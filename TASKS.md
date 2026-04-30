# mdocxengine — Full Enhancement Task List

## Phase 1 — Bug Fixes & Existing API Completion

### 1.1 Fix `ZipManager.toBuffer()`
- **File:** `src/utils/ZipManager.ts`
- **Problem:** `toBuffer()` calls `this.toBuffer()` recursively, causing a stack overflow.
- **Fix:** Call `super.toBuffer()` or use `this.writeZip()` to get the buffer.

### 1.2 Fix `HeaderManager.getAllheadersFiles()`
- **File:** `src/core/PartsManagers/HeaderManager.ts`
- **Problem:** The method increments `count` for every entry that starts with `word/`, not just headers. This causes wrong filenames like `word/header5.xml` even if only 1 header exists.
- **Fix:** Filter entries by name matching `/word\/header\d+\.xml/` and derive the name directly from the entry name.

### 1.3 Make `DocumentManager.addHeaderReferenceToDocument()` public
- **File:** `src/core/PartsManagers/DocumentManager.ts`
- **Problem:** The method is `private`, so `HeaderManager` cannot call it.
- **Fix:** Change to `public`. Update signature to accept `relId` and optionally `type` (`"default" | "first" | "even"`).

### 1.4 Implement `HeaderManager.addHeader(content)`
- **File:** `src/core/PartsManagers/HeaderManager.ts`
- **Steps:**
  1. Determine next available header filename (`word/header<n>.xml`) by scanning existing entries.
  2. Build `<w:hdr>` XML from the provided content (text string or pre-built XML object).
  3. Add the file to the zip via `this.zip.addFile()`.
  4. Generate a new `rId` via `this.rels.genId()`.
  5. Call `this.rels.addRelationship(rId, HEADER_REL_TYPE, "header<n>.xml")`.
  6. Call `this.contentTypes.addOverride("/word/header<n>.xml", HEADER_CONTENT_TYPE)`.
  7. Call `documentManager.addHeaderReferenceToDocument(rId, type)`.
- **Return:** `{ headerPath, relId, headerXml }`

### 1.5 Implement `HeaderManager.updateHeader(name, newXml)`
- **File:** `src/core/PartsManagers/HeaderManager.ts`
- **Steps:**
  1. Validate that `name` exists in `this.headers`.
  2. Overwrite the entry in the zip using `this.zip.addFile(name, Buffer.from(newXml))`.
  3. Update the local `this.headers` cache.

### 1.6 Implement `HeaderManager.removeHeader(name)`
- **File:** `src/core/PartsManagers/HeaderManager.ts`
- **Steps:**
  1. Delete the zip entry.
  2. Remove the `<Override>` from `[Content_Types].xml` via `this.contentTypes.removeOverride()`.
  3. Remove the relationship from `.rels`.
  4. Remove the `<w:headerReference>` from `word/document.xml` `<w:sectPr>`.
  5. Update the local `this.headers` cache.

### 1.7 Implement `FooterManager` (mirror of `HeaderManager`)
- **File:** `src/core/PartsManagers/FooterManager.ts`
- **Methods to implement:**
  - `getAllFooterFiles(zip)` — discover `word/footer<n>.xml` entries
  - `getFooterByName(name)` — lookup by filename
  - `addFooter(content, type?)` — full registration flow
  - `updateFooter(name, newXml)`
  - `removeFooter(name)`

---

## Phase 2 — Core Document Manipulation

### 2.1 Implement `DocumentManager.getParagraphs()`
- **File:** `src/core/PartsManagers/DocumentManager.ts`
- **Steps:**
  1. Read `word/document.xml` via `this.zip.readAsText()`.
  2. Use `getParagraphsFromXmlFile()` helper to extract raw `<w:p>` strings.
  3. Parse each with `Paragraph.createFromXml()`.
  4. Return `Paragraph[]`.

