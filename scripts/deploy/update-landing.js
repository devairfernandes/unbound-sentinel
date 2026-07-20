const fs = require('fs');
const path = require('path');

const landingDir = 'c:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing';

const langJsContent = `const translations = {
    "pt": {
        "nav.home": "<i data-lucide=\\"arrow-left\\" width=\\"16\\" height=\\"16\\"></i> Voltar para o Início",
        "nav.master": "<i data-lucide=\\"lock\\" width=\\"14\\" height=\\"14\\"></i> Painel Master",
        "index.title": "Sentinel <span>DNS</span> Segurança",
        "index.desc": "Central de Distribuição e Controle. A inteligência cibernética, validação de licenças corporativas e os pacotes de atualização (OTA) operam em fluxo constante para todos os servidores da rede.",
        "index.badge_master": "<div class=\\"dot\\"></div> Nó Mestre Online",
        "status.license": "Servidor de Licenças",
        "status.active": "<i data-lucide=\\"check-circle-2\\" width=\\"14\\" height=\\"14\\"></i> Ativo",
        "status.cti": "Inteligência (CTI)",
        "status.sync": "<i data-lucide=\\"check-circle-2\\" width=\\"14\\" height=\\"14\\"></i> Sincronizado",
        "status.ota": "Atualizações OTA",
        "status.op": "<i data-lucide=\\"check-circle-2\\" width=\\"14\\" height=\\"14\\"></i> Operante",
        "feat.title": "Capacidades do Ecossistema",
        "feat.1_title": "Filtro Anti-Malware",
        "feat.1_desc": "Bloqueio em tempo real na camada DNS contra ameaças, phishing e botnets antes que cheguem aos usuários.",
        "feat.2_title": "Baixíssima Latência",
        "feat.2_desc": "Nós locais descentralizados processam requisições em milissegundos utilizando o motor Unbound otimizado.",
        "feat.3_title": "Blacklists Dinâmicas",
        "feat.3_desc": "Sincronização automática de listas de inteligência de ameaças com o Nó Mestre a cada poucos minutos.",
        "feat.4_title": "Gestão Centralizada",
        "feat.4_desc": "Controle de todos os nós de provedores e clientes corporativos a partir deste painel de comando central.",
        "link.download": "<i data-lucide=\\"download-cloud\\" width=\\"18\\" height=\\"18\\"></i> Baixar ISO do Sentinel",
        "link.docs": "<i data-lucide=\\"book-open\\" width=\\"18\\" height=\\"18\\"></i> Ver Documentação Completa",
        "link.contact": "<i data-lucide=\\"message-circle\\" width=\\"18\\" height=\\"18\\"></i> Contato via WhatsApp",
        "news.badge": "NOVIDADE",
        "news.text": "Appliance 100% Offline (Rocky Linux 9.7) v2.6.0 Lançado!",
        "dl.title": "Instalação <span>Sentinel DNS</span>",
        "dl.desc": "Faça o download da imagem ISO oficial para instalar o nó Edge do Sentinel na sua infraestrutura corporativa.",
        "dl.btn": "<i data-lucide=\\"download\\"></i> Baixar Imagem ISO (v2.6.0)",
        "req.title": "Requisitos Mínimos da Máquina",
        "req.cpu_title": "Processador (CPU)",
        "req.cpu_desc": "2 vCores / Threads ou superior. Arquitetura x86_64.",
        "req.ram_title": "Memória RAM",
        "req.ram_desc": "4 GB Mínimo. Recomendado 8 GB para redes com mais de 5.000 clientes.",
        "req.disk_title": "Armazenamento (Disco)",
        "req.disk_desc": "40 GB SSD. Necessário para cache em alta velocidade e banco de dados local.",
        "req.net_title": "Rede / Conectividade",
        "req.net_desc": "Placa de rede Gigabit. Porta 53 (UDP/TCP) e porta 443 (TCP) liberadas.",
        "doc.title": "Documentação Oficial",
        "doc.desc": "Guias, tutoriais e manuais de implementação do ecossistema Sentinel."
    },
    "en": {
        "nav.home": "<i data-lucide=\\"arrow-left\\" width=\\"16\\" height=\\"16\\"></i> Back to Home",
        "nav.master": "<i data-lucide=\\"lock\\" width=\\"14\\" height=\\"14\\"></i> Master Panel",
        "index.title": "Sentinel <span>DNS</span> Security",
        "index.desc": "Distribution and Control Center. Cyber intelligence, corporate license validation, and update packages (OTA) operate in a constant flow to all network servers.",
        "index.badge_master": "<div class=\\"dot\\"></div> Master Node Online",
        "status.license": "License Server",
        "status.active": "<i data-lucide=\\"check-circle-2\\" width=\\"14\\" height=\\"14\\"></i> Active",
        "status.cti": "Intelligence (CTI)",
        "status.sync": "<i data-lucide=\\"check-circle-2\\" width=\\"14\\" height=\\"14\\"></i> Synchronized",
        "status.ota": "OTA Updates",
        "status.op": "<i data-lucide=\\"check-circle-2\\" width=\\"14\\" height=\\"14\\"></i> Operational",
        "feat.title": "Ecosystem Capabilities",
        "feat.1_title": "Anti-Malware Filter",
        "feat.1_desc": "Real-time DNS layer blocking against threats, phishing, and botnets before they reach users.",
        "feat.2_title": "Ultra-Low Latency",
        "feat.2_desc": "Decentralized local nodes process requests in milliseconds using the optimized Unbound engine.",
        "feat.3_title": "Dynamic Blacklists",
        "feat.3_desc": "Automatic synchronization of threat intelligence lists with the Master Node every few minutes.",
        "feat.4_title": "Centralized Management",
        "feat.4_desc": "Control all ISP nodes and corporate clients from this central command panel.",
        "link.download": "<i data-lucide=\\"download-cloud\\" width=\\"18\\" height=\\"18\\"></i> Download Sentinel ISO",
        "link.docs": "<i data-lucide=\\"book-open\\" width=\\"18\\" height=\\"18\\"></i> View Full Documentation",
        "link.contact": "<i data-lucide=\\"message-circle\\" width=\\"18\\" height=\\"18\\"></i> Contact via WhatsApp",
        "news.badge": "NEW",
        "news.text": "100% Offline Appliance (Rocky Linux 9.7) v2.6.0 Released!",
        "dl.title": "Sentinel DNS <span>Installation</span>",
        "dl.desc": "Download the official ISO image to install the Sentinel Edge node in your corporate infrastructure.",
        "dl.btn": "<i data-lucide=\\"download\\"></i> Download ISO Image (v2.6.0)",
        "req.title": "Minimum Machine Requirements",
        "req.cpu_title": "Processor (CPU)",
        "req.cpu_desc": "2 vCores / Threads or higher. x86_64 Architecture.",
        "req.ram_title": "RAM Memory",
        "req.ram_desc": "4 GB Minimum. 8 GB recommended for networks with over 5,000 clients.",
        "req.disk_title": "Storage (Disk)",
        "req.disk_desc": "40 GB SSD. Required for high-speed caching and local database.",
        "req.net_title": "Network / Connectivity",
        "req.net_desc": "Gigabit network card. Port 53 (UDP/TCP) and port 443 (TCP) opened.",
        "doc.title": "Official Documentation",
        "doc.desc": "Guides, tutorials, and implementation manuals for the Sentinel ecosystem."
    },
    "es": {
        "nav.home": "<i data-lucide=\\"arrow-left\\" width=\\"16\\" height=\\"16\\"></i> Volver al Inicio",
        "nav.master": "<i data-lucide=\\"lock\\" width=\\"14\\" height=\\"14\\"></i> Panel Master",
        "index.title": "Sentinel <span>DNS</span> Seguridad",
        "index.desc": "Centro de Distribución y Control. La inteligencia cibernética, validación de licencias corporativas y los paquetes de actualización (OTA) operan en flujo constante para todos los servidores de la red.",
        "index.badge_master": "<div class=\\"dot\\"></div> Nodo Maestro Online",
        "status.license": "Servidor de Licencias",
        "status.active": "<i data-lucide=\\"check-circle-2\\" width=\\"14\\" height=\\"14\\"></i> Activo",
        "status.cti": "Inteligencia (CTI)",
        "status.sync": "<i data-lucide=\\"check-circle-2\\" width=\\"14\\" height=\\"14\\"></i> Sincronizado",
        "status.ota": "Actualizaciones OTA",
        "status.op": "<i data-lucide=\\"check-circle-2\\" width=\\"14\\" height=\\"14\\"></i> Operativo",
        "feat.title": "Capacidades del Ecosistema",
        "feat.1_title": "Filtro Anti-Malware",
        "feat.1_desc": "Bloqueo en tiempo real en la capa DNS contra amenazas, phishing y botnets antes de que lleguen a los usuarios.",
        "feat.2_title": "Bajísima Latencia",
        "feat.2_desc": "Nodos locales descentralizados procesan peticiones en milisegundos usando el motor Unbound optimizado.",
        "feat.3_title": "Listas Negras Dinámicas",
        "feat.3_desc": "Sincronización automática de listas de inteligencia de amenazas con el Nodo Maestro cada pocos minutos.",
        "feat.4_title": "Gestión Centralizada",
        "feat.4_desc": "Control de todos los nodos de proveedores y clientes corporativos desde este panel de mando central.",
        "link.download": "<i data-lucide=\\"download-cloud\\" width=\\"18\\" height=\\"18\\"></i> Descargar ISO de Sentinel",
        "link.docs": "<i data-lucide=\\"book-open\\" width=\\"18\\" height=\\"18\\"></i> Ver Documentación Completa",
        "link.contact": "<i data-lucide=\\"message-circle\\" width=\\"18\\" height=\\"18\\"></i> Contacto vía WhatsApp",
        "news.badge": "NUEVO",
        "news.text": "¡Appliance 100% Offline (Rocky Linux 9.7) v2.6.0 Lanzado!",
        "dl.title": "Instalación <span>Sentinel DNS</span>",
        "dl.desc": "Descarga la imagen ISO oficial para instalar el nodo Edge de Sentinel en tu infraestructura corporativa.",
        "dl.btn": "<i data-lucide=\\"download\\"></i> Descargar Imagen ISO (v2.6.0)",
        "req.title": "Requisitos Mínimos de la Máquina",
        "req.cpu_title": "Procesador (CPU)",
        "req.cpu_desc": "2 vCores / Hilos o superior. Arquitectura x86_64.",
        "req.ram_title": "Memoria RAM",
        "req.ram_desc": "4 GB Mínimo. Recomendado 8 GB para redes con más de 5.000 clientes.",
        "req.disk_title": "Almacenamiento (Disco)",
        "req.disk_desc": "40 GB SSD. Necesario para caché de alta velocidad y base de datos local.",
        "req.net_title": "Red / Conectividad",
        "req.net_desc": "Tarjeta de red Gigabit. Puerto 53 (UDP/TCP) y puerto 443 (TCP) abiertos.",
        "doc.title": "Documentación Oficial",
        "doc.desc": "Guías, tutoriales y manuales de implementación del ecosistema Sentinel."
    }
};

function setLanguage(lang) {
    localStorage.setItem('landing_lang', lang);
    applyTranslations(lang);
}

function applyTranslations(lang) {
    const t = translations[lang] || translations['pt'];
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (t[key]) {
            el.innerHTML = t[key];
        }
    });
    
    const select = document.getElementById('lang-selector');
    if (select) select.value = lang;
    
    // Re-render lucide icons inside translated strings
    if (window.lucide && window.lucide.createIcons) {
        window.lucide.createIcons();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedLang = localStorage.getItem('landing_lang') || 'pt';
    applyTranslations(savedLang);
    const selector = document.getElementById('lang-selector');
    if (selector) {
        selector.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }
});
`;

