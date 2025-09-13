import { XML_NAMESPACES, XmlNamespacePrefix } from "@/constants";
import logger from "@/utils/Logger";
import { XmlnsManager } from "@/utils/XmlnsManager";
import { describe, test, expect } from "vitest";

describe("XmlnsManager", () => {
  test("should create a valid xmlns string for document parts", () => {
    // Create an instance of the manager with all your known namespaces.
    const manager = new XmlnsManager();

    // Test Case 1: Core document.xml namespaces
    const documentPrefixes: XmlNamespacePrefix[] = ["w", "r", "wp", "w14", "w15", "w16"];
    const documentXmlns = manager.getXmlnsString(documentPrefixes);
    const documentIgnorable = manager.getIgnorableString(["w14", "w15", "w16"]);

    const expectedDocumentXmlns =
      'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml"';
    const expectedDocumentIgnorable = 'mc:Ignorable="w14 w15 w16"';

    expect(documentXmlns).toBe(expectedDocumentXmlns);
    expect(documentIgnorable).toBe(expectedDocumentIgnorable);

    // Test Case 2: Header part with drawing-related namespaces
    const headerPrefixes: XmlNamespacePrefix[] = ["w", "r", "wp", "wp14", "cx", "cx1", "w16"];
    const headerXmlns = manager.getXmlnsString(headerPrefixes);
    const headerIgnorable = manager.getIgnorableString(["wp14", "cx", "cx1", "w16"]);

    const expectedHeaderXmlns =
      'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml"';
    const expectedHeaderIgnorable = 'mc:Ignorable="wp14 cx cx1 w16"';

    expect(headerXmlns).toBe(expectedHeaderXmlns);
    expect(headerIgnorable).toBe(expectedHeaderIgnorable);

    // --- Example Usage ---
    const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:hdr xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" 
      xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" 
      xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
      mc:Ignorable="w14 w15">
      <w:p>
        <w:r>
          <w:t>Hello World</w:t>
        </w:r>
      </w:p>
    </w:hdr>`;

    const extractedNamespaces = { $: manager.getXmlnsFromXmlString(sampleXml) };
    console.log("Extracted Namespaces:");
    console.log(extractedNamespaces);
  });
});
