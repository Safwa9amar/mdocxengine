import { describe, test, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import DocumentManager from "./DocumentManager";
import {
  paragraphText,
  paragraphStyleId,
  paragraphAlignment,
  paragraphHeadingLevel,
} from "../files/body/OrderedBody";

/**
 * Interleaved fixture body (mirrors DocumentManager.blocks.spec.ts):
 *   p(0) "Intro", tbl(1), p(2) "Mid"+"dle", tbl(3), p(4) image, sectPr
 *
 * The block-2 "Middle" paragraph carries TWO BOLD runs so run-preservation is
 * testable. Two runs (not one) because xml2js parses a single <w:r> as an object
 * rather than an array, and Paragraph.removeFormatting() iterates it with
 * Array.forEach — a single-object run would throw. Both runs concatenate to the
 * word "Middle" so paragraphText() still reads "Middle".
 */
const SAMPLE_DOC_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body><w:p w14:paraId="00000001"><w:r><w:t>Intro</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>TableA</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p w14:paraId="00000002"><w:r><w:rPr><w:b/></w:rPr><w:t>Mid</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>dle</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>TableB</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p w14:paraId="00000003"><w:r><w:drawing><a:blip r:embed="rId7"/></w:drawing></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;

const ORDER = ["paragraph", "table", "paragraph", "table", "paragraph"];

function makeZip(): AdmZip {
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(SAMPLE_DOC_XML, "utf-8"));
  return zip;
}

function currentXml(zip: AdmZip): string {
  return zip.readAsText("word/document.xml")!;
}

describe("DocumentManager — block-indexed paragraph edits (order + run preserving)", () => {
  let zip: AdmZip;
  let dm: DocumentManager;

  beforeEach(() => {
    zip = makeZip();
    dm = new DocumentManager(zip);
  });

  describe("setBlockStyle", () => {
    test("applies a heading style + outline level; order preserved", async () => {
      await dm.setBlockStyle(2, "Heading2");

      const blocks = await dm.getBlocks();
      expect(blocks.map((b) => b.kind)).toEqual(ORDER);
      expect(paragraphStyleId(blocks[2].xml)).toBe("Heading2");
      // Heading2 => 0-based outline level 1 so the outline/TOC detects it.
      expect(blocks[2].xml).toContain('<w:outlineLvl w:val="1"');
      expect(paragraphHeadingLevel(blocks[2].xml)).toBe(2);
      // text + bold runs survive.
      expect(paragraphText(blocks[2].xml)).toBe("Middle");

      // sibling tables untouched.
      const xml = currentXml(zip);
      expect(xml).toContain("TableA");
      expect(xml).toContain("TableB");
    });

    test("Normal demotes to body: drops style + outline level", async () => {
      await dm.setBlockStyle(2, "Heading3");
      await dm.setBlockStyle(2, "Normal");

      const blocks = await dm.getBlocks();
      expect(blocks.map((b) => b.kind)).toEqual(ORDER);
      expect(paragraphStyleId(blocks[2].xml)).not.toBe("Heading3");
      expect(paragraphStyleId(blocks[2].xml)).toBeNull();
      expect(blocks[2].xml).not.toContain("<w:outlineLvl");
      expect(paragraphHeadingLevel(blocks[2].xml)).toBe(0);
    });

    test("rejects a non-paragraph (table) block", async () => {
      await expect(dm.setBlockStyle(1, "Heading1")).rejects.toThrow(/no text paragraph/);
    });
  });

  describe("setBlockAlignment", () => {
    test("sets alignment; order preserved and bold runs NOT flattened", async () => {
      await dm.setBlockAlignment(2, "center");

      const blocks = await dm.getBlocks();
      expect(blocks.map((b) => b.kind)).toEqual(ORDER);
      expect(paragraphAlignment(blocks[2].xml)).toBe("center");
      // bold run preserved (run content not flattened).
      expect(blocks[2].xml).toContain("<w:b");
      expect(paragraphText(blocks[2].xml)).toBe("Middle");
    });

    test("rejects a non-paragraph (table) block", async () => {
      await expect(dm.setBlockAlignment(1, "center")).rejects.toThrow(/no text paragraph/);
    });
  });

  describe("clearBlockFormatting", () => {
    test("strips run formatting but keeps text + order", async () => {
      await dm.clearBlockFormatting(2);

      const blocks = await dm.getBlocks();
      expect(blocks.map((b) => b.kind)).toEqual(ORDER);
      expect(blocks[2].xml).not.toContain("<w:b");
      expect(paragraphText(blocks[2].xml)).toBe("Middle");
    });

    test("rejects a non-paragraph (table) block", async () => {
      await expect(dm.clearBlockFormatting(1)).rejects.toThrow(/no text paragraph/);
    });
  });

  describe("setBlockDirection", () => {
    test("rtl adds <w:bidi/>, order preserved, runs kept", async () => {
      await dm.setBlockDirection(2, "rtl");
      const blocks = await dm.getBlocks();
      expect(blocks.map((b) => b.kind)).toEqual(ORDER);
      expect(blocks[2].xml).toContain("<w:bidi");
      expect(blocks[2].xml).not.toContain('<w:bidi w:val="0"');
      expect(blocks[2].xml).toContain("<w:b"); // bold runs preserved
    });

    test("ltr writes an explicit <w:bidi w:val=\"0\"/>", async () => {
      await dm.setBlockDirection(2, "ltr");
      const blocks = await dm.getBlocks();
      expect(blocks[2].xml).toContain('<w:bidi w:val="0"');
    });

    test("rejects a non-paragraph (table) block", async () => {
      await expect(dm.setBlockDirection(1, "rtl")).rejects.toThrow(/no text paragraph/);
    });
  });
});
