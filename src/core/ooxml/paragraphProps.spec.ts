import { describe, test, expect } from "vitest";
import {
  applyParagraphPagination,
  applyRunPropsToParagraph,
  isParagraphXml,
  readParagraphPagination,
  readParagraphProps,
  updateParagraphProps,
} from "./paragraphProps";

// A paragraph shaped like the ones this actually runs on: an Arabic thesis
// heading, so `w:pPr` already carries children from LATE in the CT_PPr sequence.
const ARABIC_HEADING =
  `<w:p w:rsidR="00A1"><w:pPr><w:pStyle w:val="Heading1"/><w:bidi/><w:jc w:val="center"/></w:pPr>` +
  `<w:r><w:rPr><w:rtl/></w:rPr><w:t>الإهداء</w:t></w:r></w:p>`;

describe("readParagraphProps", () => {
  test("reads the pPr inner XML", () => {
    expect(readParagraphProps(ARABIC_HEADING)).toBe(
      `<w:pStyle w:val="Heading1"/><w:bidi/><w:jc w:val="center"/>`,
    );
  });

  test("empty string for a paragraph with no pPr, null for a non-paragraph", () => {
    expect(readParagraphProps(`<w:p><w:r><w:t>hi</w:t></w:r></w:p>`)).toBe("");
    expect(readParagraphProps(`<w:p/>`)).toBe("");
    expect(readParagraphProps(`<w:tbl><w:tr/></w:tbl>`)).toBeNull();
  });

  test("does not reach into a paragraph nested in a text box", () => {
    const outer =
      `<w:p><w:r><w:drawing><wps:txbx><w:txbxContent>` +
      `<w:p><w:pPr><w:jc w:val="left"/></w:pPr></w:p>` +
      `</w:txbxContent></wps:txbx></w:drawing></w:r></w:p>`;
    expect(readParagraphProps(outer)).toBe("");
  });
});

describe("isParagraphXml", () => {
  test("accepts paired, self-closing and attributed paragraphs; rejects others", () => {
    expect(isParagraphXml(`<w:p></w:p>`)).toBe(true);
    expect(isParagraphXml(`<w:p/>`)).toBe(true);
    expect(isParagraphXml(`<w:p w:rsidR="00A1"/>`)).toBe(true);
    expect(isParagraphXml(`<w:tbl></w:tbl>`)).toBe(false);
    // `<w:pPr>` starts with `<w:p` but is not a paragraph.
    expect(isParagraphXml(`<w:pPr><w:bidi/></w:pPr>`)).toBe(false);
  });
});

describe("updateParagraphProps", () => {
  test("creates a pPr when the paragraph has none", () => {
    const out = updateParagraphProps(`<w:p><w:r><w:t>hi</w:t></w:r></w:p>`, () => `<w:keepNext/>`);
    expect(out).toBe(`<w:p><w:pPr><w:keepNext/></w:pPr><w:r><w:t>hi</w:t></w:r></w:p>`);
  });

  test("a SELF-CLOSING paragraph is reopened, never spliced after its own close", () => {
    const out = updateParagraphProps(`<w:p w:rsidR="00A1"/>`, () => `<w:keepNext/>`);
    expect(out).toBe(`<w:p w:rsidR="00A1"><w:pPr><w:keepNext/></w:pPr></w:p>`);
  });

  test("returns the input byte-for-byte when the mutation is a no-op", () => {
    expect(updateParagraphProps(ARABIC_HEADING, (inner) => inner)).toBe(ARABIC_HEADING);
    expect(updateParagraphProps(`<w:p/>`, (inner) => inner)).toBe(`<w:p/>`);
  });

  test("drops the pPr entirely when the mutation empties it", () => {
    const out = updateParagraphProps(`<w:p><w:pPr><w:keepNext/></w:pPr><w:r/></w:p>`, () => "");
    expect(out).toBe(`<w:p><w:r/></w:p>`);
  });

  test("keeps everything after the pPr byte-for-byte", () => {
    const out = updateParagraphProps(ARABIC_HEADING, (inner) => `${inner}<w:keepNext/>`);
    expect(out).toContain(`<w:r><w:rPr><w:rtl/></w:rPr><w:t>الإهداء</w:t></w:r></w:p>`);
  });
});

