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

/** EMU per pixel at 96 DPI (1 px = 9525 EMU). */
export const EMU_PER_PIXEL = 9525;
/** Convert EMU to whole pixels at 96 DPI. */
export const emuToPixels = (emu: number): number => Math.round(emu / EMU_PER_PIXEL);
/** Convert pixels (96 DPI) to EMU. */
export const pixelsToEmu = (px: number): number => Math.round(px * EMU_PER_PIXEL);

/** An inline image resolved from a paragraph block's `<w:drawing>`. */
export interface InlineImage {
  /** The `r:embed` relationship id. */
  relId: string;
  /** The resolved relationship target (e.g. "media/image1.png"). */
  target: string;
  /** The raw image bytes. */
  bytes: Buffer;
  /** File extension without dot (e.g. "png"). */
  extension: string;
  /** MIME type for the extension (e.g. "image/png"). */
  mime: string;
  /** Inline display width in EMU (0 if no `<wp:extent>`). */
  widthEmu: number;
  /** Inline display height in EMU (0 if no `<wp:extent>`). */
  heightEmu: number;
  /** Inline display width in pixels @96dpi. */
  widthPx: number;
  /** Inline display height in pixels @96dpi. */
  heightPx: number;
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
   * Resolve a relationship id (e.g. an image's `r:embed`) to its bytes via the
   * document relationships. Returns null if the rel or the target part is missing.
   */
  public async getImageByRelId(relId: string): Promise<Buffer | null> {
    const target = await this.rels.getTarget(relId);
    if (!target) return null;
    return this.readByTarget(target);
  }

  /**
   * Read a media part by its relationship `Target` (e.g. "media/image1.png").
   * Targets are relative to `word/` unless already absolute/prefixed.
   */
  private readByTarget(target: string): Buffer | null {
    const path = target.startsWith("/")
      ? target.slice(1)
      : target.startsWith("word/")
        ? target
        : `word/${target}`;
    const entry = this.zip.getEntry(path);
    return entry ? entry.getData() : null;
  }

  /**
   * Extract the inline image embedded in a paragraph/run XML string (a block that
   * carries `<w:drawing>` with `<a:blip r:embed="…">`). Resolves the relationship
   * to the media bytes and reads the inline display size from `<wp:extent>`.
   * Returns null when the block has no inline image or it can't be resolved.
   *
   * Replaces hand-rolled `r:embed` + rels + `wp:extent` regex on the caller side.
   */
  public async extractInlineImage(blockXml: string): Promise<InlineImage | null> {
    const embed = /r:embed="([^"]+)"/.exec(blockXml);
    if (!embed) return null;
    const relId = embed[1];
    const target = await this.rels.getTarget(relId);
    if (!target) return null;
    const bytes = this.readByTarget(target);
    if (!bytes) return null;

    const extension = (target.split(".").pop() || "png").toLowerCase();
    const mime = CONTENT_TYPE_MAP[extension] ?? "application/octet-stream";

    let widthEmu = 0;
    let heightEmu = 0;
    const ext = /<wp:extent\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/.exec(blockXml);
    if (ext) {
      widthEmu = Number(ext[1]);
      heightEmu = Number(ext[2]);
    }

    return {
      relId,
      target,
      bytes,
      extension,
      mime,
      widthEmu,
      heightEmu,
      widthPx: emuToPixels(widthEmu),
      heightPx: emuToPixels(heightEmu),
    };
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
