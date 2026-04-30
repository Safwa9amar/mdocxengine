import * as XmlUtils from "@/utils/xmlUtils";
import { Run as RunInterface } from "@/core/files/paragraph/types";
import AdmZip from "adm-zip";

const DOCUMENT_PATH = "word/document.xml";
const CUSTOM_XML_PATH = "customXml/item1.xml";
const BIBLIOGRAPHY_NS = "http://schemas.openxmlformats.org/officeDocument/2006/bibliography";

export interface CitationSource {
  tag: string;
  sourceType?: string;
  author?: string;
  title?: string;
  year?: string;
  city?: string;
  publisher?: string;
}

export class CitationManager {
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

  private async readSources(): Promise<CitationSource[]> {
    const xml = this.zip.readAsText(CUSTOM_XML_PATH);
    if (!xml) return [];
    try {
      const parsed = (await XmlUtils.parseXml(xml)) as any;
      const sources = parsed?.["b:Sources"]?.["b:Source"];
      if (!sources) return [];
      const arr = Array.isArray(sources) ? sources : [sources];
      return arr.map((s: any) => ({
        tag: s["b:Tag"] ?? "",
        sourceType: s["b:SourceType"] ?? "",
        author: s["b:Author"]?.["b:NameList"]?.["b:Person"]?.["b:Last"] ?? "",
        title: s["b:Title"] ?? "",
        year: s["b:Year"] ?? "",
        city: s["b:City"] ?? "",
        publisher: s["b:Publisher"] ?? "",
      }));
    } catch {
      return [];
    }
  }

  private writeSources(sources: CitationSource[]): void {
    const sourceXml = sources
      .map(
        (s) => `  <b:Source>
    <b:Tag>${s.tag}</b:Tag>
    <b:SourceType>${s.sourceType ?? "Book"}</b:SourceType>
    ${s.author ? `<b:Author><b:NameList><b:Person><b:Last>${s.author}</b:Last></b:Person></b:NameList></b:Author>` : ""}
    ${s.title ? `<b:Title>${s.title}</b:Title>` : ""}
    ${s.year ? `<b:Year>${s.year}</b:Year>` : ""}
    ${s.city ? `<b:City>${s.city}</b:City>` : ""}
    ${s.publisher ? `<b:Publisher>${s.publisher}</b:Publisher>` : ""}
  </b:Source>`,
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<b:Sources xmlns:b="${BIBLIOGRAPHY_NS}" SelectedStyle="" StyleName="APA">
${sourceXml}
</b:Sources>`;

    this.zip.addFile(CUSTOM_XML_PATH, Buffer.from(xml, "utf-8"));
  }

  /**
   * Returns all citation sources stored in the document.
   */
  public async getSources(): Promise<CitationSource[]> {
    return this.readSources();
  }

  /**
   * Add or update a citation source.
   */
  public async addSource(source: CitationSource): Promise<void> {
    const sources = await this.readSources();
    const existing = sources.findIndex((s) => s.tag === source.tag);
    if (existing >= 0) {
      sources[existing] = source;
    } else {
      sources.push(source);
    }
    this.writeSources(sources);
  }

  /**
   * Remove a citation source by tag.
   */
  public async removeSource(tag: string): Promise<void> {
    const sources = (await this.readSources()).filter((s) => s.tag !== tag);
    this.writeSources(sources);
  }

  /**
   * Create a run array that inserts an inline citation (e.g. "(Smith, 2020)").
   * Insert all returned runs into a paragraph in order.
   */
  public createCitationRuns(tag: string, locale = "1033"): RunInterface[] {
    const instrText = ` CITATION ${tag} \\l ${locale} `;
    return [
      { "w:fldChar": { $: { "w:fldCharType": "begin" } } } as any,
      { "w:instrText": { _: instrText, $: { "xml:space": "preserve" } } } as any,
      { "w:fldChar": { $: { "w:fldCharType": "separate" } } } as any,
      { "w:t": { _: `(${tag})`, $: { "xml:space": "preserve" } } } as any,
      { "w:fldChar": { $: { "w:fldCharType": "end" } } } as any,
    ];
  }

  /**
   * Insert a bibliography paragraph at the given body index (default: end of document).
   */
  public async insertBibliography(index?: number): Promise<void> {
    const obj = await this.readDocument();
    const body = obj["w:document"]["w:body"];

    const raw = body["w:p"];
    const paragraphs: any[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

    const instrText = " BIBLIOGRAPHY ";
    const bibParagraphs = [
      {
        $: {},
        "w:pPr": { "w:pStyle": { $: { "w:val": "Bibliography" } } },
        "w:r": [
          { "w:fldChar": { $: { "w:fldCharType": "begin" } } },
          { "w:instrText": { _: instrText, $: { "xml:space": "preserve" } } },
          { "w:fldChar": { $: { "w:fldCharType": "separate" } } },
          { "w:t": { _: "[Bibliography]", $: { "xml:space": "preserve" } } },
          { "w:fldChar": { $: { "w:fldCharType": "end" } } },
        ],
      },
    ];

    const insertAt = index !== undefined ? Math.min(index, paragraphs.length) : paragraphs.length;
    paragraphs.splice(insertAt, 0, ...bibParagraphs);

    body["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }
}
