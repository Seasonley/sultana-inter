"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const translation_js_1 = require("translation.js");
var i = 0;
function translateMuti(keys, { from = 'zh', to = 'en' }) {
    return __awaiter(this, void 0, void 0, function* () {
        var gg = yield translation_js_1.google.translate({
            text: keys.map(v => v.replace("\n", '\n')).join("\n"),
            from,
            to,
        });
        return { keys: gg.result.map(v => {
                let ans = v.replace(/\W+/g, '_');
                if (!ans) {
                    return 'symbol' + (i++);
                }
                if (ans.length > 40) {
                    return ans.slice(0, 40) + (i++);
                }
                return ans;
            }), vals: gg.result };
    });
}
exports.default = translateMuti;
//# sourceMappingURL=translateMuti.js.map