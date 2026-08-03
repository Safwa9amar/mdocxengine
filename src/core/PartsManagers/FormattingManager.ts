import { ZipManager } from "@/utils/ZipManager";
import { cmToTwips } from "@/core/PartsManagers/PageLayoutManager";
import { applyPropsToRuns } from "@/core/PartsManagers/TextStyleManager";

const DOCUMENT_PATH = "word/document.xml";

/** Page margins in centimetres, expressed relative to the binding. */
export interface DocumentMargins {
  /** Top margin (cm). */
  top: number;
  /** Bottom margin (cm). */
  bottom: number;
  /** Inner margin on the binding side (cm) — the gutter side. */
  binding: number;
  /** Outer margin on the side opposite the binding (cm). */
  opposite: number;
}

/**
 * A document-wide formatting profile. Every field is optional; only the
 * provided ones are applied. Mirrors the kind of "norm profile" a university
 * imposes (font, size, line spacing, margins) and is applied uniformly across
 * the body via direct OOXML rewriting.
 */
export interface DocumentFormatting {
  /** Font family applied to ascii/hAnsi/cs of every `<w:rFonts>`. */
  font?: string;
  /** Font size in POINTS (written as half-points to `<w:sz>`/`<w:szCs>`). */
  fontSizePt?: number;
  /** Line spacing as a multiplier (1, 1.5, 2 → `<w:spacing w:line>` 240ths). */
  lineSpacing?: number;
  /** Page margins (cm). */
  margins?: DocumentMargins;
  /** Which side the binding is on — decides whether `binding`/`opposite` map to left/right. Default "left". */
  bindingSide?: "left" | "right";
}

/** Which transforms ran (`applied`) vs. failed (`skipped`). */
export interface FormattingResult {
  applied: string[];
  skipped: string[];
}

const spacingTo240ths = (multiplier: number): number => Math.round(multiplier * 240);

function applyFont(xml: string, font: string): string {
  // Route through the run-props primitive so this INSERTS w:rFonts on runs
  // that have none, rather than only rewriting ones that already exist (the
  // old regex-replace silently no-op'd against the seed thesis, which has
  // zero rFonts anywhere).
  return applyPropsToRuns(xml, { font }).xml;
}

function applyFontSize(xml: string, fontSizePt: number): string {
  // Same reasoning as applyFont: INSERT w:sz/w:szCs where absent instead of
  // only rewriting existing ones.
  return applyPropsToRuns(xml, { sizePt: fontSizePt }).xml;
}

function applySpacing(xml: string, lineSpacing: number): string {
  const lineVal = spacingTo240ths(lineSpacing);
  // Replace w:line="N" inside existing <w:spacing> elements.
  return xml.replace(
    /(<w:spacing\b[^>]*)\bw:line="\d+"([^>]*>)/g,
    `$1w:line="${lineVal}"$2`,
  );
}

function applyMargins(xml: string, margins: DocumentMargins, bindingSide: "left" | "right"): string {
  const top = cmToTwips(margins.top);
  const bottom = cmToTwips(margins.bottom);
  const binding = cmToTwips(margins.binding);
  const opposite = cmToTwips(margins.opposite);

  // The binding side gets the inner (binding) margin; the other side the outer.
  const left = bindingSide === "left" ? binding : opposite;
  const right = bindingSide === "left" ? opposite : binding;

  return xml.replace(
    /<w:pgMar\b[^/]*\/>/g,
    `<w:pgMar w:top="${top}" w:right="${right}" w:bottom="${bottom}" w:left="${left}" w:header="720" w:footer="720" w:gutter="0"/>`,
  );
}

/**
 * Applies a {@link DocumentFormatting} profile uniformly across the document body
 * by direct OOXML rewriting — font, font size, line spacing and page margins.
 * A coarse but deterministic "normalise the whole document" pass, distinct from
 * per-paragraph or style-based formatting.
 */
export class FormattingManager {
  constructor(private zip: ZipManager) {}

  /**
   * Apply the profile to `word/document.xml` in place. Returns which transforms
   * ran. Only fields present on `formatting` are attempted.
   */
  apply(formatting: DocumentFormatting): FormattingResult {
    const xml = this.zip.readAsText(DOCUMENT_PATH) ?? "";
    const { xml: out, result } = FormattingManager.applyToXml(xml, formatting);
    this.zip.addFile(DOCUMENT_PATH, Buffer.from(out, "utf-8"));
    return result;
  }

  /**
   * Pure transform: apply the profile to a `document.xml` string and return the
   * rewritten XML plus the applied/skipped breakdown. Useful when you already
   * hold the part bytes (e.g. a freshly merged buffer) and want to avoid a
   * second load.
   */
  static applyToXml(
    documentXml: string,
    formatting: DocumentFormatting,
  ): { xml: string; result: FormattingResult } {
    let xml = documentXml;
    const applied: string[] = [];
    const skipped: string[] = [];

    const step = (name: string, present: boolean, fn: () => string) => {
      if (!present) return;
      try {
        xml = fn();
        applied.push(name);
      } catch {
        skipped.push(name);
      }
    };

    step("font", formatting.font != null, () => applyFont(xml, formatting.font!));
    step("fontSize", formatting.fontSizePt != null, () => applyFontSize(xml, formatting.fontSizePt!));
    step("spacing", formatting.lineSpacing != null, () => applySpacing(xml, formatting.lineSpacing!));
    step("margins", formatting.margins != null, () =>
      applyMargins(xml, formatting.margins!, formatting.bindingSide ?? "left"),
    );

    return { xml, result: { applied, skipped } };
  }
}
