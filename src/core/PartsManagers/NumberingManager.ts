import * as XmlUtils from "@/utils/xmlUtils";
import Paragraph from "@/core/files/paragraph/index";
import AdmZip from "adm-zip";

const NUMBERING_PATH = "word/numbering.xml";

export interface NumberingDefinition {
  abstractNumId: string;
  numId: string;
}

export class NumberingManager {
  private zip: AdmZip;

  constructor(zip: AdmZip) {
    this.zip = zip;
  }

  private async readNumbering(): Promise<any> {
    const xml = this.zip.readAsText(NUMBERING_PATH);
    if (!xml) return { "w:numbering": {} };
    return XmlUtils.parseXml(xml);
  }

  private async writeNumbering(obj: any): Promise<void> {
    const xml = XmlUtils.buildXml(obj["w:numbering"], {
      rootName: "w:numbering",
      headless: false,
      pretty: true,
    });
    this.zip.addFile(NUMBERING_PATH, Buffer.from(xml, "utf-8"));
  }

  /**
   * Returns all concrete numbering definitions (numId → abstractNumId).
   */
  public async getNumberingDefinitions(): Promise<NumberingDefinition[]> {
    const obj = await this.readNumbering();
    const raw = obj?.["w:numbering"]?.["w:num"];
    if (!raw) return [];
    const arr = Array.isArray(raw) ? raw : [raw];

    return arr.map((n: any) => ({
      numId: n.$?.["w:numId"] ?? "",
      abstractNumId: n["w:abstractNumId"]?.$?.["w:val"] ?? "",
    }));
  }

  /**
   * Applies numbering to a paragraph by setting <w:numPr> on its <w:pPr>.
   * @param paragraph  The Paragraph instance to modify.
   * @param numId      The concrete numId from numbering.xml.
   * @param ilvl       Indent level (0-based). Defaults to 0.
   */
  public applyNumbering(paragraph: Paragraph, numId: string, ilvl = 0): void {
    if (!paragraph.paragraph["w:pPr"]) {
      paragraph.paragraph["w:pPr"] = {};
    }
    paragraph.paragraph["w:pPr"]["w:numPr"] = {
      "w:ilvl": { $: { "w:val": String(ilvl) } },
      "w:numId": { $: { "w:val": numId } },
    };
  }

  /**
   * Removes numbering from a paragraph.
   */
  public removeNumbering(paragraph: Paragraph): void {
    if (paragraph.paragraph["w:pPr"]) {
      delete paragraph.paragraph["w:pPr"]["w:numPr"];
    }
  }

  /**
   * Adds a new concrete <w:num> definition referencing an abstract numbering ID.
   * @param numId         The new numId to use.
   * @param abstractNumId The abstractNumId to reference.
   */
  public async addNumberingDefinition(numId: string, abstractNumId: string): Promise<void> {
    const obj = await this.readNumbering();
    const numbering = obj["w:numbering"];

    if (!numbering["w:num"]) {
      numbering["w:num"] = [];
    } else if (!Array.isArray(numbering["w:num"])) {
      numbering["w:num"] = [numbering["w:num"]];
    }

    numbering["w:num"].push({
      $: { "w:numId": numId },
      "w:abstractNumId": { $: { "w:val": abstractNumId } },
    });

    await this.writeNumbering(obj);
  }
}
