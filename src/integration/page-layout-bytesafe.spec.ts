import { describe, it, expect } from "vitest";
import { applyBodyPageLayout } from "../core/files/body/pageLayout";
import { PAGE_SIZES, MARGIN_PRESETS } from "../core/PartsManagers/PageLayoutManager";

// Minimal document.xml with a table BEFORE the final body sectPr. The whole point
// of byte-safe editing is that this table must NOT move.
const DOC_WITH_TABLE =
  `<?xml version="1.0"?>` +
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
  `<w:p><w:r><w:t>Intro</w:t></w:r></w:p>` +
  `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>CELL</w:t></w:r></w:p></w:tc></w:tr></w:tbl>` +
  `<w:p><w:r><w:t>After table</w:t></w:r></w:p>` +
  `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>` +
  `</w:body></w:document>`;

describe("applyBodyPageLayout (byte-safe)", () => {
  it("sets A4 page size without moving the table", () => {
    const out = applyBodyPageLayout(DOC_WITH_TABLE, { pageSizePreset: "A4" });
    expect(out.indexOf("<w:tbl>")).toBeLessThan(out.indexOf("After table"));
    expect(out.indexOf("<w:tbl>")).toBeLessThan(out.indexOf("<w:sectPr>"));
    expect(out).toContain(`w:w="${PAGE_SIZES.A4.w}"`);
    expect(out).toContain(`w:h="${PAGE_SIZES.A4.h}"`);
    expect(out).not.toContain(`w:orient`); // portrait => no orient attr
  });

  it("applies a margin preset by replacing pgMar in place", () => {
    const out = applyBodyPageLayout(DOC_WITH_TABLE, { marginPreset: "narrow" });
    expect(out).toContain(`w:top="${MARGIN_PRESETS.narrow.top}"`);
    expect(out).toContain(`w:left="${MARGIN_PRESETS.narrow.left}"`);
    expect(out.match(/<w:pgMar\b/g)?.length).toBe(1);
    // header/footer must be real numbers (preserved from the source), never the
    // literal "undefined" — MARGIN_PRESETS has no header/footer keys.
    expect(out).toMatch(/w:header="\d+"/);
    expect(out).toMatch(/w:footer="\d+"/);
    expect(out).not.toContain("undefined");
  });

  it("landscape orientation swaps w/h and adds orient, only once", () => {
    const out = applyBodyPageLayout(DOC_WITH_TABLE, { orientation: "landscape" });
    expect(out).toContain(`w:w="15840"`);
    expect(out).toContain(`w:h="12240"`);
    expect(out).toContain(`w:orient="landscape"`);
    expect(out.match(/<w:pgSz\b/g)?.length).toBe(1);
  });

  it("sets columns and is idempotent (one <w:cols>)", () => {
    const twice = applyBodyPageLayout(applyBodyPageLayout(DOC_WITH_TABLE, { columns: 2 }), { columns: 3 });
    expect(twice).toContain(`w:num="3"`);
    expect(twice.match(/<w:cols\b/g)?.length).toBe(1);
  });

  it("combines multiple ops in one call and preserves table order", () => {
    const out = applyBodyPageLayout(DOC_WITH_TABLE, {
      pageSizePreset: "A4", orientation: "landscape", marginPreset: "narrow", columns: 2,
    });
    expect(out).toContain(`w:orient="landscape"`);
    expect(out).toContain(`w:num="2"`);
    expect(out).toContain(`w:top="${MARGIN_PRESETS.narrow.top}"`);
    expect(out.indexOf("<w:tbl>")).toBeLessThan(out.indexOf("<w:sectPr>"));
  });

  it("combined ops keep canonical pgSz→pgMar→cols order", () => {
    const out = applyBodyPageLayout(DOC_WITH_TABLE, {
      pageSizePreset: "A4", marginPreset: "narrow", columns: 2,
    });
    expect(out.indexOf("<w:pgSz")).toBeLessThan(out.indexOf("<w:pgMar"));
    expect(out.indexOf("<w:pgMar")).toBeLessThan(out.indexOf("<w:cols"));
  });

  it("columns-only edit preserves order + existing header/footer", () => {
    // DOC_WITH_TABLE already carries pgSz + pgMar (header=720/footer=720). A
    // columns-only edit must slot <w:cols> after them (canonical order) and must
    // NOT disturb the existing pgSz/pgMar (incl. the header/footer margins).
    const out = applyBodyPageLayout(DOC_WITH_TABLE, { columns: 3 });
    expect(out.indexOf("<w:pgSz")).toBeLessThan(out.indexOf("<w:pgMar"));
    expect(out.indexOf("<w:pgMar")).toBeLessThan(out.indexOf("<w:cols"));
    expect(out).toContain(`w:num="3"`);
    expect(out).toContain(`w:header="720"`);
    expect(out).toContain(`w:footer="720"`);
  });

  it("keeps footnotePr/endnotePr/type before the managed block (schema order)", () => {
    // CT_SectPr child order: headerReference*, footerReference*, footnotePr?,
    // endnotePr?, type?, pgSz?, pgMar?, cols?, … The lead elements (incl.
    // footnotePr/endnotePr — common in theses with footnotes) must stay BEFORE
    // the pgSz/pgMar/cols we manage, or Word flags the doc for repair.
    const doc =
      `<?xml version="1.0"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>` +
      `<w:p><w:r><w:t>Body</w:t></w:r></w:p>` +
      `<w:sectPr>` +
      `<w:footnotePr><w:numRestart w:val="eachPage"/></w:footnotePr>` +
      `<w:endnotePr/>` +
      `<w:type w:val="nextPage"/>` +
      `<w:pgSz w:w="12240" w:h="15840"/>` +
      `<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>` +
      `</w:sectPr>` +
      `</w:body></w:document>`;
    const out = applyBodyPageLayout(doc, { marginPreset: "narrow" });
    expect(out.indexOf("<w:footnotePr")).toBeLessThan(out.indexOf("<w:pgSz"));
    expect(out.indexOf("<w:endnotePr")).toBeLessThan(out.indexOf("<w:pgSz"));
    expect(out.indexOf("<w:type")).toBeLessThan(out.indexOf("<w:pgMar"));
    // footnotePr's self-closing child stays inside its own container (not consumed
    // into the managed block) and the container is preserved intact.
    expect(out).toContain(`<w:footnotePr><w:numRestart w:val="eachPage"/></w:footnotePr>`);
  });

  it("keeps header/footer references before the managed block, retaining r:id", () => {
    const doc =
      `<?xml version="1.0"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>` +
      `<w:p><w:r><w:t>Body</w:t></w:r></w:p>` +
      `<w:sectPr>` +
      `<w:headerReference r:id="rId7" w:type="default"/>` +
      `<w:footerReference r:id="rId8" w:type="default"/>` +
      `<w:pgSz w:w="12240" w:h="15840"/>` +
      `</w:sectPr>` +
      `</w:body></w:document>`;
    const out = applyBodyPageLayout(doc, { columns: 2 });
    expect(out).toContain(`w:num="2"`);
    // References retained (incl. their r:id) and still before the managed block.
    expect(out).toContain(`<w:headerReference r:id="rId7" w:type="default"/>`);
    expect(out).toContain(`<w:footerReference r:id="rId8" w:type="default"/>`);
    expect(out.indexOf("<w:headerReference")).toBeLessThan(out.indexOf("<w:pgSz"));
    expect(out.indexOf("<w:footerReference")).toBeLessThan(out.indexOf("<w:cols"));
  });

  it("no-ops (returns input unchanged) when opts is empty", () => {
    expect(applyBodyPageLayout(DOC_WITH_TABLE, {})).toBe(DOC_WITH_TABLE);
  });
});
