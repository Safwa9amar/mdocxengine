/**
 * `CT_RPr` and `CT_Style` are `xsd:sequence` in the OOXML schema — child order
 * is a hard constraint, and Word rejects a file that violates it. Every writer
 * that touches a `<w:rPr>` or a `<w:style>` runs its output through here rather
 * than trusting the order it happened to build things in.
 */

/** `CT_RPr` child sequence, ECMA-376 Part 1 §17.3.2. */
export const CT_RPR_ORDER: readonly string[] = [
  "w:rStyle", "w:rFonts", "w:b", "w:bCs", "w:i", "w:iCs", "w:caps", "w:smallCaps",
  "w:strike", "w:dstrike", "w:outline", "w:shadow", "w:emboss", "w:imprint",
  "w:noProof", "w:snapToGrid", "w:vanish", "w:webHidden", "w:color", "w:spacing",
  "w:w", "w:kern", "w:position", "w:sz", "w:szCs", "w:highlight", "w:u", "w:effect",
  "w:bdr", "w:shd", "w:fitText", "w:vertAlign", "w:rtl", "w:cs", "w:em", "w:lang",
  "w:eastAsianLayout", "w:specVanish", "w:oMath",
];

/** `CT_Style` child sequence, ECMA-376 Part 1 §17.7.4.17. */
export const CT_STYLE_ORDER: readonly string[] = [
  "w:name", "w:aliases", "w:basedOn", "w:next", "w:link", "w:autoRedefine",
  "w:hidden", "w:uiPriority", "w:semiHidden", "w:unhideWhenUsed", "w:qFormat",
  "w:locked", "w:personal", "w:personalCompose", "w:personalReply", "w:rsid",
  "w:pPr", "w:rPr", "w:tblPr", "w:trPr", "w:tcPr", "w:tblStylePr",
];

/** Matches one start / end / self-closing tag, skipping `>` inside attribute values. */
const TAG_RE = /<(\/?)([A-Za-z_][\w.:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;

/**
 * Split a fragment into its TOP-LEVEL elements, each returned whole (nested
 * children included). Whitespace and text between elements is dropped — these
 * fragments are element-only content models, so there is nothing to preserve.
 */
export function splitTopLevelElements(fragment: string): string[] {
  const out: string[] = [];
  const re = new RegExp(TAG_RE.source, "g");
  let depth = 0;
  let start = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    const isClose = m[1] === "/";
    const isSelfClosing = m[4] === "/";
    if (depth === 0 && !isClose) start = m.index;
    if (!isClose && !isSelfClosing) depth++;
    else if (isClose) depth--;
    if (depth === 0 && start !== -1) {
      out.push(fragment.slice(start, m.index + m[0].length));
      start = -1;
    }
  }
  return out;
}

/** The tag name of a whole element, e.g. `<w:sz w:val="24"/>` → `w:sz`. */
export function elementName(element: string): string {
  return /^<\s*([A-Za-z_][\w.:-]*)/.exec(element)?.[1] ?? "";
}

/**
 * Sort a fragment's top-level elements into `order`. Elements not in `order`
 * sort last, keeping their relative order — an unrecognised extension is never
 * dropped, only moved to the end where it cannot break the known sequence.
 * The sort is stable, so the transform is idempotent.
 */
export function canonicalizeFragment(fragment: string, order: readonly string[]): string {
  const elements = splitTopLevelElements(fragment);
  // Nothing to reorder — return the input byte-for-byte, whitespace included.
  if (elements.length <= 1) return fragment;
  return elements
    .map((element, i) => {
      const rank = order.indexOf(elementName(element));
      return { element, i, rank: rank === -1 ? order.length : rank };
    })
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((entry) => entry.element)
    .join("");
}

/** Sort the INNER XML of a `<w:rPr>` into `CT_RPr` order. */
export const canonicalizeRunProps = (rPrInner: string): string =>
  canonicalizeFragment(rPrInner, CT_RPR_ORDER);

/** Sort the INNER XML of a `<w:style>` into `CT_Style` order. */
export const canonicalizeStyleChildren = (styleInner: string): string =>
  canonicalizeFragment(styleInner, CT_STYLE_ORDER);
