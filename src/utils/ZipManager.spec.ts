// ZipManager.test.ts
import { ZipManager } from "@/index";
import { describe, test, beforeAll, expect, it } from "vitest";

describe("ZipManager - Load DOCX file", () => {
  let zip: ZipManager;

  beforeAll(async () => {
    zip = await ZipManager.loadFromFile("./samples/example.docx");
  });

  it("should load a DOCX file successfully", () => {
    expect(zip).toBeDefined();
    expect(typeof zip).toBe("object");
  });

  it("should contain document.xml inside the zip", async () => {
    const files = zip.getEntries(); // Assuming `ZipManager` has this method
    let doc = files.find((file) => file.startsWith("word/document.xml"));
    console.log(doc);
    expect(doc).toBe("word/document.xml");
  });
});
