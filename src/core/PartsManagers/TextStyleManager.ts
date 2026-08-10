/**
 * `set_text_style` — apply font / size / bold / italic / colour to a named PART
 * of a thesis ("body", "heading3", "captions", "footnotes", …) rather than the
 * whole document.
 *
 * OOXML resolution order (later wins): docDefaults → table style → numbering →
 * paragraph style → character style → direct w:pPr → direct w:rPr. Direct run
 * formatting always beats a style. That cuts both ways:
 *  - The seed thesis has no `Normal` style, no `docDefaults`, and zero
 *    `rFonts`/`sz` anywhere — a direct rewrite finds nothing to rewrite.
 *  - Imported theses carry formatting on the RUNS (`rFonts w:cs`, `szCs`) — a
 *    clean style patch is correct, valid, and completely invisible.
 *
 * So the write is three steps per target: patch the style → strip ONLY the
 * named property from that target's runs so the style shows through →
 * direct-write the runs of any paragraph that would not have resolved to the
 * target's style anyway. See {@link TextStyleManager.apply}.
 */
import type AdmZip from "adm-zip";
import type { BlockInfo } from "@/Doc";
import DocumentManager from "@/core/PartsManagers/DocumentManager";
import { StylesManager, type EnsureStyleSpec } from "@/core/PartsManagers/StylesManager";
import { CAPTION_PARA_STYLE } from "@/core/PartsManagers/CaptionManager";
import { paragraphStyleId } from "@/core/files/body/OrderedBody";
import { mergeRunProps, propTagsFor, stripRunPropTags, type RunProps } from "@/core/ooxml/runProps";

const FOOTNOTES_PATH = "word/footnotes.xml";

export type TextStyleTarget =
  | "body" | "heading1" | "heading2" | "heading3" | "heading4" | "heading5" | "heading6"
  | "title" | "captions" | "lists" | "tables" | "footnotes";

export type TextStyleTargetInput = TextStyleTarget | "headings";

const HEADING_TARGETS: TextStyleTarget[] = [
  "heading1", "heading2", "heading3", "heading4", "heading5", "heading6",
];

/** Every recognised target, for validation + error messages. */
const ALL_TARGETS: TextStyleTarget[] = [
  "body", ...HEADING_TARGETS, "title", "captions", "lists", "tables", "footnotes",
];

/** Styles `body` must NOT claim — each has a target of its own. */
const NON_BODY_STYLES = new Set(["Caption", "ListParagraph", "Title", "Header", "Footer"]);

export interface TargetSpec {
  /** Style id(s) this target's runs are expected to resolve to. */
  styleIds: string[];
  /** Minimal style to create when absent, via string surgery. */
  ensure?: EnsureStyleSpec;
  /** Defer creation to a manager that owns a RICH definition. See Decision B. */
  richEnsure?: "caption";
  /** Which OOXML part the target's RUN edits happen in. The style patch itself
   *  always lands in `word/styles.xml` regardless of this field. */
  part: "body" | "footnotes";
}

export const TARGET_SPECS: Record<TextStyleTarget, TargetSpec> = {
  body: { styleIds: ["Normal"], ensure: { name: "Normal", isDefault: true }, part: "body" },
  heading1: { styleIds: ["Heading1"], part: "body" },
  heading2: { styleIds: ["Heading2"], part: "body" },
  heading3: { styleIds: ["Heading3"], part: "body" },
  heading4: { styleIds: ["Heading4"], part: "body" },
  heading5: { styleIds: ["Heading5"], part: "body" },
  heading6: { styleIds: ["Heading6"], part: "body" },
  title: { styleIds: ["Title"], part: "body" },
  // No `ensure`: CaptionManager owns the real Word Caption definition and only
  // creates it when the ID is ABSENT, so a bare one from us would permanently
  // suppress the rich one. See Decision B.
  captions: { styleIds: ["Caption"], richEnsure: "caption", part: "body" },
  lists: { styleIds: ["ListParagraph"], part: "body" },
  // Cell paragraphs normally carry no pStyle, so they resolve to Normal — the
  // style `body` also owns. The targets differ by PREDICATE, not style: picking
  // `body` alone leaves table-cell run overrides in place.
  tables: { styleIds: ["Normal"], ensure: { name: "Normal", isDefault: true }, part: "body" },
  footnotes: { styleIds: ["FootnoteText"], part: "footnotes" },
};

