import { DefaultContentTypeEnum, OverrideContentTypeEnum } from "../config/enums";
export interface ContentTypeOverride {
    PartName: string;
    ContentType: OverrideContentTypeEnum;
}
export interface ContentTypeDefault {
    Extension: string;
    ContentType: DefaultContentTypeEnum;
}
export interface ContentTypes {
    Defaults: ContentTypeDefault[];
    Overrides: ContentTypeOverride[];
}
