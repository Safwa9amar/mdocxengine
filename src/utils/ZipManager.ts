import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";
export class ZipManager extends AdmZip {
  constructor() {
    super();
  }

  getFileAsBuffer(entryName: string): Buffer | null {
    const entry = this.getEntry(entryName);
    if (!entry) return null;
    return entry.getData();
  }

  getFileAsString(entryName: string): string | null {
    const buf = this.getFileAsBuffer(entryName);
    return buf ? buf.toString("utf8") : null;
  }

  fileExists(entryName: string): boolean {
    return !!this.getEntry(entryName);
  }

  // addFile(entryName: string, content: string | Buffer): void {
  //   if (this.fileExists(entryName)) {
  //     // delete existing so we don't have duplicates
  //     try { this.deleteFile(entryName); } catch (e) { /* ignore */ }
  //   }
  //   const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  //   this.addFile(entryName, buffer);
  // }

  // getEntries(): string[] {
  //   return this.getEntries().map(e => e.entryName);
  // }

  async saveToFile(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    // writeZip has optional callback style; use writeZip to path
    await new Promise<void>((resolve, reject) => {
      try {
        this.writeZip(filePath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  toBuffer(): Buffer {
    return this.toBuffer();
  }
}
