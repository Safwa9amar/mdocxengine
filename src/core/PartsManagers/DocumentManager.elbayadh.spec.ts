import { describe, test, expect } from "vitest";
import AdmZip from "adm-zip";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import DocumentManager from "./DocumentManager";
import { splitDocument, paragraphText } from "../files/body/OrderedBody";

/**
 * REGRESSION GATE — the real-world data-loss bug.
 *
 * The previous fast-xml-parser implementation MIS-NESTED two sibling <w:tbl>
 * inside the cover paragraph's run on this exact template; editParagraphText
 * then rebuilt that paragraph and silently DELETED the runs → 4 <w:tbl>
 * dropped to 2 (and the cover logo's drawing was at risk too). This test
 * loads the REAL El Bayadh STAPS template and edits the cover paragraph
 * (block 0, which carries the logo + tables follow it) AND a clean plain-text
 * paragraph, asserting that ALL 4 tables and the media logo survive in both
 * cases and that nothing else changes.
 *
 * This FAILS on the old implementation (tables drop 4→2) and PASSES on the
 * string splitter. The original template is never mutated (temp copy only).
 */
const TEMPLATE =
  "/Users/hamzasafwan/modakerati-server/assets/templates/elbayadh-staps-template.docx";
const DOC_PATH = "word/document.xml";
const SENTINEL = "MDOCX_SENTINEL_9F3A21";
const EMBED_RE = /<w:(?:drawing|pict|object)\b/;

const exists = fs.existsSync(TEMPLATE);

function tblCount(xml: string): number {
  return (xml.match(/<w:tbl>/g) ?? []).length;
}

function mediaEntries(zip: AdmZip): string[] {
  return zip
    .getEntries()
    .map((e) => e.entryName)
    .filter((n) => n.startsWith("word/media/"))
    .sort();
}

/** Map an editable-block index back to its index among ALL top-level blocks. */
function topLevelIndexOf(
  split: ReturnType<typeof splitDocument>,
  editableIndex: number,
): number {
  const positions = split.blocks
    .map((b, i) => ({ i, kind: b.kind }))
    .filter((e) => e.kind !== "sectPr")
    .map((e) => e.i);
  return positions[editableIndex];
}

function loadCopy(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "elbayadh-"));
  const tmpFile = path.join(tmpDir, "copy.docx");
  fs.copyFileSync(TEMPLATE, tmpFile);
  return tmpFile;
}

