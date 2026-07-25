/**
 * Doc — the human-friendly facade over mdocxengine.
 *
 * A flat, verb-first API for the 90% case: open a .docx, read its content as
 * plain data, edit it with simple verbs, and save. You never touch a zip entry,
 * a relationship, a part path, or raw OOXML. Blocks are addressed by their
 * zero-based index in document order (the same order `paragraphs()`/`tables()`
 * report), not by `paraId`/`relId`.
 *
 * The underlying `Mdocxengine` (and all its managers) stays reachable via
 * `doc.engine` for anything this facade doesn't cover.
 */
import { Mdocxengine } from "./index";
import { Table } from "./core/files/table/index";
import * as XmlUtils from "./utils/xmlUtils";
import {
  makeStyledParagraphNode,
  makeTableNode,
  makeDrawingParagraphNode,
  nextDrawingId,
  paragraphText,
  paragraphStyleId,
  paragraphHeadingLevel,
  paragraphAlignment,
  paragraphFontSizePt,
  paragraphIsBold,
  type BodyBlock,
  type StyledParagraphOptions,
} from "./core/files/body/OrderedBody";
import { pixelsToEmu, type InlineImage } from "./core/PartsManagers/MediaManager";
import type { SectionEntry, SectionHeaderFooterRef } from "./core/PartsManagers/SectionManager";

const APPEND = Number.MAX_SAFE_INTEGER;

/** One body block as plain data. */
export interface BlockInfo {
  index: number;
  kind: "paragraph" | "table" | "image" | "other";
  /** Visible text (paragraph/cell text); "" for images. */
  text: string;
  /** Paragraph style id, if any. */
  styleId: string | null;
  /** Heading level 1–6, or 0 if not a heading. */
  headingLevel: number;
}

/** A node in the heading outline tree. */
export interface OutlineNode {
  index: number;
  level: number;
  title: string;
  children: OutlineNode[];
}

/** A table as a plain text grid. */
export interface TableInfo {
  index: number;
  rows: string[][];
}

/** An embedded image as plain data. */
export interface ImageInfo extends InlineImage {
  index: number;
}

/** A body block enriched with formatting signals — for inferring structure or AI labelling. */
export interface DetailedBlockInfo extends BlockInfo {
  /** Whole line is bold. */
  bold: boolean;
  /** Inline font size in points, or null if set via styles. */
  fontSizePt: number | null;
  /** Alignment (`center`, `right`, …) or null. */
  alignment: string | null;
  wordCount: number;
  /** Text looks like a figure/table caption (so NOT a heading). */
  looksLikeCaption: boolean;
}

/** A regex → heading-level rule used by {@link Doc.inferOutline}. */
export interface HeadingPattern {
  re: RegExp;
  level: number;
}

/** Tuning for {@link Doc.inferOutline}; all fields have sensible Arabic-academic defaults. */
export interface InferOutlineOptions {
  /** Text patterns that mark a heading at a given level (e.g. `^الفصل` → 1). */
  headingPatterns?: HeadingPattern[];
  /** Keywords that mark a top-level (level-1) section (e.g. `قائمة المراجع`). */
  level1Keywords?: string[];
  /** Keywords that mark a level-2 section (e.g. `تمهيد`). */
  sectionKeywords?: string[];
  /** Patterns that mark a caption (excluded from headings). */
  captionPatterns?: RegExp[];
  /** Max word count for a line to be considered a (format-based) heading. Default 14. */
  maxHeadingWords?: number;
}

/** A heading detected by {@link Doc.inferOutline}. */
export interface InferredHeading {
  index: number;
  level: number;
  title: string;
  /** `styled` = real heading markup; `high`/`medium` = inferred from text/format. */
  confidence: "styled" | "high" | "medium";
  reason: string;
}

const DEFAULT_CAPTION_PATTERNS: RegExp[] = [
  /^الجدول\s*رقم/,
  /^الشكل\s*رقم/,
  /^جدول\s*رقم/,
  /^شكل\s*رقم/,
  /^Table\s*\d/i,
  /^Figure\s*\d/i,
  /^Fig\.?\s*\d/i,
  /^Tableau\s*/i,
];

// NOTE: `\b` is an ASCII word boundary and does NOT trigger after Arabic
// letters — so heading patterns use a lookahead for whitespace/colon/end.
const DEFAULT_HEADING_PATTERNS: HeadingPattern[] = [
  { re: /^الفصل(?=[\s:：]|$)/, level: 1 },
  { re: /^الباب(?=[\s:：]|$)/, level: 1 },
  { re: /^Chapter\b/i, level: 1 },
  { re: /^المبحث(?=[\s:：]|$)/, level: 2 },
  { re: /^المطلب(?=[\s:：]|$)/, level: 3 },
];

const DEFAULT_LEVEL1_KEYWORDS = [
  "مقدمة", "المقدمة", "خاتمة", "الخاتمة", "قائمة المراجع", "المراجع",
  "الملاحق", "الاستنتاجات", "التوصيات", "التوصيات والاقتراحات",
  "قائمة الأشكال", "قائمة الجداول", "الفهرس",
];

const DEFAULT_SECTION_KEYWORDS = ["تمهيد", "مدخل"];

/** Trim surrounding whitespace and Arabic/Latin punctuation for keyword matching. */
function normalizeKey(s: string): string {
  return s.replace(/^[\s:：.)(»«\-]+/, "").replace(/[\s:：.)(»«\-]+$/, "").trim();
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(text));
}

/**
 * The section that owns paragraph `paragraphIndex`. Each intermediate section
 * ENDS at (and includes) its `paragraphIndex`; the final section catches the
 * rest. So the owner is the first section whose `paragraphIndex >= P`, else the
 * final one.
 */
function sectionIndexForParagraph(
  sections: Array<{ index: number; isFinal: boolean; paragraphIndex?: number }>,
  paragraphIndex: number,
): number {
  for (const s of sections) {
    if (s.isFinal) return s.index;
    if (s.paragraphIndex !== undefined && paragraphIndex <= s.paragraphIndex) return s.index;
  }
  return sections.length ? sections[sections.length - 1].index : 0;
}

/** Most frequent value (used to estimate the body font size). */
function mode(nums: number[]): number | null {
  if (!nums.length) return null;
  const counts = new Map<number, number>();
  let best = nums[0];
  let bestCount = 0;
  for (const n of nums) {
    const c = (counts.get(n) ?? 0) + 1;
    counts.set(n, c);
    if (c > bestCount) {
      bestCount = c;
      best = n;
    }
  }
  return best;
}

