/**
 * Structural rules: what an element is REQUIRED to contain, and what it is
 * FORBIDDEN to contain.
 *
 * These are the constraints that break a document without breaking its XML, and
 * they are the ones our own edit paths hit. Two came from real theses:
 *
 *  - a bare `<w:r>` left in `<w:body>` by an edit that appended after a
 *    self-closing `<w:p/>` — Word refuses the whole document;
 *  - an emptied `<w:tc>`, which `CT_Tc` forbids (a cell needs at least one
 *    block-level child) and which any "delete the content of this cell" path can
 *    produce.
 *
 * The rest are derived from the ECMA-376 content models rather than guessed at,
 * and every one of them is verified against a corpus of real Word-authored theses
 * so a healthy import can never trip them. Validate new rules the same way, with
 * `scripts/ooxml-validate` in modakerati-server as the arbiter — never a
 * hand-rolled hunch.
 */

import { findElements, markupEnd, tagNameAt, elementEnd } from "./xml";

// ─────────────────────────────────────────────────────────────────────────────
// Content models
// ─────────────────────────────────────────────────────────────────────────────

/** EG_BlockLevelElts — what a body, a table cell, a header/footer or a text box
 *  may contain, plus the range-markup elements that may appear between them. */
export const BLOCK_LEVEL = new Set([
  "w:customXml", "w:sdt", "w:p", "w:tbl", "w:proofErr", "w:permStart", "w:permEnd",
  "w:bookmarkStart", "w:bookmarkEnd", "w:moveFromRangeStart", "w:moveFromRangeEnd",
  "w:moveToRangeStart", "w:moveToRangeEnd", "w:commentRangeStart", "w:commentRangeEnd",
  "w:customXmlInsRangeStart", "w:customXmlInsRangeEnd", "w:customXmlDelRangeStart",
  "w:customXmlDelRangeEnd", "w:customXmlMoveFromRangeStart", "w:customXmlMoveFromRangeEnd",
  "w:customXmlMoveToRangeStart", "w:customXmlMoveToRangeEnd", "w:ins", "w:del",
  "w:moveFrom", "w:moveTo", "m:oMathPara", "m:oMath", "w:altChunk",
]);

/** EG_PContent — what a `<w:p>` may contain (besides its leading `w:pPr`). */
export const RUN_LEVEL = new Set([
  "w:pPr", "w:r", "w:hyperlink", "w:fldSimple", "w:subDoc", "w:smartTag", "w:sdt",
  "w:customXml", "w:dir", "w:bdo", "w:proofErr", "w:permStart", "w:permEnd",
  "w:bookmarkStart", "w:bookmarkEnd", "w:commentRangeStart", "w:commentRangeEnd",
  "w:moveFromRangeStart", "w:moveFromRangeEnd", "w:moveToRangeStart", "w:moveToRangeEnd",
  "w:customXmlInsRangeStart", "w:customXmlInsRangeEnd", "w:customXmlDelRangeStart",
  "w:customXmlDelRangeEnd", "w:customXmlMoveFromRangeStart", "w:customXmlMoveFromRangeEnd",
  "w:customXmlMoveToRangeStart", "w:customXmlMoveToRangeEnd",
  "w:ins", "w:del", "w:moveFrom", "w:moveTo", "m:oMathPara", "m:oMath",
]);

/** Story roots — an element whose content model is block-level. */
export const STORY_ROOTS = ["w:body", "w:hdr", "w:ftr", "w:footnote", "w:endnote", "w:txbxContent"];

/** The empty paragraph Word writes wherever a block-level child is required. */
export const spacerParagraph = (rtl: boolean): string =>
  rtl ? "<w:p><w:pPr><w:bidi/></w:pPr></w:p>" : "<w:p/>";

// ─────────────────────────────────────────────────────────────────────────────
// Child enumeration
// ─────────────────────────────────────────────────────────────────────────────

export interface Child { tag: string; start: number; end: number }

/** Immediate element children of the region `[from, to)`, each as a full subtree.
 *  Text and comments are skipped; the caller only ever asks about elements. */
export function childElements(xml: string, from: number, to: number): Child[] {
  const out: Child[] = [];
  let i = from;
  while (i < to) {
    const lt = xml.indexOf("<", i);
    if (lt === -1 || lt >= to) break;
    const tag = tagNameAt(xml, lt);
    if (!tag || xml[lt + 1] === "/") {
      const me = markupEnd(xml, lt);
      if (me === -1) break;
      i = me;
      continue;
    }
    const ee = elementEnd(xml, lt);
    if (ee === -1) break;
    out.push({ tag, start: lt, end: ee });
    i = ee;
  }
  return out;
}

