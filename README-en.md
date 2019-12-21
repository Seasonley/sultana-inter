# [-_@] sultana-i18n-tool

[中文](https://github.com/Seasonley/sultana-i18n-tool/blob/master/README.md) | English

🌎 An auto-i18n tool, based on [kiwi](https://github.com/alibaba/kiwi)+google_cn

## How to use?
1.Install
```bash
npm install sultana-i18n-tool
```
2. create `i18n.json` in your project path. it looks like:


```json
{
  "include": ["src/**/*.(ts*|js*)"],
  "exclude": ["**/i18n/**","**/test/*","**/*.test.*"],
  "importPath":"./src/i18n/language",
  "importFormat": {
    "ts":"import {i18n_lang_package,i18n_lang_format} from \"{{importPath}}\";",
    "js":"const {i18n_lang_package,i18n_lang_format} = reuqire(\"{{importPath}}\");",
    "html":"<script src=\"{{importPath}}/index.js\"></script>"
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
## Configuration

- **[include](#include) `string[]`**

  The included folder matches the `micromatch` syntax.

  Ex: `["src/**/*.(ts*|js*)"]`

- **[exclude](#exclude) `string[]`**

  The excluded folder matches the `·`micromatch` syntax.

  Ex: `["**/i18n/**","**/test/*"]`

- **[importPath](#importPath) `string`**

  Path or file name import in your code.

  Ex: `"./src/i18n/language"`

 - **importFormat**
   - **[ts](#ts)** `string`  importing template of `*.ts*`files，"{{importpath}}" is used as the template variable of configuration `importpath`.

      Ex:  `"import {i18n_lang_package,i18n_lang_format} from \"{{importPath}}\";"`

   - **[js](#js)** `string`  `*.js*`files

      Ex:  `"const {i18n_lang_package,i18n_lang_format} = reuqire(\"{{importPath}}\");"`

   - **[html](#html)** `string` `*.html`files

      Ex:  `"<script src=\"{{importPath}}/index.js\"></script>"`

- **translate**
  -  **[from](#from)** `string`  translation configuration,original language.All language formats are subject to [languages supported by Google translation] (https://cloud.google.com/translate/docs/languages). Ex: 'zh'.
  -  **[to](#to)** `string` The requirements are the same as above.Ex: `en`.

- **[templateFunction](#templateFunction) `string`**

  The function name used for formatting, such as `"I18N. Format"` will be compiled into `I18N. Format (I18N. Lang.xxx, {val1: XXX, val2: XXX})})`

- **[templateObj](#templateObj) `string`**

  The variable name of the language pack in use, such as configuration `"I18N. Lang"`, will be compiled into `I18N. Lang.xxx`

- **[exportPath](#exportPath) `string`**

  The output language directory uses`{{Lang}`and`{{filename}`as the language folder name and file name.

  Ex: `"./src/i18n/{{lang}}/{{filename}}.js"`

- **[ignoreComments](#ignoreComments) `string`**

  Ignore flag. When configuring '@ I18N ignore', translation will be ignored in the following situations:
  ```js
  // @i18n-ignore
  const title="我和我的祖国"
  ```
- **[excludeDirName](#excludeDirName) `string[]`**

  The tool uses the folder name as `{{filename}}` of the **exportpath**. Configure this to ignore the configured text when recursively looking for folders.

  Ex: `["components","models","services","src"]`

- **[defaultDirName](#defaultDirName) `string`**

  This configuration item is used instead of `{{filename}}` when there is no suitable folder name.

  Ex: `common`


## TODO
- [ ] ignoreComments
- [ ] importFomat html header