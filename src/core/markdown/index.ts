/**
 * Markdown → docx rendering.
 *
 * This module owns the *docx-specific* half of a Markdown pipeline: turning a
 * small, domain-free block model into engine `Paragraph`s + `Table` inserts,
 * honouring alignment / RTL / heading depth. Lexing a Markdown STRING into the
 * block model is deliberately left to the caller (it only needs a generic
 * Markdown parser, no docx knowledge), so this module pulls in no parser
 * dependency. See {@link MarkdownBlock} for the contract.
 *
 * Fenced code blocks survive as verbatim `code` blocks (with their language
 * tag), so a caller can layer domain-specific rendering on top — e.g. a
 * ```chart``` block rasterised to an image — via the {@link BlockRenderer} hook,
 * while the engine stays free of any app concern.
 */
import Paragraph from "@/core/files/paragraph/index";
import { Table } from "@/core/files/table/index";

export type MarkdownBlock =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "quote"; text: string }
  | { kind: "code"; lang: string; text: string };

export type MarkdownAlign = "left" | "center" | "right" | "both";

export interface MarkdownRenderCtx {
  /** Body alignment for paragraphs/lists/headings. */
  align: MarkdownAlign;
  /** Right-to-left tables (and a hint for caller hooks). */
  rtl: boolean;
  /**
   * Word heading level a top-level markdown `#` maps to (default 2). Use 3 to
   * reserve Heading1/Heading2 for an outer structure (e.g. Partie/Chapitre).
   */
  headingBase?: 2 | 3;
}

/** A `Table` to be inserted after the Nth rendered paragraph. */
export interface RenderedTable {
  afterParaCount: number;
  table: Table;
}

/** An inline image (PNG bytes + EMU dimensions) to embed after the Nth paragraph. */
export interface RenderedImage {
  afterParaCount: number;
  png: Buffer;
  widthEmu: number;
  heightEmu: number;
}

/** A chunk a {@link BlockRenderer} hook may return; insert offsets are local. */
export interface RenderedChunk {
  paragraphs: Paragraph[];
  tables?: RenderedTable[];
  images?: RenderedImage[];
}

/** Output of {@link renderMarkdownBlocks}. */
export interface RenderedMarkdown {
  paragraphs: Paragraph[];
  tables: RenderedTable[];
  images: RenderedImage[];
}

/**
 * Caller hook to render a block the engine handles differently (or not at all).
 * Returns paragraphs to append plus optional table/image inserts whose
 * `afterParaCount` is LOCAL to the returned paragraphs (0 = before the first).
 * The engine rebases those offsets onto the running paragraph count. Return
 * `undefined` (or omit the hook) to fall back to the engine's built-in
 * rendering for that block.
 */
export type BlockRenderer = (
  block: MarkdownBlock,
  ctx: MarkdownRenderCtx,
) => RenderedChunk | undefined;

/** Strip the common inline markdown markers, leaving plain text. */
export function stripInlineMarkdown(s: string): string {
  return (s || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim();
}

function listParagraph(text: string, ordered: boolean, idx: number, align: MarkdownAlign): Paragraph {
  const bullet = ordered ? `${idx + 1}. ` : "• ";
  return Paragraph.make(bullet + text, { styleId: "ListParagraph", alignment: align });
}

/**
 * Render markdown blocks into engine paragraphs + table/image inserts.
 *
 * Heading levels map to `Heading{N}` styles starting at `ctx.headingBase`
 * (default 2): a markdown `#` → `Heading{base}`, `##` → `Heading{base+1}`, …
 * capped at Heading6. Headings are bold with a matching `w:outlineLvl` so a TOC
 * can be derived. Tables are recorded as inserts positioned after the paragraph
 * count at the point they appear (the same contract the export pipeline uses).
 *
 * Pass `renderBlock` to intercept blocks (e.g. `code` blocks of a custom
 * language); anything the hook does not claim is rendered by the engine.
 */
export function renderMarkdownBlocks(
  blocks: MarkdownBlock[],
  ctx: MarkdownRenderCtx,
  renderBlock?: BlockRenderer,
): RenderedMarkdown {
  const base = ctx.headingBase ?? 2;
  const paragraphs: Paragraph[] = [];
  const tables: RenderedTable[] = [];
  const images: RenderedImage[] = [];

  for (const b of blocks) {
    // Let the caller claim this block first.
    const custom = renderBlock?.(b, ctx);
    if (custom) {
      const offset = paragraphs.length;
      for (const t of custom.tables ?? []) {
        tables.push({ afterParaCount: offset + t.afterParaCount, table: t.table });
      }
      for (const im of custom.images ?? []) {
        images.push({ ...im, afterParaCount: offset + im.afterParaCount });
      }
      paragraphs.push(...custom.paragraphs);
      continue;
    }

    switch (b.kind) {
      case "heading": {
        const word = Math.min(6, base + (b.level - 1));
        paragraphs.push(
          Paragraph.make(b.text, {
            styleId: `Heading${word}`,
            outlineLevel: word - 1,
            alignment: ctx.align,
            bold: true,
          }),
        );
        break;
      }
      case "paragraph":
      case "quote":
        paragraphs.push(Paragraph.make(b.text, { alignment: ctx.align }));
        break;
      case "code":
        // No claim → render the code verbatim as a plain body paragraph.
        paragraphs.push(Paragraph.make(b.text, { alignment: ctx.align }));
        break;
      case "list":
        b.items.forEach((it, i) =>
          paragraphs.push(listParagraph(it, b.ordered, i, ctx.align)),
        );
        break;
      case "table":
        tables.push({
          afterParaCount: paragraphs.length,
          table: Table.fromGrid([b.header, ...b.rows], { headerRow: true, rtl: ctx.rtl }),
        });
        break;
    }
  }

  return { paragraphs, tables, images };
}
