/**
 * Format unformatted.docx – Arabic academic research paper
 * Uses Mdocxengine PartsManagers, Paragraph API, Run API, and Table API throughout.
 * No raw XML string builder functions.
 */
import path from "path";
import { Mdocxengine, Table } from "../src/index";
import { buildXml } from "../src/utils/xmlUtils";
import type Paragraph from "../src/core/files/paragraph/index";

const INPUT  = path.resolve("samples/unformatted.docx");
const OUTPUT = path.resolve("samples/outputs/formatted.docx");

// ── Fonts & colours ─────────────────────────────────────────────────────────
const AF = "Traditional Arabic";
const LF = "Times New Roman";

const C_H1_BG = "1F3864";
const C_H2    = "1F3864";
const C_H3    = "2E75B6";
const C_CAP   = "595959";
const C_QUOTE = "404040";
const C_THDR  = "2E4057";
const C_TALT  = "EFF6FF";

// ── Text extraction from xml2js paragraph objects ────────────────────────────

function getText(p: Paragraph): string {
  const parts: string[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    const t = node["w:t"];
    if (t !== undefined) {
      parts.push(typeof t === "string" ? t : (t._ ?? ""));
    }
    for (const key of Object.keys(node)) {
      if (key === "w:t") continue;
      const val = node[key];
      if (Array.isArray(val)) val.forEach(walk);
      else if (val && typeof val === "object") walk(val);
    }
  };
  walk(p.paragraph);
  return parts.join("").trim();
}

function getTabCells(p: Paragraph): string[] {
  const segments: string[] = [""];
  const runs = p.paragraph["w:r"];
  if (!runs) return segments;
  const arr = Array.isArray(runs) ? runs : [runs];
  for (const run of arr) {
    if (run["w:tab"] !== undefined) {
      segments.push("");
    } else if (run["w:t"] !== undefined) {
      const t = run["w:t"];
      segments[segments.length - 1] += typeof t === "string" ? t : (t._ ?? "");
    }
  }
  return segments.map((s) => s.trim());
}

// ── Paragraph properties helper (direct xml2js object mutation) ──────────────

interface PPrOpts {
  jc?: string;
  bidi?: boolean;
  outlineLvl?: number;
  spacing?: { before?: number; after?: number };
  ind?: { left?: number; right?: number; firstLine?: number; hanging?: number };
  shd?: string;
  pBdrRight?: { val: string; sz: number; color: string };
}

function applyPPr(p: Paragraph, opts: PPrOpts): void {
  if (!p.paragraph["w:pPr"]) p.paragraph["w:pPr"] = {};
  const pPr = p.paragraph["w:pPr"];

  if (opts.bidi)                   pPr["w:bidi"]      = {};
  if (opts.jc)                     pPr["w:jc"]        = { $: { "w:val": opts.jc } };
  if (opts.outlineLvl !== undefined)
    pPr["w:outlineLvl"] = { $: { "w:val": String(opts.outlineLvl) } };

  if (opts.spacing) {
    const s: any = {};
    if (opts.spacing.before !== undefined) s["w:before"] = String(opts.spacing.before);
    if (opts.spacing.after  !== undefined) s["w:after"]  = String(opts.spacing.after);
    pPr["w:spacing"] = { $: s };
  }
  if (opts.ind) {
    const d: any = {};
    if (opts.ind.left      !== undefined) d["w:left"]      = String(opts.ind.left);
    if (opts.ind.right     !== undefined) d["w:right"]     = String(opts.ind.right);
    if (opts.ind.firstLine !== undefined) d["w:firstLine"] = String(opts.ind.firstLine);
    if (opts.ind.hanging   !== undefined) d["w:hanging"]   = String(opts.ind.hanging);
    pPr["w:ind"] = { $: d };
  }
  if (opts.shd)
    pPr["w:shd"] = { $: { "w:val": "clear", "w:color": "auto", "w:fill": opts.shd } };

  if (opts.pBdrRight) {
    pPr["w:pBdr"] = {
      "w:right": {
        $: {
          "w:val":   opts.pBdrRight.val,
          "w:sz":    String(opts.pBdrRight.sz),
          "w:space": "4",
          "w:color": opts.pBdrRight.color,
        },
      },
    };
  }
}

