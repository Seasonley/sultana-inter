export default function getFinalText(text:string){
    let finalReplaceText = text;
      if ((text as string).startsWith('`')) {
        const varInStr = text.match(/(\$\{[^\}]+?\})/g);
        if (varInStr) {
          varInStr.forEach((str, index) => {
            finalReplaceText = finalReplaceText.replace(str, `{val${index + 1}}`);
          });
        }
      }
    return finalReplaceText;
}