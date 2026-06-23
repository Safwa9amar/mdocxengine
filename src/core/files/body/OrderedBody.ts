/**
 * OrderedBody — order-faithful, string-level parse/serialize for the document
 * body.
 *
 * ## Why a string splitter (not an XML library)
 *
 * The previous implementation used `fast-xml-parser` in `preserveOrder` mode.
 * On a real-world template (El Bayadh STAPS) that parser MIS-NESTED two sibling
 * `<w:tbl>` elements *inside* paragraph 0's `<w:r>` run. `editParagraphText`
 * then rebuilt that paragraph's children and silently DISCARDED the runs — so
 * two of four tables vanished on an unrelated paragraph edit. Identity
 * round-trip looked fine; an actual edit lost data.
 *
 * This module instead treats `word/document.xml` as a string and splits the
 * `<w:body>` into its top-level children, keeping each child as its **exact
 * original XML substring**. Untouched blocks are never re-serialized, so:
 *   - identity round-trip is byte-perfect by construction, and
 *   - a paragraph edit can only ever rewrite that one paragraph's substring;
 *     it is physically impossible to corrupt a sibling table or image.
 *
 * The scanner is depth-aware and handles self-closing tags, attribute values
 * that contain `>`/`<` inside quotes, XML comments and processing
 * instructions. `pre + blocks.map(b => b.xml).join("") + post` always equals
 * the original `document.xml` byte-for-byte when nothing is edited.
 *
 * It is intentionally self-contained: it does NOT touch the existing
 * `Paragraph` / `Table` classes or `DocumentManager.saveChanges` (the
 * xml2js-based path used elsewhere).
 */

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type BlockKind = "paragraph" | "table" | "sectPr" | "other";

/**
 * A single ordered body child, stored as its exact original XML substring.
 * `xml` is the verbatim slice of `document.xml` for this top-level child —
 * including any whitespace/comment text captured as an "other" block.
 */
export interface BodyBlock {
  kind: BlockKind;
  tag: string;
  xml: string;
}

/** The result of splitting a full `word/document.xml`. */
export interface SplitDocument {
  /** Everything up to and including the `<w:body ...>` open tag. */
  pre: string;
  /** The `<w:body ...>` open tag itself (subset of `pre`, for convenience). */
  bodyOpen: string;
  /** Top-level children of `<w:body>`, in document order. */
  blocks: BodyBlock[];
  /** `</w:body>` and everything after it (trailing whitespace, `</w:document>`, …). */
  post: string;
}

// ─── Tag classification ──────────────────────────────────────────────────────

/** Classify a (possibly namespaced) tag name into a block kind. */
export function kindOf(tag: string): BlockKind {
  if (tag === "w:p") return "paragraph";
  if (tag === "w:tbl") return "table";
  if (tag === "w:sectPr") return "sectPr";
  return "other";
}

// ─── XML entity (de)coding ───────────────────────────────────────────────────

/** Escape the 5 predefined XML entities in element text. */
export function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Decode the 5 predefined XML entities (and numeric refs) in element text. */
export function decodeXmlText(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ─── String scanner ──────────────────────────────────────────────────────────

/**
 * Read an element/PI/comment tag name starting at `xml[i]` where `xml[i] === '<'`.
 * Returns the bare tag name (e.g. `w:p`), or "" for comments/PIs/closing tags.
 */
function readTagName(xml: string, ltIndex: number): string {
  let j = ltIndex + 1;
  // closing tag, comment, PI, CDATA, doctype → not an opening element
  if (xml[j] === "/" || xml[j] === "!" || xml[j] === "?") return "";
  let name = "";
  while (j < xml.length) {
    const ch = xml[j];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === ">" || ch === "/") {
      break;
    }
    name += ch;
    j++;
  }
  return name;
}

/**
 * Given `xml` and the index of a `<` that begins a tag, return the index just
 * PAST the closing `>` of that tag (handling quoted attribute values that may
 * contain `>` / `<`). For comments/PIs/CDATA, skips to the proper terminator.
 */
function endOfTag(xml: string, ltIndex: number): number {
  // XML comment
  if (xml.startsWith("<!--", ltIndex)) {
    const end = xml.indexOf("-->", ltIndex + 4);
    return end === -1 ? xml.length : end + 3;
  }
  // CDATA section
  if (xml.startsWith("<![CDATA[", ltIndex)) {
    const end = xml.indexOf("]]>", ltIndex + 9);
    return end === -1 ? xml.length : end + 3;
  }
  // Processing instruction or declaration that we treat generically: scan for
  // the matching `>`, respecting quoted strings.
  let i = ltIndex + 1;
  let quote: string | null = null;
  while (i < xml.length) {
    const ch = xml[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i + 1;
    }
    i++;
  }
  return xml.length;
}

