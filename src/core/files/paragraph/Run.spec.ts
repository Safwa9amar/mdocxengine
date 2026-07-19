import { describe, test, expect } from "vitest";
import { Run } from "./Run";

describe("Run", () => {
  test("fromText() creates a run with the given text", () => {
    const run = Run.fromText("Hello");
    expect(run.getText()).toBe("Hello");
  });

  test("getText() handles TextNode object", () => {
    const run = new Run({ "w:t": { _: "World", $: {} } });
    expect(run.getText()).toBe("World");
  });

  test("getText() handles plain string w:t", () => {
    const run = new Run({ "w:t": "Plain" as any });
    expect(run.getText()).toBe("Plain");
  });

  test("getText() handles array of TextNodes", () => {
    const run = new Run({ "w:t": [{ _: "A", $: {} }, { _: "B", $: {} }] });
    expect(run.getText()).toBe("AB");
  });

  test("setText() updates text content", () => {
    const run = Run.fromText("old");
    run.setText("new");
    expect(run.getText()).toBe("new");
  });

  test("appendText() appends to existing text", () => {
    const run = Run.fromText("Hello");
    run.appendText(" World");
    expect(run.getText()).toBe("Hello World");
  });

  test("setBold(true) sets w:b", () => {
    const run = Run.fromText("bold");
    run.setBold();
    expect(run.isBold()).toBe(true);
  });

  test("setBold(false) removes w:b", () => {
    const run = Run.fromText("bold");
    run.setBold(true);
    run.setBold(false);
    expect(run.isBold()).toBe(false);
  });

  test("setItalic(true) sets w:i", () => {
    const run = Run.fromText("italic");
    run.setItalic();
    expect(run.isItalic()).toBe(true);
  });

  test("setUnderline() sets w:u", () => {
    const run = Run.fromText("underline");
    run.setUnderline();
    expect(run.hasUnderline()).toBe(true);
  });

  test("setShading() sets w:shd", () => {
    const run = Run.fromText("shaded");
    run.setShading("FFFF00");
    expect(run.getProperties()?.["w:shd"]?.$?.["w:fill"]).toBe("FFFF00");
  });

  test("setFontSize() sets w:sz and w:szCs", () => {
    const run = Run.fromText("sized");
    run.setFontSize(28);
    const props = run.getProperties() as any;
    expect(props?.["w:sz"]?.$?.["w:val"]).toBe("28");
    expect(props?.["w:szCs"]?.$?.["w:val"]).toBe("28");
  });

  test("setFontFamily() sets w:rFonts", () => {
    const run = Run.fromText("fonted");
    run.setFontFamily("Arial");
    expect(run.getProperties()?.["w:rFonts"]?.$?.["w:ascii"]).toBe("Arial");
  });

  test("setColor() sets w:color", () => {
    const run = Run.fromText("colored");
    run.setColor("FF0000");
    const props = run.getProperties() as any;
    expect(props?.["w:color"]?.$?.["w:val"]).toBe("FF0000");
  });

  test("setColor() strips leading #", () => {
    const run = Run.fromText("colored");
    run.setColor("#00FF00");
    const props = run.getProperties() as any;
    expect(props?.["w:color"]?.$?.["w:val"]).toBe("00FF00");
  });

  test("clearFormatting() empties w:rPr", () => {
    const run = Run.fromText("formatted");
    run.setBold();
    run.setItalic();
    run.clearFormatting();
    expect(run.isBold()).toBe(false);
    expect(run.isItalic()).toBe(false);
  });

  test("toObject() returns the underlying run object", () => {
    const run = Run.fromText("raw");
    const obj = run.toObject();
    expect(obj["w:t"]).toBeDefined();
  });

  test("isEmpty() returns true when no text or special fields", () => {
    const run = new Run({ "w:rPr": {}, "w:t": { _: "", $: {} } });
    expect(run.isEmpty()).toBe(true);
  });

  test("isEmpty() returns false when text exists", () => {
    const run = Run.fromText("not empty");
    expect(run.isEmpty()).toBe(false);
  });

  test("constructor throws for falsy input", () => {
    expect(() => new Run(null as any)).toThrow();
  });

  test("setRtl(true) marks the run right-to-left", () => {
    const run = Run.fromText("مرحبا");
    run.setRtl();
    expect(run.isRtl()).toBe(true);
    expect(run.getProperties()?.["w:rtl"]).toBeDefined();
  });

  test("setRtl(false) removes the rtl marker", () => {
    const run = Run.fromText("hi");
    run.setRtl(true);
    run.setRtl(false);
    expect(run.isRtl()).toBe(false);
  });

  test("isRtl() is false by default", () => {
    expect(Run.fromText("plain").isRtl()).toBe(false);
  });
});
