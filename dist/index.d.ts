import { default as default_2 } from 'adm-zip';

export declare interface AppProperties {
    application?: string;
    pages?: number;
    words?: number;
    characters?: number;
}

export declare type BlockKind = "paragraph" | "table" | "sectPr" | "other";

/**
 * A single ordered body child, stored as its exact original XML substring.
 * `xml` is the verbatim slice of `document.xml` for this top-level child —
 * including any whitespace/comment text captured as an "other" block.
 */
export declare interface BodyBlock {
    kind: BlockKind;
    tag: string;
    xml: string;
}

export declare interface BookmarkEntry {
    id: number;
    name: string;
    text: string;
}

declare interface BorderSide {
    style?: string;
    size?: number;
    color?: string;
}

/** Reassemble from a SplitDocument (or its parts). */
export declare function buildOrderedDoc(split: SplitDocument): string;

export declare interface CaptionEntry {
    label: string;
    number: string;
    text: string;
    paragraphIndex: number;
}

export declare class CaptionManager {
    private zip;
    private styles;
    private stylesRegistered;
    constructor(zip: default_2);
    /** Register Caption + CaptionChar styles into styles.xml the first time. */
    private ensureStyles;
    private readDocument;
    private writeDocument;
    private getBodyParagraphs;
    /**
     * Build the SEQ field instruction string.
     *
     * With chapter numbers:  SEQ Figure \s 1 \* ARABIC
     * Without chapter numbers: SEQ Figure \* ARABIC
     */
    private buildSeqInstr;
    /**
     * Build a STYLEREF field run array that emits the chapter number.
     * Used only when includeChapterNumber = true.
     *
     * <w:r><w:fldChar begin/></w:r>
     * <w:r><w:instrText> STYLEREF "Heading 1" \n </w:instrText></w:r>
     * <w:r><w:fldChar separate/></w:r>
     * <w:r><w:t>1</w:t></w:r>
     * <w:r><w:fldChar end/></w:r>
     */
    private buildStyleRefRuns;
    /**
     * Build the complete set of <w:r> elements for one caption paragraph.
     *
     * Structure:
     *   [label run]            "Figure " (unless excludeLabel)
     *   [STYLEREF runs]        chapter number (if includeChapterNumber)
     *   [separator run]        "-" (if includeChapterNumber)
     *   [SEQ begin]
     *   [SEQ instrText]
     *   [SEQ separate]
     *   [SEQ placeholder]      "1"
     *   [SEQ end]
     *   [text run]             " My caption text"
     */
    private buildCaptionRuns;
    private buildCaptionParagraph;
    /** Count how many captions for a given label already exist in the document. */
    private countExistingCaptions;
    /**
     * Insert a caption paragraph next to the paragraph at `nearIndex`.
     *
     * `position: "below"` (default) inserts the caption after nearIndex.
     * `position: "above"` inserts the caption before nearIndex.
     *
     * @returns The index at which the caption was inserted.
     */
    insertCaption(nearIndex: number, opts?: CaptionOptions): Promise<number>;
    /**
     * Return all caption paragraphs (those using the "Caption" style).
     * The SEQ field placeholder text is used as the `number`.
     */
    getCaptions(filterLabel?: string): Promise<CaptionEntry[]>;
    /**
     * Remove all caption paragraphs for a given label (e.g. remove all "Figure" captions).
     */
    removeCaptions(label: string): Promise<void>;
    /**
     * Remove a single caption by its paragraph index.
     */
    removeCaptionAt(paragraphIndex: number): Promise<void>;
    /**
     * Convenience: insert a "Figure N — text" caption below a paragraph.
     */
    insertFigureCaption(nearIndex: number, text: string, numbering?: CaptionNumberingOptions): Promise<number>;
    /**
     * Convenience: insert a "Table N — text" caption above or below a table.
     */
    insertTableCaption(nearIndex: number, text: string, position?: CaptionPosition, numbering?: CaptionNumberingOptions): Promise<number>;
    /**
     * Convenience: insert an "Equation N" caption.
     */
    insertEquationCaption(nearIndex: number, text?: string, numbering?: CaptionNumberingOptions): Promise<number>;
    /**
     * Insert a caption with a custom label (New Label in Word's dialog).
     */
    insertCustomCaption(nearIndex: number, label: string, text: string, opts?: Omit<CaptionOptions, "label" | "text">): Promise<number>;
    /**
     * Insert a "List of [label]" — collects all captions for the given label
     * using the field code:  TOC \h \z \c "Figure"
     *
     * Equivalent to Word: References → Insert Table of Figures.
     *
     * @param label     Caption label to collect: "Figure", "Table", "Equation", etc.
     * @param title     Heading shown above the list (pass "" to omit).
     * @param index     Body paragraph index to insert at (default: 0 = top of document).
     */
    /**
     * Build one pre-populated entry paragraph for a caption list.
     * Matches Word's "Table of Figures" style:
     *   <entry text> <dot leader tab> <page number>
     */
    private buildListEntryParagraph;
    insertCaptionList(label: string, title?: string, index?: number): Promise<void>;
    /** Shorthand: insert List of Figures at given index. */
    insertListOfFigures(title?: string, index?: number): Promise<void>;
    /** Shorthand: insert List of Tables at given index. */
    insertListOfTables(title?: string, index?: number): Promise<void>;
    /**
     * Remove the caption list (TOC \c field) for a given label.
     */
    removeCaptionList(label: string): Promise<void>;
}

/** Numbering format matching Word's Caption Numbering dialog */
export declare type CaptionNumberFormat = "arabic" | "ROMAN" | "roman" | "ALPHABETIC" | "alphabetic";

export declare interface CaptionNumberingOptions {
    /** Numbering format (default: "arabic") */
    format?: CaptionNumberFormat;
    /** Include the chapter number (e.g. "Figure 1-1") */
    includeChapterNumber?: boolean;
    /** Heading style that starts each chapter (default: "Heading1") */
    chapterStyle?: string;
    /** Separator between chapter number and caption number (default: "-") */
    chapterSeparator?: ChapterSeparator;
}

export declare interface CaptionOptions {
    /** Built-in or custom label: "Figure", "Table", "Equation", or any string */
    label?: string;
    /** Caption body text after the label + number */
    text?: string;
    /** Where to insert relative to the paragraph at insertIndex (default: "below") */
    position?: CaptionPosition;
    /** Omit the label prefix, e.g. just "1" instead of "Figure 1" */
    excludeLabel?: boolean;
    /** Numbering configuration */
    numbering?: CaptionNumberingOptions;
}

export declare type CaptionPosition = "below" | "above";

declare interface CellMargins {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}

declare interface CellTextOptions {
    bold?: boolean;
    italic?: boolean;
    color?: string;
    fontSize?: number;
    fontFamily?: string;
    alignment?: "left" | "center" | "right" | "justify";
}

/** Chapter-number separator matching Word's "Use separator" dropdown */
export declare type ChapterSeparator = "-" | "." | ":" | "–" | "—";

declare type ChapterSeparator_2 = "hyphen" | "period" | "colon" | "emDash" | "enDash";

declare type ChapterSeparator_3 = "hyphen" | "period" | "colon" | "emDash" | "enDash";

export declare class CitationManager {
    private zip;
    constructor(zip: default_2);
    private readDocument;
    private writeDocument;
    private readSources;
    private writeSources;
    /**
     * Returns all citation sources stored in the document.
     */
    getSources(): Promise<CitationSource[]>;
    /**
     * Add or update a citation source.
     */
    addSource(source: CitationSource): Promise<void>;
    /**
     * Remove a citation source by tag.
     */
    removeSource(tag: string): Promise<void>;
    /**
     * Create a run array that inserts an inline citation (e.g. "(Smith, 2020)").
     * Insert all returned runs into a paragraph in order.
     */
    createCitationRuns(tag: string, locale?: string): Run_2[];
    /**
     * Insert a bibliography paragraph at the given body index (default: end of document).
     */
    insertBibliography(index?: number): Promise<void>;
}

export declare interface CitationSource {
    tag: string;
    sourceType?: string;
    author?: string;
    title?: string;
    year?: string;
    city?: string;
    publisher?: string;
}

/** Convert centimetres to twips */
export declare const cmToTwips: (cm: number) => number;

export declare interface ColumnOptions {
    count: number;
    space?: number;
    equalWidth?: boolean;
}

export declare interface CommentEntry {
    id: number;
    author: string;
    initials: string;
    date: string;
    text: string;
}

export declare class CommentsManager {
    private zip;
    private rels;
    private contentTypes;
    constructor(zip: default_2);
    private readComments;
    private writeComments;
    private emptyCommentsDoc;
    private normalizeComments;
    private normalizeArr;
    private nextId;
    private extractText;
    private ensureRegistered;
    private readDocument;
    private writeDocument;
    private getBodyParagraphs;
    getComments(): Promise<CommentEntry[]>;
    addComment(paragraphIndex: number, author: string, text: string, date?: string): Promise<number>;
    deleteComment(id: number): Promise<void>;
    resolveComment(id: number): Promise<void>;
}

