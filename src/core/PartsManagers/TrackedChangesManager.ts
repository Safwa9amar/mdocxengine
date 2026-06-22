import * as XmlUtils from "@/utils/xmlUtils";
import AdmZip from "adm-zip";

const DOCUMENT_PATH = "word/document.xml";

export type RevisionType = "ins" | "del" | "rPrChange" | "pPrChange";

export interface RevisionEntry {
  id: number;
  type: RevisionType;
  author: string;
  date: string;
  text: string;
  paragraphIndex: number;
}

export class TrackedChangesManager {
  private zip: AdmZip;

  constructor(zip: AdmZip) {
    this.zip = zip;
  }

  // ─── Internal read/write ──────────────────────────────────────────────────

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

  private norm(val: any): any[] {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  // ─── Text extraction helpers ──────────────────────────────────────────────

  private textFromRuns(runs: any[]): string {
    return runs
      .map((r) => {
        const t = r["w:t"] ?? r["w:delText"];
        if (!t) return "";
        return typeof t === "string" ? t : (t._ ?? "");
      })
      .join("");
  }

  private extractRevisionsFromParagraph(p: any, idx: number): RevisionEntry[] {
    const entries: RevisionEntry[] = [];

    for (const insEl of this.norm(p["w:ins"])) {
      entries.push({
        id:             parseInt(insEl.$?.["w:id"] ?? "0", 10),
        type:           "ins",
        author:         insEl.$?.["w:author"] ?? "",
        date:           insEl.$?.["w:date"] ?? "",
        text:           this.textFromRuns(this.norm(insEl["w:r"])),
        paragraphIndex: idx,
      });
    }

    for (const delEl of this.norm(p["w:del"])) {
      entries.push({
        id:             parseInt(delEl.$?.["w:id"] ?? "0", 10),
        type:           "del",
        author:         delEl.$?.["w:author"] ?? "",
        date:           delEl.$?.["w:date"] ?? "",
        text:           this.textFromRuns(this.norm(delEl["w:r"])),
        paragraphIndex: idx,
      });
    }

    // Format changes inside runs
    for (const r of this.norm(p["w:r"])) {
      const rPrChange = r?.["w:rPr"]?.["w:rPrChange"];
      if (rPrChange) {
        entries.push({
          id:             parseInt(rPrChange.$?.["w:id"] ?? "0", 10),
          type:           "rPrChange",
          author:         rPrChange.$?.["w:author"] ?? "",
          date:           rPrChange.$?.["w:date"] ?? "",
          text:           "",
          paragraphIndex: idx,
        });
      }
    }

    // Paragraph format changes
    const pPrChange = p?.["w:pPr"]?.["w:pPrChange"];
    if (pPrChange) {
      entries.push({
        id:             parseInt(pPrChange.$?.["w:id"] ?? "0", 10),
        type:           "pPrChange",
        author:         pPrChange.$?.["w:author"] ?? "",
        date:           pPrChange.$?.["w:date"] ?? "",
        text:           "",
        paragraphIndex: idx,
      });
    }

    return entries;
  }

  // ─── Accept / reject helpers ──────────────────────────────────────────────

  // Accept insertion: unwrap w:ins → promote its runs into paragraph w:r
  private acceptInsInParagraph(p: any): void {
    const insItems = this.norm(p["w:ins"]);
    if (!insItems.length) return;
    const promoted = insItems.flatMap((ins: any) => this.norm(ins["w:r"]));
    p["w:r"] = [...this.norm(p["w:r"]), ...promoted];
    p["w:ins"] = undefined;
  }

  // Reject insertion: discard w:ins entirely
  private rejectInsInParagraph(p: any): void {
    p["w:ins"] = undefined;
  }

  // Accept deletion: remove w:del entirely (deleted text stays deleted)
  private acceptDelInParagraph(p: any): void {
    p["w:del"] = undefined;
  }

  // Reject deletion: restore deleted text — rename w:delText → w:t, promote runs
  private rejectDelInParagraph(p: any): void {
    const delItems = this.norm(p["w:del"]);
    if (!delItems.length) return;
    const restored = delItems.flatMap((del: any) =>
      this.norm(del["w:r"]).map((r: any) => {
        const delText = r["w:delText"];
        const run = { ...r };
        delete run["w:delText"];
        run["w:t"] = delText;
        return run;
      }),
    );
    p["w:r"] = [...this.norm(p["w:r"]), ...restored];
    p["w:del"] = undefined;
  }

  // Accept format change: keep current formatting, discard w:rPrChange
  private acceptRPrChanges(p: any): void {
    for (const r of this.norm(p["w:r"])) {
      if (r?.["w:rPr"]?.["w:rPrChange"]) {
        delete r["w:rPr"]["w:rPrChange"];
      }
    }
  }

  // Reject format change: revert w:rPr to the original stored in w:rPrChange
  private rejectRPrChanges(p: any): void {
    for (const r of this.norm(p["w:r"])) {
      const rPrChange = r?.["w:rPr"]?.["w:rPrChange"];
      if (rPrChange) {
        r["w:rPr"] = rPrChange["w:rPr"] ?? {};
      }
    }
  }

  // Accept pPr change: keep current pPr, discard w:pPrChange
  private acceptPPrChange(p: any): void {
    if (p?.["w:pPr"]?.["w:pPrChange"]) {
      delete p["w:pPr"]["w:pPrChange"];
    }
  }

  // Reject pPr change: revert w:pPr to old value stored in w:pPrChange
  private rejectPPrChange(p: any): void {
    const pPrChange = p?.["w:pPr"]?.["w:pPrChange"];
    if (pPrChange) {
      p["w:pPr"] = { ...(pPrChange["w:pPr"] ?? {}) };
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  public async getRevisions(): Promise<RevisionEntry[]> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    return paragraphs.flatMap((p, i) => this.extractRevisionsFromParagraph(p, i));
  }

  public async acceptAll(): Promise<void> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    for (const p of paragraphs) {
      this.acceptInsInParagraph(p);
      this.acceptDelInParagraph(p);
      this.acceptRPrChanges(p);
      this.acceptPPrChange(p);
    }
    obj["w:document"]["w:body"]["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }

  public async rejectAll(): Promise<void> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    for (const p of paragraphs) {
      this.rejectInsInParagraph(p);
      this.rejectDelInParagraph(p);
      this.rejectRPrChanges(p);
      this.rejectPPrChange(p);
    }
    obj["w:document"]["w:body"]["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }

  public async acceptRevision(id: number): Promise<void> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);

    for (const p of paragraphs) {
      const ins = this.norm(p["w:ins"]);
      const matchIns = ins.filter((el: any) => parseInt(el.$?.["w:id"] ?? "-1", 10) === id);
      if (matchIns.length) {
        const promoted = matchIns.flatMap((el: any) => this.norm(el["w:r"]));
        p["w:r"] = [...this.norm(p["w:r"]), ...promoted];
        p["w:ins"] = ins.filter((el: any) => parseInt(el.$?.["w:id"] ?? "-1", 10) !== id);
        if (!p["w:ins"].length) p["w:ins"] = undefined;
      }

      const del = this.norm(p["w:del"]);
      const matchDel = del.filter((el: any) => parseInt(el.$?.["w:id"] ?? "-1", 10) === id);
      if (matchDel.length) {
        p["w:del"] = del.filter((el: any) => parseInt(el.$?.["w:id"] ?? "-1", 10) !== id);
        if (!p["w:del"].length) p["w:del"] = undefined;
      }

      for (const r of this.norm(p["w:r"])) {
        const rPrChange = r?.["w:rPr"]?.["w:rPrChange"];
        if (rPrChange && parseInt(rPrChange.$?.["w:id"] ?? "-1", 10) === id) {
          delete r["w:rPr"]["w:rPrChange"];
        }
      }

      const pPrChange = p?.["w:pPr"]?.["w:pPrChange"];
      if (pPrChange && parseInt(pPrChange.$?.["w:id"] ?? "-1", 10) === id) {
        delete p["w:pPr"]["w:pPrChange"];
      }
    }

    obj["w:document"]["w:body"]["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }

  public async rejectRevision(id: number): Promise<void> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);

    for (const p of paragraphs) {
      const ins = this.norm(p["w:ins"]);
      const matchIns = ins.filter((el: any) => parseInt(el.$?.["w:id"] ?? "-1", 10) === id);
      if (matchIns.length) {
        p["w:ins"] = ins.filter((el: any) => parseInt(el.$?.["w:id"] ?? "-1", 10) !== id);
        if (!p["w:ins"].length) p["w:ins"] = undefined;
      }

      const del = this.norm(p["w:del"]);
      const matchDel = del.filter((el: any) => parseInt(el.$?.["w:id"] ?? "-1", 10) === id);
      if (matchDel.length) {
        const restored = matchDel.flatMap((el: any) =>
          this.norm(el["w:r"]).map((r: any) => {
            const dt = r["w:delText"];
            const run = { ...r };
            delete run["w:delText"];
            run["w:t"] = dt;
            return run;
          }),
        );
        p["w:r"] = [...this.norm(p["w:r"]), ...restored];
        p["w:del"] = del.filter((el: any) => parseInt(el.$?.["w:id"] ?? "-1", 10) !== id);
        if (!p["w:del"].length) p["w:del"] = undefined;
      }

      for (const r of this.norm(p["w:r"])) {
        const rPrChange = r?.["w:rPr"]?.["w:rPrChange"];
        if (rPrChange && parseInt(rPrChange.$?.["w:id"] ?? "-1", 10) === id) {
          r["w:rPr"] = rPrChange["w:rPr"] ?? {};
        }
      }

      const pPrChange = p?.["w:pPr"]?.["w:pPrChange"];
      if (pPrChange && parseInt(pPrChange.$?.["w:id"] ?? "-1", 10) === id) {
        p["w:pPr"] = { ...(pPrChange["w:pPr"] ?? {}) };
      }
    }

    obj["w:document"]["w:body"]["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }
}
