/**
 * Byte-safe section-properties (`<w:sectPr>`) edits — string surgery, NOT an
 * xml2js full-document rebuild.
 *
 * The xml2js parse→`buildXml(whole body)` path used by several managers does not
 * preserve the interleaving of `<w:p>` and `<w:tbl>` (it groups children by tag
 * name) and re-indents the XML — so editing a header/footer reference or a
 * section break would silently REORDER every table in a document to the end.
 * These helpers instead touch only the targeted `<w:sectPr>` / paragraph
 * substring, leaving every other byte identical (the same guarantee the
 * OrderedBody block path gives).
 */
import { splitDocument, assembleDocument } from "./OrderedBody";
import { insertAfterParagraphOpen } from "@/core/ooxml/paragraphProps";

export type SectPrRefKind = "header" | "footer";

const REF_TAG: Record<SectPrRefKind, string> = {
  header: "w:headerReference",
  footer: "w:footerReference",
};

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Single-<w:sectPr> string edits ──────────────────────────────────────────

/**
 * Insert (or replace, matched by `w:type`) a header/footer reference at the
 * START of a single `<w:sectPr>…</w:sectPr>` string — references must precede
 * the rest of CT_SectPr. Handles a self-closing `<w:sectPr/>` by expanding it.
 */
export function upsertSectPrReference(sectPrXml: string, kind: SectPrRefKind, type: string, relId: string): string {
  const tag = REF_TAG[kind];
  const ref = `<${tag} w:type="${escAttr(type)}" r:id="${escAttr(relId)}"/>`;
  const m = /<w:sectPr\b[^>]*?(\/?)>/.exec(sectPrXml);
  if (!m) return sectPrXml;

  if (m[1] === "/") {
    // <w:sectPr/> → <w:sectPr>REF</w:sectPr>
    const openTag = m[0].slice(0, m[0].length - 2) + ">";
    return sectPrXml.slice(0, m.index) + openTag + ref + "</w:sectPr>" + sectPrXml.slice(m.index + m[0].length);
  }

  const openEnd = m.index + m[0].length;
  const close = sectPrXml.indexOf("</w:sectPr>", openEnd);
  if (close === -1) return sectPrXml;

  // Drop any existing reference of the same type (incl. the implicit default).
  let inner = sectPrXml.slice(openEnd, close);
  inner = inner.replace(new RegExp(`<${escRe(tag)}\\b[^>]*\\bw:type="${escRe(type)}"[^>]*/>`, "g"), "");
  if (type === "default") {
    inner = inner.replace(new RegExp(`<${escRe(tag)}\\b(?![^>]*\\bw:type=)[^>]*/>`, "g"), "");
  }
  return sectPrXml.slice(0, openEnd) + ref + inner + sectPrXml.slice(close);
}

/**
 * Insert (or replace) this section's `<w:pgNumType>` — the page-number FORMAT
 * (`w:fmt`: decimal, lowerRoman, …) and RESTART value (`w:start`).
 *
 * Unlike `FooterManager.formatPageNumbers`, which only ever writes the body
 * sectPr, this targets ONE `<w:sectPr>` string, so front matter can number in
 * roman while the body restarts at 1 in arabic. Omitting `start` leaves the
 * section continuing from the previous one (Word's "Continue from previous").
 */
export function upsertSectPrPageNumbering(
  sectPrXml: string,
  opts: { format?: string; start?: number },
): string {
  const attrs = [
    ...(opts.format ? [`w:fmt="${escAttr(opts.format)}"`] : []),
    ...(opts.start !== undefined ? [`w:start="${escAttr(String(opts.start))}"`] : []),
  ];
  if (attrs.length === 0) return sectPrXml;
  const tag = `<w:pgNumType ${attrs.join(" ")}/>`;

  const m = /<w:sectPr\b[^>]*?(\/?)>/.exec(sectPrXml);
  if (!m) return sectPrXml;

  if (m[1] === "/") {
    const openTag = m[0].slice(0, m[0].length - 2) + ">";
    return sectPrXml.slice(0, m.index) + openTag + tag + "</w:sectPr>" + sectPrXml.slice(m.index + m[0].length);
  }

  const openEnd = m.index + m[0].length;
  const close = sectPrXml.indexOf("</w:sectPr>", openEnd);
  if (close === -1) return sectPrXml;

  // Drop the existing one first so a re-apply replaces rather than duplicates.
  const inner = sectPrXml
    .slice(openEnd, close)
    .replace(/<w:pgNumType\b[^>]*\/>|<w:pgNumType\b[\s\S]*?<\/w:pgNumType>/g, "");

  return sectPrXml.slice(0, openEnd) + insertBySchemaOrder(inner, "w:pgNumType", tag) + sectPrXml.slice(close);
}

