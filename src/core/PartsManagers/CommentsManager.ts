import * as XmlUtils from "@/utils/xmlUtils";
import { RelManager } from "@/core/PartsManagers/RelManager";
import { ContentTypesManager } from "./ContentTypesManager";
import AdmZip from "adm-zip";

const COMMENTS_PATH    = "word/comments.xml";
const COMMENT_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";
const COMMENT_CT       = "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml";
const COMMENT_NS       = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const DOCUMENT_PATH    = "word/document.xml";

export interface CommentEntry {
  id: number;
  author: string;
  initials: string;
  date: string;
  text: string;
}

export class CommentsManager {
  private zip: AdmZip;
  private rels: RelManager;
  private contentTypes: ContentTypesManager;

  constructor(zip: AdmZip) {
    this.zip          = zip;
    this.rels         = new RelManager(zip);
    this.contentTypes = new ContentTypesManager(zip);
  }

  // ─── Internal read/write ──────────────────────────────────────────────────

  private async readComments(): Promise<any> {
    const xml = this.zip.readAsText(COMMENTS_PATH);
    if (!xml) return this.emptyCommentsDoc();
    return XmlUtils.parseXml(xml);
  }

  private async writeComments(obj: any): Promise<void> {
    const xml = XmlUtils.buildXml(obj["w:comments"], {
      rootName: "w:comments",
      headless: false,
      pretty: true,
    });
    this.zip.addFile(COMMENTS_PATH, Buffer.from(xml, "utf-8"));
  }

  private emptyCommentsDoc(): any {
    return {
      "w:comments": {
        $: { "xmlns:w": COMMENT_NS },
        "w:comment": [],
      },
    };
  }

  private normalizeComments(obj: any): any[] {
    const raw = obj?.["w:comments"]?.["w:comment"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  private normalizeArr(val: any): any[] {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  private nextId(comments: any[]): number {
    const ids = comments.map((c) => parseInt(c.$?.["w:id"] ?? "0", 10));
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  private extractText(comment: any): string {
    const p = comment["w:p"];
    if (!p) return "";
    const runs = this.normalizeArr(p["w:r"]);
    return runs
      .map((r: any) => {
        const t = r["w:t"];
        if (!t) return "";
        return typeof t === "string" ? t : (t._ ?? "");
      })
      .join("")
      .trim();
  }

  // ─── Lazy registration ────────────────────────────────────────────────────

  private async ensureRegistered(): Promise<void> {
    if (this.zip.getEntry(COMMENTS_PATH)) return;
    await this.writeComments(this.emptyCommentsDoc());
    await this.contentTypes.addOverride(`/${COMMENTS_PATH}`, COMMENT_CT);
    await this.rels.addRelationship(await this.rels.genId(), COMMENT_REL_TYPE, "comments.xml");
  }

  // ─── Document.xml helpers ─────────────────────────────────────────────────

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

  private getBodyParagraphs(obj: any): any[] {
    const raw = obj?.["w:document"]?.["w:body"]?.["w:p"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  public async getComments(): Promise<CommentEntry[]> {
    const obj = await this.readComments();
    return this.normalizeComments(obj).map((c) => ({
      id:       parseInt(c.$?.["w:id"] ?? "0", 10),
      author:   c.$?.["w:author"] ?? "",
      initials: c.$?.["w:initials"] ?? "",
      date:     c.$?.["w:date"] ?? "",
      text:     this.extractText(c),
    }));
  }

  public async addComment(
    paragraphIndex: number,
    author: string,
    text: string,
    date?: string,
  ): Promise<number> {
    await this.ensureRegistered();

    const isoDate  = date ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const initials = author.charAt(0).toUpperCase();

    // Write comment into comments.xml
    const commObj  = await this.readComments();
    const comments = this.normalizeComments(commObj);
    const id       = this.nextId(comments);

    comments.push({
      $: { "w:id": String(id), "w:author": author, "w:initials": initials, "w:date": isoDate },
      "w:p": {
        "w:pPr": { "w:pStyle": { $: { "w:val": "CommentText" } } },
        "w:r": [
          {
            "w:rPr": { "w:rStyle": { $: { "w:val": "CommentReference" } } },
            "w:annotationRef": {},
          },
          {
            "w:t": { _: text, $: { "xml:space": "preserve" } },
          },
        ],
      },
    });
    commObj["w:comments"]["w:comment"] = comments;
    await this.writeComments(commObj);

    // Inject range markers into document.xml paragraph
    const docObj    = await this.readDocument();
    const body      = docObj["w:document"]["w:body"];
    const paragraphs = this.getBodyParagraphs(docObj);
    if (!paragraphs.length) throw new Error("Document has no paragraphs to annotate");
    const idx        = Math.max(0, Math.min(paragraphIndex, paragraphs.length - 1));
    const para       = paragraphs[idx];
    if (!para) throw new Error(`Paragraph at index ${idx} not found`);

    para["w:commentRangeStart"] = this.normalizeArr(para["w:commentRangeStart"]);
    para["w:commentRangeStart"].push({ $: { "w:id": String(id) } });

    const runs = this.normalizeArr(para["w:r"]);
    runs.push({ $: { "w:id": String(id) } }); // commentRangeEnd placeholder handled below
    // commentRangeEnd is a sibling of w:r, not inside it
    para["w:commentRangeEnd"] = this.normalizeArr(para["w:commentRangeEnd"]);
    para["w:commentRangeEnd"].push({ $: { "w:id": String(id) } });

    runs.push({
      "w:rPr": { "w:rStyle": { $: { "w:val": "CommentReference" } } },
      "w:commentReference": { $: { "w:id": String(id) } },
    });
    para["w:r"] = runs;

    body["w:p"] = paragraphs;
    await this.writeDocument(docObj);

    return id;
  }

  public async deleteComment(id: number): Promise<void> {
    // Remove from comments.xml
    const commObj  = await this.readComments();
    commObj["w:comments"]["w:comment"] = this.normalizeComments(commObj).filter(
      (c) => parseInt(c.$?.["w:id"] ?? "0", 10) !== id,
    );
    await this.writeComments(commObj);

    // Strip range markers from document.xml
    const docObj    = await this.readDocument();
    const body      = docObj["w:document"]["w:body"];
    const paragraphs = this.getBodyParagraphs(docObj);

    for (const para of paragraphs) {
      const starts = this.normalizeArr(para["w:commentRangeStart"]);
      const filtered = starts.filter((b: any) => parseInt(b.$?.["w:id"] ?? "-1", 10) !== id);
      para["w:commentRangeStart"] = filtered.length ? filtered : undefined;

      const ends = this.normalizeArr(para["w:commentRangeEnd"]);
      const filteredEnds = ends.filter((b: any) => parseInt(b.$?.["w:id"] ?? "-1", 10) !== id);
      para["w:commentRangeEnd"] = filteredEnds.length ? filteredEnds : undefined;

      const runs = this.normalizeArr(para["w:r"]).filter((r: any) => {
        const ref = r["w:commentReference"];
        if (!ref) return true;
        return parseInt(ref.$?.["w:id"] ?? "-1", 10) !== id;
      });
      para["w:r"] = runs.length ? runs : undefined;
    }

    body["w:p"] = paragraphs;
    await this.writeDocument(docObj);
  }

  // Removes the comment from the visible list; for full Word resolution support
  // (w15:commentEx with done="1") add commentsExtended.xml separately.
  public async resolveComment(id: number): Promise<void> {
    return this.deleteComment(id);
  }
}