fs.writeFileSync(path.join(landingDir, 'lang.js'), langJsContent, 'utf8');

const langSelectorHtml = `
    <div style="position: fixed; top: 1.5rem; right: 1.5rem; z-index: 1000; display: flex; gap: 10px; align-items: center;">
        <a data-i18n="nav.master" class="lang-master-btn" href="/master" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: rgba(56, 189, 248, 0.1); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; text-decoration: none; font-family: 'Inter', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: all 0.3s ease; backdrop-filter: blur(10px);">
            <i data-lucide="lock" style="width: 14px; height: 14px;"></i>
            Painel Master
        </a>
        <select id="lang-selector" style="padding: 6px 10px; background: rgba(15, 23, 42, 0.8); color: #f8fafc; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; outline: none; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 0.9rem; backdrop-filter: blur(10px);">
            <option value="pt" style="background: #0f172a;">Português (BR)</option>
            <option value="en" style="background: #0f172a;">English (US)</option>
            <option value="es" style="background: #0f172a;">Español</option>
        </select>
    </div>
`;

function processFile(filename, replacements, insertNews = false) {
    const filepath = path.join(landingDir, filename);
    if (!fs.existsSync(filepath)) return;
    
    let content = fs.readFileSync(filepath, 'utf8');
    
    if (!content.includes('<script src="lang.js"></script>')) {
        content = content.replace('</body>', '    <script src="lang.js"></script>\n</body>');
    }
    
    if (!content.includes('id="lang-selector"')) {
        content = content.replace('<body>', '<body>\n' + langSelectorHtml);
    }
    
    for (const r of replacements) {
        if (content.indexOf(r.target) === -1) {
            console.log("NOT FOUND IN " + filename + ": " + r.target);
        } else {
            content = content.replace(r.target, r.replacement);
        }
    }
    
    if (insertNews && !content.includes('news.badge')) {
        const newsHtml = `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 1rem; border-radius: 12px; margin-bottom: 2rem; display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap;">
            <span style="background: #10b981; color: #fff; padding: 0.25rem 0.75rem; border-radius: 999px; font-weight: 800; font-size: 0.8rem; letter-spacing: 1px;" data-i18n="news.badge">NOVIDADE</span>
            <span style="color: #f8fafc; font-weight: 600; font-size: 1.05rem;" data-i18n="news.text">Appliance 100% Offline (Rocky Linux 9.7) v2.6.0 Lançado!</span>
        </div>
        `;
        content = content.replace('<h1>Sentinel <span>DNS</span> Segurança</h1>', '<h1>Sentinel <span>DNS</span> Segurança</h1>\n' + newsHtml);
    }
    
    fs.writeFileSync(filepath, content, 'utf8');
    console.log("Updated " + filename);
}