/**
 * Expand `"headings"` into the six `headingN` targets, de-duplicate, and
 * validate every entry. Throws — rather than silently dropping an unrecognised
 * target — because a caller asking to restyle "bodytext" almost certainly
 * mistyped "body", and a silent no-op there would ship broken formatting to a
 * live thesis with no signal anything went wrong.
 */
export function expandTargets(targets: readonly string[]): TextStyleTarget[] {
  const out = new Set<TextStyleTarget>();
  for (const raw of targets) {
    if (raw === "headings") {
      for (const h of HEADING_TARGETS) out.add(h);
      continue;
    }
    if (!(ALL_TARGETS as string[]).includes(raw)) {
      throw new Error(
        `TextStyleManager.expandTargets: unknown target '${raw}'. Valid targets: ${[...ALL_TARGETS, "headings"].join(", ")}`,
      );
    }
    out.add(raw as TextStyleTarget);
  }
  return [...out];
}

/** True when a paragraph's own XML carries `<w:numPr>` (a numbered/list item). */
function hasNumPr(xml: string): boolean {
  return /<w:numPr\b/.test(xml);
}

/**
 * Does `block` belong to `target`? A cheap, style-id/heading-level PREDICATE —
 * not full cascade resolution. `footnotes` always returns false here: footnote
 * runs live in `word/footnotes.xml`, a different part, and are matched against
 * that part directly rather than against body `BlockInfo`s.
 *
 * `body` deliberately EXCLUDES a numbered paragraph even though it carries no
 * heading/caption/list/title style — a numbered paragraph belongs to exactly
 * one target (`lists`), or `body` and `lists` would both claim it and the
 * second strip pass would fight the first.
 *
 * `headingN` matches on `headingLevel`, not the literal style id — this stays
 * correct for French ("Titre3") and outline-level-only imports that carry no
 * named heading style, both of which `paragraphHeadingLevel` already folds in.
 * The one style id excluded explicitly is "Title": `headingLevelFromStyleId`
 * maps a Title paragraph to heading level 1 too (it doubles as the document's
 * H1 for outline purposes), but a Title paragraph is its own target and must
 * not be swept into `heading1`.
 */
export function matchesTarget(target: TextStyleTarget, block: BlockInfo, xml: string): boolean {
  switch (target) {
    case "tables":
      return block.kind === "table";
    case "footnotes":
      return false;
    case "captions":
      return block.kind === "paragraph" && block.styleId === "Caption";
    case "title":
      return block.kind === "paragraph" && block.styleId === "Title";
    case "lists":
      return block.kind === "paragraph" && (hasNumPr(xml) || block.styleId === "ListParagraph");
    case "body":
      return (
        block.kind === "paragraph" &&
        block.headingLevel === 0 &&
        !hasNumPr(xml) &&
        !(block.styleId !== null && NON_BODY_STYLES.has(block.styleId))
      );
    default: {
      const m = /^heading([1-6])$/.exec(target);
      if (!m) return false;
      return block.kind === "paragraph" && block.headingLevel === Number(m[1]) && block.styleId !== "Title";
    }
  }
}

