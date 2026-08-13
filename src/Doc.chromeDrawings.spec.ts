import { describe, test, expect } from "vitest";
import path from "path";
import { Doc } from "./Doc";

const INPUT = path.resolve("samples/example.docx");

// 1×1 transparent PNG — stands in for the full-page frame artwork.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const read = (doc: Doc, name: string) => doc.engine.zip.getFileAsString(name) ?? "";
const headerPartFor = async (doc: Doc, sectionIndex = 0) => {
  const entries = await doc.engine.sections.getSections();
  const relId = entries[sectionIndex]?.headerRefs.find((h) => h.type === "default")?.relId;
  if (!relId) return null;
  const target = await doc.engine.rels.getTarget(relId);
  return target ? (target.startsWith("word/") ? target : `word/${target}`) : null;
};

/** A full-page decorative frame: an anchored, behind-text picture — the shape an
 *  Algerian thesis cover uses, and the one that used to be destroyed on edit. */
const anchoredFrame = (token: string) =>
  `<w:p><w:r><w:drawing><wp:anchor behindDoc="1" distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251659264" locked="0" layoutInCell="1" allowOverlap="1">` +
  `<wp:simplePos x="0" y="0"/>` +
  `<wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH>` +
  `<wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV>` +
  `<wp:extent cx="7550785" cy="10668000"/><wp:wrapNone/><wp:docPr id="9" name="Frame"/>` +
  `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
  `<pic:pic><pic:nvPicPr><pic:cNvPr id="9" name="Frame"/><pic:cNvPicPr/></pic:nvPicPr>` +
  `<pic:blipFill><a:blip r:embed="${token}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
  `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="7550785" cy="10668000"/></a:xfrm>` +
  `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
  `</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;

/** Put a section's header into the state the real thesis is in: a frame picture
 *  embedded in the header part's own relationships. */
async function giveSectionAFramedHeader(doc: Doc): Promise<string> {
  await doc.applySectionChrome(0, {
    header: { xml: anchoredFrame("__HFIMG_0__"), images: [{ token: "__HFIMG_0__", bytes: PNG, ext: "png" }] },
  });
  const partPath = await headerPartFor(doc);
  expect(partPath).toBeTruthy();
  return partPath!;
}

describe("setSectionHeader — decorative artwork survives a text edit", () => {
  test("keeps the anchored frame, and its image still resolves in the NEW part", async () => {
    const doc = await Doc.open(INPUT);
    await giveSectionAFramedHeader(doc);

    await doc.setSectionHeader(0, "Chapter One");

    const newPart = await headerPartFor(doc);
    expect(newPart).toBeTruthy();
    const xml = read(doc, newPart!);

    // The text the caller asked for is there…
    expect(xml).toContain("Chapter One");
    // …and so is the frame, still anchored behind the page.
    expect(xml).toContain("<wp:anchor");
    expect(xml).toContain('behindDoc="1"');
    expect(xml).toContain('cx="7550785"');

    // The blip must resolve against the NEW part's own _rels — a carried-over id
    // from the old part is exactly what makes Word show a repair prompt.
    const embed = xml.match(/r:embed="([^"]+)"/)?.[1];
    expect(embed).toBeTruthy();
    const partRels = read(doc, `word/_rels/${newPart!.replace(/^word\//, "")}.rels`);
    expect(partRels).toContain(`Id="${embed}"`);
    const target = partRels.match(new RegExp(`Id="${embed}"[^>]*Target="([^"]+)"`))?.[1];
    expect(target).toBeTruthy();
    expect(doc.engine.zip.getEntry(`word/${target!.replace(/^\/+/, "")}`)).toBeTruthy();
  });

  test("clearing the header text still keeps the frame", async () => {
    const doc = await Doc.open(INPUT);
    await giveSectionAFramedHeader(doc);

    await doc.setSectionHeader(0, "");

    const xml = read(doc, (await headerPartFor(doc))!);
    expect(xml).toContain("<wp:anchor");
    expect(xml).toMatch(/r:embed="[^"]+"/);
  });

  test("a plain text header is unchanged — nothing is invented", async () => {
    const doc = await Doc.open(INPUT);
    await doc.setSectionHeader(0, "First");
    await doc.setSectionHeader(0, "Second");

    const xml = read(doc, (await headerPartFor(doc))!);
    expect(xml).toContain("Second");
    expect(xml).not.toContain("First");
    expect(xml).not.toContain("<w:drawing");
  });

  test("the frame is READABLE off the section — geometry, not just presence", async () => {
    const doc = await Doc.open(INPUT);
    await giveSectionAFramedHeader(doc);

    const [s] = await doc.sections();
    expect(s!.headerDrawings).toHaveLength(1);
    const d = s!.headerDrawings[0]!;

    expect(d.image).toMatch(/^image\d+\.png$/); // resolved via the part's OWN rels
    expect(d.anchored).toBe(true);
    expect(d.behindDoc).toBe(true);
    expect(d.wrap).toBe("none");
    expect(d.extent).toEqual({ cxEmu: 7550785, cyEmu: 10668000 });
    expect(d.posH).toEqual({ relativeTo: "page", offsetEmu: 0, align: null });
    expect(d.posV).toEqual({ relativeTo: "page", offsetEmu: 0, align: null });
  });

  test("a header carrying ONLY artwork still reports the drawing (text is empty)", async () => {
    // The real failure: the cover frame's part has no <w:t> at all, so anything
    // that gates on header text decides the page has no header and draws nothing.
    const doc = await Doc.open(INPUT);
    await giveSectionAFramedHeader(doc);

    const [s] = await doc.sections();
    expect(s!.headerText).toBe("");
    expect(s!.headerDrawings.length).toBeGreaterThan(0);
  });

  test("setSectionFooter preserves footer artwork the same way", async () => {
    const doc = await Doc.open(INPUT);
    await doc.applySectionChrome(0, {
      footer: { xml: anchoredFrame("__HFIMG_0__"), images: [{ token: "__HFIMG_0__", bytes: PNG, ext: "png" }] },
    });
    const entriesBefore = await doc.engine.sections.getSections();
    expect(entriesBefore[0]?.footerRefs.find((f) => f.type === "default")).toBeTruthy();

    await doc.setSectionFooter(0, { text: "Academic year 2025-2026", pageNumbers: true });

    const entries = await doc.engine.sections.getSections();
    const relId = entries[0]!.footerRefs.find((f) => f.type === "default")!.relId;
    const target = await doc.engine.rels.getTarget(relId);
    const xml = read(doc, target!.startsWith("word/") ? target! : `word/${target}`);

    expect(xml).toContain("Academic year 2025-2026");
    expect(xml).toContain("<wp:anchor");
    expect(xml).toMatch(/r:embed="[^"]+"/);
  });
});
