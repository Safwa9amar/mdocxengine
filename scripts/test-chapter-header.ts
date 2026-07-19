/**
 * test-chapter-header.ts
 *
 * Smoke test for mdocxengine's header/footer/page-layout managers.
 *
 * Produces an essentially EMPTY .docx whose page furniture is:
 *   - Header:  chapter number on the LEFT, chapter title on the RIGHT,
 *              with a solid BLACK bottom border under the whole header line.
 *   - Footer:  centered page number ("Page X").
 *   - Page:    A4, normal margins.
 *
 * The engine has no "create blank" — it loads an existing .docx, so we load
 * samples/example.docx and replace its body with a single empty paragraph.
 *
 * Usage:
 *   cd ~/mdocxengine && npx tsx scripts/test-chapter-header.ts
 */

import path from "path";
import { Mdocxengine } from "../src/index";
import Paragraph from "../src/core/files/paragraph/index";

const INPUT  = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/chapter-header-empty.docx");

// --- knobs ---------------------------------------------------------------
const CHAPTER_NUMBER = "Chapter 1";
const CHAPTER_TITLE  = "Introduction";
// A4 = 11906 twips wide; "normal" margins = 1440 twips each side.
// Right tab sits at the right margin so the title is flush-right.
const RIGHT_TAB_TWIPS = 11906 - 1440 - 1440; // 9026

function makeEmptyParagraph(): Paragraph {
  return new Paragraph({ $: {}, "w:pPr": {}, "w:r": [] });
}

/**
 * Build a custom header part: "Chapter N" (left) <tab> "Title" (right),
 * with a black bottom border under the line.
 */
function buildChapterHeaderXml(chapterNumber: string, chapterTitle: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr>
      <w:pStyle w:val="Header"/>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/>
      </w:pBdr>
      <w:tabs>
        <w:tab w:val="right" w:pos="${RIGHT_TAB_TWIPS}"/>
      </w:tabs>
    </w:pPr>
    <w:r><w:t xml:space="preserve">${chapterNumber}</w:t></w:r>
    <w:r><w:tab/></w:r>
    <w:r><w:t xml:space="preserve">${chapterTitle}</w:t></w:r>
  </w:p>
</w:hdr>`;
}

/** Empty footer shell so insertPageNumber() adds the only paragraph. */
function buildEmptyFooterXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>`;
}

async function main() {
  console.log("Loading base document:", INPUT);
  const engine = await Mdocxengine.loadFromFile(INPUT);

  // 1. Page layout — A4 + normal margins (so the right tab lands at the margin).
  console.log("1. Page layout: A4, normal margins");
  await engine.pageLayout.setPageSizePreset("A4", "portrait");
  await engine.pageLayout.setMarginPreset("normal");

  // 2. Empty the body — keep a single blank paragraph so the doc stays valid.
  console.log("2. Clearing body content");
  await engine.document.saveChanges([makeEmptyParagraph()]);

  // 3. Idempotency — remove any pre-existing headers/footers.
  console.log("3. Removing pre-existing headers/footers");
  for (const h of engine.header.getAllheadersFiles(engine.zip)) {
    await engine.header.removeHeader(h.fileName);
  }
  for (const f of engine.footer.getAllFooterFiles(engine.zip)) {
    await engine.footer.removeFooter(f.fileName);
  }

  // 4. Header — chapter number left, title right, black bottom border.
  console.log("4. Adding chapter header");
  const { headerPath } = await engine.header.addHeader(
    "", // text ignored when custom xml is supplied
    "default",
    buildChapterHeaderXml(CHAPTER_NUMBER, CHAPTER_TITLE),
  );
  console.log("   header part:", headerPath);

  // 5. Footer — centered page number.
  console.log("5. Adding footer with page number");
  const { footerPath } = await engine.footer.addFooter(
    "",
    "default",
    buildEmptyFooterXml(),
  );
  await engine.footer.insertPageNumber(footerPath, {
    alignment: "center",
    format: "decimal",
    prefix: "Page ",
  });
  console.log("   footer part:", footerPath);

  // 6. Save.
  console.log("6. Saving:", OUTPUT);
  await engine.saveToFile(OUTPUT);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