/**
 * The child sequence of CT_SectPr, in ECMA-376 order. `w:sectPr` is a SEQUENCE,
 * not a bag: children out of order make the document invalid even though Word
 * tolerates it. Insertions scan this list for the first following sibling
 * present and insert before it.
 */
export const SECTPR_ORDER: readonly string[] = [
  "w:headerReference", "w:footerReference", "w:footnotePr", "w:endnotePr",
  "w:type", "w:pgSz", "w:pgMar", "w:paperSrc", "w:pgBorders", "w:lnNumType",
  "w:pgNumType", "w:cols", "w:formProt", "w:vAlign", "w:noEndnote", "w:titlePg",
  "w:textDirection", "w:bidi", "w:rtlGutter", "w:docGrid", "w:printerSettings",
  "w:sectPrChange",
];

/** Insert `tagXml` into a sectPr's inner XML at `tag`'s schema position: before
 *  the first later-in-sequence sibling present, else at the end. */
function insertBySchemaOrder(inner: string, tag: string, tagXml: string): string {
  let at = inner.length;
  for (const t of SECTPR_ORDER.slice(SECTPR_ORDER.indexOf(tag) + 1)) {
    const i = inner.search(new RegExp(`<${escRe(t)}\\b`));
    if (i !== -1 && i < at) at = i;
  }
  return inner.slice(0, at) + tagXml + inner.slice(at);
}

/** Insert (or replace) this section's `<w:vAlign>` — vertical alignment of the
 *  page content. "center" is what puts a divider page's title in the middle of
 *  the page rather than at the top. */
export function upsertSectPrVAlign(
  sectPrXml: string,
  val: "top" | "center" | "both" | "bottom",
): string {
  const tag = `<w:vAlign w:val="${escAttr(val)}"/>`;
  const m = /<w:sectPr\b[^>]*?(\/?)>/.exec(sectPrXml);
  if (!m) return sectPrXml;
  if (m[1] === "/") {
    const openTag = m[0].slice(0, m[0].length - 2) + ">";
    return sectPrXml.slice(0, m.index) + openTag + tag + "</w:sectPr>" + sectPrXml.slice(m.index + m[0].length);
  }
  const openEnd = m.index + m[0].length;
  const close = sectPrXml.indexOf("</w:sectPr>", openEnd);
  if (close === -1) return sectPrXml;
  const inner = sectPrXml
    .slice(openEnd, close)
    .replace(/<w:vAlign\b[^>]*\/>|<w:vAlign\b[\s\S]*?<\/w:vAlign>/g, "");
  return sectPrXml.slice(0, openEnd) + insertBySchemaOrder(inner, "w:vAlign", tag) + sectPrXml.slice(close);
}

export interface SectPrPageBorderOptions {
  style: "single" | "double" | "thick" | "dashed" | "dotted";
  /** 6-hex, with or without a leading '#'. */
  color: string;
  /** Border width in POINTS; Word stores eighths of a point (w:sz). */
  widthPt: number;
  /**
   * Distance from the page edge in points (w:space). Default 24. Word's own
   * dialog only accepts 24–31 when measuring from the page edge; other values
   * open fine but Word clamps them.
   */
  offsetPt?: number;
}

/** Insert (or replace) this section's `<w:pgBorders>` — a border around the
 *  whole page on all four edges, measured from the page edge. This is the
 *  `frame` divider family: a page border cannot be drawn with an image. */
