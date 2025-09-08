import HeaderManager from "../src/core/PartsManagers/HeaderManager";
import { ZipManager } from "../src/utils/ZipManager";

describe("HeaderManager", () => {
  let zip: any;
  let header: HeaderManager;

  // ✅ Load resources before tests
  beforeAll(async () => {
    zip = await ZipManager.loadFromFile("./tests/samples.docx");
    header = new HeaderManager(zip);
  });

  // ✅ Actual test goes inside `test` or `it`
  test("should add a simple header", async () => {
    const { headerPath, relId, headerXml } = await header.addHeaderSimple("hamza hassani");

    // Debugging output
    console.log(headerPath, relId);

    // Save the output if needed
    await zip.saveToFile("./tests/out.docx");

    // Proper assertion
    expect(typeof headerPath).toBe("string");
    expect(headerPath).toContain("header");
    expect(relId).toBeDefined();
    expect(headerXml).toBeDefined();
  });
});
