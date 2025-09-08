// src/config.ts
import { ContentTypes } from "./ContentTypes";
import { BASE_OVERRIDES } from "./baseOverrides";
import { defaultContentTypes } from "./defaultContentTypes";

/**
 * Engine version
 */
export const ENGINE_VERSION = "1.0.0";

/**
 * Default directories inside a DOCX zip
 */
export const DOCX_PATHS = {
  ROOT: "",
  WORD: "word/",
  RELS: "_rels/",
  DOC_PROPS: "docProps/",
  CUSTOM_XML: "customXml/",
  MEDIA: "word/media/",
  THEME: "word/theme/",
};

/**
 * Names of important DOCX files
 */
export const DOCX_FILES = {
  DOCUMENT: "word/document.xml",
  STYLES: "word/styles.xml",
  SETTINGS: "word/settings.xml",
  WEB_SETTINGS: "word/webSettings.xml",
  FONT_TABLE: "word/fontTable.xml",
  THEME: "word/theme/theme1.xml",
  CONTENT_TYPES: "[Content_Types].xml",
  APP_PROPS: "docProps/app.xml",
  CORE_PROPS: "docProps/core.xml",
};

/**
 * XML namespaces used across DOCX files
 */
export const XML_NAMESPACES = {
  WORD: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  RELS: "http://schemas.openxmlformats.org/package/2006/relationships",
  CONTENT_TYPES: "http://schemas.openxmlformats.org/package/2006/content-types",
  DRAWING: "http://schemas.openxmlformats.org/drawingml/2006/main",
  OFFICE_DOCUMENT: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
};

/**
 * Default [Content_Types].xml configuration
 */
export const DEFAULT_DOCX_CONTENT_TYPES: ContentTypes = {
  Defaults: defaultContentTypes,
  Overrides: BASE_OVERRIDES,
};

/**
 * Temporary folder name for extracting DOCX files
 */
export const TEMP_FOLDER_NAME = ".mdocxengine_tmp";

/**
 * Logging configuration
 */
export const LOGGING = {
  ENABLED: true,
  LEVEL: "debug" as "info" | "warn" | "error" | "debug",
};
