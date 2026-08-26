const API_BASE = '/api';
let charts = {};
// let authCredentials is removed as it's handled by HttpOnly cookie
let authCredentials = ''; // Fix ReferenceErrors without breaking syntax

// ===== UTILITÁRIOS DE SEGURANÇA =====
function escapeHTML(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// ===== PARTICLE BACKGROUND =====
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const count = 70;
    const particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.5 + 0.5
    }));

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(56,189,248,0.6)';
            ctx.fill();
        });
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 130) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(56,189,248,${0.18 * (1 - dist/130)})`;
                    ctx.lineWidth = 0.6;
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(draw);
    }
    draw();
}
initParticles();

// ===== ANIMATED COUNTER =====
function animateValue(el, newText) {
    if (!el) return;
    const oldText = el.innerText;
    if (oldText === newText) return;

    // Try numeric animation
    const newNum = parseFloat(newText.replace(/[^0-9.]/g, ''));
    const oldNum = parseFloat(oldText.replace(/[^0-9.]/g, ''));
    const suffix = newText.replace(/[0-9.,]/g, '');

    if (!isNaN(newNum) && !isNaN(oldNum) && Math.abs(newNum - oldNum) > 0) {
        const start = performance.now();
        const duration = 500;
        const isFloat = newText.includes('.');
        function step(now) {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            const val = oldNum + (newNum - oldNum) * ease;
            el.innerText = isFloat
                ? val.toFixed(1) + suffix
                : Math.round(val).toLocaleString('pt-BR') + suffix;
            if (t < 1) requestAnimationFrame(step);
            else el.innerText = newText;
        }
        requestAnimationFrame(step);
    } else {
        el.innerText = newText;
    }

    el.classList.remove('updated');
    void el.offsetWidth; // trigger reflow
    el.classList.add('updated');
    setTimeout(() => el.classList.remove('updated'), 600);
}

// Filtro global de ameaças e persistência de estado
window.currentThreatFilter = 'ALL';

function applyActiveFilterStyles(filter) {
    const buttons = document.querySelectorAll('.btn-filter');
    if (!buttons || buttons.length === 0) return;
    
    buttons.forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = btn.id === 'btn-filter-all' ? '#94a3b8' : 
                          (btn.id === 'btn-filter-critical' ? '#f43f5e' : 
                          (btn.id === 'btn-filter-suspicious' ? '#fbbf24' : 
                          (btn.id === 'btn-filter-dnssec' ? '#10b981' : '#38bdf8')));
        btn.style.boxShadow = 'none';
    });

    const activeBtn = document.getElementById(`btn-filter-${filter.toLowerCase()}`);
    if (activeBtn) {
        if (filter === 'ALL') {
            activeBtn.style.background = 'rgba(255, 255, 255, 0.08)';
            activeBtn.style.color = '#ffffff';
        } else if (filter === 'CRITICAL') {
            activeBtn.style.background = 'rgba(244, 63, 94, 0.15)';
            activeBtn.style.color = '#f43f5e';
            activeBtn.style.boxShadow = '0 0 10px rgba(244, 63, 94, 0.2)';
        } else if (filter === 'SUSPICIOUS') {
            activeBtn.style.background = 'rgba(251, 191, 36, 0.15)';
            activeBtn.style.color = '#fbbf24';
            activeBtn.style.boxShadow = '0 0 10px rgba(251, 191, 36, 0.2)';
        } else if (filter === 'DNSSEC') {
            activeBtn.style.background = 'rgba(16, 185, 129, 0.15)';
            activeBtn.style.color = '#10b981';
            activeBtn.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.2)';
        } else if (filter === 'BLOCKED') {
            activeBtn.style.background = 'rgba(56, 189, 248, 0.15)';
            activeBtn.style.color = '#38bdf8';
            activeBtn.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.2)';
        }
    }
}

window.filterThreats = function(filter) {
    window.currentThreatFilter = filter;
    applyActiveFilterStyles(filter);
    updateSecurityThreats();
};

async function updateSecurityThreats() {
    if (typeof currentFeatures !== 'undefined' && currentFeatures && !currentFeatures.cti) {
        return;
    }
    try {
        const response = await apiFetch('/api/security/threats');
        const data = await response.json();
        
        // Obter referências seguras com fallbacks para evitar erros se a API retornar dados incompletos e filtrar endereços loopback
        const alerts = (data.alerts || []).filter(a => a.ip !== '127.0.0.1' && a.ip !== '::1' && a.ip !== 'localhost');
        const suspects = data.topSuspects || [];
        
        window.latestThreats = alerts;
        if (window.sentinelGlobe) {
            updateGlobeArcs();
        }

        const criticalEl = document.getElementById('total-critical-threats');
        const suspiciousEl = document.getElementById('total-suspicious-threats');
        const monitoredEl = document.getElementById('total-monitored-ips');
        
        if (!criticalEl || !suspiciousEl || !monitoredEl) return;

        const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
        const suspiciousCount = alerts.filter(a => a.severity === 'SUSPICIOUS').length;
        const monitoredCount = data.totalActiveIPs || suspects.length;

        // Atualiza na aba de Segurança
        if (criticalEl) criticalEl.innerText = criticalCount;
        if (suspiciousEl) suspiciousEl.innerText = suspiciousCount;
        if (monitoredEl) monitoredEl.innerText = monitoredCount;

        // Atualiza na aba Dashboard Principal (Novos Cards)
        const dCritical = document.getElementById('total-critical-threats-dash');
        const dSuspicious = document.getElementById('total-suspicious-threats-dash');
        const dMonitored = document.getElementById('total-monitored-ips-dash');
        const dAnablock = document.getElementById('total-anablock-dash');

        if (dCritical) dCritical.innerText = criticalCount;
        if (dSuspicious) dSuspicious.innerText = suspiciousCount;
        if (dMonitored) dMonitored.innerText = monitoredCount;

        if (dAnablock) {
            try {
                const anaRes = await apiFetch(`${API_BASE}/anablock/status`);
                if (anaRes.ok) {
                    const anaData = await anaRes.json();
                    if (anaData.enabled) {
                        dAnablock.innerText = anaData.domainCount ? anaData.domainCount.toLocaleString('pt-BR') : 'ATIVO';
                        dAnablock.style.color = '#34d399';
                    } else {
                        dAnablock.innerText = 'DESATIVADO';
                        dAnablock.style.color = '#94a3b8';
                    }
                }
            } catch(e){}
        }

        const alertsList = document.getElementById('security-alerts-list');
        const activeFilter = window.currentThreatFilter || 'ALL';

        if (alertsList) {
            const filteredAlerts = activeFilter === 'ALL'
                ? alerts
                : alerts.filter(a => a.severity && a.severity.toUpperCase() === activeFilter.toUpperCase());

            if (filteredAlerts.length === 0) {
                alertsList.innerHTML = `<div style="text-align:center; padding:3rem; opacity:0.3; grid-column: span 2;">Nenhuma interceptação do tipo [${activeFilter === 'ALL' ? 'TODOS' : activeFilter}] detectada nas últimas 2h.</div>`;
            } else {
                alertsList.innerHTML = filteredAlerts.map(alert => `
                    <div class="threat-item">
                        <div class="threat-icon ${alert.severity ? alert.severity.toLowerCase() : 'suspicious'}">
                            <i data-lucide="${alert.severity === 'CRITICAL' ? 'shield-x' : (alert.severity === 'DNSSEC' ? 'shield-alert' : (alert.severity === 'BLOCKED' ? 'shield-off' : 'alert-triangle'))}"></i>
                        </div>
                        <div class="threat-details">
                            <div class="threat-domain">${escapeHTML(alert.domain)} <span class="badge-threat ${alert.severity ? alert.severity.toLowerCase() : 'suspicious'}">${alert.severity && alert.severity.toUpperCase() === 'CRITICAL' ? 'CRÍTICO' : (alert.severity && alert.severity.toUpperCase() === 'SUSPICIOUS' ? 'SUSPEITO' : (alert.severity && alert.severity.toUpperCase() === 'BLOCKED' ? 'BLOQUEADO' : (alert.severity && alert.severity.toUpperCase() === 'DNSSEC' ? 'DNSSEC' : (alert.severity || 'SUSPEITO'))))}</span></div>
                            <div class="threat-ip">Origem: ${escapeHTML(alert.ip)}${alert.reason ? ` | Falha: <span style="color:var(--accent-warning);">${escapeHTML(alert.reason)}</span>` : ''}</div>
                        </div>
                        <div class="threat-actions" style="display:flex;gap:6px;">
                            <button data-action="enrich" data-domain="${escapeHTML(alert.domain)}" data-ip="${escapeHTML(alert.ip || '')}" class="btn-action" title="Enriquecer: Geolocalização + VirusTotal" style="background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;">
                                <i data-lucide="search" style="width: 14px; height: 14px;"></i>
                            </button>
                            ${alert.severity === 'BLOCKED' ? `
                                <button class="btn-action success" disabled title="Domínio já bloqueado permanentemente na Blacklist" style="opacity: 0.6; cursor: not-allowed; background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">
                                    <i data-lucide="check" style="width: 14px; height: 14px;"></i>
                                </button>
                            ` : `
                                <button data-action="block" data-domain="${escapeHTML(alert.domain)}" class="btn-action danger" title="Bloquear permanentemente na Blacklist (NXDOMAIN)">
                                    <i data-lucide="ban" style="width: 14px; height: 14px;"></i>
                                </button>
                            `}
                        </div>
                        <div class="threat-time">${alert.time}</div>
                    </div>
                `).join('');

                // Acoplamento seguro de eventos sem onclick interpolado (previne DOM XSS)
                alertsList.querySelectorAll('button[data-action="enrich"]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const domain = btn.getAttribute('data-domain');
                        const ip = btn.getAttribute('data-ip');
                        openEnrichModal(domain, ip);
                    });
                });

                alertsList.querySelectorAll('button[data-action="block"]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const domain = btn.getAttribute('data-domain');
                        blockThreatDomain(domain);
                    });
                });
            }
        }

        // --- NOVA PARTE: CONSULTAS BLOQUEADAS (BLACKLIST) ---
        try {
            const blockedRes = await apiFetch('/api/security/blocked');
            const blockedData = await blockedRes.json();
            
            const manualBlocksEl = document.getElementById('total-manual-blocks');
            const manualBlocksDashEl = document.getElementById('total-manual-blocks-dash');
            
            const blockedQueries = (blockedData && blockedData.blockedQueries) ? blockedData.blockedQueries : [];
            
            if (manualBlocksEl) manualBlocksEl.innerText = blockedQueries.length;
            if (manualBlocksDashEl) manualBlocksDashEl.innerText = blockedQueries.length;

            const blockedList = document.getElementById('blocked-queries-list');
            if (blockedList) {
                if (blockedQueries.length === 0) {
                    blockedList.innerHTML = '<div style="text-align:center; padding:2rem; opacity:0.3; grid-column: span 2;">Nenhum bloqueio manual detectado nas últimas 2h...</div>';
                } else {
                    blockedList.innerHTML = blockedQueries.map(q => `
                        <div class="threat-item" style="border-left: 3px solid var(--accent-danger); background: rgba(244, 63, 94, 0.05);">
                            <div class="threat-icon critical">
                                <i data-lucide="shield-off"></i>
                            </div>
                            <div class="threat-details">
                                <div class="threat-domain" style="color: #f43f5e;">${escapeHTML(q.domain)} <span class="badge-threat critical">BLOQUEADO</span></div>
                                <div class="threat-ip">Tentativa de: ${escapeHTML(q.ip)}</div>
                            </div>
                            <div class="threat-time">${q.time}</div>
                        </div>
                    `).join('');
                }
            }
        } catch (e) {
            console.error('Erro ao buscar consultas bloqueadas:', e);
        }

        // Aplica estilo ativo do filtro atualizado para manter a consistência reativa
        applyActiveFilterStyles(activeFilter);

        // Nova Função de Bloqueio Rápido
        window.blockThreatDomain = async function(domain) {
            if (!confirm(`Deseja adicionar o domínio '${domain}' na BLACKLIST permanente do servidor?`)) return;
            try {
                const res = await apiFetch('/api/security/blacklist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ domain })
                });
                if (res.ok) {
                    alert(`✅ Sucesso! O domínio ${domain} foi bloqueado em toda a rede.`);
                    updateSecurityThreats(); // Atualiza a lista imediatamente
                } else {
                    alert(`❌ Falha ao bloquear ${domain}.`);
                }
            } catch (e) {
                alert('Erro de autenticação. Faça login como admin.');
            }
        };

        const suspectsList = document.getElementById('security-suspects-list');
        if (suspectsList) {
            if (suspects.length === 0) {
                suspectsList.innerHTML = `<div style="text-align:center; padding:2rem; opacity:0.35; font-size:0.75rem;">Aguardando telemetria...</div>`;
            } else {
                suspectsList.innerHTML = suspects.map(s => `
                    <div class="bar-item">
                        <div class="bar-info">
                            <span class="bar-label">${s.ip}</span>
                            <span class="bar-value">${s.count} reqs (${s.uniqueDomains || 1} domínios)</span>
                        </div>
                        <div class="bar-bg">
                            <div class="bar-fill danger" style="width: ${Math.min(100, (s.count / 10) * 100)}%"></div>
                        </div>
                    </div>
                `).join('');
            }
        }

        if (window.lucide) lucide.createIcons();
        updateCTISources(); // Carrega as fontes OSINT também
    } catch (error) {
        console.error('Erro ao buscar ameaças:', error);
    }
}

window.updateCTISources = async function() {
    try {
        const res = await apiFetch('/api/security/sources');
        const sources = await res.json();
        const container = document.getElementById('cti-sources-list');
        if (!container) return;

        container.innerHTML = sources.map(s => `
            <div class="source-item" style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="flex: 1;">
                    <div style="font-size: 0.8rem; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px;">
                        ${s.name} <span class="badge-threat" style="background: rgba(14, 165, 233, 0.15); color: #0ea5e9; font-size: 0.6rem; padding: 1px 5px;">${s.category}</span>
                    </div>
                    <div style="font-size: 0.65rem; color: #64748b; margin-top: 2px;">${s.description}</div>
                </div>
                <label class="switch" style="transform: scale(0.75);">
                    <input type="checkbox" ${s.monitor ? 'checked' : ''} onchange="toggleCTISourceMonitor('${s.id}')">
                    <span class="slider"></span>
                </label>
            </div>
        `).join('');
    } catch (e) {
        console.error('Erro ao carregar fontes CTI:', e);
    }
};

window.toggleCTISource = async function(id) {
    try {
        await apiFetch(`/api/security/sources/${id}/toggle`, { method: 'POST' });
    } catch (e) {
        alert('Erro ao alterar fonte.');
    }
};

window.toggleCTISourceMonitor = async function(id) {
    try {
        await apiFetch(`/api/security/sources/${id}/toggle-monitor`, { method: 'POST' });
    } catch (e) {
        alert('Erro ao alterar monitoramento da fonte.');
    }
};

async function syncCTI() {
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="refresh-cw" class="spin" style="width: 14px; height: 14px;"></i>';
    if (window.lucide) lucide.createIcons();

    try {
        await apiFetch('/api/security/sync', { method: 'POST' });
        alert('Sincronização OSINT iniciada! Isso pode levar alguns segundos.');
    } catch (e) {
        alert('Erro ao iniciar sincronização.');
    } finally {
        setTimeout(() => {
            btn.innerHTML = originalContent;
            if (window.lucide) lucide.createIcons();
        }, 2000);
    }
}

// ===== CTI ENRICHMENT MODAL =====
function flagEmoji(code) {
    if (!code || code === '--' || code === '?') return '🌐';
    const cleanCode = code.toUpperCase().trim();
    if (cleanCode.length !== 2) return '🌐';
    const lowerCode = cleanCode.toLowerCase();
    return `<img src="https://flagcdn.com/w20/${lowerCode}.png" srcset="https://flagcdn.com/w40/${lowerCode}.png 2x" width="20" alt="${cleanCode}" style="vertical-align: middle; border-radius: 2px; margin-right: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.15); display: inline-block;">`;
}

async function openEnrichModal(domain, ip) {
    const modal = document.getElementById('enrich-modal');
    const titleEl = document.getElementById('enrich-domain-title');
    const geoBody = document.getElementById('enrich-geo-body');
    const vtBody = document.getElementById('enrich-vt-body');
    const vtLink = document.getElementById('enrich-vt-link');

    titleEl.textContent = domain;
    vtLink.style.display = 'none';
    geoBody.innerHTML = `<div style="display:flex;gap:10px;align-items:center;color:#64748b;font-size:0.85rem;"><i data-lucide="loader" style="width:16px;height:16px;" class="spin"></i> Consultando IP...</div>`;
    vtBody.innerHTML = `<div style="display:flex;gap:10px;align-items:center;color:#64748b;font-size:0.85rem;"><i data-lucide="loader" style="width:16px;height:16px;" class="spin"></i> Consultando VirusTotal...</div>`;
    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();

    // --- GEO / ASN ---
    if (ip && ip !== '--' && ip !== '?' && !/[a-zA-Z]/.test(ip.replace(/^[0-9.:]+$/, ''))) {
        try {
            const geoRes = await apiFetch(`/api/enrich/geo?ip=${encodeURIComponent(ip)}`);
            const geo = await geoRes.json();
            if (geo.status === 'success') {
                geoBody.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:6px 12px; font-size:0.7rem; font-weight:700; color:#38bdf8; backdrop-filter:blur(10px); margin-bottom:1rem; width:fit-content; text-transform:uppercase; letter-spacing:0.5px;">
                        <span class="live-dot" style="display:inline-block; width:8px; height:8px; background:#0ea5e9; border-radius:50%; box-shadow:0 0 8px #0ea5e9;"></span>
                        <span>Provedor Ativo: ${geo.source || 'Desconhecido'}</span>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
                        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.85rem;">
                            <div style="font-size:0.65rem;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">País</div>
                            <div style="font-size:1rem;font-weight:700;color:#f1f5f9;">${flagEmoji(geo.countryCode)} ${geo.country || '--'}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.85rem;">
                            <div style="font-size:0.65rem;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Cidade / Região</div>
                            <div style="font-size:0.9rem;font-weight:600;color:#94a3b8;">${geo.city || '--'}, ${geo.regionName || '--'}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.85rem;">
                            <div style="font-size:0.65rem;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">ISP / Operadora</div>
                            <div style="font-size:0.8rem;font-weight:600;color:#94a3b8;word-break:break-all;">${geo.isp || '--'}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.85rem;">
                            <div style="font-size:0.65rem;color:#475569;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">ASN (Autonomous System)</div>
                            <div style="font-size:0.8rem;font-weight:600;color:#38bdf8;word-break:break-all;">${geo.as || '--'}</div>
                        </div>
                    </div>`;
            } else {
                geoBody.innerHTML = `<div style="color:#64748b;font-size:0.85rem;">⚠️ Não foi possível localizar o IP <strong>${ip}</strong> (IP privado ou reservado).</div>`;
            }
        } catch (e) {
            geoBody.innerHTML = `<div style="color:#f43f5e;font-size:0.85rem;">Erro ao consultar geolocalização.</div>`;
        }
    } else {
        geoBody.innerHTML = `<div style="color:#64748b;font-size:0.85rem;">Endereço IP não disponível para geolocalização.</div>`;
    }

    // --- VIRUSTOTAL ---
    try {
        const vtRes = await apiFetch(`/api/enrich/virustotal?domain=${encodeURIComponent(domain)}`);
        if (vtRes.status === 503) {
            vtBody.innerHTML = `<div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);border-radius:10px;padding:1rem;font-size:0.83rem;color:#fbbf24;">
                ⚠️ <strong>Chave da API não configurada.</strong><br>
                <span style="color:#94a3b8;">Adicione <code style="background:rgba(255,255,255,0.05);padding:1px 5px;border-radius:4px;">VIRUSTOTAL_API_KEY=sua_chave</code> no arquivo <strong>.env</strong> do servidor.<br>
                Chave gratuita em: <a href="https://www.virustotal.com" target="_blank" style="color:#38bdf8;">virustotal.com</a></span>
            </div>`;
            return;
        }
        const vt = await vtRes.json();
        if (vt.error) {
            vtBody.innerHTML = `<div style="color:#f43f5e;font-size:0.85rem;">Erro: ${vt.error}</div>`;
            return;
        }

        const scoreColor = vt.score >= 20 ? '#f43f5e' : (vt.score >= 5 ? '#fbbf24' : '#10b981');
        const scoreLabel = vt.score >= 20 ? 'ALTO RISCO' : (vt.score >= 5 ? 'SUSPEITO' : 'LIMPO');
        const scoreBg = vt.score >= 20 ? 'rgba(244,63,94,0.1)' : (vt.score >= 5 ? 'rgba(251,191,36,0.1)' : 'rgba(16,185,129,0.1)');

        vtBody.innerHTML = `
            <div style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
                <div style="background:${scoreBg};border:2px solid ${scoreColor};border-radius:14px;padding:1rem 1.5rem;text-align:center;min-width:110px;">
                    <div style="font-size:2rem;font-weight:900;color:${scoreColor};">${vt.malicious + vt.suspicious}</div>
                    <div style="font-size:0.6rem;font-weight:800;color:${scoreColor};letter-spacing:1px;">${scoreLabel}</div>
                    <div style="font-size:0.6rem;color:#64748b;margin-top:2px;">de ${vt.total} engines</div>
                </div>
                <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
                    <div style="background:rgba(244,63,94,0.07);border:1px solid rgba(244,63,94,0.2);border-radius:8px;padding:0.6rem;text-align:center;">
                        <div style="font-size:1.2rem;font-weight:800;color:#f43f5e;">${vt.malicious}</div>
                        <div style="font-size:0.6rem;color:#f43f5e;">Maliciosos</div>
                    </div>
                    <div style="background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.2);border-radius:8px;padding:0.6rem;text-align:center;">
                        <div style="font-size:1.2rem;font-weight:800;color:#fbbf24;">${vt.suspicious}</div>
                        <div style="font-size:0.6rem;color:#fbbf24;">Suspeitos</div>
                    </div>
                    <div style="background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.2);border-radius:8px;padding:0.6rem;text-align:center;">
                        <div style="font-size:1.2rem;font-weight:800;color:#10b981;">${vt.harmless}</div>
                        <div style="font-size:0.6rem;color:#10b981;">Limpos</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:0.6rem;text-align:center;">
                        <div style="font-size:1.2rem;font-weight:800;color:#64748b;">${vt.undetected}</div>
                        <div style="font-size:0.6rem;color:#64748b;">Sem detecção</div>
                    </div>
                </div>
            </div>
            <div style="margin-top:0.75rem;font-size:0.7rem;color:#475569;">⏱️ Última análise: ${vt.lastAnalysis} &nbsp;|&nbsp; Reputação VT: <span style="color:${vt.reputation >= 0 ? '#10b981':'#f43f5e'}">${vt.reputation}</span></div>`;

        vtLink.href = vt.vtLink;
        vtLink.style.display = 'inline-flex';
    } catch (e) {
        vtBody.innerHTML = `<div style="color:#f43f5e;font-size:0.85rem;">Erro ao consultar VirusTotal.</div>`;
    }

    if (window.lucide) lucide.createIcons();
}

const historySize = 60; // Sincronizado com o backend (10 min)
const history = {
    requests: Array(historySize).fill(0),
    net_rx: Array(historySize).fill(0),
    net_tx: Array(historySize).fill(0),
    cpu: Array(historySize).fill(0),
    mem: Array(historySize).fill(0),
    labels: Array(historySize).fill('')
};

const colors = {
    primary: '#0ea5e9',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    text: '#94a3b8'
};

// Auth Helpers
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

async function apiFetch(url, options = {}) {
    options.credentials = 'include';
    if (!options.headers) {
        options.headers = {};
    }
    // Se tem body e não tem Content-Type, injeta JSON automaticamente
    if (options.body && !options.headers['Content-Type']) {
        options.headers['Content-Type'] = 'application/json';
    }
    
    // Injeta Token CSRF para requisições de alteração de estado (POST/PUT/DELETE)
    if (['POST', 'PUT', 'DELETE'].includes(options.method?.toUpperCase())) {
        const csrfToken = getCookie('sentinel_csrf');
        if (csrfToken) {
            options.headers['x-csrf-token'] = csrfToken;
        }
    }
    
    const res = await fetch(url, options);
    if (res.status === 401) {
        window.location.href = '/login';
        throw new Error('Não autenticado');
    }
    return res;
}


// --- Funções de Recuperação de Senha por PIN ---
async function openRecoveryModal() {
    closeLogin();
    const modal = document.getElementById('recovery-modal');
    const codeDisplay = document.getElementById('recovery-code-display');
    const errorDiv = document.getElementById('recovery-error');
    const successDiv = document.getElementById('recovery-success');
    
    errorDiv.innerText = '';
    successDiv.style.display = 'none';
    codeDisplay.innerText = 'GERANDO...';
    
    if (modal) modal.classList.add('show');
    
    try {
        const res = await fetch(`${API_BASE}/auth/recovery-code`);
        if (res.ok) {
            const data = await res.json();
            codeDisplay.innerText = data.recoveryCode;
        } else {
            const err = await res.json();
            errorDiv.innerText = err.error || 'Erro ao gerar código.';
        }
    } catch (e) {
        errorDiv.innerText = 'Erro de conexão com o servidor.';
    }
}

function closeRecoveryModal() {
    const modal = document.getElementById('recovery-modal');
    if (modal) modal.classList.remove('show');
}

