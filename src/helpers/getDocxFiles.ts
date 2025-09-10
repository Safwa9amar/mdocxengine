import * as fs from "fs";
import * as path from "path";

/**
 * Reads a folder and returns an array of .docx file names.
 * @param folderPath The path to the folder to be scanned.
 * @returns An array of strings, where each string is the name of a .docx file.
 */
export function getDocxFiles(folderPath: string): string[] {
  try {
    const files: string[] = fs.readdirSync(folderPath);
    const docxFiles: string[] = files.filter(
      (file: string) => path.extname(file).toLowerCase() === ".docx"
    );
    return docxFiles;
  } catch (err) {
    console.error(`Error reading folder: ${err}`);
    return [];
  }
}
