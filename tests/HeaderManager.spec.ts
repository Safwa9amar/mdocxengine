import { getDocxFiles } from "@/helpers/getDocxFiles";
import { HeaderManager, Mdocxengine, ZipManager } from "@/index";
import { parseXml } from "@/utils/xmlUtils";
import { describe, test, beforeAll, expect, it, afterAll } from "vitest";
import AdmZip from "adm-zip";
import { HeaderFile } from "@/constants";
let zip: AdmZip;
let header: HeaderManager;

describe("HeaderManager", () => {
  // ✅ Load resources before tests
  beforeAll(async () => {
    zip = new AdmZip("./samples/MEMOIRE-ABDELMADJID-Rev-1.03.docx");
    header = new HeaderManager(zip);
  });

  // ✅ Actual test goes inside `test` or `it`
  test("should add a simple header", async () => {
    expect(header.headers.length).greaterThan(0);
  });
});