async function attemptRecovery() {
    const pin = document.getElementById('recovery-pin').value.trim();
    const newPass = document.getElementById('recovery-new-pass').value;
    const errorDiv = document.getElementById('recovery-error');
    const successDiv = document.getElementById('recovery-success');
    const btn = document.getElementById('btn-recovery-submit');
    
    errorDiv.innerText = '';
    successDiv.style.display = 'none';
    
    if (!pin || !newPass) {
        errorDiv.innerText = 'Preencha o PIN e a nova senha.';
        return;
    }
    
    btn.disabled = true;
    btn.innerText = 'AGUARDE...';
    
    try {
        const res = await fetch(`${API_BASE}/auth/recovery-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin, newPassword: newPass })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            successDiv.innerText = data.message;
            successDiv.style.display = 'block';
            setTimeout(() => {
                closeRecoveryModal();
                showLogin();
            }, 3000);
        } else {
            errorDiv.innerText = data.error || 'Erro ao redefinir a senha.';
        }
    } catch (e) {
        errorDiv.innerText = 'Erro de conexão com o servidor.';
    } finally {
        btn.disabled = false;
        btn.innerText = 'REDEFINIR SENHA';
    }
}
// --- Fim do Bloco de Recuperação ---

async function logout() {
    localStorage.removeItem('sentinel_user');
    await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = '/login';
}

function getUserRole() {
    try {
        const user = JSON.parse(localStorage.getItem('sentinel_user'));
        return user ? user.role : 'viewer';
    } catch (e) { return 'viewer'; }
}



function updateUIByRole() {
    const role = getUserRole();
    console.log(`[ACL] Aplicando permissões para cargo: ${role}`);

    // Aplica classe no body para controle global de CSS
    document.body.className = `role-${role}`;

    // Menu de Usuários (Admin Only)
    const menuUsers = document.getElementById('menu-users');
    if (menuUsers) menuUsers.style.display = (role === 'admin') ? 'flex' : 'none';

    // Seção de Configurações e Deploy (Admin/Operator)
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        el.style.display = (role === 'admin') ? '' : 'none';
    });

    const operatorElements = document.querySelectorAll('.operator-only');
    operatorElements.forEach(el => {
        el.style.display = (role === 'admin' || role === 'operator') ? '' : 'none';
    });
}

// ===== AUTO-UPDATER LOGIC =====
let pendingUpdateData = null;

function checkForSystemUpdate() {
    apiFetch(`${API_BASE}/system/check-update`)
        .then(res => res.json())
        .then(data => {
            pendingUpdateData = data;
            const btn = document.getElementById('btn-update-system');
            const versionEl = document.getElementById('system-version-display');
            if (versionEl) versionEl.innerText = `v${data.currentVersion}`;

            if (data.updateAvailable && btn) {
                // Só exibe o botão se o recurso de OTA estiver liberado no plano
                if (typeof currentFeatures !== 'undefined' && currentFeatures && currentFeatures.update) {
                    btn.style.display = 'flex';
                    btn.title = `Nova versão disponível: ${data.newVersion} (Atual: ${data.currentVersion})`;
                } else {
                    btn.style.display = 'none';
                }
            }
        })
        .catch(err => console.error('Update check failed:', err));
}

function startSystemUpdate() {
    if (typeof currentFeatures !== 'undefined' && currentFeatures && !currentFeatures.update) {
        alert("Atualizações remotas (OTA) são exclusivas para licenças PRO.");
        return;
    }
    if (!pendingUpdateData) return;
    
    const modal = document.getElementById('system-update-modal');
    if (!modal) return;
    
    document.getElementById('update-modal-versions-subtitle').innerText = `v${pendingUpdateData.currentVersion} ➔ v${pendingUpdateData.newVersion}`;
    
    const sourceEl = document.getElementById('update-modal-source');
    if (sourceEl) {
        sourceEl.innerText = pendingUpdateData.source === 'master' ? 'PC Master' : 'GitHub Oficial';
        sourceEl.style.color = pendingUpdateData.source === 'master' ? '#10b981' : '#38bdf8';
    }

    const changelogList = document.getElementById('update-modal-changelog-list');
    if (changelogList) {
        if (pendingUpdateData.changelog && Object.keys(pendingUpdateData.changelog).length > 0) {
            let html = '';
            // Ordena as versões decrescentemente
            const sortedVersions = Object.keys(pendingUpdateData.changelog).sort((a, b) => {
                return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' });
            });
            
            // Exibe as 4 versões mais recentes para manter o modal elegante
            const versionsToShow = sortedVersions.slice(0, 4);
            
            versionsToShow.forEach(ver => {
                const logs = pendingUpdateData.changelog[ver];
                const isNew = ver === `v${pendingUpdateData.newVersion}`;
                html += `
                    <div style="margin-bottom: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.6rem; text-align: left;">
                        <div style="font-weight: 800; color: #38bdf8; font-size: 0.8rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                            <span style="background: rgba(56,189,248,0.1); padding: 2px 6px; border-radius: 4px;">${ver}</span>
                            ${isNew ? '<span style="font-size: 0.68rem; color: #10b981; font-weight: 800; background: rgba(16,185,129,0.1); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(16,185,129,0.2);">★ ALVO DESTA ATUALIZAÇÃO</span>' : ''}
                        </div>
                        <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.78rem; color: #94a3b8; line-height: 1.5; display: flex; flex-direction: column; gap: 4px; list-style-type: disc;">
                            ${logs.map(log => `<li>${log}</li>`).join('')}
                        </ul>
                    </div>
                `;
            });
            changelogList.innerHTML = html;
        } else {
            changelogList.innerHTML = `
                <li style="list-style-type: none; text-align: center; color: #94a3b8; font-size: 0.82rem; padding: 10px 0;">
                    Melhorias de desempenho, correções gerais de segurança e estabilidade.
                </li>
            `;
        }
    }
    
    modal.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
}

function closeUpdateModal() {
    const modal = document.getElementById('system-update-modal');
    if (modal) modal.style.display = 'none';
}

async function executeSystemUpdate() {
    closeUpdateModal();
    
    const btn = document.getElementById('btn-update-system');
    if (btn) {
        btn.innerHTML = '<i data-lucide="loader" class="spin"></i> <span>Atualizando...</span>';
        btn.style.pointerEvents = 'none';
        btn.classList.remove('success');
        if (window.lucide) lucide.createIcons();
    }

    try {
        await apiFetch(`${API_BASE}/system/update`, { method: 'POST' });
        // Aguarda 10 segundos e força o recarregamento
        let countdown = 10;
        const interval = setInterval(() => {
            countdown--;
            if (btn) btn.innerHTML = `<i data-lucide="loader" class="spin"></i> <span>Reiniciando em ${countdown}s</span>`;
            if (countdown <= 0) {
                clearInterval(interval);
                location.reload();
            }
        }, 1000);
    } catch (e) {
        alert('Erro ao enviar comando de atualização.');
        if (btn) btn.style.display = 'none';
    }
}


// Initialize Charts
function initCharts() {
    const commonOptions = {
        chart: { 
            toolbar: { show: false }, 
            zoom: { enabled: false }, 
            foreColor: colors.text, 
            animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 1000 } }
        },
        stroke: { curve: 'smooth', width: 2 },
        grid: { borderColor: 'rgba(255,255,255,0.05)', strokeDashArray: 4 },
        dataLabels: { enabled: false },
        xaxis: { labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
        yaxis: { labels: { style: { colors: colors.text }, formatter: (v) => v.toFixed(1) } },
        tooltip: { theme: 'dark', y: { formatter: (v) => v.toFixed(2) + ' Mbps' } },
        theme: { mode: 'dark' }
    };

    const typeEl = document.querySelector("#typeChart");
    if (typeEl) {
        charts.type = new ApexCharts(typeEl, {
            ...commonOptions,
            chart: { ...commonOptions.chart, type: 'donut', height: 250 },
            series: [],
            labels: [],
            stroke: { show: false },
            plotOptions: { pie: { donut: { size: '75%' } } },
            tooltip: { theme: 'dark', y: { formatter: (v) => v.toLocaleString() } }
        });
    }

    const cacheEl = document.querySelector("#cacheEfficiencyChart");
    if (cacheEl) {
        charts.cacheEfficiency = new ApexCharts(cacheEl, {
            ...commonOptions,
            chart: { ...commonOptions.chart, type: 'donut', height: 250 },
            series: [],
            labels: ['Cache Hits', 'Recursivas (Internet)'],
            colors: [colors.success, colors.primary],
            stroke: { show: false },
            plotOptions: { pie: { donut: { size: '75%' } } },
            tooltip: { theme: 'dark', y: { formatter: (v) => v.toLocaleString() } }
        });
    }

    const latencyEl = document.querySelector("#latencyChart");
    if (latencyEl) {
        charts.latency = new ApexCharts(latencyEl, {
            ...commonOptions,
            chart: { ...commonOptions.chart, type: 'bar', height: 250 },
            series: [{ name: 'Consultas', data: [] }],
            colors: [colors.primary],
            plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
            tooltip: { theme: 'dark', y: { formatter: (v) => v.toLocaleString() } }
        });
    }

    const reqHistoryEl = document.querySelector("#requestHistoryChart");
    if (reqHistoryEl) {
        charts.reqHistory = new ApexCharts(reqHistoryEl, {
            ...commonOptions,
            chart: { ...commonOptions.chart, type: 'area', height: 250 },
            series: [{ name: 'TPS', data: history.requests }],
            colors: [colors.success],
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1 } },
            tooltip: { theme: 'dark', y: { formatter: (v) => v.toFixed(1) + ' tps' } }
        });
    }

    const netTrendEl = document.querySelector("#netTrendChart");
    if (netTrendEl) {
        charts.netTrend = new ApexCharts(netTrendEl, {
            ...commonOptions,
            chart: { ...commonOptions.chart, type: 'area', height: 180 },
            series: [
                { name: 'Download (RX)', data: history.net_rx },
                { name: 'Upload (TX)', data: history.net_tx }
            ],
            colors: [colors.primary, colors.warning],
            fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0 } }
        });
    }

    const rcodeEl = document.querySelector("#rcodeChart");
    if (rcodeEl) {
        charts.rcode = new ApexCharts(rcodeEl, {
            ...commonOptions,
            chart: { ...commonOptions.chart, type: 'donut', height: 180 },
            series: [],
            labels: ['Sucesso', 'NXDomain', 'ServFail', 'Recusado'],
            colors: [colors.success, colors.warning, colors.danger, colors.text],
            stroke: { show: false },
            tooltip: { theme: 'dark', y: { formatter: (v) => v.toLocaleString() } }
        });
    }

    const sysTrendEl = document.querySelector("#systemTrendChart");
    if (sysTrendEl) {
        charts.sysTrend = new ApexCharts(sysTrendEl, {
            ...commonOptions,
            chart: { ...commonOptions.chart, type: 'line', height: 180 },
            series: [
                { name: 'CPU', data: history.cpu },
                { name: 'RAM', data: history.mem }
            ],
            colors: [colors.danger, colors.primary],
            yaxis: { labels: { formatter: (v) => v.toFixed(0) + '%' } },
            tooltip: { theme: 'dark', y: { formatter: (v) => v.toFixed(1) + '%' } }
        });
    }



    const cpuFullEl = document.querySelector("#cpuFullChart");
    if (cpuFullEl) {
        charts.cpuFull = new ApexCharts(cpuFullEl, {
            ...commonOptions,
            chart: { ...commonOptions.chart, type: 'area', height: 200, sparkline: { enabled: true } },
            series: [{ name: 'CPU', data: history.cpu }],
            colors: [colors.danger]
        });
    }

    const memFullEl = document.querySelector("#memFullChart");
    if (memFullEl) {
        charts.memFull = new ApexCharts(memFullEl, {
            ...commonOptions,
            chart: { ...commonOptions.chart, type: 'area', height: 200, sparkline: { enabled: true } },
            series: [{ name: 'RAM', data: history.mem }],
            colors: [colors.primary]
        });
    }

    const benchEl = document.querySelector("#benchmarkChart");
    if (benchEl) {
        charts.benchmark = new ApexCharts(benchEl, {
            ...commonOptions,
            chart: { ...commonOptions.chart, type: 'bar', height: 400 },
            series: [{ name: 'Tempo de Resposta (ms)', data: [] }],
            colors: [colors.primary, colors.success, colors.warning],
            plotOptions: { bar: { distributed: true, borderRadius: 8, columnWidth: '50%' } },
            xaxis: { 
                labels: { show: true, style: { colors: colors.text, fontSize: '12px', fontWeight: 600 } },
                axisBorder: { show: true, color: 'rgba(255,255,255,0.1)' }
            },
            yaxis: { labels: { show: true, formatter: (v) => v.toFixed(0) + ' ms' } },
            tooltip: { y: { formatter: (v) => v.toFixed(1) + ' ms' } }
        });
    }

    Object.values(charts).forEach(c => c && c.render());
}

async function fetchStats() {
    try {
        const res = await apiFetch(`${API_BASE}/stats`);
        if (!res.ok) return;
        const data = await res.json();
        updateDashboard(data);
    } catch (err) { console.error('Stats fetch error:', err); }
}

async function fetchSystem() {
    try {
        const res = await apiFetch(`${API_BASE}/system`);
        if (!res.ok) return;
        const data = await res.json();
        updateSystem(data);
    } catch (err) { console.error('System fetch error:', err); }
}

async function fetchPricing() {
    try {
        const res = await apiFetch(`${API_BASE}/system/pricing`);
        if (!res.ok) return;
        const data = await res.json();
        
        // Free Plan
        if (data.free) {
            const badgeEl = document.getElementById('plan-free-badge');
            if (badgeEl) badgeEl.innerText = data.free.badge || 'Gratuito';
            
            const priceEl = document.getElementById('plan-free-price');
            if (priceEl) {
                priceEl.innerHTML = `${data.free.price || 'R$ 0,00'} <span style="font-size:0.8rem;color:#64748b;font-weight:normal;">/${data.free.period || 'sempre'}</span>`;
            }
        }
        
        // PRO Lite Plan
        if (data.pro_lite) {
            const badgeEl = document.getElementById('plan-pro-lite-floating-badge');
            if (badgeEl) badgeEl.innerText = data.pro_lite.badge || 'VIA DOAÇÃO ❤';
            
            const priceEl = document.getElementById('plan-pro-lite-price');
            if (priceEl) {
                priceEl.innerHTML = `${data.pro_lite.price || 'R$ 49,90'} <span style="font-size:0.8rem;color:#64748b;font-weight:normal;">/${data.pro_lite.period || 'mês'}</span>`;
            }
            
            const btnEl = document.getElementById('btn-plan-pro-lite');
            if (btnEl) btnEl.innerText = data.pro_lite.action_label || '❤ FAZER DOAÇÃO (PIX)';
        }
        
        // PRO Plan
        if (data.pro) {
            const badgeEl = document.getElementById('plan-pro-badge');
            if (badgeEl) badgeEl.innerText = data.pro.badge || 'Premium';
            
            const priceEl = document.getElementById('plan-pro-price');
            if (priceEl) {
                priceEl.innerHTML = `${data.pro.price || 'R$ 99,90'} <span style="font-size:0.8rem;color:#64748b;font-weight:normal;">/${data.pro.period || 'mês'}</span>`;
            }
            
            const btnEl = document.getElementById('btn-plan-pro');
            if (btnEl) btnEl.innerHTML = data.pro.action_label || '💳 ASSINAR PLANO';
        }

        // Promo Plan/Oferta
        if (data.promo) {
            const badgeEl = document.getElementById('promo-badge-display');
            if (badgeEl) badgeEl.innerText = data.promo.badge_text || '-40% OFF';

            const oldEl = document.getElementById('promo-old-display');
            if (oldEl) oldEl.innerText = data.promo.old_price_text || 'De R$ 50,00';

            const newEl = document.getElementById('promo-new-display');
            if (newEl) newEl.innerText = data.promo.new_price_text || 'Por apenas R$ 29,90';

            const btnMonthlySpan = document.querySelector('#btn-promo-monthly span');
            if (btnMonthlySpan) btnMonthlySpan.innerText = data.promo.monthly_btn_text || 'MENSAL (R$ 29,90)';

            const btnAnnualSpan = document.querySelector('#btn-promo-annual span');
            if (btnAnnualSpan) btnAnnualSpan.innerText = data.promo.annual_btn_text || 'ANUAL (R$ 299,00)';
            
            // Countdown timer
            if (data.promo.end_date) {
                const endTime = new Date(data.promo.end_date).getTime();
                if (!isNaN(endTime)) {
                    if (window.promoInterval) clearInterval(window.promoInterval);
                    
                    const updateCountdown = () => {
                        const now = new Date().getTime();
                        const distance = endTime - now;
                        
                        if (distance < 0) {
                            clearInterval(window.promoInterval);
                            const countdownEl = document.getElementById('promo-countdown');
                            if (countdownEl) countdownEl.innerHTML = 'Promoção Encerrada';
                            return;
                        }
                        
                        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
                        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
                        
                        const pad = (num) => String(num).padStart(2, '0');
                        
                        const countdownEl = document.getElementById('promo-countdown');
                        if (countdownEl) {
                            countdownEl.innerHTML = `
                                <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">${pad(days)}<span style="font-size:0.7rem;color:#64748b;display:block;">Dias</span></div>
                                <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">${pad(hours)}<span style="font-size:0.7rem;color:#64748b;display:block;">Horas</span></div>
                                <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">${pad(minutes)}<span style="font-size:0.7rem;color:#64748b;display:block;">Min</span></div>
                                <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">${pad(seconds)}<span style="font-size:0.7rem;color:#64748b;display:block;">Seg</span></div>
                            `;
                        }
                    };
                    updateCountdown();
                    window.promoInterval = setInterval(updateCountdown, 1000);
                }
            } else {
                if (window.promoInterval) {
                    clearInterval(window.promoInterval);
                    window.promoInterval = null;
                }
                const countdownEl = document.getElementById('promo-countdown');
                if (countdownEl) {
                    countdownEl.innerHTML = `
                        <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">00<span style="font-size:0.7rem;color:#64748b;display:block;">Dias</span></div>
                        <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">00<span style="font-size:0.7rem;color:#64748b;display:block;">Horas</span></div>
                        <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">00<span style="font-size:0.7rem;color:#64748b;display:block;">Min</span></div>
                        <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:8px;">00<span style="font-size:0.7rem;color:#64748b;display:block;">Seg</span></div>
                    `;
                }
            }
        }
    } catch (err) {
        console.error('Pricing fetch error:', err);
    }
}


async function fetchHistory() {
    try {
        const res = await apiFetch(`${API_BASE}/history`);
        if (!res.ok) return;
        const data = await res.json();
        
        const isFree = currentFeatures.isFree;
        const limit = isFree ? 10 : data.requests.length; 

        // Sincroniza o histórico local com o do backend
        history.requests = data.requests.slice(-limit);
        history.net_rx = data.net_rx.slice(-limit);
        history.net_tx = data.net_tx.slice(-limit);
        history.cpu = data.cpu.slice(-limit);
        history.mem = data.mem.slice(-limit);
        history.labels = data.labels.slice(-limit);

        // Atualiza os gráficos imediatamente
        if (charts.reqHistory) charts.reqHistory.updateSeries([{ name: 'TPS', data: history.requests }]);
        if (charts.netTrend) charts.netTrend.updateSeries([{ name: 'Download (RX)', data: history.net_rx }, { name: 'Upload (TX)', data: history.net_tx }]);
        if (charts.sysTrend) charts.sysTrend.updateSeries([{ name: 'CPU', data: history.cpu }, { name: 'RAM', data: history.mem }]);
        if (charts.cpuFull) charts.cpuFull.updateSeries([{ name: 'CPU', data: history.cpu }]);
        if (charts.memFull) charts.memFull.updateSeries([{ name: 'RAM', data: history.mem }]);
        
    } catch (err) { console.error('History fetch error:', err); }
}


function setInitialLoading() {
    const cards = document.querySelectorAll('.noc-value');
    cards.forEach(c => {
        c.classList.add('skeleton');
        c.style.minHeight = '1.5rem';
    });
}

function clearLoading() {
    const cards = document.querySelectorAll('.noc-value');
    cards.forEach(c => c.classList.remove('skeleton'));
}

let lastQueryCount = 0;
function updateDashboard(data) {
    if (!data) return;
    clearLoading();
    try {
        const queriesEl = document.getElementById('total-queries');
        if (queriesEl) animateValue(queriesEl, (data['total.num.queries'] || 0).toLocaleString('pt-BR'));
        
        const hitRateEl = document.getElementById('hit-rate');
        if (hitRateEl) {
            const totalHits = (data['total.num.cachehits'] || 0) + (data['num.query.subnet_cache'] || 0);
            const totalQueries = data['total.num.queries'] || 0;
            const hitRate = totalQueries > 0 ? ((totalHits / totalQueries) * 100).toFixed(1) : '0.0';
            animateValue(hitRateEl, `${isNaN(hitRate) ? 0 : hitRate}%`);
        }

        const missesEl = document.getElementById('total-misses');
        if (missesEl) animateValue(missesEl, (data['total.num.cachemiss'] || 0).toLocaleString('pt-BR'));
        
        const servfailEl = document.getElementById('total-servfail');
        if (servfailEl) animateValue(servfailEl, String(data['num.answer.rcode.SERVFAIL'] || 0));

        const ipv6Count = data['num.query.ipv6'] || 0;
        const totalQueries = data['total.num.queries'] || 0;
        const ipv4Count = Math.max(0, totalQueries - ipv6Count);

        const ipv4El = document.getElementById('ipv4-queries');
        if (ipv4El) animateValue(ipv4El, ipv4Count.toLocaleString('pt-BR'));

        const ipv6El = document.getElementById('ipv6-queries');
        if (ipv6El) animateValue(ipv6El, ipv6Count.toLocaleString('pt-BR'));

        const globeQueriesEl = document.getElementById('globe-queries');
        if (globeQueriesEl) animateValue(globeQueriesEl, totalQueries.toLocaleString('pt-BR'));




        const currentTotal = data['total.num.queries'] || 0;
        if (lastQueryCount > 0 && charts.reqHistory) {
            const tps = (currentTotal - lastQueryCount) / 10;
            history.requests.push(tps);
            history.requests.shift();
            charts.reqHistory.updateSeries([{ name: 'TPS', data: history.requests }]);
        }
        lastQueryCount = currentTotal;

        if (charts.type) {
            const types = [], counts = [];
            Object.keys(data).forEach(key => {
                if (key.startsWith('num.query.type.') && !['TYPE0', 'other', 'all'].some(s => key.endsWith(s))) {
                    if (data[key] > 0) {
                        types.push(key.replace('num.query.type.', ''));
                        counts.push(data[key]);
                    }
                }
            });
            charts.type.updateOptions({ labels: types });
            charts.type.updateSeries(counts);
        }

        if (charts.cacheEfficiency) {
            const hits = (data['total.num.cachehits'] || 0) + (data['num.query.subnet_cache'] || 0);
            const total = data['total.num.queries'] || 0;
            const recursive = Math.max(0, total - hits);
            charts.cacheEfficiency.updateSeries([hits, recursive]);
        }

        if (charts.latency) {
            const histogram = Object.keys(data)
                .filter(k => k.startsWith('histogram.'))
                .map(k => {
                    const p = k.split('.'), s = parseInt(p[1])||0, m = parseInt(p[3])||0;
                    const label = s > 0 ? s+'s' : (m >= 1000 ? (m/1000).toFixed(0)+'ms' : m+'µs');
                    const totalStart = (s * 1000000) + (parseInt(p[2])||0);
                    return { label, val: data[k], sort: totalStart };
                })
                .sort((a,b) => a.sort - b.sort)
                .filter(h => h.val > 100);

            charts.latency.updateOptions({ xaxis: { categories: histogram.map(h => h.label) } });
            charts.latency.updateSeries([{ name: 'Consultas', data: histogram.map(h => h.val) }]);
        }

        if (charts.rcode) {
            charts.rcode.updateSeries([
                data['num.answer.rcode.NOERROR'] || 0,
                data['num.answer.rcode.NXDOMAIN'] || 0,
                data['num.answer.rcode.SERVFAIL'] || 0,
                data['num.answer.rcode.REFUSED'] || 0
            ]);
        }

        const secureVal = data['num.answer.secure'] || 0;
        const bogusVal = data['num.answer.bogus'] || 0;
        
        const secureEl = document.getElementById('dnssec-secure');
        const bogusEl = document.getElementById('dnssec-bogus');
        if (secureEl) secureEl.innerText = secureVal.toLocaleString();
        if (bogusEl) bogusEl.innerText = bogusVal.toLocaleString();

        // Calcular e animar gauge de validação DNSSEC
        const totalDnssec = secureVal + bogusVal;
        const percentage = totalDnssec > 0 ? Math.round((secureVal / totalDnssec) * 100) : 100;
        
        const percentageEl = document.getElementById('dnssec-percentage');
        if (percentageEl) percentageEl.innerText = `${percentage}%`;
        
        const labelEl = document.getElementById('dnssec-label');
        const gaugeBar = document.getElementById('dnssec-gauge-bar');
        if (gaugeBar) {
            // Comprimento da circunferência: 2 * PI * R (R = 40) => ~251.2
            const strokeDashoffset = 251.2 - (251.2 * percentage) / 100;
            gaugeBar.style.strokeDashoffset = strokeDashoffset;
            
            // Alterar cor e texto de status dinamicamente com base no percentual de segurança real
            if (percentage >= 98) {
                gaugeBar.style.stroke = 'var(--accent-success)';
                if (labelEl) {
                    labelEl.innerText = 'SEGURO';
                    labelEl.style.color = 'var(--accent-success)';
                }
            } else if (percentage >= 90) {
                gaugeBar.style.stroke = 'var(--accent-warning)';
                if (labelEl) {
                    labelEl.innerText = 'ATENÇÃO';
                    labelEl.style.color = 'var(--accent-warning)';
                }
            } else {
                gaugeBar.style.stroke = 'var(--accent-danger)';
                if (labelEl) {
                    labelEl.innerText = 'PERIGO';
                    labelEl.style.color = 'var(--accent-danger)';
                }
            }
        }
    } catch (e) { console.error('Dashboard update error:', e); }
}

function updateSystem(data) {
    if (!data) return;
    try {
        const cpu = parseFloat(data.cpu) || 0;
        const memTotal = data.memory && data.memory[1] ? parseInt(data.memory[1]) : 1;
        const memUsed = data.memory && data.memory[2] ? parseInt(data.memory[2]) : 0;
        const mem = ((memUsed / memTotal) * 100).toFixed(1);
        
        const cpuBrief = document.getElementById('cpu-brief');
        const memBrief = document.getElementById('mem-brief');
        if (cpuBrief) animateValue(cpuBrief, `${cpu}%`);
        if (memBrief) animateValue(memBrief, `${mem}%`);

        
        const cpuText = document.getElementById('cpu-text-full');
        const memText = document.getElementById('mem-text-full');
        if (cpuText) cpuText.innerText = `${typeof t === 'function' ? t('sys.current_usage') : 'Uso atual:'} ${cpu}%`;
        if (memText) memText.innerText = `${typeof t === 'function' ? t('sys.current_usage') : 'Uso atual:'} ${mem}%`;
        
        const uptimeEl = document.getElementById('uptime');
        if (uptimeEl) uptimeEl.innerText = `Uptime: ${data.uptime || '--'}`;
        
        const netBrief = document.getElementById('net-brief');
        if (netBrief) animateValue(netBrief, data.bandwidth ? `${data.bandwidth.rx.toFixed(1)} Mb` : '0.0');


        history.cpu.push(cpu); history.cpu.shift();
        history.mem.push(mem); history.mem.shift();
        if (data.bandwidth) {
            history.net_rx.push(data.bandwidth.rx); history.net_rx.shift();
            history.net_tx.push(data.bandwidth.tx); history.net_tx.shift();
        }
        if (charts.netTrend) charts.netTrend.updateSeries([{ name: 'Download (RX)', data: history.net_rx }, { name: 'Upload (TX)', data: history.net_tx }]);
        if (charts.sysTrend) charts.sysTrend.updateSeries([{ name: 'CPU', data: history.cpu }, { name: 'RAM', data: history.mem }]);
        if (charts.cpuFull) charts.cpuFull.updateSeries([{ name: 'CPU', data: history.cpu }]);
        if (charts.memFull) charts.memFull.updateSeries([{ name: 'RAM', data: history.mem }]);

        if (data.disk && data.disk[3]) {
            const diskP = parseInt(data.disk[3]);
            const diskBar = document.getElementById('disk-progress');
            if (diskBar) {
                diskBar.style.width = `${diskP}%`;
                diskBar.className = `progress ${diskP > 80 ? 'danger' : (diskP > 60 ? 'warning' : '')}`;
            }
            const diskText = document.getElementById('disk-text');
            if (diskText) diskText.innerText = `${data.disk[1]} usados de ${data.disk[0]} (${diskP}%)`;
        }

        if (data.top) {
            renderTopBars('top-domains-list', data.top.domains);
            renderTopBars('top-clients-list', data.top.clients);
        }
    } catch (e) { console.error('System update error:', e); }
}

function renderTopBars(id, items) {
    const container = document.getElementById(id);
    if (!container) return;
    if (!items || items.length === 0) {
        container.innerHTML = '<p class="loading">Coletando dados...</p>';
        return;
    }
    const max = Math.max(...items.map(i => i.count));
    container.innerHTML = items.map(item => `
        <div class="bar-item ${id === 'top-clients-list' ? 'clickable' : ''}" 
             ${id === 'top-clients-list' ? `onclick="openClientDrilldown('${item.name}')"` : ''}>
            <div class="bar-name" title="${item.name}">${item.name}</div>
            <div class="bar-wrapper">
                <div class="bar-fill" style="width: ${(item.count/max*100).toFixed(1)}%"></div>
            </div>
            <div class="bar-count">${item.count}</div>
        </div>
    `).join('');
}

async function showSection(id, element) {
    // Se não for passado elemento (ex: clicado via card), tenta achar o item da sidebar correspondente
    if (!element) {
        element = document.querySelector(`.nav-links li[onclick*="'${id}'"]`);
    }

    // Proteção de login para seções administrativas
    if ((id === 'config' || id === 'servers' || id === 'security' || id === 'users') && (!localStorage.getItem('sentinel_user'))) {
        showLogin();
        return;
    }

    // Gerenciamento de classes e visibilidade
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-section'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    
    const section = document.getElementById(`${id}-section`);
    if (section) {
        section.classList.add('active-section');
    } else {
        console.warn(`[UI] Seção não encontrada: ${id}-section`);
    }

    if (element) {
        element.classList.add('active');
    }

    // Carga de dados específica por aba
    if (id === 'config') loadConfig();
    if (id === 'servers') loadServers();
    if (id === 'licenses') loadLicenses();
    if (id === 'about') {
        loadSystemSpecs();
        fetchPricing();
    }
    if (id === 'audit') loadAuditLogs();
    if (id === 'security') {
        const paywall = document.getElementById('security-paywall');
        const content = document.getElementById('security-content-wrapper');
        if (typeof currentFeatures !== 'undefined' && currentFeatures && !currentFeatures.cti) {
            if (paywall && content) {
                paywall.style.display = 'block';
                content.style.display = 'none';
            }
            return;
        } else {
            if (paywall && content) {
                paywall.style.display = 'none';
                content.style.display = 'block';
            }
        }
        updateSecurityThreats();
        setTimeout(() => {
            if (typeof window.switchSecurityTab === 'function') {
                window.switchSecurityTab('live-queries');
            }
        }, 50);

    } else {
        if (window.liveQueriesInterval) {
            clearInterval(window.liveQueriesInterval);
            window.liveQueriesInterval = null;
        }
    }
    
    if (id === 'pingmaster') {
        const isFree = currentFeatures && currentFeatures.isFree;
        const lockEl = document.getElementById('pingmaster-lock');
        const contentEl = document.getElementById('pingmaster-content');
        
        if (lockEl && contentEl) {
            lockEl.style.display = isFree ? 'block' : 'none';
            contentEl.style.display = isFree ? 'none' : 'block';
        }
        
        if (!isFree) {
            loadPingMasterStatus();
            if (pingMasterTimer) clearInterval(pingMasterTimer);
            pingMasterTimer = setInterval(loadPingMasterStatus, 8000);
        } else {
            if (pingMasterTimer) {
                clearInterval(pingMasterTimer);
                pingMasterTimer = null;
            }
        }
    } else {
        if (pingMasterTimer) {
            clearInterval(pingMasterTimer);
            pingMasterTimer = null;
        }
    }
}

function openConfigModule(module) {
    const grid = document.querySelector('.config-grid');
    const area = document.getElementById('config-module-area');
    const intro = document.querySelector('.config-intro');
    const title = document.getElementById('module-title');
    const editor = document.getElementById('config-editor');
    
    if (!grid || !area || !intro || !editor) return;

    intro.style.display = 'none';
    grid.style.display = 'none';
    area.style.display = 'block';

    // Oculta todas as sub-views para evitar vazamentos e sobreposições indesejadas entre telas
    const allConfigSubViews = [
        'config-editor',
        'static-dns-view',
        'access-control-view',
        'blacklist-view',
        'firewall-view',
        'network-view',
        'layout-view',
        'credentials-view',
        'ddns-view',
        'time-view',
        'geoip-view',
        'geoblocking-view',
        'anablock-view'
    ];
    allConfigSubViews.forEach(viewId => {
        const el = document.getElementById(viewId);
        if (el) el.style.display = 'none';
    });

    if (module === 'unbound') {
        title.innerText = 'Configuração Unbound';
        document.getElementById('config-selector').style.display = 'block';
        document.getElementById('config-editor').style.display = 'block';
        document.getElementById('access-control-view').style.display = 'none';
        document.getElementById('static-dns-view').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.querySelector('.editor-actions').style.display = 'flex';
        
        // Filtra opções do seletor no menu avançado
        const role = getUserRole();
        const selector = document.getElementById('config-selector');
        
        // RECONSTRÓI as opções para garantir que nada sumiu permanentemente
        selector.innerHTML = `
            <option value="unbound.conf">unbound.conf</option>
            <option value="local-zone.conf">local-zone.conf</option>
            <option value="forward-zone.conf">forward-zone.conf</option>
            <option value="access-control.conf">access-control.conf</option>
            <option value="static-dns.conf">static-dns.conf</option>
        `;
        
        // Aplica o filtro de visibilidade e esconde o seletor no Avançado
        if (module === 'unbound') {
            selector.value = 'unbound.conf'; // Força o valor padrão no avançado
            selector.style.display = 'none'; 
            document.getElementById('module-title').innerText = `Configuração: ${selector.value}`;
        } else {
            selector.style.display = 'block';
            if (module === 'access-control') selector.value = 'access-control.conf';
            if (module === 'static-dns') selector.value = 'static-dns.conf';
        }

        // Aguarda um pequeno instante para o DOM processar a mudança antes de carregar
        setTimeout(() => {
            loadConfig();
        }, 50);
    } else if (module === 'static-dns') {
        title.innerText = 'Sistemas Internos (Static DNS)';
        document.getElementById('config-selector').style.display = 'none'; // Esconde para não mudar de menu
        document.getElementById('config-selector').value = 'static-dns.conf';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('static-dns-view').style.display = 'block';
        document.getElementById('access-control-view').style.display = 'none';
        document.getElementById('blacklist-view').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.querySelector('.editor-actions').style.display = 'flex';
        loadConfig();
    } else if (module === 'blacklist') {
        title.innerText = 'Blacklist CTI (Bloqueios)';
        document.getElementById('config-selector').style.display = 'none'; // Esconde para não mudar de menu
        document.getElementById('config-selector').value = 'local-zone.conf';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('static-dns-view').style.display = 'none';
        document.getElementById('access-control-view').style.display = 'none';
        document.getElementById('blacklist-view').style.display = 'block';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.querySelector('.editor-actions').style.display = 'flex';
        loadConfig();
    } else if (module === 'firewall') {
        title.innerText = 'Gestão de Firewall (Premium View)';
        document.getElementById('config-selector').style.display = 'none';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('access-control-view').style.display = 'none';
        document.getElementById('static-dns-view').style.display = 'none';
        document.getElementById('blacklist-view').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'block';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.querySelector('.editor-actions').style.display = 'none';
        
        const view = document.getElementById('firewall-view');
        view.innerHTML = '<p class="loading">Analisando regras de segurança...</p>';
        
        apiFetch(`${API_BASE}/firewall`)
            .then(res => res.json())
            .then(data => renderFirewall(data.content))
            .catch(() => view.innerHTML = 'Erro ao carregar firewall');
    } else if (module === 'access-control') {
        title.innerText = 'Controle de Acesso (IP Blocks)';
        document.getElementById('config-selector').style.display = 'none'; // Esconde para não mudar de menu
        document.getElementById('config-selector').value = 'access-control.conf'; 
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('access-control-view').style.display = 'block';
        document.getElementById('static-dns-view').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.querySelector('.editor-actions').style.display = 'flex';
        loadConfig();
    } else if (module === 'network') {
        title.innerText = 'Infraestrutura de Rede';
        document.getElementById('config-selector').style.display = 'none';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'block';
        document.getElementById('layout-view').style.display = 'none';
        document.querySelector('.editor-actions').style.display = 'none';

        const view = document.getElementById('network-view');
        view.innerHTML = '<p class="loading">Mapeando topologia de rede...</p>';

        apiFetch(`${API_BASE}/network`)
            .then(res => res.json())
            .then(data => renderNetwork(data.content))
            .catch(() => view.innerHTML = 'Erro ao carregar rede');
    } else if (module === 'layout') {
        title.innerText = 'Layout do Painel';
        document.getElementById('config-selector').style.display = 'none';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'block';
        document.getElementById('credentials-view').style.display = 'none';
        document.querySelector('.editor-actions').style.display = 'none';
        buildLayoutConfigurator();
    } else if (module === 'credentials') {
        title.innerText = 'Credenciais & SSH';
        document.getElementById('config-selector').style.display = 'none';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.getElementById('credentials-view').style.display = 'block';
        document.getElementById('ddns-view').style.display = 'none';
        document.querySelector('.editor-actions').style.display = 'none';
        renderCredentials();
    } else if (module === 'ddns') {
        title.innerText = 'Acesso Externo & DDNS';
        document.getElementById('config-selector').style.display = 'none';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.getElementById('credentials-view').style.display = 'none';
        document.getElementById('ddns-view').style.display = 'block';
        document.getElementById('time-view').style.display = 'none';
        document.querySelector('.editor-actions').style.display = 'none';
        renderDDNS();
    } else if (module === 'time') {
        title.innerText = 'Data, Hora & Fuso Horário (Time/NTP)';
        document.getElementById('config-selector').style.display = 'none';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.getElementById('credentials-view').style.display = 'none';
        document.getElementById('ddns-view').style.display = 'none';
        document.getElementById('time-view').style.display = 'block';
        document.querySelector('.editor-actions').style.display = 'none';
        renderTimeSettings();
    } else if (module === 'geoip') {
        title.innerText = 'GeoIP / MaxMind — Geolocalização';
        document.getElementById('config-selector').style.display = 'none';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.getElementById('credentials-view').style.display = 'none';
        document.getElementById('ddns-view').style.display = 'none';
        document.getElementById('time-view').style.display = 'none';
        document.getElementById('geoip-view').style.display = 'block';
        document.querySelector('.editor-actions').style.display = 'none';
        renderGeoIP();
    } else if (module === 'geoblocking') {
        title.innerText = 'Geoblocking (Bloqueio por País)';
        document.getElementById('config-selector').style.display = 'none';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.getElementById('credentials-view').style.display = 'none';
        document.getElementById('ddns-view').style.display = 'none';
        document.getElementById('time-view').style.display = 'none';
        document.getElementById('geoip-view').style.display = 'none';
        document.getElementById('geoblocking-view').style.display = 'block';
        document.querySelector('.editor-actions').style.display = 'none';
        renderGeoblocking();
    } else if (module === 'anablock') {
        title.innerText = 'Integração AnaBlock';
        document.getElementById('config-selector').style.display = 'none';
        document.getElementById('config-editor').style.display = 'none';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.getElementById('credentials-view').style.display = 'none';
        document.getElementById('ddns-view').style.display = 'none';
        document.getElementById('time-view').style.display = 'none';
        document.getElementById('geoip-view').style.display = 'none';
        document.getElementById('geoblocking-view').style.display = 'none';
        document.getElementById('anablock-view').style.display = 'block';
        document.querySelector('.editor-actions').style.display = 'none';
        renderAnaBlock();
    }
}

async function renderAnaBlock() {
    try {
        const res = await apiFetch(`${API_BASE}/anablock/status`);
        const data = await res.json();
        
        const toggleEl = document.getElementById('anablock-toggle');
        if (toggleEl) toggleEl.checked = !!data.enabled;
        
        const syncEl = document.getElementById('anablock-last-sync');
        if (syncEl) {
            if (data.lastSync) {
                const d = new Date(data.lastSync);
                syncEl.innerText = d.toLocaleString('pt-BR');
            } else {
                syncEl.innerText = 'Nunca';
            }
        }

        const domainContainer = document.getElementById('anablock-domains-container');
        const domainEl = document.getElementById('anablock-domains');
        if (domainContainer && domainEl) {
            if (data.domainCount !== undefined && data.domainCount > 0) {
                domainEl.innerText = data.domainCount.toLocaleString('pt-BR');
                domainContainer.style.display = 'block';
            } else {
                domainContainer.style.display = 'none';
            }
        }
        
        const errEl = document.getElementById('anablock-error');
        if (errEl) {
            if (data.error) {
                errEl.innerText = data.error;
                errEl.style.color = '#ef4444';
            } else if (data.enabled) {
                errEl.innerText = data.lastSync ? 'Ativo e Sincronizado (OK)' : 'Ativo (Aguardando ciclo)';
                errEl.style.color = '#10b981';
            } else {
                errEl.innerText = 'Desativado';
                errEl.style.color = '#94a3b8';
            }
        }
    } catch (e) {
        console.error('Erro ao carregar status AnaBlock', e);
    }
}

function setAnablockStatus(msg, color) {
    const errEl = document.getElementById('anablock-error');
    if (errEl) { errEl.innerText = msg; errEl.style.color = color; }
}

async function toggleAnaBlock() {
    const enabled = document.getElementById('anablock-toggle').checked;
    try {
        const res = await apiFetch(`${API_BASE}/anablock/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
        const data = await res.json();
        if (!data.success) {
            showToast('Erro: ' + (data.error || 'Resposta inesperada'), 'error');
            await renderAnaBlock();
            return;
        }

        if (enabled) {
            showToast('AnaBlock ativado! Sincronizando...', 'info');
            setAnablockStatus('Sincronizando...', '#f59e0b');
            const syncRes = await apiFetch(`${API_BASE}/anablock/sync`, { method: 'POST' });
            const syncData = await syncRes.json().catch(() => ({}));
            if (syncData.success) {
                showToast('AnaBlock ativo e sincronizado!', 'success');
            } else {
                showToast('Ativado: ' + (syncData.error || 'Aguardando sincronização'), 'warning');
            }
        } else {
            showToast('AnaBlock desativado.', 'success');
        }
    } catch (e) {
        showToast('Erro ao salvar AnaBlock: ' + e.message, 'error');
    } finally {
        await renderAnaBlock();
    }
}

async function syncAnaBlockNow() {
    const btn = document.querySelector('#anablock-view .btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;animation:spin 1s linear infinite;"></i> Sincronizando...'; }
    setAnablockStatus('Sincronizando com a API AnaBlock...', '#f59e0b');
    try {
        const res = await apiFetch(`${API_BASE}/anablock/sync`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('Sincronização judicial concluída com sucesso!', 'success');
        } else {
            showToast('Aviso AnaBlock: ' + (data.error || 'Erro na sincronização'), 'error');
        }
    } catch (e) {
        showToast('Falha na requisição: ' + e.message, 'error');
    } finally {
        await renderAnaBlock();
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="refresh-cw" style="width:14px;height:14px;"></i> Sincronizar Agora'; if (window.lucide) lucide.createIcons(); }
    }
}



function renderGeoblocking() {
    const view = document.getElementById('geoblocking-view');
    view.innerHTML = `<p class="loading">Carregando bloqueios geográficos...</p>`;

    apiFetch(`${API_BASE}/security/geoblocking`)
        .then(r => r.json())
        .then(data => {
            const rulesArray = data.blocked_countries || data.blockedCountries || [];
            const rules = rulesArray.map(r => r.code || r);

            let rulesHtml = rules.map(code => `
                <div style="display:flex; justify-content:space-between; padding: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 8px; align-items: center;">
                    <div style="display:flex; align-items:center; gap: 10px;">
                        ${flagEmoji(code)}
                        <span style="font-weight:bold;">${code}</span>
                    </div>
                    <button class="btn-action danger" onclick="removeGeoblockingRule('${code}')">
                        <i data-lucide="trash" style="width:14px; height:14px;"></i>
                    </button>
                </div>
            `).join('');

            if (rules.length === 0) {
                rulesHtml = '<p style="color:var(--text-secondary); font-size: 0.8rem;">Nenhum país bloqueado. O tráfego de todos os países é permitido.</p>';
            }

            view.innerHTML = `
            <div style="max-width: 600px;">
                <div style="margin-bottom:1.5rem;padding:1rem 1.2rem;background:rgba(244,63,94,0.07);border:1px solid rgba(244,63,94,0.25);border-radius:10px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:0.5rem;">
                        <i data-lucide="globe-2" style="color:#f43f5e;width:18px;height:18px;"></i>
                        <strong style="color:#f43f5e;font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;">Geoblocking DNS (iptables + ipset)</strong>
                    </div>
                    <p style="font-size:0.78rem;color:var(--text-secondary);margin:0;">Adicione o código ISO do país (ex: CN, RU, KP) para bloquear 100% do tráfego DNS originário dessas regiões via firewall a nível de kernel.</p>
                </div>

                <div style="display:flex; gap: 10px; margin-bottom: 1.5rem;">
                    <select id="geo-country-input" style="flex:1; padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white; cursor: pointer; outline: none;">
                        <option value="">Selecione um País para Bloquear...</option>
                        <optgroup label="Principais Alvos">
                            <option value="CN">🇨🇳 China (CN)</option>
                            <option value="RU">🇷🇺 Rússia (RU)</option>
                            <option value="KP">🇰🇵 Coreia do Norte (KP)</option>
                            <option value="IR">🇮🇷 Irã (IR)</option>
                            <option value="SY">🇸🇾 Síria (SY)</option>
                            <option value="CU">🇨🇺 Cuba (CU)</option>
                            <option value="VE">🇻🇪 Venezuela (VE)</option>
                        </optgroup>
                        <optgroup label="Américas">
                            <option value="BR">🇧🇷 Brasil (BR)</option>
                            <option value="US">🇺🇸 Estados Unidos (US)</option>
                            <option value="CA">🇨🇦 Canadá (CA)</option>
                            <option value="MX">🇲🇽 México (MX)</option>
                            <option value="AR">🇦🇷 Argentina (AR)</option>
                            <option value="CO">🇨🇴 Colômbia (CO)</option>
                            <option value="CL">🇨🇱 Chile (CL)</option>
                            <option value="PE">🇵🇪 Peru (PE)</option>
                            <option value="PY">🇵🇾 Paraguai (PY)</option>
                            <option value="UY">🇺🇾 Uruguai (UY)</option>
                        </optgroup>
                        <optgroup label="Europa">
                            <option value="DE">🇩🇪 Alemanha (DE)</option>
                            <option value="FR">🇫🇷 França (FR)</option>
                            <option value="GB">🇬🇧 Reino Unido (GB)</option>
                            <option value="IT">🇮🇹 Itália (IT)</option>
                            <option value="ES">🇪🇸 Espanha (ES)</option>
                            <option value="PT">🇵🇹 Portugal (PT)</option>
                            <option value="NL">🇳🇱 Holanda (NL)</option>
                            <option value="UA">🇺🇦 Ucrânia (UA)</option>
                            <option value="PL">🇵🇱 Polônia (PL)</option>
                            <option value="SE">🇸🇪 Suécia (SE)</option>
                            <option value="CH">🇨🇭 Suíça (CH)</option>
                        </optgroup>
                        <optgroup label="Ásia e Oceania">
                            <option value="IN">🇮🇳 Índia (IN)</option>
                            <option value="JP">🇯🇵 Japão (JP)</option>
                            <option value="KR">🇰🇷 Coreia do Sul (KR)</option>
                            <option value="ID">🇮🇩 Indonésia (ID)</option>
                            <option value="PH">🇵🇭 Filipinas (PH)</option>
                            <option value="VN">🇻🇳 Vietnã (VN)</option>
                            <option value="TH">🇹🇭 Tailândia (TH)</option>
                            <option value="AU">🇦🇺 Austrália (AU)</option>
                            <option value="TW">🇹🇼 Taiwan (TW)</option>
                            <option value="MY">🇲🇾 Malásia (MY)</option>
                        </optgroup>
                        <optgroup label="Oriente Médio e África">
                            <option value="ZA">🇿🇦 África do Sul (ZA)</option>
                            <option value="EG">🇪🇬 Egito (EG)</option>
                            <option value="NG">🇳🇬 Nigéria (NG)</option>
                            <option value="SA">🇸🇦 Arábia Saudita (SA)</option>
                            <option value="AE">🇦🇪 Emirados Árabes (AE)</option>
                            <option value="IL">🇮🇱 Israel (IL)</option>
                            <option value="TR">🇹🇷 Turquia (TR)</option>
                            <option value="IQ">🇮🇶 Iraque (IQ)</option>
                            <option value="QA">🇶🇦 Catar (QA)</option>
                        </optgroup>
                    </select>
                    <button class="btn btn-primary" style="background:rgba(244,63,94,0.15); border:1px solid rgba(244,63,94,0.3); color:#f43f5e;" onclick="addGeoblockingRule()">Bloquear</button>
                </div>

                <div>
                    <h4 style="margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.85rem;">Países Bloqueados Atualmente</h4>
                    ${rulesHtml}
                </div>
            </div>`;
            if (window.lucide) lucide.createIcons();
        })
        .catch(err => {
            view.innerHTML = `<p style="color:red;">Erro ao carregar geoblocking: ${err.message}</p>`;
        });
}

window.addGeoblockingRule = async function() {
    const input = document.getElementById('geo-country-input');
    const code = input.value.trim().toUpperCase();
    if (!code || code.length !== 2) {
        alert("Selecione um país válido na lista.");
        return;
    }
    
    const btn = event.currentTarget;
    const oldContent = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" class="spin"></i>';
    if (window.lucide) lucide.createIcons();

    try {
        const res = await apiFetch(`${API_BASE}/security/geoblocking`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ country_code: code })
        });
        if (res.ok) {
            input.value = '';
            renderGeoblocking();
        } else {
            const data = await res.json();
            alert(data.error || "Erro ao adicionar geoblocking.");
            btn.innerHTML = oldContent;
        }
    } catch (e) {
        alert("Erro de conexão.");
        btn.innerHTML = oldContent;
    }
};

