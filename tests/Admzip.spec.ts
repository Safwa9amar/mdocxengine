import { RelsDir, RelsFile } from "@/constants";
import { ZipManager } from "@/index";
import AdmZip from "adm-zip";
import { describe } from "vitest";

describe("test ad zip", async () => {
  let zip = new AdmZip("./samples/MEMOIRE-ABDELMADJID-Rev-1.03.docx");
  let rel = `<w:hamza>${zip.readAsText("_rels/.rels")}</w:hamza>`;
  zip.addFile("word/header222.xml", Buffer.from(rel, "utf-8"));
  zip.writeZip("./samples/outputs/xx.docx");
});
