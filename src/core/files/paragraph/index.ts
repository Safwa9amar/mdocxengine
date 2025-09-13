import { Hyperlink, Paragraph as ParagraphInterface, Run } from "@/core/files/paragraph/types";
import { extractParaIds } from "@/helpers";
import { buildXml, parseXml } from "@/utils/xmlUtils";
import AdmZip from "adm-zip";
import { Builder, parseString } from "xml2js";
import { DOMParser, XMLSerializer } from "xmldom";

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

  public getParagraphById() {}

  public insertParagraph(parsedXml: string, newParagraphXml: string, position: number) {
    const parser = new DOMParser();
    const serializer = new XMLSerializer();

    // Parse the main document XML
    const doc = parser.parseFromString(parsedXml, "application/xml");

    // Get the <w:body>
    const body = doc.getElementsByTagName("w:body")[0];
    if (!body) throw new Error("<w:body> not found!");

    // Parse the new paragraph separately
    const newParagraphNode = parser.parseFromString(
      newParagraphXml,
      "application/xml"
    ).documentElement;

    // Insert at the desired position
    const paragraphs = body.getElementsByTagName("w:p");

    if (position >= paragraphs.length) {
      body.appendChild(newParagraphNode); // Append at the end
    } else {
      body.insertBefore(newParagraphNode, paragraphs[position]);
    }

    return serializer.serializeToString(doc);
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
    const p = this.paragraph;
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
    const p = this.paragraph;

    // Clear existing runs and hyperlinks to simplify the logic
    // This is a pragmatic approach; a more advanced version could update in place.
    p["w:r"] = [];
    p["w:hyperlink"] = [];

    // Create a new Run with the updated text
    const newRun: Run = {
      $: { "w:rsidRPr": p?.$?.["w:rsidRPr"] || "" },
      "w:rPr": p?.["w:pPr"]?.["w:rPr"] || {},
      "w:t": { _: newText, $: {} },
    };

    /// Determine if there's a hyperlink and re-create it with the new text
    // If there was a hyperlink, put the new run inside it
    if (p["w:hyperlink"] && p["w:hyperlink"].length > 0) {
      const originalHyperlink = p["w:hyperlink"][0];
      const originalRun = originalHyperlink["w:r"]?.[0]; // Get the first Run from the array

      const newRun: Run = {
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
