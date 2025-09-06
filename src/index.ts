import logger from "./utils/Logger";




function sayName(name : string) {
    return console.log("hi Mr.", name);
    
}

sayName("hamza")

export = {
    logger,
    sayName
}