import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';
import { Builder, parseStringPromise } from 'xml2js';
import fs$1 from 'fs';

class ZipManager {
    constructor(zip) {
        this.zip = zip ?? new AdmZip();
    }
    static async loadFromFile(filePath) {
        const data = await fs.readFile(filePath);
        const zip = new AdmZip(data);
        return new ZipManager(zip);
    }
    getFileAsBuffer(entryName) {
        const entry = this.zip.getEntry(entryName);
        if (!entry)
            return null;
        return entry.getData();
    }
    getFileAsString(entryName) {
        const buf = this.getFileAsBuffer(entryName);
        return buf ? buf.toString('utf8') : null;
    }
    fileExists(entryName) {
        return !!this.zip.getEntry(entryName);
    }
    addFile(entryName, content) {
        if (this.fileExists(entryName)) {
            // delete existing so we don't have duplicates
            try {
                this.zip.deleteFile(entryName);
            }
            catch (e) { /* ignore */ }
        }
        const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
        this.zip.addFile(entryName, buffer);
    }
    removeFile(entryName) {
        if (this.fileExists(entryName)) {
            try {
                this.zip.deleteFile(entryName);
            }
            catch (e) { /* ignore */ }
        }
    }
    getEntries() {
        return this.zip.getEntries().map(e => e.entryName);
    }
    async saveToFile(filePath) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        // writeZip has optional callback style; use writeZip to path
        await new Promise((resolve, reject) => {
            try {
                this.zip.writeZip(filePath, (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    toBuffer() {
        return this.zip.toBuffer();
    }
}

async function parseXml(xml) {
    return parseStringPromise(xml, {
        explicitArray: false, // prefer objects to arrays where possible
        preserveChildrenOrder: true,
        attrkey: '$',
        charkey: '_',
        trim: true
    });
}
function buildXml(obj, options) {
    const builder = new Builder({
        rootName: options?.rootName,
        headless: options?.headless ?? false,
        xmldec: { version: '1.0', encoding: 'UTF-8', standalone: options?.standalone ?? true },
        renderOpts: {
            pretty: options?.pretty ?? true,
            indent: options?.indent ?? '  ',
            newline: options?.newline ?? '\n'
        }
    });
    return builder.buildObject(obj);
}
/** Small helpers to create simple Word elements (basic shapes to start) */
function createWordParagraph(text) {
    return {
        'w:p': {
            'w:pPr': {
                'w:rPr': {}
            },
            'w:r': {
                'w:rPr': {},
                'w:t': text
            }
        }
    };
}

/**
 * Defines all log levels supported by the logger.
 */
var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["DEBUG"] = "DEBUG";
})(LogLevel || (LogLevel = {}));
// Path to save logs
const logFilePath = path.join(process.cwd(), 'logs', 'app.log');
// Ensure logs directory exists
if (!fs$1.existsSync(path.dirname(logFilePath))) {
    fs$1.mkdirSync(path.dirname(logFilePath), { recursive: true });
}
const levels = {
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG'
};
/**
 * Writes a log message to the console and log file.
 * @param {string} level - Log level (INFO, WARN, ERROR, DEBUG)
 * @param {string} message - Message to log
 */
function log(level, message) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${level}] ${message}`;
    // Print to console
    switch (level) {
        case levels.ERROR:
            console.error(formattedMessage);
            break;
        case levels.WARN:
            console.warn(formattedMessage);
            break;
        case levels.DEBUG:
            console.debug(formattedMessage);
            break;
        default:
            console.log(formattedMessage);
    }
    // Append to file
    fs$1.appendFileSync(logFilePath, formattedMessage + '\n', 'utf8');
}
const logger = {
    info: (msg) => log(LogLevel.INFO, msg),
    warn: (msg) => log(LogLevel.WARN, msg),
    error: (msg) => log(LogLevel.ERROR, msg),
    debug: (msg) => log(LogLevel.DEBUG, msg)
};

class ContentTypesManager {
    constructor(zip) {
        this.filePath = '[Content_Types].xml';
        this.ns = 'http://schemas.openxmlformats.org/package/2006/content-types';
        this.zip = zip;
    }
    /** Generate a GUID */
    generateGuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
            const rand = Math.random() * 16 | 0;
            const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
            return value.toString(16);
        });
    }
    /**
     * Reads current [Content_Types].xml or returns a default structure
     */
    async readTypes() {
        const xml = this.zip.getFileAsString(this.filePath);
        if (!xml) {
            return {
                Types: {
                    $: { xmlns: this.ns },
                    Default: [],
                    Override: []
                }
            };
        }
        const parsed = await parseXml(xml);
        // Normalize arrays
        parsed.Types.Default = Array.isArray(parsed.Types.Default) ? parsed.Types.Default : [parsed.Types.Default].filter(Boolean);
        parsed.Types.Override = Array.isArray(parsed.Types.Override) ? parsed.Types.Override : [parsed.Types.Override].filter(Boolean);
        return parsed;
    }
    /**
     * Writes back the [Content_Types].xml into the zip
     */
    async writeTypes(obj) {
        const xml = buildXml(obj.Types, { headless: false, pretty: true, rootName: "Types" });
        this.zip.addFile(this.filePath, xml);
    }
    /**
     * Adds a Default content type if not exists
     * Example: Extension="xml" ContentType="application/xml"
     */
    async addDefault(extension, contentType) {
        const typesObj = await this.readTypes();
        const exists = typesObj.Types.Default.some(d => d.$.Extension === extension);
        if (!exists) {
            typesObj.Types.Default.push({
                $: { Extension: extension, ContentType: contentType }
            });
            await this.writeTypes(typesObj);
            logger.info(`Added Default content type for extension: ${extension}`);
        }
    }
    /**
     * Adds an Override element if it doesn't exist yet.
     * Example:
     * PartName="/word/header1.xml"
     * ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"
     */
    async addOverride(partName, contentType) {
        const typesObj = await this.readTypes();
        const overrides = typesObj.Types.Override;
        const exists = overrides.some(o => o.$.PartName === partName);
        if (!exists) {
            overrides.push({
                $: {
                    PartName: partName,
                    ContentType: contentType
                }
            });
            await this.writeTypes(typesObj);
            logger.info(`Added Override for part: ${partName}`);
        }
    }
    /**
     * Removes an Override entry by PartName
     */
    async removeOverride(partName) {
        const typesObj = await this.readTypes();
        typesObj.Types.Override = typesObj.Types.Override.filter(o => o.$.PartName !== partName);
        await this.writeTypes(typesObj);
        logger.info(`Removed Override for part: ${partName}`);
    }
    /**
     * Checks if an override exists
     */
    async hasOverride(partName) {
        const typesObj = await this.readTypes();
        return typesObj.Types.Override.some(o => o.$.PartName === partName);
    }
    /**
     * Helper to create a new unique part name with GUID
     */
    generateUniquePartName(prefix, extension = 'xml') {
        return `/${prefix}/${this.generateGuid()}.${extension}`;
    }
}

// DocumentManager.ts - auto generated file
class DocumentManager {
    constructor(zip) {
        this.zip = zip;
    }
}

// FooterManager.ts - auto generated file
class FooterManager {
    constructor(zip) {
        this.zip = zip;
    }
}

// Constants.ts - auto generated file
// src/types/DocxContentTypes.ts
/**
 * Default extensions and their associated MIME types.
 */
var DefaultContentTypeEnum;
(function (DefaultContentTypeEnum) {
    DefaultContentTypeEnum["JPEG"] = "image/jpeg";
    DefaultContentTypeEnum["PNG"] = "image/png";
    DefaultContentTypeEnum["RELS"] = "application/vnd.openxmlformats-package.relationships+xml";
    DefaultContentTypeEnum["XML"] = "application/xml";
})(DefaultContentTypeEnum || (DefaultContentTypeEnum = {}));
/**
 * Override part types with their MIME types.
 */
var OverrideContentTypeEnum;
(function (OverrideContentTypeEnum) {
    OverrideContentTypeEnum["DOCUMENT"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";
    OverrideContentTypeEnum["CUSTOM_XML_PROPS"] = "application/vnd.openxmlformats-officedocument.customXmlProperties+xml";
    OverrideContentTypeEnum["NUMBERING"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml";
    OverrideContentTypeEnum["STYLES"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml";
    OverrideContentTypeEnum["SETTINGS"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml";
    OverrideContentTypeEnum["WEB_SETTINGS"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml";
    OverrideContentTypeEnum["FOOTNOTES"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml";
    OverrideContentTypeEnum["ENDNOTES"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml";
    OverrideContentTypeEnum["FOOTER"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml";
    OverrideContentTypeEnum["HEADER"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml";
    OverrideContentTypeEnum["COMMENTS"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml";
    OverrideContentTypeEnum["COMMENTS_EXTENDED"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.commentsExtended+xml";
    OverrideContentTypeEnum["COMMENTS_IDS"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.commentsIds+xml";
    OverrideContentTypeEnum["FONT_TABLE"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml";
    OverrideContentTypeEnum["THEME"] = "application/vnd.openxmlformats-officedocument.theme+xml";
    OverrideContentTypeEnum["CORE_PROPS"] = "application/vnd.openxmlformats-package.core-properties+xml";
    OverrideContentTypeEnum["APP_PROPS"] = "application/vnd.openxmlformats-officedocument.extended-properties+xml";
})(OverrideContentTypeEnum || (OverrideContentTypeEnum = {}));
// relations enums can help for managing zip relation 
var RelsType;
(function (RelsType) {
    RelsType["Root"] = "_rels/.rels";
    RelsType["Document"] = "word/_rels/document.xml.rels";
})(RelsType || (RelsType = {}));

class RelManager {
    constructor(zip, relsPath = RelsType.Document) {
        this.relsPath = RelsType.Document;
        this.ns = 'http://schemas.openxmlformats.org/package/2006/relationships';
        this.zip = zip;
        this.relsPath = relsPath;
    }
    async readRels() {
        const xml = this.zip.getFileAsString(this.relsPath);
        if (!xml) {
            return { $: { xmlns: this.ns } };
        }
        return await parseXml(xml);
    }
    async writeRels(obj) {
        const xml = buildXml(obj, {
            rootName: "Relationships"
        });
        this.zip.addFile(this.relsPath, xml);
    }
    /**
     * Adds a relationship entry: Id must be unique (caller responsible).
     * target should be relative to 'word/' (e.g. 'header1.xml' or 'media/image1.png')
     */
    async addRelationship(id, type, target) {
        const relsObj = await this.readRels();
        // ensure array structure
        const rels = relsObj;
        if (!relsObj.Relationships) {
            rels.Relationship = [];
        }
        else if (!Array.isArray(rels.Relationships.Relationship)) {
            rels.Relationship = [rels.Relationship];
        }
        rels.Relationships.Relationship.push({
            $: {
                Id: id,
                Type: type,
                Target: target
            }
        });
        await this.writeRels(relsObj.Relationships);
    }
    /**
     * Quick helper to generate a new rId (checks existing ones)
     */
    async genId(prefix = 'rId') {
        const xml = this.zip.getFileAsString(this.relsPath);
        if (!xml)
            return `${prefix}1`;
        const relsObj = await parseXml(xml);
        const arr = relsObj.Relationships && relsObj.Relationships.Relationship
            ? (Array.isArray(relsObj.Relationships.Relationship) ? relsObj.Relationships.Relationship : [relsObj.Relationships.Relationship])
            : [];
        let max = 0;
        for (const r of arr) {
            const id = r.$ && r.$.Id;
            const match = id && id.match(/(\d+)$/);
            if (match) {
                const n = parseInt(match[1], 10);
                if (n > max)
                    max = n;
            }
        }
        return `${prefix}${max + 1}`;
    }
}

// HeaderManager.ts - auto generated file
class HeaderManager {
    constructor(zip) {
        this.zip = zip;
        this.rels = new RelManager(zip);
        this.contentTypes = new ContentTypesManager(zip);
    }
    /**
     * Add a simple header part and register it in [Content_Types].xml
     */
    async addHeaderSimple(text) {
        try {
            // 1) Determine header name
            const headerPath = "word/header3.xml";
            logger.info("header name :" + headerPath);
            const paragraph = createWordParagraph(text);
            if (!paragraph || !paragraph["w:p"]) {
                throw new Error("Failed to create Word paragraph. The text might be invalid.");
            }
            const headerObj = {
                "w:hdr": {
                    $: {
                        "xmlns:wpc": "http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas",
                        "xmlns:cx": "http://schemas.microsoft.com/office/drawing/2014/chartex",
                        "xmlns:cx1": "http://schemas.microsoft.com/office/drawing/2015/9/8/chartex",
                        "xmlns:cx2": "http://schemas.microsoft.com/office/drawing/2015/10/21/chartex",
                        "xmlns:cx3": "http://schemas.microsoft.com/office/drawing/2016/5/9/chartex",
                        "xmlns:cx4": "http://schemas.microsoft.com/office/drawing/2016/5/10/chartex",
                        "xmlns:cx5": "http://schemas.microsoft.com/office/drawing/2016/5/11/chartex",
                        "xmlns:cx6": "http://schemas.microsoft.com/office/drawing/2016/5/12/chartex",
                        "xmlns:cx7": "http://schemas.microsoft.com/office/drawing/2016/5/13/chartex",
                        "xmlns:cx8": "http://schemas.microsoft.com/office/drawing/2016/5/14/chartex",
                        "xmlns:mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
                        "xmlns:aink": "http://schemas.microsoft.com/office/drawing/2016/ink",
                        "xmlns:am3d": "http://schemas.microsoft.com/office/drawing/2017/model3d",
                        "xmlns:o": "urn:schemas-microsoft-com:office:office",
                        "xmlns:oel": "http://schemas.microsoft.com/office/2019/extlst",
                        "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
                        "xmlns:m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
                        "xmlns:v": "urn:schemas-microsoft-com:vml",
                        "xmlns:wp14": "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing",
                        "xmlns:wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
                        "xmlns:w10": "urn:schemas-microsoft-com:office:word",
                        "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
                        "xmlns:w14": "http://schemas.microsoft.com/office/word/2010/wordml",
                        "xmlns:w15": "http://schemas.microsoft.com/office/word/2012/wordml",
                        "xmlns:w16cex": "http://schemas.microsoft.com/office/word/2018/wordml/cex",
                        "xmlns:w16cid": "http://schemas.microsoft.com/office/word/2016/wordml/cid",
                        "xmlns:w16": "http://schemas.microsoft.com/office/word/2018/wordml",
                        "xmlns:w16sdtdh": "http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash",
                        "xmlns:w16se": "http://schemas.microsoft.com/office/word/2015/wordml/symex",
                        "xmlns:wpg": "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
                        "xmlns:wpi": "http://schemas.microsoft.com/office/word/2010/wordprocessingInk",
                        "xmlns:wne": "http://schemas.microsoft.com/office/word/2006/wordml",
                        "xmlns:wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
                        "mc:Ignorable": "w14 w15 w16se w16cid w16 w16cex w16sdtdh wp14"
                    },
                    "w:p": {
                        $: {
                            "w14:paraId": "37C962AE",
                            "w14:textId": "7468B4DA",
                            "w:rsidR": "005E6865",
                            "w:rsidRPr": "00C80307",
                            "w:rsidRDefault": "005E6865",
                            "w:rsidP": "00C80307"
                        },
                        "w:pPr": {
                            "w:pStyle": {
                                $: { "w:val": "Header" }
                            },
                            "w:pBdr": {
                                "w:bottom": {
                                    $: {
                                        "w:val": "single",
                                        "w:sz": "24",
                                        "w:space": "1",
                                        "w:color": "1F4E79",
                                        "w:themeColor": "accent1",
                                        "w:themeShade": "80"
                                    }
                                }
                            },
                            "w:jc": {
                                $: { "w:val": "right" }
                            },
                            "w:rPr": {
                                "w:b": {},
                                "w:bCs": {}
                            }
                        },
                        "w:r": {
                            $: { "w:rsidRPr": "005E6865" },
                            "w:rPr": {
                                "w:b": {},
                                "w:bCs": {}
                            },
                            "w:t": "Conclusion"
                        }
                    }
                }
            };
            const headerXml = buildXml(headerObj, {
                rootName: "w:hdr",
                headless: false,
                pretty: true,
            });
            logger.info("header xml :" + headerXml);
            this.zip.addFile(headerPath, headerXml);
            // 3) Add relationship
            const relId = await this.rels.genId();
            logger.info("relId  :" + relId);
            await this.rels.addRelationship(relId, "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header", "header3.xml");
            // 4) Update [Content_Types].xml
            await this.contentTypes.addOverride("/word/header3.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml");
            // 5) Add header reference in document.xml
            await this.addHeaderReferenceToDocument(relId);
            return { headerPath, relId };
        }
        catch (error) {
            return logger.error(error);
        }
    }
    async addHeaderReferenceToDocument(relId) {
        const docPath = "word/document.xml";
        const xml = this.zip.getFileAsString(docPath);
        if (!xml)
            return;
        const docObj = await parseXml(xml);
        const doc = docObj["w:document"] || docObj.document;
        if (!doc)
            return;
        const body = doc["w:body"] || doc.body;
        if (!body)
            return;
        // Ensure <w:sectPr> exists
        if (!body["w:sectPr"]) {
            body["w:sectPr"] = {};
        }
        const sectPr = body["w:sectPr"];
        // Ensure <w:headerReference> is an array
        if (!sectPr["w:headerReference"]) {
            sectPr["w:headerReference"] = [];
        }
        else if (!Array.isArray(sectPr["w:headerReference"])) {
            sectPr["w:headerReference"] = [sectPr["w:headerReference"]];
        }
        // Add the new header reference
        sectPr["w:headerReference"].push({
            $: {
                "r:id": relId,
                "w:type": "default",
            },
        });
        // Rebuild the XML with correct root
        const newDocXml = buildXml(docObj["w:document"], {
            rootName: "w:document", // ✅ Must always be w:document
            headless: false,
            pretty: true,
        });
        console.log(docObj);
        this.zip.addFile(docPath, newDocXml);
    }
}

class RootRelManager extends RelManager {
    constructor(zip, relsPath = RelsType.Root) {
        super(zip, relsPath);
    }
}

class Mdocxengine {
    constructor(zip) {
        this.zip = zip;
        this.rels = new RelManager(zip);
        this.contentTypes = new ContentTypesManager(zip);
        this.document = new DocumentManager(zip);
        this.footer = new FooterManager(zip);
        this.header = new HeaderManager(zip);
        this.rootRels = new RootRelManager(zip);
    }
    static async loadFromFile(path) {
        const zm = await ZipManager.loadFromFile(path);
        return new Mdocxengine(zm);
    }
    async saveToFile(path) {
        await this.zip.saveToFile(path);
    }
}

export { ContentTypesManager, DocumentManager, FooterManager, HeaderManager, RelManager, RootRelManager, ZipManager, Mdocxengine as default };
//# sourceMappingURL=index.esm.js.map
