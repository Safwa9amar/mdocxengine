import { describe, test, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import DocumentManager from "./DocumentManager";
import { makeParagraphNode, paragraphText } from "../files/body/OrderedBody";

/**
 * Interleaved fixture body:
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

describe("DocumentManager — ordered blocks (string model)", () => {
  let zip: AdmZip;
  let dm: DocumentManager;

  beforeEach(() => {
    zip = makeZip();
    dm = new DocumentManager(zip);
  });

  test("getBlocks returns blocks in document order with correct kinds (no sectPr)", async () => {
    const blocks = await dm.getBlocks();
    expect(blocks.map((b) => b.kind)).toEqual([
      "paragraph",
      "table",
      "paragraph",
      "table",
      "paragraph",
    ]);
    expect(paragraphText(blocks[0].xml)).toBe("Intro");
    expect(paragraphText(blocks[2].xml)).toBe("Middle");
    // each block carries its exact substring
    expect(blocks[1].xml).toContain("TableA");
    expect(blocks[4].xml).toContain("w:drawing");
  });

  test("editParagraphText changes only that paragraph; tables stay in place", async () => {
    await dm.editParagraphText(2, "CHANGED");

    const blocks = await dm.getBlocks();
    expect(blocks.map((b) => b.kind)).toEqual([
      "paragraph",
      "table",
      "paragraph",
      "table",
      "paragraph",
    ]);
    expect(paragraphText(blocks[0].xml)).toBe("Intro"); // untouched
    expect(paragraphText(blocks[2].xml)).toBe("CHANGED");

    const xml = currentXml(zip);
    // Both tables still present + their cell text intact + same relative order.
    expect(xml.split("<w:tbl>").length - 1).toBe(2);
    expect(xml).toContain("TableA");
    expect(xml).toContain("TableB");
    expect(xml.indexOf("TableA")).toBeLessThan(xml.indexOf("CHANGED"));
    expect(xml.indexOf("CHANGED")).toBeLessThan(xml.indexOf("TableB"));
  });

  test("editParagraphText rewrites ONLY the target block's bytes", async () => {
    const before = currentXml(zip);
    await dm.editParagraphText(0, "Intro2");
    const after = currentXml(zip);
    // Everything except the first paragraph is byte-identical.
    const beforeAfterFirstP = before.slice(before.indexOf("</w:p>"));
    const afterAfterFirstP = after.slice(after.indexOf("</w:p>"));
    expect(afterAfterFirstP).toBe(beforeAfterFirstP);
  });

  test("editParagraphText throws when target block is not a paragraph", async () => {
    await expect(dm.editParagraphText(1, "x")).rejects.toThrow(/not a paragraph/);
  });

  test("editParagraphText throws for out-of-range index", async () => {
    await expect(dm.editParagraphText(99, "x")).rejects.toThrow(/no block at index/);
  });

  test("insertBlockAt inserts a paragraph at the right spot; order preserved", async () => {
    await dm.insertBlockAt(makeParagraphNode("NEW"), 1);

    const blocks = await dm.getBlocks();
    expect(blocks.map((b) => b.kind)).toEqual([
      "paragraph", // Intro
      "paragraph", // NEW
      "table",
      "paragraph", // Middle
      "table",
      "paragraph", // image
    ]);
    expect(paragraphText(blocks[1].xml)).toBe("NEW");
    // sectPr stays last + only one of it.
    const xml = currentXml(zip);
    expect(xml.split("<w:sectPr>").length - 1).toBe(1);
    expect(xml.indexOf("NEW")).toBeLessThan(xml.indexOf("<w:sectPr>"));
  });

  test("insertBlockAt with large index appends before sectPr", async () => {
    await dm.insertBlockAt(makeParagraphNode("LAST"), 999);
    const blocks = await dm.getBlocks();
    expect(blocks).toHaveLength(6);
    expect(paragraphText(blocks[5].xml)).toBe("LAST");
    const xml = currentXml(zip);
    expect(xml.indexOf("LAST")).toBeLessThan(xml.indexOf("<w:sectPr>"));
  });

  test("deleteBlockAt removes only that block; order otherwise preserved", async () => {
    await dm.deleteBlockAt(0); // remove Intro paragraph

    const blocks = await dm.getBlocks();
    expect(blocks.map((b) => b.kind)).toEqual([
      "table",
      "paragraph",
      "table",
      "paragraph",
    ]);
    expect(paragraphText(blocks[1].xml)).toBe("Middle");
    const xml = currentXml(zip);
    expect(xml).not.toContain(">Intro<");
    expect(xml.split("<w:tbl>").length - 1).toBe(2); // tables intact
  });

  test("deleteBlockAt throws for out-of-range index", async () => {
    await expect(dm.deleteBlockAt(99)).rejects.toThrow(/no block at index/);
  });

  test("a drawing/image paragraph survives an unrelated edit (media ref intact)", async () => {
    await dm.editParagraphText(0, "Edited intro");
    const xml = currentXml(zip);
    expect(xml).toContain("w:drawing");
    expect(xml).toContain('r:embed="rId7"');
    // drawing paragraph still the last editable block
    const blocks = await dm.getBlocks();
    expect(blocks[blocks.length - 1].tag).toBe("w:p");
    expect(blocks[blocks.length - 1].xml).toContain("w:drawing");
  });

  test("saveBlocks round-trips the same blocks BYTE-IDENTICALLY", async () => {
    const before = currentXml(zip);
    const blocks = await dm.getBlocks();
    await dm.saveBlocks(blocks);
    const after = currentXml(zip);
    expect(after).toBe(before);
  });

  test("saveBlocks reorders editable blocks while keeping sectPr last", async () => {
    const blocks = await dm.getBlocks();
    const reordered = [blocks[2], blocks[0], blocks[1], blocks[3], blocks[4]];
    await dm.saveBlocks(reordered);

    const after = await dm.getBlocks();
    expect(paragraphText(after[0].xml)).toBe("Middle");
    expect(paragraphText(after[1].xml)).toBe("Intro");
    const xml = currentXml(zip);
    // sectPr remained last.
    expect(xml.indexOf("<w:sectPr>")).toBeGreaterThan(xml.lastIndexOf("</w:tbl>"));
    expect(xml.split("<w:sectPr>").length - 1).toBe(1);
  });
});
