import AdmZip from "adm-zip";
import { beforeAll, describe, test, expect } from "vitest";
import Paragraph from ".";
import { Paragraph as ParagraphType } from "./types";
import { WordPath } from "@/constants";
import { buildXml, parseXml } from "@/utils/xmlUtils";
import { getParagraphsFromXmlFile } from "@/helpers/getParagraphsFromXml";
import { AI } from "tests/HeaderManager.spec";
import { Type } from "@google/genai";

describe("Pragraph class and fuctionality", () => {
  var paragraph: Paragraph;
  var zip: AdmZip;
  var parsedXml: ParagraphType;
  let someText = `<w:p w14:paraId="2AFCD0E0" w14:textId="77777777" w:rsidR="00FA6A43" w:rsidRPr="00323D04" w:rsidRDefault="00FA6A43" w:rsidP="0063714B">
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
    zip = new AdmZip("./samples/MEMOIRE-ABDELMADJID-Rev-1.03.docx");
    paragraph = await Paragraph.createFromXml(someText);
    paragraph.generateUniqueParaId(zip);
  });

  test("compare the xml text with extracted text from pragraph", () => {
    expect(paragraph.getText()).toBe(
      "selka, consiste en la récitation des soixante versets du Coran Au cours d’une nuit."
    );
  });
  test("try to edit a text with 'hamza' value inside paragraph", () => {
    paragraph.modifyText("hamza");
    expect(paragraph.paragraph["w:r"]?.[0]["w:t"]._).toBe("hamza");
  });

  test(
    "get document.xml and extract paragraphs data from it",
    async () => {
      let document = zip.readAsText(WordPath.Document);
      let docObj = await parseXml(document);
      let docContent: string[] = [];

      let paragraphs: ParagraphType[] = docObj["w:document"]["w:body"]["w:p"];
      paragraphs = paragraphs.filter((p) => p["w:r"]?.length !== undefined);

      for (let p of getParagraphsFromXmlFile(document)) {
        try {
          let content = await Paragraph.createFromXml(p);
          docContent.push(content.getText());
        } catch (error) {
          continue;
        }
      }
      let res = await AI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `
        explain what this theses talking for that create a conslusion and resmue in arabic language :
          ${docContent?.join()} 
      `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },
        },
      });
      console.table(res.text);
    },
    {
      timeout: 100000,
    }
  );
});
