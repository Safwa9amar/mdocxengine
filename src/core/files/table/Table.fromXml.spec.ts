import { describe, test, expect } from "vitest";
import { Table } from ".";
import { makeTableXml } from "../body/OrderedBody";

describe("Table.fromXml", () => {
  test("parses a <w:tbl> string and reads its cells", async () => {
    const xml = makeTableXml([["Name", "Role"], ["Ada", "Author"]], { headerRow: true });
    const t = await Table.fromXml(xml);
    expect(t.getAllCellText()).toEqual([["Name", "Role"], ["Ada", "Author"]]);
    expect(t.getRowCount()).toBe(2);
  });

  test("round-trips fromGrid → toObject XML → fromXml", async () => {
    const grid = [["A", "B", "C"], ["1", "2", "3"]];
    const built = Table.fromGrid(grid);
    const xml = makeTableXml(grid);
    const reparsed = await Table.fromXml(xml);
    expect(reparsed.getAllCellText()).toEqual(built.getAllCellText());
  });
});