export function upsertSectPrPageBorders(sectPrXml: string, opts: SectPrPageBorderOptions): string {
  const color = opts.color.replace(/^#/, "").toUpperCase();
  const sz = Math.min(96, Math.max(2, Math.round(opts.widthPt * 8)));
  const space = Math.round(opts.offsetPt ?? 24);
  const edge = (name: string) =>
    `<w:${name} w:val="${escAttr(opts.style)}" w:sz="${sz}" w:space="${space}" w:color="${escAttr(color)}"/>`;
  const tag =
    `<w:pgBorders w:offsetFrom="page">` +
    edge("top") + edge("left") + edge("bottom") + edge("right") +
    `</w:pgBorders>`;

  const m = /<w:sectPr\b[^>]*?(\/?)>/.exec(sectPrXml);
  if (!m) return sectPrXml;
  if (m[1] === "/") {
    const openTag = m[0].slice(0, m[0].length - 2) + ">";
    return sectPrXml.slice(0, m.index) + openTag + tag + "</w:sectPr>" + sectPrXml.slice(m.index + m[0].length);
  }
  const openEnd = m.index + m[0].length;
  const close = sectPrXml.indexOf("</w:sectPr>", openEnd);
  if (close === -1) return sectPrXml;
  const inner = sectPrXml
    .slice(openEnd, close)
    .replace(/<w:pgBorders\b[^>]*\/>|<w:pgBorders\b[\s\S]*?<\/w:pgBorders>/g, "");
  return sectPrXml.slice(0, openEnd) + insertBySchemaOrder(inner, "w:pgBorders", tag) + sectPrXml.slice(close);
}

// ─── Paragraph <w:pPr><w:sectPr> edits ───────────────────────────────────────

/** Insert/replace the `<w:sectPr>` child of a paragraph's `<w:pPr>` (creating pPr).
 *
 *  A section break is very often applied to an EMPTY paragraph — the blank line
 *  that ends a front-matter page — and Word writes an empty paragraph
 *  self-closing (`<w:p w:rsidR="00A1"/>`). Splicing the new `<w:pPr>` in by hand
 *  after the first `>` put it after a tag that had already closed, so the
 *  section break landed as a bare `<w:pPr>` DIRECT CHILD of `<w:body>`: Word
 *  refuses the document and the app draws an unknown-block chip where the page
 *  break should be. `insertAfterParagraphOpen` normalises `<w:p/>` first. */
export function upsertParagraphSectPr(paraXml: string, sectPrXml: string): string {
  const pPrIdx = paraXml.indexOf("<w:pPr");
  if (pPrIdx === -1) {
    return insertAfterParagraphOpen(paraXml, `<w:pPr>${sectPrXml}</w:pPr>`);
  }
  const pPrOpenEnd = paraXml.indexOf(">", pPrIdx) + 1;
  if (paraXml[pPrOpenEnd - 2] === "/") {
    // self-closing <w:pPr/>
    return paraXml.slice(0, pPrIdx) + `<w:pPr>${sectPrXml}</w:pPr>` + paraXml.slice(pPrOpenEnd);
  }
  const close = paraXml.indexOf("</w:pPr>", pPrOpenEnd);
  if (close === -1) return paraXml;
  const inner = paraXml.slice(pPrOpenEnd, close).replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>/g, "");
  return paraXml.slice(0, pPrOpenEnd) + inner + sectPrXml + paraXml.slice(close);
}

/** Remove the `<w:sectPr>` from a paragraph (the only place a paragraph carries one). */
export function removeParagraphSectPr(paraXml: string): string {
  return paraXml.replace(/<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>/g, "");
}

/** Transform the single `<w:sectPr>` found inside a paragraph's xml, in place. */
export function editSectPrWithinParagraph(paraXml: string, transform: (sectPrXml: string) => string): string {
  const m = /<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>/.exec(paraXml);
  if (!m) return paraXml;
  return paraXml.slice(0, m.index) + transform(m[0]) + paraXml.slice(m.index + m[0].length);
}

// ─── Document-level (body sectPr) edits ──────────────────────────────────────

/**
 * Apply `transform` to the body's final `<w:sectPr>` (the document-wide section),
 * creating one before `</w:body>` if absent. Order-preserving: every other block
 * stays byte-identical.
 */
export function editBodySectPr(documentXml: string, transform: (sectPrXml: string) => string): string {
  const split = splitDocument(documentXml);
  const sectBlock = split.blocks.find((b) => b.kind === "sectPr");
  if (sectBlock) {
    sectBlock.xml = transform(sectBlock.xml);
  } else {
    split.blocks.push({ kind: "sectPr", tag: "w:sectPr", xml: transform("<w:sectPr/>") });
  }
  return assembleDocument(split);
}

/**
 * Remove every header/footer reference with a given `r:id` from the whole
 * document (body + any section). The reference is a self-closing tag, so a
 * targeted regex delete moves nothing else.
 */
export function removeSectPrReferenceFromDocument(documentXml: string, kind: SectPrRefKind, relId: string): string {
  const tag = REF_TAG[kind];
  return documentXml.replace(new RegExp(`<${escRe(tag)}\\b[^>]*\\br:id="${escRe(relId)}"[^>]*/>`, "g"), "");
}
