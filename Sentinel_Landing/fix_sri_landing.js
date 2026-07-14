const fs = require('fs');
const files = [
    'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/index.html',
    'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/docs.html',
    'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/download.html',
    'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/privacidade.html'
];

const SRI = 'sha384-ieG+IKD0d/ZPXyCBTMVAbqsQdns8QGJR/e26WMw7M4fkaI/rHcS/YIoi+ah9WGge';
const FIXED = `<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js" integrity="${SRI}" crossorigin="anonymous"></script>`;

files.forEach(f => {
    if (!fs.existsSync(f)) { console.log('Skip: ' + f); return; }
    let html = fs.readFileSync(f, 'utf8');

    html = html.replace(
        /<script src="https:\/\/unpkg\.com\/lucide@latest\/dist\/umd\/lucide\.min\.js"><\/script>/g,
        FIXED
    );
    html = html.replace(
        /<script src="https:\/\/unpkg\.com\/lucide@latest"><\/script>/g,
        FIXED
    );

    fs.writeFileSync(f, html, 'utf8');
    console.log('Fixed: ' + f.split('/').pop());
});
console.log('Landing Page SRI fix done!');