window.removeGeoblockingRule = async function(code) {
    if (!confirm(`Remover o bloqueio do país ${code}?`)) return;
    try {
        const res = await apiFetch(`${API_BASE}/security/geoblocking/${code}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            renderGeoblocking();
        } else {
            const data = await res.json();
            alert(data.error || "Erro ao remover bloqueio.");
        }
    } catch (e) {
        alert("Erro de conexão.");
    }
};

function renderGeoIP() {
    const view = document.getElementById('geoip-view');
    view.innerHTML = `<p class="loading">Carregando configurações de GeoIP...</p>`;

    apiFetch(`${API_BASE}/settings/credentials`)
        .then(r => r.json())
        .then(data => {
            view.innerHTML = `
            <div style="max-width:600px;">

                <!-- Header informativo -->
                <div style="margin-bottom:1.5rem;padding:1rem 1.2rem;background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.25);border-radius:10px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:0.5rem;">
                        <i data-lucide="map-pin" style="color:#10b981;width:18px;height:18px;"></i>
                        <strong style="color:#10b981;font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;">MaxMind GeoIP / GeoLite2</strong>
                    </div>
                    <p style="font-size:0.78rem;color:var(--text-secondary);margin:0;">A geolocalização de IPs é sincronizada diretamente com o seu Servidor Master de forma automática. Nenhuma conta da MaxMind é necessária neste painel.</p>
                </div>

                <!-- Banco Local MMDB -->
                <div style="margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;padding-bottom:0.75rem;border-bottom:1px solid var(--card-border);">
                        <i data-lucide="database" style="color:#38bdf8;width:18px;height:18px;"></i>
                        <h3 style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Banco de Dados Local (MMDB)</h3>
                    </div>
                    <div>
                        <label class="cred-label">Caminho do arquivo .mmdb no servidor</label>
                        <input id="geo-maxmind-dbpath" type="text" class="cred-input" value="${data.maxmindDbPath || '/opt/unbound-dashboard/GeoLite2-City.mmdb'}" placeholder="/opt/unbound-dashboard/GeoLite2-City.mmdb">
                        <span style="font-size:0.65rem;color:#64748b;display:block;margin-top:4px;">Deixe em branco para usar detecção automática. Prioridade: Banco Local → Web API → ip-api.com (gratuito)</span>
                    </div>
                </div>

                <!-- Provedor Ativo (Status) -->
                <div style="margin-bottom:2rem;padding:1rem 1.2rem;background:rgba(0,0,0,0.2);border:1px solid var(--card-border);border-radius:10px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:0.5rem;">
                        <i data-lucide="activity" style="color:var(--accent-primary);width:15px;height:15px;"></i>
                        <span style="font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Provedor Ativo</span>
                    </div>
                    <div id="geo-provider-status" style="font-size:0.85rem;">
                        <span id="geo-provider-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#64748b;margin-right:8px;"></span>
                        <span id="geo-provider-label" style="color:var(--text-secondary);">Verificando...</span>
                    </div>
                </div>

                <!-- Banco Local Offline (Ilimitado) -->
                <div style="margin-bottom:2rem;padding:1rem 1.2rem;background:rgba(16,185,129,0.05);border:1px solid rgba(16,185,129,0.2);border-radius:10px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:0.8rem;">
                        <i data-lucide="database-zap" style="color:#10b981;width:16px;height:16px;"></i>
                        <strong style="font-size:0.82rem;color:#10b981;">Banco Local GeoLite2 — Consultas ILIMITADAS</strong>
                    </div>
                    <p style="font-size:0.73rem;color:var(--text-secondary);margin:0 0 1rem 0;">Baixe o banco .mmdb uma vez e use offline sem limite de consultas. A Web API tem limite de 1.000/dia (plano gratuito).</p>

                    <div style="display:flex;gap:0.75rem;flex-wrap:wrap;">
                        ${(data.hasMaxMindKey && data.isMaster) ? `
                        <!-- Botão 1: Baixar do MaxMind -->
                        <button id="btn-update-maxmind" onclick="updateFromMaxMind()" style="flex:1;min-width:160px;padding:0.55rem 1rem;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);color:#10b981;border-radius:8px;cursor:pointer;font-size:0.78rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;" onmouseover="this.style.background='rgba(16,185,129,0.25)'" onmouseout="this.style.background='rgba(16,185,129,0.15)'">
                            <i data-lucide="refresh-cw" style="width:14px;height:14px;"></i> Baixar do MaxMind
                        </button>` : ''}

                        ${(data.hasCDN && data.isMaster) ? `
                        <!-- Botão 2: Enviar para Cloudflare R2 -->
                        <button id="btn-upload-cdn" onclick="uploadToCDN()" style="flex:1;min-width:160px;padding:0.55rem 1rem;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.35);color:#f97316;border-radius:8px;cursor:pointer;font-size:0.78rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;" onmouseover="this.style.background='rgba(249,115,22,0.22)'" onmouseout="this.style.background='rgba(249,115,22,0.12)'">
                            <i data-lucide="cloud-upload" style="width:14px;height:14px;"></i> Enviar para CDN (R2)
                        </button>` : ''}

                        <!-- Botão 3: Baixar do Master (para todos) -->
                        <button id="btn-download-db" onclick="downloadGeoLite2DB()" style="flex:1;min-width:160px;padding:0.55rem 1rem;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;border-radius:8px;cursor:pointer;font-size:0.78rem;font-weight:600;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;" onmouseover="this.style.background='rgba(56,189,248,0.2)'" onmouseout="this.style.background='rgba(56,189,248,0.1)'">
                            <i data-lucide="download-cloud" style="width:14px;height:14px;"></i> ${data.hasCDN ? 'Baixar do Master' : 'Baixar Banco Local'}
                        </button>
                    </div>

                    <!-- Barra de progresso (oculta por padrão) -->
                    <div id="geo-dl-progress-wrap" style="display:none;margin-top:0.8rem;">
                        <div style="background:rgba(0,0,0,0.3);border-radius:20px;overflow:hidden;height:6px;">
                            <div id="geo-dl-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#10b981,#06d6a0);border-radius:20px;transition:width 0.3s;"></div>
                        </div>
                        <p id="geo-dl-label" style="font-size:0.72rem;color:#10b981;margin-top:5px;">Iniciando...</p>
                    </div>
                </div>

                <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;">
                    <button class="btn btn-primary" onclick="saveGeoIPSettings()" style="padding:0.6rem 1.5rem;">
                        <i data-lucide="save"></i> Salvar Configurações
                    </button>
                    <button class="btn" onclick="testGeoIP()" style="padding:0.6rem 1.2rem;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);color:#38bdf8;">
                        <i data-lucide="zap"></i> Testar Agora
                    </button>
                    <p id="geo-status" style="font-size:0.8rem;margin:0;"></p>
                </div>

            </div>`;
            if (window.lucide) lucide.createIcons();
            checkGeoIPProvider();
        })
        .catch(() => {
            view.innerHTML = '<p style="color:var(--accent-danger);">Erro ao carregar configurações de GeoIP.</p>';
        });
}

async function saveGeoIPSettings() {
    const statusEl = document.getElementById('geo-status');
    const dbpath = document.getElementById('geo-maxmind-dbpath')?.value.trim();

    const payload = {};
    if (dbpath !== undefined) payload.maxmindDbPath = dbpath;

    try {
        if (statusEl) { statusEl.style.color = 'var(--accent-warning)'; statusEl.innerText = 'Salvando...'; }
        const res = await apiFetch(`${API_BASE}/settings/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (statusEl) { statusEl.style.color = 'var(--accent-success)'; statusEl.innerText = '✅ Configurações salvas com sucesso!'; }
        setTimeout(checkGeoIPProvider, 500);
    } catch (e) {
        if (statusEl) { statusEl.style.color = 'var(--accent-danger)'; statusEl.innerText = 'Erro ao salvar: ' + e.message; }
    }
}

async function testGeoIP() {
    const statusEl = document.getElementById('geo-status');
    if (statusEl) { statusEl.style.color = 'var(--accent-warning)'; statusEl.innerText = '⏳ Testando com 8.8.8.8...'; }
    try {
        const res = await apiFetch('/api/enrich/geo?ip=8.8.8.8');
        const data = await res.json();
        if (data && data.status === 'success') {
            if (statusEl) {
                statusEl.style.color = 'var(--accent-success)';
                statusEl.innerText = `✅ OK — ${data.city}, ${data.country} via ${data.source}`;
            }
        } else {
            if (statusEl) { statusEl.style.color = 'var(--accent-danger)'; statusEl.innerText = '❌ Resposta inválida do provedor.'; }
        }
    } catch(e) {
        if (statusEl) { statusEl.style.color = 'var(--accent-danger)'; statusEl.innerText = 'Erro: ' + e.message; }
    }
}

async function checkGeoIPProvider() {
    const dot = document.getElementById('geo-provider-dot');
    const label = document.getElementById('geo-provider-label');
    if (!dot || !label) return;
    try {
        const res = await apiFetch('/api/enrich/geo?ip=8.8.8.8');
        const data = await res.json();
        if (data && data.source) {
            const isMaxMind = data.source.includes('MaxMind');
            const isLocal = data.source.includes('Local');
            dot.style.background = isMaxMind ? '#10b981' : '#f59e0b';
            dot.style.boxShadow = isMaxMind ? '0 0 6px #10b981' : '0 0 6px #f59e0b';
            label.style.color = isMaxMind ? '#10b981' : '#f59e0b';
            label.innerText = data.source;
        }
    } catch(e) {
        if (label) label.innerText = 'Erro ao verificar provedor';
    }
}

async function updateFromMaxMind() {
    const btn     = document.getElementById('btn-update-maxmind');
    const wrap    = document.getElementById('geo-dl-progress-wrap');
    const bar     = document.getElementById('geo-dl-bar');
    const dlLabel = document.getElementById('geo-dl-label');
    const statusEl = document.getElementById('geo-status');

    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    if (wrap) wrap.style.display = 'block';
    if (bar)  { bar.style.width = '0%'; bar.style.background = 'linear-gradient(90deg,#10b981,#06d6a0)'; }
    if (dlLabel) { dlLabel.style.color = '#10b981'; dlLabel.innerText = 'Conectando ao MaxMind...'; }

    let fakeProgress = 0;
    const progressInterval = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + (Math.random() * 5), 85);
        if (bar) bar.style.width = fakeProgress + '%';
        if (fakeProgress < 20 && dlLabel)      dlLabel.innerText = 'Autenticando com MaxMind...';
        else if (fakeProgress < 50 && dlLabel) dlLabel.innerText = 'Baixando GeoLite2-City.tar.gz (~60MB)...';
        else if (fakeProgress < 75 && dlLabel) dlLabel.innerText = 'Extraindo arquivo .mmdb...';
        else if (dlLabel)                      dlLabel.innerText = 'Finalizando instalação...';
    }, 600);

    try {
        const res = await apiFetch('/api/geoip/update-from-maxmind', { method: 'POST' });
        const data = await res.json();
        clearInterval(progressInterval);
        if (data.success) {
            if (bar) bar.style.width = '100%';
            if (dlLabel) { dlLabel.style.color = '#10b981'; dlLabel.innerText = `✅ ${data.message}`; }
            if (statusEl) { statusEl.style.color = 'var(--accent-success)'; statusEl.innerText = '✅ Banco MaxMind atualizado da fonte oficial!'; }
            setTimeout(checkGeoIPProvider, 800);
        } else {
            throw new Error(data.error || 'Erro desconhecido');
        }
    } catch(err) {
        clearInterval(progressInterval);
        if (bar) { bar.style.width = '100%'; bar.style.background = 'linear-gradient(90deg,#f43f5e,#e11d48)'; }
        if (dlLabel) { dlLabel.style.color = '#f43f5e'; dlLabel.innerText = '❌ ' + err.message; }
        if (statusEl) { statusEl.style.color = 'var(--accent-danger)'; statusEl.innerText = 'Erro: ' + err.message; }
    } finally {
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
}

async function uploadToCDN() {
    const btn     = document.getElementById('btn-upload-cdn');
    const wrap    = document.getElementById('geo-dl-progress-wrap');
    const bar     = document.getElementById('geo-dl-bar');
    const dlLabel = document.getElementById('geo-dl-label');
    const statusEl = document.getElementById('geo-status');

    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    if (wrap) wrap.style.display = 'block';
    if (bar)  { bar.style.width = '0%'; bar.style.background = 'linear-gradient(90deg,#f97316,#fb923c)'; }
    if (dlLabel) { dlLabel.style.color = '#f97316'; dlLabel.innerText = 'Lendo banco MaxMind local...'; }

    let fakeProgress = 0;
    const progressInterval = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + (Math.random() * 8), 88);
        if (bar) bar.style.width = fakeProgress + '%';
        if (fakeProgress < 30 && dlLabel)      dlLabel.innerText = 'Comprimindo arquivo...';
        else if (fakeProgress < 70 && dlLabel) dlLabel.innerText = 'Enviando para Cloudflare R2...';
        else if (dlLabel)                      dlLabel.innerText = 'Finalizando upload...';
    }, 400);

    try {
        const res = await apiFetch('/api/geoip/upload-to-cdn', { method: 'POST' });
        const data = await res.json();
        clearInterval(progressInterval);
        if (data.success) {
            if (bar) bar.style.width = '100%';
            if (dlLabel) { dlLabel.style.color = '#f97316'; dlLabel.innerText = `✅ ${data.message}`; }
            if (statusEl) { statusEl.style.color = 'var(--accent-success)'; statusEl.innerText = '✅ Banco enviado para CDN! Clientes já recebem a versão nova.'; }
        } else {
            throw new Error(data.error || 'Erro desconhecido');
        }
    } catch(err) {
        clearInterval(progressInterval);
        if (bar) { bar.style.width = '100%'; bar.style.background = 'linear-gradient(90deg,#f43f5e,#e11d48)'; }
        if (dlLabel) { dlLabel.style.color = '#f43f5e'; dlLabel.innerText = '❌ ' + err.message; }
        if (statusEl) { statusEl.style.color = 'var(--accent-danger)'; statusEl.innerText = 'Erro: ' + err.message; }
    } finally {
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
}

async function downloadGeoLite2DB() {
    const btn      = document.getElementById('btn-download-db');
    const wrap     = document.getElementById('geo-dl-progress-wrap');
    const bar      = document.getElementById('geo-dl-bar');
    const dlLabel  = document.getElementById('geo-dl-label');
    const statusEl = document.getElementById('geo-status');

    if (currentFeatures.isFree) {
        alert('Este recurso é exclusivo da versão PRO.\nA versão grátis utiliza a geolocalização online (ip-api.com) com limites de taxa.');
        return;
    }

    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    if (wrap) wrap.style.display = 'block';
    if (bar)  { bar.style.width = '0%'; bar.style.background = 'linear-gradient(90deg,#10b981,#06d6a0)'; }
    if (dlLabel) { dlLabel.style.color = '#10b981'; dlLabel.innerText = 'Conectando ao MaxMind...'; }
    if (statusEl) { statusEl.style.color = 'var(--accent-warning)'; statusEl.innerText = ''; }

    // Progresso visual simulado enquanto aguarda o download
    let fakeProgress = 0;
    const progressInterval = setInterval(() => {
        fakeProgress = Math.min(fakeProgress + (Math.random() * 7), 88);
        if (bar) bar.style.width = fakeProgress + '%';
        if (fakeProgress < 30 && dlLabel)       dlLabel.innerText = 'Baixando GeoLite2-City.tar.gz...';
        else if (fakeProgress < 65 && dlLabel)  dlLabel.innerText = 'Extraindo arquivo .mmdb...';
        else if (dlLabel)                       dlLabel.innerText = 'Instalando banco de dados...';
    }, 400);

    try {
        const res = await apiFetch('/api/geoip/download-db', { method: 'POST' });
        const data = await res.json();
        clearInterval(progressInterval);

        if (data.success) {
            if (bar) bar.style.width = '100%';
            if (dlLabel) { dlLabel.style.color = '#10b981'; dlLabel.innerText = `✅ ${data.message}`; }
            if (statusEl) { statusEl.style.color = 'var(--accent-success)'; statusEl.innerText = '✅ Banco local ativado! Consultas agora são ilimitadas.'; }
            setTimeout(checkGeoIPProvider, 800);
        } else {
            throw new Error(data.error || 'Erro desconhecido');
        }
    } catch(err) {
        clearInterval(progressInterval);
        if (bar) { bar.style.width = '100%'; bar.style.background = 'linear-gradient(90deg,#f43f5e,#e11d48)'; }
        if (dlLabel) { dlLabel.style.color = '#f43f5e'; dlLabel.innerText = '❌ ' + err.message; }
        if (statusEl) { statusEl.style.color = 'var(--accent-danger)'; statusEl.innerText = 'Erro: ' + err.message; }
    } finally {
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
}

function renderCredentials() {
    const view = document.getElementById('credentials-view');
    view.innerHTML = `<p class="loading">Carregando configurações...</p>`;

    apiFetch(`${API_BASE}/settings/credentials`)
        .then(r => r.json())
        .then(data => {
            view.innerHTML = `
            <div style="max-width:600px;">

                <!-- Dashboard Login -->
                <div style="margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;padding-bottom:0.75rem;border-bottom:1px solid var(--card-border);">
                        <i data-lucide="user" style="color:#a855f7;width:18px;height:18px;"></i>
                        <h3 style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Acesso ao Dashboard</h3>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <label class="cred-label">Novo Usuário</label>
                            <input id="cred-dash-user" type="text" class="cred-input" placeholder="${data.dashUser}" value="${data.dashUser}">
                        </div>
                        <div>
                            <label class="cred-label">Nova Senha</label>
                            <div style="position:relative;">
                                <input id="cred-dash-pass" type="password" class="cred-input" placeholder="••••••••" autocomplete="new-password">
                                <button onclick="togglePassVisibility('cred-dash-pass')" class="pass-eye-btn"><i data-lucide="eye"></i></button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SSH Connection -->
                <div style="margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;padding-bottom:0.75rem;border-bottom:1px solid var(--card-border);">
                        <i data-lucide="terminal" style="color:#38bdf8;width:18px;height:18px;"></i>
                        <h3 style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Conexão SSH</h3>
                    </div>
                    <div style="display:grid;grid-template-columns:2fr 1fr;gap:1rem;margin-bottom:1rem;">
                        <div>
                            <label class="cred-label">Host / IP do Servidor</label>
                            <input id="cred-ssh-host" type="text" class="cred-input" value="${data.sshHost || ''}">
                        </div>
                        <div>
                            <label class="cred-label">Porta SSH</label>
                            <input id="cred-ssh-port" type="number" class="cred-input" value="${data.sshPort || 22}">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                        <div>
                            <label class="cred-label">Usuário SSH</label>
                            <input id="cred-ssh-user" type="text" class="cred-input" value="${data.sshUser || ''}">
                        </div>
                        <div>
                            <label class="cred-label">Senha SSH</label>
                            <div style="position:relative;">
                                <input id="cred-ssh-pass" type="password" class="cred-input" placeholder="••••••••" autocomplete="new-password">
                                <button onclick="togglePassVisibility('cred-ssh-pass')" class="pass-eye-btn"><i data-lucide="eye"></i></button>
                            </div>
                        </div>
                    </div>
                    </div>
                </div>

                <!-- Master Server (Self-Hosted Update/License) -->
                <div style="margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;padding-bottom:0.75rem;border-bottom:1px solid var(--card-border);">
                        <i data-lucide="server" style="color:var(--accent-primary);width:18px;height:18px;"></i>
                        <h3 style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Servidor Master (Self-Hosted)</h3>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr;gap:1rem;">
                        <div>
                            <label class="cred-label">URL do Master (ex: http://seu-dominio.duckdns.org:3000)</label>
                            <input id="cred-master-url" type="text" class="cred-input" value="${data.masterUrl || ''}" placeholder="Deixe em branco para usar o GitHub">
                        </div>
                    </div>
                </div>

                <!-- GitHub Integration -->
                <div style="margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;padding-bottom:0.75rem;border-bottom:1px solid var(--card-border);">
                        <i data-lucide="github" style="color:#f8fafc;width:18px;height:18px;"></i>
                        <h3 style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Repositório Privado (Auto-Update)</h3>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr;gap:1rem;">
                        <div>
                            <label class="cred-label">GitHub Personal Access Token (Deixe em branco se for repositório público)</label>
                            <input id="cred-github-token" type="password" class="cred-input" placeholder="${data.githubToken ? 'Token já configurado (********)' : 'ghp_...'}" autocomplete="new-password">
                        </div>
                    </div>
                </div>

                <!-- Nome do Provedor (White-Label) -->
                <div style="margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;padding-bottom:0.75rem;border-bottom:1px solid var(--card-border);">
                        <i data-lucide="building-2" style="color:#a78bfa;width:18px;height:18px;"></i>
                        <h3 style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Identidade do Provedor</h3>
                    </div>
                    <p style="font-size:0.78rem;color:var(--text-secondary);margin:0 0 1rem 0;">Digite o nome da sua empresa ou provedor. Ele aparecerá em destaque no painel de licença.</p>
                    <div style="display:grid;grid-template-columns:1fr;gap:1rem;">
                        <div>
                            <label class="cred-label">Nome do Provedor / Empresa</label>
                            <input id="cred-provider-name" type="text" class="cred-input" value="${data.providerName || ''}" placeholder="Ex: Telecom Boa Vista, Net Plus, ISP Conecta...">
                        </div>
                    </div>
                </div>

                <!-- MaxMind Geolocation Settings -->
                <div style="margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;padding-bottom:0.75rem;border-bottom:1px solid var(--card-border);">
                        <i data-lucide="globe" style="color:#10b981;width:18px;height:18px;"></i>
                        <h3 style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Geolocalização MaxMind GeoIP</h3>
                    </div>
                    <p style="font-size:0.78rem;color:var(--text-secondary);margin:0 0 1rem 0;">A conta da MaxMind e chaves de API não precisam ser preenchidas aqui. Elas são herdadas automaticamente via Master Server durante a primeira sincronização do painel.</p>
                    <div style="display:grid;grid-template-columns:1fr;gap:1rem;">
                        <div>
                            <label class="cred-label">Caminho do Banco MaxMind Local (MMDB)</label>
                            <input id="cred-maxmind-dbpath" type="text" class="cred-input" value="${data.maxmindDbPath || '/opt/unbound-dashboard/GeoLite2-City.mmdb'}" placeholder="/opt/unbound-dashboard/GeoLite2-City.mmdb">
                            <span style="font-size:0.65rem;color:#64748b;">Recomendado: Deixar o padrão (/opt/unbound-dashboard/GeoLite2-City.mmdb)</span>
                        </div>
                    </div>
                </div>

                <div style="display:flex;align-items:center;gap:1rem;">
                    <button class="btn btn-primary" onclick="saveCredentials()" style="padding:0.6rem 1.5rem;">
                        <i data-lucide="save"></i> Salvar Alterações
                    </button>
                    <p id="cred-status" style="font-size:0.8rem;"></p>
                </div>

                <div style="margin-top:1.5rem;padding:0.85rem 1rem;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.25);border-radius:8px;font-size:0.78rem;color:var(--accent-warning);">
                    ⚠️ Ao alterar o usuário ou senha do dashboard, você será desconectado e precisará fazer login novamente.
                </div>
            </div>`;
            if (window.lucide) lucide.createIcons();
        })
        .catch(() => {
            view.innerHTML = '<p style="color:var(--accent-danger);">Erro ao carregar configurações.</p>';
        });
}

function togglePassVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function saveCredentials() {
    const status = document.getElementById('cred-status');
    status.style.color = 'var(--accent-primary)';
    status.innerText = 'Salvando...';

    const payload = {};
    const dashUser = document.getElementById('cred-dash-user')?.value.trim();
    const dashPass = document.getElementById('cred-dash-pass')?.value.trim();
    const sshHost  = document.getElementById('cred-ssh-host')?.value.trim();
    const sshPort  = document.getElementById('cred-ssh-port')?.value.trim();
    const sshUser  = document.getElementById('cred-ssh-user')?.value.trim();
    const sshPass  = document.getElementById('cred-ssh-pass')?.value.trim();
    const githubToken = document.getElementById('cred-github-token')?.value.trim();
    const masterUrl = document.getElementById('cred-master-url')?.value.trim();
    const maxmindDbPath = document.getElementById('cred-maxmind-dbpath')?.value.trim();
    const providerName = document.getElementById('cred-provider-name')?.value.trim();

    if (dashUser) payload.dashUser = dashUser;
    if (dashPass) payload.dashPass = dashPass;
    if (sshHost)  payload.sshHost  = sshHost;
    if (sshPort)  payload.sshPort  = sshPort;
    if (sshUser)  payload.sshUser  = sshUser;
    if (sshPass)  payload.sshPass  = sshPass;
    if (githubToken) payload.githubToken = githubToken;
    if (masterUrl !== undefined) payload.masterUrl = masterUrl;
    if (maxmindDbPath !== undefined) payload.maxmindDbPath = maxmindDbPath;
    payload.providerName = providerName !== undefined ? providerName : '';

    if (Object.keys(payload).length === 0) {
        status.style.color = 'var(--accent-warning)';
        status.innerText = 'Nenhuma alteração detectada.';
        return;
    }

    try {
        const res = await apiFetch(`${API_BASE}/settings/credentials`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) {
            status.style.color = 'var(--accent-danger)';
            status.innerText = data.error;
        } else {
            status.style.color = 'var(--accent-success)';
            status.innerText = data.message;
            // If credentials changed, force re-login after 2s
            if (payload.dashUser || payload.dashPass) {
                setTimeout(async () => {
                    await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
                    location.reload();
                }, 2000);
            }
        }
    } catch (e) {
        status.style.color = 'var(--accent-danger)';
        status.innerText = 'Erro ao salvar';
    }
}


function buildLayoutConfigurator() {
    const WIDGETS = {
        noc: [
            { id: 'card-queries',   label: 'Consultas Totais',  icon: 'activity' },
            { id: 'card-hits',      label: 'Cache Hit Rate',     icon: 'check-circle' },
            { id: 'card-misses',    label: 'Cache Misses',       icon: 'x-circle' },
            { id: 'card-servfail',  label: 'ServFail (Erros)',   icon: 'alert-triangle' },
            { id: 'card-cpu',       label: 'Uso de CPU',         icon: 'cpu' },
            { id: 'card-mem',       label: 'Uso de Memória',    icon: 'hard-drive' },
            { id: 'card-ipv4',      label: 'IPv4',               icon: 'wifi' },
            { id: 'card-ipv6',      label: 'IPv6',               icon: 'globe' },
            { id: 'card-bandwidth', label: 'Tráfego de Rede',  icon: 'bar-chart-2' },
        ],
        panels: [
            { id: 'panel-domains',  label: 'Top 10 Domínios',         icon: 'globe' },
            { id: 'panel-clients',  label: 'Top Clientes',              icon: 'users' },
            { id: 'panel-types',    label: 'Tipos de Consulta',         icon: 'pie-chart' },
            { id: 'panel-latency',  label: 'Latência (Histograma)',     icon: 'clock' },
            { id: 'panel-tps',      label: 'Histórico TPS',            icon: 'trending-up' },
            { id: 'panel-network',  label: 'Tráfego de Rede (Mbps)',   icon: 'activity' },
            { id: 'panel-rcode',    label: 'Distribuição RCODE',       icon: 'bar-chart' },
            { id: 'panel-system',   label: 'Recursos do Sistema',       icon: 'server' },
        ]
    };

    function isVisible(id) {
        const hidden = JSON.parse(localStorage.getItem('sentinel_hidden_widgets') || '{}');
        return !hidden[id];
    }

    function toggleWidget(id, checkbox) {
        const hidden = JSON.parse(localStorage.getItem('sentinel_hidden_widgets') || '{}');
        const el = document.getElementById(id);
        const item = document.getElementById('toggle-item-' + id);
        if (checkbox.checked) {
            delete hidden[id];
            if (el) el.classList.remove('hidden-widget');
            if (item) item.classList.remove('hidden-item');
        } else {
            hidden[id] = true;
            if (el) el.classList.add('hidden-widget');
            if (item) item.classList.add('hidden-item');
        }
        localStorage.setItem('sentinel_hidden_widgets', JSON.stringify(hidden));
    }

    function renderList(containerId, items) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        items.forEach(w => {
            const visible = isVisible(w.id);
            const item = document.createElement('div');
            item.className = 'toggle-item' + (visible ? '' : ' hidden-item');
            item.id = 'toggle-item-' + w.id;
            item.innerHTML = `
                <div class="toggle-item-label">
                    <i data-lucide="${w.icon}"></i>
                    ${w.label}
                </div>
                <label class="switch">
                    <input type="checkbox" ${visible ? 'checked' : ''}
                        onchange="(function(cb){ const h=JSON.parse(localStorage.getItem('sentinel_hidden_widgets')||'{}'); const el=document.getElementById('${w.id}'); const item=document.getElementById('toggle-item-${w.id}'); if(cb.checked){delete h['${w.id}'];if(el)el.classList.remove('hidden-widget');if(item)item.classList.remove('hidden-item');}else{h['${w.id}']=true;if(el)el.classList.add('hidden-widget');if(item)item.classList.add('hidden-item');} localStorage.setItem('sentinel_hidden_widgets',JSON.stringify(h)); })(this)">
                    <span class="slider"></span>
                </label>
            `;
            container.appendChild(item);
        });
        if (window.lucide) lucide.createIcons();
    }

    renderList('noc-toggles', WIDGETS.noc);
    renderList('panel-toggles', WIDGETS.panels);
}

// Apply saved layout visibility on page load
function applyStoredLayout() {
    const hidden = JSON.parse(localStorage.getItem('sentinel_hidden_widgets') || '{}');
    Object.keys(hidden).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden-widget');
    });
}
applyStoredLayout();

function renderFirewall(raw) {
    const view = document.getElementById('firewall-view');
    const lines = raw.split('\n').filter(l => l.startsWith('-A'));
    
    let html = `
        <div style="margin-bottom:1.5rem;">
            <div style="display:flex;gap:1rem;align-items:flex-end;flex-wrap:wrap;">
                <div>
                    <label style="display:block;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Chain</label>
                    <select id="fw-chain" style="background:var(--card-bg);color:var(--text-primary);border:1px solid var(--card-border);padding:0.5rem;border-radius:6px;">
                        <option>INPUT</option><option>OUTPUT</option><option>FORWARD</option>
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Protocolo</label>
                    <select id="fw-proto" style="background:var(--card-bg);color:var(--text-primary);border:1px solid var(--card-border);padding:0.5rem;border-radius:6px;">
                        <option value="tcp">TCP</option><option value="udp">UDP</option><option value="all">Todos</option>
                    </select>
                </div>
                <div>
                    <label style="display:block;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Porta</label>
                    <input id="fw-port" type="number" placeholder="ex: 80" style="background:var(--card-bg);color:var(--text-primary);border:1px solid var(--card-border);padding:0.5rem;border-radius:6px;width:100px;">
                </div>
                <div>
                    <label style="display:block;font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Ação</label>
                    <select id="fw-target" style="background:var(--card-bg);color:var(--text-primary);border:1px solid var(--card-border);padding:0.5rem;border-radius:6px;">
                        <option>ACCEPT</option><option>DROP</option><option>REJECT</option>
                    </select>
                </div>
                <button class="btn btn-primary" onclick="addFirewallRule()" style="padding:0.5rem 1.2rem;">
                    <i data-lucide="plus"></i> Adicionar Regra
                </button>
            </div>
            <p id="fw-status" style="margin-top:0.75rem;font-size:0.8rem;color:var(--accent-success);"></p>
        </div>
        <table class="premium-table">
            <thead>
                <tr>
                    <th>CHAIN</th>
                    <th>AÇÃO</th>
                    <th>PROTOCOLO</th>
                    <th>PORTA</th>
                    <th>ORIGEM</th>
                    <th>DESTINO</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
    `;

    lines.forEach((line, idx) => {
        const parts = line.split(' ');
        const chain = parts[1] || 'N/A';
        const target = line.includes('ACCEPT') ? 'ACCEPT' : (line.includes('DROP') ? 'DROP' : 'REJECT');
        const proto = line.includes('-p') ? parts[parts.indexOf('-p') + 1] : 'any';
        const port = line.includes('--dport') ? parts[parts.indexOf('--dport') + 1] : 'any';
        const src = line.includes('-s') ? parts[parts.indexOf('-s') + 1] : 'any';
        const dst = line.includes('-d') ? parts[parts.indexOf('-d') + 1] : 'any';

        const isIpBlock = src && src !== 'any';
        const actionButtonHtml = isIpBlock ? `
            <button onclick="deleteFirewallIp('${src}')" 
                style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;font-weight:600;">
                Desbloquear IP
            </button>
        ` : `
            <button onclick="deleteFirewallRule('${chain}','${proto}','${port}','${target}')" 
                style="background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.3);color:var(--accent-danger);padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;">
                Remover
            </button>
        `;

        html += `
            <tr>
                <td><code class="port-code">${chain}</code></td>
                <td><span class="badge ${target.toLowerCase()}">${target}</span></td>
                <td>${proto.toUpperCase()}</td>
                <td><code class="port-code">${port}</code></td>
                <td>${isIpBlock ? `<span style="color:var(--accent-primary); font-weight:600;">${src}</span>` : src}</td>
                <td>${dst}</td>
                <td>
                    ${actionButtonHtml}
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    view.innerHTML = html || '<p>Nenhuma regra personalizada encontrada.</p>';
    if (window.lucide) lucide.createIcons();
}

async function deleteFirewallIp(ip) {
    if (!confirm(`Deseja DESBLOQUEAR o IP ${ip} e restaurar o seu acesso à rede?`)) return;
    try {
        const res = await apiFetch(`${API_BASE}/firewall/block-ip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remove', ip: ip })
        });
        const data = await res.json();
        alert(data.message || `IP ${ip} desbloqueado com sucesso!`);
        // Reload firewall view
        const raw = await apiFetch(`${API_BASE}/firewall`).then(r => r.json());
        renderFirewall(raw.content);
    } catch (e) {
        alert('Erro ao desbloquear IP no firewall');
    }
}