/** True when the region holds nothing but whitespace between its markup. */
export function hasOnlyWhitespaceText(xml: string, from: number, to: number): boolean {
  return !xml.slice(from, to).replace(/<[^>]*>/g, "").trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule: a required child is missing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A `<w:tc>` with no block-level child. Fixed by inserting the empty paragraph
 * Word itself keeps in a blank cell.
 *
 * SEVERITY NOTE — this one is rated `fatal` on a judgement call, not on the
 * arbiter's word. `scripts/ooxml-validate` ACCEPTS an empty cell (the generated
 * schema relaxes the group's minOccurs), yet an empty `<w:tc/>` is a
 * long-documented cause of Word's "problems with the contents" prompt. The
 * asymmetry decides it: a scan of every real thesis and template in the corpus
 * found ZERO empty cells, so rating it fatal cannot cry wolf on a healthy
 * document — while rating it a warning risks exactly the failure that cost this
 * project a whole debugging session, a file reported "opens fine" that does not
 * open. Same reasoning for the cell-less row below. Promote or demote on
 * evidence, not taste.
 */
export function fillEmptyCells(xml: string): { xml: string; count: number } {
  const rtl = /<w:bidiVisual\b/.test(xml);
  const cells = findElements(xml, "w:tc");
  let out = xml;
  let count = 0;
  // Back-to-front so earlier offsets stay valid.
  for (let i = cells.length - 1; i >= 0; i--) {
    const c = cells[i];
    if (c.selfClosing) {
      out = out.slice(0, c.start) + `<w:tc>${spacerParagraph(rtl)}</w:tc>` + out.slice(c.end);
      count++;
      continue;
    }
    const kids = childElements(xml, c.innerStart, c.innerEnd);
    if (kids.some((k) => k.tag === "w:p" || k.tag === "w:tbl")) continue;
    // Keep any w:tcPr; the paragraph goes after it.
    out = out.slice(0, c.innerEnd) + spacerParagraph(rtl) + out.slice(c.innerEnd);
    count++;
  }
  return { xml: out, count };
}

/** A story (body, header, footer, footnote, text box) may not be empty either. */
export function fillEmptyStories(xml: string): { xml: string; count: number } {
  const rtl = /<w:bidiVisual\b/.test(xml);
  let out = xml;
  let count = 0;
  for (const root of STORY_ROOTS) {
    const found = findElements(out, root);
    for (let i = found.length - 1; i >= 0; i--) {
      const s = found[i];
      if (s.selfClosing) {
        out = out.slice(0, s.start) + `<${root}>${spacerParagraph(rtl)}</${root}>` + out.slice(s.end);
        count++;
        continue;
      }
      const kids = childElements(out, s.innerStart, s.innerEnd);
      // A body whose only child is the trailing sectPr still needs a paragraph.
      if (kids.some((k) => k.tag !== "w:sectPr")) continue;
      const at = kids.length ? kids[0].start : s.innerEnd;
      out = out.slice(0, at) + spacerParagraph(rtl) + out.slice(at);
      count++;
    }
  }
  return { xml: out, count };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule: a table that cannot render
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `CT_Tbl` requires a `<w:tblGrid>`, and `CT_Row` requires at least one `<w:tc>`.
 * A grid can be rebuilt from the widest row (Word lays the columns out from the
 * cells anyway), so that is repaired; a row with no cells renders nothing at all
 * and is removed, as is a table with no rows.
 */
export function repairTables(xml: string): {
  xml: string;
  missingGrid: number;
  emptyRows: number;
  emptyTables: number;
} {
  let out = xml;
  let missingGrid = 0;
  let emptyRows = 0;
  let emptyTables = 0;

  const tables = findElements(out, "w:tbl");
  for (let t = tables.length - 1; t >= 0; t--) {
    const tbl = tables[t];
    if (tbl.selfClosing) {
      out = out.slice(0, tbl.start) + out.slice(tbl.end);
      emptyTables++;
      continue;
    }
    const inner = out.slice(tbl.innerStart, tbl.innerEnd);
    const rows = findElements(inner, "w:tr");

    if (!rows.length) {
      out = out.slice(0, tbl.start) + out.slice(tbl.end);
      emptyTables++;
      continue;
    }

    // Drop cell-less rows first (offsets are inside `inner`).
    let nextInner = inner;
    let widest = 0;
    for (let r = rows.length - 1; r >= 0; r--) {
      const row = rows[r];
      const rowInner = row.selfClosing ? "" : inner.slice(row.innerStart, row.innerEnd);
      const cells = row.selfClosing ? [] : findElements(rowInner, "w:tc");
      if (!cells.length) {
        nextInner = nextInner.slice(0, row.start) + nextInner.slice(row.end);
        emptyRows++;
        continue;
      }
      let width = 0;
      for (const cell of cells) {
        const cellInner = rowInner.slice(cell.innerStart, cell.innerEnd);
        const pr = findElements(cellInner, "w:tcPr")[0];
        const span = pr
          ? /<w:gridSpan\b[^>]*w:val="(\d+)"/.exec(cellInner.slice(pr.innerStart, pr.innerEnd))?.[1]
          : undefined;
        width += span ? Number(span) : 1;
      }
      widest = Math.max(widest, width);
    }

    if (!findElements(nextInner, "w:tblGrid").length && widest > 0) {
      // Word's default page text width is 9360 twips; splitting it evenly is what
      // it does itself when a grid has to be inferred.
      const each = Math.floor(9360 / widest);
      const grid = `<w:tblGrid>${`<w:gridCol w:w="${each}"/>`.repeat(widest)}</w:tblGrid>`;
      const pr = findElements(nextInner, "w:tblPr")[0];
      const at = pr ? pr.end : 0;
      nextInner = nextInner.slice(0, at) + grid + nextInner.slice(at);
      missingGrid++;
    }

    if (nextInner !== inner) out = out.slice(0, tbl.innerStart) + nextInner + out.slice(tbl.innerEnd);
  }

  return { xml: out, missingGrid, emptyRows, emptyTables };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule: content in the wrong kind of container
// ─────────────────────────────────────────────────────────────────────────────

export interface StrayReport {
  /** Run-level content sitting where block-level content belongs. */
  strayRuns: { root: string; count: number };
  /** Anything else illegal at story level, by tag. */
  illegalInStory: Map<string, number>;
  /** Block-level content nested inside a paragraph. */
  blockInParagraph: Map<string, number>;
}

/** True when a run carries something a reader would actually see or miss. */
export function runHasContent(xml: string): boolean {
  if (/<w:(?:drawing|pict|object|br|tab|sym|noBreakHyphen|softHyphen|fldChar|instrText|footnoteReference|endnoteReference|commentReference)\b/.test(xml)) return true;
  return [...xml.matchAll(/<w:(?:t|delText)(?:\s[^>]*)?>([^<]*)<\//g)].some((m) => m[1].length > 0);
}

/**
 * Find run-level content directly inside a story other than `<w:body>` (the body
 * is handled on the ordered-block path, which can splice whole blocks), plus any
 * block-level element illegally nested inside a paragraph.
 *
 * `fix` wraps a stray run in the paragraph it should have been in, or drops it
 * when it carries nothing — never losing content either way.
 */
export function checkContainment(xml: string, fix: boolean): { xml: string; report: StrayReport } {
  const report: StrayReport = {
    strayRuns: { root: "", count: 0 },
    illegalInStory: new Map(),
    blockInParagraph: new Map(),
  };
  let out = xml;

  for (const root of STORY_ROOTS) {
    if (root === "w:body") continue; // ordered-block path owns the body
    const stories = findElements(out, root);
    for (let s = stories.length - 1; s >= 0; s--) {
      const story = stories[s];
      if (story.selfClosing) continue;
      const kids = childElements(out, story.innerStart, story.innerEnd);
      for (let k = kids.length - 1; k >= 0; k--) {
        const kid = kids[k];
        if (kid.tag === "w:sectPr" || BLOCK_LEVEL.has(kid.tag)) continue;
        if (kid.tag === "w:r") {
          report.strayRuns = { root, count: report.strayRuns.count + 1 };
          if (fix) {
            const runXml = out.slice(kid.start, kid.end);
            out = out.slice(0, kid.start)
              + (runHasContent(runXml) ? `<w:p>${runXml}</w:p>` : "")
              + out.slice(kid.end);
          }
        } else {
          report.illegalInStory.set(kid.tag, (report.illegalInStory.get(kid.tag) ?? 0) + 1);
        }
      }
    }
  }

  // Block-level content inside a paragraph: reported only. Moving a table or a
  // nested paragraph out of a `<w:p>` changes where the reader sees it, and
  // guessing wrong is worse than saying so.
  for (const p of findElements(out, "w:p")) {
    if (p.selfClosing) continue;
    for (const kid of childElements(out, p.innerStart, p.innerEnd)) {
      if (RUN_LEVEL.has(kid.tag)) continue;
      report.blockInParagraph.set(kid.tag, (report.blockInParagraph.get(kid.tag) ?? 0) + 1);
    }
  }

  return { xml: out, report };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule: unbalanced complex field
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A complex field is `fldChar begin` … `separate` … `end`. Captions, the TOC and
 * every cross-reference are built from them, so a delete that takes out half a
 * field leaves Word prompting to repair the document. Counting is enough to spot
 * it; stitching a field back together is not something to guess at.
 */
export function unbalancedFields(xml: string): number {
  let depth = 0;
  let broken = 0;
  for (const m of xml.matchAll(/<w:fldChar\b[^>]*w:fldCharType="(begin|end)"/g)) {
    if (m[1] === "begin") depth++;
    else if (depth > 0) depth--;
    else broken++; // an `end` with no matching `begin`
  }
  return broken + depth; // plus any `begin` still open at the end
}
