import AdmZip from "adm-zip";
import { beforeAll, describe, test, expect } from "vitest";
import Paragraph from ".";
import { Paragraph as ParagraphType } from "./types";

describe("testing pragraph", () => {
  var paragraph: Paragraph;
  var zip: AdmZip;
  var parsedXml: ParagraphType;
  let someText = ` <w:p w14:paraId="096EA004" w14:textId="77777777" w:rsidR="00361621" w:rsidRPr="00361621" w:rsidRDefault="00361621" w:rsidP="00640C0A">
        <w:r w:rsidRPr="00361621">
        <w:t>Un site assez riche par des pratiques sociales mais un grand manque dans l’organisation des espaces et ces pratiques.</w:t>
        </w:r>
      </w:p>`;

  beforeAll(async () => {
    zip = new AdmZip("./samples/مذكرة فتيحة حساني.docx");
    paragraph = await Paragraph.createFromXml(someText);
    console.log(await paragraph.toXml());
  });
  test("try to edit a text with 'hamza' value inside paragraph", () => {
    paragraph.modifyText("hamza");
    expect(paragraph.paragraph["w:p"]["w:r"]?.["w:t"]).toBe("hamza");
  });
});
