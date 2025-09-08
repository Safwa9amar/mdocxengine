import { OverrideContentTypeEnum } from "../config/enums";
import { ContentTypeOverride } from "../config/ContentTypes";

export const BASE_OVERRIDES: ContentTypeOverride[] = [
  { PartName: "/word/document.xml", ContentType: OverrideContentTypeEnum.DOCUMENT },
  { PartName: "/word/styles.xml", ContentType: OverrideContentTypeEnum.STYLES },
  { PartName: "/word/settings.xml", ContentType: OverrideContentTypeEnum.SETTINGS },
  { PartName: "/word/webSettings.xml", ContentType: OverrideContentTypeEnum.WEB_SETTINGS },
  { PartName: "/word/numbering.xml", ContentType: OverrideContentTypeEnum.NUMBERING },
  { PartName: "/word/fontTable.xml", ContentType: OverrideContentTypeEnum.FONT_TABLE },
  { PartName: "/word/theme/theme1.xml", ContentType: OverrideContentTypeEnum.THEME },
  { PartName: "/docProps/core.xml", ContentType: OverrideContentTypeEnum.CORE_PROPS },
  { PartName: "/docProps/app.xml", ContentType: OverrideContentTypeEnum.APP_PROPS },
];