export declare class ContentTypesManager {
    private readonly zip;
    private readonly filePath;
    private readonly ns;
    constructor(zip: default_2);
    /** Generate a GUID */
    private generateGuid;
    /**
     * Reads current [Content_Types].xml or returns a default structure
     */
    private readTypes;
    /**
     * Writes back the [Content_Types].xml into the zip
     */
    private writeTypes;
    /**
     * Adds a Default content type if not exists
     * Example: Extension="xml" ContentType="application/xml"
     */
    addDefault(extension: string, contentType: string): Promise<void>;
    /**
     * Adds an Override element if it doesn't exist yet.
     * Example:
     * PartName="/word/header1.xml"
     * ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"
     */
    addOverride(partName: string, contentType: string): Promise<void>;
    /**
     * Removes an Override entry by PartName
     */
    removeOverride(partName: string): Promise<void>;
    /**
     * Checks if an override exists
     */
    hasOverride(partName: string): Promise<boolean>;
    /**
     * Helper to create a new unique part name with GUID
     */
    generateUniquePartName(prefix: string, extension?: string): string;
}

export declare interface CoreProperties {
    title?: string;
    subject?: string;
    creator?: string;
    description?: string;
    lastModifiedBy?: string;
    created?: string;
    modified?: string;
}

export declare class CrossReferenceManager {
    private zip;
    constructor(zip: default_2);
    private readDocument;
    private writeDocument;
    private getAllParagraphs;
    private nextBookmarkId;
    /**
     * Returns all bookmarks defined in the document.
     */
    getBookmarks(): Promise<BookmarkEntry[]>;
    /**
     * Add a bookmark wrapping a run in the paragraph at the given body index.
     * Returns the bookmark id.
     */
    addBookmark(paragraphIndex: number, name: string, text: string): Promise<number>;
    /**
     * Remove a bookmark by name (removes bookmarkStart/End from the paragraph).
     */
    removeBookmark(name: string): Promise<void>;
    /**
     * Returns three run objects that together form a cross-reference field.
     * All three must be added to the same paragraph in order.
     */
    createCrossRefRuns(bookmarkName: string, displayText?: string): Run_2[];
}

export declare class DocumentManager {
    zip: default_2;
    constructor(zip: default_2);
    addHeaderReferenceToDocument(relId: string, type?: "default" | "first" | "even"): Promise<void>;
    addFooterReferenceToDocument(relId: string, type?: "default" | "first" | "even"): Promise<void>;
    private _addSectPrReference;
    /**
     * Returns the top-level body paragraphs from word/document.xml.
     * Only direct children of <w:body> are returned — paragraphs nested
     * inside table cells are not included, preventing duplication on
     * round-trips through saveChanges().
     */
    getParagraphs(): Promise<Paragraph[]>;
    /**
     * Returns the paragraph whose w14:paraId matches, or null.
     */
    getParagraphById(paraId: string): Promise<Paragraph | null>;
    /**
     * Returns the paragraph at the given zero-based index, or null.
     */
    getParagraphByIndex(index: number): Promise<Paragraph | null>;
    /**
     * Writes a full Paragraph[] back to word/document.xml, preserving <w:sectPr>.
     */
    saveChanges(paragraphs: Paragraph[]): Promise<void>;
    /**
     * Inserts a paragraph at the given index (appends if no index given).
     */
    insertParagraph(paragraph: Paragraph, index?: number): Promise<void>;
    /**
     * Removes the paragraph whose w14:paraId matches.
     */
    deleteParagraph(paraId: string): Promise<void>;
    /**
     * Replaces the paragraph whose w14:paraId matches with newParagraph.
     */
    replaceParagraph(paraId: string, newParagraph: Paragraph): Promise<void>;
    /**
     * Finds and replaces text across every paragraph in the document.
     * @param search   String or RegExp to search for.
     * @param replace  Replacement string.
     */
    findAndReplaceAll(search: string | RegExp, replace: string): Promise<void>;
    /**
     * Returns all tables in word/document.xml as Table instances.
     */
    getTables(): Promise<Table[]>;
    /**
     * Inserts a Table into the document body at the given index (appends if omitted).
     */
    insertTable(table: Table, index?: number): Promise<void>;
    /**
     * Returns the body's ordered editable blocks (paragraphs / tables /
     * drawings) in document order, EXCLUDING the trailing w:sectPr (which stays
     * in the document). Each block carries its exact original XML substring.
     */
    getBlocks(): Promise<BodyBlock[]>;
    /**
     * Replaces the body's editable children with `blocks` (in order), preserving
     * the existing trailing w:sectPr exactly, and writes document.xml. Callers
     * pass only the editable blocks; the sectPr is re-appended automatically.
     */
    saveBlocks(blocks: BodyBlock[]): Promise<void>;
    /**
     * Replaces the run text of the editable block at `index` (must be a
     * paragraph). Rewrites ONLY that paragraph's XML substring; every other
     * block — tables, drawings, sectPr — keeps its exact original bytes.
     */
    editParagraphText(index: number, text: string): Promise<void>;
    /**
     * Inserts `block` at editable position `index` (appends before sectPr if the
     * index is out of range), keeping sectPr last. Use
     * OrderedBody.makeParagraphNode to build a paragraph block.
     */
    insertBlockAt(block: BodyBlock, index: number): Promise<void>;
    /** Removes the editable block at `index`. */
    deleteBlockAt(index: number): Promise<void>;
    private _writeBody;
    private _getBody;
    private _writeDoc;
}

/**
 * Represents a drawing element.
 * A drawing object (e.g., a chart or picture) located in a run.
 * @example
 * <w:r>
 * <w:drawing>...</w:drawing>
 * </w:r>
 */
declare interface Drawing {
    "w:drawing": {
        $: Record<string, unknown>;
    };
}

export declare const EMU_PER_CM = 360000;

export declare const EMU_PER_INCH = 914400;

export declare interface EndnoteEntry {
    id: number;
    text: string;
}

export declare class EndnoteManager {
    private zip;
    private rels;
    private contentTypes;
    constructor(zip: default_2);
    private readEndnotes;
    private writeEndnotes;
    private emptyEndnotesDoc;
    private normalizeArray;
    private nextId;
    private ensureRegistered;
    /**
     * Returns all user-defined endnotes (excludes separator entries).
     */
    getEndnotes(): Promise<EndnoteEntry[]>;
    /**
     * Adds a new endnote to endnotes.xml.
     * @param text   The endnote body text.
     * @returns      The endnote id and a run object to insert inline.
     */
    addEndnote(text: string): Promise<{
        id: number;
        run: Run_2;
    }>;
    /**
     * Removes an endnote by id.
     */
    removeEndnote(id: number): Promise<void>;
    /**
     * Returns a run object with an endnote reference mark for inline insertion.
     */
    createEndnoteRun(endnoteId: number): Run_2;
    private extractText;
}

/**
 * Represents a field, such as a page number or table of contents.
 * @example
 * <w:r>
 * <w:fldChar w:fldCharType="begin" />
 * </w:r>
 * <w:r>
 * <w:instrText xml:space="preserve">PAGEREF _Toc123456789 \h</w:instrText>
 * </w:r>
 * <w:r>
 * <w:fldChar w:fldCharType="end" />
 * </w:r>
 */
declare interface Field {
    "w:fldChar": {
        $: {
            "w:fldCharType": "begin" | "end";
        };
    };
    "w:instrText"?: string;
}