/**
 * Would a paragraph carrying `styleId` (or no style at all) resolve to one of
 * `styleIds` under ordinary OOXML cascade resolution, AND did Phase 2 actually
 * land a patch on that style? A paragraph with no `w:pStyle` resolves to
 * `Normal`; a paragraph with a `w:pStyle` resolves to that style, full stop —
 * no cheap approximation needed there. No cascade walk (e.g. through
 * `w:basedOn` chains): the targets this feature deals with are all direct,
 * single-level styles.
 *
 * `stylePatched` is the second, load-bearing half of this check. Style-id
 * membership alone is not enough: dangling style references are the NORMAL
 * state in this corpus (the seed `thesis-base.docx` has styles declaring
 * `basedOn="Normal"`/`basedOn="DefaultParagraphFont"` while defining neither),
 * so a paragraph can carry `w:pStyle="Heading3"` while `styles.xml` has no
 * `Heading3` entry at all. `headingN`/`title`/`lists`/`footnotes` carry no
 * `ensure`, so Phase 2's `setStyleRunProps` silently no-ops when the style is
 * missing (`created: false, updated: false`). Stripping that paragraph's runs
 * on style-id membership alone would remove its formatting and leave nothing
 * behind to supply a replacement — a change that reports success while making
 * the document worse, exactly what this feature exists to prevent. Only strip
 * when the style patch actually happened; otherwise fall through to a direct
 * write, which is always safe regardless of what styles.xml contains.
 */
function resolvesToPatchedStyle(
  styleId: string | null,
  styleIds: readonly string[],
  stylePatched: boolean,
): boolean {
  if (!stylePatched) return false;
  return styleId !== null ? styleIds.includes(styleId) : styleIds.includes("Normal");
}

/**
 * Strip only the `w:rPr` children `props` owns from every RUN (`<w:r>…</w:r>`)
 * in `xml` — never from a `<w:rPr>` that is a direct child of `<w:pPr>` (the
 * paragraph MARK's properties, not a run's). An emptied `<w:rPr></w:rPr>` is
 * removed outright rather than left as dead weight.
 *
 * This is what makes a style patch visible: direct run formatting always beats
 * a style in the OOXML cascade, so patching `Normal`'s `w:rPr` accomplishes
 * nothing for a run that still carries its own `<w:sz w:val="28"/>`.
 */
export function stripPropsFromRuns(xml: string, props: RunProps): { xml: string; stripped: number } {
  const tags = propTagsFor(props);
  if (!tags.length) return { xml, stripped: 0 };

  let stripped = 0;
  const runRe = /<w:r(?=[\s>])[^>]*>[\s\S]*?<\/w:r>/g;
  const out = xml.replace(runRe, (run) => {
    const rPrMatch = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(run);
    if (!rPrMatch) return run;

    const before = rPrMatch[1];
    const after = stripRunPropTags(before, tags);
    if (after === before) return run; // this run never carried the property

    stripped++;
    const head = run.slice(0, rPrMatch.index);
    const tail = run.slice(rPrMatch.index + rPrMatch[0].length);
    return after.trim() === "" ? `${head}${tail}` : `${head}<w:rPr>${after}</w:rPr>${tail}`;
  });

  return { xml: out, stripped };
}

/**
 * Write `props` onto EVERY run in `xml`, creating `<w:rPr>` right after the
 * run's own start tag when it has none. Used for paragraphs that would not
 * have resolved to the target's patched style anyway — the only way those
 * still pick up the requested formatting.
 *
 * Per-run try/catch (Decision A): `mergeRunProps` calls
 * `canonicalizeRunProps`, which THROWS on malformed markup. This runs over
 * EVERY run in a 200-page thesis; letting one comment-bearing or malformed run
 * abort the whole pass would silently fail every other run's edit too. A
 * throwing run is left byte-for-byte unchanged and counted in `skipped`
 * instead. This is deliberately NOT the whole-category `step()` try/catch
 * FormattingManager uses elsewhere — that granularity would abandon every run
 * in the pass over one bad one, which is the wrong scope here.
 */
