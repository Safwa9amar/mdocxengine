import * as XmlUtils from "@/utils/xmlUtils";
import { StylesManager } from "@/core/PartsManagers/StylesManager";
import AdmZip from "adm-zip";

const DOCUMENT_PATH = "word/document.xml";

/** Word's "Table of Figures" paragraph style for list entries. */
const TABLE_OF_FIGURES_STYLE = {
  $: { "w:type": "paragraph", "w:styleId": "TableofFigures" },
  "w:name":       { $: { "w:val": "table of figures" } },
  "w:basedOn":    { $: { "w:val": "Normal" } },
  "w:next":       { $: { "w:val": "Normal" } },
  "w:uiPriority": { $: { "w:val": "99" } },
  "w:unhideWhenUsed": {},
  "w:pPr": {
    "w:spacing": { $: { "w:before": "0", "w:after": "200" } },
    "w:tabs": {
      "w:tab": { $: { "w:val": "right", "w:leader": "dot", "w:pos": "8748" } },
    },
  },
  "w:rPr": {
    "w:sz":   { $: { "w:val": "20" } },
    "w:szCs": { $: { "w:val": "20" } },
  },
};

// ─── Style definitions ────────────────────────────────────────────────────────

/**
 * Word's built-in "Caption" paragraph style.
 * Bold, 9 pt, dark blue-grey (#44546A), 6 pt spacing before and after.
 */
export const CAPTION_PARA_STYLE = {
  $: { "w:type": "paragraph", "w:styleId": "Caption" },
  "w:name":      { $: { "w:val": "caption" } },
  "w:basedOn":   { $: { "w:val": "Normal" } },
  "w:next":      { $: { "w:val": "Normal" } },
  "w:uiPriority":{ $: { "w:val": "99" } },
  "w:qFormat":   {},
  "w:pPr": {
    "w:spacing": { $: { "w:before": "120", "w:after": "120" } },
    "w:jc":      { $: { "w:val": "left" } },
  },
  "w:rPr": {
    "w:b":    {},
    "w:bCs":  {},
    "w:color":{ $: { "w:val": "44546A", "w:themeColor": "text2" } },
    "w:sz":   { $: { "w:val": "18" } },
    "w:szCs": { $: { "w:val": "18" } },
  },
};

/**
 * "CaptionChar" character style — used for the auto-number run inside captions.
 * Inherits paragraph formatting, keeps the same bold + colour.
 */