### 2.2 Implement `DocumentManager.getParagraphById(paraId)`
- **File:** `src/core/PartsManagers/DocumentManager.ts`
- **Steps:**
  1. Call `this.getParagraphs()`.
  2. Find the paragraph whose `paragraph.$["w14:paraId"]` matches.
  3. Return `Paragraph | null`.

### 2.3 Implement `DocumentManager.getParagraphByIndex(index)`
- **File:** `src/core/PartsManagers/DocumentManager.ts`
- Return `(await this.getParagraphs())[index] ?? null`.

### 2.4 Implement `DocumentManager.insertParagraph(paragraph, index?)`
- **File:** `src/core/PartsManagers/DocumentManager.ts`
- **Steps:**
  1. Parse `word/document.xml`.
  2. Locate `w:body` → `w:p[]` array.
  3. Splice the new paragraph's object at the given index (or append if no index).
  4. Generate a unique `w14:paraId` via `paragraph.generateUniqueParaId(this.zip)`.
  5. Rebuild and write back the XML.

### 2.5 Implement `DocumentManager.deleteParagraph(paraId)`
- **File:** `src/core/PartsManagers/DocumentManager.ts`
- **Steps:**
  1. Parse `word/document.xml`.
  2. Filter out the `w:p` whose `w14:paraId` matches.
  3. Rebuild and write back the XML.

### 2.6 Implement `DocumentManager.replaceParagraph(paraId, newParagraph)`
- **File:** `src/core/PartsManagers/DocumentManager.ts`
- **Steps:**
  1. Parse `word/document.xml`.
  2. Find and swap the matching `w:p` with the new paragraph object.
  3. Rebuild and write back the XML.

### 2.7 Implement `DocumentManager.saveChanges(paragraphs)`
- **File:** `src/core/PartsManagers/DocumentManager.ts`
- Accept a full `Paragraph[]` and write them back to `word/document.xml`, replacing all existing body paragraphs (preserving `<w:sectPr>`).

### 2.8 Implement `DocumentManager.findAndReplaceAll(search, replace)`
- **File:** `src/core/PartsManagers/DocumentManager.ts`
- **Steps:**
  1. Get all paragraphs.
  2. Call `paragraph.replaceText(search, replace)` on each.
  3. Call `this.saveChanges(paragraphs)`.
  4. Optionally: also run find/replace inside headers and footers.

---

## Phase 3 — New Managers

### 3.1 Create `StylesManager`
- **File:** `src/core/PartsManagers/StylesManager.ts`
- **Methods:**
  - `listStyles()` → `{ id: string; name: string; type: string }[]` — read all `<w:style>` entries from `word/styles.xml`
  - `getStyle(styleId)` → raw style object or null
  - `addStyle(styleObj)` — insert a new `<w:style>` element
  - `removeStyle(styleId)`
- **Integration:** Add `styles: StylesManager` property to `Mdocxengine`.

### 3.2 Create `NumberingManager`
- **File:** `src/core/PartsManagers/NumberingManager.ts`
- **Methods:**
  - `getNumberingDefinitions()` → list of abstract/concrete numbering defs from `word/numbering.xml`
  - `applyNumbering(paragraph, numId, ilvl)` — set `<w:numPr>` on paragraph's `w:pPr`
  - `addNumberingDefinition(def)` — insert a new definition
- **Integration:** Add `numbering: NumberingManager` property to `Mdocxengine`.

### 3.3 Create `MetadataManager`
- **File:** `src/core/PartsManagers/MetadataManager.ts`
- **Covers:** `docProps/core.xml` (title, subject, author, created, modified) and `docProps/app.xml` (application, page count, word count)
- **Methods:**
  - `getCoreProperties()` → `{ title, subject, creator, created, modified, ... }`
  - `setCoreProperties(props)` — partial update
  - `getAppProperties()` → `{ application, pages, words, ... }`
- **Integration:** Add `metadata: MetadataManager` property to `Mdocxengine`.

