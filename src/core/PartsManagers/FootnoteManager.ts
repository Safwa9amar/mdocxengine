import * as XmlUtils from "@/utils/xmlUtils";
import { RelManager } from "@/core/PartsManagers/RelManager";
import { ContentTypesManager } from "./ContentTypesManager";
import { Run as RunInterface } from "@/core/files/paragraph/types";
import AdmZip from "adm-zip";

const FOOTNOTES_PATH = "word/footnotes.xml";
const FOOTNOTE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes";
const FOOTNOTE_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml";
const FOOTNOTE_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export interface FootnoteEntry {
  id: number;
  text: string;
}

export class FootnoteManager {
  private zip: AdmZip;
  private rels: RelManager;
  private contentTypes: ContentTypesManager;

  constructor(zip: AdmZip) {
    this.zip = zip;
    this.rels = new RelManager(zip);
    this.contentTypes = new ContentTypesManager(zip);
  }

  // ─── Internal read/write ──────────────────────────────────────────────────

  private async readFootnotes(): Promise<any> {
    const xml = this.zip.readAsText(FOOTNOTES_PATH);
    if (!xml) return this.emptyFootnotesDoc();
    return XmlUtils.parseXml(xml);
  }

  private async writeFootnotes(obj: any): Promise<void> {
    const xml = XmlUtils.buildXml(obj["w:footnotes"], {
      rootName: "w:footnotes",
      headless: false,
      pretty: true,
    });
    this.zip.addFile(FOOTNOTES_PATH, Buffer.from(xml, "utf-8"));
  }

  private emptyFootnotesDoc(): any {
    return {
      "w:footnotes": {
        $: {
          "xmlns:w": FOOTNOTE_NS,
        },
        "w:footnote": [
          // Required separator footnotes that Word expects
          {
            $: { "w:type": "separator", "w:id": "-1" },
            "w:p": {
              "w:r": { "w:separator": {} },
            },
          },
          {
            $: { "w:type": "continuationSeparator", "w:id": "0" },
            "w:p": {
              "w:r": { "w:continuationSeparator": {} },
            },
          },
        ],
      },
    };
  }

  private normalizeArray(obj: any): any[] {
    const raw = obj?.["w:footnotes"]?.["w:footnote"];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  private nextId(footnotes: any[]): number {
    const ids = footnotes
      .map((f) => parseInt(f.$?.["w:id"] ?? "0", 10))
      .filter((n) => n > 0);
    return ids.length ? Math.max(...ids) + 1 : 1;
  }

  // ─── Registration (called once when footnotes are first added) ────────────

  private async ensureRegistered(): Promise<void> {
    const alreadyExists = this.zip.getEntry(FOOTNOTES_PATH);
    if (!alreadyExists) {
      await this.writeFootnotes(this.emptyFootnotesDoc());
      await this.contentTypes.addOverride(`/${FOOTNOTES_PATH}`, FOOTNOTE_CONTENT_TYPE);
      await this.rels.addRelationship(
        await this.rels.genId(),
        FOOTNOTE_REL_TYPE,
        "footnotes.xml",
      );
    }
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Returns all user-defined footnotes (excludes separator entries).
   */
  public async getFootnotes(): Promise<FootnoteEntry[]> {
    const obj = await this.readFootnotes();
    return this.normalizeArray(obj)
      .filter((f) => !f.$?.["w:type"])
      .map((f) => ({
        id: parseInt(f.$?.["w:id"] ?? "0", 10),
        text: this.extractText(f),
      }));
  }

  /**
   * Adds a new footnote to footnotes.xml and returns a run object
   * that should be inserted into the paragraph at the desired position.
   *
   * @param text   The footnote body text.
   * @returns      The footnote id and a run object containing the reference mark.
   */
  public async addFootnote(text: string): Promise<{ id: number; run: RunInterface }> {
    await this.ensureRegistered();

    const obj = await this.readFootnotes();
    const footnotes = this.normalizeArray(obj);
    const id = this.nextId(footnotes);

    footnotes.push({
      $: { "w:id": String(id) },
      "w:p": {
        "w:pPr": { "w:pStyle": { $: { "w:val": "FootnoteText" } } },
        "w:r": [
          {
            "w:rPr": { "w:rStyle": { $: { "w:val": "FootnoteReference" } } },
            "w:footnoteRef": {},
          },
          {
            "w:t": { _: ` ${text}`, $: { "xml:space": "preserve" } },
          },
        ],
      },
    });

    obj["w:footnotes"]["w:footnote"] = footnotes;
    await this.writeFootnotes(obj);

    const run: RunInterface = {
      "w:rPr": { "w:rStyle": { $: { "w:val": "FootnoteReference" } } },
      "w:t": undefined,
      ...({"w:footnoteReference": { $: { "w:id": String(id) } }} as any),
    };

    return { id, run };
  }

  /**
   * Removes a footnote by id from footnotes.xml.
   * You must also manually remove the <w:footnoteReference> run from the document.
   */
  public async removeFootnote(id: number): Promise<void> {
    const obj = await this.readFootnotes();
    obj["w:footnotes"]["w:footnote"] = this.normalizeArray(obj).filter(
      (f) => parseInt(f.$?.["w:id"] ?? "0", 10) !== id,
    );
    await this.writeFootnotes(obj);
  }

  /**
   * Returns a run object (w:r) with a footnote reference mark for inline insertion.
   * Use after addFootnote() to get the inline anchor run.
   */
  public createFootnoteRun(footnoteId: number): RunInterface {
    return {
      "w:rPr": { "w:rStyle": { $: { "w:val": "FootnoteReference" } } },
      ...({ "w:footnoteReference": { $: { "w:id": String(footnoteId) } } } as any),
    };
  }

  private extractText(footnote: any): string {
    const p = footnote["w:p"];
    if (!p) return "";
    const runs = p["w:r"];
    if (!runs) return "";
    const arr = Array.isArray(runs) ? runs : [runs];
    return arr
      .map((r: any) => {
        const t = r["w:t"];
        if (!t) return "";
        return typeof t === "string" ? t : t._ ?? "";
      })
      .join("")
      .trim();
  }
}
