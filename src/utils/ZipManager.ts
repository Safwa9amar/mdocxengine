import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';
export class ZipManager {
  zip: AdmZip;

  constructor(zip?: AdmZip) {
    this.zip = zip ?? new AdmZip();
  }

  static async loadFromFile(filePath: string): Promise<ZipManager> {
    const data = await fs.readFile(filePath);
    const zip = new AdmZip(data);
    return new ZipManager(zip);
  }

  getFileAsBuffer(entryName: string): Buffer | null {
    const entry = this.zip.getEntry(entryName);
    if (!entry) return null;
    return entry.getData();
  }

  getFileAsString(entryName: string): string | null {
    const buf = this.getFileAsBuffer(entryName);
    return buf ? buf.toString('utf8') : null;
  }

  fileExists(entryName: string): boolean {
    return !!this.zip.getEntry(entryName);
  }

  addFile(entryName: string, content: string | Buffer): void {
    if (this.fileExists(entryName)) {
      // delete existing so we don't have duplicates
      try { this.zip.deleteFile(entryName); } catch (e) { /* ignore */ }
    }
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    this.zip.addFile(entryName, buffer);
  }

  removeFile(entryName: string): void {
    if (this.fileExists(entryName)) {
      try { this.zip.deleteFile(entryName); } catch (e) { /* ignore */ }
    }
  }

  getEntries(): string[] {
    return this.zip.getEntries().map(e => e.entryName);
  }

  async saveToFile(filePath: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    // writeZip has optional callback style; use writeZip to path
    await new Promise<void>((resolve, reject) => {
      try {
        this.zip.writeZip(filePath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  toBuffer(): Buffer {
    return this.zip.toBuffer();
  }
}
