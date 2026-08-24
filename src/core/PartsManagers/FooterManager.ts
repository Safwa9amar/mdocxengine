import * as XmlUtils from "@/utils/xmlUtils";
import { RelManager } from "@/core/PartsManagers/RelManager";
import { ContentTypesManager } from "./ContentTypesManager";
import DocumentManager from "./DocumentManager";
import AdmZip from "adm-zip";
import { FooterFile } from "@/constants";
import { removeSectPrReferenceFromDocument } from "@/core/files/body/sectPr";

const FOOTER_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer";
const FOOTER_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml";

export type FooterType = "default" | "first" | "even";

export type PageNumberFormat =
  | "decimal"
  | "upperRoman"
  | "lowerRoman"
  | "upperLetter"
  | "lowerLetter"
  | "arabicAlpha"
  | "arabicAbjad";

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
  arabicAlpha:  "ArabicAlpha",
  arabicAbjad:  "ArabicAbjad",
};

const FORMAT_OOXML: Record<PageNumberFormat, string> = {
  decimal:      "decimal",
  upperRoman:   "upperRoman",
  lowerRoman:   "lowerRoman",
  upperLetter:  "upperLetter",
  lowerLetter:  "lowerLetter",
  arabicAlpha:  "arabicAlpha",
  arabicAbjad:  "arabicAbjad",
};

export default class FooterManager {
  zip: AdmZip;
  rels: RelManager;
  contentTypes: ContentTypesManager;
  document: DocumentManager;
  footers: xmlFile[];

  constructor(zip: AdmZip) {
    this.zip = zip;
    this.rels = new RelManager(zip);
    this.contentTypes = new ContentTypesManager(zip);
    this.document = new DocumentManager(zip);
    this.footers = this.getAllFooterFiles(zip);
  }

  public getFooterByName(name: string): xmlFile | false {
    return this.footers.find((f) => f.fileName === name) || false;
  }

  public getAllFooterFiles(zip: AdmZip): xmlFile[] {
    const files: xmlFile[] = [];
    zip.getEntries().forEach((el) => {
      if (/^word\/footer\d+\.xml$/.test(el.entryName)) {
        const file = zip.readFile(el.entryName);
        if (file) {
          files.push({ fileName: el.entryName as FooterFile, xml: file.toString() });
        }
      }
    });
    return files;
  }

