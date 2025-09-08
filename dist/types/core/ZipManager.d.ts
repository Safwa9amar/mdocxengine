import AdmZip from 'adm-zip';
export declare class ZipManager {
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
