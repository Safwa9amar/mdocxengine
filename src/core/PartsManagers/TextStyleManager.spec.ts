import { describe, test, expect } from "vitest";
import AdmZip from "adm-zip";
import {
  TARGET_SPECS,
  expandTargets,
  matchesTarget,
  applyPropsToRuns,
  stripPropsFromRuns,
  TextStyleManager,
} from "./TextStyleManager";
import type { BlockInfo } from "@/Doc";

const para = (over: Partial<BlockInfo> = {}): BlockInfo => ({
  index: 0,
  kind: "paragraph",
  text: "نص",
  styleId: null,
  headingLevel: 0,
  ...over,
});

describe("expandTargets", () => {
  test("expands 'headings' to all six levels", () => {
    expect(expandTargets(["headings"])).toEqual([
      "heading1", "heading2", "heading3", "heading4", "heading5", "heading6",
    ]);
  });

  test("de-duplicates overlapping requests", () => {
    expect(expandTargets(["headings", "heading1"])).toHaveLength(6);
  });

  test("throws on an unknown target rather than silently ignoring it", () => {
    expect(() => expandTargets(["bodytext"])).toThrow(/unknown target 'bodytext'/i);
  });
});

describe("matchesTarget", () => {
  test("body takes an unstyled paragraph", () => {
    expect(matchesTarget("body", para(), "<w:p/>")).toBe(true);
  });

  test("body rejects headings, captions, lists and titles", () => {
    expect(matchesTarget("body", para({ headingLevel: 2, styleId: "Heading2" }), "<w:p/>")).toBe(false);
    expect(matchesTarget("body", para({ styleId: "Caption" }), "<w:p/>")).toBe(false);
    expect(matchesTarget("body", para({ styleId: "ListParagraph" }), "<w:p/>")).toBe(false);
    expect(matchesTarget("body", para({ styleId: "Title" }), "<w:p/>")).toBe(false);
  });

  test("body rejects a numbered paragraph — it belongs to lists", () => {
    expect(matchesTarget("body", para(), `<w:p><w:pPr><w:numPr/></w:pPr></w:p>`)).toBe(false);
  });

  test("heading3 takes only level 3", () => {
    expect(matchesTarget("heading3", para({ headingLevel: 3 }), "<w:p/>")).toBe(true);
    expect(matchesTarget("heading3", para({ headingLevel: 2 }), "<w:p/>")).toBe(false);
  });

  test("lists takes a numPr paragraph even without the ListParagraph style", () => {
    expect(matchesTarget("lists", para(), `<w:p><w:pPr><w:numPr/></w:pPr></w:p>`)).toBe(true);
  });

  test("tables takes table blocks and nothing else", () => {
    expect(matchesTarget("tables", para({ kind: "table" }), "<w:tbl/>")).toBe(true);
    expect(matchesTarget("tables", para(), "<w:p/>")).toBe(false);
  });
});

describe("TARGET_SPECS", () => {
  test("body and tables share the Normal style", () => {
    expect(TARGET_SPECS.body.styleIds).toEqual(["Normal"]);
    expect(TARGET_SPECS.tables.styleIds).toEqual(["Normal"]);
    expect(TARGET_SPECS.body.ensure?.isDefault).toBe(true);
  });

  test("captions defers to CaptionManager's rich definition, not a bare ensure", () => {
    expect(TARGET_SPECS.captions.richEnsure).toBe("caption");
    expect(TARGET_SPECS.captions.ensure).toBeUndefined();
  });
});

describe("stripPropsFromRuns", () => {
  test("removes only the named property, leaving rtl and highlight intact", () => {
    const xml =
      `<w:p><w:r><w:rPr><w:rFonts w:cs="Traditional Arabic"/><w:sz w:val="28"/>` +
      `<w:rtl/><w:highlight w:val="yellow"/></w:rPr><w:t>نص</w:t></w:r></w:p>`;
    const { xml: out, stripped } = stripPropsFromRuns(xml, { font: "X" });
    expect(stripped).toBe(1);
    expect(out).not.toContain("Traditional Arabic");
    expect(out).toContain(`<w:sz w:val="28"/>`);
    expect(out).toContain(`<w:rtl/>`);
    expect(out).toContain(`<w:highlight w:val="yellow"/>`);
  });

  test("removes an emptied rPr entirely", () => {
    const xml = `<w:p><w:r><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>x</w:t></w:r></w:p>`;
    const { xml: out } = stripPropsFromRuns(xml, { sizePt: 16 });
    expect(out).toBe(`<w:p><w:r><w:t>x</w:t></w:r></w:p>`);
  });

  test("ignores rPr inside pPr — paragraph mark properties are not runs", () => {
    const xml = `<w:p><w:pPr><w:rPr><w:sz w:val="28"/></w:rPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>`;
    const { xml: out, stripped } = stripPropsFromRuns(xml, { sizePt: 16 });
    expect(stripped).toBe(0);
    expect(out).toBe(xml);
  });

  test("counts nothing and changes nothing when no run carries the property", () => {
    const xml = `<w:p><w:r><w:t>x</w:t></w:r></w:p>`;
    expect(stripPropsFromRuns(xml, { font: "X" })).toEqual({ xml, stripped: 0 });
  });
});