export function applyPropsToRuns(xml: string, props: RunProps): { xml: string; written: number; skipped: number } {
  let written = 0;
  let skipped = 0;
  const runRe = /<w:r(?=[\s>])[^>]*>[\s\S]*?<\/w:r>/g;

  const out = xml.replace(runRe, (run) => {
    try {
      const rPrMatch = /<w:rPr>([\s\S]*?)<\/w:rPr>/.exec(run);
      const nextInner = mergeRunProps(rPrMatch ? rPrMatch[1] : "", props);

      let result: string;
      if (rPrMatch) {
        const head = run.slice(0, rPrMatch.index);
        const tail = run.slice(rPrMatch.index + rPrMatch[0].length);
        result = `${head}<w:rPr>${nextInner}</w:rPr>${tail}`;
      } else {
        const openMatch = /^<w:r(?:\s[^>]*)?>/.exec(run);
        const openLen = openMatch ? openMatch[0].length : 0;
        result = `${run.slice(0, openLen)}<w:rPr>${nextInner}</w:rPr>${run.slice(openLen)}`;
      }
      written++;
      return result;
    } catch {
      skipped++;
      return run; // leave this ONE run byte-for-byte unchanged; every other run still gets written
    }
  });

  return { xml: out, written, skipped };
}

/**
 * Every outermost `<w:p>…</w:p>` inside a block's XML, in document order. A
 * `tables` target block is a whole `<w:tbl>` — its cell paragraphs are nested
 * several levels deep, and this walks in regardless of depth. Mirrors
 * `CaptionManager`'s private `eachParagraph`; duplicated rather than imported
 * because that helper is not exported and this task's scope is limited to the
 * one-line `CAPTION_PARA_STYLE` export (Decision B).
 *
 * Exported for `TextStyleReader`, which must walk a target's paragraphs exactly
 * the way the write does or it would report on text the write wouldn't touch.
 */
export function eachParagraphIn(xml: string): Array<{ start: number; end: number; xml: string }> {
  const out: Array<{ start: number; end: number; xml: string }> = [];
  const re = /<w:p\b[^>]*?(\/?)>|<\/w:p>/g;
  const stack: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[0] === "</w:p>") {
      const start = stack.pop();
      if (start !== undefined && stack.length === 0) {
        out.push({ start, end: re.lastIndex, xml: xml.slice(start, re.lastIndex) });
      }
    } else if (m[1] !== "/") {
      stack.push(m.index);
    }
  }
  return out;
}

/**
 * Strip-or-direct-write every paragraph nested inside a block, given
 * `styleIds`. `stylePatched` must reflect whether Phase 2 actually created or
 * updated the target's style (see {@link resolvesToPatchedStyle}) — when
 * false, every paragraph here falls through to a direct write regardless of
 * its own `w:pStyle`, since stripping would have nothing left to fall back on.
 */
function restyleParagraphsIn(
  xml: string,
  styleIds: readonly string[],
  props: RunProps,
  stylePatched: boolean,
): { xml: string; stripped: number; skipped: number; written: number; paragraphsAffected: number } {
  let out = xml;
  let stripped = 0;
  let skipped = 0;
  let written = 0;
  const paras = eachParagraphIn(out);

  // Back-to-front so earlier offsets stay valid as later ones are rewritten.
  for (let i = paras.length - 1; i >= 0; i--) {
    const para = paras[i];
    const styleId = paragraphStyleId(para.xml);
    let nextXml: string;
    if (resolvesToPatchedStyle(styleId, styleIds, stylePatched)) {
      const r = stripPropsFromRuns(para.xml, props);
      nextXml = r.xml;
      stripped += r.stripped;
    } else {
      const r = applyPropsToRuns(para.xml, props);
      nextXml = r.xml;
      written += r.written;
      skipped += r.skipped;
    }
    out = out.slice(0, para.start) + nextXml + out.slice(para.end);
  }

  return { xml: out, stripped, skipped, written, paragraphsAffected: paras.length };
}

