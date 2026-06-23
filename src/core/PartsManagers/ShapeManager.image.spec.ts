import { describe, test, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import { MediaManager } from "./MediaManager";
import { ShapeManager } from "./ShapeManager";

// 1x1 transparent PNG
const B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function makeZip(): AdmZip {
  const zip = new AdmZip();
  zip.addFile(
    "[Content_Types].xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
      "utf-8",
    ),
  );
  zip.addFile(
    "word/_rels/document.xml.rels",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
      "utf-8",
    ),
  );
  zip.addFile(
    "word/document.xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
  <w:body>
    <w:p><w:r><w:t>Hello</w:t></w:r></w:p>
  </w:body>
</w:document>`,
      "utf-8",
    ),
  );
  return zip;
}

describe("ShapeManager.insertImage", () => {
  let zip: AdmZip;
  let media: MediaManager;
  let shapes: ShapeManager;

  beforeEach(() => {
    zip = makeZip();
    media = new MediaManager(zip);
    shapes = new ShapeManager(zip);
  });

  test("inserts an inline picture referencing a registered image relId", async () => {
    const png = Buffer.from(B64, "base64");
    const { relId, imagePath } = await media.insertImage(png, "png");
    expect(relId).toBeTruthy();
    expect(imagePath).toBe("word/media/image1.png");

    const id = await shapes.insertImage(relId, { width: 2_000_000, height: 1_500_000 });
    expect(id).toBeGreaterThan(0);

    // ── document.xml references the picture ──
    const docXml = zip.readAsText("word/document.xml");
    expect(docXml).toContain("wp:inline");
    expect(docXml).toContain("pic:pic");
    // r:embed must carry the relId (quoting may be ' or " depending on serializer)
    expect(docXml).toMatch(/r:embed=["'].*?["']/);
    expect(docXml).toContain(relId);
    // relId should sit on the a:blip (i.e. near the blip element)
    const blipIdx = docXml.indexOf("a:blip");
    const relIdx = docXml.indexOf(relId, blipIdx);
    expect(blipIdx).toBeGreaterThanOrEqual(0);
    expect(relIdx).toBeGreaterThan(blipIdx);
    // xmlns:pic declared so pic:* prefix resolves
    expect(docXml).toContain("xmlns:pic");
    // extent carries the requested EMU size
    expect(docXml).toContain('cx="2000000"');
    expect(docXml).toContain('cy="1500000"');

    // ── relationship resolves to the media file ──
    const relsXml = zip.readAsText("word/_rels/document.xml.rels");
    expect(relsXml).toContain(`Id="${relId}"`);
    const relLine = relsXml
      .split(/<Relationship\b/)
      .find((seg) => seg.includes(`Id="${relId}"`));
    expect(relLine).toBeDefined();
    expect(relLine).toContain("media/");
    expect(relLine).toContain("image1.png");

    // ── content type Default registered for png ──
    const ctXml = zip.readAsText("[Content_Types].xml");
    expect(ctXml).toMatch(/Extension="png"/);
    expect(ctXml).toContain("image/png");
  });
});
