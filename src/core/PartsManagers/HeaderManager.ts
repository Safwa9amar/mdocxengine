import { ZipManager } from "../../utils/ZipManager";
import * as XmlUtils from "../../utils/xmlUtils";
import { RelManager } from "./RelManager";
import { ContentTypesManager } from "./ContentTypesManager";
import logger from "../../utils/Logger";

// HeaderManager.ts - auto generated file
export default class HeaderManager {
  zip: ZipManager;
  rels: RelManager;
  contentTypes: ContentTypesManager;

  constructor(zip: ZipManager) {
    this.zip = zip;
    this.rels = new RelManager(zip);
    this.contentTypes = new ContentTypesManager(zip);
  }
  /**
   * Add a simple header part and register it in [Content_Types].xml
   */
  async addHeaderSimple(text: string) :Promise<{headerPath:string ,  headerXml : string , relId : string }>  {
      // 1) Determine header name
      const headerPath = "word/header3.xml";
      const paragraph = XmlUtils.createWordParagraph(text);
      if (!paragraph || !paragraph["w:p"]) {
        throw new Error(
          "Failed to create Word paragraph. The text might be invalid."
        );
      }
      const headerObj = {
          $: {
            "xmlns:wpc": "http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas",
            "xmlns:cx": "http://schemas.microsoft.com/office/drawing/2014/chartex",
            "xmlns:cx1": "http://schemas.microsoft.com/office/drawing/2015/9/8/chartex",
            "xmlns:cx2": "http://schemas.microsoft.com/office/drawing/2015/10/21/chartex",
            "xmlns:cx3": "http://schemas.microsoft.com/office/drawing/2016/5/9/chartex",
            "xmlns:cx4": "http://schemas.microsoft.com/office/drawing/2016/5/10/chartex",
            "xmlns:cx5": "http://schemas.microsoft.com/office/drawing/2016/5/11/chartex",
            "xmlns:cx6": "http://schemas.microsoft.com/office/drawing/2016/5/12/chartex",
            "xmlns:cx7": "http://schemas.microsoft.com/office/drawing/2016/5/13/chartex",
            "xmlns:cx8": "http://schemas.microsoft.com/office/drawing/2016/5/14/chartex",
            "xmlns:mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
            "xmlns:aink": "http://schemas.microsoft.com/office/drawing/2016/ink",
            "xmlns:am3d": "http://schemas.microsoft.com/office/drawing/2017/model3d",
            "xmlns:o": "urn:schemas-microsoft-com:office:office",
            "xmlns:oel": "http://schemas.microsoft.com/office/2019/extlst",
            "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
            "xmlns:m": "http://schemas.openxmlformats.org/officeDocument/2006/math",
            "xmlns:v": "urn:schemas-microsoft-com:vml",
            "xmlns:wp14": "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing",
            "xmlns:wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
            "xmlns:w10": "urn:schemas-microsoft-com:office:word",
            "xmlns:w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
            "xmlns:w14": "http://schemas.microsoft.com/office/word/2010/wordml",
            "xmlns:w15": "http://schemas.microsoft.com/office/word/2012/wordml",
            "xmlns:w16cex": "http://schemas.microsoft.com/office/word/2018/wordml/cex",
            "xmlns:w16cid": "http://schemas.microsoft.com/office/word/2016/wordml/cid",
            "xmlns:w16": "http://schemas.microsoft.com/office/word/2018/wordml",
            "xmlns:w16sdtdh": "http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash",
            "xmlns:w16se": "http://schemas.microsoft.com/office/word/2015/wordml/symex",
            "xmlns:wpg": "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
            "xmlns:wpi": "http://schemas.microsoft.com/office/word/2010/wordprocessingInk",
            "xmlns:wne": "http://schemas.microsoft.com/office/word/2006/wordml",
            "xmlns:wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
            "mc:Ignorable": "w14 w15 w16se w16cid w16 w16cex w16sdtdh wp14"
          },
          "w:p": {
            $: {
              "w14:paraId": "37C962AE",
              "w14:textId": "7468B4DA",
              "w:rsidR": "005E6865",
              "w:rsidRPr": "00C80307",
              "w:rsidRDefault": "005E6865",
              "w:rsidP": "00C80307"
            },
            "w:pPr": {
              "w:pStyle": {
                $: { "w:val": "Header" }
              },
              "w:pBdr": {
                "w:bottom": {
                  $: {
                    "w:val": "single",
                    "w:sz": "24",
                    "w:space": "1",
                    "w:color": "1F4E79",
                    "w:themeColor": "accent1",
                    "w:themeShade": "80"
                  }
                }
              },
              "w:jc": {
                $: { "w:val": "right" }
              },
              "w:rPr": {
                "w:b": {},
                "w:bCs": {}
              }
            },
            "w:r": {
              $: { "w:rsidRPr": "005E6865" },
              "w:rPr": {
                "w:b": {},
                "w:bCs": {}
              },
              "w:t": text
            }
          }
      };
      
      const headerXml =  XmlUtils.buildXml(headerObj, {
        rootName : "w:hdr",
        headless: false,
        pretty: true,
      });


      this.zip.addFile(headerPath, headerXml);

      // 3) Add relationship
      const relId = await this.rels.genId();


      
      await this.rels.addRelationship(
        relId,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header",
        "header3.xml"
      );

      // 4) Update [Content_Types].xml
      await this.contentTypes.addOverride(
        "/word/header3.xml",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"
      );

      // 5) Add header reference in document.xml
      await this.addHeaderReferenceToDocument(relId);

      return { headerPath, relId ,headerXml};
   
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
    })
    
    this.zip.addFile(docPath, newDocXml);
  }
  
}
