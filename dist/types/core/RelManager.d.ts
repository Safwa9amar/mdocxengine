import { ZipManager } from './ZipManager';
import { RelsType } from 'config/enums';
export declare class RelManager {
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
