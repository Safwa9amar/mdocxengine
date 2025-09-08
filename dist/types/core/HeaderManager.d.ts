import { ZipManager } from "../core/ZipManager";
import { RelManager } from "../core/RelManager";
import { ContentTypesManager } from "../core/ContentTypesManager";
export default class HeaderManager {
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