// 1. Index
processFile('index.html', [
    { target: '<div class="badge"><div class="dot"></div> Nó Mestre Online</div>', replacement: '<div class="badge" data-i18n="index.badge_master"><div class="dot"></div> Nó Mestre Online</div>' },
    { target: '<h1>Sentinel <span>DNS</span> Segurança</h1>', replacement: '<h1 data-i18n="index.title">Sentinel <span>DNS</span> Segurança</h1>' },
    { target: '<p>Central de Distribuição e Controle. A inteligência cibernética, validação de licenças corporativas e os pacotes de atualização (OTA) operam em fluxo constante para todos os servidores da rede.</p>', replacement: '<p data-i18n="index.desc">Central de Distribuição e Controle. A inteligência cibernética, validação de licenças corporativas e os pacotes de atualização (OTA) operam em fluxo constante para todos os servidores da rede.</p>' },
    { target: '<span class="status-label">Servidor de Licenças</span>', replacement: '<span class="status-label" data-i18n="status.license">Servidor de Licenças</span>' },
    { target: '<span class="status-value"><i data-lucide="check-circle-2" width="14" height="14"></i> Ativo</span>', replacement: '<span class="status-value" data-i18n="status.active"><i data-lucide="check-circle-2" width="14" height="14"></i> Ativo</span>' },
    { target: '<span class="status-label">Inteligência (CTI)</span>', replacement: '<span class="status-label" data-i18n="status.cti">Inteligência (CTI)</span>' },
    { target: '<span class="status-value"><i data-lucide="check-circle-2" width="14" height="14"></i> Sincronizado</span>', replacement: '<span class="status-value" data-i18n="status.sync"><i data-lucide="check-circle-2" width="14" height="14"></i> Sincronizado</span>' },
    { target: '<span class="status-label">Atualizações OTA</span>', replacement: '<span class="status-label" data-i18n="status.ota">Atualizações OTA</span>' },
    { target: '<span class="status-value"><i data-lucide="check-circle-2" width="14" height="14"></i> Operante</span>', replacement: '<span class="status-value" data-i18n="status.op"><i data-lucide="check-circle-2" width="14" height="14"></i> Operante</span>' },
    { target: '<span class="features-title">Capacidades do Ecossistema</span>', replacement: '<span class="features-title" data-i18n="feat.title">Capacidades do Ecossistema</span>' },
    { target: '<h3>Filtro Anti-Malware</h3>', replacement: '<h3 data-i18n="feat.1_title">Filtro Anti-Malware</h3>' },
    { target: '<p>Bloqueio em tempo real na camada DNS contra ameaças, phishing e botnets antes que cheguem aos usuários.</p>', replacement: '<p data-i18n="feat.1_desc">Bloqueio em tempo real na camada DNS contra ameaças, phishing e botnets antes que cheguem aos usuários.</p>' },
    { target: '<h3>Baixíssima Latência</h3>', replacement: '<h3 data-i18n="feat.2_title">Baixíssima Latência</h3>' },
    { target: '<p>Nós locais descentralizados processam requisições em milissegundos utilizando o motor Unbound otimizado.</p>', replacement: '<p data-i18n="feat.2_desc">Nós locais descentralizados processam requisições em milissegundos utilizando o motor Unbound otimizado.</p>' },
    { target: '<h3>Blacklists Dinâmicas</h3>', replacement: '<h3 data-i18n="feat.3_title">Blacklists Dinâmicas</h3>' },
    { target: '<p>Sincronização automática de listas de inteligência de ameaças com o Nó Mestre a cada poucos minutos.</p>', replacement: '<p data-i18n="feat.3_desc">Sincronização automática de listas de inteligência de ameaças com o Nó Mestre a cada poucos minutos.</p>' },
    { target: '<h3>Gestão Centralizada</h3>', replacement: '<h3 data-i18n="feat.4_title">Gestão Centralizada</h3>' },
    { target: '<p>Controle de todos os nós de provedores e clientes corporativos a partir deste painel de comando central.</p>', replacement: '<p data-i18n="feat.4_desc">Controle de todos os nós de provedores e clientes corporativos a partir deste painel de comando central.</p>' },
    { target: 'Baixar ISO do Sentinel\n            </a>', replacement: 'Baixar ISO do Sentinel\n            </a>'.replace('Baixar ISO do Sentinel', '</span>').replace('a href', 'a data-i18n="link.download" href') },
    { target: '<i data-lucide="download-cloud" width="18" height="18"></i>\n                Baixar ISO do Sentinel', replacement: '<i data-lucide="download-cloud" width="18" height="18"></i> Baixar ISO do Sentinel' },
    { target: '<i data-lucide="book-open" width="18" height="18"></i>\n                Ver Documentação Completa', replacement: '<i data-lucide="book-open" width="18" height="18"></i> Ver Documentação Completa' },
    { target: '<i data-lucide="message-circle" width="18" height="18"></i>\n                Contato via WhatsApp', replacement: '<i data-lucide="message-circle" width="18" height="18"></i> Contato via WhatsApp' },
    { target: '<a href="download.html" style="', replacement: '<a data-i18n="link.download" href="download.html" style="' },
    { target: '<a href="docs.html" style="', replacement: '<a data-i18n="link.docs" href="docs.html" style="' },
    { target: '<a href="https://wa.me/5569992214709" target="_blank" style="', replacement: '<a data-i18n="link.contact" href="https://wa.me/5569992214709" target="_blank" style="' }
], true);

