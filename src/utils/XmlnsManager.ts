import { XML_NAMESPACES, XmlNamespacePrefix } from "@/constants";

/**
 * Manages the generation of XML namespace declaration strings.
 */
export class XmlnsManager {
  private readonly namespaces: Record<string, string>;

  /**
   * Constructs an XmlnsManager instance with a given set of namespaces.
   * @param namespaces A map of namespace prefixes to URIs.
   */
  constructor(namespaces: Record<string, string> = XML_NAMESPACES) {
    this.namespaces = namespaces;
  }

  /**
   * Generates the `xmlns` attribute string for a given list of prefixes.
   * @param prefixes The list of namespace prefixes to include in the string.
   * @returns A space-separated string of `xmlns:prefix="uri"` attributes.
   */
  public getXmlnsString(prefixes: XmlNamespacePrefix[]): string {
    return prefixes
      .map((prefix) => {
        const uri = this.namespaces[prefix];
        if (uri) {
          return `xmlns:${prefix}="${uri}"`;
        }
        return "";
      })
      .filter((str) => str !== "")
      .join(" ");
  }

  /**
   * Generates the `mc:Ignorable` attribute string for a given list of prefixes.
   * This is useful for backward and forward compatibility.
   * @param prefixes The list of prefixes to be marked as ignorable.
   * @returns A string like `mc:Ignorable="prefix1 prefix2 ..."`.
   */
  public getIgnorableString(prefixes: XmlNamespacePrefix[]): string {
    if (prefixes.length === 0) {
      return "";
    }
    return `mc:Ignorable="${prefixes.join(" ")}"`;
  }

  /**
   * Extracts all `xmlns` (XML namespace) attributes from the root element of an XML string.
   * * @param xmlString The XML content as a string.
   * @returns An object where keys are the namespace prefixes and values are their URIs.
   * Returns an empty object if no namespaces are found or on parsing error.
   */
  public getXmlnsFromXmlString(xmlString: string): Record<string, string> {
    const namespaces: Record<string, string> = {};

    // Regex to find the root element and capture all xmlns attributes.
    // This is a simple, non-robust way to find attributes and may fail on complex XML.
    const rootElementRegex = /<([a-zA-Z0-9]+:[a-zA-Z0-9]+)\s+([^>]+)>/;
    const match = xmlString.match(rootElementRegex);

    if (!match) {
      return namespaces;
    }

    // Extract the attributes string from the regex match
    const attributesString = match[2];

    // Regex to find all xmlns:prefix="uri" pairs
    const xmlnsRegex = /(xmlns:[a-zA-Z0-9]+|xmlns)="([^"]+)"/g;
    let attrMatch;

    while ((attrMatch = xmlnsRegex.exec(attributesString)) !== null) {
      const fullPrefix = attrMatch[1];
      const uri = attrMatch[2];

      // Check if the namespace has a prefix or is the default
      if (fullPrefix.includes(":")) {
        const prefix = fullPrefix.split(":")[1];
        namespaces[prefix] = uri;
      } else {
        // Handle the default namespace
        namespaces[""] = uri;
      }
    }

    return namespaces;
  }
}
