/**
 * Two-section document integration test.
 *
 * Produces a 10-page .docx:
 *   Section 1 (pages 1–5)  — header: "Section 1 — Introduction"
 *                            footer: "Confidential  |  Page X of Y"  (centered)
 *   Section 2 (pages 6–10) — header: "Section 2 — Main Content"
 *                            footer: "Draft v1.0  |  Page X of Y"    (centered)
 *
 * In OOXML, a section boundary is a <w:p> whose <w:pPr> contains a <w:sectPr>.
 * That inline sectPr carries the header/footer references for the section that
 * *ends* at that paragraph.  The main <w:sectPr> at the end of <w:body> defines
 * the last section.
 */

import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import * as XmlUtils from "@/utils/xmlUtils";
import { Mdocxengine, Paragraph, Run } from "@/index";

const INPUT  = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/two-section-document.docx");

let engine: Mdocxengine;

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build a page-number run array: "Page X of Y" */
function pageNumberRuns(prefix: string): any[] {
  return [
    { "w:t": { _: `${prefix}  |  Page `, $: { "xml:space": "preserve" } } },
    { "w:fldChar":   { $: { "w:fldCharType": "begin" } } },
    { "w:instrText": { _: " PAGE \\* ARABIC \\* MERGEFORMAT ", $: { "xml:space": "preserve" } } },
    { "w:fldChar":   { $: { "w:fldCharType": "separate" } } },
    { "w:t":         { _: "1", $: { "xml:space": "preserve" } } },
    { "w:fldChar":   { $: { "w:fldCharType": "end" } } },
    { "w:t": { _: " of ", $: { "xml:space": "preserve" } } },
    { "w:fldChar":   { $: { "w:fldCharType": "begin" } } },
    { "w:instrText": { _: " NUMPAGES \\* ARABIC \\* MERGEFORMAT ", $: { "xml:space": "preserve" } } },
    { "w:fldChar":   { $: { "w:fldCharType": "separate" } } },
    { "w:t":         { _: "10", $: { "xml:space": "preserve" } } },
    { "w:fldChar":   { $: { "w:fldCharType": "end" } } },
  ];
}

