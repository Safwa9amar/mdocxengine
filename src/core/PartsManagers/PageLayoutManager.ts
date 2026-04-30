import * as XmlUtils from "@/utils/xmlUtils";
import AdmZip from "adm-zip";

const DOCUMENT_PATH = "word/document.xml";

// 1 inch = 1440 twips (twentieths of a point)
const IN = 1440;
const CM = 567; // ≈ 1440 / 2.54

// ─── Types ────────────────────────────────────────────────────────────────────

export type PageSizePreset =
  | "USLetter"
  | "USLegal"
  | "A3"
  | "A4"
  | "A5"
  | "B5"
  | "JISB5"
  | "Tabloid"
  | "TabloidOversize"
  | "EnvelopeDL"
  | "Envelope10";

export type MarginPreset = "normal" | "narrow" | "moderate" | "wide" | "mirrored";

export type Orientation = "portrait" | "landscape";

export type SectionBreakType =
  | "nextPage"
  | "continuous"
  | "evenPage"
  | "oddPage"
  | "nextColumn";

export interface PageSize {
  width: number;  // twips
  height: number; // twips
  orientation?: Orientation;
}

export interface PageMargins {
  top: number;    // twips
  bottom: number;
  left: number;
  right: number;
  gutter?: number;
  header?: number;
  footer?: number;
}

export interface ColumnOptions {
  count: number;
  space?: number;     // space between columns in twips (default 720 = 0.5")
  equalWidth?: boolean;
}

export interface LineNumberingOptions {
  countBy?: number;   // show number every N lines (default 1)
  start?: number;     // starting number (default 1)
  distance?: number;  // distance from text in twips (default 360)
  restart?: "newPage" | "newSection" | "continuous";
}

// ─── Presets ──────────────────────────────────────────────────────────────────

export const PAGE_SIZES: Record<PageSizePreset, { w: number; h: number }> = {
  USLetter:       { w: 12240, h: 15840 },
  USLegal:        { w: 12240, h: 20160 },
  A3:             { w: 16838, h: 23811 },
  A4:             { w: 11906, h: 16838 },
  A5:             { w:  8391, h: 11906 },
  B5:             { w:  9922, h: 14031 },
  JISB5:          { w: 10206, h: 14430 },
  Tabloid:        { w: 15840, h: 24480 },
  TabloidOversize:{ w: 17280, h: 25920 },
  EnvelopeDL:     { w:  6237, h: 12474 },
  Envelope10:     { w:  5940, h: 13680 },
};

export const MARGIN_PRESETS: Record<MarginPreset, PageMargins> = {
  normal:   { top: IN,        bottom: IN,        left: IN,        right: IN,        gutter: 0 },
  narrow:   { top: IN * 0.5,  bottom: IN * 0.5,  left: IN * 0.5,  right: IN * 0.5,  gutter: 0 },
  moderate: { top: IN,        bottom: IN,        left: IN * 0.75, right: IN * 0.75, gutter: 0 },
  wide:     { top: IN,        bottom: IN,        left: IN * 2,    right: IN * 2,    gutter: 0 },
  mirrored: { top: IN,        bottom: IN,        left: IN * 1.25, right: IN,        gutter: 0 },
};

// ─── Manager ──────────────────────────────────────────────────────────────────

export class PageLayoutManager {
  private zip: AdmZip;

