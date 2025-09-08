import { DefaultContentTypeEnum } from "../config/enums";
import { ContentTypeDefault } from "../config/ContentTypes";

export const defaultContentTypes: ContentTypeDefault[] = [
  { Extension: "rels", ContentType: DefaultContentTypeEnum.RELS },
  { Extension: "xml", ContentType: DefaultContentTypeEnum.XML },
  { Extension: "png", ContentType: DefaultContentTypeEnum.PNG },
  { Extension: "jpeg", ContentType: DefaultContentTypeEnum.JPEG },
//   { Extension: "gif", ContentType: DefaultContentTypeEnum.GIF },
//   { Extension: "svg", ContentType: DefaultContentTypeEnum.SVG },
];
