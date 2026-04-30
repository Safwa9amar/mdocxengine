import * as XmlUtils from "@/utils/xmlUtils";
import { RelManager } from "@/core/PartsManagers/RelManager";
import { ContentTypesManager } from "./ContentTypesManager";
import DocumentManager from "./DocumentManager";
import AdmZip from "adm-zip";
import { HeaderFile } from "@/constants";

const HEADER_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header";
const HEADER_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml";

export type HeaderType = "default" | "first" | "even";

export type PageNumberFormat =
  | "decimal"
  | "upperRoman"
  | "lowerRoman"
  | "upperLetter"
  | "lowerLetter";

export interface PageNumberOptions {
  /** Paragraph alignment for the page-number line. Default: "center". */
  alignment?: "left" | "center" | "right";
  /** Numbering style. Default: "decimal". */
  format?: PageNumberFormat;
  /** When true, renders "X / Y" (current page / total pages). */
  includeTotalPages?: boolean;
  /** Prefix text before the page number, e.g. "Page ". */
  prefix?: string;
}

export type ChapterSeparator = "hyphen" | "period" | "colon" | "emDash" | "enDash";

export interface PageNumberFormatOptions {
  /** Numbering style written to w:pgNumType. Default: "decimal". */
  format?: PageNumberFormat;
  /**
   * Include the chapter number before the page number (e.g. "1-1", "1-A").
   * Requires a heading style to be set via chapterStyle.
   */
  includeChapterNumber?: boolean;
  /**
   * Heading level whose numbering is used as the chapter prefix.
   * 1 = Heading 1, 2 = Heading 2, … Default: 1.
   */
  chapterStyle?: number;
  /**
   * Separator between chapter and page number.
   * hyphen → "-", period → ".", colon → ":", emDash → "—", enDash → "–".
   * Default: "hyphen".
   */
  chapterSeparator?: ChapterSeparator;
  /**
   * When true, page numbering continues from the previous section (no w:start attribute).
   * When false/omitted, startAt is used if provided.
   */
  continueFromPreviousSection?: boolean;
  /** Restart page numbering at this value. Ignored when continueFromPreviousSection is true. */
  startAt?: number;
}

type xmlFile = {
  fileName: string;
  xml: string;
};

const FORMAT_SWITCH: Record<PageNumberFormat, string> = {
  decimal:      "ARABIC",
  upperRoman:   "ROMAN",
  lowerRoman:   "roman",
  upperLetter:  "ALPHABETIC",
  lowerLetter:  "alphabetic",
};

const FORMAT_OOXML: Record<PageNumberFormat, string> = {
  decimal:      "decimal",
  upperRoman:   "upperRoman",
  lowerRoman:   "lowerRoman",
  upperLetter:  "upperLetter",
  lowerLetter:  "lowerLetter",
};

export default class HeaderManager {
  zip: AdmZip;
  rels: RelManager;
  contentTypes: ContentTypesManager;
  document: DocumentManager;
  headers: xmlFile[];

  constructor(zip: AdmZip) {
    this.zip = zip;
    this.rels = new RelManager(zip);
    this.contentTypes = new ContentTypesManager(zip);
    this.document = new DocumentManager(zip);
    this.headers = this.getAllheadersFiles(zip);
  }

  public getHeaderByName(name: string): xmlFile | false {
    return this.headers.find((header) => header.fileName === name) || false;
  }

  public getAllheadersFiles(zip: AdmZip): xmlFile[] {
    const files: xmlFile[] = [];
    zip.getEntries().forEach((el) => {
      if (/^word\/header\d+\.xml$/.test(el.entryName)) {
        const file = zip.readFile(el.entryName);
        if (file) {
          files.push({ fileName: el.entryName as HeaderFile, xml: file.toString() });
        }
      }
    });
    return files;
  }

