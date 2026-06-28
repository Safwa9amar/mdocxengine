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

describe("MergeManager.appendDocument — footnote fidelity (Phase 2)", () => {
  test("preserves rich footnote formatting verbatim (bold run survives)", async () => {
    const src = await Mdocxengine.loadFromFile("samples/example.docx");
    await src.footnotes.addFootnote("seed"); // registers footnotes.xml + content-type + rel
    // Overwrite footnotes.xml with a footnote carrying a bold run + unique marker.
    const customFootnotes =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
      `<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>` +
      `<w:footnote w:id="7"><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>BOLD-FN-MARKER-QQQ</w:t></w:r></w:p></w:footnote>` +
      `</w:footnotes>`;
    src.zip.addFile("word/footnotes.xml", Buffer.from(customFootnotes, "utf-8"));
    const refBlock: BodyBlock = {
      kind: "paragraph",
      tag: "w:p",
      xml: `<w:p><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="7"/></w:r></w:p>`,
    };
    await src.document.saveBlocks([refBlock]);
    const sourceBuf = src.zip.toBuffer();

    const target = await Mdocxengine.loadFromBuffer(await docWith(["TARGET-A"]));
    await target.merge.appendDocument(sourceBuf);

    const fnXml = target.zip.readAsText("word/footnotes.xml") ?? "";
    // The bold run + unique marker survived (text-copy would have dropped <w:b/>).
    expect(fnXml).toContain("BOLD-FN-MARKER-QQQ");
    expect(fnXml).toContain("<w:b/>");

    // The body reference resolves to an existing footnote id.
    const bodyXml = joinXml(await target.document.getBlocks());
    const refId = /<w:footnoteReference\b[^>]*\bw:id="([^"]+)"/.exec(bodyXml)?.[1];
    expect(refId).toBeTruthy();
    expect(fnXml).toContain(`w:id="${refId}"`);
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

describe("MergeManager.appendDocument — numbering (Phase 2)", () => {
  test("copies numbering definitions and remaps numId with no dangling chain", async () => {
    const sourceBuf = fs.readFileSync(path.resolve("samples/hanachi.docx")); // rich numbering, real list refs
    const target = await Mdocxengine.loadFromBuffer(await docWith(["TARGET-A"]));

    await target.merge.appendDocument(sourceBuf);

    const xml = joinXml(await target.document.getBlocks());
    const numXml = target.zip.readAsText("word/numbering.xml") ?? "";

    // The merged body still references list numIds.
    const bodyNumIds = [...xml.matchAll(/<w:numId\b[^>]*\bw:val="([^"]+)"/g)].map((m) => m[1]);
    expect(bodyNumIds.length).toBeGreaterThan(0);

    // Every referenced numId (except 0 = "remove list") resolves to a <w:num> def.
    const definedNumIds = new Set(
      [...numXml.matchAll(/<w:num\b[^>]*\bw:numId="([^"]+)"/g)].map((m) => m[1]),
    );
    for (const id of bodyNumIds) {
      if (id === "0") continue;
      expect(definedNumIds.has(id)).toBe(true);
    }

    // Every <w:num>'s abstractNumId reference resolves to a defined <w:abstractNum>.
    const absRefs = [...numXml.matchAll(/<w:abstractNumId\b[^>]*\bw:val="([^"]+)"/g)].map((m) => m[1]);
    const absDefs = new Set(
      [...numXml.matchAll(/<w:abstractNum\b[^>]*\bw:abstractNumId="([^"]+)"/g)].map((m) => m[1]),
    );
    expect(absRefs.length).toBeGreaterThan(0);
    for (const ref of absRefs) expect(absDefs.has(ref)).toBe(true);
  });
});

describe("MergeManager.appendDocument — hyperlinks (Phase 2)", () => {
  const HYPERLINK_TYPE =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";

  test("copies external hyperlink relationships and remaps r:id", async () => {
    // Build a source doc with an external hyperlink relationship + a body reference.
    const src = await Mdocxengine.loadFromFile("samples/example.docx");
    const hid = await src.rels.genId();
    await src.rels.addRelationship(hid, HYPERLINK_TYPE, "https://example.com/UNIQUE-LINK", "External");
    const hlBlock: BodyBlock = {
      kind: "paragraph",
      tag: "w:p",
      xml: `<w:p><w:hyperlink r:id="${hid}"><w:r><w:t>link</w:t></w:r></w:hyperlink></w:p>`,
    };
    await src.document.saveBlocks([hlBlock]);
    const sourceBuf = src.zip.toBuffer();

    const target = await Mdocxengine.loadFromBuffer(await docWith(["TARGET-A"]));
    await target.merge.appendDocument(sourceBuf);

    const xml = joinXml(await target.document.getBlocks());
    const relsXml = target.zip.readAsText("word/_rels/document.xml.rels") ?? "";

    const hlRid = /<w:hyperlink\b[^>]*\br:id="([^"]+)"/.exec(xml)?.[1];
    expect(hlRid).toBeTruthy();
    expect(relsXml).toContain(`Id="${hlRid}"`);
    expect(relsXml).toContain("https://example.com/UNIQUE-LINK");
    expect(relsXml).toMatch(/TargetMode="External"/);
  });
});

