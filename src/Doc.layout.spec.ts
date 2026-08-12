import { describe, test, expect } from "vitest";
import path from "path";
import { Doc } from "./Doc";

const INPUT = path.resolve("samples/example.docx");

const headerFiles = (doc: Doc) =>
  doc.engine.zip.getEntries().filter((e) => /^word\/header\d+\.xml$/.test(e.entryName));
const footerFiles = (doc: Doc) =>
  doc.engine.zip.getEntries().filter((e) => /^word\/footer\d+\.xml$/.test(e.entryName));

describe("Doc layout / section verbs", () => {
  test("setHeader adds a document header; empty removes it", async () => {
    const doc = await Doc.open(INPUT);
    await doc.setHeader("My Thesis Title");
    const hdr = headerFiles(doc).map((e) => doc.engine.zip.getFileAsString(e.entryName) ?? "");
    expect(hdr.some((x) => x.includes("My Thesis Title"))).toBe(true);

    await doc.setHeader("");
    expect(headerFiles(doc).length).toBe(0);
  });

  test("setFooter with page numbers creates a footer carrying a PAGE field", async () => {
    const doc = await Doc.open(INPUT);
    await doc.setFooter({ text: "Confidential", pageNumbers: true, alignment: "center" });
    const ftr = footerFiles(doc).map((e) => doc.engine.zip.getFileAsString(e.entryName) ?? "").join("\n");
    expect(ftr).toContain("Confidential");
    expect(ftr).toMatch(/PAGE/);
  });

  test("startOnNewPage adds a section; first-content is a no-op", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addHeading("New Part", 1);
    const headingIdx = (await doc.blocks()).length - 1;
    const sectionsBefore = (await doc.engine.sections.getSections()).length;

    const r = await doc.startOnNewPage(headingIdx);
    expect(r.changed).toBe(true);
    const sectionsAfter = (await doc.engine.sections.getSections()).length;
    expect(sectionsAfter).toBe(sectionsBefore + 1);

    // Block 0 has no paragraph before it → nothing to break from.
    const r0 = await doc.startOnNewPage(0);
    expect(r0.changed).toBe(false);
  });

  test("setSectionHeader/Footer target the section containing the block", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addHeading("Part Two", 1);
    const headingIdx = (await doc.blocks()).length - 1;
    await doc.startOnNewPage(headingIdx); // make it its own section

    const h = await doc.setSectionHeader(headingIdx, "Part Two — Methods");
    expect(h.totalSections).toBeGreaterThanOrEqual(2);
    expect(h.sectionIndex).toBeGreaterThanOrEqual(0);

    const f = await doc.setSectionFooter(headingIdx, { pageNumbers: true });
    expect(f.sectionIndex).toBe(h.sectionIndex);

    // A header part carrying our text now exists.
    const hdr = headerFiles(doc).map((e) => doc.engine.zip.getFileAsString(e.entryName) ?? "").join("\n");
    expect(hdr).toContain("Part Two — Methods");
  });

  test("getSections parses w:pgNumType (format + start)", async () => {
    const doc = await Doc.open(INPUT);
    await doc.setFooter({ pageNumbers: true });
    await doc.engine.footer.formatPageNumbers({ format: "lowerRoman", startAt: 1 });
    const secs = await doc.engine.sections.getSections();
    const final = secs[secs.length - 1];
    expect(final.pageNumberType).toEqual({ format: "lowerRoman", start: 1 });
  });

  test("sections() maps start block indices and resolves header inheritance", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addHeading("Part One", 1);
    await doc.addParagraph("p1");
    await doc.addHeading("Part Two", 1);
    await doc.addParagraph("p2");
    await doc.addHeading("Part Three", 1);
    await doc.addParagraph("p3");
    const blocks = await doc.blocks();
    const two = blocks.findIndex((b) => b.text === "Part Two");
    const three = blocks.findIndex((b) => b.text === "Part Three");
    // addSectionBreak mutates an existing paragraph in place — indices stay valid.
    await doc.startOnNewPage(two);
    await doc.startOnNewPage(three);
    await doc.setSectionHeader(two, "Part Two — Methods");
    await doc.setSectionFooter(two, { text: "Conf", pageNumbers: true });

    const secs = await doc.sections();
    expect(secs.length).toBe(3);
    expect(secs[0].startBlockIndex).toBe(0);
    expect(secs[1].startBlockIndex).toBe(two);
    expect(secs[2].startBlockIndex).toBe(three);
    // Section 0 has no part of its own and nothing before it → none.
    expect(secs[0].headerText).toBeNull();
    expect(secs[0].footerText).toBeNull();
    expect(secs[0].footerHasPageNumbers).toBe(false);
    // Section 1 owns both parts.
    expect(secs[1].headerText).toBe("Part Two — Methods");
    expect(secs[1].footerText).toBe("Conf");
    expect(secs[1].footerHasPageNumbers).toBe(true);
    // Section 2 has no refs → inherits section 1's parts (ECMA-376).
    expect(secs[2].headerText).toBe("Part Two — Methods");
    expect(secs[2].footerHasPageNumbers).toBe(true);
  });

  test("sections() on an untouched document reports one bare section", async () => {
    const doc = await Doc.open(INPUT);
    const secs = await doc.sections();
    expect(secs.length).toBe(1);
    expect(secs[0].startBlockIndex).toBe(0);
    expect(secs[0].headerText).toBeNull();
    expect(secs[0].footerText).toBeNull();
  });

  test("sections() blank own header part stops inheritance", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addHeading("Alpha Part", 1);
    await doc.addParagraph("a1");
    await doc.addHeading("Beta Part", 1);
    await doc.addParagraph("b1");
    await doc.addHeading("Gamma Part", 1);
    await doc.addParagraph("g1");
    const blocks = await doc.blocks();
    const beta = blocks.findIndex((b) => b.text === "Beta Part");
    const gamma = blocks.findIndex((b) => b.text === "Gamma Part");
    await doc.startOnNewPage(beta);
    await doc.startOnNewPage(gamma);
    await doc.setSectionHeader(beta, "Own");
    await doc.setSectionHeader(gamma, ""); // explicitly blank part

    const secs = await doc.sections();
    expect(secs.length).toBe(3);
    expect(secs[1].headerText).toBe("Own");
    // A blank part is still an OWN part — it overrides, not inherits.
    expect(secs[2].headerText).toBe("");
  });

  test("sections() keeps non-page field results and strips page fields (complex + fldSimple)", async () => {
    const doc = await Doc.open(INPUT);
    // A running header as Word writes it: a complex STYLEREF field whose cached
    // result is the current chapter title, plus a fldSimple PAGE field with a
    // cached page number.
    const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> STYLEREF "Heading 1" \\* MERGEFORMAT </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:t>Chapter One</w:t></w:r>
    <w:r><w:fldChar w:fldCharType="end"/></w:r>
    <w:fldSimple w:instr=" PAGE \\* MERGEFORMAT "><w:r><w:t>7</w:t></w:r></w:fldSimple>
  </w:p>
</w:hdr>`;
    await doc.engine.header.addHeader("", "default", headerXml);

    const secs = await doc.sections();
    expect(secs.length).toBe(1);
    expect(secs[0].headerText).toContain("Chapter One");
    expect(secs[0].headerText).not.toContain("7");
  });

  test("sections() startBlockIndex stays correct when the document starts with a table", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addTable([["a", "b"], ["1", "2"]], {}, 0); // FIRST block is a table
    await doc.addHeading("Late Part", 1);
    const blocks = await doc.blocks();
    expect(blocks[0].kind).toBe("table");
    const headingIdx = blocks.findIndex((b) => b.text === "Late Part");
    await doc.startOnNewPage(headingIdx);

    const secs = await doc.sections();
    expect(secs.length).toBe(2);
    expect(secs[0].startBlockIndex).toBe(0);
    // Paragraph→block mapping is shifted by the table; the section must still
    // start at the heading's BLOCK index.
    expect(secs[1].startBlockIndex).toBe(headingIdx);
  });

  test("sections(preloadedBlocks) matches sections() on a 3-section doc", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addHeading("Pre One", 1);
    await doc.addParagraph("p1");
    await doc.addHeading("Pre Two", 1);
    await doc.addParagraph("p2");
    await doc.addHeading("Pre Three", 1);
    await doc.addParagraph("p3");
    const blocks = await doc.blocks();
    const two = blocks.findIndex((b) => b.text === "Pre Two");
    const three = blocks.findIndex((b) => b.text === "Pre Three");
    await doc.startOnNewPage(two);
    await doc.startOnNewPage(three);
    await doc.setSectionHeader(two, "Pre Two — Methods");
    await doc.setSectionFooter(two, { text: "Conf", pageNumbers: true });

    const fresh = await doc.sections();
    const preloaded = await doc.sections(await doc.engine.document.getBlocks());
    expect(fresh.length).toBe(3);
    expect(preloaded).toEqual(fresh);
  });

  test("sections() derives pageNumberFormat from the PAGE field switch (no pgNumType)", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addPageNumbers({ format: "lowerRoman" });
    // The insertion path encodes the format ONLY as a field switch — no pgNumType.
    const raw = await doc.engine.sections.getSections();
    expect(raw[raw.length - 1].pageNumberType).toBeUndefined();

    const secs = await doc.sections();
    expect(secs.length).toBe(1);
    expect(secs[0].footerHasPageNumbers).toBe(true);
    expect(secs[0].pageNumberFormat).toBe("lowerRoman");
  });

  test("sections() lets w:pgNumType override the field-switch format", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addPageNumbers({ format: "lowerRoman" });
    await doc.engine.footer.formatPageNumbers({ format: "upperRoman" });
    const secs = await doc.sections();
    expect(secs.length).toBe(1);
    expect(secs[0].pageNumberFormat).toBe("upperRoman");
  });

  test("sections() ignores first/even-only header refs (default parts only)", async () => {
    const doc = await Doc.open(INPUT);
    await doc.engine.header.addHeader("First Page Only", "first");
    const secs = await doc.sections();
    expect(secs.length).toBe(1);
    expect(secs[0].headerText).toBeNull();
  });

  test("formatPageNumbers keeps the block count (no phantom #text blocks)", async () => {
    const doc = await Doc.open(INPUT);
    const before = (await doc.blocks()).length;
    await doc.engine.footer.formatPageNumbers({ format: "lowerRoman", startAt: 1 });
    const after = (await doc.blocks()).length;
    expect(after).toBe(before);
  });

  test("getBlocks heals an already-prettified document.xml", async () => {
    const doc = await Doc.open(INPUT);
    const before = (await doc.blocks()).length;
    // Simulate a doc previously corrupted by a pretty-printing round-trip:
    // whitespace between top-level body children.
    const xml = doc.engine.zip.readAsText("word/document.xml");
    const prettified = xml.replace(/(<\/w:p>)(<w:p)/g, "$1\n  $2");
    expect(prettified.length).toBeGreaterThan(xml.length); // injection happened
    doc.engine.zip.addFile("word/document.xml", Buffer.from(prettified, "utf-8"));
    const after = (await doc.blocks()).length;
    expect(after).toBe(before);

    // Positional edits must address the SAME healed index space.
    await doc.editParagraph(1, "Healed edit");
    const blocks = await doc.blocks();
    expect(blocks.length).toBe(before);
    expect(blocks[1].text).toBe("Healed edit");
  });

  test("setSectionVerticalAlign centres a section's content vertically, in schema order", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addHeading("Divider", 1);
    const idx = (await doc.blocks()).length - 1;
    await doc.startOnNewPage(idx);

    await doc.setSectionVerticalAlign(idx, "center");

    const xml = doc.engine.zip.getFileAsString("word/document.xml") ?? "";
    expect(xml).toMatch(/<w:vAlign w:val="center"\/>/);
    // The document may hold MULTIPLE sectPr (the section-break paragraph gets
    // its own minimal one) — locate the sectPr that actually CONTAINS our
    // vAlign, not just the first one in document order.
    const vAlignPos = xml.indexOf("<w:vAlign");
    const sect = xml.slice(xml.lastIndexOf("<w:sectPr", vAlignPos), xml.indexOf("</w:sectPr>", vAlignPos));
    const mar = sect.indexOf("<w:pgMar");
    if (mar !== -1) expect(sect.indexOf("<w:vAlign")).toBeGreaterThan(mar);
  });

  test("setSectionPageBorders draws four edges and sits BEFORE vAlign in the sequence", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addHeading("Divider", 1);
    const idx = (await doc.blocks()).length - 1;
    await doc.startOnNewPage(idx);
    await doc.setSectionVerticalAlign(idx, "center");
    await doc.setSectionPageBorders(idx, { style: "double", color: "#6b4f2a", widthPt: 3 });

    const xml = doc.engine.zip.getFileAsString("word/document.xml") ?? "";
    // Same multi-sectPr caveat as above: anchor on the vAlign we just wrote so
    // we slice the section that actually got the border, not the section-break
    // paragraph's own (unrelated) sectPr.
    const vAlignPos = xml.indexOf("<w:vAlign");
    const sect = xml.slice(xml.lastIndexOf("<w:sectPr", vAlignPos), xml.indexOf("</w:sectPr>", vAlignPos));
    for (const edge of ["top", "left", "bottom", "right"]) {
      expect(sect).toMatch(new RegExp(`<w:${edge} w:val="double" w:sz="24" w:space="24" w:color="6B4F2A"/>`));
    }
    expect(sect.indexOf("<w:pgBorders")).toBeLessThan(sect.indexOf("<w:vAlign"));
  });

  test("setSectionPageBorders refuses a non-hex colour", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addHeading("Divider", 1);
    const idx = (await doc.blocks()).length - 1;
    await expect(doc.setSectionPageBorders(idx, { style: "single", color: "red", widthPt: 1 }))
      .rejects.toThrow(/6-digit hex/);
  });

  test("sections() reports page geometry, inheriting the body sectPr", async () => {
    const doc = await Doc.open(INPUT);
    const base = await doc.sections();
    expect(base[0].page).not.toBeNull();
    expect(base[0].page!.widthTwips).toBeGreaterThan(0);
    expect(base[0].page!.heightTwips).toBeGreaterThan(0);
    expect(base[0].page!.margins.top).toBeGreaterThanOrEqual(0);

    // A section made by startOnNewPage writes only <w:type/> — no pgSz/pgMar —
    // so it must inherit the body sectPr's geometry rather than report null.
    await doc.addHeading("Part Two", 1);
    const headingIdx = (await doc.blocks()).length - 1;
    await doc.startOnNewPage(headingIdx);

    const after = await doc.sections();
    expect(after.length).toBeGreaterThan(base.length);
    const inherited = after[after.length - 2]; // the section the break created
    expect(inherited.page).not.toBeNull();
    expect(inherited.page!.widthTwips).toBe(base[0].page!.widthTwips);
    expect(inherited.page!.heightTwips).toBe(base[0].page!.heightTwips);
  });
});
