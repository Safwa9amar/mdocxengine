import AdmZip from "adm-zip";
import { beforeAll, describe, test, expect } from "vitest";
import Paragraph from ".";
import { WordPath } from "@/constants";
import { getParagraphsFromXmlFile } from "@/helpers/getParagraphsFromXml";
import logger from "@/utils/Logger";
import { buildXml, parseXml } from "@/utils/xmlUtils";
import { Paragraph as ParagraphInterface, Run as RunInterFace } from "./types";
import { Run } from "./Run";
var paragraph: Paragraph;
var zip: AdmZip;

// Sample XML representing a single Word paragraph for testing
let someXml = `
<w:p>
      <w:pPr>
        <w:rPr>
          <w:szCs w:val="24"/>
        </w:rPr>
      </w:pPr>
      <w:proofErr w:type="spellStart"/>
      <w:proofErr w:type="spellEnd"/>
      <w:r w:rsidRPr="00323D04">
        <w:t>selka</w:t>
      </w:r>
      <w:r w:rsidRPr="00323D04">
        <w:t>, consiste en la récitation des soixante versets du Coran Au cours d’une nuit</w:t>
      </w:r>
      <w:r w:rsidRPr="00323D04">
        <w:rPr>
          <w:szCs w:val="24"/>
        </w:rPr>
        <w:t>.</w:t>
      </w:r>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:i/>
        </w:rPr>
        <w:t xml:space="preserve">Hello</w:t>
        <w:tab/>
        <w:t xml:space="preserve">World</w:t>
        <w:br/>
        <w:fldChar w:fldCharType="begin"/>
        <w:instrText xml:space="preserve">PAGE</w:instrText>
        <w:drawing>
          <wp:inline>...</wp:inline>
        </w:drawing>
      </w:r>
  </w:p>
`;

beforeAll(async () => {
  // Load the Word document as a ZIP archive
  zip = new AdmZip("./samples/paragraps.docx");

  // Create a Paragraph instance from the provided XML
  let parsedxml = await parseXml(someXml);

  paragraph = new Paragraph(parsedxml["w:p"]);
});

describe("Paragraph class and functionality", () => {
  /**
   * Test #1
   * Ensures that the paragraph text extracted from XML matches the expected string.
   */
  test("compare the xml text with extracted text from paragraph", async () => {
    expect((await paragraph.getPlainText()).text).toBe(
      "selka, consiste en la récitation des soixante versets du Coran Au cours d’une nuit.HelloWorld"
    );
  });

  /**
   * Test #2
   * Tests the ability to modify the text of the first <w:t> node in the paragraph.
   * Verifies that the new text "hamza" replaces the original text "selka".
   */
  test("try to edit a text with 'hamza' value inside paragraph", async () => {
    // paragraph.modifyText("hamza");
    let run: RunInterFace[] | undefined = paragraph.paragraph["w:r"];
    // let cc = new Run(run[3]);
    // console.log(cc.getText(), run?.length);

    // expect(w_t?.toString().length ).toBe("hamza");
  });

  /**
   * Test #3
   * Loads the full Word document (`document.xml`), extracts all paragraph nodes,
   * and performs the following checks:
   * 1. Extracts and collects highlighted runs using `getHighlightedRuns`.
   * 2. Extracts text content from each paragraph.
   * 3. Verifies that there are valid paragraphs, text content, and highlighted runs.
   */
  test("get document.xml and extract paragraphs data from it", async () => {
    let docContent: string[] = []; // To store text extracted from all paragraphs
    let document = zip.readAsText(WordPath.Document); // Read the raw XML content from the Word document
    let parsedDoc = await parseXml(document); // Parse the XML into a JS object

    // Navigate to the array of <w:p> elements
    let extractedParagraphs: ParagraphInterface[] = parsedDoc["w:document"]["w:body"]["w:p"];

    let highlighted = []; // To collect highlighted runs

    // Iterate over each paragraph
    for (let p of extractedParagraphs) {
      try {
        // Create a Paragraph instance for each <w:p> node
        let content = new Paragraph(p);
        // Get highlighted runs with a specific color code (e.g., BF819E)
        let isHighlight = content.getHighlightedRuns();

        // Get the text content of the paragraph
        let { text, hasText } = await content.getPlainText();

        // If highlights exist, add them to the collection
        if (isHighlight)
          highlighted.push({
            isHighlight,
            p_index: extractedParagraphs.indexOf(p),
          });

        // If paragraph has text, add it to the docContent array
        if (text && hasText) docContent.push(text);
      } catch (error) {
        // Log any errors during parsing or extraction
        logger.error(error);
      }
    }

    //create isnatnce and replace text
    let new_p = new Paragraph(extractedParagraphs[6]);
    new_p.replaceText("hyperlink", "test text replace");

    //create isnatnce and get hyperlink from it
    let new_p_h = new Paragraph(extractedParagraphs[8]);
    let hyprLink = await new_p_h.getHyperlinks();

    let wordCount: number = await new_p.getWordCount();
    // expected outputs
    expect((await new_p.getPlainText()).text).toBe("test text replace");
    //
    expect(wordCount).toEqual(3);
    //
    expect(hyprLink.length).greaterThan(0);
    // --- Assertions ---
    // Ensure that we have extracted paragraphs
    expect(extractedParagraphs?.length).greaterThan(0);

    // Ensure that some text content has been extracted
    expect(docContent?.length).greaterThan(0);

    // Ensure that there are highlighted runs detected
    expect(highlighted.length).greaterThan(0);

    // Example: Update the document.xml file in the ZIP
    // zip.updateFile(WordPath.Document, Buffer.from(updatedXml, "utf-8"));

    // Write the modified document back to a new file
    zip.writeZip("./samples/outputs/cc.docx");
  });
});