export declare class FooterManager {
    zip: default_2;
    rels: RelManager;
    contentTypes: ContentTypesManager;
    document: DocumentManager;
    footers: xmlFile[];
    constructor(zip: default_2);
    getFooterByName(name: string): xmlFile | false;
    getAllFooterFiles(zip: default_2): xmlFile[];
    private nextFooterPath;
    private buildFooterXml;
    private readDocObj;
    private writeDocObj;
    private getSectPr;
    private buildPageNumberRuns;
    /**
     * Adds a footer to the document.
     * @param registerInSectPr  When false, skips adding the <w:footerReference> to the main
     *                          w:sectPr. Useful when building multi-section documents.
     */
    addFooter(text: string, type?: FooterType, xml?: string, options?: {
        registerInSectPr?: boolean;
    }): Promise<{
        footerPath: string;
        relId: string;
        footerXml: string;
    }>;
    /**
     * Overwrites an existing footer file's content.
     */
    updateFooter(name: string, newXml: string): void;
    /**
     * Removes a footer: deletes zip entry, content-type, relationship and sectPr reference.
     */
    removeFooter(name: string): Promise<void>;
    /**
     * Insert a page number paragraph into the specified footer file.
     * Appends a new paragraph containing a PAGE field (optionally "X / Y").
     */
    insertPageNumber(footerPath: string, options?: PageNumberOptions): Promise<void>;
    /**
     * Remove all PAGE / NUMPAGES fields from the specified footer.
     */
    removePageNumbers(footerPath: string): Promise<void>;
    /**
     * Set page number format via w:pgNumType in w:sectPr.
     * Covers the full "Format Page Numbers" dialog:
     *   - number format (decimal, roman, letter…)
     *   - include chapter number + chapter heading style + separator
     *   - continue from previous section OR start at a specific number
     */
    formatPageNumbers(options: PageNumberFormatOptions): Promise<void>;
    /**
     * Enable or disable a different header/footer for the first page (w:titlePg in sectPr).
     */
    setDifferentFirstPage(enable: boolean): Promise<void>;
    /**
     * Enable or disable different odd/even page footers (w:evenAndOddHeaders in settings.xml).
     */
    setDifferentOddEvenPages(enable: boolean): Promise<void>;
    /**
     * Set the distance from the bottom of the page to the footer (in twips; 1 inch = 1440).
     * Default in Word is ~709 twips (0.49").
     */
    setFooterDistance(twips: number): Promise<void>;
    /**
     * Link (or unlink) the given footer to the previous section's footer.
     * Passing `true` removes the footer part so Word inherits from the previous section.
     */
    linkToPrevious(footerPath: string, linked: boolean): Promise<void>;
    private removeFooterRelAndReference;
    private removeFooterReferenceFromDocument;
}

declare type FooterType = "default" | "first" | "even";

export declare interface FootnoteEntry {
    id: number;
    text: string;
}

export declare class FootnoteManager {
    private zip;
    private rels;
    private contentTypes;
    constructor(zip: default_2);
    private readFootnotes;
    private writeFootnotes;
    private emptyFootnotesDoc;
    private normalizeArray;
    private nextId;
    private ensureRegistered;
    /**
     * Returns all user-defined footnotes (excludes separator entries).
     */
    getFootnotes(): Promise<FootnoteEntry[]>;
    /**
     * Adds a new footnote to footnotes.xml and returns a run object
     * that should be inserted into the paragraph at the desired position.
     *
     * @param text   The footnote body text.
     * @returns      The footnote id and a run object containing the reference mark.
     */
    addFootnote(text: string): Promise<{
        id: number;
        run: Run_2;
    }>;
    /**
     * Removes a footnote by id from footnotes.xml.
     * You must also manually remove the <w:footnoteReference> run from the document.
     */
    removeFootnote(id: number): Promise<void>;
    /**
     * Returns a run object (w:r) with a footnote reference mark for inline insertion.
     * Use after addFootnote() to get the inline anchor run.
     */
    createFootnoteRun(footnoteId: number): Run_2;
    private extractText;
}

export declare class HeaderManager {
    zip: default_2;
    rels: RelManager;
    contentTypes: ContentTypesManager;
    document: DocumentManager;
    headers: xmlFile_2[];
    constructor(zip: default_2);
    getHeaderByName(name: string): xmlFile_2 | false;
    getAllheadersFiles(zip: default_2): xmlFile_2[];
    private nextHeaderPath;
    private buildHeaderXml;
    private readDocObj;
    private writeDocObj;
    private getSectPr;
    private buildPageNumberRuns;
    /**
     * Adds a header to the document.
     * @param registerInSectPr  When false, skips adding the <w:headerReference> to the main
     *                          w:sectPr. Useful when building multi-section documents where the
     *                          reference will be placed in an intermediate section-break paragraph.
     */
    addHeader(text: string, type?: HeaderType, xml?: string, options?: {
        registerInSectPr?: boolean;
    }): Promise<{
        headerPath: string;
        relId: string;
        headerXml: string;
    }>;
    /**
     * Overwrites an existing header file's content.
     */
    updateHeader(name: string, newXml: string): void;
    /**
     * Removes a header: deletes zip entry, content-type, relationship and sectPr reference.
     */
    removeHeader(name: string): Promise<void>;
    /**
     * Insert a page number paragraph into the specified header file.
     * Appends a new paragraph containing a PAGE field (optionally "X / Y").
     */
    insertPageNumber(headerPath: string, options?: PageNumberOptions_2): Promise<void>;
    /**
     * Remove all PAGE / NUMPAGES fields from the specified header.
     */
    removePageNumbers(headerPath: string): Promise<void>;
    /**
     * Set page number format via w:pgNumType in w:sectPr.
     * Covers the full "Format Page Numbers" dialog:
     *   - number format (decimal, roman, letter…)
     *   - include chapter number + chapter heading style + separator
     *   - continue from previous section OR start at a specific number
     */
    formatPageNumbers(options: PageNumberFormatOptions_2): Promise<void>;
    /**
     * Enable or disable a different header/footer for the first page (w:titlePg in sectPr).
     */
    setDifferentFirstPage(enable: boolean): Promise<void>;
    /**
     * Enable or disable different odd/even page headers (w:evenAndOddHeaders in settings.xml).
     */
    setDifferentOddEvenPages(enable: boolean): Promise<void>;
    /**
     * Set the distance from the top of the page to the header (in twips; 1 inch = 1440).
     * Default in Word is ~709 twips (0.49").
     */
    setHeaderDistance(twips: number): Promise<void>;
    /**
     * Link (or unlink) the given header to the previous section's header.
     * In OOXML this is controlled by the absence/presence of a headerReference for this section.
     * Passing `false` removes the reference so Word inherits from the previous section.
     */
    linkToPrevious(headerPath: string, linked: boolean): Promise<void>;
    private removeHeaderRelAndReference;
    private removeHeaderReferenceFromDocument;
}

declare type HeaderType = "default" | "first" | "even";

/**
 * Interface for a hyperlink element that contains one or more runs.
 * It's a container for text that serves as a link to another part of the document or an external URL.
 * @example
 * <w:hyperlink w:anchor="_Toc106885920" w:history="1">
 * <w:r>
 * <w:t>Liste des organigrammes</w:t>
 * </w:r>
 * </w:hyperlink>
 */
declare interface Hyperlink {
    $: {
        "w:anchor"?: string;
        "w:history"?: string;
        "r:id"?: string;
    };
    "w:r"?: Run_2[];
    "w:fldChar"?: Field[];
}

export declare interface ImageEntry {
    name: string;
    path: string;
    buffer: Buffer;
}

/** Convert inches to twips */
export declare const inchesToTwips: (inches: number) => number;

export declare interface InsertLineOptions {
    color?: string;
    arrowEnd?: boolean;
    arrowStart?: boolean;
    lineWidthPt?: number;
    paragraphIndex?: number;
    label?: string;
    labelOffsetX?: number;
    labelOffsetY?: number;
}

export declare interface InsertShapeOptions {
    position?: ShapePosition;
    size?: ShapeSize;
    paragraphIndex?: number;
    fillColor?: string;
    borderColor?: string;
    floating?: boolean;
    name?: string;
    text?: string;
    textColor?: string;
    fontSize?: number;
    bold?: boolean;
    textAlign?: "l" | "ctr" | "r";
}

export declare interface LineNumberingOptions {
    countBy?: number;
    start?: number;
    distance?: number;
    restart?: "newPage" | "newSection" | "continuous";
}

/** Build a drawing (inline image) paragraph `BodyBlock`. */
export declare function makeDrawingParagraphNode(relId: string, widthEmu: number, heightEmu: number, shapeId: number, name: string): BodyBlock;

/**
 * Build a `<w:p>` paragraph wrapping an inline `<w:drawing>` that references an
 * already-registered image relationship (`relId`, see MediaManager.insertImage).
 *
 * Namespaces are declared LOCALLY so the block is self-contained regardless of
 * the host document: `xmlns:wp` + `xmlns:a` on `<wp:inline>`, `xmlns:pic` on
 * `<pic:pic>`. `r:` is NOT redeclared — it is universally declared on
 * `<w:document>`. A plain `<w:drawing>` is used (no `mc:AlternateContent`,
 * which modern Word does not require for inline pictures).
 *
 * @param relId      The image relationship id (e.g. "rId7").
 * @param widthEmu   Inline width in EMU (1 px @96dpi = 9525 EMU).
 * @param heightEmu  Inline height in EMU.
 * @param shapeId    A document-unique id for `wp:docPr` / `pic:cNvPr`.
 * @param name       The picture name (escaped).
 */
export declare function makeDrawingParagraphXml(relId: string, widthEmu: number, heightEmu: number, shapeId: number, name: string): string;

/**
 * Build a paragraph `BodyBlock` (kept under the legacy export name
 * `makeParagraphNode` for API stability). Now string-based.
 */
