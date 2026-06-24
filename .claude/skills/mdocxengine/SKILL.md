---
name: mdocxengine
description: Use when reading, writing, or manipulating Word .docx files programmatically — paragraphs, tables, headers, footers, images, styles, numbering, captions, shapes, footnotes, TOC, sections, or page layout. Also use when doing byte-perfect round-trip edits on existing .docx documents.
---

# mdocxengine

TypeScript library for reading, manipulating, and writing Word (.docx) files. Treats .docx as a ZIP of XML and provides manager classes for every document part.

## Install

```bash
npm install mdocxengine
```

## Quick Start

```typescript
import { Mdocxengine } from "mdocxengine";

// Load from file or buffer
const doc = await Mdocxengine.loadFromFile("thesis.docx");
const doc = await Mdocxengine.loadFromBuffer(buffer);

// Save
await doc.saveToFile("output.docx");
const buf = doc.zip.toBuffer(); // in-memory buffer
```

## Architecture

`Mdocxengine` is the main facade. It exposes manager instances:

| Manager | Property | Key Methods |
|---------|----------|-------------|
| DocumentManager | `doc.document` | getParagraphs, getTables, getBlocks, saveBlocks, insertParagraph, deleteParagraph, findAndReplaceAll |
| StylesManager | `doc.styles` | listStyles, getStyle, addStyle, updateStyle, removeStyle |
| HeaderManager | `doc.header` | addPageNumbers, addPageNumberWithFormat |
| FooterManager | `doc.footer` | addPageNumbers, addPageNumberWithFormat |
| MediaManager | `doc.media` | listImages, extractImage, insertImage |
| NumberingManager | `doc.numbering` | listNumberingDefinitions, addNumberingDefinition |
| MetadataManager | `doc.metadata` | get/set title, author, subject, keywords |
| PageLayoutManager | `doc.pageLayout` | setPageSize, setMargins, setOrientation, setColumns |
| ShapeManager | `doc.shapes` | insertTextBox, insertShape, insertLine, listShapes |
| CaptionManager | `doc.captions` | addCaption, listCaptions |
| FootnoteManager | `doc.footnotes` | listFootnotes, addFootnote |
| EndnoteManager | `doc.endnotes` | listEndnotes, addEndnote |
| TableOfContentsManager | `doc.toc` | generateToc |
| CrossReferenceManager | `doc.crossRef` | addBookmark, addCrossReference |
| CitationManager | `doc.citations` | addSource, listSources |
| CommentsManager | `doc.comments` | listComments, addComment |
| TrackedChangesManager | `doc.trackedChanges` | listRevisions, acceptAll, rejectAll |
| SectionManager | `doc.sections` | listSections, addSectionBreak |
| RelManager | `doc.rels` | relationship management |
| ContentTypesManager | `doc.contentTypes` | MIME type registry |

## Two Editing Paths

### 1. Paragraph API (xml2js — full parse)

```typescript
const paras = await doc.document.getParagraphs();
paras[0].replaceText("old", "new");
paras[0].setAlignment("center");
paras[0].applyStyle("Heading1");
await doc.document.saveChanges(paras);
```

Paragraph methods: `getPlainText()`, `replaceText()`, `appendText()`, `getRuns()`, `addRun()`, `addHyperlink()`, `clone()`, `splitAt()`, `mergeWith()`, `getWordCount()`, `detectLanguage()`, `toXml()`.

Run methods: `getText()`, `setText()`, `setBold()`, `setItalic()`, `setColor()`, `setFontName()`, `setFontSize()`, `clone()`.

### 2. OrderedBody API (string-level — byte-perfect round-trip)

**Preferred for surgical edits.** Untouched blocks stay verbatim — no XML re-serialization corruption.

```typescript
import {
  parseOrderedDoc, buildOrderedDoc, toBlocks,
  makeParagraphNode, makeTableNode, makeDrawingParagraphNode,
  setParagraphText, paragraphText, paragraphStyleId, nodeTag,
} from "mdocxengine";

// Via DocumentManager
const blocks = await doc.document.getBlocks();
// blocks: BodyBlock[] = [{ kind, tag, xml }]

await doc.document.editParagraphText(index, "new text");
await doc.document.insertBlockAt(index, block);
await doc.document.deleteBlockAt(index);
await doc.document.saveBlocks(blocks);

// Low-level
const split = parseOrderedDoc(xmlString);
// split.blocks: BodyBlock[] — each has { kind: "paragraph"|"table"|"sectPr"|"other", tag, xml }
const rebuilt = buildOrderedDoc(split); // identity round-trip

// Helpers
const block = makeParagraphNode("paraId", "Hello world");
const table = makeTableNode();
const drawing = makeDrawingParagraphNode(relId);
const text = paragraphText(block.xml);
const style = paragraphStyleId(block.xml);
const newXml = setParagraphText(block.xml, "new text");
```

**BodyBlock type:**
```typescript
type BlockKind = "paragraph" | "table" | "sectPr" | "other";
interface BodyBlock { kind: BlockKind; tag: string; xml: string; }
```

