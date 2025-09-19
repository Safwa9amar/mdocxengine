import { parseStringPromise } from "xml2js";

/**
 * Extracts all paragraph contents from a WordprocessingML XML string.
 *
 * This function uses a regular expression to find all occurrences of
 * <w:p> tags, including those with attributes, and captures the inner
 * content of each paragraph.
 *
 * @param {string} xmlString The XML string containing the WordprocessingML document.
 * @returns {string[]} An array of strings, where each string is the content
 * of a paragraph. Returns an empty array if no paragraphs are found.
 */

export async function getParagraphsFromXmlFile(xmlString: string) {
  const regex = /<\/?w:p\b[^>]*>/g;
  const matches = [...xmlString.matchAll(regex)];
  let stack: any[] = [];
  let paragraphs: { xmlStr: string; index: number }[] = [];
  //
  matches.forEach(async (match, index) => {
    const tag = match[0];
    const position = match.index;

    if (!tag.startsWith("</")) {
      // opening <w:p>
      stack.push({ position, start: position });
    } else {
      // closing </w:p>
      const last = stack.pop();
      if (last) {
        const paragraph = xmlString.slice(last.start, position + tag.length);
        paragraphs.push({
          xmlStr: paragraph,
          index,
        });
      }
    }
  });
  return paragraphs;
}