export declare function makeParagraphNode(text: string, styleId?: string, rtl?: boolean): BodyBlock;

/**
 * Build a `<w:p>` paragraph XML string from plain text + optional style/RTL:
 * `<w:p>(<w:pPr>(<w:pStyle w:val="ID"/>)(<w:bidi/>)</w:pPr>)?<w:r><w:t xml:space="preserve">ESCAPED</w:t></w:r></w:p>`
 */
export declare function makeParagraphXml(text: string, styleId?: string, rtl?: boolean): string;

/** Build a table `BodyBlock` from a grid of cell texts. */
export declare function makeTableNode(rows: string[][], opts?: {
    headerRow?: boolean;
    rtl?: boolean;
}): BodyBlock;

/**
 * Build a `<w:tbl>` XML string from a grid of cell texts.
 *
 * Reuses the existing `Table` class (the same path the export pipeline uses, via
 * `docx-blocks.buildTable`) so the produced table is byte-identical to a
 * natively built one:
 *   - `w:tblPr` with single-line borders (top/bottom/left/right/insideH/insideV)
 *     + `w:tblW` 100% (`w:type="pct" w:w="5000"`) + `w:bidiVisual` when `rtl`;
 *   - `w:tblGrid` with N `w:gridCol` (N = the widest row);
 *   - the first row marked as a shaded + bold header when `headerRow`;
 *   - each cell `<w:tc><w:p><w:r>(<w:rPr><w:b/></w:rPr>)?<w:t xml:space="preserve">…</w:t></w:r></w:p></w:tc>`.
 *
 * Cell text escaping is delegated to the xml2js serializer (it escapes the
 * predefined entities for the run text + attribute values).
 */
export declare function makeTableXml(rows: string[][], opts?: {
    headerRow?: boolean;
    rtl?: boolean;
}): string;

export declare const MARGIN_PRESETS: Record<MarginPreset, PageMargins>;

export declare type MarginPreset = "normal" | "narrow" | "moderate" | "wide" | "mirrored";

export declare class Mdocxengine {
    zip: ZipManager;
    rels: RelManager;
    contentTypes: ContentTypesManager;
    document: DocumentManager;
    footer: FooterManager;
    header: HeaderManager;
    rootRels: RootRelManager;
    styles: StylesManager;
    numbering: NumberingManager;
    metadata: MetadataManager;
    media: MediaManager;
    footnotes: FootnoteManager;
    endnotes: EndnoteManager;
    toc: TableOfContentsManager;
    crossRef: CrossReferenceManager;
    citations: CitationManager;
    pageLayout: PageLayoutManager;
    captions: CaptionManager;
    comments: CommentsManager;
    trackedChanges: TrackedChangesManager;
    sections: SectionManager;
    shapes: ShapeManager;
    private constructor();
    static loadFromFile(path: string): Promise<Mdocxengine>;
    static loadFromBuffer(buffer: Buffer): Promise<Mdocxengine>;
    saveToFile(outputPath: string): Promise<void>;
}

export declare class MediaManager {
    private zip;
    private rels;
    private contentTypes;
    constructor(zip: default_2);
    /**
     * Returns all image files found in word/media/.
     */
    listImages(): ImageEntry[];
    /**
     * Returns the buffer for a specific image by filename (e.g. "image1.png"), or null.
     */
    extractImage(name: string): Buffer | null;
    /**
     * Inserts a new image into the document.
     * @param imageBuffer  Raw image bytes.
     * @param extension    File extension without dot (e.g. "png", "jpg").
     * @returns The image path and the generated relationship ID.
     */
    insertImage(imageBuffer: Buffer, extension: string): Promise<{
        imagePath: string;
        relId: string;
    }>;
    /**
     * Replaces an existing image's bytes in-place (same filename, same relId).
     * @param name         Filename like "image1.png" (without path prefix).
     * @param newBuffer    New image bytes.
     */
    replaceImage(name: string, newBuffer: Buffer): void;
    /**
     * Deletes an image from the zip (does not remove the relationship or inline reference).
     */
    deleteImage(name: string): void;
}

export declare class MetadataManager {
    private zip;
    constructor(zip: default_2);
    /**
     * Reads core document properties.
     */
    getCoreProperties(): Promise<CoreProperties>;
    /**
     * Updates core document properties. Merges with existing values.
     */
    setCoreProperties(props: CoreProperties): Promise<void>;
    /**
     * Reads application properties.
     */
    getAppProperties(): Promise<AppProperties>;
    /**
     * Updates application properties. Merges with existing values.
     */
    setAppProperties(props: AppProperties): Promise<void>;
}

/**
 * Scan a full `document.xml` for the highest existing drawing id (`wp:docPr @id`
 * and `pic:cNvPr @id`) and return max+1 (minimum 1). Use it to assign a
 * document-unique id to a newly inserted drawing.
 */
export declare function nextDrawingId(documentXml: string): number;

/** The tag name of a block (compat shim — accepts a BodyBlock). */
export declare function nodeTag(block: BodyBlock | string): string;

export declare interface NumberingDefinition {
    abstractNumId: string;
    numId: string;
}

export declare class NumberingManager {
    private zip;
    constructor(zip: default_2);
    private readNumbering;
    private writeNumbering;
    /**
     * Returns all concrete numbering definitions (numId → abstractNumId).
     */
    getNumberingDefinitions(): Promise<NumberingDefinition[]>;
    /**
     * Applies numbering to a paragraph by setting <w:numPr> on its <w:pPr>.
     * @param paragraph  The Paragraph instance to modify.
     * @param numId      The concrete numId from numbering.xml.
     * @param ilvl       Indent level (0-based). Defaults to 0.
     */
    applyNumbering(paragraph: Paragraph, numId: string, ilvl?: number): void;
    /**
     * Removes numbering from a paragraph.
     */
    removeNumbering(paragraph: Paragraph): void;
    /**
     * Adds a new concrete <w:num> definition referencing an abstract numbering ID.
     * @param numId         The new numId to use.
     * @param abstractNumId The abstractNumId to reference.
     */
    addNumberingDefinition(numId: string, abstractNumId: string): Promise<void>;
}

export declare type Orientation = "portrait" | "landscape";

export declare const PAGE_SIZES: Record<PageSizePreset, {
    w: number;
    h: number;
}>;

export declare class PageLayoutManager {
    private zip;
    constructor(zip: default_2);
    private readDocument;
    private writeDocument;
    private getSectPr;
    private twip;
    /**
     * Get the current page size in twips.
     */
    getPageSize(): Promise<PageSize>;
    /**
     * Set page size from a preset name.
     */
    setPageSizePreset(preset: PageSizePreset, orientation?: Orientation): Promise<void>;
    /**
     * Set a custom page size (values in twips).
     */
    setPageSize(size: PageSize): Promise<void>;
    /**
     * Toggle orientation while preserving current page size dimensions.
     */
    setOrientation(orientation: Orientation): Promise<void>;
    /**
     * Get current orientation.
     */
    getOrientation(): Promise<Orientation>;
    /**
     * Get the current page margins in twips.
     */
    getMargins(): Promise<PageMargins>;
    /**
     * Apply a named margin preset.
     */
    setMarginPreset(preset: MarginPreset): Promise<void>;
    /**
     * Set custom margins (values in twips). Pass partial to merge with existing.
     */
    setMargins(margins: Partial<PageMargins>): Promise<void>;
    /**
     * Set margins using inches (convenience wrapper).
     */
    setMarginsInInches(margins: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
        gutter?: number;
    }): Promise<void>;
    /**
     * Get current column configuration.
     */
    getColumns(): Promise<ColumnOptions>;
    /**
     * Set column layout.
     */
    setColumns(options: ColumnOptions): Promise<void>;
    /**
     * Insert a page or section break before the paragraph at `paragraphIndex`.
     * Defaults to appending at end of document.
     *
     * - "nextPage" / "evenPage" / "oddPage" / "continuous" = section breaks
     * - "nextColumn" = column break within a multi-column section
     */
    insertBreak(type: SectionBreakType, paragraphIndex?: number): Promise<void>;
    /**
     * Get current line numbering settings (null if not enabled).
     */
    getLineNumbering(): Promise<LineNumberingOptions | null>;
    /**
     * Enable line numbering.
     */
    setLineNumbering(options?: LineNumberingOptions): Promise<void>;
    /**
     * Remove line numbering.
     */
    removeLineNumbering(): Promise<void>;
}

export declare interface PageMargins {
    top: number;
    bottom: number;
    left: number;
    right: number;
    gutter?: number;
    header?: number;
    footer?: number;
}

declare type PageNumberFormat = "decimal" | "upperRoman" | "lowerRoman" | "upperLetter" | "lowerLetter";

