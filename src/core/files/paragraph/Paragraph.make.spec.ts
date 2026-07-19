import { describe, test, expect } from "vitest";
import Paragraph from ".";

describe("Paragraph.make", () => {
  test("plain text paragraph has a single run with that text", async () => {
    const p = Paragraph.make("Hello world");
    const { text } = await p.getPlainText();
    expect(text).toBe("Hello world");
    expect(p.getRuns()).toHaveLength(1);
  });

  test("empty text yields a property-only spacer (no run)", () => {
    const p = Paragraph.make("");
    expect(p.getRuns()).toHaveLength(0);
  });

  test("applies style, alignment and outline level in pPr", async () => {
    const p = Paragraph.make("Chapter", {
      styleId: "Heading1",
      alignment: "center",
      outlineLevel: 0,
    });
    const xml = await p.toXml();
    expect(xml).toContain('<w:pStyle w:val="Heading1"');
    expect(xml).toContain('<w:jc w:val="center"');
    expect(xml).toContain('<w:outlineLvl w:val="0"');
    expect(p.getAlignment()).toBe("center");
  });

  test("emits pPr children in canonical order (pStyle → jc → outlineLvl)", async () => {
    const p = Paragraph.make("X", { styleId: "Heading2", alignment: "right", outlineLevel: 1 });
    const xml = await p.toXml();
    const iStyle = xml.indexOf("w:pStyle");
    const iJc = xml.indexOf("w:jc");
    const iLvl = xml.indexOf("w:outlineLvl");
    expect(iStyle).toBeLessThan(iJc);
    expect(iJc).toBeLessThan(iLvl);
  });

  test("applies bold, italic, font size, family, colour and rtl to the run", () => {
    const p = Paragraph.make("نص", {
      bold: true,
      italic: true,
      fontSizePt: 14,
      fontFamily: "Sakkal Majalla",
      color: "#FF0000",
      rtl: true,
    });
    const [run] = p.getRuns();
    expect(run.isBold()).toBe(true);
    expect(run.isItalic()).toBe(true);
    expect(run.isRtl()).toBe(true);
    const props = run.getProperties()!;
    expect(props["w:sz"]?.$["w:val"]).toBe("28"); // 14pt → 28 half-points
    expect(props["w:rFonts"]?.$["w:ascii"]).toBe("Sakkal Majalla");
    expect(props["w:rFonts"]?.$["w:cs"]).toBe("Sakkal Majalla");
    expect(props["w:color"]?.$["w:val"]).toBe("FF0000"); // '#' stripped
  });
});
