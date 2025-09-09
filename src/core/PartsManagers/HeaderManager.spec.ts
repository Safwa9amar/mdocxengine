import { HeaderManager, ZipManager } from "@/index";
import logger from "@/utils/Logger";
import { describe, test, beforeAll, expect, it } from "vitest";
type XmlParagraph = {
  readonly p: "w:p";
};
describe("HeaderManager", () => {
  let zip: ZipManager;
  let header: HeaderManager;
  // ✅ Load resources before tests
  beforeAll(async () => {
    zip = await ZipManager.loadFromFile("./samples/example.docx");
    header = new HeaderManager(zip);
  });

  // ✅ Actual test goes inside `test` or `it`
  test("should add a simple header", async () => {
    let text = "hassani hammza";
    const { headerPath, relId, headerXml } = await header.addHeaderSimple("hamza hassani");
    // Save the output if needed
    await zip.saveToFile(`./samples/outputs/added-header-is-${text}.docx`);

    // Proper assertion
    expect(typeof headerPath).toBe("string");
    expect(headerPath).toContain("header");
    expect(relId).toBeDefined();
    expect(headerXml).toBeDefined();
  });
});
