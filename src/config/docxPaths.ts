/** Folder where all embedded images are stored */
export type MediaDir = "word/media";

/** Supported image file extensions */
export type MediaExtension = "png" | "jpg" | "jpeg" | "gif";

/** Dynamic media file name like image1.png */
export type MediaFile = `image${number}.${MediaExtension}`;

/** Relationship files folders */
export type RelsDirRoot = "_rels";
export type RelsDirWord = "word/_rels";
export type RelsDir = RelsDirRoot | RelsDirWord;

/** Theme folder */
export type ThemeDir = "word/theme";

/** Document properties folder */
export type DocPropsDir = "docProps";

/** Root Word folder */
export type WordDir = "word";

/** Files inside the "word" directory */
export type WordFile =
  | "document.xml"
  | "styles.xml"
  | "settings.xml"
  | "webSettings.xml"
  | "fontTable.xml"
  | "numbering.xml";

/** Dynamic header file name like image1.png */

export type headerFile = `${WordDir}/header${number}.xml`;

/** Dynamic footer file name like image1.png */

export type FooterFile = `${WordDir}/footer${number}.xml`;

export type ContentTypeFile = "[Content_Types].xml";

/** Files inside "word/theme" */
export type ThemeFile = "theme1.xml";

/** Files inside "_rels" or "word/_rels" */
export type RelsFile = ".rels" | "document.xml.rels";

/** Files inside "docProps" */
export type DocPropsFile = "app.xml" | "core.xml";

/** Full paths */
export type WordPath = `${WordDir}/${WordFile}`;
export type ThemePath = `${ThemeDir}/${ThemeFile}`;
export type RelsPath = `${RelsDir}/${RelsFile}`;
export type DocPropsPath = `${DocPropsDir}/${DocPropsFile}`;
export type MediaPath = `${MediaDir}/${MediaFile}`;

/** Unified type for all valid paths in a docx file */
export type DocxPath = WordPath | ThemePath | RelsPath | DocPropsPath | MediaPath;
