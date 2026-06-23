import * as XmlUtils from "@/utils/xmlUtils";
import AdmZip from "adm-zip";

const DOCUMENT_PATH = "word/document.xml";

// Namespace URIs
const NS_A  = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_W  = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const NS_R  = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";

// Unit helpers — 1 inch = 914400 EMU
export const EMU_PER_INCH = 914400;
export const EMU_PER_CM   = 360000;

// Maps DrawingML align values to WordprocessingML w:jc values
const TEXT_ALIGN_MAP: Record<string, string> = { l: "left", ctr: "center", r: "right" };

export type ShapeType =
  | "rect"
  | "roundRect"
  | "ellipse"
  | "triangle"
  | "diamond"
  | "line"
  | "rightArrow"
  | "leftArrow"
  | "star5"
  | "cloud"
  | "heart";

export interface ShapePosition {
  x: number; // EMU from column left
  y: number; // EMU from paragraph top
}

export interface ShapeSize {
  width: number;  // EMU
  height: number; // EMU
}

export interface TextBoxOptions {
  text: string;
  position?: ShapePosition;
  size?: ShapeSize;
  paragraphIndex?: number;
  fillColor?: string;   // hex without #
  borderColor?: string; // hex without #
  floating?: boolean;   // default true
}

export interface InsertShapeOptions {
  position?: ShapePosition;
  size?: ShapeSize;
  paragraphIndex?: number;
  fillColor?: string;
  borderColor?: string;
  floating?: boolean;
  name?: string;
  text?: string;
  textColor?: string;
  fontSize?: number;
  bold?: boolean;
  textAlign?: "l" | "ctr" | "r";
}

export interface InsertLineOptions {
  color?: string;
  arrowEnd?: boolean;
  arrowStart?: boolean;
  lineWidthPt?: number;
  paragraphIndex?: number;
  label?: string;
  labelOffsetX?: number;
  labelOffsetY?: number;
}

export interface ShapeEntry {
  id: number;
  name: string;
  type: "textbox" | ShapeType | "unknown";
  position?: ShapePosition;
  size: ShapeSize;
}

export class ShapeManager {
  private zip: AdmZip;

  constructor(zip: AdmZip) {
    this.zip = zip;
  }

  // ─── Internal read/write ──────────────────────────────────────────────────

  private async readDocument(): Promise<any> {
    const xml = this.zip.readAsText(DOCUMENT_PATH);
    if (!xml) throw new Error("word/document.xml not found");
    return XmlUtils.parseXml(xml);
  }

  private async writeDocument(obj: any): Promise<void> {
    // Ensure DrawingML / relationship / wordprocessingDrawing namespaces are declared at
    // the root so all DrawingML elements (and r:embed on inline pictures) resolve correctly.
    if (!obj["w:document"]["$"]) obj["w:document"]["$"] = {};
    const rootAttrs = obj["w:document"]["$"];
    if (!rootAttrs["xmlns:a"])  rootAttrs["xmlns:a"]  = NS_A;
    if (!rootAttrs["xmlns:r"])  rootAttrs["xmlns:r"]  = NS_R;
    if (!rootAttrs["xmlns:wp"]) rootAttrs["xmlns:wp"] = NS_WP;

    const xml = XmlUtils.buildXml(obj["w:document"], {
      rootName: "w:document",
      headless: false,
      pretty: true,
    });
    this.zip.addFile(DOCUMENT_PATH, Buffer.from(xml, "utf-8"));
  }

