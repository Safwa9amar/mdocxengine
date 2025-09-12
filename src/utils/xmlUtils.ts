import { parseStringPromise, Builder } from "xml2js";

export async function parseXml<T = any>(xml: string): Promise<T> {
  return parseStringPromise(xml, {
    explicitArray: false, // prefer objects to arrays where possible
    preserveChildrenOrder: true,
    attrkey: "$",
    charkey: "_",
    trim: true,
  }) as T;
}

export function buildXml(
  obj: any,
  options?: {
    rootName?: string;
    headless?: boolean;
    pretty?: boolean;
    indent?: string;
    newline?: string;
    standalone?: boolean;
  }
) {
  const builder = new Builder({
    // rootName: options?.rootName,
    headless: options?.headless ?? false,
    xmldec: { version: "1.0", encoding: "UTF-8", standalone: options?.standalone ?? true },
    renderOpts: {
      pretty: options?.pretty ?? true,
      indent: options?.indent ?? "  ",
      newline: options?.newline ?? "\n",
    },
  });
  return builder.buildObject(obj);
}
