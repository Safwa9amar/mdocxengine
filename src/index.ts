import { ZipManager } from './utils/ZipManager';
import { ContentTypesManager } from './core/PartsManagers/ContentTypesManager';
import DocumentManager from './core/PartsManagers/DocumentManager';
import FooterManager from './core/PartsManagers/FooterManager';
import HeaderManager from './core/PartsManagers/HeaderManager';
import RootRelManager from './core/PartsManagers/RootRelManager';
import { RelManager } from './core/PartsManagers/RelManager';
 class Mdocxengine {
    zip: ZipManager;
    rels: RelManager;
    contentTypes: ContentTypesManager;
    document : DocumentManager
    footer : FooterManager
    header : HeaderManager
    rootRels : RootRelManager
  
    private constructor(zip: ZipManager) {
      this.zip = zip;
      this.rels = new RelManager(zip);
      this.contentTypes = new ContentTypesManager(zip);
      this.document = new DocumentManager(zip)
      this.footer = new FooterManager(zip)
      this.header = new HeaderManager(zip)
      this.rootRels = new RootRelManager(zip)
    }
  
    static async loadFromFile(path: string) {
      const zm = await ZipManager.loadFromFile(path);
      return new Mdocxengine(zm);
    }
  
    async saveToFile(path: string) {
      await this.zip.saveToFile(path);
    }
  

  }

  export default Mdocxengine

  export {
    ZipManager,
    RelManager,
    ContentTypesManager,
    DocumentManager,
    FooterManager,
    HeaderManager,
    RootRelManager
  };