"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getFinalText(text) {
    let finalReplaceText = text;
    if (text.startsWith('`')) {
        const varInStr = text.match(/(\$\{[^\}]+?\})/g);
        if (varInStr) {
            varInStr.forEach((str, index) => {
                finalReplaceText = finalReplaceText.replace(str, `{val${index + 1}}`);
            });
        }
    }
    return finalReplaceText;
}
exports.default = getFinalText;
//# sourceMappingURL=getFinalText.js.map