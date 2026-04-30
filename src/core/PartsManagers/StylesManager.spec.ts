import { describe, test, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import { StylesManager } from "./StylesManager";

const SAMPLE_STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
  </w:style>
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
});
