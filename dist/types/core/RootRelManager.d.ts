import { RelsType } from "config/enums";
import { RelManager } from "./RelManager";
import { ZipManager } from "./ZipManager";
export default class RootRelManager extends RelManager {
    constructor(zip: ZipManager, relsPath?: RelsType);
}
