import { describe, test, expect } from "vitest";
import path from "path";
import { Doc } from "./Doc";

const INPUT = path.resolve("samples/unformatted.docx");
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("Doc facade", () => {
  test("open + read text/words", async () => {
    const doc = await Doc.open(INPUT);
    expect((await doc.text()).length).toBeGreaterThan(0);
    expect(await doc.wordCount()).toBeGreaterThan(0);
  });

  test("addHeading/addParagraph append and are readable back; outline reflects headings", async () => {
    const doc = await Doc.open(INPUT);
    const before = (await doc.blocks()).length;
    await doc.addHeading("My New Chapter", 1);
    await doc.addParagraph("A new body paragraph.", { alignment: "both" });
    const blocks = await doc.blocks();
    expect(blocks.length).toBe(before + 2);

    const heading = blocks[blocks.length - 2];
    expect(heading.headingLevel).toBe(1);
    expect(heading.text).toBe("My New Chapter");
    expect(blocks[blocks.length - 1].text).toBe("A new body paragraph.");

    const outline = await doc.outline();
    expect(outline.some((n) => n.title === "My New Chapter" && n.level === 1)).toBe(true);
  });

  test("editParagraph replaces text at index", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addParagraph("original");
    const idx = (await doc.blocks()).length - 1;
    await doc.editParagraph(idx, "edited");
    expect((await doc.blocks())[idx].text).toBe("edited");
  });

  test("addTable + editTableCell + tables() round-trip", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addTable([["H1", "H2"], ["a", "b"]], { header: true });
    const tableBlock = (await doc.blocks()).findIndex((b) => b.kind === "table");
    expect(tableBlock).toBeGreaterThanOrEqual(0);
    await doc.editTableCell(tableBlock, 1, 0, "EDITED");
    const tables = await doc.tables();
    const mine = tables.find((t) => t.index === tableBlock)!;
    expect(mine.rows[0]).toEqual(["H1", "H2"]);
    expect(mine.rows[1][0]).toBe("EDITED");
  });

  test("addImage embeds and images() reads it back", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addImage(PNG_1x1, { format: "png", width: 96, height: 48 });
    const imgs = await doc.images();
    expect(imgs.length).toBeGreaterThanOrEqual(1);
    const last = imgs[imgs.length - 1];
    expect(last.mime).toBe("image/png");
    expect(last.widthPx).toBe(96);
    expect(last.bytes.equals(PNG_1x1)).toBe(true);
  });

  test("replaceText fills a token", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addParagraph("Hello {{name}}!");
    await doc.replaceText("{{name}}", "Ada");
    expect(await doc.text()).toContain("Hello Ada!");
  });

  test("describe() + toMarkdownMap() produce an accurate map", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addHeading("Mapped Heading", 2);
    const map = await doc.describe();
    console.log(map);
    
    expect(map.counts.headings).toBeGreaterThanOrEqual(1);
    expect(map.wordCount).toBeGreaterThan(0);
    expect(map.page.width).toBeGreaterThan(0);
    const md = await doc.toMarkdownMap();
    expect(md).toContain("— map");
    expect(md).toContain("Outline");
    expect(md).toContain("Mapped Heading");
  });

  test("toBuffer round-trips through Doc.open", async () => {
    const doc = await Doc.open(INPUT);
    await doc.addParagraph("persisted");
    const buf = doc.toBuffer();
    const reopened = await Doc.open(buf);
    expect(await reopened.text()).toContain("persisted");
  });

  test("engine escape hatch is exposed", async () => {
    const doc = await Doc.open(INPUT);
    expect(doc.engine).toBeTruthy();
    expect(typeof doc.engine.document.getBlocks).toBe("function");
  });
});
