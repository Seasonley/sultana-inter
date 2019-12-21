"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 更新文件
 * @param arg  目标字符串对象
 * @param val  目标 key
 * @param validateDuplicate 是否校验文件中已经存在要写入的 key
 */
function replaceAndUpdate(fPath, sourceCode, arg, val, conf) {
    const isHtmlFile = fPath.endsWith('.html');
    let finalReplaceText = arg.text;
    // 若是字符串，删掉两侧的引号
    if (arg.isString) {
        // 如果引号左侧是 等号，则可能是 jsx 的 props，此时要替换成 {
        let startColPostion = sourceCode.slice(arg.range[0] - 2, arg.range[0]).indexOf("\n") >= 0 ? arg.range[0] : arg.range[0] - 2;
        const [last2Char, last1Char] = sourceCode.slice(startColPostion, arg.range[0]).split('');
        let finalReplaceVal = val;
        if (last2Char === '=') {
            if (isHtmlFile) {
                finalReplaceVal = '{{' + val + '}}';
            }
            else {
                finalReplaceVal = '{' + val + '}';
            }
        }
        // 若是模板字符串，看看其中是否包含变量
        if (last1Char === '`') {
            const varInStr = arg.text.match(/(\$\{[^\}]+?\})/g);
            if (varInStr) {
                const kvPair = varInStr.map((str, index) => {
                    return `val${index + 1}: ${str.replace(/^\${([^\}]+)\}$/, '$1')}`;
                });
                finalReplaceVal = `${conf.templateFunction}(${val}, { ${kvPair.join(',\n')} })`;
                varInStr.forEach((str, index) => {
                    finalReplaceText = finalReplaceText.replace(str, `{val${index + 1}}`);
                });
            }
        }
        return Promise.resolve({ rangeAfter: [arg.range[0] - 1, arg.range[1] + 1], final: finalReplaceVal, finalText: finalReplaceText });
    }
    else {
        if (isHtmlFile) {
            return Promise.resolve({ rangeAfter: arg.range, final: '{{' + val + '}}' });
        }
        else {
            return Promise.resolve({ rangeAfter: arg.range, final: '{' + val + '}' });
        }
    }
}
exports.default = replaceAndUpdate;
//# sourceMappingURL=replaceAndUpdate.js.map