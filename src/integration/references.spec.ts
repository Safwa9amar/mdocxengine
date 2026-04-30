import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine } from "@/index";
import Paragraph from "@/core/files/paragraph";
import { Run } from "@/core/files/paragraph/Run";

const INPUT = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/references-test-output.docx");

let engine: Mdocxengine;

describe("References integration", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);
  });

  // ─── Footnotes ────────────────────────────────────────────────────────────

  test("add a footnote and get inline run", async () => {
    const { id, run } = await engine.footnotes.addFootnote("This is footnote text.");
    expect(id).toBeGreaterThan(0);
    expect(run).toBeDefined();
    expect((run as any)["w:footnoteReference"]?.["$"]?.["w:id"]).toBe(String(id));
  });

  test("retrieve footnotes list", async () => {
    const footnotes = await engine.footnotes.getFootnotes();
    expect(footnotes.length).toBeGreaterThan(0);
    expect(footnotes[0]).toHaveProperty("id");
    expect(footnotes[0]).toHaveProperty("text");
    expect(footnotes[0].text).toContain("footnote text");
  });

  test("add footnote run to a paragraph", async () => {
    const { id, run } = await engine.footnotes.addFootnote("Second footnote.");

    const para = new Paragraph({ $: {}, "w:r": [] } as any);
    const textRun = Run.fromText("See footnote");
    para.addRun(textRun);
    para.addRun(new Run(run));

    await engine.document.insertParagraph(para);

    const paragraphs = await engine.document.getParagraphs();
    const last = paragraphs[paragraphs.length - 1];
    const runs = last.getRuns();
    expect(runs.length).toBeGreaterThan(0);
    expect(id).toBeGreaterThan(0);
  });

  test("remove a footnote by id", async () => {
    const before = await engine.footnotes.getFootnotes();
    const firstId = before[0]?.id;
    if (!firstId) return;

    await engine.footnotes.removeFootnote(firstId);
    const after = await engine.footnotes.getFootnotes();
    expect(after.find((f) => f.id === firstId)).toBeUndefined();
  });

  // ─── Endnotes ─────────────────────────────────────────────────────────────

  test("add an endnote and get inline run", async () => {
    const { id, run } = await engine.endnotes.addEndnote("This is endnote text.");
    expect(id).toBeGreaterThan(0);
    expect(run).toBeDefined();
    expect((run as any)["w:endnoteReference"]?.["$"]?.["w:id"]).toBe(String(id));
  });

  test("retrieve endnotes list", async () => {
    const endnotes = await engine.endnotes.getEndnotes();
    expect(endnotes.length).toBeGreaterThan(0);
    expect(endnotes[0].text).toContain("endnote text");
  });

  test("remove an endnote by id", async () => {
    const before = await engine.endnotes.getEndnotes();
    const firstId = before[0]?.id;
    if (!firstId) return;

    await engine.endnotes.removeEndnote(firstId);
    const after = await engine.endnotes.getEndnotes();
    expect(after.find((e) => e.id === firstId)).toBeUndefined();
  });

  // ─── Table of Contents ────────────────────────────────────────────────────

  test("insert a table of contents at top of document", async () => {
    await engine.toc.insertTOC({ headingDepth: 3, title: "Contents" }, 0);

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("TOCHeading");
    expect(xml).toContain("TOC");
    expect(xml).toContain("Contents");
  });

  test("remove the table of contents", async () => {
    await engine.toc.removeTOC();
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).not.toContain("TOCHeading");
  });

  test("insert TOC without title", async () => {
    await engine.toc.insertTOC({ title: "" });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("TOC");
    await engine.toc.removeTOC();
  });

  // ─── Cross References ─────────────────────────────────────────────────────

  test("add a bookmark to a paragraph", async () => {
    const paragraphs = await engine.document.getParagraphs();
    const index = Math.max(0, paragraphs.length - 1);

    const id = await engine.crossRef.addBookmark(index, "section1", "Section One");
    expect(id).toBeGreaterThanOrEqual(0);

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("section1");
  });

  test("retrieve bookmarks", async () => {
    const bookmarks = await engine.crossRef.getBookmarks();
    expect(Array.isArray(bookmarks)).toBe(true);
    const found = bookmarks.find((b) => b.name === "section1");
    expect(found).toBeDefined();
  });

  test("create cross-reference runs for a bookmark", () => {
    const runs = engine.crossRef.createCrossRefRuns("section1", "See Section One");
    expect(runs.length).toBe(5);
    expect((runs[0] as any)["w:fldChar"]?.["$"]?.["w:fldCharType"]).toBe("begin");
    expect((runs[1] as any)["w:instrText"]?.["_"]).toContain("REF section1");
    expect((runs[4] as any)["w:fldChar"]?.["$"]?.["w:fldCharType"]).toBe("end");
  });

  test("remove a bookmark", async () => {
    await engine.crossRef.removeBookmark("section1");
    const bookmarks = await engine.crossRef.getBookmarks();
    expect(bookmarks.find((b) => b.name === "section1")).toBeUndefined();
  });

  // ─── Citations ────────────────────────────────────────────────────────────

  test("add a citation source", async () => {
    await engine.citations.addSource({
      tag: "Smith2020",
      sourceType: "Book",
      author: "Smith",
      title: "A Great Book",
      year: "2020",
      publisher: "Academic Press",
    });

    const sources = await engine.citations.getSources();
    const found = sources.find((s) => s.tag === "Smith2020");
    expect(found).toBeDefined();
    expect(found?.title).toBe("A Great Book");
  });

  test("create citation runs", () => {
    const runs = engine.citations.createCitationRuns("Smith2020");
    expect(runs.length).toBe(5);
    expect((runs[1] as any)["w:instrText"]?.["_"]).toContain("CITATION Smith2020");
  });

  test("insert bibliography", async () => {
    await engine.citations.insertBibliography();
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("BIBLIOGRAPHY");
  });

  test("remove a citation source", async () => {
    await engine.citations.removeSource("Smith2020");
    const sources = await engine.citations.getSources();
    expect(sources.find((s) => s.tag === "Smith2020")).toBeUndefined();
  });

  // ─── Save ─────────────────────────────────────────────────────────────────

  test("save references document to disk", async () => {
    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    const stat = fs.statSync(OUTPUT);
    expect(stat.size).toBeGreaterThan(0);
    console.log(`\n✓ Output written to: ${OUTPUT}`);
  });
});
