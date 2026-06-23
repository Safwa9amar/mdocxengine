/**
 * OrderedBody — order-faithful parse/serialize for the document body.
 *
 * The existing xml2js path (see {@link file://../../../utils/xmlUtils.ts}) loses
 * the document order between paragraphs and tables because it groups them into
 * separate `w:p` / `w:tbl` arrays. This module uses `fast-xml-parser` in
 * `preserveOrder: true` mode, which represents the body as an *ordered array of
 * single-key nodes* — so `w:p`, `w:tbl` and drawing-bearing paragraphs keep
 * their exact document order on a read → write round-trip.
 *
 * It is intentionally self-contained: it does NOT touch the existing
 * `Paragraph` / `Table` classes or `DocumentManager.saveChanges`.
 *
 * fast-xml-parser is vendored under `<repo>/vendor/fast-xml-parser` because the
 * repo's `node_modules` is not writable in this environment; the import below
 * resolves to that vendored v4 copy. It is also declared in `package.json`
 * dependencies so consumers resolve the same version normally.
 */
// The vendored fast-xml-parser is CommonJS (module.exports = { XMLParser, ... }).
// Import it as a default/namespace binding and destructure at runtime so it
// resolves cleanly under both Rollup (vite SSR build) and vitest.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - resolved to the vendored fast-xml-parser v4 copy
import * as fxp from "../../../../vendor/fast-xml-parser/src/fxp.js";

const { XMLParser, XMLBuilder } = (fxp as any).default ?? (fxp as any);

/** Options shared by parse + build so the body round-trips faithfully. */
const PARSE_OPTIONS = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Keep text exactly as authored — do NOT trim/parse w:t content. OOXML relies
  // on significant whitespace (xml:space="preserve") in run text.
  trimValues: false,
  parseTagValue: false,
  processEntities: true,
} as const;

const BUILD_OPTIONS = {
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // Emit empty elements as <a></a> rather than self-closing — semantically
  // identical OOXML, and avoids any reformatting of mixed content.
  suppressEmptyNode: false,
  // format:false keeps the build idempotent: no indentation whitespace is
  // injected into mixed content, so w:t text is never corrupted.
  format: false,
  processEntities: true,
} as const;

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export type BlockKind = "paragraph" | "table" | "sectPr" | "other";

/**
 * A single ordered body child.
 * `node` is the raw fast-xml-parser ordered node: an object whose only
 * non-`:@` key is the element tag (e.g. `{ "w:p": [...], ":@"?: {...} }`).
 */
export interface BodyBlock {
  kind: BlockKind;
  tag: string;
  node: any;
}

// ─── Low-level ordered-node helpers ─────────────────────────────────────────

/** The tag name of an ordered node (the only key that isn't `:@`). */
export function nodeTag(node: any): string {
  if (!node || typeof node !== "object") return "";
  const keys = Object.keys(node).filter((k) => k !== ":@");
  return keys[0] ?? "";
}

/** The ordered children array of an ordered node. */
function nodeChildren(node: any): any[] {
  const tag = nodeTag(node);
  if (!tag) return [];
  const v = node[tag];
  return Array.isArray(v) ? v : [];
}

function kindForTag(tag: string): BlockKind {
  if (tag === "w:p") return "paragraph";
  if (tag === "w:tbl") return "table";
  if (tag === "w:sectPr") return "sectPr";
  return "other";
}

// ─── Document-level parse / build ────────────────────────────────────────────

/**
 * Parse a full `word/document.xml` into the ordered top-level node array and a
 * reference to the body's ordered children array.
 *
 * `doc` is the value you mutate (in place, via `bodyChildren`) and then pass to
 * {@link buildOrderedDoc}. `bodyChildren` is a *live reference* into `doc`, so
 * splicing it mutates the document.
 */
export function parseOrderedDoc(xml: string): { doc: any[]; bodyChildren: any[] } {
  const parser = new XMLParser(PARSE_OPTIONS as any);
  const doc = parser.parse(xml) as any[];

  const documentNode = doc.find((n) => nodeTag(n) === "w:document");
  if (!documentNode) {
    throw new Error("OrderedBody.parseOrderedDoc: no <w:document> root found");
  }
  const bodyNode = nodeChildren(documentNode).find((n) => nodeTag(n) === "w:body");
  if (!bodyNode) {
    throw new Error("OrderedBody.parseOrderedDoc: no <w:body> found");
  }
  const bodyChildren = bodyNode["w:body"] as any[];
  return { doc, bodyChildren };
}

