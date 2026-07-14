const fs = require('fs');

const indexHtmlPath = 'index.html';

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
        html = html.replace(/<\/section>\s*<!-- Live Stats Grid -->/, '</section>\n' + previewBlock + '\n        <!-- Live Stats Grid -->');
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
        html = html.replace(/<!-- Architecture Section -->/, useCasesBlock + '\n        <!-- Architecture Section -->');
    }

    // Add Floating CTA HTML
    if (!html.includes('floating-cta')) {
        html = html.replace(/<\/footer>\s*<\/div>/, '</footer>\n        <a href="download.html" class="floating-cta" data-i18n="float.cta"><i data-lucide="download"></i> Baixar ISO Grátis</a>\n    </div>');
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
        html = html.replace(/lucide\.createIcons\(\);/, 'lucide.createIcons();\n' + jsToAdd);
    }

    fs.writeFileSync(indexHtmlPath, html, 'utf8');
}
