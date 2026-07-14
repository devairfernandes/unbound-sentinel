const fs = require('fs');

const indexHtmlPath = 'index.html';
const styleCssPath = 'style.css';
const langJsPath = 'lang.js';

// 1. UPDATE index.html
if (fs.existsSync(indexHtmlPath)) {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    // Add Dashboard Preview
    if (!html.includes('preview-section')) {
        const previewBlock = `
        <!-- Dashboard Preview Section -->
        <section class="preview-section" style="text-align: center; margin: 2rem 0 5rem 0; animation: fade-in-up 1s ease; z-index: 2; position: relative;">
            <div style="position: relative; max-width: 1000px; margin: 0 auto; padding: 0 1rem;">
                <div style="position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(56,189,248,0.15) 0%, transparent 70%); filter: blur(40px); z-index: -1;"></div>
                <img src="/screen1-real.png" alt="Sentinel Dashboard Preview" style="width: 100%; border-radius: 12px; border: 1px solid rgba(56,189,248,0.3); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 60px rgba(56,189,248,0.15);">
            </div>
        </section>
`;
        html = html.replace('</section>\n\n        <!-- Live Stats Grid -->', '</section>\n' + previewBlock + '\n        <!-- Live Stats Grid -->');
    }

    // Add Casos de Uso
    if (!html.includes('usecases-section')) {
        const useCasesBlock = `
        <!-- Use Cases Section -->
        <section class="usecases-section" id="casos-uso" style="margin-bottom: 5rem;">
            <h2 data-i18n="uc.title" style="text-align: center; margin-bottom: 3rem; font-size: 2.2rem; color: #f8fafc;">Para quem é o Sentinel?</h2>
            <div class="arch-grid">
                <div class="arch-card" style="border-top: 3px solid var(--accent-primary);">
                    <h3 data-i18n="uc.c1_title" style="color: var(--text-highlight); display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="wifi"></i> Provedores ISP</h3>
                    <p data-i18n="uc.c1_desc">Reduza a latência da sua rede com cache ultrarrápido, economize link internacional e bloqueie sites irregulares exigidos pela Anatel (AnaBlock) de forma 100% automatizada.</p>
                </div>
                <div class="arch-card" style="border-top: 3px solid #f43f5e;">
                    <h3 data-i18n="uc.c2_title" style="color: var(--text-highlight); display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="building"></i> Redes Corporativas</h3>
                    <p data-i18n="uc.c2_desc">Proteja os computadores da sua empresa contra ataques de Ransomware, Phishing e Botnets interceptando as ameaças na camada DNS antes que cheguem aos usuários.</p>
                </div>
                <div class="arch-card" style="border-top: 3px solid var(--success);">
                    <h3 data-i18n="uc.c3_title" style="color: var(--text-highlight); display: flex; align-items: center; gap: 0.5rem;"><i data-lucide="server"></i> Datacenters</h3>
                    <p data-i18n="uc.c3_desc">Ofereça um serviço de resolução DNS local de alta disponibilidade para seus clientes em nuvem, garantindo estabilidade mesmo sob fortes ataques DDoS.</p>
                </div>
            </div>
        </section>
`;
        html = html.replace('<!-- Architecture Section -->', useCasesBlock + '\n        <!-- Architecture Section -->');
    }

    // Add Floating CTA HTML
    if (!html.includes('floating-cta')) {
        html = html.replace('</footer>\n    </div>', '</footer>\n        <a href="download.html" class="floating-cta" data-i18n="float.cta"><i data-lucide="download"></i> Baixar ISO Grátis</a>\n    </div>');
    }

    // Add Floating CTA Script
    if (!html.includes('floatCta.classList.add')) {
        const jsToAdd = `
        // Floating CTA Logic
        const floatCta = document.querySelector('.floating-cta');
        if(floatCta) {
            window.addEventListener('scroll', () => {
                if(window.scrollY > 600) floatCta.classList.add('visible');
                else floatCta.classList.remove('visible');
            });
        }
        `;
        html = html.replace('lucide.createIcons();', 'lucide.createIcons();\n' + jsToAdd);
    }

    fs.writeFileSync(indexHtmlPath, html, 'utf8');
}

// 2. UPDATE style.css
if (fs.existsSync(styleCssPath)) {
    let css = fs.readFileSync(styleCssPath, 'utf8');
    if (!css.includes('.floating-cta')) {
        const cssToAdd = `
/* Floating CTA */
.floating-cta {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: linear-gradient(135deg, var(--accent-primary) 0%, #1e40af 100%);
    color: #fff;
    padding: 1rem 1.5rem;
    border-radius: 50px;
    font-weight: 700;
    font-size: 1rem;
    text-decoration: none;
    box-shadow: 0 10px 25px rgba(56, 189, 248, 0.4);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    z-index: 100;
    transition: all 0.3s ease;
    opacity: 0;
    visibility: hidden;
    transform: translateY(20px);
}
.floating-cta.visible {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
}
.floating-cta:hover {
    transform: translateY(-5px) scale(1.05);
    box-shadow: 0 15px 30px rgba(56, 189, 248, 0.6);
    color: #fff;
}
`;
        fs.writeFileSync(styleCssPath, css + cssToAdd, 'utf8');
    }
}