/** Extracted content of one header/footer part (internal). */
interface HeaderFooterContent {
  text: string;
  /** Tab-separated positioned parts of the running text (e.g. a right/left header
   *  renders as two segments). One entry when there are no tab stops. Empty ends
   *  trimmed. Lets a consumer lay them out positionally instead of concatenated. */
  segments: string[];
  /** The paragraph's BOTTOM border (Word's header rule), if any — `bottom` true when
   *  present, `color` the 6-hex rule colour (e.g. the brown thesis rule) or null. */
  border: { bottom: boolean; color: string | null };
  hasPage: boolean;
  /**
   * Page-number format in w:pgNumType vocabulary ("lowerRoman", …), derived
   * from the PAGE field's `\*` switch. null when there is no PAGE field or
   * its switch isn't recognized.
   */
  pageFormat: string | null;
}

/**
 * Inverse of FooterManager's FORMAT_SWITCH: PAGE field `\*` switch token →
 * w:pgNumType format. Case-sensitive — "roman" and "ROMAN" differ.
 */
const SWITCH_TO_FORMAT: Record<string, string> = {
  ARABIC: "decimal",
  ROMAN: "upperRoman",
  roman: "lowerRoman",
  ALPHABETIC: "upperLetter",
  alphabetic: "lowerLetter",
};

/** The w:pgNumType-vocabulary format encoded in a PAGE field instruction, if any. */
function pageFormatFromInstr(instr: string): string | null {
  for (const m of instr.matchAll(/\\\*\s+([A-Za-z]+)/g)) {
    const fmt = SWITCH_TO_FORMAT[m[1]];
    if (fmt) return fmt;
  }
  return null;
}

/** Decode the five predefined XML entities in a `w:t` text node. */
function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Plain text + PAGE-field flag of one header/footer part's XML.
 *
 * Field handling mirrors what Word RENDERS:
 *  • Complex non-page fields (e.g. a STYLEREF running header) KEEP their cached
 *    result between `separate` and `end` — that text is exactly what shows on
 *    the page.
 *  • PAGE/NUMPAGES fields — complex or `w:fldSimple` — DROP their cached
 *    result: it's a stale per-page number, not authored content ("Conf" plus a
 *    cached "1" would otherwise read back as "Conf1").
 *
 * Paragraph texts are joined with single spaces so multi-paragraph parts don't
 * concatenate ("Chapter 3Introduction"), and whitespace runs are collapsed.
 */
/** Split the running text into tab-separated positioned segments (the runs between
 *  <w:tab/> elements, in order). A two-part right/left header → two segments; no tab
 *  stops → one segment. Empty leading/trailing segments trimmed. */
function extractHeaderSegments(stripped: string): string[] {
  const segs: string[] = [];
  let cur = "";
  for (const m of stripped.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\b[^>]*\/?>/g)) {
    if (m[1] !== undefined) cur += decodeXmlEntities(m[1]);
    else { segs.push(cur); cur = ""; }
  }
  segs.push(cur);
  const cleaned = segs.map((s) => s.replace(/\s+/g, " ").trim());
  while (cleaned.length && cleaned[0] === "") cleaned.shift();
  while (cleaned.length && cleaned[cleaned.length - 1] === "") cleaned.pop();
  return cleaned;
}

/** The header paragraph's BOTTOM border (Word's header rule) — from the first <w:pBdr>. */
function extractHeaderBorder(xml: string): { bottom: boolean; color: string | null } {
  const pBdr = xml.match(/<w:pBdr\b[^>]*>([\s\S]*?)<\/w:pBdr>/);
  if (!pBdr) return { bottom: false, color: null };
  const bottom = pBdr[1].match(/<w:bottom\b[^>]*>/);
  if (!bottom) return { bottom: false, color: null };
  const color = bottom[0].match(/w:color="([0-9A-Fa-f]{6})"/);
  return { bottom: true, color: color ? color[1].toUpperCase() : null };
}

function extractHeaderFooterContent(xml: string): HeaderFooterContent {
  // The PAGE field's instruction — complex (<w:instrText>) or simple
  // (w:fldSimple/@w:instr) — drives both the flag and the format.
  const pageInstr =
    Array.from(xml.matchAll(/<w:instrText[^>]*>([^<]*)<\/w:instrText>/g))
      .map((m) => m[1] ?? "")
      .find((t) => /\bPAGE\b/.test(t)) ??
    Array.from(xml.matchAll(/<w:fldSimple\b[^>]*w:instr="([^"]*)"/g))
      .map((m) => m[1] ?? "")
      .find((t) => /\bPAGE\b/.test(t)) ??
    null;
  const hasPage = pageInstr !== null;
  const pageFormat = pageInstr !== null ? pageFormatFromInstr(pageInstr) : null;

  // Complex fields: within each begin…end span, strip separate→end only when
  // the field instruction is PAGE/NUMPAGES; other fields stay untouched.
  let stripped = xml.replace(
    /<w:fldChar[^>]*w:fldCharType="begin"[^>]*\/>[\s\S]*?<w:fldChar[^>]*w:fldCharType="end"[^>]*\/>/g,
    (span) =>
      /<w:instrText[^>]*>[^<]*\b(?:PAGE|NUMPAGES)\b/.test(span)
        ? span.replace(/<w:fldChar[^>]*w:fldCharType="separate"[^>]*\/>[\s\S]*$/, "")
        : span,
  );
  // Simple fields: drop the whole element (cached digit included) when its
  // instruction is a page field; other fldSimple content stays extractable.
  stripped = stripped.replace(
    /<w:fldSimple\b[^>]*w:instr="[^"]*\b(?:PAGE|NUMPAGES)\b[^"]*"[^>]*>[\s\S]*?<\/w:fldSimple>/g,
    "",
  );

  const text = stripped
    .split("</w:p>")
    .map((chunk) =>
      Array.from(chunk.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g))
        .map((m) => decodeXmlEntities(m[1] ?? ""))
        .join(""),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const segments = extractHeaderSegments(stripped);
  const border = extractHeaderBorder(xml);
  return { text, segments, border, hasPage, pageFormat };
}

/** Options accepted by paragraph/heading verbs. */
export type ParagraphFormat = Omit<StyledParagraphOptions, "outlineLevel" | "styleId"> & {
  styleId?: string;
};

/** Footer options (text and/or page numbers) for {@link Doc.setFooter}/{@link Doc.setSectionFooter}. */
export interface FooterOptions {
  text?: string;
  pageNumbers?: boolean;
  alignment?: "left" | "center" | "right";
  /** Text before the page number, e.g. "Page ". */
  prefix?: string;
  /** Render "current / total" (e.g. "3 / 40"). */
  includeTotalPages?: boolean;
}

