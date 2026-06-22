import * as XmlUtils from "@/utils/xmlUtils";
import AdmZip from "adm-zip";

const DOCUMENT_PATH = "word/document.xml";

export interface SectionPageSize {
  width: number;
  height: number;
  orientation?: "portrait" | "landscape";
}

export interface SectionMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
  header?: number;
  footer?: number;
  gutter?: number;
}

export interface SectionLayout {
  type?: "nextPage" | "continuous" | "evenPage" | "oddPage";
  pageSize?: SectionPageSize;
  margins?: SectionMargins;
}

export interface SectionHeaderFooterRef {
  relId: string;
  type: "default" | "first" | "even";
}

export interface SectionEntry {
  index: number;
  isFinal: boolean;
  type?: string;
  pageSize?: SectionPageSize;
  margins?: SectionMargins;
  headerRefs: SectionHeaderFooterRef[];
  footerRefs: SectionHeaderFooterRef[];
  paragraphIndex?: number;
}

export class SectionManager {
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

  // ─── SectPr parsing ───────────────────────────────────────────────────────

  private parseSectPr(sectPr: any): Omit<SectionEntry, "index" | "isFinal" | "paragraphIndex"> {
    const type = sectPr?.["w:type"]?.$?.["w:val"];

    let pageSize: SectionPageSize | undefined;
    const pgSz = sectPr?.["w:pgSz"];
    if (pgSz) {
      pageSize = {
        width:       parseInt(pgSz.$?.["w:w"] ?? "12240", 10),
        height:      parseInt(pgSz.$?.["w:h"] ?? "15840", 10),
        orientation: pgSz.$?.["w:orient"] === "landscape" ? "landscape" : "portrait",
      };
    }

    let margins: SectionMargins | undefined;
    const pgMar = sectPr?.["w:pgMar"];
    if (pgMar) {
      margins = {
        top:    parseInt(pgMar.$?.["w:top"]    ?? "1440", 10),
        bottom: parseInt(pgMar.$?.["w:bottom"] ?? "1440", 10),
        left:   parseInt(pgMar.$?.["w:left"]   ?? "1440", 10),
        right:  parseInt(pgMar.$?.["w:right"]  ?? "1440", 10),
        header: pgMar.$?.["w:header"] !== undefined ? parseInt(pgMar.$["w:header"], 10) : undefined,
        footer: pgMar.$?.["w:footer"] !== undefined ? parseInt(pgMar.$["w:footer"], 10) : undefined,
        gutter: pgMar.$?.["w:gutter"] !== undefined ? parseInt(pgMar.$["w:gutter"], 10) : undefined,
      };
    }

    const headerRefs: SectionHeaderFooterRef[] = this.norm(sectPr?.["w:headerReference"]).map(
      (h: any) => ({ relId: h.$?.["r:id"] ?? "", type: (h.$?.["w:type"] ?? "default") as any }),
    );

    const footerRefs: SectionHeaderFooterRef[] = this.norm(sectPr?.["w:footerReference"]).map(
      (f: any) => ({ relId: f.$?.["r:id"] ?? "", type: (f.$?.["w:type"] ?? "default") as any }),
    );

    return { type, pageSize, margins, headerRefs, footerRefs };
  }

  private applyLayout(sectPr: any, layout: SectionLayout): void {
    if (layout.type !== undefined) {
      sectPr["w:type"] = { $: { "w:val": layout.type } };
    }
    if (layout.pageSize) {
      const s = layout.pageSize;
      sectPr["w:pgSz"] = {
        $: {
          "w:w":      String(s.width),
          "w:h":      String(s.height),
          ...(s.orientation ? { "w:orient": s.orientation } : {}),
        },
      };
    }
    if (layout.margins) {
      const m = layout.margins;
      sectPr["w:pgMar"] = {
        $: {
          "w:top":    String(m.top),
          "w:bottom": String(m.bottom),
          "w:left":   String(m.left),
          "w:right":  String(m.right),
          ...(m.header !== undefined ? { "w:header": String(m.header) } : {}),
          ...(m.footer !== undefined ? { "w:footer": String(m.footer) } : {}),
          ...(m.gutter !== undefined ? { "w:gutter": String(m.gutter) } : {}),
        },
      };
    }
  }

  // ─── Section lookup ───────────────────────────────────────────────────────

