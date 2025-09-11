/** Folder where all embedded images are stored */
export type MediaDir = "word/media";
export const MediaDir = "word/media" as const;

/** Supported image file extensions */
export type MediaExtension = "png" | "jpg" | "jpeg" | "gif";
export const MediaExtension = {
  PNG: "png",
  JPG: "jpg",
  JPEG: "jpeg",
  GIF: "gif",
} as const;

/** Dynamic media file name like image1.png */
export type MediaFile = `image${number}.${MediaExtension}`;

/** Relationship files folders */
export type RelsDirRoot = "_rels";
export type RelsDirWord = "word/_rels";
export type RelsDir = RelsDirRoot | RelsDirWord;
export const RelsDir = {
  Root: "_rels",
  Word: "word/_rels",
} as const;

/** Theme folder */
export type ThemeDir = "word/theme";
export const ThemeDir = "word/theme" as const;

/** Document properties folder */
export type DocPropsDir = "docProps";
export const DocPropsDir = "docProps" as const;

/** Root Word folder */
export type WordDir = "word";
export const WordDir = "word" as const;

/** Files inside the "word" directory */
export type WordFile =
  | "document.xml"
  | "styles.xml"
  | "settings.xml"
  | "webSettings.xml"
  | "fontTable.xml"
  | "numbering.xml";
export const WordFile = {
  Document: "document.xml",
  Styles: "styles.xml",
  Settings: "settings.xml",
  WebSettings: "webSettings.xml",
  FontTable: "fontTable.xml",
  Numbering: "numbering.xml",
} as const;

/** Dynamic header file name like header1.xml */
export type HeaderFile = `${WordDir}/header${number}.xml`;

/** Dynamic footer file name like footer1.xml */
export type FooterFile = `${WordDir}/footer${number}.xml`;

export type ContentTypeFile = "[Content_Types].xml";
export const ContentTypeFile = "[Content_Types].xml" as const;

/** Files inside "word/theme" */
export type ThemeFile = "theme1.xml";
export const ThemeFile = "theme1.xml" as const;

/** Files inside "_rels" or "word/_rels" */
export type RelsFile = ".rels" | "document.xml.rels";
export const RelsFile = {
  Root: ".rels",
  Document: "document.xml.rels",
} as const;

/** Files inside "docProps" */
export type DocPropsFile = "app.xml" | "core.xml";
export const DocPropsFile = {
  App: "app.xml",
  Core: "core.xml",
} as const;

/** Full paths */
export type WordPath = `${WordDir}/${WordFile}`;
export const WordPath = {
  Document: `${WordDir}/${WordFile.Document}`,
  Styles: `${WordDir}/${WordFile.Styles}`,
  Settings: `${WordDir}/${WordFile.Settings}`,
  WebSettings: `${WordDir}/${WordFile.WebSettings}`,
  FontTable: `${WordDir}/${WordFile.FontTable}`,
  Numbering: `${WordDir}/${WordFile.Numbering}`,
} as const;

export type ThemePath = `${ThemeDir}/${ThemeFile}`;
export const ThemePath = `${ThemeDir}/${ThemeFile}` as const;

export type RelsPath = `${RelsDir}/${RelsFile}`;
export const RelsPath = {
  Root: `${RelsDir.Root}/${RelsFile.Root}`,
  Document: `${RelsDir.Word}/${RelsFile.Document}`,
} as const;

export type DocPropsPath = `${DocPropsDir}/${DocPropsFile}`;
export const DocPropsPath = {
  App: `${DocPropsDir}/${DocPropsFile.App}`,
  Core: `${DocPropsDir}/${DocPropsFile.Core}`,
} as const;

export type MediaPath = `${MediaDir}/${MediaFile}`;

/** Unified type for all valid paths in a docx file */
export type DocxPath = WordPath | ThemePath | RelsPath | DocPropsPath | MediaPath;
