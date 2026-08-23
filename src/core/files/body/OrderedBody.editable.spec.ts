import { describe, expect, it } from "vitest";
import { splitDocument, isEditableBlock } from "./OrderedBody";

const XML = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>` +
  `<w:p><w:r><w:t>one</w:t></w:r></w:p>` +
  `\n  ` +
  `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>` +
  `<w:sectPr><w:pgSz w:w="11906"/></w:sectPr>` +
  `</w:body></w:document>`;

describe("isEditableBlock", () => {
  it("keeps paragraphs and tables, drops sectPr and whitespace text nodes", () => {
    const editable = splitDocument(XML).blocks.filter(isEditableBlock);
    expect(editable.map((b) => b.kind)).toEqual(["paragraph", "table"]);
  });
});
