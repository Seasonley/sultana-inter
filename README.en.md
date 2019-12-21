# [-_@] sultana-i18n-tool

🌎 An auto-i18n tool, based on kiwi+google.cn

create `i18n.json` in your project path. it looks like:

# Install
```bash
npm install sultana-i18n-tool
```

```json
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
  "ignoreComments": "@i18n-ignore",
  "excludeDirName":["components","pages","constants","containers","models","services","src"],
  "defaultDirName":"common"
}
```