declare type PageNumberFormat_2 = "decimal" | "upperRoman" | "lowerRoman" | "upperLetter" | "lowerLetter";

declare interface PageNumberFormatOptions {
    /** Numbering style written to w:pgNumType. Default: "decimal". */
    format?: PageNumberFormat;
    /**
     * Include the chapter number before the page number (e.g. "1-1", "1-A").
     * Requires a heading style to be set via chapterStyle.
     */
    includeChapterNumber?: boolean;
    /**
     * Heading level whose numbering is used as the chapter prefix.
     * 1 = Heading 1, 2 = Heading 2, … Default: 1.
     */
    chapterStyle?: number;
    /**
     * Separator between chapter and page number.
     * hyphen → "-", period → ".", colon → ":", emDash → "—", enDash → "–".
     * Default: "hyphen".
     */
    chapterSeparator?: ChapterSeparator_2;
    /**
     * When true, page numbering continues from the previous section (no w:start attribute).
     * When false/omitted, startAt is used if provided.
     */
    continueFromPreviousSection?: boolean;
    /** Restart page numbering at this value. Ignored when continueFromPreviousSection is true. */
    startAt?: number;
}

declare interface PageNumberFormatOptions_2 {
    /** Numbering style written to w:pgNumType. Default: "decimal". */
    format?: PageNumberFormat_2;
    /**
     * Include the chapter number before the page number (e.g. "1-1", "1-A").
     * Requires a heading style to be set via chapterStyle.
     */
    includeChapterNumber?: boolean;
    /**
     * Heading level whose numbering is used as the chapter prefix.
     * 1 = Heading 1, 2 = Heading 2, … Default: 1.
     */
    chapterStyle?: number;
    /**
     * Separator between chapter and page number.
     * hyphen → "-", period → ".", colon → ":", emDash → "—", enDash → "–".
     * Default: "hyphen".
     */
    chapterSeparator?: ChapterSeparator_3;
    /**
     * When true, page numbering continues from the previous section (no w:start attribute).
     * When false/omitted, startAt is used if provided.
     */
    continueFromPreviousSection?: boolean;
    /** Restart page numbering at this value. Ignored when continueFromPreviousSection is true. */
    startAt?: number;
}

declare interface PageNumberOptions {
    /** Paragraph alignment for the page-number line. Default: "center". */
    alignment?: "left" | "center" | "right";
    /** Numbering style. Default: "decimal". */
    format?: PageNumberFormat;
    /** When true, renders "X / Y" (current page / total pages). */
    includeTotalPages?: boolean;
    /** Prefix text before the page number, e.g. "Page ". */
    prefix?: string;
}

declare interface PageNumberOptions_2 {
    /** Paragraph alignment for the page-number line. Default: "center". */
    alignment?: "left" | "center" | "right";
    /** Numbering style. Default: "decimal". */
    format?: PageNumberFormat_2;
    /** When true, renders "X / Y" (current page / total pages). */
    includeTotalPages?: boolean;
    /** Prefix text before the page number, e.g. "Page ". */
    prefix?: string;
}

export declare interface PageSize {
    width: number;
    height: number;
    orientation?: Orientation;
}

export declare type PageSizePreset = "USLetter" | "USLegal" | "A3" | "A4" | "A5" | "B5" | "JISB5" | "Tabloid" | "TabloidOversize" | "EnvelopeDL" | "Envelope10";

/**
 * A class representing a single paragraph from a WordprocessingML document.
 * It provides methods to easily get and modify the paragraph's text content.
 */
export declare class Paragraph {
    paragraph: Paragraph_2;
    /**
     * Constructs a new Paragraph instance.
     * @param paragraph The parsed JSON representation of the paragraph's XML.
     */
    constructor(paragraph: Paragraph_2);
    /**
     * Extracts plain text from a Word paragraph XML string and checks if it contains any text.
     * - If no `<w:t>` tags exist or they're empty, it returns `hasText = false` and `text = ""`.
     * - Otherwise, it returns the combined text and `hasText = true`.
     *
     * @param paragraphXml - Optional raw XML string of the <w:p> element. If not provided, it uses this.toXml().
     * @returns An object containing the extracted text and a boolean flag.
     */
    getPlainText(paragraphXml?: string): Promise<{
        hasText: boolean;
        text: string;
    }>;
    /**
     * Safely extracts visible text from a Word paragraph (<w:p>),
     * handling nested structures like hyperlinks, bookmarks, and tabs.
     *
     * @param paragraphXml Optional XML string of the paragraph.
     * @returns Object with a boolean (hasText) and the combined text string.
     */
    getPlainTextSafe(): Promise<{
        hasText: boolean;
        text: string;
    }>;
    /**
     * Recursively extracts text from any node including nested structures.
     */
    private extractTextFromNode;
    /**
     * Appends new text to the paragraph without removing existing runs.
     * @param text - The text to append.
     */
    appendText(text: string): void;
    /**
     * Recursively replaces text inside a paragraph without removing hyperlinks or nested structures.
     *
     * @param searchText - Text to search for. If null, replace all text.
     * @param replaceText - Text to replace with.
     */
    replaceText(searchText: string | null, replaceText: string): void;
    /**
     * Sets the paragraph alignment.
     * @param alignment - One of "left" | "center" | "right" | "both"
     */
    setAlignment(alignment: "left" | "center" | "right" | "both"): void;
    /**
     * Ensures <w:pPr> exists AND is the first child of <w:p>. OOXML (CT_P) requires
     * paragraph properties to precede all run content; xml2js's Builder serializes
     * keys in insertion order, so simply assigning this.paragraph["w:pPr"] = {} on a
     * paragraph that already has runs would emit <w:pPr> after <w:r> and produce a
     * file Word flags as corrupt. Rebuild the object with w:pPr first when creating it.
     */
    private ensurePPr;
    /**
     * Gets the current alignment of the paragraph.
     */
    getAlignment(): string | null;
    /**
     * Returns the total number of words in the paragraph.
     */
    getWordCount(): Promise<number>;
    /**
     * Applies a style to the entire paragraph.
     * @param styleId - The Word style ID (e.g., "Heading1", "Normal").
     */
    applyStyle(styleId: string): void;
    /**
     * Removes all formatting (bold, italic, etc.) from runs but keeps text.
     */
    removeFormatting(): void;
    /**
     * Creates a deep clone of the paragraph object.
     */
    clone(): Paragraph;
    /**
     * Merges another paragraph's runs into this one.
     * @param otherParagraph - The paragraph to merge into this one.
     */
    mergeWith(otherParagraph: Paragraph): void;
    /**
     * Splits the paragraph into two at the specified character index.
     * @param index - Character position to split at.
     * @returns A tuple: [firstPart, secondPart]
     */
    splitAt(index: number): Promise<[Paragraph, Paragraph]>;
    /**
     * Adds a new hyperlink to the paragraph.
     * @param url - The URL of the hyperlink.
     * @param displayText - The visible text for the hyperlink.
     */
    addHyperlink(url: string, displayText: string, rsidRPr: string): void;
    /**
     * Extracts all hyperlinks inside the paragraph.
     * Returns array of { displayText, url }.
     */
    getHyperlinks(): Promise<{
        displayText: string;
        url: string;
    }[]>;
    /**
     * Removes all hyperlinks but keeps the visible text.
     */
    removeHyperlinks(): void;
    /**
     * Creates a Paragraph instance from an XML string.
     * @param xmlString The XML string of the paragraph.
     * @returns A Promise that resolves with the new Paragraph instance.
     */
    static createFromXml(xmlString: string): Promise<Paragraph>;
    /**
     * Returns all highlighted runs in the current paragraph, optionally filtered by fill and value.
     *
     * @param {string} [fill] - Optional. Filter by highlight fill color (e.g., "FFFF00").
     * @param {string} [value] - Optional. Filter by shading value (e.g., "clear").
     * @returns {Run[] | false} - Array of highlighted runs or false if none found.
     */
    getHighlightedRuns(fill?: string, value?: string): Run_2[] | false;
    /**
     * Returns true if any run in the paragraph is highlighted.
     */
    hasHighlight(): boolean;
    /**

     * Modifies the text content of the paragraph.
     * Clears all existing runs and child elements, then replaces them
     * with a single new run containing the provided text.
     * @param newText - The new string to set as the paragraph's content.

     */
    modifyText(newText: string): void;
    generateUniqueParaId(zip: default_2): string;
    /**
     * Detects the primary language of the paragraph (if available).
     */
    detectLanguage(): string | null;
    /**
     * Returns all runs in the paragraph as Run class instances.
     */
    getRuns(): Run[];
    /**
     * Appends a Run instance to the paragraph.
     */
    addRun(run: Run): void;
    /**
     * Removes the run at the given zero-based index.
     */
    removeRun(index: number): void;
    /**
     * Converts the internal paragraph object back into an XML string.
     * @returns A Promise that resolves with the XML string.
     */
    toXml(): Promise<string>;
}

