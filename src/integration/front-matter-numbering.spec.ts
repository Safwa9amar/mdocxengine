import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine } from "../index";

const INPUT = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/front-matter-numbering-output.docx");

describe("applyFrontMatterNumbering integration", () => {
  let engine: Mdocxengine;
  let sectionsBefore: number;
  let footerCountBefore: number;

  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);
    sectionsBefore = (await engine.sections.getSections()).length;
    footerCountBefore = engine.zip
      .getEntries()
      .filter((e) => /^word\/footer\d+\.xml$/.test(e.entryName)).length;
    await engine.applyFrontMatterNumbering({ bodyStartParaIndex: 1 });
    await engine.saveToFile(OUTPUT);
  });

  test("adds a second section (the page break splits the document)", async () => {
    const sectionsAfter = (await engine.sections.getSections()).length;
    expect(sectionsAfter).toBeGreaterThanOrEqual(sectionsBefore + 1);
    expect(sectionsAfter).toBeGreaterThanOrEqual(2);
  });

  test("creates two new footer parts (front matter + body)", () => {
    const footerCountAfter = engine.zip
      .getEntries()
      .filter((e) => /^word\/footer\d+\.xml$/.test(e.entryName)).length;
    expect(footerCountAfter).toBe(footerCountBefore + 2);
  });

  test("front-matter footer uses roman, body footer uses decimal page numbers", () => {
    const footers = engine.zip
      .getEntries()
      .filter((e) => /^word\/footer\d+\.xml$/.test(e.entryName))
      .map((e) => engine.zip.readAsText(e.entryName) ?? "");
    const joined = footers.join("\n");
    // PAGE field present in footers, with roman and arabic numbering somewhere.
    expect(joined).toMatch(/PAGE/);
    expect(joined.toLowerCase()).toContain("roman");
  });

  test("body section restarts numbering at 1 (decimal)", () => {
    const documentXml = engine.zip.readAsText("word/document.xml") ?? "";
    expect(documentXml).toMatch(/<w:pgNumType[^>]*w:start="1"/);
    expect(documentXml).toMatch(/<w:pgNumType[^>]*w:fmt="decimal"/);
  });

  test("output file is written", () => {
    expect(fs.existsSync(OUTPUT)).toBe(true);
  });
});
