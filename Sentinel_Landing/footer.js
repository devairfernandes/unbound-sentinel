
document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('sentinel-footer-root');
    if (root) {
        root.innerHTML = `<footer style="border-top: 1px solid rgba(56,189,248,0.1); padding: 2rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: gap; gap: 1rem; font-size: 0.85rem; color: #94a3b8; font-family: 'Outfit', sans-serif;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="lock" style="width: 15px; height: 15px; color: #10b981;"></i>
            Conexão criptografada (End-to-End Encryption)
        </div>
        <div>Sentinel DNS © 2026 — Todos os direitos reservados</div>
        <div style="display: flex; gap: 1.2rem;">
            <a href="/" style="color: #94a3b8; text-decoration: none; transition: color 0.3s;" onmouseover="this.style.color='#38bdf8'" onmouseout="this.style.color='#94a3b8'">Início</a>
            <a href="/docs.html" style="color: #94a3b8; text-decoration: none; transition: color 0.3s;" onmouseover="this.style.color='#38bdf8'" onmouseout="this.style.color='#94a3b8'">Docs</a>
            <a href="/blog/oque-e-dns-recursivo.html" style="color: #94a3b8; text-decoration: none; transition: color 0.3s;" onmouseover="this.style.color='#38bdf8'" onmouseout="this.style.color='#94a3b8'">Blog</a>
            <a href="/download.html" style="color: #94a3b8; text-decoration: none; transition: color 0.3s;" onmouseover="this.style.color='#38bdf8'" onmouseout="this.style.color='#94a3b8'">Download</a>
            <a href="/privacidade.html" style="color: #94a3b8; text-decoration: none; transition: color 0.3s;" onmouseover="this.style.color='#38bdf8'" onmouseout="this.style.color='#94a3b8'">Privacidade</a>
            <a href="mailto:dnssentinel@sentineldns.net" style="color: #94a3b8; text-decoration: none; transition: color 0.3s;" onmouseover="this.style.color='#38bdf8'" onmouseout="this.style.color='#94a3b8'">Suporte</a>
        </div>
    </footer>`;
        if (window.lucide) {
            lucide.createIcons({ root: root });
        }
    }
});