/**
 * Interface for a paragraph element, which contains a collection of content elements.
 * A paragraph is a block-level element that can contain multiple runs, hyperlinks, and other elements.
 * @example
 * <w:p>
 * <w:pPr>
 * <w:pStyle w:val="Normal" />
 * </w:pPr>
 * <w:r>
 * <w:t>Hello</w:t>
 * </w:r>
 * <w:r>
 * <w:t xml:space="preserve"> World</w:t>
 * </w:r>
 * </w:p>
 */
declare interface Paragraph_2 {
    $: {
        "w14:paraId"?: string;
        "w14:textId"?: string;
        "w:rsidR"?: string;
        [key: string]: string | undefined;
    };
    "w:pPr"?: ParagraphProperties;
    "w:r"?: Run_2[];
    "w:hyperlink"?: Hyperlink[];
    "w:fldChar"?: Field[];
    "w:drawing"?: Drawing[];
}

/**
 * Interface for the properties of a paragraph.
 * These properties apply to the entire paragraph, such as style, alignment, and spacing.
 */
declare interface ParagraphProperties {
    "w:pStyle"?: {
        $: {
            "w:val": string;
        };
    };
    "w:tabs"?: {};
    "w:spacing"?: {};
    "w:jc"?: {
        $: {
            "w:val": string;
        };
    };
    "w:numPr"?: {
        "w:ilvl"?: {
            $: {
                "w:val": string;
            };
        };
        "w:numId"?: {
            $: {
                "w:val": string;
            };
        };
    };
    /**
     * Represents the default run properties for the paragraph mark.
     * Any run properties defined here are inherited by all runs in the paragraph,
     * unless overridden by a specific run's own properties.
     */
    "w:rPr"?: RunProperties;
}

/** Extract the `w:val` of the paragraph's `<w:pStyle>`, or null. */
export declare function paragraphStyleId(xml: string): string | null;

/** Concatenate the decoded text of every `<w:t ...>...</w:t>` in a block. */
export declare function paragraphText(xml: string): string;

/** Split a full document into its top-level body blocks. */
export declare function parseOrderedDoc(documentXml: string): {
    split: SplitDocument;
    blocks: BodyBlock[];
    bodyChildren: BodyBlock[];
};

export declare class RelManager {
    zip: default_2;
    relsPath: RelsType;
    ns: string;
    constructor(zip: default_2, relsPath?: RelsType);
    private readRels;
    private writeRels;
    /**
     * Adds a relationship entry: Id must be unique (caller responsible).
     * target should be relative to 'word/' (e.g. 'header1.xml' or 'media/image1.png')
     */
    addRelationship(id: string, type: string, target: string): Promise<void>;
    /**
     * Quick helper to generate a new rId (checks existing ones)
     */
    genId(prefix?: string): Promise<string>;
}

declare enum RelsType {
    Root = "_rels/.rels",
    Document = "word/_rels/document.xml.rels"
}

export declare interface RevisionEntry {
    id: number;
    type: RevisionType;
    author: string;
    date: string;
    text: string;
    paragraphIndex: number;
}

export declare type RevisionType = "ins" | "del" | "rPrChange" | "pPrChange";

export declare class RootRelManager extends RelManager {
    constructor(zip: ZipManager, relsPath?: RelsType);
}

/**
 * A class to represent and manipulate a single WordprocessingML run (<w:r>).
 */
export declare class Run {
    private run;
    constructor(run: Run_2);
    /**
     * Get the raw run object.
     */
    getRaw(): Run_2;
    /**
     * Get the text content of the run.
     */
    getText(): string;
    /**
     * Set or replace the text content of the run.
     * @param newText - The new text to set.
     */
    setText(newText: string): void;
    /**
     * Append text to the existing text in the run.
     * @param textToAppend - Text to append.
     */
    appendText(textToAppend: string): void;
    /**
     * Get the run's formatting properties (<w:rPr>).
     */
    getProperties(): RunProperties | undefined;
    /**
     * Ensure the run has a <w:rPr> object to work with.
     */
    private ensureProperties;
    /**
     * Set bold formatting.
     */
    setBold(enable?: boolean): void;
    /**
     * Set italic formatting.
     */
    setItalic(enable?: boolean): void;
    /**
     * Set underline formatting with optional style.
     * @param style - Underline style (e.g., "single", "double")
     */
    setUnderline(enable?: boolean, style?: string): void;
    /**
     * Set shading (background color) for the run.
     */
    setShading(color?: string, value?: string): void;
    /**
     * Remove shading.
     */
    removeShading(): void;
    /**
     * Determine if the run is bold.
     */
    isBold(): boolean;
    /**
     * Determine if the run is italic.
     */
    isItalic(): boolean;
    /**
     * Check if the run has underline formatting.
     */
    hasUnderline(): boolean;
    /**
     * Determine if the run is empty (no text and no special fields).
     */
    isEmpty(): boolean;
    /**
     * Add a field to the run, like a page number or TOC reference.
     */
    setField(fieldType: "begin" | "end", instrText?: string): void;
    /**
     * Add a drawing (image or graphic) to the run.
     */
    setDrawing(drawing: Drawing): void;
    /**
     * Set font size.
     * @param halfPoints Size in half-points (e.g. 24 = 12pt, 28 = 14pt).
     */
    setFontSize(halfPoints: number): void;
    /**
     * Set font family.
     * @param ascii  Font name for ASCII/Latin characters.
     * @param cs     Font name for complex scripts (defaults to ascii).
     */
    setFontFamily(ascii: string, cs?: string): void;
    /**
     * Set text color.
     * @param hex  6-character hex color without '#' (e.g. "FF0000" for red).
     */
    setColor(hex: string): void;
    /**
     * Clear all run formatting (empties w:rPr).
     */
    clearFormatting(): void;
    /**
     * Returns the underlying raw run object.
     */
    toObject(): Run_2;
    /**
     * Creates a Run from a plain text string with no formatting.
     */
    static fromText(text: string): Run;
    /**
     * Export the run to XML string.
     */
    toXml(): string;
}

/**
 * Represents a text run in the document.
 * A run may contain text, tabs, breaks, fields, and drawings.
 */
declare interface Run_2 {
    $?: {
        "w:rsidRPr"?: string;
        "w:rsidR"?: string;
        [key: string]: string | undefined;
    };
    /**
     * Run-level properties defining style and formatting.
     */
    "w:rPr"?: RunProperties;
    /**
     * Text nodes inside the run.
     * Some runs have multiple <w:t> tags if Word splits the text.
     */
    "w:t"?: TextNode | TextNode[] | string;
    /**
     * Line breaks inside a run.
     * <w:br/>
     */
    "w:br"?: Record<string, unknown> | Record<string, unknown>[];
    /**
     * Tab characters inside a run.
     * <w:tab/>
     */
    "w:tab"?: Record<string, unknown> | Record<string, unknown>[];
    /**
     * Dynamic fields or special instructions.
     * <w:instrText xml:space="preserve">PAGE</w:instrText>
     */
    "w:instrText"?: TextNode | TextNode[];
    /**
     * Drawings or images inside a run.
     * <w:drawing>...</w:drawing>
     */
    "w:drawing"?: Drawing | Drawing[];
    /**
     * A single field character, not a whole Field object
     * Example: <w:fldChar w:fldCharType="begin"/>
     */
    "w:fldChar"?: {
        $: {
            "w:fldCharType": "begin" | "end";
        };
    };
}

/**
 * Interface for the properties of a text run.
 * These properties define the formatting for the run's content.
 */
declare interface RunProperties {
    "w:rStyle"?: {
        $: {
            "w:val": string;
        };
    };
    "w:rFonts"?: {
        $: {
            "w:ascii"?: string;
            "w:hAnsi"?: string;
            "w:eastAsia"?: string;
            "w:cs"?: string;
        };
    };
    "w:noProof"?: {};
    "w:lang"?: {
        $: {
            "w:val": string;
            "w:eastAsia"?: string;
        };
    };
    "w:b"?: {};
    "w:i"?: {};
    "w:u"?: {
        $: {
            "w:val": string;
        };
        "w:sh": {
            $: {
                "w:fill": string;
                "w:val": string;
            };
        };
    };
    "w:shd"?: {
        $: {
            "w:fill": string;
            "w:val": string;
        };
    };
}

export declare type SectionBreakType = "nextPage" | "continuous" | "evenPage" | "oddPage" | "nextColumn";

export declare interface SectionEntry {
    index: number;
    isFinal: boolean;
    type?: string;
    pageSize?: SectionPageSize;
    margins?: SectionMargins;
    headerRefs: SectionHeaderFooterRef[];
    footerRefs: SectionHeaderFooterRef[];
    paragraphIndex?: number;
}

