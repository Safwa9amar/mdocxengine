export interface TableCellProperties {
  "w:tcW"?:    { $: { "w:w": string; "w:type": string } };
  "w:shd"?:    { $: { "w:fill": string; "w:val": string; "w:color"?: string } };
  "w:vAlign"?: { $: { "w:val": string } };
  "w:tcMar"?:  any;
  "w:gridSpan"?: { $: { "w:val": string } };
  "w:vMerge"?: { $?: { "w:val"?: string } } | string;
  [key: string]: any;
}

export interface TableCell {
  $?: Record<string, any>;
  "w:tcPr"?: TableCellProperties;
  "w:p"?: any | any[];
}

export interface TableRowProperties {
  "w:trHeight"?:  { $: { "w:val": string; "w:hRule"?: string } };
  "w:tblHeader"?: Record<string, any>;
  "w:cantSplit"?: Record<string, any>;
  [key: string]: any;
}

export interface TableRow {
  $?: Record<string, any>;
  "w:trPr"?: TableRowProperties;
  "w:tc"?: TableCell | TableCell[];
}

export interface TableProperties {
  "w:tblStyle"?:   { $: { "w:val": string } };
  "w:tblW"?:       { $: { "w:w": string; "w:type": string } };
  "w:jc"?:         { $: { "w:val": string } };
  "w:tblInd"?:     { $: { "w:w": string; "w:type": string } };
  "w:tblBorders"?: any;
  "w:tblLayout"?:  { $: { "w:type": string } };
  "w:tblCellMar"?: any;
  "w:bidiVisual"?: Record<string, any>;
  "w:tblCaption"?: { $: { "w:val": string } };
  "w:tblDescription"?: { $: { "w:val": string } };
  [key: string]: any;
}

export interface TableObject {
  $?: Record<string, any>;
  "w:tblPr"?:   TableProperties;
  "w:tblGrid"?: any;
  "w:tr"?:      TableRow | TableRow[];
}

export interface CellMargins {
  top?:    number; // twips
  bottom?: number;
  left?:   number;
  right?:  number;
}
