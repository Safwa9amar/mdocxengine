/**
 * Default extensions and their associated MIME types.
 */
export declare enum DefaultContentTypeEnum {
    JPEG = "image/jpeg",
    PNG = "image/png",
    RELS = "application/vnd.openxmlformats-package.relationships+xml",
    XML = "application/xml"
}
/**
 * Override part types with their MIME types.
 */
export declare enum OverrideContentTypeEnum {
    DOCUMENT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
    CUSTOM_XML_PROPS = "application/vnd.openxmlformats-officedocument.customXmlProperties+xml",
    NUMBERING = "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml",
    STYLES = "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml",
    SETTINGS = "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml",
    WEB_SETTINGS = "application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml",
    FOOTNOTES = "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml",
    ENDNOTES = "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml",
    FOOTER = "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml",
    HEADER = "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml",
    COMMENTS = "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml",
    COMMENTS_EXTENDED = "application/vnd.openxmlformats-officedocument.wordprocessingml.commentsExtended+xml",
    COMMENTS_IDS = "application/vnd.openxmlformats-officedocument.wordprocessingml.commentsIds+xml",
    FONT_TABLE = "application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml",
    THEME = "application/vnd.openxmlformats-officedocument.theme+xml",
    CORE_PROPS = "application/vnd.openxmlformats-package.core-properties+xml",
    APP_PROPS = "application/vnd.openxmlformats-officedocument.extended-properties+xml"
}
export declare enum RelsType {
    Root = "_rels/.rels",
    Document = "word/_rels/document.xml.rels"
}
declare const _default: {};
export default _default;
