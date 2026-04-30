import { describe, test, expect, beforeEach } from "vitest";
import { Table } from "./index";
import { TableObject } from "./types";

function makeTable(rows: string[][]): TableObject {
  return {
    "w:tr": rows.map((cells) => ({
      "w:tc": cells.map((text) => ({
        "w:p": { "w:r": { "w:t": text } },
      })),
    })),
  };
}

describe("Table", () => {
  let table: Table;

  beforeEach(() => {
    table = new Table(makeTable([["A", "B"], ["C", "D"]]));
  });

  test("getRowCount() returns correct count", () => {
    expect(table.getRowCount()).toBe(2);
  });

  test("getColumnCount() returns correct count for row 0", () => {
    expect(table.getColumnCount()).toBe(2);
  });

  test("getCellText() returns correct text", () => {
    expect(table.getCellText(0, 0)).toBe("A");
    expect(table.getCellText(0, 1)).toBe("B");
    expect(table.getCellText(1, 0)).toBe("C");
    expect(table.getCellText(1, 1)).toBe("D");
  });

  test("getCellText() returns empty string for out-of-range cell", () => {
    expect(table.getCellText(5, 5)).toBe("");
  });

  test("setCellText() updates cell content", () => {
    table.setCellText(0, 0, "Updated");
    expect(table.getCellText(0, 0)).toBe("Updated");
  });

  test("setCellText() throws for out-of-range cell", () => {
    expect(() => table.setCellText(5, 5, "X")).toThrow();
  });

  test("addRow() increases row count", () => {
    table.addRow(["E", "F"]);
    expect(table.getRowCount()).toBe(3);
    expect(table.getCellText(2, 0)).toBe("E");
  });

  test("addRow() without args fills empty strings", () => {
    table.addRow();
    expect(table.getRowCount()).toBe(3);
    expect(table.getCellText(2, 0)).toBe("");
  });

  test("removeRow() decreases row count", () => {
    table.removeRow(0);
    expect(table.getRowCount()).toBe(1);
    expect(table.getCellText(0, 0)).toBe("C");
  });

  test("removeRow() throws for out-of-range index", () => {
    expect(() => table.removeRow(5)).toThrow();
  });

  test("getCell() returns the raw cell object", () => {
    const cell = table.getCell(0, 0);
    expect(cell).not.toBeNull();
  });

  test("getCell() returns null for out-of-range", () => {
    expect(table.getCell(9, 9)).toBeNull();
  });

  test("toObject() returns the underlying table object", () => {
    const obj = table.toObject();
    expect(obj["w:tr"]).toBeDefined();
  });

  test("works with a single-row single-column table", () => {
    const t = new Table(makeTable([["Only"]]));
    expect(t.getRowCount()).toBe(1);
    expect(t.getColumnCount()).toBe(1);
    expect(t.getCellText(0, 0)).toBe("Only");
  });

  test("works with an empty table (no rows)", () => {
    const t = new Table({});
    expect(t.getRowCount()).toBe(0);
    expect(t.getColumnCount()).toBe(0);
  });
});
