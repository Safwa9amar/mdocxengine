import { getDocxFiles } from "@/helpers/getDocxFiles";
import { HeaderManager, Mdocxengine, ZipManager } from "@/index";
import { parseXml } from "@/utils/xmlUtils";
import { describe, test, beforeAll, expect, it, afterAll } from "vitest";
import { headerFile } from "@/config/docxPaths";
let zip: ZipManager;
let header: HeaderManager;

describe("HeaderManager", () => {
  // ✅ Load resources before tests
  beforeAll(async () => {
    zip = await ZipManager.loadFromFile("./samples/example.docx");
    header = new HeaderManager(zip);
  });

  // ✅ Actual test goes inside `test` or `it`
  test("should add a simple header", async () => {
    let text = "hassani hammza";
    const { headerPath, relId, headerXml } = await header.addHeaderSimple("hamza hassani");
    // Save the output if needed
    await zip.saveToFile(`./samples/outputs/added-header-is-${text}.docx`);
    // Proper assertion
    expect(typeof headerPath).toBe("string");
    expect(headerPath).toContain("header");
    expect(relId).toBeDefined();
    expect(headerXml).toBeDefined();
  });
});

describe.skip("try to get all headers content from docx file", async () => {
  let docxPath: string;
  let zip: ZipManager;
  let engine: Mdocxengine;

  // let xml = await parseXml(header);
  // console.log(xml["w:hdr"]["w:p"]);
  type fileType = {
    fileName: string;
    xml: string;
  };
  let count: number = 0;
  let files: fileType[] = [];

  beforeAll(async () => {
    docxPath = "./samples/MEMOIRE-ABDELMADJID-Rev-1.03.docx";
    engine = await Mdocxengine.loadFromFile(docxPath);
    zip = engine.zip;
  });
  test("check if header content is xml", async () => {
    let entries = zip.getEntries();

    entries.forEach((el: string) => {
      if (el.startsWith("word/header")) {
        count++;
        let filename: headerFile = `word/header${count}.xml`;
        let file = zip.getFileAsString(filename);
        file
          ? files.push({
              fileName: filename,
              xml: file,
            })
          : console.log("not file");
      }
    });

    files.forEach(async (file) => {
      expect(file.fileName).toMatch(/^word\/header\d+\.xml$/);
      let xml = await parseXml(file.xml);
      expect(xml["w:hdr"]).toBeDefined();
      expect(xml).toBeDefined();
    });
  });
});