describe("applyParagraphPagination", () => {
  test("keepNext lands in CT_PPr ORDER — right after pStyle, ahead of bidi/jc", () => {
    const out = applyParagraphPagination(ARABIC_HEADING, { keepWithNext: true });
    expect(out).toContain(
      `<w:pPr><w:pStyle w:val="Heading1"/><w:keepNext/><w:bidi/><w:jc w:val="center"/></w:pPr>`,
    );
  });

  test("the whole CT_PPrBase sequence stays ordered with every flag set at once", () => {
    const out = applyParagraphPagination(ARABIC_HEADING, {
      keepWithNext: true,
      keepLines: true,
      pageBreakBefore: true,
      widowControl: true,
    });
    const inner = readParagraphProps(out)!;
    const order = ["w:pStyle", "w:keepNext", "w:keepLines", "w:pageBreakBefore", "w:widowControl", "w:bidi", "w:jc"];
    const positions = order.map((tag) => inner.indexOf(`<${tag}`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  test("false writes an EXPLICIT w:val=0 — deleting would only re-inherit the style's keepNext", () => {
    const on = applyParagraphPagination(ARABIC_HEADING, { keepWithNext: true });
    const off = applyParagraphPagination(on, { keepWithNext: false });
    expect(off).toContain(`<w:keepNext w:val="0"/>`);
    expect(off).not.toContain(`<w:keepNext/>`);
  });

  test("is idempotent — applying twice never duplicates the element", () => {
    const once = applyParagraphPagination(ARABIC_HEADING, { keepWithNext: true, keepLines: true });
    const twice = applyParagraphPagination(once, { keepWithNext: true, keepLines: true });
    expect(twice).toBe(once);
    expect(twice.match(/<w:keepNext\b/g)).toHaveLength(1);
  });

  test("undefined leaves a property alone", () => {
    const on = applyParagraphPagination(ARABIC_HEADING, { keepWithNext: true, widowControl: false });
    const out = applyParagraphPagination(on, { keepLines: true });
    expect(out).toContain(`<w:keepNext/>`);
    expect(out).toContain(`<w:widowControl w:val="0"/>`);
    expect(out).toContain(`<w:keepLines/>`);
  });

  test("works on a paragraph with no pPr at all", () => {
    const out = applyParagraphPagination(`<w:p><w:r><w:t>x</w:t></w:r></w:p>`, { keepWithNext: true });
    expect(out).toBe(`<w:p><w:pPr><w:keepNext/></w:pPr><w:r><w:t>x</w:t></w:r></w:p>`);
  });

  test("reads back what it wrote", () => {
    const out = applyParagraphPagination(ARABIC_HEADING, { keepWithNext: true, widowControl: false });
    expect(readParagraphPagination(out)).toEqual({ keepWithNext: true, widowControl: false });
    expect(readParagraphPagination(ARABIC_HEADING)).toEqual({});
  });

  test("throws on a non-paragraph rather than corrupting it", () => {
    expect(() => applyParagraphPagination(`<w:tbl/>`, { keepWithNext: true })).toThrow(/not a <w:p>/);
  });
});

describe("applyRunPropsToParagraph", () => {
  test("sizes EVERY run and the paragraph mark, with the complex-script twin", () => {
    const { xml, runs } = applyRunPropsToParagraph(ARABIC_HEADING, { sizePt: 48 });
    expect(runs).toBe(1);
    // the run
    expect(xml).toContain(`<w:rPr><w:sz w:val="96"/><w:szCs w:val="96"/><w:rtl/></w:rPr>`);
    // the paragraph mark, inside pPr
    expect(readParagraphProps(xml)).toContain(`<w:rPr><w:sz w:val="96"/><w:szCs w:val="96"/></w:rPr>`);
  });

  test("the mark's rPr is the LAST pPr child — CT_PPr puts it after jc", () => {
    const inner = readParagraphProps(applyRunPropsToParagraph(ARABIC_HEADING, { sizePt: 48 }).xml)!;
    expect(inner.indexOf("<w:rPr>")).toBeGreaterThan(inner.indexOf("<w:jc"));
  });

  test("keeps run properties it was not asked about (w:rtl survives a resize)", () => {
    const { xml } = applyRunPropsToParagraph(ARABIC_HEADING, { sizePt: 48 });
    expect(xml).toContain("<w:rtl/>");
  });

  test("creates rPr as the run's FIRST child when the run has none", () => {
    const p = `<w:p><w:r><w:t>hello</w:t></w:r></w:p>`;
    const { xml } = applyRunPropsToParagraph(p, { bold: true });
    expect(xml).toBe(`<w:p><w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:pPr><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>hello</w:t></w:r></w:p>`);
  });

  test("styles every run of a multi-run paragraph", () => {
    const p = `<w:p><w:r><w:t>a</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>b</w:t></w:r></w:p>`;
    const { runs, xml } = applyRunPropsToParagraph(p, { font: "Simplified Arabic" });
    expect(runs).toBe(2);
    expect(xml.match(/w:cs="Simplified Arabic"/g)).toHaveLength(3); // 2 runs + the mark
    expect(xml).toContain("<w:b/>"); // the bold run stays bold
  });

  test("reports zero runs for an empty paragraph instead of pretending it worked", () => {
    expect(applyRunPropsToParagraph(`<w:p/>`, { sizePt: 14 }).runs).toBe(0);
  });

  test("propagates an invalid size rather than writing schema-invalid OOXML", () => {
    expect(() => applyRunPropsToParagraph(ARABIC_HEADING, { sizePt: 0 })).toThrow(/sizePt/);
    expect(() => applyRunPropsToParagraph(ARABIC_HEADING, { color: "reddish" })).toThrow(/color/);
  });

  test("throws on a non-paragraph", () => {
    expect(() => applyRunPropsToParagraph(`<w:tbl/>`, { bold: true })).toThrow(/not a <w:p>/);
  });
});
