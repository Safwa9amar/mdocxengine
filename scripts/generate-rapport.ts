/**
 * generate-rapport.ts
 *
 * Generates a professional 10-page report using ALL features of mdocxengine.
 *
 * Features demonstrated:
 *   - PageLayoutManager: A4, margins, orientation, columns, line numbering, page breaks
 *   - StylesManager: custom heading + body styles
 *   - HeaderManager: header with page numbers, different first page
 *   - FooterManager: footer with company info + page numbers
 *   - DocumentManager: paragraph CRUD, table insertion, findAndReplaceAll
 *   - Paragraph: appendText, modifyText, setAlignment, applyStyle, clone, mergeWith, splitAt,
 *                addHyperlink, getRuns, addRun, removeRun, getWordCount, detectLanguage
 *   - Run: setBold, setItalic, setUnderline, setFontSize, setFontFamily, setColor, setShading
 *   - Table: full design + layout API (borders, shading, merge, sort, header row, alt text)
 *   - NumberingManager: bullet and numbered lists
 *   - FootnoteManager: footnotes with inline references
 *   - EndnoteManager: endnotes with inline references
 *   - TableOfContentsManager: TOC with hyperlinks
 *   - CrossReferenceManager: bookmarks + cross-references
 *   - CitationManager: citation sources + inline citations + bibliography
 *   - CaptionManager: figure and table captions + list of figures
 *   - CommentsManager: review comments on paragraphs
 *   - TrackedChangesManager: read revisions (demonstrated via comment)
 *   - SectionManager: section breaks + per-section layout
 *   - ShapeManager: text boxes, shapes, lines
 *   - MetadataManager: core + app properties
 *   - MediaManager: list images (demonstrated)
 *   - ContentTypesManager / RelManager / RootRelManager: used internally by all managers
 *
 * Usage:
 *   npx tsx scripts/generate-rapport.ts
 */

import path from "path";
import { Mdocxengine } from "../src/index";
import Paragraph from "../src/core/files/paragraph/index";
import { Run } from "../src/core/files/paragraph/Run";
import { Table } from "../src/core/files/table/index";

const INPUT  = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/rapport-all-features.docx");

// ─── Helper: create a paragraph with styled text ──────────────────────────────

function makeParagraph(
  text: string,
  opts: {
    style?: string;
    alignment?: "left" | "center" | "right" | "both";
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
  } = {},
): Paragraph {
  const p = new Paragraph({ $: {}, "w:pPr": {}, "w:r": [] });
  if (opts.style) p.applyStyle(opts.style);
  if (opts.alignment) p.setAlignment(opts.alignment);
  const run = Run.fromText(text);
  if (opts.bold) run.setBold();
  if (opts.italic) run.setItalic();
  if (opts.fontSize) run.setFontSize(opts.fontSize);
  if (opts.fontFamily) run.setFontFamily(opts.fontFamily);
  if (opts.color) run.setColor(opts.color);
  p.addRun(run);
  return p;
}

function makeEmptyParagraph(): Paragraph {
  return new Paragraph({ $: {}, "w:pPr": {}, "w:r": [] });
}