// ── Run formatting helper – uses Run class API ───────────────────────────────

interface RunStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fontSize?: number; // in points
}

function styleRuns(p: Paragraph, opts: RunStyle): void {
  const runs = p.getRuns();
  if (!runs.length) return;
  runs.forEach((r) => {
    r.setFontFamily(LF, AF);
    if (opts.bold    !== undefined) r.setBold(opts.bold);
    if (opts.italic  !== undefined) r.setItalic(opts.italic);
    if (opts.color)                 r.setColor(opts.color);
    if (opts.fontSize)              r.setFontSize(opts.fontSize * 2);
    // RTL mark on the underlying run object
    const raw = r.toObject() as any;
    if (!raw["w:rPr"]) raw["w:rPr"] = {};
    raw["w:rPr"]["w:rtl"] = {};
  });
}

// ── Style factory – returns xml2js-format object for engine.styles.addStyle ──

function makeStyle(
  id: string,
  name: string,
  pOpts: PPrOpts,
  rOpts: RunStyle,
): any {
  const pPr: any = {};
  if (pOpts.bidi)                    pPr["w:bidi"]       = {};
  if (pOpts.jc)                      pPr["w:jc"]         = { $: { "w:val": pOpts.jc } };
  if (pOpts.outlineLvl !== undefined)
    pPr["w:outlineLvl"] = { $: { "w:val": String(pOpts.outlineLvl) } };
  if (pOpts.spacing) {
    const s: any = {};
    if (pOpts.spacing.before !== undefined) s["w:before"] = String(pOpts.spacing.before);
    if (pOpts.spacing.after  !== undefined) s["w:after"]  = String(pOpts.spacing.after);
    pPr["w:spacing"] = { $: s };
  }
  if (pOpts.ind) {
    const d: any = {};
    if (pOpts.ind.left      !== undefined) d["w:left"]      = String(pOpts.ind.left);
    if (pOpts.ind.right     !== undefined) d["w:right"]     = String(pOpts.ind.right);
    if (pOpts.ind.firstLine !== undefined) d["w:firstLine"] = String(pOpts.ind.firstLine);
    if (pOpts.ind.hanging   !== undefined) d["w:hanging"]   = String(pOpts.ind.hanging);
    pPr["w:ind"] = { $: d };
  }
  if (pOpts.shd)
    pPr["w:shd"] = { $: { "w:val": "clear", "w:color": "auto", "w:fill": pOpts.shd } };
  if (pOpts.pBdrRight) {
    pPr["w:pBdr"] = {
      "w:right": { $: { "w:val": pOpts.pBdrRight.val, "w:sz": String(pOpts.pBdrRight.sz), "w:space": "4", "w:color": pOpts.pBdrRight.color } },
    };
  }

  const rPr: any = {
    "w:rFonts": { $: { "w:ascii": LF, "w:hAnsi": LF, "w:cs": AF } },
    "w:rtl": {},
  };
  if (rOpts.bold)     { rPr["w:b"] = {}; rPr["w:bCs"] = {}; }
  if (rOpts.italic)   { rPr["w:i"] = {}; rPr["w:iCs"] = {}; }
  if (rOpts.color)    rPr["w:color"] = { $: { "w:val": rOpts.color } };
  if (rOpts.fontSize) {
    const fs2 = String(rOpts.fontSize * 2);
    rPr["w:sz"]   = { $: { "w:val": fs2 } };
    rPr["w:szCs"] = { $: { "w:val": fs2 } };
  }

  return {
    $: { "w:type": "paragraph", "w:styleId": id },
    "w:name": { $: { "w:val": name } },
    "w:pPr": pPr,
    "w:rPr": rPr,
  };
}

