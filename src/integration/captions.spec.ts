import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine, Paragraph, Run } from "@/index";

const INPUT  = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/captions-output.docx");

let engine: Mdocxengine;
let baseIndex: number;

describe("CaptionManager", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);

    // Insert a heading paragraph to anchor captions near
    const para = new Paragraph({ $: {}, "w:r": [] } as any);
    para.applyStyle("Heading1");
    para.addRun(Run.fromText("Results"));
    await engine.document.insertParagraph(para);
    const paragraphs = await engine.document.getParagraphs();
    baseIndex = paragraphs.length - 1;
  });

  // ─── Figure captions ──────────────────────────────────────────────────────

  test("insert a Figure caption below a paragraph", async () => {
    const insertedAt = await engine.captions.insertFigureCaption(
      baseIndex,
      "Architecture overview diagram",
    );

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("SEQ Figure");
    expect(xml).toContain("Architecture overview diagram");
    expect(insertedAt).toBe(baseIndex + 1);
  });

  test("insert a second Figure caption", async () => {
    await engine.captions.insertFigureCaption(
      baseIndex + 1,
      "Data flow diagram",
    );
    const captions = await engine.captions.getCaptions("Figure");
    expect(captions.length).toBeGreaterThanOrEqual(2);
  });

  // ─── Table captions ───────────────────────────────────────────────────────

  test("insert a Table caption above a paragraph", async () => {
    const insertedAt = await engine.captions.insertTableCaption(
      baseIndex,
      "Summary of experimental results",
      "above",
    );

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("SEQ Table");
    expect(xml).toContain("Summary of experimental results");
    expect(insertedAt).toBeLessThanOrEqual(baseIndex);
  });

  // ─── Equation captions ────────────────────────────────────────────────────

  test("insert an Equation caption", async () => {
    await engine.captions.insertEquationCaption(baseIndex, "Energy-mass equivalence");
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("SEQ Equation");
  });

  // ─── Custom label ─────────────────────────────────────────────────────────

  test("insert a caption with a custom label", async () => {
    await engine.captions.insertCustomCaption(
      baseIndex,
      "Listing",
      "TypeScript implementation of the parser",
    );
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("SEQ Listing");
    expect(xml).toContain("TypeScript implementation");
  });

  // ─── Exclude label ────────────────────────────────────────────────────────

  test("insert caption with label excluded", async () => {
    await engine.captions.insertCaption(baseIndex, {
      label: "Figure",
      text: "Unlabelled figure",
      excludeLabel: true,
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("SEQ Figure");
    // The label text "Figure " should not appear before the field
    expect(xml).toContain("Unlabelled figure");
  });

  // ─── Numbering formats ────────────────────────────────────────────────────

  test("insert caption with Roman numeral numbering", async () => {
    await engine.captions.insertCaption(baseIndex, {
      label: "Figure",
      text: "Roman numbered figure",
      numbering: { format: "ROMAN" },
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("ROMAN");
  });

  test("insert caption with alphabetic numbering", async () => {
    await engine.captions.insertCaption(baseIndex, {
      label: "Figure",
      text: "Alphabetically numbered",
      numbering: { format: "ALPHABETIC" },
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("ALPHABETIC");
  });

  test("insert caption with lowercase alphabetic numbering", async () => {
    await engine.captions.insertCaption(baseIndex, {
      label: "Figure",
      text: "Lowercase alphabetic",
      numbering: { format: "alphabetic" },
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("alphabetic");
  });

  // ─── Chapter number inclusion ─────────────────────────────────────────────

  test("insert caption with chapter number and hyphen separator", async () => {
    await engine.captions.insertCaption(baseIndex, {
      label: "Figure",
      text: "Chapter-numbered figure",
      numbering: {
        format: "arabic",
        includeChapterNumber: true,
        chapterStyle: "Heading1",
        chapterSeparator: "-",
      },
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("STYLEREF");
    expect(xml).toContain("\\s 1");
  });

  test("insert caption with chapter number and period separator", async () => {
    await engine.captions.insertCaption(baseIndex, {
      label: "Table",
      text: "Chapter table with period",
      numbering: {
        includeChapterNumber: true,
        chapterSeparator: ".",
      },
    });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("SEQ Table");
    expect(xml).toContain("STYLEREF");
  });

  // ─── getCaptions ──────────────────────────────────────────────────────────

  test("getCaptions returns all captions", async () => {
    const all = await engine.captions.getCaptions();
    expect(all.length).toBeGreaterThan(0);
    all.forEach((c) => {
      expect(c).toHaveProperty("label");
      expect(c).toHaveProperty("text");
      expect(c).toHaveProperty("paragraphIndex");
    });
  });

  test("getCaptions filtered by label returns only that label", async () => {
    const figures = await engine.captions.getCaptions("Figure");
    expect(figures.length).toBeGreaterThan(0);
    figures.forEach((c) => expect(c.label).toBe("Figure"));
  });

  // ─── removeCaptions ───────────────────────────────────────────────────────

  test("removeCaptions removes all captions for a label", async () => {
    // Add a caption we'll immediately delete
    await engine.captions.insertCaption(baseIndex, {
      label: "Appendix",
      text: "To be removed",
    });

    const before = await engine.captions.getCaptions("Appendix");
    expect(before.length).toBeGreaterThan(0);

    await engine.captions.removeCaptions("Appendix");
    const after = await engine.captions.getCaptions("Appendix");
    expect(after.length).toBe(0);
  });

  // ─── removeCaptionAt ──────────────────────────────────────────────────────

  test("removeCaptionAt removes a single caption by index", async () => {
    const allBefore = await engine.captions.getCaptions();
    const target    = allBefore[allBefore.length - 1];
    if (!target) return;

    await engine.captions.removeCaptionAt(target.paragraphIndex);
    const allAfter = await engine.captions.getCaptions();
    expect(allAfter.length).toBe(allBefore.length - 1);
  });

  // ─── Position ─────────────────────────────────────────────────────────────

  test("position above inserts caption before the target paragraph", async () => {
    const paragraphs = await engine.document.getParagraphs();
    const idx        = paragraphs.length - 1;
    const insertedAt = await engine.captions.insertCaption(idx, {
      label: "Figure",
      text:  "Above position test",
      position: "above",
    });
    expect(insertedAt).toBeLessThanOrEqual(idx);
  });

  test("position below inserts caption after the target paragraph", async () => {
    const paragraphs = await engine.document.getParagraphs();
    const idx        = paragraphs.length - 1;
    const insertedAt = await engine.captions.insertCaption(idx, {
      label: "Figure",
      text:  "Below position test",
      position: "below",
    });
    expect(insertedAt).toBe(idx + 1);
  });

  // ─── Caption style ────────────────────────────────────────────────────────

  test("caption paragraphs use the Caption style", async () => {
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:val="Caption"');
  });

  // ─── Save ─────────────────────────────────────────────────────────────────

  test("save captioned document to disk", async () => {
    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    expect(fs.statSync(OUTPUT).size).toBeGreaterThan(0);
    console.log(`\n✓ Output written to: ${OUTPUT}`);
  });
});