### 3.4 Create `MediaManager`
- **File:** `src/core/PartsManagers/MediaManager.ts`
- **Methods:**
  - `listImages()` → `{ name: string; buffer: Buffer }[]` — all files in `word/media/`
  - `insertImage(imageBuffer, extension)` → `{ imagePath, relId }` — add to zip, register rel and content type
  - `extractImage(name)` → `Buffer | null`
  - `replaceImage(name, newBuffer)` — overwrite existing media entry
- **Integration:** Add `media: MediaManager` property to `Mdocxengine`.

---

## Phase 4 — Rich Content

### 4.1 Build `Run` class
- **File:** `src/core/files/paragraph/Run.ts`
- Wraps a single `Run` interface object and provides a fluent API:
  - `setBold(on?)` / `setItalic(on?)`
  - `setFontSize(halfPoints)` — sets `<w:sz>` and `<w:szCs>`
  - `setFontFamily(ascii, cs?)` — sets `<w:rFonts>`
  - `setColor(hex)` — sets `<w:color>`
  - `setUnderline(style?)` — sets `<w:u>`
  - `setHighlight(color)` — sets `<w:highlight>`
  - `getText()` → string
  - `setText(text)`
  - `toObject()` → raw `Run` interface object

### 4.2 Integrate `Run` class into `Paragraph`
- **File:** `src/core/files/paragraph/index.ts`
- Add `getRuns()` → `Run[]` (wraps each `w:r` in a `Run` instance)
- Add `addRun(run: Run)`
- Add `removeRun(index: number)`

### 4.3 Build `Table` class and types
- **File:** `src/core/files/table/index.ts` + `src/core/files/table/types.ts`
- **Types needed:** `Table`, `TableRow`, `TableCell`
- **Methods:**
  - `getRowCount()` → number
  - `getColumnCount(rowIndex?)` → number
  - `getCell(row, col)` → `TableCell`
  - `getCellText(row, col)` → string
  - `setCellText(row, col, text)`
  - `addRow(cells?: string[])` — append a new `<w:tr>`
  - `removeRow(index)`
  - `toObject()` → raw parsed table object

### 4.4 Implement `DocumentManager.getTables()`
- **File:** `src/core/PartsManagers/DocumentManager.ts`
- Parse `word/document.xml`, find all `<w:tbl>` elements, wrap in `Table` instances, return `Table[]`.

### 4.5 Implement `DocumentManager.insertTable(table, index?)`
- Insert a `Table` object into the body at the given paragraph index.

---

## Phase 5 — Integration & Wiring

### 5.1 Update `Mdocxengine` constructor
- **File:** `src/index.ts`
- Add properties: `styles`, `numbering`, `metadata`, `media`
- Instantiate all new managers with the shared `ZipManager`.

### 5.2 Update public exports
- **File:** `src/index.ts`
- Export: `StylesManager`, `NumberingManager`, `MetadataManager`, `MediaManager`, `Table`, `Run`

### 5.3 Update `static loadFromFile()`
- Ensure any lazy-loaded state (e.g., paragraphs cache) is handled correctly after load.

---

## Phase 6 — Testing

### 6.1 Tests for bug fixes
- `ZipManager.toBuffer()` does not recurse
- `HeaderManager.getAllheadersFiles()` returns correct count with sample docx

### 6.2 Tests for `DocumentManager`
- `getParagraphs()` returns correct count from sample file
- `getParagraphById()` returns correct paragraph or null
- `insertParagraph()` increases paragraph count and appears at correct index
- `deleteParagraph()` removes correct paragraph
- `replaceParagraph()` swaps content correctly
- `findAndReplaceAll()` replaces text in all matching paragraphs

### 6.3 Tests for `HeaderManager`
- `addHeader()` adds file to zip, registers rel, override, and sectPr reference
- `updateHeader()` overwrites file content
- `removeHeader()` removes file, rel, override, and sectPr reference

