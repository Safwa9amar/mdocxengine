// ZipManager.test.ts
import { ZipManager } from "../src/utils/ZipManager";
describe("ZipManager - Load DOCX file", () => {
  let zip: ZipManager;

  beforeAll(async () => {
    zip = await ZipManager.loadFromFile("./tests/samples.docx");
    console.log(zip); 
    
  });

  it("should load a DOCX file successfully", () => {
    expect(zip).toBeDefined();
    expect(typeof zip).toBe("object");
  });

  it("should contain document.xml inside the zip", async () => {
    const files = zip.getEntries(); // Assuming `ZipManager` has this method
    let doc = files.find(file => file.startsWith("word/document.xml"))
    console.log(doc);
    expect(doc).toBe("word/document.xml");
  });
});
