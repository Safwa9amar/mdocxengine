// src/config.ts
import { ContentTypes, defaultContentTypes } from "./ContentTypes";
import { BASE_OVERRIDES } from "./baseOverrides";

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
