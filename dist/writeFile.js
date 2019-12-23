"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const getLangJson_1 = require("./getLangJson");
function writeFile(rootPath, fPath, $src, $res, conf, cache) {
    //get pkgname from fpath
    const dirs = fPath.replace(rootPath, "").split("/");
    dirs.pop();
    let dir;
    while ((dir = dirs.pop())) {
        if (![...conf.excludeDirName].includes(dir)) {
            break;
        }
    }
    dir = dir || conf.defaultDirName;
    const pkgname = dir.replace(/\W+/g, "");
    const exportPath = path.join(rootPath, conf.exportPath.replace('{{filename}}', pkgname).replace('{{lang}}', conf.translate.from));
    const exportTransPath = path.join(rootPath, conf.exportPath.replace('{{filename}}', pkgname).replace('{{lang}}', conf.translate.to));
    //get importPath
    const importPath = path.relative(path.dirname(fPath), path.join(rootPath, conf.importPath));
    console.log(pkgname, "\t|\t", fPath.replace(rootPath, ''));
    //rewriteJSfile
    //- replace
    const fStr = $res.reduce((acc, cur, idx) => acc.slice(0, cur.range[0]) +
        cur.var.split(".").splice(1, 0, pkgname).join(".") +
        acc.slice(cur.range[1]), $src);
    //- add header
    let headerStr;
    let ext = 'html';
    if (fPath.endsWith('jsx') || fPath.endsWith('js')) {
        ext = 'js';
    }
    else if (fPath.endsWith('tsx') || fPath.endsWith('ts')) {
        ext = 'ts';
    }
    headerStr = conf.importFormat[ext].replace("{{importPath}}", importPath);
    // - write fStr
    if (ext !== 'html') {
        fs.writeFileSync(fPath, headerStr + "\n" + fStr.replace(headerStr, ''));
    }
    //read pkg
    let langExist = {};
    let langObj = {};
    $res.forEach(v => {
        langObj[v.i18nKey] = v.text;
    });
    //diff pkg data
    try {
        langExist = getLangJson_1.default(exportPath);
        langObj = Object.assign(langObj, langExist);
    }
    catch (error) { }
    checkDirExist(path.dirname(exportPath));
    //write pkg
    fs.writeFileSync(exportPath, "export default " + JSON.stringify(langObj, null, "\t"));
    //read pkg-trans
    langExist = {};
    langObj = {};
    $res.forEach(v => {
        langObj[v.i18nKey] = cache.get('#_' + v.i18nKey);
    });
    //diff pkg-trans data
    try {
        langExist = getLangJson_1.default(exportTransPath);
        langObj = Object.assign(langObj, langExist);
    }
    catch (error) { }
    checkDirExist(path.dirname(exportTransPath));
    //write pkg-trans
    fs.writeFileSync(exportTransPath, "export default " + JSON.stringify(langObj, null, "\t"));
}
exports.default = writeFile;
function checkDirExist(folderpath) {
    const pathArr = folderpath.split('/');
    let _path = '';
    for (let i = 0; i < pathArr.length; i++) {
        if (pathArr[i]) {
            _path += `/${pathArr[i]}`;
            if (!fs.existsSync(_path)) {
                fs.mkdirSync(_path);
            }
        }
    }
}
//# sourceMappingURL=writeFile.js.map