  constructor(zip: AdmZip) {
    this.zip = zip;
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

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

  private async getSectPr(obj: any): Promise<any> {
    const body = obj["w:document"]["w:body"];
    if (!body["w:sectPr"]) body["w:sectPr"] = {};
    return body["w:sectPr"];
  }

  private twip(n: number): string {
    return String(Math.round(n));
  }

  // ── Page Size ───────────────────────────────────────────────────────────────

  /**
   * Get the current page size in twips.
   */
  public async getPageSize(): Promise<PageSize> {
    const obj = await this.readDocument();
    const sectPr = await this.getSectPr(obj);
    const pgSz = sectPr["w:pgSz"]?.["$"] ?? {};
    return {
      width:       parseInt(pgSz["w:w"]   ?? "12240", 10),
      height:      parseInt(pgSz["w:h"]   ?? "15840", 10),
      orientation: pgSz["w:orient"] === "landscape" ? "landscape" : "portrait",
    };
  }

  /**
   * Set page size from a preset name.
   */
  public async setPageSizePreset(preset: PageSizePreset, orientation: Orientation = "portrait"): Promise<void> {
    const { w, h } = PAGE_SIZES[preset];
    await this.setPageSize({ width: w, height: h, orientation });
  }

  /**
   * Set a custom page size (values in twips).
   */
  public async setPageSize(size: PageSize): Promise<void> {
    const obj = await this.readDocument();
    const sectPr = await this.getSectPr(obj);

    const landscape = size.orientation === "landscape";
    const w = landscape ? Math.max(size.width, size.height) : Math.min(size.width, size.height);
    const h = landscape ? Math.min(size.width, size.height) : Math.max(size.width, size.height);

    sectPr["w:pgSz"] = {
      $: {
        "w:w": this.twip(w),
        "w:h": this.twip(h),
        ...(landscape ? { "w:orient": "landscape" } : {}),
      },
    };

    await this.writeDocument(obj);
  }

  // ── Orientation ─────────────────────────────────────────────────────────────

  /**
   * Toggle orientation while preserving current page size dimensions.
   */
  public async setOrientation(orientation: Orientation): Promise<void> {
    const current = await this.getPageSize();
    await this.setPageSize({ ...current, orientation });
  }

  /**
   * Get current orientation.
   */
  public async getOrientation(): Promise<Orientation> {
    return (await this.getPageSize()).orientation ?? "portrait";
  }

  // ── Margins ─────────────────────────────────────────────────────────────────

  /**
   * Get the current page margins in twips.
   */
  public async getMargins(): Promise<PageMargins> {
    const obj = await this.readDocument();
    const sectPr = await this.getSectPr(obj);
    const m = sectPr["w:pgMar"]?.["$"] ?? {};
    return {
      top:    parseInt(m["w:top"]    ?? String(IN), 10),
      bottom: parseInt(m["w:bottom"] ?? String(IN), 10),
      left:   parseInt(m["w:left"]   ?? String(IN), 10),
      right:  parseInt(m["w:right"]  ?? String(IN), 10),
      gutter: parseInt(m["w:gutter"] ?? "0",        10),
      header: parseInt(m["w:header"] ?? "720",      10),
      footer: parseInt(m["w:footer"] ?? "720",      10),
    };
  }

  /**
   * Apply a named margin preset.
   */
  public async setMarginPreset(preset: MarginPreset): Promise<void> {
    await this.setMargins(MARGIN_PRESETS[preset]);
  }

  /**
   * Set custom margins (values in twips). Pass partial to merge with existing.
   */
  public async setMargins(margins: Partial<PageMargins>): Promise<void> {
    const obj = await this.readDocument();
    const sectPr = await this.getSectPr(obj);
    const existing = await this.getMargins();
    const merged = { ...existing, ...margins };

    sectPr["w:pgMar"] = {
      $: {
        "w:top":    this.twip(merged.top),
        "w:right":  this.twip(merged.right),
        "w:bottom": this.twip(merged.bottom),
        "w:left":   this.twip(merged.left),
        "w:header": this.twip(merged.header ?? 720),
        "w:footer": this.twip(merged.footer ?? 720),
        "w:gutter": this.twip(merged.gutter ?? 0),
      },
    };

    await this.writeDocument(obj);
  }

  /**
   * Set margins using inches (convenience wrapper).
   */
  public async setMarginsInInches(margins: {
    top?: number; bottom?: number; left?: number; right?: number; gutter?: number;
  }): Promise<void> {
    const toTwips = (n: number) => Math.round(n * IN);
    await this.setMargins({
      ...(margins.top    !== undefined ? { top:    toTwips(margins.top)    } : {}),
      ...(margins.bottom !== undefined ? { bottom: toTwips(margins.bottom) } : {}),
      ...(margins.left   !== undefined ? { left:   toTwips(margins.left)   } : {}),
      ...(margins.right  !== undefined ? { right:  toTwips(margins.right)  } : {}),
      ...(margins.gutter !== undefined ? { gutter: toTwips(margins.gutter) } : {}),
    });
  }

  // ── Columns ──────────────────────────────────────────────────────────────────

  /**
   * Get current column configuration.
   */
  public async getColumns(): Promise<ColumnOptions> {
    const obj = await this.readDocument();
    const sectPr = await this.getSectPr(obj);
    const c = sectPr["w:cols"]?.["$"] ?? {};
    return {
      count: parseInt(c["w:num"] ?? "1", 10),
      space: parseInt(c["w:space"] ?? "720", 10),
      equalWidth: c["w:equalWidth"] !== "0",
    };
  }

  /**
   * Set column layout.
   */
  public async setColumns(options: ColumnOptions): Promise<void> {
    const obj = await this.readDocument();
    const sectPr = await this.getSectPr(obj);

    sectPr["w:cols"] = {
      $: {
        "w:num":        String(options.count),
        "w:space":      String(options.space ?? 720),
        "w:equalWidth": options.equalWidth === false ? "0" : "1",
      },
    };

    await this.writeDocument(obj);
  }

  // ── Section & Page Breaks ────────────────────────────────────────────────────

  /**
   * Insert a page or section break before the paragraph at `paragraphIndex`.
   * Defaults to appending at end of document.
   *
   * - "nextPage" / "evenPage" / "oddPage" / "continuous" = section breaks
   * - "nextColumn" = column break within a multi-column section
   */
  public async insertBreak(type: SectionBreakType, paragraphIndex?: number): Promise<void> {
    const obj = await this.readDocument();
    const body = obj["w:document"]["w:body"];

    const raw = body["w:p"];
    const paragraphs: any[] = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

    let breakPara: any;

    if (type === "nextColumn") {
      // Column break: inserted as a run inside a paragraph
      breakPara = {
        $: {},
        "w:r": [{ "w:br": { $: { "w:type": "column" } } }],
      };
    } else {
      // Section break: <w:sectPr> inside <w:pPr>
      const sectPrEl: any = {};
      if (type !== "nextPage") {
        sectPrEl["w:type"] = { $: { "w:val": type } };
      }
      breakPara = {
        $: {},
        "w:pPr": { "w:sectPr": sectPrEl },
      };
    }

    const insertAt =
      paragraphIndex !== undefined
        ? Math.min(paragraphIndex, paragraphs.length)
        : paragraphs.length;

    paragraphs.splice(insertAt, 0, breakPara);
    body["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }

  // ── Line Numbering ───────────────────────────────────────────────────────────

  /**
   * Get current line numbering settings (null if not enabled).
   */
  public async getLineNumbering(): Promise<LineNumberingOptions | null> {
    const obj = await this.readDocument();
    const sectPr = await this.getSectPr(obj);
    const ln = sectPr["w:lnNumType"];
    if (!ln) return null;
    const a = ln["$"] ?? {};
    return {
      countBy: parseInt(a["w:countBy"] ?? "1", 10),
      start:   parseInt(a["w:start"]   ?? "1", 10),
      distance:parseInt(a["w:distance"]?? "360", 10),
      restart: a["w:restart"] ?? "newPage",
    };
  }

  /**
   * Enable line numbering.
   */
  public async setLineNumbering(options: LineNumberingOptions = {}): Promise<void> {
    const obj = await this.readDocument();
    const sectPr = await this.getSectPr(obj);

    sectPr["w:lnNumType"] = {
      $: {
        "w:countBy": String(options.countBy ?? 1),
        "w:start":   String(options.start   ?? 1),
        "w:distance":String(options.distance ?? 360),
        "w:restart": options.restart ?? "newPage",
      },
    };

    await this.writeDocument(obj);
  }

  /**
   * Remove line numbering.
   */
  public async removeLineNumbering(): Promise<void> {
    const obj = await this.readDocument();
    const sectPr = await this.getSectPr(obj);
    delete sectPr["w:lnNumType"];
    await this.writeDocument(obj);
  }
}

// ─── Unit conversion helpers ─────────────────────────────────────────────────

/** Convert inches to twips */
export const inchesToTwips = (inches: number): number => Math.round(inches * IN);
/** Convert centimetres to twips */
export const cmToTwips = (cm: number): number => Math.round(cm * CM);
/** Convert twips to inches */
export const twipsToInches = (twips: number): number => twips / IN;
/** Convert twips to centimetres */
export const twipsToCm = (twips: number): number => twips / CM;
