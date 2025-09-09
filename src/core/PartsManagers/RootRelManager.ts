import { RelsType } from "@/config/enums";
import { RelManager } from "@/core/PartsManagers/RelManager";
import { ZipManager } from "@/utils/ZipManager";

export default class RootRelManager extends RelManager {
    constructor(zip: ZipManager, relsPath = RelsType.Root) {
      super(zip, relsPath);
    }
  }
  