/** True if the tag whose `<` is at `ltIndex` is self-closing (`<w:x .../>`). */
function isSelfClosing(xml: string, ltIndex: number, tagEnd: number): boolean {
  // tagEnd points just past `>`. The char before `>` is at tagEnd-2.
  return xml[tagEnd - 2] === "/";
}

/**
 * Split a full `word/document.xml` into the body region's top-level children,
 * each preserved as its exact original substring.
 *
 * Guarantee: `pre + blocks.map(b => b.xml).join("") + post === documentXml`.
 */
export function splitDocument(documentXml: string): SplitDocument {
  // Locate the <w:body ...> open tag (with optional attributes) or a
  // self-closing <w:body/>.
  const bodyOpenMatch = /<w:body(?:\s[^>]*?)?(\/?)>/.exec(documentXml);
  if (!bodyOpenMatch) {
    throw new Error("OrderedBody.splitDocument: no <w:body> found");
  }
  const bodyOpenStart = bodyOpenMatch.index;
  const bodyOpenEnd = bodyOpenStart + bodyOpenMatch[0].length;
  const selfClosingBody = bodyOpenMatch[1] === "/";

  if (selfClosingBody) {
    // <w:body/> → no children.
    return {
      pre: documentXml.slice(0, bodyOpenEnd),
      bodyOpen: bodyOpenMatch[0],
      blocks: [],
      post: documentXml.slice(bodyOpenEnd),
    };
  }

  // Find the matching </w:body>. <w:body> cannot nest, so the first one is it.
  const bodyCloseIdx = documentXml.indexOf("</w:body>", bodyOpenEnd);
  if (bodyCloseIdx === -1) {
    throw new Error("OrderedBody.splitDocument: no closing </w:body> found");
  }

  const pre = documentXml.slice(0, bodyOpenEnd);
  const post = documentXml.slice(bodyCloseIdx);
  const inner = documentXml.slice(bodyOpenEnd, bodyCloseIdx);

  const blocks = scanTopLevelChildren(inner);
  return { pre, bodyOpen: bodyOpenMatch[0], blocks, post };
}

/**
 * Scan a body's inner XML into top-level children, depth-aware.
 * Any inter-element text/whitespace/comments are captured as "other" blocks so
 * the join is byte-lossless.
 */
function scanTopLevelChildren(inner: string): BodyBlock[] {
  const blocks: BodyBlock[] = [];
  let i = 0;
  const n = inner.length;

  while (i < n) {
    const lt = inner.indexOf("<", i);
    if (lt === -1) {
      // Trailing text after the last element — keep it lossless.
      const text = inner.slice(i);
      if (text.length > 0) blocks.push({ kind: "other", tag: "#text", xml: text });
      break;
    }
    if (lt > i) {
      // Text/whitespace between top-level children → "other" block.
      blocks.push({ kind: "other", tag: "#text", xml: inner.slice(i, lt) });
      i = lt;
      continue;
    }

    // We're at a `<`.
    if (inner.startsWith("<!--", lt)) {
      const end = endOfTag(inner, lt);
      blocks.push({ kind: "other", tag: "#comment", xml: inner.slice(lt, end) });
      i = end;
      continue;
    }
    if (inner.startsWith("<?", lt)) {
      const end = endOfTag(inner, lt);
      blocks.push({ kind: "other", tag: "#pi", xml: inner.slice(lt, end) });
      i = end;
      continue;
    }
    if (inner.startsWith("<![CDATA[", lt)) {
      const end = endOfTag(inner, lt);
      blocks.push({ kind: "other", tag: "#cdata", xml: inner.slice(lt, end) });
      i = end;
      continue;
    }

    const tag = readTagName(inner, lt);
    if (!tag) {
      // Unexpected stray closing tag or malformed — capture generically.
      const end = endOfTag(inner, lt);
      blocks.push({ kind: "other", tag: "#raw", xml: inner.slice(lt, end) });
      i = end;
      continue;
    }

    const openTagEnd = endOfTag(inner, lt);
    if (isSelfClosing(inner, lt, openTagEnd)) {
      blocks.push({ kind: kindOf(tag), tag, xml: inner.slice(lt, openTagEnd) });
      i = openTagEnd;
      continue;
    }

    // Normal open tag — scan forward, depth-aware, to its matching close.
    const elementEnd = findMatchingClose(inner, openTagEnd, tag);
    blocks.push({ kind: kindOf(tag), tag, xml: inner.slice(lt, elementEnd) });
    i = elementEnd;
  }

  return blocks;
}

/**
 * Starting just past the open tag of `<tag>` (at `from`), find the index just
 * past the matching `</tag>`, tracking depth across same-named nested elements
 * and skipping comments / PIs / CDATA / self-closing tags / quoted attrs.
 */
