import { describe, test, expect } from "vitest";
import {
  headingLevelFromStyleId,
  paragraphOutlineLevel,
  paragraphHeadingLevel,
  paragraphAlignment,
  paragraphFontSizePt,
  paragraphIsBold,
  makeParagraphXml,
  makeStyledParagraphXml,
} from "./OrderedBody";

describe("heading-level helpers", () => {
  test("headingLevelFromStyleId handles English, French and separators", () => {
    expect(headingLevelFromStyleId("Heading1")).toBe(1);
    expect(headingLevelFromStyleId("Heading 3")).toBe(3);
    expect(headingLevelFromStyleId("heading-2")).toBe(2);
    expect(headingLevelFromStyleId("Titre4")).toBe(4);
    expect(headingLevelFromStyleId("Title")).toBe(1);
    expect(headingLevelFromStyleId("Normal")).toBe(0);
    expect(headingLevelFromStyleId(null)).toBe(0);
    expect(headingLevelFromStyleId("Heading7")).toBe(0); // out of range
  });

  test("paragraphOutlineLevel reads w:outlineLvl as 1-based", () => {
    expect(paragraphOutlineLevel('<w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:p>')).toBe(1);
    expect(paragraphOutlineLevel('<w:p><w:pPr><w:outlineLvl w:val="2"/></w:pPr></w:p>')).toBe(3);
    expect(paragraphOutlineLevel("<w:p><w:pPr/></w:p>")).toBe(0);
    expect(paragraphOutlineLevel('<w:p><w:pPr><w:outlineLvl w:val="9"/></w:pPr></w:p>')).toBe(0);
  });

  test("paragraphHeadingLevel prefers style, falls back to outline level", () => {
    expect(paragraphHeadingLevel(makeParagraphXml("Intro", "Heading2"))).toBe(2);
    // no heading style, but outline level present → 1-based
    expect(paragraphHeadingLevel('<w:p><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:r><w:t>x</w:t></w:r></w:p>')).toBe(2);
    // plain body paragraph
    expect(paragraphHeadingLevel(makeParagraphXml("body"))).toBe(0);
  });
});

describe("paragraph formatting signal readers", () => {
  test("paragraphAlignment reads w:jc", () => {
    expect(paragraphAlignment(makeStyledParagraphXml("x", { alignment: "center" }))).toBe("center");
    expect(paragraphAlignment(makeStyledParagraphXml("x"))).toBeNull();
  });

  test("paragraphFontSizePt converts half-points to points", () => {
    expect(paragraphFontSizePt(makeStyledParagraphXml("x", { fontSizePt: 14 }))).toBe(14);
    expect(paragraphFontSizePt(makeStyledParagraphXml("x"))).toBeNull();
  });

  test("paragraphIsBold is true only when every text run is bold", () => {
    expect(paragraphIsBold(makeStyledParagraphXml("title", { bold: true }))).toBe(true);
    expect(paragraphIsBold(makeStyledParagraphXml("plain"))).toBe(false);
    // mixed: one bold run + one non-bold text run → not fully bold
    const mixed =
      '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>A</w:t></w:r><w:r><w:t>B</w:t></w:r></w:p>';
    expect(paragraphIsBold(mixed)).toBe(false);
    // bold explicitly disabled
    expect(
      paragraphIsBold('<w:p><w:r><w:rPr><w:b w:val="0"/></w:rPr><w:t>A</w:t></w:r></w:p>'),
    ).toBe(false);
  });
});
