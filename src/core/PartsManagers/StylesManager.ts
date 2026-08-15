import * as XmlUtils from "@/utils/xmlUtils";
import AdmZip from "adm-zip";
import { canonicalizeRunProps, canonicalizeStyleChildren } from "@/core/ooxml/canonicalOrder";
import { mergeRunProps, type RunProps } from "@/core/ooxml/runProps";
import { toHalfPoints } from "@/core/ooxml/hps";

const STYLES_PATH = "word/styles.xml";

export interface StyleEntry {
  id: string;
  name: string;
  type: string;
}

/** Run-level formatting to force onto a heading style's `<w:rPr>`. Only the
 *  provided fields are touched. */
export interface HeadingRunFormatting {
  /** Font size in POINTS (written as half-points to `<w:sz>`/`<w:szCs>`). */
  fontSizePt?: number;
  /** true adds `<w:b/><w:bCs/>`; false removes them. */
  bold?: boolean;
  /** Hex colour, with or without leading '#'. */
  color?: string;
}

/** Which `HeadingN` styles were found (and rewritten) vs. missing from styles.xml. */
export interface HeadingStyleResult {
  updatedLevels: number[];
  missingLevels: number[];
}

const selfClosingTag = (tag: string): RegExp => new RegExp(`<w:${tag}\\b[^>]*/>`, "g");

/** Strip every self-closing `<w:TAG .../>` occurrence from a fragment. */
function stripTag(xml: string, tag: string): string {
  return xml.replace(selfClosingTag(tag), "");
}

/**
 * Rewrite the INSIDE of a `<w:rPr>…</w:rPr>` fragment, replacing (or removing)
 * only the bold/color/size elements `formatting` specifies; every other child
 * (e.g. `<w:i/>`, `<w:rFonts/>`) is left untouched in its original position.
 * New elements are (re)inserted in CT_RPr schema order: b/bCs, …, color, …,
 * sz/szCs.
 */
function rewriteHeadingRunProps(rPrInner: string, formatting: HeadingRunFormatting): string {
  let body = rPrInner;
  let boldTags = "";
  if (formatting.bold !== undefined) {
    body = stripTag(stripTag(body, "b"), "bCs");
    if (formatting.bold) boldTags = `<w:b/><w:bCs/>`;
  }

  let colorTag = "";
  if (formatting.color !== undefined) {
    body = stripTag(body, "color");
    colorTag = `<w:color w:val="${formatting.color.replace(/^#/, "").toUpperCase()}"/>`;
  }

  let sizeTags = "";
  if (formatting.fontSizePt !== undefined) {
    body = stripTag(stripTag(body, "sz"), "szCs");
    const halfPts = toHalfPoints(formatting.fontSizePt, "heading style fontSizePt");
    sizeTags = `<w:sz w:val="${halfPts}"/><w:szCs w:val="${halfPts}"/>`;
  }

  return canonicalizeRunProps(`${boldTags}${body}${colorTag}${sizeTags}`);
}

/** Rewrite one `<w:style … w:styleId="HeadingN">…</w:style>` block's `<w:rPr>`. */
function rewriteHeadingStyleBlock(styleBlock: string, formatting: HeadingRunFormatting): string {
  const rPrMatch = styleBlock.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
  if (rPrMatch) {
    const newInner = rewriteHeadingRunProps(rPrMatch[1], formatting);
    return styleBlock.replace(rPrMatch[0], `<w:rPr>${newInner}</w:rPr>`);
  }

  const newInner = rewriteHeadingRunProps("", formatting);
  if (!newInner) return styleBlock;
  const insertion = `<w:rPr>${newInner}</w:rPr>`;
  const nameMatch = styleBlock.match(/<w:name\b[^>]*\/>/);
  if (nameMatch) return styleBlock.replace(nameMatch[0], `${nameMatch[0]}${insertion}`);
  return styleBlock.replace(/(<w:style\b[^>]*>)/, `$1${insertion}`);
}

/**
 * Pure transform: force `formatting` onto the `Heading{level}` styles (1–6)
 * listed in `levels`, inside a `word/styles.xml` string. A style-level change —
 * not a per-run override — so it applies uniformly to every existing heading
 * that uses that style AND any new one added afterwards (matching how
 * `Doc.setHeadingLevel`/`addHeading` only ever set `w:pStyle`, never bold/size/
 * color directly). Returns the rewritten XML plus which levels existed.
 */