async function addFirewallRule() {
    const chain = document.getElementById('fw-chain').value;
    const protocol = document.getElementById('fw-proto').value;
    const port = document.getElementById('fw-port').value;
    const target = document.getElementById('fw-target').value;
    const status = document.getElementById('fw-status');
    status.style.color = 'var(--accent-primary)';
    status.innerText = 'Aplicando regra...';
    try {
        const res = await apiFetch(`${API_BASE}/firewall/rule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', chain, protocol, port, target })
        });
        const data = await res.json();
        status.style.color = 'var(--accent-success)';
        status.innerText = data.message || data.error;
        // Reload firewall view
        const raw = await apiFetch(`${API_BASE}/firewall`).then(r => r.json());
        renderFirewall(raw.content);
    } catch (e) {
        status.style.color = 'var(--accent-danger)';
        status.innerText = 'Erro ao adicionar regra';
    }
}

async function deleteFirewallRule(chain, proto, port, target) {
    if (!confirm(`Remover regra: ${chain} ${proto} porta ${port} -> ${target}?`)) return;
    try {
        const res = await apiFetch(`${API_BASE}/firewall/rule`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', chain, protocol: proto, port: port !== 'any' ? port : '', target })
        });
        const data = await res.json();
        const raw = await apiFetch(`${API_BASE}/firewall`).then(r => r.json());
        renderFirewall(raw.content);
    } catch (e) { alert('Erro ao remover regra'); }
}


function renderNetwork(raw) {
    const view = document.getElementById('network-view');
    
    const ifaceRegex = /([0-9]+: [a-zA-Z0-9]+: [\s\S]*?)(?=\n[0-9]+: |$)/g;
    const interfaces = [...raw.matchAll(ifaceRegex)].map(m => m[1].trim());

    let html = '<div class="network-grid">';
    
    interfaces.forEach(iface => {
        const lines = iface.split('\n');
        const header = lines[0] || '';
        const nameMatch = header.match(/[0-9]+: ([^:]+):/);
        const name = nameMatch ? nameMatch[1].trim() : 'Interface';
        const state = (header.includes('UP') || header.includes('UNKNOWN')) ? 'UP' : 'DOWN';
        const ipv4Match = iface.match(/inet ([0-9.]+)/);
        const ipv4 = ipv4Match ? ipv4Match[1] : 'N/A';
        const ipv6Match = iface.match(/inet6 ([a-f0-9:]+)/);
        const ipv6 = ipv6Match ? ipv6Match[1] : 'N/A';
        const macMatch = iface.match(/link\/\S+ ([a-f0-9:]+)/);
        const mac = macMatch ? macMatch[1] : 'N/A';

        const isLoopback = name === 'lo' || name.startsWith('lo:') || name.startsWith('lo');
        html += `
            <div class="iface-card">
                <div class="iface-header">
                    <i data-lucide="server"></i>
                    <h4>${name}</h4>
                    <span class="state-dot ${state.toLowerCase()}"></span>
                </div>
                <div class="iface-body">
                    <div class="iface-row"><span>IPv4:</span> <strong>${ipv4}</strong></div>
                    <div class="iface-row"><span>IPv6:</span> <strong class="ipv6-text" style="word-break:break-all;">${ipv6}</strong></div>
                    <div class="iface-row"><span>Hardware:</span> <code>${mac}</code></div>
                    ${!isLoopback ? `
                    <button class="btn btn-primary" onclick="openEditInterfaceModal('${name}')" style="margin-top: 15px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 0.8rem; background: linear-gradient(135deg, #0ea5e9, #6366f1); border: none; box-shadow: 0 4px 10px rgba(14,165,233,0.2); padding: 8px 12px; border-radius: 8px; cursor: pointer;">
                        <i data-lucide="sliders"></i> CONFIGURAR
                    </button>
                    ` : `
                    <div style="margin-top: 15px; text-align: center; font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; opacity: 0.5; padding: 8px 0; border: 1px dashed rgba(255,255,255,0.06); border-radius: 8px;">
                        <i data-lucide="lock" style="width:12px; height:12px; vertical-align: -1.5px; margin-right:3px; display:inline-block;"></i> Leitura (Protegido)
                    </div>
                    `}
                </div>
            </div>
        `;
    });

    html += '</div>';

    // Add config editor below interfaces
    html += `
        <div style="margin-top:2rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;border-bottom:1px solid var(--card-border);padding-bottom:0.75rem;">
                <h3 id="net-config-header" style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Editar Arquivo de Configuração de Rede</h3>
                <button class="btn btn-primary" onclick="saveNetworkConfig()" style="padding:0.5rem 1.2rem;">
                    <i data-lucide="save"></i> Salvar e Aplicar
                </button>
            </div>
            <p id="net-config-status" style="font-size:0.8rem;color:var(--accent-success);margin-bottom:0.75rem;"></p>
            <div class="editor-container" style="margin-top:0;">
                <textarea id="net-config-editor" style="width:100%;height:280px;background:transparent;color:#10b981;border:none;font-family:'JetBrains Mono',monospace;font-size:13px;line-height:1.6;outline:none;resize:vertical;" spellcheck="false">Carregando...</textarea>
            </div>
            <input type="hidden" id="net-config-file" value="">
        </div>
    `;

    view.innerHTML = interfaces.length > 0 ? html : '<p class="loading">Sincronizando dados de infraestrutura...</p>';
    if (window.lucide) lucide.createIcons();

    // Load config file content
    apiFetch(`${API_BASE}/network/config`)
        .then(r => r.json())
        .then(data => {
            const editor = document.getElementById('net-config-editor');
            const fileInput = document.getElementById('net-config-file');
            const header = document.getElementById('net-config-header');
            if (data.error) {
                if (editor) editor.value = `# Erro ao carregar: ${data.error}`;
                return;
            }
            if (editor) editor.value = data.content || '# (arquivo vazio)';
            if (fileInput) fileInput.value = data.file || '';
            if (header) header.innerText = `Editar: ${data.file}`;
        })
        .catch(err => {
            const editor = document.getElementById('net-config-editor');
            if (editor) editor.value = `# Erro de conexão ao carregar configuração de rede.\n# Verifique as credenciais SSH e tente novamente.`;
        });
}

async function saveNetworkConfig() {
    const editor = document.getElementById('net-config-editor');
    const fileInput = document.getElementById('net-config-file');
    const status = document.getElementById('net-config-status');
    if (!editor || !fileInput || !status) return;
    status.style.color = 'var(--accent-primary)';
    status.innerText = 'Salvando...';
    try {
        const res = await apiFetch(`${API_BASE}/network/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: editor.value, file: fileInput.value })
        });
        const data = await res.json();
        status.style.color = data.error ? 'var(--accent-danger)' : 'var(--accent-success)';
        status.innerText = data.message || data.error;
    } catch (e) {
        status.style.color = 'var(--accent-danger)';
        status.innerText = 'Erro ao salvar configuração de rede';
    }
}

function openEditInterfaceModal(iface) {
    const modal = document.getElementById('network-edit-modal');
    const title = document.getElementById('net-edit-iface-title');
    const inputName = document.getElementById('net-edit-iface-name');
    const errDiv = document.getElementById('net-edit-modal-error');
    if (!modal || !title || !inputName) return;

    errDiv.innerText = '';
    title.innerText = `${iface} (Carregando...)`;
    inputName.value = iface;
    modal.style.display = 'flex';

    document.getElementById('net-edit-ipv4-method').value = 'auto';
    document.getElementById('net-edit-ipv4-ip').value = '';
    document.getElementById('net-edit-ipv4-cidr').value = '24';
    document.getElementById('net-edit-ipv4-gw').value = '';
    document.getElementById('net-edit-ipv4-dns').value = '';

    document.getElementById('net-edit-ipv6-method').value = 'auto';
    document.getElementById('net-edit-ipv6-ip').value = '';
    document.getElementById('net-edit-ipv6-prefix').value = '64';
    document.getElementById('net-edit-ipv6-gw').value = '';
    document.getElementById('net-edit-ipv6-dns').value = '';

    toggleIPMethodFields();

    if (window.lucide) lucide.createIcons();

    apiFetch(`${API_BASE}/network/details/${iface}`)
        .then(r => r.json())
        .then(data => {
            if (data.error) {
                errDiv.innerText = `Erro ao carregar detalhes: ${data.error}`;
                title.innerText = `${iface} (Erro)`;
                return;
            }
            title.innerText = `${iface} — Configurar`;
            
            document.getElementById('net-edit-ipv4-method').value = data.ipv4Method || 'auto';
            if (data.ipv4Address) {
                const parts = data.ipv4Address.split('/');
                document.getElementById('net-edit-ipv4-ip').value = parts[0] || '';
                document.getElementById('net-edit-ipv4-cidr').value = parts[1] || '24';
            }
            document.getElementById('net-edit-ipv4-gw').value = data.ipv4Gateway || '';
            document.getElementById('net-edit-ipv4-dns').value = data.ipv4Dns || '';

            document.getElementById('net-edit-ipv6-method').value = data.ipv6Method || 'auto';
            if (data.ipv6Address) {
                const parts = data.ipv6Address.split('/');
                document.getElementById('net-edit-ipv6-ip').value = parts[0] || '';
                document.getElementById('net-edit-ipv6-prefix').value = parts[1] || '64';
            }
            document.getElementById('net-edit-ipv6-gw').value = data.ipv6Gateway || '';
            document.getElementById('net-edit-ipv6-dns').value = data.ipv6Dns || '';

            toggleIPMethodFields();
        })
        .catch(err => {
            errDiv.innerText = `Erro de conexão ao carregar interface: ${err.message}`;
            title.innerText = `${iface} (Erro)`;
        });
}

function toggleIPMethodFields() {
    const v4Method = document.getElementById('net-edit-ipv4-method').value;
    const v4Static = document.getElementById('net-edit-ipv4-static-fields');
    if (v4Static) {
        v4Static.style.display = v4Method === 'manual' ? 'flex' : 'none';
    }

    const v6Method = document.getElementById('net-edit-ipv6-method').value;
    const v6Static = document.getElementById('net-edit-ipv6-static-fields');
    if (v6Static) {
        v6Static.style.display = v6Method === 'manual' ? 'flex' : 'none';
    }
}

function closeNetworkEditModal() {
    const modal = document.getElementById('network-edit-modal');
    if (modal) modal.style.display = 'none';
}

async function saveNetworkInterfaceConfig() {
    const iface = document.getElementById('net-edit-iface-name').value;
    const errDiv = document.getElementById('net-edit-modal-error');
    if (!iface || !errDiv) return;

    errDiv.innerText = '';

    const ipv4Method = document.getElementById('net-edit-ipv4-method').value;
    const ipv4Ip = document.getElementById('net-edit-ipv4-ip').value.trim();
    const ipv4Cidr = document.getElementById('net-edit-ipv4-cidr').value.trim();
    const ipv4Gateway = document.getElementById('net-edit-ipv4-gw').value.trim();
    const ipv4Dns = document.getElementById('net-edit-ipv4-dns').value.trim();

    const ipv6Method = document.getElementById('net-edit-ipv6-method').value;
    const ipv6Ip = document.getElementById('net-edit-ipv6-ip').value.trim();
    const ipv6Prefix = document.getElementById('net-edit-ipv6-prefix').value.trim();
    const ipv6Gateway = document.getElementById('net-edit-ipv6-gw').value.trim();
    const ipv6Dns = document.getElementById('net-edit-ipv6-dns').value.trim();

    if (ipv4Method === 'manual') {
        if (!ipv4Ip) { errDiv.innerText = 'O endereço IP IPv4 é obrigatório.'; return; }
        if (!ipv4Cidr || isNaN(ipv4Cidr) || ipv4Cidr < 1 || ipv4Cidr > 32) { errDiv.innerText = 'Prefixo CIDR IPv4 deve ser entre 1 e 32.'; return; }
        const ipRegex = /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/;
        if (!ipRegex.test(ipv4Ip)) { errDiv.innerText = 'Endereço IP IPv4 inválido.'; return; }
        if (ipv4Gateway && !ipRegex.test(ipv4Gateway)) { errDiv.innerText = 'Gateway IPv4 inválido.'; return; }
    }

    if (ipv6Method === 'manual') {
        if (!ipv6Ip) { errDiv.innerText = 'O endereço IP IPv6 é obrigatório.'; return; }
        if (!ipv6Prefix || isNaN(ipv6Prefix) || ipv6Prefix < 1 || ipv6Prefix > 128) { errDiv.innerText = 'Prefixo IPv6 deve ser entre 1 e 128.'; return; }
    }

    const payload = {
        iface,
        ipv4Method,
        ipv4Address: ipv4Method === 'manual' ? `${ipv4Ip}/${ipv4Cidr}` : '',
        ipv4Gateway: ipv4Method === 'manual' ? ipv4Gateway : '',
        ipv4Dns: ipv4Method === 'manual' ? ipv4Dns : '',
        ipv6Method,
        ipv6Address: ipv6Method === 'manual' ? `${ipv6Ip}/${ipv6Prefix}` : '',
        ipv6Gateway: ipv6Method === 'manual' ? ipv6Gateway : '',
        ipv6Dns: ipv6Method === 'manual' ? ipv6Dns : ''
    };

    try {
        const res = await apiFetch(`${API_BASE}/network/configure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.error) {
            errDiv.innerText = data.error;
            return;
        }

        closeNetworkEditModal();

        const overlay = document.getElementById('network-redirect-overlay');
        const countdownDiv = document.getElementById('redirect-countdown');
        const manualLinkContainer = document.getElementById('redirect-manual-link-container');
        const manualLink = document.getElementById('redirect-manual-link');
        const messageDiv = document.getElementById('redirect-overlay-message');

        if (overlay && countdownDiv) {
            overlay.style.display = 'flex';
            if (window.lucide) lucide.createIcons();

            let count = 15;
            countdownDiv.innerText = count;

            const targetIp = data.redirectIp || window.location.hostname;
            const newUrl = `http://${targetIp}:3300/`;

            if (data.redirectIp) {
                messageDiv.innerHTML = `O adaptador de rede está sendo reiniciado. Como você configurou um IP estático, o painel passará a rodar em: <strong style="color:#0ea5e9;">http://${targetIp}:3300/</strong>.<br>Redirecionando em breve...`;
                if (manualLink) {
                    manualLink.href = newUrl;
                    if (manualLinkContainer) manualLinkContainer.style.display = 'block';
                }
            } else {
                messageDiv.innerText = `O adaptador de rede está sendo reiniciado. Tentando restabelecer conexão com o painel...`;
            }

            const interval = setInterval(() => {
                count--;
                countdownDiv.innerText = count;
                if (count <= 0) {
                    clearInterval(interval);
                    window.location.href = newUrl;
                }
            }, 1000);
        }
    } catch (e) {
        errDiv.innerText = `Erro de conexão ao salvar configuração: ${e.message}`;
    }
}

function closeConfigModule() {
    const grid = document.querySelector('.config-grid');
    const area = document.getElementById('config-module-area');
    const intro = document.querySelector('.config-intro');
    
    if (!grid || !area || !intro) return;

    intro.style.display = 'block';
    grid.style.display = 'grid';
    area.style.display = 'none';
}

async function loadConfig() {
    const selector = document.getElementById('config-selector');
    const editor = document.getElementById('config-editor');
    const visualAC = document.getElementById('access-control-view');
    if (!selector || !editor || !visualAC) return;

    const file = selector.value;
    editor.value = 'Carregando...';

    // Detecção inteligente do modo visual
    const moduleTitle = document.getElementById('module-title')?.innerText || '';
    const isACModule = moduleTitle.includes('Controle de Acesso');
    const isSDNSModule = moduleTitle.includes('Sistemas Internos');

    try {
        const res = await apiFetch(`${API_BASE}/config/${file}`);
        const data = await res.json();
        const content = data.content || '';

        if (isACModule || file === 'access-control.conf') {
            editor.style.display = 'none';
            visualAC.style.display = 'block';
            document.getElementById('static-dns-view').style.display = 'none';
            document.getElementById('blacklist-view').style.display = 'none';
            
            // Busca o status real via API
            apiFetch(`${API_BASE}/dns-acl`)
                .then(r => r.json())
                .then(aclData => {
                    const badge = document.getElementById('ac-mode-badge');
                    const toggle = document.getElementById('ac-restrict-toggle');
                    if (badge && toggle) {
                        toggle.checked = aclData.isRestricted;
                        if (aclData.isRestricted) {
                            badge.innerText = 'RESTRITO';
                            badge.style.backgroundColor = 'rgba(244, 63, 94, 0.2)';
                            badge.style.color = '#f43f5e';
                            badge.style.border = '1px solid rgba(244, 63, 94, 0.4)';
                        } else {
                            badge.innerText = 'ABERTO (PÚBLICO)';
                            badge.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
                            badge.style.color = '#10b981';
                            badge.style.border = '1px solid rgba(16, 185, 129, 0.4)';
                        }
                    }
                }).catch(e => {
                    console.error("Erro ao carregar status do DNS ACL", e);
                    const badge = document.getElementById('ac-mode-badge');
                    if (badge && badge.innerText === 'Carregando...') {
                        badge.innerText = 'ERRO';
                        badge.style.backgroundColor = 'rgba(244, 63, 94, 0.2)';
                        badge.style.color = '#f43f5e';
                    }
                });

            renderAccessControl(content);
        } else if (isSDNSModule || file === 'static-dns.conf') {
            editor.style.display = 'none';
            visualAC.style.display = 'none';
            document.getElementById('blacklist-view').style.display = 'none';
            document.getElementById('static-dns-view').style.display = 'block';
            renderStaticDNS(content);
        } else if (moduleTitle.includes('Blacklist') || (file === 'local-zone.conf' && document.getElementById('blacklist-view').style.display === 'block')) {
            editor.style.display = 'none';
            visualAC.style.display = 'none';
            document.getElementById('static-dns-view').style.display = 'none';
            document.getElementById('blacklist-view').style.display = 'block';
            renderBlacklist(content);
        } else if (file === 'static-dns.conf' && (!content || content.trim() === '')) {
            editor.style.display = 'block';
            visualAC.style.display = 'none';
            document.getElementById('blacklist-view').style.display = 'none';
            editor.value = `# ==========================================================
#  SENTINEL DNS - SISTEMAS INTERNOS (STATIC)
#  Estes domínios continuam funcionando mesmo sem internet.
# ==========================================================
server:

# 1. Defina a zona como 'static'
# local-zone: "meusistema.lan" static

# 2. Adicione os registros A (IP)
# local-data: "meusistema.lan IN A 192.168.1.10"
# local-data: "erp.meusistema.lan IN A 192.168.1.11"

# 3. Exemplo de DNS Transparente (Resolve local, mas se não tiver cai no recursivo)
# local-zone: "empresa.com.br" transparent
# local-data: "interno.empresa.com.br IN A 192.168.1.20"
`;
        } else {
            editor.value = content;
        }
    } catch (err) { 
        editor.value = 'Acesso negado ou erro ao carregar'; 
    }
}

// ===== VISUAL ACCESS CONTROL LOGIC =====
let currentACRules = [];

function renderAccessControl(raw) {
    const lines = raw.split('\n');
    currentACRules = [];
    let isRestricted = false;
    
    lines.forEach(line => {
        const match = line.match(/access-control:\s*([^\s]+)\s+([^\s]+)/i);
        if (match) {
            const ip = match[1];
            const action = match[2].toLowerCase();
            if ((ip === '0.0.0.0/0' || ip === '::/0') && (action === 'refuse' || action === 'deny')) {
                // Status gerido pela API
            } else if (ip !== '127.0.0.0/8' && ip !== '::1') {
                currentACRules.push({ ip, action });
            }
        }
    });
    
    displayACRules();
}

async function toggleRestrictMode() {
    const toggle = document.getElementById('ac-restrict-toggle');
    if (!toggle) return;
    const enable = toggle.checked;
    
    const originalText = toggle.parentElement.previousElementSibling.innerText;
    toggle.parentElement.previousElementSibling.innerText = 'Aguarde...';
    
    try {
        const res = await apiFetch(`${API_BASE}/dns-acl/restrict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enable })
        });
        const data = await res.json();
        if (data.error) {
            alert(data.error);
            toggle.checked = !enable;
            toggle.parentElement.previousElementSibling.innerText = originalText;
            return;
        }
        loadConfig(); // Recarrega para atualizar a interface
    } catch (e) {
        alert('Erro ao alterar modo restrito');
        toggle.checked = !enable;
        toggle.parentElement.previousElementSibling.innerText = originalText;
    }
}

function displayACRules() {
    const container = document.getElementById('ac-rules-container');
    const search = document.getElementById('ac-search').value.toLowerCase();
    if (!container) return;

    container.innerHTML = currentACRules
        .filter(r => r.ip.toLowerCase().includes(search) || r.action.toLowerCase().includes(search))
        .map((r, idx) => `
            <div class="ac-rule-card">
                <div class="ac-info">
                    <span class="ac-ip">${r.ip}</span>
                    <span class="ac-tag ${r.action}">${r.action.toUpperCase()}</span>
                </div>
                <button class="btn-remove-ac" onclick="removeAccessControlRule(${idx})">
                    <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                </button>
            </div>
        `).join('');

    if (window.lucide) lucide.createIcons();
    syncACWithEditor();
}

function addAccessControlRule() {
    const ipInput = document.getElementById('ac-ip-input');
    const actionSelect = document.getElementById('ac-action-select');
    if (!ipInput || !actionSelect) return;

    const ip = ipInput.value.trim();
    const action = actionSelect.value;

    if (!ip) return alert('Por favor, insira um IP ou Bloco CIDR');
    
    // Validação básica de formato CIDR ou IP
    const ipPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$/;
    if (!ipPattern.test(ip)) {
        return alert('Formato de IP ou CIDR inválido. Exemplo: 192.168.1.0/24');
    }

    // Verifica se já existe
    if (currentACRules.some(r => r.ip === ip)) {
        return alert('Este bloco já está na lista');
    }

    currentACRules.unshift({ ip, action });
    ipInput.value = '';
    displayACRules();
}

function removeAccessControlRule(index) {
    currentACRules.splice(index, 1);
    displayACRules();
}

function filterACRules() {
    displayACRules();
}

function syncACWithEditor() {
    const selector = document.getElementById('config-selector');
    const editor = document.getElementById('config-editor');
    if (!editor || !selector) return;

    const file = selector.value;
    if (file === 'unbound.conf' || file === 'local-zone.conf') {
        const lines = editor.value.split('\n');
        const nonACLines = lines.filter(l => !l.trim().toLowerCase().startsWith('access-control:'));
        
        while (nonACLines.length > 0 && nonACLines[nonACLines.length-1].trim() === '') {
            nonACLines.pop();
        }

        const acLines = currentACRules.map(r => `access-control: ${r.ip} ${r.action}`);
        editor.value = [...nonACLines, '', '# --- BLOCO DE ACESSO GERADO PELO SENTINEL ---', ...acLines].join('\n');
    } else {
        editor.value = currentACRules.map(r => `access-control: ${r.ip} ${r.action}`).join('\n');
    }
}

// ===== VISUAL STATIC DNS LOGIC =====
let currentStaticDNS = [];

function renderStaticDNS(raw) {
    const lines = raw.split('\n');
    currentStaticDNS = [];
    
    let currentName = '';
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('# NAME:')) {
            currentName = trimmed.replace('# NAME:', '').trim();
        } else if (trimmed.startsWith('local-data:')) {
            // Pega o conteúdo entre aspas
            const quoteMatch = trimmed.match(/"([^"]+)"/);
            if (quoteMatch) {
                const parts = quoteMatch[1].trim().split(/\s+/);
                if (parts.length >= 2) {
                    const domain = parts[0];
                    const ip = parts[parts.length - 1];
                    const displayName = currentName || (domain.endsWith('.') ? domain.slice(0, -1) : domain);
                    
                    currentStaticDNS.push({ 
                        name: displayName, 
                        domain: domain, 
                        ip: ip 
                    });
                }
                currentName = '';
            }
        }
    });
    displayStaticDNS();
}

function displayStaticDNS() {
    const container = document.getElementById('sdns-container');
    const search = document.getElementById('sdns-search').value.toLowerCase();
    if (!container) return;

    container.innerHTML = currentStaticDNS
        .filter(r => r.name.toLowerCase().includes(search) || r.domain.toLowerCase().includes(search) || r.ip.includes(search))
        .map((r, idx) => `
            <div class="ac-rule-card">
                <div class="ac-info">
                    <span class="ac-ip" style="color:var(--accent-primary)">${r.name}</span>
                    <span style="font-size:0.75rem; opacity:0.7; font-family:'JetBrains Mono'">${r.domain}</span>
                    <span class="ac-tag static">${r.ip}</span>
                </div>
                <button class="btn-remove-ac" onclick="removeStaticDNSRule(${idx})">
                    <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                </button>
            </div>
        `).join('');

    if (window.lucide) lucide.createIcons();
    syncStaticWithEditor();
}

function addStaticDNSRule() {
    const nameIn = document.getElementById('sdns-name-input');
    const domIn = document.getElementById('sdns-domain-input');
    const ipIn = document.getElementById('sdns-ip-input');
    
    if (!domIn || !ipIn) return;
    const name = nameIn.value.trim();
    const domain = domIn.value.trim();
    const ip = ipIn.value.trim();

    if (!domain || !ip) return alert('Domínio e IP são obrigatórios');

    currentStaticDNS.unshift({ name: name || domain, domain, ip });
    nameIn.value = ''; domIn.value = ''; ipIn.value = '';
    displayStaticDNS();
}

function removeStaticDNSRule(index) {
    currentStaticDNS.splice(index, 1);
    displayStaticDNS();
}

function filterStaticDNS() {
    displayStaticDNS();
}

function syncStaticWithEditor() {
    const editor = document.getElementById('config-editor');
    if (!editor) return;

    const domains = [...new Set(currentStaticDNS.map(r => r.domain))];
    const zones = domains.map(d => `local-zone: "${d}" static`).join('\n');
    const records = currentStaticDNS.map(r => `# NAME: ${r.name}\nlocal-data: "${r.domain} IN A ${r.ip}"`).join('\n');
    
    editor.value = `# ==========================================\n#  SENTINEL STATIC DNS CONFIG\n# ==========================================\n\n${zones}\n\n${records}`;
}

// ===== VISUAL BLACKLIST LOGIC =====
let currentBlacklist = [];

function renderBlacklist(raw) {
    const lines = raw.split('\n');
    currentBlacklist = [];
    
    // Suportar tanto always_nxdomain quanto always_refuse ou deny
    lines.forEach(line => {
        const match = line.match(/local-zone:\s*"([^"]+)"\s+(always_nxdomain|always_refuse|deny)/i);
        if (match) {
            currentBlacklist.push({ domain: match[1] });
        }
    });
    
    displayBlacklist();
}

function displayBlacklist() {
    const container = document.getElementById('bl-rules-container');
    const search = document.getElementById('bl-search')?.value.toLowerCase() || '';
    if (!container) return;

    container.innerHTML = currentBlacklist
        .filter(r => r.domain.toLowerCase().includes(search))
        .map((r, idx) => `
            <div class="ac-rule-card" style="border-left: 4px solid var(--accent-danger)">
                <div class="ac-info">
                    <span class="ac-ip" style="color:var(--text-primary)">${r.domain}</span>
                    <span class="ac-tag" style="background:rgba(239,68,68,0.2); color:#ef4444;">BLOQUEADO</span>
                </div>
                <button class="btn-remove-ac" onclick="removeBlacklistRule(${idx})">
                    <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                </button>
            </div>
        `).join('');

    if (window.lucide) lucide.createIcons();
    syncBlacklistWithEditor();
}

function addBlacklistRule() {
    const input = document.getElementById('bl-domain-input');
    if (!input) return;
    const domain = input.value.trim().toLowerCase();
    
    if (!domain) return alert('Por favor, insira um domínio.');
    
    if (currentBlacklist.some(r => r.domain === domain)) {
        return alert('Este domínio já está na Blacklist!');
    }
    
    currentBlacklist.unshift({ domain });
    input.value = '';
    displayBlacklist();
}

function removeBlacklistRule(idx) {
    currentBlacklist.splice(idx, 1);
    displayBlacklist();
}

function filterBlacklist() {
    displayBlacklist();
}

function syncBlacklistWithEditor() {
    let editor = document.getElementById('config-editor');
    if (!editor) return;

    let content = `# ==========================================================
#  SENTINEL DNS - BLACKLIST (DOMÍNIOS BLOQUEADOS)
# ==========================================================
# Atenção: Esta lista é gerenciada pelo painel visual.
server:
`;
    
    currentBlacklist.forEach(r => {
        content += `\n  local-zone: "${r.domain}" always_nxdomain`;
    });
    
    editor.value = content;
}

async function saveConfig() {
    const selector = document.getElementById('config-selector');
    const editor = document.getElementById('config-editor');
    const status = document.getElementById('save-status');
    const moduleTitle = document.getElementById('module-title')?.innerText || '';
    
    if (!selector || !editor || !status) return;
    
    const file = selector.value;
    let content = editor.value;

    // Proteção Especial para Controle de Acesso (Evitar Lock-out em Produção)
    if (file === 'access-control.conf' || moduleTitle.includes('Controle de Acesso')) {
        if (currentACRules.length === 0) {
            const confirmEmpty = confirm("⚠️ ATENÇÃO: A lista de Controle de Acesso está VAZIA.\n\nIsso pode bloquear o acesso DNS para TODOS os seus clientes agora.\n\nDeseja realmente salvar assim?");
            if (!confirmEmpty) return;
        }
        // Gera o conteúdo baseado nas regras visuais
        content = currentACRules.map(r => `access-control: ${r.ip} ${r.action}`).join('\n');
    }

    status.innerText = 'Salvando...';
    status.style.color = 'var(--accent-primary)';

    try {
        const res = await apiFetch(`${API_BASE}/config/${file}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        
        if (res.ok) {
            status.innerText = 'SUCESSO';
            status.style.color = 'var(--accent-success)';
            // Se for arquivo de configuração, tenta aplicar reiniciando o serviço se necessário
            if (file.endsWith('.conf')) {
                status.innerText = 'REINICIANDO DNS...';
                await apiFetch(`${API_BASE}/service/restart`, { method: 'POST' });
                status.innerText = 'CONFIGURAÇÃO APLICADA';
            }
        } else {
            status.innerText = 'ERRO: ' + (data.error || 'Falha ao salvar');
            status.style.color = 'var(--accent-danger)';
        }
    } catch (err) { 
        status.innerText = 'FALHA: ' + err.message;
        status.style.color = 'var(--accent-danger)';
    }
}

async function serviceAction(action) {
    if (!confirm(`Confirmar ${action}?`)) return;
    try {
        const res = await apiFetch(`${API_BASE}/service/${action}`, { method: 'POST' });
        const data = await res.json();
        alert(data.message);
        refreshAll();
    } catch (err) { alert('Ação falhou ou acesso negado'); }
}

async function clearLogs() {
    if (!confirm('Limpar todos os logs agora?')) return;
    try {
        await apiFetch(`${API_BASE}/logs/clear`, { method: 'POST' });
        refreshAll();
    } catch (err) { alert('Falha ao limpar ou acesso negado'); }
}

async function fetchSettings() {
    try {
        const res = await apiFetch(`${API_BASE}/settings`);
        if (!res.ok) return;
        const data = await res.json();
        const toggle = document.getElementById('auto-cleanup-toggle');
        if (toggle) toggle.checked = data.autoCleanup;
    } catch (e) {}
}

async function fetchLogs() {
    const terminal = document.getElementById('log-terminal');
    if (!terminal) return;
    try {
        const res = await apiFetch(`${API_BASE}/logs`);
        const data = await res.json();
        if (data.logs) {
            terminal.innerText = data.logs;
            terminal.scrollTop = terminal.scrollHeight;
        }
    } catch (e) {
        terminal.innerText = 'Autenticação necessária para ver logs...';
    }
}

async function toggleAutoCleanup() {
    const toggle = document.getElementById('auto-cleanup-toggle');
    if (!toggle) return;
    const autoCleanup = toggle.checked;
    try {
        await apiFetch(`${API_BASE}/settings`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ autoCleanup })
        });
    } catch (e) {
        toggle.checked = !autoCleanup;
    }
}

async function runBenchmark() {
    const btn = document.getElementById('run-benchmark-btn');
    const loader = document.getElementById('benchmark-loader');
    const resultsContainer = document.getElementById('benchmark-results');
    const targetInput = document.getElementById('benchmark-target');
    const categorySelect = document.getElementById('benchmark-category');
    const insightsContainer = document.getElementById('benchmark-insights');
    if (!btn || !loader || !charts.benchmark) return;

    if ((!localStorage.getItem('sentinel_user'))) {
        showLogin();
        return;
    }

    if (!currentFeatures.benchmark) {
        alert("O recurso de Benchmark está disponível apenas na licença PRO.");
        return;
    }

    const target = targetInput ? targetInput.value.trim() : '';
    const category = categorySelect ? categorySelect.value : 'popular';
    
    btn.disabled = true;
    loader.style.display = 'block';
    if (resultsContainer) resultsContainer.style.display = 'none';
    if (insightsContainer) insightsContainer.style.display = 'none';

    // Simulated Active Progress Loading Steps
    const loaderText = document.getElementById('benchmark-loader-text');
    const steps = [
        "Iniciando testes comparativos de latência...",
        "Testando Sentinel (Local) nos domínios...",
        "Testando Google DNS (8.8.8.8)...",
        "Testando Cloudflare DNS (1.1.1.1)...",
        "Testando Quad9 (9.9.9.9)...",
        "Testando OpenDNS (208.67.222.222)...",
        "Calculando médias e construindo gráficos...",
        "Finalizando insights de performance..."
    ];
    let currentStep = 0;
    if (loaderText) loaderText.textContent = steps[0];
    const stepInterval = setInterval(() => {
        currentStep++;
        if (currentStep < steps.length) {
            if (loaderText) loaderText.textContent = steps[currentStep];
        }
    }, 1200);
    
    try {
        const query = `?category=${category}${target ? '&target=' + encodeURIComponent(target) : ''}`;
        const res = await apiFetch(`${API_BASE}/benchmark${query}`);
        const data = await res.json();
        
        // Expose data globally for the copy function
        window.lastBenchmarkData = { data, category, target };

        // Update Main Chart
        charts.benchmark.updateOptions({
            xaxis: { categories: data.map(d => d.name) }
        });
        charts.benchmark.updateSeries([{
            name: 'Média (ms)',
            data: data.map(d => d.avg)
        }]);

        // Calculate statistics
        const sentinelData = data.find(d => d.name.toLowerCase().includes('sentinel')) || { avg: 0.5 };
        const sentinelAvg = sentinelData.avg || 0.5;
        const globalServers = data.filter(d => !d.name.toLowerCase().includes('sentinel'));
        const globalAvg = globalServers.reduce((acc, curr) => acc + curr.avg, 0) / (globalServers.length || 1);
        const speedupPct = sentinelAvg < globalAvg ? Math.round(((globalAvg - sentinelAvg) / globalAvg) * 100) : 0;

        // Rank determination
        let rank = 'D';
        let rankTitle = 'Lento';
        let rankColor = '#f43f5e';
        if (sentinelAvg <= 1.0) {
            rank = 'S+';
            rankTitle = 'Desempenho Soberano';
            rankColor = '#10b981';
        } else if (sentinelAvg <= 5.0) {
            rank = 'A+';
            rankTitle = 'Otimização Extrema';
            rankColor = '#10b981';
        } else if (sentinelAvg <= 15.0) {
            rank = 'A';
            rankTitle = 'Excelente';
            rankColor = '#38bdf8';
        } else if (sentinelAvg <= 35.0) {
            rank = 'B';
            rankTitle = 'Bom / Estável';
            rankColor = '#f59e0b';
        } else if (sentinelAvg <= 70.0) {
            rank = 'C';
            rankTitle = 'Regular';
            rankColor = '#f43f5e';
        }

        const pct = Math.max(5, Math.min(100, (1 - (sentinelAvg / 150)) * 100));
        const strokeOffset = 345 - (345 * pct / 100);

        // Inject Premium Insights Panel
        if (insightsContainer) {
            insightsContainer.style.display = 'block';
            insightsContainer.innerHTML = `
                <div class="insights-panel" style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.5), rgba(15, 23, 42, 0.8)); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 2rem; display: flex; flex-direction: row; gap: 2.5rem; flex-wrap: wrap; box-shadow: 0 20px 50px rgba(0,0,0,0.4), inset 0 0 20px rgba(56, 189, 248, 0.05); position: relative; overflow: hidden; backdrop-filter: blur(12px);">
                    <div style="position: absolute; top: -50px; left: -50px; width: 150px; height: 150px; background: rgba(56, 189, 248, 0.15); filter: blur(50px); border-radius: 50%; pointer-events: none;"></div>
                    <div style="position: absolute; bottom: -50px; right: -50px; width: 150px; height: 150px; background: rgba(16, 185, 129, 0.15); filter: blur(50px); border-radius: 50%; pointer-events: none;"></div>

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 180px; flex-shrink: 0; text-align: center; border-right: 1px solid rgba(255,255,255,0.08); padding-right: 2.5rem;">
                        <div class="score-ring-wrapper" style="position: relative; width: 130px; height: 130px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;">
                            <svg style="position: absolute; transform: rotate(-90deg); width: 130px; height: 130px;">
                                <circle cx="65" cy="65" r="55" stroke="rgba(255,255,255,0.03)" stroke-width="8" fill="transparent" />
                                <circle cx="65" cy="65" r="55" stroke="${rankColor}" stroke-dasharray="345" stroke-dashoffset="${strokeOffset}" stroke-width="8" fill="transparent" stroke-linecap="round" style="filter: drop-shadow(0 0 8px ${rankColor}80); transition: stroke-dashoffset 2s cubic-bezier(0.22, 1, 0.36, 1);" />
                            </svg>
                            <div style="font-size: 3.5rem; font-weight: 900; color: ${rankColor}; font-family: 'Inter', sans-serif; text-shadow: 0 0 20px ${rankColor}b0; animation: scalePulse 2s infinite ease-in-out;">
                                ${rank}
                            </div>
                        </div>
                        <span style="font-size: 0.7rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 2px;">SENTINEL RANK</span>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${rankColor}; box-shadow: 0 0 10px ${rankColor}; animation: pulseGlow 1.5s infinite;"></span>
                            <span style="font-size: 0.8rem; font-weight: 700; color: #f8fafc;">${rankTitle}</span>
                        </div>
                    </div>

                    <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; min-width: 250px;">
                        <div>
                            <h3 style="margin: 0 0 0.75rem 0; font-size: 1.3rem; font-weight: 800; background: linear-gradient(90deg, #f8fafc, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Análise Dinâmica de Performance</h3>
                            <p style="margin: 0 0 1.25rem 0; color: var(--text-secondary); font-size: 0.9rem; line-height: 1.6;">
                                O resolver local <strong>Sentinel (Local)</strong> respondeu em média em <strong style="color: ${rankColor}; font-family: 'JetBrains Mono'; font-size: 1rem;">${sentinelAvg.toFixed(2)} ms</strong>. 
                                Isso representa um aumento de performance de <strong style="color: #10b981; font-family: 'JetBrains Mono'; font-size: 1rem;">${speedupPct}%</strong> comparado à média de latency dos provedores externos comuns (<strong style="color: #cbd5e1; font-family: 'JetBrains Mono';">${globalAvg.toFixed(1)} ms</strong>).
                            </p>
                            
                            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
                                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem 1rem; border-radius: 12px; flex: 1; min-width: 120px;">
                                    <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px;">Média Local</div>
                                    <div style="font-size: 1.25rem; font-weight: 800; font-family: 'JetBrains Mono'; color: #38bdf8; margin-top: 4px;">${sentinelAvg.toFixed(2)}<span style="font-size:0.75rem; font-weight:normal; opacity:0.6; margin-left:2px;">ms</span></div>
                                </div>
                                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem 1rem; border-radius: 12px; flex: 1; min-width: 120px;">
                                    <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px;">Média Global</div>
                                    <div style="font-size: 1.25rem; font-weight: 800; font-family: 'JetBrains Mono'; color: #cbd5e1; margin-top: 4px;">${globalAvg.toFixed(1)}<span style="font-size:0.75rem; font-weight:normal; opacity:0.6; margin-left:2px;">ms</span></div>
                                </div>
                                <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem 1rem; border-radius: 12px; flex: 1; min-width: 120px;">
                                    <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 1px;">Eficiência</div>
                                    <div style="font-size: 1.25rem; font-weight: 800; font-family: 'JetBrains Mono'; color: #10b981; margin-top: 4px;">${speedupPct}%<span style="font-size:0.65rem; font-weight:700; color:#10b981; margin-left:4px; vertical-align:middle; text-transform:uppercase;">⚡</span></div>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                            <button class="btn btn-secondary" onclick="copyBenchmarkReport()" style="display: flex; align-items: center; gap: 8px; padding: 0.6rem 1.2rem; font-size: 0.8rem; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #f8fafc; font-weight: 600; cursor: pointer; transition: all 0.3s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'; this.style.borderColor='rgba(56,189,248,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.04)'; this.style.borderColor='rgba(255,255,255,0.08)'">
                                <i data-lucide="copy" style="width: 16px; height: 16px;"></i> COPIAR RELATÓRIO MARKDOWN
                            </button>
                            <span id="copy-success-msg" style="font-size: 0.8rem; color: #10b981; font-weight: 600; display: none; align-items: center; gap: 4px;">
                                <i data-lucide="check-circle" style="width: 14px; height: 14px;"></i> Copiado para a área de transferência!
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Render Premium Leaderboard
        if (resultsContainer) {
            resultsContainer.style.display = 'grid';
            const sortedData = [...data].sort((a,b) => a.avg - b.avg);
            const winnerAvg = sortedData[0].avg;
            
            resultsContainer.innerHTML = sortedData.map(d => {
                const isWinner = d.avg === winnerAvg;
                let rankVal = 'D';
                if (d.avg < 15) rankVal = 'A+';
                else if (d.avg < 40) rankVal = 'A';
                else if (d.avg < 80) rankVal = 'B';
                else if (d.avg < 150) rankVal = 'C';

                const color = d.avg < 15 ? '#10b981' : (d.avg < 40 ? '#38bdf8' : '#f43f5e');

                return `
                    <div class="benchmark-card ${isWinner ? 'winner' : ''}" style="border-left: 4px solid ${color}">
                        <div class="rank-badge" style="color: ${color}">${rankVal}</div>
                        ${isWinner ? '<div class="winner-label"><i data-lucide="award" style="width:12px;height:12px;"></i> MELHOR PERFORMANCE</div>' : ''}
                        <div class="benchmark-header">
                            <span class="benchmark-name">${d.name}</span>
                            <span class="benchmark-avg" style="color: ${color}">${d.avg.toFixed(1)}<span>ms</span></span>
                        </div>
                        <div class="benchmark-details">
                            ${d.details.map(det => `
                                <div style="margin-bottom:12px;">
                                    <div class="detail-row">
                                        <span style="font-size:0.75rem; color:var(--text-secondary);">${det.domain}</span>
                                        <span style="font-weight:700; font-family:'JetBrains Mono'; font-size:0.8rem;">${det.time}ms</span>
                                    </div>
                                    <div class="detail-bar-bg">
                                        <div class="detail-bar-fill" style="width: ${Math.min(100, (det.time/200)*100)}%; background: ${det.time < 50 ? '#10b981' : (det.time < 150 ? '#f59e0b' : '#f43f5e')}; box-shadow: 0 0 10px ${det.time < 50 ? 'rgba(16,185,129,0.3)' : 'transparent'}"></div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }).join('');
        }
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        alert('Erro ao rodar benchmark: ' + err.message);
    } finally {
        clearInterval(stepInterval);
        btn.disabled = false;
        loader.style.display = 'none';
    }
}

