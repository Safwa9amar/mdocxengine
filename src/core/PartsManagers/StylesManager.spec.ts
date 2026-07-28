import { describe, test, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import { StylesManager, applyHeadingStyleToXml } from "./StylesManager";

const SAMPLE_STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
  </w:style>
</w:styles>`;

const HEADING_STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:rPr><w:color w:val="2E74B5"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="Heading 4"/><w:rPr><w:i w:val="true"/><w:iCs w:val="true"/><w:color w:val="2E74B5"/></w:rPr><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="Heading 5"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;

function makeZip(withStyles = true): AdmZip {
  const zip = new AdmZip();
  if (withStyles) {
    zip.addFile("word/styles.xml", Buffer.from(SAMPLE_STYLES_XML, "utf-8"));
  }
  return zip;
}

describe("StylesManager", () => {
  let sm: StylesManager;

  beforeEach(() => {
    sm = new StylesManager(makeZip());
  });

  test("listStyles() returns all styles", async () => {
    const styles = await sm.listStyles();
    expect(styles).toHaveLength(2);
    expect(styles.map((s) => s.id)).toContain("Normal");
    expect(styles.map((s) => s.id)).toContain("Heading1");
  });

  test("getStyle() returns the correct style object", async () => {
    const style = await sm.getStyle("Normal");
    expect(style).not.toBeNull();
    expect(style.$?.["w:styleId"]).toBe("Normal");
  });

  test("getStyle() returns null for unknown id", async () => {
    const style = await sm.getStyle("NonExistent");
    expect(style).toBeNull();
  });

  test("addStyle() inserts a new style", async () => {
    await sm.addStyle({
      $: { "w:styleId": "MyStyle", "w:type": "paragraph" },
      "w:name": { $: { "w:val": "My Style" } },
    });
    const styles = await sm.listStyles();
    expect(styles.map((s) => s.id)).toContain("MyStyle");
  });

  test("addStyle() is idempotent for existing styleId", async () => {
    await sm.addStyle({ $: { "w:styleId": "Normal", "w:type": "paragraph" }, "w:name": { $: { "w:val": "Normal" } } });
    const styles = await sm.listStyles();
    expect(styles.filter((s) => s.id === "Normal")).toHaveLength(1);
  });

  test("removeStyle() deletes the style", async () => {
    await sm.removeStyle("Normal");
    const styles = await sm.listStyles();
    expect(styles.map((s) => s.id)).not.toContain("Normal");
    expect(styles).toHaveLength(1);
  });

  test("listStyles() returns empty array when no styles.xml exists", async () => {
    const sm2 = new StylesManager(makeZip(false));
    const styles = await sm2.listStyles();
    expect(styles).toHaveLength(0);
  });

  test("setHeadingStyle() writes size/bold/color into Heading1..6 styles.xml and is readable back", async () => {
    const zip = new AdmZip();
    zip.addFile("word/styles.xml", Buffer.from(HEADING_STYLES_XML, "utf-8"));
    const sm2 = new StylesManager(zip);

    const result = await sm2.setHeadingStyle([1, 4, 5, 6], { fontSizePt: 18, bold: true, color: "000000" });
    expect(result.updatedLevels).toEqual([1, 4, 5]);
    expect(result.missingLevels).toEqual([6]);

    const out = zip.readAsText("word/styles.xml")!;
    const h1 = out.match(/<w:style\b[^>]*w:styleId="Heading1"[^>]*>[\s\S]*?<\/w:style>/)![0];
    expect(h1).toContain("<w:b/><w:bCs/>");
    expect(h1).toContain('<w:sz w:val="36"/><w:szCs w:val="36"/>');
    expect(h1).toContain('<w:color w:val="000000"/>');

    // Heading4 keeps its unrelated <w:i/> while color/bold/size are rewritten.
    const h4 = out.match(/<w:style\b[^>]*w:styleId="Heading4"[^>]*>[\s\S]*?<\/w:style>/)![0];
    expect(h4).toContain('<w:i w:val="true"/>');
    expect(h4).toContain("<w:b/><w:bCs/>");
    expect(h4).toContain('<w:color w:val="000000"/>');

    // Heading5 had no <w:rPr> at all — one is synthesized.
    const h5 = out.match(/<w:style\b[^>]*w:styleId="Heading5"[^>]*>[\s\S]*?<\/w:style>/)![0];
    expect(h5).toContain("<w:rPr><w:b/><w:bCs/><w:color");
  });
});

describe("applyHeadingStyleToXml", () => {
  test("replaces existing sz/szCs/color, leaves other rPr children untouched", () => {
    const { xml, result } = applyHeadingStyleToXml(HEADING_STYLES_XML, [1], { fontSizePt: 18, bold: true, color: "#000000" });
    expect(result).toEqual({ updatedLevels: [1], missingLevels: [] });
    const h1 = xml.match(/<w:style\b[^>]*w:styleId="Heading1"[^>]*>[\s\S]*?<\/w:style>/)![0];
    expect(h1).toContain('<w:sz w:val="36"/><w:szCs w:val="36"/>');
    expect(h1).toContain('<w:color w:val="000000"/>');
    expect(h1).not.toContain('w:val="2E74B5"');
    // Heading4 (not requested) is untouched, still carries its original color.
    expect(xml).toContain('w:val="2E74B5"');
  });

  test("bold:false strips an existing <w:b/>", () => {
    const withBold = HEADING_STYLES_XML.replace(
      '<w:rPr><w:color w:val="2E74B5"/>',
      '<w:rPr><w:b/><w:bCs/><w:color w:val="2E74B5"/>',
    );
    const { xml } = applyHeadingStyleToXml(withBold, [1], { bold: false });
    const h1 = xml.match(/<w:style\b[^>]*w:styleId="Heading1"[^>]*>[\s\S]*?<\/w:style>/)![0];
    expect(h1).not.toContain("<w:b/>");
    expect(h1).not.toContain("<w:bCs/>");
  });

  test("reports missing levels without touching the xml", () => {
    const { xml, result } = applyHeadingStyleToXml(HEADING_STYLES_XML, [2, 3], { bold: true });
    expect(xml).toBe(HEADING_STYLES_XML);
    expect(result).toEqual({ updatedLevels: [], missingLevels: [2, 3] });
  });

  test("empty formatting is effectively a no-op on content", () => {
    const { xml } = applyHeadingStyleToXml(HEADING_STYLES_XML, [1], {});
    expect(xml).toBe(HEADING_STYLES_XML);
  });
});
