import { ContentTypes } from "./ContentTypes";
/**
 * Engine version
 */
export declare const ENGINE_VERSION = "1.0.0";
/**
 * Default directories inside a DOCX zip
 */
export declare const DOCX_PATHS: {
    ROOT: string;
    WORD: string;
    RELS: string;
    DOC_PROPS: string;
    CUSTOM_XML: string;
    MEDIA: string;
    THEME: string;
};
/**
 * Names of important DOCX files
 */
export declare const DOCX_FILES: {
    DOCUMENT: string;
    STYLES: string;
    SETTINGS: string;
    WEB_SETTINGS: string;
    FONT_TABLE: string;
    THEME: string;
    CONTENT_TYPES: string;
    APP_PROPS: string;
    CORE_PROPS: string;
};
/**
 * XML namespaces used across DOCX files
 */
export declare const XML_NAMESPACES: {
    WORD: string;
    RELS: string;
    CONTENT_TYPES: string;
    DRAWING: string;
    OFFICE_DOCUMENT: string;
};
/**
 * Default [Content_Types].xml configuration
 */
export declare const DEFAULT_DOCX_CONTENT_TYPES: ContentTypes;
/**
 * Temporary folder name for extracting DOCX files
 */
export declare const TEMP_FOLDER_NAME = ".mdocxengine_tmp";
/**
 * Logging configuration
 */
export declare const LOGGING: {
    ENABLED: boolean;
    LEVEL: "info" | "warn" | "error" | "debug";
};
