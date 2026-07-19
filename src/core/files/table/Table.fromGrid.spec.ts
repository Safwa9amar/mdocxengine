import { describe, test, expect } from "vitest";
import { Table } from ".";

describe("Table.fromGrid", () => {
  test("builds a table with one column per widest row, padding short rows", () => {
    const t = Table.fromGrid([
      ["A", "B", "C"],
      ["1"],
    ]);
    expect(t.getRowCount()).toBe(2);
    expect(t.getColumnCount(0)).toBe(3);
    expect(t.getColumnCount(1)).toBe(3); // padded
    expect(t.getCellText(1, 0)).toBe("1");
    expect(t.getCellText(1, 2)).toBe(""); // padded empty
  });

  test("getAllCellText round-trips the grid", () => {
    const grid = [
      ["Name", "Role"],
      ["Ada", "Author"],
    ];
    const t = Table.fromGrid(grid);
    expect(t.getAllCellText()).toEqual(grid);
  });

  test("header row marks repeat header and applies fill + bold when requested", () => {
    const t = Table.fromGrid([["H1", "H2"], ["a", "b"]], {
      headerRow: true,
      boldHeader: true,
      headerFill: "D9D9D9",
    });
    const obj: any = t.toObject();
    const firstRow = obj["w:tr"][0];
    expect(firstRow["w:trPr"]["w:tblHeader"]).toBeDefined();
    expect(firstRow["w:tc"][0]["w:tcPr"]["w:shd"].$["w:fill"]).toBe("D9D9D9");
    expect(firstRow["w:tc"][0]["w:p"]["w:r"]["w:rPr"]["w:b"]).toBeDefined();
  });

  test("rtl sets bidiVisual and width defaults to 100%", () => {
    const t = Table.fromGrid([["x"]], { rtl: true });
    const obj: any = t.toObject();
    expect(obj["w:tblPr"]["w:bidiVisual"]).toBeDefined();
    expect(obj["w:tblPr"]["w:tblW"].$["w:type"]).toBe("pct");
    expect(obj["w:tblPr"]["w:tblW"].$["w:w"]).toBe("5000"); // 100% → 5000 fiftieths
  });

  test("empty input still yields a single-column table", () => {
    const t = Table.fromGrid([]);
    expect(t.getColumnCount(0)).toBe(0); // no rows
    expect(t.getRowCount()).toBe(0);
  });

  test("default borders are the light-grey grid", () => {
    const t = Table.fromGrid([["x"]]);
    const obj: any = t.toObject();
    const borders = obj["w:tblPr"]["w:tblBorders"];
    expect(borders["w:top"].$["w:color"]).toBe("808080");
    expect(borders["w:insideH"].$["w:color"]).toBe("BFBFBF");
  });
});
