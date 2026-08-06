import { describe, test, expect } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine } from "@/index";

/**
 * Word-parity guarantees for captions. These are the regressions that made the
 * caption tools unusable: rebuilding document.xml through an XML object model
 * regrouped the body by tag (every table torn away from its paragraphs) and
 * trimmed the whitespace-only runs Word writes between words.
 */

const THESIS = path.resolve("samples/hanachi.docx"); // real Arabic thesis, has tables
const SIMPLE = path.resolve("samples/example.docx");

/** Top-level children of <w:body>, in document order, by tag. */
function bodyOrder(xml: string): string {
  const openEnd = xml.indexOf(">", xml.indexOf("<w:body"));
  const inner = xml.slice(openEnd + 1, xml.lastIndexOf("</w:body>"));
  const out: string[] = [];
  let i = 0;
  let depth = 0;
  while (i < inner.length) {
    const lt = inner.indexOf("<", i);
    if (lt < 0) break;
    const gt = inner.indexOf(">", lt);
    if (gt < 0) break;
    const raw = inner.slice(lt + 1, gt);
    const closing = raw.startsWith("/");
    const selfClose = raw.endsWith("/");
    const name = raw.replace(/^\//, "").split(/[\s/>]/)[0];
    if (!closing && !selfClose) {
      if (depth === 0) out.push(name === "w:tbl" ? "T" : name === "w:p" ? "P" : "?");
      depth++;
    } else if (closing) depth--;
    i = gt + 1;
  }
  return out.join("");
}

function edgeSpaceRuns(xml: string): number {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]+)<\/w:t>/g)].filter((m) => m[1] !== m[1].trim()).length;
}

