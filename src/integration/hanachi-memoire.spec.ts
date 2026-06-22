/**
 * Integration test for: samples/مذكرة فتيحة حساني.docx
 *
 * Document characteristics:
 *   - 672 paragraphs, ~17 sections (16 inline sectPr + 1 main)
 *   - Heading styles: Titre1 (outlineLvl 0) → Titre4 (outlineLvl 3)
 *   - 24 numbering definitions (numId 1–24), 39 numbered paragraphs
 *   - 17 header/footer file pairs; footers carry page numbers & academic year
 *   - No existing TOC or TOF (caption fields) — we insert them here
 *
 * Tests cover:
 *   1. Read — baseline assertions on the loaded document
 *   2. Sections — update existing section headers/footers, add new section
 *   3. Numbering — apply existing numId, add new bulleted list definition
 *   4. TOC — insert Table of Contents (Titre1–Titre4 → heading levels 1–4)
 *   5. TOF — insert figure/table captions then List of Tables & List of Figures
 */

import { describe, test, expect, beforeAll } from "vitest";
import path from "path";
import fs from "fs";
import { Mdocxengine, Paragraph, Run } from "@/index";

const INPUT  = path.resolve("samples/مذكرة فتيحة حساني.docx");
const OUTPUT = path.resolve("samples/outputs/hanachi-memoire-updated.docx");

let engine: Mdocxengine;

// ── helpers ───────────────────────────────────────────────────────────────────

function makePara(text: string, style?: string, bold = false): Paragraph {
  const p   = new Paragraph({ $: {}, "w:r": [] } as any);
  const run = Run.fromText(text);
  if (bold) run.setBold();
  p.addRun(run);
  if (style) p.applyStyle(style);
  return p;
}

