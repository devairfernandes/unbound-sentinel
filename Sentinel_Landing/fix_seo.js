const fs = require('fs');

const files = [
    'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/index.html',
    'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/docs.html',
    'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/download.html'
];

files.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    let html = fs.readFileSync(filePath, 'utf8');
    const basename = filePath.split('/').pop();

    // 1. Fix meta description (must be <= 155 chars)
    if (basename === 'index.html') {
        html = html.replace(
            /<meta name="description" content="[^"]*">/,
            '<meta name="description" content="Sentinel DNS — Appliance Open Source de DNS Firewall para ISPs e Redes Corporativas. Auto-tuning, CTI e proteção Zero-Day.">'
        );
        // That's 140 chars — safe!
    }

    // 2. Add robots meta tag right after <meta name="author">
    if (!html.includes('meta name="robots"')) {
        html = html.replace(
            '<meta name="author" content="Sentinel DNS">',
            '<meta name="author" content="Sentinel DNS">\n    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'
        );
    }

    // 3. If robots still not added (docs/download may not have author), add after viewport
    if (!html.includes('meta name="robots"')) {
        html = html.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'
        );
    }

    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`Fixed: ${basename}`);
});

console.log("SEO fixes applied!");