const CAPTION_CHAR_STYLE = {
  $: { "w:type": "character", "w:styleId": "CaptionChar", "w:customStyle": "1" },
  "w:name":      { $: { "w:val": "caption char" } },
  "w:basedOn":   { $: { "w:val": "DefaultParagraphFont" } },
  "w:uiPriority":{ $: { "w:val": "99" } },
  "w:rPr": {
    "w:b":    {},
    "w:bCs":  {},
    "w:color":{ $: { "w:val": "44546A", "w:themeColor": "text2" } },
    "w:sz":   { $: { "w:val": "18" } },
    "w:szCs": { $: { "w:val": "18" } },
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

/** Numbering format matching Word's Caption Numbering dialog */
export type CaptionNumberFormat =
  | "arabic"       // 1, 2, 3, …       (default)
  | "ROMAN"        // I, II, III, …
  | "roman"        // i, ii, iii, …
  | "ALPHABETIC"   // A, B, C, …
  | "alphabetic";  // a, b, c, …

/** Chapter-number separator matching Word's "Use separator" dropdown */
export type ChapterSeparator = "-" | "." | ":" | "–" | "—"; // hyphen, period, colon, en-dash, em-dash

export type CaptionPosition = "below" | "above";

export interface CaptionNumberingOptions {
  /** Numbering format (default: "arabic") */
  format?: CaptionNumberFormat;
  /** Include the chapter number (e.g. "Figure 1-1") */
  includeChapterNumber?: boolean;
  /** Heading style that starts each chapter (default: "Heading1") */
  chapterStyle?: string;
  /** Separator between chapter number and caption number (default: "-") */
  chapterSeparator?: ChapterSeparator;
}

export interface CaptionOptions {
  /** Built-in or custom label: "Figure", "Table", "Equation", or any string */
  label?: string;
  /** Caption body text after the label + number */
  text?: string;
  /** Where to insert relative to the paragraph at insertIndex (default: "below") */
  position?: CaptionPosition;
  /** Omit the label prefix, e.g. just "1" instead of "Figure 1" */
  excludeLabel?: boolean;
  /** Numbering configuration */
  numbering?: CaptionNumberingOptions;
}

export interface CaptionEntry {
  label: string;
  number: string;  // placeholder shown in the field separator
  text: string;
  paragraphIndex: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FORMAT_MAP: Record<CaptionNumberFormat, string> = {
  arabic:     "ARABIC",
  ROMAN:      "ROMAN",
  roman:      "roman",
  ALPHABETIC: "ALPHABETIC",
  alphabetic: "alphabetic",
};

// ─── Manager ──────────────────────────────────────────────────────────────────

export class CaptionManager {
  private zip: AdmZip;
  private styles: StylesManager;
  private stylesRegistered = false;

  constructor(zip: AdmZip) {
    this.zip    = zip;
    this.styles = new StylesManager(zip);
  }

  /** Register Caption + CaptionChar styles into styles.xml the first time. */
  private async ensureStyles(): Promise<void> {
    if (this.stylesRegistered) return;
    const existing = await this.styles.listStyles();
    const ids      = new Set(existing.map((s) => s.id));
    if (!ids.has("Caption"))         await this.styles.addStyle(CAPTION_PARA_STYLE);
    if (!ids.has("CaptionChar"))     await this.styles.addStyle(CAPTION_CHAR_STYLE);
    if (!ids.has("TableofFigures"))  await this.styles.addStyle(TABLE_OF_FIGURES_STYLE);
    this.stylesRegistered = true;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

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
    const body = obj["w:document"]["w:body"];
    const raw  = body["w:p"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  /**
   * Build the SEQ field instruction string.
   *
   * With chapter numbers:  SEQ Figure \s 1 \* ARABIC
   * Without chapter numbers: SEQ Figure \* ARABIC
   */
  private buildSeqInstr(label: string, opts: CaptionNumberingOptions): string {
    const fmt    = FORMAT_MAP[opts.format ?? "arabic"];
    const chStyle = opts.chapterStyle ?? "Heading1";
    // Word uses the heading outline level (\s N, 1-based)
    const level   = parseInt(chStyle.replace(/\D/g, ""), 10) || 1;
    if (opts.includeChapterNumber) {
      return ` SEQ ${label} \\s ${level} \\* ${fmt} `;
    }
    return ` SEQ ${label} \\* ${fmt} `;
  }

  /**
   * Build a STYLEREF field run array that emits the chapter number.
   * Used only when includeChapterNumber = true.
   *
   * <w:r><w:fldChar begin/></w:r>
   * <w:r><w:instrText> STYLEREF "Heading 1" \n </w:instrText></w:r>
   * <w:r><w:fldChar separate/></w:r>
   * <w:r><w:t>1</w:t></w:r>
   * <w:r><w:fldChar end/></w:r>
   */
  private buildStyleRefRuns(chapterStyle: string): any[] {
    const styleName = chapterStyle.replace(/(\D+)(\d+)/, "$1 $2"); // "Heading1" → "Heading 1"
    return [
      { "w:fldChar": { $: { "w:fldCharType": "begin" } } },
      { "w:instrText": { _: ` STYLEREF "${styleName}" \\n `, $: { "xml:space": "preserve" } } },
      { "w:fldChar": { $: { "w:fldCharType": "separate" } } },
      { "w:t": { _: "1", $: { "xml:space": "preserve" } } },
      { "w:fldChar": { $: { "w:fldCharType": "end" } } },
    ];
  }

  /**
   * Build the complete set of <w:r> elements for one caption paragraph.
   *
   * Structure:
   *   [label run]            "Figure " (unless excludeLabel)
   *   [STYLEREF runs]        chapter number (if includeChapterNumber)
   *   [separator run]        "-" (if includeChapterNumber)
   *   [SEQ begin]
   *   [SEQ instrText]
   *   [SEQ separate]
   *   [SEQ placeholder]      "1"
   *   [SEQ end]
   *   [text run]             " My caption text"
   */
  private buildCaptionRuns(opts: CaptionOptions, seqNumber: number): any[] {
    const label    = opts.label    ?? "Figure";
    const text     = opts.text     ?? "";
    const numOpts  = opts.numbering ?? {};
    const seqInstr = this.buildSeqInstr(label, numOpts);
    const captionRPr = { "w:rStyle": { $: { "w:val": "CaptionChar" } } };
    const runs: any[] = [];

    // 1. Label prefix
    if (!opts.excludeLabel) {
      runs.push({
        "w:rPr": captionRPr,
        "w:t": { _: `${label} `, $: { "xml:space": "preserve" } },
      });
    }

    // 2. Chapter number via STYLEREF (if requested)
    if (numOpts.includeChapterNumber) {
      const styleRefRuns = this.buildStyleRefRuns(numOpts.chapterStyle ?? "Heading1")
        .map((r) => ({ "w:rPr": captionRPr, ...r }));
      runs.push(...styleRefRuns);
      const sep = numOpts.chapterSeparator ?? "-";
      runs.push({ "w:rPr": captionRPr, "w:t": { _: sep, $: { "xml:space": "preserve" } } });
    }

    // 3. SEQ field — placeholder uses the actual incremented sequence number
    runs.push({ "w:rPr": captionRPr, "w:fldChar": { $: { "w:fldCharType": "begin" } } });
    runs.push({ "w:rPr": captionRPr, "w:instrText": { _: seqInstr, $: { "xml:space": "preserve" } } });
    runs.push({ "w:rPr": captionRPr, "w:fldChar": { $: { "w:fldCharType": "separate" } } });
    runs.push({ "w:rPr": captionRPr, "w:t": { _: String(seqNumber), $: { "xml:space": "preserve" } } });
    runs.push({ "w:rPr": captionRPr, "w:fldChar": { $: { "w:fldCharType": "end" } } });

    // 4. Caption text
    if (text) {
      runs.push({ "w:t": { _: ` ${text}`, $: { "xml:space": "preserve" } } });
    }

    return runs;
  }

  private buildCaptionParagraph(opts: CaptionOptions, seqNumber: number): any {
    return {
      $: {},
      "w:pPr": { "w:pStyle": { $: { "w:val": "Caption" } } },
      "w:r": this.buildCaptionRuns(opts, seqNumber),
    };
  }

  /** Count how many captions for a given label already exist in the document. */
  private async countExistingCaptions(label: string): Promise<number> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    let count = 0;
    for (const p of paragraphs) {
      if (p["w:pPr"]?.["w:pStyle"]?.["$"]?.["w:val"] !== "Caption") continue;
      const runs: any[] = p["w:r"]
        ? Array.isArray(p["w:r"]) ? p["w:r"] : [p["w:r"]]
        : [];
      const hasLabel = runs.some((r: any) => {
        const instr: string =
          typeof r["w:instrText"] === "string"
            ? r["w:instrText"]
            : (r["w:instrText"]?._ ?? "");
        return instr.includes(`SEQ ${label}`);
      });
      if (hasLabel) count++;
    }
    return count;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Insert a caption paragraph next to the paragraph at `nearIndex`.
   *
   * `position: "below"` (default) inserts the caption after nearIndex.
   * `position: "above"` inserts the caption before nearIndex.
   *
   * @returns The index at which the caption was inserted.
   */
  public async insertCaption(nearIndex: number, opts: CaptionOptions = {}): Promise<number> {
    await this.ensureStyles();
    const label  = opts.label ?? "Figure";
    const seqNum = (await this.countExistingCaptions(label)) + 1;
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    const position   = opts.position ?? "below";

    const captionPara = this.buildCaptionParagraph(opts, seqNum);
    const insertAt    = position === "below" ? nearIndex + 1 : Math.max(0, nearIndex);

    const clamped = Math.min(insertAt, paragraphs.length);
    paragraphs.splice(clamped, 0, captionPara);

    obj["w:document"]["w:body"]["w:p"] = paragraphs;
    await this.writeDocument(obj);
    return clamped;
  }

  /**
   * Return all caption paragraphs (those using the "Caption" style).
   * The SEQ field placeholder text is used as the `number`.
   */
  public async getCaptions(filterLabel?: string): Promise<CaptionEntry[]> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    const results: CaptionEntry[] = [];

    paragraphs.forEach((p: any, idx: number) => {
      const style = p["w:pPr"]?.["w:pStyle"]?.["$"]?.["w:val"];
      if (style !== "Caption") return;

      const runs: any[] = p["w:r"]
        ? Array.isArray(p["w:r"]) ? p["w:r"] : [p["w:r"]]
        : [];

      // Identify the label from the first run's w:t (if not excluded)
      let label  = "";
      let number = "";
      let text   = "";
      let inSep  = false;

      for (const r of runs) {
        const fld = r["w:fldChar"]?.["$"]?.["w:fldCharType"];
        if (fld === "separate") { inSep = true; continue; }
        if (fld === "end")      { inSep = false; continue; }
        if (fld === "begin")    continue;

        if (r["w:instrText"]) {
          const instr: string = typeof r["w:instrText"] === "string"
            ? r["w:instrText"]
            : (r["w:instrText"]?._ ?? "");
          if (instr.includes("SEQ") && !label) {
            const m = instr.match(/SEQ\s+(\S+)/);
            if (m) label = m[1];
          }
          continue;
        }

        const t = r["w:t"];
        if (!t) continue;
        const val = typeof t === "string" ? t : (t._ ?? "");

        if (inSep) {
          number = val.trim();
          inSep  = false;
        } else if (val.trim() && !val.includes(label)) {
          text += val;
        }
      }

      if (filterLabel && label !== filterLabel) return;
      results.push({ label, number, text: text.trim(), paragraphIndex: idx });
    });

    return results;
  }

  /**
   * Remove all caption paragraphs for a given label (e.g. remove all "Figure" captions).
   */
  public async removeCaptions(label: string): Promise<void> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);

    const filtered = paragraphs.filter((p: any) => {
      if (p["w:pPr"]?.["w:pStyle"]?.["$"]?.["w:val"] !== "Caption") return true;
      const runs: any[] = p["w:r"]
        ? Array.isArray(p["w:r"]) ? p["w:r"] : [p["w:r"]]
        : [];
      return !runs.some((r: any) => {
        const instr: string = typeof r["w:instrText"] === "string"
          ? r["w:instrText"]
          : (r["w:instrText"]?._ ?? "");
        return instr.includes(`SEQ ${label}`);
      });
    });

    obj["w:document"]["w:body"]["w:p"] = filtered;
    await this.writeDocument(obj);
  }

  /**
   * Remove a single caption by its paragraph index.
   */
  public async removeCaptionAt(paragraphIndex: number): Promise<void> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    if (paragraphIndex < 0 || paragraphIndex >= paragraphs.length) return;
    paragraphs.splice(paragraphIndex, 1);
    obj["w:document"]["w:body"]["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }

  /**
   * Convenience: insert a "Figure N — text" caption below a paragraph.
   */
  public async insertFigureCaption(
    nearIndex: number,
    text: string,
    numbering?: CaptionNumberingOptions,
  ): Promise<number> {
    return this.insertCaption(nearIndex, { label: "Figure", text, numbering });
  }

  /**
   * Convenience: insert a "Table N — text" caption above or below a table.
   */
  public async insertTableCaption(
    nearIndex: number,
    text: string,
    position: CaptionPosition = "above",
    numbering?: CaptionNumberingOptions,
  ): Promise<number> {
    return this.insertCaption(nearIndex, { label: "Table", text, position, numbering });
  }

  /**
   * Convenience: insert an "Equation N" caption.
   */
  public async insertEquationCaption(
    nearIndex: number,
    text = "",
    numbering?: CaptionNumberingOptions,
  ): Promise<number> {
    return this.insertCaption(nearIndex, { label: "Equation", text, numbering });
  }

  /**
   * Insert a caption with a custom label (New Label in Word's dialog).
   */
  public async insertCustomCaption(
    nearIndex: number,
    label: string,
    text: string,
    opts: Omit<CaptionOptions, "label" | "text"> = {},
  ): Promise<number> {
    return this.insertCaption(nearIndex, { ...opts, label, text });
  }

  // ── Caption List (Table of Figures / Table of Tables) ──────────────────────

  /**
   * Insert a "List of [label]" — collects all captions for the given label
   * using the field code:  TOC \h \z \c "Figure"
   *
   * Equivalent to Word: References → Insert Table of Figures.
   *
   * @param label     Caption label to collect: "Figure", "Table", "Equation", etc.
   * @param title     Heading shown above the list (pass "" to omit).
   * @param index     Body paragraph index to insert at (default: 0 = top of document).
   */
  /**
   * Build one pre-populated entry paragraph for a caption list.
   * Matches Word's "Table of Figures" style:
   *   <entry text> <dot leader tab> <page number>
   */
  private buildListEntryParagraph(entryText: string, pageNum = "1"): any {
    return {
      $: {},
      "w:pPr": {
        "w:pStyle": { $: { "w:val": "TableofFigures" } },
        "w:tabs": {
          "w:tab": { $: { "w:val": "right", "w:leader": "dot", "w:pos": "8748" } },
        },
      },
      "w:r": [
        // Entry text
        {
          "w:t": { _: entryText, $: { "xml:space": "preserve" } },
        },
        // Tab — triggers the dot leader
        { "w:tab": {} },
        // Page number (PAGEREF field — Word will update on refresh)
        { "w:fldChar": { $: { "w:fldCharType": "begin" } } },
        { "w:instrText": { _: ` PAGEREF _Toc${Date.now()} \\h `, $: { "xml:space": "preserve" } } },
        { "w:fldChar": { $: { "w:fldCharType": "separate" } } },
        { "w:t": { _: pageNum, $: {} } },
        { "w:fldChar": { $: { "w:fldCharType": "end" } } },
      ],
    };
  }

  public async insertCaptionList(
    label: string,
    title?: string,
    index = 0,
  ): Promise<void> {
    await this.ensureStyles();

    // Collect existing captions for this label BEFORE modifying the document
    const existingCaptions = await this.getCaptions(label);

    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    const heading    = title !== undefined ? title : `List of ${label}s`;
    const instrText  = ` TOC \\h \\z \\c "${label}" `;

    const newParas: any[] = [];

    // 1. Heading paragraph (TOCHeading style)
    if (heading) {
      newParas.push({
        $: {},
        "w:pPr": { "w:pStyle": { $: { "w:val": "TOCHeading" } } },
        "w:r": [{ "w:t": { _: heading, $: { "xml:space": "preserve" } } }],
      });
    }

    // 2. Field-begin paragraph: begin + instrText + separate
    newParas.push({
      $: {},
      "w:r": [
        { "w:fldChar":   { $: { "w:fldCharType": "begin" } } },
        { "w:instrText": { _: instrText, $: { "xml:space": "preserve" } } },
        { "w:fldChar":   { $: { "w:fldCharType": "separate" } } },
      ],
    });

    // 3. One entry paragraph per caption (pre-populated)
    if (existingCaptions.length > 0) {
      existingCaptions.forEach((caption, i) => {
        const num     = caption.number || String(i + 1);
        const display = caption.text
          ? `${label} ${num} ${caption.text}`
          : `${label} ${num}`;
        newParas.push(this.buildListEntryParagraph(display, "1"));
      });
    } else {
      // Fallback when no captions exist yet
      newParas.push({
        $: {},
        "w:pPr": { "w:pStyle": { $: { "w:val": "TableofFigures" } } },
        "w:r": [{ "w:t": { _: `No ${label} captions found`, $: {} } }],
      });
    }

    // 4. Field-end paragraph
    newParas.push({
      $: {},
      "w:r": [{ "w:fldChar": { $: { "w:fldCharType": "end" } } }],
    });

    const insertAt = Math.min(index, paragraphs.length);
    paragraphs.splice(insertAt, 0, ...newParas);
    obj["w:document"]["w:body"]["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }

  /** Shorthand: insert List of Figures at given index. */
  public async insertListOfFigures(title = "List of Figures", index = 0): Promise<void> {
    return this.insertCaptionList("Figure", title, index);
  }

  /** Shorthand: insert List of Tables at given index. */
  public async insertListOfTables(title = "List of Tables", index = 0): Promise<void> {
    return this.insertCaptionList("Table", title, index);
  }

  /**
   * Remove the caption list (TOC \c field) for a given label.
   */
  public async removeCaptionList(label: string): Promise<void> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);

    const filtered = paragraphs.filter((p: any) => {
      // Remove TOCHeading paragraphs that precede a caption-list field
      const runs: any[] = p["w:r"]
        ? Array.isArray(p["w:r"]) ? p["w:r"] : [p["w:r"]]
        : [];
      const hasCaptionListField = runs.some((r: any) => {
        const instr: string =
          typeof r["w:instrText"] === "string"
            ? r["w:instrText"]
            : (r["w:instrText"]?._ ?? "");
        return instr.includes(`\\c "${label}"`);
      });
      return !hasCaptionListField;
    });

    obj["w:document"]["w:body"]["w:p"] = filtered;
    await this.writeDocument(obj);
  }
}
