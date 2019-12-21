/**
 * @author linhuiw
 * @desc 工具方法
 */
import * as fs from 'fs';



/**
 * 获取文件 Json
 */
export default function getLangJson(fileName) {
  const fileContent = fs.readFileSync(fileName, { encoding: 'utf8' });
  let obj = fileContent.match(/export\s*default\s*({[\s\S]+);?$/)[1];
  obj = obj.replace(/\s*;\s*$/, '');
  let jsObj = {};
  try {
    jsObj = eval('(' + obj + ')');
  } catch (err) {
    console.log(obj);
    console.error(err);
  }
  return jsObj;
}
