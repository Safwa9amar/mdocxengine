import { Hyperlink, Paragraph as ParagraphInterface, Run as RunInterface, RunProperties } from "@/core/files/paragraph/types";
import { Run } from "@/core/files/paragraph/Run";
import { extractParaIds } from "@/helpers";
import { parseXml } from "@/utils/xmlUtils";
import AdmZip from "adm-zip";
import { Builder } from "xml2js";

/**
 * A class representing a single paragraph from a WordprocessingML document.
 * It provides methods to easily get and modify the paragraph's text content.
 */
class Paragraph {
  paragraph: ParagraphInterface;

  /**
   * Constructs a new Paragraph instance.
   * @param paragraph The parsed JSON representation of the paragraph's XML.
   */
  constructor(paragraph: ParagraphInterface) {
    this.paragraph = paragraph;
    if (!this.paragraph || !this.paragraph) {
      throw new Error("Invalid paragraph XML: 'w:p' element is missing.");
    }
  }
  /**
   * Extracts plain text from a Word paragraph XML string and checks if it contains any text.
   * - If no `<w:t>` tags exist or they're empty, it returns `hasText = false` and `text = ""`.
   * - Otherwise, it returns the combined text and `hasText = true`.
   *
   * @param paragraphXml - Optional raw XML string of the <w:p> element. If not provided, it uses this.toXml().
   * @returns An object containing the extracted text and a boolean flag.
   */
  public async getPlainText(paragraphXml?: string): Promise<{ hasText: boolean; text: string }> {
    // Load the XML string

    const xml = paragraphXml || (await this.toXml());
    // Regex to match <w:t>...</w:t> blocks

    const matches = xml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g);

    // If no matches found, return empty result
    if (!matches) {
      return { hasText: false, text: "" };
    }

    // Extract, trim, and join the inner text
    const textContent = matches
      .map((match) => match.replace(/<\/?w:t\b[^>]*>/g, "")) // remove <w:t> tags
      .join("")
      .trim();

