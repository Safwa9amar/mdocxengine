import { describe, test, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import DocumentManager from "../../PartsManagers/DocumentManager";
import {
  makeTableXml,
  makeTableNode,
  makeDrawingParagraphXml,
  makeDrawingParagraphNode,
  nextDrawingId,
  splitDocument,
} from "./OrderedBody";

/**
 * Interleaved fixture body (same shape as DocumentManager.blocks.spec):
 *   p(0) "Intro", tbl(1), p(2) "Middle", tbl(3), p(4) image, sectPr
 */
const SAMPLE_DOC_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body><w:p w14:paraId="00000001"><w:r><w:t>Intro</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>TableA</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p w14:paraId="00000002"><w:r><w:t>Middle</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>TableB</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p w14:paraId="00000003"><w:r><w:drawing><a:blip r:embed="rId7"/></w:drawing></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;

function makeZip(): AdmZip {
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(SAMPLE_DOC_XML, "utf-8"));
  return zip;
}

function currentXml(zip: AdmZip): string {
  return zip.readAsText("word/document.xml")!;
}

/** Returns the exact substring of each top-level body block, in order. */
function blockSubstrings(xml: string): string[] {
  return splitDocument(xml).blocks.map((b) => b.xml);
}

/** Cheap well-formedness check: re-split via the scanner so depth tracking proves balance. */
function wellFormedFragment(fragment: string): boolean {
  // Wrap the fragment in a minimal document and let the scanner walk it; if the
  // top-level structure is balanced it parses back to exactly one block.
  const wrapped = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${fragment}</w:body></w:document>`;
  const blocks = splitDocument(wrapped).blocks;
  return blocks.length === 1 && blocks[0].xml === fragment;
}

describe("OrderedBody — table block builder", () => {
  let zip: AdmZip;
  let dm: DocumentManager;

  beforeEach(() => {
    zip = makeZip();
    dm = new DocumentManager(zip);
  });

  test("makeTableXml produces a well-formed <w:tbl> with header bold + shading + 100% width", () => {
    const xml = makeTableXml(
      [
        ["A", "B"],
        ["1", "2"],
      ],
      { headerRow: true },
    );
    expect(xml.startsWith("<w:tbl>")).toBe(true);
    expect(xml.endsWith("</w:tbl>")).toBe(true);
    // 2 grid cols (widest row), 2 rows, 4 cells.
    expect(xml.split("<w:gridCol").length - 1).toBe(2);
    expect(xml.split("<w:tr>").length - 1).toBe(2);
    expect(xml.split("<w:tc>").length - 1).toBe(4);
    // 100% pct width.
    expect(xml).toContain('w:type="pct"');
    expect(xml).toContain('w:w="5000"');
    // header row → tblHeader marker + shaded + bold run.
    expect(xml).toContain("w:tblHeader");
    expect(xml).toContain('w:fill="D9D9D9"');
    expect(xml).toContain("<w:b/>");
    // borders present.
    expect(xml).toContain("w:tblBorders");
    expect(xml).toContain("w:insideH");
    // cell text preserved + escaped via the serializer.
    expect(xml).toContain(">A<");
    expect(xml).toContain(">2<");
    // re-parses (well-formed fragment).
    expect(wellFormedFragment(xml)).toBe(true);
  });

  test("makeTableXml escapes cell text and supports RTL", () => {
    const xml = makeTableXml([["a & <b>", "c"]], { rtl: true });
    expect(xml).toContain("a &amp; &lt;b&gt;");
    expect(xml).toContain("w:bidiVisual");
    expect(wellFormedFragment(xml)).toBe(true);
  });

  test("makeTableXml widens grid to the longest row", () => {
    const xml = makeTableXml([["a"], ["b", "c", "d"]]);
    expect(xml.split("<w:gridCol").length - 1).toBe(3);
    // every row padded to 3 cells.
    expect(xml.split("<w:tc>").length - 1).toBe(6);
  });

  test("inserting a table block round-trips: other blocks byte-identical, table at right index", async () => {
    const before = currentXml(zip);
    const beforeBlocks = blockSubstrings(before);

    // Insert a table after the first paragraph (editable index 1).
    const node = makeTableNode(
      [
        ["A", "B"],
        ["1", "2"],
      ],
      { headerRow: true },
    );
    await dm.insertBlockAt(node, 1);

    const blocks = await dm.getBlocks();
    expect(blocks.map((b) => b.kind)).toEqual([
      "paragraph", // Intro
      "table", // NEW table
      "table", // TableA
      "paragraph", // Middle
      "table", // TableB
      "paragraph", // image
    ]);
    expect(blocks[1].xml).toBe(node.xml);

    // The inserted <w:tbl> re-parses + has 2 rows / correct cell text.
    expect(wellFormedFragment(blocks[1].xml)).toBe(true);
    expect(blocks[1].xml.split("<w:tr>").length - 1).toBe(2);
    expect(blocks[1].xml).toContain(">A<");
    expect(blocks[1].xml).toContain(">1<");

    // ALL original blocks are byte-identical (the new block is purely additive).
    const after = currentXml(zip);
    const afterBlocks = blockSubstrings(after);
    // afterBlocks = [Intro, NEW, TableA, Middle, TableB, image, sectPr]
    expect(afterBlocks).toHaveLength(beforeBlocks.length + 1);
    expect(afterBlocks[0]).toBe(beforeBlocks[0]); // Intro
    expect(afterBlocks[2]).toBe(beforeBlocks[1]); // TableA
    expect(afterBlocks[3]).toBe(beforeBlocks[2]); // Middle
    expect(afterBlocks[4]).toBe(beforeBlocks[3]); // TableB
    expect(afterBlocks[5]).toBe(beforeBlocks[4]); // image paragraph
    expect(afterBlocks[6]).toBe(beforeBlocks[5]); // sectPr
    // exactly one sectPr remains, still last.
    expect(after.split("<w:sectPr>").length - 1).toBe(1);
  });
});

describe("OrderedBody — drawing (inline image) block builder", () => {
  let zip: AdmZip;
  let dm: DocumentManager;

  beforeEach(() => {
    zip = makeZip();
    dm = new DocumentManager(zip);
  });

  test("makeDrawingParagraphXml declares wp/a/pic namespaces, preserves r:embed + extent", () => {
    const xml = makeDrawingParagraphXml("rId99", 4572000, 3429000, 7, "Chart 1");
    expect(xml.startsWith("<w:p>")).toBe(true);
    expect(xml.endsWith("</w:p>")).toBe(true);
    expect(xml).toContain("<w:drawing>");
    expect(xml).toContain('r:embed="rId99"');
    expect(xml).toContain('cx="4572000"');
    expect(xml).toContain('cy="3429000"');
    expect(xml).toContain('id="7"');
    expect(xml).toContain('name="Chart 1"');
    // namespaces declared LOCALLY so the block is self-contained.
    expect(xml).toContain('xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"');
    expect(xml).toContain('xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"');
    expect(xml).toContain('xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"');
    // r: is NOT redeclared locally (it lives on w:document).
    expect(xml).not.toContain('xmlns:r=');
    // plain drawing — no mc:AlternateContent.
    expect(xml).not.toContain("mc:AlternateContent");
    expect(wellFormedFragment(xml)).toBe(true);
  });

  test("makeDrawingParagraphXml escapes the picture name", () => {
    const xml = makeDrawingParagraphXml("rId1", 100, 100, 3, 'A & "B" <C>');
    expect(xml).toContain("A &amp; &quot;B&quot; &lt;C&gt;");
    expect(wellFormedFragment(xml)).toBe(true);
  });

  test("inserting a drawing paragraph: getBlocks sees a paragraph carrying <w:drawing>, others byte-identical", async () => {
    const before = currentXml(zip);
    const beforeBlocks = blockSubstrings(before);

    const node = makeDrawingParagraphNode("rId99", 4572000, 3429000, 7, "Chart 1");
    expect(node.kind).toBe("paragraph");
    expect(node.tag).toBe("w:p");

    // Insert at the end (before sectPr).
    await dm.insertBlockAt(node, 999);

    const blocks = await dm.getBlocks();
    expect(blocks.map((b) => b.kind)).toEqual([
      "paragraph", // Intro
      "table", // TableA
      "paragraph", // Middle
      "table", // TableB
      "paragraph", // image
      "paragraph", // NEW drawing paragraph
    ]);
    const inserted = blocks[blocks.length - 1];
    // L1 image detection fires on a paragraph whose xml includes "<w:drawing>".
    expect(inserted.xml.includes("<w:drawing>")).toBe(true);
    expect(inserted.xml).toContain('r:embed="rId99"');
    expect(wellFormedFragment(inserted.xml)).toBe(true);

    // Original blocks byte-identical (additive insert before sectPr).
    const after = currentXml(zip);
    const afterBlocks = blockSubstrings(after);
    expect(afterBlocks).toHaveLength(beforeBlocks.length + 1);
    expect(afterBlocks[0]).toBe(beforeBlocks[0]); // Intro
    expect(afterBlocks[1]).toBe(beforeBlocks[1]); // TableA
    expect(afterBlocks[2]).toBe(beforeBlocks[2]); // Middle
    expect(afterBlocks[3]).toBe(beforeBlocks[3]); // TableB
    expect(afterBlocks[4]).toBe(beforeBlocks[4]); // original image paragraph
    // sectPr stays last + only one.
    expect(afterBlocks[6]).toBe(beforeBlocks[5]); // sectPr
    expect(after.split("<w:sectPr>").length - 1).toBe(1);
    expect(after.indexOf("rId99")).toBeLessThan(after.indexOf("<w:sectPr>"));
  });
});

describe("OrderedBody — nextDrawingId", () => {
  test("returns max(existing docPr/cNvPr id) + 1", () => {
    const xml =
      `<w:document><w:body>` +
      `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="3" name="x"/>` +
      `<pic:pic><pic:nvPicPr><pic:cNvPr id="5" name="y"/></pic:nvPicPr></pic:pic>` +
      `</wp:inline></w:drawing></w:r></w:p>` +
      `<w:p><w:r><w:drawing><wp:inline><wp:docPr id="11" name="z"/></wp:inline></w:drawing></w:r></w:p>` +
      `</w:body></w:document>`;
    expect(nextDrawingId(xml)).toBe(12);
  });

  test("returns 1 when the document has no drawing ids", () => {
    const xml = `<w:document><w:body><w:p><w:r><w:t>hi</w:t></w:r></w:p></w:body></w:document>`;
    expect(nextDrawingId(xml)).toBe(1);
  });
});
