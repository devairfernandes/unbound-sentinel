/* ===================================================
   SENTINEL MASTER HQ ΓÇö JavaScript
   L├│gica exclusiva do dashboard master.
   N├úo mistura com app.js do DNS.
   =================================================== */

'use strict';

// ===== CONFIG =====
const MASTER_API = '/api';
// let masterAuth is removed
let allSessions = [];
let allLicenses = {};
let revenueChart = null;
let pollInterval = null;
let pricingData  = null;

// Cache para dados dos bot├╡es (evita JSON em onclick)
const sessionCache = {}; // hwid -> session data
const licenseCache = {}; // key -> license data

// ===== UTILIT├üRIOS =====
function escH(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str.replace(/[&<>"']/g, t => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[t] || t));
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

function masterFetch(url, opts = {}) {
    opts.credentials = 'include';
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    
    // Injeta Token CSRF para requisi├º├╡es de altera├º├úo de estado (POST/PUT/DELETE)
    if (['POST', 'PUT', 'DELETE'].includes(opts.method?.toUpperCase())) {
        const csrfToken = getCookie('sentinel_csrf');
        if (csrfToken) {
            headers['x-csrf-token'] = csrfToken;
        }
    }
    
    return fetch(url, { ...opts, headers });
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatRelativeTime(isoDate) {
    if (!isoDate) return 'ΓÇö';
    const diff = Date.now() - new Date(isoDate).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60)  return `${s}s atr├ís`;
    if (s < 3600) return `${Math.floor(s/60)}min atr├ís`;
    if (s < 86400) return `${Math.floor(s/3600)}h atr├ís`;
    return new Date(isoDate).toLocaleDateString('pt-BR');
}

function formatDate(val) {
    if (!val || val === 'never') return 'Nunca';
    try { return new Date(val).toLocaleDateString('pt-BR'); } catch { return val; }
}

function animateNum(el, to) {
    if (!el) return;
    if (el._animateInterval) {
        clearInterval(el._animateInterval);
    }
    const from = parseInt(el.innerText.replace(/\D/g, '')) || 0;
    if (from === to) {
        el.innerText = to;
        return;
    }
    const step = (to - from) / 20;
    let cur = from;
    el._animateInterval = setInterval(() => {
        cur += step;
        if ((step > 0 && cur >= to) || (step < 0 && cur <= to)) { 
            cur = to; 
            clearInterval(el._animateInterval); 
            delete el._animateInterval;
        }
        el.innerText = Math.round(cur);
    }, 25);
}

// ===== REL├ôGIO =====
function updateMasterClock() {
    const el = document.getElementById('master-clock');
    if (el) el.innerText = new Date().toLocaleTimeString('pt-BR');
}
setInterval(updateMasterClock, 1000);
updateMasterClock();

// ===== PART├ìCULAS (tema roxo) =====
function initMasterParticles() {
    const canvas = document.getElementById('master-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const count = 55;
    const particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.2 + 0.4
    }));

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(139,92,246,0.5)';
            ctx.fill();
        });
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(124,58,237,${0.15 * (1 - dist/120)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(draw);
    }
    draw();
}

// ===== NAVEGA├ç├âO =====
function showMasterSection(name, btn) {
    document.querySelectorAll('.master-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.master-nav-item').forEach(b => b.classList.remove('active'));

    const section = document.getElementById(`section-${name}`);
    if (section) section.classList.add('active');
    if (btn) btn.classList.add('active');

    const titles = {
        overview:  ['Vis├úo Geral', 'Painel central de gest├úo ΓÇö Sentinel Master HQ'],
        clients:   ['Clientes', 'Todos os servidores Sentinel registrados'],
        licenses:  ['Licen├ºas', 'Gest├úo de chaves de ativa├º├úo e planos'],
        revenue:   ['Receita', 'Estimativa baseada em licen├ºas ativas'],
        plans:     ['Planos & Promo├º├úo', 'Pre├ºos e promo├º├╡es exibidos para os clientes'],
        users:     ['Usu├írios', 'Contas com acesso ao painel master'],
        alerts:    ['Alertas', 'Notifica├º├╡es do sistema'],
        config:    ['Configura├º├╡es', 'Token de hardware, credenciais e integra├º├╡es'],
    };
    const [title, subtitle] = titles[name] || ['Master HQ', ''];
    const h1 = document.getElementById('section-title');
    const sub = document.getElementById('section-subtitle');
    if (h1) h1.innerText = title;
    if (sub) sub.innerText = subtitle;

    // A├º├╡es espec├¡ficas por se├º├úo
    if (name === 'licenses') loadLicenses();
    if (name === 'users')    loadUsers();
    if (name === 'revenue')  renderRevenueSection();
    if (name === 'clients')  renderClientsPage();
    if (name === 'plans')    loadPlans();
    if (name === 'alerts')   loadAlerts();
}