    return {
      hasText: textContent.length > 0 ? true : false,
      text: textContent,
    };
  }
  /**
   * Safely extracts visible text from a Word paragraph (<w:p>),
   * handling nested structures like hyperlinks, bookmarks, and tabs.
   *
   * @param paragraphXml Optional XML string of the paragraph.
   * @returns Object with a boolean (hasText) and the combined text string.
   */
  public async getPlainTextSafe(): Promise<{ hasText: boolean; text: string }> {
    const parsed = this.paragraph;

    // Helper function to recursively extract text
    const extractText = (node: any): string => {
      if (!node || typeof node !== "object") return "";

      let result = "";

      // 1. Handle runs <w:r>
      if (Array.isArray(node["w:r"])) {
        for (const run of node["w:r"]) {
          result += extractText(run);
        }
      }

      // 2. Handle text <w:t>
      if (node["w:t"]) {
        const t = node["w:t"];
        if (typeof t === "string") {
          result += t;
        } else if (typeof t._ === "string") {
          result += t._;
        }
      }

      // 3. Handle tabs <w:tab> and line breaks <w:br>
      if (node["w:tab"]) {
        result += "\t"; // add tab
      }
      if (node["w:br"]) {
        result += "\n"; // add line break
      }

      // 4. Handle hyperlinks <w:hyperlink>
      if (Array.isArray(node["w:hyperlink"])) {
        for (const link of node["w:hyperlink"]) {
          result += extractText(link); // recurse into hyperlink children
        }
      }

      // 5. Handle any other nested children
      for (const key in node) {
        if (node.hasOwnProperty(key)) {
          const child = node[key];

          if (Array.isArray(child)) {
            for (const c of child) {
              result += extractText(c);
            }
          } else {
            result += extractText(child);
          }
        }
      }

      return result;
    };

    const text = extractText(parsed || {}).trimEnd();
    return { hasText: text.length > 0, text };
  }

  /**
   * Recursively extracts text from any node including nested structures.
   */
  private extractTextFromNode(node: any): string {
    if (!node || typeof node !== "object") return "";

    let text = "";

    for (const key of Object.keys(node)) {
      const value = node[key];

      if (key === "w:t" && typeof value === "string") {
        text += value;
      } else if (Array.isArray(value)) {
        for (const child of value) {
          text += this.extractTextFromNode(child);
        }
      } else if (typeof value === "object") {
        text += this.extractTextFromNode(value);
      }
    }
    return text;
  }

  /**
   * Appends new text to the paragraph without removing existing runs.
   * @param text - The text to append.
   */
  public appendText(text: string): void {
    const newRun: RunInterface = {
      $: { "w:rsidRPr": this.paragraph?.$?.["w:rsidRPr"] || "" },
      "w:rPr": this.paragraph["w:pPr"]?.["w:rPr"] || {},
      "w:t": { _: text, $: {} },
    };

    if (!this.paragraph["w:r"]) {
      this.paragraph["w:r"] = [];
    }
    this.paragraph["w:r"].push(newRun);
  }
  /**
   * Recursively replaces text inside a paragraph without removing hyperlinks or nested structures.
   *
   * @param searchText - Text to search for. If null, replace all text.
   * @param replaceText - Text to replace with.
   */
  public replaceText(searchText: string | null, replaceText: string): void {
    const p = this.paragraph;

    const recursiveReplace = (node: any) => {
      if (Array.isArray(node)) {
        node.forEach(recursiveReplace);
      } else if (typeof node === "object" && node !== null) {
        // If this is a text node <w:t>
        if (node["w:t"]) {
          const textNode = node["w:t"];
          if (typeof textNode === "string") {
            node["w:t"] = searchText
              ? textNode.replace(new RegExp(searchText, "g"), replaceText)
              : replaceText;
          } else if (typeof textNode._ === "string") {
            textNode._ = searchText
              ? textNode._.replace(new RegExp(searchText, "g"), replaceText)
              : replaceText;
          }
        }

        // Recursively process all children
        for (const key in node) {
          if (node.hasOwnProperty(key) && key !== "w:t") {
            recursiveReplace(node[key]);
          }
        }
      }
    };

    recursiveReplace(p);
  }

  /**
   * Sets the paragraph alignment.
   * @param alignment - One of "left" | "center" | "right" | "both"
   */
  public setAlignment(alignment: "left" | "center" | "right" | "both"): void {
    if (!this.paragraph["w:pPr"]) {
      this.paragraph["w:pPr"] = {};
    }
    this.paragraph["w:pPr"]["w:jc"] = { $: { "w:val": alignment } };
  }

  /**
   * Gets the current alignment of the paragraph.
   */
  public getAlignment(): string | null {
    return this.paragraph["w:pPr"]?.["w:jc"]?.$?.["w:val"] || null;
  }

  /**
   * Returns the total number of words in the paragraph.
   */
  public async getWordCount(): Promise<number> {
    const { text } = await this.getPlainText();
    return text.split(/\s+/).filter(Boolean).length;
  }

  /**
   * Applies a style to the entire paragraph.
   * @param styleId - The Word style ID (e.g., "Heading1", "Normal").
   */
  public applyStyle(styleId: string): void {
    if (!this.paragraph["w:pPr"]) {
      this.paragraph["w:pPr"] = {};
    }
    this.paragraph["w:pPr"]["w:pStyle"] = { $: { "w:val": styleId } };
  }
  /**
   * Removes all formatting (bold, italic, etc.) from runs but keeps text.
   */
  public removeFormatting(): void {
    const strip = (run: RunInterface) => {
      run["w:rPr"] = {}; // Clear formatting
    };

    (this.paragraph["w:r"] || []).forEach(strip);
    if (Array.isArray(this.paragraph["w:hyperlink"])) {
      this.paragraph["w:hyperlink"].forEach((link) => {
        (link["w:r"] || []).forEach(strip);
      });
    }
  }
  /**
   * Creates a deep clone of the paragraph object.
   */
  public clone(): Paragraph {
    const cloneData = JSON.parse(JSON.stringify(this.paragraph));
    return new Paragraph(cloneData);
  }

  /**
   * Merges another paragraph's runs into this one.
   * @param otherParagraph - The paragraph to merge into this one.
   */
  public mergeWith(otherParagraph: Paragraph): void {
    const otherRuns = otherParagraph.paragraph["w:r"] || [];
    if (!this.paragraph["w:r"]) {
      this.paragraph["w:r"] = [];
    }
    this.paragraph["w:r"].push(...otherRuns);
  }
  /**
   * Splits the paragraph into two at the specified character index.
   * @param index - Character position to split at.
   * @returns A tuple: [firstPart, secondPart]
   */
  public async splitAt(index: number): Promise<[Paragraph, Paragraph]> {
    const { text } = await this.getPlainText();

    const firstText = text.slice(0, index);
    const secondText = text.slice(index);

    const first = this.clone();
    const second = this.clone();

    first.modifyText(firstText);
    second.modifyText(secondText);

    return [first, second];
  }

  /**
   * Adds a new hyperlink to the paragraph.
   * @param url - The URL of the hyperlink.
   * @param displayText - The visible text for the hyperlink.
   */
  public addHyperlink(url: string, displayText: string, rsidRPr: string): void {
    const newLink: Hyperlink = {
      $: { "r:id": url },
      "w:r": [
        {
          $: {
            "w:rsidRPr": rsidRPr,
          },
          "w:rPr": {},
          "w:t": { _: displayText, $: {} },
        },
      ],
    };

    if (!this.paragraph["w:hyperlink"]) {
      this.paragraph["w:hyperlink"] = [];
    }

    if (!Array.isArray(this.paragraph["w:hyperlink"])) {
      this.paragraph["w:hyperlink"] = [this.paragraph["w:hyperlink"]];
    }

    this.paragraph["w:hyperlink"].push(newLink);
  }
  /**
   * Extracts all hyperlinks inside the paragraph.
   * Returns array of { displayText, url }.
   */
  public async getHyperlinks(): Promise<{ displayText: string; url: string }[]> {
    const parsed = this.paragraph;
    const links: { displayText: string; url: string }[] = [];

    const traverse = (node: any) => {
      if (!node) return;

      if (node["w:hyperlink"]) {
        const hyperlinks = Array.isArray(node["w:hyperlink"])
          ? node["w:hyperlink"]
          : [node["w:hyperlink"]];

        for (const link of hyperlinks) {
          const displayText = this.extractTextFromNode(link);
          const url = link["$"]?.["r:id"] || ""; // `r:id` links to relationships
          links.push({ displayText, url });
        }
      }

      // Recursively search children
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (typeof value === "object") {
          traverse(value);
        }
      }
    };

    traverse(parsed);
    return links;
  }
  /**
   * Removes all hyperlinks but keeps the visible text.
   */
  public removeHyperlinks(): void {
    if (!this.paragraph["w:hyperlink"]) return;

    const plainRuns: RunInterface[] = [];
    const extractRuns = (runs: RunInterface | RunInterface[] | undefined) =>
      Array.isArray(runs) ? runs : runs ? [runs] : [];

    const hyperlinks = Array.isArray(this.paragraph["w:hyperlink"])
      ? this.paragraph["w:hyperlink"]
      : [this.paragraph["w:hyperlink"]];

    hyperlinks.forEach((link) => {
      plainRuns.push(...extractRuns(link["w:r"]));
    });

    // Merge with existing runs
    this.paragraph["w:r"] = [...(this.paragraph["w:r"] || []), ...plainRuns];
    this.paragraph["w:hyperlink"] = [];
  }

  /**
   * Creates a Paragraph instance from an XML string.
   * @param xmlString The XML string of the paragraph.
   * @returns A Promise that resolves with the new Paragraph instance.
   */
  public static async createFromXml(xmlString: string): Promise<Paragraph> {
    const parsedParagraph = await parseXml(xmlString);
    return new Paragraph(parsedParagraph);
  }
  /**
   * Returns all highlighted runs in the current paragraph, optionally filtered by fill and value.
   *
   * @param {string} [fill] - Optional. Filter by highlight fill color (e.g., "FFFF00").
   * @param {string} [value] - Optional. Filter by shading value (e.g., "clear").
   * @returns {Run[] | false} - Array of highlighted runs or false if none found.
   */
  public getHighlightedRuns(fill?: string, value: string = "clear"): RunInterface[] | false {
    const runArray: RunInterface[] = [];

    // Helper function to push runs safely
    const pushRuns = (runs: RunInterface | RunInterface[] | undefined) => {
      if (Array.isArray(runs)) {
        runArray.push(...runs);
      } else if (runs) {
        runArray.push(runs);
      }
    };

    // Collect runs directly under the paragraph
    pushRuns(this.paragraph["w:r"]);

    // Collect runs inside hyperlinks
    const hyperlinks = this.paragraph["w:hyperlink"];
    if (Array.isArray(hyperlinks)) {
      hyperlinks.forEach((link) => pushRuns(link["w:r"]));
    } else if (hyperlinks) {
      pushRuns(hyperlinks["w:r"]);
    }

    // Filter highlighted runs
    const highlightedRuns = runArray.filter((run) => {
      const shd = run?.["w:rPr"]?.["w:shd"];
      if (!shd || !shd.$) return false;

      const runFill = shd.$["w:fill"];
      const runValue = shd.$["w:val"];

      // Check optional filters
      if (fill && runFill !== fill) return false;
      if (value && runValue !== value) return false;

      return true; // Run matches highlight criteria
    });

    return highlightedRuns.length ? highlightedRuns : false;
  }
  /**
   * Returns true if any run in the paragraph is highlighted.
   */
  public hasHighlight(): boolean {
    return !!this.getHighlightedRuns();
  }

  /**

* Modifies the text content of the paragraph.
* Clears all existing runs and child elements, then replaces them
* with a single new run containing the provided text.
* @param newText - The new string to set as the paragraph's content.

*/
  public modifyText(newText: string): void {
    const p = this.paragraph;

    // Clear existing runs and hyperlinks to simplify the logic
    // This is a pragmatic approach; a more advanced version could update in place.
    p["w:r"] = [];
    p["w:hyperlink"] = [];

    // Create a new Run with the updated text
    const newRun: RunInterface = {
      $: { "w:rsidRPr": p?.$?.["w:rsidRPr"] || "" },
      "w:rPr": p["w:pPr"]?.["w:rPr"] || {},
      "w:t": { _: newText, $: {} },
    };

    /// Determine if there's a hyperlink and re-create it with the new text
    // If there was a hyperlink, put the new run inside it
    if (p["w:hyperlink"] && p["w:hyperlink"].length > 0) {
      const originalHyperlink = p["w:hyperlink"][0];
      const originalRun = originalHyperlink["w:r"]?.[0]; // Get the first Run from the array

      const newRun: RunInterface = {
        // Safely access the $ property of the first run.
        $: originalRun?.$ || { "w:rsidRPr": "" },
        // Safely access the w:rPr property of the first run.
        "w:rPr": originalRun?.["w:rPr"] || {},
        // Set the new text.
        "w:t": { _: newText, $: {} },
      };

      const newHyperlink: Hyperlink = {
        $: originalHyperlink.$,
        // Assign the new single run within an array.
        "w:r": [newRun],
      };

      // Re-add the single updated hyperlink
      p["w:hyperlink"] = [newHyperlink];
    } else {
      // Otherwise, just add the new run to the paragraph
      p["w:r"] = [newRun];
    }
  }

  // create unique paragraph id based on given document
  public generateUniqueParaId(zip: AdmZip): string {
    let paraId: string;
    let xml = zip.readAsText("word/document.xml");
    let existingIds = extractParaIds(xml);
    if (existingIds.length === 0) {
      // If no IDs exist, start with a base value.
      return "00000001";
    }

    // Convert hexadecimal IDs to decimal numbers to find the maximum.
    const decimalIds = existingIds.map((id) => parseInt(id, 16));
    const maxId = Math.max(...decimalIds);

    // Increment the maximum ID to get a unique new ID.
    const newId = maxId + 1;

    // Convert the new decimal ID back to a hexadecimal string,
    // padding with leading zeros to maintain the original format.
    paraId = newId.toString(16).toUpperCase().padStart(8, "0");

    return paraId;
  }
  /**
   * Detects the primary language of the paragraph (if available).
   */
  public detectLanguage(): string | null {
    const runs = this.paragraph["w:r"] || [];
    for (const run of runs) {
      const lang = run?.["w:rPr"]?.["w:lang"]?.$?.["w:val"];
      if (lang) return lang;
    }
    return null;
  }

  /**
   * Returns all runs in the paragraph as Run class instances.
   */
  public getRuns(): Run[] {
    const rawRuns = this.paragraph["w:r"];
    if (!rawRuns) return [];
    const arr = Array.isArray(rawRuns) ? rawRuns : [rawRuns];
    return arr.map((r) => new Run(r));
  }

  /**
   * Appends a Run instance to the paragraph.
   */
  public addRun(run: Run): void {
    if (!this.paragraph["w:r"]) {
      this.paragraph["w:r"] = [];
    } else if (!Array.isArray(this.paragraph["w:r"])) {
      this.paragraph["w:r"] = [this.paragraph["w:r"] as RunInterface];
    }
    (this.paragraph["w:r"] as RunInterface[]).push(run.toObject());
  }

  /**
   * Removes the run at the given zero-based index.
   */
  public removeRun(index: number): void {
    if (!this.paragraph["w:r"]) return;
    const arr = Array.isArray(this.paragraph["w:r"])
      ? this.paragraph["w:r"]
      : [this.paragraph["w:r"] as RunInterface];
    arr.splice(index, 1);
    this.paragraph["w:r"] = arr;
  }

  /**
   * Converts the internal paragraph object back into an XML string.
   * @returns A Promise that resolves with the XML string.
   */
  public async toXml(): Promise<string> {
    const builder = new Builder({
      headless: true,
    });
    return builder.buildObject(this.paragraph);
  }
}

export default Paragraph;
