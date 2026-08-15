import { describe, test, expect } from "vitest";
import { toHalfPoints } from "./hps";
import { makeStyledParagraphXml } from "@/core/files/body/OrderedBody";

describe("toHalfPoints", () => {
  test("points → whole half-points", () => {
    expect(toHalfPoints(14)).toBe(28);
    expect(toHalfPoints(32)).toBe(64);
    expect(toHalfPoints(11.5)).toBe(23);
  });

  test("rounds to a whole half-point — w:sz takes nothing finer", () => {
    expect(toHalfPoints(12.3)).toBe(25);
    expect(Number.isInteger(toHalfPoints(9.7))).toBe(true);
  });

  test("refuses a fraction of a point — the size that prints an invisible title", () => {
    // The real defect: a model filled labelSizePt/titleSizePt with 0.0602 and
    // the divider page reached the student blank.
    expect(() => toHalfPoints(0.0602)).toThrow(/outside Word's range/);
    expect(() => toHalfPoints(0.032)).toThrow(/points/);
  });

  test("refuses zero, negative, non-finite and absurdly large sizes", () => {
    expect(() => toHalfPoints(0)).toThrow();
    expect(() => toHalfPoints(-14)).toThrow();
    expect(() => toHalfPoints(NaN)).toThrow();
    expect(() => toHalfPoints(Infinity)).toThrow();
    expect(() => toHalfPoints(5000)).toThrow(/outside Word's range/);
  });

  test("names what was being set, so the caller can be found", () => {
    expect(() => toHalfPoints(0.05, "divider title")).toThrow(/divider title/);
  });
});

describe("makeStyledParagraphXml font size", () => {
  test("emits whole half-points to BOTH w:sz and w:szCs", () => {
    const xml = makeStyledParagraphXml("عنوان", { fontSizePt: 32 });
    expect(xml).toContain(`<w:sz w:val="64"/><w:szCs w:val="64"/>`);
  });

  test("throws instead of writing a fractional w:sz", () => {
    expect(() => makeStyledParagraphXml("عنوان", { fontSizePt: 0.0602 })).toThrow(/outside Word's range/);
  });
});
