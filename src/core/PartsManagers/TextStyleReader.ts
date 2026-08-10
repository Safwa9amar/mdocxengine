/**
 * `get_text_style` — READ the font / size / bold / italic / colour actually in
 * force on a named PART of a thesis ("body", "heading3", "captions", …). The
 * read half of {@link TextStyleManager}, and deliberately its mirror image: the
 * same target names, resolved by the same {@link matchesTarget} predicate, so
 * "what font is the body in?" and "make the body Simplified Arabic 16" always
 * name the same set of paragraphs.
 *
 * Why this can't be a one-line `rFonts` grep: a run's rendered formatting is the
 * end of a CASCADE, and every rung of it is populated somewhere in this corpus.
 *   docDefaults → paragraph style (through its `w:basedOn` chain) → character
 *   style (`w:rStyle`) → direct `w:rPr`
 * Later wins. The seed `thesis-base.docx` puts nothing on its runs and doesn't
 * even define `Normal`, so a run-only read reports "no font" for a document
 * Word renders in Calibri; an imported thesis puts everything on the runs, so a
 * styles-only read reports the style's font while the student sees another. Only
 * walking the whole cascade answers the question the student actually asked.
 *
 * Two more things the shape of this data forces:
 *  - Latin and complex-script properties are reported SEPARATELY (`font` vs
 *    `fontCs`, `sizePt` vs `sizeCsPt`). In an Arabic thesis the Arabic text
 *    renders from `w:cs`/`w:szCs`; a document whose `w:ascii` says Times New
 *    Roman while `w:cs` says Traditional Arabic is normal, not a contradiction,
 *    and collapsing the two would report the half nobody is reading.
 *  - Every answer is WEIGHTED BY CHARACTERS and carries its share, because real
 *    theses are never uniform. "Simplified Arabic, 96%" plus the 4% that isn't
 *    is a true answer; "Simplified Arabic" alone is a guess that happens to be
 *    mostly right.
 *
 * Read-only throughout: nothing here writes a zip entry.
 */
import type AdmZip from "adm-zip";
import type { BlockInfo } from "@/Doc";
import DocumentManager from "@/core/PartsManagers/DocumentManager";
import { paragraphStyleId } from "@/core/files/body/OrderedBody";
import {
  TARGET_SPECS,
  eachParagraphIn,
  matchesTarget,
  type TextStyleTarget,
} from "@/core/PartsManagers/TextStyleManager";

const STYLES_PATH = "word/styles.xml";
const FOOTNOTES_PATH = "word/footnotes.xml";

/** How many alternative values a facet reports alongside its dominant one. */
const MAX_OTHERS = 3;
/** Cycle/depth guard for a `w:basedOn` walk. Real chains are 2–3 deep. */
const MAX_BASED_ON_DEPTH = 12;

/**
 * Run properties as OBSERVED in a document — the read counterpart of
 * {@link RunProps}, which describes what to WRITE.
 *
 * Every field is a tri-state: a value, `false` for a toggle explicitly turned
 * off (`<w:b w:val="0"/>`, which must beat an inherited bold rather than be
 * mistaken for "unspecified"), or `undefined` for "this rung of the cascade
 * says nothing", which is what lets a lower rung show through.
 */
export interface ObservedRunProps {
  /** Latin font — `w:rFonts/@w:ascii`, falling back to `@w:hAnsi`. */
  font?: string;
  /** Complex-script font — `w:rFonts/@w:cs`. What ARABIC text renders in. */
  fontCs?: string;
  /** Latin size in points (`w:sz`, stored as half-points). */
  sizePt?: number;
  /** Complex-script size in points (`w:szCs`). The size ARABIC text renders at. */
  sizeCsPt?: number;
  bold?: boolean;
  italic?: boolean;
  /** 6-digit upper-case hex, or the literal "auto". */
  color?: string;
}

