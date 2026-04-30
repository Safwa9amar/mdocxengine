import * as XmlUtils from "@/utils/xmlUtils";
import { Run as RunInterface } from "@/core/files/paragraph/types";
import AdmZip from "adm-zip";

const DOCUMENT_PATH = "word/document.xml";

export interface BookmarkEntry {
  id: number;
  name: string;
  text: string;
}

export class CrossReferenceManager {
  private zip: AdmZip;

  constructor(zip: AdmZip) {
    this.zip = zip;
  }

  private async readDocument(): Promise<any> {
    const xml = this.zip.readAsText(DOCUMENT_PATH);
    if (!xml) throw new Error("word/document.xml not found");
    return XmlUtils.parseXml(xml);
  }

  private async writeDocument(obj: any): Promise<void> {
    const xml = XmlUtils.buildXml(obj["w:document"], {
      rootName: "w:document",
      headless: false,
      pretty: true,
    });
    this.zip.addFile(DOCUMENT_PATH, Buffer.from(xml, "utf-8"));
  }

  private getAllParagraphs(body: any): any[] {
    const raw = body["w:p"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  private nextBookmarkId(paragraphs: any[]): number {
    let max = 0;
    for (const p of paragraphs) {
      for (const key of ["w:bookmarkStart", "w:bookmarkEnd"]) {
        const bm = p[key];
        if (!bm) continue;
        const arr = Array.isArray(bm) ? bm : [bm];
        for (const b of arr) {
          const id = parseInt(b.$?.["w:id"] ?? "0", 10);
          if (id > max) max = id;
        }
      }
    }
    return max + 1;
  }

  /**
   * Returns all bookmarks defined in the document.
   */
  public async getBookmarks(): Promise<BookmarkEntry[]> {
    const obj = await this.readDocument();
    const body = obj["w:document"]["w:body"];
    const paragraphs = this.getAllParagraphs(body);
    const result: BookmarkEntry[] = [];

    for (const p of paragraphs) {
      const starts = p["w:bookmarkStart"];
      if (!starts) continue;
      const arr = Array.isArray(starts) ? starts : [starts];
      for (const bm of arr) {
        const id = parseInt(bm.$?.["w:id"] ?? "-1", 10);
        const name = bm.$?.["w:name"] ?? "";
        if (id < 0 || !name) continue;

        const runs = p["w:r"];
        const runsArr = runs ? (Array.isArray(runs) ? runs : [runs]) : [];
        const text = runsArr
          .map((r: any) => {
            const t = r["w:t"];
            if (!t) return "";
            return typeof t === "string" ? t : (t._ ?? "");
          })
          .join("")
          .trim();

        result.push({ id, name, text });
      }
    }

    return result;
  }

  /**
   * Add a bookmark wrapping a run in the paragraph at the given body index.
   * Returns the bookmark id.
   */
  public async addBookmark(
    paragraphIndex: number,
    name: string,
    text: string,
  ): Promise<number> {
    const obj = await this.readDocument();
    const body = obj["w:document"]["w:body"];
    const paragraphs = this.getAllParagraphs(body);
    const id = this.nextBookmarkId(paragraphs);

    const clampedIndex = Math.max(0, Math.min(paragraphIndex, paragraphs.length - 1));

    const para = paragraphs[clampedIndex];

    para["w:bookmarkStart"] = { $: { "w:id": String(id), "w:name": name } };
    para["w:bookmarkEnd"] = { $: { "w:id": String(id) } };

    const existingRuns = para["w:r"];
    const runsArr = existingRuns
      ? Array.isArray(existingRuns)
        ? existingRuns
        : [existingRuns]
      : [];

    if (text) {
      runsArr.push({ "w:t": { _: text, $: { "xml:space": "preserve" } } });
    }
    para["w:r"] = runsArr;

    body["w:p"] = paragraphs;
    await this.writeDocument(obj);
    return id;
  }

  /**
   * Remove a bookmark by name (removes bookmarkStart/End from the paragraph).
   */
  public async removeBookmark(name: string): Promise<void> {
    const obj = await this.readDocument();
    const body = obj["w:document"]["w:body"];
    const paragraphs = this.getAllParagraphs(body);

    for (const p of paragraphs) {
      const starts = p["w:bookmarkStart"];
      if (!starts) continue;
      const arr = Array.isArray(starts) ? starts : [starts];
      const match = arr.find((b: any) => b.$?.["w:name"] === name);
      if (!match) continue;

      const filteredStarts = arr.filter((b: any) => b.$?.["w:name"] !== name);
      p["w:bookmarkStart"] = filteredStarts.length === 1 ? filteredStarts[0] : filteredStarts.length === 0 ? undefined : filteredStarts;

      const ends = p["w:bookmarkEnd"];
      if (ends) {
        const endsArr = Array.isArray(ends) ? ends : [ends];
        const filteredEnds = endsArr.filter((b: any) => b.$?.["w:id"] !== match.$?.["w:id"]);
        p["w:bookmarkEnd"] = filteredEnds.length === 1 ? filteredEnds[0] : filteredEnds.length === 0 ? undefined : filteredEnds;
      }
      break;
    }

    body["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }

  /**
   * Create a run that cross-references a bookmark by name.
   * Insert this run into any paragraph via paragraph.addRun().
   */
  public createCrossRefRun(bookmarkName: string, displayText = ""): RunInterface {
    const instrText = ` REF ${bookmarkName} \\h `;
    return {
      "w:rPr": {},
      "w:fldChar": { $: { "w:fldCharType": "begin" } },
    } as any as RunInterface;

    // Note: a full cross-ref needs three sibling runs (begin, instrText+separate, end).
    // Use createCrossRefRuns() for the complete triplet.
    void instrText;
    void displayText;
  }

  /**
   * Returns three run objects that together form a cross-reference field.
   * All three must be added to the same paragraph in order.
   */
  public createCrossRefRuns(bookmarkName: string, displayText = ""): RunInterface[] {
    const instrText = ` REF ${bookmarkName} \\h `;
    return [
      {
        "w:fldChar": { $: { "w:fldCharType": "begin" } },
      } as any,
      {
        "w:instrText": { _: instrText, $: { "xml:space": "preserve" } },
      } as any,
      {
        "w:fldChar": { $: { "w:fldCharType": "separate" } },
      } as any,
      {
        "w:t": { _: displayText || bookmarkName, $: { "xml:space": "preserve" } },
      } as any,
      {
        "w:fldChar": { $: { "w:fldCharType": "end" } },
      } as any,
    ];
  }
}