/** Build a <w:hdr> XML string with centered text + optional page number field. */
function buildHeaderXml(title: string): string {
  const obj = {
    $: {
      "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    },
    "w:p": {
      "w:pPr": {
        "w:pStyle": { $: { "w:val": "Header" } },
        "w:jc":     { $: { "w:val": "center" } },
      },
      "w:r": { "w:t": { _: title, $: { "xml:space": "preserve" } } },
    },
  };
  return XmlUtils.buildXml(obj, { rootName: "w:hdr", headless: false, pretty: true });
}

/** Build a <w:ftr> XML string with a centered "prefix | Page X of Y" line. */
function buildFooterXml(prefix: string): string {
  const obj = {
    $: {
      "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
      "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    },
    "w:p": {
      "w:pPr": {
        "w:pStyle": { $: { "w:val": "Footer" } },
        "w:jc":     { $: { "w:val": "center" } },
      },
      "w:r": pageNumberRuns(prefix),
    },
  };
  return XmlUtils.buildXml(obj, { rootName: "w:ftr", headless: false, pretty: true });
}

/** Build a content paragraph with optional explicit page break at the end. */
function makeContentPara(text: string, withPageBreak = false): Paragraph {
  const p = new Paragraph({ $: {}, "w:r": [] } as any);
  const run = Run.fromText(text);
  run.setFontSize(24);
  p.addRun(run);
  if (withPageBreak) {
    // Push a raw page-break run directly onto the underlying paragraph array
    (p as any).paragraph["w:r"].push({
      $: {},
      "w:br": { $: { "w:type": "page" } },
    });
  }
  return p;
}

/**
 * Build the inline sectPr paragraph that ends Section 1.
 * This empty paragraph contains a <w:sectPr> referencing Section 1's
 * header/footer and a nextPage break type.
 */
function buildSectionBreakParagraph(
  headerRelId: string,
  footerRelId: string,
): any {
  return {
    $: {},
    "w:pPr": {
      "w:sectPr": {
        $: {
          "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
        },
        "w:headerReference": {
          $: { "w:type": "default", "r:id": headerRelId },
        },
        "w:footerReference": {
          $: { "w:type": "default", "r:id": footerRelId },
        },
        "w:type": { $: { "w:val": "nextPage" } },
      },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Two-section document (10 pages, 2 sections, different headers/footers)", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);
  });

  // ── Step 1: create Section 1 header & footer (NOT registered in main sectPr) ──

  let s1HeaderRelId: string;
  let s1FooterRelId: string;

  test("create Section 1 header and footer files", async () => {
    const s1H = await engine.header.addHeader(
      "Section 1 — Introduction",
      "default",
      buildHeaderXml("Section 1 — Introduction"),
      { registerInSectPr: false },
    );
    s1HeaderRelId = s1H.relId;

    const s1F = await engine.footer.addFooter(
      "Confidential",
      "default",
      buildFooterXml("Confidential"),
      { registerInSectPr: false },
    );
    s1FooterRelId = s1F.relId;

    // Files exist in zip
    expect(engine.zip.readAsText(s1H.headerPath)).toContain("Section 1");
    expect(engine.zip.readAsText(s1F.footerPath)).toContain("Confidential");

    // NOT referenced in main sectPr yet
    const docXml = engine.zip.readAsText("word/document.xml")!;
    expect(docXml).not.toContain(`r:id="${s1HeaderRelId}"`);
  });

  // ── Step 2: create Section 2 header & footer (registered in main sectPr) ────

  test("create Section 2 header and footer, register in main sectPr", async () => {
    await engine.header.addHeader(
      "Section 2 — Main Content",
      "default",
      buildHeaderXml("Section 2 — Main Content"),
    );
    await engine.footer.addFooter(
      "Draft v1.0",
      "default",
      buildFooterXml("Draft v1.0"),
    );

    const docXml = engine.zip.readAsText("word/document.xml")!;
    expect(docXml).toContain("w:headerReference");
    expect(docXml).toContain("w:footerReference");
  });

  // ── Step 3: insert Section 1 content (5 pages) ───────────────────────────────

  test("insert 5 pages of Section 1 content", async () => {
    const s1Paragraphs = [
      { heading: "1.1  Background",        body: "This section introduces the project background, scope, and initial findings from the discovery phase." },
      { heading: "1.2  Objectives",        body: "The primary objectives are to analyse existing workflows, identify bottlenecks, and propose a modernised architecture." },
      { heading: "1.3  Methodology",       body: "A mixed-methods approach combining quantitative data analysis with qualitative stakeholder interviews was adopted." },
      { heading: "1.4  Scope & Exclusions",body: "The scope covers all internal systems. Third-party SaaS integrations are excluded from the current analysis." },
      { heading: "1.5  Summary",           body: "This concludes the introduction. Proceed to Section 2 for detailed findings and recommendations." },
    ];

    for (let i = 0; i < s1Paragraphs.length; i++) {
      const { heading, body } = s1Paragraphs[i];
      const isLast = i === s1Paragraphs.length - 1;

      // Heading paragraph
      const hPara = new Paragraph({ $: {}, "w:r": [] } as any);
      hPara.applyStyle("Heading1");
      hPara.addRun(Run.fromText(heading));
      await engine.document.insertParagraph(hPara);

      // Body paragraph (last one has NO page break — section break handles the page)
      const bPara = makeContentPara(body, !isLast);
      await engine.document.insertParagraph(bPara);
    }

    const paragraphs = await engine.document.getParagraphs();
    expect(paragraphs.length).toBeGreaterThan(10);
  });

  // ── Step 4: insert the section-break paragraph ───────────────────────────────

  test("insert section-break paragraph referencing Section 1 header/footer", async () => {
    // Read the raw document, splice in the section-break paragraph at the end
    // of the current content (before w:sectPr).
    const docXml = engine.zip.readAsText("word/document.xml")!;
    const docObj = await XmlUtils.parseXml(docXml) as any;
    const body   = docObj["w:document"]["w:body"];

    const paragraphs: any[] = body["w:p"]
      ? Array.isArray(body["w:p"]) ? body["w:p"] : [body["w:p"]]
      : [];

    paragraphs.push(buildSectionBreakParagraph(s1HeaderRelId, s1FooterRelId));
    body["w:p"] = paragraphs;

    const newXml = XmlUtils.buildXml(docObj["w:document"], {
      rootName: "w:document",
      headless: false,
      pretty: true,
    });
    engine.zip.addFile("word/document.xml", Buffer.from(newXml, "utf-8"));

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("w:sectPr");
    expect(xml).toContain(`r:id="${s1HeaderRelId}"`);
    expect(xml).toContain(`r:id="${s1FooterRelId}"`);
    expect(xml).toContain('w:val="nextPage"');
  });

  // ── Step 5: insert Section 2 content (5 pages) ───────────────────────────────

  test("insert 5 pages of Section 2 content", async () => {
    const s2Paragraphs = [
      { heading: "2.1  Current State Assessment", body: "The current infrastructure operates on a monolithic architecture with an average deployment cycle of 3 weeks." },
      { heading: "2.2  Gap Analysis",             body: "Key gaps identified: lack of automated testing (68% manual), no CI/CD pipeline, and single-region deployment." },
      { heading: "2.3  Recommended Architecture", body: "We recommend a microservices architecture on Kubernetes with GitOps-based deployment and multi-region active-active redundancy." },
      { heading: "2.4  Implementation Roadmap",   body: "The implementation is structured across three 90-day phases: Foundation, Migration, and Optimisation." },
      { heading: "2.5  Conclusion",               body: "Adopting the recommended architecture will reduce deployment lead time by 85% and achieve 99.99% SLA targets." },
    ];

    for (let i = 0; i < s2Paragraphs.length; i++) {
      const { heading, body } = s2Paragraphs[i];
      const isLast = i === s2Paragraphs.length - 1;

      const hPara = new Paragraph({ $: {}, "w:r": [] } as any);
      hPara.applyStyle("Heading1");
      hPara.addRun(Run.fromText(heading));
      await engine.document.insertParagraph(hPara);

      const bPara = makeContentPara(body, !isLast);
      await engine.document.insertParagraph(bPara);
    }

    const paragraphs = await engine.document.getParagraphs();
    expect(paragraphs.length).toBeGreaterThan(20);
  });

  // ── Structural assertions ────────────────────────────────────────────────────

  test("document XML contains exactly two sectPr blocks", () => {
    const xml = engine.zip.readAsText("word/document.xml")!;
    const matches = xml.match(/<w:sectPr/g) ?? [];
    // One inline (section break) + one main = 2
    expect(matches.length).toBe(2);
  });

  test("Section 1 inline sectPr references Section 1 header and footer", () => {
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain(`r:id="${s1HeaderRelId}"`);
    expect(xml).toContain(`r:id="${s1FooterRelId}"`);
  });

  test("main sectPr references Section 2 header and footer", () => {
    const xml = engine.zip.readAsText("word/document.xml")!;
    // Section 2 header/footer were added via addHeader (registerInSectPr defaults to true)
    expect(xml).toContain("w:headerReference");
    expect(xml).toContain("w:footerReference");
  });

  test("Section 1 header file contains correct title text", () => {
    const headers = engine.header.getAllheadersFiles(engine.zip);
    const s1 = headers.find((h) => engine.zip.readAsText(h.fileName)?.includes("Section 1"));
    expect(s1).toBeDefined();
    expect(engine.zip.readAsText(s1!.fileName)).toContain("Section 1 — Introduction");
  });

  test("Section 2 header file contains correct title text", () => {
    const headers = engine.header.getAllheadersFiles(engine.zip);
    const s2 = headers.find((h) => engine.zip.readAsText(h.fileName)?.includes("Section 2"));
    expect(s2).toBeDefined();
    expect(engine.zip.readAsText(s2!.fileName)).toContain("Section 2 — Main Content");
  });

  test("Section 1 footer contains 'Confidential' and PAGE field", () => {
    const footers = engine.footer.getAllFooterFiles(engine.zip);
    const s1f = footers.find((f) => engine.zip.readAsText(f.fileName)?.includes("Confidential"));
    expect(s1f).toBeDefined();
    const xml = engine.zip.readAsText(s1f!.fileName)!;
    expect(xml).toContain("PAGE");
    expect(xml).toContain("NUMPAGES");
  });

  test("Section 2 footer contains 'Draft v1.0' and PAGE field", () => {
    const footers = engine.footer.getAllFooterFiles(engine.zip);
    const s2f = footers.find((f) => engine.zip.readAsText(f.fileName)?.includes("Draft v1.0"));
    expect(s2f).toBeDefined();
    const xml = engine.zip.readAsText(s2f!.fileName)!;
    expect(xml).toContain("PAGE");
    expect(xml).toContain("NUMPAGES");
  });

  test("document has 4 header/footer files total (2 headers + 2 footers)", () => {
    const headers = engine.header.getAllheadersFiles(engine.zip);
    const footers = engine.footer.getAllFooterFiles(engine.zip);
    // The sample may have pre-existing ones; we added exactly 2 of each
    const newHeaders = headers.filter((h) => {
      const xml = engine.zip.readAsText(h.fileName) ?? "";
      return xml.includes("Section 1") || xml.includes("Section 2");
    });
    const newFooters = footers.filter((f) => {
      const xml = engine.zip.readAsText(f.fileName) ?? "";
      return xml.includes("Confidential") || xml.includes("Draft v1.0");
    });
    expect(newHeaders.length).toBe(2);
    expect(newFooters.length).toBe(2);
  });

  test("section break paragraph has nextPage type", () => {
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:val="nextPage"');
  });

  // ── Save ────────────────────────────────────────────────────────────────────

  test("save to disk", async () => {
    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    expect(fs.statSync(OUTPUT).size).toBeGreaterThan(5000);
    console.log(`\n✓ Output written to: ${OUTPUT}`);
  });
});