/** The `ObservedRunProps` keys reported as facets, in output order. */
const FACET_KEYS = ["font", "fontCs", "sizePt", "sizeCsPt", "bold", "italic", "color"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

/** One value of one property, with the share of characters carrying it. */
export interface ValueShare {
  /** `null` means "the cascade specifies nothing here" — Word falls back to its own default. */
  value: string | number | boolean | null;
  /** Share of this target's characters, 0–1, rounded to 3 decimals. */
  share: number;
}

/** What one property resolves to across a whole target. */
export interface StyleFacet extends ValueShare {
  /** Runner-up values, share-descending — present only when the target is not uniform. */
  others?: ValueShare[];
}

/** What a target's text is formatted with, and where that formatting comes from. */
export interface TargetStyleReport {
  target: TextStyleTarget;
  /** Paragraphs matched (table-cell paragraphs for `tables`). 0 ⇒ this part is absent. */
  paragraphs: number;
  /** Characters weighed. 0 ⇒ matched paragraphs exist but are empty. */
  characters: number;
  /** The style id `set_text_style` would patch for this target. */
  styleId: string;
  /** Is that style actually DEFINED in `styles.xml`? Dangling refs are normal here. */
  styleDefined: boolean;
  /** `w:basedOn` chain walked, nearest first — `["Heading1", "Normal"]`. */
  styleChain: string[];
  /** What the style chain alone resolves to, before any direct run formatting. */
  styleProps: ObservedRunProps;
  /** What the text ACTUALLY renders with, per property. The answer to the question. */
  effective: Record<FacetKey, StyleFacet>;
  /** True when any property has more than one value across this target. */
  mixed: boolean;
}

/** {@link TextStyleReader.inspect} output. */
export interface TextStyleInspection {
  /** `styles.xml`'s `w:docDefaults` — the bottom rung, inherited by everything. */
  documentDefaults: ObservedRunProps;
  targets: TargetStyleReport[];
}

// ── rPr parsing ──────────────────────────────────────────────────────────────

/** Read one attribute off an element's opening tag. Word double-quotes; accept both. */
function attr(openTag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}=["']([^"']*)["']`).exec(openTag);
  return m && m[1] !== "" ? m[1] : undefined;
}

/**
 * An element's opening tag, whether it is self-closing or paired. The `(?=[\s/>])`
 * guard is what keeps `w:sz` from matching `w:szCs` — after "sz" comes "C",
 * which is none of space, slash or '>'.
 */
function openTagOf(inner: string, tag: string): string | undefined {
  return new RegExp(`<w:${tag}(?=[\\s/>])[^>]*>`).exec(inner)?.[0];
}

/**
 * An OOXML toggle: absent ⇒ `undefined`, present ⇒ true unless its `w:val`
 * explicitly says otherwise. `<w:b w:val="0"/>` is how Word records "bold OFF
 * here", overriding a bold style — reading it as absent would report the
 * inherited bold and be wrong about the one paragraph that isn't.
 */
function readToggle(inner: string, tag: string): boolean | undefined {
  const open = openTagOf(inner, tag);
  if (!open) return undefined;
  const val = attr(open, "w:val");
  return !(val !== undefined && /^(0|false|off)$/i.test(val));
}

/** Half-point measure (`w:sz`, `w:szCs`) as points. */
function readHalfPoints(inner: string, tag: string): number | undefined {
  const open = openTagOf(inner, tag);
  if (!open) return undefined;
  const val = attr(open, "w:val");
  if (val === undefined) return undefined;
  const n = Number(val);
  return Number.isFinite(n) && n > 0 ? n / 2 : undefined;
}

/**
 * Parse the INSIDE of a `<w:rPr>` into observed properties. The read inverse of
 * {@link mergeRunProps}: it reports only what this fragment states, never a
 * default, so callers can merge rungs of the cascade without a lower one
 * silently masking a higher one.
 */
export function parseRunProps(rPrInner: string): ObservedRunProps {
  const out: ObservedRunProps = {};
  if (!rPrInner) return out;

  const rFonts = openTagOf(rPrInner, "rFonts");
  if (rFonts) {
    // ascii and hAnsi are near-always identical; prefer ascii and fall back
    // rather than reporting a Latin font twice.
    const latin = attr(rFonts, "w:ascii") ?? attr(rFonts, "w:hAnsi");
    if (latin !== undefined) out.font = latin;
    const cs = attr(rFonts, "w:cs");
    if (cs !== undefined) out.fontCs = cs;
  }

  const sz = readHalfPoints(rPrInner, "sz");
  if (sz !== undefined) out.sizePt = sz;
  const szCs = readHalfPoints(rPrInner, "szCs");
  if (szCs !== undefined) out.sizeCsPt = szCs;

  // b/bCs are the Latin and complex-script twins of one property; either one
  // being on means the reader sees bold. Same for i/iCs.
  const bold = readToggle(rPrInner, "b") ?? readToggle(rPrInner, "bCs");
  if (bold !== undefined) out.bold = bold;
  const italic = readToggle(rPrInner, "i") ?? readToggle(rPrInner, "iCs");
  if (italic !== undefined) out.italic = italic;

  const color = openTagOf(rPrInner, "color");
  if (color) {
    const val = attr(color, "w:val");
    if (val !== undefined) out.color = /^auto$/i.test(val) ? "auto" : val.replace(/^#/, "").toUpperCase();
  }

  return out;
}

/** The character style a run references (`w:rStyle`), if any. */
function runCharStyleId(rPrInner: string): string | undefined {
  const open = openTagOf(rPrInner, "rStyle");
  return open ? attr(open, "w:val") : undefined;
}

/** Overlay `over` onto `under`; only properties `over` actually states win. */
function overlay(under: ObservedRunProps, over: ObservedRunProps): ObservedRunProps {
  const out: ObservedRunProps = { ...under };
  for (const key of FACET_KEYS) {
    const v = over[key];
    if (v !== undefined) (out as Record<string, unknown>)[key] = v;
  }
  return out;
}

// ── styles.xml index ─────────────────────────────────────────────────────────

interface StyleDef {
  id: string;
  type: string;
  name?: string;
  basedOn?: string;
  props: ObservedRunProps;
}

interface StylesIndex {
  byId: Map<string, StyleDef>;
  /** The `w:type="paragraph" w:default="1"` style a paragraph with no `w:pStyle` resolves to. */
  defaultParagraphStyleId: string;
  docDefaults: ObservedRunProps;
}

/** First `<w:rPr>…</w:rPr>` in a fragment, or "". */
function firstRPrInner(xml: string): string {
  return /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(xml)?.[1] ?? "";
}

/**
 * Index `styles.xml`: every `<w:style>`'s run properties and `w:basedOn`, plus
 * `w:docDefaults`. String surgery rather than an xml2js round-trip, matching
 * every other read on this file — and cheap enough to do once per inspection.
 */
export function parseStylesIndex(stylesXml: string | null | undefined): StylesIndex {
  const byId = new Map<string, StyleDef>();
  let defaultParagraphStyleId = "Normal";
  let docDefaults: ObservedRunProps = {};
  if (!stylesXml) return { byId, defaultParagraphStyleId, docDefaults };

  const rPrDefault = /<w:rPrDefault>([\s\S]*?)<\/w:rPrDefault>/.exec(stylesXml);
  if (rPrDefault) docDefaults = parseRunProps(firstRPrInner(rPrDefault[1]));

  const styleRe = /<w:style\b[^>]*>[\s\S]*?<\/w:style>/g;
  let m: RegExpExecArray | null;
  while ((m = styleRe.exec(stylesXml)) !== null) {
    const block = m[0];
    const open = /^<w:style\b[^>]*>/.exec(block)?.[0] ?? "";
    const id = attr(open, "w:styleId");
    if (!id) continue;
    const type = attr(open, "w:type") ?? "";
    // A style's `w:pPr` is CT_PPrGeneral and carries no `w:rPr` — but drop it
    // before the search anyway, so a malformed file can't hand us a paragraph
    // MARK's properties in place of the style's own.
    const withoutPPr = block.replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, "");
    byId.set(id, {
      id,
      type,
      name: /<w:name\b[^>]*\bw:val="([^"]*)"/.exec(block)?.[1],
      basedOn: /<w:basedOn\b[^>]*\bw:val="([^"]*)"/.exec(block)?.[1],
      props: parseRunProps(firstRPrInner(withoutPPr)),
    });
    if (type === "paragraph" && attr(open, "w:default") === "1") defaultParagraphStyleId = id;
  }

  return { byId, defaultParagraphStyleId, docDefaults };
}

/**
 * Resolve a style through its `w:basedOn` ancestry, base-first so the nearest
 * definition wins. Returns the chain too: an AI reporting "Heading1, which
 * inherits from Normal" is telling the student where to make the change.
 *
 * A dangling reference is the NORMAL state in this corpus (the seed thesis has
 * styles based on a `Normal` it never defines), so a missing link truncates the
 * walk instead of throwing.
 */
export function resolveStyleChain(
  styleId: string,
  index: StylesIndex,
): { chain: string[]; props: ObservedRunProps; defined: boolean } {
  const chain: string[] = [];
  const defs: StyleDef[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = styleId;

  while (cursor && !seen.has(cursor) && chain.length < MAX_BASED_ON_DEPTH) {
    seen.add(cursor);
    const def = index.byId.get(cursor);
    chain.push(cursor);
    if (!def) break; // dangling w:basedOn / w:pStyle — stop, don't throw
    defs.push(def);
    cursor = def.basedOn;
  }

  // Base-first: the furthest ancestor is overlaid by each descendant in turn.
  let props: ObservedRunProps = {};
  for (let i = defs.length - 1; i >= 0; i--) props = overlay(props, defs[i].props);

  return { chain, props, defined: index.byId.has(styleId) };
}

// ── aggregation ──────────────────────────────────────────────────────────────

/** Characters of visible text in a run — its weight in the tally. */
function runTextLength(runXml: string): number {
  let total = 0;
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(runXml)) !== null) total += m[1].length;
  return total;
}

type Tally = Map<FacetKey, Map<string, ValueShare & { chars: number }>>;

function newTally(): Tally {
  const t: Tally = new Map();
  for (const key of FACET_KEYS) t.set(key, new Map());
  return t;
}

interface Accumulator {
  paragraphs: number;
  characters: number;
  tally: Tally;
}

function record(acc: Accumulator, props: ObservedRunProps, chars: number): void {
  acc.characters += chars;
  for (const key of FACET_KEYS) {
    const value = props[key] ?? null;
    const bucket = acc.tally.get(key)!;
    // `null` (nothing in the cascade states this) needs a key of its own that
    // no real value can collide with, and a Map key must be a primitive.
    const k = value === null ? " none" : `${typeof value}:${value}`;
    const existing = bucket.get(k);
    if (existing) existing.chars += chars;
    else bucket.set(k, { value, share: 0, chars });
  }
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

function facetsOf(acc: Accumulator): { effective: Record<FacetKey, StyleFacet>; mixed: boolean } {
  const effective = {} as Record<FacetKey, StyleFacet>;
  let mixed = false;

  for (const key of FACET_KEYS) {
    const entries = [...acc.tally.get(key)!.values()].sort((a, b) => b.chars - a.chars);
    if (!entries.length || acc.characters === 0) {
      effective[key] = { value: null, share: 0 };
      continue;
    }
    if (entries.length > 1) mixed = true;
    const [top, ...rest] = entries;
    const facet: StyleFacet = { value: top.value, share: round3(top.chars / acc.characters) };
    if (rest.length) {
      facet.others = rest
        .slice(0, MAX_OTHERS)
        .map((e) => ({ value: e.value, share: round3(e.chars / acc.characters) }));
    }
    effective[key] = facet;
  }

  return { effective, mixed };
}

// ── the reader ───────────────────────────────────────────────────────────────

/**
 * Report what each named PART of a document is actually formatted with.
 *
 * @see TextStyleManager for the write side. Any change to `matchesTarget` or
 * `TARGET_SPECS` reaches both, which is the point: a read that scoped its
 * targets differently from the write would answer a question about text the
 * write then wouldn't touch.
 */
export class TextStyleReader {
  private zip: AdmZip;
  private doc: DocumentManager;

  constructor(zip: AdmZip) {
    this.zip = zip;
    this.doc = new DocumentManager(zip);
  }

  /**
   * @param targets    Already-expanded targets (see `expandTargets`).
   * @param blockInfos `Doc.blocks()` output, index-aligned 1:1 with
   *                   `DocumentManager.getBlocks()` — `matchesTarget` needs the
   *                   `headingLevel`/`styleId` a raw `BodyBlock` doesn't carry.
   */
  public async inspect(
    targets: readonly TextStyleTarget[],
    blockInfos: readonly BlockInfo[],
  ): Promise<TextStyleInspection> {
    const index = parseStylesIndex(this.zip.readAsText(STYLES_PATH));
    const styleCache = new Map<string, ReturnType<typeof resolveStyleChain>>();
    const resolve = (id: string) => {
      let hit = styleCache.get(id);
      if (!hit) {
        hit = resolveStyleChain(id, index);
        styleCache.set(id, hit);
      }
      return hit;
    };

    const reports: TargetStyleReport[] = [];
    const bodyTargets = targets.filter((t) => TARGET_SPECS[t].part === "body");

    if (bodyTargets.length) {
      const blocks = await this.doc.getBlocks();
      for (const target of bodyTargets) {
        const acc: Accumulator = { paragraphs: 0, characters: 0, tally: newTally() };
        for (let i = 0; i < blocks.length; i++) {
          const info = blockInfos[i];
          if (!info || !matchesTarget(target, info, blocks[i].xml)) continue;
          this.collect(blocks[i].xml, index, resolve, acc);
        }
        reports.push(this.report(target, acc, index, resolve));
      }
    }

    if (targets.includes("footnotes")) {
      const acc: Accumulator = { paragraphs: 0, characters: 0, tally: newTally() };
      const xml = this.zip.readAsText(FOOTNOTES_PATH);
      // No footnotes part at all is the ordinary case, not an error — it reports
      // as an absent target (0 paragraphs), same as a document with no captions.
      if (xml) {
        for (const note of eachFootnote(xml)) this.collect(note, index, resolve, acc);
      }
      reports.push(this.report("footnotes", acc, index, resolve));
    }

    return { documentDefaults: index.docDefaults, targets: reports };
  }

  /**
   * Walk every paragraph in a block (cell paragraphs included, at any depth for
   * a `tables` target) and tally each run's effective properties.
   */
  private collect(
    xml: string,
    index: StylesIndex,
    resolve: (id: string) => ReturnType<typeof resolveStyleChain>,
    acc: Accumulator,
  ): void {
    for (const para of eachParagraphIn(xml)) {
      acc.paragraphs++;
      // No `w:pStyle` ⇒ the document's default paragraph style, per the cascade.
      const paraStyleId = paragraphStyleId(para.xml) ?? index.defaultParagraphStyleId;
      const paraBase = overlay(index.docDefaults, resolve(paraStyleId).props);

      const runRe = /<w:r(?=[\s>])[^>]*>[\s\S]*?<\/w:r>/g;
      let m: RegExpExecArray | null;
      while ((m = runRe.exec(para.xml)) !== null) {
        const chars = runTextLength(m[0]);
        // Weight by visible text: an empty run, a bookmark or a drawing wrapper
        // carries formatting nobody can see, and counting them would let a
        // document's invisible runs outvote its actual text.
        if (chars === 0) continue;
        const rPrInner = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(m[0])?.[1] ?? "";
        const direct = parseRunProps(rPrInner);
        const charStyle = runCharStyleId(rPrInner);
        let props = paraBase;
        if (charStyle) props = overlay(props, resolve(charStyle).props);
        record(acc, overlay(props, direct), chars);
      }
    }
  }

  private report(
    target: TextStyleTarget,
    acc: Accumulator,
    index: StylesIndex,
    resolve: (id: string) => ReturnType<typeof resolveStyleChain>,
  ): TargetStyleReport {
    const styleId = TARGET_SPECS[target].styleIds[0];
    const resolved = resolve(styleId);
    const { effective, mixed } = facetsOf(acc);
    return {
      target,
      paragraphs: acc.paragraphs,
      characters: acc.characters,
      styleId,
      styleDefined: resolved.defined,
      styleChain: resolved.chain,
      styleProps: overlay(index.docDefaults, resolved.props),
      effective,
      mixed,
    };
  }
}

/**
 * Each real footnote's XML. The separator/continuation footnotes Word puts at
 * ids -1 and 0 hold a horizontal rule, not text, and would tally as body-styled
 * empty paragraphs; they are skipped by their `w:type`.
 */
function eachFootnote(xml: string): string[] {
  const out: string[] = [];
  const re = /<w:footnote\b([^>]*)>([\s\S]*?)<\/w:footnote>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (/\sw:type=["'][^"']+["']/.test(m[1])) continue;
    out.push(m[2]);
  }
  return out;
}
