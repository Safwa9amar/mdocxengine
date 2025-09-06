"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const Logger_1 = __importDefault(require("./utils/Logger"));
Logger_1.default.error('Something went wrong');
function sayName(name) {
    return console.log("hi Mr.", name);
}
sayName("hamza");
module.exports = {
    logger: Logger_1.default,
    sayName
};