// 2. Download
processFile('download.html', [
    { target: '<h1>Instalação <span>Sentinel DNS</span></h1>', replacement: '<h1 data-i18n="dl.title">Instalação <span>Sentinel DNS</span></h1>' },
    { target: '<p>Faça o download da imagem ISO oficial para instalar o nó Edge do Sentinel na sua infraestrutura corporativa.</p>', replacement: '<p data-i18n="dl.desc">Faça o download da imagem ISO oficial para instalar o nó Edge do Sentinel na sua infraestrutura corporativa.</p>' },
    { target: '<i data-lucide="download"></i>\n            Baixar Imagem ISO (v2.5.26)', replacement: '<i data-lucide="download"></i> Baixar Imagem ISO (v2.6.0)' },
    { target: 'Baixar Imagem ISO (v2.5.26)', replacement: 'Baixar Imagem ISO (v2.6.0)' },
    { target: '<a href="https://drive.google.com/file/d/1R_7dqcFS1kef_SWxAF3nLnnRm21Sjo3i/view?usp=sharing" target="_blank" class="download-btn">', replacement: '<a data-i18n="dl.btn" href="https://drive.google.com/file/d/1R_7dqcFS1kef_SWxAF3nLnnRm21Sjo3i/view?usp=sharing" target="_blank" class="download-btn">' },
    { target: '<span class="section-title">Requisitos Mínimos da Máquina</span>', replacement: '<span class="section-title" data-i18n="req.title">Requisitos Mínimos da Máquina</span>' },
    { target: '<h3>Processador (CPU)</h3>', replacement: '<h3 data-i18n="req.cpu_title">Processador (CPU)</h3>' },
    { target: '<p>2 vCores / Threads ou superior. Arquitetura x86_64.</p>', replacement: '<p data-i18n="req.cpu_desc">2 vCores / Threads ou superior. Arquitetura x86_64.</p>' },
    { target: '<h3>Memória RAM</h3>', replacement: '<h3 data-i18n="req.ram_title">Memória RAM</h3>' },
    { target: '<p>4 GB Mínimo. Recomendado 8 GB para redes com mais de 5.000 clientes.</p>', replacement: '<p data-i18n="req.ram_desc">4 GB Mínimo. Recomendado 8 GB para redes com mais de 5.000 clientes.</p>' },
    { target: '<h3>Armazenamento (Disco)</h3>', replacement: '<h3 data-i18n="req.disk_title">Armazenamento (Disco)</h3>' },
    { target: '<p>40 GB SSD. Necessário para cache em alta velocidade e banco de dados local.</p>', replacement: '<p data-i18n="req.disk_desc">40 GB SSD. Necessário para cache em alta velocidade e banco de dados local.</p>' },
    { target: '<h3>Rede / Conectividade</h3>', replacement: '<h3 data-i18n="req.net_title">Rede / Conectividade</h3>' },
    { target: '<p>Placa de rede Gigabit. Porta 53 (UDP/TCP) e porta 443 (TCP) liberadas.</p>', replacement: '<p data-i18n="req.net_desc">Placa de rede Gigabit. Porta 53 (UDP/TCP) e porta 443 (TCP) liberadas.</p>' },
    { target: '<i data-lucide="arrow-left" width="16" height="16"></i>\n            Voltar para o Início', replacement: '<i data-lucide="arrow-left" width="16" height="16"></i> Voltar para o Início' },
    { target: '<a href="/" class="back-link">', replacement: '<a data-i18n="nav.home" href="/" class="back-link">' }
]);

// 3. Docs (if it exists)
processFile('docs.html', [
    { target: '<h1>Documentação Oficial</h1>', replacement: '<h1 data-i18n="doc.title">Documentação Oficial</h1>' },
    { target: '<p>Guias, tutoriais e manuais de implementação do ecossistema Sentinel.</p>', replacement: '<p data-i18n="doc.desc">Guias, tutoriais e manuais de implementação do ecossistema Sentinel.</p>' },
    { target: '<i data-lucide="arrow-left" width="16" height="16"></i>\n            Voltar para o Início', replacement: '<i data-lucide="arrow-left" width="16" height="16"></i> Voltar para o Início' },
    { target: '<a href="/" class="back-link">', replacement: '<a data-i18n="nav.home" href="/" class="back-link">' }
]);

// 4. Privacidade
processFile('privacidade.html', []);
