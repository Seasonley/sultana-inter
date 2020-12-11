#!/usr/bin/env node
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
const fs = require("fs");
const path = require("path");
const micromatch = require("micromatch");
const findChineseText_1 = require("./findChineseText");
const replaceAndUpdate_1 = require("./replaceAndUpdate");
const writeFile_1 = require("./writeFile");
const translateMuti_1 = require("./translateMuti");
const getFinalText_1 = require("./getFinalText");
const commander = require("commander");
commander
    .version('1.1.1')
    .option('-p, --path [type]', 'Compile path')
    .parse(process.argv);
let program_path = process.cwd() + '/';
if (commander.path) {
    program_path = commander.path;
}
main(program_path);
function main(rootPath) {
    return __awaiter(this, void 0, void 0, function* () {
        //read conf
        const conf = require(path.join(rootPath, "i18n.json"));
        //make translate cache
        //- transSet
        const transSet = new Set();
        const cache = new Map();
        let acc = 0;
        for (let fPath of getFiles(rootPath, conf)) {
            const $src = fs.readFileSync(fPath, "utf8");
            const $res = findChineseText_1.default($src, fPath, conf).reverse();
            for (let item of $res) {
                transSet.add(getFinalText_1.default(item.text));
            }
        }
        // - muti trans
        if (transSet.size > 0) {
            let keys = Array.from(transSet);
            const total = keys.length;
            let tmpKeys;
            while (keys.length > 0) {
                tmpKeys = keys.splice(0, 100);
                let tmpTrans = yield translateMuti_1.default(tmpKeys, conf.translate);
                yield sleep(3000);
                for (let i in tmpKeys) {
                    cache.set(tmpKeys[i], tmpTrans.keys[i]);
                    cache.set('#_' + tmpTrans.keys[i], tmpTrans.vals[i]);
                }
                console.log(`translate ${acc += tmpKeys.length}/${total}`);
            }
        }
        else {
            return;
        }
        //read file
        for (let fPath of getFiles(rootPath, conf)) {
            const $src = fs.readFileSync(fPath, "utf8");
            //walking
            const $res = findChineseText_1.default($src, fPath, conf).reverse();
            if ($res.length === 0) {
                continue;
            }
            //replace&update
            for (let item of $res) {
                //i18nKey = cache || gg
                let i18nKey = cache.get(getFinalText_1.default(item.text));
                //replace
                const after = yield replaceAndUpdate_1.default(fPath, $src, item, conf.templateObj + '.' + i18nKey, conf);
                item.range = after.rangeAfter;
                item.var = after.final;
                item.text = after.finalText || item.text;
                item.i18nKey = i18nKey;
            }
            //write file
            yield writeFile_1.default(rootPath, fPath, $src, $res, conf, cache);
            // return;
        }
    });
}
exports.default = main;
function getFiles(rootPath, conf) {
    let arr = [];
    function findFile(p) {
        let files = fs.readdirSync(p);
        files.forEach(function (item) {
            let fPath = path.join(p, item);
            let stat = fs.statSync(fPath);
            if (stat.isDirectory()) {
                findFile(fPath);
            }
            else if (stat.isFile()) {
                //judge reg
                let b = fPath.replace(rootPath, "");
                micromatch.isMatch(b, conf.include) &&
                    !micromatch.isMatch(b, conf.exclude) &&
                    arr.push(fPath);
            }
        });
    }
    findFile(rootPath);
    return arr;
}
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=index.js.map