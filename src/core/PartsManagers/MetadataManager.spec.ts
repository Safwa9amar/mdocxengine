import { describe, test, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import { MetadataManager } from "./MetadataManager";

const CORE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties
  xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>My Document</dc:title>
  <dc:creator>Alice</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">2024-01-01T00:00:00Z</dcterms:created>
</cp:coreProperties>`;

const APP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Microsoft Word</Application>
  <Pages>5</Pages>
  <Words>1200</Words>
</Properties>`;

function makeZip(): AdmZip {
  const zip = new AdmZip();
  zip.addFile("docProps/core.xml", Buffer.from(CORE_XML, "utf-8"));
  zip.addFile("docProps/app.xml", Buffer.from(APP_XML, "utf-8"));
  return zip;
}

describe("MetadataManager", () => {
  let mm: MetadataManager;

  beforeEach(() => {
    mm = new MetadataManager(makeZip());
  });

  test("getCoreProperties() reads title and creator", async () => {
    const props = await mm.getCoreProperties();
    expect(props.title).toBe("My Document");
    expect(props.creator).toBe("Alice");
  });

  test("setCoreProperties() updates title", async () => {
    await mm.setCoreProperties({ title: "Updated Title" });
    const props = await mm.getCoreProperties();
    expect(props.title).toBe("Updated Title");
  });

  test("setCoreProperties() preserves existing fields when updating one", async () => {
    await mm.setCoreProperties({ title: "New Title" });
    const props = await mm.getCoreProperties();
    expect(props.creator).toBe("Alice");
  });

  test("setCoreProperties() sets lastModifiedBy", async () => {
    await mm.setCoreProperties({ lastModifiedBy: "Bob" });
    const props = await mm.getCoreProperties();
    expect(props.lastModifiedBy).toBe("Bob");
  });

  test("getAppProperties() reads application and page count", async () => {
    const props = await mm.getAppProperties();
    expect(props.application).toBe("Microsoft Word");
    expect(props.pages).toBe(5);
    expect(props.words).toBe(1200);
  });

  test("setAppProperties() updates word count", async () => {
    await mm.setAppProperties({ words: 999 });
    const props = await mm.getAppProperties();
    expect(props.words).toBe(999);
  });

  test("getCoreProperties() returns empty object when no core.xml", async () => {
    const mm2 = new MetadataManager(new AdmZip());
    const props = await mm2.getCoreProperties();
    expect(props.title).toBeUndefined();
  });

  test("getAppProperties() returns empty object when no app.xml", async () => {
    const mm2 = new MetadataManager(new AdmZip());
    const props = await mm2.getAppProperties();
    expect(props.application).toBeUndefined();
  });
});
