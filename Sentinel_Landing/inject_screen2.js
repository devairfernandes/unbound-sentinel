const fs = require('fs');

const indexHtmlPath = 'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/index.html';

if (fs.existsSync(indexHtmlPath)) {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    const injection = `
        <!-- Dashboard Preview Section 2 (Global Traffic) -->
        <section class="preview-section" style="text-align: center; margin: 5rem 0; animation: fade-in-up 1s ease; z-index: 2; position: relative;">
            <div style="position: relative; max-width: 1000px; margin: 0 auto; padding: 0 1rem;">
                <div style="position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(56,189,248,0.15) 0%, transparent 70%); filter: blur(40px); z-index: -1;"></div>
                <img src="/screen2-real.png" alt="Sentinel Global Traffic Preview" style="width: 100%; border-radius: 12px; border: 1px solid rgba(56,189,248,0.3); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7), 0 0 60px rgba(56,189,248,0.15);">
            </div>
        </section>

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

    if (!html.includes('screen2-real.png')) {
        html = html.replace('<!-- Architecture / SEO Content -->', injection + '\n        <!-- Architecture / SEO Content -->');
        fs.writeFileSync(indexHtmlPath, html, 'utf8');
        console.log("Injected screen2 and Use Cases successfully.");
    } else {
        console.log("Already injected.");
    }
}