(exists ? describe : describe.skip)(
  "DocumentManager — El Bayadh template (real-world data-loss gate)",
  () => {
    test("baseline: the template really has 4 <w:tbl> and a media logo", () => {
      const zip = new AdmZip(loadCopy());
      const xml = zip.readAsText(DOC_PATH)!;
      expect(tblCount(xml)).toBe(4);
      expect(mediaEntries(zip).length).toBeGreaterThanOrEqual(1);
      // block 0 is the cover paragraph carrying the logo drawing.
      const split = splitDocument(xml);
      const block0 = split.blocks[0];
      expect(block0.kind).toBe("paragraph");
      expect(EMBED_RE.test(block0.xml)).toBe(true);
    });

    test("editing the COVER paragraph (block 0, with the logo) preserves all 4 tables + the logo", async () => {
      const tmpFile = loadCopy();

      const beforeZip = new AdmZip(tmpFile);
      const beforeXml = beforeZip.readAsText(DOC_PATH)!;
      const beforeMedia = mediaEntries(beforeZip);
      const beforeSplit = splitDocument(beforeXml);

      const beforeDm = new DocumentManager(beforeZip);
      const beforeBlocks = await beforeDm.getBlocks();
      // block 0 = the cover paragraph (the one that triggered the data loss).
      expect(beforeBlocks[0].kind).toBe("paragraph");

      // Edit it.
      const editZip = new AdmZip(tmpFile);
      const dm = new DocumentManager(editZip);
      await dm.editParagraphText(0, SENTINEL);
      editZip.writeZip(tmpFile);

      // Reload.
      const afterZip = new AdmZip(tmpFile);
      const afterXml = afterZip.readAsText(DOC_PATH)!;
      const afterDm = new DocumentManager(afterZip);
      const afterBlocks = await afterDm.getBlocks();
      const afterSplit = splitDocument(afterXml);

      // (a) ALL 4 tables survive — the core regression assertion.
      expect(tblCount(afterXml)).toBe(4);
      // (b) media (logo) unchanged.
      expect(mediaEntries(afterZip)).toEqual(beforeMedia);
      // (c) the logo drawing inside the cover paragraph survives (image-safe).
      expect(afterBlocks[0].xml).toContain("w:drawing");
      // (d) the sentinel landed in exactly the cover paragraph (and only once).
      expect(paragraphText(afterBlocks[0].xml)).toContain(SENTINEL);
      expect((afterXml.match(new RegExp(SENTINEL, "g")) ?? []).length).toBe(1);
      // (e) block order/kinds unchanged + sectPr last.
      expect(afterBlocks.map((b) => b.kind)).toEqual(beforeBlocks.map((b) => b.kind));
      expect(afterSplit.blocks.at(-1)?.kind).toBe("sectPr");
      // (f) every block EXCEPT the edited cover paragraph is byte-identical.
      const editedPos = topLevelIndexOf(beforeSplit, 0);
      expect(afterSplit.pre).toBe(beforeSplit.pre);
      expect(afterSplit.post).toBe(beforeSplit.post);
      expect(afterSplit.blocks.length).toBe(beforeSplit.blocks.length);
      for (let i = 0; i < beforeSplit.blocks.length; i++) {
        if (i === editedPos) continue;
        expect(afterSplit.blocks[i].xml).toBe(beforeSplit.blocks[i].xml);
      }

      fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
    });

    test("editing a CLEAN plain-text paragraph sets its text exactly + leaves all else byte-identical", async () => {
      const tmpFile = loadCopy();

      const beforeZip = new AdmZip(tmpFile);
      const beforeXml = beforeZip.readAsText(DOC_PATH)!;
      const beforeMedia = mediaEntries(beforeZip);
      const beforeSplit = splitDocument(beforeXml);

      const beforeDm = new DocumentManager(beforeZip);
      const beforeBlocks = await beforeDm.getBlocks();

      // Find the first clean, non-empty, image-free paragraph.
      const cleanIdx = beforeBlocks.findIndex(
        (b) =>
          b.kind === "paragraph" &&
          !EMBED_RE.test(b.xml) &&
          paragraphText(b.xml).trim().length > 0,
      );
      expect(cleanIdx).toBeGreaterThan(0);

      const editZip = new AdmZip(tmpFile);
      const dm = new DocumentManager(editZip);
      await dm.editParagraphText(cleanIdx, SENTINEL);
      editZip.writeZip(tmpFile);

      const afterZip = new AdmZip(tmpFile);
      const afterXml = afterZip.readAsText(DOC_PATH)!;
      const afterDm = new DocumentManager(afterZip);
      const afterBlocks = await afterDm.getBlocks();
      const afterSplit = splitDocument(afterXml);

      // Tables + media intact.
      expect(tblCount(afterXml)).toBe(4);
      expect(mediaEntries(afterZip)).toEqual(beforeMedia);

      // The clean paragraph now reads EXACTLY the sentinel.
      expect(paragraphText(afterBlocks[cleanIdx].xml)).toBe(SENTINEL);

      // Every OTHER paragraph's text is unchanged.
      for (let i = 0; i < beforeBlocks.length; i++) {
        if (i === cleanIdx) continue;
        if (beforeBlocks[i].kind !== "paragraph") continue;
        expect(paragraphText(afterBlocks[i].xml)).toBe(
          paragraphText(beforeBlocks[i].xml),
        );
      }

      // Byte-identical everywhere except the one edited paragraph.
      const editedPos = topLevelIndexOf(beforeSplit, cleanIdx);
      for (let i = 0; i < beforeSplit.blocks.length; i++) {
        if (i === editedPos) continue;
        expect(afterSplit.blocks[i].xml).toBe(beforeSplit.blocks[i].xml);
      }

      fs.rmSync(path.dirname(tmpFile), { recursive: true, force: true });
    });
  },
);
