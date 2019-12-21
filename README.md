# [-_@] sultana-i18n-tool

中文 | [English](https://github.com/Seasonley/sultana-i18n-tool/blob/master/README-en.md)

🌎 自动国际化项目代码，基于[kiwi](https://github.com/alibaba/kiwi)+google国内翻译

## 如何使用?
1. 安装
```bash
npm install sultana-i18n-tool
```
2. 在项目跟目录创建配置文件`i18n.json`,详细配置如下：

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
## 配置说明

- **include `string[]`**

  包含的文件夹匹配符，符合`micromatch`语法。

  例`["src/**/*.(ts*|js*)"]`

- **exclude `string[]`**

  排除的文件夹匹配符，符合`micromatch`语法。

  例`["**/i18n/**","**/test/*"]`

- **importPath `string`**

  在代码中引用的路径或文件

  例`"./src/i18n/language"`

 - **importFormat**
   - ** ts `string` ** `*.ts*`的文件引入模板，使用`{{importPath}}`作为配置项`importPath`的模板变量。
      例 `"import {i18n_lang_package,i18n_lang_format} from \"{{importPath}}\";"`
   - ** "js" `string`** `*.js*`文件的
      例 `"const {i18n_lang_package,i18n_lang_format} = reuqire(\"{{importPath}}\");"`
   - ** "html" `string`** `*.html`文件的
      例 `"<script src=\"{{importPath}}/index.js\"></script>"`

- **translate**
  -  ** "from" `string`** 翻译配置项，原语言。所有的语种格式都以[谷歌翻译支持的语种](https://cloud.google.com/translate/docs/languages)为准。例 `zh`。
  -  ** "to" `string`**翻译配置项，翻译目标语言。要求同上。例 `en`。

- **templateFunction `string`**

  用作格式化的函数名，如配置`"I18N.format" `将被编译成`I18N.format(I18N.lang.xxx,{val1:xxx,val2:xxx}})`

- **templateObj `string`**

  使用时的语言包的变量名，如配置`"I18N.lang" `将被编译成`I18N.lang.xxx`

- **exportPath `string`**

  输出的语言目录，使用`{{lang}}`和`{{filename}}`作为语言文件夹名和文件名。

  例`"./src/i18n/{{lang}}/{{filename}}.js"`

- **ignoreComments `string`**

  注释忽略标志，当配置`"@i18n-ignore"`时，遇到如下情况会忽略翻译：
  ```js
  // @i18n-ignore
  const title="我和我的祖国"
  ```
- **excludeDirName `string[]`**

  该工具使用文件夹名做exportPath的{{filename}}。配置该项可以在递归寻找文件夹时忽略配置的文本。

  例 `["components","models","services","src"]`

- **defaultDirName `string`**

  当没有合适的文件夹名做{{filename}}时，用该配置项代替。

  例`common`


## TODO
-  ignoreComments
-  importFomat html header