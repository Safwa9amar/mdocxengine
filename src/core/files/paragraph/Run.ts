import { Builder } from "xml2js";
import { Run as RunInterFace, RunProperties, Field, Drawing } from "./types";

/**
 * A class to represent and manipulate a single WordprocessingML run (<w:r>).
 */
export class Run {
  private run: RunInterFace;

  constructor(run: RunInterFace) {
    if (!run) throw new Error("Invalid run: run object is required");
    this.run = run;
  }

  /**
   * Get the raw run object.
   */
  public getRaw(): RunInterFace {
    return this.run;
  }
  /**
   * Get the text content of the run.
   */
  public getText(): string {
    const wT = this.run?.["w:t"];

    if (!wT) return "";

    // If it's a string, return directly
    if (typeof wT === "string") {
      return wT;
    }

    // If it's an array of TextNodes, join all text parts
    if (Array.isArray(wT)) {
      return wT.map((t) => t._ || "").join("");
    }

    // Otherwise, it's a single TextNode
    return wT._ || "";
  }

  /**
   * Set or replace the text content of the run.
   * @param newText - The new text to set.
   */
  public setText(newText: string): void {
    const wT = this.run["w:t"];

    // CASE 1: w:t does not exist -> create a new TextNode
    if (!wT) {
      this.run["w:t"] = { _: newText, $: {} };
      return;
    }

    // CASE 2: w:t is a string -> replace with a TextNode
    if (typeof wT === "string") {
      this.run["w:t"] = { _: newText, $: {} };
      return;
    }

    // CASE 3: w:t is an array of TextNodes
    if (Array.isArray(wT)) {
      if (wT.length === 0) {
        wT.push({ _: newText, $: {} });
      } else {
        wT[0]._ = newText; // Replace only the first node
      }
      return;
    }

    // CASE 4: w:t is a single TextNode
    wT._ = newText;
  }

  /**
   * Append text to the existing text in the run.
   * @param textToAppend - Text to append.
   */
  public appendText(textToAppend: string): void {
    const currentText = this.getText();
    this.setText(currentText + textToAppend);
  }

  /**
   * Get the run's formatting properties (<w:rPr>).
   */
  public getProperties(): RunProperties | undefined {
    return this.run["w:rPr"];
  }

  /**
   * Ensure the run has a <w:rPr> object to work with.
   */
  private ensureProperties(): RunProperties {
    if (!this.run["w:rPr"]) {
      this.run["w:rPr"] = {};
    }
    return this.run["w:rPr"];
  }

  /**
   * Set bold formatting.
   */
  public setBold(enable = true): void {
    const props = this.ensureProperties();
    if (enable) {
      props["w:b"] = {};
    } else {
      delete props["w:b"];
    }
  }

  /**
   * Set italic formatting.
   */
  public setItalic(enable = true): void {
    const props = this.ensureProperties();
    if (enable) {
      props["w:i"] = {};
    } else {
      delete props["w:i"];
    }
  }

  /**
   * Set underline formatting with optional style.
   * @param style - Underline style (e.g., "single", "double")
   */
  public setUnderline(enable = true, style = "single"): void {
    const props = this.ensureProperties();
    if (enable) {
      props["w:u"] = {
        $: { "w:val": style },
        "w:sh": { $: { "w:fill": "000000", "w:val": "clear" } },
      };
    } else {
      delete props["w:u"];
    }
  }

  /**
   * Set shading (background color) for the run.
   */
  public setShading(color = "FFFF00", value = "clear"): void {
    const props = this.ensureProperties();
    props["w:shd"] = {
      $: {
        "w:fill": color,
        "w:val": value,
      },
    };
  }

  /**
   * Remove shading.
   */
  public removeShading(): void {
    const props = this.ensureProperties();
    delete props["w:shd"];
  }

  /**
   * Mark the run as right-to-left (`<w:rtl/>`) so Word shapes Arabic / Hebrew
   * text correctly. Pass `false` to remove the marker.
   */
  public setRtl(enable = true): void {
    const props = this.ensureProperties();
    if (enable) {
      props["w:rtl"] = {};
    } else {
      delete props["w:rtl"];
    }
  }

  /** Determine if the run is marked right-to-left. */
  public isRtl(): boolean {
    const rPr = this.run["w:rPr"];
    return rPr != null && "w:rtl" in rPr;
  }

  /**
   * Determine if the run is bold.
   */
  public isBold(): boolean {
    const rPr = this.run["w:rPr"];
    return rPr != null && "w:b" in rPr;
  }

  /**
   * Determine if the run is italic.
   */
  public isItalic(): boolean {
    const rPr = this.run["w:rPr"];
    return rPr != null && "w:i" in rPr;
  }

  /**
   * Check if the run has underline formatting.
   */
  public hasUnderline(): boolean {
    const rPr = this.run["w:rPr"];
    return rPr != null && "w:u" in rPr;
  }

  /**
   * Determine if the run is empty (no text and no special fields).
   */
  public isEmpty(): boolean {
    return !this.getText() && !this.run["w:fldChar"] && !this.run["w:drawing"];
  }
  /**
   * Add a field to the run, like a page number or TOC reference.
   */
  public setField(fieldType: "begin" | "end", instrText?: string): void {
    // Add <w:fldChar w:fldCharType="begin"/> or <w:fldChar w:fldCharType="end"/>
    this.run["w:fldChar"] = {
      $: {
        "w:fldCharType": fieldType,
      },
    };

    // Optionally add <w:instrText>...</w:instrText>
    if (instrText) {
      this.run["w:instrText"] = {
        _: instrText,
        $: {},
      };
    }
  }

  /**
   * Add a drawing (image or graphic) to the run.
   */
  public setDrawing(drawing: Drawing): void {
    (this.run as any)["w:drawing"] = drawing["w:drawing"];
  }

  /**
   * Set font size.
   * @param halfPoints Size in half-points (e.g. 24 = 12pt, 28 = 14pt).
   */
  public setFontSize(halfPoints: number): void {
    const props = this.ensureProperties();
    (props as any)["w:sz"] = { $: { "w:val": String(halfPoints) } };
    (props as any)["w:szCs"] = { $: { "w:val": String(halfPoints) } };
  }

  /**
   * Set font family.
   * @param ascii  Font name for ASCII/Latin characters.
   * @param cs     Font name for complex scripts (defaults to ascii).
   */
  public setFontFamily(ascii: string, cs?: string): void {
    const props = this.ensureProperties();
    props["w:rFonts"] = {
      $: {
        "w:ascii": ascii,
        "w:hAnsi": ascii,
        "w:eastAsia": ascii,
        "w:cs": cs ?? ascii,
      },
    };
  }

  /**
   * Set text color.
   * @param hex  6-character hex color without '#' (e.g. "FF0000" for red).
   */
  public setColor(hex: string): void {
    const props = this.ensureProperties();
    (props as any)["w:color"] = { $: { "w:val": hex.replace("#", "") } };
  }

  /**
   * Clear all run formatting (empties w:rPr).
   */
  public clearFormatting(): void {
    this.run["w:rPr"] = {};
  }

  /**
   * Returns the underlying raw run object.
   */
  public toObject(): RunInterFace {
    return this.run;
  }

  /**
   * Creates a Run from a plain text string with no formatting.
   */
  public static fromText(text: string): Run {
    return new Run({
      "w:rPr": {},
      "w:t": { _: text, $: { "xml:space": "preserve" } },
    });
  }

  /**
   * Export the run to XML string.
   */
  public toXml(): string {
    const builder = new Builder({ headless: true });
    return builder.buildObject({ "w:r": this.run });
  }
}