describe("captions — Word parity", () => {
  test("inserting a caption preserves body order and inter-word spaces", async () => {
    const engine = await Mdocxengine.loadFromFile(THESIS);
    const before = engine.zip.readAsText("word/document.xml")!;
    const orderBefore = bodyOrder(before);
    const spacesBefore = edgeSpaceRuns(before);
    const kindsBefore = (await engine.document.getBlocks()).map((b) => b.kind);

    const tableIndex = kindsBefore.indexOf("table");
    expect(tableIndex).toBeGreaterThanOrEqual(0);

    await engine.captions.insertTableCaption(tableIndex, "جدول الاختبار", "above");

    const after = engine.zip.readAsText("word/document.xml")!;
    // Exactly one paragraph added, every table still where it was.
    expect(bodyOrder(after)).toBe(orderBefore.slice(0, tableIndex) + "P" + orderBefore.slice(tableIndex));
    // The caption adds exactly two whitespace-bearing runs (label→number and
    // number→text separators) and destroys none of the document's 198 others.
    expect(edgeSpaceRuns(after)).toBe(spacesBefore + 2);
    expect(after.length).toBeLessThan(before.length * 1.05); // no pretty-print bloat

    // The caption sits directly above its table, in the SAME index space the
    // caller used.
    const kindsAfter = (await engine.document.getBlocks()).map((b) => b.kind);
    expect(kindsAfter[tableIndex]).toBe("paragraph");
    expect(kindsAfter[tableIndex + 1]).toBe("table");
  }, 120000);

  test("numbering follows DOCUMENT order, not insertion order", async () => {
    const engine = await Mdocxengine.loadFromFile(SIMPLE);
    await engine.captions.insertFigureCaption(40, "later figure");
    await engine.captions.insertFigureCaption(5, "earlier figure");
    await engine.captions.insertFigureCaption(20, "middle figure");

    const caps = await engine.captions.getCaptions("Figure");
    expect(caps.map((c) => c.text)).toEqual(["earlier figure", "middle figure", "later figure"]);
    expect(caps.map((c) => c.number)).toEqual(["1", "2", "3"]);
  }, 120000);

  test("number format and chapter numbering match the Word dialog", async () => {
    const engine = await Mdocxengine.loadFromFile(SIMPLE);
    await engine.captions.insertCaption(5, {
      label: "Table",
      text: "roman",
      numbering: { format: "ROMAN" },
    });
    await engine.captions.insertCaption(6, {
      label: "Table",
      text: "roman two",
      numbering: { format: "ROMAN" },
    });
    const caps = await engine.captions.getCaptions("Table");
    expect(caps.map((c) => c.number)).toEqual(["I", "II"]);

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:instr=" SEQ Table \\* ROMAN "');
  }, 120000);

  test("chapter numbers use Word's STYLEREF n \\s form and restart per chapter", async () => {
    const engine = await Mdocxengine.loadFromFile(SIMPLE);
    const blocks = await engine.document.getBlocks();
    const headings: number[] = [];
    blocks.forEach((b, i) => {
      if (b.kind === "paragraph" && /w:val="Heading1"/.test(b.xml)) headings.push(i);
    });
    expect(headings.length).toBeGreaterThanOrEqual(2);

    const numbering = { includeChapterNumber: true, chapterStyle: "Heading1", chapterSeparator: "-" as const };
    await engine.captions.insertCaption(headings[0] + 1, { label: "Figure", text: "in chapter one", numbering });
    // +1 for the caption just inserted before it
    await engine.captions.insertCaption(headings[1] + 2, { label: "Figure", text: "in chapter two", numbering });

    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain('w:instr=" STYLEREF 1 \\s "');
    expect(xml).toContain('w:instr=" SEQ Figure \\* ARABIC \\s 1 "');

    const caps = await engine.captions.getCaptions("Figure");
    // Each chapter restarts the figure numbering — Word's `\s 1`.
    expect(caps.map((c) => c.number)).toEqual(["1", "1"]);
  }, 120000);

  test("custom Arabic label numbers under a space-free SEQ identifier", async () => {
    const engine = await Mdocxengine.loadFromFile(SIMPLE);
    await engine.captions.insertCustomCaption(5, "الشكل رقم", "المخطط العام", { rtl: true });
    const xml = engine.zip.readAsText("word/document.xml")!;
    expect(xml).toContain("SEQ الشكل_رقم");   // SEQ names cannot contain spaces
    expect(xml).toContain("الشكل رقم");        // …but the document still READS the label
    expect(xml).toContain("<w:bidi/>");

    const [cap] = await engine.captions.getCaptions("الشكل رقم");
    expect(cap.displayLabel).toBe("الشكل رقم");
    expect(cap.text).toBe("المخطط العام");
    expect(cap.number).toBe("1");
  }, 120000);

  test("exclude label keeps the number only", async () => {
    const engine = await Mdocxengine.loadFromFile(SIMPLE);
    await engine.captions.insertCaption(5, { label: "Figure", text: "bare", excludeLabel: true });
    const [cap] = await engine.captions.getCaptions("Figure");
    expect(cap.displayLabel).toBe("");
    expect(cap.fullText).toBe("1 bare");
  }, 120000);

  test("editing a caption's text keeps its label, field and bookmark", async () => {
    const engine = await Mdocxengine.loadFromFile(SIMPLE);
    const at = await engine.captions.insertFigureCaption(5, "first wording");
    const [before] = await engine.captions.getCaptions("Figure");

    expect(await engine.captions.setCaptionText(at, "second wording")).toBe(true);

    const [after] = await engine.captions.getCaptions("Figure");
    expect(after.text).toBe("second wording");
    expect(after.number).toBe("1");
    expect(after.displayLabel).toBe("Figure");
    expect(after.bookmark).toBe(before.bookmark);
    expect(engine.zip.readAsText("word/document.xml")!).toContain("SEQ Figure");
  }, 120000);

  test("caption list points at bookmarks that actually exist", async () => {
    const engine = await Mdocxengine.loadFromFile(SIMPLE);
    await engine.captions.insertFigureCaption(5, "one");
    await engine.captions.insertFigureCaption(9, "two");
    await engine.captions.insertListOfFigures("List of Figures", 0);

    const xml = engine.zip.readAsText("word/document.xml")!;
    const targets = [...xml.matchAll(/PAGEREF\s+(\S+)\s/g)].map((m) => m[1]);
    expect(targets.length).toBe(2);
    for (const t of targets) expect(xml).toContain(`w:name="${t}"`);
    expect(xml).toContain('TOC \\h \\z \\c "Figure"');
    expect(xml).toContain("Figure 1 one");
    expect(xml).toContain("Figure 2 two");
  }, 120000);

  test("removing a caption renumbers the rest", async () => {
    const engine = await Mdocxengine.loadFromFile(SIMPLE);
    await engine.captions.insertFigureCaption(5, "a");
    await engine.captions.insertFigureCaption(7, "b");
    await engine.captions.insertFigureCaption(9, "c");
    const caps = await engine.captions.getCaptions("Figure");
    expect(caps.map((c) => c.number)).toEqual(["1", "2", "3"]);

    await engine.captions.removeCaptionAt(caps[0].blockIndex);
    const after = await engine.captions.getCaptions("Figure");
    expect(after.map((c) => c.text)).toEqual(["b", "c"]);
    expect(after.map((c) => c.number)).toEqual(["1", "2"]);
  }, 120000);

  test("Word-authored captions are read as-is, then renumbered on the next insert", async () => {
    const src = path.resolve("samples/MEMOIRE-ABDELMADJID-Rev-1.03.docx");
    if (!fs.existsSync(src)) return;
    const engine = await Mdocxengine.loadFromFile(src);

    // Word writes captions as fldSimple with custom labels ("Carte", "Planche").
    const labels = (await engine.captions.listLabels()).map((l) => l.label);
    expect(labels).toContain("Figure");
    expect(labels).toContain("Planche");

    const before = await engine.captions.getCaptions("Figure");
    expect(before.length).toBeGreaterThan(5);
    expect(before[0].displayLabel).toBe("Figure");
    expect(before[0].text).toBeTruthy();
    // Reading must not rewrite anything.
    expect(before.map((c) => c.number)).toEqual(before.map((c) => c.number));

    // Inserting one caption renumbers the whole sequence in document order,
    // which is exactly what Word shows after F9.
    await engine.captions.insertFigureCaption(before[0].blockIndex, "nouvelle figure");
    const after = await engine.captions.getCaptions("Figure");
    expect(after.map((c) => c.number)).toEqual(after.map((_, i) => String(i + 1)));
    expect(after.length).toBe(before.length + 1);
  }, 120000);
});
