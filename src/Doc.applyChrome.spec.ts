import { describe, test, expect } from "vitest";
import path from "path";
import { Doc } from "./Doc";

const INPUT = path.resolve("samples/example.docx");

// 1×1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const headerFiles = (doc: Doc) =>
  doc.engine.zip.getEntries().map((e) => e.entryName).filter((n) => /^word\/header\d+\.xml$/.test(n));
const footerFiles = (doc: Doc) =>
  doc.engine.zip.getEntries().map((e) => e.entryName).filter((n) => /^word\/footer\d+\.xml$/.test(n));
const read = (doc: Doc, name: string) => doc.engine.zip.getFileAsString(name) ?? "";

// A minimal inline-image drawing whose r:embed carries a replaceable token.
const drawing = (token: string) =>
  `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">` +
  `<wp:extent cx="457200" cy="457200"/><wp:docPr id="1" name="logo"/>` +
  `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
  `<pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="logo"/><pic:cNvPicPr/></pic:nvPicPr>` +
  `<pic:blipFill><a:blip r:embed="${token}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
  `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="457200" cy="457200"/></a:xfrm>` +
  `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
  `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

describe("Doc.applySectionChrome — apply a compiled header/footer template", () => {
  test("embeds a logo into the header part's OWN _rels and wires the section", async () => {
    const doc = await Doc.open(INPUT);
    const before = new Set(headerFiles(doc));

    const { sectionIndex } = await doc.applySectionChrome(0, {
      header: {
        xml: `<w:p><w:r><w:t>Faculty of Sciences</w:t></w:r></w:p>${drawing("__HFIMG_0__")}`,
        images: [{ token: "__HFIMG_0__", bytes: PNG, ext: "png" }],
      },
    });
    expect(sectionIndex).toBeGreaterThanOrEqual(0);

    // Exactly one new header part was created.
    const added = headerFiles(doc).filter((n) => !before.has(n));
    expect(added.length).toBe(1);
    const hdrPath = added[0]; // e.g. "word/header2.xml"
    const hdrXml = read(doc, hdrPath);

    // The token was replaced with a real relationship id.
    expect(hdrXml).not.toContain("__HFIMG_0__");
    const embed = /r:embed="([^"]+)"/.exec(hdrXml);
    expect(embed).not.toBeNull();
    const relId = embed![1];

    // The header part has its OWN rels, with the image relationship the r:embed points to.
    const relsXml = read(doc, `word/_rels/${hdrPath.replace(/^word\//, "")}.rels`);
    expect(relsXml).toContain(`Id="${relId}"`);
    expect(relsXml).toMatch(/Type="[^"]*\/image"/);
    expect(relsXml).toMatch(/Target="media\/image\d+\.png"/);

    // Content-type Default for png is registered, and the media bytes exist.
    expect(read(doc, "[Content_Types].xml")).toMatch(/Extension="png"/i);
    const mediaTarget = /Target="(media\/image\d+\.png)"/.exec(relsXml)![1];
    expect(doc.engine.zip.getEntry(`word/${mediaTarget}`)).not.toBeNull();

    // The section now references the header part.
    expect(read(doc, "word/document.xml")).toContain("w:headerReference");
  });

  test("applies a header + footer with no images (tables only) and wires both", async () => {
    const doc = await Doc.open(INPUT);
    const beforeH = new Set(headerFiles(doc));
    const beforeF = new Set(footerFiles(doc));

    await doc.applySectionChrome(0, {
      header: { xml: `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Title</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`, images: [] },
      footer: { xml: `<w:p><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p>`, images: [] },
    });

    const addedH = headerFiles(doc).filter((n) => !beforeH.has(n));
    const addedF = footerFiles(doc).filter((n) => !beforeF.has(n));
    expect(addedH.length).toBe(1);
    expect(addedF.length).toBe(1);
    expect(read(doc, addedH[0])).toContain("<w:tbl>");
    expect(read(doc, addedF[0])).toContain("PAGE");
    const docXml = read(doc, "word/document.xml");
    expect(docXml).toContain("w:headerReference");
    expect(docXml).toContain("w:footerReference");
    // No stray image rels part was created for image-less parts.
    expect(doc.engine.zip.getEntry(`word/_rels/${addedH[0].replace(/^word\//, "")}.rels`)).toBeNull();
  });
});