// ── Table builder – uses only Table class API ────────────────────────────────

function buildTableFromRows(
  rows: string[][],
  colWidths: number[],
  headerRows: number,
): Table {
  const totalW = colWidths.reduce((a, b) => a + b, 0);

  const tbl = new Table({ "w:tblPr": {}, "w:tblGrid": {}, "w:tr": [] });
  tbl
    .setTableDirection(true)
    .setTableWidth(totalW, "dxa")
    .setTableBorders({
      top:     { style: "single", size: 6, color: "888888" },
      bottom:  { style: "single", size: 6, color: "888888" },
      left:    { style: "single", size: 6, color: "888888" },
      right:   { style: "single", size: 6, color: "888888" },
      insideH: { style: "single", size: 4, color: "CCCCCC" },
      insideV: { style: "single", size: 4, color: "CCCCCC" },
    })
    .setDefaultCellMargins({ top: 60, bottom: 60, left: 80, right: 80 });

  // Set grid column widths directly on the raw object
  (tbl.toObject() as any)["w:tblGrid"] = {
    "w:gridCol": colWidths.map((w) => ({ $: { "w:w": String(w) } })),
  };

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const isHdr = ri < headerRows;
    const bg = isHdr ? C_THDR : ri % 2 === 1 ? C_TALT : "FFFFFF";
    const textColor = isHdr ? "FFFFFF" : "000000";

    // Add row with initial cell texts using Table.addRow()
    const cellTexts = colWidths.map((_, ci) => row[ci] ?? "");
    tbl.addRow(cellTexts);

    // Apply rich formatting to each cell via setCellContent / setCellShading / setCellWidth
    for (let ci = 0; ci < colWidths.length; ci++) {
      tbl.setCellContent(ri, ci, row[ci] ?? "", {
        bold:      isHdr,
        color:     textColor,
        fontSize:  18, // half-points → 9pt
        alignment: "center",
      });
      tbl.setCellShading(ri, ci, bg);
      tbl.setCellWidth(ri, ci, colWidths[ci]);

      // Fix fonts and add RTL bidi on the cell paragraph directly
      const cell = tbl.getCell(ri, ci) as any;
      if (cell?.["w:p"]) {
        const cp = cell["w:p"];
        if (!cp["w:pPr"]) cp["w:pPr"] = {};
        cp["w:pPr"]["w:bidi"] = {};
        cp["w:pPr"]["w:jc"]   = { $: { "w:val": "center" } };
        if (cp["w:r"]) {
          const cr = cp["w:r"];
          if (!cr["w:rPr"]) cr["w:rPr"] = {};
          cr["w:rPr"]["w:rFonts"] = { $: { "w:ascii": LF, "w:hAnsi": LF, "w:cs": AF } };
          cr["w:rPr"]["w:rtl"]    = {};
        }
      }
    }

    // Mark repeating header rows (without overriding shading we just set)
    if (isHdr) tbl.setHeaderRow(ri);
  }

  return tbl;
}

// ── Numbering XML (abstractNums + nums for bullet and numbered list) ──────────

