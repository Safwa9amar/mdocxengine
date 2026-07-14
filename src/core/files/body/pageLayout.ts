// Byte-safe, order-preserving page-layout writers for the FINAL body <w:sectPr>.
// Built on editBodySectPr (string surgery) — NOT on PageLayoutManager's xml2js
// rebuild, which reorders tables. Only touches the sectPr fragment; the rest of
// document.xml (paragraphs, tables) is left byte-for-byte intact.
import { editBodySectPr } from "./sectPr";
import { PAGE_SIZES, MARGIN_PRESETS } from "../../PartsManagers/PageLayoutManager";
import type { MarginPreset, PageSizePreset, Orientation } from "../../PartsManagers/PageLayoutManager";

export interface BodyPageLayoutOpts {
  marginPreset?: MarginPreset;
  orientation?: Orientation;
  pageSizePreset?: PageSizePreset;
  columns?: number; // 1..3 (equal-width)
}

// Canonical OOXML order of the sectPr children we manage. We remove any existing
// instance of a managed tag, then re-insert new ones in this order at the point
// AFTER the reference/type children (which must stay first) — Word repairs docs
// whose sectPr children are out of schema order, so we keep them ordered.
const MANAGED_ORDER = ["w:pgSz", "w:pgMar", "w:cols"] as const;

/** Strip every self-closing (or paired) instance of `tag` from a sectPr fragment. */
function stripTag(sectPrInner: string, tag: string): string {
  const selfClosing = new RegExp(`<${tag}\\b[^>]*/>`, "g");
  const paired = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "g");
  return sectPrInner.replace(paired, "").replace(selfClosing, "");
}

/** Insert `elements` (already in MANAGED_ORDER) right after the leading
 *  headerReference/footerReference/footnotePr/endnotePr/type children (the
 *  CT_SectPr members that must precede pgSz/pgMar/cols), else at the very start. */
function insertManaged(sectPrInner: string, elements: string): string {
  if (!elements) return sectPrInner;
  const lead = /^(?:\s*<w:(?:headerReference|footerReference|footnotePr|endnotePr|type)\b[^>]*\/?>(?:[\s\S]*?<\/w:(?:headerReference|footerReference|footnotePr|endnotePr|type)>)?)+/;
  const m = sectPrInner.match(lead);
  if (m) {
    const at = m[0].length;
    return sectPrInner.slice(0, at) + elements + sectPrInner.slice(at);
  }
  return elements + sectPrInner;
}

/** Read current pgSz width/height (twips) from a sectPr fragment, if present. */
function readPgSz(sectPrInner: string): { w: number; h: number } | null {
  const m = sectPrInner.match(/<w:pgSz\b[^>]*\/?>/);
  if (!m) return null;
  const w = Number(m[0].match(/\bw:w="(\d+)"/)?.[1]);
  const h = Number(m[0].match(/\bw:h="(\d+)"/)?.[1]);
  return Number.isFinite(w) && Number.isFinite(h) ? { w, h } : null;
}

/** Read the existing pgMar header/footer margins (twips), defaulting to 720
 *  (matches PageLayoutManager.setMargins) — MARGIN_PRESETS carries neither. */
function readPgMarHF(inner: string): { header: number; footer: number } {
  const m = inner.match(/<w:pgMar\b[^>]*\/?>/);
  const header = Number(m?.[0].match(/\bw:header="(\d+)"/)?.[1]);
  const footer = Number(m?.[0].match(/\bw:footer="(\d+)"/)?.[1]);
  return {
    header: Number.isFinite(header) ? header : 720,
    footer: Number.isFinite(footer) ? footer : 720,
  };
}

function pgSzXml(w: number, h: number, orientation?: Orientation): string {
  const orient = orientation === "landscape" ? ` w:orient="landscape"` : "";
  return `<w:pgSz w:w="${w}" w:h="${h}"${orient}/>`;
}

function pgMarXml(p: (typeof MARGIN_PRESETS)[MarginPreset], header: number, footer: number): string {
  return `<w:pgMar w:top="${p.top}" w:right="${p.right}" w:bottom="${p.bottom}" w:left="${p.left}" w:header="${header}" w:footer="${footer}" w:gutter="${p.gutter}"/>`;
}