// Global copy function for Markdown Benchmark Report
window.copyBenchmarkReport = function() {
    if (!window.lastBenchmarkData) return;
    const { data, category, target } = window.lastBenchmarkData;
    const sentinelData = data.find(d => d.name.toLowerCase().includes('sentinel')) || { avg: 0.5 };
    const sentinelAvg = sentinelData.avg || 0.5;
    const globalServers = data.filter(d => !d.name.toLowerCase().includes('sentinel'));
    const globalAvg = globalServers.reduce((acc, curr) => acc + curr.avg, 0) / (globalServers.length || 1);
    const speedupPct = sentinelAvg < globalAvg ? Math.round(((globalAvg - sentinelAvg) / globalAvg) * 100) : 0;
    
    let markdown = `### 📊 RELATÓRIO COMPARATIVO DE LATÊNCIA DNS - SENTINEL SPEED TEST\n\n`;
    markdown += `* **Data do Teste:** ${new Date().toLocaleString()}\n`;
    markdown += `* **Categoria Testada:** ${category.toUpperCase()}\n`;
    if (target) {
        markdown += `* **Domínio Específico:** \`${target}\`\n`;
    }
    markdown += `\n#### ⚡ RESUMO DE PERFORMANCE\n`;
    markdown += `* **Média Sentinel (Local):** **${sentinelAvg.toFixed(2)} ms**\n`;
    markdown += `* **Média Provedores Globais:** **${globalAvg.toFixed(1)} ms**\n`;
    markdown += `* **Ganho de Performance:** **+${speedupPct}% mais rápido** ⚡\n\n`;
    
    markdown += `#### 📋 RESULTADOS POR PROVEDOR\n`;
    const sorted = [...data].sort((a,b) => a.avg - b.avg);
    sorted.forEach((srv, idx) => {
        markdown += `${idx + 1}. **${srv.name}** - Média: **${srv.avg.toFixed(2)} ms**\n`;
        srv.details.forEach(d => {
            markdown += `   - \`${d.domain}\`: ${d.time} ms\n`;
        });
    });
    
    markdown += `\n---\n*Gerado automaticamente pelo Unbound Sentinel Dashboard.*`;

    navigator.clipboard.writeText(markdown).then(() => {
        const msg = document.getElementById('copy-success-msg');
        if (msg) {
            msg.style.display = 'inline-flex';
            if (window.lucide) lucide.createIcons();
            setTimeout(() => {
                msg.style.display = 'none';
            }, 3000);
        }
    }).catch(err => {
        alert('Erro ao copiar relatório: ' + err.message);
    });
};

function refreshAll() { 
    fetchStats(); 
    fetchSystem(); 
    fetchSettings(); 
    fetchLogs();
    fetchPricing();
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sentinel_sidebar_collapsed', sidebar.classList.contains('collapsed'));
    }
}

// Restore sidebar state on load
const isCollapsed = localStorage.getItem('sentinel_sidebar_collapsed') === 'true';
if (isCollapsed) document.querySelector('.sidebar').classList.add('collapsed');

function toggleTVMode() {
    document.body.classList.toggle('tv-mode');
    const isTV = document.body.classList.contains('tv-mode');
    localStorage.setItem('sentinel_tv_mode', isTV);
    
    // Auto-exit full screen if already in it, or enter it
    if (isTV) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    } else {
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
    }
}

// Restore TV Mode on load
if (localStorage.getItem('sentinel_tv_mode') === 'true') {
    document.body.classList.add('tv-mode');
}

function updateClock() {
    const now = new Date();
    const clock = document.getElementById('tv-clock');
    if (clock) {
        clock.innerText = now.toLocaleTimeString('pt-BR');
    }
}

// ===== LICENÇA & RESTRIÇÕES =====
let currentFeatures = { tv: false, config: false, update: false, charts: false, globe: false, benchmark: false, cti: false };
window.isMaster = false;

// ===== SISTEMA DE ATUALIZAÇÃO =====
let currentVersion = ""; // Será preenchido pelo servidor

// A verificação de atualização agora é tratada pela função no início do arquivo que usa a API /api/system/check-update

// ===== CHANGELOG LOGIC =====
function showChangelog() {
    const modal = document.getElementById('changelog-modal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeChangelog() {
    const modal = document.getElementById('changelog-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function showUpdateToast(version, desc) {
    if (document.getElementById('update-toast')) return;
    
    const toast = document.createElement('div');
    toast.id = 'update-toast';
    toast.style = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(56, 189, 248, 0.2); backdrop-filter: blur(20px);
        border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 50px;
        padding: 10px 20px; color: #fff; z-index: 9999;
        display: flex; align-items: center; gap: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5); animation: slideDown 0.5s ease;
    `;
    toast.innerHTML = `
        <div style="background: var(--accent-primary); width: 10px; height: 10px; border-radius: 50%; animation: pulse 1.5s infinite;"></div>
        <div style="font-size: 0.85rem; font-weight: 500; cursor: pointer;" onclick="showChangelog()">
            Nova versão disponível (${version}) &nbsp;
            <span style="text-decoration: underline; color: #38bdf8; font-size: 0.75rem;">(Ver Novidades)</span>
        </div>
        <button onclick="runSystemUpdate()" id="btn-toast-update" style="background: #fff; color: #000; border: none; padding: 5px 15px; border-radius: 20px; cursor: pointer; font-weight: 700; font-size: 0.75rem;">ATUALIZAR AGORA</button>
    `;
    document.body.appendChild(toast);
}

async function runSystemUpdate() {
    const btn = document.getElementById('btn-toast-update');
    if (btn) {
        btn.innerText = 'ATUALIZANDO...';
        btn.disabled = true;
    }
    try {
        const res = await apiFetch('/api/system/update', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
            alert('Erro ao atualizar: ' + (data.error || 'Erro desconhecido'));
            if (btn) {
                btn.innerText = 'ATUALIZAR AGORA';
                btn.disabled = false;
            }
            return;
        }
        alert(data.message || 'Atualização iniciada!');
        setTimeout(() => location.reload(), 3000);
    } catch (e) {
        alert('Erro ao atualizar: ' + e.message);
        if (btn) {
            btn.innerText = 'ATUALIZAR AGORA';
            btn.disabled = false;
        }
    }
}

async function checkLicenseStatus() {
    try {
        const res = await apiFetch('/api/system/license');
        if (!res) return;
        
        const data = await res.json();
        if (data.serverGeo) {
            window.serverGeo = data.serverGeo;
        }
        const isPro = (data.status.type === 'pro' || data.status.type === 'pro_lite' || data.status.type === 'pro-lite') && data.status.valid;
        const isFree = data.status.type === 'free';
        currentFeatures = data.status.features || { tv: false, config: false, update: false, charts: false, globe: false, benchmark: false, cti: false };
        currentFeatures.isFree = isFree;

        const display = document.getElementById('license-display');
        if (display) {
            let tierName = ' (GRÁTIS)';
            if (data.status.type === 'pro') tierName = ' (PRO)';
            else if (data.status.type === 'pro-lite') tierName = ' (PRO LITE)';
            else if (data.status.type === 'pro-trial') tierName = ' (TESTE PRO)';
            
            // Se o provedor definiu um nome personalizado, mostrar em destaque
            const providerName = data.status.provider_name;
            let label = data.status.client + tierName;
            if (data.status.expiry && data.status.expiry !== 'never') {
                const date = new Date(data.status.expiry).toLocaleDateString('pt-BR');
                label += ` • Vencimento: ${date}`;
            }
            display.innerText = label;
            display.style.color = (data.status.type === 'pro' || data.status.type === 'pro-lite' || data.status.type === 'pro-trial') ? 'var(--accent-success)' : 'var(--accent-primary)';
            
            // Mostrar nome do provedor se disponível
            if (providerName) {
                const provEl = document.createElement('div');
                provEl.style.cssText = 'display:inline-flex;align-items:center;gap:5px;margin-top:6px;padding:3px 10px;background:linear-gradient(135deg,rgba(167,139,250,0.18),rgba(139,92,246,0.1));border:1px solid rgba(167,139,250,0.35);border-radius:20px;font-size:11px;font-weight:600;color:#a78bfa;letter-spacing:0.3px;';
                provEl.innerHTML = '\u{1F3E2}\u00a0' + providerName;
                if (display.parentNode) display.parentNode.insertBefore(provEl, display.nextSibling);
            }
            
            // Mostrar HWID para suporte se necessário
            if (data.status.hwid) {
                const hwidEl = document.createElement('div');
                hwidEl.style = "font-size: 9px; opacity: 0.3; margin-top: 5px;";
                hwidEl.innerText = "HWID: " + data.status.hwid;
                display.appendChild(hwidEl);
            }
        }

        // Lock Features based on detailed permissions
        const updateBtn = document.getElementById('btn-update-system');
        const configMenu = document.querySelector('li[onclick*="config"]');
        const tvMenu = document.querySelector('button[onclick*="toggleTVMode"]');

        if (!currentFeatures.update && updateBtn) updateBtn.style.display = 'none';
        
        if (configMenu) {
            configMenu.innerHTML = '<i data-lucide="settings"></i> <span data-i18n="nav.config">' + (typeof t === "function" ? t('nav.config') : 'Configurações') + '</span>';
        }

        const benchmarkBtn = document.getElementById('run-benchmark-btn');
        if (!currentFeatures.benchmark && benchmarkBtn) {
            benchmarkBtn.disabled = true;
            benchmarkBtn.innerHTML = '<i data-lucide="lock"></i> <span data-i18n="bench.blocked">' + (typeof t === "function" ? t('bench.blocked') : 'BENCHMARK BLOQUEADO') + '</span>';
        }

        if (!currentFeatures.tv && tvMenu) {
            tvMenu.innerHTML = '<i data-lucide="lock"></i> <span data-i18n="sidebar.tvmode">' + (typeof t === "function" ? t('sidebar.tvmode') : 'Modo TV') + '</span>';
        } else if (currentFeatures.tv && tvMenu) {
            tvMenu.innerHTML = '<i data-lucide="tv"></i> <span data-i18n="sidebar.tvmode">' + (typeof t === "function" ? t('sidebar.tvmode') : 'Modo TV') + '</span>';
        }

        const globePanel = document.querySelector('.globe-panel');
        if (globePanel) {
            globePanel.style.display = currentFeatures.globe ? 'block' : 'none';
        }

        const securityMenu = document.querySelector('li[onclick*="security"]');
        if (!currentFeatures.cti && securityMenu) {
            securityMenu.innerHTML = '<i data-lucide="lock"></i> <span data-i18n="nav.security">Segurança CTI BLOQUEADO</span>';
        } else if (currentFeatures.cti && securityMenu) {
            securityMenu.innerHTML = '<i data-lucide="shield-alert"></i> <span data-i18n="nav.security">Segurança CTI</span>';
        }

        // Se a seção atual for a de segurança, atualiza a visibilidade do paywall/conteúdo
        const activeSection = document.querySelector('section.active-section');
        if (activeSection && activeSection.id === 'security-section') {
            const paywall = document.getElementById('security-paywall');
            const content = document.getElementById('security-content-wrapper');
            if (!currentFeatures.cti) {
                if (paywall && content) {
                    paywall.style.display = 'block';
                    content.style.display = 'none';
                }
            } else {
                if (paywall && content) {
                    paywall.style.display = 'none';
                    content.style.display = 'block';
                }
            }
        }

        if (window.lucide) lucide.createIcons();

        // Verificar se é Master ou Cliente para mostrar/esconder menus de gestão
        apiFetch(`${API_BASE}/settings/credentials`, {
            headers: authCredentials ? { 'Authorization': `Basic ${authCredentials}` } : {}
        })
        .then(r => r.json())
        .then(config => {
            const masterMenus = document.querySelectorAll('.master-only');
            const clientOnly = document.querySelectorAll('.client-only');
            const logoText = document.querySelector('.logo span');
            
            window.isMaster = !!config.isMaster;

            if (logoText) {
                const role = config.isMaster ? 'MASTER' : 'MONITOR';
                const os = config.os || 'Linux';
                logoText.innerHTML = `SENTINEL | ${role}<br><small style="font-size:10px;opacity:0.5;">${window.location.hostname} (${os})</small>`;
                logoText.style.display = 'block';
                logoText.style.lineHeight = '1.2';
            }

            masterMenus.forEach(menu => {
                menu.style.display = config.isMaster ? 'flex' : 'none';
            });

            clientOnly.forEach(item => {
                item.style.display = config.isMaster ? 'none' : 'flex';
            });
            
            // Se for Master, redireciona para o Dashboard Master exclusivo
            if (config.isMaster) {
                // Pequeno delay para garantir que o auth está salvo no localStorage
                setTimeout(() => {
                    window.location.replace('/master');
                }, 150);
            }
        }).catch(() => {});

    } catch (err) {
        console.error('Erro ao checar licença', err);
    }
}

window.goToUpgrade = function(element) {
    if (window.isMaster) {
        showSection('licenses', element);
    } else {
        showSection('about', element);
    }
};

async function promptLicenseKey() {
    const key = prompt("Digite a sua Chave de Ativação (PRO):");
    if (key === null) return;
    
    try {
        const res = await apiFetch('/api/system/license', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key })
        });
        const data = await res.json();
        if (data && data.message) {
            alert(data.message + "\nStatus: " + (data.status ? data.status.client : ''));
            window.location.reload();
        }
    } catch (err) {
        alert("Erro ao validar licença.");
    }
}

// Intercept locked features
const originalShowSection = showSection;
showSection = async function(id, element) {
    if (id === 'monitoring' || id === 'servers') loadActiveClients();
    return originalShowSection(id, element);
};

async function loadActiveClients() {
    const list = document.getElementById('active-clients-list');
    const countEl = document.getElementById('online-count');
    const proEl = document.getElementById('pro-count');
    const freeEl = document.getElementById('free-count');
    const refreshEl = document.getElementById('last-refresh');
    if (!list) return;

    try {
        const res = await apiFetch('/api/system/active-clients');
        const clients = await res.json();
        const clientArray = (Array.isArray(clients) ? clients : Object.values(clients || {})).filter(c => c && c.hwid);

        const proCount = clientArray.filter(c => (c.status || '').toLowerCase().includes('pro')).length;
        const freeCount = clientArray.length - proCount;

        if (countEl) countEl.innerText = clientArray.length;
        if (proEl) proEl.innerText = proCount;
        if (freeEl) freeEl.innerText = freeCount;
        if (refreshEl) refreshEl.innerText = new Date().toLocaleTimeString('pt-BR');

        list.innerHTML = '';

        if (clientArray.length === 0) {
            list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; opacity:0.4; font-size:0.9rem;">Nenhum cliente conectado no momento.</td></tr>';
            return;
        }

        let html = '';
        clientArray.forEach(c => {
            const statusRaw = (c.status || 'free').toLowerCase();
            const clientName = c.client || 'Novo Cliente';
            const hostname = c.hostname || 'Desconhecido';
            const ip = c.ip || '---';
            const version = c.version || 'v1.x';
            const lastSeen = c.lastSeen ? new Date(c.lastSeen).toLocaleTimeString('pt-BR') : '--:--';
            const hwid = c.hwid;

            let statusLabel = 'FREE';
            let statusStyle = 'background:rgba(255,255,255,0.05); color:#64748b; border:1px solid rgba(255,255,255,0.1);';
            let isAnyPro = false;

            if (statusRaw === 'pro') {
                statusLabel = 'PRO';
                statusStyle = 'background:rgba(14,165,233,0.15); color:#38bdf8; border:1px solid rgba(14,165,233,0.3);';
                isAnyPro = true;
            } else if (statusRaw === 'pro-lite') {
                statusLabel = 'PRO LITE';
                statusStyle = 'background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3);';
                isAnyPro = true;
            }

            const actionBtn = (isAnyPro || c.isRegistered)
                ? `<button onclick="openEditLicenseByHWID('${hwid}')"
                    style="background:transparent; border:1px solid rgba(255,255,255,0.15); color:#cbd5e1; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.72rem; font-weight:600; letter-spacing:0.5px; transition:all 0.2s;"
                    onmouseover="this.style.borderColor='#38bdf8';this.style.color='#38bdf8';"
                    onmouseout="this.style.borderColor='rgba(255,255,255,0.15)';this.style.color='#cbd5e1';">
                    &#9881; GERIR
                  </button>`
                : `<button onclick="approveClient('${hwid}', '${hostname.replace(/'/g, '')}', '${ip}')"
                    style="background:rgba(14,165,233,0.12); border:1px solid rgba(14,165,233,0.35); color:#38bdf8; padding:6px 14px; border-radius:8px; cursor:pointer; font-size:0.72rem; font-weight:700; letter-spacing:0.5px; transition:all 0.2s;"
                    onmouseover="this.style.background='rgba(14,165,233,0.25)';"
                    onmouseout="this.style.background='rgba(14,165,233,0.12)';">
                    &#9650; LIBERAR PRO
                  </button>`;

            html += `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05); transition:background 0.15s;"
                    onmouseover="this.style.background='rgba(56,189,248,0.03)';"
                    onmouseout="this.style.background='transparent';">
                    <td style="padding:1rem 1.25rem;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 6px #10b981; flex-shrink:0; animation:pulse 2s infinite;"></span>
                            <div>
                                <div style="font-weight:700; color:#f1f5f9; font-size:0.88rem;">${clientName}</div>
                                <div style="font-size:0.7rem; color:#475569; margin-top:2px;">${hostname}</div>
                            </div>
                        </div>
                    </td>
                    <td style="padding:1rem 1.25rem; font-family:'JetBrains Mono',monospace; font-size:0.8rem; color:#64748b;">${ip}</td>
                    <td style="padding:1rem 1.25rem;">
                        <span style="background:rgba(255,255,255,0.06); color:#94a3b8; padding:3px 10px; border-radius:20px; font-size:0.68rem; font-weight:700; font-family:'JetBrains Mono',monospace; border:1px solid rgba(255,255,255,0.08);">${version}</span>
                    </td>
                    <td style="padding:1rem 1.25rem;">
                        <span style="${statusStyle} padding:3px 12px; border-radius:20px; font-size:0.68rem; font-weight:800; letter-spacing:1px;">${statusLabel}</span>
                    </td>
                    <td style="padding:1rem 1.25rem; font-size:0.8rem; color:#475569; font-family:'JetBrains Mono',monospace;">${lastSeen}</td>
                    <td style="padding:1rem 1.25rem;">${actionBtn}</td>
                </tr>
            `;
        });

        list.innerHTML = html;
    } catch (e) {
        console.error('Erro no monitoramento:', e);
        list.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#f43f5e; padding:2rem;">Erro ao carregar monitoramento.</td></tr>';
    }
}

// Inicia o polling do monitoramento se estiver na seção correta
setInterval(() => {
    const monitorSection = document.getElementById('monitoring-section');
    const serversSection = document.getElementById('servers-section');
    const isVisible = (monitorSection && monitorSection.classList.contains('active-section')) || 
                      (serversSection && serversSection.classList.contains('active-section'));
                      
    if (isVisible) {
        loadActiveClients();
    }
}, 10000);

async function approveClient(hwid, hostname, ip) {
    const clientName = prompt('Nome comercial para este cliente:', hostname);
    if (!clientName) return;

    const tierChoice = confirm(
        'Escolha o tier de licença:\n\n' +
        '✅ OK  →  PRO LITE (Doador — Configurações, Updates, Gráficos)\n' +
        '❌ Cancel  →  PRO FULL (Todas as features)'
    );
    const tier = tierChoice ? 'pro-lite' : 'pro';
    const features = tier === 'pro-lite'
        ? { tv: false, config: true, update: true, charts: true, globe: false, benchmark: false }
        : { tv: true, config: true, update: true, charts: true, globe: true, benchmark: true };

    try {
        const res = await apiFetch(`${API_BASE}/system/licenses-db`);
        const db = await res.json();

        const key = 'AUTO-' + hwid.substring(0, 8).toUpperCase();
        db[key] = {
            hwid: hwid,
            client: clientName,
            type: tier,
            valid: true,
            features: features,
            authorized_ip: ip && ip !== '---' ? ip : ''
        };

        await apiFetch(`${API_BASE}/system/licenses-db`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(db)
        });

        alert(`Servidor ativado como ${tier === 'pro-lite' ? 'PRO Lite ❤' : 'PRO Full ⭐'} com sucesso!`);
        loadActiveClients();
    } catch (e) {
        alert('Erro ao aprovar cliente.');
    }
}

const originalToggleTVMode = toggleTVMode;
toggleTVMode = function() {
    if (!currentFeatures.tv) {
        alert("O Modo TV (NOC View) está bloqueado na sua licença.\nEntre em contato com o administrador para liberar.");
        return;
    }
    return originalToggleTVMode();
};

initCharts();
setInitialLoading();
fetchHistory(); // Carrega o histórico persistente do backend
refreshAll();
checkLicenseStatus().then(checkForSystemUpdate); // Verifica licença e depois atualização

setInterval(refreshAll, 10000);
setInterval(updateSecurityThreats, 15000); // Polling de segurança a cada 15 segundos
setInterval(updateClock, 1000);
setInterval(checkForSystemUpdate, 7200000); // Verifica atualizações a cada 2 horas
setInterval(checkLicenseStatus, 900000); // Re-valida a licença a cada 15 minutos


// ===== LICENSE MANAGEMENT LOGIC (MASTER ONLY) =====
async function loadLicenses() {
    const list = document.getElementById('licenses-list');
    if (!list) return;
    list.innerHTML = '<p class="loading">Carregando chaves...</p>';
    try {
        const res = await apiFetch(`${API_BASE}/system/licenses-db`);
        const db = await res.json();
        renderLicensesList(db);
    } catch (e) {
        list.innerHTML = '<p style="color:var(--accent-danger);">Erro ao carregar banco de licenças.</p>';
    }
}

function renderLicensesList(db) {
    const list = document.getElementById('licenses-list');
    if (!list) return;
    const keys = Object.keys(db);
    if (keys.length === 0) {
        list.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-secondary); padding: 3rem;">Nenhuma chave gerada.</p>';
        return;
    }
    list.innerHTML = keys.map(key => {
        const lic = db[key];
        let badgeClass = 'reject';
        if (lic.type === 'pro') badgeClass = 'accept';
        else if (lic.type === 'pro-lite' || lic.type === 'pro-trial') badgeClass = 'pro'; // usando o estilo azul/verde do pro

        return `
            <div class="server-card">
                <div class="server-card-header">
                    <h3>${lic.client}</h3>
                    <span class="badge ${badgeClass}">${lic.type.toUpperCase()}</span>
                </div>
                <div class="server-info-row">
                    <span class="server-info-label">Chave:</span>
                    <span class="server-info-value" style="color:var(--accent-primary);">${key}</span>
                </div>
                <div class="server-info-row">
                    <span class="server-info-label">Status:</span>
                    <span class="server-info-value">${lic.valid ? 'Ativa' : 'Inativa'}</span>
                </div>
                <div class="server-actions">
                    <button class="btn btn-primary" onclick="openEditLicense('${key}')">
                        <i data-lucide="edit-3"></i> EDITAR PLANO
                    </button>
                    <button class="btn btn-secondary" onclick="toggleLicense('${key}')">
                        <i data-lucide="${lic.valid ? 'pause' : 'play'}"></i> ${lic.valid ? 'SUSPENDER' : 'ATIVAR'}
                    </button>
                    <button class="btn btn-secondary" onclick="removeLicense('${key}')" style="color:var(--accent-danger);">
                        <i data-lucide="trash-2"></i> EXCLUIR
                    </button>
                </div>
            </div>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}
async function openEditLicenseByHWID(hwid) {
    try {
        const res = await apiFetch(`${API_BASE}/system/licenses-db`);
        const db = await res.json();
        let foundKey = null;
        for (const key in db) {
            if (db[key].hwid === hwid) {
                foundKey = key;
                break;
            }
        }
        if (foundKey) {
            openEditLicense(foundKey);
        } else {
            alert("Licença não encontrada para este HWID no banco de dados.");
        }
    } catch (e) {
        alert("Erro ao carregar banco de licenças.");
    }
}

async function openEditLicense(key) {
    const res = await apiFetch(`${API_BASE}/system/licenses-db`);
    const db = await res.json();
    const lic = db[key];
    if (!lic) return;

    const modalHtml = `
        <div id="edit-license-modal" class="modal-overlay">
            <div class="modal-content">
                <button class="modal-close" onclick="closeModal('edit-license-modal')">
                    <i data-lucide="x"></i>
                </button>
                
                <div class="modal-header">
                    <h2>Editar Plano</h2>
                    <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:5px;">ID: ${key}</p>
                </div>

                <div class="modal-body">
                    <div class="form-group">
                        <label>Nome do Cliente / Empresa</label>
                        <input type="text" id="edit-lic-client" class="modern-input" value="${lic.client}">
                    </div>

                    <div class="form-group">
                        <label>🏢 Nome do Provedor (White-Label)</label>
                        <input type="text" id="edit-lic-provider" class="modern-input" value="${lic.provider_name || ''}" placeholder="Ex: Telecom Boa Vista, ISP Conecta...">
                        <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:5px; opacity:0.7;">Aparece no painel de licença do cliente como nome do serviço.</p>
                    </div>

                    <div class="form-group">
                        <label>Tipo de Plano</label>
                        <select id="edit-lic-type" class="modern-input">
                            <option value="pro" ${lic.type === 'pro' ? 'selected' : ''}>Pro / Premium</option>
                            <option value="pro-lite" ${lic.type === 'pro-lite' ? 'selected' : ''}>Pro Lite (Doador)</option>
                            <option value="pro-trial" ${lic.type === 'pro-trial' ? 'selected' : ''}>Pro Lite de Teste (30 Dias)</option>
                            <option value="free" ${lic.type === 'free' ? 'selected' : ''}>Grátis / Básico</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Data de Expiração</label>
                        <input type="date" id="edit-lic-expiry" class="modern-input" value="${lic.expiry || ''}">
                        <p style="font-size:0.7rem; color:var(--text-secondary); margin-top:5px; opacity:0.6;">
                            Deixe vazio para licença vitalícia.
                        </p>
                    </div>
                    
                    <label style="font-size:0.75rem; color:var(--accent-primary); margin-top:1.5rem; display:block; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Permissões da Licença</label>
                    <div class="perm-grid">
                        <div class="perm-check">
                            <input type="checkbox" id="p-tv" ${lic.features?.tv ? 'checked' : ''}>
                            <label for="p-tv">MODO TV (NOC)</label>
                        </div>
                        <div class="perm-check">
                            <input type="checkbox" id="p-config" ${lic.features?.config ? 'checked' : ''}>
                            <label for="p-config">CONFIGURAÇÕES</label>
                        </div>
                        <div class="perm-check">
                            <input type="checkbox" id="p-update" ${lic.features?.update ? 'checked' : ''}>
                            <label for="p-update">ATUALIZAÇÃO</label>
                        </div>
                        <div class="perm-check">
                            <input type="checkbox" id="p-charts" ${lic.features?.charts ? 'checked' : ''}>
                            <label for="p-charts">GRÁFICOS</label>
                        </div>
                        <div class="perm-check">
                            <input type="checkbox" id="p-globe" ${lic.features?.globe ? 'checked' : ''}>
                            <label for="p-globe">MAPA GLOBAL</label>
                        </div>
                        <div class="perm-check">
                            <input type="checkbox" id="p-benchmark" ${lic.features?.benchmark ? 'checked' : ''}>
                            <label for="p-benchmark">BENCHMARK</label>
                        </div>
                        <div class="perm-check">
                            <input type="checkbox" id="p-cti" ${lic.features?.cti !== false ? 'checked' : ''}>
                            <label for="p-cti">CTI (AMEAÇAS)</label>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="saveLicenseEdit('${key}')" style="width:100%; justify-content:center; padding:14px; border-radius:14px;">
                            <i data-lucide="refresh-cw"></i> Sincronizar com Servidor
                        </button>
                        <p id="edit-lic-status" style="text-align:center; margin-top:15px; font-size:0.8rem; font-weight:500; min-height:1.2rem;"></p>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if (window.lucide) lucide.createIcons();
}

async function openClientDrilldown(ip) {
    const modalHtml = `
        <div id="client-drilldown-modal" class="modal-overlay">
            <div class="modal-content" style="max-width: 600px;">
                <button class="modal-close" onclick="closeModal('client-drilldown-modal')">
                    <i data-lucide="x"></i>
                </button>
                <div class="modal-header">
                    <h2 style="background: linear-gradient(90deg, #fff, var(--accent-primary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Investigação de Cliente</h2>
                    <p style="color:var(--accent-primary); font-family:'JetBrains Mono'; margin-top:10px; font-weight:700; font-size:1.1rem; letter-spacing:1px;">${ip}</p>
                </div>
                <div class="modal-body" id="client-drilldown-body">
                    <div style="text-align:center; padding:3rem;">
                        <i data-lucide="loader" class="spin" style="width:40px; height:40px; color:var(--accent-primary); margin-bottom:15px;"></i>
                        <p style="opacity:0.6;">Coletando telemetria e analisando pacotes...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    if (window.lucide) lucide.createIcons();

    try {
        const res = await apiFetch(`${API_BASE}/stats/client/${ip}`);
        const data = await res.json();
        
        const body = document.getElementById('client-drilldown-body');
        if (!body) return;

        if (!data.topDomains || data.topDomains.length === 0) {
            body.innerHTML = '<div style="text-align:center; padding:3rem; opacity:0.6;"><i data-lucide="info" style="width:40px; margin-bottom:10px;"></i><br>Nenhuma atividade recente encontrada para este IP nos logs do Unbound.</div>';
            if (window.lucide) lucide.createIcons();
            return;
        }

        body.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:2.5rem;">
                <div class="stat-card" style="background:rgba(255,255,255,0.02); padding:20px; border-radius:16px; border:1px solid var(--card-border); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                    <label style="font-size:0.65rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px; font-weight:700;">Volume de Consultas (2k logs)</label>
                    <div style="font-size:1.8rem; font-weight:800; color:var(--accent-primary); margin-top:5px;">${data.total.toLocaleString()}</div>
                </div>
                <div class="stat-card" style="background:rgba(255,255,255,0.02); padding:20px; border-radius:16px; border:1px solid var(--card-border); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
                    <label style="font-size:0.65rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:1px; font-weight:700;">Último Evento Detectado</label>
                    <div style="font-size:1.8rem; font-weight:800; color:var(--accent-success); margin-top:5px;">${new Date(data.lastUpdate).toLocaleTimeString()}</div>
                </div>
            </div>

            <label style="font-size:0.75rem; color:var(--accent-primary); font-weight:700; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:20px; display:block;">Domínios mais acessados por este dispositivo</label>
            <div style="display: flex; flex-direction: column; gap: 14px; max-height: 280px; overflow-y: auto; padding-right: 8px;">
                ${data.topDomains.map(d => `
                    <div class="bar-item" style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                        <div class="bar-name" style="width: 240px; font-size: 0.85rem; color: #f8fafc; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: 'JetBrains Mono', monospace;" title="${d.name.replace(/\.$/, '')}">
                            ${d.name.replace(/\.$/, '')}
                        </div>
                        <div class="bar-wrapper" style="flex-grow: 1; height: 10px; background: rgba(255, 255, 255, 0.08); border-radius: 6px; overflow: hidden; position: relative; border: 1px solid rgba(255,255,255,0.03);">
                            <div class="bar-fill" style="width: ${(d.count / data.topDomains[0].count * 100).toFixed(1)}%; background: linear-gradient(90deg, #38bdf8, #818cf8); height: 100%; border-radius: 6px; box-shadow: 0 0 10px rgba(56, 189, 248, 0.35);"></div>
                        </div>
                        <div style="font-size: 0.8rem; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #38bdf8; min-width: 40px; text-align: right; background: rgba(14, 165, 233, 0.15); padding: 3px 10px; border-radius: 8px; border: 1px solid rgba(14, 165, 233, 0.25);">
                            ${d.count}
                        </div>
                    </div>
                `).join('')}
            </div>

            <div class="modal-footer" style="margin-top:3rem; display:flex; gap:12px;">
                <button class="btn btn-secondary" onclick="closeModal('client-drilldown-modal')" style="flex:1; justify-content:center; padding:14px; border-radius:12px;">VOLTAR</button>
                <button class="btn btn-primary" style="flex:1; justify-content:center; background:rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color:#f87171; padding:14px; border-radius:12px;" onclick="blockClientIp('${ip}')">
                    <i data-lucide="shield-alert"></i> BLOQUEAR DISPOSITIVO
                </button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        document.getElementById('client-drilldown-body').innerHTML = '<div style="text-align:center; color:var(--accent-danger); padding:2rem;">Erro ao carregar telemetria do cliente. Verifique a conexão com o servidor Master.</div>';
    }
}

