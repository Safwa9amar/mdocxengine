/**
 * verify-roundtrip.ts — adversarial real-docx round-trip harness.
 *
 * For each given .docx:
 *   1. copy to a temp dir (NEVER mutate the original)
 *   2. Mdocxengine.loadFromFile → getBlocks()
 *   3. saveBlocks(sameBlocks)   (identity round-trip)
 *   4. saveToFile(tmpOut) → reload
 *   5. assert: ordered top-level body tag sequence unchanged, <w:tbl> count
 *      unchanged, word/media/* set unchanged, concatenated text unchanged
 *      (modulo whitespace).
 *
 * Prints a per-file PASS/FAIL matrix.
 *
 * Run:  npx tsx scripts/verify-roundtrip.ts [file1.docx file2.docx ...]
 * With no args it uses the default list of real theses below.
 */
import AdmZip from "adm-zip";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Mdocxengine } from "../src/index";
import { parseOrderedDoc, nodeTag, paragraphText } from "../src/core/files/body/OrderedBody";

const DOC_PATH = "word/document.xml";

// Provide one or more .docx paths as CLI args, e.g.
//   npx tsx scripts/verify-roundtrip.ts a.docx b.docx
// or set MDOCX_VERIFY_FILES to a path-separator-delimited list.
const DEFAULT_FILES = (process.env.MDOCX_VERIFY_FILES ?? "")
  .split(path.delimiter)
  .map((s) => s.trim())
  .filter(Boolean);

interface DocFacts {
  bodyTagSeq: string[];
  tblCount: number;
  media: string[];
  text: string;
}

function bodyTagSequence(xml: string): string[] {
  const { bodyChildren } = parseOrderedDoc(xml);
  return bodyChildren.map((n) => nodeTag(n));
}

/**
 * Concatenated w:t run text of the whole document, whitespace-collapsed.
 * The `(?:\s[^>]*)?>` guard requires the tag to be exactly `<w:t>` or
 * `<w:t ...>` — NOT `<w:tab>` / `<w:tbl>` (which share the `w:t` prefix).
 */
function allText(xml: string): string {
  const matches = xml.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g) ?? [];
  const text = matches
    .map((m) => m.replace(/<w:t(?:\s[^>]*)?>/, "").replace(/<\/w:t>$/, ""))
    .join("");
  // decode the handful of XML entities + collapse whitespace
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function mediaEntries(zip: AdmZip): string[] {
  return zip
    .getEntries()
    .map((e) => e.entryName)
    .filter((n) => n.startsWith("word/media/"))
    .sort();
}

function factsFromZip(zip: AdmZip): DocFacts {
  const xml = zip.readAsText(DOC_PATH) ?? "";
  return {
    bodyTagSeq: bodyTagSequence(xml),
    tblCount: bodyTagSequence(xml).filter((t) => t === "w:tbl").length,
    media: mediaEntries(zip),
    text: allText(xml),
  };
}

function seqEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

const EMBED_RE = /<w:(?:drawing|pict|object)\b/;
const EDIT_SENTINEL = "MDOCX_RT_SENTINEL_4B7";

interface Result {
  file: string;
  exists: boolean;
  // identity round-trip
  order?: boolean;
  tables?: boolean;
  media?: boolean;
  textOk?: boolean;
  identityBytes?: boolean; // document.xml byte-identical after saveBlocks(same)
  // edit round-trip (editParagraphText on a clean paragraph)
  editTables?: boolean;
  editMedia?: boolean;
  editOtherText?: boolean; // every non-edited paragraph's text unchanged
  editSentinel?: boolean; // edited paragraph now reads exactly the sentinel
  error?: string;
  blockCount?: number;
  tableTotal?: number; // total <w:tbl> incl. nested
  mediaCount?: number;
}

