import { describe, test, expect } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine, makeParagraphNode, type BodyBlock } from "../index";

/** Build a docx buffer whose body is exactly the given paragraphs (base = example.docx, 0 media). */
async function docWith(paragraphs: string[]): Promise<Buffer> {
  const e = await Mdocxengine.loadFromFile("samples/example.docx");
  await e.document.saveBlocks(paragraphs.map((p) => makeParagraphNode(p)));
  return e.zip.toBuffer();
}

/** Build a docx buffer whose body is exactly the given raw block xml strings. */
async function docWithBlocks(blocks: BodyBlock[]): Promise<Buffer> {
  const e = await Mdocxengine.loadFromFile("samples/example.docx");
  await e.document.saveBlocks(blocks);
  return e.zip.toBuffer();
}

function joinXml(blocks: { xml: string }[]): string {
  return blocks.map((b) => b.xml).join("");
}

describe("MergeManager.appendDocument — ordering & structure", () => {
  test("appends source body blocks after target blocks", async () => {
    const target = await Mdocxengine.loadFromBuffer(await docWith(["TARGET-A", "TARGET-B"]));
    const sourceBuf = await docWith(["SOURCE-X", "SOURCE-Y"]);

    await target.merge.appendDocument(sourceBuf);

    const xml = joinXml(await target.document.getBlocks());
    expect(xml).toContain("TARGET-A");
    expect(xml).toContain("SOURCE-X");
    expect(xml).toContain("SOURCE-Y");
    expect(xml.indexOf("TARGET-B")).toBeLessThan(xml.indexOf("SOURCE-X"));
  });

  test("leadingBlocks are inserted before the copied body", async () => {
    const target = await Mdocxengine.loadFromBuffer(await docWith(["TARGET-A"]));
    const sourceBuf = await docWith(["BODY-1"]);

    await target.merge.appendDocument(sourceBuf, {
      leadingBlocks: [makeParagraphNode("PART TITLE", "Heading1")],
    });

    const xml = joinXml(await target.document.getBlocks());
    expect(xml.indexOf("PART TITLE")).toBeLessThan(xml.indexOf("BODY-1"));
  });

  test("startOnNewPage prepends a page break before everything appended", async () => {
    const target = await Mdocxengine.loadFromBuffer(await docWith(["TARGET-A"]));
    const sourceBuf = await docWith(["BODY-1"]);

    await target.merge.appendDocument(sourceBuf, { startOnNewPage: true });

    const xml = joinXml(await target.document.getBlocks());
    expect(xml).toContain('w:type="page"');
    expect(xml.indexOf('w:type="page"')).toBeLessThan(xml.indexOf("BODY-1"));
  });
});

describe("MergeManager.appendDocument — media", () => {
  test("copies images and remaps r:embed so every rId resolves in the target", async () => {
    const sourceBuf = fs.readFileSync(path.resolve("samples/hanachi.docx")); // 4 media
    const target = await Mdocxengine.loadFromBuffer(await docWith(["TARGET-A"]));

    const before = target.media.listImages().length;
    await target.merge.appendDocument(sourceBuf);

    expect(target.media.listImages().length).toBeGreaterThan(before);

    const xml = joinXml(await target.document.getBlocks());
    const relsXml = target.zip.readAsText("word/_rels/document.xml.rels") ?? "";
    const embeds = [...xml.matchAll(/r:(?:embed|link)="([^"]+)"/g)].map((m) => m[1]);
    expect(embeds.length).toBeGreaterThan(0);
    for (const rId of embeds) {
      expect(relsXml).toContain(`Id="${rId}"`);
    }
  });
});

