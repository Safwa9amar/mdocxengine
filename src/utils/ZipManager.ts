import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";
export class ZipManager extends AdmZip {
  constructor(filePathOrBuffer?: string | Buffer) {
    super(filePathOrBuffer as any);
    // adm-zip's constructor RETURNS a fresh plain object, so a `new ZipManager()`
    // is actually that object and never sees ZipManager.prototype — the
    // convenience readers below would be `undefined` on every live instance.
    // Re-attach them as own-properties on the live object so they always work.
    ZipManager.ensureReaders(this);
  }

  static async loadFromFile(filePath: string): Promise<ZipManager> {
    return ZipManager.ensureReaders(new ZipManager(filePath));
  }

  // Load a .docx straight from an in-memory Buffer (no temp file). adm-zip's
  // constructor already accepts a Buffer, so this mirrors loadFromFile for
  // stateless callers that hold the document bytes (e.g. fetched from storage).
  static async loadFromBuffer(buffer: Buffer): Promise<ZipManager> {
    return ZipManager.ensureReaders(new ZipManager(buffer));
  }

  /**
   * Guarantee the convenience readers exist on a (possibly adm-zip-returned)
   * instance. Idempotent: if they're already present (a real ZipManager), it's a
   * no-op. See the constructor note on why this is necessary.
   */
  private static ensureReaders(zm: ZipManager): ZipManager {
    const self = zm as any;
    if (typeof self.getFileAsBuffer !== "function") {
      self.getFileAsBuffer = (entryName: string): Buffer | null => {
        const entry = self.getEntry(entryName);
        return entry ? entry.getData() : null;
      };
    }
    if (typeof self.getFileAsString !== "function") {
      self.getFileAsString = (entryName: string): string | null => {
        const buf = self.getFileAsBuffer(entryName);
        return buf ? buf.toString("utf8") : null;
      };
    }
    if (typeof self.fileExists !== "function") {
      self.fileExists = (entryName: string): boolean => !!self.getEntry(entryName);
    }
    return zm;
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
    return super.toBuffer();
  }
}
