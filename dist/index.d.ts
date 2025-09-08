import AdmZip from 'adm-zip';
import { RelsType } from 'config/enums';

declare class ZipManager {
    zip: AdmZip;
    constructor(zip?: AdmZip);
    static loadFromFile(filePath: string): Promise<ZipManager>;
    getFileAsBuffer(entryName: string): Buffer | null;
    getFileAsString(entryName: string): string | null;
    fileExists(entryName: string): boolean;
    addFile(entryName: string, content: string | Buffer): void;
    removeFile(entryName: string): void;
    getEntries(): string[];
    saveToFile(filePath: string): Promise<void>;
    toBuffer(): Buffer;
}

declare class ContentTypesManager {
    private readonly zip;
    private readonly filePath;
    private readonly ns;
    constructor(zip: ZipManager);
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

declare class DocumentManager {
    zip: ZipManager;
    constructor(zip: ZipManager);
}

declare class FooterManager {
    zip: ZipManager;
    constructor(zip: ZipManager);
}

declare class RelManager {
    zip: ZipManager;
    relsPath: RelsType;
    ns: string;
    constructor(zip: ZipManager, relsPath?: RelsType);
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

declare class HeaderManager {
    zip: ZipManager;
    rels: RelManager;
    contentTypes: ContentTypesManager;
    constructor(zip: ZipManager);
    /**
     * Add a simple header part and register it in [Content_Types].xml
     */
    addHeaderSimple(text: string): Promise<void | {
        headerPath: string;
        relId: string;
    }>;
    private addHeaderReferenceToDocument;
}

declare class RootRelManager extends RelManager {
    constructor(zip: ZipManager, relsPath?: RelsType);
}

declare class Mdocxengine {
    zip: ZipManager;
    rels: RelManager;
    contentTypes: ContentTypesManager;
    document: DocumentManager;
    footer: FooterManager;
    header: HeaderManager;
    rootRels: RootRelManager;
    private constructor();
    static loadFromFile(path: string): Promise<Mdocxengine>;
    saveToFile(path: string): Promise<void>;
}

export { ContentTypesManager, DocumentManager, FooterManager, HeaderManager, RelManager, RootRelManager, ZipManager, Mdocxengine as default };
