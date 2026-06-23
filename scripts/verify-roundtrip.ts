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
import { parseOrderedDoc, nodeTag } from "../src/core/files/body/OrderedBody";

const DOC_PATH = "word/document.xml";

const DEFAULT_FILES = [
  "/Users/hamzasafwan/Downloads/هيكل المذكرة.docx",
  "/Users/hamzasafwan/modakerati-server/assets/templates/elbayadh-staps-template.docx",
  "/Users/hamzasafwan/Downloads/memoire qualite final.docx",
  "/Users/hamzasafwan/Downloads/مذكرة_بلعربي_علي_-_النسخة_النهائية.docx",
  "/Users/hamzasafwan/Downloads/الجانب_التطبيقي_بوصبيع_قويدر_v3_with_charts.docx",
];

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

interface Result {
  file: string;
  exists: boolean;
  order?: boolean;
  tables?: boolean;
  media?: boolean;
  textOk?: boolean;
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

  // 1. copy original to temp (read-only on the original).
  fs.copyFileSync(file, inCopy);

  try {
    // before facts
    const beforeZip = new AdmZip(inCopy);
    const before = factsFromZip(beforeZip);
    const totalTbl = (beforeZip.readAsText(DOC_PATH)?.match(/<w:tbl>/g) ?? []).length;

    // 2-4. identity round-trip through the engine.
    const eng = await Mdocxengine.loadFromFile(inCopy);
    const blocks = await eng.document.getBlocks();
    await eng.document.saveBlocks(blocks);
    await eng.saveToFile(outCopy);

    // 5. after facts.
    const afterZip = new AdmZip(outCopy);
    const after = factsFromZip(afterZip);

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
    };
  } catch (err: any) {
    return { file, exists: true, error: err?.stack ?? String(err) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args : DEFAULT_FILES;
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
    const pass = r.order && r.tables && r.media && r.textOk;
    if (!pass) allPass = false;
    const flag = (b?: boolean) => (b ? "ok " : "XX ");
    console.log(
      `${pass ? "PASS" : "FAIL"}  ${name}\n` +
        `        order:${flag(r.order)} tables:${flag(r.tables)} media:${flag(r.media)} text:${flag(r.textOk)}` +
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