// 3. UPDATE lang.js
if (fs.existsSync(langJsPath)) {
    let lang = fs.readFileSync(langJsPath, 'utf8');
    
    // PT Additions
    if (!lang.includes('"float.cta"')) {
        const ptInserts = `        "float.cta": "<i data-lucide=\\"download\\"></i> Baixar ISO Grátis",
        "uc.title": "Para quem é o Sentinel?",
        "uc.c1_title": "<i data-lucide=\\"wifi\\"></i> Provedores ISP",
        "uc.c1_desc": "Reduza a latência da sua rede com cache ultrarrápido, economize link internacional e bloqueie sites irregulares exigidos pela Anatel (AnaBlock) de forma 100% automatizada.",
        "uc.c2_title": "<i data-lucide=\\"building\\"></i> Redes Corporativas",
        "uc.c2_desc": "Proteja os computadores da sua empresa contra ataques de Ransomware, Phishing e Botnets interceptando as ameaças na camada DNS antes que cheguem aos usuários.",
        "uc.c3_title": "<i data-lucide=\\"server\\"></i> Datacenters",
        "uc.c3_desc": "Ofereça um serviço de resolução DNS local de alta disponibilidade para seus clientes em nuvem, garantindo estabilidade mesmo sob fortes ataques DDoS.",
`;
        lang = lang.replace('"hero.title": "Sentinel DNS<br><span class=\\"highlight\\">Open Source Appliance</span>",', ptInserts + '        "hero.title": "Sentinel DNS<br><span class=\\"highlight\\">Open Source Appliance</span>",');

        const enInserts = `        "float.cta": "<i data-lucide=\\"download\\"></i> Download Free ISO",
        "uc.title": "Who is Sentinel for?",
        "uc.c1_title": "<i data-lucide=\\"wifi\\"></i> ISPs & Telecom",
        "uc.c1_desc": "Reduce network latency with ultra-fast caching, save international bandwidth, and automatically block illegal websites mandated by regulators.",
        "uc.c2_title": "<i data-lucide=\\"building\\"></i> Corporate Networks",
        "uc.c2_desc": "Protect your company's computers against Ransomware, Phishing, and Botnet attacks by intercepting threats at the DNS layer before they reach users.",
        "uc.c3_title": "<i data-lucide=\\"server\\"></i> Datacenters",
        "uc.c3_desc": "Provide a high-availability local DNS resolution service for your cloud customers, ensuring stability even under heavy DDoS attacks.",
`;
        lang = lang.replace('"hero.title": "Sentinel DNS<br><span class=\\"highlight\\">Open Source Appliance</span>",\n        "hero.desc": "Sentinel DNS is an open-source', enInserts + '        "hero.title": "Sentinel DNS<br><span class=\\"highlight\\">Open Source Appliance</span>",\n        "hero.desc": "Sentinel DNS is an open-source');

        const esInserts = `        "float.cta": "<i data-lucide=\\"download\\"></i> Descargar ISO Gratis",
        "uc.title": "¿Para quién es Sentinel?",
        "uc.c1_title": "<i data-lucide=\\"wifi\\"></i> Proveedores ISP",
        "uc.c1_desc": "Reduzca la latencia de su red con caché ultrarrápido, ahorre ancho de banda internacional y bloquee sitios ilegales automáticamente.",
        "uc.c2_title": "<i data-lucide=\\"building\\"></i> Redes Corporativas",
        "uc.c2_desc": "Proteja las computadoras de su empresa contra ataques de Ransomware, Phishing y Botnets interceptando amenazas en la capa DNS.",
        "uc.c3_title": "<i data-lucide=\\"server\\"></i> Datacenters",
        "uc.c3_desc": "Ofrezca un servicio de resolución DNS local de alta disponibilidad para sus clientes en la nube, garantizando estabilidad bajo ataques DDoS.",
`;
        lang = lang.replace('"hero.title": "Sentinel DNS<br><span class=\\"highlight\\">Open Source Appliance</span>",\n        "hero.desc": "Sentinel DNS es un appliance', esInserts + '        "hero.title": "Sentinel DNS<br><span class=\\"highlight\\">Open Source Appliance</span>",\n        "hero.desc": "Sentinel DNS es un appliance');

        fs.writeFileSync(langJsPath, lang, 'utf8');
    }
}

console.log('Update finished successfully.');
