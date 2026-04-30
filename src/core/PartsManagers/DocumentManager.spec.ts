import { describe, test, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import DocumentManager from "./DocumentManager";
import Paragraph from "@/core/files/paragraph";

const SAMPLE_DOC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">
  <w:body>
    <w:p w14:paraId="00000001">
      <w:r><w:t>Hello</w:t></w:r>
    </w:p>
    <w:p w14:paraId="00000002">
      <w:r><w:t>World</w:t></w:r>
    </w:p>
    <w:sectPr/>
  </w:body>
</w:document>`;

function makeZip(): AdmZip {
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(SAMPLE_DOC_XML, "utf-8"));
  return zip;
}

describe("DocumentManager", () => {
  let zip: AdmZip;
  let dm: DocumentManager;

  beforeEach(() => {
    zip = makeZip();
    dm = new DocumentManager(zip);
  });

  test("getParagraphs() returns all paragraphs", async () => {
    const paragraphs = await dm.getParagraphs();
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toBeInstanceOf(Paragraph);
  });

  test("getParagraphByIndex() returns the correct paragraph", async () => {
    const p = await dm.getParagraphByIndex(1);
    expect(p).not.toBeNull();
    const { text } = await p!.getPlainText();
    expect(text).toBe("World");
  });

  test("getParagraphByIndex() returns null for out-of-range index", async () => {
    const p = await dm.getParagraphByIndex(99);
    expect(p).toBeNull();
  });

  test("getParagraphById() finds paragraph by paraId", async () => {
    const p = await dm.getParagraphById("00000001");
    expect(p).not.toBeNull();
    const { text } = await p!.getPlainText();
    expect(text).toBe("Hello");
  });

  test("getParagraphById() returns null for unknown id", async () => {
    const p = await dm.getParagraphById("FFFFFFFF");
    expect(p).toBeNull();
  });

  test("insertParagraph() appends paragraph when no index given", async () => {
    const newP = new Paragraph({ $: {}, "w:r": [{ "w:t": "New" }] } as any);
    await dm.insertParagraph(newP);
    const paragraphs = await dm.getParagraphs();
    expect(paragraphs).toHaveLength(3);
    const { text } = await paragraphs[2].getPlainText();
    expect(text).toBe("New");
  });

  test("insertParagraph() inserts at the given index", async () => {
    const newP = new Paragraph({ $: {}, "w:r": [{ "w:t": "Middle" }] } as any);
    await dm.insertParagraph(newP, 1);
    const paragraphs = await dm.getParagraphs();
    expect(paragraphs).toHaveLength(3);
    const { text } = await paragraphs[1].getPlainText();
    expect(text).toBe("Middle");
  });

  test("deleteParagraph() removes paragraph by paraId", async () => {
    await dm.deleteParagraph("00000001");
    const paragraphs = await dm.getParagraphs();
    expect(paragraphs).toHaveLength(1);
    const { text } = await paragraphs[0].getPlainText();
    expect(text).toBe("World");
  });

  test("replaceParagraph() swaps a paragraph by paraId", async () => {
    const replacement = new Paragraph({
      $: { "w14:paraId": "00000001" },
      "w:r": [{ "w:t": "Replaced" }],
    } as any);
    await dm.replaceParagraph("00000001", replacement);
    const paragraphs = await dm.getParagraphs();
    expect(paragraphs).toHaveLength(2);
    const { text } = await paragraphs[0].getPlainText();
    expect(text).toBe("Replaced");
  });

  test("replaceParagraph() throws for unknown paraId", async () => {
    const p = new Paragraph({ $: {} } as any);
    await expect(dm.replaceParagraph("FFFFFFFF", p)).rejects.toThrow("Paragraph not found");
  });

  test("findAndReplaceAll() replaces text across all paragraphs", async () => {
    await dm.findAndReplaceAll("Hello", "Hi");
    const paragraphs = await dm.getParagraphs();
    const { text } = await paragraphs[0].getPlainText();
    expect(text).toBe("Hi");
  });

  test("addHeaderReferenceToDocument() adds sectPr reference", async () => {
    await dm.addHeaderReferenceToDocument("rId1", "default");
    const xml = zip.readAsText("word/document.xml")!;
    expect(xml).toContain("rId1");
    expect(xml).toContain("w:headerReference");
  });

  test("addFooterReferenceToDocument() adds sectPr reference", async () => {
    await dm.addFooterReferenceToDocument("rId2", "default");
    const xml = zip.readAsText("word/document.xml")!;
    expect(xml).toContain("rId2");
    expect(xml).toContain("w:footerReference");
  });
});
