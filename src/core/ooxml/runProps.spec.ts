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

  test("preserves attributes quoted with single quotes", () => {
    const existing = `<w:rFonts w:ascii="Calibri" w:hint='cs' w:cstheme='minorBidi'/>`;
    expect(buildRFonts("Arial", existing)).toBe(
      `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:cstheme="minorBidi" w:hint="cs"/>`,
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

  test("preserves eastAsia/cstheme through a PAIRED existing rFonts, not just a self-closing one", () => {
    const out = mergeRunProps(
      `<w:rFonts w:ascii="Calibri" w:eastAsia="SimSun" w:cstheme="minorBidi"></w:rFonts><w:rtl/>`,
      { font: "Simplified Arabic" },
    );
    expect(out).toBe(
      `<w:rFonts w:ascii="Simplified Arabic" w:hAnsi="Simplified Arabic" w:cs="Simplified Arabic"` +
        ` w:eastAsia="SimSun" w:cstheme="minorBidi"/><w:rtl/>`,
    );
  });

  test("throws on a non-finite or non-positive sizePt rather than writing invalid OOXML", () => {
    expect(() => mergeRunProps("", { sizePt: -5 })).toThrow(/sizePt/);
    expect(() => mergeRunProps("", { sizePt: NaN })).toThrow(/sizePt/);
    expect(() => mergeRunProps("", { sizePt: Infinity })).toThrow(/sizePt/);
    expect(() => mergeRunProps("", { sizePt: 0 })).toThrow(/sizePt/);
  });

  test("throws on a colour that is neither 6 hex digits nor the literal 'auto'", () => {
    expect(() => mergeRunProps("", { color: "red" })).toThrow(/color/);
    expect(() => mergeRunProps("", { color: "#0f0" })).toThrow(/color/);
  });

  test("accepts the literal 'auto' for colour, case-insensitively", () => {
    expect(mergeRunProps("", { color: "auto" })).toBe(`<w:color w:val="auto"/>`);
    expect(mergeRunProps("", { color: "AUTO" })).toBe(`<w:color w:val="auto"/>`);
  });

  test("propagates a malformed-markup throw from canonicalizeRunProps rather than swallowing it", () => {
    expect(() => mergeRunProps("<w:b/></w:bCs>", { sizePt: 12 })).toThrow(
      /malformed markup - unexpected "<\/w:bCs>"/,
    );
  });

  test("propagates an unclosed-element throw from canonicalizeRunProps rather than swallowing it", () => {
    expect(() => mergeRunProps("<w:foo><w:bar/>", { sizePt: 12 })).toThrow(
      /unclosed element <w:foo>/,
    );
  });
});