  private nextFooterPath(): FooterFile {
    const nums = this.footers.map((f) => {
      const m = f.fileName.match(/footer(\d+)\.xml$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return `word/footer${next}.xml`;
  }

  private buildFooterXml(text: string): string {
    const obj = {
      $: {
        "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
        "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      },
      "w:p": {
        "w:pPr": { "w:pStyle": { $: { "w:val": "Footer" } } },
        "w:r":   { "w:t": text },
      },
    };
    return XmlUtils.buildXml(obj, { rootName: "w:ftr", headless: false, pretty: true });
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
      // NOT pretty: indentation between top-level body children becomes #text
      // "blocks" in splitDocument, corrupting every consumer's block indices.
      pretty: false,
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
   * Adds a footer to the document.
   * @param registerInSectPr  When false, skips adding the <w:footerReference> to the main
   *                          w:sectPr. Useful when building multi-section documents.
   */
  public async addFooter(
    text: string,
    type: FooterType = "default",
    xml?: string,
    options: { registerInSectPr?: boolean } = {},
  ): Promise<{ footerPath: string; relId: string; footerXml: string }> {
    const footerPath = this.nextFooterPath();
    const footerXml  = xml ?? this.buildFooterXml(text);

    this.zip.addFile(footerPath, Buffer.from(footerXml, "utf-8"));

    const relId = await this.rels.genId();
    await this.rels.addRelationship(relId, FOOTER_REL_TYPE, footerPath.replace("word/", ""));
    await this.contentTypes.addOverride(`/${footerPath}`, FOOTER_CONTENT_TYPE);

    if (options.registerInSectPr !== false) {
      await this.document.addFooterReferenceToDocument(relId, type);
    }

    this.footers.push({ fileName: footerPath, xml: footerXml });
    return { footerPath, relId, footerXml };
  }

  /**
   * Overwrites an existing footer file's content.
   */
  public updateFooter(name: string, newXml: string): void {
    const existing = this.footers.find((f) => f.fileName === name);
    if (!existing) throw new Error(`Footer not found: ${name}`);
    this.zip.addFile(name, Buffer.from(newXml, "utf-8"));
    existing.xml = newXml;
  }

  /**
   * Removes a footer: deletes zip entry, content-type, relationship and sectPr reference.
   */
  public async removeFooter(name: string): Promise<void> {
    const existing = this.footers.find((f) => f.fileName === name);
    if (!existing) throw new Error(`Footer not found: ${name}`);

    this.zip.deleteFile(name);
    await this.contentTypes.removeOverride(`/${name}`);
    await this.removeFooterRelAndReference(name);
    this.footers = this.footers.filter((f) => f.fileName !== name);
  }

  // ── Page Number ─────────────────────────────────────────────────────────────

  /**
   * Insert a page number paragraph into the specified footer file.
   * Appends a new paragraph containing a PAGE field (optionally "X / Y").
   */
  public async insertPageNumber(footerPath: string, options: PageNumberOptions = {}): Promise<void> {
    const xmlStr = this.zip.readAsText(footerPath);
    if (!xmlStr) throw new Error(`Footer not found: ${footerPath}`);

    const obj = await XmlUtils.parseXml(xmlStr) as any;
    const ftr = obj["w:ftr"];
    const jc  = options.alignment ?? "center";

    const pgNumPara = {
      "w:pPr": {
        "w:pStyle": { $: { "w:val": "Footer" } },
        "w:jc":     { $: { "w:val": jc } },
      },
      "w:r": this.buildPageNumberRuns(options),
    };

    const existing: any[] = ftr["w:p"]
      ? Array.isArray(ftr["w:p"]) ? ftr["w:p"] : [ftr["w:p"]]
      : [];

    existing.push(pgNumPara);
    ftr["w:p"] = existing;

    const newXml = XmlUtils.buildXml(ftr, { rootName: "w:ftr", headless: false, pretty: true });
    this.zip.addFile(footerPath, Buffer.from(newXml, "utf-8"));

    const cached = this.footers.find((f) => f.fileName === footerPath);
    if (cached) cached.xml = newXml;
  }

  /**
   * Remove all PAGE / NUMPAGES fields from the specified footer.
   */
  public async removePageNumbers(footerPath: string): Promise<void> {
    const xmlStr = this.zip.readAsText(footerPath);
    if (!xmlStr) throw new Error(`Footer not found: ${footerPath}`);

    const obj = await XmlUtils.parseXml(xmlStr) as any;
    const ftr = obj["w:ftr"];

    const paras: any[] = ftr["w:p"]
      ? Array.isArray(ftr["w:p"]) ? ftr["w:p"] : [ftr["w:p"]]
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

    ftr["w:p"] = cleaned;
    const newXml = XmlUtils.buildXml(ftr, { rootName: "w:ftr", headless: false, pretty: true });
    this.zip.addFile(footerPath, Buffer.from(newXml, "utf-8"));

    const cached = this.footers.find((f) => f.fileName === footerPath);
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
   * Enable or disable different odd/even page footers (w:evenAndOddHeaders in settings.xml).
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

  // ── Footer from Bottom distance ─────────────────────────────────────────────

  /**
   * Set the distance from the bottom of the page to the footer (in twips; 1 inch = 1440).
   * Default in Word is ~709 twips (0.49").
   */
  public async setFooterDistance(twips: number): Promise<void> {
    const docObj = await this.readDocObj();
    const sectPr = this.getSectPr(docObj);
    if (!sectPr["w:pgMar"])      sectPr["w:pgMar"] = { $: {} };
    if (!sectPr["w:pgMar"]["$"]) sectPr["w:pgMar"]["$"] = {};
    sectPr["w:pgMar"]["$"]["w:footer"] = String(twips);
    this.writeDocObj(docObj);
  }

  // ── Link to Previous ───────────────────────────────────────────────────────

  /**
   * Link (or unlink) the given footer to the previous section's footer.
   * Passing `true` removes the footer part so Word inherits from the previous section.
   */
  public async linkToPrevious(footerPath: string, linked: boolean): Promise<void> {
    if (linked) {
      await this.removeFooter(footerPath);
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async removeFooterRelAndReference(footerPath: string): Promise<void> {
    const relsXml = this.zip.readAsText("word/_rels/document.xml.rels");
    if (!relsXml) return;

    const relsObj    = await XmlUtils.parseXml(relsXml);
    const rels       = relsObj?.Relationships?.Relationship;
    if (!rels) return;

    const relsArr    = Array.isArray(rels) ? rels : [rels];
    const targetName = footerPath.replace("word/", "");
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

    await this.removeFooterReferenceFromDocument(relId);
  }

  private async removeFooterReferenceFromDocument(relId: string): Promise<void> {
    const docXml = this.zip.readAsText("word/document.xml");
    if (!docXml) return;
    // Byte-safe: delete just the self-closing <w:footerReference> tag wherever it
    // is (body or any section) — never rebuild the body (which reorders tables).
    const next = removeSectPrReferenceFromDocument(docXml, "footer", relId);
    this.zip.addFile("word/document.xml", Buffer.from(next, "utf-8"));
  }
}
