import { describe, test, expect } from "vitest";
import path from "path";
import { Doc } from "./Doc";

const INPUT = path.resolve("samples/example.docx");

// Build a region of PLAIN-TEXT titles (bold/centered, but NO heading styles),
// mirroring a real Arabic thesis where structure lives only in the text.
async function withPlainThesisTail() {
  const doc = await Doc.open(INPUT);
  const base = (await doc.blocks()).length;
  await doc.addParagraph("الفصل الأول: منهج البحث وإجراءاته الميدانية", { bold: true, alignment: "center", rtl: true });
  await doc.addParagraph("تمهيد", { bold: true, rtl: true });
  await doc.addParagraph(
    "هذا نص تمهيدي طويل يحتوي على عدد كبير من الكلمات لكي يُحتسب فقرة جسمية وليس عنواناً قصيراً في عملية الاستدلال على البنية الهيكلية للوثيقة المدروسة هنا بدقة.",
    { rtl: true },
  );
  await doc.addParagraph("الدراسة الاستطلاعية", { bold: true, rtl: true });
  await doc.addParagraph("الجدول رقم (01): يبين مواصفات عينة البحث", { bold: true, rtl: true });
  await doc.addParagraph("قائمة المراجع", { bold: true, rtl: true });
  return { doc, base };
}

describe("Doc.blocksDetailed / inferOutline / setHeadingLevel (plain-text structure)", () => {
  test("blocksDetailed exposes bold/alignment/wordCount/caption signals", async () => {
    const { doc, base } = await withPlainThesisTail();
    const d = await doc.blocksDetailed();

    const chapter = d[base];
    expect(chapter.headingLevel).toBe(0); // NOT a styled heading
    expect(chapter.bold).toBe(true);
    expect(chapter.alignment).toBe("center");

    const tamhid = d[base + 1];
    expect(tamhid.bold).toBe(true);
    expect(tamhid.wordCount).toBe(1);
    expect(tamhid.looksLikeCaption).toBe(false);

    const caption = d[base + 4];
    expect(caption.looksLikeCaption).toBe(true);
  });

  test("inferOutline detects untyped headings, levels them, and excludes captions/body", async () => {
    const { doc, base } = await withPlainThesisTail();
    const inferred = await doc.inferOutline();
    const byIndex = new Map(inferred.map((h) => [h.index, h]));

    expect(byIndex.get(base)?.level).toBe(1); // "الفصل ..." → chapter pattern
    expect(byIndex.get(base)?.reason).toContain("pattern");
    expect(byIndex.get(base + 1)?.level).toBe(2); // "تمهيد" → section keyword
    expect(byIndex.get(base + 3)).toBeTruthy(); // "الدراسة الاستطلاعية" → bold + short
    expect(byIndex.has(base + 4)).toBe(false); // caption excluded
    expect(byIndex.get(base + 5)?.level).toBe(1); // "قائمة المراجع" → level-1 keyword
    expect(byIndex.has(base + 2)).toBe(false); // long body paragraph excluded
  });

  test("setHeadingLevel promotes a plain title to a real heading (preserving text + rtl)", async () => {
    const { doc, base } = await withPlainThesisTail();

    // Before: not a heading; outline can't see it.
    expect((await doc.blocks())[base].headingLevel).toBe(0);

    await doc.setHeadingLevel(base, 1);

    const promoted = (await doc.blocks())[base];
    expect(promoted.headingLevel).toBe(1);
    expect(promoted.text).toContain("منهج البحث"); // text preserved

    const outline = await doc.outline();
    expect(outline.some((n) => n.level === 1 && n.title.includes("منهج البحث"))).toBe(true);

    // Now inferOutline reports it as a real (styled) heading, not a guess.
    const inferred = await doc.inferOutline();
    expect(inferred.find((h) => h.index === base)?.confidence).toBe("styled");
  });

  test("end-to-end: promote all inferred headings, then the outline is populated", async () => {
    const { doc } = await withPlainThesisTail();
    const inferred = await doc.inferOutline();
    // Promote each inferred (non-styled) heading to a real one.
    for (const h of inferred.filter((x) => x.confidence !== "styled")) {
      await doc.setHeadingLevel(h.index, h.level);
    }
    const outline = await doc.outline();
    expect(outline.some((n) => n.title.includes("منهج البحث"))).toBe(true);
    expect(outline.some((n) => n.title.includes("قائمة المراجع"))).toBe(true);
  });
});