async function verifyFile(file: string, tmpRoot: string): Promise<Result> {
  if (!fs.existsSync(file)) {
    return { file, exists: false };
  }

  const base = path.basename(file).replace(/[^\w.-]+/g, "_");
  const inCopy = path.join(tmpRoot, `in_${base}`);
  const outCopy = path.join(tmpRoot, `out_${base}`);
  const editCopy = path.join(tmpRoot, `edit_${base}`);

  // 1. copy original to temp (read-only on the original).
  fs.copyFileSync(file, inCopy);

  try {
    // before facts
    const beforeZip = new AdmZip(inCopy);
    const before = factsFromZip(beforeZip);
    const beforeDocXml = beforeZip.readAsText(DOC_PATH) ?? "";
    const totalTbl = (beforeDocXml.match(/<w:tbl>/g) ?? []).length;

    // ── IDENTITY round-trip: getBlocks → saveBlocks(same) → reload. ──
    const eng = await Mdocxengine.loadFromFile(inCopy);
    const blocks = await eng.document.getBlocks();
    await eng.document.saveBlocks(blocks);
    await eng.saveToFile(outCopy);

    const afterZip = new AdmZip(outCopy);
    const after = factsFromZip(afterZip);
    const afterDocXml = afterZip.readAsText(DOC_PATH) ?? "";

    // ── EDIT round-trip: editParagraphText on a CLEAN paragraph, reload,
    //    assert tables/media/other-text unchanged + sentinel landed. ──
    fs.copyFileSync(file, editCopy);
    const eng2 = await Mdocxengine.loadFromFile(editCopy);
    const blocks2 = await eng2.document.getBlocks();
    const beforeTexts = blocks2.map((b) =>
      b.kind === "paragraph" ? paragraphText(b.xml) : null,
    );
    // first clean (image-free, non-empty) paragraph; fall back to first paragraph
    let editIdx = blocks2.findIndex(
      (b) =>
        b.kind === "paragraph" &&
        !EMBED_RE.test(b.xml) &&
        paragraphText(b.xml).trim().length > 0,
    );
    if (editIdx === -1) editIdx = blocks2.findIndex((b) => b.kind === "paragraph");

    let editTables: boolean | undefined;
    let editMedia: boolean | undefined;
    let editOtherText: boolean | undefined;
    let editSentinel: boolean | undefined;

    if (editIdx !== -1) {
      await eng2.document.editParagraphText(editIdx, EDIT_SENTINEL);
      const editTmpOut = path.join(tmpRoot, `editout_${base}`);
      await eng2.saveToFile(editTmpOut);

      const editZip = new AdmZip(editTmpOut);
      const editDocXml = editZip.readAsText(DOC_PATH) ?? "";
      const editFacts = factsFromZip(editZip);
      const editEng = await Mdocxengine.loadFromFile(editTmpOut);
      const editBlocks = await editEng.document.getBlocks();
      const afterTexts = editBlocks.map((b) =>
        b.kind === "paragraph" ? paragraphText(b.xml) : null,
      );

      editTables = totalTbl === (editDocXml.match(/<w:tbl>/g) ?? []).length;
      editMedia = seqEqual(before.media, editFacts.media);
      editSentinel = paragraphText(editBlocks[editIdx].xml) === EDIT_SENTINEL;
      editOtherText =
        afterTexts.length === beforeTexts.length &&
        afterTexts.every((t, i) => i === editIdx || t === beforeTexts[i]);
    }

    return {
      file,
      exists: true,
      blockCount: blocks.length,
      tableTotal: totalTbl,
      mediaCount: before.media.length,
      order: seqEqual(before.bodyTagSeq, after.bodyTagSeq),
      tables: before.tblCount === after.tblCount,
      media: seqEqual(before.media, after.media),
      textOk: before.text === after.text,
      identityBytes: beforeDocXml === afterDocXml,
      editTables,
      editMedia,
      editOtherText,
      editSentinel,
    };
  } catch (err: any) {
    return { file, exists: true, error: err?.stack ?? String(err) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args : DEFAULT_FILES;
  if (files.length === 0) {
    console.log(
      "Usage: npx tsx scripts/verify-roundtrip.ts <file1.docx> [file2.docx ...]\n" +
        "   or: MDOCX_VERIFY_FILES=\"a.docx:b.docx\" npx tsx scripts/verify-roundtrip.ts",
    );
    return;
  }
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mdocx-rt-"));

  const results: Result[] = [];
  for (const f of files) {
    results.push(await verifyFile(f, tmpRoot));
  }

  console.log("\n=== Round-trip verification matrix ===");
  console.log(`(temp dir: ${tmpRoot})\n`);
  let allPass = true;
  for (const r of results) {
    const name = path.basename(r.file);
    if (!r.exists) {
      console.log(`SKIP  (missing)  ${name}`);
      continue;
    }
    if (r.error) {
      allPass = false;
      console.log(`FAIL  (error)    ${name}\n        ${r.error.split("\n").slice(0, 4).join("\n        ")}`);
      continue;
    }
    const identityPass = r.order && r.tables && r.media && r.textOk && r.identityBytes;
    const editPass = r.editTables && r.editMedia && r.editOtherText && r.editSentinel;
    const pass = identityPass && editPass;
    if (!pass) allPass = false;
    const flag = (b?: boolean) => (b ? "ok " : "XX ");
    console.log(
      `${pass ? "PASS" : "FAIL"}  ${name}\n` +
        `        identity: order:${flag(r.order)} tables:${flag(r.tables)} media:${flag(r.media)} text:${flag(r.textOk)} bytes:${flag(r.identityBytes)}\n` +
        `        edit:     tables:${flag(r.editTables)} media:${flag(r.editMedia)} otherText:${flag(r.editOtherText)} sentinel:${flag(r.editSentinel)}` +
        `   [blocks:${r.blockCount} tbl:${r.tableTotal} media:${r.mediaCount}]`,
    );
  }
  console.log(`\n${allPass ? "ALL PASS ✅" : "SOME FAILED ❌"}\n`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
