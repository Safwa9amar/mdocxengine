import * as XmlUtils from "@/utils/xmlUtils";
import AdmZip from "adm-zip";

const DOCUMENT_PATH = "word/document.xml";

export interface TocOptions {
  headingDepth?: number;
  title?: string;
  includePageNumbers?: boolean;
  useHyperlinks?: boolean;
}

export class TableOfContentsManager {
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

  private buildInstrText(options: TocOptions): string {
    const depth = options.headingDepth ?? 3;
    const hyperlinks = options.useHyperlinks !== false;
    let instr = ` TOC \\o "1-${depth}"`;
    if (hyperlinks) instr += " \\h";
    instr += " \\z \\u ";
    return instr;
  }

  private buildTocParagraphs(options: TocOptions): any[] {
    const title = options.title ?? "Table of Contents";
    const instrText = this.buildInstrText(options);
    const paragraphs: any[] = [];

    if (title) {
      paragraphs.push({
        $: {},
        "w:pPr": { "w:pStyle": { $: { "w:val": "TOCHeading" } } },
        "w:r": [{ "w:t": { _: title, $: { "xml:space": "preserve" } } }],
      });
    }

    paragraphs.push({
      $: {},
      "w:r": [
        { "w:fldChar": { $: { "w:fldCharType": "begin" } } },
        { "w:instrText": { _: instrText, $: { "xml:space": "preserve" } } },
        { "w:fldChar": { $: { "w:fldCharType": "separate" } } },
        { "w:t": { _: "[Right-click to update field]", $: { "xml:space": "preserve" } } },
        { "w:fldChar": { $: { "w:fldCharType": "end" } } },
      ],
    });

    return paragraphs;
  }

  /**
   * Insert a Table of Contents at the given body paragraph index (default: 0).
   */
  public async insertTOC(options: TocOptions = {}, index = 0): Promise<void> {
    const obj = await this.readDocument();
    const body = obj["w:document"]["w:body"];

    const raw = body["w:p"];
    const children: any[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

    const tocParagraphs = this.buildTocParagraphs(options);
    const insertAt = Math.min(index, children.length);
    children.splice(insertAt, 0, ...tocParagraphs);

    body["w:p"] = children;
    await this.writeDocument(obj);
  }

  /**
   * Remove all TOC paragraphs (TOCHeading + paragraphs containing a TOC field).
   */
  public async removeTOC(): Promise<void> {
    const obj = await this.readDocument();
    const body = obj["w:document"]["w:body"];

    const raw = body["w:p"];
    if (!raw) return;
    const paragraphs: any[] = Array.isArray(raw) ? raw : [raw];

    body["w:p"] = paragraphs.filter((p) => {
      if (p["w:pPr"]?.["w:pStyle"]?.$?.["w:val"] === "TOCHeading") return false;
      const runs = p["w:r"];
      if (!runs) return true;
      const arr = Array.isArray(runs) ? runs : [runs];
      return !arr.some((r: any) => {
        const instr = r["w:instrText"];
        if (!instr) return false;
        const text = typeof instr === "string" ? instr : (instr._ ?? "");
        return text.includes("TOC");
      });
    });

    await this.writeDocument(obj);
  }
}