/** Serialize the (possibly mutated) ordered document array back to XML. */
export function buildOrderedDoc(doc: any[]): string {
  const builder = new XMLBuilder(BUILD_OPTIONS as any);
  return builder.build(doc) as string;
}

// ─── Block mapping ───────────────────────────────────────────────────────────

/** Map the body's ordered children to typed blocks (includes sectPr). */
export function toBlocks(bodyChildren: any[]): BodyBlock[] {
  return bodyChildren.map((node) => {
    const tag = nodeTag(node);
    return { kind: kindForTag(tag), tag, node };
  });
}

// ─── Paragraph helpers ───────────────────────────────────────────────────────

/**
 * Build an ordered `w:p` node from plain text + optional style/RTL, in the
 * fast-xml-parser ordered shape:
 * `<w:p><w:pPr>(pStyle)(bidi)</w:pPr><w:r><w:t xml:space="preserve">text</w:t></w:r></w:p>`
 */
export function makeParagraphNode(text: string, styleId?: string, rtl?: boolean): any {
  const pChildren: any[] = [];

  // w:pPr (only emitted when there is something to put in it)
  const pPrChildren: any[] = [];
  if (styleId) {
    pPrChildren.push({ "w:pStyle": [], ":@": { "@_w:val": styleId } });
  }
  if (rtl) {
    pPrChildren.push({ "w:bidi": [] });
  }
  if (pPrChildren.length > 0) {
    pChildren.push({ "w:pPr": pPrChildren });
  }

  // w:r > w:t (xml:space="preserve" so leading/trailing spaces survive)
  pChildren.push({
    "w:r": [
      {
        "w:t": [{ "#text": text }],
        ":@": { "@_xml:space": "preserve" },
      },
    ],
  });

  return { "w:p": pChildren };
}

/** Recursively gather the text of every `w:t` descendant of an ordered node. */
function gatherText(node: any): string {
  let out = "";
  const tag = nodeTag(node);
  const children = nodeChildren(node);
  if (tag === "w:t") {
    for (const child of children) {
      if (child && typeof child === "object" && "#text" in child) {
        out += String(child["#text"] ?? "");
      }
    }
    return out;
  }
  for (const child of children) {
    if (child && typeof child === "object") {
      out += gatherText(child);
    }
  }
  return out;
}

/** Concatenated `w:t` text of a paragraph node. */
export function paragraphText(node: any): string {
  if (nodeTag(node) !== "w:p") return "";
  return gatherText(node);
}

/** The `w:val` of the paragraph's `w:pStyle`, or null. */
export function paragraphStyleId(node: any): string | null {
  if (nodeTag(node) !== "w:p") return null;
  const pPr = nodeChildren(node).find((c) => nodeTag(c) === "w:pPr");
  if (!pPr) return null;
  const pStyle = nodeChildren(pPr).find((c) => nodeTag(c) === "w:pStyle");
  if (!pStyle) return null;
  return pStyle[":@"]?.["@_w:val"] ?? null;
}

/**
 * Replace the text of a paragraph node in place: collapse its runs to a single
 * `w:r > w:t` carrying `text`, preserving the paragraph's `w:pPr` (style, RTL,
 * etc.) if present. Returns the same node for convenience.
 */
export function setParagraphText(node: any, text: string): any {
  if (nodeTag(node) !== "w:p") {
    throw new Error("setParagraphText: node is not a w:p paragraph");
  }
  const children = node["w:p"] as any[];
  const pPr = children.find((c) => nodeTag(c) === "w:pPr");
  const newChildren: any[] = [];
  if (pPr) newChildren.push(pPr);
  newChildren.push({
    "w:r": [
      {
        "w:t": [{ "#text": text }],
        ":@": { "@_xml:space": "preserve" },
      },
    ],
  });
  node["w:p"] = newChildren;
  return node;
}

export { W_NS };