function findMatchingClose(inner: string, from: string | number, tag: string): number {
  // `from` is the numeric index just past the open tag's `>`.
  let i = from as number;
  let depth = 1;
  const openMarker = `<${tag}`;
  const closeMarker = `</${tag}>`;
  const n = inner.length;

  while (i < n) {
    const lt = inner.indexOf("<", i);
    if (lt === -1) break;

    if (inner.startsWith("<!--", lt) || inner.startsWith("<?", lt) || inner.startsWith("<![CDATA[", lt)) {
      i = endOfTag(inner, lt);
      continue;
    }

    if (inner.startsWith(closeMarker, lt)) {
      depth--;
      const end = lt + closeMarker.length;
      if (depth === 0) return end;
      i = end;
      continue;
    }

    // Is this an opening of the SAME tag (and not just a prefix like
    // `<w:tblPr` when tag is `<w:tbl`)? Require the char after the name to be a
    // delimiter.
    if (inner.startsWith(openMarker, lt)) {
      const after = inner[lt + openMarker.length];
      const isSameTag =
        after === " " || after === "\t" || after === "\n" || after === "\r" || after === ">" || after === "/";
      const tagEnd = endOfTag(inner, lt);
      if (isSameTag && !isSelfClosing(inner, lt, tagEnd)) {
        depth++;
      }
      i = tagEnd;
      continue;
    }

    // Any other tag — skip past it (we only track depth on the SAME tag name,
    // which is sufficient because XML is well-formed and elements are properly
    // nested; a `</tag>` can only close a same-named ancestor).
    i = endOfTag(inner, lt);
  }

  // Malformed — return end so we don't loop forever.
  return n;
}

/** Reassemble a split document into a full `document.xml` string. */
export function assembleDocument(split: {
  pre: string;
  blocks: BodyBlock[];
  post: string;
}): string {
  return split.pre + split.blocks.map((b) => b.xml).join("") + split.post;
}

// ─── Paragraph construction ──────────────────────────────────────────────────

/**
 * Build a `<w:p>` paragraph XML string from plain text + optional style/RTL:
 * `<w:p>(<w:pPr>(<w:pStyle w:val="ID"/>)(<w:bidi/>)</w:pPr>)?<w:r><w:t xml:space="preserve">ESCAPED</w:t></w:r></w:p>`
 */
export function makeParagraphXml(text: string, styleId?: string, rtl?: boolean): string {
  let pPr = "";
  if (styleId || rtl) {
    const style = styleId ? `<w:pStyle w:val="${escapeXmlText(styleId)}"/>` : "";
    const bidi = rtl ? "<w:bidi/>" : "";
    pPr = `<w:pPr>${style}${bidi}</w:pPr>`;
  }
  return `<w:p>${pPr}<w:r><w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r></w:p>`;
}

/**
 * Build a paragraph `BodyBlock` (kept under the legacy export name
 * `makeParagraphNode` for API stability). Now string-based.
 */
export function makeParagraphNode(text: string, styleId?: string, rtl?: boolean): BodyBlock {
  return { kind: "paragraph", tag: "w:p", xml: makeParagraphXml(text, styleId, rtl) };
}

// ─── Paragraph inspection ────────────────────────────────────────────────────

/** Concatenate the decoded text of every `<w:t ...>...</w:t>` in a block. */
export function paragraphText(xml: string): string {
  // Match `<w:t>`/`<w:t ...>...</w:t>` (NOT `<w:tab>`/`<w:tbl>`), and `<w:t/>`.
  let out = "";
  const re = /<w:t(\/)?(?:\s[^>]*?)?(\/)?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const selfClosed = m[1] === "/" || m[2] === "/";
    if (selfClosed) continue; // <w:t/> → empty
    const contentStart = re.lastIndex;
    const closeIdx = xml.indexOf("</w:t>", contentStart);
    if (closeIdx === -1) break;
    out += decodeXmlText(xml.slice(contentStart, closeIdx));
    re.lastIndex = closeIdx + "</w:t>".length;
  }
  return out;
}

/** Extract the `w:val` of the paragraph's `<w:pStyle>`, or null. */
export function paragraphStyleId(xml: string): string | null {
  const m = /<w:pStyle\b[^>]*\bw:val="([^"]*)"/.exec(xml);
  return m ? decodeXmlText(m[1]) : null;
}

// ─── Paragraph text replacement (run-preserving where it matters) ────────────

const EMBED_RE = /<w:(?:drawing|pict|object)\b/;

