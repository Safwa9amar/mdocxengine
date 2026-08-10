import { describe, test, expect } from "vitest";
import AdmZip from "adm-zip";
import { Doc } from "./Doc";
import { Mdocxengine } from "./index";

// A document that exercises every rung of the cascade at once: docDefaults
// supplies the Latin font, `Normal` the size and the Arabic font, `Heading1` its
// own size/bold on top of `Normal`, and two body runs carry direct `w:cs`
// overrides in an 8:2 character split (the shares below are that split).
const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
  `<w:p><w:r><w:rPr><w:rFonts w:cs="Traditional Arabic"/></w:rPr><w:t>aaaaaaaa</w:t></w:r></w:p>` +
  `<w:p><w:r><w:rPr><w:rFonts w:cs="Andalus"/></w:rPr><w:t>bb</w:t></w:r></w:p>` +
  `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Chapter</w:t></w:r></w:p>` +
  `<w:tbl><w:tr><w:tc><w:p><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl>` +
  `</w:body></w:document>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:cs="Simplified Arabic"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:bCs/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr></w:style>` +
  `</w:styles>`;

async function makeDoc(document = DOCUMENT_XML, styles = STYLES_XML, footnotes?: string): Promise<Doc> {
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(document, "utf-8"));
  zip.addFile("word/styles.xml", Buffer.from(styles, "utf-8"));
  if (footnotes) zip.addFile("word/footnotes.xml", Buffer.from(footnotes, "utf-8"));
  return Doc.from(await Mdocxengine.loadFromBuffer(zip.toBuffer()));
}

const targetOf = (inspection: { targets: Array<{ target: string }> }, name: string) =>
  inspection.targets.find((t) => t.target === name) as any;

describe("Doc.getTextStyle", () => {
  test("reports the dominant Arabic font by character share, with the runner-up", async () => {
    const body = targetOf(await (await makeDoc()).getTextStyle(["body"]), "body");

    expect(body.paragraphs).toBe(2);
    expect(body.characters).toBe(10);
    expect(body.effective.fontCs).toEqual({
      value: "Traditional Arabic",
      share: 0.8,
      others: [{ value: "Andalus", share: 0.2 }],
    });
    expect(body.mixed).toBe(true);
  });

  test("falls back through the cascade: docDefaults for Latin, Normal for size", async () => {
    const body = targetOf(await (await makeDoc()).getTextStyle(["body"]), "body");

    // Nothing on the runs and nothing on Normal names a Latin font — docDefaults does.
    expect(body.effective.font).toMatchObject({ value: "Calibri", share: 1 });
    // Normal's w:sz=28 beats docDefaults' w:sz=22, and no run overrides it.
    expect(body.effective.sizePt).toMatchObject({ value: 14, share: 1 });
    expect(body.effective.sizeCsPt).toMatchObject({ value: 14, share: 1 });
    expect(body.effective.bold).toMatchObject({ value: null, share: 1 });
  });

  test("walks w:basedOn so a heading inherits Normal's font and overrides its size", async () => {
    const h1 = targetOf(await (await makeDoc()).getTextStyle(["heading1"]), "heading1");

    expect(h1.styleDefined).toBe(true);
    expect(h1.styleChain).toEqual(["Heading1", "Normal"]);
    expect(h1.effective.fontCs).toMatchObject({ value: "Simplified Arabic" }); // inherited
    expect(h1.effective.sizePt).toMatchObject({ value: 18 }); // Heading1's own w:sz=36
    expect(h1.effective.bold).toMatchObject({ value: true });
    expect(h1.mixed).toBe(false);
  });

  test("reads table-cell paragraphs, whose direct run size beats the style", async () => {
    const tables = targetOf(await (await makeDoc()).getTextStyle(["tables"]), "tables");

    expect(tables.paragraphs).toBe(1);
    expect(tables.effective.sizePt).toMatchObject({ value: 10, share: 1 });
  });

  test("an absent part reports zero paragraphs rather than failing", async () => {
    const inspection = await (await makeDoc()).getTextStyle(["captions", "heading4"]);

    expect(targetOf(inspection, "captions")).toMatchObject({ paragraphs: 0, characters: 0 });
    expect(targetOf(inspection, "heading4").effective.font).toEqual({ value: null, share: 0 });
  });

  test("exposes docDefaults separately as the document-wide fallback", async () => {
    const { documentDefaults } = await (await makeDoc()).getTextStyle(["body"]);
    expect(documentDefaults).toMatchObject({ font: "Calibri", sizePt: 11 });
  });

  test('an explicit <w:b w:val="0"/> overrides the style bold, not the other way round', async () => {
    const doc = await makeDoc(
      `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:rPr><w:b w:val="0"/><w:bCs w:val="0"/></w:rPr><w:t>flat</w:t></w:r></w:p>` +
        `</w:body></w:document>`,
    );

    const h1 = targetOf(await doc.getTextStyle(["heading1"]), "heading1");
    expect(h1.styleProps.bold).toBe(true); // the style says bold…
    expect(h1.effective.bold).toMatchObject({ value: false, share: 1 }); // …the run says no
  });

  test("a dangling w:pStyle truncates the chain instead of throwing", async () => {
    const doc = await makeDoc(
      `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
        `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>orphan</w:t></w:r></w:p>` +
        `</w:body></w:document>`,
    );

    const h3 = targetOf(await doc.getTextStyle(["heading3"]), "heading3");
    expect(h3).toMatchObject({ styleDefined: false, styleChain: ["Heading3"], paragraphs: 1 });
    // docDefaults still shows through — that IS what Word renders.
    expect(h3.effective.font).toMatchObject({ value: "Calibri" });
  });

  test("footnotes read from word/footnotes.xml, skipping the separators", async () => {
    const doc = await makeDoc(
      DOCUMENT_XML,
      STYLES_XML,
      `<?xml version="1.0" encoding="UTF-8"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
        `<w:footnote w:id="1"><w:p><w:r><w:rPr><w:sz w:val="18"/></w:rPr><w:t>note</w:t></w:r></w:p></w:footnote>` +
        `</w:footnotes>`,
    );

    const fn = targetOf(await doc.getTextStyle(["footnotes"]), "footnotes");
    expect(fn.paragraphs).toBe(1); // the separator footnote is not counted
    expect(fn.effective.sizePt).toMatchObject({ value: 9, share: 1 });
  });

  test("no footnotes part at all is an absent target, not an error", async () => {
    const fn = targetOf(await (await makeDoc()).getTextStyle(["footnotes"]), "footnotes");
    expect(fn).toMatchObject({ paragraphs: 0, characters: 0, styleId: "FootnoteText" });
  });

  test("rejects an unknown target, exactly as setTextStyle does", async () => {
    const doc = await makeDoc();
    await expect(doc.getTextStyle(["footer" as never])).rejects.toThrow(/unknown target 'footer'/i);
  });
});
