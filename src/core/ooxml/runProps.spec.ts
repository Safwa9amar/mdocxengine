import { describe, test, expect } from "vitest";
import { buildRFonts, propTagsFor, stripRunPropTags, mergeRunProps } from "./runProps";

describe("buildRFonts", () => {
  test("sets ascii, hAnsi AND cs — cs is what Arabic runs actually read", () => {
    expect(buildRFonts("Simplified Arabic")).toBe(
      `<w:rFonts w:ascii="Simplified Arabic" w:hAnsi="Simplified Arabic" w:cs="Simplified Arabic"/>`,
    );
  });

  test("preserves eastAsia and theme attributes from the existing element", () => {
    const existing = `<w:rFonts w:ascii="Calibri" w:eastAsia="SimSun" w:cstheme="minorBidi"/>`;
    expect(buildRFonts("Arial", existing)).toBe(
      `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="SimSun" w:cstheme="minorBidi"/>`,
    );
  });
});

describe("propTagsFor", () => {
  test("names only the tags for the properties actually supplied", () => {
    expect(propTagsFor({ font: "Arial" })).toEqual(["rFonts"]);
    expect(propTagsFor({ sizePt: 16 })).toEqual(["sz", "szCs"]);
    expect(propTagsFor({ bold: false })).toEqual(["b", "bCs"]);
    expect(propTagsFor({ font: "Arial", sizePt: 16 })).toEqual(["rFonts", "sz", "szCs"]);
  });

  test("an absent property contributes nothing", () => {
    expect(propTagsFor({})).toEqual([]);
  });
});

describe("stripRunPropTags", () => {
  test("removes self-closing and paired forms", () => {
    expect(stripRunPropTags(`<w:rFonts w:ascii="X"/><w:b/>`, ["rFonts"])).toBe(`<w:b/>`);
    expect(stripRunPropTags(`<w:color w:val="F00"></w:color><w:b/>`, ["color"])).toBe(`<w:b/>`);
  });

  test("does not touch a tag whose name merely starts the same", () => {
    expect(stripRunPropTags(`<w:sz w:val="24"/><w:szCs w:val="24"/>`, ["sz"])).toBe(
      `<w:szCs w:val="24"/>`,
    );
  });
});

describe("mergeRunProps", () => {
  test("writes sz AND szCs for a size", () => {
    expect(mergeRunProps("", { sizePt: 16 })).toBe(`<w:sz w:val="32"/><w:szCs w:val="32"/>`);
  });

  test("writes b AND bCs for bold, and removes both when false", () => {
    expect(mergeRunProps("", { bold: true })).toBe(`<w:b/><w:bCs/>`);
    expect(mergeRunProps(`<w:b/><w:bCs/>`, { bold: false })).toBe("");
  });

  test("replaces an existing font rather than appending a second rFonts", () => {
    const out = mergeRunProps(`<w:rFonts w:ascii="Calibri" w:cs="Calibri"/>`, {
      font: "Simplified Arabic",
    });
    expect(out).toBe(
      `<w:rFonts w:ascii="Simplified Arabic" w:hAnsi="Simplified Arabic" w:cs="Simplified Arabic"/>`,
    );
  });

  test("leaves properties it was not asked about alone", () => {
    const out = mergeRunProps(`<w:rtl/><w:highlight w:val="yellow"/>`, { sizePt: 14 });
    expect(out).toContain(`<w:rtl/>`);
    expect(out).toContain(`<w:highlight w:val="yellow"/>`);
  });

  test("emits CT_RPr order regardless of input order", () => {
    expect(mergeRunProps(`<w:rtl/>`, { bold: true, font: "Arial", sizePt: 12 })).toBe(
      `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/>` +
        `<w:sz w:val="24"/><w:szCs w:val="24"/><w:rtl/>`,
    );
  });

  test("normalises a colour to uppercase hex without '#'", () => {
    expect(mergeRunProps("", { color: "#00ff00" })).toBe(`<w:color w:val="00FF00"/>`);
  });
});
