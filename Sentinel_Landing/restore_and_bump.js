const fs = require('fs');
const path = require('path');

const srcDir = 'C:/Users/Administrator/Desktop/Projetos/dashbord/TempLanding/Sentinel_Landing';
const dstDir = 'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing';

const files = ['index.html', 'docs.html', 'download.html', 'lang.js'];

files.forEach(file => {
    let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
    
    // 1. Version Bump
    content = content.replace(/v2\.6\.0/g, 'v2.9.31');
    content = content.replace(/2\.6\.0/g, '2.9.31');

    fs.writeFileSync(path.join(dstDir, file), content, 'utf8');
});

console.log("Restored clean files and bumped version.");
