import { describe, test, expect, beforeAll, beforeEach } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine, Table } from "@/index";

const INPUT  = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/table-layout.docx");

const NAVY   = "1F3864";
const WHITE  = "FFFFFF";
const BLUE   = "2E75B6";
const LIGHT  = "DCE6F1";
const GREEN  = "E2EFDA";
const RED    = "FCE4D6";
const YELLOW = "FFF2CC";

let engine: Mdocxengine;

/** Build a fresh 5-column, 6-row table for each test group */
function makeTable(): Table {
  return new Table({
    $: {},
    "w:tr": Array.from({ length: 6 }, () => ({
      "w:tc": Array.from({ length: 5 }, () => ({
        "w:p": { "w:r": { "w:t": "" } },
      })),
    })),
  } as any);
}

describe("Table layout tools", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLE PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Table Properties — Table tab", () => {
    test("setTableAlignment left / center / right", () => {
      const t = makeTable();
      t.setTableAlignment("center");
      expect(t.toObject()["w:tblPr"]?.["w:jc"]?.["$"]?.["w:val"]).toBe("center");

      t.setTableAlignment("right");
      expect(t.toObject()["w:tblPr"]?.["w:jc"]?.["$"]?.["w:val"]).toBe("right");
    });

    test("setTableIndent sets tblInd in twips", () => {
      const t = makeTable();
      t.setTableIndent(720);
      expect(t.toObject()["w:tblPr"]?.["w:tblInd"]?.["$"]?.["w:w"]).toBe("720");
    });

    test("setTextWrapping none / around", () => {
      const t = makeTable();
      t.setTextWrapping("around");
      expect(t.toObject()["w:tblPr"]?.["w:tblpPr"]).toBeDefined();

      t.setTextWrapping("none");
      expect(t.toObject()["w:tblPr"]?.["w:tblpPr"]).toBeUndefined();
    });

    test("setTableDirection RTL / LTR", () => {
      const t = makeTable();
      t.setTableDirection(true);
      expect(t.toObject()["w:tblPr"]?.["w:bidiVisual"]).toBeDefined();

      t.setTableDirection(false);
      expect(t.toObject()["w:tblPr"]?.["w:bidiVisual"]).toBeUndefined();
    });

    test("setAltText sets caption and description", () => {
      const t = makeTable();
      t.setAltText("Employee Table", "A table of employees and their roles.");
      const tblPr = t.toObject()["w:tblPr"]!;
      expect(tblPr["w:tblCaption"]?.["$"]?.["w:val"]).toBe("Employee Table");
      expect(tblPr["w:tblDescription"]?.["$"]?.["w:val"]).toBe("A table of employees and their roles.");
    });

    test("setTableWidth pct and dxa", () => {
      const t = makeTable();
      t.setTableWidth(100, "pct");
      expect(t.toObject()["w:tblPr"]?.["w:tblW"]?.["$"]?.["w:type"]).toBe("pct");

      t.setTableWidth(9360, "dxa");
      expect(t.toObject()["w:tblPr"]?.["w:tblW"]?.["$"]?.["w:w"]).toBe("9360");
    });

    test("setDefaultCellMargins applies tblCellMar", () => {
      const t = makeTable();
      t.setDefaultCellMargins({ top: 72, bottom: 72, left: 108, right: 108 });
      const mar = t.toObject()["w:tblPr"]?.["w:tblCellMar"]!;
      expect(mar["w:top"]?.["$"]?.["w:w"]).toBe("72");
      expect(mar["w:left"]?.["$"]?.["w:w"]).toBe("108");
    });

    test("setTableStyle applies named style", () => {
      const t = makeTable();
      t.setTableStyle("TableGrid");
      expect(t.toObject()["w:tblPr"]?.["w:tblStyle"]?.["$"]?.["w:val"]).toBe("TableGrid");
    });

    test("setTableBorders applies all six sides", () => {
      const t = makeTable();
      const side = { style: "single", size: 8, color: NAVY };
      t.setTableBorders({ top: side, bottom: side, left: side, right: side, insideH: side, insideV: side });
      const borders = t.toObject()["w:tblPr"]?.["w:tblBorders"]!;
      expect(borders["w:top"]?.["$"]?.["w:color"]).toBe(NAVY);
      expect(borders["w:insideV"]?.["$"]?.["w:sz"]).toBe("8");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYOUT MODE  (AutoFit / Fixed)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Layout tab — AutoFit", () => {
    test("autoFitContents sets autofit layout and auto width", () => {
      const t = makeTable();
      t.autoFitContents();
      expect(t.toObject()["w:tblPr"]?.["w:tblLayout"]?.["$"]?.["w:type"]).toBe("autofit");
      expect(t.toObject()["w:tblPr"]?.["w:tblW"]?.["$"]?.["w:type"]).toBe("auto");
    });

    test("autoFitWindow sets autofit layout and 100% width", () => {
      const t = makeTable();
      t.autoFitWindow();
      expect(t.toObject()["w:tblPr"]?.["w:tblLayout"]?.["$"]?.["w:type"]).toBe("autofit");
      expect(t.toObject()["w:tblPr"]?.["w:tblW"]?.["$"]?.["w:type"]).toBe("pct");
    });

    test("fixedColumnWidth sets fixed layout", () => {
      const t = makeTable();
      t.fixedColumnWidth();
      expect(t.toObject()["w:tblPr"]?.["w:tblLayout"]?.["$"]?.["w:type"]).toBe("fixed");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Table Properties — Row tab", () => {
    test("setRowHeight sets trHeight with atLeast rule", () => {
      const t = makeTable();
      t.setRowHeight(0, 567, "atLeast");
      const trPr = (t.toObject()["w:tr"] as any[])[0]["w:trPr"]!;
      expect(trPr["w:trHeight"]?.["$"]?.["w:val"]).toBe("567");
      expect(trPr["w:trHeight"]?.["$"]?.["w:hRule"]).toBe("atLeast");
    });

    test("setRowHeight sets trHeight with exact rule", () => {
      const t = makeTable();
      t.setRowHeight(1, 800, "exact");
      const trPr = (t.toObject()["w:tr"] as any[])[1]["w:trPr"]!;
      expect(trPr["w:trHeight"]?.["$"]?.["w:hRule"]).toBe("exact");
    });

    test("setRowAllowBreak false adds cantSplit", () => {
      const t = makeTable();
      t.setRowAllowBreak(0, false);
      expect((t.toObject()["w:tr"] as any[])[0]["w:trPr"]?.["w:cantSplit"]).toBeDefined();

      t.setRowAllowBreak(0, true);
      expect((t.toObject()["w:tr"] as any[])[0]["w:trPr"]?.["w:cantSplit"]).toBeUndefined();
    });

    test("setHeaderRow adds tblHeader and optional shading", () => {
      const t = makeTable();
      t.setHeaderRow(0, NAVY);
      const row0 = (t.toObject()["w:tr"] as any[])[0];
      expect(row0["w:trPr"]?.["w:tblHeader"]).toBeDefined();
      // shading applied to each cell
      const cell0 = (row0["w:tc"] as any[])[0];
      expect(cell0["w:tcPr"]?.["w:shd"]?.["$"]?.["w:fill"]).toBe(NAVY);
    });

    test("setRowShading shades all cells in a row", () => {
      const t = makeTable();
      t.setRowShading(1, LIGHT);
      const cells = (t.toObject()["w:tr"] as any[])[1]["w:tc"] as any[];
      cells.forEach((c) => {
        expect(c["w:tcPr"]?.["w:shd"]?.["$"]?.["w:fill"]).toBe(LIGHT);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMN PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Table Properties — Column tab", () => {
    test("setColumnWidth sets tcW on every row in the column", () => {
      const t = makeTable();
      t.setColumnWidth(0, 1440);
      const rows = t.toObject()["w:tr"] as any[];
      rows.forEach((row) => {
        const cells = row["w:tc"] as any[];
        expect(cells[0]["w:tcPr"]?.["w:tcW"]?.["$"]?.["w:w"]).toBe("1440");
      });
    });

    test("distributeColumns sets equal widths across all columns", () => {
      const t = makeTable();
      t.setTableWidth(7200, "dxa").distributeColumns();
      const rows = t.toObject()["w:tr"] as any[];
      const cells = rows[0]["w:tc"] as any[];
      // 7200 / 5 = 1440 per column
      cells.forEach((c) => {
        expect(c["w:tcPr"]?.["w:tcW"]?.["$"]?.["w:w"]).toBe("1440");
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CELL PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Table Properties — Cell tab", () => {
    test("setCellVerticalAlignment top / center / bottom", () => {
      const t = makeTable();
      t.setCellVerticalAlignment(0, 0, "center");
      expect(t.getCell(0, 0)?.["w:tcPr"]?.["w:vAlign"]?.["$"]?.["w:val"]).toBe("center");

      t.setCellVerticalAlignment(0, 0, "bottom");
      expect(t.getCell(0, 0)?.["w:tcPr"]?.["w:vAlign"]?.["$"]?.["w:val"]).toBe("bottom");
    });

    test("setCellMargins sets per-cell padding", () => {
      const t = makeTable();
      t.setCellMargins(0, 0, { top: 72, bottom: 72, left: 144, right: 144 });
      const mar = t.getCell(0, 0)?.["w:tcPr"]?.["w:tcMar"]!;
      expect(mar["w:top"]?.["$"]?.["w:w"]).toBe("72");
      expect(mar["w:left"]?.["$"]?.["w:w"]).toBe("144");
    });

    test("setCellShading sets background colour", () => {
      const t = makeTable();
      t.setCellShading(1, 2, BLUE);
      expect(t.getCell(1, 2)?.["w:tcPr"]?.["w:shd"]?.["$"]?.["w:fill"]).toBe(BLUE);
    });

    test("setCellWidth sets preferred width on one cell", () => {
      const t = makeTable();
      t.setCellWidth(0, 1, 2880);
      expect(t.getCell(0, 1)?.["w:tcPr"]?.["w:tcW"]?.["$"]?.["w:w"]).toBe("2880");
    });

    test("setCellContent applies rich formatting", () => {
      const t = makeTable();
      t.setCellContent(0, 0, "Hello", { bold: true, color: WHITE, fontSize: 24, alignment: "center" });
      expect(t.getCellText(0, 0)).toBe("Hello");
      const rPr = (t.getCell(0, 0)?.["w:p"] as any)?.["w:r"]?.["w:rPr"];
      expect(rPr?.["w:b"]).toBeDefined();
      expect(rPr?.["w:color"]?.["$"]?.["w:val"]).toBe(WHITE);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // INSERT / DELETE ROWS & COLUMNS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Layout tab — Insert & Delete", () => {
    test("insertRowAbove increases row count and positions correctly", () => {
      const t = makeTable();
      t.setCellText(1, 0, "WAS_ROW1");
      t.insertRowAbove(1);
      expect(t.getRowCount()).toBe(7);
      expect(t.getCellText(2, 0)).toBe("WAS_ROW1");
      expect(t.getCellText(1, 0)).toBe("");
    });

    test("insertRowBelow increases row count and positions correctly", () => {
      const t = makeTable();
      t.setCellText(1, 0, "WAS_ROW1");
      t.insertRowBelow(1);
      expect(t.getRowCount()).toBe(7);
      expect(t.getCellText(1, 0)).toBe("WAS_ROW1");
      expect(t.getCellText(2, 0)).toBe("");
    });

    test("addRow appends row with text", () => {
      const t = makeTable();
      t.addRow(["A", "B", "C", "D", "E"]);
      expect(t.getRowCount()).toBe(7);
      expect(t.getCellText(6, 2)).toBe("C");
    });

    test("removeRow deletes the correct row", () => {
      const t = makeTable();
      t.setCellText(2, 0, "TARGET");
      t.removeRow(2);
      expect(t.getRowCount()).toBe(5);
      expect(t.getCellText(2, 0)).not.toBe("TARGET");
    });

    test("insertColumnLeft shifts columns right", () => {
      const t = makeTable();
      t.setCellText(0, 1, "COL1");
      t.insertColumnLeft(1);
      expect(t.getColumnCount()).toBe(6);
      expect(t.getCellText(0, 2)).toBe("COL1");
      expect(t.getCellText(0, 1)).toBe("");
    });

    test("insertColumnRight adds column after target", () => {
      const t = makeTable();
      t.setCellText(0, 2, "COL2");
      t.insertColumnRight(2);
      expect(t.getColumnCount()).toBe(6);
      expect(t.getCellText(0, 2)).toBe("COL2");
      expect(t.getCellText(0, 3)).toBe("");
    });

    test("deleteColumn removes correct column", () => {
      const t = makeTable();
      t.setCellText(0, 2, "GONE");
      t.setCellText(0, 3, "STAYS");
      t.deleteColumn(2);
      expect(t.getColumnCount()).toBe(4);
      expect(t.getCellText(0, 2)).toBe("STAYS");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGE CELLS
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Layout tab — Merge Cells", () => {
    test("mergeCellsHorizontal spans multiple columns", () => {
      const t = makeTable();
      t.setCellText(0, 1, "A");
      t.setCellText(0, 2, "B");
      t.mergeCellsHorizontal(0, 1, 3);
      const cell = t.getCell(0, 1)!;
      expect(cell["w:tcPr"]?.["w:gridSpan"]?.["$"]?.["w:val"]).toBe("3");
      expect(t.getColumnCount(0)).toBe(3); // 5 - 2 consumed = 3
    });

    test("mergeCellsVertical adds vMerge restart and continuations", () => {
      const t = makeTable();
      t.mergeCellsVertical(1, 0, 2);
      const firstCell  = (t.toObject()["w:tr"] as any[])[0]["w:tc"][1];
      const secondCell = (t.toObject()["w:tr"] as any[])[1]["w:tc"][1];
      const thirdCell  = (t.toObject()["w:tr"] as any[])[2]["w:tc"][1];
      expect(firstCell["w:tcPr"]?.["w:vMerge"]?.["$"]?.["w:val"]).toBe("restart");
      expect(secondCell["w:tcPr"]?.["w:vMerge"]).toBeDefined();
      expect(thirdCell["w:tcPr"]?.["w:vMerge"]).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DISTRIBUTE
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Layout tab — Distribute", () => {
    test("distributeRows sets equal heights for all rows", () => {
      const t = makeTable();
      t.distributeRows(400);
      const rows = t.toObject()["w:tr"] as any[];
      rows.forEach((row) => {
        expect(row["w:trPr"]?.["w:trHeight"]?.["$"]?.["w:val"]).toBe("400");
      });
    });

    test("distributeColumns sets equal widths", () => {
      const t = makeTable();
      t.setTableWidth(5000, "dxa").distributeColumns();
      const rows = t.toObject()["w:tr"] as any[];
      const cells = rows[0]["w:tc"] as any[];
      const expectedW = String(Math.floor(5000 / 5));
      cells.forEach((c) => {
        expect(c["w:tcPr"]?.["w:tcW"]?.["$"]?.["w:w"]).toBe(expectedW);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SORT
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Layout tab — Sort", () => {
    test("sortByColumn ascending text", () => {
      const t = makeTable();
      t.setCellText(0, 0, "Header");
      t.setCellText(1, 0, "Charlie");
      t.setCellText(2, 0, "Alice");
      t.setCellText(3, 0, "Bob");
      t.setCellText(4, 0, "Eve");
      t.setCellText(5, 0, "Dave");

      t.sortByColumn(0, "asc", true);
      expect(t.getCellText(1, 0)).toBe("Alice");
      expect(t.getCellText(2, 0)).toBe("Bob");
      expect(t.getCellText(3, 0)).toBe("Charlie");
    });

    test("sortByColumn descending numeric", () => {
      const t = makeTable();
      t.setCellText(0, 0, "Score");
      t.setCellText(1, 0, "73");
      t.setCellText(2, 0, "91");
      t.setCellText(3, 0, "55");
      t.setCellText(4, 0, "88");
      t.setCellText(5, 0, "62");

      t.sortByColumn(0, "desc", true);
      expect(t.getCellText(1, 0)).toBe("91");
      expect(t.getCellText(5, 0)).toBe("55");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL STYLED TABLE → SAVE
  // ═══════════════════════════════════════════════════════════════════════════

  test("build complete styled table and save to docx", async () => {
    const t = makeTable();

    // Table-level config
    t.setTableStyle("TableGrid")
     .setTableAlignment("center")
     .setTableWidth(100, "pct")
     .fixedColumnWidth()
     .setTableBorders({
       top:     { style: "single", size: 8, color: NAVY },
       bottom:  { style: "single", size: 8, color: NAVY },
       left:    { style: "single", size: 8, color: NAVY },
       right:   { style: "single", size: 8, color: NAVY },
       insideH: { style: "single", size: 4, color: "B8CCE4" },
       insideV: { style: "single", size: 4, color: "B8CCE4" },
     })
     .setDefaultCellMargins({ top: 72, bottom: 72, left: 108, right: 108 })
     .setAltText("Employee Summary Table", "Lists employees, departments, scores and status.");

    // Column widths
    t.setColumnWidth(0, 720);
    t.setColumnWidth(1, 2160);
    t.setColumnWidth(2, 1800);
    t.setColumnWidth(3, 1080);
    t.setColumnWidth(4, 1440);

    // Header row (row 0)
    const headers = ["#", "Employee", "Department", "Score", "Status"];
    headers.forEach((h, col) => {
      t.setCellContent(0, col, h, { bold: true, color: WHITE, fontSize: 22, alignment: "center" });
    });
    t.setHeaderRow(0, NAVY)
     .setRowHeight(0, 480, "exact")
     .setRowAllowBreak(0, false);

    // Data rows 1–5
    const data = [
      ["1", "Alice Martin",  "Engineering", "98", "Active"],
      ["2", "Bob Chen",      "Design",      "87", "Active"],
      ["3", "Carol Diaz",    "Marketing",   "74", "On Leave"],
      ["4", "David Kim",     "Engineering", "91", "Active"],
      ["5", "Eve Okonkwo",   "HR",          "65", "Inactive"],
    ];

    const statusColors: Record<string, string> = {
      "Active": GREEN, "On Leave": YELLOW, "Inactive": RED,
    };
    const scoreColors = (n: number) => n >= 90 ? "375623" : n >= 75 ? BLUE : "C00000";

    data.forEach(([num, name, dept, score, status], i) => {
      const row = i + 1;
      const bg  = i % 2 === 0 ? WHITE : LIGHT;
      t.setRowShading(row, bg)
       .setRowHeight(row, 400, "atLeast")
       .setCellContent(row, 0, num,    { alignment: "center", fontSize: 20 })
       .setCellContent(row, 1, name,   { fontSize: 20 })
       .setCellContent(row, 2, dept,   { fontSize: 20 })
       .setCellContent(row, 3, score,  { bold: true, alignment: "center", fontSize: 20, color: scoreColors(parseInt(score)) })
       .setCellContent(row, 4, status, { alignment: "center", fontSize: 20 });
      t.setCellShading(row, 4, statusColors[status] ?? WHITE);
      t.setCellVerticalAlignment(row, 0, "center");
    });

    // Totals row
    t.addRow(["", "Total / Avg", "", "83", ""])
     .setRowShading(6, "D9E1F2")
     .setCellContent(6, 1, "Total / Avg", { bold: true, fontSize: 20 })
     .setCellContent(6, 3, "83", { bold: true, alignment: "center", fontSize: 20, color: BLUE });

    // Sort data rows descending by score before inserting
    t.sortByColumn(3, "desc", true);

    await engine.document.insertTable(t);

    const tables = await engine.document.getTables();
    const last = tables[tables.length - 1];
    expect(last.getRowCount()).toBe(7);
    expect(last.getCellText(0, 0)).toBe("#");

    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    expect(fs.statSync(OUTPUT).size).toBeGreaterThan(0);
    console.log(`\n✓ Output written to: ${OUTPUT}`);
  });
});
