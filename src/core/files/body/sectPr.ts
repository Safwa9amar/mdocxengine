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

// ─── Paragraph <w:pPr><w:sectPr> edits ───────────────────────────────────────

/** Insert/replace the `<w:sectPr>` child of a paragraph's `<w:pPr>` (creating pPr). */
export function upsertParagraphSectPr(paraXml: string, sectPrXml: string): string {
  const pPrIdx = paraXml.indexOf("<w:pPr");
  if (pPrIdx === -1) {
    const pOpenEnd = paraXml.indexOf(">") + 1;
    return paraXml.slice(0, pOpenEnd) + `<w:pPr>${sectPrXml}</w:pPr>` + paraXml.slice(pOpenEnd);
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