describe("MergeManager.appendDocument — footnotes", () => {
  test("copies footnote content and remaps the reference id", async () => {
    // Build a source doc that HAS a footnote and references it in the body.
    const e = await Mdocxengine.loadFromFile("samples/example.docx");
    const { id } = await e.footnotes.addFootnote("UNIQUE-FOOTNOTE-TEXT-ZZZ");
    const refBlock: BodyBlock = {
      kind: "paragraph",
      tag: "w:p",
      xml: `<w:p><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${id}"/></w:r></w:p>`,
    };
    await e.document.saveBlocks([makeParagraphNode("Body with a note"), refBlock]);
    const sourceBuf = e.zip.toBuffer();

    // Target already has its own footnote, so ids must NOT collide.
    const t = await Mdocxengine.loadFromBuffer(await docWith(["TARGET-A"]));
    await t.footnotes.addFootnote("TARGET-EXISTING-NOTE");
    const targetBuf = t.zip.toBuffer();

    const target = await Mdocxengine.loadFromBuffer(targetBuf);
    await target.merge.appendDocument(sourceBuf);

    const fns = await target.footnotes.getFootnotes();
    expect(fns.some((f) => f.text.includes("UNIQUE-FOOTNOTE-TEXT-ZZZ"))).toBe(true);

    // the copied reference in the body points at a footnote that exists
    const xml = joinXml(await target.document.getBlocks());
    const refIds = [...xml.matchAll(/<w:footnoteReference\b[^>]*\bw:id="([^"]+)"/g)].map((m) => m[1]);
    expect(refIds.length).toBeGreaterThan(0);
    const fnIds = new Set(fns.map((f) => String(f.id)));
    for (const rid of refIds) expect(fnIds.has(rid)).toBe(true);
  });
});

describe("MergeManager.appendDocument — equations & styles", () => {
  test("equations (m:oMath) survive verbatim", async () => {
    const omml =
      '<w:p><m:oMathPara><m:oMath><m:r><m:t>E=mc^2</m:t></m:r></m:oMath></m:oMathPara></w:p>';
    const sourceBuf = await docWithBlocks([{ kind: "other", tag: "w:p", xml: omml }]);

    const target = await Mdocxengine.loadFromBuffer(await docWith(["TARGET-A"]));
    await target.merge.appendDocument(sourceBuf);

    const xml = joinXml(await target.document.getBlocks());
    expect(xml).toContain("<m:t>E=mc^2</m:t>");
  });

  test("maps a source heading styleId to the target style by name", async () => {
    const srcXml =
      '<w:p><w:pPr><w:pStyle w:val="Titre1"/></w:pPr><w:r><w:t>Chapitre</w:t></w:r></w:p>';
    const sourceBuf = await docWithBlocks([{ kind: "paragraph", tag: "w:p", xml: srcXml }]);

    const target = await Mdocxengine.loadFromBuffer(await docWith(["TARGET-A"]));
    await target.merge.appendDocument(sourceBuf, { styleMap: { Titre1: "Heading1" } });

    const xml = joinXml(await target.document.getBlocks());
    expect(xml).toContain('w:val="Heading1"');
    expect(xml).not.toContain('w:val="Titre1"');
  });
});

describe("MergeManager.appendDocument — real-doc integration", () => {
  // Real combine direction: parts are merged INTO the base template (the target),
  // never the other way. Use an example-based target (round-trips cleanly) and a
  // media-rich source (hanachi, 4 images).
  test("merging a media-rich part into the base produces a re-openable buffer", async () => {
    const target = await Mdocxengine.loadFromBuffer(await docWith(["BASE-COVER"]));
    const partBuf = fs.readFileSync(path.resolve("samples/hanachi.docx"));

    await target.merge.appendDocument(partBuf, {
      startOnNewPage: true,
      leadingBlocks: [makeParagraphNode("APPENDED PART", "Heading1")],
    });

    const out = target.zip.toBuffer();
    expect(out.length).toBeGreaterThan(0);

    const reopened = await Mdocxengine.loadFromBuffer(out);
    const xml = joinXml(await reopened.document.getBlocks());
    expect(xml).toContain("APPENDED PART");
    expect(xml).toContain("BASE-COVER");
    // images came across and every embed resolves
    expect(reopened.media.listImages().length).toBeGreaterThan(0);
    const rels = reopened.zip.readAsText("word/_rels/document.xml.rels") ?? "";
    for (const rId of [...xml.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1])) {
      expect(rels).toContain(`Id="${rId}"`);
    }
  });
});