## Tables

```typescript
const tables = await doc.document.getTables();
const t = tables[0];
t.getRowCount(); t.getColCount();
t.getCellText(row, col);
t.setCellText(row, col, "value");
t.getAllCellText(); // string[][]
t.insertRow(index, cells);
t.deleteRow(index);
t.insertColumn(index);
t.deleteColumn(index);
t.setTableStyle("TableGrid");
t.setTableBorders({ top: { val: "single", sz: "4", color: "000000" } });
await doc.document.saveChanges(paras); // saves tables too
```

## Images

```typescript
const { relId, imagePath } = await doc.media.insertImage(buffer, "png");
// Then create a drawing paragraph referencing relId:
const drawingBlock = makeDrawingParagraphNode(relId);
await doc.document.insertBlockAt(index, drawingBlock);
```

## Headers & Footers

```typescript
await doc.header.addPageNumbers({ format: "decimal", alignment: "center" });
await doc.footer.addPageNumbers({ format: "roman", alignment: "right" });
// Supports "default", "first", "even" types
```

## Page Layout

```typescript
import { PAGE_SIZES, MARGIN_PRESETS, inchesToTwips, cmToTwips } from "mdocxengine";

await doc.pageLayout.setPageSize("A4");
await doc.pageLayout.setMargins(MARGIN_PRESETS.normal);
await doc.pageLayout.setOrientation("portrait");
await doc.pageLayout.setColumns({ count: 2, space: cmToTwips(1) });
```

## Styles

```typescript
const styles = await doc.styles.listStyles(); // [{id, name, type}]
await doc.styles.addStyle({ id: "CustomH1", name: "Custom Heading 1", type: "paragraph", basedOn: "Heading1" });
await doc.styles.updateStyle("CustomH1", { fontSize: "28" });
```

## Shapes

```typescript
import { EMU_PER_CM } from "mdocxengine";
// Types: rect, roundRect, ellipse, triangle, diamond, line, arrow, star5, cloud, heart
await doc.shapes.insertTextBox(paragraph, "Hello", { x: 0, y: 0 }, { width: 5 * EMU_PER_CM, height: 2 * EMU_PER_CM });
await doc.shapes.insertShape("ellipse", { x: 0, y: 0 }, { width: 100, height: 100 });
```

## Common Patterns

### Full document generation (thesis/report)
```typescript
const doc = await Mdocxengine.loadFromFile("template.docx");
const blocks = await doc.document.getBlocks();
// Insert title, chapters, tables, figures using OrderedBody API
// Set page layout, headers, footers, numbering
await doc.saveToFile("output.docx");
```

### Surgical edit (change one paragraph)
```typescript
const doc = await Mdocxengine.loadFromBuffer(buf);
await doc.document.editParagraphText(3, "Updated text");
return doc.zip.toBuffer();
```

### Find and replace
```typescript
const doc = await Mdocxengine.loadFromFile("contract.docx");
await doc.document.findAndReplaceAll("{{NAME}}", "John Doe");
await doc.saveToFile("filled.docx");
```

## Key Exports

```typescript
// Classes
export { Mdocxengine, Paragraph, Run, Table, ZipManager };
// All managers (DocumentManager, StylesManager, etc.)

// OrderedBody functions
export { parseOrderedDoc, buildOrderedDoc, toBlocks, makeParagraphNode,
  makeParagraphXml, makeTableNode, makeTableXml, makeDrawingParagraphNode,
  makeDrawingParagraphXml, nextDrawingId, paragraphText, paragraphStyleId,
  setParagraphText, nodeTag };

// Types
export type { BodyBlock, BlockKind, StyleEntry, NumberingDefinition,
  CoreProperties, AppProperties, ImageEntry, TableObject, TableRow, TableCell,
  FootnoteEntry, EndnoteEntry, TocOptions, BookmarkEntry, CitationSource,
  PageSizePreset, MarginPreset, Orientation, SectionBreakType, PageSize,
  PageMargins, ColumnOptions, LineNumberingOptions, CaptionOptions,
  CaptionEntry, CommentEntry, RevisionEntry, RevisionType, SectionEntry,
  ShapeEntry, TextBoxOptions, ShapeType, ShapePosition, ShapeSize };

// Constants
export { PAGE_SIZES, MARGIN_PRESETS, inchesToTwips, cmToTwips, twipsToInches,
  twipsToCm, EMU_PER_INCH, EMU_PER_CM };
```

## Common Mistakes

- **Using xml2js path for surgical edits**: Prefer OrderedBody API — it preserves untouched blocks verbatim.
- **Forgetting saveChanges/saveBlocks**: Edits are in-memory until you call save.
- **Not creating relationship for images**: `insertImage` returns a `relId` — you must reference it in a drawing paragraph.
- **Mixing edit paths**: Don't mix getParagraphs/saveChanges with getBlocks/saveBlocks in the same edit session.
