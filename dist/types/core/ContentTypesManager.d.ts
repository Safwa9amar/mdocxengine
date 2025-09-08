import { ZipManager } from '../core/ZipManager';
export declare class ContentTypesManager {
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