  private async findSectPr(
    sectionIndex: number,
  ): Promise<{ obj: any; sectPr: any; isBody: boolean }> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    const body       = obj["w:document"]["w:body"];

    // Collect intermediate section sectPrs (in paragraph order)
    const intermediateParagraphIndices: number[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i]?.["w:pPr"]?.["w:sectPr"]) {
        intermediateParagraphIndices.push(i);
      }
    }

    const totalSections = intermediateParagraphIndices.length + 1; // +1 for final

    if (sectionIndex < 0 || sectionIndex >= totalSections) {
      throw new Error(`Section index ${sectionIndex} out of range (0–${totalSections - 1})`);
    }

    if (sectionIndex < intermediateParagraphIndices.length) {
      const pIdx   = intermediateParagraphIndices[sectionIndex];
      const sectPr = paragraphs[pIdx]["w:pPr"]["w:sectPr"];
      return { obj, sectPr, isBody: false };
    }

    // Final section
    return { obj, sectPr: body["w:sectPr"], isBody: true };
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  public async getSections(): Promise<SectionEntry[]> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    const body       = obj["w:document"]["w:body"];
    const sections:  SectionEntry[] = [];
    let   sectionIdx = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const sectPr = paragraphs[i]?.["w:pPr"]?.["w:sectPr"];
      if (sectPr) {
        sections.push({
          index:          sectionIdx++,
          isFinal:        false,
          paragraphIndex: i,
          ...this.parseSectPr(sectPr),
        });
      }
    }

    const bodySectPr = body["w:sectPr"];
    sections.push({
      index:   sectionIdx,
      isFinal: true,
      ...this.parseSectPr(bodySectPr ?? {}),
    });

    return sections;
  }

  public async addSectionBreak(
    paragraphIndex: number,
    type: "nextPage" | "continuous" | "evenPage" | "oddPage",
  ): Promise<void> {
    const obj        = await this.readDocument();
    const body       = obj["w:document"]["w:body"];
    const paragraphs = this.getBodyParagraphs(obj);
    const idx        = Math.max(0, Math.min(paragraphIndex, paragraphs.length - 1));
    const para       = paragraphs[idx];

    if (!para["w:pPr"]) para["w:pPr"] = {};
    para["w:pPr"]["w:sectPr"] = {
      "w:type": { $: { "w:val": type } },
    };

    body["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }

  public async removeSectionBreak(paragraphIndex: number): Promise<void> {
    const obj        = await this.readDocument();
    const body       = obj["w:document"]["w:body"];
    const paragraphs = this.getBodyParagraphs(obj);
    const para       = paragraphs[paragraphIndex];

    if (para?.["w:pPr"]?.["w:sectPr"]) {
      delete para["w:pPr"]["w:sectPr"];
    }

    body["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }

  public async setSectionLayout(sectionIndex: number, layout: SectionLayout): Promise<void> {
    const { obj, sectPr, isBody } = await this.findSectPr(sectionIndex);
    this.applyLayout(sectPr, layout);
    if (isBody) obj["w:document"]["w:body"]["w:sectPr"] = sectPr;
    await this.writeDocument(obj);
  }

  public async setSectionHeader(
    sectionIndex: number,
    relId: string,
    type: "default" | "first" | "even" = "default",
  ): Promise<void> {
    const { obj, sectPr, isBody } = await this.findSectPr(sectionIndex);
    const refs = this.norm(sectPr["w:headerReference"]).filter(
      (h: any) => h.$?.["w:type"] !== type,
    );
    refs.push({ $: { "w:type": type, "r:id": relId } });
    sectPr["w:headerReference"] = refs;
    if (isBody) obj["w:document"]["w:body"]["w:sectPr"] = sectPr;
    await this.writeDocument(obj);
  }

  public async setSectionFooter(
    sectionIndex: number,
    relId: string,
    type: "default" | "first" | "even" = "default",
  ): Promise<void> {
    const { obj, sectPr, isBody } = await this.findSectPr(sectionIndex);
    const refs = this.norm(sectPr["w:footerReference"]).filter(
      (f: any) => f.$?.["w:type"] !== type,
    );
    refs.push({ $: { "w:type": type, "r:id": relId } });
    sectPr["w:footerReference"] = refs;
    if (isBody) obj["w:document"]["w:body"]["w:sectPr"] = sectPr;
    await this.writeDocument(obj);
  }
}