function buildHeaderXml(text: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pStyle w:val="En-tte"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>
  </w:p>
</w:hdr>`;
}

function buildFooterWithPageXml(label: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p>
    <w:pPr>
      <w:pStyle w:val="Pieddepage"/>
      <w:jc w:val="center"/>
    </w:pPr>
    <w:r><w:t xml:space="preserve">${label}  |  </w:t></w:r>
    <w:r><w:fldChar w:fldCharType="begin"/></w:r>
    <w:r><w:instrText xml:space="preserve"> PAGE \* ARABIC \* MERGEFORMAT </w:instrText></w:r>
    <w:r><w:fldChar w:fldCharType="separate"/></w:r>
    <w:r><w:t>1</w:t></w:r>
    <w:r><w:fldChar w:fldCharType="end"/></w:r>
  </w:p>
</w:ftr>`;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("مذكرة فتيحة حساني — read, modify sections, numbering, TOC, TOF", () => {
  beforeAll(async () => {
    fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
    engine = await Mdocxengine.loadFromFile(INPUT);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 1. READ — baseline assertions
  // ══════════════════════════════════════════════════════════════════════════

  describe("1. Read", () => {
    test("document loads and has many paragraphs", async () => {
      const paragraphs = await engine.document.getParagraphs();
      expect(paragraphs.length).toBeGreaterThan(100);
    });

    test("heading styles Titre1–Titre4 are present", async () => {
      const styles = await engine.styles.listStyles();
      const ids    = styles.map((s) => s.id);
      expect(ids).toContain("Titre1");
      expect(ids).toContain("Titre2");
      expect(ids).toContain("Titre3");
    });

    test("Titre1 paragraphs are discoverable", async () => {
      const paragraphs = await engine.document.getParagraphs();
      const h1 = paragraphs.filter((p) => {
        const raw = (p as any).paragraph;
        return raw["w:pPr"]?.["w:pStyle"]?.["$"]?.["w:val"] === "Titre1";
      });
      expect(h1.length).toBeGreaterThan(2);
    });

    test("document has multiple sections (inline sectPr)", () => {
      const xml = engine.zip.readAsText("word/document.xml")!;
      const count = (xml.match(/<w:sectPr/g) ?? []).length;
      expect(count).toBeGreaterThan(5);
    });

    test("existing header files are discoverable", () => {
      const headers = engine.header.getAllheadersFiles(engine.zip);
      expect(headers.length).toBeGreaterThan(0);
    });

    test("existing footer files carry page numbers or text", () => {
      const footers = engine.footer.getAllFooterFiles(engine.zip);
      expect(footers.length).toBeGreaterThan(0);
      const withContent = footers.filter((f) => {
        const xml = engine.zip.readAsText(f.fileName) ?? "";
        return xml.includes("PAGE") || xml.match(/<w:t[^>]*>[^<]+<\/w:t>/);
      });
      expect(withContent.length).toBeGreaterThan(0);
    });

    test("numbering definitions exist", async () => {
      const defs = await engine.numbering.getNumberingDefinitions();
      expect(defs.length).toBeGreaterThan(5);
    });

    test("core metadata is readable", async () => {
      const meta = await engine.metadata.getCoreProperties();
      expect(meta).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. SECTIONS — update headers/footers, add a new appendix section
  // ══════════════════════════════════════════════════════════════════════════

  describe("2. Sections", () => {
    test("update section 5 header text (تمهيد → Introduction & Foreword)", () => {
      const newXml = buildHeaderXml("مذكرة ماستر — تمهيد: Introduction & Foreword");
      engine.header.updateHeader("word/header5.xml", newXml);

      const xml = engine.zip.readAsText("word/header5.xml")!;
      expect(xml).toContain("Foreword");
      expect(xml).toContain("تمهيد");
    });

    test("update section 7 header (المبحث الأول — add chapter label)", () => {
      const newXml = buildHeaderXml("الفصل الأول — الإطار العام للتدقيق المالي");
      engine.header.updateHeader("word/header7.xml", newXml);

      const xml = engine.zip.readAsText("word/header7.xml")!;
      expect(xml).toContain("الفصل الأول");
    });

    test("update footer1 — replace academic year with updated year", () => {
      const newXml = buildFooterWithPageXml("الموسم الجامعي: 2025-2026");
      engine.footer.updateFooter("word/footer1.xml", newXml);

      const xml = engine.zip.readAsText("word/footer1.xml")!;
      expect(xml).toContain("2025-2026");
      expect(xml).toContain("PAGE");
    });

    test("update all numbered content footers to show section label + page", () => {
      // Footers 5, 7, 9, 11, 13 carry page numbers
      const contentFooters = ["word/footer5.xml", "word/footer7.xml",
                              "word/footer9.xml", "word/footer11.xml"];
      contentFooters.forEach((fp) => {
        const existing = engine.zip.readAsText(fp);
        if (existing) {
          const newXml = buildFooterWithPageXml("مذكرة فتيحة حساني");
          engine.footer.updateFooter(fp, newXml);
          expect(engine.zip.readAsText(fp)).toContain("فتيحة حساني");
        }
      });
    });

    test("add a new Appendix section header and footer", async () => {
      const { headerPath } = await engine.header.addHeader(
        "الملاحق",
        "default",
        buildHeaderXml("الملاحق — Annexes"),
      );
      const { footerPath } = await engine.footer.addFooter(
        "الملاحق",
        "default",
        buildFooterWithPageXml("الملاحق"),
      );

      expect(engine.zip.readAsText(headerPath)).toContain("Annexes");
      expect(engine.zip.readAsText(footerPath)).toContain("الملاحق");
      expect(engine.zip.readAsText(footerPath)).toContain("PAGE");
    });

    test("set Different First Page on main sectPr", async () => {
      await engine.header.setDifferentFirstPage(true);
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain("w:titlePg");
    });

    test("set page number format to decimal starting at 1", async () => {
      await engine.footer.formatPageNumbers({ format: "decimal", startAt: 1 });
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain("w:pgNumType");
    });

    test("set header distance (top margin for header)", async () => {
      await engine.header.setHeaderDistance(709); // 0.49" — Word default
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain('w:header="709"');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. NUMBERING
  // ══════════════════════════════════════════════════════════════════════════

  describe("3. Numbering", () => {
    const NEW_NUM_ID = "25";
    const NEW_ABSTRACT_NUM_ID = "25";

    test("append an appendix heading (Titre1 style)", async () => {
      const p = makePara("الملاحق", "Titre1", true);
      await engine.document.insertParagraph(p);
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain("الملاحق");
    });

    test("apply existing numId=14 to new paragraphs (ordered list)", async () => {
      const items = [
        "الملحق رقم 01: الميزانية العامة للمؤسسة لسنة 2015",
        "الملحق رقم 02: الميزانية العامة للمؤسسة لسنة 2016",
        "الملحق رقم 03: جدول حسابات النتائج",
      ];

      for (const text of items) {
        const p = new Paragraph({ $: {}, "w:r": [] } as any);
        p.addRun(Run.fromText(text));
        await engine.document.insertParagraph(p);
      }

      // Apply numbering to the 3 newly inserted paragraphs then persist
      const all   = await engine.document.getParagraphs();
      const last3 = all.slice(-3);
      for (const p of last3) {
        engine.numbering.applyNumbering(p, "14", 0);
      }
      await engine.document.saveChanges(all);

      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain("الملحق رقم 01");
      expect(xml).toContain("الملحق رقم 03");
      expect(xml).toContain('w:numId w:val="14"');
    }, 30000);

    test("add a new numbering definition (bullet list) and verify", async () => {
      await engine.numbering.addNumberingDefinition(NEW_NUM_ID, NEW_ABSTRACT_NUM_ID);

      const defs  = await engine.numbering.getNumberingDefinitions();
      const found = defs.find((d) => d.numId === NEW_NUM_ID);
      expect(found).toBeDefined();
    });

    test("apply new numbering definition to recommendation paragraphs", async () => {
      const h = makePara("التوصيات", "Titre2", true);
      await engine.document.insertParagraph(h);

      const recs = [
        "تعزيز استقلالية المدقق المالي الداخلي والخارجي",
        "اعتماد معايير التدقيق الدولية ISA بشكل كامل",
        "تطوير كفاءات فريق التدقيق عبر التدريب المستمر",
      ];

      for (const rec of recs) {
        const p = new Paragraph({ $: {}, "w:r": [] } as any);
        p.addRun(Run.fromText(rec));
        await engine.document.insertParagraph(p);
      }

      // Apply numbering to the 3 items then persist
      const all   = await engine.document.getParagraphs();
      const last3 = all.slice(-3);
      for (const p of last3) {
        engine.numbering.applyNumbering(p, NEW_NUM_ID, 0);
      }
      await engine.document.saveChanges(all);

      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain("التوصيات");
      expect(xml).toContain("استقلالية المدقق");
      expect(xml).toContain(`w:numId w:val="${NEW_NUM_ID}"`);
    }, 30000);

    test("remove numbering from a paragraph (in-memory check)", async () => {
      const p = new Paragraph({ $: {}, "w:r": [] } as any);
      p.addRun(Run.fromText("فقرة مؤقتة بدون قائمة"));
      await engine.document.insertParagraph(p);

      const all  = await engine.document.getParagraphs();
      const last = all[all.length - 1];

      engine.numbering.applyNumbering(last, "14", 0);
      const raw = (last as any).paragraph;
      expect(raw["w:pPr"]?.["w:numPr"]).toBeDefined();

      engine.numbering.removeNumbering(last);
      expect(raw["w:pPr"]?.["w:numPr"]).toBeUndefined();
    }, 30000);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. TOC — Table of Contents
  // ══════════════════════════════════════════════════════════════════════════

  describe("4. TOC", () => {
    test("insert TOC at position 0 with Arabic/French title", async () => {
      await engine.toc.insertTOC(
        {
          title: "فهرس المحتويات — Table des Matières",
          headingDepth: 4, // covers Titre1–Titre4 (outlineLvl 0–3)
          useHyperlinks: true,
        },
        0,
      );

      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain('TOC \\o "1-4"');
      expect(xml).toContain("فهرس المحتويات");
      expect(xml).toContain("TOCHeading");
    });

    test("TOC field contains \\h hyperlink switch", () => {
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain("\\h");
    });

    test("TOC field does not contain w:dirty (no update-fields prompt)", () => {
      const xml = engine.zip.readAsText("word/document.xml")!;
      // The TOC field char itself should not carry w:dirty
      expect(xml).not.toContain('w:dirty="true"');
    });

    test("removeTOC cleans up TOC heading and field", async () => {
      await engine.toc.removeTOC();
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).not.toContain("TOCHeading");
    });

    test("re-insert TOC at position 2 (after front-matter paragraphs)", async () => {
      await engine.toc.insertTOC(
        {
          title: "فهرس المحتويات",
          headingDepth: 4,
          useHyperlinks: true,
        },
        2,
      );

      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain("فهرس المحتويات");
      expect(xml).toContain("TOCHeading");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5. TOF — Captions + List of Tables / List of Figures
  // ══════════════════════════════════════════════════════════════════════════

  describe("5. TOF — captions and caption lists", () => {
    test("insert 3 Table captions for existing financial tables", async () => {
      const titles = [
        "الميزانية العامة — بيانات السنة المالية 2015",
        "جدول حسابات النتائج للسنة 2015 مقارنةً بالسنة 2016",
        "مؤشرات الأداء المالي — نسب السيولة والمديونية",
      ];

      for (const title of titles) {
        // Re-fetch after each insert so the index stays at the true end
        const paragraphs = await engine.document.getParagraphs();
        await engine.captions.insertTableCaption(paragraphs.length - 1, title, "below");
      }

      const tableCaptions = await engine.captions.getCaptions("Table");
      expect(tableCaptions.length).toBe(3);
      expect(tableCaptions[0].text).toBe(titles[0]);
      expect(tableCaptions[2].text).toBe(titles[2]);
    }, 60000);

    test("table captions are numbered sequentially (1, 2, 3)", async () => {
      const captions = await engine.captions.getCaptions("Table");
      expect(captions[0].number).toBe("1");
      expect(captions[1].number).toBe("2");
      expect(captions[2].number).toBe("3");
    }, 30000);

    test("insert 2 Figure captions for diagrams", async () => {
      const figures = [
        "مخطط دورة التدقيق المالي — مراحل التخطيط والتنفيذ والتقرير",
        "هيكل المؤسسة التنظيمي — تسلسل الرقابة الداخلية",
      ];

      for (const title of figures) {
        const paragraphs = await engine.document.getParagraphs();
        await engine.captions.insertFigureCaption(paragraphs.length - 1, title);
      }

      const figureCaptions = await engine.captions.getCaptions("Figure");
      expect(figureCaptions.length).toBe(2);
      expect(figureCaptions[1].text).toBe(figures[1]);
    }, 60000);

    test("getCaptions() returns all 5 captions combined", async () => {
      const all = await engine.captions.getCaptions();
      expect(all.length).toBe(5);
    }, 30000);

    test("getCaptions filtered by label returns correct subset", async () => {
      const tables  = await engine.captions.getCaptions("Table");
      const figures = await engine.captions.getCaptions("Figure");
      expect(tables.length).toBe(3);
      expect(figures.length).toBe(2);
      tables.forEach((c) => expect(c.label).toBe("Table"));
      figures.forEach((c) => expect(c.label).toBe("Figure"));
    });

    test("insert List of Tables at position 4", async () => {
      await engine.captions.insertListOfTables("قائمة الجداول — Liste des Tableaux", 4);

      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain('\\c "Table"');
      expect(xml).toContain("قائمة الجداول");
      expect(xml).toContain("TOCHeading");
    });

    test("insert List of Figures at position 6 (after List of Tables)", async () => {
      await engine.captions.insertListOfFigures("قائمة الأشكال — Liste des Figures", 6);

      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain('\\c "Figure"');
      expect(xml).toContain("قائمة الأشكال");
    });

    test("List of Tables entries include table titles", () => {
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain("الميزانية العامة");
      expect(xml).toContain("مؤشرات الأداء المالي");
    });

    test("List of Figures entries include figure titles", () => {
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain("مخطط دورة التدقيق");
      expect(xml).toContain("هيكل المؤسسة التنظيمي");
    });

    test("caption lists contain no w:dirty fields", () => {
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).not.toContain('w:dirty="true"');
    });

    test("Caption and CaptionChar styles registered in styles.xml", async () => {
      const styles = await engine.styles.listStyles();
      const ids    = styles.map((s) => s.id);
      expect(ids).toContain("Caption");
      expect(ids).toContain("CaptionChar");
    });

    test("removeCaptionList removes List of Tables only", async () => {
      await engine.captions.removeCaptionList("Table");
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).not.toContain('\\c "Table"');
      // Figures list must survive
      expect(xml).toContain('\\c "Figure"');
    });

    test("re-insert List of Tables after removal", async () => {
      await engine.captions.insertListOfTables("قائمة الجداول", 4);
      const xml = engine.zip.readAsText("word/document.xml")!;
      expect(xml).toContain('\\c "Table"');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 6. Metadata — update document properties
  // ══════════════════════════════════════════════════════════════════════════

  describe("6. Metadata", () => {
    test("update core properties with thesis metadata", async () => {
      await engine.metadata.setCoreProperties({
        title:          "التدقيق المالي في المؤسسة الاقتصادية — دراسة تطبيقية",
        subject:        "علوم التسيير — المحاسبة والتدقيق",
        creator:        "فتيحة حساني",
        lastModifiedBy: "mdocxengine",
        description:    "مذكرة مقدمة لاستكمال متطلبات شهادة الماستر",
      });

      const meta = await engine.metadata.getCoreProperties();
      expect(meta.title).toBe("التدقيق المالي في المؤسسة الاقتصادية — دراسة تطبيقية");
      expect(meta.creator).toBe("فتيحة حساني");
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 7. Save
  // ══════════════════════════════════════════════════════════════════════════

  test("save updated document to disk", async () => {
    await engine.saveToFile(OUTPUT);
    expect(fs.existsSync(OUTPUT)).toBe(true);
    expect(fs.statSync(OUTPUT).size).toBeGreaterThan(10_000);
    console.log(`\n✓ Output written to: ${OUTPUT}`);
  });
});