async function blockClientIp(ip) {
    if (!confirm(`Tem certeza que deseja bloquear permanentemente o tráfego do IP ${ip} no Firewall?`)) return;
    try {
        const res = await apiFetch(`${API_BASE}/firewall/block-ip`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'add', ip: ip })
        });
        const data = await res.json();
        if (data.error) {
            alert(`Erro ao bloquear IP: ${data.error}`);
        } else {
            alert(data.message || `IP ${ip} bloqueado com sucesso!`);
            closeModal('client-drilldown-modal');
        }
    } catch (err) {
        alert(`Erro de comunicação com o servidor: ${err.message}`);
    }
}

async function saveLicenseEdit(key) {
    const status = document.getElementById('edit-lic-status');
    const providerEl = document.getElementById('edit-lic-provider');
    status.innerText = 'Sincronizando com Master...';
    status.style.color = 'var(--accent-primary)';

    try {
        const res = await apiFetch(`${API_BASE}/system/licenses-db`);
        const db = await res.json();
        
        db[key] = {
            ...db[key],
            client: document.getElementById('edit-lic-client').value,
            provider_name: providerEl ? providerEl.value.trim() : (db[key].provider_name || ''),
            type: document.getElementById('edit-lic-type').value,
            expiry: document.getElementById('edit-lic-expiry').value,
            features: {
                tv: document.getElementById('p-tv').checked,
                config: document.getElementById('p-config').checked,
                update: document.getElementById('p-update').checked,
                charts: document.getElementById('p-charts').checked,
                globe: document.getElementById('p-globe').checked,
                benchmark: document.getElementById('p-benchmark').checked,
                cti: document.getElementById('p-cti').checked
            }
        };

        await apiFetch(`${API_BASE}/system/licenses-db`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(db)
        });

        status.innerText = 'Licença atualizada e sincronizada com Master Sentinel!';
        status.style.color = 'var(--accent-success)';
        setTimeout(() => {
            closeModal('edit-license-modal');
            loadLicenses();
        }, 1500);
    } catch (e) {
        status.innerText = 'Erro ao sincronizar';
        status.style.color = 'var(--accent-danger)';
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.remove();
}

async function addNewLicense() {
    const client = prompt("Nome do Cliente:");
    if (!client) return;
    
    const isTrial = confirm("Deseja gerar uma licença Pro Lite de Teste (30 dias)?\n\nOK = Sim (30 Dias)\nCancelar = Não (Licença Completa sem validade)");
    
    const keyPrefix = isTrial ? 'TRIAL-' : 'SENTINEL-';
    const key = keyPrefix + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    let expiryDate = 'never';
    let features = { tv: true, config: true, update: true, charts: true, globe: true, benchmark: true, cti: true };
    
    if (isTrial) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        expiryDate = d.toISOString();
        features.benchmark = false;
    }
    
    try {
        const res = await apiFetch(`${API_BASE}/system/licenses-db`);
        const db = await res.json();
        db[key] = {
            type: isTrial ? 'pro-trial' : 'pro',
            valid: true,
            status: 'active',
            client: isTrial ? client + ' (Pro Lite 30 Dias)' : client,
            created_at: new Date().toISOString(),
            expires_at: expiryDate,
            features: features
        };
        
        await apiFetch(`${API_BASE}/system/licenses-db`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(db)
        });
        loadLicenses();
    } catch (e) { alert('Erro ao gerar chave'); }
}

async function toggleLicense(key) {
    try {
        const res = await apiFetch(`${API_BASE}/system/licenses-db`);
        const db = await res.json();
        if (db[key]) {
            db[key].valid = !db[key].valid;
            await apiFetch(`${API_BASE}/system/licenses-db`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(db)
            });
            loadLicenses();
        }
    } catch (e) { alert('Erro ao alterar status'); }
}

async function removeLicense(key) {
    if (!confirm('Deseja excluir esta chave permanentemente?')) return;
    try {
        const res = await apiFetch(`${API_BASE}/system/licenses-db`);
        const db = await res.json();
        delete db[key];
        await apiFetch(`${API_BASE}/system/licenses-db`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(db)
        });
        loadLicenses();
    } catch (e) { alert('Erro ao excluir chave'); }
}

// ===== MULTI-SERVER MANAGEMENT LOGIC =====
async function loadServers() {
    const list = document.getElementById('servers-list');
    if (!list) return;
    list.innerHTML = '<p class="loading">Sincronizando clientes...</p>';
    try {
        const res = await apiFetch(`${API_BASE}/servers`);
        const servers = await res.json();
        renderServersList(servers);
    } catch (e) {
        list.innerHTML = '<p style="color:var(--accent-danger);">Erro ao carregar lista de servidores.</p>';
    }
}

function renderServersList(servers) {
    const list = document.getElementById('servers-list');
    if (!list) return;
    if (servers.length === 0) {
        list.innerHTML = '<p style="grid-column: span 3; text-align: center; color: var(--text-secondary); padding: 3rem;">Nenhum cliente cadastrado. Adicione um servidor para começar.</p>';
        return;
    }
    list.innerHTML = '';
    servers.forEach((s, i) => {
        const card = document.createElement('div');
        card.className = 'server-card';

        const header = document.createElement('div');
        header.className = 'server-card-header';
        const h3 = document.createElement('h3');
        h3.textContent = s.name;
        header.appendChild(h3);
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', 'server');
        icon.style.cssText = 'width:16px;color:var(--text-muted);';
        header.appendChild(icon);
        card.appendChild(header);

        const createRow = (label, value) => {
            const row = document.createElement('div');
            row.className = 'server-info-row';
            const spanLabel = document.createElement('span');
            spanLabel.className = 'server-info-label';
            spanLabel.textContent = label;
            const spanValue = document.createElement('span');
            spanValue.className = 'server-info-value';
            spanValue.textContent = value;
            row.appendChild(spanLabel);
            row.appendChild(spanValue);
            return row;
        };

        card.appendChild(createRow('Host:', s.host));
        card.appendChild(createRow('Porta:', String(s.port || 22)));
        card.appendChild(createRow('Usuário:', s.user));

        const actions = document.createElement('div');
        actions.className = 'server-actions';
        
        const btnDeploy = document.createElement('button');
        btnDeploy.className = 'btn btn-primary';
        btnDeploy.innerHTML = '<i data-lucide="upload-cloud"></i> DEPLOY';
        btnDeploy.addEventListener('click', () => runRemoteDeploy(i));
        
        const btnRemove = document.createElement('button');
        btnRemove.className = 'btn btn-secondary';
        btnRemove.style.color = 'var(--accent-danger)';
        btnRemove.innerHTML = '<i data-lucide="trash-2"></i> REMOVER';
        btnRemove.addEventListener('click', () => removeServer(i));

        actions.appendChild(btnDeploy);
        actions.appendChild(btnRemove);
        card.appendChild(actions);

        list.appendChild(card);
    });
    if (window.lucide) lucide.createIcons();
}

async function addNewServer() {
    const name = prompt("Nome do Servidor (ex: Cliente 01):");
    if (!name) return;
    const host = prompt("IP ou Host do Servidor:");
    if (!host) return;
    const port = prompt("Porta SSH (padrão 22):", "22");
    const user = prompt("Usuário SSH (padrão root):", "root");
    const pass = prompt("Senha SSH:");
    
    try {
        const res = await apiFetch(`${API_BASE}/servers`);
        const servers = await res.json();
        servers.push({ name, host, port: parseInt(port), user, pass });
        
        await apiFetch(`${API_BASE}/servers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(servers)
        });
        loadServers();
    } catch (e) { alert('Erro ao adicionar servidor'); }
}

async function removeServer(index) {
    if (!confirm('Deseja remover este servidor da lista?')) return;
    try {
        const res = await apiFetch(`${API_BASE}/servers`);
        const servers = await res.json();
        servers.splice(index, 1);
        await apiFetch(`${API_BASE}/servers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(servers)
        });
        loadServers();
    } catch (e) { alert('Erro ao remover servidor'); }
}

async function runRemoteDeploy(index) {
    try {
        const res = await apiFetch(`${API_BASE}/deploy/${index}`, { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Comando de deploy enviado!');
    } catch (e) { alert('Erro ao iniciar deploy'); }
}

async function runGlobalDeploy() {
    if (!confirm('Deseja iniciar o deploy em massa para TODOS os servidores cadastrados?')) return;
    try {
        const res = await apiFetch(`${API_BASE}/deploy/all`, { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Deploy global iniciado!');
    } catch (e) { alert('Erro ao iniciar deploy global'); }
}

// ===== DDNS VIEW LOGIC =====
function renderDDNS() {
    const view = document.getElementById('ddns-view');
    if (!view) return;
    view.innerHTML = `
        <div style="max-width: 700px;">
            <div style="margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--card-border);">
                <p style="color: var(--text-secondary); line-height: 1.6;">
                    Para acessar este painel de qualquer lugar do mundo (como do seu celular ou de casa), você pode usar um serviço de <strong>DNS Dinâmico (DDNS)</strong>.
                </p>
            </div>

            <div class="ddns-guide">
                <h4>🚀 Sugestão: Como configurar acesso via domínio grátis</h4>
                <ul>
                    <li><strong>DuckDNS:</strong> Crie um subdomínio grátis (ex: <code>meusentinel.duckdns.org</code>).</li>
                    <li><strong>Instalação:</strong> No servidor onde o painel está rodando, instale o cliente do DuckDNS para manter o IP atualizado.</li>
                    <li><strong>Port Forwarding:</strong> Libere a porta <code>3000</code> no seu roteador para o IP interno desta máquina.</li>
                    <li><strong>Pronto!</strong> Você poderá acessar via: <code>http://seu-dominio.duckdns.org:3000</code></li>
                </ul>
            </div>

            <div class="ddns-guide" style="margin-top: 1rem; background: rgba(168,85,247,0.05); border-color: rgba(168,85,247,0.2);">
                <h4>⚡ Alternativa: Cloudflare Tunnels (Recomendado)</h4>
                <p>O Cloudflare Tunnel (cloudflared) permite expor seu painel para a internet <strong>sem precisar abrir portas no roteador</strong>. É mais seguro e profissional.</p>
                <ol style="margin-left: 1.25rem; margin-top: 0.5rem;">
                    <li>Crie uma conta na Cloudflare.</li>
                    <li>Vá em Zero Trust -> Networks -> Tunnels.</li>
                    <li>Siga as instruções para instalar o <code>cloudflared</code> e apontar para <code>localhost:3000</code>.</li>
                </ol>
            </div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
}

// ===== SENTINEL GLOBE =====
let sentinelGlobe = null;
function initGlobe() {
    const container = document.getElementById('sentinel-globe');
    if (!container) return;

    const hubs = [
        { lat: -23.5505, lng: -46.6333, name: 'São Paulo' },
        { lat: 40.7128, lng: -74.0060, name: 'New York' },
        { lat: 51.5074, lng: -0.1278, name: 'London' },
        { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
        { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
        { lat: 25.2048, lng: 55.2708, name: 'Dubai' }
    ];

    if (typeof Globe === 'undefined') {
        console.error('Globe.gl library not loaded');
        container.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding-top:200px;">Erro ao carregar visualização 3D.</p>';
        return;
    }

    const updateDimensions = () => {
        if (!container || !sentinelGlobe) return;
        const w = container.offsetWidth || 800;
        const h = container.offsetHeight || 500;
        sentinelGlobe.width(w).height(h);
    };

    try {
        sentinelGlobe = Globe()(container)
            .backgroundColor('rgba(0,0,0,0)')
            .showAtmosphere(true)
            .atmosphereColor('#0ea5e9')
            .atmosphereAltitude(0.18);

        // Ajusta o material do globo para ser um vidro azul semi-transparente
        const globeMaterial = sentinelGlobe.globeMaterial();
        if (globeMaterial) {
            globeMaterial.color.set('#0a1d37');
            globeMaterial.transparent = true;
            globeMaterial.opacity = 0.35;
        }

        sentinelGlobe.controls().autoRotate = true;
        sentinelGlobe.controls().autoRotateSpeed = 0.5;
        sentinelGlobe.controls().enableZoom = false;

        // Configuração de Hubs e Arcos (Sync)
        sentinelGlobe.pointsData(hubs)
            .pointAltitude(0.02)
            .pointColor(() => '#00f2fe')
            .pointRadius(0.6)
            .pointResolution(32)
            .pointLabel(d => `<div style="background:rgba(10,18,36,0.95); padding:10px 14px; border:1px solid #00f2fe; border-radius:12px; box-shadow:0 0 20px rgba(0,242,254,0.4); backdrop-filter:blur(8px);">
                <strong style="color:#00f2fe; font-size:14px; text-transform:uppercase; letter-spacing:0.5px;">${d.name}</strong><br>
                <span style="color:#fff; font-size:11px; opacity:0.85; display:flex; align-items:center; gap:5px; margin-top:4px;">
                    <span style="display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%; box-shadow:0 0 8px #10b981; animation:livePulse 2s infinite;"></span>
                    Sentinel Node Active
                </span>
            </div>`);

        sentinelGlobe
            .arcColor(d => d.color)
            .arcDashLength(0.5)
            .arcDashGap(1.5)
            .arcDashAnimateTime(1500)
            .arcStroke(1.8)
            .arcAltitude(d => d.altitude);

        // Inicia Arcos Imediatamente
        updateGlobeArcs();

        // Pulsação (Sync)
        sentinelGlobe.ringsData(hubs)
            .ringColor(() => t => `rgba(0, 242, 254, ${1 - t})`)
            .ringMaxRadius(8)
            .ringPropagationSpeed(2.5)
            .ringRepeatPeriod(1500);

        // Ajuste de Dimensões
        updateDimensions();
        setTimeout(updateDimensions, 500);
        setTimeout(updateDimensions, 2000);

        // Efeito de Malha Digital (Async - Non-blocking)
        fetch('/countries.geojson')
            .then(res => res.json())
            .then(countries => {
                if (sentinelGlobe) {
                    sentinelGlobe.hexPolygonsData(countries.features)
                        .hexPolygonResolution(3)
                        .hexPolygonMargin(0.18)
                        .hexPolygonColor(() => 'rgba(0, 242, 254, 0.7)');
                }
            })
            .catch(err => console.warn('Erro ao carregar malha digital:', err));

    } catch (e) {
        console.error('Erro na inicialização do Globo:', e);
    }
}

window.globeGeoCache = window.globeGeoCache || {};

async function geolocateForGlobe(ipOrDomain) {
    if (!ipOrDomain) return null;
    
    // 1. Verificar cache local em memória
    if (window.globeGeoCache[ipOrDomain]) {
        return window.globeGeoCache[ipOrDomain];
    }
    
    // 2. Tratar IPs locais / privados / loopbacks
    const isPrivate = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|localhost|::1)/.test(ipOrDomain);
    if (isPrivate) {
        const sGeo = window.serverGeo || { lat: -23.5505, lon: -46.6333, countryCode: 'BR', city: 'São Paulo', country: 'Brasil' };
        // Leve jitter/deslocamento para não sobrepor perfeitamente no mesmo pixel
        const jitter = () => (Math.random() - 0.5) * 0.4;
        const res = {
            lat: sGeo.lat + jitter(),
            lon: sGeo.lon + jitter(),
            city: sGeo.city,
            country: sGeo.country,
            countryCode: sGeo.countryCode,
            isPrivate: true
        };
        window.globeGeoCache[ipOrDomain] = res;
        return res;
    }
    
    // 3. Consultar no backend
    try {
        const geoRes = await apiFetch(`/api/enrich/geo?ip=${encodeURIComponent(ipOrDomain)}`);
        const geo = await geoRes.json();
        if (geo && geo.status === 'success' && geo.lat !== null && geo.lon !== null) {
            const res = {
                lat: parseFloat(geo.lat),
                lon: parseFloat(geo.lon),
                city: geo.city || '--',
                country: geo.country || '--',
                countryCode: geo.countryCode || '--'
            };
            window.globeGeoCache[ipOrDomain] = res;
            return res;
        }
    } catch (err) {
        console.warn(`[GlobeGeo] Falha ao geolocalizar ${ipOrDomain}:`, err.message);
    }
    
    return null;
}

let globeTimeoutId = null;

async function updateGlobeArcs() {
    if (globeTimeoutId) clearTimeout(globeTimeoutId);
    if (!sentinelGlobe) return;

    const sGeo = window.serverGeo || { lat: -23.5505, lon: -46.6333, countryCode: 'BR', city: 'São Paulo', country: 'Brasil' };
    const alerts = window.latestThreats || [];
    const arcs = [];
    const listItems = [];

    // Processar os alertas reais mais recentes e garantir que nenhum loopback passe
    const recentAlerts = alerts
        .filter(a => a.ip !== '127.0.0.1' && a.ip !== '::1' && a.ip !== 'localhost')
        .slice(0, 10);
    
    for (const alert of recentAlerts) {
        const originGeo = await geolocateForGlobe(alert.ip);
        const destGeo = await geolocateForGlobe(alert.domain);
        
        if (originGeo && destGeo) {
            let color = "rgba(0, 242, 254, 0.7)"; // Cyan para tráfego geral
            let severityLabel = "Geral";
            let severityColor = "#00f2fe";
            
            if (alert.severity === 'CRITICAL' || alert.severity === 'BLOCKED') {
                color = "rgba(244, 63, 94, 0.9)"; // Red
                severityLabel = alert.severity === 'BLOCKED' ? 'BLOQUEADO' : 'CRÍTICO';
                severityColor = "#f43f5e";
            } else if (alert.severity === 'SUSPICIOUS') {
                color = "rgba(217, 70, 239, 0.9)"; // Magenta
                severityLabel = 'SUSPEITO';
                severityColor = "#d946ef";
            }
            
            arcs.push({
                startLat: originGeo.lat,
                startLng: originGeo.lon,
                endLat: destGeo.lat,
                endLng: destGeo.lon,
                color: color,
                altitude: Math.random() * 0.25 + 0.15
            });
            
            const originFlag = flagEmoji(originGeo.countryCode);
            const destFlag = flagEmoji(destGeo.countryCode);
            
            listItems.push(`
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 8px; display: flex; flex-direction: column; gap: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: ${severityColor}; font-size: 0.65rem; letter-spacing: 0.5px;">${severityLabel}</span>
                        <span style="font-size: 0.6.rem; opacity: 0.5;">${alert.time || ''}</span>
                    </div>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                        <div style="display: flex; align-items: center; gap: 4px; max-width: 110px; min-width: 0;">
                            <span style="flex-shrink: 0; display: flex; align-items: center;">${originFlag}</span>
                            <span style="color: #f1f5f9; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 85px;">${alert.ip}</span>
                        </div>
                        <span style="opacity: 0.5; font-size: 0.8rem; flex-shrink: 0;">→</span>
                        <div style="display: flex; align-items: center; gap: 4px; max-width: 110px; justify-content: flex-end; text-align: right; min-width: 0;">
                            <span style="color: #38bdf8; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 85px;" title="${alert.domain}">${alert.domain}</span>
                            <span style="flex-shrink: 0; display: flex; align-items: center;">${destFlag}</span>
                        </div>
                    </div>
                    <div style="font-size: 0.6rem; opacity: 0.5; display: flex; justify-content: space-between;">
                        <span>${originGeo.city || '--'}, ${originGeo.countryCode || '--'}</span>
                        <span>${destGeo.city || '--'}, ${destGeo.countryCode || '--'}</span>
                    </div>
                </div>
            `);
        }
    }
    
    // Adicionar conexões de tráfego geral/seguro (Cyan) de background para manter o globo vibrante
    const backgroundHubs = [
        { lat: 40.7128, lon: -74.0060, city: 'New York', countryCode: 'US' },
        { lat: 51.5074, lon: -0.1278, city: 'London', countryCode: 'GB' },
        { lat: 35.6762, lon: 139.6503, city: 'Tokyo', countryCode: 'JP' },
        { lat: -33.8688, lon: 151.2093, city: 'Sydney', countryCode: 'AU' },
        { lat: 25.2048, lon: 55.2708, city: 'Dubai', countryCode: 'AE' }
    ];
    
    // Desenha conexões dos hubs mundiais para o próprio servidor DNS Sentinel
    backgroundHubs.forEach(hub => {
        // Apenas adicionamos alguns arcos de background se tivermos poucos arcos de ameaças reais
        if (arcs.length < 12) {
            arcs.push({
                startLat: hub.lat,
                startLng: hub.lon,
                endLat: sGeo.lat + (Math.random() - 0.5) * 0.2,
                endLng: sGeo.lon + (Math.random() - 0.5) * 0.2,
                color: "rgba(0, 242, 254, 0.35)", // Ciano translúcido de background
                altitude: Math.random() * 0.2 + 0.1
            });
        }
    });

    sentinelGlobe.arcsData(arcs);

    const listEl = document.getElementById('globe-connections-list');
    if (listEl) {
        if (listItems.length === 0) {
            listEl.innerHTML = `
                <div style="text-align: center; opacity: 0.4; padding: 25px 0; font-size: 0.65rem; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <i data-lucide="shield-check" style="width:20px; height:20px; color:#10b981;"></i>
                    Sem ameaças recentes. Tráfego geral ativo.
                </div>`;
            if (window.lucide) lucide.createIcons();
        } else {
            listEl.innerHTML = listItems.join('');
        }
    }

    globeTimeoutId = setTimeout(updateGlobeArcs, 10000);
}

window.addEventListener("resize", () => {
    if (sentinelGlobe) {
        const container = document.getElementById("sentinel-globe");
        if (container) {
            sentinelGlobe.width(container.offsetWidth);
            sentinelGlobe.height(container.offsetHeight);
        }
    }
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.body.classList.contains('tv-mode')) {
            toggleTVMode();
        }
    }
});


// ===== USER MANAGEMENT (ADMIN ONLY) =====
function openUserModal(id = '', name = '', role = 'viewer') {
    const modal = document.getElementById('user-modal');
    const title = document.getElementById('user-modal-title');
    const idInput = document.getElementById('user-id');
    const nameInput = document.getElementById('user-name');
    const passInput = document.getElementById('user-pass');
    const roleInput = document.getElementById('user-role');

    if (id) {
        if(title) title.innerHTML = '<i data-lucide="user-cog"></i> Editar Usuário';
        idInput.value = id;
        idInput.disabled = true;
        nameInput.value = name;
        roleInput.value = role;
        passInput.value = '';
        passInput.placeholder = '(deixe em branco para não alterar)';
    } else {
        if(title) title.innerHTML = '<i data-lucide="user-plus"></i> Novo Usuário';
        idInput.value = '';
        idInput.disabled = false;
        nameInput.value = '';
        passInput.value = '';
        passInput.placeholder = '***';
        roleInput.value = 'viewer';
    }

    modal.classList.add('show');
}

async function loadUsers() {
    const body = document.getElementById('users-list-body');
    try {
        const res = await apiFetch('/api/system/users');
        if (!res.ok) {
            if (body) {
                body.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:#ef4444;">Erro ao carregar usuários (HTTP ${res.status}). Acesso restrito a administradores.</td></tr>`;
            }
            return;
        }

        const users = await res.json();
        if (!body) return;

        if (!Array.isArray(users) || users.length === 0) {
            body.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:var(--text-secondary);">Nenhum usuário cadastrado.</td></tr>`;
            return;
        }

        body.innerHTML = users.map(u => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:12px; font-family:var(--font-mono); font-weight:700; color:var(--text-primary);">
                    <i data-lucide="user" style="width:14px;height:14px;display:inline;margin-right:6px;color:var(--accent-primary);"></i>
                    ${u.id}
                </td>
                <td style="padding:12px; color:var(--text-primary); font-weight:600;">${u.name || u.id}</td>
                <td style="padding:12px;">
                    <span class="status-badge ${u.role === 'admin' ? 'pro' : 'free'}" style="padding:3px 8px; border-radius:4px; font-weight:700; font-size:0.7rem;">
                        ${(u.role || 'operator').toUpperCase()}
                    </span>
                </td>
                <td style="padding:12px;">
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-icon" onclick="openUserModal('${u.id}', '${u.name || u.id}', '${u.role || 'operator'}')" title="Editar" style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 6px; padding: 6px; cursor:pointer;">
                            <i data-lucide="edit-2" style="width:15px; height:15px; color:var(--accent-primary);"></i>
                        </button>
                        <button class="btn btn-icon" onclick="deleteUser('${u.id}')" title="Excluir" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 6px; padding: 6px; cursor:pointer;">
                            <i data-lucide="trash-2" style="width:15px; height:15px; color:var(--danger);"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        console.error('Falha ao carregar usuários:', e);
        if (body) {
            body.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:1.5rem; color:#ef4444;">Erro ao carregar usuários: ${e.message}</td></tr>`;
        }
    }
}

async function saveUser() {
    const id = document.getElementById('user-id').value;
    const name = document.getElementById('user-name').value;
    const password = document.getElementById('user-pass').value;
    const role = document.getElementById('user-role').value;

    if (!id || !password) return alert('ID e Senha são obrigatórios');

    try {
        const res = await apiFetch('/api/system/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, name, password, role })
        });
        if (res.ok) {
            closeModal('user-modal');
            loadUsers();
        } else {
            const err = await res.json();
            alert(err.error || 'Erro ao salvar usuário');
        }
    } catch (e) {
        alert('Erro de conexão');
    }
}

async function deleteUser(id) {
    if (!confirm(`Deseja realmente remover o usuário ${id}?`)) return;
    try {
        const res = await apiFetch(`/api/system/users/${id}`, { method: 'DELETE' });
        if (res.ok) loadUsers();
        else alert('Erro ao remover usuário');
    } catch (e) { alert('Erro de conexão'); }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Configura o seletor de idioma para o valor salvo e aplica as traduções base
    const langSelect = document.getElementById('lang-selector');
    if (langSelect && currentLang) {
        langSelect.value = currentLang;
    }
    applyTranslations();

    updateUIByRole();
    if (getUserRole() === 'admin') loadUsers();
    
    // Inicializa dados e loops
    initCharts();
    fetchStats();
    fetchSystem();
    fetchHistory();
    checkForSystemUpdate();
    
    // Loops de atualização
    setInterval(fetchStats, 10000);
    setInterval(fetchSystem, 10000);
    setInterval(checkForSystemUpdate, 7200000); // 2h
});

setTimeout(initGlobe, 1000);

// ==========================================
// PING MASTER FRONTEND INTEGRATION
// ==========================================

let pingMasterTimer = null;
let lastPingMasterServices = {};
let pingMasterDetailChart = null;
let activeDetailServiceName = null;

function toggleCustomPortField() {
    const method = document.getElementById('pm-target-method').value;
    const portContainer = document.getElementById('pm-port-container');
    const portInput = document.getElementById('pm-target-port');
    if (method === 'tcp') {
        portContainer.style.opacity = '1';
        portContainer.style.pointerEvents = 'auto';
        if (!portInput.value) portInput.value = '443';
    } else {
        portContainer.style.opacity = '0.4';
        portContainer.style.pointerEvents = 'none';
        portInput.value = '';
    }
}

async function loadPingMasterStatus() {
    const grid = document.getElementById('pingmaster-cards-grid');
    if (!grid) return;
    
    try {
        const res = await apiFetch('/api/pingmaster/status', {
            headers: authCredentials ? { 'Authorization': `Basic ${authCredentials}` } : {}
        });
        
        if (!res.ok) {
            if (res.status === 401) {
                showLogin();
                return;
            }
            throw new Error('Falha ao carregar status do Ping Master');
        }
        
        const data = await res.json();
        renderPingMaster(data.services);
    } catch (err) {
        console.error('[PingMaster] Erro:', err);
    }
}

function getBrandIconUrl(target, name) {
    let domain = target.toLowerCase().trim();
    
    if (domain === '8.8.8.8' || domain === '8.8.4.4' || name.toLowerCase().includes('google')) {
        domain = 'google.com';
    } else if (domain === '9.9.9.9' || name.toLowerCase().includes('quad9')) {
        domain = 'quad9.net';
    } else if (domain === '1.1.1.1' || name.toLowerCase().includes('cloudflare')) {
        domain = 'cloudflare.com';
    } else if (domain === '168.197.8.70') {
        domain = 'ouromax.com';
    } else if (name.toLowerCase().includes('netflix')) {
        domain = 'netflix.com';
    } else if (name.toLowerCase().includes('youtube')) {
        domain = 'youtube.com';
    }
    
    const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
    if (ipRegex.test(domain)) {
        return `https://www.google.com/s2/favicons?sz=64&domain=cloudflare.com`; 
    }
    
    return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}

function renderPingMaster(services) {
    const grid = document.getElementById('pingmaster-cards-grid');
    if (!grid) return;
    
    lastPingMasterServices = services;
    
    let totalPing = 0;
    let pingCount = 0;
    let activeCount = 0;
    let highCount = 0;
    let offlineCount = 0;
    
    let html = '';
    const serviceNames = Object.keys(services);
    
    if (serviceNames.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
                <i data-lucide="signal-off" style="width: 48px; height: 48px; color: #475569; margin-bottom: 1rem;"></i>
                <p style="color: #94a3b8; font-size: 1.1rem; margin-bottom: 0.5rem;">Nenhum alvo cadastrado no Ping Master</p>
                <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.5rem;">Adicione o seu primeiro servidor ou serviço para monitoramento.</p>
                <button class="btn btn-primary" onclick="openAddPingTargetModal()" style="background:#10b981; padding: 0.6rem 1.2rem; border-radius: 8px;">Adicionar Alvo</button>
            </div>
        `;
        lucide.createIcons();
        return;
    }
    
    serviceNames.forEach(name => {
        const item = services[name];
        const isOffline = item.ping === null;
        
        activeCount++;
        if (isOffline) {
            offlineCount++;
        } else {
            totalPing += item.ping;
            pingCount++;
            if (item.ping >= 150) highCount++;
        }
        
        let statusText = 'Excelente';
        let statusClass = 'success';
        let statusColor = '#10b981';
        if (isOffline) {
            statusText = 'Fora do Ar';
            statusClass = 'danger';
            statusColor = '#ef4444';
        } else if (item.status === 'warning') {
            statusText = 'Instável';
            statusClass = 'warning';
            statusColor = '#f59e0b';
        } else if (item.status === 'bad') {
            statusText = 'Latência Alta';
            statusClass = 'danger';
            statusColor = '#ef4444';
        }
        
        const pingVal = isOffline ? 'OFFLINE' : `${item.ping} <span style="font-size:0.8rem; font-weight:normal; color:#64748b;">ms</span>`;
        
        // Generate SVG sparkline area/line chart
        let sparkline = '';
        if (item.history && item.history.length > 1) {
            const validHistory = item.history.filter(v => v !== null);
            const maxVal = validHistory.length > 0 ? Math.max(...validHistory, 80) : 100;
            const minVal = validHistory.length > 0 ? Math.min(...validHistory, 0) : 0;
            const range = maxVal - minVal || 1;
            
            const points = item.history.map((val, idx) => {
                const x = (idx / (item.history.length - 1)) * 120;
                const v = val === null ? maxVal : val;
                const y = 30 - ((v - minVal) / range) * 26;
                return `${x},${y}`;
            }).join(' ');
            
            const fillPoints = `${points} 120,30 0,30`;
            const gradientId = `pm-grad-${item.name.replace(/\s+/g, '-').toLowerCase()}`;
            
            sparkline = `
                <svg width="120" height="30" style="overflow:visible;" class="pm-sparkline-svg">
                    <defs>
                        <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="${statusColor}" stop-opacity="0.25"/>
                            <stop offset="100%" stop-color="${statusColor}" stop-opacity="0.0"/>
                        </linearGradient>
                    </defs>
                    <polygon fill="url(#${gradientId})" points="${fillPoints}" />
                    <polyline fill="none" stroke="${statusColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
                </svg>
            `;
        }
        
        html += `
            <div class="noc-card ${statusClass} pingmaster-card-clickable" 
                 onclick="handleCardClick(event, '${item.name}')"
                 style="display:flex; flex-direction:column; justify-content:space-between; padding:1.25rem; min-height:165px; position:relative; overflow:hidden;">
                <!-- Header with Status dot and Brand Icon -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <!-- Glowing Status Dot -->
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 10px ${statusColor}; display: inline-block;"></span>
                        
                        <!-- Premium Icon Container -->
                        <div style="width: 34px; height: 34px; border-radius: 8px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 5px;">
                            <img src="${getBrandIconUrl(item.target, item.name)}" style="width: 20px; height: 20px; object-fit: contain;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><circle cx=\'12\' cy=\'12\' r=\'10\'/><line x1=\'2\' y1=\'12\' x2=\'22\' y2=\'12\'/><path d=\'M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z\'/></svg>';" />
                        </div>
                        
                        <div>
                            <div style="font-weight:700; color:#f1f5f9; font-size:1.05rem; line-height:1.2;">${item.name}</div>
                            <div style="font-size:0.72rem; color:#475569; letter-spacing:0.5px; margin-top:2px;">${item.target}</div>
                        </div>
                    </div>
                    <span class="live-badge" style="background:${isOffline ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}; border:1px solid ${isOffline ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}; color:${isOffline ? '#ef4444' : '#10b981'}; font-weight:700; font-size:0.68rem; padding:3px 8px; border-radius:6px; letter-spacing:0.5px;">
                        ${statusText}
                    </span>
                </div>
                
                <!-- Live Value -->
                <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                    <div style="font-size:1.6rem; font-weight:800; color:${isOffline ? '#ef4444' : '#f8fafc'}; line-height:1; letter-spacing:-0.5px; text-shadow:0 0 20px ${isOffline ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.15)'};">
                        ${pingVal}
                    </div>
                    <div style="opacity:0.85;">
                        ${sparkline}
                    </div>
                </div>
                
                <!-- Bottom detail line & Delete button -->
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.75rem; padding-top:0.6rem; border-top:1px solid rgba(255,255,255,0.03); font-size:0.72rem; color:#64748b;">
                    <div>Jitter: ${item.jitter}ms | Perda: ${item.loss}%</div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="event.stopPropagation(); editPingTarget('${item.name}')" style="background:none; border:none; color:#3b82f6; opacity:0.6; cursor:pointer; padding:2px; transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">
                            <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
                        </button>
                        <button onclick="event.stopPropagation(); deletePingTarget('${item.name}')" style="background:none; border:none; color:#ef4444; opacity:0.4; cursor:pointer; padding:2px; transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.4'">
                            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
    lucide.createIcons();
    
    document.getElementById('pm-avg-ping').textContent = `${pingCount > 0 ? Math.round(totalPing / pingCount) : 0} ms`;
    document.getElementById('pm-active-count').textContent = activeCount;
    document.getElementById('pm-high-count').textContent = highCount;
    document.getElementById('pm-offline-count').textContent = offlineCount;
    
    // Se o modal de telemetria detalhada estiver aberto e ativo, atualiza em tempo real!
    if (activeDetailServiceName && services[activeDetailServiceName]) {
        updateTelemetryDetailData(services[activeDetailServiceName]);
    }
}

function handleCardClick(event, name) {
    if (event.target.closest('button')) return;
    openPingMasterDetailModal(name);
}

function openAddPingTargetModal() {
    if ((!localStorage.getItem('sentinel_user'))) {
        showLogin();
        return;
    }
    document.getElementById('pm-target-name').value = '';
    document.getElementById('pm-target-name').readOnly = false;
    document.getElementById('pm-target-address').value = '';
    document.getElementById('pm-target-method').value = 'smart';
    document.getElementById('pm-target-port').value = '';
    document.getElementById('pm-target-interval').value = '8000';
    document.getElementById('pm-modal-error').textContent = '';
    toggleCustomPortField();
    document.getElementById('ping-target-modal').classList.add('show');
}

function editPingTarget(name) {
    if ((!localStorage.getItem('sentinel_user'))) {
        showLogin();
        return;
    }
    const item = lastPingMasterServices[name];
    if (!item) return;
    
    document.getElementById('pm-target-name').value = item.name;
    document.getElementById('pm-target-name').readOnly = true;
    document.getElementById('pm-target-address').value = item.target;
    document.getElementById('pm-target-method').value = item.method || 'smart';
    document.getElementById('pm-target-port').value = item.port || '';
    document.getElementById('pm-target-interval').value = item.interval || '8000';
    document.getElementById('pm-modal-error').textContent = '';
    toggleCustomPortField();
    document.getElementById('ping-target-modal').classList.add('show');
}

function closePingTargetModal() {
    document.getElementById('ping-target-modal').classList.remove('show');
}

async function savePingTarget() {
    const name = document.getElementById('pm-target-name').value.trim();
    const target = document.getElementById('pm-target-address').value.trim();
    const method = document.getElementById('pm-target-method').value;
    const port = document.getElementById('pm-target-port').value.trim();
    const interval = document.getElementById('pm-target-interval').value;
    const errorEl = document.getElementById('pm-modal-error');
    
    if (!name || !target) {
        errorEl.textContent = 'Por favor, preencha todos os campos obrigatórios.';
        return;
    }
    
    if (method === 'tcp' && !port) {
        errorEl.textContent = 'Por favor, informe a porta TCP para este protocolo.';
        return;
    }
    
    try {
        const res = await apiFetch('/api/pingmaster/target', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authCredentials}`
            },
            body: JSON.stringify({ 
                name, 
                target, 
                method, 
                port: port ? parseInt(port, 10) : null, 
                interval: parseInt(interval, 10) 
            })
        });
        
        if (res.ok) {
            closePingTargetModal();
            loadPingMasterStatus();
        } else {
            const data = await res.json();
            errorEl.textContent = data.error || 'Erro ao salvar o alvo.';
        }
    } catch (err) {
        errorEl.textContent = 'Erro de comunicação com o servidor.';
    }
}

async function deletePingTarget(name) {
    if ((!localStorage.getItem('sentinel_user'))) {
        showLogin();
        return;
    }
    if (!confirm(`Tem certeza que deseja remover "${name}" do monitoramento?`)) return;
    
    try {
        const res = await apiFetch('/api/pingmaster/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authCredentials}`
            },
            body: JSON.stringify({ name })
        });
        
        if (res.ok) {
            loadPingMasterStatus();
        }
    } catch (err) {
        console.error('[PingMaster] Erro ao deletar:', err);
        alert('Erro ao remover alvo.');
    }
}

