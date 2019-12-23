// main
import * as fs from "fs";
import * as path from "path";
import * as micromatch from "micromatch";
import findChineseText from "./findChineseText";
import replaceAndUpdate from "./replaceAndUpdate";
import writeFile from './writeFile';
import translateMuti from './translateMuti';
import getFinalText from './getFinalText';

main(process.cwd());

export default async function main(rootPath) {
  //read conf
  const conf = require(path.join(rootPath, "i18n.json"));
  //make translate cache
  //- transSet
  const transSet = new Set();
  const cache = new Map();
  let acc = 0;
  for (let fPath of getFiles(rootPath, conf)) { 
    const $src = fs.readFileSync(fPath, "utf8");
    const $res = findChineseText($src, fPath, conf).reverse();
    for (let item of $res) {
      transSet.add(getFinalText(item.text));
    }
  }
// - muti trans
  if (transSet.size > 0) {
    let keys = Array.from(transSet) as string[];
    const total = keys.length;
    let tmpKeys:string[];
    while (keys.length>0) {
      tmpKeys = keys.splice(0, 100);
      let tmpTrans = await translateMuti(tmpKeys,conf.translate);
      await sleep(3000);
      for (let i in tmpKeys) {
        cache.set(tmpKeys[i], tmpTrans.keys[i]);
        cache.set('#_'+tmpTrans.keys[i], tmpTrans.vals[i]);
      }
      console.log(`translate ${acc+=tmpKeys.length}/${total}`)
    }
  } else {
    return;
  }
  //read file
  for (let fPath of getFiles(rootPath, conf)) {
    const $src = fs.readFileSync(fPath, "utf8");
    //walking
    const $res = findChineseText($src, fPath, conf).reverse();
    if($res.length===0){continue}
    //replace&update
    for (let item of $res) {
      //i18nKey = cache || gg
      let i18nKey = cache.get(getFinalText(item.text));

      //replace
      const after = await replaceAndUpdate(fPath, $src, item, conf.templateObj+'.'+i18nKey,conf);
      item.range = after.rangeAfter;
      item.var = after.final;
      item.text = after.finalText || item.text;
      item.i18nKey = i18nKey;
    }
    //write file
    await writeFile(rootPath, fPath, $src,$res, conf,cache);
    // return;
  }
}

function getFiles(rootPath, conf) {
  let arr = [];
  function findFile(p) {
    let files = fs.readdirSync(p);
    files.forEach(function(item) {
      let fPath = path.join(p, item);
      let stat = fs.statSync(fPath);
      if (stat.isDirectory()) {
        findFile(fPath);
      } else if (stat.isFile()) {
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
