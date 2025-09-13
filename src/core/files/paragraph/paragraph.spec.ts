import AdmZip from "adm-zip";
import { beforeAll, describe, test, expect, afterAll } from "vitest";
import Paragraph from ".";
import { Paragraph as ParagraphType } from "./types";
import { WordPath } from "@/constants";
import { buildXml, parseXml } from "@/utils/xmlUtils";
import { getParagraphsFromXmlFile } from "@/helpers/getParagraphsFromXml";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const AI = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});
var paragraph: Paragraph;
var zip: AdmZip;

let someText = `<w:p >
<w:pPr>
  <w:rPr>
    <w:szCs w:val="24"/>
  </w:rPr>
</w:pPr>
<w:proofErr w:type="spellStart"/>
<w:proofErr w:type="spellEnd"/>
<w:r w:rsidRPr="00323D04">
  <w:t>selka</w:t>
</w:r>
<w:r w:rsidRPr="00323D04">
  <w:t>, consiste en la récitation des soixante versets du Coran Au cours d’une nuit</w:t>
</w:r>
<w:r w:rsidRPr="00323D04">
  <w:rPr>
    <w:szCs w:val="24"/>
  </w:rPr>
  <w:t>.</w:t>
</w:r>
</w:p>`;

beforeAll(async () => {
  zip = new AdmZip("./samples/ss.docx");
  paragraph = await Paragraph.createFromXml(someText);
});
describe("Pragraph class and fuctionality", () => {
  test("compare the xml text with extracted text from pragraph", () => {
    expect(paragraph.getText()).toBe(
      "selka, consiste en la récitation des soixante versets du Coran Au cours d’une nuit."
    );
  });
  test("try to edit a text with 'hamza' value inside paragraph", () => {
    paragraph.modifyText("hamza");
    expect(paragraph.paragraph["w:r"]?.[0]["w:t"]._).toBe("hamza");
  });

  test("get document.xml and extract paragraphs data from it", async () => {
    let docContent: string[] = [];
    let document = zip.readAsText(WordPath.Document);
    let extractedParagraphs = getParagraphsFromXmlFile(document);

    for (let p of extractedParagraphs) {
      try {
        let content = await Paragraph.createFromXml(p);
        docContent.push(content.getText());
      } catch (error) {
        continue;
      }
    }

    expect(extractedParagraphs?.length).greaterThan(0);
    expect(docContent?.length).greaterThan(0);

    // Usage

    const updatedXml = paragraph.insertParagraph(document, someText, 0);
    console.log(updatedXml);

    zip.updateFile(WordPath.Document, Buffer.from(updatedXml, "utf-8"));
    zip.writeZip("./samples/outputs/cc.docx");
  });
});
