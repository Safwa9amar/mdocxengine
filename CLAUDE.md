# mdocxengine — Agent Reference

## What This Project Is

`mdocxengine` is a TypeScript library for reading and manipulating `.docx` (Word) files by treating them as ZIP archives and operating directly on the underlying Office Open XML (OOXML). Published as an npm package targeting Node 18+.

---

## Architecture Overview

A `.docx` file is a ZIP archive containing XML part files. This library maps each major part to a dedicated **Manager class**, all sharing the same `ZipManager` instance. Mutations are in-memory until `saveToFile()` is called.

```
Mdocxengine (src/index.ts)
├── ZipManager          — low-level ZIP I/O (wraps adm-zip)
├── RelManager          — word/_rels/document.xml.rels
├── RootRelManager      — _rels/.rels  (extends RelManager)
├── ContentTypesManager — [Content_Types].xml
├── DocumentManager     — word/document.xml (paragraphs + tables)
├── HeaderManager       — word/header*.xml
├── FooterManager       — word/footer*.xml
├── StylesManager       — word/styles.xml
├── NumberingManager    — word/numbering.xml
├── MetadataManager     — docProps/core.xml + docProps/app.xml
└── MediaManager        — word/media/  (images)
```

---

## Source Layout

```
src/
  index.ts                          — public entry point, re-exports everything
  config/
    enums.ts                        — RelsType, DefaultContentTypeEnum, OverrideContentTypeEnum
    ContentTypes.ts
    baseOverrides.ts
    index.ts
  constants/
    xmlns.ts                        — XML_NAMESPACES map + XmlNamespacePrefix type
    docxPaths.ts                    — typed path constants (WordPath, HeaderFile, FooterFile, etc.)
    rootNames.ts
    index.ts
  utils/
    ZipManager.ts                   — AdmZip subclass; static loadFromFile(), saveToFile(), toBuffer()
    xmlUtils.ts                     — parseXml() + buildXml() (xml2js, rootName now working)
    XmlnsManager.ts                 — generates xmlns attribute strings
    Logger.ts                       — logger singleton → logs/app.log
  core/
    PartsManagers/
      ContentTypesManager.ts        — addDefault, addOverride, removeOverride, hasOverride
      DocumentManager.ts            — full paragraph + table CRUD API
      HeaderManager.ts              — getAllheadersFiles, addHeader, updateHeader, removeHeader
      FooterManager.ts              — getAllFooterFiles, addFooter, updateFooter, removeFooter
      RelManager.ts                 — addRelationship, genId
      RootRelManager.ts             — same as RelManager for _rels/.rels
      StylesManager.ts              — listStyles, getStyle, addStyle, removeStyle
      NumberingManager.ts           — getNumberingDefinitions, applyNumbering, addNumberingDefinition
      MetadataManager.ts            — getCoreProperties, setCoreProperties, getAppProperties, setAppProperties
      MediaManager.ts               — listImages, extractImage, insertImage, replaceImage, deleteImage
    files/
      paragraph/
        index.ts                    — Paragraph class (rich manipulation + Run integration)
        types.ts                    — Paragraph, Run, Hyperlink, Field, Drawing, RunProperties, TextNode
        Run.ts                      — Run class with full formatting API
      header/
        index.ts                    — Header stub
      table/
        index.ts                    — Table class
        types.ts                    — TableObject, TableRow, TableCell, TableProperties
  helpers/
    extractParaIds.ts               — extract all w14:paraId values from XML string
    getParagraphsFromXml.ts         — extract raw <w:p>…</w:p> blocks from XML string
    getDocxFiles.ts
    index.ts
```

---

## Key Classes & APIs

### `Mdocxengine` (src/index.ts)
```ts
const engine = await Mdocxengine.loadFromFile("path/to/file.docx");
await engine.saveToFile("path/to/output.docx");

// All managers:
engine.zip          // ZipManager
engine.rels         // RelManager
engine.rootRels     // RootRelManager
engine.contentTypes // ContentTypesManager
engine.document     // DocumentManager
engine.header       // HeaderManager
engine.footer       // FooterManager
engine.styles       // StylesManager
engine.numbering    // NumberingManager
engine.metadata     // MetadataManager
engine.media        // MediaManager
```

