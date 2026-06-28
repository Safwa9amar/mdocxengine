import { ZipManager } from "./utils/ZipManager";
import { ContentTypesManager } from "./core/PartsManagers/ContentTypesManager";
import DocumentManager from "./core/PartsManagers/DocumentManager";
import FooterManager from "@/core/PartsManagers/FooterManager";
import HeaderManager from "./core/PartsManagers/HeaderManager";
import RootRelManager from "./core/PartsManagers/RootRelManager";
import { RelManager } from "./core/PartsManagers/RelManager";
import { StylesManager } from "./core/PartsManagers/StylesManager";
import { NumberingManager } from "./core/PartsManagers/NumberingManager";
import { MetadataManager } from "./core/PartsManagers/MetadataManager";
import { MediaManager } from "./core/PartsManagers/MediaManager";
import { FootnoteManager } from "./core/PartsManagers/FootnoteManager";
import { EndnoteManager } from "./core/PartsManagers/EndnoteManager";
import { TableOfContentsManager } from "./core/PartsManagers/TableOfContentsManager";
import { CrossReferenceManager } from "./core/PartsManagers/CrossReferenceManager";
import { CitationManager } from "./core/PartsManagers/CitationManager";
import { PageLayoutManager } from "./core/PartsManagers/PageLayoutManager";
import { CaptionManager } from "./core/PartsManagers/CaptionManager";
import { CommentsManager } from "./core/PartsManagers/CommentsManager";
import { TrackedChangesManager } from "./core/PartsManagers/TrackedChangesManager";
import { SectionManager } from "./core/PartsManagers/SectionManager";
import { ShapeManager } from "./core/PartsManagers/ShapeManager";
import { MergeManager } from "./core/PartsManagers/MergeManager";
import fs from "fs/promises";
import path from "path";
class Mdocxengine {
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
  merge: MergeManager;

  private constructor(zip: ZipManager) {
    this.zip = zip;
    this.rels = new RelManager(zip);
    this.contentTypes = new ContentTypesManager(zip);
    this.document = new DocumentManager(zip);
    this.footer = new FooterManager(zip);
    this.header = new HeaderManager(zip);
    this.rootRels = new RootRelManager(zip);
    this.styles = new StylesManager(zip);
    this.numbering = new NumberingManager(zip);
    this.metadata = new MetadataManager(zip);
    this.media = new MediaManager(zip);
    this.footnotes = new FootnoteManager(zip);
    this.endnotes = new EndnoteManager(zip);
    this.toc = new TableOfContentsManager(zip);
    this.crossRef = new CrossReferenceManager(zip);
    this.citations = new CitationManager(zip);
    this.pageLayout = new PageLayoutManager(zip);
    this.captions       = new CaptionManager(zip);
    this.comments       = new CommentsManager(zip);
    this.trackedChanges = new TrackedChangesManager(zip);
    this.sections       = new SectionManager(zip);
    this.shapes         = new ShapeManager(zip);
    this.merge          = new MergeManager(zip);
  }

  static async loadFromFile(path: string) {
    const zm = await ZipManager.loadFromFile(path);
    return new Mdocxengine(zm);
  }

  // Load a document from an in-memory Buffer (e.g. bytes fetched from object
  // storage) without writing a temp file. Mirrors loadFromFile.
  static async loadFromBuffer(buffer: Buffer) {
    const zm = await ZipManager.loadFromBuffer(buffer);
    return new Mdocxengine(zm);
  }

  async saveToFile(outputPath: string) {
    const buf: Buffer = this.zip.toBuffer();
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buf);
  }
}

export {
  Mdocxengine,
  ZipManager,
  RelManager,
  ContentTypesManager,
  DocumentManager,
  FooterManager,
  HeaderManager,
  RootRelManager,
  StylesManager,
  NumberingManager,
  MetadataManager,
  MediaManager,
  FootnoteManager,
  EndnoteManager,
  TableOfContentsManager,
  CrossReferenceManager,
  CitationManager,
  PageLayoutManager,
  CaptionManager,
  CommentsManager,
  TrackedChangesManager,
  SectionManager,
  ShapeManager,
  MergeManager,
};
export { DEFAULT_STYLE_ALIASES } from "./core/PartsManagers/MergeManager";
export type { AppendOptions } from "./core/PartsManagers/MergeManager";
export { default as Paragraph } from "./core/files/paragraph/index";
export { Run } from "./core/files/paragraph/Run";
export { Table } from "./core/files/table/index";
export {
  parseOrderedDoc,
  buildOrderedDoc,
  toBlocks,
  makeParagraphXml,
  makeParagraphNode,
  makeTableXml,
  makeTableNode,
  makeDrawingParagraphXml,
  makeDrawingParagraphNode,
  nextDrawingId,
  paragraphText,
  paragraphStyleId,
  setParagraphText,
  nodeTag,
} from "./core/files/body/OrderedBody";
export type { BodyBlock, BlockKind } from "./core/files/body/OrderedBody";
export type { StyleEntry } from "./core/PartsManagers/StylesManager";
export type { NumberingDefinition } from "./core/PartsManagers/NumberingManager";
export type { CoreProperties, AppProperties } from "./core/PartsManagers/MetadataManager";
export type { ImageEntry } from "./core/PartsManagers/MediaManager";
export type { TableObject, TableRow, TableCell } from "./core/files/table/types";
export type { FootnoteEntry } from "./core/PartsManagers/FootnoteManager";
export type { EndnoteEntry } from "./core/PartsManagers/EndnoteManager";
export type { TocOptions } from "./core/PartsManagers/TableOfContentsManager";
export type { BookmarkEntry } from "./core/PartsManagers/CrossReferenceManager";
export type { CitationSource } from "./core/PartsManagers/CitationManager";
export type {
  PageSizePreset,
  MarginPreset,
  Orientation,
  SectionBreakType,
  PageSize,
  PageMargins,
  ColumnOptions,
  LineNumberingOptions,
} from "./core/PartsManagers/PageLayoutManager";
export { PAGE_SIZES, MARGIN_PRESETS, inchesToTwips, cmToTwips, twipsToInches, twipsToCm } from "./core/PartsManagers/PageLayoutManager";
export type {
  CaptionOptions,
  CaptionNumberingOptions,
  CaptionNumberFormat,
  CaptionPosition,
  ChapterSeparator,
  CaptionEntry,
} from "./core/PartsManagers/CaptionManager";
export type { CommentEntry } from "./core/PartsManagers/CommentsManager";
export type { RevisionEntry, RevisionType } from "./core/PartsManagers/TrackedChangesManager";
export type {
  SectionEntry,
  SectionLayout,
  SectionPageSize,
  SectionMargins,
  SectionHeaderFooterRef,
} from "./core/PartsManagers/SectionManager";
export type {
  ShapeEntry,
  TextBoxOptions,
  InsertShapeOptions,
  InsertLineOptions,
  ShapeType,
  ShapePosition,
  ShapeSize,
} from "./core/PartsManagers/ShapeManager";
export { EMU_PER_INCH, EMU_PER_CM } from "./core/PartsManagers/ShapeManager";