export declare interface SectionHeaderFooterRef {
    relId: string;
    type: "default" | "first" | "even";
}

export declare interface SectionLayout {
    type?: "nextPage" | "continuous" | "evenPage" | "oddPage";
    pageSize?: SectionPageSize;
    margins?: SectionMargins;
}

export declare class SectionManager {
    private zip;
    constructor(zip: default_2);
    private readDocument;
    private writeDocument;
    private getBodyParagraphs;
    private norm;
    private parseSectPr;
    private applyLayout;
    private findSectPr;
    getSections(): Promise<SectionEntry[]>;
    addSectionBreak(paragraphIndex: number, type: "nextPage" | "continuous" | "evenPage" | "oddPage"): Promise<void>;
    removeSectionBreak(paragraphIndex: number): Promise<void>;
    setSectionLayout(sectionIndex: number, layout: SectionLayout): Promise<void>;
    setSectionHeader(sectionIndex: number, relId: string, type?: "default" | "first" | "even"): Promise<void>;
    setSectionFooter(sectionIndex: number, relId: string, type?: "default" | "first" | "even"): Promise<void>;
}

export declare interface SectionMargins {
    top: number;
    bottom: number;
    left: number;
    right: number;
    header?: number;
    footer?: number;
    gutter?: number;
}

export declare interface SectionPageSize {
    width: number;
    height: number;
    orientation?: "portrait" | "landscape";
}

/**
 * Replace the text of a paragraph's XML string IN PLACE (operates only on the
 * given paragraph substring — cannot affect any sibling block):
 *
 *  - If the paragraph contains a `<w:drawing>` / `<w:pict>` / `<w:object>`
 *    (an inline image or embedded object), DO NOT strip runs. Instead replace
 *    only the text inside the FIRST `<w:t>` (or append a text run after
 *    `<w:pPr>` if there is no `<w:t>`), leaving the drawing runs intact.
 *  - Otherwise (a plain text paragraph): preserve `<w:pPr>...</w:pPr>` if
 *    present and replace ALL `<w:r>...</w:r>` runs with a single
 *    `<w:r><w:t xml:space="preserve">ESCAPED</w:t></w:r>`.
 */
export declare function setParagraphText(paragraphXml: string, text: string): string;

export declare interface ShapeEntry {
    id: number;
    name: string;
    type: "textbox" | ShapeType | "unknown";
    position?: ShapePosition;
    size: ShapeSize;
}

export declare class ShapeManager {
    private zip;
    constructor(zip: default_2);
    private readDocument;
    private writeDocument;
    private getBodyParagraphs;
    private norm;
    private nextShapeId;
    private buildSpPr;
    private buildWsp;
    private buildGraphicData;
    private buildAnchor;
    private buildInline;
    private insertDrawingParagraph;
    /** Collect all w:drawing nodes from a run, handling both direct and
     *  mc:AlternateContent-wrapped drawings. */
    private drawingsFromRun;
    private extractShapesFromParagraph;
    getShapes(): Promise<ShapeEntry[]>;
    insertTextBox(opts: TextBoxOptions): Promise<number>;
    insertShape(type: ShapeType, opts?: InsertShapeOptions): Promise<number>;
    insertLine(x1: number, y1: number, x2: number, y2: number, opts?: InsertLineOptions): Promise<number>;
    /** Insert an inline picture referencing an already-registered image relId
     *  (see MediaManager.insertImage). width/height are in EMU (1 px @96dpi = 9525 EMU). */
    insertImage(relId: string, opts: {
        width: number;
        height: number;
        name?: string;
        paragraphIndex?: number;
    }): Promise<number>;
    deleteShape(id: number): Promise<void>;
}

export declare interface ShapePosition {
    x: number;
    y: number;
}

export declare interface ShapeSize {
    width: number;
    height: number;
}

export declare type ShapeType = "rect" | "roundRect" | "ellipse" | "triangle" | "diamond" | "line" | "rightArrow" | "leftArrow" | "star5" | "cloud" | "heart";

/** The result of splitting a full `word/document.xml`. */
declare interface SplitDocument {
    /** Everything up to and including the `<w:body ...>` open tag. */
    pre: string;
    /** The `<w:body ...>` open tag itself (subset of `pre`, for convenience). */
    bodyOpen: string;
    /** Top-level children of `<w:body>`, in document order. */
    blocks: BodyBlock[];
    /** `</w:body>` and everything after it (trailing whitespace, `</w:document>`, …). */
    post: string;
}

export declare interface StyleEntry {
    id: string;
    name: string;
    type: string;
}

export declare class StylesManager {
    private zip;
    constructor(zip: default_2);
    private readStyles;
    private writeStyles;
    private normalizeStylesArray;
    /**
     * Lists all styles in the document.
     */
    listStyles(): Promise<StyleEntry[]>;
    /**
     * Returns the raw style object for a given style ID, or null.
     */
    getStyle(styleId: string): Promise<any | null>;
    /**
     * Adds a new style. Does nothing if a style with the same ID already exists.
     */
    addStyle(styleObj: any): Promise<void>;
    /**
     * Removes a style by ID.
     */
    removeStyle(styleId: string): Promise<void>;
}

/**
 * Wraps a parsed <w:tbl> and provides a full Table Design + Layout API.
 */
export declare class Table {
    private table;
    constructor(table: TableObject);
    private getRows;
    private setRows;
    private getCells;
    private setCells;
    private extractCellText;
    private ensureCellProps;
    private ensureRowProps;
    private ensureTableProps;
    private buildBorderEl;
    private emptyCell;
    /** Number of rows. */
    getRowCount(): number;
    /** Number of columns in the given row (default row 0). */
    getColumnCount(rowIndex?: number): number;
    /** Raw cell object at [row, col], or null. */
    getCell(row: number, col: number): TableCell | null;
    /** Plain text of cell [row, col]. */
    getCellText(row: number, col: number): string;
    /** Apply a named Word table style, e.g. "TableGrid", "LightShading-Accent1". */
    setTableStyle(styleId: string): this;
    /**
     * Table alignment on the page.
     * Equivalent to Table Properties → Table → Alignment.
     */
    setTableAlignment(alignment: "left" | "center" | "right"): this;
    /**
     * Table indent from the left margin in twips.
     * Equivalent to Table Properties → Table → Indent from Left.
     */
    setTableIndent(twips: number): this;
    /**
     * Text wrapping around the table.
     * Equivalent to Table Properties → Table → Text Wrapping.
     */
    setTextWrapping(type: "none" | "around"): this;
    /**
     * Right-to-left table direction.
     * Equivalent to Table Properties → Table → Table direction.
     */
    setTableDirection(rtl: boolean): this;
    /**
     * Set accessible alt text (title + description).
     * Equivalent to Table Properties → Alt Text.
     */
    setAltText(title: string, description?: string): this;
    /**
     * Set table width.
     * type "pct"  → percentage of page width (pass 0–100)
     * type "dxa"  → fixed twips
     * type "auto" → auto
     */
    setTableWidth(value: number, type?: "pct" | "dxa" | "auto"): this;
    /**
     * Layout mode.
     * "autofit" → AutoFit Contents / AutoFit Window
     * "fixed"   → Fixed Column Width
     */
    setLayoutMode(mode: "autofit" | "fixed"): this;
    /** Shorthand: AutoFit to contents. */
    autoFitContents(): this;
    /** Shorthand: AutoFit to window (page width). */
    autoFitWindow(): this;
    /** Shorthand: Fixed column widths. */
    fixedColumnWidth(): this;
    /**
     * Default cell margins for the entire table (twips).
     * Equivalent to Table Properties → Options → Default cell margins.
     */
    setDefaultCellMargins(margins: CellMargins): this;
    /**
     * Table-level borders.
     */
    setTableBorders(borders: TableBorderOptions): this;
    /**
     * Set row height.
     * rule: "atLeast" (At least) | "exact" (Exact)
     * Equivalent to Table Properties → Row → Specify height.
     */
    setRowHeight(rowIndex: number, heightTwips: number, rule?: "atLeast" | "exact"): this;
    /**
     * Allow/prevent a row from breaking across pages.
     * Equivalent to Table Properties → Row → Allow row to break across pages.
     */
    setRowAllowBreak(rowIndex: number, allow: boolean): this;
    /**
     * Mark a row as a repeating header at the top of each page.
     * Equivalent to Table Properties → Row → Repeat as header row.
     * Optionally set a background fill colour.
     */
    setHeaderRow(rowIndex: number, fillColor?: string): this;
    /** Shade all cells in a row with one background colour. */
    setRowShading(rowIndex: number, fillColor: string): this;
    /**
     * Set preferred width (twips) for every cell in a column.
     * Equivalent to Table Properties → Column → Preferred width.
     */
    setColumnWidth(colIndex: number, widthTwips: number): this;
    /** Set cell preferred width in twips. */
    setCellWidth(row: number, col: number, widthTwips: number): this;
    /**
     * Set cell vertical alignment.
     * Equivalent to Table Properties → Cell → Vertical Alignment.
     */
    setCellVerticalAlignment(row: number, col: number, alignment: "top" | "center" | "bottom"): this;
    /**
     * Set individual cell margins (overrides table default).
     * Equivalent to Table Properties → Cell → Options.
     */
    setCellMargins(row: number, col: number, margins: CellMargins): this;
    /** Set cell background shading colour. */
    setCellShading(row: number, col: number, fillColor: string): this;
    /** Set text with rich formatting in a cell. */
    setCellContent(row: number, col: number, text: string, opts?: CellTextOptions): this;
    /** Set plain text in a cell. */
    setCellText(row: number, col: number, text: string): this;
    private makeEmptyRow;
    /**
     * Insert a blank row above the given index.
     * Equivalent to Layout → Insert Above.
     */
    insertRowAbove(rowIndex: number): this;
    /**
     * Insert a blank row below the given index.
     * Equivalent to Layout → Insert Below.
     */
    insertRowBelow(rowIndex: number): this;
    /**
     * Append a row, optionally pre-filled with text.
     */
    addRow(cellTexts?: string[]): this;
    /**
     * Remove the row at the given index.
     * Equivalent to Layout → Delete → Delete Rows.
     */
    removeRow(index: number): this;
    /**
     * Insert a blank column to the left of colIndex.
     * Equivalent to Layout → Insert Left.
     */
    insertColumnLeft(colIndex: number): this;
    /**
     * Insert a blank column to the right of colIndex.
     * Equivalent to Layout → Insert Right.
     */
    insertColumnRight(colIndex: number): this;
    /**
     * Delete an entire column.
     * Equivalent to Layout → Delete → Delete Columns.
     */
    deleteColumn(colIndex: number): this;
    /**
     * Horizontally merge cells in a single row from startCol to endCol (inclusive).
     * Equivalent to Layout → Merge Cells.
     */
    mergeCellsHorizontal(rowIndex: number, startCol: number, endCol: number): this;
    /**
     * Vertically merge cells in a column from startRow to endRow (inclusive).
     * Equivalent to Layout → Merge Cells (vertical selection).
     */
    mergeCellsVertical(colIndex: number, startRow: number, endRow: number): this;
    /**
     * Set all rows to the same height (based on tallest row or a fixed value).
     * Equivalent to Layout → Distribute Rows.
     */
    distributeRows(heightTwips?: number): this;
    /**
     * Set all columns to equal width.
     * Equivalent to Layout → Distribute Columns.
     */
    distributeColumns(): this;
    /**
     * Sort data rows (skipping the header row) by the value in colIndex.
     * Equivalent to Layout → Sort.
     */
    sortByColumn(colIndex: number, direction?: "asc" | "desc", hasHeaderRow?: boolean): this;
    /** Raw table object for serialisation. */
    toObject(): TableObject;
}