  private nextHeaderPath(): HeaderFile {
    const nums = this.headers.map((h) => {
      const m = h.fileName.match(/header(\d+)\.xml$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `word/header${next}.xml`;
  }

  private buildHeaderXml(text: string): string {
    const obj = {
      $: {
        "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      },
      "w:p": {
        "w:pPr": { "w:pStyle": { $: { "w:val": "Header" } } },
        "w:r":   { "w:t": text },
      },
    };
    return XmlUtils.buildXml(obj, { rootName: "w:hdr", headless: false, pretty: true });
  }

  // ── sectPr helpers ──────────────────────────────────────────────────────────

  private async readDocObj(): Promise<any> {
    const xml = this.zip.readAsText("word/document.xml");
    if (!xml) throw new Error("word/document.xml not found");
    return XmlUtils.parseXml(xml);
  }

  private writeDocObj(docObj: any): void {
    const xml = XmlUtils.buildXml(docObj["w:document"], {
      rootName: "w:document",
      headless: false,
      pretty: true,
    });
    this.zip.addFile("word/document.xml", Buffer.from(xml, "utf-8"));
  }

  private getSectPr(docObj: any): any {
    const body = docObj["w:document"]["w:body"];
    if (!body["w:sectPr"]) body["w:sectPr"] = {};
    return body["w:sectPr"];
  }

  // ── Page number field builder ───────────────────────────────────────────────

  private buildPageNumberRuns(options: PageNumberOptions = {}): any[] {
    const sw    = FORMAT_SWITCH[options.format ?? "decimal"];
    const instr = ` PAGE \\* ${sw} \\* MERGEFORMAT `;
    const runs: any[] = [];

    if (options.prefix) {
      runs.push({ "w:t": { _: options.prefix, $: { "xml:space": "preserve" } } });
    }

    runs.push(
      { "w:fldChar":   { $: { "w:fldCharType": "begin" } } },
      { "w:instrText": { _: instr, $: { "xml:space": "preserve" } } },
      { "w:fldChar":   { $: { "w:fldCharType": "separate" } } },
      { "w:t":         { _: "1", $: { "xml:space": "preserve" } } },
      { "w:fldChar":   { $: { "w:fldCharType": "end" } } },
    );

    if (options.includeTotalPages) {
      const totalInstr = ` NUMPAGES \\* ${sw} \\* MERGEFORMAT `;
      runs.push(
        { "w:t":         { _: " / ", $: { "xml:space": "preserve" } } },
        { "w:fldChar":   { $: { "w:fldCharType": "begin" } } },
        { "w:instrText": { _: totalInstr, $: { "xml:space": "preserve" } } },
        { "w:fldChar":   { $: { "w:fldCharType": "separate" } } },
        { "w:t":         { _: "1", $: { "xml:space": "preserve" } } },
        { "w:fldChar":   { $: { "w:fldCharType": "end" } } },
      );
    }

    return runs;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Adds a header to the document.
   * @param registerInSectPr  When false, skips adding the <w:headerReference> to the main
   *                          w:sectPr. Useful when building multi-section documents where the
   *                          reference will be placed in an intermediate section-break paragraph.
   */
  public async addHeader(
    text: string,
    type: HeaderType = "default",
    xml?: string,
    options: { registerInSectPr?: boolean } = {},
  ): Promise<{ headerPath: string; relId: string; headerXml: string }> {
    const headerPath = this.nextHeaderPath();
    const headerXml  = xml ?? this.buildHeaderXml(text);

    this.zip.addFile(headerPath, Buffer.from(headerXml, "utf-8"));

    const relId = await this.rels.genId();
    await this.rels.addRelationship(relId, HEADER_REL_TYPE, headerPath.replace("word/", ""));
    await this.contentTypes.addOverride(`/${headerPath}`, HEADER_CONTENT_TYPE);

    if (options.registerInSectPr !== false) {
      await this.document.addHeaderReferenceToDocument(relId, type);
    }

    this.headers.push({ fileName: headerPath, xml: headerXml });
    return { headerPath, relId, headerXml };
  }

  /**
   * Overwrites an existing header file's content.
   */
  public updateHeader(name: string, newXml: string): void {
    const existing = this.headers.find((h) => h.fileName === name);
    if (!existing) throw new Error(`Header not found: ${name}`);
    this.zip.addFile(name, Buffer.from(newXml, "utf-8"));
    existing.xml = newXml;
  }

  /**
   * Removes a header: deletes zip entry, content-type, relationship and sectPr reference.
   */
  public async removeHeader(name: string): Promise<void> {
    const existing = this.headers.find((h) => h.fileName === name);
    if (!existing) throw new Error(`Header not found: ${name}`);

    this.zip.deleteFile(name);
    await this.contentTypes.removeOverride(`/${name}`);
    await this.removeHeaderRelAndReference(name);
    this.headers = this.headers.filter((h) => h.fileName !== name);
  }

  // ── Page Number ─────────────────────────────────────────────────────────────

  /**
   * Insert a page number paragraph into the specified header file.
   * Appends a new paragraph containing a PAGE field (optionally "X / Y").
   */
  public async insertPageNumber(headerPath: string, options: PageNumberOptions = {}): Promise<void> {
    const xmlStr = this.zip.readAsText(headerPath);
    if (!xmlStr) throw new Error(`Header not found: ${headerPath}`);

    const obj  = await XmlUtils.parseXml(xmlStr) as any;
    const hdr  = obj["w:hdr"];
    const jc   = options.alignment ?? "center";

    const pgNumPara = {
      "w:pPr": {
        "w:pStyle": { $: { "w:val": "Header" } },
        "w:jc":     { $: { "w:val": jc } },
      },
      "w:r": this.buildPageNumberRuns(options),
    };

    const existing: any[] = hdr["w:p"]
      ? Array.isArray(hdr["w:p"]) ? hdr["w:p"] : [hdr["w:p"]]
      : [];

    existing.push(pgNumPara);
    hdr["w:p"] = existing;

    const newXml = XmlUtils.buildXml(hdr, { rootName: "w:hdr", headless: false, pretty: true });
    this.zip.addFile(headerPath, Buffer.from(newXml, "utf-8"));

    const cached = this.headers.find((h) => h.fileName === headerPath);
    if (cached) cached.xml = newXml;
  }

  /**
   * Remove all PAGE / NUMPAGES fields from the specified header.
   */
  public async removePageNumbers(headerPath: string): Promise<void> {
    const xmlStr = this.zip.readAsText(headerPath);
    if (!xmlStr) throw new Error(`Header not found: ${headerPath}`);

    const obj = await XmlUtils.parseXml(xmlStr) as any;
    const hdr = obj["w:hdr"];

    const paras: any[] = hdr["w:p"]
      ? Array.isArray(hdr["w:p"]) ? hdr["w:p"] : [hdr["w:p"]]
      : [];

    const cleaned = paras.map((p: any) => {
      const runs: any[] = p["w:r"]
        ? Array.isArray(p["w:r"]) ? p["w:r"] : [p["w:r"]]
        : [];

      let inPageField = false;
      const filteredRuns = runs.filter((r: any) => {
        const fldType = r["w:fldChar"]?.["$"]?.["w:fldCharType"];
        if (fldType === "begin") {
          const sibling = runs[runs.indexOf(r) + 1];
          const instr: string =
            typeof sibling?.["w:instrText"] === "string"
              ? sibling["w:instrText"]
              : (sibling?.["w:instrText"]?._ ?? "");
          if (instr.includes("PAGE") || instr.includes("NUMPAGES")) {
            inPageField = true;
            return false;
          }
        }
        if (inPageField) {
          if (fldType === "end") inPageField = false;
          return false;
        }
        return true;
      });

      return { ...p, "w:r": filteredRuns };
    });

    hdr["w:p"] = cleaned;
    const newXml = XmlUtils.buildXml(hdr, { rootName: "w:hdr", headless: false, pretty: true });
    this.zip.addFile(headerPath, Buffer.from(newXml, "utf-8"));

    const cached = this.headers.find((h) => h.fileName === headerPath);
    if (cached) cached.xml = newXml;
  }

  /**
   * Set page number format via w:pgNumType in w:sectPr.
   * Covers the full "Format Page Numbers" dialog:
   *   - number format (decimal, roman, letter…)
   *   - include chapter number + chapter heading style + separator
   *   - continue from previous section OR start at a specific number
   */
  public async formatPageNumbers(options: PageNumberFormatOptions): Promise<void> {
    const docObj = await this.readDocObj();
    const sectPr = this.getSectPr(docObj);
    const attrs: Record<string, string> = {};

    if (options.format) {
      attrs["w:fmt"] = FORMAT_OOXML[options.format];
    }

    if (options.includeChapterNumber) {
      attrs["w:chapStyle"] = String(options.chapterStyle ?? 1);
      attrs["w:chapSep"]   = options.chapterSeparator ?? "hyphen";
    }

    if (!options.continueFromPreviousSection && options.startAt !== undefined) {
      attrs["w:start"] = String(options.startAt);
    }

    sectPr["w:pgNumType"] = { $: attrs };
    this.writeDocObj(docObj);
  }

  // ── Different First Page ────────────────────────────────────────────────────

  /**
   * Enable or disable a different header/footer for the first page (w:titlePg in sectPr).
   */
  public async setDifferentFirstPage(enable: boolean): Promise<void> {
    const docObj = await this.readDocObj();
    const sectPr = this.getSectPr(docObj);
    if (enable) {
      sectPr["w:titlePg"] = {};
    } else {
      delete sectPr["w:titlePg"];
    }
    this.writeDocObj(docObj);
  }

  // ── Different Odd & Even Pages ──────────────────────────────────────────────

  /**
   * Enable or disable different odd/even page headers (w:evenAndOddHeaders in settings.xml).
   */
  public async setDifferentOddEvenPages(enable: boolean): Promise<void> {
    const xml = this.zip.readAsText("word/settings.xml");
    if (!xml) return;
    const obj      = await XmlUtils.parseXml(xml) as any;
    const settings = obj["w:settings"];
    if (enable) {
      settings["w:evenAndOddHeaders"] = {};
    } else {
      delete settings["w:evenAndOddHeaders"];
    }
    const newXml = XmlUtils.buildXml(settings, {
      rootName: "w:settings",
      headless: false,
      pretty: true,
    });
    this.zip.addFile("word/settings.xml", Buffer.from(newXml, "utf-8"));
  }

  // ── Header from Top distance ────────────────────────────────────────────────

  /**
   * Set the distance from the top of the page to the header (in twips; 1 inch = 1440).
   * Default in Word is ~709 twips (0.49").
   */
  public async setHeaderDistance(twips: number): Promise<void> {
    const docObj = await this.readDocObj();
    const sectPr = this.getSectPr(docObj);
    if (!sectPr["w:pgMar"]) sectPr["w:pgMar"] = { $: {} };
    if (!sectPr["w:pgMar"]["$"]) sectPr["w:pgMar"]["$"] = {};
    sectPr["w:pgMar"]["$"]["w:header"] = String(twips);
    this.writeDocObj(docObj);
  }

  // ── Link to Previous ───────────────────────────────────────────────────────

  /**
   * Link (or unlink) the given header to the previous section's header.
   * In OOXML this is controlled by the absence/presence of a headerReference for this section.
   * Passing `false` removes the reference so Word inherits from the previous section.
   */
  public async linkToPrevious(headerPath: string, linked: boolean): Promise<void> {
    if (linked) {
      await this.removeHeader(headerPath);
    }
    // When linked=true we remove the part entirely so Word falls back to the previous section.
    // When linked=false the caller should addHeader() to create a distinct header.
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async removeHeaderRelAndReference(headerPath: string): Promise<void> {
    const relsXml = this.zip.readAsText("word/_rels/document.xml.rels");
    if (!relsXml) return;

    const relsObj  = await XmlUtils.parseXml(relsXml);
    const rels     = relsObj?.Relationships?.Relationship;
    if (!rels) return;

    const relsArr    = Array.isArray(rels) ? rels : [rels];
    const targetName = headerPath.replace("word/", "");
    const match      = relsArr.find((r: any) => r.$?.Target === targetName);
    if (!match) return;

    const relId = match.$?.Id;

    relsObj.Relationships.Relationship = relsArr.filter((r: any) => r.$?.Id !== relId);
    const newRelsXml = XmlUtils.buildXml(relsObj.Relationships, {
      rootName: "Relationships",
      headless: false,
      pretty: true,
    });
    this.zip.addFile("word/_rels/document.xml.rels", Buffer.from(newRelsXml, "utf-8"));

    await this.removeHeaderReferenceFromDocument(relId);
  }

  private async removeHeaderReferenceFromDocument(relId: string): Promise<void> {
    const docXml = this.zip.readAsText("word/document.xml");
    if (!docXml) return;

    const docObj = await XmlUtils.parseXml(docXml);
    const body   = docObj?.["w:document"]?.["w:body"];
    if (!body?.["w:sectPr"]) return;

    const sectPr = body["w:sectPr"];
    if (!sectPr["w:headerReference"]) return;

    const refs = Array.isArray(sectPr["w:headerReference"])
      ? sectPr["w:headerReference"]
      : [sectPr["w:headerReference"]];

    sectPr["w:headerReference"] = refs.filter((r: any) => r.$?.["r:id"] !== relId);

    const newDocXml = XmlUtils.buildXml(docObj["w:document"], {
      rootName: "w:document",
      headless: false,
      pretty: true,
    });
    this.zip.addFile("word/document.xml", Buffer.from(newDocXml, "utf-8"));
  }
}
