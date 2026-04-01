const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'public', 'settings');

function walkSync(currentDirPath, callback) {
    fs.readdirSync(currentDirPath).forEach(function (name) {
        var filePath = path.join(currentDirPath, name);
        var stat = fs.statSync(filePath);
        if (stat.isFile()) {
            callback(filePath, stat);
        } else if (stat.isDirectory()) {
            walkSync(filePath, callback);
        }
    });
}

let count = 0;
walkSync(directoryPath, function(filePath, stat) {
    if (filePath.endsWith('.mdx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('ローガン')) {
            let newContent = content.replace(/ローガン/g, 'ヴィラン');
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log(`Replaced in ${path.basename(filePath)}`);
            count++;
        }
    }
});
console.log(`Total files updated: ${count}`);
