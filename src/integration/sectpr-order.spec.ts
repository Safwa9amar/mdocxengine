import { describe, test, expect } from "vitest";
import path from "path";
import { Doc } from "../Doc";

const INPUT = path.resolve("samples/example.docx");

// Build a doc with a TABLE between two paragraphs, then cross a persist boundary.
async function tableDoc() {
  const doc = await Doc.open(INPUT);
  const n0 = (await doc.blocks()).length;
  await doc.addParagraph("P1", {}, n0);
  await doc.addTable([["a", "b"], ["1", "2"]], {}, n0 + 1);
  await doc.addParagraph("P2", {}, n0 + 2);
  return { doc: await Doc.open(doc.toBuffer()), n0 };
}
const tail = async (doc: Doc, n0: number) => (await doc.blocks()).slice(n0).map((b) => b.kind).join(",");

describe("byte-safe sectPr edits preserve table order", () => {
  test("baseline tail is paragraph,table,paragraph", async () => {
    const { doc, n0 } = await tableDoc();
    expect(await tail(doc, n0)).toBe("paragraph,table,paragraph");
  });

  test("setHeader does NOT reorder the table", async () => {
    let { doc, n0 } = await tableDoc();
    await doc.setHeader("My Header");
    doc = await Doc.open(doc.toBuffer());
    expect(await tail(doc, n0)).toBe("paragraph,table,paragraph");
    const hdr = doc.engine.zip.getEntries().filter((e) => /^word\/header\d+\.xml$/.test(e.entryName));
    expect(hdr.length).toBe(1);
  });

  test("setFooter (page numbers) does NOT reorder the table", async () => {
    let { doc, n0 } = await tableDoc();
    await doc.setFooter({ pageNumbers: true });
    doc = await Doc.open(doc.toBuffer());
    expect(await tail(doc, n0)).toBe("paragraph,table,paragraph");
  });

  test("start_on_new_page does NOT reorder the table", async () => {
    let { doc, n0 } = await tableDoc();
    await doc.startOnNewPage(n0 + 2); // P2 starts a new page
    doc = await Doc.open(doc.toBuffer());
    expect(await tail(doc, n0)).toBe("paragraph,table,paragraph");
    expect((await doc.engine.sections.getSections()).length).toBeGreaterThanOrEqual(2);
  });

  test("set_section_header + set_section_footer do NOT reorder the table", async () => {
    let { doc, n0 } = await tableDoc();
    await doc.startOnNewPage(n0 + 2);
    doc = await Doc.open(doc.toBuffer());
    await doc.setSectionHeader(n0 + 2, "Sec Header");
    await doc.setSectionFooter(n0 + 2, { pageNumbers: true });
    doc = await Doc.open(doc.toBuffer());
    expect(await tail(doc, n0)).toBe("paragraph,table,paragraph");
  });

  test("repeated header set/replace stays clean and ordered", async () => {
    let { doc, n0 } = await tableDoc();
    await doc.setHeader("First");
    await doc.setHeader("Second");
    doc = await Doc.open(doc.toBuffer());
    expect(await tail(doc, n0)).toBe("paragraph,table,paragraph");
    const hdr = doc.engine.zip.getEntries().filter((e) => /^word\/header\d+\.xml$/.test(e.entryName));
    expect(hdr.length).toBe(1); // no duplicate header parts
    expect(doc.engine.zip.getFileAsString(hdr[0].entryName)).toContain("Second");
  });

  test("full tool sequence (the original corruption repro) keeps the table in place", async () => {
    let { doc, n0 } = await tableDoc();
    await doc.addParagraph("الفصل الأول", { bold: true, rtl: true }, n0);
    await doc.setHeadingLevel(n0, 1);
    await doc.editParagraph(n0 + 1, "P1 edited");
    doc = await Doc.open(doc.toBuffer());
    await doc.setHeader("H");
    await doc.startOnNewPage(n0);
    await doc.setSectionHeader(n0, "Sec");
    doc = await Doc.open(doc.toBuffer());
    const kinds = (await doc.blocks()).slice(n0).map((b) => b.kind).join(",");
    // heading, edited P1, table, P2 — table still present and not shoved to the end
    expect(kinds).toContain("table");
    expect(kinds.endsWith("table")).toBe(false);
    expect((await doc.blocks())[n0].headingLevel).toBe(1);
  });
});
