import { describe, test, expect } from "vitest";
import {
  splitTopLevelElements,
  elementName,
  canonicalizeRunProps,
  canonicalizeStyleChildren,
} from "./canonicalOrder";

describe("splitTopLevelElements", () => {
  test("splits self-closing siblings", () => {
    expect(splitTopLevelElements(`<w:b/><w:sz w:val="24"/>`)).toEqual([
      `<w:b/>`,
      `<w:sz w:val="24"/>`,
    ]);
  });

  test("keeps a paired element with nested children whole", () => {
    const xml = `<w:rPr><w:b/></w:rPr><w:name w:val="X"/>`;
    expect(splitTopLevelElements(xml)).toEqual([`<w:rPr><w:b/></w:rPr>`, `<w:name w:val="X"/>`]);
  });

  test("handles same-name nesting without closing early", () => {
    const xml = `<w:p><w:p/></w:p>`;
    expect(splitTopLevelElements(xml)).toEqual([`<w:p><w:p/></w:p>`]);
  });

  test("ignores whitespace between elements", () => {
    expect(splitTopLevelElements(`\n  <w:b/>\n  <w:i/>\n`)).toEqual([`<w:b/>`, `<w:i/>`]);
  });
});

describe("elementName", () => {
  test("reads the tag name", () => {
    expect(elementName(`<w:szCs w:val="32"/>`)).toBe("w:szCs");
    expect(elementName(`<w:rPr><w:b/></w:rPr>`)).toBe("w:rPr");
  });
});

describe("canonicalizeRunProps", () => {
  test("moves rFonts before b — the rewriteHeadingRunProps bug", () => {
    expect(canonicalizeRunProps(`<w:b/><w:bCs/><w:rFonts w:ascii="Arial"/>`)).toBe(
      `<w:rFonts w:ascii="Arial"/><w:b/><w:bCs/>`,
    );
  });

  test("sorts a full run into CT_RPr order", () => {
    const input = `<w:sz w:val="32"/><w:rtl/><w:color w:val="FF0000"/><w:rFonts w:cs="Simplified Arabic"/><w:b/>`;
    expect(canonicalizeRunProps(input)).toBe(
      `<w:rFonts w:cs="Simplified Arabic"/><w:b/><w:color w:val="FF0000"/><w:sz w:val="32"/><w:rtl/>`,
    );
  });

  test("is stable for unknown elements — they go last, in original order", () => {
    expect(canonicalizeRunProps(`<w:zzz/><w:yyy/><w:b/>`)).toBe(`<w:b/><w:zzz/><w:yyy/>`);
  });

  test("is idempotent", () => {
    const once = canonicalizeRunProps(`<w:sz w:val="32"/><w:rFonts w:ascii="Arial"/>`);
    expect(canonicalizeRunProps(once)).toBe(once);
  });

  test("returns a single element untouched, whitespace and all", () => {
    expect(canonicalizeRunProps(`\n  <w:b/>\n`)).toBe(`\n  <w:b/>\n`);
  });

  test("returns empty input untouched", () => {
    expect(canonicalizeRunProps("")).toBe("");
  });
});

describe("canonicalizeStyleChildren", () => {
  test("moves basedOn/next/qFormat before rPr — the seed styles.xml defect", () => {
    const input = `<w:name w:val="Heading 1"/><w:rPr><w:b/></w:rPr><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>`;
    expect(canonicalizeStyleChildren(input)).toBe(
      `<w:name w:val="Heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:rPr><w:b/></w:rPr>`,
    );
  });

  test("puts pPr before rPr", () => {
    expect(canonicalizeStyleChildren(`<w:rPr><w:b/></w:rPr><w:pPr><w:jc w:val="both"/></w:pPr>`)).toBe(
      `<w:pPr><w:jc w:val="both"/></w:pPr><w:rPr><w:b/></w:rPr>`,
    );
  });
});
