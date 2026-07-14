const fs = require('fs');

const indexHtmlPath = 'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/index.html';

if (fs.existsSync(indexHtmlPath)) {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    // Remove the broken empty keyframes
    html = html.replace(/@keyframes term-type \{\s*\}/g, '');

    // Let's also make sure the color of the text isn't black or something.
    // .terminal-body has color #cbd5e1 which is light gray.

    fs.writeFileSync(indexHtmlPath, html, 'utf8');
    console.log("Fixed CSS animation.");
}