/**
 * Replace the text of a paragraph's XML string IN PLACE (operates only on the
 * given paragraph substring — cannot affect any sibling block):
 *
 *  - If the paragraph contains a `<w:drawing>` / `<w:pict>` / `<w:object>`
 *    (an inline image or embedded object), DO NOT strip runs. Instead replace
 *    only the text inside the FIRST `<w:t>` (or append a text run after
 *    `<w:pPr>` if there is no `<w:t>`), leaving the drawing runs intact.
 *  - Otherwise (a plain text paragraph): preserve `<w:pPr>...</w:pPr>` if
 *    present and replace ALL `<w:r>...</w:r>` runs with a single
 *    `<w:r><w:t xml:space="preserve">ESCAPED</w:t></w:r>`.
 */
export function setParagraphText(paragraphXml: string, text: string): string {
  const escaped = escapeXmlText(text);

  if (EMBED_RE.test(paragraphXml)) {
    // Image/object paragraph — never strip runs. Edit the first <w:t> only.
    const tMatch = /<w:t(?:\s[^>]*?)?>([\s\S]*?)<\/w:t>|<w:t(?:\s[^>]*?)?\/>/.exec(paragraphXml);
    if (tMatch) {
      // Replace the first <w:t> (whether empty self-closing or with content).
      const full = tMatch[0];
      const replacement = `<w:t xml:space="preserve">${escaped}</w:t>`;
      return paragraphXml.slice(0, tMatch.index) + replacement + paragraphXml.slice(tMatch.index + full.length);
    }
    // No <w:t> at all — append a text run after </w:pPr> (or after <w:p...>).
    const run = `<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>`;
    const pPrEnd = paragraphXml.indexOf("</w:pPr>");
    if (pPrEnd !== -1) {
      const at = pPrEnd + "</w:pPr>".length;
      return paragraphXml.slice(0, at) + run + paragraphXml.slice(at);
    }
    // Insert right after the <w:p ...> open tag.
    const openEnd = paragraphXml.indexOf(">") + 1;
    return paragraphXml.slice(0, openEnd) + run + paragraphXml.slice(openEnd);
  }

  // Plain text paragraph: keep <w:pPr> (style/bidi/alignment), replace runs.
  const newRun = `<w:r><w:t xml:space="preserve">${escaped}</w:t></w:r>`;

  // Find the paragraph's inner content (between <w:p ...> and </w:p>).
  const openEnd = paragraphXml.indexOf(">") + 1;
  const closeStart = paragraphXml.lastIndexOf("</w:p>");
  const head = paragraphXml.slice(0, openEnd); // `<w:p ...>`
  const tail = closeStart === -1 ? "" : paragraphXml.slice(closeStart); // `</w:p>`
  const innerEnd = closeStart === -1 ? paragraphXml.length : closeStart;
  const inner = paragraphXml.slice(openEnd, innerEnd);

  // Preserve a leading <w:pPr>...</w:pPr> if present.
  const pPrMatch = /^(\s*)<w:pPr\b/.exec(inner);
  let pPr = "";
  if (pPrMatch) {
    const pPrStart = inner.indexOf("<w:pPr", 0);
    // <w:pPr/> self-closing?
    const pPrOpenEnd = endOfTag(inner, pPrStart);
    if (isSelfClosing(inner, pPrStart, pPrOpenEnd)) {
      pPr = inner.slice(pPrStart, pPrOpenEnd);
    } else {
      const pPrClose = inner.indexOf("</w:pPr>", pPrOpenEnd);
      pPr = pPrClose === -1 ? "" : inner.slice(pPrStart, pPrClose + "</w:pPr>".length);
    }
  }

  return `${head}${pPr}${newRun}${tail}`;
}

// ─── Legacy-compatible helpers (kept for the existing public exports) ────────
//
// The package's `src/index.ts` re-exports `parseOrderedDoc`, `buildOrderedDoc`,
// `toBlocks`, and `nodeTag`. They are reimplemented here on top of the string
// model so external imports and the verify-roundtrip harness keep working.

/** Split a full document into its top-level body blocks. */
export function parseOrderedDoc(documentXml: string): {
  split: SplitDocument;
  blocks: BodyBlock[];
  bodyChildren: BodyBlock[];
} {
  const split = splitDocument(documentXml);
  return { split, blocks: split.blocks, bodyChildren: split.blocks };
}

/** Reassemble from a SplitDocument (or its parts). */
export function buildOrderedDoc(split: SplitDocument): string {
  return assembleDocument(split);
}

/**
 * Pass-through classifier kept for compatibility. Filters out pure-whitespace
 * "other" blocks would change semantics, so this returns every block as-is.
 */
export function toBlocks(bodyChildren: BodyBlock[]): BodyBlock[] {
  return bodyChildren;
}

/** The tag name of a block (compat shim — accepts a BodyBlock). */
export function nodeTag(block: BodyBlock | string): string {
  if (typeof block === "string") {
    // Treat as raw XML and read the first tag name.
    const lt = block.indexOf("<");
    return lt === -1 ? "" : readTagName(block, lt);
  }
  return block?.tag ?? "";
}

export { W_NS };
