# [-_@] sultana-i18n-tool

🌎 自动国际化项目代码，基于kiwi+google国内翻译
🌎 An auto-i18n tool, based on kiwi+google.cn

在项目跟目录创建配置文件,详细配置如下：
create `i18n.json` in your project path. it looks like:

```js
{
  "include": ["src/**/*.(ts*|js*)"],
  "exclude": ["**/i18n/**","**/test/*","**/*.test.*"],
  "importPath":"./src/i18n/language",
  "importFormat": {
    "ts":"import {i18n_lang_package,i18n_lang_format} from \"{{path}}\";",
    "js":"const {i18n_lang_package,i18n_lang_format} = reuqire(\"{{path}}\");",
    "html":"<script src=\"{{path}}/index.js\"></script>"
  },
  "translate":{
    "from":"zh",
    "to":"en"
  },
  "templateFunction":"i18n_lang_format",
  "templateObj":"i18n_lang_package",
  "exportPath": "./src/i18n/{{lang}}/{{filename}}.js",
  "ignoreStr": "@i18n-ignore",
  "excludeDirName":["components","pages","constants","containers","models","services","src"],
  "defaultDirName":"common"
}
```