### `DocumentManager` (src/core/PartsManagers/DocumentManager.ts)

**Paragraph API**

| Method | Description |
|---|---|
| `getParagraphs()` | `Paragraph[]` from word/document.xml |
| `getParagraphById(paraId)` | Find by `w14:paraId` → `Paragraph \| null` |
| `getParagraphByIndex(n)` | Find by zero-based index → `Paragraph \| null` |
| `insertParagraph(p, index?)` | Insert at index or append |
| `deleteParagraph(paraId)` | Remove by paraId |
| `replaceParagraph(paraId, p)` | Swap by paraId |
| `saveChanges(paragraphs)` | Write full `Paragraph[]` back, preserving `<w:sectPr>` |
| `findAndReplaceAll(search, replace)` | Global text replace across all paragraphs |

**Header/Footer references**

| Method | Description |
|---|---|
| `addHeaderReferenceToDocument(relId, type?)` | Add `<w:headerReference>` to `<w:sectPr>` |
| `addFooterReferenceToDocument(relId, type?)` | Add `<w:footerReference>` to `<w:sectPr>` |

**Table API**

| Method | Description |
|---|---|
| `getTables()` | `Table[]` from word/document.xml |
| `insertTable(table, index?)` | Insert Table at body index or append |

### `Paragraph` (src/core/files/paragraph/index.ts)

| Method | Description |
|---|---|
| `getPlainText(xml?)` | Regex-based text extraction |
| `getPlainTextSafe()` | Recursive traversal (handles hyperlinks, tabs, breaks) |
| `appendText(text)` | Add new run without removing existing content |
| `modifyText(newText)` | Replace all runs with one new run |
| `replaceText(search, replace)` | Find-and-replace inside all `w:t` nodes |
| `setAlignment(align)` | Set `w:jc` on `w:pPr` |
| `getAlignment()` | Read current `w:jc` |
| `applyStyle(styleId)` | Set `w:pStyle` |
| `removeFormatting()` | Clear `w:rPr` on all runs |
| `getWordCount()` | Word count |
| `clone()` | Deep clone |
| `mergeWith(other)` | Append another paragraph's runs |
| `splitAt(index)` | Split into two Paragraphs at char index |
| `addHyperlink(url, text, rsidRPr)` | Add `w:hyperlink` |
| `getHyperlinks()` | Extract `{displayText, url}[]` |
| `removeHyperlinks()` | Flatten hyperlinks to plain runs |
| `getHighlightedRuns(fill?, value?)` | Find runs with `w:shd` shading |
| `hasHighlight()` | Boolean version |
| `detectLanguage()` | Read `w:lang` from first run |
| `generateUniqueParaId(zip)` | Hex ID not already in document.xml |
| `getRuns()` | Returns `Run[]` wrapping all `w:r` elements |
| `addRun(run)` | Append a `Run` instance |
| `removeRun(index)` | Remove run at index |
| `toXml()` | Serialize back to XML string |
| `static createFromXml(xml)` | Parse XML string → Paragraph |

### `Run` (src/core/files/paragraph/Run.ts)

Wraps a single `<w:r>` and provides a fluent formatting API.

| Method | Description |
|---|---|
| `getText()` | Plain text content |
| `setText(text)` | Set/replace text |
| `appendText(text)` | Append to existing text |
| `setBold(on?)` | Toggle `w:b` |
| `setItalic(on?)` | Toggle `w:i` |
| `setUnderline(on?, style?)` | Toggle `w:u` |
| `setShading(color?, value?)` | Set `w:shd` background |
| `setFontSize(halfPoints)` | Set `w:sz` and `w:szCs` |
| `setFontFamily(ascii, cs?)` | Set `w:rFonts` |
| `setColor(hex)` | Set `w:color` (strips leading `#`) |
| `clearFormatting()` | Empty `w:rPr` |
| `isBold()` / `isItalic()` / `hasUnderline()` | State checks |
| `isEmpty()` | True when no text and no fields/drawings |
| `getProperties()` | Raw `RunProperties` object |
| `toObject()` | Raw `Run` interface |
| `toXml()` | Serialize to XML string |
| `static fromText(text)` | Create plain Run from string |