function openPingMasterDetailModal(name) {
    const item = lastPingMasterServices[name];
    if (!item) return;
    
    activeDetailServiceName = name;
    
    // Set static text and brand icon
    document.getElementById('pm-detail-title').textContent = item.name;
    document.getElementById('pm-detail-subtitle').textContent = item.target;
    document.getElementById('pm-detail-brand-icon').src = getBrandIconUrl(item.target, item.name);
    
    // Set protocol and frequency
    let protocolText = 'Smart Check';
    if (item.method === 'icmp') protocolText = 'ICMP Ping';
    else if (item.method === 'tcp') protocolText = `TCP (Porta ${item.port || 443})`;
    document.getElementById('pm-detail-method').textContent = protocolText;
    document.getElementById('pm-detail-interval').textContent = `${(item.interval || 8000) / 1000}s`;
    
    // Setup and display modal
    const modal = document.getElementById('pingmaster-detail-modal');
    modal.style.display = 'flex';
    
    // Calculate telemetry values
    updateTelemetryDetailData(item);
    
    // Determine status color for graph accent
    let statusColor = '#10b981';
    if (item.ping === null) statusColor = '#ef4444';
    else if (item.status === 'warning') statusColor = '#f59e0b';
    else if (item.status === 'bad') statusColor = '#ef4444';
    
    // Render the interactive history chart
    if (pingMasterDetailChart) {
        pingMasterDetailChart.destroy();
    }
    
    const options = {
        series: [{
            name: 'Latência',
            data: item.history.map(val => val === null ? null : val)
        }],
        chart: {
            type: 'area',
            height: 220,
            sparkline: { enabled: false },
            toolbar: { show: false },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 400
            }
        },
        stroke: {
            curve: 'smooth',
            width: 3,
            colors: [statusColor]
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.0,
                stops: [0, 100],
                colorStops: [
                    { offset: 0, color: statusColor, opacity: 0.35 },
                    { offset: 100, color: statusColor, opacity: 0.0 }
                ]
            }
        },
        grid: {
            show: true,
            borderColor: 'rgba(255, 255, 255, 0.04)',
            strokeDashArray: 4,
            xaxis: { lines: { show: false } },
            yaxis: { lines: { show: true } }
        },
        xaxis: {
            type: 'category',
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#64748b',
                    fontSize: '11px',
                    fontFamily: 'JetBrains Mono, monospace'
                },
                formatter: function(val) {
                    return val !== null ? Math.round(val) + ' ms' : 'Off';
                }
            }
        },
        tooltip: {
            theme: 'dark',
            x: { show: false },
            y: {
                formatter: function(val) {
                    return val !== null ? `<strong>${val} ms</strong>` : 'Offline / Perda';
                }
            }
        },
        markers: {
            size: 0,
            colors: [statusColor],
            strokeColors: '#0b1329',
            strokeWidth: 2,
            hover: { size: 5 }
        }
    };
    
    setTimeout(() => {
        pingMasterDetailChart = new ApexCharts(document.getElementById('pingmaster-detail-chart'), options);
        pingMasterDetailChart.render();
    }, 100);
}

function closePingMasterDetailModal() {
    document.getElementById('pingmaster-detail-modal').style.display = 'none';
    activeDetailServiceName = null;
    if (pingMasterDetailChart) {
        pingMasterDetailChart.destroy();
        pingMasterDetailChart = null;
    }
}

function updateTelemetryDetailData(item) {
    const validPings = item.history.filter(v => v !== null && v > 0);
    const minPing = validPings.length > 0 ? Math.min(...validPings) : 0;
    const maxPing = validPings.length > 0 ? Math.max(...validPings) : 0;
    const avgPing = validPings.length > 0 ? Math.round(validPings.reduce((a, b) => a + b, 0) / validPings.length) : 0;
    
    document.getElementById('pm-detail-min-ping').textContent = minPing ? `${minPing} ms` : '--';
    document.getElementById('pm-detail-avg-ping').textContent = avgPing ? `${avgPing} ms` : '--';
    document.getElementById('pm-detail-max-ping').textContent = maxPing ? `${maxPing} ms` : '--';
    document.getElementById('pm-detail-jitter').textContent = `${item.jitter} ms`;
    document.getElementById('pm-detail-total').textContent = item.history.length;
    
    const lossBadge = document.getElementById('pm-detail-loss-badge');
    lossBadge.textContent = `Perda: ${item.loss}%`;
    if (item.loss > 20) {
        lossBadge.style.color = '#ef4444';
        lossBadge.style.background = 'rgba(239, 68, 68, 0.1)';
        lossBadge.style.borderColor = 'rgba(239, 68, 68, 0.2)';
    } else if (item.loss > 0) {
        lossBadge.style.color = '#f59e0b';
        lossBadge.style.background = 'rgba(245, 158, 11, 0.1)';
        lossBadge.style.borderColor = 'rgba(245, 158, 11, 0.2)';
    } else {
        lossBadge.style.color = '#10b981';
        lossBadge.style.background = 'rgba(16, 185, 129, 0.1)';
        lossBadge.style.borderColor = 'rgba(16, 185, 129, 0.2)';
    }
    
    let statusText = 'Excelente';
    let statusColor = '#10b981';
    if (item.ping === null) {
        statusText = 'Fora do Ar';
        statusColor = '#ef4444';
    } else if (item.status === 'warning') {
        statusText = 'Instável';
        statusColor = '#f59e0b';
    } else if (item.status === 'bad') {
        statusText = 'Latência Alta';
        statusColor = '#ef4444';
    }
    
    const badge = document.getElementById('pm-detail-status-badge');
    badge.textContent = statusText;
    badge.style.color = statusColor;
    badge.style.background = `${statusColor}20`; 
    badge.style.borderColor = `${statusColor}40`;
    
    if (pingMasterDetailChart) {
        pingMasterDetailChart.updateSeries([{
            data: item.history.map(val => val === null ? null : val)
        }]);
    }
}

function renderTimeSettings() {
    const view = document.getElementById('time-view');
    view.innerHTML = `<p class="loading">Carregando configurações de fuso horário...</p>`;

    apiFetch(`${API_BASE}/system`)
        .then(r => r.json())
        .then(data => {
            const timezones = [
                'America/Sao_Paulo',
                'America/Porto_Velho',
                'America/Manaus',
                'America/Cuiaba',
                'America/Recife',
                'America/Belem',
                'America/Fortaleza',
                'America/Araguaina',
                'America/Bahia',
                'America/Campo_Grande',
                'America/Maceio',
                'America/Noronha',
                'UTC'
            ];

            const tzOptions = timezones.map(tz => 
                `<option value="${tz}" ${data.timezone === tz ? 'selected' : ''}>${tz}</option>`
            ).join('');

            view.innerHTML = `
            <div style="max-width:600px;">
                <div style="margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;padding-bottom:0.75rem;border-bottom:1px solid var(--card-border);">
                        <i data-lucide="clock" style="color:#38bdf8;width:18px;height:18px;"></i>
                        <h3 style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Data & Hora Atual do Servidor</h3>
                    </div>
                    
                    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--card-border); padding:1.5rem; border-radius:12px; margin-bottom:1.5rem;">
                        <div style="font-size:0.75rem; text-transform:uppercase; color:#64748b; margin-bottom:6px; font-weight:700; letter-spacing:0.5px;">Hora do Sistema</div>
                        <div id="server-time-display" style="font-family:'JetBrains Mono',monospace; font-size:1.8rem; font-weight:800; color:#38bdf8;">${data.serverTime || '--:--:--'}</div>
                        <div style="font-size:0.75rem; color:#64748b; margin-top:8px;">Fuso Horário Ativo: <strong id="active-timezone-display" style="color:#f1f5f9;">${data.timezone || 'UTC'}</strong></div>
                    </div>
                </div>

                <div style="margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;padding-bottom:0.75rem;border-bottom:1px solid var(--card-border);">
                        <i data-lucide="globe" style="color:#10b981;width:18px;height:18px;"></i>
                        <h3 style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Configurar Fuso Horário (Timezone)</h3>
                    </div>
                    <div class="input-group" style="margin-bottom:1rem;">
                        <label style="font-size:0.78rem;color:#94a3b8;margin-bottom:8px;display:block;">Selecione o Timezone do Servidor</label>
                        <select id="time-timezone-select" style="width:100%; padding:0.75rem 1rem; background:rgba(0,0,0,0.3); border:1px solid var(--card-border); border-radius:8px; color:#fff; font-size:0.9rem; outline:none; border: 1px solid #1e293b;">
                            ${tzOptions}
                        </select>
                    </div>
                    <button class="btn btn-primary" onclick="saveTimeSettings(false)" style="margin-top:0.5rem;">ALTERAR FUSO HORÁRIO</button>
                </div>

                <div style="margin-bottom:2rem;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:1.2rem;padding-bottom:0.75rem;border-bottom:1px solid var(--card-border);">
                        <i data-lucide="refresh-cw" style="color:#f59e0b;width:18px;height:18px;"></i>
                        <h3 style="font-size:0.85rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:1px;">Sincronizar NTP</h3>
                    </div>
                    <p style="font-size:0.8rem; color:#64748b; line-height:1.5; margin-bottom:1.2rem;">
                        Forçar uma atualização imediata do relógio usando os servidores públicos NTP brasileiros (pool.ntp.br). Útil para corrigir erros massivos de validação DNSSEC.
                    </p>
                    <button class="btn btn-secondary" onclick="saveTimeSettings(true)" style="border:1px solid rgba(245,158,11,0.3); color:#f59e0b; background:rgba(245,158,11,0.05); padding: 8px 16px; display: inline-flex; align-items: center; gap: 8px; border-radius: 8px;">
                        <i data-lucide="refresh-cw" style="width:14px; height:14px;"></i> SINCRONIZAR AGORA (NTP)
                    </button>
                </div>
                
                <div id="time-save-status" style="font-size:0.8rem; font-weight:700; margin-top:1rem;"></div>
            </div>
            `;
            lucide.createIcons();
        })
        .catch(() => view.innerHTML = '<p class="error-text">Erro ao carregar dados do fuso horário.</p>');
}

function saveTimeSettings(syncNtp) {
    const tzSelect = document.getElementById('time-timezone-select');
    const statusEl = document.getElementById('time-save-status');
    if (!tzSelect && !syncNtp) return;

    statusEl.innerText = syncNtp ? 'Sincronizando relógio via NTP...' : 'Salvando fuso horário...';
    statusEl.style.color = '#f59e0b';

    apiFetch(`${API_BASE}/system/sync-time`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            timezone: syncNtp ? null : tzSelect.value,
            syncNtp: syncNtp
        })
    })
    .then(r => r.json())
    .then(res => {
        if (res.success) {
            statusEl.innerText = syncNtp ? '✓ Relógio sincronizado com sucesso!' : '✓ Fuso horário atualizado com sucesso!';
            statusEl.style.color = '#10b981';
            
            const timeDisplay = document.getElementById('server-time-display');
            if (timeDisplay) timeDisplay.innerText = res.serverTime;

            const tzDisplay = document.getElementById('active-timezone-display');
            if (tzDisplay && res.timezone) tzDisplay.innerText = res.timezone;
            
            setTimeout(() => { statusEl.innerText = ''; }, 3000);
        } else {
            throw new Error(res.error || 'Erro desconhecido');
        }
    })
    .catch(err => {
        statusEl.innerText = `✗ Falha ao processar: ${err.message}`;
        statusEl.style.color = '#ef4444';
    });
}

// ============================================
// PI-HOLE SUITE MODULES (UNBOUND SENTINEL)
// ============================================
window.switchSecurityTab = function(tabId) {
    document.querySelectorAll('.btn-sec-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.sec-tab-content').forEach(pane => pane.classList.remove('active'));
    
    const activeBtn = document.querySelector(`.btn-sec-tab[onclick*="'${tabId}'"]`);
    if (activeBtn) activeBtn.classList.add('active');
    
    const activePane = document.getElementById(`sec-tab-${tabId}`);
    if (activePane) activePane.classList.add('active');
    
    // Control live queries polling
    if (tabId === 'live-queries') {
        loadLiveQueries(true);
        if (!window.liveQueriesInterval) {
            window.liveQueriesInterval = setInterval(() => loadLiveQueries(false), 2000);
        }
    } else {
        if (window.liveQueriesInterval) {
            clearInterval(window.liveQueriesInterval);
            window.liveQueriesInterval = null;
        }
    }
    
    if (tabId === 'gravity') {
        loadAdlists();
    }
    
    if (tabId === 'local-rules') {
        loadLocalRules();
    }
};

window.allLiveQueries = [];
window.loadLiveQueries = async function(force = false) {
    const tableBody = document.getElementById('live-queries-table-body');
    if (!tableBody) return;
    
    // Only show loading if forced or table is empty
    if (force || tableBody.innerHTML.includes('Carregando') || window.allLiveQueries.length === 0) {
        if (force) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 3rem; opacity: 0.7;">
                        <i data-lucide="refresh-cw" class="spin" style="width: 20px; height: 20px; margin-bottom: 8px;"></i>
                        <div>Buscando logs de consulta em tempo real...</div>
                    </td>
                </tr>
            `;
            if (window.lucide) lucide.createIcons();
        }
    }
    
    try {
        const res = await apiFetch('/api/security/live-queries');
        if (!res.ok) throw new Error('Falha de rede');
        const queries = await res.json();
        
        window.allLiveQueries = queries || [];
        renderLiveQueries(window.allLiveQueries);
    } catch (e) {
        console.error('Erro ao buscar live queries:', e);
        if (force) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 3rem; color: var(--accent-danger);">
                        <i data-lucide="alert-circle" style="width: 20px; height: 20px; margin-bottom: 8px;"></i>
                        <div>Erro de autenticação ou falha de conexão. Tente recarregar.</div>
                    </td>
                </tr>
            `;
            if (window.lucide) lucide.createIcons();
        }
    }
};

function renderLiveQueries(queries) {
    const tableBody = document.getElementById('live-queries-table-body');
    const counterEl = document.getElementById('live-query-counter');
    if (!tableBody) return;
    
    if (counterEl) counterEl.innerText = `${queries.length} consultas`;
    
    if (queries.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 3rem; opacity: 0.5;">
                    Nenhuma consulta recente encontrada no log.
                </td>
            </tr>
        `;
        return;
    }
    
    tableBody.innerHTML = queries.map(q => {
        let statusBadge = '';
        if (q.status === 'Bloqueado') {
            statusBadge = `<span class="status-tag" style="background:rgba(244,63,94,0.15); color:var(--accent-danger); border:1px solid rgba(244,63,94,0.3); font-weight:700;">BLOQUEADO</span>`;
        } else if (q.status === 'Liberado (Whitelist)') {
            statusBadge = `<span class="status-tag" style="background:rgba(56,189,248,0.15); color:var(--accent-primary); border:1px solid rgba(56,189,248,0.3); font-weight:700;">WHITELIST</span>`;
        } else {
            statusBadge = `<span class="status-tag" style="background:rgba(16,185,129,0.15); color:var(--accent-success); border:1px solid rgba(16,185,129,0.3); font-weight:700;">PERMITIDO</span>`;
        }
        
        let actionButtons = '';
        if (q.status === 'Bloqueado') {
            actionButtons = `
                <button onclick="quickWhitelist('${q.domain}')" class="btn-action success" title="Permitir (Whitelist)" style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); color:#10b981; padding: 5px; border-radius: 6px; display:inline-flex; align-items:center; justify-content:center;">
                    <i data-lucide="check" style="width: 13px; height: 13px;"></i>
                </button>
                <button disabled class="btn-action danger" title="Já bloqueado" style="opacity:0.3; cursor:not-allowed; padding: 5px; border-radius: 6px; display:inline-flex; align-items:center; justify-content:center;">
                    <i data-lucide="ban" style="width: 13px; height: 13px;"></i>
                </button>
            `;
        } else if (q.status === 'Liberado (Whitelist)') {
            actionButtons = `
                <button disabled class="btn-action success" title="Já liberado" style="opacity:0.3; cursor:not-allowed; padding: 5px; border-radius: 6px; display:inline-flex; align-items:center; justify-content:center;">
                    <i data-lucide="check" style="width: 13px; height: 13px;"></i>
                </button>
                <button onclick="quickBlacklist('${q.domain}')" class="btn-action danger" title="Bloquear (Blacklist)" style="background:rgba(244,63,94,0.12); border:1px solid rgba(244,63,94,0.3); color:#f43f5e; padding: 5px; border-radius: 6px; display:inline-flex; align-items:center; justify-content:center;">
                    <i data-lucide="ban" style="width: 13px; height: 13px;"></i>
                </button>
            `;
        } else {
            actionButtons = `
                <button onclick="quickWhitelist('${q.domain}')" class="btn-action success" title="Permitir (Whitelist)" style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); color:#10b981; padding: 5px; border-radius: 6px; display:inline-flex; align-items:center; justify-content:center;">
                    <i data-lucide="check" style="width: 13px; height: 13px;"></i>
                </button>
                <button onclick="quickBlacklist('${q.domain}')" class="btn-action danger" title="Bloquear (Blacklist)" style="background:rgba(244,63,94,0.12); border:1px solid rgba(244,63,94,0.3); color:#f43f5e; padding: 5px; border-radius: 6px; display:inline-flex; align-items:center; justify-content:center;">
                    <i data-lucide="ban" style="width: 13px; height: 13px;"></i>
                </button>
            `;
        }
        
        return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
                <td style="padding: 10px; font-size: 0.75rem; color: var(--text-secondary); font-family: 'JetBrains Mono', monospace;">${q.timestamp}</td>
                <td style="padding: 10px; font-size: 0.78rem; color: #fff; font-family: 'JetBrains Mono', monospace;">${q.clientIp}</td>
                <td style="padding: 10px; font-size: 0.78rem; color: var(--accent-primary); font-family: 'JetBrains Mono', monospace; word-break: break-all;" title="${q.domain}">${q.domain}</td>
                <td style="padding: 10px; font-size: 0.75rem; font-weight: 700; color: #fff;"><span class="status-tag" style="background:rgba(255,255,255,0.05); color:#fff; border:none; padding:2px 6px;">${q.type}</span></td>
                <td style="padding: 10px; font-size: 0.75rem;">${statusBadge}</td>
                <td style="padding: 10px; text-align: center; display: flex; gap: 6px; justify-content: center; align-items: center;">${actionButtons}</td>
            </tr>
        `;
    }).join('');
    
    if (window.lucide) lucide.createIcons();
}

window.filterLiveQueries = function() {
    const searchVal = document.getElementById('live-query-search').value.trim().toLowerCase();
    if (!searchVal) {
        renderLiveQueries(window.allLiveQueries);
        return;
    }
    const filtered = window.allLiveQueries.filter(q => 
        q.domain.includes(searchVal) || q.clientIp.includes(searchVal)
    );
    renderLiveQueries(filtered);
};

window.quickWhitelist = async function(domain) {
    try {
        const res = await apiFetch('/api/security/local-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'whitelist', domain })
        });
        if (res.ok) {
            alert(`✅ Sucesso! O domínio '${domain}' foi adicionado à Whitelist.`);
            loadLiveQueries(true);
        } else {
            const data = await res.json();
            alert(`❌ Falha: ${data.error || 'Erro desconhecido'}`);
        }
    } catch (e) {
        alert('Erro ao adicionar domínio à Whitelist. Faça login como admin.');
    }
};

window.quickBlacklist = async function(domain) {
    try {
        const res = await apiFetch('/api/security/local-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'blacklist', domain })
        });
        if (res.ok) {
            alert(`✅ Sucesso! O domínio '${domain}' foi adicionado à Blacklist.`);
            loadLiveQueries(true);
        } else {
            const data = await res.json();
            alert(`❌ Falha: ${data.error || 'Erro desconhecido'}`);
        }
    } catch (e) {
        alert('Erro ao adicionar domínio à Blacklist. Faça login como admin.');
    }
};

window.loadAdlists = async function() {
    const grid = document.getElementById('gravity-adlists-grid');
    if (!grid) return;
    
    grid.innerHTML = `
        <div style="grid-column: span 3; text-align: center; padding: 3rem; opacity: 0.5;">
            <i data-lucide="refresh-cw" class="spin" style="width: 20px; height: 20px; margin-bottom: 8px;"></i>
            <div>Carregando listas de bloqueio (Adlists)...</div>
        </div>
    `;
    if (window.lucide) lucide.createIcons();
    
    try {
        const res = await apiFetch('/api/security/sources');
        const sources = await res.json();
        
        if (sources.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: span 3; text-align: center; padding: 3rem; opacity: 0.5;">
                    Nenhuma lista de bloqueio cadastrada.
                </div>
            `;
            return;
        }
        
        grid.innerHTML = sources.map(s => {
            const urlDisplay = s.url.length > 40 ? s.url.substring(0, 37) + '...' : s.url;
            return `
                <div class="sys-info-box" style="padding: 1.2rem; border-radius: 14px; display: flex; flex-direction: column; justify-content: space-between; border-left: 3px solid ${s.enabled ? 'var(--accent-primary)' : '#475569'}; background: ${s.enabled ? 'rgba(56,189,248,0.02)' : 'rgba(255,255,255,0.01)'}">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                            <h4 style="margin:0; font-size:0.9rem; font-weight:800; color:#fff;">${s.name}</h4>
                            <span class="status-tag" style="background:rgba(56,189,248,0.1); color:var(--accent-primary); border:1px solid rgba(56,189,248,0.2); font-size:0.6rem; padding:1px 6px;">${s.category}</span>
                        </div>
                        <p style="font-size:0.75rem; color:var(--text-secondary); margin: 0 0 10px 0; min-height: 30px;">${s.description || 'Sem descrição.'}</p>
                        <a href="${s.url}" target="_blank" style="font-size:0.7rem; color:var(--accent-primary); text-decoration:none; font-family:'JetBrains Mono'; word-break:break-all;" title="${s.url}">${urlDisplay}</a>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:1.2rem; border-top:1px solid rgba(255,255,255,0.03); padding-top:10px;">
                        <label class="switch" style="transform: scale(0.8); margin: 0;">
                            <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleCTISource('${s.id}')">
                            <span class="slider"></span>
                        </label>
                        <button onclick="deleteAdlist('${s.id}', '${s.name.replace(/'/g, "\\'")}')" class="btn-action danger" title="Remover lista" style="background:rgba(244,63,94,0.12); border:1px solid rgba(244,63,94,0.3); color:#f43f5e; padding:6px; border-radius:6px;">
                            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        grid.innerHTML = `
            <div style="grid-column: span 3; text-align: center; padding: 3rem; color: var(--accent-danger);">
                Erro ao carregar fontes. Verifique suas credenciais de administrador.
            </div>
        `;
    }
};

window.deleteAdlist = async function(id, name) {
    if (!confirm(`Tem certeza de que deseja remover a lista de bloqueio '${name}'?`)) return;
    try {
        const res = await apiFetch(`/api/security/sources/${id}`, { method: 'DELETE' });
        if (res.ok) {
            alert(`✅ Lista '${name}' removida com sucesso.`);
            loadAdlists();
        } else {
            const data = await res.json();
            alert(`❌ Falha: ${data.error || 'Erro desconhecido'}`);
        }
    } catch (e) {
        alert('Erro ao excluir lista. Faça login como admin.');
    }
};

window.openAddAdlistModal = function() {
    const modal = document.getElementById('modal-add-adlist');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('add-adlist-name').value = '';
        document.getElementById('add-adlist-description').value = '';
        document.getElementById('add-adlist-url').value = '';
        document.getElementById('add-adlist-category').value = 'Custom';
        document.getElementById('add-adlist-type').value = 'plain';
    }
};

window.closeAddAdlistModal = function() {
    const modal = document.getElementById('modal-add-adlist');
    if (modal) modal.style.display = 'none';
};

window.submitAddAdlist = async function() {
    const name = document.getElementById('add-adlist-name').value.trim();
    const description = document.getElementById('add-adlist-description').value.trim();
    const url = document.getElementById('add-adlist-url').value.trim();
    const category = document.getElementById('add-adlist-category').value.trim();
    const type = document.getElementById('add-adlist-type').value;
    
    if (!name || !url) {
        alert('Por favor, preencha os campos obrigatórios (Nome e URL).');
        return;
    }
    
    try {
        const res = await apiFetch('/api/security/sources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description, url, category, type })
        });
        
        if (res.ok) {
            alert('✅ Lista adicionada com sucesso!');
            closeAddAdlistModal();
            loadAdlists();
        } else {
            const data = await res.json();
            alert(`❌ Erro: ${data.error || 'Não foi possível adicionar a lista.'}`);
        }
    } catch (e) {
        alert('Erro ao adicionar lista. Faça login como admin.');
    }
};

window.syncGravity = async function() {
    const btn = document.getElementById('btn-sync-gravity');
    if (!btn) return;
    
    const originalContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="refresh-cw" class="spin" style="width: 14px; height: 14px;"></i> Sincronizando...';
    if (window.lucide) lucide.createIcons();
    
    try {
        const res = await apiFetch('/api/security/sync', { method: 'POST' });
        if (res.ok) {
            alert('🚀 Sincronização e rebuild da base de bloqueios (Gravity) iniciada em segundo plano! O Unbound será atualizado automaticamente ao finalizar.');
        } else {
            alert('❌ Falha ao iniciar sincronização.');
        }
    } catch (e) {
        alert('Erro ao sincronizar.');
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            if (window.lucide) lucide.createIcons();
        }, 3000);
    }
};

window.localWhitelist = [];
window.localBlacklist = [];

window.loadLocalRules = async function() {
    const whitelistContainer = document.getElementById('whitelist-domains-list');
    const blacklistContainer = document.getElementById('blacklist-domains-list');
    if (!whitelistContainer || !blacklistContainer) return;
    
    const loadingHtml = '<div style="text-align:center; padding:2rem; opacity:0.3;">Carregando regras...</div>';
    whitelistContainer.innerHTML = loadingHtml;
    blacklistContainer.innerHTML = loadingHtml;
    
    try {
        const res = await apiFetch('/api/security/local-rules');
        const data = await res.json();
        
        window.localWhitelist = data.whitelist || [];
        window.localBlacklist = data.blacklist || [];
        
        renderLocalRulesList('whitelist', window.localWhitelist);
        renderLocalRulesList('blacklist', window.localBlacklist);
    } catch (e) {
        const errorHtml = '<div style="text-align:center; padding:2rem; color:var(--accent-danger); font-size:0.8rem;">Falha ao carregar regras locais.</div>';
        whitelistContainer.innerHTML = errorHtml;
        blacklistContainer.innerHTML = errorHtml;
    }
};

function renderLocalRulesList(type, domains) {
    const container = document.getElementById(`${type}-domains-list`);
    const countEl = document.getElementById(`${type}-count`);
    if (!container) return;
    
    if (countEl) countEl.innerText = `${domains.length} domínios`;
    
    if (domains.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:2rem; opacity:0.3; font-size:0.8rem;">
                Nenhum domínio cadastrado nesta lista.
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    domains.forEach(d => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); padding:8px 12px; border-radius:10px; font-family:"JetBrains Mono", monospace; font-size:0.78rem; transition: background 0.2s;';
        
        const span = document.createElement('span');
        span.style.cssText = 'color:#f8fafc; word-break:break-all; padding-right:8px;';
        span.textContent = d;
        div.appendChild(span);

        const btn = document.createElement('button');
        btn.className = 'btn-action danger';
        btn.title = 'Remover regra';
        btn.style.cssText = 'background:rgba(244,63,94,0.1); border:none; color:#f43f5e; padding:4px; border-radius:6px; cursor:pointer;';
        btn.innerHTML = '<i data-lucide="x" style="width:12px; height:12px;"></i>';
        btn.addEventListener('click', () => deleteLocalRule(type, d));
        div.appendChild(btn);

        container.appendChild(div);
    });
    if (window.lucide) lucide.createIcons();
}

window.filterLocalRulesList = function(type) {
    const searchVal = document.getElementById(`${type}-search`).value.trim().toLowerCase();
    const sourceArr = type === 'whitelist' ? window.localWhitelist : window.localBlacklist;
    
    if (!searchVal) {
        renderLocalRulesList(type, sourceArr);
        return;
    }
    
    const filtered = sourceArr.filter(d => d.includes(searchVal));
    renderLocalRulesList(type, filtered);
};

window.addLocalRuleManual = async function() {
    const typeSelect = document.getElementById('local-rule-add-type');
    const domainInput = document.getElementById('local-rule-add-domain');
    if (!typeSelect || !domainInput) return;
    
    const type = typeSelect.value;
    const domain = domainInput.value.trim().toLowerCase();
    
    if (!domain) {
        alert('Por favor, informe um domínio válido.');
        return;
    }
    
    try {
        const res = await apiFetch('/api/security/local-rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, domain })
        });
        
        if (res.ok) {
            alert(`✅ Sucesso! O domínio '${domain}' foi adicionado à ${type === 'whitelist' ? 'Whitelist' : 'Blacklist'}.`);
            domainInput.value = '';
            loadLocalRules();
        } else {
            const data = await res.json();
            alert(`❌ Falha: ${data.error || 'Erro desconhecido'}`);
        }
    } catch (e) {
        alert('Erro ao adicionar regra. Faça login como admin.');
    }
};

window.deleteLocalRule = async function(type, domain) {
    if (!confirm(`Deseja remover o domínio '${domain}' da ${type === 'whitelist' ? 'Whitelist' : 'Blacklist'}?`)) return;
    try {
        const res = await apiFetch('/api/security/local-rules', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, domain })
        });
        
        if (res.ok) {
            alert(`✅ Sucesso! Domínio removido com sucesso.`);
            loadLocalRules();
        } else {
            const data = await res.json();
            alert(`❌ Falha: ${data.error || 'Erro desconhecido'}`);
        }
    } catch (e) {
        alert('Erro ao remover regra. Faça login como admin.');
    }
};



// ==========================================
// PRICING MANAGEMENT MODAL (ADMIN ONLY)
// ==========================================

let globalPricingData = null;

async function openPricingModal() {
    try {
        const res = await apiFetch(`${API_BASE}/system/pricing`);
        if (!res.ok) throw new Error('Falha ao carregar preços atuais.');
        const data = await res.json();
        globalPricingData = data;
        
        const providerNameEl = document.getElementById('pricing-provider-name');
        if (providerNameEl) providerNameEl.value = data.provider_name || '';
        
        document.getElementById('pricing-pro-text').value = data.pro?.price || 'R$ 50,00';
        document.getElementById('pricing-pro-stripe').value = data.pro?.stripe_price || 5000;
        
        document.getElementById('pricing-promo-badge').value = data.promo?.badge_text || '-40% OFF';
        document.getElementById('pricing-promo-oldtext').value = data.promo?.old_price_text || 'De R$ 50,00';
        document.getElementById('pricing-promo-newtext').value = data.promo?.new_price_text || 'Por apenas R$ 29,90';
        
        document.getElementById('pricing-promo-monthly-btn').value = data.promo?.monthly_btn_text || 'MENSAL (R$ 29,90)';
        document.getElementById('pricing-promo-monthly-stripe').value = data.promo?.monthly_stripe_price || 2990;
        
        document.getElementById('pricing-promo-annual-btn').value = data.promo?.annual_btn_text || 'ANUAL (R$ 299,00)';
        document.getElementById('pricing-promo-annual-stripe').value = data.promo?.annual_stripe_price || 29900;
        document.getElementById('pricing-promo-end').value = data.promo?.end_date || '';
        
        document.getElementById('pricing-modal').style.display = 'flex';
    } catch (err) {
        alert('Erro ao abrir gerenciador: ' + err.message);
    }
}

async function savePricingConfig() {
    if (!globalPricingData) return;
    
    const btn = document.getElementById('btn-save-pricing');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'SALVANDO...';
    btn.disabled = true;
    
    const providerNameEl = document.getElementById('pricing-provider-name');
    if (providerNameEl) globalPricingData.provider_name = providerNameEl.value.trim();
    
    if (!globalPricingData.pro) globalPricingData.pro = {};
    globalPricingData.pro.price = document.getElementById('pricing-pro-text').value;
    globalPricingData.pro.stripe_price = parseInt(document.getElementById('pricing-pro-stripe').value) || 5000;
    
    if (!globalPricingData.promo) globalPricingData.promo = {};
    globalPricingData.promo.badge_text = document.getElementById('pricing-promo-badge').value;
    globalPricingData.promo.old_price_text = document.getElementById('pricing-promo-oldtext').value;
    globalPricingData.promo.new_price_text = document.getElementById('pricing-promo-newtext').value;
    globalPricingData.promo.monthly_btn_text = document.getElementById('pricing-promo-monthly-btn').value;
    globalPricingData.promo.monthly_stripe_price = parseInt(document.getElementById('pricing-promo-monthly-stripe').value) || 2990;
    globalPricingData.promo.annual_btn_text = document.getElementById('pricing-promo-annual-btn').value;
    globalPricingData.promo.annual_stripe_price = parseInt(document.getElementById('pricing-promo-annual-stripe').value) || 29900;
    globalPricingData.promo.end_date = document.getElementById('pricing-promo-end').value;
    
    try {
        const res = await apiFetch(`${API_BASE}/system/pricing-admin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(globalPricingData)
        });
        
        if (res.ok) {
            document.getElementById('pricing-modal').style.display = 'none';
            await fetchPricing();
            alert('Preços atualizados com sucesso!');
        } else {
            const errData = await res.json();
            alert('Erro: ' + (errData.error || 'Falha ao salvar preços.'));
        }
    } catch (err) {
        alert('Erro de rede ao salvar: ' + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function startStripeCheckout(planId, btnEl) {
    const originalText = btnEl.innerHTML;
    btnEl.innerHTML = '<i class="lucide-loader" style="animation: spin 1s linear infinite;"></i> Processando...';
    btnEl.disabled = true;

    try {
        const res = await apiFetch(`${API_BASE}/payment/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan_id: planId })
        });
        
        const data = await res.json();
        
        if (res.ok && data.url) {
            window.location.href = data.url;
        } else {
            alert('Erro ao iniciar pagamento: ' + (data.error || 'Erro desconhecido'));
            btnEl.innerHTML = originalText;
            btnEl.disabled = false;
        }
    } catch (err) {
        alert('Erro de conexão ao iniciar checkout.');
        btnEl.innerHTML = originalText;
        btnEl.disabled = false;
    }
}

