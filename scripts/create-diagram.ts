import fs from "fs";
import path from "path";
import { Mdocxengine, EMU_PER_INCH } from "../src/index";

const INPUT  = path.resolve("samples/example.docx");
const OUTPUT = path.resolve("samples/outputs/supply-chain.docx");

// Colors
const DARK_BLUE   = "1D4ED8";
const LIGHT_BLUE  = "BFDBFE";
const DARK_BORDER = "1E3A8A";
const WHITE       = "FFFFFF";
const DARK_TEXT   = "1E3A8A";
const ARROW_COLOR = "374151";

function emu(inches: number): number {
  return Math.round(inches * EMU_PER_INCH);
}

async function main() {
  const engine = await Mdocxengine.loadFromFile(INPUT);

  // ── Clear body, preserve sectPr ───────────────────────────────────────────
  let docXml = engine.zip.readAsText("word/document.xml")!;
  const sectPrMatch = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPr = sectPrMatch ? sectPrMatch[0] : "";
  docXml = docXml.replace(
    /<w:body>[\s\S]*<\/w:body>/,
    `<w:body><w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>${sectPr}</w:body>`,
  );
  engine.zip.addFile("word/document.xml", Buffer.from(docXml, "utf-8"));

  const sm = engine.shapes;

  // ── Layout constants ──────────────────────────────────────────────────────
  // Box sizes
  const BH    = emu(0.45);   // box height
  const BW_SM = emu(1.2);    // small (single-word) box width
  const BW_LG = emu(1.5);    // large (multi-word) box width

  // Row Y (top edge of each row's boxes)
  const R1 = emu(0.15);   // Client
  const R2 = emu(1.15);   // Factory | Order product | Inventory | Make Report
  const R3 = emu(2.5);    // Order resupply | Manager
  const R4 = emu(3.8);    // Supplier

  // Column X (left edge of each box)
  //   Body = 6.5" wide (standard 8.5" - 1" margins each side)
  //   Col 1: Factory          0.0" → 1.2"
  //   Col 2: Client/Op        1.5" → 3.0"   (LG box)
  //   Col 3: Inventory        3.3" → 4.5"
  //   Col 4: MakeReport/Mgr   4.8" → 6.3"   (LG box)
  //   Row3: OrderResupply     3.0" → 4.5"
  //   Row4: Supplier          3.0" → 4.2"
  const C1 = emu(0.0);
  const C2 = emu(1.5);
  const C3 = emu(3.3);
  const C4 = emu(4.8);
  const C3b = emu(3.0);   // Order resupply / Supplier

  const sharedTextOpts = { bold: true as const, fontSize: 10, textAlign: "ctr" as const };

  // ── Dark-blue boxes ───────────────────────────────────────────────────────
  await sm.insertShape("rect", { name: "Client",    text: "Client",    fillColor: DARK_BLUE,  borderColor: DARK_BLUE,  textColor: WHITE,     ...sharedTextOpts, position: { x: C2, y: R1 }, size: { width: BW_LG, height: BH } });
  await sm.insertShape("rect", { name: "Factory",   text: "Factory",   fillColor: DARK_BLUE,  borderColor: DARK_BLUE,  textColor: WHITE,     ...sharedTextOpts, position: { x: C1, y: R2 }, size: { width: BW_SM, height: BH } });
  await sm.insertShape("rect", { name: "Inventory", text: "Inventory", fillColor: DARK_BLUE,  borderColor: DARK_BLUE,  textColor: WHITE,     ...sharedTextOpts, position: { x: C3, y: R2 }, size: { width: BW_SM, height: BH } });
  await sm.insertShape("rect", { name: "Manager",   text: "Manager",   fillColor: DARK_BLUE,  borderColor: DARK_BLUE,  textColor: WHITE,     ...sharedTextOpts, position: { x: C4, y: R3 }, size: { width: BW_SM, height: BH } });
  await sm.insertShape("rect", { name: "Supplier",  text: "Supplier",  fillColor: DARK_BLUE,  borderColor: DARK_BLUE,  textColor: WHITE,     ...sharedTextOpts, position: { x: C3b, y: R4 }, size: { width: BW_SM, height: BH } });

  // ── Light-blue boxes ──────────────────────────────────────────────────────
  await sm.insertShape("rect", { name: "Order product",   text: "Order product",   fillColor: LIGHT_BLUE, borderColor: DARK_BORDER, textColor: DARK_TEXT, ...sharedTextOpts, fontSize: 9, position: { x: C2,  y: R2 }, size: { width: BW_LG, height: BH } });
  await sm.insertShape("rect", { name: "Make Report",     text: "Make Report",     fillColor: LIGHT_BLUE, borderColor: DARK_BORDER, textColor: DARK_TEXT, ...sharedTextOpts, fontSize: 9, position: { x: C4,  y: R2 }, size: { width: BW_LG, height: BH } });
  await sm.insertShape("rect", { name: "Order resupply",  text: "Order resupply",  fillColor: LIGHT_BLUE, borderColor: DARK_BORDER, textColor: DARK_TEXT, ...sharedTextOpts, fontSize: 9, position: { x: C3b, y: R3 }, size: { width: BW_LG, height: BH } });

  // ── Derived anchor coordinates (in EMU) ───────────────────────────────────
  // Client
  const clientCX    = C2 + BW_LG / 2;
  const clientBot   = R1 + BH;

  // Order product
  const opTop       = R2;
  const opBot       = R2 + BH;
  const opLeft      = C2;
  const opRight     = C2 + BW_LG;
  const opCY        = R2 + BH / 2;

  // Factory
  const facRight    = C1 + BW_SM;

  // Inventory
  const invLeft     = C3;
  const invRight    = C3 + BW_SM;
  const invBot      = R2 + BH;
  const invCX       = C3 + BW_SM / 2;

  // Make Report
  const mrLeft      = C4;
  const mrBot       = R2 + BH;
  const mrCX        = C4 + BW_LG / 2;

  // Manager
  const mgrLeft     = C4;
  const mgrTop      = R3;
  const mgrCX       = C4 + BW_SM / 2;
  const mgrCY       = R3 + BH / 2;

  // Order resupply
  const resTop      = R3;
  const resBot      = R3 + BH;
  const resRight    = C3b + BW_LG;
  const resCX       = C3b + BW_LG / 2;

  // Supplier
  const supTop      = R4;
  const supCX       = C3b + BW_SM / 2;

  const LA = { color: ARROW_COLOR, lineWidthPt: 1.5 };

  // ── Arrows ────────────────────────────────────────────────────────────────

  // 1. Client ──Order──▶ Order product  (going down, left offset)
  await sm.insertLine(
    clientCX - emu(0.13), clientBot,
    clientCX - emu(0.13), opTop,
    { ...LA, arrowEnd: true, label: "Order", labelOffsetX: emu(0.15), labelOffsetY: emu(-0.05) },
  );

  // 2. Order product ──Bill──▶ Client  (going up, right offset)
  await sm.insertLine(
    clientCX + emu(0.13), opTop,
    clientCX + emu(0.13), clientBot,
    { ...LA, arrowEnd: true, label: "Bill", labelOffsetX: emu(0.15), labelOffsetY: emu(-0.05) },
  );

  // 3. Order product ──Order──▶ Factory  (going left)
  await sm.insertLine(
    opLeft, opCY,
    facRight, opCY,
    { ...LA, arrowEnd: true, label: "Order", labelOffsetY: emu(-0.22) },
  );

  // 4. Order product ──List orders──▶ Inventory  (going right)
  await sm.insertLine(
    opRight, opCY,
    invLeft, opCY,
    { ...LA, arrowEnd: true, label: "List orders", labelOffsetY: emu(-0.22) },
  );

  // 5. Inventory ──▶ Make Report  (going right)
  await sm.insertLine(
    invRight, opCY,
    mrLeft, opCY,
    { ...LA, arrowEnd: true },
  );

  // 6. Make Report ──▶ Manager  (going down)
  await sm.insertLine(
    mrCX, mrBot,
    mgrCX, mgrTop,
    { ...LA, arrowEnd: true },
  );

  // 7. Manager ──Confirm orders──▶ Order resupply  (going left)
  await sm.insertLine(
    mgrLeft, mgrCY,
    resRight, mgrCY,
    { ...LA, arrowEnd: true, label: "Confirm orders", labelOffsetY: emu(-0.22) },
  );

  // 8. Order resupply ──▶ Inventory  (going up-right)
  await sm.insertLine(
    resCX, resTop,
    invCX, invBot,
    { ...LA, arrowEnd: true },
  );

  // 9. Order resupply ──▶ Supplier  (going down)
  await sm.insertLine(
    resCX, resBot,
    supCX, supTop,
    { ...LA, arrowEnd: true },
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  await fs.promises.mkdir(path.dirname(OUTPUT), { recursive: true });
  await engine.saveToFile(OUTPUT);
  console.log(`✓ Saved: ${OUTPUT}`);
}

main().catch(console.error);
