import { Mdocxengine, ZipManager } from "@/index";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
let zip: ZipManager;
let entries: string[];
let engine: Mdocxengine;

enum Filename {
  first = "MEMOIRE-ABDELMADJID-Rev-1.03",
  second = "example",
}

type SamplesDir = "./samples";
type DocxPath<T extends SamplesDir, F extends Filename> = `${T}/${F}.docx`;

describe("extract zip conent", async () => {
  let docxPath: DocxPath<"./samples", Filename.first>;
  docxPath = "./samples/MEMOIRE-ABDELMADJID-Rev-1.03.docx";

  beforeAll(async () => {
    engine = await Mdocxengine.loadFromFile(docxPath);
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
