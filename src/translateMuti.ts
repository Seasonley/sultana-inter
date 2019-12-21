
import { google } from 'translation.js';
var i = 0;
export default async function translateMuti(keys:string[],{from='zh',to='en'}) {
    var gg = await google.translate({
            text: keys.map(v=>v.replace("\n",'\n')).join("\n"),
            from,
            to,
    });
    return {keys:gg.result.map(v => {
        let ans = v.replace(/\W+/g, '_');
        if (!ans) {
            return 'symbol' + (i++);
        }
        if (ans.length > 40) {
            return ans.slice(0,40)+(i++);
        }
        return ans;
    }),vals:gg.result};
}
