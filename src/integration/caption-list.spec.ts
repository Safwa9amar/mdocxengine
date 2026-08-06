import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine, Table, Paragraph, Run } from "@/index";

const INPUT  = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/caption-list.docx");

let engine: Mdocxengine;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStyledTable(headers: string[], rows: string[][]): Table {
  const t = new Table({
    $: {},
    "w:tr": Array.from({ length: rows.length + 1 }, () => ({
      "w:tc": Array.from({ length: headers.length }, () => ({
        "w:p": { "w:r": { "w:t": "" } },
      })),
    })),
  } as any);

  t.setTableStyle("TableGrid")
   .setTableAlignment("center")
   .setTableWidth(100, "pct")
   .setTableBorders({
     top:     { style: "single", size: 8, color: "1F3864" },
     bottom:  { style: "single", size: 8, color: "1F3864" },
     left:    { style: "single", size: 8, color: "1F3864" },
     right:   { style: "single", size: 8, color: "1F3864" },
     insideH: { style: "single", size: 4, color: "B8CCE4" },
     insideV: { style: "single", size: 4, color: "B8CCE4" },
   })
   .setDefaultCellMargins({ top: 72, bottom: 72, left: 108, right: 108 });

  // Header row
  headers.forEach((h, col) => {
    t.setCellContent(0, col, h, { bold: true, color: "FFFFFF", fontSize: 22, alignment: "center" });
  });
  t.setHeaderRow(0, "1F3864").setRowHeight(0, 460, "exact");

  // Data rows
  rows.forEach((row, i) => {
    t.setRowShading(i + 1, i % 2 === 0 ? "FFFFFF" : "DCE6F1");
    row.forEach((cell, col) => {
      t.setCellContent(i + 1, col, cell, { fontSize: 20, alignment: col === 0 ? "center" : "left" });
    });
  });

  return t;
}

