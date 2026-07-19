import { describe, test, expect } from "vitest";
import path from "path";
import { ZipManager } from "./ZipManager";

const SAMPLE = path.resolve("samples/example.docx");

describe("ZipManager convenience readers on live instances", () => {
  test("getFileAsString works after loadFromFile", async () => {
    const zm = await ZipManager.loadFromFile(SAMPLE);
    expect(typeof zm.getFileAsString).toBe("function");
    const xml = zm.getFileAsString("word/document.xml");
    expect(xml).toContain("<w:document");
  });

  test("getFileAsBuffer + fileExists work after loadFromBuffer", async () => {
    const fromFile = await ZipManager.loadFromFile(SAMPLE);
    const buf = fromFile.toBuffer();
    const zm = await ZipManager.loadFromBuffer(buf);
    expect(zm.fileExists("word/document.xml")).toBe(true);
    expect(zm.fileExists("word/does-not-exist.xml")).toBe(false);
    const bytes = zm.getFileAsBuffer("word/document.xml");
    expect(Buffer.isBuffer(bytes)).toBe(true);
    expect(zm.getFileAsBuffer("missing.xml")).toBeNull();
    expect(zm.getFileAsString("missing.xml")).toBeNull();
  });

  test("new ZipManager(buffer) directly also has the readers", async () => {
    const buf = (await ZipManager.loadFromFile(SAMPLE)).toBuffer();
    const zm = new ZipManager(buf);
    expect(typeof zm.getFileAsString).toBe("function");
    expect(zm.getFileAsString("word/document.xml")).toContain("<w:document");
  });
});
