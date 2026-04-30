import { default as default_2 } from 'adm-zip';

export declare interface AppProperties {
    application?: string;
    pages?: number;
    words?: number;
    characters?: number;
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
    /**
     * Build the full caption <w:p> node (uses the "Caption" paragraph style).
     */
    private buildCaptionParagraph;
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
     * Create a run that cross-references a bookmark by name.
     * Insert this run into any paragraph via paragraph.addRun().
     */
    createCrossRefRun(bookmarkName: string, displayText?: string): Run_2;
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
     * Returns all paragraphs in word/document.xml as Paragraph instances.
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
    /**
     * Adds a footer to the document.
     * @param text  Plain text for the footer paragraph.
     * @param type  Footer type: "default" | "first" | "even". Defaults to "default".
     * @param xml   Optional — provide raw footer XML instead of auto-generating from text.
     */
    addFooter(text: string, type?: FooterType, xml?: string): Promise<{
        footerPath: string;
        relId: string;
        footerXml: string;
    }>;
    /**
     * Overwrites an existing footer file's content.
     */
    updateFooter(name: string, newXml: string): void;
    /**
     * Removes a footer: deletes the zip entry, content-type override, relationship,
     * and the <w:footerReference> from document.xml's <w:sectPr>.
     */
    removeFooter(name: string): Promise<void>;
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
    /**
     * Returns the next available header filename (e.g. word/header3.xml).
     */
    private nextHeaderPath;
    /**
     * Builds a minimal <w:hdr> XML string containing a single paragraph with the given text.
     */
    private buildHeaderXml;
    /**
     * Adds a header to the document.
     * @param text     Plain text for the header paragraph.
     * @param type     Header type: "default" | "first" | "even". Defaults to "default".
     * @param xml      Optional — provide raw header XML to use instead of auto-generating from text.
     */
    addHeader(text: string, type?: HeaderType, xml?: string): Promise<{
        headerPath: string;
        relId: string;
        headerXml: string;
    }>;
    /**
     * Overwrites an existing header file's content.
     * @param name   Full path like "word/header1.xml"
     * @param newXml New XML string for the header.
     */
    updateHeader(name: string, newXml: string): void;
    /**
     * Removes a header: deletes the zip entry, content-type override, relationship,
     * and the <w:headerReference> from document.xml's <w:sectPr>.
     * @param name  Full path like "word/header1.xml"
     */
    removeHeader(name: string): Promise<void>;
    /**
     * Finds the relationship ID for a given header file, removes it from .rels,
     * and removes the matching <w:headerReference> from document.xml.
     */
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

export declare interface LineNumberingOptions {
    countBy?: number;
    start?: number;
    distance?: number;
    restart?: "newPage" | "newSection" | "continuous";
}

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
    private constructor();
    static loadFromFile(path: string): Promise<Mdocxengine>;
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

export declare interface TocOptions {
    headingDepth?: number;
    title?: string;
    includePageNumbers?: boolean;
    useHyperlinks?: boolean;
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
    getFileAsBuffer(entryName: string): Buffer | null;
    getFileAsString(entryName: string): string | null;
    fileExists(entryName: string): boolean;
    saveToFile(filePath: string): Promise<void>;
    toBuffer(): Buffer;
}

export { }
