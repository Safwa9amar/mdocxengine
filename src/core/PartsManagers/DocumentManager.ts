import * as XmlUtils from "@/utils/xmlUtils";
import Paragraph from "@/core/files/paragraph/index";
import { Table } from "@/core/files/table/index";
import {
  splitDocument,
  assembleDocument,
  setParagraphText,
  paragraphText,
  type BodyBlock,
} from "@/core/files/body/OrderedBody";
import { editBodySectPr, upsertSectPrReference } from "@/core/files/body/sectPr";
import AdmZip from "adm-zip";

const DOC_PATH = "word/document.xml";

/**
 * True for body children that occupy a slot in the editable block-index space.
 * Excludes the trailing w:sectPr AND whitespace-only #text runs (left behind by
 * pretty-printing round-trips) — counting the latter as blocks would corrupt
 * every consumer's block indices. The excluded blocks stay in the document on
 * byte-safe reassembly; they're just never indexable.
 */
function isEditableBlock(b: BodyBlock): boolean {
  if (b.kind === "sectPr") return false;
  if (b.kind === "other" && b.tag === "#text" && b.xml.trim() === "") return false;
  return true;
}

export default class DocumentManager {
  zip: AdmZip;

  constructor(zip: AdmZip) {
    this.zip = zip;
  }

  // ─── Header / Footer references ───────────────────────────────────────────

  public async addHeaderReferenceToDocument(
    relId: string,
    type: "default" | "first" | "even" = "default",
  ) {
    await this._addSectPrReference("w:headerReference", relId, type);
  }

  public async addFooterReferenceToDocument(
    relId: string,
    type: "default" | "first" | "even" = "default",
  ) {
    await this._addSectPrReference("w:footerReference", relId, type);
  }

  private async _addSectPrReference(
    refTag: "w:headerReference" | "w:footerReference",
    relId: string,
    type: string,
  ) {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;
    // Byte-safe: edit only the body's <w:sectPr>, never rebuild the whole body
    // (which would reorder tables). Replaces any existing ref of the same type.
    const kind = refTag === "w:headerReference" ? "header" : "footer";
    const next = editBodySectPr(xml, (s) => upsertSectPrReference(s, kind, type, relId));
    this.zip.addFile(DOC_PATH, Buffer.from(next, "utf-8"));
  }

  // ─── Paragraph read API ───────────────────────────────────────────────────

  /**
   * Returns the top-level body paragraphs from word/document.xml.
   * Only direct children of <w:body> are returned — paragraphs nested
   * inside table cells are not included, preventing duplication on
   * round-trips through saveChanges().
   */
  public async getParagraphs(): Promise<Paragraph[]> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return [];

    const docObj = await XmlUtils.parseXml(xml);
    const body   = this._getBody(docObj);
    if (!body) return [];

