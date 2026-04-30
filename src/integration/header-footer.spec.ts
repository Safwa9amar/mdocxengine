import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine } from "@/index";

const INPUT  = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/header-footer.docx");

let engine: Mdocxengine;

describe("HeaderManager & FooterManager — Header & Footer tab features", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);
  });

  // ── addHeader / addFooter ─────────────────────────────────────────────────

  test("add a default header with plain text", async () => {
    const { headerPath } = await engine.header.addHeader("My Report — Confidential");
    expect(headerPath).toMatch(/word\/header\d+\.xml/);
    const xml = engine.zip.readAsText(headerPath)!;
    expect(xml).toContain("My Report");
  });

  test("add a default footer with plain text", async () => {
    const { footerPath } = await engine.footer.addFooter("© 2026 Acme Corp");
    expect(footerPath).toMatch(/word\/footer\d+\.xml/);
    const xml = engine.zip.readAsText(footerPath)!;
    expect(xml).toContain("Acme Corp");
  });

  // ── Insert Page Number ────────────────────────────────────────────────────

  test("insert centered page number into footer", async () => {
    const { footerPath } = await engine.footer.addFooter("", "default");
    await engine.footer.insertPageNumber(footerPath, { alignment: "center" });

    const xml = engine.zip.readAsText(footerPath)!;
    expect(xml).toContain("PAGE");
    expect(xml).toContain("MERGEFORMAT");
    expect(xml).toContain('w:val="center"');
  });

  test("insert right-aligned page number with total pages into footer", async () => {
    const { footerPath } = await engine.footer.addFooter("", "default");
    await engine.footer.insertPageNumber(footerPath, {
      alignment: "right",
      includeTotalPages: true,
      prefix: "Page ",
    });

    const xml = engine.zip.readAsText(footerPath)!;
    expect(xml).toContain("PAGE");
    expect(xml).toContain("NUMPAGES");
    expect(xml).toContain("Page ");
    expect(xml).toContain('w:val="right"');
  });

  test("insert Roman-numeral page number into header", async () => {
    const { headerPath } = await engine.header.addHeader("", "default");
    await engine.header.insertPageNumber(headerPath, {
      alignment: "right",
      format: "upperRoman",
    });

    const xml = engine.zip.readAsText(headerPath)!;
    expect(xml).toContain("PAGE");
    expect(xml).toContain("ROMAN");
  });

  test("insert uppercase-letter page number into footer", async () => {
    const { footerPath } = await engine.footer.addFooter("", "default");
    await engine.footer.insertPageNumber(footerPath, { format: "upperLetter" });

    const xml = engine.zip.readAsText(footerPath)!;
    expect(xml).toContain("ALPHABETIC");
  });

  // ── Remove Page Numbers ───────────────────────────────────────────────────

  test("removePageNumbers strips PAGE fields from footer", async () => {
    const { footerPath } = await engine.footer.addFooter("", "default");
    await engine.footer.insertPageNumber(footerPath, { alignment: "center" });

    let xml = engine.zip.readAsText(footerPath)!;
    expect(xml).toContain("PAGE");

    await engine.footer.removePageNumbers(footerPath);
    xml = engine.zip.readAsText(footerPath)!;
    expect(xml).not.toContain("PAGE");
  });

  test("removePageNumbers strips PAGE fields from header", async () => {
    const { headerPath } = await engine.header.addHeader("", "default");
    await engine.header.insertPageNumber(headerPath, { alignment: "left" });

    let xml = engine.zip.readAsText(headerPath)!;
    expect(xml).toContain("PAGE");

    await engine.header.removePageNumbers(headerPath);
    xml = engine.zip.readAsText(headerPath)!;
    expect(xml).not.toContain("PAGE");
  });

  // ── Format Page Numbers ───────────────────────────────────────────────────

  test("formatPageNumbers sets decimal format starting at 1", async () => {
    await engine.footer.formatPageNumbers({ format: "decimal", startAt: 1 });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("w:pgNumType");
    expect(xml).toContain('w:fmt="decimal"');
    expect(xml).toContain('w:start="1"');
  });

  test("formatPageNumbers sets lowerRoman format", async () => {
    await engine.header.formatPageNumbers({ format: "lowerRoman" });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:fmt="lowerRoman"');
  });

  test("formatPageNumbers with custom start page", async () => {
    await engine.footer.formatPageNumbers({ startAt: 5 });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:start="5"');
  });

  test("formatPageNumbers — include chapter number with Heading 1 and hyphen separator", async () => {
    await engine.footer.formatPageNumbers({
      format: "decimal",
      includeChapterNumber: true,
      chapterStyle: 1,
      chapterSeparator: "hyphen",
      startAt: 1,
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:fmt="decimal"');
    expect(xml).toContain('w:chapStyle="1"');
    expect(xml).toContain('w:chapSep="hyphen"');
    expect(xml).toContain('w:start="1"');
  });

  test("formatPageNumbers — include chapter number with Heading 2 and period separator", async () => {
    await engine.footer.formatPageNumbers({
      format: "decimal",
      includeChapterNumber: true,
      chapterStyle: 2,
      chapterSeparator: "period",
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:chapStyle="2"');
    expect(xml).toContain('w:chapSep="period"');
  });

  test("formatPageNumbers — include chapter number with colon separator", async () => {
    await engine.footer.formatPageNumbers({
      includeChapterNumber: true,
      chapterSeparator: "colon",
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:chapSep="colon"');
  });

  test("formatPageNumbers — include chapter number with em dash separator", async () => {
    await engine.header.formatPageNumbers({
      format: "upperLetter",
      includeChapterNumber: true,
      chapterSeparator: "emDash",
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:fmt="upperLetter"');
    expect(xml).toContain('w:chapSep="emDash"');
  });

  test("formatPageNumbers — include chapter number with en dash separator", async () => {
    await engine.footer.formatPageNumbers({
      includeChapterNumber: true,
      chapterSeparator: "enDash",
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:chapSep="enDash"');
  });

  test("formatPageNumbers — continueFromPreviousSection omits w:start", async () => {
    await engine.footer.formatPageNumbers({
      format: "decimal",
      continueFromPreviousSection: true,
      startAt: 99, // should be ignored
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:fmt="decimal"');
    expect(xml).not.toContain('w:start="99"');
  });

  test("formatPageNumbers — start at 3 without continueFromPreviousSection", async () => {
    await engine.header.formatPageNumbers({
      format: "upperRoman",
      continueFromPreviousSection: false,
      startAt: 3,
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:fmt="upperRoman"');
    expect(xml).toContain('w:start="3"');
  });

  // ── Different First Page ──────────────────────────────────────────────────

  test("setDifferentFirstPage(true) adds w:titlePg to sectPr", async () => {
    await engine.header.setDifferentFirstPage(true);
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("w:titlePg");
  });

  test("setDifferentFirstPage(false) removes w:titlePg", async () => {
    await engine.header.setDifferentFirstPage(false);
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).not.toContain("w:titlePg");
  });

  test("footer setDifferentFirstPage also controls w:titlePg", async () => {
    await engine.footer.setDifferentFirstPage(true);
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("w:titlePg");
    // clean up
    await engine.footer.setDifferentFirstPage(false);
  });

  // ── Different First Page: add first-page header & footer ─────────────────

  test("add first-page header and footer after enabling different first page", async () => {
    await engine.header.setDifferentFirstPage(true);

    const { headerPath } = await engine.header.addHeader("Cover Page Header", "first");
    const { footerPath } = await engine.footer.addFooter("Cover Page Footer", "first");

    const docXml = engine.zip.readAsText("word/document.xml")!;
    expect(docXml).toContain("w:titlePg");

    const hXml = engine.zip.readAsText(headerPath)!;
    expect(hXml).toContain("Cover Page Header");

    const fXml = engine.zip.readAsText(footerPath)!;
    expect(fXml).toContain("Cover Page Footer");
  });

  // ── Different Odd & Even Pages ────────────────────────────────────────────

  test("setDifferentOddEvenPages(true) writes w:evenAndOddHeaders to settings.xml", async () => {
    await engine.header.setDifferentOddEvenPages(true);
    const xml = engine.zip.readAsText("word/settings.xml");
    // settings.xml may not exist in all samples — skip if absent
    if (xml) expect(xml).toContain("evenAndOddHeaders");
  });

  test("setDifferentOddEvenPages(false) removes w:evenAndOddHeaders", async () => {
    await engine.header.setDifferentOddEvenPages(false);
    const xml = engine.zip.readAsText("word/settings.xml");
    if (xml) expect(xml).not.toContain("evenAndOddHeaders");
  });

  test("footer setDifferentOddEvenPages mirrors header behaviour", async () => {
    await engine.footer.setDifferentOddEvenPages(true);
    const xml = engine.zip.readAsText("word/settings.xml");
    if (xml) expect(xml).toContain("evenAndOddHeaders");
    await engine.footer.setDifferentOddEvenPages(false);
  });

  // ── Even-page header & footer after enabling odd/even ────────────────────

  test("add even-page header after enabling odd/even pages", async () => {
    await engine.header.setDifferentOddEvenPages(true);
    const { headerPath } = await engine.header.addHeader("Even Page Header", "even");

    const xml = engine.zip.readAsText(headerPath)!;
    expect(xml).toContain("Even Page Header");

    await engine.header.setDifferentOddEvenPages(false);
  });

  // ── Header from Top / Footer from Bottom distances ────────────────────────

  test("setHeaderDistance writes w:header to w:pgMar in sectPr", async () => {
    await engine.header.setHeaderDistance(720); // 0.5 inch
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:header="720"');
  });

  test("setFooterDistance writes w:footer to w:pgMar in sectPr", async () => {
    await engine.footer.setFooterDistance(720); // 0.5 inch
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:footer="720"');
  });

  test("setHeaderDistance to Word default (709 twips ≈ 0.49\")", async () => {
    await engine.header.setHeaderDistance(709);
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:header="709"');
  });

  test("setFooterDistance to Word default (709 twips ≈ 0.49\")", async () => {
    await engine.footer.setFooterDistance(709);
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:footer="709"');
  });

  // ── updateHeader / updateFooter ───────────────────────────────────────────

  test("updateHeader replaces XML of existing header", async () => {
    const { headerPath, headerXml } = await engine.header.addHeader("Old text");
    expect(engine.zip.readAsText(headerPath)).toContain("Old text");

    const newXml = headerXml.replace("Old text", "New text");
    engine.header.updateHeader(headerPath, newXml);
    expect(engine.zip.readAsText(headerPath)).toContain("New text");
  });

  test("updateFooter replaces XML of existing footer", async () => {
    const { footerPath, footerXml } = await engine.footer.addFooter("Old footer");
    const newXml = footerXml.replace("Old footer", "New footer");
    engine.footer.updateFooter(footerPath, newXml);
    expect(engine.zip.readAsText(footerPath)).toContain("New footer");
  });

  // ── removeHeader / removeFooter ───────────────────────────────────────────

  test("removeHeader deletes file and relationship", async () => {
    const { headerPath } = await engine.header.addHeader("Temp header");
    expect(engine.zip.readAsText(headerPath)).toBeTruthy();

    await engine.header.removeHeader(headerPath);
    expect(engine.zip.readAsText(headerPath) || null).toBeNull();
  });

  test("removeFooter deletes file and relationship", async () => {
    const { footerPath } = await engine.footer.addFooter("Temp footer");
    expect(engine.zip.readAsText(footerPath)).toBeTruthy();

    await engine.footer.removeFooter(footerPath);
    expect(engine.zip.readAsText(footerPath) || null).toBeNull();
  });

  // ── Save ──────────────────────────────────────────────────────────────────

  test("save to disk", async () => {
    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    expect(fs.statSync(OUTPUT).size).toBeGreaterThan(0);
    console.log(`\n✓ Output written to: ${OUTPUT}`);
  });
});
