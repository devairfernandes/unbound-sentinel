
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('sentinel-header-root');
    if (root) {
        root.innerHTML = `<div class="header" style="border-bottom: 1px solid rgba(56, 189, 248, 0.15); padding: 1rem 1.5rem; backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 1000; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
        <button id="mobile-menu-btn" class="mobile-menu-btn" aria-label="Abrir menu de navegação" style="background: transparent; border: none; color: #38bdf8; cursor: pointer; display: none;">
            <i data-lucide="menu" width="28" height="28"></i>
        </button>
        <div class="mobile-logo-text" style="display: none; color: #fff; font-weight: bold; font-family: 'Outfit', sans-serif; font-size: 1.2rem;">
            Sentinel<span style="color:#38bdf8">DNS</span>
        </div>
        <div class="nav-links" style="display: flex; gap: 2rem; justify-content: center; align-items: center; flex: 1;">
            <a href="/" style="color: #38bdf8; text-decoration: none; font-weight: 700; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem; transition: color 0.3s; justify-content: center;" aria-current="page"><i data-lucide="home" width="16" height="16"></i> Início</a>
            <a href="/docs.html" style="color: #94a3b8; text-decoration: none; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem; transition: color 0.3s; justify-content: center;"><i data-lucide="book" width="16" height="16"></i> Documentação</a>
            <a href="/blog/oque-e-dns-recursivo.html" style="color: #94a3b8; text-decoration: none; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem; transition: color 0.3s; justify-content: center;"><i data-lucide="pen-tool" width="16" height="16"></i> Blog</a>
            <a href="/download.html" style="color: #94a3b8; text-decoration: none; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem; transition: color 0.3s; justify-content: center;"><i data-lucide="download" width="16" height="16"></i> Instalação ISO</a>
            <a href="/privacidade.html" style="color: #94a3b8; text-decoration: none; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem; transition: color 0.3s; justify-content: center;"><i data-lucide="shield" width="16" height="16"></i> Privacidade</a>
            <a href="https://t.me/sentineldns" target="_blank" rel="noopener noreferrer" style="color: #94a3b8; text-decoration: none; font-weight: 600; font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem; transition: color 0.3s; justify-content: center;"><i data-lucide="send" width="16" height="16"></i> Telegram</a>
        </div>
    </div>`;
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const mobileMenu = document.querySelector('.nav-links');
        if (mobileBtn && mobileMenu) {
            mobileBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('active');
            });
        }
        if (window.lucide) {
            lucide.createIcons({ root: root });
        }
    }
});
