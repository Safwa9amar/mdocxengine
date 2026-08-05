import { describe, test, expect } from "vitest";
import {
  upsertSectPrReference,
  upsertSectPrPageNumbering,
  upsertParagraphSectPr,
  removeParagraphSectPr,
  editBodySectPr,
  removeSectPrReferenceFromDocument,
} from "./sectPr";

describe("upsertSectPrPageNumbering", () => {
  test("inserts pgNumType AFTER pgSz/pgMar and BEFORE cols (CT_SectPr order)", () => {
    const start = '<w:sectPr><w:pgSz w:w="11906"/><w:pgMar w:top="1440"/><w:cols w:space="708"/></w:sectPr>';
    const out = upsertSectPrPageNumbering(start, { format: "lowerRoman", start: 1 });
    expect(out).toBe(
      '<w:sectPr><w:pgSz w:w="11906"/><w:pgMar w:top="1440"/>' +
        '<w:pgNumType w:fmt="lowerRoman" w:start="1"/>' +
        '<w:cols w:space="708"/></w:sectPr>',
    );
  });

  test("appends when no later-ordered sibling is present", () => {
    const out = upsertSectPrPageNumbering('<w:sectPr><w:pgSz w:w="1"/></w:sectPr>', { format: "decimal" });
    expect(out).toBe('<w:sectPr><w:pgSz w:w="1"/><w:pgNumType w:fmt="decimal"/></w:sectPr>');
  });

  test("replaces an existing pgNumType rather than duplicating it", () => {
    const start = '<w:sectPr><w:pgSz/><w:pgNumType w:fmt="lowerRoman" w:start="3"/><w:cols/></w:sectPr>';
    const out = upsertSectPrPageNumbering(start, { format: "decimal", start: 1 });
    expect((out.match(/w:pgNumType/g) ?? []).length).toBe(1);
    expect(out).toContain('<w:pgNumType w:fmt="decimal" w:start="1"/>');
    expect(out.indexOf("w:pgNumType")).toBeLessThan(out.indexOf("w:cols"));
  });

  test("omitting start leaves the section continuing the previous sequence", () => {
    const out = upsertSectPrPageNumbering("<w:sectPr><w:cols/></w:sectPr>", { format: "decimal" });
    expect(out).toBe('<w:sectPr><w:pgNumType w:fmt="decimal"/><w:cols/></w:sectPr>');
    expect(out).not.toContain("w:start");
  });

  test("expands a self-closing sectPr, and no-ops with nothing to set", () => {
    expect(upsertSectPrPageNumbering("<w:sectPr/>", { start: 5 })).toBe(
      '<w:sectPr><w:pgNumType w:start="5"/></w:sectPr>',
    );
    expect(upsertSectPrPageNumbering("<w:sectPr/>", {})).toBe("<w:sectPr/>");
  });
});

describe("sectPr string helpers", () => {
  test("upsertSectPrReference inserts a header ref at the start of the sectPr", () => {
    const out = upsertSectPrReference("<w:sectPr><w:pgSz w:w=\"100\"/></w:sectPr>", "header", "default", "rId9");
    expect(out).toBe('<w:sectPr><w:headerReference w:type="default" r:id="rId9"/><w:pgSz w:w="100"/></w:sectPr>');
  });

  test("upsertSectPrReference replaces an existing ref of the same type", () => {
    const start = '<w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:pgSz/></w:sectPr>';
    const out = upsertSectPrReference(start, "header", "default", "rId2");
    expect(out).toContain('r:id="rId2"');
    expect(out).not.toContain('r:id="rId1"');
    expect((out.match(/w:headerReference/g) ?? []).length).toBe(1);
  });

  test("upsertSectPrReference expands a self-closing sectPr", () => {
    const out = upsertSectPrReference("<w:sectPr/>", "footer", "default", "rId5");
    expect(out).toBe('<w:sectPr><w:footerReference w:type="default" r:id="rId5"/></w:sectPr>');
  });

  test("upsertParagraphSectPr adds a pPr+sectPr to a bare paragraph", () => {
    const out = upsertParagraphSectPr("<w:p><w:r><w:t>x</w:t></w:r></w:p>", "<w:sectPr><w:type w:val=\"nextPage\"/></w:sectPr>");
    expect(out).toBe('<w:p><w:pPr><w:sectPr><w:type w:val="nextPage"/></w:sectPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>');
  });

  test("upsertParagraphSectPr appends sectPr inside an existing pPr (after other props)", () => {
    const out = upsertParagraphSectPr('<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r/></w:p>', "<w:sectPr/>");
    expect(out).toBe('<w:p><w:pPr><w:jc w:val="center"/><w:sectPr/></w:pPr><w:r/></w:p>');
  });

  test("removeParagraphSectPr strips the sectPr only", () => {
    const out = removeParagraphSectPr('<w:p><w:pPr><w:jc w:val="left"/><w:sectPr><w:type w:val="nextPage"/></w:sectPr></w:pPr></w:p>');
    expect(out).toBe('<w:p><w:pPr><w:jc w:val="left"/></w:pPr></w:p>');
  });

  test("editBodySectPr targets the body sectPr and leaves tables before it untouched", () => {
    const doc = '<w:document><w:body><w:p/><w:tbl><w:tr/></w:tbl><w:sectPr><w:pgSz/></w:sectPr></w:body></w:document>';
    const out = editBodySectPr(doc, (s) => upsertSectPrReference(s, "header", "default", "rIdH"));
    expect(out.indexOf("<w:tbl>")).toBeLessThan(out.indexOf("<w:sectPr>"));
    expect(out).toContain('<w:headerReference w:type="default" r:id="rIdH"/>');
  });

  test("removeSectPrReferenceFromDocument deletes only the matching ref tag", () => {
    const doc = '<w:document><w:body><w:sectPr><w:headerReference w:type="default" r:id="rId1"/><w:footerReference w:type="default" r:id="rId2"/></w:sectPr></w:body></w:document>';
    const out = removeSectPrReferenceFromDocument(doc, "header", "rId1");
    expect(out).not.toContain('r:id="rId1"');
    expect(out).toContain('r:id="rId2"'); // footer ref untouched
  });
});