/** Per-target outcome of {@link TextStyleManager.apply}. */
export interface TargetReport {
  target: TextStyleTarget;
  /** The style id patched in `word/styles.xml` for this target. */
  styleId: string;
  /** True if the style did not exist and was created (Phase 1 or Phase 2). */
  styleCreated: boolean;
  /** True if the style's `w:rPr` was rewritten (already existed or just created). */
  styleTouched: boolean;
  /** Runs whose named property was stripped so the patched style shows through. */
  runsStripped: number;
  /** Runs the per-run pass could not parse and left untouched (Decision A). */
  runsSkipped: number;
  /** Runs written directly because their paragraph would not resolve to the target's style. */
  directWrites: number;
  /** Paragraphs (or table-cell paragraphs) considered for this target. */
  paragraphsAffected: number;
}

/**
 * Apply a font/size/bold/italic/colour change to named PARTS of a thesis
 * ("body", "heading3", "captions", "footnotes", …).
 *
 * Three strictly ordered phases per {@link apply}:
 *  1. Object-model style ENSURES — today, only `captions`, via CaptionManager's
 *     own rich `Caption` definition (Decision B).
 *  2. String-surgery style PATCHES — `StylesManager.setStyleRunProps` for every
 *     selected target's style id.
 *  3. Body/footnote RUN edits — strip the named property from runs that would
 *     resolve to the now-patched style; direct-write everything else.
 *
 * Phase 2 must never run after Phase 3 starts, and Phase 1 must never run
 * after Phase 2: `StylesManager.addStyle` round-trips the ENTIRE styles.xml
 * through an xml2js object model (parse → pretty-print), while
 * `setStyleRunProps` is string surgery on the same file. An object-model
 * write after string surgery can reformat or disturb it — so object-model
 * ensures come first, string surgery always comes last within styles.xml.
 */
export class TextStyleManager {
  private zip: AdmZip;
  private styles: StylesManager;
  private doc: DocumentManager;

  constructor(zip: AdmZip) {
    this.zip = zip;
    this.styles = new StylesManager(zip);
    this.doc = new DocumentManager(zip);
  }

