"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function trimWhiteSpace(code, startPos, endPos) {
    const initStr = code.slice(startPos, endPos);
    const accStart = (initStr.match(/^\s+/) || [''])[0].length;
    const accEnd = (initStr.match(/\s+$/) || [''])[0].length;
    return {
        trimStart: startPos + accStart,
        trimEnd: endPos - accEnd
    };
}
exports.trimWhiteSpace = trimWhiteSpace;
//# sourceMappingURL=parserUtils.js.map