const NUMBERING_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
             xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
             xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
             mc:Ignorable="w14">
  <w:abstractNum w:abstractNumId="10">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="bullet"/>
      <w:lvlText w:val="&#x25C4;"/>
      <w:lvlJc w:val="right"/>
      <w:pPr><w:bidi/><w:ind w:right="360" w:hanging="360"/></w:pPr>
      <w:rPr>
        <w:rFonts w:ascii="${LF}" w:hAnsi="${LF}" w:cs="${AF}"/>
        <w:b/><w:bCs/>
        <w:color w:val="${C_H2}"/>
        <w:sz w:val="24"/><w:szCs w:val="24"/>
      </w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="11">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0">
      <w:start w:val="1"/>
      <w:numFmt w:val="decimal"/>
      <w:lvlText w:val="%1."/>
      <w:lvlJc w:val="right"/>
      <w:pPr><w:bidi/><w:ind w:right="360" w:hanging="360"/></w:pPr>
      <w:rPr>
        <w:rFonts w:ascii="${LF}" w:hAnsi="${LF}" w:cs="${AF}"/>
        <w:sz w:val="22"/><w:szCs w:val="22"/>
      </w:rPr>
    </w:lvl>
  </w:abstractNum>
  <w:num w:numId="10"><w:abstractNumId w:val="10"/></w:num>
  <w:num w:numId="11"><w:abstractNumId w:val="11"/></w:num>
