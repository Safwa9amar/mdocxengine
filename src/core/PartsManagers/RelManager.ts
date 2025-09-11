import { parseXml, buildXml } from "@/utils/xmlUtils";
import { RelsType } from "@/config/enums";
import AdmZip from "adm-zip";

export class RelManager {
  zip: AdmZip;
  relsPath = RelsType.Document;
  ns = "http://schemas.openxmlformats.org/package/2006/relationships";

  constructor(zip: AdmZip, relsPath = RelsType.Document) {
    this.zip = zip;
    this.relsPath = relsPath;
  }

  private async readRels(): Promise<any> {
    this.zip.readFile("");
    const xml = this.zip.readAsText(this.relsPath);
    if (!xml) {
      return { $: { xmlns: this.ns } };
    }
    return await parseXml(xml);
  }

  private async writeRels(obj: any) {
    const xml = buildXml(obj, {
      rootName: "Relationships",
    });

    this.zip.addFile(this.relsPath, Buffer.from(xml, "utf8"));
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
        Target: target,
      },
    });

    await this.writeRels(relsObj.Relationships);
  }

  /**
   * Quick helper to generate a new rId (checks existing ones)
   */
  async genId(prefix = "rId"): Promise<string> {
    const xml = this.zip.getEntry(this.relsPath);
    if (!xml) return `${prefix}1`;
    const relsObj = await parseXml(xml.getData().toString());
    const arr =
      relsObj.Relationships && relsObj.Relationships.Relationship
        ? Array.isArray(relsObj.Relationships.Relationship)
          ? relsObj.Relationships.Relationship
          : [relsObj.Relationships.Relationship]
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
