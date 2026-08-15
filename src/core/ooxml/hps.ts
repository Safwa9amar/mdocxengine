/**
 * Point → half-point conversion for every `ST_HpsMeasure` attribute the engine
 * writes (`w:sz`, `w:szCs`).
 *
 * The measure is an unsigned WHOLE number of half-points. `<w:sz w:val="0.1204"/>`
 * is not "a very small font" — it is schema-invalid, and Word neither refuses
 * the file nor falls back to a readable size: it paints the text at a height of
 * effectively nothing, so a title the student asked for arrives INVISIBLE. A
 * caller that hands over a ratio, a fraction, or a percentage where points were
 * expected must be told at the call site, not discovered in Word.
 */

/** Word's own floor: one half-point. */
export const MIN_FONT_SIZE_PT = 0.5;
/** Word's own ceiling (its font-size box refuses more). */
export const MAX_FONT_SIZE_PT = 1638;

/**
 * `sizePt` in POINTS → whole half-points, or throw.
 *
 * @param sizePt  A real font size in points, e.g. 14 or 11.5.
 * @param what    What the caller was setting, for the error message.
 */
export function toHalfPoints(sizePt: number, what = "font size"): number {
  if (typeof sizePt !== "number" || !Number.isFinite(sizePt)) {
    throw new Error(`${what}: expected a number of POINTS, got ${JSON.stringify(sizePt)}`);
  }
  if (sizePt < MIN_FONT_SIZE_PT || sizePt > MAX_FONT_SIZE_PT) {
    throw new Error(
      `${what}: ${sizePt}pt is outside Word's range (${MIN_FONT_SIZE_PT}–${MAX_FONT_SIZE_PT}pt). ` +
        `A value this ${sizePt < MIN_FONT_SIZE_PT ? "small" : "large"} usually means a ratio, a fraction or another unit ` +
        `was passed where points were expected — pass e.g. 14 for 14pt.`,
    );
  }
  // w:sz is an INTEGER measure: a fractional half-point makes the file invalid.
  return Math.round(sizePt * 2);
}