/** Result of a section-scoped header/footer change. */
export interface SectionEditResult {
  sectionIndex: number;
  totalSections: number;
}

export interface SectionInfo {
  /** Section position in document order (0-based; same order as getSections()). */
  index: number;
  /** Block index (document.getBlocks() order) of the section's first block. */
  startBlockIndex: number;
  /**
   * Effective running header text — the section's own default part, else the
   * previous section's (ECMA-376 inheritance). null = no header anywhere in
   * the chain; "" = an explicitly blank header part.
   */
  headerText: string | null;
  /** The effective header's tab-separated positioned segments (e.g. a right/left
   *  header → two entries) for faithful rendering. null when there's no header. */
  headerSegments: string[] | null;
  /** The effective header paragraph's bottom rule (Word's header line): `bottom`
   *  true when present + its 6-hex `color`. null when there's no header. */
  headerBorder: { bottom: boolean; color: string | null } | null;
  /** Effective footer text (same inheritance rules). */
  footerText: string | null;
  /** True when the effective footer part contains a PAGE field. */
  footerHasPageNumbers: boolean;
  /**
   * Page-number format in w:pgNumType vocabulary ("decimal", "lowerRoman", …).
   * The section's own w:pgNumType format wins when set; otherwise the format
   * is derived from the effective footer's PAGE field `\*` switch (the normal
   * insertion path writes only the switch), which travels with the inherited
   * part. null when neither exists.
   */
  pageNumberFormat: string | null;
  /** This section's own w:pgNumType start value, if set. */
  pageNumberStart: number | null;
}

type BreakType = "nextPage" | "evenPage" | "oddPage";

/** A generated, always-accurate structural map of the document. */
export interface DocMap {
  title: string;
  wordCount: number;
  counts: { paragraphs: number; headings: number; tables: number; images: number; sections: number };
  page: { width: number; height: number; orientation: string };
  margins: { top: number; right: number; bottom: number; left: number };
  hasHeader: boolean;
  hasFooter: boolean;
  rtl: boolean;
  outline: OutlineNode[];
}

export class Doc {
  /** Escape hatch: the underlying engine + all its managers. */
  readonly engine: Mdocxengine;

  private constructor(engine: Mdocxengine) {
    this.engine = engine;
  }

  /** Open a document from a file path or an in-memory buffer. */
  static async open(source: string | Buffer): Promise<Doc> {
    const engine =
      typeof source === "string"
        ? await Mdocxengine.loadFromFile(source)
        : await Mdocxengine.loadFromBuffer(source);
    return new Doc(engine);
  }

