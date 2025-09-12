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
export const getParagraphsFromXmlFile = (xmlString: string) => {
  // The regular expression to match paragraph tags with attributes and capture their content.
  // The 'g' flag ensures all matches are found, and the 's' flag allows the dot to match newlines.

  const paragraphRegex = /<w:p[^>]*>.*?<\/w:p>/gs;

  // Use the matchAll() method to find all matches. It returns an iterator.
  const matches = xmlString.matchAll(paragraphRegex);

  // An array to store the extracted paragraph contents.
  const paragraphs = [];

  // Loop through each match.
  // Each match array contains the full match at index 0 and the capturing group at index 1.
  for (const match of matches) {
    if (match[0]) {
      paragraphs.push(match[0]);
    }
  }

  return paragraphs;
};
