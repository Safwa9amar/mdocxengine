import { describe, test, expect, beforeEach } from "vitest";
import AdmZip from "adm-zip";
import { MediaManager } from "./MediaManager";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // minimal PNG-like bytes

function makeZip(withImages = false): AdmZip {
  const zip = new AdmZip();
  zip.addFile(
    "word/_rels/document.xml.rels",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
      "utf-8",
    ),
  );
  if (withImages) {
    zip.addFile("word/media/image1.png", PNG_HEADER);
    zip.addFile("word/media/image2.jpg", PNG_HEADER);
  }
  return zip;
}

describe("MediaManager", () => {
  let mm: MediaManager;

  beforeEach(() => {
    mm = new MediaManager(makeZip(true));
  });

  test("listImages() returns all images", () => {
    const images = mm.listImages();
    expect(images).toHaveLength(2);
    expect(images.map((i) => i.name)).toContain("image1.png");
    expect(images.map((i) => i.name)).toContain("image2.jpg");
  });

  test("listImages() returns empty array when no images", () => {
    const mm2 = new MediaManager(makeZip(false));
    expect(mm2.listImages()).toHaveLength(0);
  });

  test("extractImage() returns buffer for existing image", () => {
    const buf = mm.extractImage("image1.png");
    expect(buf).not.toBeNull();
    expect(buf!.length).toBeGreaterThan(0);
  });

  test("extractImage() returns null for non-existent image", () => {
    expect(mm.extractImage("ghost.png")).toBeNull();
  });

  test("insertImage() adds image to zip", async () => {
    const newBuf = Buffer.from([0x00, 0x01, 0x02]);
    const { imagePath, relId } = await mm.insertImage(newBuf, "png");
    expect(imagePath).toBe("word/media/image3.png");
    expect(relId).toBeTruthy();
    const images = mm.listImages();
    expect(images.map((i) => i.name)).toContain("image3.png");
  });

  test("replaceImage() overwrites existing image bytes", () => {
    const newBuf = Buffer.from([0xFF, 0xFE]);
    mm.replaceImage("image1.png", newBuf);
    const buf = mm.extractImage("image1.png");
    expect(buf![0]).toBe(0xFF);
  });

  test("replaceImage() throws for non-existent image", () => {
    expect(() => mm.replaceImage("ghost.png", Buffer.from([]))).toThrow("Image not found");
  });

  test("deleteImage() removes image from zip", () => {
    mm.deleteImage("image1.png");
    const images = mm.listImages();
    expect(images.map((i) => i.name)).not.toContain("image1.png");
  });

  test("deleteImage() throws for non-existent image", () => {
    expect(() => mm.deleteImage("ghost.png")).toThrow("Image not found");
  });
});
