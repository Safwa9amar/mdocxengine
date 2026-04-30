import * as XmlUtils from "@/utils/xmlUtils";
import AdmZip from "adm-zip";

const STYLES_PATH = "word/styles.xml";

export interface StyleEntry {
  id: string;
  name: string;
  type: string;
}

export class StylesManager {
  private zip: AdmZip;

  constructor(zip: AdmZip) {
    this.zip = zip;
  }

  private async readStyles(): Promise<any> {
    const xml = this.zip.readAsText(STYLES_PATH);
    if (!xml) return { "w:styles": { "w:style": [] } };
    return XmlUtils.parseXml(xml);
  }

  private async writeStyles(obj: any): Promise<void> {
    const xml = XmlUtils.buildXml(obj["w:styles"], {
      rootName: "w:styles",
      headless: false,
      pretty: true,
    });
    this.zip.addFile(STYLES_PATH, Buffer.from(xml, "utf-8"));
  }

  private normalizeStylesArray(obj: any): any[] {
    const raw = obj?.["w:styles"]?.["w:style"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  /**
   * Lists all styles in the document.
   */
  public async listStyles(): Promise<StyleEntry[]> {
    const obj = await this.readStyles();
    return this.normalizeStylesArray(obj).map((s: any) => ({
      id: s.$?.["w:styleId"] ?? "",
      name: s["w:name"]?.$?.["w:val"] ?? "",
      type: s.$?.["w:type"] ?? "",
    }));
  }

  /**
   * Returns the raw style object for a given style ID, or null.
   */
  public async getStyle(styleId: string): Promise<any | null> {
    const obj = await this.readStyles();
    return (
      this.normalizeStylesArray(obj).find((s: any) => s.$?.["w:styleId"] === styleId) ?? null
    );
  }

  /**
   * Adds a new style. Does nothing if a style with the same ID already exists.
   */
  public async addStyle(styleObj: any): Promise<void> {
    const obj = await this.readStyles();
    const styles = this.normalizeStylesArray(obj);
    const id = styleObj.$?.["w:styleId"];

    if (id && styles.some((s: any) => s.$?.["w:styleId"] === id)) return;

    styles.push(styleObj);
    obj["w:styles"]["w:style"] = styles;
    await this.writeStyles(obj);
  }

  /**
   * Removes a style by ID.
   */
  public async removeStyle(styleId: string): Promise<void> {
    const obj = await this.readStyles();
    const styles = this.normalizeStylesArray(obj);
    obj["w:styles"]["w:style"] = styles.filter(
      (s: any) => s.$?.["w:styleId"] !== styleId,
    );
    await this.writeStyles(obj);
  }
}
