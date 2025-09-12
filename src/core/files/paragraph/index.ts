import { Paragraph as ParagraphInterface, Run } from "@/core/files/paragraph/types";
import { buildXml, parseXml } from "@/utils/xmlUtils";
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
    if (!this.paragraph || !this.paragraph["w:p"]) {
      throw new Error("Invalid paragraph XML: 'w:p' element is missing.");
    }
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
   * Gets the combined text content of the paragraph by recursively
   * iterating through all child elements (runs, hyperlinks, etc.) and
   * extracting the text from `w:t` elements.
   * @returns The full text content of the paragraph as a single string.
   */
  public getText(): string {
    let fullText = "";
    const p = this.paragraph["w:p"];

    /**
     * Helper function to extract text from a given node.
     * @param node The XML node to traverse.
     */
    const extractText = (node: any) => {
      // Check if the node is a text run element
      if (node && node["w:t"]) {
        // Concatenate the text, handling arrays and single values
        if (Array.isArray(node["w:t"])) {
          fullText += node["w:t"].join("");
        } else if (typeof node["w:t"] === "string") {
          fullText += node["w:t"];
        }
      }

      // Check for nested children that could contain text
      for (const key in node) {
        if (typeof node[key] === "object") {
          if (Array.isArray(node[key])) {
            node[key].forEach(extractText);
          } else {
            extractText(node[key]);
          }
        }
      }
    };

    // Start extraction from the paragraph element
    if (p) {
      extractText(p);
    }

    return fullText;
  }

  /**

* Modifies the text content of the paragraph.
* Clears all existing runs and child elements, then replaces them
* with a single new run containing the provided text.
* @param newText - The new string to set as the paragraph's content.

*/

  public modifyText(newText: string): void {
    const p = this.paragraph["w:p"];
    // Safely get original $ object or provide a default
    const runAttributes = p?.["w:r"]?.$ || { "w:rsidRPr": "00000000" };
    const newRun: Run = {
      $: runAttributes,
      "w:rPr": p?.["w:r"]?.["w:rPr"] || {},
      "w:t": newText,
    };
    // Handle hyperlink if present
    const hyperlink = p?.["w:hyperlink"]
      ? {
          "w:hyperlink": {
            $: p["w:hyperlink"].$ || {},
            "w:r": {
              $: p["w:hyperlink"]["w:r"]?.$ || { "w:rsidRPr": "00000000" },
              "w:rPr": p["w:hyperlink"]["w:r"]?.["w:rPr"] || {},
              "w:t": newText,
            },
          },
        }
      : null;

    // Build final paragraph
    const newP: ParagraphInterface = {
      "w:p": {
        $: p?.$ || {},
        "w:pPr": p?.["w:pPr"] || {},
        ...(hyperlink || { "w:r": newRun }),
      },
    };
    this.paragraph = newP;
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