function makeFigurePara(text: string): Paragraph {
  const run = Run.fromText(text);
  run.setItalic();
  run.setColor("595959");
  run.setFontSize(20);
  const p = new Paragraph({ $: {}, "w:r": [] } as any);
  p.setAlignment("center");
  p.addRun(run);
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("Caption list — Table des figures / Table des tableaux", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);
  });

  // ─── Insert 10 tables with captions ────────────────────────────────────────

  test("insert 10 tables each with a Table caption", async () => {
    const datasets = [
      { title: "Monthly Revenue (Q1)",   headers: ["Month",   "Revenue",  "Growth"],  rows: [["Jan", "$12,400", "+4%"], ["Feb", "$13,100", "+5%"], ["Mar", "$14,800", "+13%"]] },
      { title: "Monthly Revenue (Q2)",   headers: ["Month",   "Revenue",  "Growth"],  rows: [["Apr", "$15,200", "+3%"], ["May", "$16,000", "+5%"], ["Jun", "$17,500", "+9%"]] },
      { title: "Employee Headcount",     headers: ["Dept",    "Staff",    "Vacancies"], rows: [["Engineering", "42", "3"], ["Design", "18", "1"], ["Marketing", "24", "2"]] },
      { title: "Server Uptime SLA",      headers: ["Region",  "Uptime",   "Incidents"], rows: [["EU-West", "99.98%", "1"], ["US-East", "99.95%", "3"], ["APAC", "99.90%", "5"]] },
      { title: "Product Sales by SKU",   headers: ["SKU",     "Units",    "Revenue"],  rows: [["PRO-01", "1,240", "$62k"], ["PRO-02", "980", "$49k"], ["PRO-03", "540", "$27k"]] },
      { title: "Customer Satisfaction",  headers: ["Quarter", "CSAT",     "NPS"],      rows: [["Q1", "87%", "42"], ["Q2", "89%", "47"], ["Q3", "91%", "51"]] },
      { title: "Bug Tracker Summary",    headers: ["Priority","Open",     "Resolved"], rows: [["Critical", "2", "14"], ["High", "8", "43"], ["Medium", "21", "97"]] },
      { title: "Cloud Cost Breakdown",   headers: ["Service", "Monthly",  "YTD"],      rows: [["Compute", "$4,200", "$38k"], ["Storage", "$1,100", "$9.8k"], ["Network", "$680", "$6.1k"]] },
      { title: "Training Completion",    headers: ["Course",  "Enrolled", "Complete"], rows: [["Security", "120", "108"], ["Compliance", "120", "115"], ["Leadership", "45", "38"]] },
      { title: "Annual KPI Dashboard",   headers: ["KPI",     "Target",   "Actual"],   rows: [["Revenue", "$200k", "$218k"], ["Churn", "<5%", "3.8%"], ["NPS", ">40", "51"]] },
    ];

    for (const ds of datasets) {
      const table = makeStyledTable(ds.headers, ds.rows);
      await engine.document.insertTable(table);
      const blocks = await engine.document.getBlocks();
      await engine.captions.insertTableCaption(
        blocks.length - 1,
        ds.title,
        "above",
      );
    }

    const tableCaptions = await engine.captions.getCaptions("Table");
    expect(tableCaptions.length).toBe(10);
    expect(tableCaptions[0].text).toBe("Monthly Revenue (Q1)");
    expect(tableCaptions[9].text).toBe("Annual KPI Dashboard");
  });

  // ─── Insert 5 figure placeholders with captions ───────────────────────────

  test("insert 5 figure paragraphs each with a Figure caption", async () => {
    const figures = [
      "System Architecture Overview",
      "Data Pipeline Flow Diagram",
      "Monthly Revenue Trend Chart",
      "User Retention Funnel",
      "Infrastructure Topology Map",
    ];

    for (const title of figures) {
      const para = makeFigurePara(`[ ${title} ]`);
      await engine.document.insertParagraph(para);
      const blocks = await engine.document.getBlocks();
      await engine.captions.insertFigureCaption(
        blocks.length - 1,
        title,
      );
    }

    const figureCaptions = await engine.captions.getCaptions("Figure");
    expect(figureCaptions.length).toBe(5);
    expect(figureCaptions[0].text).toBe("System Architecture Overview");
    expect(figureCaptions[4].text).toBe("Infrastructure Topology Map");
  });

  // ─── Insert List of Tables at top ─────────────────────────────────────────

  test("insert List of Tables at top of document", async () => {
    await engine.captions.insertListOfTables("List of Tables", 0);

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('\\c "Table"');
    expect(xml).toContain("List of Tables");
    expect(xml).toContain("TOCHeading");
  });

  // ─── Insert List of Figures after List of Tables ──────────────────────────

  test("insert List of Figures after List of Tables", async () => {
    // A caption list is heading + field-begin + one entry per caption + field-end.
    // Insert AFTER all of that, or the Figures field nests inside the Tables one.
    const tableCount = (await engine.captions.getCaptions("Table")).length;
    await engine.captions.insertListOfFigures("List of Figures", 3 + tableCount);

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('\\c "Figure"');
    expect(xml).toContain("List of Figures");
  });

  // ─── getCaptions filtered ─────────────────────────────────────────────────

  test("getCaptions returns only Table captions when filtered", async () => {
    const tables = await engine.captions.getCaptions("Table");
    expect(tables.length).toBe(10);
    tables.forEach((c) => expect(c.label).toBe("Table"));
  });

  test("getCaptions returns only Figure captions when filtered", async () => {
    const figures = await engine.captions.getCaptions("Figure");
    expect(figures.length).toBe(5);
    figures.forEach((c) => expect(c.label).toBe("Figure"));
  });

  test("getCaptions returns all captions combined", async () => {
    const all = await engine.captions.getCaptions();
    expect(all.length).toBe(15);
  });

  // ─── removeCaptionList ────────────────────────────────────────────────────

  test("removeCaptionList removes Table list field", async () => {
    await engine.captions.removeCaptionList("Table");
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).not.toContain('\\c "Table"');
    // Figure list should still be present
    expect(xml).toContain('\\c "Figure"');
  });

  test("re-insert List of Tables after removal", async () => {
    await engine.captions.insertListOfTables("List of Tables", 0);
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('\\c "Table"');
  });

  // ─── Custom label list ────────────────────────────────────────────────────

  test("insertCaptionList works with custom label", async () => {
    // Add 3 Equation captions
    const blocks = await engine.document.getBlocks();
    const idx = blocks.length - 1;
    await engine.captions.insertCustomCaption(idx, "Equation", "Energy-mass equivalence E = mc²");
    await engine.captions.insertCustomCaption(idx, "Equation", "Pythagorean theorem a² + b² = c²");
    await engine.captions.insertCustomCaption(idx, "Equation", "Euler's identity e^(iπ) + 1 = 0");

    // Insert list of equations
    await engine.captions.insertCaptionList("Equation", "List of Equations", 4);

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('\\c "Equation"');
    expect(xml).toContain("List of Equations");

    const eqs = await engine.captions.getCaptions("Equation");
    expect(eqs.length).toBe(3);
  });

  // ─── No w:dirty in output ─────────────────────────────────────────────────

  test("output document contains no w:dirty fields", async () => {
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).not.toContain("w:dirty");
  });

  // ─── Caption style registered ─────────────────────────────────────────────

  test("Caption and CaptionChar styles are registered in styles.xml", async () => {
    const styles = await engine.styles.listStyles();
    const ids    = styles.map((s) => s.id);
    expect(ids).toContain("Caption");
    expect(ids).toContain("CaptionChar");
  });

  // ─── Save ─────────────────────────────────────────────────────────────────

  test("save to disk", async () => {
    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    expect(fs.statSync(OUTPUT).size).toBeGreaterThan(0);
    console.log(`\n✓ Output written to: ${OUTPUT}`);
  });
});
