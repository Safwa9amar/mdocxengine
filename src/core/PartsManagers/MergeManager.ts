/**
 * MergeManager — copy another .docx's body into THIS document, fully remapped.
 *
 * mdocxengine stores each body child as its exact original XML substring
 * (see OrderedBody). Concatenating blocks from two documents is therefore
 * byte-safe — EXCEPT for anything a block references by id across the package
 * boundary: image relationships (`r:embed`/`r:link`), footnote references
 * (`w:footnoteReference/@w:id`), numbering (`w:numId`, Phase 2) and styles.
 *
 * `appendDocument` copies the source body and rewrites those references so they
 * resolve against THIS document:
 *   - images   → copied into word/media (new rId via MediaManager.insertImage)
 *   - footnotes→ copied into word/footnotes.xml (new id via FootnoteManager)
 *   - styles   → retargeted to this document's styles by name (caller-supplied
 *                map); the combine flow normalizes everything to one profile, so
 *                source style DEFINITIONS are intentionally not imported.
 *   - equations (OMML) are inline in the paragraph XML and copied verbatim.
 *
 * The rewrite is attribute-aware and applied to EACH copied block string
 * individually — never a blind global string replace, and never a join/split
 * round-trip (block XML is full of spaces).
 */

import AdmZip from "adm-zip";
import DocumentManager from "./DocumentManager";
import { MediaManager } from "./MediaManager";
import { FootnoteManager } from "./FootnoteManager";
import { parseXml } from "@/utils/xmlUtils";
import type { BodyBlock } from "@/core/files/body/OrderedBody";
// Imported lazily inside appendDocument() to avoid an index.ts ↔ MergeManager cycle.
import type { Mdocxengine as MdocxengineType } from "@/index";

const SRC_RELS_PATH = "word/_rels/document.xml.rels";
const PAGE_BREAK_XML = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

function pageBreakBlock(): BodyBlock {
  return { kind: "paragraph", tag: "w:p", xml: PAGE_BREAK_XML };
}

export interface AppendOptions {
  /** Prepend a page break before everything this call appends. */
  startOnNewPage?: boolean;
  /** Blocks inserted BEFORE the copied source body (e.g. a part-title heading). */
  leadingBlocks?: BodyBlock[];
  /** source styleId → target styleId (applied to `<w:pStyle w:val>`). */
  styleMap?: Record<string, string>;
}

/**
 * Common French/English Word heading + body style aliases → canonical target
 * styleIds. The combine flow passes this so mismatched source heading styles map
 * onto the template's styles by name.
 */
export const DEFAULT_STYLE_ALIASES: Record<string, string> = {
  Titre1: "Heading1",
  Titre2: "Heading2",
  Titre3: "Heading3",
  Titre4: "Heading4",
  Heading1: "Heading1",
  Heading2: "Heading2",
  Heading3: "Heading3",
  Heading4: "Heading4",
  Normal: "Normal",
  Standard: "Normal",
  Corpsdetexte: "Normal",
  BodyText: "Normal",
};

export class MergeManager {
  private zip: AdmZip;
  private document: DocumentManager;
  private media: MediaManager;
  private footnotes: FootnoteManager;

  constructor(zip: AdmZip) {
    this.zip = zip;
    this.document = new DocumentManager(zip);
    this.media = new MediaManager(zip);
    this.footnotes = new FootnoteManager(zip);
  }

  /**
   * Copy `sourceBuffer`'s body into this document, fully remapped, appended after
   * the existing body (before the trailing sectPr, handled by saveBlocks).
   */
  async appendDocument(sourceBuffer: Buffer, opts: AppendOptions = {}): Promise<void> {
    const { Mdocxengine } = await import("@/index");
    const source = (await (Mdocxengine as typeof MdocxengineType).loadFromBuffer(
      sourceBuffer,
    )) as MdocxengineType;

    const srcBlocks = await source.document.getBlocks();
    const remapped = await this.remapBlocks(source, srcBlocks, opts.styleMap ?? {});

    const existing = await this.document.getBlocks();
    const prefix: BodyBlock[] = [];
    if (opts.startOnNewPage) prefix.push(pageBreakBlock());
    if (opts.leadingBlocks?.length) prefix.push(...opts.leadingBlocks);

    await this.document.saveBlocks([...existing, ...prefix, ...remapped]);
  }

  // ─── Remap orchestration ───────────────────────────────────────────────────