  /**
   * @param targets    Target names (accepts the `"headings"` shorthand).
   * @param props      Which run properties to force, and to what value.
   * @param blockInfos `Doc.blocks()` output, index-aligned 1:1 with
   *                    `DocumentManager.getBlocks()`. Required because
   *                    `BodyBlock` alone doesn't carry `headingLevel`/`styleId`.
   */
  public async apply(
    targets: readonly string[],
    props: RunProps,
    blockInfos: readonly BlockInfo[],
  ): Promise<TargetReport[]> {
    const resolved = expandTargets(targets);

    // ── Phase 1 — object-model ensures ──────────────────────────────────────
    for (const target of resolved) {
      if (TARGET_SPECS[target].richEnsure === "caption") {
        // addStyle() is itself a no-op when the id already exists, matching
        // CaptionManager.ensureStyles()'s own "create only if absent" contract.
        await this.styles.addStyle(CAPTION_PARA_STYLE);
      }
    }

    // ── Phase 2 — string-surgery style patches (always after Phase 1, always
    // before Phase 3) ────────────────────────────────────────────────────────
    const styleResults = new Map<TextStyleTarget, { created: boolean; updated: boolean }>();
    for (const target of resolved) {
      const spec = TARGET_SPECS[target];
      const styleId = spec.styleIds[0];
      // `body` and `tables` both patch "Normal" — calling this twice when both
      // are selected is idempotent (the second call re-merges identical props
      // onto an already-patched fragment) and harmless.
      const result = await this.styles.setStyleRunProps(styleId, props, spec.ensure);
      styleResults.set(target, result);
    }

    // ── Phase 3 — body/run edits ─────────────────────────────────────────────
    const reports: TargetReport[] = [];
    const bodyTargets = resolved.filter((t) => TARGET_SPECS[t].part === "body");

    if (bodyTargets.length) {
      const blocks = await this.doc.getBlocks();
      let bodyChanged = false;

      for (const target of bodyTargets) {
        const spec = TARGET_SPECS[target];
        const styleId = spec.styleIds[0];
        const sr = styleResults.get(target);
        // GATE: a paragraph is only "covered by the style patch" (and safe to
        // strip) when Phase 2 actually created or touched this style. Style-id
        // membership alone is not enough — dangling `w:pStyle` references
        // (e.g. a paragraph styled "Heading3" with no `Heading3` entry in
        // styles.xml) are the NORMAL state in this corpus, and stripping a
        // run's own formatting with nothing patched to replace it would strand
        // that paragraph with none at all. See {@link resolvesToPatchedStyle}.
        const stylePatched = Boolean(sr?.created || sr?.updated);
        let runsStripped = 0;
        let runsSkipped = 0;
        let directWrites = 0;
        let paragraphsAffected = 0;

        for (let i = 0; i < blocks.length; i++) {
          const block = blocks[i];
          const info = blockInfos[i];
          if (!info || !matchesTarget(target, info, block.xml)) continue;

          if (target === "tables") {
            const r = restyleParagraphsIn(block.xml, spec.styleIds, props, stylePatched);
            block.xml = r.xml;
            runsStripped += r.stripped;
            runsSkipped += r.skipped;
            directWrites += r.written;
            paragraphsAffected += r.paragraphsAffected;
            if (r.stripped || r.written) bodyChanged = true;
            continue;
          }

          paragraphsAffected++;
          if (resolvesToPatchedStyle(info.styleId, spec.styleIds, stylePatched)) {
            const r = stripPropsFromRuns(block.xml, props);
            block.xml = r.xml;
            runsStripped += r.stripped;
            if (r.stripped) bodyChanged = true;
          } else {
            const r = applyPropsToRuns(block.xml, props);
            block.xml = r.xml;
            directWrites += r.written;
            runsSkipped += r.skipped;
            if (r.written) bodyChanged = true;
          }
        }

        reports.push({
          target,
          styleId,
          styleCreated: sr?.created ?? false,
          styleTouched: sr?.updated ?? false,
          runsStripped,
          runsSkipped,
          directWrites,
          paragraphsAffected,
        });
      }

      if (bodyChanged) await this.doc.saveBlocks(blocks);
    }

    if (resolved.includes("footnotes")) {
      reports.push(await this.applyFootnotes(props, styleResults.get("footnotes")));
    }

    return reports;
  }

  /** Phase 3 for the `footnotes` target — a separate part, `word/footnotes.xml`. */
  private async applyFootnotes(
    props: RunProps,
    styleResult: { created: boolean; updated: boolean } | undefined,
  ): Promise<TargetReport> {
    const spec = TARGET_SPECS.footnotes;
    const styleId = spec.styleIds[0];
    const base: TargetReport = {
      target: "footnotes",
      styleId,
      styleCreated: styleResult?.created ?? false,
      styleTouched: styleResult?.updated ?? false,
      runsStripped: 0,
      runsSkipped: 0,
      directWrites: 0,
      paragraphsAffected: 0,
    };

    const xml = this.zip.readAsText(FOOTNOTES_PATH);
    if (!xml) return base; // no footnotes part — nothing to do, not an error

    const stylePatched = Boolean(styleResult?.created || styleResult?.updated);
    const r = restyleParagraphsIn(xml, spec.styleIds, props, stylePatched);
    if (r.stripped || r.written) {
      this.zip.addFile(FOOTNOTES_PATH, Buffer.from(r.xml, "utf-8"));
    }

    return {
      ...base,
      runsStripped: r.stripped,
      runsSkipped: r.skipped,
      directWrites: r.written,
      paragraphsAffected: r.paragraphsAffected,
    };
  }
}