  /** Wrap an already-loaded engine. */
  static from(engine: Mdocxengine): Doc {
    return new Doc(engine);
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  /** Whole-document plain text (blocks joined by `separator`, default newline). */
  async text(separator = "\n"): Promise<string> {
    return this.engine.document.getPlainText(separator);
  }

  /** Total word count of the body. */
  async wordCount(): Promise<number> {
    return this.engine.document.getWordCount();
  }

  /** Every body block as plain data, in document order. */
  async blocks(): Promise<BlockInfo[]> {
    const raw = await this.engine.document.getBlocks();
    return raw.map((b, index) => this.toBlockInfo(b, index));
  }

  private toBlockInfo(b: BodyBlock, index: number): BlockInfo {
    if (b.kind === "table") {
      return { index, kind: "table", text: "", styleId: null, headingLevel: 0 };
    }
    if (b.kind === "paragraph") {
      const isImage = b.xml.includes("<w:drawing>");
      return {
        index,
        kind: isImage ? "image" : "paragraph",
        text: isImage ? "" : paragraphText(b.xml),
        styleId: paragraphStyleId(b.xml),
        headingLevel: paragraphHeadingLevel(b.xml),
      };
    }
    return { index, kind: "other", text: "", styleId: null, headingLevel: 0 };
  }

  /** The heading outline as a nested tree (like a table of contents). */
  async outline(): Promise<OutlineNode[]> {
    const flat = (await this.blocks())
      .filter((b) => b.headingLevel > 0 && b.text.trim())
      .map((b) => ({ index: b.index, level: b.headingLevel, title: b.text.trim() }));

    const roots: OutlineNode[] = [];
    const stack: OutlineNode[] = [];
    for (const h of flat) {
      const node: OutlineNode = { ...h, children: [] };
      while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
      (stack.length ? stack[stack.length - 1].children : roots).push(node);
      stack.push(node);
    }
    return roots;
  }

  /** Every table as a plain text grid. */
  async tables(): Promise<TableInfo[]> {
    const raw = await this.engine.document.getBlocks();
    const out: TableInfo[] = [];
    for (let i = 0; i < raw.length; i++) {
      if (raw[i].kind !== "table") continue;
      const t = await Table.fromXml(raw[i].xml);
      out.push({ index: i, rows: t.getAllCellText() });
    }
    return out;
  }

  /** Every embedded inline image as bytes + size + mime. */
  async images(): Promise<ImageInfo[]> {
    const raw = await this.engine.document.getBlocks();
    const out: ImageInfo[] = [];
    for (let i = 0; i < raw.length; i++) {
      if (!raw[i].xml.includes("<w:drawing>")) continue;
      const img = await this.engine.media.extractInlineImage(raw[i].xml);
      if (img) out.push({ index: i, ...img });
    }
    return out;
  }

  /**
   * Every body block enriched with formatting signals (bold, font size,
   * alignment, word count, caption flag). The raw material for inferring
   * structure when a document has no heading markup — feed it to a heuristic
   * (`inferOutline`) or to an LLM to label headings.
   */
  async blocksDetailed(captionPatterns: RegExp[] = DEFAULT_CAPTION_PATTERNS): Promise<DetailedBlockInfo[]> {
    const raw = await this.engine.document.getBlocks();
    return raw.map((b, index) => {
      const base = this.toBlockInfo(b, index);
      const wordCount = base.text ? base.text.split(/\s+/).filter(Boolean).length : 0;
      if (b.kind === "paragraph" && base.kind === "paragraph") {
        return {
          ...base,
          bold: paragraphIsBold(b.xml),
          fontSizePt: paragraphFontSizePt(b.xml),
          alignment: paragraphAlignment(b.xml),
          wordCount,
          looksLikeCaption: matchesAny(base.text.trim(), captionPatterns),
        };
      }
      return { ...base, bold: false, fontSizePt: null, alignment: null, wordCount, looksLikeCaption: false };
    });
  }

  /**
   * Infer a heading outline for documents whose titles are plain text (no
   * heading styles) — the common case for imported / copy-pasted theses.
   *
   * Real headings (styled or with an outline level) are reported as
   * `confidence: "styled"`. The rest are inferred from text patterns
   * (`^الفصل`, `^المبحث`…), section keywords (`تمهيد`, `قائمة المراجع`…), and
   * formatting (bold / larger-than-body font / centered + short line), while
   * figure/table captions are excluded. All rules are overridable.
   *
   * This is a best-effort heuristic; for messy documents, pass
   * `blocksDetailed()` to an LLM and call `setHeadingLevel()` with its labels.
   */
  async inferOutline(opts: InferOutlineOptions = {}): Promise<InferredHeading[]> {
    const captionPatterns = opts.captionPatterns ?? DEFAULT_CAPTION_PATTERNS;
    const headingPatterns = opts.headingPatterns ?? DEFAULT_HEADING_PATTERNS;
    const level1 = new Set((opts.level1Keywords ?? DEFAULT_LEVEL1_KEYWORDS).map(normalizeKey));
    const sections = new Set((opts.sectionKeywords ?? DEFAULT_SECTION_KEYWORDS).map(normalizeKey));
    const maxWords = opts.maxHeadingWords ?? 14;

    const detailed = await this.blocksDetailed(captionPatterns);
    // Estimate the body font as the most common inline size among long paragraphs.
    const bodyFont = mode(
      detailed.filter((b) => b.kind === "paragraph" && b.fontSizePt != null && b.wordCount > 20).map((b) => b.fontSizePt!),
    );

    const out: InferredHeading[] = [];
    for (const b of detailed) {
      if (b.kind !== "paragraph") continue;
      const title = b.text.trim();
      if (!title) continue;

      if (b.headingLevel > 0) {
        out.push({ index: b.index, level: b.headingLevel, title, confidence: "styled", reason: "heading style / outline level" });
        continue;
      }
      if (b.looksLikeCaption) continue;

      const pat = headingPatterns.find((p) => p.re.test(title));
      if (pat) {
        out.push({ index: b.index, level: pat.level, title, confidence: "high", reason: "matches heading pattern" });
        continue;
      }

      const key = normalizeKey(title);
      const firstWord = normalizeKey(title.split(/\s+/)[0] ?? "");
      if (level1.has(key) || level1.has(firstWord)) {
        out.push({ index: b.index, level: 1, title, confidence: "high", reason: "top-level keyword" });
        continue;
      }
      if (sections.has(key) || sections.has(firstWord)) {
        out.push({ index: b.index, level: 2, title, confidence: "high", reason: "section keyword" });
        continue;
      }

      const short = b.wordCount > 0 && b.wordCount <= maxWords;
      const larger = bodyFont != null && b.fontSizePt != null && b.fontSizePt > bodyFont;
      const centered = b.alignment === "center";
      if (short && (b.bold || larger)) {
        const strong = b.bold && (larger || centered);
        out.push({
          index: b.index,
          level: 2,
          title,
          confidence: strong ? "high" : "medium",
          reason: [b.bold && "bold", larger && "larger-font", centered && "centered", "short line"].filter(Boolean).join(", "),
        });
      }
    }
    return out;
  }

  // ─── Write (verbs) ───────────────────────────────────────────────────────────

  /** Append a paragraph (or insert at `at`). */
  async addParagraph(text: string, opts: ParagraphFormat = {}, at = APPEND): Promise<this> {
    await this.engine.document.insertBlockAt(makeStyledParagraphNode(text, opts), at);
    return this;
  }

  /** Append a heading at `level` (1–6) → maps to `Heading{level}`, bold, with outline level. */
  async addHeading(text: string, level = 1, opts: ParagraphFormat = {}, at = APPEND): Promise<this> {
    const lvl = Math.min(6, Math.max(1, level));
    const block = makeStyledParagraphNode(text, {
      styleId: `Heading${lvl}`,
      outlineLevel: lvl - 1,
      bold: true,
      ...opts,
    });
    await this.engine.document.insertBlockAt(block, at);
    return this;
  }

  /** Replace the text of the paragraph at `index` (preserves its formatting). */
  async editParagraph(index: number, text: string): Promise<this> {
    await this.engine.document.editParagraphText(index, text);
    return this;
  }

  /**
   * Promote (or demote) the paragraph at `index` to a real heading at `level`
   * (1–6): applies the `Heading{level}` style + matching outline level, keeping
   * the text and preserving RTL/alignment. This is how you turn a plain-text
   * title — e.g. one found by `inferOutline()` or labelled by an LLM — into a
   * structural heading the outline/TOC can see.
   */
  async setHeadingLevel(index: number, level: number): Promise<this> {
    const blocks = await this.engine.document.getBlocks();
    const b = blocks[index];
    if (!b || b.kind !== "paragraph" || b.xml.includes("<w:drawing>")) {
      throw new Error(`setHeadingLevel: no text paragraph at block index ${index}`);
    }
    const lvl = Math.min(6, Math.max(1, level));
    const rtl = /<w:bidi\b/.test(b.xml) || /<w:rtl\b/.test(b.xml);
    const alignment = paragraphAlignment(b.xml) as StyledParagraphOptions["alignment"] | null;
    blocks[index] = makeStyledParagraphNode(paragraphText(b.xml), {
      styleId: `Heading${lvl}`,
      outlineLevel: lvl - 1,
      rtl,
      ...(alignment ? { alignment } : {}),
    });
    await this.engine.document.saveBlocks(blocks);
    return this;
  }

  /** Delete the block at `index`. */
  async deleteBlock(index: number): Promise<this> {
    await this.engine.document.deleteBlockAt(index);
    return this;
  }

  /** Append a table from a row-major grid (or insert at `at`). */
  async addTable(
    rows: string[][],
    opts: { header?: boolean; rtl?: boolean } = {},
    at = APPEND,
  ): Promise<this> {
    const block = makeTableNode(rows, { headerRow: opts.header, rtl: opts.rtl });
    await this.engine.document.insertBlockAt(block, at);
    return this;
  }

  /** Set the text of one cell of the table at block `index`. */
  async editTableCell(index: number, row: number, col: number, value: string): Promise<this> {
    return this.mutateTable(index, (t) => t.setCellText(row, col, value));
  }

  // Shared load→mutate→save round-trip for the table at `index` (mirrors the old
  // editTableCell inline body). ANY Table mutation preserves per-cell formatting
  // because it edits the parsed TableObject, then re-serializes the whole <w:tbl>.
  private async mutateTable(index: number, fn: (t: Table) => void): Promise<this> {
    const blocks = await this.engine.document.getBlocks();
    const block = blocks[index];
    if (!block || block.kind !== "table") throw new Error(`No table at block index ${index}`);
    const table = await Table.fromXml(block.xml);
    fn(table);
    blocks[index] = {
      ...block,
      xml: XmlUtils.buildXml(table.toObject(), { rootName: "w:tbl", headless: true, pretty: false }),
    };
    await this.engine.document.saveBlocks(blocks);
    return this;
  }

  /**
   * Insert a row into the table at `index`: below row `at` (0-based), ABOVE it
   * when `before` is true (e.g. a new first row: at=0, before=true), or
   * appended when `at` is omitted.
   */
  async addTableRow(index: number, at?: number, before?: boolean): Promise<this> {
    return this.mutateTable(index, (t) => {
      if (at != null && at >= 0 && at < t.getRowCount()) {
        if (before) t.insertRowAbove(at);
        else t.insertRowBelow(at);
      } else t.addRow();
    });
  }

  /** Remove row `row` (0-based) from the table at `index`. */
  async removeTableRow(index: number, row: number): Promise<this> {
    return this.mutateTable(index, (t) => t.removeRow(row));
  }

  /**
   * Insert a column into the table at `index`: to the right of column `at`
   * (0-based), to its LEFT when `before` is true (e.g. a new first column:
   * at=0, before=true), or appended when omitted.
   */
  async insertTableColumn(index: number, at?: number, before?: boolean): Promise<this> {
    return this.mutateTable(index, (t) => {
      const cols = t.getColumnCount();
      const target = at != null && at >= 0 && at < cols ? at : Math.max(0, cols - 1);
      if (before && at != null) t.insertColumnLeft(target);
      else t.insertColumnRight(target);
    });
  }

  /** Sort the table's data rows by column `col` (numeric when both parse). Header row 0 stays put unless includeHeader. */
  async sortTable(index: number, col: number, opts?: { desc?: boolean; includeHeader?: boolean }): Promise<this> {
    return this.mutateTable(index, (t) => {
      t.sortByColumn(col, opts?.desc ? "desc" : "asc", !(opts?.includeHeader ?? false));
    });
  }

  /**
   * Column/table widths: `columnsTwips[i]` sets column i's preferred width
   * (1440 twips = 1 inch; ~600 per cm); `autofit` switches the layout mode.
   */
  async setTableWidths(index: number, opts: { columnsTwips?: number[]; autofit?: "contents" | "window" }): Promise<this> {
    return this.mutateTable(index, (t) => {
      if (opts.autofit === "contents") t.autoFitContents();
      else if (opts.autofit === "window") t.autoFitWindow();
      if (opts.columnsTwips) {
        for (let c = 0; c < opts.columnsTwips.length; c++) {
          const w = opts.columnsTwips[c];
          if (w && w > 0) t.setColumnWidth(c, Math.round(w));
        }
      }
    });
  }

  /**
   * Format a cell (row+col) or a whole row (row only, col omitted) — existing
   * text preserved: bold/italic, font size (points), font family, vertical
   * alignment inside the cell, uniform cell padding (twips).
   */
  async formatTableCellText(
    index: number,
    opts: {
      row?: number;
      col?: number;
      bold?: boolean;
      italic?: boolean;
      sizePt?: number;
      fontFamily?: string;
      vAlign?: "top" | "center" | "bottom";
      paddingTwips?: number;
    },
  ): Promise<this> {
    return this.mutateTable(index, (t) => {
      const row = opts.row ?? 0;
      const cols = t.getColumnCount();
      const targets = opts.col != null ? [opts.col] : Array.from({ length: cols }, (_, c) => c);
      for (const c of targets) {
        if (opts.bold !== undefined || opts.italic !== undefined || opts.sizePt !== undefined || opts.fontFamily !== undefined) {
          t.setCellTextFormat(row, c, {
            bold: opts.bold,
            italic: opts.italic,
            sizeHalfPoints: opts.sizePt != null ? Math.round(opts.sizePt * 2) : undefined,
            fontFamily: opts.fontFamily,
          });
        }
        if (opts.vAlign) t.setCellVerticalAlignment(row, c, opts.vAlign);
        if (opts.paddingTwips != null) {
          const p = Math.round(opts.paddingTwips);
          t.setCellMargins(row, c, { top: p, bottom: p, left: p, right: p });
        }
      }
    });
  }

  /** Merge cells: horizontal (row + startCol..endCol) or vertical (col + startRow..endRow). */
  async mergeTableCells(
    index: number,
    opts:
      | { direction: "horizontal"; row: number; start: number; end: number }
      | { direction: "vertical"; col: number; start: number; end: number },
  ): Promise<this> {
    return this.mutateTable(index, (t) => {
      if (opts.direction === "horizontal") t.mergeCellsHorizontal(opts.row, opts.start, opts.end);
      else t.mergeCellsVertical(opts.col, opts.start, opts.end);
    });
  }

  /** Delete column `col` (0-based) from the table at `index`. */
  async deleteTableColumn(index: number, col: number): Promise<this> {
    return this.mutateTable(index, (t) => t.deleteColumn(col));
  }

  /**
   * Table-level layout + styling. All fields optional — pass what changes:
   * alignment/direction/header (row 0) as before; `borders` true/false for
   * simple single/none, or `{ style?, sizePt?, color?, sides? }` for custom
   * borders (sides defaults to all six); `widthPct` (10..100) sets the table
   * width as a page percentage; `indentTwips` indents from the margin;
   * `wrap` lets body text flow around the table; `styleId` applies a named
   * Word table style (must exist in the doc's styles.xml); `rowHeightTwips`
   * (+ optional `row`, default all rows) sets row height; `distributeRows` /
   * `distributeColumns` even out sizes; `allowRowBreaks` toggles rows
   * splitting across pages; `altTitle`/`altDescription` set accessibility
   * alt text.
   */
  async setTableLayout(
    index: number,
    opts: {
      alignment?: "left" | "center" | "right";
      direction?: "rtl" | "ltr";
      headerRow?: boolean;
      headerFill?: string;
      borders?: boolean | { style?: string; sizePt?: number; color?: string; sides?: ("top" | "bottom" | "left" | "right" | "insideH" | "insideV")[] };
      widthPct?: number;
      indentTwips?: number;
      wrap?: "none" | "around";
      styleId?: string;
      rowHeightTwips?: number;
      row?: number;
      distributeRows?: boolean;
      distributeColumns?: boolean;
      allowRowBreaks?: boolean;
      altTitle?: string;
      altDescription?: string;
    },
  ): Promise<this> {
    return this.mutateTable(index, (t) => {
      if (opts.alignment) t.setTableAlignment(opts.alignment);
      if (opts.direction) t.setTableDirection(opts.direction === "rtl");
      // headerFill alone also marks+shades row 0 (e.g. "make the header orange").
      if (opts.headerRow || opts.headerFill) t.setHeaderRow(0, opts.headerFill);
      if (opts.borders != null) {
        if (typeof opts.borders === "boolean") {
          const side = opts.borders ? { style: "single", size: 4 } : { style: "none" };
          t.setTableBorders({ top: side, bottom: side, left: side, right: side, insideH: side, insideV: side });
        } else {
          const b = opts.borders;
          const side = {
            style: b.style ?? "single",
            size: Math.max(2, Math.round((b.sizePt ?? 0.5) * 8)),
            color: (b.color ?? "000000").replace("#", ""),
          };
          const sides = b.sides ?? ["top", "bottom", "left", "right", "insideH", "insideV"];
          const all: Record<string, typeof side> = {};
          for (const s of sides) all[s] = side;
          t.setTableBorders(all);
        }
      }
      if (opts.widthPct != null) t.setTableWidth(Math.round(Math.max(10, Math.min(100, opts.widthPct)) * 50), "pct");
      if (opts.indentTwips != null) t.setTableIndent(Math.round(opts.indentTwips));
      if (opts.wrap) t.setTextWrapping(opts.wrap);
      if (opts.styleId) t.setTableStyle(opts.styleId);
      if (opts.rowHeightTwips != null) {
        const rows = t.getRowCount();
        const targets = opts.row != null ? [opts.row] : Array.from({ length: rows }, (_, r) => r);
        for (const r of targets) t.setRowHeight(r, Math.round(opts.rowHeightTwips));
      }
      if (opts.distributeRows) t.distributeRows();
      if (opts.distributeColumns) t.distributeColumns();
      if (opts.allowRowBreaks != null) {
        for (let r = 0; r < t.getRowCount(); r++) t.setRowAllowBreak(r, opts.allowRowBreaks);
      }
      if (opts.altTitle != null) t.setAltText(opts.altTitle, opts.altDescription ?? "");
    });
  }

  /** Split a merged cell back apart: horizontal (gridSpan) or vertical (vMerge chain). */
  async splitTableCells(index: number, opts: { direction: "horizontal" | "vertical"; row: number; col: number }): Promise<this> {
    return this.mutateTable(index, (t) => {
      if (opts.direction === "horizontal") t.splitCellHorizontal(opts.row, opts.col);
      else t.splitCellVertical(opts.row, opts.col);
    });
  }

  /** Move a row or a column from one position to another (0-based). */
  async moveTableLine(index: number, opts: { kind: "row" | "column"; from: number; to: number }): Promise<this> {
    return this.mutateTable(index, (t) => {
      if (opts.kind === "row") t.moveRow(opts.from, opts.to);
      else t.moveColumn(opts.from, opts.to);
    });
  }

  /**
   * Style one cell (row+col), a whole row (row only), or the header row
   * (neither): `fill` = 6-hex background, `textColor` = 6-hex font colour of
   * the existing text. Pass either or both.
   */
  async shadeTable(index: number, opts: { row?: number; col?: number; fill?: string; textColor?: string }): Promise<this> {
    return this.mutateTable(index, (t) => {
      const row = opts.row ?? 0;
      const cols = t.getColumnCount();
      const targets = opts.col != null ? [opts.col] : Array.from({ length: cols }, (_, c) => c);
      for (const c of targets) {
        if (opts.fill) t.setCellShading(row, c, opts.fill.replace("#", ""));
        if (opts.textColor) t.setCellTextColor(row, c, opts.textColor);
      }
    });
  }

  /**
   * Apply styling grids: fills[r][c] = 6-hex background, textColors[r][c] =
   * 6-hex font colour for that cell's existing text; null/undefined = leave
   * as-is. Either grid may be omitted.
   */
  async shadeTableCells(
    index: number,
    fills?: (string | null | undefined)[][] | null,
    textColors?: (string | null | undefined)[][] | null,
  ): Promise<this> {
    return this.mutateTable(index, (t) => {
      const rows = t.getRowCount();
      const cols = t.getColumnCount();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const fill = fills?.[r]?.[c];
          if (fill) t.setCellShading(r, c, fill.replace("#", ""));
          const tc = textColors?.[r]?.[c];
          if (tc) t.setCellTextColor(r, c, tc);
        }
      }
    });
  }

  /** Append an image from bytes (or insert at `at`). Size in pixels @96dpi. */
  async addImage(
    bytes: Buffer,
    opts: { format?: string; width?: number; height?: number; at?: number } = {},
  ): Promise<this> {
    const format = (opts.format ?? "png").toLowerCase();
    const widthEmu = pixelsToEmu(opts.width ?? 400);
    const heightEmu = pixelsToEmu(opts.height ?? 300);
    const { relId } = await this.engine.media.insertImage(bytes, format);
    const docXml = this.engine.zip.getFileAsString("word/document.xml") ?? "";
    const drawingId = nextDrawingId(docXml);
    const block = makeDrawingParagraphNode(relId, widthEmu, heightEmu, drawingId, `Image ${drawingId}`);
    await this.engine.document.insertBlockAt(block, opts.at ?? APPEND);
    return this;
  }

  /** Render Markdown and append the result (headings, paragraphs, lists, tables). */
  async addMarkdown(blocks: BodyBlock[], at = APPEND): Promise<this> {
    // Accepts pre-built BodyBlocks (e.g. from a markdown renderer) and appends them.
    const target = await this.engine.document.getBlocks();
    const insertAt = at === APPEND ? target.length : at;
    await this.engine.document.saveBlocks([
      ...target.slice(0, insertAt),
      ...blocks,
      ...target.slice(insertAt),
    ]);
    return this;
  }

  /** Find-and-replace across the document body (e.g. fill `{{tokens}}`). */
  async replaceText(find: string | RegExp, replace: string): Promise<this> {
    await this.engine.document.findAndReplaceAll(find, replace);
    return this;
  }

  // ─── Page setup / layout (chainable) ─────────────────────────────────────────

  async setPageSize(preset: "A4" | "USLetter" | "Legal" | "A3" | "A5", orientation: "portrait" | "landscape" = "portrait"): Promise<this> {
    await this.engine.pageLayout.setPageSizePreset(preset as any, orientation);
    return this;
  }

  async setMargins(margins: { top?: number; right?: number; bottom?: number; left?: number }): Promise<this> {
    await this.engine.pageLayout.setMargins(margins as any);
    return this;
  }

  async setOrientation(orientation: "portrait" | "landscape"): Promise<this> {
    await this.engine.pageLayout.setOrientation(orientation);
    return this;
  }

  /** Page numbers in the footer (centered decimal by default). */
  async addPageNumbers(opts: { alignment?: "left" | "center" | "right"; format?: "decimal" | "lowerRoman" | "upperRoman" } = {}): Promise<this> {
    const f = await this.engine.footer.addFooter("", "default");
    await this.engine.footer.insertPageNumber(f.footerPath, {
      alignment: opts.alignment ?? "center",
      format: opts.format ?? "decimal",
    });
    return this;
  }

  /** Roman front-matter / arabic body footers, split at `bodyStartIndex`. */
  async frontMatterNumbering(bodyStartIndex: number): Promise<this> {
    await this.engine.applyFrontMatterNumbering({ bodyStartParaIndex: bodyStartIndex });
    return this;
  }

  /**
   * Set ONE document-wide page header (top of every page). Empty text removes it.
   * Replaces any existing header (no duplicates) and clears per-section headers.
   */
  async setHeader(text: string): Promise<this> {
    const existing = this.engine.header.getAllheadersFiles(this.engine.zip);
    for (const h of existing) await this.engine.header.removeHeader(h.fileName);
    const t = (text ?? "").trim();
    if (t) await this.engine.header.addHeader(t, "default", undefined, { registerInSectPr: true });
    return this;
  }

  /**
   * Set ONE document-wide page footer (text and/or page numbers). Empty text +
   * `pageNumbers:false` removes it. Replaces any existing footer and clears
   * per-section footers.
   */
  async setFooter(opts: FooterOptions = {}): Promise<this> {
    const existing = this.engine.footer.getAllFooterFiles(this.engine.zip);
    for (const f of existing) await this.engine.footer.removeFooter(f.fileName);
    const t = (opts.text ?? "").trim();
    if (!t && !opts.pageNumbers) return this; // removed
    const { footerPath } = await this.engine.footer.addFooter(t, "default", undefined, { registerInSectPr: true });
    if (opts.pageNumbers) {
      await this.engine.footer.insertPageNumber(footerPath, {
        alignment: opts.alignment ?? "center",
        prefix: opts.prefix || undefined,
        includeTotalPages: !!opts.includeTotalPages,
      });
    }
    return this;
  }

  /**
   * Make the block at `blockIndex` begin on a new page by inserting a section
   * break just before it (so e.g. each chapter starts a fresh page and can own
   * its header/footer). Returns `{ changed:false }` if the block is already the
   * first content. Block index ↔ paragraph index is handled internally.
   */
  async startOnNewPage(blockIndex: number, breakType: BreakType = "nextPage"): Promise<{ changed: boolean }> {
    const blocks = await this.engine.document.getBlocks();
    if (blockIndex < 0 || blockIndex >= blocks.length) {
      throw new Error(`startOnNewPage: block index ${blockIndex} out of range (0..${blocks.length - 1})`);
    }
    const paraIndex = blocks.slice(0, blockIndex).filter((b) => b.kind === "paragraph").length;
    if (paraIndex === 0) return { changed: false };
    await this.engine.sections.addSectionBreak(paraIndex - 1, breakType);
    return { changed: true };
  }

  /**
   * Give the section CONTAINING the block at `blockIndex` its own running header
   * (call `startOnNewPage` on that heading first to make it its own section).
   * Empty text → a blank header for that section. Cleans up the section's
   * previous distinct header part.
   */
  async setSectionHeader(blockIndex: number, text: string): Promise<SectionEditResult> {
    const { sections, sectionIndex } = await this.resolveSection(blockIndex);
    const oldRelId = sections[sectionIndex]?.headerRefs?.find((h) => h.type === "default")?.relId;
    const { relId } = await this.engine.header.addHeader((text ?? "").trim(), "default", undefined, { registerInSectPr: false });
    await this.engine.sections.setSectionHeader(sectionIndex, relId, "default");
    if (oldRelId && oldRelId !== relId) await this.removeHeaderFooterByRel("header", oldRelId);
    return { sectionIndex, totalSections: sections.length };
  }

  /**
   * Give the section CONTAINING the block at `blockIndex` its own footer (text
   * and/or page numbers). Cleans up the section's previous distinct footer part.
   */
  async setSectionFooter(blockIndex: number, opts: FooterOptions = {}): Promise<SectionEditResult> {
    const { sections, sectionIndex } = await this.resolveSection(blockIndex);
    const oldRelId = sections[sectionIndex]?.footerRefs?.find((f) => f.type === "default")?.relId;
    const { footerPath, relId } = await this.engine.footer.addFooter((opts.text ?? "").trim(), "default", undefined, { registerInSectPr: false });
    if (opts.pageNumbers) {
      await this.engine.footer.insertPageNumber(footerPath, {
        alignment: opts.alignment ?? "center",
        prefix: opts.prefix || undefined,
        includeTotalPages: !!opts.includeTotalPages,
      });
    }
    await this.engine.sections.setSectionFooter(sectionIndex, relId, "default");
    if (oldRelId && oldRelId !== relId) await this.removeHeaderFooterByRel("footer", oldRelId);
    return { sectionIndex, totalSections: sections.length };
  }

  /** Map a block index → its owning section (+ the full section list). */
  private async resolveSection(blockIndex: number): Promise<{ sections: SectionEntry[]; sectionIndex: number }> {
    const blocks = await this.engine.document.getBlocks();
    if (blockIndex < 0 || blockIndex >= blocks.length) {
      throw new Error(`block index ${blockIndex} out of range (0..${blocks.length - 1})`);
    }
    const paraIndex = blocks.slice(0, blockIndex).filter((b) => b.kind === "paragraph").length;
    const sections = await this.engine.sections.getSections();
    return { sections, sectionIndex: sectionIndexForParagraph(sections, paraIndex) };
  }

  /**
   * Per-section header/footer info, read-only companion to setSectionHeader /
   * setSectionFooter. Inheritance is resolved the way Word renders it
   * (ECMA-376): a section without its own reference uses the previous
   * section's part; a first section without one has none.
   *
   * @param preloadedBlocks Pass blocks you already fetched from
   *   `engine.document.getBlocks()` to avoid a second body parse; they must be
   *   CURRENT for this document state.
   */
  async sections(preloadedBlocks?: BodyBlock[]): Promise<SectionInfo[]> {
    const [blocks, entries] = await Promise.all([
      preloadedBlocks ? Promise.resolve(preloadedBlocks) : this.engine.document.getBlocks(),
      this.engine.sections.getSections(),
    ]);
    // Section boundaries live on paragraphs; map paragraph index → block index.
    const paraToBlock: number[] = [];
    blocks.forEach((b, i) => {
      if (b.kind === "paragraph") paraToBlock.push(i);
    });

    const out: SectionInfo[] = [];
    // Sections often share one part (that's what inheritance references) —
    // read each part at most once per call.
    const partCache = new Map<string, HeaderFooterContent | null>();
    let header: HeaderFooterContent | null = null;
    let footer: HeaderFooterContent | null = null;

    for (let k = 0; k < entries.length; k++) {
      const prev = entries[k - 1];
      const prevBreakBlock =
        prev?.paragraphIndex !== undefined ? paraToBlock[prev.paragraphIndex] : undefined;
      const startBlockIndex =
        k === 0 ? 0 : Math.min((prevBreakBlock ?? -1) + 1, blocks.length);

      const own = entries[k];
      const [ownHeader, ownFooter] = await Promise.all([
        this.readHeaderFooterPart(own.headerRefs, partCache),
        this.readHeaderFooterPart(own.footerRefs, partCache),
      ]);
      if (ownHeader) header = ownHeader;
      if (ownFooter) footer = ownFooter;

      out.push({
        index: k,
        startBlockIndex,
        headerText: header ? header.text : null,
        headerSegments: header ? header.segments : null,
        headerBorder: header ? header.border : null,
        footerText: footer ? footer.text : null,
        footerHasPageNumbers: !!footer?.hasPage,
        // Explicit pgNumType wins; else the format the effective footer's PAGE
        // field renders with (it travels with the inherited part).
        pageNumberFormat: own.pageNumberType?.format ?? footer?.pageFormat ?? null,
        pageNumberStart: own.pageNumberType?.start ?? null,
      });
    }
    return out;
  }

  /**
   * Content of the DEFAULT-type header/footer part behind `refs` (first/even
   * page-only refs are not the running chrome and are ignored), memoized by
   * relId in `cache` so sections sharing a part read it once per
   * {@link sections} call. null when no part resolves — including on any
   * read/parse failure, so chrome extraction can never throw.
   */
  private async readHeaderFooterPart(
    refs: SectionHeaderFooterRef[],
    cache: Map<string, HeaderFooterContent | null>,
  ): Promise<HeaderFooterContent | null> {
    const ref = refs.find((r) => r.type === "default");
    if (!ref?.relId) return null;
    if (cache.has(ref.relId)) return cache.get(ref.relId) ?? null;
    let content: HeaderFooterContent | null = null;
    try {
      const target = await this.engine.rels.getTarget(ref.relId);
      if (target) {
        const path = target.startsWith("word/") ? target : `word/${target.replace(/^\/+/, "")}`;
        const xml = this.engine.zip.readAsText(path);
        if (xml) content = extractHeaderFooterContent(xml);
      }
    } catch {
      content = null;
    }
    cache.set(ref.relId, content);
    return content;
  }

  /** Best-effort delete of a header/footer part by its relationship id (cleanup). */
  private async removeHeaderFooterByRel(which: "header" | "footer", relId: string): Promise<void> {
    const target = await this.engine.rels.getTarget(relId);
    if (!target) return;
    const path = target.startsWith("word/") ? target : `word/${target.replace(/^\/+/, "")}`;
    if (which === "header") await this.engine.header.removeHeader(path).catch(() => {});
    else await this.engine.footer.removeFooter(path).catch(() => {});
  }

  // ─── Describe (generated map) ────────────────────────────────────────────────

  /** A generated, always-accurate structural map of the document. */
  async describe(): Promise<DocMap> {
    const blocks = await this.blocks();
    const counts = { paragraphs: 0, headings: 0, tables: 0, images: 0, sections: 0 };
    for (const b of blocks) {
      if (b.kind === "table") counts.tables++;
      else if (b.kind === "image") counts.images++;
      else if (b.kind === "paragraph") counts.paragraphs++;
      if (b.headingLevel > 0) counts.headings++;
    }

    const [meta, page, margins, sections, wordCount, outline] = await Promise.all([
      this.engine.metadata.getCoreProperties().catch(() => ({} as any)),
      this.engine.pageLayout.getPageSize().catch(() => ({ width: 0, height: 0, orientation: "portrait" } as any)),
      this.engine.pageLayout.getMargins().catch(() => ({ top: 0, right: 0, bottom: 0, left: 0 } as any)),
      this.engine.sections.getSections().then((s) => s.length).catch(() => 1),
      this.wordCount(),
      this.outline(),
    ]);
    counts.sections = sections;

    const entries = this.engine.zip.getEntries().map((e) => e.entryName);
    const hasHeader = entries.some((n) => /^word\/header\d+\.xml$/.test(n));
    const hasFooter = entries.some((n) => /^word\/footer\d+\.xml$/.test(n));
    const docXml = this.engine.zip.getFileAsString("word/document.xml") ?? "";
    const rtl = /<w:bidi\b/.test(docXml) || /<w:rtl\b/.test(docXml);

    return {
      title: meta.title ?? "",
      wordCount,
      counts,
      page: { width: page.width, height: page.height, orientation: page.orientation },
      margins: { top: margins.top, right: margins.right, bottom: margins.bottom, left: margins.left },
      hasHeader,
      hasFooter,
      rtl,
      outline,
    };
  }

  /** The structural map rendered as human-readable Markdown. */
  async toMarkdownMap(): Promise<string> {
    const m = await this.describe();
    const lines: string[] = [];
    lines.push(`# ${m.title || "Document"} — map`);
    lines.push("");
    lines.push(
      `**${m.counts.paragraphs}** paragraphs · **${m.counts.headings}** headings · ` +
        `**${m.counts.tables}** tables · **${m.counts.images}** images · ` +
        `**${m.counts.sections}** sections · **${m.wordCount}** words`,
    );
    lines.push(
      `Page: ${m.page.width}×${m.page.height} (${m.page.orientation}) · ` +
        `Header: ${m.hasHeader ? "yes" : "no"} · Footer: ${m.hasFooter ? "yes" : "no"} · ` +
        `RTL: ${m.rtl ? "yes" : "no"}`,
    );
    lines.push("");
    lines.push("## Outline");
    if (!m.outline.length) lines.push("_(no headings)_");
    const walk = (nodes: OutlineNode[], depth: number) => {
      for (const n of nodes) {
        lines.push(`${"  ".repeat(depth)}- H${n.level} ${n.title}  _(block ${n.index})_`);
        walk(n.children, depth + 1);
      }
    };
    walk(m.outline, 0);
    return lines.join("\n");
  }

  // ─── Save ────────────────────────────────────────────────────────────────────

  /** Write the document to a file. */
  async save(outputPath: string): Promise<void> {
    await this.engine.saveToFile(outputPath);
  }

  /** Get the document as an in-memory buffer. */
  toBuffer(): Buffer {
    return this.engine.zip.toBuffer();
  }
}
