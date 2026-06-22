import fs from "fs";
import path from "path";
import { Mdocxengine } from "../src/index";

const IMAGE_PATH = path.resolve(process.env.HOME!, "Desktop/Diagram_of_the_human_heart.svg.png");
const INPUT      = path.resolve("samples/example.docx");
const OUTPUT     = path.resolve("samples/outputs/heart-diagram.docx");

// 500×511 px image scaled to 5 inches wide (1 inch = 914400 EMU)
const CX = Math.round(5 * 914400);
const CY = Math.round(CX * (511 / 500));

function buildImageParagraph(relId: string, cx: number, cy: number): string {
  const NS_WP  = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
  const NS_A   = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const NS_PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";
  const NS_R   = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  return (
    `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
    `<w:pPr><w:jc w:val="center"/></w:pPr>` +
    `<w:r><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="${NS_WP}">` +
      `<wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:docPr id="1" name="Heart Diagram"/>` +
      `<wp:cNvGraphicFramePr>` +
        `<a:graphicFrameLocks xmlns:a="${NS_A}" noChangeAspect="1"/>` +
      `</wp:cNvGraphicFramePr>` +
      `<a:graphic xmlns:a="${NS_A}">` +
        `<a:graphicData uri="${NS_PIC}">` +
          `<pic:pic xmlns:pic="${NS_PIC}">` +
            `<pic:nvPicPr>` +
              `<pic:cNvPr id="1" name="Heart Diagram"/>` +
              `<pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr>` +
            `</pic:nvPicPr>` +
            `<pic:blipFill>` +
              `<a:blip xmlns:r="${NS_R}" r:embed="${relId}"/>` +
              `<a:stretch><a:fillRect/></a:stretch>` +
            `</pic:blipFill>` +
            `<pic:spPr>` +
              `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
              `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
              `<a:noFill/>` +
            `</pic:spPr>` +
          `</pic:pic>` +
        `</a:graphicData>` +
      `</a:graphic>` +
    `</wp:inline>` +
    `</w:drawing></w:r></w:p>`
  );
}

async function main() {
  const engine = await Mdocxengine.loadFromFile(INPUT);

  // ── 1. Strip the body down to just the sectPr ─────────────────────────────
  let docXml = engine.zip.readAsText("word/document.xml")!;

  // Extract the existing sectPr so page size/margins are preserved
  const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPr      = sectPrMatch ? sectPrMatch[0] : "";

  // Replace entire <w:body>…</w:body> with an empty body (sectPr only)
  docXml = docXml.replace(
    /<w:body>[\s\S]*<\/w:body>/,
    `<w:body>${sectPr}</w:body>`,
  );
  engine.zip.addFile("word/document.xml", Buffer.from(docXml, "utf-8"));

  // ── 2. Register image in zip + rels ──────────────────────────────────────
  const imageBuffer = fs.readFileSync(IMAGE_PATH);
  const { relId }   = await engine.media.insertImage(imageBuffer, "png");

  // ── 3. Inject image drawing paragraph before </w:body> ───────────────────
  docXml = engine.zip.readAsText("word/document.xml")!;
  docXml = docXml.replace(/(<\/w:body>)/, `${buildImageParagraph(relId, CX, CY)}$1`);
  engine.zip.addFile("word/document.xml", Buffer.from(docXml, "utf-8"));

  // ── 4. Insert caption ────────────────────────────────────────────────────
  const paragraphs = await engine.document.getParagraphs();
  await engine.captions.insertCaption(paragraphs.length - 1, {
    label:    "Figure",
    title:    "Diagram of the human heart",
    position: "after" as const,
  });

  // ── 5. Save ───────────────────────────────────────────────────────────────
  await fs.promises.mkdir(path.dirname(OUTPUT), { recursive: true });
  await engine.saveToFile(OUTPUT);
  console.log(`✓ Saved: ${OUTPUT}`);
}

main().catch(console.error);
