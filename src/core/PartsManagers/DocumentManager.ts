import { ZipManager } from "@/utils/ZipManager";
import * as XmlUtils from "@/utils/xmlUtils";

// DocumentManager.ts - auto generated file
export default class DocumentManager {
  zip: ZipManager;
  constructor(zip: ZipManager) {
    this.zip = zip;
  }

  private async addHeaderReferenceToDocument(relId: string) {
    const docPath = "word/document.xml";
    const xml = this.zip.getFileAsString(docPath);
    if (!xml) return;

    const docObj = await XmlUtils.parseXml(xml);
    const doc = docObj["w:document"] || docObj.document;
    if (!doc) return;

    const body = doc["w:body"] || doc.body;
    if (!body) return;

    // Ensure <w:sectPr> exists
    if (!body["w:sectPr"]) {
      body["w:sectPr"] = {};
    }
    const sectPr = body["w:sectPr"];

    // Ensure <w:headerReference> is an array
    if (!sectPr["w:headerReference"]) {
      sectPr["w:headerReference"] = [];
    } else if (!Array.isArray(sectPr["w:headerReference"])) {
      sectPr["w:headerReference"] = [sectPr["w:headerReference"]];
    }

    // Add the new header reference
    sectPr["w:headerReference"].push({
      $: {
        "r:id": relId,
        "w:type": "default",
      },
    });

    // Rebuild the XML with correct root
    const newDocXml = XmlUtils.buildXml(docObj["w:document"], {
      rootName: "w:document", // ✅ Must always be w:document
      headless: false,
      pretty: true,
    });

    this.zip.addFile(docPath, newDocXml);
  }
}
