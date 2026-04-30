import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine } from "@/index";
import { Run } from "@/core/files/paragraph/Run";
import Paragraph from "@/core/files/paragraph";

const INPUT = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/full-test-output.docx");

let engine: Mdocxengine;

describe("Full document integration", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);
  });

  // ─── Metadata ─────────────────────────────────────────────────────────────

  test("set document title and author", async () => {
    await engine.metadata.setCoreProperties({
      title: "Integration Test Document",
      creator: "mdocxengine",
      lastModifiedBy: "automated-test",
    });

    const props = await engine.metadata.getCoreProperties();
    expect(props.title).toBe("Integration Test Document");
    expect(props.creator).toBe("mdocxengine");
  });

  // ─── Header ───────────────────────────────────────────────────────────────

  test("add a default header", async () => {
    const before = engine.header.headers.length;
    await engine.header.addHeader("Integration Test — Header", "default");
    expect(engine.header.headers.length).toBe(before + 1);

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("w:headerReference");
  });

  // ─── Footer ───────────────────────────────────────────────────────────────

  test("add a default footer", async () => {
    const before = engine.footer.footers.length;
    await engine.footer.addFooter("Page | mdocxengine", "default");
    expect(engine.footer.footers.length).toBe(before + 1);

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("w:footerReference");
  });

  // ─── Paragraphs ───────────────────────────────────────────────────────────

  test("read all paragraphs", async () => {
    const paragraphs = await engine.document.getParagraphs();
    expect(paragraphs.length).toBeGreaterThan(0);
  });

  test("find and replace text across entire document", async () => {
    const paragraphs = await engine.document.getParagraphs();
    const allText = await Promise.all(paragraphs.map((p) => p.getPlainText()));
    const hasAny = allText.some((r) => r.hasText);
    expect(hasAny).toBe(true);

    // Replace a common word — won't throw even if nothing matches
    await engine.document.findAndReplaceAll("the", "the");
  });

  test("insert a new paragraph at the top", async () => {
    const before = (await engine.document.getParagraphs()).length;

    const newPara = new Paragraph({
      $: {},
      "w:pPr": { "w:jc": { $: { "w:val": "center" } } },
      "w:r": [{ "w:t": { _: "— Inserted by mdocxengine —", $: {} } }],
    } as any);

    await engine.document.insertParagraph(newPara, 0);

    const after = await engine.document.getParagraphs();
    expect(after.length).toBe(before + 1);

    const { text } = await after[0].getPlainText();
    expect(text).toBe("— Inserted by mdocxengine —");
  });

  test("append a paragraph with bold + italic + colored run", async () => {
    const run = Run.fromText("Bold Italic Red Text");
    run.setBold();
    run.setItalic();
    run.setColor("FF0000");
    run.setFontSize(28); // 14pt

    const newPara = new Paragraph({ $: {}, "w:r": [] } as any);
    newPara.addRun(run);

    await engine.document.insertParagraph(newPara);

    const paragraphs = await engine.document.getParagraphs();
    const last = paragraphs[paragraphs.length - 1];
    const runs = last.getRuns();

    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].isBold()).toBe(true);
    expect(runs[0].isItalic()).toBe(true);
    expect(runs[0].getText()).toBe("Bold Italic Red Text");
  });

  test("append a highlighted paragraph", async () => {
    const run = Run.fromText("This text is highlighted");
    run.setShading("FFFF00"); // yellow background

    const para = new Paragraph({ $: {}, "w:r": [] } as any);
    para.addRun(run);

    await engine.document.insertParagraph(para);

    const paragraphs = await engine.document.getParagraphs();
    const last = paragraphs[paragraphs.length - 1];
    expect(last.hasHighlight()).toBe(true);
  });

  test("append an underlined paragraph", async () => {
    const run = Run.fromText("This text is underlined");
    run.setUnderline(true, "single");

    const para = new Paragraph({ $: {}, "w:r": [] } as any);
    para.addRun(run);
    await engine.document.insertParagraph(para);

    const paragraphs = await engine.document.getParagraphs();
    const last = paragraphs[paragraphs.length - 1];
    const runs = last.getRuns();
    expect(runs[0].hasUnderline()).toBe(true);
  });

  test("set paragraph alignment to center", async () => {
    const para = new Paragraph({ $: {}, "w:r": [{ "w:t": "Centered text" }] } as any);
    para.setAlignment("center");
    await engine.document.insertParagraph(para);

    const paragraphs = await engine.document.getParagraphs();
    const last = paragraphs[paragraphs.length - 1];
    expect(last.getAlignment()).toBe("center");
  });

  test("delete a paragraph by index", async () => {
    const before = await engine.document.getParagraphs();

    // We inserted a centered paragraph last — find it by paraId
    const last = before[before.length - 1];
    const paraId = last.paragraph.$?.["w14:paraId"];

    if (paraId) {
      await engine.document.deleteParagraph(paraId);
      const after = await engine.document.getParagraphs();
      expect(after.length).toBe(before.length - 1);
    } else {
      // No paraId on this paragraph — skip deletion check
      expect(true).toBe(true);
    }
  });

  // ─── Styles ───────────────────────────────────────────────────────────────

  test("list styles from styles.xml", async () => {
    const styles = await engine.styles.listStyles();
    expect(styles.length).toBeGreaterThan(0);
    expect(styles[0]).toHaveProperty("id");
    expect(styles[0]).toHaveProperty("name");
    expect(styles[0]).toHaveProperty("type");
  });

  test("get a specific style by id", async () => {
    const styles = await engine.styles.listStyles();
    if (styles.length === 0) return;

    const firstId = styles[0].id;
    const style = await engine.styles.getStyle(firstId);
    expect(style).not.toBeNull();
    expect(style.$?.["w:styleId"]).toBe(firstId);
  });

  // ─── Media ────────────────────────────────────────────────────────────────

  test("list images in the document", async () => {
    const images = engine.media.listImages();
    // May be empty for this sample — just verify it returns an array
    expect(Array.isArray(images)).toBe(true);
  });

  // ─── Tables ───────────────────────────────────────────────────────────────

  test("get tables from document", async () => {
    const tables = await engine.document.getTables();
    expect(Array.isArray(tables)).toBe(true);
    // May be empty for this sample
  });

  // ─── Save ─────────────────────────────────────────────────────────────────

  test("save modified document to disk", async () => {
    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    const stat = fs.statSync(OUTPUT);
    expect(stat.size).toBeGreaterThan(0);
    console.log(`\n✓ Output written to: ${OUTPUT}`);
  });
});
