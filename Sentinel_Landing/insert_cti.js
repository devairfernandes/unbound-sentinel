const fs = require('fs');

const f = 'index.html';
if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    fs.writeFileSync(f, content, 'utf8');
}

const docsFile = 'docs.html';
if (fs.existsSync(docsFile)) {
    let content = fs.readFileSync(docsFile, 'utf8');

    // HTML Insert
    const htmlToInsert = `
        <h2><i data-lucide="shield-alert"></i> <span data-i18n="d.h_cti">Cyber Threat Intelligence (CTI) Automático</span></h2>
        <p data-i18n="d.cti_1" style="line-height: 1.8; color: #cbd5e1; margin-bottom: 3rem;">O Sentinel DNS integra-se nativamente com dezenas de feeds de Threat Intelligence. A sincronização (download de listas negras e brancas atualizadas) ocorre de forma automática e silenciosa em segundo plano a cada hora pelo motor NOC, garantindo proteção Zero-Day contra novos malwares, sem necessidade de intervenção do administrador.</p>
`;
    content = content.replace('<h2><i data-lucide="wrench"></i> <span data-i18n="d.h_maint">', htmlToInsert + '\n        <h2><i data-lucide="wrench"></i> <span data-i18n="d.h_maint">');

    // PT Insert
    content = content.replace(/"d.h_maint": "Manuten\u00E7ao e Acessos",/, '"d.h_cti": "Cyber Threat Intelligence (CTI) Automático",\n        "d.cti_1": "O Sentinel DNS integra-se nativamente com dezenas de feeds de Threat Intelligence. A sincronização (download de listas negras e brancas atualizadas) ocorre de forma automática e silenciosa em segundo plano a cada hora pelo motor NOC, garantindo proteção Zero-Day contra novos malwares, sem necessidade de intervenção do administrador.",\n        "d.h_maint": "Manutenção e Acessos",');

    // EN Insert
    content = content.replace(/"d.h_maint": "Maintenance & Access",/, '"d.h_cti": "Automatic Cyber Threat Intelligence (CTI)",\n        "d.cti_1": "Sentinel DNS natively integrates with dozens of Threat Intelligence feeds. Synchronization (download of updated blacklists and whitelists) occurs automatically and silently in the background every hour by the NOC engine, ensuring Zero-Day protection against new malware without the need for administrator intervention.",\n        "d.h_maint": "Maintenance & Access",');

    // ES Insert
    content = content.replace(/"d.h_maint": "Mantenimiento y Accesos",/, '"d.h_cti": "Cyber Threat Intelligence (CTI) Automático",\n        "d.cti_1": "Sentinel DNS se integra de forma nativa con docenas de feeds de Threat Intelligence. La sincronización (descarga de listas negras y blancas actualizadas) se produce de forma automática y silenciosa en segundo plano cada hora por el motor NOC, lo que garantiza protección Zero-Day contra nuevo malware sin necesidad de intervención del administrador.",\n        "d.h_maint": "Mantenimiento y Accesos",');

    fs.writeFileSync(docsFile, content, 'utf8');
}

console.log("Docs updated with CTI!");
