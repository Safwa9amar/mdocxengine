import { getDocxFiles } from "@/helpers/getDocxFiles";
import { HeaderManager, Mdocxengine, ZipManager } from "@/index";
import { buildXml, parseXml } from "@/utils/xmlUtils";
import { describe, test, beforeAll, expect, it, afterAll } from "vitest";
import AdmZip from "adm-zip";
import fs from "fs";
import { buffer } from "stream/consumers";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import Paragraph from "@/core/files/paragraph";
dotenv.config();

let zip: AdmZip;
let header: HeaderManager;
let res;
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

describe("HeaderManager", () => {
  // ✅ Load resources before tests
  beforeAll(async () => {
    zip = new AdmZip("./samples/مذكرة فتيحة حساني.docx");
    header = new HeaderManager(zip);
    let header1 = await parseXml(header.headers[0].xml);

    let doc = zip.readAsText("word/document.xml");
    let regex = /<w:t>(.*?)<\/w:t>/g;
    let text = doc.match(regex)?.map((text) => text.replace("<w:t>", "").replace("</w:t>", ""));

    res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
         get all headres and main title from this txt ${text?.toString()} 
         than enhance headers and add chapters name and  nested numbring based on chapter and header , subheader  
         get only important and main titles, remove unnecessary title
         and create a table content based on all items
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

    fs.writeFile("data.txt", res.text || "", (res) => {
      console.log(res);
    });
    // console.log(text?.toString().length);
  }, 100000);

  // ✅ Actual test goes inside `test` or `it`
  test("should add a simple header", async () => {
    expect(header.headers.length).greaterThan(0);
  });
});