describe("MergeManager.appendDocument — full-fidelity combine (Phase 2)", () => {
  const HYPERLINK_TYPE =
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";

  // Build a synthetic part carrying a footnote (bold marker), an equation, and a hyperlink.
  async function richPartBuffer(): Promise<Buffer> {
    const src = await Mdocxengine.loadFromFile("samples/example.docx");
    await src.footnotes.addFootnote("seed");
    const footnotesXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>` +
      `<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>` +
      `<w:footnote w:id="5"><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>FN2-MARKER-WWW</w:t></w:r></w:p></w:footnote>` +
      `</w:footnotes>`;
    src.zip.addFile("word/footnotes.xml", Buffer.from(footnotesXml, "utf-8"));
    const hid = await src.rels.genId();
    await src.rels.addRelationship(hid, HYPERLINK_TYPE, "https://x.example/part-two", "External");
    await src.document.saveBlocks([
      {
        kind: "paragraph",
        tag: "w:p",
        xml: `<w:p><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="5"/></w:r></w:p>`,
      },
      {
        kind: "other",
        tag: "w:p",
        xml: "<w:p><m:oMathPara><m:oMath><m:r><m:t>a^2+b^2</m:t></m:r></m:oMath></m:oMathPara></w:p>",
      },
      {
        kind: "paragraph",
        tag: "w:p",
        xml: `<w:p><w:hyperlink r:id="${hid}"><w:r><w:t>see link</w:t></w:r></w:hyperlink></w:p>`,
      },
    ]);
    return src.zip.toBuffer();
  }

  test("two parts (media+numbering, then footnote+equation+hyperlink) all survive together", async () => {
    const target = await Mdocxengine.loadFromBuffer(await docWith(["COVER"]));

    // Part one: a real media + numbering doc.
    await target.merge.appendDocument(fs.readFileSync(path.resolve("samples/hanachi.docx")), {
      startOnNewPage: true,
      leadingBlocks: [makeParagraphNode("Part One", "Heading1")],
    });
    // Part two: synthetic footnote + equation + hyperlink.
    await target.merge.appendDocument(await richPartBuffer(), {
      startOnNewPage: true,
      leadingBlocks: [makeParagraphNode("Part Two", "Heading1")],
    });

    const out = target.zip.toBuffer();
    const reopened = await Mdocxengine.loadFromBuffer(out);
    const xml = joinXml(await reopened.document.getBlocks());
    const rels = reopened.zip.readAsText("word/_rels/document.xml.rels") ?? "";
    const numXml = reopened.zip.readAsText("word/numbering.xml") ?? "";
    const fnXml = reopened.zip.readAsText("word/footnotes.xml") ?? "";

    // Titles + page breaks
    expect(xml).toContain("Part One");
    expect(xml).toContain("Part Two");
    expect((xml.match(/w:type="page"/g) ?? []).length).toBeGreaterThanOrEqual(2);

    // Images survive and resolve
    expect(reopened.media.listImages().length).toBeGreaterThan(0);
    for (const rId of [...xml.matchAll(/r:embed="([^"]+)"/g)].map((m) => m[1])) {
      expect(rels).toContain(`Id="${rId}"`);
    }
    // Numbering chains resolve (no dangling numId)
    const definedNumIds = new Set([...numXml.matchAll(/<w:num\b[^>]*\bw:numId="([^"]+)"/g)].map((m) => m[1]));
    for (const id of [...xml.matchAll(/<w:numId\b[^>]*\bw:val="([^"]+)"/g)].map((m) => m[1])) {
      if (id !== "0") expect(definedNumIds.has(id)).toBe(true);
    }
    // Equation, footnote (bold), hyperlink all present
    expect(xml).toContain("<m:t>a^2+b^2</m:t>");
    expect(fnXml).toContain("FN2-MARKER-WWW");
    expect(fnXml).toContain("<w:b/>");
    expect(rels).toContain("https://x.example/part-two");
    expect(rels).toMatch(/TargetMode="External"/);
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
