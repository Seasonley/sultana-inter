interface TargetStr {
  text: string;
  range: number[];
  var: string;
    isString: boolean;
  i18nKey: string;
}
import * as fs from "fs";
import * as path from "path";
import getLangJson from "./getLangJson";
export default function writeFile(
  rootPath: string,
  fPath: string,
  $src: string,
  $res: TargetStr[],
  conf: any,
  cache:any
) {
  //get pkgname from fpath
  const dirs = fPath.replace(rootPath, "").split("/");
  dirs.pop();
  let dir: string;
  while ((dir = dirs.pop())) {
    if (![...conf.excludeDirName].includes(dir)) {
      break;
    }
  }
  dir = dir || conf.defaultDirName;
    const pkgname = dir.replace(/\W+/g, "");
    const exportPath = path.join(
        rootPath,
        conf.exportPath.replace('{{filename}}', pkgname).replace('{{lang}}',conf.translate.from)
    );
    const exportTransPath = path.join(
        rootPath,
        conf.exportPath.replace('{{filename}}', pkgname).replace('{{lang}}',conf.translate.to)
    );
    //get importPath
    const importPath = path.relative(path.dirname(fPath), path.join(rootPath, conf.importPath));
    console.log(pkgname,"\t|\t",fPath.replace(rootPath,''),);
  //rewriteJSfile
  //- replace
  const fStr = $res.reduce(
    (acc, cur, idx) =>
      acc.slice(0, cur.range[0]) +
      cur.var +
      acc.slice(cur.range[1]),
    $src
  );
    
  //- add header
    let headerStr: string;
    let ext = 'html';
    if (fPath.endsWith('jsx') || fPath.endsWith('js')) {
        ext='js'
    } else if (fPath.endsWith('tsx')|| fPath.endsWith('ts')) {
        ext='ts'
    }
    headerStr = conf.importFormat[ext].replace("{{importPath}}", importPath);
    
// - write fStr
    if (ext !== 'html') {
        fs.writeFileSync(fPath, headerStr + "\n" + fStr.replace(headerStr, ''));
    }

  //read pkg
    let langExist: any = {};
    let langObj: any = {};
    $res.forEach(v => {
        langObj[v.i18nKey] = v.text;
    })
    //diff pkg data
    try {
        langExist = getLangJson(exportPath);
        langObj = Object.assign(langObj, langExist);
    } catch (error) {}
    checkDirExist(path.dirname(exportPath));
    //write pkg
    fs.writeFileSync(exportPath, "export default " + JSON.stringify(langObj, null, "\t"));
  
  //read pkg-trans
  langExist= {};
  langObj= {};
  $res.forEach(v => {
      langObj[v.i18nKey] = cache.get('#_'+v.i18nKey);
  })
  //diff pkg-trans data
  try {
      langExist = getLangJson(exportTransPath);
      langObj = Object.assign(langObj, langExist);
  } catch (error) {}
  checkDirExist(path.dirname(exportTransPath));
  //write pkg-trans
  fs.writeFileSync(exportTransPath, "export default " + JSON.stringify(langObj, null, "\t"));
  
}

function checkDirExist(folderpath){
    const pathArr=folderpath.split('/');
    let _path='';
    for(let i=0;i<pathArr.length;i++){
      if(pathArr[i]){
        _path +=`/${pathArr[i]}`;
        if (!fs.existsSync(_path)) {
          fs.mkdirSync(_path);
        }
      }
    }
}
