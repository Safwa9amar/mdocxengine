/**
 * A utility function to extract all w14:paraId values from a WordprocessingML XML string.
 * This is useful for identifying and referencing specific paragraphs within a document.
 * @param xmlString The XML content containing one or more <w:p> elements.
 * @returns An array of strings, where each string is a paraId value.
 */
export function extractParaIds(xmlString: string): string[] {
  // The regular expression to find all instances of w14:paraId and capture its value.
  // The 'g' flag is crucial to find all matches in the string.
  const regex = /w14:paraId="([^"]+)"/g;

  // Use the matchAll() method to get an iterator of all matches.
  // This is a modern approach that is much cleaner than a loop with .exec().
  const matches = xmlString.matchAll(regex);

  // Map the iterator to an array of just the captured group (the ID itself).
  const paraIds = Array.from(matches, (match) => match[1]);

  return paraIds;
}

// Example XML string containing multiple paragraphs.
// const docxXml = `
//   <w:p w14:paraId="48589590" w14:textId="2111A6D5">
//     <w:pPr><w:rPr><w:b/><w:bCs/></w:rPr></w:pPr>
//     <w:r w:rsidRPr="0063714B">
//       <w:rPr><w:b/><w:bCs/></w:rPr>
//       <w:t>Synthèse:</w:t>
//     </w:r>
//   </w:p>
//   <w:p w14:paraId="096EA004" w14:textId="77777777">
//     <w:r w:rsidRPr="00361621">
//       <w:t>Un site assez riche par des pratiques sociales.</w:t>
//     </w:r>
//   </w:p>
//   <w:p w14:paraId="73FD5FBD" w14:textId="77777777">
//     <w:r w:rsidRPr="00361621">
//       <w:t>D’après l’étude de ces potentialités du site notamment ce caractère spirituel.</w:t>
//     </w:r>
//   </w:p>
//   `;

// Extract the para IDs from the example XML.
// const ids = extractParaIds(docxXml);

// Log the result to the console.
// console.log("Extracted Paragraph IDs:", ids);
// Expected output: ["48589590", "096EA004", "73FD5FBD"]
