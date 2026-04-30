import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine, Table } from "@/index";

const INPUT  = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/styled-table.docx");

// Header row color (dark navy), alternating row colors
const HEADER_BG   = "1F3864"; // dark navy
const HEADER_TEXT = "FFFFFF"; // white
const ROW_ALT     = "DCE6F1"; // light blue
const ROW_EVEN    = "FFFFFF"; // white
const ACCENT      = "2E75B6"; // medium blue
const RED         = "C00000"; // red
const GREEN       = "375623"; // dark green

let engine: Mdocxengine;
let table: Table;

describe("Styled table", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);

    // ── Build raw table skeleton ────────────────────────────────────────────
    table = new Table({
      $: {},
      "w:tr": [
        // Row 0 — header
        {
          "w:tc": [
            { "w:p": { "w:r": { "w:t": "" } } },
            { "w:p": { "w:r": { "w:t": "" } } },
            { "w:p": { "w:r": { "w:t": "" } } },
            { "w:p": { "w:r": { "w:t": "" } } },
            { "w:p": { "w:r": { "w:t": "" } } },
          ],
        },
        // Rows 1-5 — data
        ...Array.from({ length: 5 }, () => ({
          "w:tc": [
            { "w:p": { "w:r": { "w:t": "" } } },
            { "w:p": { "w:r": { "w:t": "" } } },
            { "w:p": { "w:r": { "w:t": "" } } },
            { "w:p": { "w:r": { "w:t": "" } } },
            { "w:p": { "w:r": { "w:t": "" } } },
          ],
        })),
      ],
    } as any);
  });

  // ─── Structure ────────────────────────────────────────────────────────────

  test("table has 6 rows and 5 columns", () => {
    expect(table.getRowCount()).toBe(6);
    expect(table.getColumnCount()).toBe(5);
  });

  // ─── Header row ───────────────────────────────────────────────────────────

  test("populate header row with bold white text on navy background", () => {
    const headers = ["#", "Employee", "Department", "Score", "Status"];
    headers.forEach((text, col) => {
      table.setCellContent(0, col, text, {
        bold: true,
        color: HEADER_TEXT,
        fontSize: 22,
        alignment: "center",
      });
    });

    table.setHeaderRow(0, HEADER_BG);

    expect(table.getCellText(0, 0)).toBe("#");
    expect(table.getCellText(0, 4)).toBe("Status");
  });

  // ─── Data rows ────────────────────────────────────────────────────────────

  test("populate data rows with alternating row colors", () => {
    const data = [
      ["1", "Alice Martin",  "Engineering", "98",  "Active"],
      ["2", "Bob Chen",      "Design",      "87",  "Active"],
      ["3", "Carol Diaz",    "Marketing",   "74",  "On Leave"],
      ["4", "David Kim",     "Engineering", "91",  "Active"],
      ["5", "Eve Okonkwo",   "HR",          "65",  "Inactive"],
    ];

    data.forEach((rowData, i) => {
      const rowIndex = i + 1;
      const bg = i % 2 === 0 ? ROW_EVEN : ROW_ALT;
      table.setRowShading(rowIndex, bg);

      rowData.forEach((text, col) => {
        table.setCellContent(rowIndex, col, text, {
          alignment: col === 0 ? "center" : "left",
          fontSize: 20,
        });
      });
    });

    expect(table.getCellText(1, 1)).toBe("Alice Martin");
    expect(table.getCellText(5, 1)).toBe("Eve Okonkwo");
  });

  // ─── Score column — colored by value ──────────────────────────────────────

  test("color Score column cells by value (green / yellow / red)", () => {
    const scores = [
      { row: 1, score: 98, color: GREEN  },  // high  → green
      { row: 2, score: 87, color: ACCENT },  // mid   → blue
      { row: 3, score: 74, color: ACCENT },  // mid   → blue
      { row: 4, score: 91, color: GREEN  },  // high  → green
      { row: 5, score: 65, color: RED    },  // low   → red
    ];

    scores.forEach(({ row, score, color }) => {
      table.setCellContent(row, 3, String(score), {
        bold: true,
        color,
        alignment: "center",
        fontSize: 20,
      });
    });

    expect(table.getCellText(1, 3)).toBe("98");
    expect(table.getCellText(5, 3)).toBe("65");
  });

  // ─── Status column — background per status ────────────────────────────────

  test("shade Status cells by status value", () => {
    const statusColors: Record<string, string> = {
      Active:   "E2EFDA", // light green
      "On Leave": "FFF2CC", // light yellow
      Inactive: "FCE4D6", // light red/orange
    };

    const statuses = ["Active", "Active", "On Leave", "Active", "Inactive"];
    statuses.forEach((status, i) => {
      const rowIndex = i + 1;
      const fill = statusColors[status] ?? ROW_EVEN;
      table.setCellShading(rowIndex, 4, fill);
      table.setCellContent(rowIndex, 4, status, {
        bold: status === "Inactive",
        alignment: "center",
        fontSize: 20,
      });
    });

    expect(table.getCellText(3, 4)).toBe("On Leave");
    expect(table.getCellText(5, 4)).toBe("Inactive");
  });

  // ─── Borders ──────────────────────────────────────────────────────────────

  test("apply table borders", () => {
    table.setTableBorders({
      top:     { style: "single", size: 8,  color: HEADER_BG },
      bottom:  { style: "single", size: 8,  color: HEADER_BG },
      left:    { style: "single", size: 8,  color: HEADER_BG },
      right:   { style: "single", size: 8,  color: HEADER_BG },
      insideH: { style: "single", size: 4,  color: "B8CCE4" },
      insideV: { style: "single", size: 4,  color: "B8CCE4" },
    });

    const raw = table.toObject();
    expect(raw["w:tblPr"]?.["w:tblBorders"]).toBeDefined();
    expect(raw["w:tblPr"]!["w:tblBorders"]["w:top"]?.["$"]?.["w:color"]).toBe(HEADER_BG);
  });

  // ─── Table width ──────────────────────────────────────────────────────────

  test("set table to 100% page width", () => {
    table.setTableWidth(100, "pct");
    const raw = table.toObject();
    expect(raw["w:tblPr"]?.["w:tblW"]).toBeDefined();
  });

  // ─── Row operations ───────────────────────────────────────────────────────

  test("add a totals row at the bottom", () => {
    const before = table.getRowCount();
    table.addRow(["", "Total", "", "83", ""]);
    table.setRowShading(before, "D9E1F2"); // soft blue for totals
    table.setCellContent(before, 1, "Total", { bold: true, fontSize: 20 });
    table.setCellContent(before, 3, "83",    { bold: true, fontSize: 20, alignment: "center", color: ACCENT });
    expect(table.getRowCount()).toBe(before + 1);
    expect(table.getCellText(before, 1)).toBe("Total");
  });

  // ─── Insert into document & save ──────────────────────────────────────────

  test("insert styled table into document and save", async () => {
    await engine.document.insertTable(table);

    const tables = await engine.document.getTables();
    const last = tables[tables.length - 1];
    expect(last.getRowCount()).toBe(7); // 1 header + 5 data + 1 totals
    expect(last.getCellText(0, 0)).toBe("#");

    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    expect(fs.statSync(OUTPUT).size).toBeGreaterThan(0);
    console.log(`\n✓ Output written to: ${OUTPUT}`);
  });
});