describe("applyPropsToRuns", () => {
  test("writes the property onto every run, creating rPr where absent", () => {
    const xml = `<w:p><w:r><w:t>x</w:t></w:r><w:r><w:rPr><w:rtl/></w:rPr><w:t>y</w:t></w:r></w:p>`;
    const { xml: out, written, skipped } = applyPropsToRuns(xml, { sizePt: 16 });
    expect(written).toBe(2);
    expect(skipped).toBe(0);
    expect(out).toBe(
      `<w:p><w:r><w:rPr><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>x</w:t></w:r>` +
        `<w:r><w:rPr><w:sz w:val="32"/><w:szCs w:val="32"/><w:rtl/></w:rPr><w:t>y</w:t></w:r></w:p>`,
    );
  });

  test("does not touch runs inside pPr", () => {
    const xml = `<w:p><w:pPr><w:rPr><w:rtl/></w:rPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>`;
    const { written } = applyPropsToRuns(xml, { bold: true });
    expect(written).toBe(1);
  });

  test("a malformed run is skipped and counted, and never aborts the pass", () => {
    // The first run's rPr is malformed (stray close) and makes mergeRunProps throw;
    // the second is fine and must still be written.
    const xml =
      `<w:p><w:r><w:rPr><w:b/></w:bCs></w:rPr><w:t>bad</w:t></w:r>` +
      `<w:r><w:t>good</w:t></w:r></w:p>`;
    const { xml: out, written, skipped } = applyPropsToRuns(xml, { sizePt: 16 });
    expect(skipped).toBe(1);
    expect(written).toBe(1);
    expect(out).toContain(`<w:rPr><w:b/></w:bCs></w:rPr>`); // bad run untouched
    expect(out).toContain(`<w:sz w:val="32"/>`);            // good run written
  });
});

// ─── TextStyleManager.apply() — the style-patch gate ───────────────────────
//
// A paragraph must only be STRIPPED when Phase 2 actually created or updated
// its style. Style-id membership alone is not enough: `headingN`/`title`/
// `lists`/`footnotes` carry no `ensure`, so a paragraph can be styled
// "Heading3" while `styles.xml` defines no such style at all — the seed
// `thesis-base.docx` itself has styles declaring `basedOn="Normal"` /
// `basedOn="DefaultParagraphFont"` while defining neither, so a dangling
// `w:pStyle` reference is the NORMAL state in this corpus, not an edge case.
// Stripping a run's own formatting with nothing patched to replace it would
// silently strand that paragraph with no formatting at all.

const HEADING3_PARAGRAPH =
  `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr>` +
  `<w:r><w:rPr><w:sz w:val="40"/><w:szCs w:val="40"/></w:rPr><w:t>Chapter</w:t></w:r></w:p>`;

const HEADING3_DOC_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:body>${HEADING3_PARAGRAPH}<w:sectPr/></w:body></w:document>`;

const STYLES_XML_NO_HEADING3 =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
  `</w:styles>`;

const STYLES_XML_WITH_HEADING3 =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>` +
  `<w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/>` +
  `<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/></w:style>` +
  `</w:styles>`;

const HEADING3_BLOCK_INFOS: BlockInfo[] = [
  { index: 0, kind: "paragraph", text: "Chapter", styleId: "Heading3", headingLevel: 3 },
];

function makeHeading3Zip(stylesXml: string | null): AdmZip {
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(HEADING3_DOC_XML, "utf-8"));
  if (stylesXml) zip.addFile("word/styles.xml", Buffer.from(stylesXml, "utf-8"));
  return zip;
}

describe("TextStyleManager.apply() — style-patch gate", () => {
  test("dangling style reference (no Heading3 defined): direct-writes the run instead of stripping it bare", async () => {
    const zip = makeHeading3Zip(STYLES_XML_NO_HEADING3);
    const tsm = new TextStyleManager(zip);

    const reports = await tsm.apply(["heading3"], { sizePt: 16 }, HEADING3_BLOCK_INFOS);
    const report = reports.find((r) => r.target === "heading3")!;

    // Phase 2 could not touch a style that doesn't exist (no `ensure` for headingN).
    expect(report.styleCreated).toBe(false);
    expect(report.styleTouched).toBe(false);
    // So the run keeps — and gets — its OWN formatting rather than being
    // stripped bare with nothing left to supply a replacement.
    expect(report.runsStripped).toBe(0);
    expect(report.directWrites).toBe(1);

    const docXml = zip.readAsText("word/document.xml")!;
    expect(docXml).toContain(`<w:sz w:val="32"/>`); // 16pt written directly onto the run
    expect(docXml).toContain(`<w:t>Chapter</w:t>`); // text untouched
  });

  test("Heading3 defined: strips the run's own size so the newly patched style shows through", async () => {
    const zip = makeHeading3Zip(STYLES_XML_WITH_HEADING3);
    const tsm = new TextStyleManager(zip);

    const reports = await tsm.apply(["heading3"], { sizePt: 16 }, HEADING3_BLOCK_INFOS);
    const report = reports.find((r) => r.target === "heading3")!;

    expect(report.styleCreated).toBe(false); // it already existed
    expect(report.styleTouched).toBe(true);  // but its rPr was patched
    expect(report.runsStripped).toBe(1);
    expect(report.directWrites).toBe(0);

    const docXml = zip.readAsText("word/document.xml")!;
    // The run's own size is gone entirely — neither the old value nor a
    // directly written new one — so the cascade falls through to the style.
    expect(docXml).not.toContain(`<w:sz w:val="40"/>`);
    expect(docXml).not.toContain(`<w:sz w:val="32"/>`);
    expect(docXml).toContain(`<w:t>Chapter</w:t>`);

    const stylesXml = zip.readAsText("word/styles.xml")!;
    expect(stylesXml).toContain(`w:styleId="Heading3"`);
    expect(stylesXml).toContain(`<w:sz w:val="32"/>`); // 16pt now lives on the style
  });
});
