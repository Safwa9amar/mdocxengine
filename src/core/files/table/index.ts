import { TableObject, TableRow, TableCell, CellMargins } from "./types";

export interface CellTextOptions {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fontSize?: number;      // half-points
  fontFamily?: string;
  alignment?: "left" | "center" | "right" | "justify";
}

export interface BorderSide {
  style?: string;   // "single"|"double"|"dashed"|"dotted"|"thick"|"none"
  size?: number;    // eighth-points (4 = 0.5pt, 8 = 1pt)
  color?: string;   // hex without '#'
}

export interface TableBorderOptions {
  top?: BorderSide;
  bottom?: BorderSide;
  left?: BorderSide;
  right?: BorderSide;
  insideH?: BorderSide;
  insideV?: BorderSide;
}

/**
 * Wraps a parsed <w:tbl> and provides a full Table Design + Layout API.
 */
export class Table {
  private table: TableObject;

  constructor(table: TableObject) {
    this.table = table;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private getRows(): TableRow[] {
    const raw = this.table["w:tr"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  private setRows(rows: TableRow[]): void {
    this.table["w:tr"] = rows;
  }

  private getCells(row: TableRow): TableCell[] {
    const raw = row["w:tc"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  private setCells(row: TableRow, cells: TableCell[]): void {
    row["w:tc"] = cells;
  }

  private extractCellText(cell: TableCell): string {
    const paragraphs = cell["w:p"];
    if (!paragraphs) return "";
    const arr = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
    return arr
      .map((p: any) => {
        const runs = p["w:r"];
        if (!runs) return "";
        const runArr = Array.isArray(runs) ? runs : [runs];
        return runArr
          .map((r: any) => {
            const t = r["w:t"];
            if (!t) return "";
            return typeof t === "string" ? t : (t._ ?? "");
          })
          .join("");
      })
      .join("\n");
  }

  private ensureCellProps(cell: TableCell): any {
    if (!cell["w:tcPr"]) cell["w:tcPr"] = {};
    return cell["w:tcPr"];
  }

  private ensureRowProps(row: TableRow): any {
    if (!row["w:trPr"]) row["w:trPr"] = {};
    return row["w:trPr"];
  }

  private ensureTableProps(): any {
    if (!this.table["w:tblPr"]) this.table["w:tblPr"] = {};
    return this.table["w:tblPr"];
  }

  private buildBorderEl(side: BorderSide): any {
    return {
      $: {
        "w:val":   side.style ?? "single",
        "w:sz":    String(side.size ?? 4),
        "w:space": "0",
        "w:color": (side.color ?? "000000").replace("#", ""),
      },
    };
  }

  private emptyCell(): TableCell {
    return { "w:p": { "w:r": { "w:t": "" } } };
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  /** Number of rows. */
  public getRowCount(): number {
    return this.getRows().length;
  }

  /** Number of columns in the given row (default row 0). */
  public getColumnCount(rowIndex = 0): number {
    const rows = this.getRows();
    if (!rows[rowIndex]) return 0;
    return this.getCells(rows[rowIndex]).length;
  }

  /** Raw cell object at [row, col], or null. */
  public getCell(row: number, col: number): TableCell | null {
    const rows = this.getRows();
    if (!rows[row]) return null;
    const cells = this.getCells(rows[row]);
    return cells[col] ?? null;
  }

  /** Plain text of cell [row, col]. */
  public getCellText(row: number, col: number): string {
    const cell = this.getCell(row, col);
    if (!cell) return "";
    return this.extractCellText(cell);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLE PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Apply a named Word table style, e.g. "TableGrid", "LightShading-Accent1". */
  public setTableStyle(styleId: string): this {
    this.ensureTableProps()["w:tblStyle"] = { $: { "w:val": styleId } };
    return this;
  }

  /**
   * Table alignment on the page.
   * Equivalent to Table Properties → Table → Alignment.
   */
  public setTableAlignment(alignment: "left" | "center" | "right"): this {
    this.ensureTableProps()["w:jc"] = { $: { "w:val": alignment } };
    return this;
  }

  /**
   * Table indent from the left margin in twips.
   * Equivalent to Table Properties → Table → Indent from Left.
   */
  public setTableIndent(twips: number): this {
    this.ensureTableProps()["w:tblInd"] = {
      $: { "w:w": String(twips), "w:type": "dxa" },
    };
    return this;
  }

  /**
   * Text wrapping around the table.
   * Equivalent to Table Properties → Table → Text Wrapping.
   */
  public setTextWrapping(type: "none" | "around"): this {
    const tblPr = this.ensureTableProps();
    if (type === "around") {
      tblPr["w:tblpPr"] = { $: {} }; // Word fills positioning attrs when placed
    } else {
      delete tblPr["w:tblpPr"];
    }
    return this;
  }

  /**
   * Right-to-left table direction.
   * Equivalent to Table Properties → Table → Table direction.
   */
  public setTableDirection(rtl: boolean): this {
    const tblPr = this.ensureTableProps();
    if (rtl) {
      tblPr["w:bidiVisual"] = {};
    } else {
      delete tblPr["w:bidiVisual"];
    }
    return this;
  }

  /**
   * Set accessible alt text (title + description).
   * Equivalent to Table Properties → Alt Text.
   */
  public setAltText(title: string, description = ""): this {
    const tblPr = this.ensureTableProps();
    tblPr["w:tblCaption"]     = { $: { "w:val": title } };
    tblPr["w:tblDescription"] = { $: { "w:val": description } };
    return this;
  }

  /**
   * Set table width.
   * type "pct"  → percentage of page width (pass 0–100)
   * type "dxa"  → fixed twips
   * type "auto" → auto
   */
  public setTableWidth(value: number, type: "pct" | "dxa" | "auto" = "pct"): this {
    this.ensureTableProps()["w:tblW"] = {
      $: { "w:w": String(type === "pct" ? value * 50 : value), "w:type": type },
    };
    return this;
  }

  /**
   * Layout mode.
   * "autofit" → AutoFit Contents / AutoFit Window
   * "fixed"   → Fixed Column Width
   */
  public setLayoutMode(mode: "autofit" | "fixed"): this {
    this.ensureTableProps()["w:tblLayout"] = { $: { "w:type": mode } };
    return this;
  }

  /** Shorthand: AutoFit to contents. */
  public autoFitContents(): this {
    return this.setLayoutMode("autofit").setTableWidth(0, "auto");
  }

  /** Shorthand: AutoFit to window (page width). */
  public autoFitWindow(): this {
    return this.setLayoutMode("autofit").setTableWidth(100, "pct");
  }

  /** Shorthand: Fixed column widths. */
  public fixedColumnWidth(): this {
    return this.setLayoutMode("fixed");
  }

  /**
   * Default cell margins for the entire table (twips).
   * Equivalent to Table Properties → Options → Default cell margins.
   */
  public setDefaultCellMargins(margins: CellMargins): this {
    const tblPr = this.ensureTableProps();
    tblPr["w:tblCellMar"] = {
      ...(margins.top    !== undefined ? { "w:top":    { $: { "w:w": String(margins.top),    "w:type": "dxa" } } } : {}),
      ...(margins.bottom !== undefined ? { "w:bottom": { $: { "w:w": String(margins.bottom), "w:type": "dxa" } } } : {}),
      ...(margins.left   !== undefined ? { "w:left":   { $: { "w:w": String(margins.left),   "w:type": "dxa" } } } : {}),
      ...(margins.right  !== undefined ? { "w:right":  { $: { "w:w": String(margins.right),  "w:type": "dxa" } } } : {}),
    };
    return this;
  }

  /**
   * Table-level borders.
   */
  public setTableBorders(borders: TableBorderOptions): this {
    const tblBorders: any = {};
    if (borders.top)     tblBorders["w:top"]     = this.buildBorderEl(borders.top);
    if (borders.bottom)  tblBorders["w:bottom"]  = this.buildBorderEl(borders.bottom);
    if (borders.left)    tblBorders["w:left"]     = this.buildBorderEl(borders.left);
    if (borders.right)   tblBorders["w:right"]    = this.buildBorderEl(borders.right);
    if (borders.insideH) tblBorders["w:insideH"]  = this.buildBorderEl(borders.insideH);
    if (borders.insideV) tblBorders["w:insideV"]  = this.buildBorderEl(borders.insideV);
    this.ensureTableProps()["w:tblBorders"] = tblBorders;
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set row height.
   * rule: "atLeast" (At least) | "exact" (Exact)
   * Equivalent to Table Properties → Row → Specify height.
   */
  public setRowHeight(rowIndex: number, heightTwips: number, rule: "atLeast" | "exact" = "atLeast"): this {
    const rows = this.getRows();
    if (!rows[rowIndex]) throw new Error(`Row ${rowIndex} not found`);
    this.ensureRowProps(rows[rowIndex])["w:trHeight"] = {
      $: { "w:val": String(heightTwips), "w:hRule": rule },
    };
    this.setRows(rows);
    return this;
  }

  /**
   * Allow/prevent a row from breaking across pages.
   * Equivalent to Table Properties → Row → Allow row to break across pages.
   */
  public setRowAllowBreak(rowIndex: number, allow: boolean): this {
    const rows = this.getRows();
    if (!rows[rowIndex]) throw new Error(`Row ${rowIndex} not found`);
    const trPr = this.ensureRowProps(rows[rowIndex]);
    if (allow) {
      delete trPr["w:cantSplit"];
    } else {
      trPr["w:cantSplit"] = {};
    }
    this.setRows(rows);
    return this;
  }

  /**
   * Mark a row as a repeating header at the top of each page.
   * Equivalent to Table Properties → Row → Repeat as header row.
   * Optionally set a background fill colour.
   */
  public setHeaderRow(rowIndex: number, fillColor?: string): this {
    const rows = this.getRows();
    if (!rows[rowIndex]) throw new Error(`Row ${rowIndex} not found`);
    this.ensureRowProps(rows[rowIndex])["w:tblHeader"] = {};
    if (fillColor) this.setRowShading(rowIndex, fillColor);
    this.setRows(rows);
    return this;
  }

  /** Shade all cells in a row with one background colour. */
  public setRowShading(rowIndex: number, fillColor: string): this {
    const count = this.getColumnCount(rowIndex);
    for (let col = 0; col < count; col++) {
      this.setCellShading(rowIndex, col, fillColor);
    }
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COLUMN PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set preferred width (twips) for every cell in a column.
   * Equivalent to Table Properties → Column → Preferred width.
   */
  public setColumnWidth(colIndex: number, widthTwips: number): this {
    const rows = this.getRows();
    rows.forEach((row) => {
      const cells = this.getCells(row);
      if (cells[colIndex]) {
        const tcPr = this.ensureCellProps(cells[colIndex]);
        tcPr["w:tcW"] = { $: { "w:w": String(widthTwips), "w:type": "dxa" } };
      }
    });
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CELL PROPERTIES
  // ═══════════════════════════════════════════════════════════════════════════

  /** Set cell preferred width in twips. */
  public setCellWidth(row: number, col: number, widthTwips: number): this {
    const cell = this.getCell(row, col);
    if (!cell) throw new Error(`Cell [${row},${col}] not found`);
    this.ensureCellProps(cell)["w:tcW"] = {
      $: { "w:w": String(widthTwips), "w:type": "dxa" },
    };
    return this;
  }

  /**
   * Set cell vertical alignment.
   * Equivalent to Table Properties → Cell → Vertical Alignment.
   */
  public setCellVerticalAlignment(
    row: number,
    col: number,
    alignment: "top" | "center" | "bottom",
  ): this {
    const cell = this.getCell(row, col);
    if (!cell) throw new Error(`Cell [${row},${col}] not found`);
    this.ensureCellProps(cell)["w:vAlign"] = { $: { "w:val": alignment } };
    return this;
  }

  /**
   * Set individual cell margins (overrides table default).
   * Equivalent to Table Properties → Cell → Options.
   */
  public setCellMargins(row: number, col: number, margins: CellMargins): this {
    const cell = this.getCell(row, col);
    if (!cell) throw new Error(`Cell [${row},${col}] not found`);
    const tcPr = this.ensureCellProps(cell);
    tcPr["w:tcMar"] = {
      ...(margins.top    !== undefined ? { "w:top":    { $: { "w:w": String(margins.top),    "w:type": "dxa" } } } : {}),
      ...(margins.bottom !== undefined ? { "w:bottom": { $: { "w:w": String(margins.bottom), "w:type": "dxa" } } } : {}),
      ...(margins.left   !== undefined ? { "w:left":   { $: { "w:w": String(margins.left),   "w:type": "dxa" } } } : {}),
      ...(margins.right  !== undefined ? { "w:right":  { $: { "w:w": String(margins.right),  "w:type": "dxa" } } } : {}),
    };
    return this;
  }

  /** Set cell background shading colour. */
  public setCellShading(row: number, col: number, fillColor: string): this {
    const cell = this.getCell(row, col);
    if (!cell) throw new Error(`Cell [${row},${col}] not found`);
    this.ensureCellProps(cell)["w:shd"] = {
      $: { "w:val": "clear", "w:color": "auto", "w:fill": fillColor.replace("#", "") },
    };
    return this;
  }

  /** Set text with rich formatting in a cell. */
  public setCellContent(
    row: number,
    col: number,
    text: string,
    opts: CellTextOptions = {},
  ): this {
    const cell = this.getCell(row, col);
    if (!cell) throw new Error(`Cell [${row},${col}] not found`);

    const rPr: any = {};
    if (opts.bold)       rPr["w:b"] = {};
    if (opts.italic)     rPr["w:i"] = {};
    if (opts.color)      rPr["w:color"] = { $: { "w:val": opts.color.replace("#", "") } };
    if (opts.fontSize) {
      rPr["w:sz"]   = { $: { "w:val": String(opts.fontSize) } };
      rPr["w:szCs"] = { $: { "w:val": String(opts.fontSize) } };
    }
    if (opts.fontFamily) {
      rPr["w:rFonts"] = {
        $: { "w:ascii": opts.fontFamily, "w:hAnsi": opts.fontFamily, "w:cs": opts.fontFamily },
      };
    }

    const pPr: any = opts.alignment
      ? { "w:jc": { $: { "w:val": opts.alignment } } }
      : undefined;

    cell["w:p"] = {
      ...(pPr ? { "w:pPr": pPr } : {}),
      "w:r": {
        ...(Object.keys(rPr).length ? { "w:rPr": rPr } : {}),
        "w:t": { _: text, $: { "xml:space": "preserve" } },
      },
    };
    return this;
  }

  /** Set plain text in a cell. */
  public setCellText(row: number, col: number, text: string): this {
    const cell = this.getCell(row, col);
    if (!cell) throw new Error(`Cell [${row},${col}] not found`);
    cell["w:p"] = { "w:r": { "w:t": text } };
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROW / COLUMN INSERT & DELETE  (Layout tab)
  // ═══════════════════════════════════════════════════════════════════════════

  private makeEmptyRow(colCount: number): TableRow {
    return { "w:tc": Array.from({ length: colCount }, () => this.emptyCell()) };
  }

  /**
   * Insert a blank row above the given index.
   * Equivalent to Layout → Insert Above.
   */
  public insertRowAbove(rowIndex: number): this {
    const rows = this.getRows();
    const colCount = this.getColumnCount();
    rows.splice(rowIndex, 0, this.makeEmptyRow(colCount));
    this.setRows(rows);
    return this;
  }

  /**
   * Insert a blank row below the given index.
   * Equivalent to Layout → Insert Below.
   */
  public insertRowBelow(rowIndex: number): this {
    const rows = this.getRows();
    const colCount = this.getColumnCount();
    rows.splice(rowIndex + 1, 0, this.makeEmptyRow(colCount));
    this.setRows(rows);
    return this;
  }

  /**
   * Append a row, optionally pre-filled with text.
   */
  public addRow(cellTexts?: string[]): this {
    const colCount = this.getColumnCount();
    const texts = cellTexts ?? Array(colCount).fill("");
    const newRow: TableRow = {
      "w:tc": texts.map((text) => ({ "w:p": { "w:r": { "w:t": text } } })),
    };
    const rows = this.getRows();
    rows.push(newRow);
    this.setRows(rows);
    return this;
  }

  /**
   * Remove the row at the given index.
   * Equivalent to Layout → Delete → Delete Rows.
   */
  public removeRow(index: number): this {
    const rows = this.getRows();
    if (index < 0 || index >= rows.length) throw new Error(`Row index ${index} out of bounds`);
    rows.splice(index, 1);
    this.setRows(rows);
    return this;
  }

  /**
   * Insert a blank column to the left of colIndex.
   * Equivalent to Layout → Insert Left.
   */
  public insertColumnLeft(colIndex: number): this {
    const rows = this.getRows();
    rows.forEach((row) => {
      const cells = this.getCells(row);
      cells.splice(colIndex, 0, this.emptyCell());
      this.setCells(row, cells);
    });
    return this;
  }

  /**
   * Insert a blank column to the right of colIndex.
   * Equivalent to Layout → Insert Right.
   */
  public insertColumnRight(colIndex: number): this {
    const rows = this.getRows();
    rows.forEach((row) => {
      const cells = this.getCells(row);
      cells.splice(colIndex + 1, 0, this.emptyCell());
      this.setCells(row, cells);
    });
    return this;
  }

  /**
   * Delete an entire column.
   * Equivalent to Layout → Delete → Delete Columns.
   */
  public deleteColumn(colIndex: number): this {
    const rows = this.getRows();
    rows.forEach((row) => {
      const cells = this.getCells(row);
      cells.splice(colIndex, 1);
      this.setCells(row, cells);
    });
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGE / SPLIT  (Layout tab)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Horizontally merge cells in a single row from startCol to endCol (inclusive).
   * Equivalent to Layout → Merge Cells.
   */
  public mergeCellsHorizontal(rowIndex: number, startCol: number, endCol: number): this {
    if (startCol >= endCol) throw new Error("startCol must be less than endCol");
    const rows = this.getRows();
    const cells = this.getCells(rows[rowIndex]);

    // Collect text from all merged cells
    const mergedText = cells
      .slice(startCol, endCol + 1)
      .map((c) => this.extractCellText(c))
      .filter(Boolean)
      .join(" ");

    // Set gridSpan on the first cell
    const firstCell = cells[startCol];
    const tcPr = this.ensureCellProps(firstCell);
    tcPr["w:gridSpan"] = { $: { "w:val": String(endCol - startCol + 1) } };
    firstCell["w:p"] = { "w:r": { "w:t": mergedText } };

    // Remove the consumed cells
    cells.splice(startCol + 1, endCol - startCol);
    this.setCells(rows[rowIndex], cells);
    this.setRows(rows);
    return this;
  }

  /**
   * Vertically merge cells in a column from startRow to endRow (inclusive).
   * Equivalent to Layout → Merge Cells (vertical selection).
   */
  public mergeCellsVertical(colIndex: number, startRow: number, endRow: number): this {
    if (startRow >= endRow) throw new Error("startRow must be less than endRow");
    const rows = this.getRows();

    // First cell: vMerge with val="restart"
    const firstCell = this.getCells(rows[startRow])[colIndex];
    if (!firstCell) throw new Error(`Cell [${startRow},${colIndex}] not found`);
    this.ensureCellProps(firstCell)["w:vMerge"] = { $: { "w:val": "restart" } };

    // Subsequent cells: vMerge (no val = continuation)
    for (let r = startRow + 1; r <= endRow; r++) {
      const cell = this.getCells(rows[r])[colIndex];
      if (!cell) throw new Error(`Cell [${r},${colIndex}] not found`);
      this.ensureCellProps(cell)["w:vMerge"] = {};
      cell["w:p"] = { "w:r": { "w:t": "" } }; // empty content in continuation rows
    }

    this.setRows(rows);
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DISTRIBUTE  (Layout tab)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Set all rows to the same height (based on tallest row or a fixed value).
   * Equivalent to Layout → Distribute Rows.
   */
  public distributeRows(heightTwips?: number): this {
    const rows = this.getRows();
    const h = heightTwips ?? 400;
    rows.forEach((_, i) => this.setRowHeight(i, h, "atLeast"));
    return this;
  }

  /**
   * Set all columns to equal width.
   * Equivalent to Layout → Distribute Columns.
   */
  public distributeColumns(): this {
    const colCount = this.getColumnCount();
    if (colCount === 0) return this;
    const tblPr = this.ensureTableProps();
    const totalW = parseInt(tblPr["w:tblW"]?.["$"]?.["w:w"] ?? "9360", 10);
    const perCol = Math.floor(totalW / colCount);
    for (let c = 0; c < colCount; c++) this.setColumnWidth(c, perCol);
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SORT  (Layout tab)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Sort data rows (skipping the header row) by the value in colIndex.
   * Equivalent to Layout → Sort.
   */
  public sortByColumn(
    colIndex: number,
    direction: "asc" | "desc" = "asc",
    hasHeaderRow = true,
  ): this {
    const rows = this.getRows();
    const headerRows = hasHeaderRow ? rows.splice(0, 1) : [];

    rows.sort((a, b) => {
      const aText = this.extractCellText(this.getCells(a)[colIndex] ?? {});
      const bText = this.extractCellText(this.getCells(b)[colIndex] ?? {});
      const aNum = parseFloat(aText);
      const bNum = parseFloat(bText);
      const numeric = !isNaN(aNum) && !isNaN(bNum);
      const cmp = numeric ? aNum - bNum : aText.localeCompare(bText);
      return direction === "asc" ? cmp : -cmp;
    });

    this.setRows([...headerRows, ...rows]);
    return this;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTPUT
  // ═══════════════════════════════════════════════════════════════════════════

  /** Raw table object for serialisation. */
  public toObject(): TableObject {
    return this.table;
  }
}