  private getBodyParagraphs(obj: any): any[] {
    const raw = obj?.["w:document"]?.["w:body"]?.["w:p"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  private norm(val: any): any[] {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
  }

  // ─── ID management ────────────────────────────────────────────────────────

  private async nextShapeId(): Promise<number> {
    const shapes = await this.getShapes();
    if (!shapes.length) return 1;
    return Math.max(...shapes.map((s) => s.id)) + 1;
  }

  // ─── Drawing XML builders ─────────────────────────────────────────────────

  private buildSpPr(size: ShapeSize, prst: string, fill?: string, border?: string): any {
    const fillNode = fill
      ? { "a:solidFill": { "a:srgbClr": { $: { val: fill } } } }
      : { "a:noFill": {} };
    const lnNode = border
      ? { "a:solidFill": { "a:srgbClr": { $: { val: border } } } }
      : { "a:solidFill": { "a:srgbClr": { $: { val: "000000" } } } };

    return {
      "a:xfrm": {
        "a:off": { $: { x: "0", y: "0" } },
        "a:ext": { $: { cx: String(size.width), cy: String(size.height) } },
      },
      "a:prstGeom": {
        $: { prst },
        "a:avLst": {},
      },
      ...fillNode,
      "a:ln": lnNode,
    };
  }

  private buildWsp(
    id: number,
    name: string,
    size: ShapeSize,
    prst: string,
    fill?: string,
    border?: string,
    textContent?: string,
    textOpts?: { textColor?: string; fontSize?: number; bold?: boolean; textAlign?: "l" | "ctr" | "r" },
    isTextBox = false,
  ): any {
    const wsp: any = {
      "wps:cNvPr": { $: { id: String(id), name } },
      "wps:cNvSpPr": isTextBox
        ? { $: { txBx: "1" }, "a:spLocks": { $: { noChangeArrowheads: "1" } } }
        : { "a:spLocks": { $: { noChangeArrowheads: "1" } } },
      "wps:spPr": this.buildSpPr(size, prst, fill, border),
    };

    if (textContent !== undefined) {
      const rPr: any = {};
      if (textOpts?.bold) rPr["w:b"] = {};
      if (textOpts?.textColor) rPr["w:color"] = { $: { "w:val": textOpts.textColor } };
      if (textOpts?.fontSize) {
        rPr["w:sz"]   = { $: { "w:val": String(textOpts.fontSize * 2) } };
        rPr["w:szCs"] = { $: { "w:val": String(textOpts.fontSize * 2) } };
      }
      const pPr: any = {};
      if (textOpts?.textAlign) {
        const jcVal = TEXT_ALIGN_MAP[textOpts.textAlign] ?? textOpts.textAlign;
        pPr["w:jc"] = { $: { "w:val": jcVal } };
      }

      wsp["wps:txbx"] = {
        "w:txbxContent": {
          $: { "xmlns:w": NS_W },
          "w:p": {
            ...(Object.keys(pPr).length ? { "w:pPr": pPr } : {}),
            "w:r": {
              ...(Object.keys(rPr).length ? { "w:rPr": rPr } : {}),
              "w:t": { _: textContent, $: { "xml:space": "preserve" } },
            },
          },
        },
      };
      wsp["wps:bodyPr"] = {
        $: {
          vertOverflow: "overflow",
          horzOverflow: "overflow",
          wrap: "square",
          lIns: "91440",
          tIns: "45720",
          rIns: "91440",
          bIns: "45720",
          anchor: "ctr",
          anchorCtr: "1",
        },
      };
    } else {
      wsp["wps:bodyPr"] = {};
    }

    return wsp;
  }

  private buildGraphicData(wsp: any): any {
    return {
      $: { uri: "http://schemas.microsoft.com/office/word/2010/wordprocessingShape" },
      "wps:wsp": wsp,
    };
  }

  private buildAnchor(
    id: number,
    name: string,
    size: ShapeSize,
    position: ShapePosition,
    graphicData: any,
  ): any {
    return {
      "wp:anchor": {
        $: {
          distT: "0", distB: "0", distL: "114300", distR: "114300",
          simplePos: "0", relativeHeight: "251658240",
          behindDoc: "0", locked: "0", layoutInCell: "1", allowOverlap: "1",
        },
        "wp:simplePos": { $: { x: "0", y: "0" } },
        "wp:positionH": {
          $: { relativeFrom: "column" },
          "wp:posOffset": String(position.x),
        },
        "wp:positionV": {
          $: { relativeFrom: "paragraph" },
          "wp:posOffset": String(position.y),
        },
        "wp:extent": { $: { cx: String(size.width), cy: String(size.height) } },
        "wp:effectExtent": { $: { l: "0", t: "0", r: "0", b: "0" } },
        "wp:wrapSquare": { $: { wrapText: "bothSides" } },
        "wp:docPr": { $: { id: String(id), name } },
        "wp:cNvGraphicFramePr": {
          "a:graphicFrameLocks": { $: { noChangeAspect: "1" } },
        },
        "a:graphic": {
          "a:graphicData": graphicData,
        },
      },
    };
  }

  private buildInline(
    id: number,
    name: string,
    size: ShapeSize,
    graphicData: any,
  ): any {
    return {
      "wp:inline": {
        $: { distT: "0", distB: "0", distL: "0", distR: "0" },
        "wp:extent": { $: { cx: String(size.width), cy: String(size.height) } },
        "wp:effectExtent": { $: { l: "0", t: "0", r: "0", b: "0" } },
        "wp:docPr": { $: { id: String(id), name } },
        "wp:cNvGraphicFramePr": {
          "a:graphicFrameLocks": { $: { noChangeAspect: "1" } },
        },
        "a:graphic": {
          "a:graphicData": graphicData,
        },
      },
    };
  }

  // ─── Document injection ───────────────────────────────────────────────────

  private insertDrawingParagraph(
    obj: any,
    drawing: any,
    paragraphIndex?: number,
  ): void {
    const body       = obj["w:document"]["w:body"];
    const paragraphs = this.getBodyParagraphs(obj);

    // Wrap in mc:AlternateContent so Word can open the document reliably.
    // mc:Choice tells Word 2010+ to use the WPS drawing; mc:Fallback is empty
    // (shapes disappear in Word 2007 but the file stays openable).
    const newPara = {
      "w:r": {
        "mc:AlternateContent": {
          "mc:Choice": {
            $: { Requires: "wps" },
            "w:drawing": drawing,
          },
          "mc:Fallback": {},
        },
      },
    };

    if (paragraphIndex === undefined) {
      paragraphs.push(newPara);
    } else {
      const idx = Math.max(0, Math.min(paragraphIndex, paragraphs.length));
      paragraphs.splice(idx, 0, newPara);
    }
    body["w:p"] = paragraphs;
  }

  // ─── Shape extraction ─────────────────────────────────────────────────────

  /** Collect all w:drawing nodes from a run, handling both direct and
   *  mc:AlternateContent-wrapped drawings. */
  private drawingsFromRun(r: any): any[] {
    const result: any[] = [];
    // Direct drawing (legacy / inline shapes without wrapper)
    for (const d of this.norm(r["w:drawing"])) result.push(d);
    // mc:AlternateContent wrapper (produced by this manager and by Word itself)
    for (const ac of this.norm(r["mc:AlternateContent"])) {
      for (const choice of this.norm(ac["mc:Choice"])) {
        for (const d of this.norm(choice["w:drawing"])) result.push(d);
      }
    }
    return result;
  }

  private extractShapesFromParagraph(p: any): ShapeEntry[] {
    const entries: ShapeEntry[] = [];
    for (const r of this.norm(p["w:r"])) {
      for (const drawing of this.drawingsFromRun(r)) {
        const anchor = drawing["wp:anchor"];
        const inline = drawing["wp:inline"];
        const container = anchor ?? inline;
        if (!container) continue;

        const docPr   = container["wp:docPr"];
        const id      = parseInt(docPr?.$?.id ?? "0", 10);
        const name    = docPr?.$?.name ?? "";
        const extent  = container["wp:extent"];
        const size: ShapeSize = {
          width:  parseInt(extent?.$?.cx ?? "0", 10),
          height: parseInt(extent?.$?.cy ?? "0", 10),
        };

        let position: ShapePosition | undefined;
        if (anchor) {
          position = {
            x: parseInt(anchor["wp:positionH"]?.["wp:posOffset"] ?? "0", 10),
            y: parseInt(anchor["wp:positionV"]?.["wp:posOffset"] ?? "0", 10),
          };
        }

        const wsp = container["a:graphic"]?.["a:graphicData"]?.["wps:wsp"];
        let type: ShapeEntry["type"] = "unknown";
        if (wsp) {
          if (wsp["wps:txbx"]) {
            type = "textbox";
          } else {
            const prst = wsp["wps:spPr"]?.["a:prstGeom"]?.$?.prst;
            type = (prst as ShapeType) ?? "unknown";
          }
        }

        entries.push({ id, name, type, size, ...(position ? { position } : {}) });
      }
    }
    return entries;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  public async getShapes(): Promise<ShapeEntry[]> {
    const obj        = await this.readDocument();
    const paragraphs = this.getBodyParagraphs(obj);
    return paragraphs.flatMap((p) => this.extractShapesFromParagraph(p));
  }

  public async insertTextBox(opts: TextBoxOptions): Promise<number> {
    const id       = await this.nextShapeId();
    const name     = `TextBox ${id}`;
    const floating = opts.floating !== false;
    const size     = opts.size ?? { width: 2_743_200, height: 1_143_000 };
    const position = opts.position ?? { x: 914_400, y: 914_400 };

    const wsp         = this.buildWsp(id, name, size, "rect", opts.fillColor ?? "FFFFFF", opts.borderColor, opts.text, undefined, true);
    const graphicData = this.buildGraphicData(wsp);
    const drawing     = floating
      ? this.buildAnchor(id, name, size, position, graphicData)
      : this.buildInline(id, name, size, graphicData);

    const obj = await this.readDocument();
    this.insertDrawingParagraph(obj, drawing, opts.paragraphIndex);
    await this.writeDocument(obj);
    return id;
  }

  public async insertShape(type: ShapeType, opts: InsertShapeOptions = {}): Promise<number> {
    const id       = await this.nextShapeId();
    const name     = opts.name ?? `Shape ${id}`;
    const floating = opts.floating !== false;
    const size     = opts.size ?? { width: 2_743_200, height: 1_143_000 };
    const position = opts.position ?? { x: 914_400, y: 914_400 };

    const wsp         = this.buildWsp(id, name, size, type, opts.fillColor, opts.borderColor, opts.text, {
      textColor: opts.textColor,
      fontSize: opts.fontSize,
      bold: opts.bold,
      textAlign: opts.textAlign,
    });
    const graphicData = this.buildGraphicData(wsp);
    const drawing     = floating
      ? this.buildAnchor(id, name, size, position, graphicData)
      : this.buildInline(id, name, size, graphicData);

    const obj = await this.readDocument();
    this.insertDrawingParagraph(obj, drawing, opts.paragraphIndex);
    await this.writeDocument(obj);
    return id;
  }

  public async insertLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts: InsertLineOptions = {},
  ): Promise<number> {
    const id   = await this.nextShapeId();
    const name = `Line ${id}`;

    const dx = x2 - x1;
    const dy = y2 - y1;
    // flipH when going left; flipV when going up — reverses tail/head of the line shape
    const flipH = dx < 0;
    const flipV = dy < 0;

    const cx = Math.abs(dx) || 9525;
    const cy = Math.abs(dy) || 9525;

    const posX = Math.min(x1, x2);
    const posY = Math.min(y1, y2);

    const size: ShapeSize     = { width: cx, height: cy };
    const position: ShapePosition = { x: posX, y: posY };

    const lineW = Math.round((opts.lineWidthPt ?? 1) * 12700);
    const color = opts.color ?? "000000";

    const xfrmAttrs: Record<string, string> = {};
    if (flipH) xfrmAttrs.flipH = "1";
    if (flipV) xfrmAttrs.flipV = "1";

    const lnContent: any = {
      "a:solidFill": { "a:srgbClr": { $: { val: color } } },
    };
    if (opts.arrowEnd)   lnContent["a:tailEnd"] = { $: { type: "arrow" } };
    if (opts.arrowStart) lnContent["a:headEnd"] = { $: { type: "arrow" } };

    const spPr: any = {
      "a:xfrm": {
        ...(Object.keys(xfrmAttrs).length ? { $: xfrmAttrs } : {}),
        "a:off": { $: { x: "0", y: "0" } },
        "a:ext": { $: { cx: String(cx), cy: String(cy) } },
      },
      "a:prstGeom": { $: { prst: "line" }, "a:avLst": {} },
      "a:noFill": {},
      "a:ln": { $: { w: String(lineW) }, ...lnContent },
    };

    const wsp: any = {
      "wps:cNvSpPr": { "a:spLocks": { $: { noChangeArrowheads: "1" } } },
      "wps:spPr": spPr,
      "wps:bodyPr": {},
    };

    const graphicData = this.buildGraphicData(wsp);
    const drawing     = this.buildAnchor(id, name, size, position, graphicData);

    const obj = await this.readDocument();
    this.insertDrawingParagraph(obj, drawing, opts.paragraphIndex);
    await this.writeDocument(obj);

    if (opts.label) {
      const midX = Math.round((x1 + x2) / 2) + (opts.labelOffsetX ?? 0);
      const midY = Math.round((y1 + y2) / 2) + (opts.labelOffsetY ?? 0);
      await this.insertTextBox({
        text:        opts.label,
        position:    { x: midX, y: midY - 114300 },
        size:        { width: 640080, height: 200000 },
        fillColor:   "FFFFFF",
        borderColor: "FFFFFF",
        paragraphIndex: opts.paragraphIndex,
      });
    }

    return id;
  }

  /** Insert an inline picture referencing an already-registered image relId
   *  (see MediaManager.insertImage). width/height are in EMU (1 px @96dpi = 9525 EMU). */
  public async insertImage(
    relId: string,
    opts: { width: number; height: number; name?: string; paragraphIndex?: number },
  ): Promise<number> {
    const id = await this.nextShapeId();
    const name = opts.name ?? `Image ${id}`;
    const size: ShapeSize = { width: opts.width, height: opts.height };
    const graphicData = {
      $: { uri: "http://schemas.openxmlformats.org/drawingml/2006/picture" },
      "pic:pic": {
        $: { "xmlns:pic": "http://schemas.openxmlformats.org/drawingml/2006/picture" },
        "pic:nvPicPr": {
          "pic:cNvPr": { $: { id: String(id), name } },
          "pic:cNvPicPr": {},
        },
        "pic:blipFill": {
          "a:blip": { $: { "r:embed": relId } },
          "a:stretch": { "a:fillRect": {} },
        },
        "pic:spPr": {
          "a:xfrm": {
            "a:off": { $: { x: "0", y: "0" } },
            "a:ext": { $: { cx: String(size.width), cy: String(size.height) } },
          },
          "a:prstGeom": { $: { prst: "rect" }, "a:avLst": {} },
        },
      },
    };
    const drawing = this.buildInline(id, name, size, graphicData);
    const obj = await this.readDocument();
    this.insertDrawingParagraph(obj, drawing, opts.paragraphIndex);
    await this.writeDocument(obj);
    return id;
  }

  public async deleteShape(id: number): Promise<void> {
    const obj        = await this.readDocument();
    const body       = obj["w:document"]["w:body"];
    const paragraphs = this.getBodyParagraphs(obj);

    for (const p of paragraphs) {
      const runs = this.norm(p["w:r"]);
      const filtered = runs.filter((r: any) => {
        // Check direct drawing
        for (const d of this.norm(r["w:drawing"])) {
          const container = d["wp:anchor"] ?? d["wp:inline"];
          if (parseInt(container?.["wp:docPr"]?.$?.id ?? "-1", 10) === id) return false;
        }
        // Check mc:AlternateContent-wrapped drawing
        for (const ac of this.norm(r["mc:AlternateContent"])) {
          for (const choice of this.norm(ac["mc:Choice"])) {
            for (const d of this.norm(choice["w:drawing"])) {
              const container = d["wp:anchor"] ?? d["wp:inline"];
              if (parseInt(container?.["wp:docPr"]?.$?.id ?? "-1", 10) === id) return false;
            }
          }
        }
        return true;
      });
      if (filtered.length !== runs.length) {
        p["w:r"] = filtered.length ? filtered : undefined;
      }
    }

    body["w:p"] = paragraphs;
    await this.writeDocument(obj);
  }
}