    const raw = body["w:p"];
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((p: any) => new Paragraph(p));
  }

  /**
   * Returns the paragraph whose w14:paraId matches, or null.
   */
  public async getParagraphById(paraId: string): Promise<Paragraph | null> {
    const paragraphs = await this.getParagraphs();
    return paragraphs.find((p) => p.paragraph.$?.["w14:paraId"] === paraId) ?? null;
  }

  /**
   * Returns the paragraph at the given zero-based index, or null.
   */
  public async getParagraphByIndex(index: number): Promise<Paragraph | null> {
    const paragraphs = await this.getParagraphs();
    return paragraphs[index] ?? null;
  }

  // ─── Paragraph write API ──────────────────────────────────────────────────

  /**
   * Writes a full Paragraph[] back to word/document.xml, preserving <w:sectPr>.
   */
  public async saveChanges(paragraphs: Paragraph[]): Promise<void> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;

    const docObj = await XmlUtils.parseXml(xml);
    const body = this._getBody(docObj);
    if (!body) return;

    const sectPr = body["w:sectPr"];
    body["w:p"] = paragraphs.map((p) => p.paragraph);
    if (sectPr) body["w:sectPr"] = sectPr;

    await this._writeDoc(docObj);
  }

  /**
   * Inserts a paragraph at the given index (appends if no index given).
   */
  public async insertParagraph(paragraph: Paragraph, index?: number): Promise<void> {
    const paragraphs = await this.getParagraphs();

    if (index === undefined || index >= paragraphs.length) {
      paragraphs.push(paragraph);
    } else {
      paragraphs.splice(Math.max(0, index), 0, paragraph);
    }

    await this.saveChanges(paragraphs);
  }

  /**
   * Removes the paragraph whose w14:paraId matches.
   */
  public async deleteParagraph(paraId: string): Promise<void> {
    const paragraphs = await this.getParagraphs();
    const filtered = paragraphs.filter((p) => p.paragraph.$?.["w14:paraId"] !== paraId);
    await this.saveChanges(filtered);
  }

  /**
   * Replaces the paragraph whose w14:paraId matches with newParagraph.
   */
  public async replaceParagraph(paraId: string, newParagraph: Paragraph): Promise<void> {
    const paragraphs = await this.getParagraphs();
    const idx = paragraphs.findIndex((p) => p.paragraph.$?.["w14:paraId"] === paraId);
    if (idx === -1) throw new Error(`Paragraph not found: ${paraId}`);
    paragraphs[idx] = newParagraph;
    await this.saveChanges(paragraphs);
  }

  /**
   * Finds and replaces text across every paragraph in the document.
   * @param search   String or RegExp to search for.
   * @param replace  Replacement string.
   */
  public async findAndReplaceAll(search: string | RegExp, replace: string): Promise<void> {
    const paragraphs = await this.getParagraphs();
    const searchStr = search instanceof RegExp ? search.source : search;
    paragraphs.forEach((p) => p.replaceText(searchStr, replace));
    await this.saveChanges(paragraphs);
  }

  // ─── Table API ────────────────────────────────────────────────────────────

  /**
   * Returns all tables in word/document.xml as Table instances.
   */
  public async getTables(): Promise<Table[]> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return [];

    const docObj = await XmlUtils.parseXml(xml);
    const body = this._getBody(docObj);
    if (!body) return [];

    const raw = body["w:tbl"];
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];
    return arr.map((t: any) => new Table(t));
  }

  /**
   * Inserts a Table into the document body at the given index (appends if omitted).
   */
  public async insertTable(table: Table, index?: number): Promise<void> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;

    const docObj = await XmlUtils.parseXml(xml);
    const body = this._getBody(docObj);
    if (!body) return;

    // Collect body children as ordered array preserving paragraphs and tables
    const children: { tag: string; obj: any }[] = [];
    const paragraphs: any[] = Array.isArray(body["w:p"])
      ? body["w:p"]
      : body["w:p"]
        ? [body["w:p"]]
        : [];
    const tables: any[] = Array.isArray(body["w:tbl"])
      ? body["w:tbl"]
      : body["w:tbl"]
        ? [body["w:tbl"]]
        : [];

    paragraphs.forEach((p) => children.push({ tag: "w:p", obj: p }));
    tables.forEach((t) => children.push({ tag: "w:tbl", obj: t }));

    const newEntry = { tag: "w:tbl", obj: table.toObject() };
    if (index === undefined || index >= children.length) {
      children.push(newEntry);
    } else {
      children.splice(Math.max(0, index), 0, newEntry);
    }

    body["w:p"] = children.filter((c) => c.tag === "w:p").map((c) => c.obj);
    body["w:tbl"] = children.filter((c) => c.tag === "w:tbl").map((c) => c.obj);

    await this._writeDoc(docObj);
  }

  // ─── Ordered body-block API (order-faithful, string-level OrderedBody) ────
  //
  // This is a SEPARATE representation from the xml2js-based getParagraphs /
  // saveChanges path above. It reads word/document.xml as an ordered list of
  // body children (paragraphs, tables, drawing-bearing paragraphs), each kept
  // as its EXACT original XML substring, and writes it back preserving order +
  // content byte-for-byte — including images and the trailing w:sectPr.
  //
  // INDEX SEMANTICS: `index` refers to the position in the ordered *editable*
  // block list, which is every top-level body child EXCEPT the trailing
  // w:sectPr (it stays in the document but is never indexable). Because an
  // untouched block is never re-serialized, editing one paragraph can never
  // corrupt a sibling table or drawing.

  /**
   * Returns the body's ordered editable blocks (paragraphs / tables /
   * drawings) in document order, EXCLUDING the trailing w:sectPr (which stays
   * in the document). Each block carries its exact original XML substring.
   */
  public async getBlocks(): Promise<BodyBlock[]> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return [];
    return splitDocument(xml).blocks.filter(isEditableBlock);
  }

  /**
   * Plain text of the whole document body: every block's visible text, joined by
   * the given separator (default newline). Blank/whitespace-only blocks are
   * dropped. Useful for word counts, search indexing, or AI classification.
   */
  public async getPlainText(separator = "\n"): Promise<string> {
    const blocks = await this.getBlocks();
    return blocks
      .map((b) => paragraphText(b.xml))
      .filter((t) => t && t.trim())
      .join(separator);
  }

  /** Total word count of the document body (whitespace-delimited). */
  public async getWordCount(): Promise<number> {
    const text = await this.getPlainText(" ");
    return text.split(/\s+/).filter(Boolean).length;
  }

  /**
   * Replaces the body's editable children with `blocks` (in order), preserving
   * the existing trailing w:sectPr exactly, and writes document.xml. Callers
   * pass only the editable blocks; the sectPr is re-appended automatically.
   */
  public async saveBlocks(blocks: BodyBlock[]): Promise<void> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;
    const split = splitDocument(xml);

    const sectPr = split.blocks.filter((b) => b.kind === "sectPr");
    const next = [...blocks, ...sectPr];

    this._writeBody({ ...split, blocks: next });
  }

  /**
   * Replaces the run text of the editable block at `index` (must be a
   * paragraph). Rewrites ONLY that paragraph's XML substring; every other
   * block — tables, drawings, sectPr — keeps its exact original bytes.
   */
  public async editParagraphText(index: number, text: string): Promise<void> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;
    const split = splitDocument(xml);

    const editablePositions = split.blocks
      .map((b, i) => ({ b, i }))
      .filter((e) => isEditableBlock(e.b))
      .map((e) => e.i);

    const pos = editablePositions[index];
    if (pos === undefined) {
      throw new Error(`editParagraphText: no block at index ${index}`);
    }
    const block = split.blocks[pos];
    if (block.kind !== "paragraph") {
      throw new Error(
        `editParagraphText: block at index ${index} is a ${block.kind}, not a paragraph`,
      );
    }

    block.xml = setParagraphText(block.xml, text);
    this._writeBody(split);
  }

  /**
   * Inserts `block` at editable position `index` (appends before sectPr if the
   * index is out of range), keeping sectPr last. Use
   * OrderedBody.makeParagraphNode to build a paragraph block.
   */
  public async insertBlockAt(block: BodyBlock, index: number): Promise<void> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;
    const split = splitDocument(xml);

    const editablePositions = split.blocks
      .map((b, i) => ({ b, i }))
      .filter((e) => isEditableBlock(e.b))
      .map((e) => e.i);

    let target: number;
    if (index <= 0) {
      target = editablePositions[0] ?? split.blocks.length;
    } else if (index >= editablePositions.length) {
      // Append after the last editable block (i.e. before any sectPr).
      const last = editablePositions[editablePositions.length - 1];
      target = last === undefined ? split.blocks.length : last + 1;
    } else {
      target = editablePositions[index];
    }

    split.blocks.splice(target, 0, block);
    this._writeBody(split);
  }

  /** Removes the editable block at `index`. */
  public async deleteBlockAt(index: number): Promise<void> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;
    const split = splitDocument(xml);

    const editablePositions = split.blocks
      .map((b, i) => ({ b, i }))
      .filter((e) => isEditableBlock(e.b))
      .map((e) => e.i);

    const pos = editablePositions[index];
    if (pos === undefined) {
      throw new Error(`deleteBlockAt: no block at index ${index}`);
    }
    split.blocks.splice(pos, 1);
    this._writeBody(split);
  }

  // ─── Block-indexed paragraph formatting (order + run preserving) ──────────
  //
  // These mirror Doc.editTableCell's round-trip for paragraphs: getBlocks →
  // Paragraph.createFromXml → mutate → buildXml(node, {rootName:"w:p",...}) →
  // saveBlocks. Only the target block's XML is rewritten; every sibling block
  // keeps its exact original bytes and the sectPr stays last.

  /**
   * Set the paragraph style at block `index`, preserving order + runs.
   * "Normal" demotes to body (drops w:pStyle + w:outlineLvl). "Heading{n}"
   * sets the style AND w:outlineLvl = n-1 so the outline/TOC detects it.
   */
  public async setBlockStyle(index: number, styleId: string): Promise<void> {
    const blocks = await this.getBlocks();
    const b = blocks[index];
    if (!b || b.kind !== "paragraph" || b.xml.includes("<w:drawing>")) {
      throw new Error(`setBlockStyle: no text paragraph at block index ${index}`);
    }
    const p = await Paragraph.createFromXml(b.xml);
    if (styleId === "Normal") {
      p.applyStyle("Normal");
      // applyStyle() runs ensurePPr(), which REBUILDS this.paragraph when the
      // paragraph had no <w:pPr>. Read the node AFTER, or a pre-captured
      // reference would point at the discarded object (and lack w:pPr).
      const node = (p as any).paragraph;
      delete node["w:pPr"]["w:pStyle"];
      delete node["w:pPr"]["w:outlineLvl"];
    } else {
      p.applyStyle(styleId);
      const node = (p as any).paragraph;
      const m = /^Heading([1-6])$/.exec(styleId);
      if (m) node["w:pPr"]["w:outlineLvl"] = { $: { "w:val": String(Number(m[1]) - 1) } };
    }
    blocks[index] = {
      ...b,
      xml: XmlUtils.buildXml((p as any).paragraph, { rootName: "w:p", headless: true, pretty: false }),
    };
    await this.saveBlocks(blocks);
  }

  /** Set paragraph alignment at block `index`, preserving order + runs. */
  public async setBlockAlignment(
    index: number,
    alignment: "left" | "center" | "right" | "both",
  ): Promise<void> {
    const blocks = await this.getBlocks();
    const b = blocks[index];
    if (!b || b.kind !== "paragraph" || b.xml.includes("<w:drawing>")) {
      throw new Error(`setBlockAlignment: no text paragraph at block index ${index}`);
    }
    const p = await Paragraph.createFromXml(b.xml);
    p.setAlignment(alignment);
    blocks[index] = {
      ...b,
      xml: XmlUtils.buildXml((p as any).paragraph, { rootName: "w:p", headless: true, pretty: false }),
    };
    await this.saveBlocks(blocks);
  }

  /**
   * Set paragraph text direction at block `index` via <w:bidi>, preserving order
   * + runs. "rtl" → <w:bidi/> (right-to-left); "ltr" → <w:bidi w:val="0"/> (an
   * explicit left-to-right marker, so it overrides an RTL style default).
   */
  public async setBlockDirection(index: number, direction: "rtl" | "ltr"): Promise<void> {
    const blocks = await this.getBlocks();
    const b = blocks[index];
    if (!b || b.kind !== "paragraph" || b.xml.includes("<w:drawing>")) {
      throw new Error(`setBlockDirection: no text paragraph at block index ${index}`);
    }
    const p = await Paragraph.createFromXml(b.xml);
    // ensurePPr() is private but guarantees <w:pPr> exists and is first — the same
    // hook applyStyle()/setAlignment() rely on.
    (p as unknown as { ensurePPr(): void }).ensurePPr();
    (p as any).paragraph["w:pPr"]["w:bidi"] =
      direction === "rtl" ? {} : { $: { "w:val": "0" } };
    blocks[index] = {
      ...b,
      xml: XmlUtils.buildXml((p as any).paragraph, { rootName: "w:p", headless: true, pretty: false }),
    };
    await this.saveBlocks(blocks);
  }

  /** Strip run-level formatting (bold/italic/font) at block `index`; keeps text. */
  public async clearBlockFormatting(index: number): Promise<void> {
    const blocks = await this.getBlocks();
    const b = blocks[index];
    if (!b || b.kind !== "paragraph" || b.xml.includes("<w:drawing>")) {
      throw new Error(`clearBlockFormatting: no text paragraph at block index ${index}`);
    }
    const p = await Paragraph.createFromXml(b.xml);
    p.removeFormatting();
    blocks[index] = {
      ...b,
      xml: XmlUtils.buildXml((p as any).paragraph, { rootName: "w:p", headless: true, pretty: false }),
    };
    await this.saveBlocks(blocks);
  }

  /**
   * Move the block at `from` to position `to`, preserving every block's bytes.
   * Pure array reorder over the ordered block model — the moved block and all
   * others keep their exact XML; only their sequence changes.
   */
  public async moveBlock(from: number, to: number): Promise<void> {
    const blocks = await this.getBlocks();
    const last = blocks.length - 1;
    if (from < 0 || from > last || to < 0 || to > last) {
      throw new Error(`moveBlock: index out of range (from=${from}, to=${to}, len=${blocks.length})`);
    }
    if (from === to) return;
    const [moved] = blocks.splice(from, 1);
    blocks.splice(to, 0, moved);
    await this.saveBlocks(blocks);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private _writeBody(split: {
    pre: string;
    blocks: BodyBlock[];
    post: string;
  }): void {
    const newXml = assembleDocument(split);
    this.zip.addFile(DOC_PATH, Buffer.from(newXml, "utf-8"));
  }

  private _getBody(docObj: any): any | null {
    const doc = docObj["w:document"] ?? docObj.document;
    if (!doc) return null;
    return doc["w:body"] ?? doc.body ?? null;
  }

  private async _writeDoc(docObj: any): Promise<void> {
    const newXml = XmlUtils.buildXml(docObj["w:document"], {
      rootName: "w:document",
      headless: false,
      pretty: true,
    });
    this.zip.addFile(DOC_PATH, Buffer.from(newXml, "utf-8"));
  }
}