export function applyHeadingStyleToXml(
  stylesXml: string,
  levels: number[],
  formatting: HeadingRunFormatting,
): { xml: string; result: HeadingStyleResult } {
  let xml = stylesXml;
  const updatedLevels: number[] = [];
  const missingLevels: number[] = [];

  for (const level of levels) {
    const styleId = `Heading${level}`;
    const blockRe = new RegExp(`<w:style\\b[^>]*w:styleId="${styleId}"[^>]*>[\\s\\S]*?<\\/w:style>`);
    const match = blockRe.exec(xml);
    if (!match) {
      missingLevels.push(level);
      continue;
    }
    const rewritten = rewriteHeadingStyleBlock(match[0], formatting);
    xml = xml.slice(0, match.index) + rewritten + xml.slice(match.index + match[0].length);
    updatedLevels.push(level);
  }

  return { xml, result: { updatedLevels, missingLevels } };
}

/** How to create a paragraph style that does not exist yet. */
export interface EnsureStyleSpec {
  /** `w:name` — Word's display name. Maps the style onto a built-in when it matches. */
  name: string;
  /** `w:basedOn` target, omitted when absent. */
  basedOn?: string;
  /** Emit `w:default="1"` — used for `Normal`. */
  isDefault?: boolean;
}

/** Build a minimal, schema-ordered paragraph `<w:style>`. */
export function buildParagraphStyleXml(
  styleId: string,
  name: string,
  opts: { basedOn?: string; isDefault?: boolean } = {},
): string {
  const defaultAttr = opts.isDefault ? ` w:default="1"` : "";
  const basedOn = opts.basedOn ? `<w:basedOn w:val="${opts.basedOn}"/>` : "";
  return (
    `<w:style w:type="paragraph"${defaultAttr} w:styleId="${styleId}">` +
    `<w:name w:val="${name}"/>${basedOn}<w:qFormat/>` +
    `</w:style>`
  );
}

/**
 * Pure transform: apply `props` to the `<w:rPr>` of the `styleId` style inside a
 * `word/styles.xml` string, creating the style first when `ensure` is supplied
 * and it does not exist. Returns the rewritten XML plus whether the style was
 * created and whether it ended up changed.
 *
 * The seed `thesis-base.docx` defines neither `Normal` nor `Caption`, so the
 * create path is the ordinary one, not an error path.
 *
 * @throws if the style fragment is malformed markup (propagated from
 * `canonicalizeRunProps`). This operates on ONE small styles fragment, not
 * per-run, so failing loudly is correct — a broken `styles.xml` must not be
 * half-applied. Callers doing PER-RUN work must catch per run instead.
 */
export function applyStyleRunPropsToXml(
  stylesXml: string,
  styleId: string,
  props: RunProps,
  ensure?: EnsureStyleSpec,
): { xml: string; created: boolean; updated: boolean } {
  let xml = stylesXml;
  let created = false;

  const blockRe = new RegExp(`<w:style\\b[^>]*w:styleId="${styleId}"[^>]*>[\\s\\S]*?<\\/w:style>`);
  if (!blockRe.test(xml)) {
    if (!ensure) return { xml, created: false, updated: false };
    const fresh = buildParagraphStyleXml(styleId, ensure.name, {
      basedOn: ensure.basedOn,
      isDefault: ensure.isDefault,
    });
    xml = xml.replace(/<\/w:styles>\s*$/, `${fresh}</w:styles>`);
    created = true;
  }

  const match = blockRe.exec(xml);
  if (!match) return { xml, created, updated: false };

  const block = match[0];
  const rPrMatch = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(block);
  const nextInner = mergeRunProps(rPrMatch ? rPrMatch[1] : "", props);

  let rewritten: string;
  if (rPrMatch) {
    rewritten = block.replace(rPrMatch[0], `<w:rPr>${nextInner}</w:rPr>`);
  } else if (nextInner) {
    const inner = /^(<w:style\b[^>]*>)([\s\S]*)(<\/w:style>)$/.exec(block);
    if (!inner) return { xml, created, updated: false };
    const children = canonicalizeStyleChildren(`${inner[2]}<w:rPr>${nextInner}</w:rPr>`);
    rewritten = `${inner[1]}${children}${inner[3]}`;
  } else {
    return { xml, created, updated: false };
  }

  xml = xml.slice(0, match.index) + rewritten + xml.slice(match.index + block.length);
  return { xml, created, updated: true };
}

