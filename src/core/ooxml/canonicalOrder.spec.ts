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

describe("canonicalizeRunProps — comments, CDATA and malformed markup", () => {
  test("a comment containing a closing tag no longer deletes the real elements around it", () => {
    // Counterexample 1 from code review: a naive open/close depth counter reads
    // the `</w:b>` INSIDE the comment as a real close, desynchronising depth and
    // silently dropping <w:sz> and the <w:x> wrapper. The comment must survive
    // (not be dropped), and a genuine reorder must still happen (<w:sz> moves
    // ahead of it).
    const input = `<w:b/><!-- </w:b> --><w:x><w:y/></w:x><w:sz w:val="20"/>`;
    expect(canonicalizeRunProps(input)).toBe(
      `<w:b/><w:sz w:val="20"/><!-- </w:b> --><w:x><w:y/></w:x>`,
    );
  });

  test("a comment containing an unclosed-looking tag no longer causes a silent no-op", () => {
    // Counterexample 2 from code review: the naive scanner reads `<w:evil>`
    // INSIDE the comment as a real unclosed open tag, which swallows the rest
    // of the fragment and makes `elements.length <= 1` return the input
    // unchanged — even though <w:rFonts> should have moved to the front. A
    // silent no-op here is as bad as corruption: the caller believes it
    // reordered and Word still rejects the file.
    const input = `<w:b/><!-- <w:evil> --><w:i/><w:rFonts w:ascii="Arial"/>`;
    expect(canonicalizeRunProps(input)).toBe(
      `<w:rFonts w:ascii="Arial"/><w:b/><w:i/><!-- <w:evil> -->`,
    );
  });

  test("a CDATA section is treated as opaque content, not dropped, not mistaken for a tag", () => {
    const input = `<w:sz w:val="20"/><![CDATA[<w:b/>]]><w:rFonts w:ascii="Arial"/>`;
    expect(canonicalizeRunProps(input)).toBe(
      `<w:rFonts w:ascii="Arial"/><w:sz w:val="20"/><![CDATA[<w:b/>]]>`,
    );
  });

  test("throws on a stray closing tag instead of silently dropping the real elements after it", () => {
    // The old depth counter went negative on `</w:b>` and never recovered, so
    // <w:i> and <w:u> vanished from the output with no error at all.
    expect(() => canonicalizeRunProps(`</w:b><w:i/><w:u/>`)).toThrow(/malformed markup/);
  });

  test("throws on an element whose matching close is never found", () => {
    // <w:x> never closes; the trailing <w:y/> is its (equally unclosed) child.
    expect(() => canonicalizeRunProps(`<w:b/><w:x><w:y/>`)).toThrow(/unclosed element/);
  });

  test("throws on a raw NUL in the input instead of colliding with the internal EOF probe", () => {
    // XML 1.0 forbids a raw NUL in content, so this can only arise from
    // already-invalid input - but silently dropping the colliding text (the
    // old behaviour) would be the one quiet failure in an otherwise loud module.
    expect(() => canonicalizeRunProps(`<w:b/>\u0000<w:sz w:val="20"/>`)).toThrow(/NUL/);
  });
});