### `HeaderManager` (src/core/PartsManagers/HeaderManager.ts)

| Method | Description |
|---|---|
| `getAllheadersFiles(zip)` | Discover all `word/header*.xml` entries |
| `getHeaderByName(name)` | Lookup by filename |
| `addHeader(text, type?, xml?)` | Full flow: create part → rel → content type → sectPr reference |
| `updateHeader(name, newXml)` | Overwrite header XML in zip |
| `removeHeader(name)` | Delete part, rel, content type override, and sectPr reference |

### `FooterManager` (src/core/PartsManagers/FooterManager.ts)

Mirror of HeaderManager with `addFooter`, `updateFooter`, `removeFooter`, `getAllFooterFiles`, `getFooterByName`.

### `StylesManager` (src/core/PartsManagers/StylesManager.ts)

| Method | Description |
|---|---|
| `listStyles()` | `{ id, name, type }[]` from word/styles.xml |
| `getStyle(styleId)` | Raw style object or null |
| `addStyle(styleObj)` | Insert new style (idempotent on same ID) |
| `removeStyle(styleId)` | Delete style by ID |

### `NumberingManager` (src/core/PartsManagers/NumberingManager.ts)

| Method | Description |
|---|---|
| `getNumberingDefinitions()` | `{ numId, abstractNumId }[]` |
| `applyNumbering(paragraph, numId, ilvl?)` | Set `<w:numPr>` on paragraph |
| `removeNumbering(paragraph)` | Remove `<w:numPr>` from paragraph |
| `addNumberingDefinition(numId, abstractNumId)` | Append new `<w:num>` to numbering.xml |

### `MetadataManager` (src/core/PartsManagers/MetadataManager.ts)

| Method | Description |
|---|---|
| `getCoreProperties()` | `{ title, subject, creator, description, lastModifiedBy, created, modified }` |
| `setCoreProperties(props)` | Partial update (merges with existing) |
| `getAppProperties()` | `{ application, pages, words, characters }` |
| `setAppProperties(props)` | Partial update |

### `MediaManager` (src/core/PartsManagers/MediaManager.ts)

| Method | Description |
|---|---|
| `listImages()` | `{ name, path, buffer }[]` from word/media/ |
| `extractImage(name)` | `Buffer \| null` by filename |
| `insertImage(buffer, extension)` | Add to zip + register rel + content type → `{ imagePath, relId }` |
| `replaceImage(name, newBuffer)` | Overwrite existing image bytes in-place |
| `deleteImage(name)` | Remove from zip |

### `Table` (src/core/files/table/index.ts)

| Method | Description |
|---|---|
| `getRowCount()` | Number of rows |
| `getColumnCount(rowIndex?)` | Number of columns in given row |
| `getCell(row, col)` | Raw `TableCell` or null |
| `getCellText(row, col)` | Plain text from cell |
| `setCellText(row, col, text)` | Replace cell content with plain text |
| `addRow(cellTexts?)` | Append new row |
| `removeRow(index)` | Remove row at index |
| `toObject()` | Raw `TableObject` |

### `RelManager` (src/core/PartsManagers/RelManager.ts)

| Method | Description |
|---|---|
| `addRelationship(id, type, target)` | Append entry to .rels |
| `genId(prefix?)` | Find max existing rId and return prefix+(max+1) |

### `ContentTypesManager` (src/core/PartsManagers/ContentTypesManager.ts)

| Method | Description |
|---|---|
| `addDefault(extension, contentType)` | Idempotent |
| `addOverride(partName, contentType)` | Idempotent |
| `removeOverride(partName)` | Delete override |
| `hasOverride(partName)` | Boolean check |
| `generateUniquePartName(prefix, ext?)` | GUID-based path |

