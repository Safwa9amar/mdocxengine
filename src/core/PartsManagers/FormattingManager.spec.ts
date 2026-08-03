import { describe, test, expect } from "vitest";
import { FormattingManager } from "./FormattingManager";

const SAMPLE = [
  '<w:p><w:pPr><w:spacing w:before="0" w:line="240" w:lineRule="auto"/></w:pPr>',
  '<w:r><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>',
  "<w:t>hello</w:t></w:r></w:p>",
  '<w:sectPr><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>',
].join("");

describe("FormattingManager.applyToXml", () => {
  test("applies font to every w:rFonts (ascii/hAnsi/cs)", () => {
    const { xml, result } = FormattingManager.applyToXml(SAMPLE, { font: "Times New Roman" });
    expect(xml).toContain('<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>');
    expect(result.applied).toContain("font");
  });

  test("applies font size in half-points", () => {
    const { xml } = FormattingManager.applyToXml(SAMPLE, { fontSizePt: 12 });
    expect(xml).toContain('<w:sz w:val="24"');
    expect(xml).toContain('<w:szCs w:val="24"');
  });

  test("applies line spacing as 240ths", () => {
    const { xml } = FormattingManager.applyToXml(SAMPLE, { lineSpacing: 1.5 });
    expect(xml).toContain('w:line="360"'); // 1.5 * 240
  });

  test("margins respect binding side (left binding)", () => {
    const { xml } = FormattingManager.applyToXml(SAMPLE, {
      margins: { top: 2.5, bottom: 2, binding: 3, opposite: 2 },
      bindingSide: "left",
    });
    // binding(3cm)=1701 on left; opposite(2cm)=1134 on right
    expect(xml).toContain('w:left="1701"');
    expect(xml).toContain('w:right="1134"');
    expect(xml).toContain('w:top="1418"'); // 2.5 * 567 = 1417.5 → 1418
  });

  test("margins respect binding side (right binding swaps left/right)", () => {
    const { xml } = FormattingManager.applyToXml(SAMPLE, {
      margins: { top: 2, bottom: 2, binding: 3, opposite: 2 },
      bindingSide: "right",
    });
    expect(xml).toContain('w:right="1701"'); // binding on the right
    expect(xml).toContain('w:left="1134"');
  });

  test("only present fields are applied; others are not listed", () => {
    const { result } = FormattingManager.applyToXml(SAMPLE, { font: "Arial" });
    expect(result.applied).toEqual(["font"]);
    expect(result.skipped).toEqual([]);
  });

  test("empty formatting is a no-op", () => {
    const { xml, result } = FormattingManager.applyToXml(SAMPLE, {});
    expect(xml).toBe(SAMPLE);
    expect(result.applied).toEqual([]);
  });

  test("applyFont INSERTS on a document with no rFonts — the norm-profile no-op bug", () => {
    const xml = `<w:document><w:body><w:p><w:r><w:t>x</w:t></w:r></w:p></w:body></w:document>`;
    const { xml: out, result } = FormattingManager.applyToXml(xml, { font: "Simplified Arabic" });
    expect(result.applied).toContain("font");
    expect(out).toContain(`w:cs="Simplified Arabic"`);
  });

  test("applyFontSize INSERTS sz and szCs where absent", () => {
    const xml = `<w:document><w:body><w:p><w:r><w:t>x</w:t></w:r></w:p></w:body></w:document>`;
    const { xml: out } = FormattingManager.applyToXml(xml, { fontSizePt: 16 });
    expect(out).toContain(`<w:sz w:val="32"/>`);
    expect(out).toContain(`<w:szCs w:val="32"/>`);
  });
});
