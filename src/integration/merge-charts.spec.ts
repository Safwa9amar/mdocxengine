import { describe, test, expect } from "vitest";
import { Mdocxengine, makeParagraphNode, type BodyBlock } from "../index";

/**
 * Charts across a merge.
 *
 * A `<c:chart r:id>` addresses a whole PART, not inline markup. Before this was
 * handled, `appendDocument` copied the paragraph and left the rId untouched, so
 * in the merged package it resolved against the TARGET's relationships — landing
 * on an image. Word refuses such a file outright, and neither schema validation
 * nor a dangling-target check catches it: the rId resolves, just to the wrong
 * KIND of part. That shipped a combined thesis that could never be opened.
 */

const CHART_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
const CHART_CT = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
const COLORS_CT = "application/vnd.ms-office.chartcolorstyle+xml";
const STYLE_CT = "application/vnd.ms-office.chartstyle+xml";
const XLSX_CT = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const CHART_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  "<c:chart><c:plotArea><c:layout/><c:barChart><c:barDir val=\"col\"/></c:barChart></c:plotArea></c:chart>" +
  '<c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData>' +
  "</c:chartSpace>";

const CHART_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/package" Target="../embeddings/Microsoft_Excel_Sheet1.xlsx"/>` +
  `<Relationship Id="rId2" Type="http://schemas.microsoft.com/office/2011/relationships/chartColorStyle" Target="colors1.xml"/>` +
  `<Relationship Id="rId3" Type="http://schemas.microsoft.com/office/2011/relationships/chartStyle" Target="style1.xml"/>` +
  "</Relationships>";

const chartDrawing = (rid: string) =>
  "<w:p><w:r><w:drawing>" +
  '<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">' +
  '<wp:extent cx="5420360" cy="3161665"/><wp:docPr id="7" name="Chart 1"/><wp:cNvGraphicFramePr/>' +
  '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
  '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
  `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${rid}"/>` +
  "</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>";

/** A source .docx carrying one real chart with its full part closure. */
async function chartSource(opts: { withParts?: boolean } = {}): Promise<Buffer> {
  const withParts = opts.withParts !== false;
  const e = await Mdocxengine.loadFromFile("samples/example.docx");

  const rid = await e.merge["rels"].genId();
  await e.merge["rels"].addRelationship(rid, CHART_TYPE, "charts/chart1.xml");

  if (withParts) {
    e.zip.addFile("word/charts/chart1.xml", Buffer.from(CHART_XML, "utf8"));
    e.zip.addFile("word/charts/_rels/chart1.xml.rels", Buffer.from(CHART_RELS, "utf8"));
    e.zip.addFile("word/charts/colors1.xml", Buffer.from("<cs/>", "utf8"));
    e.zip.addFile("word/charts/style1.xml", Buffer.from("<cs/>", "utf8"));
    e.zip.addFile("word/embeddings/Microsoft_Excel_Sheet1.xlsx", Buffer.from("PK-stub-workbook"));
    const ct = new (await import("../core/PartsManagers/ContentTypesManager")).ContentTypesManager(e.zip);
    await ct.addOverride("/word/charts/chart1.xml", CHART_CT);
    await ct.addOverride("/word/charts/colors1.xml", COLORS_CT);
    await ct.addOverride("/word/charts/style1.xml", STYLE_CT);
    await ct.addDefault("xlsx", XLSX_CT);
  }

  const blocks: BodyBlock[] = [
    makeParagraphNode("before the chart"),
    { kind: "paragraph", tag: "w:p", xml: chartDrawing(rid) },
    makeParagraphNode("after the chart"),
  ];
  await e.document.saveBlocks(blocks);
  return e.zip.toBuffer();
}

/** A target that already uses the rIds the source's chart used — the collision
 *  that produced the unopenable thesis. */
async function targetWithImages(): Promise<Mdocxengine> {
  const e = await Mdocxengine.loadFromFile("samples/example.docx");
  await e.document.saveBlocks([makeParagraphNode("TARGET")]);
  return e;
}

function relsOf(e: Mdocxengine): { id: string; type: string; target: string }[] {
  const xml = e.zip.readAsText("word/_rels/document.xml.rels") ?? "";
  return [...xml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => ({
    id: /Id="([^"]+)"/.exec(m[0])?.[1] ?? "",
    type: /Type="([^"]+)"/.exec(m[0])?.[1] ?? "",
    target: /Target="([^"]+)"/.exec(m[0])?.[1] ?? "",
  }));
}

