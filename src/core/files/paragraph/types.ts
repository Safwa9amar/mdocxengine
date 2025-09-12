// A Union type to represent the content of a paragraph, which can be a Run or a Hyperlink.
export type ParagraphContent = Run | Hyperlink | Field | Drawing;

/**
 * Represents a text run in the document.
 * A run is a region of text with a common set of properties, such as formatting.
 * @example
 * <w:r>
 * <w:rPr>
 * <w:b/>
 * <w:i/>
 * </w:rPr>
 * <w:t>quick</w:t>
 * </w:r>
 */
export interface Run {
  $: { "w:rsidRPr": string };
  "w:rPr"?: RunProperties;
  // Use this if xml:space is required, otherwise simple string is fine
  "w:t": {
    $: { "xml:space"?: "preserve" };
    _: string;
  };
}
/**
 * Represents a drawing element.
 * A drawing object (e.g., a chart or picture) located in a run.
 * @example
 * <w:r>
 * <w:drawing>...</w:drawing>
 * </w:r>
 */
export interface Drawing {
  "w:drawing": {
    // Drawing elements have their own complex schema.
    $: Record<string, unknown>;
    // ... further drawing properties would go here
  };
}

/**
 * Represents a field, such as a page number or table of contents.
 * @example
 * <w:r>
 * <w:fldChar w:fldCharType="begin" />
 * </w:r>
 * <w:r>
 * <w:instrText xml:space="preserve">PAGEREF _Toc123456789 \h</w:instrText>
 * </w:r>
 * <w:r>
 * <w:fldChar w:fldCharType="end" />
 * </w:r>
 */
export interface Field {
  "w:fldChar": {
    $: {
      "w:fldCharType": "begin" | "end";
    };
  };
  "w:instrText"?: string;
}

/**
 * Interface for the properties of a text run.
 * These properties define the formatting for the run's content.
 */
interface RunProperties {
  "w:rStyle"?: {
    $: {
      "w:val": string;
    };
  };
  "w:rFonts"?: {
    $: {
      "w:ascii"?: string;
      "w:hAnsi"?: string;
      "w:eastAsia"?: string;
      "w:cs"?: string;
    };
  };
  "w:noProof"?: {}; // A self-closing tag, represented as an empty object.
  "w:lang"?: {
    $: {
      "w:val": string;
      "w:eastAsia"?: string;
    };
  };
  "w:b"?: {}; // Bold formatting
  "w:i"?: {}; // Italic formatting
  "w:u"?: {
    $: {
      "w:val": string;
    };
  }; // Underline formatting
}

/**
 * Interface for a hyperlink element that contains one or more runs.
 * It's a container for text that serves as a link to another part of the document or an external URL.
 * @example
 * <w:hyperlink w:anchor="_Toc106885920" w:history="1">
 * <w:r>
 * <w:t>Liste des organigrammes</w:t>
 * </w:r>
 * </w:hyperlink>
 */
export interface Hyperlink {
  $: {
    "w:anchor"?: string;
    "w:history"?: string;
    "r:id"?: string;
  };
  // A hyperlink can contain multiple runs, fields, etc.
  "w:r"?: Run[];
  "w:fldChar"?: Field[];
}

/**
 * Interface for the properties of a paragraph.
 * These properties apply to the entire paragraph, such as style, alignment, and spacing.
 */
interface ParagraphProperties {
  "w:pStyle"?: {
    $: {
      "w:val": string;
    };
  };
  "w:tabs"?: {
    // Specific properties for tab stops.
  };
  "w:spacing"?: {
    // Specific properties for line and paragraph spacing.
  };
  /**
   * Represents the default run properties for the paragraph mark.
   * Any run properties defined here are inherited by all runs in the paragraph,
   * unless overridden by a specific run's own properties.
   */
  "w:rPr"?: RunProperties;
}

/**
 * Interface for a paragraph element, which contains a collection of content elements.
 * A paragraph is a block-level element that can contain multiple runs, hyperlinks, and other elements.
 * @example
 * <w:p>
 * <w:pPr>
 * <w:pStyle w:val="Normal" />
 * </w:pPr>
 * <w:r>
 * <w:t>Hello</w:t>
 * </w:r>
 * <w:r>
 * <w:t xml:space="preserve"> World</w:t>
 * </w:r>
 * </w:p>
 */
export interface Paragraph {
  $: {
    "w14:paraId"?: string;
    "w14:textId"?: string;
    "w:rsidR"?: string;
    // Add other attributes as needed
    [key: string]: string | undefined;
  };
  "w:pPr"?: ParagraphProperties;
  // The content of a paragraph can be a mix of elements.
  // This is a simplified representation to avoid a complex type union.
  // A full implementation would need to handle the mixed nature more accurately.
  // A common approach is to use a single "children" array.
  "w:r"?: Run[];
  "w:hyperlink"?: Hyperlink[];
  "w:fldChar"?: Field[];
  "w:drawing"?: Drawing[];
}