declare interface TableBorderOptions {
    top?: BorderSide;
    bottom?: BorderSide;
    left?: BorderSide;
    right?: BorderSide;
    insideH?: BorderSide;
    insideV?: BorderSide;
}

export declare interface TableCell {
    $?: Record<string, any>;
    "w:tcPr"?: TableCellProperties;
    "w:p"?: any | any[];
}

declare interface TableCellProperties {
    "w:tcW"?: {
        $: {
            "w:w": string;
            "w:type": string;
        };
    };
    "w:shd"?: {
        $: {
            "w:fill": string;
            "w:val": string;
            "w:color"?: string;
        };
    };
    "w:vAlign"?: {
        $: {
            "w:val": string;
        };
    };
    "w:tcMar"?: any;
    "w:gridSpan"?: {
        $: {
            "w:val": string;
        };
    };
    "w:vMerge"?: {
        $?: {
            "w:val"?: string;
        };
    } | string;
    [key: string]: any;
}

export declare interface TableObject {
    $?: Record<string, any>;
    "w:tblPr"?: TableProperties;
    "w:tblGrid"?: any;
    "w:tr"?: TableRow | TableRow[];
}

export declare class TableOfContentsManager {
    private zip;
    constructor(zip: default_2);
    private readDocument;
    private writeDocument;
    private buildInstrText;
    private buildTocParagraphs;
    /**
     * Insert a Table of Contents at the given body paragraph index (default: 0).
     */
    insertTOC(options?: TocOptions, index?: number): Promise<void>;
    /**
     * Remove all TOC paragraphs (TOCHeading + paragraphs containing a TOC field).
     */
    removeTOC(): Promise<void>;
}

declare interface TableProperties {
    "w:tblStyle"?: {
        $: {
            "w:val": string;
        };
    };
    "w:tblW"?: {
        $: {
            "w:w": string;
            "w:type": string;
        };
    };
    "w:jc"?: {
        $: {
            "w:val": string;
        };
    };
    "w:tblInd"?: {
        $: {
            "w:w": string;
            "w:type": string;
        };
    };
    "w:tblBorders"?: any;
    "w:tblLayout"?: {
        $: {
            "w:type": string;
        };
    };
    "w:tblCellMar"?: any;
    "w:bidiVisual"?: Record<string, any>;
    "w:tblCaption"?: {
        $: {
            "w:val": string;
        };
    };
    "w:tblDescription"?: {
        $: {
            "w:val": string;
        };
    };
    [key: string]: any;
}

export declare interface TableRow {
    $?: Record<string, any>;
    "w:trPr"?: TableRowProperties;
    "w:tc"?: TableCell | TableCell[];
}

declare interface TableRowProperties {
    "w:trHeight"?: {
        $: {
            "w:val": string;
            "w:hRule"?: string;
        };
    };
    "w:tblHeader"?: Record<string, any>;
    "w:cantSplit"?: Record<string, any>;
    [key: string]: any;
}

export declare interface TextBoxOptions {
    text: string;
    position?: ShapePosition;
    size?: ShapeSize;
    paragraphIndex?: number;
    fillColor?: string;
    borderColor?: string;
    floating?: boolean;
}

/**
 * Represents a text run in the document.
 * A run is a region of text with a common set of properties, such as formatting,
 * inline elements like breaks, tabs, fields, and drawings.
 *
 * @example
 * <w:r>
 *   <w:rPr>
 *     <w:b/>
 *     <w:i/>
 *   </w:rPr>
 *   <w:t xml:space="preserve">quick</w:t>
 *   <w:br/>
 *   <w:tab/>
 * </w:r>
 */
/**
 * Represents a single text node inside a run.
 */
declare interface TextNode {
    $?: {
        "xml:space"?: "preserve";
    };
    _: string;
}

/**
 * Pass-through classifier kept for compatibility. Filters out pure-whitespace
 * "other" blocks would change semantics, so this returns every block as-is.
 */
export declare function toBlocks(bodyChildren: BodyBlock[]): BodyBlock[];

export declare interface TocOptions {
    headingDepth?: number;
    title?: string;
    includePageNumbers?: boolean;
    useHyperlinks?: boolean;
}

export declare class TrackedChangesManager {
    private zip;
    constructor(zip: default_2);
    private readDocument;
    private writeDocument;
    private getBodyParagraphs;
    private norm;
    private textFromRuns;
    private extractRevisionsFromParagraph;
    private acceptInsInParagraph;
    private rejectInsInParagraph;
    private acceptDelInParagraph;
    private rejectDelInParagraph;
    private acceptRPrChanges;
    private rejectRPrChanges;
    private acceptPPrChange;
    private rejectPPrChange;
    getRevisions(): Promise<RevisionEntry[]>;
    acceptAll(): Promise<void>;
    rejectAll(): Promise<void>;
    acceptRevision(id: number): Promise<void>;
    rejectRevision(id: number): Promise<void>;
}

/** Convert twips to centimetres */
export declare const twipsToCm: (twips: number) => number;

/** Convert twips to inches */
export declare const twipsToInches: (twips: number) => number;

declare type xmlFile = {
    fileName: string;
    xml: string;
};

declare type xmlFile_2 = {
    fileName: string;
    xml: string;
};

export declare class ZipManager extends default_2 {
    constructor(filePathOrBuffer?: string | Buffer);
    static loadFromFile(filePath: string): Promise<ZipManager>;
    static loadFromBuffer(buffer: Buffer): Promise<ZipManager>;
    getFileAsBuffer(entryName: string): Buffer | null;
    getFileAsString(entryName: string): string | null;
    fileExists(entryName: string): boolean;
    saveToFile(filePath: string): Promise<void>;
    toBuffer(): Buffer;
}

export { }
