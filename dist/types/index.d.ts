import { ZipManager } from './core/ZipManager';
import { ContentTypesManager } from './core/ContentTypesManager';
import DocumentManager from './core/DocumentManager';
import FooterManager from './core/FooterManager';
import HeaderManager from './core/HeaderManager';
import RootRelManager from './core/RootRelManager';
import { RelManager } from './core/RelManager';
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
export default Mdocxengine;
export { ZipManager, RelManager, ContentTypesManager, DocumentManager, FooterManager, HeaderManager, RootRelManager };
