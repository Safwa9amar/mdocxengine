import { Mdocxengine } from "../src/index";

function extractText(xml: string): string {
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map(m => m[1]).join("").trim();
}

async function main() {
  const engine = await Mdocxengine.loadFromFile("samples/unformatted.docx");

  // Read document XML directly through the zip the engine already holds
  const docXml = engine.zip.readAsText("word/document.xml")!;

  // Split into individual <w:p> blocks
  const paraBlocks = [...docXml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map(m => m[0]);
  console.log(`Total paragraphs: ${paraBlocks.length}\n`);

  for (let i = 0; i < paraBlocks.length; i++) {
    const xml  = paraBlocks[i];
    const text = extractText(xml);
    const isBullet = text.startsWith("•");
    const tabCount = (xml.match(/<w:tab\/>/g) || []).length;
    const label    = isBullet ? "BULLET" : tabCount > 0 ? `TAB(${tabCount})` : "PARA";
    if (text) {
      console.log(`[${i}] ${label} | ${text.substring(0, 110)}`);
    } else {
      console.log(`[${i}] EMPTY`);
    }
  }
}

main().catch(console.error);
