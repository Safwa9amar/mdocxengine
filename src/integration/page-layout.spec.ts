import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine, inchesToTwips, PAGE_SIZES, MARGIN_PRESETS } from "@/index";

const INPUT = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/page-layout-output.docx");

let engine: Mdocxengine;

describe("PageLayout integration", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);
  });

  // ─── Page Size ────────────────────────────────────────────────────────────

  test("set page size to A4 portrait", async () => {
    await engine.pageLayout.setPageSizePreset("A4", "portrait");
    const size = await engine.pageLayout.getPageSize();
    expect(size.width).toBe(PAGE_SIZES.A4.w);
    expect(size.height).toBe(PAGE_SIZES.A4.h);
    expect(size.orientation).toBe("portrait");
  });

  test("set page size to US Letter landscape", async () => {
    await engine.pageLayout.setPageSizePreset("USLetter", "landscape");
    const size = await engine.pageLayout.getPageSize();
    expect(size.orientation).toBe("landscape");
    // landscape: width > height
    expect(size.width).toBeGreaterThan(size.height);
  });

  test("set custom page size", async () => {
    await engine.pageLayout.setPageSize({ width: 10000, height: 14000 });
    const size = await engine.pageLayout.getPageSize();
    expect(size.width).toBe(10000);
    expect(size.height).toBe(14000);
  });

  // ─── Orientation ──────────────────────────────────────────────────────────

  test("toggle orientation to landscape then back", async () => {
    await engine.pageLayout.setPageSizePreset("A4");
    await engine.pageLayout.setOrientation("landscape");
    expect(await engine.pageLayout.getOrientation()).toBe("landscape");

    await engine.pageLayout.setOrientation("portrait");
    expect(await engine.pageLayout.getOrientation()).toBe("portrait");
  });

  // ─── Margins ──────────────────────────────────────────────────────────────

  test("apply Normal margin preset", async () => {
    await engine.pageLayout.setMarginPreset("normal");
    const m = await engine.pageLayout.getMargins();
    expect(m.top).toBe(MARGIN_PRESETS.normal.top);
    expect(m.left).toBe(MARGIN_PRESETS.normal.left);
  });

  test("apply Narrow margin preset", async () => {
    await engine.pageLayout.setMarginPreset("narrow");
    const m = await engine.pageLayout.getMargins();
    expect(m.top).toBe(MARGIN_PRESETS.narrow.top);
    expect(m.left).toBe(MARGIN_PRESETS.narrow.left);
  });

  test("apply Moderate margin preset", async () => {
    await engine.pageLayout.setMarginPreset("moderate");
    const m = await engine.pageLayout.getMargins();
    expect(m.left).toBe(MARGIN_PRESETS.moderate.left);
  });

  test("set custom margins in twips", async () => {
    await engine.pageLayout.setMargins({ top: 720, bottom: 720, left: 1080, right: 1080 });
    const m = await engine.pageLayout.getMargins();
    expect(m.top).toBe(720);
    expect(m.left).toBe(1080);
  });

  test("set margins in inches", async () => {
    await engine.pageLayout.setMarginsInInches({ top: 1, bottom: 1, left: 1.25, right: 1 });
    const m = await engine.pageLayout.getMargins();
    expect(m.top).toBe(inchesToTwips(1));
    expect(m.left).toBe(inchesToTwips(1.25));
  });

  // ─── Columns ──────────────────────────────────────────────────────────────

  test("set two-column layout", async () => {
    await engine.pageLayout.setColumns({ count: 2, space: 720 });
    const cols = await engine.pageLayout.getColumns();
    expect(cols.count).toBe(2);
    expect(cols.space).toBe(720);
  });

  test("set three-column layout", async () => {
    await engine.pageLayout.setColumns({ count: 3, space: 500 });
    const cols = await engine.pageLayout.getColumns();
    expect(cols.count).toBe(3);
  });

  test("reset to single column", async () => {
    await engine.pageLayout.setColumns({ count: 1 });
    const cols = await engine.pageLayout.getColumns();
    expect(cols.count).toBe(1);
  });

  // ─── Breaks ───────────────────────────────────────────────────────────────

  test("insert a next-page section break", async () => {
    const before = (await engine.document.getParagraphs()).length;
    await engine.pageLayout.insertBreak("nextPage");
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("w:sectPr");
    // paragraph count increases by 1 (the break paragraph)
    const after = await engine.document.getParagraphs();
    expect(after.length).toBeGreaterThanOrEqual(before);
  });

  test("insert a continuous section break", async () => {
    await engine.pageLayout.insertBreak("continuous");
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("continuous");
  });

  test("insert a column break", async () => {
    await engine.pageLayout.insertBreak("nextColumn");
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:type="column"');
  });

  // ─── Line Numbering ───────────────────────────────────────────────────────

  test("enable line numbering", async () => {
    await engine.pageLayout.setLineNumbering({ countBy: 1, restart: "newPage" });
    const ln = await engine.pageLayout.getLineNumbering();
    expect(ln).not.toBeNull();
    expect(ln!.countBy).toBe(1);
    expect(ln!.restart).toBe("newPage");
  });

  test("disable line numbering", async () => {
    await engine.pageLayout.removeLineNumbering();
    const ln = await engine.pageLayout.getLineNumbering();
    expect(ln).toBeNull();
  });

  // ─── Save ─────────────────────────────────────────────────────────────────

  test("save layout document to disk", async () => {
    // Reset to clean A4 Normal before saving
    await engine.pageLayout.setPageSizePreset("A4", "portrait");
    await engine.pageLayout.setMarginPreset("normal");
    await engine.pageLayout.setColumns({ count: 1 });

    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    expect(fs.statSync(OUTPUT).size).toBeGreaterThan(0);
    console.log(`\n✓ Output written to: ${OUTPUT}`);
  });
});