function chartRefs(xml: string): string[] {
  return [...xml.matchAll(/<c:chart\b[^>]*\br:id="([^"]+)"/g)].map((m) => m[1]);
}

describe("MergeManager — charts survive a merge", () => {
  test("copies the chart part and every part it references", async () => {
    const target = await targetWithImages();
    await target.merge.appendDocument(await chartSource());

    const names = target.zip.getEntries().map((x) => x.entryName);
    expect(names.some((n) => /^word\/charts\/chart\d+\.xml$/.test(n))).toBe(true);
    expect(names.some((n) => /^word\/charts\/colors\d+\.xml$/.test(n))).toBe(true);
    expect(names.some((n) => /^word\/charts\/style\d+\.xml$/.test(n))).toBe(true);
    expect(names.some((n) => /^word\/embeddings\/.*\.xlsx$/.test(n))).toBe(true);
  });

  test("the merged c:chart resolves to a CHART relationship whose part exists", async () => {
    const target = await targetWithImages();
    await target.merge.appendDocument(await chartSource());

    const body = (await target.document.getBlocks()).map((b) => b.xml).join("");
    const refs = chartRefs(body);
    expect(refs).toHaveLength(1);

    const rel = relsOf(target).find((r) => r.id === refs[0]);
    expect(rel, "the chart's rId must exist in document.xml.rels").toBeDefined();
    // THE bug: it resolved, but to an image.
    expect(rel!.type).toBe(CHART_TYPE);
    expect(target.zip.getEntry(`word/${rel!.target}`)).toBeTruthy();
  });

  test("the copied chart's own rels are rewritten to the copied parts", async () => {
    const target = await targetWithImages();
    await target.merge.appendDocument(await chartSource());

    const chartPart = target.zip
      .getEntries()
      .map((x) => x.entryName)
      .find((n) => /^word\/charts\/chart\d+\.xml$/.test(n))!;
    const rels = target.zip.readAsText(chartPart.replace(/charts\/(.*)$/, "charts/_rels/$1.rels")) ?? "";
    expect(rels).toContain("Relationship");
    for (const m of rels.matchAll(/Target="([^"]+)"/g)) {
      const t = m[1];
      const resolved = t.startsWith("../")
        ? `word/${t.replace(/^\.\.\//, "")}`
        : `word/charts/${t}`;
      expect(target.zip.getEntry(resolved), `${t} must exist`).toBeTruthy();
    }
  });

  test("declares content types for every copied part", async () => {
    const target = await targetWithImages();
    await target.merge.appendDocument(await chartSource());
    const ct = target.zip.readAsText("[Content_Types].xml") ?? "";
    expect(ct).toContain(CHART_CT);
    expect(ct).toContain(XLSX_CT);
  });

  test("two chart-bearing sources do not collide", async () => {
    const target = await targetWithImages();
    await target.merge.appendDocument(await chartSource());
    await target.merge.appendDocument(await chartSource());

    const body = (await target.document.getBlocks()).map((b) => b.xml).join("");
    const refs = chartRefs(body);
    expect(refs).toHaveLength(2);
    expect(new Set(refs).size).toBe(2); // distinct rIds

    const rels = relsOf(target);
    const targets = refs.map((r) => rels.find((x) => x.id === r)!.target);
    expect(new Set(targets).size).toBe(2); // distinct parts, neither overwritten
    for (const t of targets) expect(target.zip.getEntry(`word/${t}`)).toBeTruthy();
  });

  test("a chart whose part is missing is dropped, never left dangling", async () => {
    const target = await targetWithImages();
    await target.merge.appendDocument(await chartSource({ withParts: false }));

    const body = (await target.document.getBlocks()).map((b) => b.xml).join("");
    expect(chartRefs(body)).toHaveLength(0);
    // The surrounding text still comes across — only the unusable drawing goes.
    expect(body).toContain("before the chart");
    expect(body).toContain("after the chart");
  });

  test("no reference ever points at a relationship of the wrong kind", async () => {
    const target = await targetWithImages();
    await target.merge.appendDocument(await chartSource());

    const body = (await target.document.getBlocks()).map((b) => b.xml).join("");
    const rels = new Map(relsOf(target).map((r) => [r.id, r.type]));
    for (const rid of chartRefs(body)) expect(rels.get(rid)).toBe(CHART_TYPE);
    for (const m of body.matchAll(/<a:blip\b[^>]*\br:embed="([^"]+)"/g)) {
      expect(rels.get(m[1])).toMatch(/\/image$/);
    }
  });
});
