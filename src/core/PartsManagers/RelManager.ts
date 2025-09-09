import { ZipManager } from '@/utils/ZipManager';
import { parseXml, buildXml } from '@/utils/xmlUtils';
import { RelsType } from '@/config/enums';



export class RelManager {
  zip: ZipManager;
  relsPath = RelsType.Document;
  ns = 'http://schemas.openxmlformats.org/package/2006/relationships';
  

  constructor(zip: ZipManager, relsPath = RelsType.Document) {
    this.zip = zip;
    this.relsPath = relsPath;
  }

  private async readRels(): Promise<any> {
    const xml = this.zip.getFileAsString(this.relsPath);
    if (!xml) {
      return {$: { xmlns: this.ns } };
    }
    return await parseXml(xml);
  }

  private async writeRels(obj: any) {
    const xml = buildXml(obj, {
      rootName : "Relationships"
    });
    this.zip.addFile(this.relsPath, xml);
  }

  /**
   * Adds a relationship entry: Id must be unique (caller responsible).
   * target should be relative to 'word/' (e.g. 'header1.xml' or 'media/image1.png')
   */
  async addRelationship(id: string, type: string, target: string) {
    const relsObj = await this.readRels();
    // ensure array structure
    const rels = relsObj;
    
    
    if (!relsObj.Relationships) {
      rels.Relationship = [];
    } else if (!Array.isArray(rels.Relationships.Relationship)) {
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
  async genId(prefix = 'rId'): Promise<string> {
    const xml = this.zip.getFileAsString(this.relsPath);
    if (!xml) return `${prefix}1`;
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
        if (n > max) max = n;
      }
    }
    return `${prefix}${max + 1}`;
  }
}