// ===== TOAST =====
function showToast(msg, type = 'info') {
    const icons = { success: 'Γ£à', error: 'Γ¥î', info: 'Γä╣∩╕Å' };
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `master-toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${escH(msg)}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ===== GERAR CHAVE DE LICEN├çA =====
function generateLicenseKey(type) {
    // Pega o tipo do select se n├úo passado
    if (!type) type = document.getElementById('lic-type')?.value || 'pro';
    const prefixMap = { 'pro': 'PRO', 'pro-lite': 'LITE', 'pro-trial': 'TRIAL', 'free': 'FREE' };
    const prefix = prefixMap[type] || 'PRO';

    // Gera 3 blocos de 4 chars aleat├│rios (mai├║sculos, sem caracteres amb├¡guos)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const block = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const key = `SEN-${prefix}-${block()}-${block()}-${block()}`;

    const el = document.getElementById('lic-key');
    if (el) el.value = key;
    return key;
}

// ===== MODAL =====
// Mapeamento de Funcionalidades por Plano
const PLANOS_FUNCIONALIDADES = {
    'pro':       { tv: true,  globe: true,  cti: true,  benchmark: true,  update: true,  charts: true,  config: true  },
    'pro-lite':  { tv: false, globe: false, cti: false, benchmark: false, update: true,  charts: true,  config: true  },
    'pro-trial': { tv: true,  globe: true,  cti: true,  benchmark: true,  update: true,  charts: true,  config: true  },
    'free':      { tv: false, globe: false, cti: false, benchmark: false, update: false, charts: false, config: false }
};

let hasManualFeatureChanges = false;

// Tracker de altera├º├úo manual nas checkboxes de features
['tv','globe','cti','benchmark','update','charts','config'].forEach(f => {
    const el = document.getElementById(`feat-${f}`);
    if (el) {
        el.addEventListener('change', () => {
            hasManualFeatureChanges = true;
        });
    }
});

// Listener do add-on de suporte para refletir automaticamente no CTI
const licSuporteAtivo = document.getElementById('lic-suporte-ativo');
if (licSuporteAtivo) {
    licSuporteAtivo.addEventListener('change', () => {
        const type = document.getElementById('lic-type').value;
        if (type === 'pro-lite' && !hasManualFeatureChanges) {
            const featCti = document.getElementById('feat-cti');
            if (featCti) featCti.checked = licSuporteAtivo.checked;
        }
    });
}

function applyLicenseBusinessRules(isUserTriggered = false) {
    const typeEl = document.getElementById('lic-type');
    const modObj = document.getElementById('lic-modelo');
    const addonsContainer = document.getElementById('lic-addons-container');
    const expiryContainer = document.getElementById('lic-expiry-container');
    
    if (!typeEl || !modObj) return;

    const plan = typeEl.value;
    const isTrial = plan.includes('trial') || plan === 'free';
    
    if (isUserTriggered && isTrial) {
        modObj.value = 'recorrente';
        const licSuporte = document.getElementById('lic-suporte-ativo');
        const licExtraNodes = document.getElementById('lic-extra-nodes');
        if (licSuporte) licSuporte.checked = false;
        if (licExtraNodes) licExtraNodes.value = 0;
    }
    
    let warningId = 'lic-business-warning';
    let warningEl = document.getElementById(warningId);
    if (!warningEl) {
        warningEl = document.createElement('div');
        warningEl.id = warningId;
        warningEl.style = 'font-size: 11px; color: var(--amber-400); margin-top: 6px; display: none;';
        modObj.parentNode.appendChild(warningEl);
    }
    
    if (isTrial && modObj.value === 'vitalicio') {
        warningEl.innerHTML = 'ΓÜá∩╕Å Incomum: Planos Trial/Free normalmente n├úo s├úo vital├¡cios.';
        warningEl.style.display = 'block';
    } else {
        warningEl.style.display = 'none';
    }
    
    if (expiryContainer) {
        expiryContainer.style.display = (modObj.value === 'vitalicio') ? 'none' : 'block';
    }
    
    if (addonsContainer) {
        addonsContainer.style.display = 'block';
        if (isTrial) {
            addonsContainer.style.opacity = '0.4';
            addonsContainer.style.border = '1px dashed var(--amber-500)';
            addonsContainer.title = 'Add-ons geralmente n├úo se aplicam a planos Trial.';
        } else {
            addonsContainer.style.opacity = '1';
            addonsContainer.style.border = '1px solid rgba(255,255,255,0.05)';
            addonsContainer.title = '';
        }
    }
}

function setFeatCheckboxes(features) {
    ['tv','globe','cti','benchmark','update','charts','config'].forEach(f => {
        const el = document.getElementById(`feat-${f}`);
        if (el) el.checked = !!(features?.[f]);
    });
}

function setFeaturePreset(type) {
    // Caso venha dos bot├╡es antigos que passavam 'lite' em vez de 'pro-lite'
    const planKey = (type === 'lite') ? 'pro-lite' : type;
    const preset = PLANOS_FUNCIONALIDADES[planKey] || PLANOS_FUNCIONALIDADES['free'];
    const features = { ...preset };

    // Regra do CTI para PRO Lite baseada no add-on de suporte
    if (planKey === 'pro-lite') {
        const modObj = document.getElementById('lic-modelo');
        if (modObj && modObj.value === 'vitalicio' && licSuporteAtivo) {
            features.cti = licSuporteAtivo.checked;
        }
    }
    
    setFeatCheckboxes(features);
    hasManualFeatureChanges = false; // Aplicar um preset reseta o status de edi├º├úo manual
}

function getFeatCheckboxes() {
    const f = {};
    ['tv','globe','cti','benchmark','update','charts','config'].forEach(k => {
        f[k] = !!(document.getElementById(`feat-${k}`)?.checked);
    });
    return f;
}

function openAddLicenseModal(licKey = '', data = {}) {
    const isNew = !licKey;
    const type = data.type || 'pro';

    document.getElementById('lic-type').value   = type;
    
    const licClientInput = document.getElementById('lic-client');
    licClientInput.value = data.client || '';
    licClientInput.removeAttribute('data-client-id');
    licClientInput.readOnly = false;
    
    document.getElementById('lic-expiry').value = (data.expiry && data.expiry !== 'never') ? data.expiry.split('T')[0] : '';
    document.getElementById('lic-hwid').value   = data.hwid || '';
    
    const modObj = document.getElementById('lic-modelo');
    if (modObj) {
        modObj.value = data.modelo_cobranca || 'recorrente';
        
        const licSuporte = document.getElementById('lic-suporte-ativo');
        if (licSuporte) licSuporte.checked = data.suporte_ativo !== undefined ? data.suporte_ativo : true;
        
        const licExtraNodes = document.getElementById('lic-extra-nodes');
        if (licExtraNodes) licExtraNodes.value = data.extra_nodes || 0;
        
        applyLicenseBusinessRules(false);
    }

    // Preenche features ΓÇö usa as da licen├ºa ou o preset do plano
    let currentPlan = type; // Guarda o plano atual para poss├¡vel revert

    if (data.features) {
        setFeatCheckboxes(data.features);
        hasManualFeatureChanges = false; 
    } else {
        setFeaturePreset(type);
    }

    if (isNew) {
        generateLicenseKey(type);
    } else {
        document.getElementById('lic-key').value = licKey;
    }

    // Ao mudar plano: intercepta para confirmar overwrite manual
    const typeEl = document.getElementById('lic-type');
    typeEl.onchange = (e) => {
        const newPlan = typeEl.value;
        if (hasManualFeatureChanges) {
            const confirmChange = confirm("Trocar o plano vai resetar as funcionalidades marcadas para o padr├úo deste novo plano. Continuar?");
            if (!confirmChange) {
                typeEl.value = currentPlan; // Reverte o dropdown
                return;
            }
        }
        currentPlan = newPlan;
        
        if (isNew) generateLicenseKey(newPlan);
        setFeaturePreset(newPlan);
        applyLicenseBusinessRules(true);
    };

    document.getElementById('modal-license').style.display = 'flex';
    setTimeout(() => { document.getElementById('lic-client')?.focus(); }, 80);
}

function openAddUserModal() {
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-pass').value = '';
    document.getElementById('new-user-role').value = 'operator';
    document.getElementById('modal-user').style.display = 'flex';
}

function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

// ===== VERIFICAR MASTER + CARREGAR INFO =====
async function verifyMasterAndInit() {
    try {
        const res = await masterFetch(`${MASTER_API}/master/verify`);
        if (res.status === 401) {
            // Sem auth ΓÇö mostra tela de login embutida
            showLoginScreen();
            return false;
        }
        if (res.status === 403) {
            // Auth OK mas n├úo ├⌐ master (token inv├ílido ou IS_MASTER=false)
            showNotMasterError();
            return false;
        }
        if (!res.ok) {
            showLoginScreen('Erro de servidor. Tente novamente.');
            return false;
        }
        const data = await res.json();

        // Esconde tela de login se estava vis├¡vel
        const loginOverlay = document.getElementById('master-login-overlay');
        if (loginOverlay) loginOverlay.remove();

        // Preenche fingerprint e info
        const fpEl = document.getElementById('fp-display');
        if (fpEl) fpEl.textContent = data.fingerprint || 'ΓÇö';
        document.getElementById('info-hostname').innerText = data.hostname || 'ΓÇö';
        document.getElementById('info-uptime').innerText = data.uptime ? formatUptime(data.uptime) : 'ΓÇö';
        document.getElementById('cfg-fingerprint').value = data.fingerprint || '';
        document.getElementById('cfg-hwid').value       = data.hwid || '';
        document.getElementById('cfg-hostname').innerText = data.hostname || 'ΓÇö';
        document.getElementById('cfg-platform').innerText = data.platform || 'ΓÇö';
        document.getElementById('cfg-uptime').innerText   = data.uptime ? formatUptime(data.uptime) : 'ΓÇö';

        return true;
    } catch (e) {
        console.error('[Master] Erro ao verificar token master:', e);
        showLoginScreen('Falha de conex├úo com o servidor.');
        return false;
    }
}

// ===== VERS├âO =====
async function loadVersion() {
    try {
        const res = await masterFetch(`${MASTER_API}/system/check-update`);
        if (res.ok) {
            const d = await res.json();
            window.masterVersion = d.currentVersion || '1.0.0';
            const el = document.getElementById('info-version');
            if (el) el.innerText = d.currentVersion || 'ΓÇö';
        }
    } catch {}
}

async function loadPricingData() {
    try {
        const res = await masterFetch(`${MASTER_API}/system/pricing`);
        if (res.ok) {
            pricingData = await res.json();
        }
    } catch {}
}

// ===== BLACKLIST (Banlist) =====
async function loadBlacklist() {
    try {
        const res = await masterFetch(`${MASTER_API}/system/blacklist`);
        if (res.ok) {
            const data = await res.json();
            const tbody = document.querySelector('#blacklist-table tbody');
            if (!tbody) return;
            
            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Nenhum HWID bloqueado.</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.map(b => `
                <tr>
                    <td style="font-family:monospace;font-size:11px;">${b.hwid}</td>
                    <td>${b.clientName || 'Desconhecido'}</td>
                    <td style="font-size:11px;color:var(--text-muted)">${new Date(b.blockedAt).toLocaleString()}</td>
                    <td style="text-align:center;">
                        <button class="btn-master outline" data-action="unbanClient" data-hwid="${b.hwid}" style="padding:4px 8px;font-size:11px;">
                            Desbloquear
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (e) {
        console.error('[Blacklist] Erro ao carregar blacklist:', e);
    }
}