  /**
   * Build the id maps from a READ-ONLY concatenation of source blocks, then apply
   * them to EACH block's xml independently (kind/tag preserved verbatim).
   */
  private async remapBlocks(
    source: MdocxengineType,
    blocks: BodyBlock[],
    styleMap: Record<string, string>,
  ): Promise<BodyBlock[]> {
    const scan = blocks.map((b) => b.xml).join("\n");
    const mediaMap = await this.buildMediaMap(source, scan);
    const footnoteMap = await this.buildFootnoteMap(source, scan);

    return blocks.map((b) => {
      let xml = b.xml;
      xml = this.applyAttrMap(xml, ["r:embed", "r:link"], mediaMap);
      xml = this.applyFootnoteRefMap(xml, footnoteMap);
      xml = this.applyStyleMap(xml, styleMap);
      return { kind: b.kind, tag: b.tag, xml };
    });
  }

  // ─── Media ─────────────────────────────────────────────────────────────────

  /** Read the source document's relationships as { rId: Target }. */
  private async readSourceRels(source: MdocxengineType): Promise<Record<string, string>> {
    const xml = source.zip.readAsText(SRC_RELS_PATH);
    if (!xml) return {};
    const obj: any = await parseXml(xml);
    const raw = obj?.Relationships?.Relationship;
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const map: Record<string, string> = {};
    for (const r of arr) {
      if (r?.$?.Id && r?.$?.Target != null) map[r.$.Id] = String(r.$.Target);
    }
    return map;
  }

  /** Copy each image referenced by the blocks; return source-rId → new-rId. */
  private async buildMediaMap(
    source: MdocxengineType,
    blocksXml: string,
  ): Promise<Record<string, string>> {
    const refRIds = new Set(
      [...blocksXml.matchAll(/r:(?:embed|link)="([^"]+)"/g)].map((m) => m[1]),
    );
    if (refRIds.size === 0) return {};

    const srcRels = await this.readSourceRels(source);
    const map: Record<string, string> = {};
    for (const rId of refRIds) {
      const target = srcRels[rId];
      if (!target) continue; // not a media rel (or dangling)
      const name = target.replace(/^.*\//, ""); // "media/image1.png" → "image1.png"
      const buf = source.media.extractImage(name);
      if (!buf) continue;
      const ext = (/\.([a-zA-Z0-9]+)$/.exec(target)?.[1] ?? "png").toLowerCase();
      const { relId } = await this.media.insertImage(buf, ext);
      map[rId] = relId;
    }
    return map;
  }

  // ─── Footnotes (Phase 1: text fidelity) ──────────────────────────────────────

  /** Copy each referenced source footnote; return source-id → new-id (as strings). */
  private async buildFootnoteMap(
    source: MdocxengineType,
    blocksXml: string,
  ): Promise<Record<string, string>> {
    const refIds = new Set(
      [...blocksXml.matchAll(/<w:footnoteReference\b[^>]*\bw:id="([^"]+)"/g)].map((m) => m[1]),
    );
    if (refIds.size === 0) return {};

    const srcFns = await source.footnotes.getFootnotes(); // [{ id, text }]
    const byId = new Map(srcFns.map((f) => [String(f.id), f.text]));
    const map: Record<string, string> = {};
    for (const oldId of refIds) {
      const text = byId.get(oldId);
      if (text == null) continue; // separator / unknown → leave as-is
      const { id } = await this.footnotes.addFootnote(text);
      map[oldId] = String(id);
    }
    return map;
  }

  // ─── Attribute rewriters (scoped to the passed block xml) ───────────────────

  /** Replace attr="old" → attr="new" for each given attribute name. */
  private applyAttrMap(
    xml: string,
    attrs: string[],
    idMap: Record<string, string>,
  ): string {
    if (Object.keys(idMap).length === 0) return xml;
    let out = xml;
    for (const attr of attrs) {
      const re = new RegExp(`(${attr.replace(":", "\\:")}=")([^"]+)(")`, "g");
      out = out.replace(re, (full, p1, val, p3) => (idMap[val] ? `${p1}${idMap[val]}${p3}` : full));
    }
    return out;
  }

  /** Remap w:id ONLY inside <w:footnoteReference .../> (never other w:id). */
  private applyFootnoteRefMap(xml: string, idMap: Record<string, string>): string {
    if (Object.keys(idMap).length === 0) return xml;
    return xml.replace(/<w:footnoteReference\b[^>]*>/g, (tag) =>
      tag.replace(/\bw:id="([^"]+)"/, (full, val) => (idMap[val] ? `w:id="${idMap[val]}"` : full)),
    );
  }

  /** Retarget <w:pStyle w:val="X"/> by name. */
  private applyStyleMap(xml: string, styleMap: Record<string, string>): string {
    if (Object.keys(styleMap).length === 0) return xml;
    return xml.replace(/<w:pStyle\b[^>]*\bw:val="([^"]+)"[^>]*\/?>/g, (tag, val) =>
      styleMap[val] ? tag.replace(`w:val="${val}"`, `w:val="${styleMap[val]}"`) : tag,
    );
  }
}