function colsXml(count: number): string {
  const n = Math.max(1, Math.min(3, Math.round(count)));
  // w:space="720" = 0.5" between columns, the default matching PageLayoutManager's
  // ColumnOptions.space.
  return `<w:cols w:num="${n}" w:space="720" w:equalWidth="1"/>`;
}

/** Grab the FIRST (self-closing or paired) instance of `tag` from a fragment, or null. */
function grabTag(inner: string, tag: string): string | null {
  return inner.match(new RegExp(`<${tag}\\b[^>]*/>`))?.[0]
      ?? inner.match(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`))?.[0]
      ?? null;
}

/** Re-emit the managed children (pgSz→pgMar→cols) in canonical MANAGED_ORDER,
 *  preserving any that were left untouched. Guarantees schema-correct sibling
 *  order regardless of the order individual edits happened to insert them. */
function normalizeManagedOrder(inner: string): string {
  const els = MANAGED_ORDER.map((t) => grabTag(inner, t));
  let stripped = inner;
  for (const t of MANAGED_ORDER) stripped = stripTag(stripped, t);
  return insertManaged(stripped, els.filter(Boolean).join(""));
}

export function applyBodyPageLayout(documentXml: string, opts: BodyPageLayoutOpts): string {
  const wants = opts.marginPreset || opts.orientation || opts.pageSizePreset || opts.columns != null;
  if (!wants) return documentXml;

  return editBodySectPr(documentXml, (sectPrXml) => {
    // `sectPrXml` is the FULL element — `<w:sectPr ...>…</w:sectPr>` or a
    // self-closing `<w:sectPr/>` — not just its inner content (OrderedBody
    // slices block xml from the opening `<` through the matching close tag).
    // Unwrap so the managed-child logic below operates on inner content only,
    // then re-wrap with the original open-tag attributes preserved.
    const openMatch = /<w:sectPr\b([^>]*?)(\/?)>/.exec(sectPrXml);
    if (!openMatch) return sectPrXml;
    const attrs = openMatch[1];
    const selfClosing = openMatch[2] === "/";
    const openEnd = openMatch.index + openMatch[0].length;
    const sectPrInner = selfClosing ? "" : sectPrXml.slice(openEnd, sectPrXml.lastIndexOf("</w:sectPr>"));

    let next = sectPrInner;

    if (opts.pageSizePreset || opts.orientation) {
      const base = opts.pageSizePreset
        ? { w: PAGE_SIZES[opts.pageSizePreset].w, h: PAGE_SIZES[opts.pageSizePreset].h }
        : readPgSz(sectPrInner) ?? { w: PAGE_SIZES.A4.w, h: PAGE_SIZES.A4.h };
      const cur = readPgSz(sectPrInner);
      const orient: Orientation =
        opts.orientation ?? (cur && cur.w > cur.h ? "landscape" : "portrait");
      const portraitW = Math.min(base.w, base.h);
      const portraitH = Math.max(base.w, base.h);
      const [w, h] = orient === "landscape" ? [portraitH, portraitW] : [portraitW, portraitH];
      next = stripTag(next, "w:pgSz");
      next = insertManaged(next, pgSzXml(w, h, orient === "landscape" ? "landscape" : undefined));
    }

    if (opts.marginPreset) {
      // Margin presets carry no header/footer — preserve the existing ones (or
      // 720) so we never emit w:header="undefined" nor wipe a real value.
      const hf = readPgMarHF(next);
      next = stripTag(next, "w:pgMar");
      next = insertManaged(next, pgMarXml(MARGIN_PRESETS[opts.marginPreset], hf.header, hf.footer));
    }

    if (opts.columns != null) {
      next = stripTag(next, "w:cols");
      next = insertManaged(next, colsXml(opts.columns));
    }

    // Individual inserts prepend at the same anchor (reversing order); normalize
    // once so the managed siblings end up in canonical pgSz→pgMar→cols order.
    next = normalizeManagedOrder(next);

    return `<w:sectPr${attrs}>${next}</w:sectPr>`;
  });
}
