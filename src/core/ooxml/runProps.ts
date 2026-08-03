import { canonicalizeRunProps } from "./canonicalOrder";

/**
 * The run-level properties `set_text_style` can apply. Every field is optional;
 * only the ones actually supplied are ever written, stripped, or considered.
 * `undefined` means "the student did not name this" — distinct from `false`,
 * which means "remove it".
 */
export interface RunProps {
  /** Font family. Written to `w:ascii`, `w:hAnsi` AND `w:cs`. */
  font?: string;
  /** Size in POINTS. Written as half-points to BOTH `w:sz` and `w:szCs`. */
  sizePt?: number;
  /** true writes `<w:b/><w:bCs/>`; false removes both. */
  bold?: boolean;
  /** true writes `<w:i/><w:iCs/>`; false removes both. */
  italic?: boolean;
  /** Hex colour, with or without a leading '#'. */
  color?: string;
}

/**
 * Which `w:rPr` children each property owns. The complex-script twin is part of
 * the property, not an extra: a size that writes `w:sz` but not `w:szCs` leaves
 * Arabic text at its old size, which is precisely the defect this feature fixes.
 */
export const RUN_PROP_TAGS: Record<keyof RunProps, readonly string[]> = {
  font: ["rFonts"],
  sizePt: ["sz", "szCs"],
  bold: ["b", "bCs"],
  italic: ["i", "iCs"],
  color: ["color"],
};

/** Attributes of an existing `w:rFonts` that survive a font change. */
const PRESERVED_RFONTS_ATTRS = [
  "w:eastAsia", "w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme", "w:hint",
];

/**
 * Build a `<w:rFonts/>` for `font`, carrying over any east-Asian and theme
 * attributes the element being replaced happened to carry. The previous
 * implementation in FormattingManager dropped them.
 */
export function buildRFonts(font: string, existing?: string): string {
  const kept: string[] = [];
  if (existing) {
    for (const attr of PRESERVED_RFONTS_ATTRS) {
      // Word always double-quotes, but accept single quotes too.
      const m = new RegExp(`\\s${attr}=["']([^"']*)["']`).exec(existing);
      if (m) kept.push(`${attr}="${m[1]}"`);
    }
  }
  const tail = kept.length ? ` ${kept.join(" ")}` : "";
  return `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"${tail}/>`;
}

/** The `w:rPr` child tags owned by the properties present on `props`. */
export function propTagsFor(props: RunProps): string[] {
  const tags: string[] = [];
  for (const key of Object.keys(RUN_PROP_TAGS) as (keyof RunProps)[]) {
    if (props[key] !== undefined) tags.push(...RUN_PROP_TAGS[key]);
  }
  return tags;
}

/** Remove every occurrence of `tags` (self-closing or paired) from `w:rPr` inner XML. */
export function stripRunPropTags(rPrInner: string, tags: readonly string[]): string {
  let out = rPrInner;
  for (const tag of tags) {
    // `\b` would let "sz" match "szCs"; require a delimiter after the name.
    out = out.replace(new RegExp(`<w:${tag}(?=[\\s/>])[^>]*/>`, "g"), "");
    out = out.replace(new RegExp(`<w:${tag}(?=[\\s>])[^>]*>[\\s\\S]*?</w:${tag}>`, "g"), "");
  }
  return out;
}

/**
 * Merge `props` into `w:rPr` inner XML: strip the tags each named property owns,
 * append the replacements, then canonicalise into `CT_RPr` order. Properties not
 * named on `props` survive untouched — including `w:rtl`, `w:cs`, `w:highlight`
 * and `w:u`.
 */
export function mergeRunProps(rPrInner: string, props: RunProps): string {
  // Match the OPENING tag only, up to its own `>` - works whether the element
  // turns out to be self-closing (`<w:rFonts .../>`) or paired
  // (`<w:rFonts ...>...</w:rFonts>`). A `\/>`-only match (the previous bug)
  // returns undefined for a paired element, and buildRFonts then has nothing
  // to preserve from - the same silent-formatting-loss class this feature
  // exists to fix.
  const existingRFonts = /<w:rFonts(?=[\s/>])[^>]*>/.exec(rPrInner)?.[0];
  let body = rPrInner;
  const added: string[] = [];

  if (props.font !== undefined) {
    body = stripRunPropTags(body, RUN_PROP_TAGS.font);
    added.push(buildRFonts(props.font, existingRFonts));
  }
  if (props.sizePt !== undefined) {
    // w:sz/w:szCs are ST_HpsMeasure (unsigned half-points) - a negative,
    // zero, NaN or Infinite value would be schema-invalid OOXML that Word
    // refuses to open. Fail loudly rather than writing it.
    if (!Number.isFinite(props.sizePt) || props.sizePt <= 0) {
      throw new Error(
        `runProps.mergeRunProps: sizePt must be a finite number of points greater than 0, got ${props.sizePt}`,
      );
    }
    body = stripRunPropTags(body, RUN_PROP_TAGS.sizePt);
    const halfPoints = Math.round(props.sizePt * 2);
    added.push(`<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`);
  }
  if (props.bold !== undefined) {
    body = stripRunPropTags(body, RUN_PROP_TAGS.bold);
    if (props.bold) added.push(`<w:b/><w:bCs/>`);
  }
  if (props.italic !== undefined) {
    body = stripRunPropTags(body, RUN_PROP_TAGS.italic);
    if (props.italic) added.push(`<w:i/><w:iCs/>`);
  }
  if (props.color !== undefined) {
    // w:color is ST_HexColor: exactly 6 hex digits, or the literal "auto" -
    // anything else is schema-invalid OOXML.
    const stripped = props.color.replace(/^#/, "");
    let colorVal: string;
    if (/^[0-9a-fA-F]{6}$/.test(stripped)) {
      colorVal = stripped.toUpperCase();
    } else if (/^auto$/i.test(props.color)) {
      colorVal = "auto";
    } else {
      throw new Error(
        `runProps.mergeRunProps: color must be 6 hex digits (optionally prefixed with '#') or the literal "auto", got ${JSON.stringify(props.color)}`,
      );
    }
    body = stripRunPropTags(body, RUN_PROP_TAGS.color);
    added.push(`<w:color w:val="${colorVal}"/>`);
  }

  return canonicalizeRunProps(`${body}${added.join("")}`);
}
