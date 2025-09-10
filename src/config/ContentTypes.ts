// src/types/ContentTypes.ts
import { DefaultContentTypeEnum, OverrideContentTypeEnum } from "../config/enums";

// Interface for individual override
export interface ContentTypeOverride {
  PartName: string; // e.g., "/word/document.xml"
  ContentType: OverrideContentTypeEnum;
}

// Interface for individual default
export interface ContentTypeDefault {
  Extension: string; // e.g., "xml"
  ContentType: DefaultContentTypeEnum;
}

// Main content types container
export interface ContentTypes {
  Defaults: ContentTypeDefault[];
  Overrides: ContentTypeOverride[];
}

export const defaultContentTypes: ContentTypeDefault[] = [
  { Extension: "rels", ContentType: DefaultContentTypeEnum.RELS },
  { Extension: "xml", ContentType: DefaultContentTypeEnum.XML },
  { Extension: "png", ContentType: DefaultContentTypeEnum.PNG },
  { Extension: "jpeg", ContentType: DefaultContentTypeEnum.JPEG },
];