window.unbanClient = async function(hwid) {
    if (!confirm(`Tem certeza que deseja desbloquear o HWID: ${hwid}?`)) return;
    try {
        const res = await masterFetch(`${MASTER_API}/system/blacklist/${hwid}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('HWID desbloqueado com sucesso!');
            loadBlacklist();
        } else {
            const err = await res.json();
            alert(err.error || 'Erro ao desbloquear');
        }
    } catch(e) {
        alert('Erro de rede ao desbloquear HWID');
    }
}

// ===== LICEN├çA (master pr├│pria) =====
async function loadMasterLicense() {
    try {
        const res = await masterFetch(`${MASTER_API}/system/license`);
        if (res.ok) {
            const d = await res.json();
            const el = document.getElementById('info-license');
            if (el) el.innerText = d.status?.client || 'ΓÇö';
            // Token no cfg
            const tk = document.getElementById('cfg-master-token');
            if (tk && d.masterToken) tk.value = 'ΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇóΓÇó' + d.masterToken.slice(-8);
        }
    } catch {}
}

// ===== CLIENTES ATIVOS =====
let allClients = [];

async function loadActiveSessions() {
    try {
        const resSessions = await masterFetch(`${MASTER_API}/system/active-clients`);
        if (resSessions.ok) allSessions = await resSessions.json();
        
        const resClients = await masterFetch(`${MASTER_API}/system/clients`);
        if (resClients.ok) allClients = await resClients.json();

        const resLic = await masterFetch(`${MASTER_API}/system/licenses-db`);
        if (resLic.ok) allLicenses = await resLic.json();
        
        try {
            const histRes = await masterFetch(`${MASTER_API}/system/historical-metrics`);
            if (histRes.ok) {
                const histData = await histRes.json();
                renderSparklines(histData);
            }
        } catch(e){}

        updateMetrics();
        renderClientsTable('clients-tbody', allClients, true);
        renderClientsPage();
        updateDistribution();
        // Item 5: timestamp de atualiza├º├úo
        const tsEl = document.getElementById('clients-last-update');
        if (tsEl) tsEl.innerText = 'atualizado ' + new Date().toLocaleTimeString('pt-BR');
    } catch (e) {
        console.error('[Master] Erro ao carregar sess├╡es:', e);
    }
}

function updateMetrics() {
    const total  = allSessions.length;
    const online = allSessions.filter(s => Date.now() - new Date(s.lastSeen).getTime() < 5 * 60 * 1000).length;

    // Receita e "Licen├ºas PRO" baseadas em allLicenses
    const validLicenses = Object.values(allLicenses).filter(l => {
        const expiry = l.expiry || l.expires_at;
        const isExpired = expiry && expiry !== 'never' && new Date() > new Date(expiry);
        return !isExpired && (l.valid || l.status === 'active');
    });

    const proLicenses = validLicenses.filter(l => l.type === 'pro' || l.type === 'pro-lite');
    const pro = proLicenses.length;

    // Item 1: remove skeleton e popula com valor real
    const clearSkeleton = (el, value) => {
        if (!el) return;
        el.classList.remove('loading');
        el.innerHTML = '';
        el.innerText = value;
    };

    clearSkeleton(document.getElementById('m-total'),  total);
    clearSkeleton(document.getElementById('m-online'), online);
    clearSkeleton(document.getElementById('m-pro'),    pro);

    const bo = document.getElementById('badge-online');
    const bc = document.getElementById('badge-clients');
    if (bo) bo.innerText = online;
    if (bc) bc.innerText = total;

    // Item 4: zero-hint no card PRO
    const proHint = document.getElementById('m-pro-hint');
    if (proHint) proHint.style.display = pro === 0 ? 'block' : 'none';

    // Sub-label do card Total
    const totalSub = document.getElementById('m-total-sub');
    if (totalSub) {
        totalSub.classList.remove('loading');
        totalSub.innerHTML = '';
        totalSub.innerText = 'clientes registrados';
    }
    const proSub = document.getElementById('m-pro-sub');
    if (proSub) {
        proSub.classList.remove('loading');
        proSub.innerHTML = '';
        proSub.innerText = 'licen├ºas ativas';
    }

    // Receita ΓÇö baseada no total de licen├ºas no DB
    const proPrice  = pricingData?.pro?.stripe_price  ? pricingData.pro.stripe_price  / 100 : 50;
    const litePrice = pricingData?.pro_lite?.stripe_price ? pricingData.pro_lite.stripe_price / 100 : 49.90;
    
    let mrr = 0;
    let lifetimeRev = 0;

    validLicenses.forEach(l => {
        if (l.type !== 'pro' && l.type !== 'pro-lite') return;
        const price = l.type === 'pro' ? proPrice : litePrice;
        if (l.modelo_cobranca === 'vitalicio') {
            lifetimeRev += l.price_paid !== undefined ? l.price_paid : 598.00;
            const suporteAtivo = l.suporte_ativo !== undefined ? l.suporte_ativo : true;
            if (suporteAtivo) {
                mrr += 29.90;
            }
            if (l.extra_nodes) {
                mrr += (parseInt(l.extra_nodes, 10) * 15.00);
            }
        } else {
            mrr += price;
        }
    });

    const revEl = document.getElementById('m-revenue');
    if (revEl) {
        revEl.classList.remove('loading');
        revEl.innerHTML = '';
        revEl.innerText = `R$${mrr.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    }
    const revSub = document.getElementById('m-revenue-sub');
    if (revSub) {
        revSub.classList.remove('loading');
        revSub.innerHTML = '';
        revSub.innerText = 'baseado em licen├ºas ativas';
    }
    const revBadge = document.getElementById('badge-revenue');
    if (revBadge) revBadge.innerText = `R$${mrr.toLocaleString('pt-BR')}`;

    const mrrEl  = document.getElementById('rev-mrr');
    const arrEl  = document.getElementById('rev-arr');
    const lifetimeEl = document.getElementById('rev-lifetime');
    const proEl  = document.getElementById('rev-pro-count');
    const freeEl = document.getElementById('rev-free-count');
    const trialEl = document.getElementById('rev-trial-count');
    const trialCount = allSessions.filter(s => s.status === 'pro-trial').length;
    if (mrrEl)   mrrEl.innerText   = `R$ ${mrr.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if (arrEl)   arrEl.innerText   = `R$ ${(mrr * 12).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if (lifetimeEl) lifetimeEl.innerText = `R$ ${lifetimeRev.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if (proEl)   proEl.innerText   = pro;
    if (trialEl) trialEl.innerText = trialCount;
    // FREE = tudo que n├úo ├⌐ pagante nem trial
    if (freeEl)  freeEl.innerText  = total - pro - trialCount;
}

// ===== SPARKLINES E DELTAS =====
let sparklineCharts = {};
function renderSparklines(history) {
    if (!history || history.length === 0) return;
    // Se tiver s├│ 1 dia, duplica pra formar uma reta
    const data = history.length === 1 ? [history[0], history[0]] : history;
    
    const labels = data.map(d => d.date);
    const totals = data.map(d => d.total);
    const pros = data.map(d => d.pro);
    const onlines = data.map(d => d.online);
    const revenues = data.map(d => d.revenue);

    const updateDelta = (id, values) => {
        const deltaEl = document.getElementById(id);
        if (!deltaEl) return;
        if (values.length < 2) return;
        const current = values[values.length - 1];
        const previous = values[values.length - 2];
        const diff = current - previous;
        if (diff === 0) {
            deltaEl.innerHTML = `<span style="color:var(--text-muted);font-size:11px;">= Sem varia├º├úo hoje</span>`;
        } else if (diff > 0) {
            deltaEl.innerHTML = `<span style="color:var(--green-400);font-size:11px;">Γåæ +${diff} hoje</span>`;
        } else {
            deltaEl.innerHTML = `<span style="color:var(--red-400);font-size:11px;">Γåô ${diff} hoje</span>`;
        }
    };

    updateDelta('delta-total', totals);
    updateDelta('delta-pro', pros);
    updateDelta('delta-online', onlines);
    updateDelta('delta-revenue', revenues);

    const drawSpark = (canvasId, vals, colorStr) => {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        if (sparklineCharts[canvasId]) sparklineCharts[canvasId].destroy();
        
        sparklineCharts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    data: vals,
                    borderColor: colorStr,
                    borderWidth: 1.5,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: { display: false, min: Math.min(...vals) * 0.9, max: Math.max(...vals) * 1.1 }
                },
                layout: { padding: 0 }
            }
        });
    };

    drawSpark('spark-total', totals, '#a78bfa'); // violet
    drawSpark('spark-pro', pros, '#a78bfa');
    drawSpark('spark-online', onlines, '#34d399'); // green
    drawSpark('spark-revenue', revenues, '#fbbf24'); // amber
}

function updateDistribution() {
    const validLicenses = Object.values(allLicenses).filter(l => {
        const expiry = l.expiry || l.expires_at;
        const isExpired = expiry && expiry !== 'never' && new Date() > new Date(expiry);
        return !isExpired && (l.valid || l.status === 'active');
    });

    const pro  = validLicenses.filter(l => l.type === 'pro').length;
    const lite = validLicenses.filter(l => l.type === 'pro-lite').length;
    const free = allSessions.filter(s => !s.status || s.status === 'free').length;
    const total = (pro + lite + free) || 1;

    const set = (id, n) => {
        const pct = Math.round((n / total) * 100);
        const pEl = document.getElementById(`dist-${id}-pct`);
        const bEl = document.getElementById(`dist-${id}-bar`);
        if (pEl) pEl.innerText = `${pct}%`;
        if (bEl) bEl.style.width = `${pct}%`;
    };
    set('pro',  pro);
    set('lite', lite);
    set('free', free);
}

function licBadgeHtml(type) {
    const map = {
        'pro':       ['PRO', 'pro'],
        'pro-lite':  ['PRO Lite', 'pro-lite'],
        'pro-trial': ['Trial', 'trial'],
        'free':      ['FREE', 'free'],
    };
    const [label, cls] = map[type] || ['FREE', 'free'];
    return `<span class="lic-badge ${cls}">${label}</span>`;
}

function renderClientsTable(tbodyId, clients, compact = false) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    if (!clients.length) {
        tbody.innerHTML = `<tr><td colspan="${compact?6:7}">
            <div class="empty-state">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                <p>Nenhum cliente registrado.</p>
            </div>
        </td></tr>`;
        return;
    }

    tbody.innerHTML = clients.map((c, idx) => {
        const isOnline = c.isOnline;
        const dotClass = isOnline ? 'online' : 'offline';
        const lastSeen = c.lastSeen ? formatRelativeTime(c.lastSeen) : 'Nunca';
        
        const mainNode = c.nodes && c.nodes.length > 0 ? c.nodes.sort((a,b) => b.lastSeen - a.lastSeen)[0] : null;

        // Avatar
        const avatarColors = [
            ['#7c3aed','#a78bfa'], ['#059669','#34d399'], ['#d97706','#fbbf24'],
            ['#0284c7','#38bdf8'], ['#dc2626','#f87171'], ['#7c3aed','#c4b5fd'],
        ];
        const name = c.name || '?';
        const initials = name.replace(/[^a-zA-Z0-9]/g, '').slice(0,2).toUpperCase() || '?';
        const colorPair = avatarColors[(name.charCodeAt(0) || 0) % avatarColors.length];
        const avatarHtml = `<span class="client-avatar" style="background:${colorPair[0]};color:${colorPair[1]};">${escH(initials)}</span>`;

        const hwidLabel = c.hwids && c.hwids.length > 1 ? `M├║ltiplos n├│s (${c.hwids.length})` : (mainNode ? mainNode.hwid.slice(0,16) : '');
        
        const nameCell = `<div class="client-name-wrap">
                          ${avatarHtml}
                          <div>
                            <div class="client-name"><span class="client-dot ${dotClass}"></span>${escH(name)}</div>
                            <div class="client-hostname">${escH(hwidLabel)}</div>
                          </div>
                        </div>`;

        const statusCol = compact ? '' : `<td><span class="client-dot ${dotClass}" style="display:inline-block"></span></td>`;

        const cacheId = `c_${idx}`;
        sessionCache[cacheId] = c;

        const actions = `<div style="display:flex;gap:4px;">
            <button class="action-btn manage" data-cache-id="${cacheId}" data-action="handleManageClient">
                Gerir
            </button>
        </div>`;

        const displayIp = mainNode ? mainNode.ip : c.ip;
        const displayVersion = mainNode ? mainNode.version : '';
        const displayStatus = mainNode ? mainNode.status : (Object.values(allLicenses).find(l => l.client_id === c.id)?.type || 'free');

        let versionBadge = '';
        if (displayVersion && window.masterVersion) {
            const cmpVersions = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
            if (cmpVersions(displayVersion, window.masterVersion) < 0) {
                versionBadge = ' <span class="lic-badge free" style="font-size:9px; background:var(--danger-glow); color:#fff; border-color:var(--danger)">Desatualizado</span>';
            } else {
                versionBadge = ' <span class="lic-badge pro" style="font-size:9px;">Atualizado</span>';
            }
        }

        return `<tr>
            ${statusCol}
            <td>${nameCell}</td>
            <td><span class="client-ip">${escH(displayIp||'ΓÇö')}</span></td>
            <td>
                <span style="font-family:monospace;font-size:11px;color:var(--text-secondary)">${escH(displayVersion||'ΓÇö')}</span>
                ${versionBadge}
            </td>
            <td>${licBadgeHtml(displayStatus)}</td>
            <td><span style="font-size:11px;color:var(--text-muted)">${lastSeen}</span></td>
            <td style="width:1%; white-space:nowrap;">${actions}</td>
        </tr>`;
    }).join('');
        setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 10);
}

// ===== HANDLERS DE BOT├òES (usam cache ΓÇö sem JSON em onclick) =====
function handleManageClient(btn) {
    const cacheId = btn.getAttribute('data-cache-id');
    const c = sessionCache[cacheId];
    if (!c) { showToast('Dados do cliente n├úo encontrados', 'error'); return; }

    openManageClientModal(c);
}

function handleEditLicense(btn) {
    const key = btn.getAttribute('data-lic-key');
    const lic = licenseCache[key];
    if (!lic) { showToast('Dados da licen├ºa n├úo encontrados', 'error'); return; }
    openAddLicenseModal(key, lic);
}

function handleRevokeLicense(btn) {
    const key = btn.getAttribute('data-lic-key');
    if (!key) return;
    revokeLicense(key);
}

function filterClients() {
    const q = (document.getElementById('client-search')?.value || '').toLowerCase();
    const filtered = allClients.filter(c =>
        (c.name||'').toLowerCase().includes(q) ||
        (c.hostname||'').toLowerCase().includes(q) ||
        (c.ip||'').toLowerCase().includes(q)
    );
    renderClientsTable('clients-tbody', filtered, true);
}

function filterClientsPage() {
    const q = (document.getElementById('clients-search2')?.value || '').toLowerCase();
    const filtered = allClients.filter(c =>
        (c.name||'').toLowerCase().includes(q) ||
        (c.hostname||'').toLowerCase().includes(q) ||
        (c.ip||'').toLowerCase().includes(q)
    );
    renderClientsTable('clients-full-tbody', filtered, false);
}

function renderClientsPage() {
    renderClientsTable('clients-full-tbody', allClients, false);
}

// ===== NOVOS HANDLERS (Clientes Manuais / M├║ltiplas Licen├ºas) =====
// ===== M├üSCARAS E VALIDA├ç├òES =====
function maskPhone(el) {
    let v = el.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 10) {
        v = v.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (v.length > 5) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})/, '($1) $2');
    } else if (v.length > 0) {
        v = v.replace(/^(\d*)/, '($1');
    }
    el.value = v;
}

function maskDocument(el) {
    let v = el.value.replace(/\D/g, '');
    if (v.length > 14) v = v.slice(0, 14);
    if (v.length > 11) {
        // CNPJ
        v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
    } else {
        // CPF
        v = v.replace(/^(\d{3})(\d{3})(\d{3})(\d{0,2}).*/, function(match, p1, p2, p3, p4) {
            let res = p1;
            if (p2) res += '.' + p2;
            if (p3) res += '.' + p3;
            if (p4) res += '-' + p4;
            return res;
        });
    }
    el.value = v;
}

function isValidCPF(cpf) {
    cpf = cpf.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let sum = 0, rest;
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i-1, i)) * (11 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cpf.substring(9, 10))) return false;
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i-1, i)) * (12 - i);
    rest = (sum * 10) % 11;
    if ((rest === 10) || (rest === 11)) rest = 0;
    if (rest !== parseInt(cpf.substring(10, 11))) return false;
    return true;
}

function isValidCNPJ(cnpj) {
    cnpj = cnpj.replace(/\D/g, '');
    if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    let digits = cnpj.substring(size);
    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result != digits.charAt(1)) return false;
    return true;
}

function validateDocument(doc) {
    const raw = doc.replace(/\D/g, '');
    if (!raw) return true;
    if (raw.length === 11) return isValidCPF(raw);
    if (raw.length === 14) return isValidCNPJ(raw);
    return false;
}

function openCreateClientModal() {
    document.getElementById('new-client-name').value = '';
    document.getElementById('new-client-ip').value = '';
    document.getElementById('new-client-hostname').value = '';
    document.getElementById('new-client-phone').value = '';
    document.getElementById('new-client-document').value = '';
    document.getElementById('new-client-email').value = '';
    document.getElementById('new-client-address').value = '';
    document.getElementById('new-client-notes').value = '';
    openModal('modal-client');
}

async function saveNewClient() {
    const name = document.getElementById('new-client-name').value.trim();
    const ip = document.getElementById('new-client-ip').value.trim();
    const hostname = document.getElementById('new-client-hostname').value.trim();
    const phone = document.getElementById('new-client-phone').value.trim();
    const documentStr = document.getElementById('new-client-document').value.trim();
    const email = document.getElementById('new-client-email').value.trim();
    const address = document.getElementById('new-client-address').value.trim();
    const notes = document.getElementById('new-client-notes').value.trim();

    if (!name) return showToast('O nome do cliente ├⌐ obrigat├│rio', 'error');
    if (documentStr && !validateDocument(documentStr)) return showToast('CPF ou CNPJ inv├ílido', 'error');

    try {
        const res = await masterFetch(`${MASTER_API}/system/clients`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, ip, hostname, phone, document: documentStr, email, address, notes })
        });
        if (res.ok) {
            showToast('Cliente cadastrado!', 'success');
            closeModal('modal-client');
            loadActiveSessions();
        } else {
            const d = await res.json();
            showToast(d.error || 'Erro ao cadastrar', 'error');
        }
    } catch(e) { showToast('Erro', 'error'); }
}

function switchClientTab(tabId) {
    document.querySelectorAll('.client-tab').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.client-tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-btn-${tabId}`).classList.add('active');
    document.getElementById(`tab-content-${tabId}`).classList.add('active');
}

function openManageClientModal(client) {
    document.getElementById('manage-client-id').value = client.id;
    document.getElementById('manage-client-name').value = client.name || '';
    document.getElementById('manage-client-ip').value = client.ip || '';
    document.getElementById('manage-client-hostname').value = client.hostname || '';

    const phoneInput = document.getElementById('manage-client-phone');
    phoneInput.value = client.phone || '';
    maskPhone(phoneInput);

    const docInput = document.getElementById('manage-client-document');
    docInput.value = client.document || '';
    maskDocument(docInput);

    document.getElementById('manage-client-email').value = client.email || '';
    document.getElementById('manage-client-address').value = client.address || '';
    document.getElementById('manage-client-notes').value = client.notes || '';

    switchClientTab('data');
    openModal('modal-manage-client');
    loadClientLicenses(client.id);
}

async function openDeleteClientConfirm() {
    const id = document.getElementById('manage-client-id').value;
    const name = document.getElementById('manage-client-name').value || id;

    document.getElementById('delete-client-id').value = id;
    document.getElementById('delete-client-name-display').textContent = name;
    document.getElementById('delete-client-ban').checked = false;

    const warning = document.getElementById('delete-client-license-warning');
    warning.style.display = 'none';

    try {
        const res = await masterFetch(`${MASTER_API}/system/clients/${id}/licenses`);
        if (res.ok) {
            const lics = await res.json();
            if (lics.length > 0) {
                document.getElementById('delete-client-license-warning-text').textContent =
                    `Este cliente tem ${lics.length} licen├ºa(s) vinculada(s). Elas tamb├⌐m ser├úo removidas.`;
                warning.style.display = 'block';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        }
    } catch(e) {}

    openModal('modal-delete-client');
}

async function executeDeleteClient() {
    const id = document.getElementById('delete-client-id').value;
    const ban = document.getElementById('delete-client-ban').checked;
    if (!id) return;

    const btn = document.querySelector('[data-action="executeDeleteClient"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Excluindo...'; }

    try {
        const url = `${MASTER_API}/system/clients/${id}${ban ? '?ban=true' : ''}`;
        const res = await masterFetch(url, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            closeModal('modal-delete-client');
            closeModal('modal-manage-client');
            const msg = data.licenses_removed > 0
                ? `Cliente exclu├¡do. ${data.licenses_removed} licen├ºa(s) removida(s).`
                : 'Cliente exclu├¡do com sucesso.';
            showToast(msg, 'success');
            loadActiveSessions();
        } else {
            showToast(data.error || 'Erro ao excluir cliente', 'error');
        }
    } catch(e) {
        showToast('Erro de conex├úo', 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Sim, excluir'; }
    }
}

async function executeBanClientStandalone() {
    const id = document.getElementById('manage-client-id').value;
    const name = document.getElementById('manage-client-name').value || id;
    if (!id) return;
    
    // Procura os HWIDs do cliente para confirmar
    const client = allClients.find(c => c.id === id);
    if (!client || !client.hwids || client.hwids.length === 0) {
        alert('Este cliente não possui HWIDs registrados para bloquear.');
        return;
    }

    if (!confirm(`Tem certeza que deseja bloquear todos os HWIDs do cliente "${name}"? Ele será desconectado e impedido de usar o sistema.`)) return;

    try {
        let successCount = 0;
        for (const hwid of client.hwids) {
            const res = await masterFetch(`${MASTER_API}/system/blacklist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hwid, clientName: name })
            });
            if (res.ok) successCount++;
        }
        
        if (successCount > 0) {
            showToast(`${successCount} HWID(s) adicionados à lista de bloqueio.`);
            closeModal('modal-manage-client');
            loadActiveSessions(); // Atualiza a lista para remover o cliente caso ele deslogue
            loadBlacklist(); // Atualiza a tabela da blacklist
        } else {
            alert('Falha ao bloquear os HWIDs.');
        }
    } catch (e) {
        alert('Erro de rede ao bloquear o cliente.');
    }
}

async function updateClient() {
    const id = document.getElementById('manage-client-id').value;
    const name = document.getElementById('manage-client-name').value.trim();
    const ip = document.getElementById('manage-client-ip').value.trim();
    const hostname = document.getElementById('manage-client-hostname').value.trim();
    const phone = document.getElementById('manage-client-phone').value.trim();
    const documentStr = document.getElementById('manage-client-document').value.trim();
    const email = document.getElementById('manage-client-email').value.trim();
    const address = document.getElementById('manage-client-address').value.trim();
    const notes = document.getElementById('manage-client-notes').value.trim();

    if (!name) return showToast('O nome do cliente ├⌐ obrigat├│rio', 'error');
    if (documentStr && !validateDocument(documentStr)) return showToast('CPF ou CNPJ inv├ílido', 'error');

    try {
        const res = await masterFetch(`${MASTER_API}/system/clients/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, ip, hostname, phone, document: documentStr, email, address, notes })
        });
        if (res.ok) {
            showToast('Cliente atualizado!', 'success');
            closeModal('modal-manage-client');
            loadActiveSessions();
        } else {
            const d = await res.json();
            showToast(d.error || 'Erro ao atualizar', 'error');
        }
    } catch(e) { showToast('Erro de conex├úo', 'error'); }
}

async function loadClientLicenses(clientId) {
    const tbody = document.getElementById('client-licenses-tbody');
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Carregando...</div></td></tr>';
    try {
        const res = await masterFetch(`${MASTER_API}/system/clients/${clientId}/licenses`);
        if (!res.ok) throw new Error();
        const lics = await res.json();
        if (!lics.length) {
            tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Nenhuma licen├ºa vinculada.</div></td></tr>';
            return;
        }
        tbody.innerHTML = lics.map(l => {
            const isVit = l.modelo_cobranca === 'vitalicio';
            const hasSupport = l.suporte_ativo !== undefined ? l.suporte_ativo : true;
            const suppBadge = hasSupport ? '<span style="font-size:10px; background:rgba(16,185,129,0.15); color:var(--success); padding:2px 6px; border-radius:4px; border:1px solid rgba(16,185,129,0.2);">CTI Ativo</span>' : '<span style="font-size:10px; background:rgba(239,68,68,0.15); color:var(--danger); padding:2px 6px; border-radius:4px; border:1px solid rgba(239,68,68,0.2);">Sem CTI</span>';
            const nodesBadge = l.extra_nodes ? `<span style="font-size:10px; background:rgba(255,255,255,0.05); color:var(--text-muted); padding:2px 6px; border-radius:4px; border:1px solid rgba(255,255,255,0.1);">+${l.extra_nodes} N├│(s)</span>` : '';
            const addOnsDisplay = `<div style="display:flex; gap: 6px; margin-top: 8px; flex-wrap:wrap;">${suppBadge} ${nodesBadge}</div>`;
            
            const statusDisplay = isVit 
                ? `<span class="status-badge active" style="background:var(--amber-400);color:#000;">Vital├¡cia</span>${addOnsDisplay}` 
                : `<span class="status-badge ${l.status==='active'?'active':'inactive'}">${l.status === 'active' ? 'Recorrente (Ativa)' : 'Inativa'}</span>${addOnsDisplay}`;
            
            let actions;
            
            if (isVit) {
                actions = `<div style="display:flex;gap:4px;align-items:center;">
                    <button class="action-btn manage" title="Transferir HWID" style="padding:4px 8px;" data-action="openTransferHWIDModal" data-arg1="${l.key}" data-arg2="${l.hwid || ''}"><i data-lucide="arrow-right-left" style="width:14px;height:14px;"></i></button>
                    <button class="action-btn manage" title="Hist├│rico" style="padding:4px 8px;" data-action="openLicenseHistoryModal" data-target="${l.key}"><i data-lucide="history" style="width:14px;height:14px;"></i></button>
                    <button class="action-btn remove" title="Remover" style="padding:4px 8px;" data-action="revokeClientLicense" data-lic="${l.key}" data-client="${clientId}"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button>
                </div>`;
            } else {
                actions = `<div style="display:flex;gap:4px;align-items:center;"><button class="action-btn remove" title="Remover" style="padding:4px 8px;" data-action="revokeClientLicense" data-lic="${l.key}" data-client="${clientId}"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button></div>`;
            }

            return `<tr>
                <td style="font-family:monospace; font-size:11px; white-space:nowrap; letter-spacing:-0.3px;">${l.key}</td>
                <td>${licBadgeHtml(l.type)}</td>
                <td>${statusDisplay}</td>
                <td style="width:1%; white-space:nowrap;">${actions}</td>
            </tr>`;
        }).join('');
        setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 10);
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Erro ao carregar licen├ºas.</div></td></tr>';
    }
}

function openTransferHWIDModal(key, currentHwid) {
    document.getElementById('transfer-lic-key').value = key;
    document.getElementById('transfer-old-hwid').value = currentHwid || 'Nenhum dispositivo vinculado';
    document.getElementById('transfer-new-hwid').value = '';
    openModal('modal-transfer-hwid');
}

async function confirmTransferHWID() {
    const key = document.getElementById('transfer-lic-key').value;
    const newHwid = document.getElementById('transfer-new-hwid').value.trim();
    if (!newHwid) return showToast('Novo HWID ├⌐ obrigat├│rio', 'error');

    try {
        const res = await masterFetch(`${MASTER_API}/system/licenses/${key}/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_hwid: newHwid })
        });
        if (res.ok) {
            showToast('Transfer├¬ncia realizada com sucesso!', 'success');
            closeModal('modal-transfer-hwid');
            const clientId = document.getElementById('manage-client-id').value;
            if (clientId) loadClientLicenses(clientId);
            loadActiveSessions();
        } else {
            const d = await res.json();
            showToast(d.error || 'Erro na transfer├¬ncia', 'error');
        }
    } catch(e) {
        showToast('Erro de conex├úo', 'error');
    }
}

async function openLicenseHistoryModal(key) {
    const container = document.getElementById('license-history-container');
    container.innerHTML = '<div class="empty-state">Carregando hist├│rico...</div>';
    openModal('modal-license-history');

    try {
        const res = await masterFetch(`${MASTER_API}/system/licenses-db`);
        if (!res.ok) throw new Error();
        const db = await res.json();
        const lic = db[key];
        
        if (!lic || !lic.history || lic.history.length === 0) {
            container.innerHTML = '<div class="empty-state">Nenhum hist├│rico encontrado para esta licen├ºa.</div>';
            return;
        }

        container.innerHTML = lic.history.map(h => {
            const date = new Date(h.date).toLocaleString('pt-BR');
            let text = '';
            let icon = '';
            if (h.action === 'created') {
                text = `Licen├ºa vital├¡cia criada.`;
                icon = '<i data-lucide="plus-circle" style="width:14px;color:var(--emerald-400)"></i>';
            } else if (h.action === 'transfer_hwid') {
                text = `HWID transferido de <b>${h.old_hwid || 'Nenhum'}</b> para <b>${h.new_hwid}</b>.`;
                icon = '<i data-lucide="cpu" style="width:14px;color:var(--amber-400)"></i>';
            } else {
                text = `A├º├úo: ${h.action}`;
                icon = '<i data-lucide="info" style="width:14px;color:var(--sky-400)"></i>';
            }

            return `<div style="padding: 10px; border: 1px solid var(--surface-border); border-radius: 6px; background: var(--bg-secondary);">
                <div style="display:flex; justify-content:space-between; margin-bottom: 6px; font-size: 11px; color: var(--text-muted);">
                    <span style="display:flex; gap: 4px; align-items:center;">${icon} ${date}</span>
                    <span>Admin: ${h.admin}</span>
                </div>
                <div style="font-size: 13px; color: var(--text-primary);">${text}</div>
            </div>`;
        }).reverse().join('');
        lucide.createIcons();
    } catch(e) {
        container.innerHTML = '<div class="empty-state">Erro ao carregar hist├│rico.</div>';
    }
}

function openAddLicenseToClientModal() {
    const clientId = document.getElementById('manage-client-id').value;
    const clientName = document.getElementById('manage-client-name').value;
    
    document.getElementById('lic-key').value = '';
    const licClientInput = document.getElementById('lic-client');
    licClientInput.value = clientName;
    licClientInput.setAttribute('data-client-id', clientId);
    licClientInput.readOnly = true; // Prevents changing the client name when linking directly
    document.getElementById('lic-hwid').value = '';
    document.getElementById('lic-expiry').value = '';
    
    const modObj = document.getElementById('lic-modelo');
    if (modObj) {
        modObj.value = 'recorrente';
        document.getElementById('lic-expiry-container').style.display = 'block';
    }
    
    openModal('modal-license');
}

// ===== LICEN├çAS =====
async function loadLicenses() {
    const tbody = document.getElementById('licenses-tbody');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="master-spinner"></div></div></td></tr>`;
    try {
        const res = await masterFetch(`${MASTER_API}/system/licenses-db`);
        if (!res.ok) throw new Error('Erro ao buscar licen├ºas (status ' + res.status + ')');
        allLicenses = await res.json();
        const entries = Object.entries(allLicenses);
        if (!entries.length) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Nenhuma licen├ºa cadastrada.</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = entries.map(([key, lic]) => {
            const isExpired = lic.expiry && lic.expiry !== 'never' && new Date() > new Date(lic.expiry);
            const statusBadge = isExpired
                ? `<span class="lic-badge free">Expirado</span>`
                : (lic.valid || lic.status === 'active')
                    ? `<span class="lic-badge pro" style="color:var(--emerald-400);background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.25)">Ativa</span>`
                    : `<span class="lic-badge free">Inativa</span>`;

            // Guarda no cache para os bot├╡es acessarem sem JSON no onclick
            licenseCache[key] = lic;

            return `<tr>
                <td><code style="font-size:10px;color:var(--violet-300)">${escH(key)}</code></td>
                <td><strong>${escH(lic.client||'ΓÇö')}</strong></td>
                <td>${licBadgeHtml(lic.type)}</td>
                <td><span style="font-family:monospace;font-size:10px;color:var(--text-muted)">${escH(lic.hwid ? lic.hwid.slice(0,16)+'...' : 'ΓÇö')}</span></td>
                <td><span style="font-size:11px;">${formatDate(lic.expiry || lic.expires_at)}</span></td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display:flex;gap:4px;">
                        <button class="action-btn manage" data-lic-key="${escH(key)}" data-action="handleEditLicense">Editar</button>
                        <button class="action-btn revoke" data-lic-key="${escH(key)}" data-action="handleRevokeLicense">Revogar</button>
                    </div>
                </td>
            </tr>`;
        }).join('');
        setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 10);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><p>Erro ao carregar licen├ºas: ${escH(e.message)}</p></div></td></tr>`;
    }
}

async function saveLicense() {
    const key    = document.getElementById('lic-key').value.trim();
    const client = document.getElementById('lic-client').value.trim();
    const type   = document.getElementById('lic-type').value;
    const expiry = document.getElementById('lic-expiry').value || 'never';
    const hwid   = document.getElementById('lic-hwid').value.trim();

    if (!key || !client) { showToast('Chave e Nome s├úo obrigat├│rios', 'error'); return; }

    try {
        // L├¬ o DB atual, atualiza a entrada e salva tudo de volta
        const getRes = await masterFetch(`${MASTER_API}/system/licenses-db`);
        if (!getRes.ok) throw new Error('Falha ao carregar DB de licen├ºas');
        const db = await getRes.json();

        const clientIdInput = document.getElementById('lic-client');
        const clientId = clientIdInput.getAttribute('data-client-id');
        
        const modeloInput = document.getElementById('lic-modelo');
        const modelo = modeloInput ? modeloInput.value : 'recorrente';
        const isVit = modelo === 'vitalicio';
        
        const history = db[key]?.history || [];
        if (!db[key]) {
            history.push({
                action: 'created',
                date: new Date().toISOString(),
                admin: 'admin' // No painel JS client-side assumimos admin
            });
        }

        const licSuporteObj = document.getElementById('lic-suporte-ativo');
        const suporte_ativo = licSuporteObj ? licSuporteObj.checked : true;
        
        const licExtraObj = document.getElementById('lic-extra-nodes');
        const extra_nodes = licExtraObj ? parseInt(licExtraObj.value, 10) || 0 : 0;

        db[key] = {
            ...(db[key] || {}),
            client_id: clientId || db[key]?.client_id || undefined,
            client,
            type,
            modelo_cobranca: modelo,
            price_paid: isVit ? (db[key]?.price_paid || 1997.00) : undefined,
            extra_nodes: isVit ? extra_nodes : undefined,
            suporte_ativo: isVit ? suporte_ativo : undefined,
            hwid: hwid || undefined,
            expiry: isVit ? 'never' : (expiry === 'never' ? 'never' : expiry),
            valid: true,
            status: 'active',
            history: history,
            features: getFeatCheckboxes()  // l├¬ os checkboxes do modal
        };
        
        if (isVit) {
            db[key].expires_at = 'never';
        } else if (!db[key].expires_at && expiry !== 'never') {
            db[key].expires_at = expiry;
        }

        if (!hwid) delete db[key].hwid;

        const saveRes = await masterFetch(`${MASTER_API}/system/licenses-db`, {
            method: 'POST',
            body: JSON.stringify(db)
        });
        if (saveRes.ok) {
            showToast('Licen├ºa salva com sucesso!', 'success');
            closeModal('modal-license');
            loadLicenses();
            const currentClientId = document.getElementById('manage-client-id')?.value;
            if (currentClientId) loadClientLicenses(currentClientId);
        } else {
            const d = await saveRes.json();
            showToast(d.error || 'Erro ao salvar', 'error');
        }
    } catch (e) {
        showToast('Erro de conex├úo: ' + e.message, 'error');
    }
}

async function revokeLicense(key) {
    if (!confirm(`Revogar licen├ºa "${key}"?`)) return;
    try {
        const getRes = await masterFetch(`${MASTER_API}/system/licenses-db`);
        if (!getRes.ok) throw new Error('Falha ao carregar DB');
        const db = await getRes.json();
        delete db[key];
        const saveRes = await masterFetch(`${MASTER_API}/system/licenses-db`, {
            method: 'POST',
            body: JSON.stringify(db)
        });
        if (saveRes.ok) { 
            showToast('Licen├ºa revogada!', 'success'); 
            loadLicenses(); 
            const currentClientId = document.getElementById('manage-client-id')?.value;
            if (currentClientId) loadClientLicenses(currentClientId);
        } else {
            showToast('Erro ao revogar', 'error');
        }
    } catch (e) {
        showToast('Erro: ' + e.message, 'error');
    }
}

// ===== USU├üRIOS =====
async function loadUsers() {
    const container = document.getElementById('users-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state"><div class="master-spinner"></div></div>';
    try {
        const res = await masterFetch(`${MASTER_API}/users`);
        if (!res.ok) throw new Error('Sem permiss├úo');
        const users = await res.json();
        const entries = Object.entries(users);
        if (!entries.length) {
            container.innerHTML = '<div class="empty-state"><p>Nenhum usu├írio cadastrado.</p></div>';
            return;
        }
        container.innerHTML = `<table class="clients-table">
            <thead><tr><th>Usu├írio</th><th>Nome</th><th>Permiss├úo</th><th>A├º├╡es</th></tr></thead>
            <tbody>${entries.map(([uid, u]) => `<tr>
                <td><strong>${escH(uid)}</strong></td>
                <td>${escH(u.name||'ΓÇö')}</td>
                <td>${u.role === 'admin'
                    ? '<span class="lic-badge pro">Admin</span>'
                    : '<span class="lic-badge free">Operador</span>'}</td>
                <td><button class="action-btn revoke" data-action="deleteUser" data-target="${escH(uid)}"><i data-lucide="trash-2" style="width:14px;height:14px;"></i></button></td>
            </tr>`).join('')}</tbody>
        </table>`;
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><p>Erro: ${escH(e.message)}</p></div>`;
    }
}

async function saveUser() {
    const name = document.getElementById('new-user-name').value.trim();
    const pass = document.getElementById('new-user-pass').value;
    const role = document.getElementById('new-user-role').value;
    if (!name || !pass) { showToast('Preencha todos os campos', 'error'); return; }
    try {
        const res = await masterFetch(`${MASTER_API}/users`, {
            method: 'POST',
            body: JSON.stringify({ user: name, pass, role, name })
        });
        if (res.ok) { showToast('Usu├írio criado!', 'success'); closeModal('modal-user'); loadUsers(); }
        else { const d = await res.json(); showToast(d.error || 'Erro ao criar usu├írio', 'error'); }
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

async function deleteUser(uid) {
    if (!confirm(`Remover usu├írio "${uid}"?`)) return;
    try {
        const res = await masterFetch(`${MASTER_API}/users/${encodeURIComponent(uid)}`, { method: 'DELETE' });
        if (res.ok) { showToast('Usu├írio removido!', 'success'); loadUsers(); }
        else showToast('Erro ao remover', 'error');
    } catch (e) { showToast('Erro: ' + e.message, 'error'); }
}

// ===== GR├üFICO DE RECEITA =====
function renderRevenueSection() {
    updateMetrics();
    const pro   = allSessions.filter(s => s.status === 'pro').length;
    const lite  = allSessions.filter(s => s.status === 'pro-lite').length;
    const trial = allSessions.filter(s => s.status === 'pro-trial').length;
    const free  = allSessions.filter(s => !s.status || s.status === 'free').length;

    const ctx = document.getElementById('revenue-chart');
    if (!ctx) return;
    if (revenueChart) revenueChart.destroy();

    revenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['PRO Elite', 'PRO Lite', 'Trial', 'FREE'],
            datasets: [{
                label: 'Clientes',
                data: [pro, lite, trial, free],
                backgroundColor: [
                    'rgba(124,58,237,0.7)',
                    'rgba(245,158,11,0.7)',
                    'rgba(56,189,248,0.6)',
                    'rgba(95,93,138,0.4)',
                ],
                borderColor: [
                    'rgba(124,58,237,1)',
                    'rgba(245,158,11,1)',
                    'rgba(56,189,248,0.8)',
                    'rgba(95,93,138,0.6)',
                ],
                borderWidth: 1,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#12122e',
                    borderColor: 'rgba(124,58,237,0.4)',
                    borderWidth: 1,
                    titleColor: '#f1f0ff',
                    bodyColor: '#a5a3c8',
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#a5a3c8', font: { size: 11 } } },
                y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#a5a3c8', font: { size: 11 }, stepSize: 1 } }
            }
        }
    });
}

// ===== PLANOS & PROMO├ç├âO =====
let promoCountdownInterval = null;

async function loadPlans() {
    try {
        const res = await masterFetch(`${MASTER_API}/system/pricing`);
        if (!res.ok) throw new Error('Erro ao carregar planos');
        const p = await res.json();

        // PRO
        const proPrice = p.pro?.price || '';
        const proStripe = p.pro?.stripe_price || '';
        document.getElementById('plan-pro-price').value  = proPrice;
        document.getElementById('plan-pro-stripe').value = proStripe;

        // PRO Lite
        const litePrice = p.pro_lite?.price || '';
        const liteStripe = p.pro_lite?.stripe_price || '';
        const liteBtn = p.pro_lite?.action_label || '';
        document.getElementById('plan-lite-price').value  = litePrice;
        document.getElementById('plan-lite-stripe').value = liteStripe;
        document.getElementById('plan-lite-btn').value    = liteBtn;

        // Promo
        const promo = p.promo || {};
        document.getElementById('promo-badge').value          = promo.badge_text || '';
        document.getElementById('promo-old-price').value      = promo.old_price_text || '';
        document.getElementById('promo-new-price').value      = promo.new_price_text || '';
        document.getElementById('promo-monthly-btn').value    = promo.monthly_btn_text || '';
        document.getElementById('promo-monthly-stripe').value = promo.monthly_stripe_price || '';
        document.getElementById('promo-annual-btn').value     = promo.annual_btn_text || '';
        document.getElementById('promo-annual-stripe').value  = promo.annual_stripe_price || '';
        document.getElementById('promo-end-date').value       = promo.end_date ? promo.end_date.slice(0,16) : '';

        // Inicia countdown se tiver data
        startPromoCountdown(promo.end_date);

        showToast('Planos carregados!', 'info');
    } catch (e) {
        showToast('Erro ao carregar planos: ' + e.message, 'error');
    }
}

async function savePlans() {
    try {
        const db = {
            pro: {
                price:        document.getElementById('plan-pro-price').value.trim(),
                stripe_price: parseInt(document.getElementById('plan-pro-stripe').value) || 0,
            },
            pro_lite: {
                price:        document.getElementById('plan-lite-price').value.trim(),
                stripe_price: parseInt(document.getElementById('plan-lite-stripe').value) || 0,
                action_label: document.getElementById('plan-lite-btn').value.trim(),
                badge:        'VIA DOA├ç├âO Γ¥ñ',
                period:       'm├¬s',
            },
            promo: {
                badge_text:           document.getElementById('promo-badge').value.trim(),
                old_price_text:       document.getElementById('promo-old-price').value.trim(),
                new_price_text:       document.getElementById('promo-new-price').value.trim(),
                monthly_btn_text:     document.getElementById('promo-monthly-btn').value.trim(),
                monthly_stripe_price: parseInt(document.getElementById('promo-monthly-stripe').value) || 0,
                annual_btn_text:      document.getElementById('promo-annual-btn').value.trim(),
                annual_stripe_price:  parseInt(document.getElementById('promo-annual-stripe').value) || 0,
                end_date:             document.getElementById('promo-end-date').value || '',
            }
        };

        const res = await masterFetch(`${MASTER_API}/system/pricing-admin`, {
            method: 'POST',
            body: JSON.stringify(db)
        });
        if (res.ok) {
            showToast('Planos e promo├º├úo salvos!', 'success');
            startPromoCountdown(db.promo.end_date);
        } else {
            const d = await res.json();
            showToast(d.error || 'Erro ao salvar', 'error');
        }
    } catch (e) {
        showToast('Erro: ' + e.message, 'error');
    }
}

function startPromoCountdown(endDateStr) {
    if (promoCountdownInterval) clearInterval(promoCountdownInterval);
    const el = document.getElementById('promo-countdown');
    if (!el) return;

    if (!endDateStr) { el.innerText = ''; return; }

    const endDate = new Date(endDateStr);
    if (isNaN(endDate.getTime())) { el.innerText = ''; return; }

    function tick() {
        const diff = endDate - Date.now();
        if (diff <= 0) {
            el.innerText = 'ΓÅ░ ENCERRADA';
            clearInterval(promoCountdownInterval);
            return;
        }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.innerText = `ΓÅ▒ ${d}d ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    tick();
    promoCountdownInterval = setInterval(tick, 1000);
}

// ===== TELA DE LOGIN EMBUTIDA =====
function showLoginScreen(errorMsg = '') {
    // Se o overlay j├í existe, apenas atualiza o estado para n├úo apagar a senha do usu├írio
    const existing = document.getElementById('master-login-overlay');
    if (existing) {
        const errorDiv = document.getElementById('login-error-msg');
        if (errorDiv) {
            if (errorMsg) {
                errorDiv.style.display = 'block';
                errorDiv.innerHTML = escH(errorMsg);
            } else {
                errorDiv.style.display = 'none';
                errorDiv.innerHTML = '';
            }
        }
        const btn = document.getElementById('login-btn');
        if (btn) {
            btn.innerText = 'Entrar no Master HQ';
            btn.disabled = false;
        }
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'master-login-overlay';
    overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        background: var(--bg-void);
    `;
    overlay.innerHTML = `
        <div style="
            background: var(--bg-card);
            border: 1px solid var(--border-active);
            border-radius: 20px;
            width: 380px;
            max-width: 95vw;
            overflow: hidden;
            box-shadow: 0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(124,58,237,0.2);
            animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1);
        ">
            <div style="
                padding: 28px 28px 20px;
                background: linear-gradient(135deg, rgba(124,58,237,0.15), rgba(245,158,11,0.05));
                border-bottom: 1px solid var(--border-subtle);
                text-align: center;
            ">
                <div style="
                    width: 52px; height: 52px;
                    background: linear-gradient(135deg, var(--violet-600), var(--violet-800));
                    border-radius: 14px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 24px; margin: 0 auto 14px;
                    box-shadow: 0 0 30px rgba(124,58,237,0.4);
                ">Γ¼í</div>
                <div style="font-size:18px;font-weight:800;color:var(--text-primary)">SENTINEL</div>
                <div style="
                    display:inline-flex;align-items:center;gap:5px;
                    margin-top:6px;padding:3px 12px;
                    background:rgba(245,158,11,0.15);
                    border:1px solid var(--border-amber);
                    border-radius:20px;font-size:10px;font-weight:700;
                    color:var(--amber-400);letter-spacing:1px;
                ">≡ƒöÉ MASTER HQ</div>
            </div>
            <div style="padding: 24px 28px;">
                <div id="login-error-msg" style="
                    display: ${errorMsg ? 'block' : 'none'};
                    margin-bottom:16px;padding:10px 14px;
                    background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);
                    border-radius:8px;font-size:12px;color:#f87171;
                ">${errorMsg ? escH(errorMsg) : ''}</div>
                <div style="margin-bottom:14px;">
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Usu├írio</label>
                    <input id="login-user" type="text" autocomplete="username" placeholder="Seu usu├írio" style="
                        width:100%;background:var(--bg-surface);border:1px solid var(--border-subtle);
                        border-radius:8px;padding:10px 14px;color:var(--text-primary);
                        font-size:13px;font-family:inherit;outline:none;
                        transition:border-color 0.2s;
                    "  >
                </div>
                <div style="margin-bottom:20px;">
                    <label style="display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Senha</label>
                    <input id="login-pass" type="password" autocomplete="current-password" placeholder="Sua senha" style="
                        width:100%;background:var(--bg-surface);border:1px solid var(--border-subtle);
                        border-radius:8px;padding:10px 14px;color:var(--text-primary);
                        font-size:13px;font-family:inherit;outline:none;
                        transition:border-color 0.2s;
                    "  
                    data-action-key="Enter-doMasterLogin">
                </div>
                <button id="login-btn" data-action="doMasterLogin" style="
                    width:100%;padding:11px;background:var(--violet-600);
                    border:1px solid var(--violet-500);border-radius:8px;
                    color:#fff;font-size:13px;font-weight:700;
                    cursor:pointer;font-family:inherit;
                    box-shadow:0 0 20px rgba(124,58,237,0.3);
                    transition:all 0.2s;
                " data-hover-bg="var(--violet-500)" data-out-bg="var(--violet-600)">
                    Entrar no Master HQ
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => { const u = document.getElementById('login-user'); if (u) u.focus(); }, 100);
}

function showNotMasterError() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:var(--bg-void);';
    overlay.innerHTML = `
        <div style="text-align:center;padding:40px;">
            <div style="font-size:48px;margin-bottom:16px;">≡ƒöÆ</div>
            <div style="font-size:20px;font-weight:800;color:var(--text-primary);margin-bottom:8px;">Acesso Negado</div>
            <div style="font-size:13px;color:var(--text-muted);margin-bottom:24px;">Este servidor n├úo ├⌐ um Master ou o token HMAC ├⌐ inv├ílido.</div>
            <a href="/" style="padding:10px 24px;background:var(--violet-600);border-radius:8px;color:#fff;text-decoration:none;font-weight:600;">Voltar ao DNS</a>
        </div>`;
    document.body.appendChild(overlay);
}

async function doMasterLogin() {
    const user = document.getElementById('login-user')?.value.trim();
    const pass = document.getElementById('login-pass')?.value;
    const btn  = document.getElementById('login-btn');
    if (!user || !pass) { showLoginScreen('Preencha usu├írio e senha.'); return; }

    if (btn) { btn.innerText = 'Verificando...'; btn.disabled = true; }

    try {
        const headers = { 'Content-Type': 'application/json' };
        const csrfToken = getCookie('sentinel_csrf');
        if (csrfToken) {
            headers['x-csrf-token'] = csrfToken;
        }

        const res = await fetch(`${MASTER_API}/login`, {
            method: 'POST',
            credentials: 'include',
            headers: headers,
            body: JSON.stringify({ user, pass })
        });
        
        if (res.ok) {
            const ok = await verifyMasterAndInit();
            if (ok) {
                // Login bem-sucedido ΓÇö carrega o dashboard
                await loadPricingData();
                await Promise.all([loadVersion(), loadMasterLicense(), loadActiveSessions(), loadBlacklist()]);
                pollInterval = setInterval(loadActiveSessions, 15000);
            } else {
                showLoginScreen('Voc├¬ n├úo tem permiss├╡es Master.');
            }
        } else {
            showLoginScreen('Usu├írio ou senha inv├ílidos.');
        }
    } catch (e) {
        showLoginScreen('Erro de conex├úo com o servidor.');
    }
}

// ===== AUTENTICA├ç├âO =====
// checkAuth was removed, verifyMasterAndInit verifies auth remotely

// ===== INICIALIZA├ç├âO =====
async function initMasterDashboard() {
    // Inicia part├¡culas e ├¡cones sempre (aparecem no login tamb├⌐m)
    initMasterParticles();
    if (window.lucide) lucide.createIcons();

    const ok = await verifyMasterAndInit();
    if (!ok) return; // verifyMasterAndInit j├í trata erros

    // Carrega pre├ºos PRIMEIRO para que updateMetrics() use valores corretos
    await loadPricingData();

    // Demais carregamentos em paralelo
    await Promise.all([
        loadVersion(),
        loadMasterLicense(),
        loadActiveSessions(),
        loadBlacklist(),
    ]);

    // Polling a cada 15s
    pollInterval = setInterval(loadActiveSessions, 15000);
}

// Inicializa ao carregar
document.addEventListener('DOMContentLoaded', initMasterDashboard);

// ===== ALERTAS =====
async function loadAlerts() {
    const container = document.getElementById('alerts-list');
    if (!container) return;
    container.innerHTML = '<div class="empty-state"><div class="master-spinner"></div></div>';
    try {
        const res = await masterFetch(`${MASTER_API}/system/log-violation`);
        if (!res.ok) throw new Error('Falha ao buscar alertas');
        const logs = await res.json();
        
        if (!logs || logs.length === 0) {
            container.innerHTML = `<div class="empty-state"><i data-lucide="bell-off"></i><p>Nenhum alerta de seguran├ºa no momento.</p></div>`;
            if (window.lucide) window.lucide.createIcons();
            return;
        }

        let html = `<table class="clients-table">
            <thead>
                <tr>
                    <th style="width: 150px">Data/Hora</th>
                    <th style="width: 150px">Endere├ºo IP</th>
                    <th>Tipo de Viola├º├úo</th>
                </tr>
            </thead>
            <tbody>`;
            
        logs.forEach(log => {
            const date = new Date(log.time);
            const timeStr = date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second:'2-digit' });
            html += `<tr>
                <td style="color:var(--text-muted)">${timeStr}</td>
                <td style="font-family:monospace; color:var(--text-primary)">${escH(log.ip)}</td>
                <td style="color:var(--rose-400); font-weight:500;">
                    <i data-lucide="alert-triangle" style="width:14px;height:14px;vertical-align:middle;margin-right:4px;"></i>
                    ${escH(log.type)}
                </td>
            </tr>`;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
        if (window.lucide) window.lucide.createIcons();
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><p>Erro ao carregar alertas: ${escH(e.message)}</p></div>`;
    }
}


// ===== GLOBAL EVENT DELEGATION (CSP COMPLIANT) =====
document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', (e) => {
        if (e.target.hasAttribute('data-modal-overlay')) {
            const modalId = e.target.getAttribute('data-modal-overlay');
            if (typeof closeModal === 'function') closeModal(modalId);
            return;
        }

        const btn = e.target.closest('[data-action], [data-href]');
        if (!btn) return;

        if (btn.hasAttribute('data-href')) {
            window.location.href = btn.getAttribute('data-href');
            return;
        }

        const action = btn.getAttribute('data-action');
        const target = btn.getAttribute('data-target');
        
        switch (action) {
            case 'toggleNOCMode': if (typeof toggleNOCMode === 'function') toggleNOCMode(); break;
            case 'showMasterSection': if (typeof showMasterSection === 'function') showMasterSection(target, btn); break;
            case 'loadActiveSessions': if (typeof loadActiveSessions === 'function') loadActiveSessions(); break;
            case 'openAddLicenseModal': if (typeof openAddLicenseModal === 'function') openAddLicenseModal(); break;
            case 'openCreateClientModal': if (typeof openCreateClientModal === 'function') openCreateClientModal(); break;
            case 'openAddUserModal': if (typeof openAddUserModal === 'function') openAddUserModal(); break;
            case 'loadPlans': if (typeof loadPlans === 'function') loadPlans(); break;
            case 'savePlans': if (typeof savePlans === 'function') savePlans(); break;
            case 'closeModal': if (typeof closeModal === 'function') closeModal(target); break;
            case 'generateLicenseKey': if (typeof generateLicenseKey === 'function') generateLicenseKey(); break;
            case 'setFeaturePreset': if (typeof setFeaturePreset === 'function') setFeaturePreset(target); break;
            case 'saveLicense': if (typeof saveLicense === 'function') saveLicense(); break;
            case 'saveUser': if (typeof saveUser === 'function') saveUser(); break;
            case 'confirmTransferHWID': if (typeof confirmTransferHWID === 'function') confirmTransferHWID(); break;
            case 'saveNewClient': if (typeof saveNewClient === 'function') saveNewClient(); break;
            case 'switchClientTab': if (typeof switchClientTab === 'function') switchClientTab(target); break;
            case 'updateClient': if (typeof updateClient === 'function') updateClient(); break;
            case 'openDeleteClientConfirm': if (typeof openDeleteClientConfirm === 'function') openDeleteClientConfirm(); break;
            case 'executeDeleteClient': if (typeof executeDeleteClient === 'function') executeDeleteClient(); break;
            case 'openAddLicenseToClientModal': if (typeof openAddLicenseToClientModal === 'function') openAddLicenseToClientModal(); break;
            case 'doMasterLogin': if (typeof doMasterLogin === 'function') doMasterLogin(); break;
            case 'handleManageClient': if (typeof handleManageClient === 'function') handleManageClient(btn); break;
            case 'openTransferHWIDModal': 
                if (typeof openTransferHWIDModal === 'function') openTransferHWIDModal(btn.getAttribute('data-arg1'), btn.getAttribute('data-arg2')); 
                break;
            case 'openLicenseHistoryModal': if (typeof openLicenseHistoryModal === 'function') openLicenseHistoryModal(target); break;
            case 'revokeClientLicense': 
                if (typeof revokeLicense === 'function') {
                    revokeLicense(btn.getAttribute('data-lic'));
                    setTimeout(() => { if (typeof loadClientLicenses === 'function') loadClientLicenses(btn.getAttribute('data-client')); }, 500);
                }
                break;
            case 'handleEditLicense': if (typeof handleEditLicense === 'function') handleEditLicense(btn); break;
            case 'handleRevokeLicense': if (typeof handleRevokeLicense === 'function') handleRevokeLicense(btn); break;
            case 'deleteUser': if (typeof deleteUser === 'function') deleteUser(target); break;
            case 'unbanClient': if (typeof unbanClient === 'function') unbanClient(btn.getAttribute('data-hwid')); break;
        }
    });

    document.body.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-hover-bg]');
        if (target) {
            target.dataset.originalBg = target.style.background || '';
            target.style.background = target.getAttribute('data-hover-bg');
        }
    });
    document.body.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-out-bg]');
        if (target) {
            target.style.background = target.getAttribute('data-out-bg');
        }
    });
    
    document.body.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const target = e.target.closest('[data-action-key="Enter-doMasterLogin"]');
            if (target && typeof doMasterLogin === 'function') doMasterLogin();
        }
    });

    const licModelo = document.getElementById('lic-modelo');
    if (licModelo) {
        licModelo.addEventListener('change', function() {
            applyLicenseBusinessRules(false);
        });
    }

    // Bind master.html inputs events
    const clientSearch = document.getElementById('client-search');
    if (clientSearch) clientSearch.addEventListener('input', () => { if (typeof filterClients === 'function') filterClients(); });

    const clientsSearch2 = document.getElementById('clients-search2');
    if (clientsSearch2) clientsSearch2.addEventListener('input', () => { if (typeof filterClientsPage === 'function') filterClientsPage(); });

    const newClientDoc = document.getElementById('new-client-document');
    if (newClientDoc) newClientDoc.addEventListener('input', (e) => { if (typeof maskDocument === 'function') maskDocument(e.target); });

    const newClientPhone = document.getElementById('new-client-phone');
    if (newClientPhone) newClientPhone.addEventListener('input', (e) => { if (typeof maskPhone === 'function') maskPhone(e.target); });

    const manageClientDoc = document.getElementById('manage-client-document');
    if (manageClientDoc) manageClientDoc.addEventListener('input', (e) => { if (typeof maskDocument === 'function') maskDocument(e.target); });

    const manageClientPhone = document.getElementById('manage-client-phone');
    if (manageClientPhone) manageClientPhone.addEventListener('input', (e) => { if (typeof maskPhone === 'function') maskPhone(e.target); });
});