export class StylesManager {
  private zip: AdmZip;

  constructor(zip: AdmZip) {
    this.zip = zip;
  }

  private async readStyles(): Promise<any> {
    const xml = this.zip.readAsText(STYLES_PATH);
    if (!xml) return { "w:styles": { "w:style": [] } };
    return XmlUtils.parseXml(xml);
  }

  private async writeStyles(obj: any): Promise<void> {
    const xml = XmlUtils.buildXml(obj["w:styles"], {
      rootName: "w:styles",
      headless: false,
      pretty: true,
    });
    this.zip.addFile(STYLES_PATH, Buffer.from(xml, "utf-8"));
  }

  private normalizeStylesArray(obj: any): any[] {
    const raw = obj?.["w:styles"]?.["w:style"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  /**
   * Lists all styles in the document.
   */
  public async listStyles(): Promise<StyleEntry[]> {
    const obj = await this.readStyles();
    return this.normalizeStylesArray(obj).map((s: any) => ({
      id: s.$?.["w:styleId"] ?? "",
      name: s["w:name"]?.$?.["w:val"] ?? "",
      type: s.$?.["w:type"] ?? "",
    }));
  }

  /**
   * Returns the raw style object for a given style ID, or null.
   */
  public async getStyle(styleId: string): Promise<any | null> {
    const obj = await this.readStyles();
    return (
      this.normalizeStylesArray(obj).find((s: any) => s.$?.["w:styleId"] === styleId) ?? null
    );
  }

  /**
   * Adds a new style. Does nothing if a style with the same ID already exists.
   */
  public async addStyle(styleObj: any): Promise<void> {
    const obj = await this.readStyles();
    const styles = this.normalizeStylesArray(obj);
    const id = styleObj.$?.["w:styleId"];

    if (id && styles.some((s: any) => s.$?.["w:styleId"] === id)) return;

    styles.push(styleObj);
    obj["w:styles"]["w:style"] = styles;
    await this.writeStyles(obj);
  }

  /**
   * Removes a style by ID.
   */
  public async removeStyle(styleId: string): Promise<void> {
    const obj = await this.readStyles();
    const styles = this.normalizeStylesArray(obj);
    obj["w:styles"]["w:style"] = styles.filter(
      (s: any) => s.$?.["w:styleId"] !== styleId,
    );
    await this.writeStyles(obj);
  }

  /**
   * Forces `formatting` (font size / bold / color) onto the `Heading{level}`
   * styles for the given `levels` (default 1–6) — a STYLE-level change, so it
   * applies uniformly to every heading using that level, present and future,
   * rather than one paragraph's run. See {@link applyHeadingStyleToXml}.
   */
  public async setHeadingStyle(
    levels: number[] = [1, 2, 3, 4, 5, 6],
    formatting: HeadingRunFormatting,
  ): Promise<HeadingStyleResult> {
    const xml = this.zip.readAsText(STYLES_PATH) ?? "";
    const { xml: out, result } = applyHeadingStyleToXml(xml, levels, formatting);
    this.zip.addFile(STYLES_PATH, Buffer.from(out, "utf-8"));
    return result;
  }

  /**
   * Ensure `styleId` exists (creating it from `ensure` when missing), then apply
   * `props` to its `<w:rPr>`. A STYLE-level change: it reaches every paragraph
   * using the style, present and future.
   */
  public async setStyleRunProps(
    styleId: string,
    props: RunProps,
    ensure?: EnsureStyleSpec,
  ): Promise<{ created: boolean; updated: boolean }> {
    const xml = this.zip.readAsText(STYLES_PATH) ?? "";
    const { xml: out, created, updated } = applyStyleRunPropsToXml(xml, styleId, props, ensure);
    if (created || updated) this.zip.addFile(STYLES_PATH, Buffer.from(out, "utf-8"));
    return { created, updated };
  }
}
