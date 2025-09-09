import { describe, expect, test } from "vitest";
import { Header } from ".";
import { Builder } from "xml2js";
// Define a generic XML component interface
interface XmlComponent<TagName extends string, Attr> {
  tagName: TagName;
  $: Attr;
  children: any[];
}

describe("Header Inddex Tests", () => {
  const header = new Header();

  test("should create a valid XML component", () => {
    const xml: XmlComponent<"w:p", { xmlns: string }> = {
      tagName: "w:p",
      $: { xmlns: "http://schemas.openxmlformats.org/wordprocessingml/2006/main" },
      children: [],
    };
    let builder = new Builder({
      rootName: "w:h",
      xmldec: {
        version: "1.0",
        encoding: "UTF-8",
        standalone: true,
      },
    });
    let newxml = builder.buildObject(xml);
    console.log(newxml);

    expect(xml.tagName).toBe("w:p");
    expect(xml.$.xmlns).toBe("http://schemas.openxmlformats.org/wordprocessingml/2006/main");
    expect(Array.isArray(xml.children)).toBe(true);
  });
});
