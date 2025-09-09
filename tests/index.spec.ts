import { Mdocxengine, ZipManager } from "@/index";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
let zip: ZipManager;
let entries: string[];
let engine: Mdocxengine;
describe("extract zip conent", async () => {
  beforeAll(async () => {
    engine = await Mdocxengine.loadFromFile("./samples/example.docx");
    zip = engine.zip;

    engine.header.addHeaderSimple(`hello worlds this is test from vitetest `);

    await zip.saveToFile("./samples/outputs/test-extract-zip-content.docx");
    zip = await ZipManager.loadFromFile("./samples/outputs/test-extract-zip-content.docx");
    entries = zip.getEntries();
  });

  test("check if entires > 0", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  afterAll(async () => {
    zip.zip.extractAllTo("./samples/extracted/test-extract-zip-content");
  });
});