### `ZipManager` (src/utils/ZipManager.ts)

| Method | Description |
|---|---|
| `static loadFromFile(path)` | Load .docx from disk → `ZipManager` |
| `getFileAsBuffer(name)` | `Buffer \| null` |
| `getFileAsString(name)` | `string \| null` |
| `fileExists(name)` | Boolean |
| `saveToFile(path)` | Write zip to disk (async) |
| `toBuffer()` | In-memory buffer (calls `super.toBuffer()`) |

---

## XML Parsing Convention

All XML parsed/built with **xml2js**:
- `attrkey: "$"` — XML attributes on `$` key
- `charkey: "_"` — text content on `_` key
- `explicitArray: false` — single children are objects, not arrays
- `trim: true`

`buildXml(obj, { rootName: "w:document" })` — `rootName` is now active and required for correct round-trips. Always normalize to array before pushing to any XML collection.

---

## Path Alias

`@/` → `src/` (tsconfig paths + vite-tsconfig-paths).

---

## Build & Test

| Command | What it does |
|---|---|
| `npm run build` | `tsc` + `vite build --ssr` → `dist/` |
| `npm test` | Vitest UI + coverage |
| `npm run test:ci` | Vitest headless |
| `npm run prettier:fix` | Format all source files |

Build outputs: `dist/index.mjs` (ESM), `dist/index.js` (CJS), `dist/index.d.ts` + `dist/index.d.cts`.

Coverage thresholds: 100% statements, functions, lines; 99.68% branches.

The existing `src/core/PartsManagers/HeaderManager.spec.ts` calls the Google AI API and will fail in CI without a valid `GOOGLE_API_KEY` — this is pre-existing and unrelated to the library's own logic.

---

## Key Dependencies

| Package | Role |
|---|---|
| `adm-zip` | ZIP read/write |
| `xml2js` | XML ↔ JS object parsing and building |
| `dotenv` | Load `.env` |
| `@google/genai` | AI integration (used in demo/test scripts) |
| `vitest` | Test runner |
| `vite` + `vite-plugin-dts` | Library bundler |

---

## OOXML Concepts

- **`word/document.xml`** — main body; `<w:body>` → `<w:p>` paragraphs + `<w:tbl>` tables + `<w:sectPr>` section properties.
- **`word/_rels/document.xml.rels`** — relationships for headers, footers, images, hyperlinks.
- **`_rels/.rels`** — root relationships (document, core props, app props).
- **`[Content_Types].xml`** — MIME types for all parts via `<Default>` and `<Override>`.
- **`<w:sectPr>`** — section properties; contains `<w:headerReference>` and `<w:footerReference>`.
- **`w14:paraId`** — unique 8-char hex ID per paragraph, used for lookup and revision tracking.
- **`word/styles.xml`** — style definitions; each `<w:style>` has a `w:styleId` attribute.
- **`word/numbering.xml`** — list/numbering definitions; `<w:abstractNum>` + `<w:num>`.
- **`docProps/core.xml`** — Dublin Core metadata (title, creator, dates).
- **`docProps/app.xml`** — application metadata (page count, word count).
- **`word/media/`** — embedded images (`image1.png`, `image2.jpg`, etc.).

---

## Known Bugs Fixed

| Bug | File | Fix |
|---|---|---|
| `toBuffer()` infinite recursion | `ZipManager.ts` | Changed to `super.toBuffer()` |
| `getAllheadersFiles()` counted all `word/` entries | `HeaderManager.ts` | Now filters by `/^word\/header\d+\.xml$/` |
| `addRelationship()` pushed to undefined array | `RelManager.ts` | Fixed conditional initialization |
| `buildXml()` ignored `rootName` option | `xmlUtils.ts` | Uncommented `rootName` in Builder config |
| `w:numPr` missing from `ParagraphProperties` type | `paragraph/types.ts` | Added `w:numPr` with `w:ilvl` and `w:numId` |
| `ZipManager` missing `static loadFromFile()` | `ZipManager.ts` | Added static factory method |