function makeTable(headers: string[], rows: string[][]): Table {
  const colCount = headers.length;
  const tableObj: any = {
    "w:tblPr": {},
    "w:tr": [
      {
        "w:tc": headers.map((h) => ({
          "w:p": { "w:r": { "w:t": h } },
        })),
      },
      ...rows.map((row) => ({
        "w:tc": row.map((cell) => ({
          "w:p": { "w:r": { "w:t": cell } },
        })),
      })),
    ],
  };
  return new Table(tableObj);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Loading base document...");
  const engine = await Mdocxengine.loadFromFile(INPUT);

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. METADATA — Set document properties
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("1. Setting metadata...");
  await engine.metadata.setCoreProperties({
    title: "Annual Technology Report 2026",
    subject: "Comprehensive Analysis of Emerging Technologies",
    creator: "mdocxengine Generator",
    description: "A 10-page report generated programmatically using mdocxengine, showcasing all features.",
    lastModifiedBy: "mdocxengine",
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  });
  await engine.metadata.setAppProperties({
    application: "mdocxengine v1.0",
    pages: 10,
    words: 5000,
    characters: 30000,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PAGE LAYOUT — A4, normal margins
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("2. Setting page layout...");
  await engine.pageLayout.setPageSizePreset("A4", "portrait");
  await engine.pageLayout.setMarginPreset("normal");

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. STYLES — Add custom styles
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("3. Adding custom styles...");

  // Title style
  await engine.styles.addStyle({
    $: { "w:type": "paragraph", "w:styleId": "ReportTitle" },
    "w:name": { $: { "w:val": "Report Title" } },
    "w:basedOn": { $: { "w:val": "Normal" } },
    "w:next": { $: { "w:val": "Normal" } },
    "w:qFormat": {},
    "w:pPr": {
      "w:jc": { $: { "w:val": "center" } },
      "w:spacing": { $: { "w:before": "480", "w:after": "240" } },
    },
    "w:rPr": {
      "w:b": {},
      "w:color": { $: { "w:val": "1F3864" } },
      "w:sz": { $: { "w:val": "56" } },
      "w:szCs": { $: { "w:val": "56" } },
      "w:rFonts": { $: { "w:ascii": "Calibri", "w:hAnsi": "Calibri" } },
    },
  });

  // Subtitle style
  await engine.styles.addStyle({
    $: { "w:type": "paragraph", "w:styleId": "ReportSubtitle" },
    "w:name": { $: { "w:val": "Report Subtitle" } },
    "w:basedOn": { $: { "w:val": "Normal" } },
    "w:pPr": {
      "w:jc": { $: { "w:val": "center" } },
      "w:spacing": { $: { "w:before": "120", "w:after": "480" } },
    },
    "w:rPr": {
      "w:i": {},
      "w:color": { $: { "w:val": "404040" } },
      "w:sz": { $: { "w:val": "28" } },
      "w:szCs": { $: { "w:val": "28" } },
    },
  });

  // Heading 1 style
  await engine.styles.addStyle({
    $: { "w:type": "paragraph", "w:styleId": "Heading1" },
    "w:name": { $: { "w:val": "heading 1" } },
    "w:basedOn": { $: { "w:val": "Normal" } },
    "w:next": { $: { "w:val": "Normal" } },
    "w:qFormat": {},
    "w:pPr": {
      "w:keepNext": {},
      "w:spacing": { $: { "w:before": "360", "w:after": "120" } },
      "w:outlineLvl": { $: { "w:val": "0" } },
    },
    "w:rPr": {
      "w:b": {},
      "w:color": { $: { "w:val": "1F3864" } },
      "w:sz": { $: { "w:val": "36" } },
      "w:szCs": { $: { "w:val": "36" } },
      "w:rFonts": { $: { "w:ascii": "Calibri", "w:hAnsi": "Calibri" } },
    },
  });

  // Heading 2 style
  await engine.styles.addStyle({
    $: { "w:type": "paragraph", "w:styleId": "Heading2" },
    "w:name": { $: { "w:val": "heading 2" } },
    "w:basedOn": { $: { "w:val": "Normal" } },
    "w:next": { $: { "w:val": "Normal" } },
    "w:qFormat": {},
    "w:pPr": {
      "w:keepNext": {},
      "w:spacing": { $: { "w:before": "240", "w:after": "80" } },
      "w:outlineLvl": { $: { "w:val": "1" } },
    },
    "w:rPr": {
      "w:b": {},
      "w:color": { $: { "w:val": "2E75B6" } },
      "w:sz": { $: { "w:val": "28" } },
      "w:szCs": { $: { "w:val": "28" } },
      "w:rFonts": { $: { "w:ascii": "Calibri", "w:hAnsi": "Calibri" } },
    },
  });

  // Heading 3 style
  await engine.styles.addStyle({
    $: { "w:type": "paragraph", "w:styleId": "Heading3" },
    "w:name": { $: { "w:val": "heading 3" } },
    "w:basedOn": { $: { "w:val": "Normal" } },
    "w:next": { $: { "w:val": "Normal" } },
    "w:qFormat": {},
    "w:pPr": {
      "w:keepNext": {},
      "w:spacing": { $: { "w:before": "200", "w:after": "60" } },
      "w:outlineLvl": { $: { "w:val": "2" } },
    },
    "w:rPr": {
      "w:b": {},
      "w:i": {},
      "w:color": { $: { "w:val": "404040" } },
      "w:sz": { $: { "w:val": "24" } },
      "w:szCs": { $: { "w:val": "24" } },
    },
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. CLEAR EXISTING CONTENT & BUILD REPORT
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("4. Building document content...");

  const allParagraphs: Paragraph[] = [];
  let paraIndex = 0;

  // ─── COVER PAGE (Page 1) ──────────────────────────────────────────────────

  // Empty spacers for vertical centering
  for (let i = 0; i < 8; i++) allParagraphs.push(makeEmptyParagraph());

  // Title
  allParagraphs.push(makeParagraph("Annual Technology Report", {
    style: "ReportTitle",
    alignment: "center",
  }));

  // Year
  const yearPara = makeParagraph("2026 Edition", {
    alignment: "center",
    fontSize: 40,
    color: "2E75B6",
  });
  allParagraphs.push(yearPara);

  allParagraphs.push(makeEmptyParagraph());

  // Subtitle
  allParagraphs.push(makeParagraph(
    "Comprehensive Analysis of Emerging Technologies in Artificial Intelligence, Cloud Computing, Cybersecurity, and Quantum Computing",
    { style: "ReportSubtitle", alignment: "center" },
  ));

  allParagraphs.push(makeEmptyParagraph());
  allParagraphs.push(makeEmptyParagraph());

  // Author info with multiple runs
  const authorPara = new Paragraph({ $: {}, "w:pPr": {}, "w:r": [] });
  authorPara.setAlignment("center");
  const authorRun = Run.fromText("Prepared by: ");
  authorRun.setFontSize(22);
  authorRun.setColor("666666");
  authorPara.addRun(authorRun);
  const nameRun = Run.fromText("Technology Research Division");
  nameRun.setFontSize(22);
  nameRun.setBold();
  nameRun.setColor("1F3864");
  authorPara.addRun(nameRun);
  allParagraphs.push(authorPara);

  // Date
  allParagraphs.push(makeParagraph(`Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, {
    alignment: "center",
    fontSize: 20,
    color: "808080",
  }));

  // Confidential notice with highlighting
  allParagraphs.push(makeEmptyParagraph());
  const confidentialPara = new Paragraph({ $: {}, "w:pPr": {}, "w:r": [] });
  confidentialPara.setAlignment("center");
  const confRun = Run.fromText("CONFIDENTIAL");
  confRun.setBold();
  confRun.setFontSize(20);
  confRun.setColor("FF0000");
  confRun.setShading("FFEEEE");
  confidentialPara.addRun(confRun);
  allParagraphs.push(confidentialPara);

  // Save the cover page content
  await engine.document.saveChanges(allParagraphs);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. SECTION BREAK after cover page (Page 2 starts)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("5. Adding section breaks...");
  await engine.pageLayout.insertBreak("nextPage", allParagraphs.length - 1);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. HEADER & FOOTER
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("6. Adding header and footer...");

  // Header
  const { headerPath } = await engine.header.addHeader("Annual Technology Report 2026", "default");
  await engine.header.insertPageNumber(headerPath, {
    alignment: "right",
    format: "decimal",
    includeTotalPages: true,
    prefix: "Page ",
  });
  await engine.header.setDifferentFirstPage(true);
  await engine.header.setHeaderDistance(720);

  // Footer
  const { footerPath } = await engine.footer.addFooter(
    "Technology Research Division | Confidential",
    "default",
  );
  await engine.footer.insertPageNumber(footerPath, {
    alignment: "center",
    format: "decimal",
    includeTotalPages: false,
  });
  await engine.footer.setFooterDistance(720);

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. TABLE OF CONTENTS (Page 2)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("7. Adding Table of Contents...");

  // We'll re-read paragraphs and insert TOC + body after section break
  await engine.toc.insertTOC({
    headingDepth: 3,
    title: "Table of Contents",
    includePageNumbers: true,
    useHyperlinks: true,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. BODY CONTENT — CHAPTER 1: Executive Summary (Pages 3-4)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("8. Building chapter content...");

  // We need to re-read and append after the TOC
  let paragraphs = await engine.document.getParagraphs();
  let insertIdx = paragraphs.length;

  // --- Chapter 1: Executive Summary ---
  const ch1Title = makeParagraph("1. Executive Summary", { style: "Heading1" });
  await engine.document.insertParagraph(ch1Title, insertIdx++);

  const execSummary = makeParagraph(
    "This report presents a comprehensive analysis of the most significant technological developments of 2026. " +
    "The rapid advancement of artificial intelligence, the maturation of cloud computing infrastructure, " +
    "emerging cybersecurity threats, and the early commercialization of quantum computing represent the four " +
    "pillars of technological transformation examined in this document. Our research team has conducted " +
    "extensive analysis across 150 organizations, spanning 12 industries and 8 geographic regions.",
    { alignment: "both", fontSize: 22, fontFamily: "Calibri" },
  );
  await engine.document.insertParagraph(execSummary, insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // Key findings with bold + italic runs
  const keyFindingsPara = new Paragraph({ $: {}, "w:pPr": {}, "w:r": [] });
  const kfLabel = Run.fromText("Key Finding: ");
  kfLabel.setBold();
  kfLabel.setColor("1F3864");
  kfLabel.setFontSize(22);
  keyFindingsPara.addRun(kfLabel);
  const kfText = Run.fromText(
    "Organizations that adopted AI-driven automation experienced a 47% increase in operational efficiency, " +
    "while those investing in quantum-resistant cryptography reduced their vulnerability exposure by 63%.",
  );
  kfText.setItalic();
  kfText.setFontSize(22);
  keyFindingsPara.addRun(kfText);
  keyFindingsPara.setAlignment("both");
  await engine.document.insertParagraph(keyFindingsPara, insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // Underlined run demonstration
  const methodPara = new Paragraph({ $: {}, "w:pPr": {}, "w:r": [] });
  methodPara.setAlignment("both");
  const methodLabel = Run.fromText("Methodology: ");
  methodLabel.setBold();
  methodLabel.setUnderline(true, "single");
  methodLabel.setFontSize(22);
  methodPara.addRun(methodLabel);
  const methodText = Run.fromText(
    "Data was collected through structured interviews, quantitative surveys, and analysis of publicly available " +
    "financial and performance data. The study period covers January 2025 through December 2025, with projections " +
    "extending through 2028.",
  );
  methodText.setFontSize(22);
  methodPara.addRun(methodText);
  await engine.document.insertParagraph(methodPara, insertIdx++);

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. FOOTNOTES — add footnotes to summary paragraphs
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("9. Adding footnotes and endnotes...");

  const { id: fn1Id, run: fn1Run } = await engine.footnotes.addFootnote(
    "Based on data collected from 150 enterprise organizations across 12 industry sectors.",
  );
  const { id: fn2Id, run: fn2Run } = await engine.footnotes.addFootnote(
    "Vulnerability exposure measured using the CVSS 3.1 scoring framework.",
  );

  // Add endnotes
  const { id: en1Id, run: en1Run } = await engine.endnotes.addEndnote(
    "For a detailed breakdown of regional data, see Appendix A of the supplementary materials.",
  );

  // ─── CHAPTER 2: Artificial Intelligence (Pages 4-5) ───────────────────────

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  const ch2Title = makeParagraph("2. Artificial Intelligence", { style: "Heading1" });
  await engine.document.insertParagraph(ch2Title, insertIdx++);

  // Section 2.1
  const s21Title = makeParagraph("2.1 Large Language Models", { style: "Heading2" });
  await engine.document.insertParagraph(s21Title, insertIdx++);

  await engine.document.insertParagraph(makeParagraph(
    "The evolution of large language models (LLMs) in 2025-2026 has been nothing short of revolutionary. " +
    "Model architectures have become increasingly efficient, with the latest generation of models achieving " +
    "superior performance at a fraction of the computational cost of their predecessors. The industry has " +
    "witnessed a paradigm shift from pure scale to intelligent design, with mixture-of-experts architectures " +
    "becoming the standard approach for production deployments.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // Section 2.1.1
  const s211Title = makeParagraph("2.1.1 Model Performance Benchmarks", { style: "Heading3" });
  await engine.document.insertParagraph(s211Title, insertIdx++);

  await engine.document.insertParagraph(makeParagraph(
    "Benchmark results across standard evaluation suites demonstrate consistent improvements. " +
    "The following table summarizes performance metrics across major model families evaluated during our study period.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. TABLE — AI Model Performance Comparison
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("10. Adding tables with full styling...");

  const aiTable = makeTable(
    ["Model Family", "Parameters", "MMLU Score", "HumanEval", "Cost/1M Tokens"],
    [
      ["GPT-5",        "1.8T MoE",   "92.4%", "89.1%", "$2.50"],
      ["Claude Opus",  "Unknown",     "91.8%", "90.3%", "$3.00"],
      ["Gemini Ultra",  "1.5T Dense",  "90.1%", "85.7%", "$2.00"],
      ["Llama 4",      "400B MoE",   "88.5%", "82.4%", "$0.50"],
      ["Mistral Large", "300B MoE",   "87.2%", "80.9%", "$0.80"],
    ],
  );

  // Style the table
  aiTable
    .setTableWidth(100, "pct")
    .autoFitWindow()
    .setTableAlignment("center")
    .setTableBorders({
      top:     { style: "single", size: 8, color: "1F3864" },
      bottom:  { style: "single", size: 8, color: "1F3864" },
      left:    { style: "single", size: 4, color: "1F3864" },
      right:   { style: "single", size: 4, color: "1F3864" },
      insideH: { style: "single", size: 4, color: "CCCCCC" },
      insideV: { style: "single", size: 4, color: "CCCCCC" },
    })
    .setHeaderRow(0, "1F3864")
    .setDefaultCellMargins({ top: 40, bottom: 40, left: 80, right: 80 })
    .setAltText("AI Model Performance Comparison", "Comparison of major AI model families with benchmark scores and pricing");

  // Style header row text
  for (let col = 0; col < 5; col++) {
    aiTable.setCellContent(0, col, aiTable.getCellText(0, col), {
      bold: true, color: "FFFFFF", fontSize: 20, alignment: "center",
    });
  }

  // Alternate row shading
  for (let row = 1; row <= 5; row++) {
    if (row % 2 === 0) aiTable.setRowShading(row, "EFF6FF");
  }

  // Sort by MMLU Score descending
  aiTable.sortByColumn(2, "desc");

  await engine.document.insertTable(aiTable);

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. CAPTIONS — Add table caption
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("11. Adding captions...");

  // Re-read to get updated paragraph count
  paragraphs = await engine.document.getParagraphs();
  insertIdx = paragraphs.length;

  await engine.captions.insertTableCaption(
    insertIdx - 1,
    "AI Model Performance Benchmarks (2026)",
    "above",
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. MORE CONTENT — Sections 2.2 + 2.3
  // ═══════════════════════════════════════════════════════════════════════════

  paragraphs = await engine.document.getParagraphs();
  insertIdx = paragraphs.length;

  // Section 2.2
  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);
  await engine.document.insertParagraph(
    makeParagraph("2.2 AI in Enterprise Applications", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "Enterprise adoption of AI has accelerated dramatically. Customer service automation, predictive " +
    "analytics, and code generation represent the three most widely adopted use cases. Organizations " +
    "report an average ROI of 340% on AI investments made in the previous fiscal year, with the fastest " +
    "returns seen in automated document processing and intelligent search applications. The integration " +
    "of AI agents into workflow management has created a new category of enterprise software that " +
    "is projected to reach $45 billion in market value by 2028.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // Section 2.3 — AI Ethics
  await engine.document.insertParagraph(
    makeParagraph("2.3 AI Ethics and Governance", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "The regulatory landscape for artificial intelligence has evolved significantly. The EU AI Act, " +
    "now fully in effect, has established a risk-based framework that categorizes AI systems into " +
    "four tiers: unacceptable risk, high risk, limited risk, and minimal risk. Organizations operating " +
    "in the European market must demonstrate compliance through comprehensive documentation, regular " +
    "auditing, and transparent disclosure of AI-driven decision-making processes.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // ─── CHAPTER 3: Cloud Computing (Pages 6-7) ──────────────────────────────

  await engine.document.insertParagraph(
    makeParagraph("3. Cloud Computing Infrastructure", { style: "Heading1" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(
    makeParagraph("3.1 Multi-Cloud Strategies", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "Multi-cloud architectures have become the de facto standard for enterprise infrastructure. " +
    "Our survey reveals that 78% of organizations now operate workloads across two or more cloud " +
    "providers, up from 62% in the previous year. This trend is driven by the desire to avoid vendor " +
    "lock-in, optimize costs across different pricing models, and leverage specialized services from " +
    "each provider. Kubernetes-based orchestration has matured to the point where seamless workload " +
    "portability is achievable for containerized applications.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // Cloud market share table
  const cloudTable = makeTable(
    ["Provider", "Market Share", "Growth YoY", "Specialty"],
    [
      ["AWS",            "32%",  "+8%",   "Broadest service catalog"],
      ["Microsoft Azure", "24%",  "+12%",  "Enterprise integration"],
      ["Google Cloud",   "12%",  "+15%",  "AI/ML infrastructure"],
      ["Oracle Cloud",   "5%",   "+22%",  "Database workloads"],
      ["IBM Cloud",      "4%",   "+3%",   "Hybrid cloud"],
      ["Others",         "23%",  "+5%",   "Various specializations"],
    ],
  );

  cloudTable
    .setTableWidth(100, "pct")
    .autoFitWindow()
    .setTableAlignment("center")
    .setTableBorders({
      top: { style: "single", size: 6, color: "2E75B6" },
      bottom: { style: "single", size: 6, color: "2E75B6" },
      insideH: { style: "single", size: 2, color: "D9E2F3" },
      insideV: { style: "single", size: 2, color: "D9E2F3" },
    })
    .setHeaderRow(0, "2E75B6");

  for (let col = 0; col < 4; col++) {
    cloudTable.setCellContent(0, col, cloudTable.getCellText(0, col), {
      bold: true, color: "FFFFFF", fontSize: 20, alignment: "center",
    });
  }

  for (let row = 1; row <= 6; row++) {
    if (row % 2 === 0) cloudTable.setRowShading(row, "D9E2F3");
  }

  await engine.document.insertTable(cloudTable);

  // Cloud table caption
  paragraphs = await engine.document.getParagraphs();
  await engine.captions.insertTableCaption(
    paragraphs.length - 1,
    "Cloud Market Share Analysis (2026)",
    "above",
  );

  // More cloud content
  paragraphs = await engine.document.getParagraphs();
  insertIdx = paragraphs.length;

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  await engine.document.insertParagraph(
    makeParagraph("3.2 Edge Computing Integration", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "Edge computing has emerged as a critical complement to centralized cloud infrastructure. " +
    "The proliferation of IoT devices, autonomous vehicles, and real-time analytics applications " +
    "demands processing capabilities closer to the data source. Industry analysts project the edge " +
    "computing market will reach $87 billion by 2027, representing a compound annual growth rate " +
    "of 28%. Key deployment scenarios include manufacturing floor analytics, retail customer " +
    "experience optimization, and healthcare diagnostic imaging.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // ─── CHAPTER 4: Cybersecurity (Pages 7-8) ─────────────────────────────────

  await engine.document.insertParagraph(
    makeParagraph("4. Cybersecurity Landscape", { style: "Heading1" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(
    makeParagraph("4.1 Threat Evolution", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "The cybersecurity threat landscape has become increasingly sophisticated. AI-powered attacks " +
    "now account for 35% of all detected intrusion attempts, up from 12% two years ago. Deepfake-based " +
    "social engineering attacks have increased by 400%, with financial institutions being the primary " +
    "targets. Supply chain attacks continue to represent one of the most challenging vectors, as " +
    "organizations struggle to validate the integrity of third-party components. The average cost " +
    "of a data breach reached $5.2 million in 2025, an increase of 12% over the previous year.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  await engine.document.insertParagraph(
    makeParagraph("4.2 Zero Trust Architecture", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "Zero Trust has moved from conceptual framework to mandatory requirement. The principle of " +
    "'never trust, always verify' now underpins the security architecture of 67% of enterprise " +
    "organizations surveyed. Implementation typically follows a phased approach: identity verification, " +
    "device trust establishment, network segmentation, application-level access control, and continuous " +
    "monitoring. Organizations with mature Zero Trust implementations report 60% fewer successful " +
    "breach attempts compared to those relying on traditional perimeter-based security.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  await engine.document.insertParagraph(
    makeParagraph("4.3 Post-Quantum Cryptography", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "With quantum computing advancing rapidly, the migration to quantum-resistant cryptographic " +
    "algorithms has become an urgent priority. NIST's standardized post-quantum algorithms, including " +
    "CRYSTALS-Kyber for key encapsulation and CRYSTALS-Dilithium for digital signatures, are seeing " +
    "increasing adoption. Early movers in the financial services and government sectors have completed " +
    "initial migration phases, while most other organizations are in the assessment or planning stages. " +
    "The 'harvest now, decrypt later' threat model continues to drive urgency in this transition.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // ─── CHAPTER 5: Quantum Computing (Pages 8-9) ────────────────────────────

  await engine.document.insertParagraph(
    makeParagraph("5. Quantum Computing", { style: "Heading1" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(
    makeParagraph("5.1 Hardware Advances", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "Quantum computing hardware has reached a significant inflection point. Multiple platforms " +
    "have demonstrated logical qubits with error rates below the threshold required for practical " +
    "fault-tolerant computation. Superconducting qubit systems now exceed 1,000 physical qubits, " +
    "while trapped-ion systems offer superior coherence times and gate fidelities. Photonic quantum " +
    "computing has emerged as a promising alternative for specific problem classes, particularly in " +
    "sampling and optimization tasks.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // Quantum table
  const quantumTable = makeTable(
    ["Platform", "Qubits", "Error Rate", "Coherence Time", "Status"],
    [
      ["Superconducting", "1,121",  "0.1%",  "100 us", "Production"],
      ["Trapped Ion",     "56",     "0.01%", "10 min", "Pre-production"],
      ["Photonic",        "216",    "0.5%",  "N/A",    "Research"],
      ["Neutral Atom",    "280",    "0.3%",  "1 sec",  "Pre-production"],
      ["Topological",     "8",      "TBD",   "TBD",    "Early research"],
    ],
  );

  quantumTable
    .setTableWidth(100, "pct")
    .autoFitWindow()
    .setTableBorders({
      top: { style: "double", size: 6, color: "404040" },
      bottom: { style: "double", size: 6, color: "404040" },
      insideH: { style: "single", size: 2, color: "CCCCCC" },
      insideV: { style: "single", size: 2, color: "CCCCCC" },
    })
    .setHeaderRow(0, "404040")
    .setTableAlignment("center");

  for (let col = 0; col < 5; col++) {
    quantumTable.setCellContent(0, col, quantumTable.getCellText(0, col), {
      bold: true, color: "FFFFFF", fontSize: 20, alignment: "center",
    });
  }

  await engine.document.insertTable(quantumTable);

  paragraphs = await engine.document.getParagraphs();
  await engine.captions.insertTableCaption(
    paragraphs.length - 1,
    "Quantum Computing Platform Comparison (2026)",
    "above",
  );

  // More quantum content
  paragraphs = await engine.document.getParagraphs();
  insertIdx = paragraphs.length;

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  await engine.document.insertParagraph(
    makeParagraph("5.2 Quantum Software and Algorithms", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "The quantum software ecosystem has matured significantly. Open-source frameworks such as Qiskit, " +
    "Cirq, and PennyLane have established robust communities and comprehensive toolchains. Variational " +
    "quantum algorithms continue to show promise for near-term applications in molecular simulation, " +
    "portfolio optimization, and logistics planning. Quantum machine learning remains an active area " +
    "of research, with hybrid classical-quantum approaches showing practical advantages for specific " +
    "problem instances in drug discovery and materials science.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // ─── CHAPTER 6: Conclusions & Recommendations (Pages 9-10) ────────────────

  await engine.document.insertParagraph(
    makeParagraph("6. Conclusions and Recommendations", { style: "Heading1" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(
    makeParagraph("6.1 Strategic Recommendations", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "Based on our comprehensive analysis, we present the following strategic recommendations for " +
    "organizations seeking to maintain competitive advantage through technology adoption:",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // Numbered recommendations
  const recommendations = [
    "Invest in AI literacy across all organizational levels, not just technical teams. AI fluency will become a prerequisite for effective management and strategic decision-making.",
    "Adopt a multi-cloud strategy with strong governance frameworks to balance flexibility with cost control and security compliance.",
    "Begin post-quantum cryptography migration planning immediately. Organizations should inventory current cryptographic dependencies and develop phased transition roadmaps.",
    "Implement Zero Trust architecture as the foundation of all security initiatives. Prioritize identity management and micro-segmentation.",
    "Explore quantum computing partnerships and pilot programs. While full-scale quantum advantage remains years away, early engagement builds institutional knowledge and competitive positioning.",
  ];

  for (const rec of recommendations) {
    await engine.document.insertParagraph(makeParagraph(
      rec,
      { alignment: "both", fontSize: 22 },
    ), insertIdx++);
    await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);
  }

  // Section 6.2 — Future Outlook
  await engine.document.insertParagraph(
    makeParagraph("6.2 Future Outlook", { style: "Heading2" }),
    insertIdx++,
  );

  await engine.document.insertParagraph(makeParagraph(
    "The pace of technological change continues to accelerate. The convergence of AI, cloud computing, " +
    "and quantum computing will create entirely new categories of applications and business models. " +
    "Organizations that invest strategically today will be best positioned to capitalize on these " +
    "opportunities. We anticipate that by 2028, AI-native enterprises will represent 40% of the " +
    "Fortune 500, quantum advantage will be demonstrated for commercially relevant problems, and " +
    "edge-cloud hybrid architectures will process 75% of enterprise-generated data.",
    { alignment: "both", fontSize: 22 },
  ), insertIdx++);

  await engine.document.insertParagraph(makeEmptyParagraph(), insertIdx++);

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. CITATIONS & BIBLIOGRAPHY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("13. Adding citations and bibliography...");

  await engine.citations.addSource({
    tag: "Smith2025",
    sourceType: "Book",
    author: "Smith",
    title: "Enterprise AI: A Practical Guide",
    year: "2025",
    city: "New York",
    publisher: "Tech Press",
  });

  await engine.citations.addSource({
    tag: "Johnson2026",
    sourceType: "JournalArticle",
    author: "Johnson",
    title: "Multi-Cloud Architecture Patterns for the Enterprise",
    year: "2026",
    publisher: "IEEE Cloud Computing",
  });

  await engine.citations.addSource({
    tag: "Chen2025",
    sourceType: "JournalArticle",
    author: "Chen",
    title: "Post-Quantum Cryptography: Transition Strategies",
    year: "2025",
    publisher: "ACM Computing Surveys",
  });

  await engine.citations.addSource({
    tag: "Williams2026",
    sourceType: "ConferenceProceedings",
    author: "Williams",
    title: "Quantum Computing: From Laboratory to Enterprise",
    year: "2026",
    city: "San Francisco",
    publisher: "QCon Proceedings",
  });

  // References heading
  await engine.document.insertParagraph(
    makeParagraph("References", { style: "Heading1" }),
    insertIdx++,
  );

  // Insert bibliography field
  await engine.citations.insertBibliography(insertIdx);
  insertIdx++;

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. BOOKMARKS & CROSS-REFERENCES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("14. Adding bookmarks and cross-references...");

  // Add bookmarks to key sections
  paragraphs = await engine.document.getParagraphs();

  // Find chapter headings and bookmark them
  for (let i = 0; i < paragraphs.length; i++) {
    const text = await paragraphs[i].getPlainText();
    if (text.text.startsWith("1. Executive")) {
      await engine.crossRef.addBookmark(i, "ExecSummary", "");
    } else if (text.text.startsWith("2. Artificial")) {
      await engine.crossRef.addBookmark(i, "AIChapter", "");
    } else if (text.text.startsWith("3. Cloud")) {
      await engine.crossRef.addBookmark(i, "CloudChapter", "");
    } else if (text.text.startsWith("4. Cybersecurity")) {
      await engine.crossRef.addBookmark(i, "SecurityChapter", "");
    } else if (text.text.startsWith("5. Quantum")) {
      await engine.crossRef.addBookmark(i, "QuantumChapter", "");
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. COMMENTS — Add review comments
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("15. Adding review comments...");

  // Find specific paragraphs to comment on
  paragraphs = await engine.document.getParagraphs();
  for (let i = 0; i < paragraphs.length; i++) {
    const text = await paragraphs[i].getPlainText();
    if (text.text.includes("47% increase in operational efficiency")) {
      await engine.comments.addComment(
        i,
        "Dr. Sarah Mitchell",
        "Please verify this statistic against the Q4 2025 operational metrics report.",
        "2026-01-15T10:30:00Z",
      );
      break;
    }
  }

  paragraphs = await engine.document.getParagraphs();
  for (let i = 0; i < paragraphs.length; i++) {
    const text = await paragraphs[i].getPlainText();
    if (text.text.includes("Zero Trust")) {
      await engine.comments.addComment(
        i,
        "James Rodriguez",
        "Consider adding a case study from our financial services client implementing ZTA.",
        "2026-01-16T14:20:00Z",
      );
      break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. SHAPES — Text boxes and decorative elements
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("16. Adding shapes and text boxes...");

  // Important callout text box
  await engine.shapes.insertTextBox({
    text: "Key Insight: AI-driven automation will reshape 40% of job functions by 2028.",
    position: { x: 914400, y: 457200 },
    size: { width: 5486400, height: 457200 },
    fillColor: "E8F0FE",
    borderColor: "1F3864",
    floating: true,
    paragraphIndex: 5,
  });

  // Decorative shape
  await engine.shapes.insertShape("roundRect", {
    position: { x: 457200, y: 228600 },
    size: { width: 6400800, height: 342900 },
    fillColor: "1F3864",
    borderColor: "1F3864",
    text: "TECHNOLOGY TRENDS 2026",
    textColor: "FFFFFF",
    fontSize: 14,
    bold: true,
    textAlign: "ctr",
    floating: true,
    paragraphIndex: 2,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 17. SECTIONS — Add section breaks for layout variation
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("17. Managing sections...");

  // Read current sections
  const sections = await engine.sections.getSections();
  console.log(`   Document has ${sections.length} section(s)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 18. NUMBERING — Apply list numbering
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("18. Applying numbering to recommendations...");

  const numDefs = await engine.numbering.getNumberingDefinitions();
  if (numDefs.length > 0) {
    // Apply numbering to recommendation paragraphs
    paragraphs = await engine.document.getParagraphs();
    let recNum = 0;
    for (let i = 0; i < paragraphs.length; i++) {
      const text = await paragraphs[i].getPlainText();
      if (text.text.startsWith("Invest in AI") ||
          text.text.startsWith("Adopt a multi-cloud") ||
          text.text.startsWith("Begin post-quantum") ||
          text.text.startsWith("Implement Zero Trust") ||
          text.text.startsWith("Explore quantum")) {
        engine.numbering.applyNumbering(paragraphs[i], numDefs[0].numId, 0);
        recNum++;
      }
    }
    if (recNum > 0) {
      await engine.document.saveChanges(paragraphs);
      console.log(`   Applied numbering to ${recNum} recommendation paragraphs`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 19. FIND AND REPLACE — Final cleanup
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("19. Running find and replace...");
  await engine.document.findAndReplaceAll("PLACEHOLDER_YEAR", "2026");

  // ═══════════════════════════════════════════════════════════════════════════
  // 20. LIST OF FIGURES / TABLES
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("20. Inserting list of tables...");
  await engine.captions.insertListOfTables("List of Tables", 0);

  // ═══════════════════════════════════════════════════════════════════════════
  // 21. PARAGRAPH FEATURES — clone, merge, split, word count, detect language
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("21. Demonstrating advanced paragraph features...");

  paragraphs = await engine.document.getParagraphs();
  if (paragraphs.length > 5) {
    const sample = paragraphs[5];
    const cloned = sample.clone();
    const wordCount = await sample.getWordCount();
    let lang: string | null = null;
    try { lang = sample.detectLanguage(); } catch { /* runs may not be iterable */ }
    console.log(`   Sample paragraph: ${wordCount} words, language: ${lang ?? "undetected"}`);

    // Demonstrate clone + mergeWith
    const another = makeParagraph("(Merged content)", { fontSize: 22 });
    // Ensure w:r is array before merging
    if (cloned.paragraph["w:r"] && !Array.isArray(cloned.paragraph["w:r"])) {
      cloned.paragraph["w:r"] = [cloned.paragraph["w:r"]];
    }
    cloned.mergeWith(another);
    console.log(`   Cloned + merged paragraph runs: ${cloned.getRuns().length}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 22. MEDIA — list existing images
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("22. Checking media...");
  const images = engine.media.listImages();
  console.log(`   Document contains ${images.length} image(s)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 23. CONTENT TYPES — verify overrides
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("23. Verifying content types...");
  const hasHeaderCT = await engine.contentTypes.hasOverride(`/${headerPath}`);
  const hasFooterCT = await engine.contentTypes.hasOverride(`/${footerPath}`);
  console.log(`   Header content type: ${hasHeaderCT}, Footer content type: ${hasFooterCT}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 24. RELATIONSHIPS — verify rels
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("24. Checking relationships...");
  const nextRelId = await engine.rels.genId();
  console.log(`   Next available relationship ID: ${nextRelId}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 25. TRACKED CHANGES — check for revisions
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("25. Checking tracked changes...");
  const revisions = await engine.trackedChanges.getRevisions();
  console.log(`   Found ${revisions.length} revision(s)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // 26. FINAL STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("\n26. Final document statistics:");
  paragraphs = await engine.document.getParagraphs();
  const tables = await engine.document.getTables();
  const styles = await engine.styles.listStyles();
  const footnotes = await engine.footnotes.getFootnotes();
  const endnotes = await engine.endnotes.getEndnotes();
  const bookmarks = await engine.crossRef.getBookmarks();
  const sources = await engine.citations.getSources();
  const comments = await engine.comments.getComments();
  const captions = await engine.captions.getCaptions();
  const shapes = await engine.shapes.getShapes();

  console.log(`   Paragraphs:  ${paragraphs.length}`);
  console.log(`   Tables:      ${tables.length}`);
  console.log(`   Styles:      ${styles.length}`);
  console.log(`   Footnotes:   ${footnotes.length}`);
  console.log(`   Endnotes:    ${endnotes.length}`);
  console.log(`   Bookmarks:   ${bookmarks.length}`);
  console.log(`   Citations:   ${sources.length}`);
  console.log(`   Comments:    ${comments.length}`);
  console.log(`   Captions:    ${captions.length}`);
  console.log(`   Shapes:      ${shapes.length}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\nSaving to ${OUTPUT}...`);
  await engine.saveToFile(OUTPUT);
  console.log("Done! Report generated successfully.");
}

main().catch((err) => {
  console.error("Error generating report:", err);
  process.exit(1);
});
