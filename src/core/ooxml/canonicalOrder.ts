/**
 * `CT_RPr` and `CT_Style` are `xsd:sequence` in the OOXML schema - child order
 * is a hard constraint, and Word rejects a file that violates it. Every writer
 * that touches a `<w:rPr>` or a `<w:style>` runs its output through here rather
 * than trusting the order it happened to build things in.
 *
 * The top-level scan is delegated to `OrderedBody.scanTopLevelChildren` (see
 * {@link splitTopLevelElements}) rather than reimplemented here: it already
 * gets comments, CDATA and processing instructions right, which a naive
 * open/close depth counter does not - tag-like text inside a `<!-- ... -->`
 * comment can desynchronise it, silently deleting real sibling elements or
 * (worse, since it looks like success) silently swallowing the rest of the
 * fragment into what looks like a single, unmovable element.
 */

import { scanTopLevelChildren } from "@/core/files/body/OrderedBody";

/** `CT_RPr` child sequence, ECMA-376 Part 1 17.3.2. */
export const CT_RPR_ORDER: readonly string[] = [
  "w:rStyle", "w:rFonts", "w:b", "w:bCs", "w:i", "w:iCs", "w:caps", "w:smallCaps",
  "w:strike", "w:dstrike", "w:outline", "w:shadow", "w:emboss", "w:imprint",
  "w:noProof", "w:snapToGrid", "w:vanish", "w:webHidden", "w:color", "w:spacing",
  "w:w", "w:kern", "w:position", "w:sz", "w:szCs", "w:highlight", "w:u", "w:effect",
  "w:bdr", "w:shd", "w:fitText", "w:vertAlign", "w:rtl", "w:cs", "w:em", "w:lang",
  "w:eastAsianLayout", "w:specVanish", "w:oMath",
];

/** `CT_Style` child sequence, ECMA-376 Part 1 17.7.4.17. */
export const CT_STYLE_ORDER: readonly string[] = [
  "w:name", "w:aliases", "w:basedOn", "w:next", "w:link", "w:autoRedefine",
  "w:hidden", "w:uiPriority", "w:semiHidden", "w:unhideWhenUsed", "w:qFormat",
  "w:locked", "w:personal", "w:personalCompose", "w:personalReply", "w:rsid",
  "w:pPr", "w:rPr", "w:tblPr", "w:trPr", "w:tcPr", "w:tblStylePr",
];

/**
 * Appended to the input before scanning, and stripped from the result after.
 * It contains no `<`, so it can never be mistaken for markup - after a scan
 * it either shows up on its own, past every real element (a clean parse:
 * nothing ever ran past where it should have stopped), or it turns up INSIDE
 * an element's captured text (that element's search for a matching close tag
 * ran off the end of the real input without ever finding one).
 *
 * The second case is otherwise unobservable from the split result alone: a
 * genuinely well-formed last element (e.g. a trailing self-closing
 * `<w:sz .../>`) also ends exactly at the end of the fragment, so "this
 * block's text ends at the input's edge" cannot by itself distinguish a real
 * close from the scanner's "never found one, so stop at the end" fallback.
 * Probing with a suffix that only a runaway fallback can reach makes the
 * difference directly observable instead of guessed at.
 *
 * Delimited with NUL (`\u0000`), which is illegal in XML 1.0 content even
 * escaped - real OOXML can never contain it, so the probe can never collide
 * with genuine input.
 */
const EOF_PROBE = "\u0000CANONICAL_ORDER_EOF_PROBE\u0000";

/**
 * Split a fragment into its TOP-LEVEL elements, each returned whole (nested
 * children included, comments/CDATA/processing-instructions handled
 * correctly rather than scanned as if they were tags).
 *
 * Whitespace-only gaps between elements are dropped - these fragments are
 * element-only content models, so whitespace carries no information. A
 * comment / CDATA section / processing instruction / stray non-whitespace
 * text is NOT dropped: it is kept as its own opaque top-level item so
 * {@link canonicalizeFragment} can carry it through a reorder (sorted after
 * every recognised element) instead of losing it.
 *
 * Throws - rather than silently returning `fragment` unchanged, and rather
 * than silently dropping the offending markup - when the fragment is not a
 * cleanly parseable sequence of top-level items: a closing tag with no
 * matching open, or an element whose matching close is never found before
 * the fragment ends. Reordering either case would mean guessing at a
 * structure the input doesn't actually have, and a caller cannot tell
 * "nothing needed reordering" from "this could not be parsed" unless the two
 * are reported differently.
 */
export function splitTopLevelElements(fragment: string): string[] {
  const blocks = scanTopLevelChildren(fragment + EOF_PROBE);
  const out: string[] = [];
  for (const block of blocks) {
    const probeAt = block.xml.indexOf(EOF_PROBE);
    if (probeAt !== -1) {
      const real = block.xml.slice(0, probeAt);
      if (block.tag === "#text") {
        if (real.trim() !== "") out.push(real); // trailing stray text, probe stripped
        continue; // just the probe's own placeholder block - nothing to keep
      }
      // The probe was dragged INTO an element/markup block: its capture ran
      // off the end of the real input because a matching close was never
      // found (see EOF_PROBE above).
      throw new Error(
        `canonicalOrder.splitTopLevelElements: unclosed element <${block.tag}> - no matching close before the end of the fragment`,
      );
    }
    if (block.tag === "#text") {
      if (block.xml.trim() === "") continue; // whitespace-only gap between elements
      out.push(block.xml); // stray non-whitespace text - kept, not dropped
      continue;
    }
    if (block.tag === "#raw") {
      // readTagName couldn't classify this as an opening element - typically
      // a closing tag with no matching open. The old ad hoc depth counter let
      // a stray close send its depth negative and silently dropped every real
      // sibling after it; this fails loudly instead.
      throw new Error(
        `canonicalOrder.splitTopLevelElements: malformed markup - unexpected ${JSON.stringify(block.xml)}`,
      );
    }
    out.push(block.xml);
  }
  return out;
}

/** The tag name of a whole element, e.g. `<w:sz w:val="24"/>` -> `w:sz`. */
export function elementName(element: string): string {
  return /^<\s*([A-Za-z_][\w.:-]*)/.exec(element)?.[1] ?? "";
}

/**
 * Sort a fragment's top-level elements into `order`. Elements not in `order`
 * - including any comment / CDATA / processing-instruction / stray text kept
 * by {@link splitTopLevelElements} - sort last, keeping their relative order:
 * an unrecognised item is never dropped, only moved to the end where it
 * cannot break the known sequence. The sort is stable, so the transform is
 * idempotent.
 *
 * Throws if `fragment` cannot be cleanly split into top-level items - see
 * {@link splitTopLevelElements} for exactly which inputs that covers and why
 * throwing (rather than returning `fragment` unchanged) is the chosen
 * behaviour for them.
 */
export function canonicalizeFragment(fragment: string, order: readonly string[]): string {
  const elements = splitTopLevelElements(fragment);
  // Nothing to reorder - return the input byte-for-byte, whitespace included.
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
