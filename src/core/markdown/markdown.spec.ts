import { describe, test, expect } from "vitest";
import Paragraph from "../files/paragraph/index";
import {
  renderMarkdownBlocks,
  stripInlineMarkdown,
  type MarkdownBlock,
} from ".";

describe("stripInlineMarkdown", () => {
  test("removes bold/italic/code/link markers", () => {
    expect(stripInlineMarkdown("**bold** and *it* and `c` and [t](u)")).toBe(
      "bold and it and c and t",
    );
  });
  test("tolerates null/empty", () => {
    expect(stripInlineMarkdown("")).toBe("");
    expect(stripInlineMarkdown(undefined as any)).toBe("");
  });
});

describe("renderMarkdownBlocks", () => {
  test("headings map to Heading{base+level-1} with outline level and bold", async () => {
    const blocks: MarkdownBlock[] = [{ kind: "heading", level: 1, text: "Intro" }];
    const { paragraphs } = renderMarkdownBlocks(blocks, { align: "both", rtl: false });
    const xml = await paragraphs[0].toXml();
    expect(xml).toContain('<w:pStyle w:val="Heading2"'); // default base 2
    expect(xml).toContain('<w:outlineLvl w:val="1"');
    expect(xml).toContain("<w:b/>");
  });

  test("headingBase shifts the mapping", async () => {
    const { paragraphs } = renderMarkdownBlocks(
      [{ kind: "heading", level: 1, text: "X" }],
      { align: "both", rtl: false, headingBase: 3 },
    );
    expect(await paragraphs[0].toXml()).toContain('<w:pStyle w:val="Heading3"');
  });

  test("deep headings clamp at Heading6", async () => {
    const { paragraphs } = renderMarkdownBlocks(
      [{ kind: "heading", level: 6, text: "deep" }],
      { align: "both", rtl: false, headingBase: 3 },
    );
    expect(await paragraphs[0].toXml()).toContain('<w:pStyle w:val="Heading6"');
  });

  test("lists become ListParagraph items with bullets / numbers", async () => {
    const { paragraphs } = renderMarkdownBlocks(
      [
        { kind: "list", ordered: false, items: ["a", "b"] },
        { kind: "list", ordered: true, items: ["x"] },
      ],
      { align: "left", rtl: false },
    );
    expect(paragraphs).toHaveLength(3);
    expect((await paragraphs[0].getPlainText()).text).toBe("• a");
    expect((await paragraphs[2].getPlainText()).text).toBe("1. x");
    expect(await paragraphs[0].toXml()).toContain('<w:pStyle w:val="ListParagraph"');
  });

  test("table block produces a table insert at the current paragraph position", () => {
    const blocks: MarkdownBlock[] = [
      { kind: "paragraph", text: "before" },
      { kind: "table", header: ["H"], rows: [["v"]] },
    ];
    const { paragraphs, tables } = renderMarkdownBlocks(blocks, { align: "both", rtl: false });
    expect(paragraphs).toHaveLength(1);
    expect(tables).toHaveLength(1);
    expect(tables[0].afterParaCount).toBe(1);
    expect(tables[0].table.getAllCellText()).toEqual([["H"], ["v"]]);
  });

  test("unclaimed code block renders verbatim as a paragraph", async () => {
    const { paragraphs } = renderMarkdownBlocks(
      [{ kind: "code", lang: "js", text: "const x = 1;" }],
      { align: "left", rtl: false },
    );
    expect((await paragraphs[0].getPlainText()).text).toBe("const x = 1;");
  });

  test("renderBlock hook claims a block and rebases its insert offsets", () => {
    const blocks: MarkdownBlock[] = [
      { kind: "paragraph", text: "p1" },
      { kind: "code", lang: "chart", text: "{}" },
    ];
    const fakePng = Buffer.from([1, 2, 3]);
    const { paragraphs, images } = renderMarkdownBlocks(
      blocks,
      { align: "both", rtl: false },
      (block) => {
        if (block.kind === "code" && block.lang === "chart") {
          // caption paragraph + an image positioned right after it (local offset 1)
          return {
            paragraphs: [Paragraph.make("Figure", { alignment: "center", bold: true })],
            images: [{ afterParaCount: 1, png: fakePng, widthEmu: 100, heightEmu: 50 }],
          };
        }
        return undefined;
      },
    );
    // 1 base paragraph + 1 caption from the hook
    expect(paragraphs).toHaveLength(2);
    // hook image local offset 1, rebased onto the 1 already-emitted paragraph → 2
    expect(images).toHaveLength(1);
    expect(images[0].afterParaCount).toBe(2);
    expect(images[0].png).toBe(fakePng);
  });
});
