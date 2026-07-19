import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine } from "../index";
import { makeDrawingParagraphNode, nextDrawingId } from "../core/files/body/OrderedBody";

const INPUT = path.resolve("samples/example.docx");
// A tiny valid 1x1 PNG.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("engine reader APIs", () => {
  let engine: Mdocxengine;

  beforeAll(async () => {
    engine = await Mdocxengine.loadFromFile(INPUT);
  });

  test("zip convenience readers work on the live instance", () => {
    expect(engine.zip.getFileAsString("word/document.xml")).toContain("<w:document");
    expect(engine.zip.fileExists("word/document.xml")).toBe(true);
  });

  test("document.getPlainText and getWordCount return real content", async () => {
    const text = await engine.document.getPlainText();
    expect(text.length).toBeGreaterThan(0);
    const words = await engine.document.getWordCount();
    expect(words).toBeGreaterThan(0);
    expect(words).toBe(text.split(/\s+/).filter(Boolean).length);
  });

  test("RelManager exposes relationships and resolves a target", async () => {
    const rels = await engine.rels.getRelationships();
    expect(Array.isArray(rels)).toBe(true);
    if (rels.length) {
      const got = await engine.rels.getTarget(rels[0].id);
      expect(got).toBe(rels[0].target);
    }
    expect(await engine.rels.getTarget("rId-does-not-exist")).toBeNull();
  });

  test("media.extractInlineImage round-trips an inserted image", async () => {
    const { relId } = await engine.media.insertImage(PNG_1x1, "png");
    const blocks = await engine.document.getBlocks();
    const drawingId = nextDrawingId(engine.zip.getFileAsString("word/document.xml") ?? "");
    // EMU for a 96x48 px display box.
    const drawing = makeDrawingParagraphNode(relId, 96 * 9525, 48 * 9525, drawingId, "pic");
    await engine.document.saveBlocks([...blocks, drawing]);

    const withDrawing = (await engine.document.getBlocks()).find((b) => b.xml.includes("<w:drawing>"));
    expect(withDrawing).toBeTruthy();

    const img = await engine.media.extractInlineImage(withDrawing!.xml);
    expect(img).not.toBeNull();
    expect(img!.relId).toBe(relId);
    expect(img!.extension).toBe("png");
    expect(img!.mime).toBe("image/png");
    expect(img!.bytes.equals(PNG_1x1)).toBe(true);
    expect(img!.widthPx).toBe(96);
    expect(img!.heightPx).toBe(48);

    // getImageByRelId resolves the same bytes.
    const byRel = await engine.media.getImageByRelId(relId);
    expect(byRel!.equals(PNG_1x1)).toBe(true);
  });

  test("extractInlineImage returns null for a plain paragraph", async () => {
    expect(await engine.media.extractInlineImage("<w:p><w:r><w:t>no image</w:t></w:r></w:p>")).toBeNull();
  });
});
