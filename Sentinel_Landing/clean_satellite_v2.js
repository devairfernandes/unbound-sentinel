const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing';
const files = ['index.html', 'docs.html', 'download.html', 'lang.js'];

files.forEach(file => {
    const fPath = path.join(dir, file);
    if (!fs.existsSync(fPath)) return;
    
    let c = fs.readFileSync(fPath, 'utf8');

    // Remove from index.html SEO json
    c = c.replace(/"description": ".*?(Satélite|Satelite|satélite|satelite).*?",/i, '"description": "Appliance DNS Open-Source e DNS Firewall para Provedores ISP e Redes Corporativas",');
    c = c.replace(/<meta name="description" content=".*?(Satélite|Satelite|satélite|satelite).*?">/i, '<meta name="description" content="Sentinel DNS - Open Source DNS Firewall para Provedores ISP e Redes Corporativas">');
    c = c.replace(/<meta property="og:description" content=".*?(Satélite|Satelite|satélite|satelite).*?">/i, '<meta property="og:description" content="O Sentinel DNS é um appliance DNS Open Source e DNS Firewall desenhado para ISPs.">');

    // Remove specific features from translations
    c = c.replace(/"d\.t3_6": ".*?(Satélite|Satelite|satélite|satelite).*?",/gi, '"d.t3_6": "❌ Não",');
    c = c.replace(/"d\.t3_8": ".*?(Satélite|Satelite|satélite|satelite).*?",/gi, '"d.t3_8": "<span class=\\"badge\\">Sim (Ilimitado)</span>",');

    // Any stray satellite references
    c = c.replace(/Cluster Satélite Ilimitado/gi, '');
    c = c.replace(/Cluster Satélite/gi, '');

    fs.writeFileSync(fPath, c, 'utf8');
});

console.log("Satellite cleaned safely.");
