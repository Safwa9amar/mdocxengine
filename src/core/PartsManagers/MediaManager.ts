import { RelManager } from "@/core/PartsManagers/RelManager";
import { ContentTypesManager } from "./ContentTypesManager";
import AdmZip from "adm-zip";

const MEDIA_DIR = "word/media";
const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

const CONTENT_TYPE_MAP: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  svg: "image/svg+xml",
};

export interface ImageEntry {
  name: string;
  path: string;
  buffer: Buffer;
}

export class MediaManager {
  private zip: AdmZip;
  private rels: RelManager;
  private contentTypes: ContentTypesManager;

  constructor(zip: AdmZip) {
    this.zip = zip;
    this.rels = new RelManager(zip);
    this.contentTypes = new ContentTypesManager(zip);
  }

  /**
   * Returns all image files found in word/media/.
   */
  public listImages(): ImageEntry[] {
    const images: ImageEntry[] = [];

    this.zip.getEntries().forEach((entry) => {
      if (
        entry.entryName.startsWith(`${MEDIA_DIR}/`) &&
        /\.(png|jpe?g|gif|bmp|tiff|svg)$/i.test(entry.entryName)
      ) {
        const buf = entry.getData();
        if (buf) {
          images.push({
            name: entry.entryName.replace(`${MEDIA_DIR}/`, ""),
            path: entry.entryName,
            buffer: buf,
          });
        }
      }
    });

    return images;
  }

  /**
   * Returns the buffer for a specific image by filename (e.g. "image1.png"), or null.
   */
  public extractImage(name: string): Buffer | null {
    const entry = this.zip.getEntry(`${MEDIA_DIR}/${name}`);
    return entry ? entry.getData() : null;
  }

  /**
   * Inserts a new image into the document.
   * @param imageBuffer  Raw image bytes.
   * @param extension    File extension without dot (e.g. "png", "jpg").
   * @returns The image path and the generated relationship ID.
   */
  public async insertImage(
    imageBuffer: Buffer,
    extension: string,
  ): Promise<{ imagePath: string; relId: string }> {
    const ext = extension.toLowerCase();
    const existingImages = this.listImages();
    const nums = existingImages.map((img) => {
      const m = img.name.match(/image(\d+)\./);
      return m ? parseInt(m[1], 10) : 0;
    });
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    const imageName = `image${next}.${ext}`;
    const imagePath = `${MEDIA_DIR}/${imageName}`;

    // 1. Add to zip
    this.zip.addFile(imagePath, imageBuffer);

    // 2. Register content type default for extension
    const contentType = CONTENT_TYPE_MAP[ext] ?? `image/${ext}`;
    await this.contentTypes.addDefault(ext, contentType);

    // 3. Register relationship
    const relId = await this.rels.genId();
    await this.rels.addRelationship(relId, IMAGE_REL_TYPE, `media/${imageName}`);

    return { imagePath, relId };
  }

  /**
   * Replaces an existing image's bytes in-place (same filename, same relId).
   * @param name         Filename like "image1.png" (without path prefix).
   * @param newBuffer    New image bytes.
   */
  public replaceImage(name: string, newBuffer: Buffer): void {
    const path = `${MEDIA_DIR}/${name}`;
    if (!this.zip.getEntry(path)) throw new Error(`Image not found: ${name}`);
    this.zip.addFile(path, newBuffer);
  }

  /**
   * Deletes an image from the zip (does not remove the relationship or inline reference).
   */
  public deleteImage(name: string): void {
    const path = `${MEDIA_DIR}/${name}`;
    if (!this.zip.getEntry(path)) throw new Error(`Image not found: ${name}`);
    this.zip.deleteFile(path);
  }
}