### 6.4 Tests for `FooterManager`
- Mirror of HeaderManager tests

### 6.5 Tests for `StylesManager`
- `listStyles()` returns expected style IDs from sample file
- `getStyle()` returns correct object
- `addStyle()` / `removeStyle()` round-trips

### 6.6 Tests for `MetadataManager`
- `getCoreProperties()` returns correct title and author
- `setCoreProperties()` writes changes and reads back

### 6.7 Tests for `MediaManager`
- `listImages()` returns correct files from sample docx with images
- `insertImage()` adds entry to zip and registers rel + content type
- `replaceImage()` overwrites buffer

### 6.8 Tests for `Run` class
- `setBold()`, `setItalic()`, `setFontSize()`, `setColor()` all mutate the underlying object correctly

### 6.9 Tests for `Table` class
- `getRowCount()`, `getColumnCount()`, `getCellText()`, `setCellText()`, `addRow()`, `removeRow()`

---

## Phase 7 — Docs & Quality

### 7.1 Update `CLAUDE.md`
- Document all new managers, methods, and architecture changes.

### 7.2 Verify build passes
- `npm run build` produces `dist/index.mjs`, `dist/index.cjs`, `dist/index.d.ts`

### 7.3 Verify coverage thresholds
- `npm run test:ci` must pass with: statements 100%, functions 100%, lines 100%, branches ≥ 99.68%

### 7.4 Run Prettier
- `npm run prettier:fix` — ensure all new files are formatted consistently

---

## Summary Checklist

| # | Task | Phase |
|---|------|-------|
| 1 | Fix `ZipManager.toBuffer()` | 1 |
| 2 | Fix `HeaderManager.getAllheadersFiles()` | 1 |
| 3 | Make `DocumentManager.addHeaderReferenceToDocument()` public | 1 |
| 4 | Implement `HeaderManager.addHeader()` | 1 |
| 5 | Implement `HeaderManager.updateHeader()` / `removeHeader()` | 1 |
| 6 | Implement `FooterManager` | 1 |
| 7 | Implement `DocumentManager.getParagraphs()` | 2 |
| 8 | Implement `DocumentManager.getParagraphById()` / `ByIndex()` | 2 |
| 9 | Implement `DocumentManager.insertParagraph()` | 2 |
| 10 | Implement `DocumentManager.deleteParagraph()` | 2 |
| 11 | Implement `DocumentManager.replaceParagraph()` | 2 |
| 12 | Implement `DocumentManager.saveChanges()` | 2 |
| 13 | Implement `DocumentManager.findAndReplaceAll()` | 2 |
| 14 | Create `StylesManager` | 3 |
| 15 | Create `NumberingManager` | 3 |
| 16 | Create `MetadataManager` | 3 |
| 17 | Create `MediaManager` | 3 |
| 18 | Build `Run` class with formatting API | 4 |
| 19 | Integrate `Run` into `Paragraph` | 4 |
| 20 | Build `Table` class and types | 4 |
| 21 | Implement `DocumentManager.getTables()` | 4 |
| 22 | Implement `DocumentManager.insertTable()` | 4 |
| 23 | Wire all managers into `Mdocxengine` | 5 |
| 24 | Update public exports | 5 |
| 25 | Tests for bug fixes | 6 |
| 26 | Tests for `DocumentManager` | 6 |
| 27 | Tests for `HeaderManager` / `FooterManager` | 6 |
| 28 | Tests for `StylesManager` | 6 |
| 29 | Tests for `MetadataManager` | 6 |
| 30 | Tests for `MediaManager` | 6 |
| 31 | Tests for `Run` class | 6 |
| 32 | Tests for `Table` class | 6 |
| 33 | Update `CLAUDE.md` | 7 |
| 34 | Verify build passes | 7 |
| 35 | Verify coverage thresholds | 7 |
| 36 | Run Prettier on all new files | 7 |