</w:numbering>`;

// ── Paragraph role index sets ─────────────────────────────────────────────────

const P_TITLE   = new Set([0]);
const P_SUB1    = new Set([1]);
const P_SUB2    = new Set([2]);
const P_H1      = new Set([4, 113, 189, 194, 210]);
const P_H2      = new Set([5, 7, 15, 18, 36, 48, 62, 69, 82, 102, 114, 116, 133, 136, 150, 154, 166, 169, 173, 180, 195, 204]);
const P_H3      = new Set([19, 24, 37, 39, 41, 50, 56, 70, 72, 84, 95, 130, 146, 163, 211, 213, 215, 217]);
const P_CAPTION = new Set([30, 58, 74, 86, 97, 120, 140, 158]);
const P_FIGCAP  = new Set([129, 145]);
const P_QUOTE   = new Set([118, 138, 156]);

// [start, end, headerRows, colWidths]
const TABLE_RANGES: [number, number, number, number[]][] = [
  [31,  35,  1, [3000, 2100, 2100, 2100]],
  [59,  61,  1, [2400, 3060, 1500, 1500]],
  [75,  80,  1, [3500, 2000, 1730, 2030]],
  [87,  93,  1, [3500, 1620, 1620, 2000]],
  [98,  100, 1, [3000, 2120, 2120, 2120]],
  [121, 127, 2, [2200, 580, 580, 580, 580, 580, 580, 580, 580, 870, 870]],
  [141, 143, 2, [1800, 530, 530, 530, 530, 530, 530, 530, 530, 530, 530, 800, 800]],
  [159, 161, 2, [2000, 1400, 1400, 1400, 1400, 1820]],
];

const NUMLIST_RANGES: [number, number][] = [
  [104, 110],
  [175, 179],
  [182, 188],
  [196, 203],
  [205, 209],
];

function buildSkipMap(): Map<number, string> {
  const m = new Map<number, string>();
  for (const [s, e] of TABLE_RANGES)   for (let i = s; i <= e; i++) m.set(i, `TABLE_${s}`);
  for (const [s, e] of NUMLIST_RANGES) for (let i = s; i <= e; i++) m.set(i, `NUMLIST_${s}`);
  return m;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const engine = await Mdocxengine.loadFromFile(INPUT);

  // ── 1. Register custom styles via engine.styles.addStyle() ────────────────
  await engine.styles.addStyle(makeStyle("AcTitle",   "Ac Title",
    { bidi: true, jc: "center", spacing: { before: 120, after: 120 }, shd: C_H1_BG },
    { bold: true, color: "FFFFFF", fontSize: 17 }));

  await engine.styles.addStyle(makeStyle("AcSub1",    "Ac Subtitle 1",
    { bidi: true, jc: "center", spacing: { before: 60, after: 40 } },
    { bold: true, color: C_H2, fontSize: 13 }));

  await engine.styles.addStyle(makeStyle("AcSub2",    "Ac Subtitle 2",
    { bidi: true, jc: "center", spacing: { after: 240 } },
    { italic: true, color: "606060", fontSize: 11 }));

  await engine.styles.addStyle(makeStyle("AcH1",      "Ac Heading 1",
    { bidi: true, jc: "center", outlineLvl: 0, spacing: { before: 280, after: 140 }, shd: C_H1_BG },
    { bold: true, color: "FFFFFF", fontSize: 15 }));

  await engine.styles.addStyle(makeStyle("AcH2",      "Ac Heading 2",
    { bidi: true, jc: "right", outlineLvl: 1, spacing: { before: 200, after: 80 },
      ind: { right: 200 }, pBdrRight: { val: "single", sz: 18, color: C_H2 } },
    { bold: true, color: C_H2, fontSize: 13 }));

  await engine.styles.addStyle(makeStyle("AcH3",      "Ac Heading 3",
    { bidi: true, jc: "right", outlineLvl: 2, spacing: { before: 140, after: 60 },
      ind: { right: 400 } },
    { bold: true, color: C_H3, fontSize: 12 }));

  await engine.styles.addStyle(makeStyle("AcCaption", "Ac Caption",
    { bidi: true, jc: "right", spacing: { before: 120, after: 40 } },
    { bold: true, italic: true, color: C_CAP, fontSize: 10 }));

  await engine.styles.addStyle(makeStyle("AcFigCap",  "Ac Figure Caption",
    { bidi: true, jc: "center", spacing: { before: 40, after: 120 } },
    { italic: true, color: C_CAP, fontSize: 10 }));

  await engine.styles.addStyle(makeStyle("AcQuote",   "Ac Block Quote",
    { bidi: true, jc: "right", spacing: { before: 100, after: 100 },
      ind: { left: 720, right: 720 }, shd: "F2F5FA",
      pBdrRight: { val: "thick", sz: 24, color: C_H2 } },
    { italic: true, color: C_QUOTE, fontSize: 12 }));

  await engine.styles.addStyle(makeStyle("AcBody",    "Ac Body",
    { bidi: true, jc: "right", spacing: { after: 100 }, ind: { firstLine: 720 } },
    { fontSize: 12 }));

  await engine.styles.addStyle(makeStyle("AcBullet",  "Ac Bullet",
    { bidi: true, jc: "right", spacing: { before: 0, after: 60 },
      ind: { right: 360, hanging: 360 } },
    { fontSize: 11 }));

  await engine.styles.addStyle(makeStyle("AcNum",     "Ac Numbered Item",
    { bidi: true, jc: "right", spacing: { before: 0, after: 60 },
      ind: { right: 360, hanging: 360 } },
    { fontSize: 11 }));

  // ── 2. Create numbering.xml and register via engine managers ─────────────
  engine.zip.addFile("word/numbering.xml", Buffer.from(NUMBERING_XML, "utf-8"));
  await engine.contentTypes.addOverride(
    "/word/numbering.xml",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml",
  );
  const numRelId = await engine.rels.genId();
  await engine.rels.addRelationship(
    numRelId,
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering",
    "numbering.xml",
  );

  // ── 3. Load all paragraphs via engine ─────────────────────────────────────
  const allParas = await engine.document.getParagraphs();

  // Pre-collect table row data from source paragraphs
  const tableDataMap = new Map<string, string[][]>();
  for (const [start, end, , colWidths] of TABLE_RANGES) {
    const key = `TABLE_${start}`;
    const colCount = colWidths.length;
    const tableRows: string[][] = [];
    for (let j = start; j <= end; j++) {
      const src = allParas[j];
      if (!src) continue;
      const cells = getTabCells(src);
      tableRows.push(Array.from({ length: colCount }, (_, c) => cells[c] ?? ""));
    }
    tableDataMap.set(key, tableRows);
  }

  // ── 4. Process paragraphs using Paragraph API + Run API ──────────────────
  const skipMap  = buildSkipMap();
  const visited  = new Set<string>();
  const outputParas: Paragraph[] = [];

  for (let i = 0; i < allParas.length; i++) {
    const p    = allParas[i];
    const text = getText(p);

    if (skipMap.has(i)) {
      const key = skipMap.get(i)!;
      if (visited.has(key)) continue;
      visited.add(key);

      if (key.startsWith("NUMLIST_")) {
        const rangeStart = parseInt(key.split("_")[1]);
        const range = NUMLIST_RANGES.find((r) => r[0] === rangeStart)!;
        for (let j = range[0]; j <= range[1]; j++) {
          const np = allParas[j];
          if (!np) continue;
          const itemText = getTabCells(np).join(" ").trim();
          np.modifyText(itemText);
          np.applyStyle("AcNum");
          applyPPr(np, {
            bidi: true, jc: "right",
            spacing: { before: 0, after: 60 },
            ind: { right: 360, hanging: 360 },
          });
          styleRuns(np, { fontSize: 11 });
          engine.numbering.applyNumbering(np, "11", 0);
          outputParas.push(np);
        }
      }
      // TABLE paragraphs are skipped here; tables injected after saveChanges
      continue;
    }

    // Empty paragraphs
    if (!text) {
      p.applyStyle("AcBody");
      applyPPr(p, { bidi: true, spacing: { after: 80 } });
      outputParas.push(p);
      continue;
    }

    if (P_TITLE.has(i)) {
      p.applyStyle("AcTitle");
      applyPPr(p, { bidi: true, jc: "center", spacing: { before: 120, after: 120 }, shd: C_H1_BG });
      styleRuns(p, { bold: true, color: "FFFFFF", fontSize: 17 });
      outputParas.push(p);
      continue;
    }
    if (P_SUB1.has(i)) {
      p.applyStyle("AcSub1");
      applyPPr(p, { bidi: true, jc: "center", spacing: { before: 60, after: 40 } });
      styleRuns(p, { bold: true, color: C_H2, fontSize: 13 });
      outputParas.push(p);
      continue;
    }
    if (P_SUB2.has(i)) {
      p.applyStyle("AcSub2");
      applyPPr(p, { bidi: true, jc: "center", spacing: { after: 240 } });
      styleRuns(p, { italic: true, color: "606060", fontSize: 11 });
      outputParas.push(p);
      continue;
    }
    if (P_H1.has(i)) {
      p.applyStyle("AcH1");
      applyPPr(p, {
        bidi: true, jc: "center", outlineLvl: 0,
        spacing: { before: 280, after: 140 }, shd: C_H1_BG,
      });
      styleRuns(p, { bold: true, color: "FFFFFF", fontSize: 15 });
      outputParas.push(p);
      continue;
    }
    if (P_H2.has(i)) {
      p.applyStyle("AcH2");
      applyPPr(p, {
        bidi: true, jc: "right", outlineLvl: 1,
        spacing: { before: 200, after: 80 },
        ind: { right: 200 },
        pBdrRight: { val: "single", sz: 18, color: C_H2 },
      });
      styleRuns(p, { bold: true, color: C_H2, fontSize: 13 });
      outputParas.push(p);
      continue;
    }
    if (P_H3.has(i)) {
      p.applyStyle("AcH3");
      applyPPr(p, {
        bidi: true, jc: "right", outlineLvl: 2,
        spacing: { before: 140, after: 60 },
        ind: { right: 400 },
      });
      styleRuns(p, { bold: true, color: C_H3, fontSize: 12 });
      outputParas.push(p);
      continue;
    }
    if (P_CAPTION.has(i)) {
      p.applyStyle("AcCaption");
      applyPPr(p, { bidi: true, jc: "right", spacing: { before: 120, after: 40 } });
      styleRuns(p, { bold: true, italic: true, color: C_CAP, fontSize: 10 });
      outputParas.push(p);
      continue;
    }
    if (P_FIGCAP.has(i)) {
      p.applyStyle("AcFigCap");
      applyPPr(p, { bidi: true, jc: "center", spacing: { before: 40, after: 120 } });
      styleRuns(p, { italic: true, color: C_CAP, fontSize: 10 });
      outputParas.push(p);
      continue;
    }
    if (P_QUOTE.has(i)) {
      p.applyStyle("AcQuote");
      applyPPr(p, {
        bidi: true, jc: "right",
        spacing: { before: 100, after: 100 },
        ind: { left: 720, right: 720 },
        shd: "F2F5FA",
        pBdrRight: { val: "thick", sz: 24, color: C_H2 },
      });
      styleRuns(p, { italic: true, color: C_QUOTE, fontSize: 12 });
      outputParas.push(p);
      continue;
    }

    // Bullet items
    if (text.startsWith("•")) {
      p.modifyText(text.replace(/^•\s*/, "").trim());
      p.applyStyle("AcBullet");
      applyPPr(p, {
        bidi: true, jc: "right",
        spacing: { before: 0, after: 60 },
        ind: { right: 360, hanging: 360 },
      });
      styleRuns(p, { fontSize: 11 });
      engine.numbering.applyNumbering(p, "10", 0);
      outputParas.push(p);
      continue;
    }

    // Tab-separated items outside defined ranges
    const cells = getTabCells(p);
    if (cells.length > 1) {
      p.modifyText(cells.join(" ").trim());
      p.applyStyle("AcNum");
      applyPPr(p, {
        bidi: true, jc: "right",
        spacing: { before: 0, after: 60 },
        ind: { right: 360, hanging: 360 },
      });
      styleRuns(p, { fontSize: 11 });
      outputParas.push(p);
      continue;
    }

    // Default: body paragraph
    p.applyStyle("AcBody");
    applyPPr(p, { bidi: true, jc: "right", spacing: { after: 100 }, ind: { firstLine: 720 } });
    styleRuns(p, { fontSize: 12 });
    outputParas.push(p);
  }

  // ── 5. Persist paragraphs via engine.document.saveChanges() ──────────────
  await engine.document.saveChanges(outputParas);

  // ── 6. Build table XMLs using Table class API ─────────────────────────────
  const tableXmls: string[] = TABLE_RANGES.map(([start, , hdrRows, colWidths]) => {
    const key = `TABLE_${start}`;
    const rows = tableDataMap.get(key) ?? [];
    const tbl = buildTableFromRows(rows, colWidths, hdrRows);
    return buildXml(tbl.toObject(), { rootName: "w:tbl", headless: true });
  });

  // ── 7. Inject table XML after each AcCaption paragraph ───────────────────
  // There are exactly 8 AcCaption paragraphs (matching 8 table ranges).
  let docXml = engine.zip.readAsText("word/document.xml")!;
  const paraRe = /<w:p[ >][\s\S]*?<\/w:p>/g;
  let m: RegExpExecArray | null;
  const captionEnds: number[] = [];

  while ((m = paraRe.exec(docXml)) !== null) {
    if (m[0].includes('"AcCaption"')) {
      captionEnds.push(m.index + m[0].length);
    }
  }

  // Inject in reverse order so earlier offsets stay valid
  for (let k = captionEnds.length - 1; k >= 0; k--) {
    if (k < tableXmls.length) {
      const pos = captionEnds[k];
      docXml = docXml.slice(0, pos) + "\n" + tableXmls[k] + docXml.slice(pos);
    }
  }
  engine.zip.addFile("word/document.xml", Buffer.from(docXml, "utf-8"));

  // ── 8. Save via engine ────────────────────────────────────────────────────
  await engine.saveToFile(OUTPUT);
  console.log(`✓ Saved → ${OUTPUT}`);
  console.log(`  Source paragraphs : ${allParas.length}`);
  console.log(`  Output paragraphs : ${outputParas.length}`);
  console.log(`  Tables injected   : ${captionEnds.length}`);
}

main().catch(console.error);
