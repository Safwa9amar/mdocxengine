import { describe, test, expect } from "vitest";
import AdmZip from "adm-zip";
import { Doc } from "./Doc";
import { Mdocxengine } from "./index";

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:rFonts w:cs="Traditional Arabic"/><w:rtl/></w:rPr><w:t>متن</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>عنوان</w:t></w:r></w:p></w:body></w:document>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`;

// Mdocxengine's constructor is private; loadFromBuffer is the factory. Doc.spec.ts
// opens a real sample .docx, but these assertions need a controlled two-paragraph
// document, so build the zip in memory instead.
async function makeDoc(): Promise<Doc> {
  const zip = new AdmZip();
  zip.addFile("word/document.xml", Buffer.from(DOCUMENT_XML, "utf-8"));
  zip.addFile("word/styles.xml", Buffer.from(STYLES_XML, "utf-8"));
  return Doc.from(await Mdocxengine.loadFromBuffer(zip.toBuffer()));
}

describe("Doc.setTextStyle", () => {
  test("creates Normal, patches it, and strips the body run's competing font", async () => {
    const doc = await makeDoc();
    const reports = await doc.setTextStyle(["body"], { font: "Simplified Arabic" });

    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      target: "body",
      styleId: "Normal",
      styleCreated: true,
      styleTouched: true,
      runsStripped: 1,
      directWrites: 0,
      paragraphsAffected: 1,
    });

    const styles = doc.engine.zip.readAsText("word/styles.xml") ?? "";
    expect(styles).toContain(`w:styleId="Normal"`);
    expect(styles).toContain(`w:cs="Simplified Arabic"`);

    const body = doc.engine.zip.readAsText("word/document.xml") ?? "";
    expect(body).not.toContain("Traditional Arabic");
    // The property we did NOT name survives.
    expect(body).toContain(`<w:rtl/>`);
  });

  test("headings target patches Heading1 and leaves the body paragraph alone", async () => {
    const doc = await makeDoc();
    const reports = await doc.setTextStyle(["headings"], { sizePt: 18, bold: true });

    const h1 = reports.find((r) => r.target === "heading1");
    expect(h1?.paragraphsAffected).toBe(1);
    expect(reports.find((r) => r.target === "heading4")?.paragraphsAffected).toBe(0);

    const styles = doc.engine.zip.readAsText("word/styles.xml") ?? "";
    expect(styles).toMatch(/w:styleId="Heading1"[\s\S]*<w:sz w:val="36"\/>/);
  });

  test("rejects an unknown target", async () => {
    const doc = await makeDoc();
    await expect(doc.setTextStyle(["footer" as never], { bold: true })).rejects.toThrow(
      /unknown target 'footer'/i,
    );
  });
});
