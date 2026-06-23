import { describe, test, expect } from "vitest";
import {
  parseOrderedDoc,
  buildOrderedDoc,
  toBlocks,
  makeParagraphNode,
  paragraphText,
  paragraphStyleId,
  setParagraphText,
  nodeTag,
} from "./OrderedBody";

/**
 * Golden fixture: an interleaved body —
 *   p, tbl, p, tbl, p(with w:drawing)
 * plus a trailing w:sectPr. This is the GATE for the whole migration.
 */
const FIXTURE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><w:body><w:p w14:paraId="00000001"><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">First heading </w:t></w:r></w:p><w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr><w:tr><w:tc><w:p><w:r><w:t>Cell A1</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>Between tables &amp; more</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell B1</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><a:graphic><a:graphicData><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId7"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`;

/** Ordered list of top-level body tags from a document XML string. */
function bodyTagSequence(xml: string): string[] {
  const { bodyChildren } = parseOrderedDoc(xml);
  return bodyChildren.map((n) => nodeTag(n));
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("OrderedBody — golden round-trip (the gate)", () => {
  test("preserves the ordered top-level body tag sequence", () => {
    const original = bodyTagSequence(FIXTURE);
    expect(original).toEqual(["w:p", "w:tbl", "w:p", "w:tbl", "w:p", "w:sectPr"]);

    const { doc } = parseOrderedDoc(FIXTURE);
    const rebuilt = buildOrderedDoc(doc);
    const afterSequence = bodyTagSequence(rebuilt);

    expect(afterSequence).toEqual(original);
  });

  test("preserves w:tbl count", () => {
    const { doc } = parseOrderedDoc(FIXTURE);
    const rebuilt = buildOrderedDoc(doc);
    expect(countOccurrences(rebuilt, "<w:tbl>")).toBe(2);
  });

  test("preserves the w:drawing (and its embedded image relationship)", () => {
    const { doc } = parseOrderedDoc(FIXTURE);
    const rebuilt = buildOrderedDoc(doc);
    expect(rebuilt).toContain("w:drawing");
    expect(rebuilt).toContain('r:embed="rId7"');
    expect(rebuilt).toContain("pic:pic");
  });

  test("preserves the trailing w:sectPr in place", () => {
    const { doc } = parseOrderedDoc(FIXTURE);
    const rebuilt = buildOrderedDoc(doc);
    const seq = bodyTagSequence(rebuilt);
    expect(seq[seq.length - 1]).toBe("w:sectPr");
    expect(rebuilt).toContain('w:w="11906"');
    expect(rebuilt).toContain('w:h="16838"');
  });

  test("round-trip is idempotent (re-parse + re-build is byte-stable)", () => {
    const { doc } = parseOrderedDoc(FIXTURE);
    const once = buildOrderedDoc(doc);
    const twice = buildOrderedDoc(parseOrderedDoc(once).doc);
    expect(twice).toBe(once);
  });

  test("preserves text content (including escaped ampersand + whitespace)", () => {
    const { doc } = parseOrderedDoc(FIXTURE);
    const rebuilt = buildOrderedDoc(doc);
    expect(rebuilt).toContain("First heading ");
    expect(rebuilt).toContain("Between tables &amp; more");
  });
});

describe("OrderedBody — block mapping + helpers", () => {
  test("toBlocks classifies kinds in order", () => {
    const { bodyChildren } = parseOrderedDoc(FIXTURE);
    const blocks = toBlocks(bodyChildren);
    expect(blocks.map((b) => b.kind)).toEqual([
      "paragraph",
      "table",
      "paragraph",
      "table",
      "paragraph",
      "sectPr",
    ]);
    expect(blocks.map((b) => b.tag)).toEqual([
      "w:p",
      "w:tbl",
      "w:p",
      "w:tbl",
      "w:p",
      "w:sectPr",
    ]);
  });

  test("paragraphText concatenates w:t runs of a paragraph", () => {
    const { bodyChildren } = parseOrderedDoc(FIXTURE);
    const blocks = toBlocks(bodyChildren);
    expect(paragraphText(blocks[0].node)).toBe("First heading ");
    expect(paragraphText(blocks[2].node)).toBe("Between tables & more");
  });

  test("paragraphText returns '' for a non-paragraph node", () => {
    const { bodyChildren } = parseOrderedDoc(FIXTURE);
    const blocks = toBlocks(bodyChildren);
    expect(paragraphText(blocks[1].node)).toBe(""); // a table
  });

  test("paragraphStyleId reads w:pStyle val", () => {
    const { bodyChildren } = parseOrderedDoc(FIXTURE);
    const blocks = toBlocks(bodyChildren);
    expect(paragraphStyleId(blocks[0].node)).toBe("Heading1");
    expect(paragraphStyleId(blocks[2].node)).toBeNull(); // no style
  });

  test("makeParagraphNode builds a valid styled RTL paragraph that round-trips", () => {
    const node = makeParagraphNode("مرحبا", "BodyArabic", true);
    expect(nodeTag(node)).toBe("w:p");
    expect(paragraphText(node)).toBe("مرحبا");
    expect(paragraphStyleId(node)).toBe("BodyArabic");

    // Insert into the body and confirm it serializes + re-parses faithfully.
    const { doc, bodyChildren } = parseOrderedDoc(FIXTURE);
    bodyChildren.splice(0, 0, node);
    const xml = buildOrderedDoc(doc);
    expect(xml).toContain("مرحبا");
    expect(xml).toContain('w:val="BodyArabic"');
    expect(xml).toContain("w:bidi");
    const reblocks = toBlocks(parseOrderedDoc(xml).bodyChildren);
    expect(reblocks[0].kind).toBe("paragraph");
    expect(paragraphText(reblocks[0].node)).toBe("مرحبا");
  });

  test("setParagraphText replaces run text while keeping w:pPr", () => {
    const { bodyChildren } = parseOrderedDoc(FIXTURE);
    const blocks = toBlocks(bodyChildren);
    setParagraphText(blocks[0].node, "Changed heading");
    expect(paragraphText(blocks[0].node)).toBe("Changed heading");
    // style preserved
    expect(paragraphStyleId(blocks[0].node)).toBe("Heading1");
  });
});
