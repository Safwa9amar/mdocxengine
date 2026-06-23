import * as XmlUtils from "@/utils/xmlUtils";
import Paragraph from "@/core/files/paragraph/index";
import { Table } from "@/core/files/table/index";
import {
  parseOrderedDoc,
  buildOrderedDoc,
  toBlocks,
  setParagraphText,
  type BodyBlock,
} from "@/core/files/body/OrderedBody";
import AdmZip from "adm-zip";

const DOC_PATH = "word/document.xml";

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

    const docObj = await XmlUtils.parseXml(xml);
    const body = this._getBody(docObj);
    if (!body) return;

    if (!body["w:sectPr"]) body["w:sectPr"] = {};
    const sectPr = body["w:sectPr"];

    if (!sectPr[refTag]) {
      sectPr[refTag] = [];
    } else if (!Array.isArray(sectPr[refTag])) {
      sectPr[refTag] = [sectPr[refTag]];
    }

    sectPr[refTag].push({ $: { "r:id": relId, "w:type": type } });

    await this._writeDoc(docObj);
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

  // ─── Ordered body-block API (order-faithful, via OrderedBody) ─────────────
  //
  // This is a SEPARATE representation from the xml2js-based getParagraphs /
  // saveChanges path above. It reads word/document.xml as an ordered list of
  // body children (paragraphs, tables, drawing-bearing paragraphs) and writes
  // it back preserving order + content exactly, including images and the
  // trailing w:sectPr. `index` always refers to the position in the ordered
  // *editable* block list (everything except sectPr).

  /**
   * Returns the body's ordered blocks (paragraphs / tables / drawings) in
   * document order, EXCLUDING the trailing w:sectPr (which stays in the doc).
   */
  public async getBlocks(): Promise<BodyBlock[]> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return [];
    const { bodyChildren } = parseOrderedDoc(xml);
    return toBlocks(bodyChildren).filter((b) => b.kind !== "sectPr");
  }

  /**
   * Replaces the body's editable children with `blocks` (in order), preserving
   * the existing trailing w:sectPr, and writes document.xml.
   */
  public async saveBlocks(blocks: BodyBlock[]): Promise<void> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;
    const { doc, bodyChildren } = parseOrderedDoc(xml);

    const sectPr = toBlocks(bodyChildren).find((b) => b.kind === "sectPr");
    const next = blocks.map((b) => b.node);
    if (sectPr) next.push(sectPr.node);

    // Mutate the live body-children array in place so `doc` reflects the change.
    bodyChildren.length = 0;
    bodyChildren.push(...next);

    await this._writeOrderedDoc(doc);
  }

  /**
   * Replaces the w:t run text of the editable block at `index` (must be a
   * paragraph). Leaves all other blocks — tables, drawings — untouched and in
   * their exact positions.
   */
  public async editParagraphText(index: number, text: string): Promise<void> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;
    const { doc, bodyChildren } = parseOrderedDoc(xml);

    const editable = toBlocks(bodyChildren).filter((b) => b.kind !== "sectPr");
    const block = editable[index];
    if (!block) throw new Error(`editParagraphText: no block at index ${index}`);
    if (block.kind !== "paragraph") {
      throw new Error(`editParagraphText: block at index ${index} is a ${block.kind}, not a paragraph`);
    }

    setParagraphText(block.node, text);
    await this._writeOrderedDoc(doc);
  }

  /**
   * Inserts `block` at editable position `index` (appends if index is out of
   * range), keeping sectPr last. Use OrderedBody.makeParagraphNode to build a
   * paragraph block node.
   */
  public async insertBlockAt(block: BodyBlock, index: number): Promise<void> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;
    const { doc, bodyChildren } = parseOrderedDoc(xml);

    // Find where sectPr sits among the raw children (so we never insert past it).
    const sectPrPos = bodyChildren.findIndex(
      (n) => toBlocks([n])[0].kind === "sectPr",
    );
    const editableCount =
      sectPrPos === -1 ? bodyChildren.length : sectPrPos;

    const target = index < 0 ? 0 : Math.min(index, editableCount);
    bodyChildren.splice(target, 0, block.node);

    await this._writeOrderedDoc(doc);
  }

  /** Removes the editable block at `index`. */
  public async deleteBlockAt(index: number): Promise<void> {
    const xml = this.zip.readAsText(DOC_PATH);
    if (!xml) return;
    const { doc, bodyChildren } = parseOrderedDoc(xml);

    const editablePositions = bodyChildren
      .map((n, i) => ({ i, kind: toBlocks([n])[0].kind }))
      .filter((e) => e.kind !== "sectPr")
      .map((e) => e.i);

    const pos = editablePositions[index];
    if (pos === undefined) {
      throw new Error(`deleteBlockAt: no block at index ${index}`);
    }
    bodyChildren.splice(pos, 1);

    await this._writeOrderedDoc(doc);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async _writeOrderedDoc(doc: any[]): Promise<void> {
    const newXml = buildOrderedDoc(doc);
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
