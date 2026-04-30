import * as XmlUtils from "@/utils/xmlUtils";
import AdmZip from "adm-zip";

const CORE_PATH = "docProps/core.xml";
const APP_PATH = "docProps/app.xml";

export interface CoreProperties {
  title?: string;
  subject?: string;
  creator?: string;
  description?: string;
  lastModifiedBy?: string;
  created?: string;
  modified?: string;
}

export interface AppProperties {
  application?: string;
  pages?: number;
  words?: number;
  characters?: number;
}

export class MetadataManager {
  private zip: AdmZip;

  constructor(zip: AdmZip) {
    this.zip = zip;
  }

  // ─── Core properties (docProps/core.xml) ──────────────────────────────────

  /**
   * Reads core document properties.
   */
  public async getCoreProperties(): Promise<CoreProperties> {
    const xml = this.zip.readAsText(CORE_PATH);
    if (!xml) return {};

    const obj = await XmlUtils.parseXml(xml);
    const cp = obj["cp:coreProperties"] ?? obj;

    return {
      title: cp["dc:title"] ?? undefined,
      subject: cp["dc:subject"] ?? undefined,
      creator: cp["dc:creator"] ?? undefined,
      description: cp["dc:description"] ?? undefined,
      lastModifiedBy: cp["cp:lastModifiedBy"] ?? undefined,
      created: cp["dcterms:created"]?._ ?? cp["dcterms:created"] ?? undefined,
      modified: cp["dcterms:modified"]?._ ?? cp["dcterms:modified"] ?? undefined,
    };
  }

  /**
   * Updates core document properties. Merges with existing values.
   */
  public async setCoreProperties(props: CoreProperties): Promise<void> {
    const xml = this.zip.readAsText(CORE_PATH);
    const obj = xml ? await XmlUtils.parseXml(xml) : { "cp:coreProperties": {} };
    const cp = obj["cp:coreProperties"] ?? obj;

    if (props.title !== undefined) cp["dc:title"] = props.title;
    if (props.subject !== undefined) cp["dc:subject"] = props.subject;
    if (props.creator !== undefined) cp["dc:creator"] = props.creator;
    if (props.description !== undefined) cp["dc:description"] = props.description;
    if (props.lastModifiedBy !== undefined) cp["cp:lastModifiedBy"] = props.lastModifiedBy;
    if (props.created !== undefined) {
      cp["dcterms:created"] = {
        _: props.created,
        $: { "xsi:type": "dcterms:W3CDTF" },
      };
    }
    if (props.modified !== undefined) {
      cp["dcterms:modified"] = {
        _: props.modified,
        $: { "xsi:type": "dcterms:W3CDTF" },
      };
    }

    const newXml = XmlUtils.buildXml(cp, {
      rootName: "cp:coreProperties",
      headless: false,
      pretty: true,
    });
    this.zip.addFile(CORE_PATH, Buffer.from(newXml, "utf-8"));
  }

  // ─── App properties (docProps/app.xml) ────────────────────────────────────

  /**
   * Reads application properties.
   */
  public async getAppProperties(): Promise<AppProperties> {
    const xml = this.zip.readAsText(APP_PATH);
    if (!xml) return {};

    const obj = await XmlUtils.parseXml(xml);
    const ap = obj["Properties"] ?? obj;

    return {
      application: ap["Application"] ?? undefined,
      pages: ap["Pages"] ? Number(ap["Pages"]) : undefined,
      words: ap["Words"] ? Number(ap["Words"]) : undefined,
      characters: ap["Characters"] ? Number(ap["Characters"]) : undefined,
    };
  }

  /**
   * Updates application properties. Merges with existing values.
   */
  public async setAppProperties(props: AppProperties): Promise<void> {
    const xml = this.zip.readAsText(APP_PATH);
    const obj = xml ? await XmlUtils.parseXml(xml) : { Properties: {} };
    const ap = obj["Properties"] ?? obj;

    if (props.application !== undefined) ap["Application"] = props.application;
    if (props.pages !== undefined) ap["Pages"] = String(props.pages);
    if (props.words !== undefined) ap["Words"] = String(props.words);
    if (props.characters !== undefined) ap["Characters"] = String(props.characters);

    const newXml = XmlUtils.buildXml(ap, {
      rootName: "Properties",
      headless: false,
      pretty: true,
    });
    this.zip.addFile(APP_PATH, Buffer.from(newXml, "utf-8"));
  }
}
