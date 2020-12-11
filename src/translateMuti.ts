
import * as inquirer from 'inquirer';
var i = 0;
export default async function translateMuti(keys: string[], { from = 'zh', to = 'en' }) {
    const answers = await inquirer.prompt([{
        type: 'editor',
        name: 'content',
        message: "---translate content---\n"+keys.join("\n")+"\n---(one line per index)---"
    }]);
    
    return {
        keys: answers.content.split("\n").map(v => {
            let ans = v.replace(/\W+/g, '_');
            if (!ans) {
                return 'symbol' + (i++);
            }
            if (ans.length > 40) {
                return ans.slice(0, 40) + (i++);
            }
            return ans;
        }), vals: answers.content.split("\n")
    };
}
