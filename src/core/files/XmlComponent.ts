import { Builder } from "xml2js";

class XmlComponent {
  RootName;
  attrs;

  constructor(RootName: string, attrs: { $: object }) {
    this.RootName = RootName;
    this.attrs = attrs;
  }
}