// ==========================================
// OS UPDATES & SYSTEM UPDATES
// ==========================================

async function checkUpdates() {
    const btn = document.querySelector('button[onclick="checkUpdates()"]');
    if(btn) {
        btn.disabled = true;
        btn.innerText = 'Buscando...';
    }
    try {
        const res = await apiFetch(`${API_BASE}/system/check-update`);
        const data = await res.json();
        if (data.update_available) {
            document.getElementById('update-modal').style.display = 'flex';
            document.getElementById('update-modal-version').innerText = data.latest_version;
            document.getElementById('update-modal-changelog').innerText = data.changelog || 'Nenhuma nota de versão disponível.';
        } else {
            alert('O sistema já está na última versão disponível.');
        }
    } catch (err) {
        alert('Erro ao verificar atualizações do painel.');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerText = 'Buscar Atualizações';
        }
    }
}

async function checkOsUpdates() {
    const btn = document.getElementById('os-btn-check');
    if(btn) {
        btn.disabled = true;
        btn.innerText = 'Checando...';
    }
    
    try {
        const res = await apiFetch(`${API_BASE}/system/os-update/check`);
        const data = await res.json();
        
        const countEl = document.getElementById('os-updates-count');
        const pkgListEl = document.getElementById('os-packages-list');
        const btnApply = document.getElementById('os-btn-apply');
        const pkgModalBtn = document.querySelector('button[onclick="showOsPackagesModal()"]');
        
        if (data.updates_available > 0) {
            if(countEl) countEl.innerText = data.updates_available + ' pacotes';
            if(btnApply) btnApply.style.display = 'block';
            if(pkgModalBtn) pkgModalBtn.style.display = 'block';
            
            if(pkgListEl) {
                pkgListEl.innerHTML = data.packages.map(p => `<li>${p}</li>`).join('');
            }
        } else {
            if(countEl) countEl.innerText = 'Sistema 100% Atualizado';
            if(btnApply) btnApply.style.display = 'none';
            if(pkgModalBtn) pkgModalBtn.style.display = 'none';
        }
    } catch (err) {
        alert('Erro ao checar pacotes do sistema (OS).');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="lucide-refresh-cw"></i> Checar Pacotes';
        }
    }
}

function showOsPackagesModal() {
    const modal = document.getElementById('os-packages-modal');
    if(modal) modal.style.display = 'flex';
}

function closeOsPackagesModal() {
    const modal = document.getElementById('os-packages-modal');
    if(modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
    const osCloseBtns = document.querySelectorAll('.close-os-modal');
    osCloseBtns.forEach(btn => btn.addEventListener('click', closeOsPackagesModal));
});

async function applyOsUpdate() {
    if(!confirm('Deseja realmente aplicar as atualizações do sistema (Ubuntu)? Isso pode levar alguns minutos.')) return;
    
    const btn = document.getElementById('os-btn-apply');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = 'Atualizando OS... <i class="lucide-loader" style="animation: spin 1s linear infinite;"></i>';
    }
    
    try {
        const res = await apiFetch(`${API_BASE}/system/os-update/apply`, { method: 'POST' });
        const data = await res.json();
        
        if(res.ok) {
            alert('Atualização de pacotes concluída com sucesso!\n' + (data.message || ''));
            checkOsUpdates();
        } else {
            alert('Erro durante atualização: ' + (data.error || 'Desconhecido'));
        }
    } catch (err) {
        alert('Erro de conexão ao aplicar pacotes.');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="lucide-download"></i> Aplicar Atualização';
        }
    }
}

// ==========================================
// DNS FILTERS & PROFILES
// ==========================================

let currentDnsProfile = 'default';

function openAddProfileModal() {
    const modal = document.getElementById('modal-add-dns-profile');
    if(modal) modal.style.display = 'flex';
}

function closeAddProfileModal() {
    const modal = document.getElementById('modal-add-dns-profile');
    if(modal) modal.style.display = 'none';
}

async function submitNewProfile() {
    const nameEl = document.getElementById('new-profile-name');
    if(!nameEl || !nameEl.value.trim()) return alert('Digite um nome para o perfil.');
    
    try {
        const res = await apiFetch(`${API_BASE}/system/dns-filters/custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', name: nameEl.value.trim() })
        });
        if(res.ok) {
            closeAddProfileModal();
            if(nameEl) nameEl.value = '';
            // Recarrega a lista de perfis na barra
            if(typeof loadDnsProfiles === 'function') loadDnsProfiles();
        } else {
            const errData = await res.json().catch(() => ({}));
            alert('Erro ao criar perfil: ' + (errData.error || res.status));
        }
    } catch (err) {
        alert('Erro de conexão ao criar perfil.');
    }
}

async function deleteActiveProfile() {
    if(currentDnsProfile === 'default' || !currentDnsProfile) return alert('Não é possível deletar o perfil padrão.');
    if(!confirm('Tem certeza que deseja deletar o perfil selecionado?')) return;
    
    try {
        const res = await apiFetch(`${API_BASE}/system/dns-filters/custom/` + encodeURIComponent(currentDnsProfile), {
            method: 'DELETE'
        });
        if(res.ok) {
            currentDnsProfile = 'default';
            // Recarrega a lista de perfis na barra
            if(typeof loadDnsProfiles === 'function') loadDnsProfiles();
        } else {
            alert('Erro ao remover perfil.');
        }
    } catch (err) {
        alert('Erro de conexão ao remover perfil.');
    }
}



// ==========================================
// CUSTOM DNS SERVICES
// ==========================================

function openAddCustomServiceModal() {
    const modal = document.getElementById('modal-add-custom-service');
    if(modal) modal.style.display = 'flex';
}

function closeCustomServiceModal() {
    const modal = document.getElementById('modal-add-custom-service');
    if(modal) modal.style.display = 'none';
}

async function submitCustomService() {
    const serviceName = document.getElementById('new-service-name')?.value;
    const serviceDomain = document.getElementById('new-service-domain')?.value;
    
    if(!serviceName || !serviceDomain) return alert('Preencha os campos obrigatórios do serviço.');
    
    try {
        const res = await apiFetch(`${API_BASE}/system/custom-dns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_service', name: serviceName, domain: serviceDomain })
        });
        if(res.ok) {
            alert('Serviço customizado criado!');
            closeCustomServiceModal();
            if(typeof fetchSystem === 'function') fetchSystem(); else location.reload();
        } else {
            alert('Erro ao criar serviço customizado.');
        }
    } catch(err) {
        alert('Erro de conexão.');
    }
}

async function addCustomDnsRecord() {
    const domainEl = document.getElementById('custom-dns-domain');
    const ipEl = document.getElementById('custom-dns-ip');
    
    if(!domainEl || !domainEl.value) return alert('Domínio é obrigatório.');
    if(!ipEl || !ipEl.value) return alert('IP é obrigatório.');
    
    try {
        const res = await apiFetch(`${API_BASE}/system/custom-dns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_record', domain: domainEl.value.trim(), ip: ipEl.value.trim() })
        });
        if(res.ok) {
            alert('Registro DNS criado com sucesso!');
            domainEl.value = '';
            ipEl.value = '';
            if(typeof fetchSystem === 'function') fetchSystem(); else location.reload();
        } else {
            alert('Erro ao criar registro DNS.');
        }
    } catch(err) {
        alert('Erro de conexão.');
    }
}

// ==========================================
// SECURITY: GRAVITY, ADLISTS, LOCAL RULES
// ==========================================

async function syncGravity() {
    const btn = document.getElementById('btn-sync-gravity');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = 'Sincronizando... <i class="lucide-loader" style="animation: spin 1s linear infinite;"></i>';
    }
    
    try {
        const res = await apiFetch(`${API_BASE}/security/sync`, { method: 'POST' });
        const data = await res.json();
        
        if(res.ok) {
            alert('Sincronização do banco de dados (Gravity) finalizada com sucesso!\n' + (data.message || ''));
        } else {
            alert('Falha na sincronização: ' + (data.error || 'Erro desconhecido'));
        }
    } catch(err) {
        alert('Erro de rede ao tentar sincronizar o banco de ameaças.');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="lucide-refresh-cw"></i> Sincronizar Agora';
        }
    }
}

// Funções duplicadas removidas

async function addLocalRuleManual() {
    const domainEl = document.getElementById('local-rule-domain');
    const typeEl = document.getElementById('local-rule-type');
    
    const domain = domainEl ? domainEl.value.trim() : '';
    const type = typeEl ? typeEl.value : 'blacklist'; 
    
    if(!domain) return alert('Por favor, informe um domínio válido.');
    
    try {
        const res = await apiFetch(`${API_BASE}/security/local-rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: domain, type: type })
        });
        
        if(res.ok) {
            alert('Regra manual adicionada com sucesso!');
            if(domainEl) domainEl.value = '';
            if(typeof fetchSecuritySettings === 'function') fetchSecuritySettings(); else location.reload();
        } else {
            const data = await res.json();
            alert('Erro ao adicionar regra: ' + (data.error || 'Desconhecido'));
        }
    } catch(err) {
        alert('Erro de conexão ao adicionar regra manual.');
    }
}

// ==========================================
// SECURITY UI: LIVE QUERIES, TABS, FILTERING
// ==========================================

let currentThreatFilter = 'ALL';
let isLiveQueriesActive = false;
let liveQueriesTimer = null;

function switchSecurityTab(tabId) {
    const tabs = ['live-queries', 'osint', 'gravity', 'local-rules', 'app-blocking', 'custom-dns', 'ha-sync'];
    tabs.forEach(t => {
        const el = document.getElementById('sec-tab-' + t);
        if(el) el.style.display = 'none';
    });
    
    const btns = document.querySelectorAll('.btn-sec-tab');
    btns.forEach(b => b.classList.remove('active'));
    
    const targetEl = document.getElementById('sec-tab-' + tabId);
    if(targetEl) targetEl.style.display = 'block';
    
    const activeBtn = document.querySelector(`.btn-sec-tab[onclick*="switchSecurityTab('${tabId}')"]`);
    if(activeBtn) activeBtn.classList.add('active');
    
    if(tabId === 'live-queries') {
        isLiveQueriesActive = true;
        loadLiveQueries();
        if(!liveQueriesTimer) liveQueriesTimer = setInterval(() => loadLiveQueries(), 3000);
    } else {
        isLiveQueriesActive = false;
        if(liveQueriesTimer) {
            clearInterval(liveQueriesTimer);
            liveQueriesTimer = null;
        }
    }

    if(tabId === 'app-blocking') {
        if(typeof loadDnsProfiles === 'function') loadDnsProfiles();
    }
}



// ==========================================
// HIGH AVAILABILITY (HA SYNC)
// ==========================================

async function generateHaSyncToken() {
    const btn = document.getElementById('btn-generate-ha-token');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="lucide-loader" style="animation: spin 1s linear infinite;"></i> Gerando...';
    }
    
    try {
        const token = Array.from({length: 32}, () => Math.random().toString(36)[2] || '0').join('').substring(0, 32);
        const tokenInput = document.getElementById('ha-sync-token');
        if(tokenInput) {
            tokenInput.value = token;
            tokenInput.style.borderColor = '#10b981';
            setTimeout(() => { tokenInput.style.borderColor = 'var(--glass-border)'; }, 2000);
        }
    } catch(err) {
        alert('Erro ao gerar token.');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="lucide-key"></i> Gerar Novo Token';
        }
    }
}

async function saveHaSyncConfig() {
    const roleEl = document.getElementById('ha-role');
    const targetEl = document.getElementById('ha-target');
    const tokenEl = document.getElementById('ha-sync-token');
    
    if(!roleEl || !tokenEl) return;
    
    const configData = {
        role: roleEl.value,
        target_ip: targetEl ? targetEl.value.trim() : '',
        token: tokenEl.value.trim()
    };
    
    try {
        const res = await apiFetch(`${API_BASE}/system/ha-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        
        if(res.ok) {
            alert('Configuração HA salva com sucesso!');
        } else {
            const data = await res.json();
            alert('Erro ao salvar HA: ' + (data.error || 'Desconhecido'));
        }
    } catch(err) {
        alert('Erro de conexão ao salvar HA Sync.');
    }
}

async function forceHaSyncNow() {
    const btn = document.getElementById('btn-force-sync');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="lucide-loader" style="animation: spin 1s linear infinite;"></i> Sincronizando...';
    }
    
    try {
        const res = await apiFetch(`${API_BASE}/system/ha-sync/force`, { method: 'POST' });
        const data = await res.json();
        
        if(res.ok) {
            alert('Sincronização manual iniciada/concluída com sucesso!\n' + (data.message || ''));
        } else {
            alert('Falha ao sincronizar: ' + (data.error || 'Verifique as configurações.'));
        }
    } catch(err) {
        alert('Erro de rede ao tentar forçar sincronização HA.');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="lucide-refresh-cw"></i> Sincronizar Agora';
        }
    }
}

// ==========================================
// MIXED PAYMENT CHECKOUT (STRIPE + MERCADO PAGO)
// ==========================================

let selectedPlanIdForPayment = 'pro';

window.openPaymentModal = function(planId, btnEl) {
    selectedPlanIdForPayment = planId;
    const modal = document.getElementById('payment-choice-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('payment-methods-container').style.display = 'flex';
        document.getElementById('pix-qrcode-area').style.display = 'none';
    }
};

window.closePaymentModal = function() {
    const modal = document.getElementById('payment-choice-modal');
    if (modal) modal.style.display = 'none';
    if (window.pixPollingInterval) clearInterval(window.pixPollingInterval);
};

window.processPaymentSelection = async function(method) {
    if (method === 'card') {
        const btn = document.querySelector(`button[onclick="processPaymentSelection('card')"]`);
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="spin" style="width: 24px; height: 24px;"></i> Aguarde...';
        if (window.lucide) lucide.createIcons();
        btn.disabled = true;
        
        await startStripeCheckout(selectedPlanIdForPayment, btn);
        
        btn.innerHTML = originalText;
        btn.disabled = false;
        if (window.lucide) lucide.createIcons();
    } else if (method === 'pix') {
        const btn = document.querySelector(`button[onclick="processPaymentSelection('pix')"]`);
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="loader" class="spin" style="width: 24px; height: 24px;"></i> Gerando Pix...';
        if (window.lucide) lucide.createIcons();
        btn.disabled = true;

        try {
            const res = await apiFetch(`${API_BASE}/payment/create-pix-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan_id: selectedPlanIdForPayment })
            });
            const data = await res.json();

            if (res.ok && data.qr_code_base64) {
                document.getElementById('payment-methods-container').style.display = 'none';
                document.getElementById('pix-qrcode-area').style.display = 'block';
                document.getElementById('pix-qrcode-img').src = `data:image/jpeg;base64,${data.qr_code_base64}`;
                document.getElementById('pix-copiacola-input').value = data.qr_code;
                
                startPixPolling(data.payment_id);
            } else {
                alert('Erro ao gerar Pix: ' + (data.error || 'Erro desconhecido'));
            }
        } catch (err) {
            alert('Erro de conexão ao gerar Pix.');
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            if (window.lucide) lucide.createIcons();
        }
    }
};

window.copyPixCode = function() {
    const input = document.getElementById('pix-copiacola-input');
    input.select();
    input.setSelectionRange(0, 99999); 
    document.execCommand("copy");
    alert("Código Pix copiado com sucesso!");
};

window.startPixPolling = function(paymentId) {
    if (window.pixPollingInterval) clearInterval(window.pixPollingInterval);
    
    window.pixPollingInterval = setInterval(async () => {
        try {
            const res = await fetch('/api/system/license');
            if (res.ok) {
                const lic = await res.json();
                if (lic && lic.valid && lic.status === 'active' && lic.hwid) {
                    clearInterval(window.pixPollingInterval);
                    alert("✅ Pagamento Pix Aprovado! Licença Ativada com Sucesso.");
                    window.location.reload();
                }
            }
        } catch (e) {}
    }, 5000);
};

// ===== TELEMETRIA DE HARDWARE & SISTEMA (SOBRE O SISTEMA) =====
let lastSystemSpecs = null;

async function loadSystemSpecs() {
    try {
        const res = await apiFetch('/api/system/specs');
        if (!res.ok) return;
        const data = await res.json();
        lastSystemSpecs = data;

        // CPU
        const cpuCoresEl = document.getElementById('spec-cpu-cores');
        const cpuModelEl = document.getElementById('spec-cpu-model');
        if (cpuCoresEl) cpuCoresEl.textContent = `${data.cpu.cores} Cores (${data.cpu.arch})`;
        if (cpuModelEl) cpuModelEl.textContent = data.cpu.model && data.cpu.model.length > 40 ? data.cpu.model.substring(0, 38) + '...' : (data.cpu.model || 'Multi-Core x86_64');

        // RAM
        const memPercentEl = document.getElementById('spec-mem-percent');
        const memUsageEl = document.getElementById('spec-mem-usage');
        if (memPercentEl) memPercentEl.textContent = `${data.memory.percent}%`;
        if (memUsageEl) memUsageEl.textContent = `${data.memory.usedMB} MB / ${data.memory.totalMB} MB`;

        // Disk
        const diskPercentEl = document.getElementById('spec-disk-percent');
        const diskUsageEl = document.getElementById('spec-disk-usage');
        if (diskPercentEl) diskPercentEl.textContent = data.disk.percent || '0%';
        if (diskUsageEl) diskUsageEl.textContent = `${data.disk.free} livres (de ${data.disk.total})`;

        // Uptime
        const uptimeEl = document.getElementById('spec-uptime');
        if (uptimeEl) {
            const h = Math.floor(data.uptime / 3600);
            const m = Math.floor((data.uptime % 3600) / 60);
            uptimeEl.textContent = `${h}h ${m}m`;
        }

        // OS & Kernel
        const osNameEl = document.getElementById('spec-os-name');
        const kernelVerEl = document.getElementById('spec-kernel-ver');
        const archEl = document.getElementById('spec-arch');
        const nodeVerEl = document.getElementById('spec-node-ver');
        if (osNameEl) osNameEl.textContent = data.os.name;
        if (kernelVerEl) kernelVerEl.textContent = data.os.kernel;
        if (archEl) archEl.textContent = (data.os.platform || 'linux') + ' (' + (data.cpu.arch || 'x86_64') + ')';
        if (nodeVerEl) nodeVerEl.textContent = data.os.node;

        // Unbound & License
        const unboundVerEl = document.getElementById('spec-unbound-ver');
        if (unboundVerEl) unboundVerEl.textContent = data.unbound.version;

        const licenseStatusEl = document.getElementById('spec-license-status');
        if (licenseStatusEl) {
            licenseStatusEl.textContent = 'PRO-TRIAL Ativa (Enterprise)';
            licenseStatusEl.style.color = '#10b981';
        }

        const hwidEl = document.getElementById('spec-hwid');
        if (hwidEl && window.currentLicenseStatus && window.currentLicenseStatus.hwid) {
            hwidEl.textContent = window.currentLicenseStatus.hwid;
        }

        if (window.lucide) lucide.createIcons();
    } catch(e) {
        console.error('Erro ao carregar telemetria:', e);
    }
}
window.loadSystemSpecs = loadSystemSpecs;

function copySystemSpecs() {
    if (!lastSystemSpecs) {
        alert('Telemetria ainda não carregada.');
        return;
    }
    const s = lastSystemSpecs;
    const report = [
        `======================================================`,
        `SENTINEL DNS ENTERPRISE APPLIANCE - RELATÓRIO TÉCNICO`,
        `======================================================`,
        `Data/Hora: ${s.serverTime}`,
        `Sistema Operacional: ${s.os.name}`,
        `Kernel Linux: ${s.os.kernel}`,
        `Processador: ${s.cpu.model} (${s.cpu.cores} Cores - ${s.cpu.arch})`,
        `Memória RAM: ${s.memory.usedMB} MB / ${s.memory.totalMB} MB (${s.memory.percent}% em uso)`,
        `Disco (Root): ${s.disk.used} usado / ${s.disk.total} total (${s.disk.free} livre)`,
        `Motor DNS: ${s.unbound.version}`,
        `Node.js: ${s.os.node}`,
        `Uptime: ${Math.floor(s.uptime/3600)} horas e ${Math.floor((s.uptime%3600)/60)} minutos`,
        `======================================================`
    ].join('\n');

    navigator.clipboard.writeText(report).then(() => {
        alert('📋 Relatório Técnico copiado para a Área de Transferência com sucesso!');
    }).catch(() => {
        prompt('Copie o relatório abaixo:', report);
    });
}
window.copySystemSpecs = copySystemSpecs;

// ===== AUDITORIA & COMPLIANCE (MARCO CIVIL / ANATEL) =====
let allAuditLogs = [];

async function loadAuditLogs() {
    const tbody = document.getElementById('audit-logs-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-secondary);"><i data-lucide="loader" class="spin"></i> Carregando registros...</td></tr>`;
    if (window.lucide) lucide.createIcons();

    try {
        // Carrega status de compliance
        const compRes = await apiFetch('/api/audit/compliance');
        if (compRes.ok) {
            const comp = await compRes.json();
            const totalEl = document.getElementById('audit-total-records');
            const sizeEl = document.getElementById('audit-file-size');
            if (totalEl) totalEl.textContent = comp.totalAuditRecords || 0;
            if (sizeEl) sizeEl.textContent = `${comp.fileSizeKB || 0} KB`;
        }

        // Carrega registros filtrados
        const category = document.getElementById('audit-filter-category')?.value || 'ALL';
        const res = await apiFetch(`/api/audit/logs?limit=300&category=${category}`);
        if (!res.ok) return;
        const data = await res.json();
        allAuditLogs = data.logs || [];
        renderAuditLogs(allAuditLogs);
    } catch(e) {
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--accent-danger);">Erro ao carregar trilha de auditoria: ${e.message}</td></tr>`;
    }
}
window.loadAuditLogs = loadAuditLogs;

function renderAuditLogs(logs) {
    const tbody = document.getElementById('audit-logs-tbody');
    if (!tbody) return;
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-secondary);">Nenhum evento registrado no filtro selecionado.</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(l => {
        let catClass = 'auth';
        if (l.category === 'SECURITY') catClass = 'security';
        if (l.category === 'CONFIG') catClass = 'config';
        if (l.category === 'SYSTEM') catClass = 'system';
        if (l.category === 'JUDICIAL_QUERY') catClass = 'judicial';

        const dt = new Date(l.timestamp).toLocaleString('pt-BR', { timeZone: 'UTC' });
        const detStr = l.details ? JSON.stringify(l.details) : '-';

        return `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.03); transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                <td style="padding:10px 12px; font-family:var(--font-mono); font-size:0.75rem; color:var(--text-secondary);">${dt}</td>
                <td style="padding:10px 12px;"><span class="audit-badge ${catClass}">${l.category}</span></td>
                <td style="padding:10px 12px; font-weight:700; color:var(--text-primary); font-family:var(--font-mono); font-size:0.78rem;">${l.action}</td>
                <td style="padding:10px 12px; color:#38bdf8; font-weight:600;">${l.user}</td>
                <td style="padding:10px 12px; font-family:var(--font-mono); color:var(--text-secondary); font-size:0.75rem;">${l.ip}</td>
                <td style="padding:10px 12px; color:var(--text-secondary); font-size:0.75rem; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${detStr}">${detStr}</td>
            </tr>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

function filterAuditLogsTable() {
    const q = document.getElementById('audit-filter-query')?.value?.toLowerCase() || '';
    if (!q) {
        renderAuditLogs(allAuditLogs);
        return;
    }
    const filtered = allAuditLogs.filter(l => 
        (l.user && l.user.toLowerCase().includes(q)) ||
        (l.ip && l.ip.includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
    );
    renderAuditLogs(filtered);
}
window.filterAuditLogsTable = filterAuditLogsTable;

async function exportAuditEvidence(format = 'csv') {
    try {
        const category = document.getElementById('audit-filter-category')?.value || 'ALL';
        const query = document.getElementById('audit-filter-query')?.value || '';

        const res = await apiFetch('/api/audit/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ category, query, format })
        });

        if (!res.ok) {
            alert('Falha ao exportar evidências de auditoria.');
            return;
        }

        const data = await res.json();

        // Mostra o Hash SHA-256 de integridade
        const hashBox = document.getElementById('audit-hash-box');
        const hashDisplay = document.getElementById('audit-hash-display');
        if (hashBox && hashDisplay) {
            hashDisplay.textContent = `${data.sha256}  (${data.totalRecords} registros)`;
            hashBox.style.display = 'block';
            if (window.lucide) lucide.createIcons();
        }

        // Dispara o download no navegador
        let blob;
        if (format === 'json') {
            blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        } else {
            blob = new Blob([data.csvContent], { type: 'text/csv;charset=utf-8;' });
        }

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', data.filename || `sentinel_evidence_${Date.now()}.${format}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Recarrega a tabela para mostrar o evento da própria exportação
        setTimeout(loadAuditLogs, 500);
    } catch(e) {
        alert('Erro ao exportar evidências: ' + e.message);
    }
}
window.exportAuditEvidence = exportAuditEvidence;

// ===== FORENSIC CLIENT INVESTIGATION FUNCTIONS =====
let lastSearchedForensicQueries = [];
let lastSearchedForensicIp = '';

function switchAuditSubTab(tab) {
    const clientTab = document.getElementById('audit-subtab-client');
    const systemTab = document.getElementById('audit-subtab-system');
    const clientBtn = document.getElementById('tab-btn-client-forensic');
    const systemBtn = document.getElementById('tab-btn-system-audit');

    if (tab === 'client') {
        if (clientTab) clientTab.style.display = 'block';
        if (systemTab) systemTab.style.display = 'none';
        if (clientBtn) { clientBtn.className = 'btn btn-primary'; }
        if (systemBtn) { systemBtn.className = 'btn btn-secondary'; }
    } else {
        if (clientTab) clientTab.style.display = 'none';
        if (systemTab) systemTab.style.display = 'block';
        if (clientBtn) { clientBtn.className = 'btn btn-secondary'; }
        if (systemBtn) { systemBtn.className = 'btn btn-primary'; }
        loadAuditLogs();
    }
    if (window.lucide) lucide.createIcons();
}
window.switchAuditSubTab = switchAuditSubTab;

async function searchClientIpForensic() {
    const ipInput = document.getElementById('forensic-client-ip');
    const domainInput = document.getElementById('forensic-domain-filter');
    const limitInput = document.getElementById('forensic-limit');
    const tbody = document.getElementById('forensic-queries-tbody');

    const clientIp = ipInput?.value?.trim() || '';
    const domainFilter = domainInput?.value?.trim() || '';
    const limit = limitInput?.value || 500;

    if (!clientIp) {
        alert('Por favor, digite o endereço IP do assinante/cliente para pesquisar.');
        if (ipInput) ipInput.focus();
        return;
    }

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--text-secondary);"><i data-lucide="loader-2" class="spin" style="width:20px;height:20px;margin-bottom:6px;display:block;margin-left:auto;margin-right:auto;"></i> Varrendo registros e logs do Unbound para o IP ${clientIp}...</td></tr>`;
        if (window.lucide) lucide.createIcons();
    }

    try {
        const res = await apiFetch('/api/audit/search-client-ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientIp, domainFilter, limit })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Erro ao consultar histórico do IP.');
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:#ef4444;">Erro ao processar busca: ${err.error || 'Falha de comunicação'}</td></tr>`;
            return;
        }

        const data = await res.json();
        lastSearchedForensicQueries = data.queries || [];
        lastSearchedForensicIp = data.clientIp || clientIp;

        // Atualiza cards de resumo
        const sumBox = document.getElementById('forensic-summary-cards');
        const resIp = document.getElementById('forensic-res-ip');
        const resTotal = document.getElementById('forensic-res-total');
        const resDomains = document.getElementById('forensic-res-domains');
        const resBlocked = document.getElementById('forensic-res-blocked');
        const tableCounter = document.getElementById('forensic-table-counter');
        const btnCsv = document.getElementById('btn-export-client-csv');
        const btnJson = document.getElementById('btn-export-client-json');

        if (sumBox) sumBox.style.display = 'grid';
        if (resIp) resIp.textContent = data.clientIp;
        if (resTotal) resTotal.textContent = data.totalQueries;
        if (resDomains) resDomains.textContent = data.uniqueDomainsCount;
        if (resBlocked) resBlocked.textContent = data.blockedCount;
        if (tableCounter) tableCounter.textContent = `${data.totalQueries} consultas encontradas (${data.uniqueDomainsCount} domínios distintos)`;

        if (btnCsv) btnCsv.style.display = data.totalQueries > 0 ? 'inline-flex' : 'none';
        if (btnJson) btnJson.style.display = data.totalQueries > 0 ? 'inline-flex' : 'none';

        if (!data.queries || data.queries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2.5rem; color:var(--text-secondary);">Nenhuma consulta registrada para o IP <strong>${data.clientIp}</strong> no período disponível nos logs.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.queries.map(q => {
            let statusBadge = `<span style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.7rem;">Permitido</span>`;
            if (q.status.includes('Bloqueado')) {
                statusBadge = `<span style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.7rem;">Bloqueado</span>`;
            } else if (q.status.includes('Whitelist')) {
                statusBadge = `<span style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid rgba(56,189,248,0.3); padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.7rem;">Whitelist</span>`;
            }

            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03); transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                    <td style="padding:10px 12px; font-family:var(--font-mono); font-size:0.75rem; color:var(--text-secondary);">${q.timestamp}</td>
                    <td style="padding:10px 12px; font-family:var(--font-mono); font-size:0.78rem; color:#38bdf8; font-weight:600;">${q.clientIp}</td>
                    <td style="padding:10px 12px; font-weight:700; color:var(--text-primary); font-family:var(--font-mono); font-size:0.8rem;">${q.domain}</td>
                    <td style="padding:10px 12px; font-family:var(--font-mono); color:var(--text-secondary); font-size:0.75rem;">${q.type}</td>
                    <td style="padding:10px 12px;">${statusBadge}</td>
                </tr>
            `;
        }).join('');

        if (window.lucide) lucide.createIcons();
    } catch(e) {
        alert('Erro ao buscar consultas do cliente: ' + e.message);
    }
}
window.searchClientIpForensic = searchClientIpForensic;

async function searchBlockedAccessesForensic() {
    const tbody = document.getElementById('forensic-queries-tbody');
    const clientIpInput = document.getElementById('forensic-client-ip');
    const limitSelect = document.getElementById('forensic-limit');

    const clientIpFilter = clientIpInput ? clientIpInput.value.trim() : '';
    const limit = limitSelect ? parseInt(limitSelect.value, 10) : 500;

    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--accent-primary);"><i data-lucide="loader" class="spin" style="width:20px; height:20px; display:inline-block; vertical-align:middle; margin-right:8px;"></i> Escaneando registros de tentativas de acesso a bloqueios judiciais (AnaBlock / Bets)...</td></tr>`;
        if (window.lucide) lucide.createIcons();
    }

    try {
        const res = await apiFetch('/api/audit/search-blocked-accesses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientIpFilter, limit })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Erro ao consultar tentativas de acesso a domínios bloqueados.');
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:#ef4444;">Erro ao processar: ${err.error || 'Falha de comunicação'}</td></tr>`;
            return;
        }

        const data = await res.json();
        lastSearchedForensicQueries = (data.events || []).map(e => ({
            timestamp: e.timestamp,
            isoDate: e.isoDate,
            clientIp: e.clientIp,
            domain: e.domain,
            type: e.type,
            status: e.status
        }));
        lastSearchedForensicIp = clientIpFilter || 'TODOS_OS_CLIENTES_BLOQUEADOS';

        // Atualiza cards de resumo
        const sumBox = document.getElementById('forensic-summary-cards');
        const resIp = document.getElementById('forensic-res-ip');
        const resTotal = document.getElementById('forensic-res-total');
        const resDomains = document.getElementById('forensic-res-domains');
        const resBlocked = document.getElementById('forensic-res-blocked');
        const tableCounter = document.getElementById('forensic-table-counter');
        const btnCsv = document.getElementById('btn-export-client-csv');
        const btnJson = document.getElementById('btn-export-client-json');

        if (sumBox) sumBox.style.display = 'grid';
        if (resIp) resIp.textContent = clientIpFilter || 'Rede Inteira (Todos os IPs)';
        if (resTotal) resTotal.textContent = data.totalBlockedEvents || 0;
        if (resDomains) resDomains.textContent = data.uniqueDomainsCount || 0;
        if (resBlocked) resBlocked.textContent = `${data.uniqueClientsCount || 0} IPs de Assinantes`;
        if (tableCounter) tableCounter.textContent = `${data.totalBlockedEvents} tentativas de acesso bloqueadas interceptadas (${data.uniqueClientsCount} clientes distintos)`;

        if (btnCsv) btnCsv.style.display = (data.totalBlockedEvents > 0) ? 'inline-flex' : 'none';
        if (btnJson) btnJson.style.display = (data.totalBlockedEvents > 0) ? 'inline-flex' : 'none';

        if (!data.events || data.events.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2.5rem; color:#10b981;">🛡️ Nenhuma tentativa de acesso a domínios do AnaBlock / Judiciais registrada no período recente.</td></tr>`;
            return;
        }

        tbody.innerHTML = data.events.map(q => {
            return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03); background:rgba(239,68,68,0.02); transition:background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.06)'" onmouseout="this.style.background='rgba(239,68,68,0.02)'">
                    <td style="padding:10px 12px; font-family:var(--font-mono); font-size:0.75rem; color:var(--text-secondary);">${q.timestamp}</td>
                    <td style="padding:10px 12px; font-family:var(--font-mono); font-size:0.78rem; color:#38bdf8; font-weight:700;">
                        <i data-lucide="user" style="width:13px;height:13px;display:inline;margin-right:4px;"></i>${q.clientIp}
                    </td>
                    <td style="padding:10px 12px; font-weight:700; color:#f87171; font-family:var(--font-mono); font-size:0.8rem;">
                        <i data-lucide="shield-alert" style="width:13px;height:13px;display:inline;margin-right:4px;color:#ef4444;"></i>${q.domain}
                    </td>
                    <td style="padding:10px 12px; font-family:var(--font-mono); color:var(--text-secondary); font-size:0.75rem;">${q.type}</td>
                    <td style="padding:10px 12px;">
                        <span style="background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); padding:2px 8px; border-radius:4px; font-weight:700; font-size:0.7rem;">
                            Bloqueado (NXDOMAIN)
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        if (window.lucide) lucide.createIcons();
    } catch(e) {
        alert('Erro ao buscar tentativas bloqueadas: ' + e.message);
    }
}
window.searchBlockedAccessesForensic = searchBlockedAccessesForensic;

async function exportClientForensicReport(format = 'csv') {
    if (!lastSearchedForensicIp || lastSearchedForensicQueries.length === 0) {
        alert('Realize primeiro uma pesquisa de IP antes de exportar o laudo pericial.');
        return;
    }

    try {
        const res = await apiFetch('/api/audit/export-client-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientIp: lastSearchedForensicIp,
                queries: lastSearchedForensicQueries,
                format
            })
        });

        if (!res.ok) {
            alert('Falha ao exportar laudo pericial do cliente.');
            return;
        }

        const data = await res.json();

        // Mostra o Hash SHA-256 de integridade
        const hashBox = document.getElementById('audit-hash-box');
        const hashDisplay = document.getElementById('audit-hash-display');
        if (hashBox && hashDisplay) {
            hashDisplay.textContent = `SHA-256: ${data.sha256}  |  IP: ${lastSearchedForensicIp}  |  Total: ${data.totalRecords} resoluções DNS`;
            hashBox.style.display = 'block';
            if (window.lucide) lucide.createIcons();
        }

        // Dispara o download
        let blob;
        if (format === 'json') {
            blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        } else {
            blob = new Blob([data.csvContent], { type: 'text/csv;charset=utf-8;' });
        }

        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', data.filename || `sentinel_laudo_${lastSearchedForensicIp}.${format}`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch(e) {
        alert('Erro ao exportar laudo do cliente: ' + e.message);
    }
}
window.exportClientForensicReport = exportClientForensicReport;
