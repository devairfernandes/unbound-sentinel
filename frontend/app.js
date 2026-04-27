const API_BASE = '/api';
let charts = {};
let authCredentials = localStorage.getItem('sentinel_auth') || null;

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
function getAuthHeader() {
    return authCredentials ? { 'Authorization': `Basic ${authCredentials}` } : {};
}

async function apiFetch(url, options = {}) {
    options.headers = { ...options.headers, ...getAuthHeader() };
    const res = await fetch(url, options);
    if (res.status === 401) {
        showLogin();
        throw new Error('Não autenticado');
    }
    return res;
}

function showLogin() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.add('show');
}

function closeLogin() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.classList.remove('show');
}

async function attemptLogin() {
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    const errorDiv = document.getElementById('login-error');
    
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, pass })
        });
        
        if (res.ok) {
            authCredentials = btoa(`${user}:${pass}`);
            localStorage.setItem('sentinel_auth', authCredentials);
            closeLogin();
            errorDiv.innerText = '';
            location.reload(); 
        } else {
            errorDiv.innerText = 'Usuário ou senha inválidos';
        }
    } catch (e) {
        errorDiv.innerText = 'Erro de conexão com o servidor';
    }
}

function logout() {
    localStorage.removeItem('sentinel_auth');
    location.reload();
}

// ===== AUTO-UPDATER LOGIC =====
function checkForSystemUpdate() {
    apiFetch(`${API_BASE}/system/check-update`)
        .then(res => res.json())
        .then(data => {
            const btn = document.getElementById('btn-update-system');
            if (data.updateAvailable && btn) {
                btn.style.display = 'flex';
                btn.title = `Nova versão disponível: ${data.newVersion} (Atual: ${data.currentVersion})`;
            }
        })
        .catch(err => console.error('Update check failed:', err));
}

async function startSystemUpdate() {
    if (!confirm('Deseja iniciar a atualização do painel? O serviço ficará indisponível por cerca de 10 segundos e recarregará automaticamente.')) return;
    
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
                { name: 'Downstream', data: history.net_rx },
                { name: 'Upstream', data: history.net_tx }
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
                { name: 'MEM', data: history.mem }
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
            series: [{ name: 'MEM', data: history.mem }],
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
        const res = await fetch(`${API_BASE}/stats`); 
        if (!res.ok) return;
        const data = await res.json();
        updateDashboard(data);
    } catch (err) { console.error('Stats fetch error:', err); }
}

async function fetchSystem() {
    try {
        const res = await fetch(`${API_BASE}/system`); 
        if (!res.ok) return;
        const data = await res.json();
        updateSystem(data);
    } catch (err) { console.error('System fetch error:', err); }
}

async function fetchHistory() {
    try {
        const res = await fetch(`${API_BASE}/history`);
        if (!res.ok) return;
        const data = await res.json();
        
        // Sincroniza o histórico local com o do backend
        history.requests = data.requests;
        history.net_rx = data.net_rx;
        history.net_tx = data.net_tx;
        history.cpu = data.cpu;
        history.mem = data.mem;
        history.labels = data.labels;

        // Atualiza os gráficos imediatamente
        if (charts.reqHistory) charts.reqHistory.updateSeries([{ data: history.requests }]);
        if (charts.netTrend) charts.netTrend.updateSeries([{ data: history.net_rx }, { data: history.net_tx }]);
        if (charts.sysTrend) charts.sysTrend.updateSeries([{ data: history.cpu }, { data: history.mem }]);
        if (charts.cpuFull) charts.cpuFull.updateSeries([{ data: history.cpu }]);
        if (charts.memFull) charts.memFull.updateSeries([{ data: history.mem }]);
        
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
            const hitRate = (data['total.num.cachehits'] / data['total.num.queries'] * 100).toFixed(1);
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




        const currentTotal = data['total.num.queries'] || 0;
        if (lastQueryCount > 0 && charts.reqHistory) {
            const tps = (currentTotal - lastQueryCount) / 10;
            history.requests.push(tps);
            history.requests.shift();
            charts.reqHistory.updateSeries([{ data: history.requests }]);
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
            charts.latency.updateSeries([{ data: histogram.map(h => h.val) }]);
        }

        if (charts.rcode) {
            charts.rcode.updateSeries([
                data['num.answer.rcode.NOERROR'] || 0,
                data['num.answer.rcode.NXDOMAIN'] || 0,
                data['num.answer.rcode.SERVFAIL'] || 0,
                data['num.answer.rcode.REFUSED'] || 0
            ]);
        }

        const secureEl = document.getElementById('dnssec-secure');
        const bogusEl = document.getElementById('dnssec-bogus');
        if (secureEl) secureEl.innerText = (data['num.answer.secure'] || 0).toLocaleString();
        if (bogusEl) bogusEl.innerText = (data['num.answer.bogus'] || 0).toLocaleString();
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
        if (cpuText) cpuText.innerText = `Uso atual: ${cpu}%`;
        if (memText) memText.innerText = `Uso atual: ${mem}%`;
        
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
        if (charts.netTrend) charts.netTrend.updateSeries([{ data: history.net_rx }, { data: history.net_tx }]);
        if (charts.sysTrend) charts.sysTrend.updateSeries([{ data: history.cpu }, { data: history.mem }]);
        if (charts.cpuFull) charts.cpuFull.updateSeries([{ data: history.cpu }]);
        if (charts.memFull) charts.memFull.updateSeries([{ data: history.mem }]);

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
        <div class="bar-item">
            <div class="bar-name" title="${item.name}">${item.name}</div>
            <div class="bar-wrapper">
                <div class="bar-fill" style="width: ${(item.count/max*100).toFixed(1)}%"></div>
            </div>
            <div class="bar-count">${item.count}</div>
        </div>
    `).join('');
}

async function showSection(id, element) {
    if (!element) return;
    if (id === 'config' && !authCredentials) {
        showLogin();
        return;
    }
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-section'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    const section = document.getElementById(`${id}-section`);
    if (section) section.classList.add('active-section');
    element.classList.add('active');
    if (id === 'config') loadConfig();
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

    if (module === 'unbound') {
        title.innerText = 'Configuração Unbound';
        document.getElementById('config-selector').style.display = 'block';
        document.getElementById('config-editor').style.display = 'block';
        document.getElementById('firewall-view').style.display = 'none';
        document.getElementById('network-view').style.display = 'none';
        document.getElementById('layout-view').style.display = 'none';
        document.querySelector('.editor-actions').style.display = 'flex';
        loadConfig();
    } else if (module === 'firewall') {
        title.innerText = 'Gestão de Firewall (Premium View)';
        document.getElementById('config-selector').style.display = 'none';
        document.getElementById('config-editor').style.display = 'none';
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
        document.querySelector('.editor-actions').style.display = 'none';
        renderCredentials();
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

    if (dashUser) payload.dashUser = dashUser;
    if (dashPass) payload.dashPass = dashPass;
    if (sshHost)  payload.sshHost  = sshHost;
    if (sshPort)  payload.sshPort  = sshPort;
    if (sshUser)  payload.sshUser  = sshUser;
    if (sshPass)  payload.sshPass  = sshPass;

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
                setTimeout(() => {
                    localStorage.removeItem('sentinel_auth');
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

        html += `
            <tr>
                <td><code class="port-code">${chain}</code></td>
                <td><span class="badge ${target.toLowerCase()}">${target}</span></td>
                <td>${proto.toUpperCase()}</td>
                <td><code class="port-code">${port}</code></td>
                <td>${src}</td>
                <td>${dst}</td>
                <td>
                    <button onclick="deleteFirewallRule('${chain}','${proto}','${port}','${target}')" 
                        style="background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.3);color:var(--accent-danger);padding:4px 10px;border-radius:4px;cursor:pointer;font-size:0.75rem;">
                        Remover
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    view.innerHTML = html || '<p>Nenhuma regra personalizada encontrada.</p>';
    if (window.lucide) lucide.createIcons();
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

        html += `
            <div class="iface-card">
                <div class="iface-header">
                    <i data-lucide="server"></i>
                    <h4>${name}</h4>
                    <span class="state-dot ${state.toLowerCase()}"></span>
                </div>
                <div class="iface-body">
                    <div class="iface-row"><span>IPv4:</span> <strong>${ipv4}</strong></div>
                    <div class="iface-row"><span>IPv6:</span> <strong class="ipv6-text">${ipv6}</strong></div>
                    <div class="iface-row"><span>Hardware:</span> <code>${mac}</code></div>
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
    if (!selector || !editor) return;
    const file = selector.value;
    editor.value = 'Carregando...';
    try {
        const res = await apiFetch(`${API_BASE}/config/${file}`);
        const data = await res.json();
        editor.value = data.content;
    } catch (err) { editor.value = 'Acesso negado ou erro ao carregar'; }
}

async function saveConfig() {
    const selector = document.getElementById('config-selector');
    const editor = document.getElementById('config-editor');
    const status = document.getElementById('save-status');
    if (!selector || !editor || !status) return;
    const file = selector.value;
    const content = editor.value;
    status.innerText = 'Salvando...';
    try {
        const res = await apiFetch(`${API_BASE}/config/${file}`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        const data = await res.json();
        status.innerText = res.ok ? 'SUCESSO' : 'ERRO: ' + data.error;
    } catch (err) { status.innerText = 'FALHA: ' + err.message; }
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
        const res = await fetch(`${API_BASE}/settings`);
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
    if (!btn || !loader || !charts.benchmark) return;

    if (!authCredentials) {
        showLogin();
        return;
    }

    btn.disabled = true;
    loader.style.display = 'block';
    
    try {
        const res = await apiFetch(`${API_BASE}/benchmark`);
        const data = await res.json();
        
        charts.benchmark.updateOptions({
            xaxis: { categories: data.map(d => d.name) }
        });
        charts.benchmark.updateSeries([{
            name: 'Tempo de Resposta (ms)',
            data: data.map(d => d.avg)
        }]);
    } catch (err) {
        alert('Erro ao rodar benchmark: ' + err.message);
    } finally {
        btn.disabled = false;
        loader.style.display = 'none';
    }
}

function refreshAll() { 
    fetchStats(); 
    fetchSystem(); 
    fetchSettings(); 
    fetchLogs();
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
let currentFeatures = { tv: false, config: false, update: false, charts: false };

// ===== SISTEMA DE ATUALIZAÇÃO =====
let currentVersion = "2.0.0"; // Versão base

async function checkForSystemUpdate() {
    try {
        const res = await fetch('/version.json?t=' + Date.now());
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.version !== currentVersion && currentVersion !== "2.0.0") {
            showUpdateToast(data.version, data.description);
        }
        currentVersion = data.version;
    } catch (e) {}
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
        <div style="font-size: 0.85rem; font-weight: 500;">Nova versão disponível (${version})</div>
        <button onclick="location.reload()" style="background: #fff; color: #000; border: none; padding: 5px 15px; border-radius: 20px; cursor: pointer; font-weight: 700; font-size: 0.75rem;">ATUALIZAR AGORA</button>
    `;
    document.body.appendChild(toast);
}

async function checkLicenseStatus() {
    try {
        const res = await apiFetch('/api/system/license');
        if (!res) return;
        
        const data = await res.json();
        const isPro = data.status.type === 'pro' && data.status.valid;
        currentFeatures = data.status.features || { tv: false, config: false, update: false, charts: false };
        
        const display = document.getElementById('license-display');
        if (display) {
            display.innerText = data.status.client + (isPro ? ' (PRO)' : ' (GRÁTIS)');
            display.style.color = isPro ? 'var(--accent-success)' : 'var(--accent-primary)';
        }

        // Lock Features based on detailed permissions
        const updateBtn = document.getElementById('btn-update-system');
        const configMenu = document.querySelector('li[onclick*="config"]');
        const tvMenu = document.querySelector('button[onclick*="toggleTVMode"]');

        if (!currentFeatures.update && updateBtn) updateBtn.style.display = 'none';
        
        if (!currentFeatures.config && configMenu) {
            configMenu.innerHTML = '<i data-lucide="lock"></i> <span>Configurações</span>';
        } else if (currentFeatures.config && configMenu) {
            configMenu.innerHTML = '<i data-lucide="settings"></i> <span>Configurações</span>';
        }

        if (!currentFeatures.tv && tvMenu) {
            tvMenu.innerHTML = '<i data-lucide="lock"></i> <span>Modo TV</span>';
        } else if (currentFeatures.tv && tvMenu) {
            tvMenu.innerHTML = '<i data-lucide="tv"></i> <span>Modo TV</span>';
        }

        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error('Erro ao checar licença', err);
    }
}

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
    if (id === 'config' && !currentFeatures.config) {
        alert("A área de Configurações está bloqueada na sua licença.\nEntre em contato com o administrador para liberar.");
        return;
    }
    return originalShowSection(id, element);
};

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
setInterval(updateClock, 1000);
setInterval(checkForSystemUpdate, 30000); // Verifica atualizações a cada 30 segundos
setInterval(checkLicenseStatus, 60000); // Re-valida a licença a cada 1 minuto (mais responsivo)

// Double click to exit TV mode
document.addEventListener('dblclick', () => {
    if (document.body.classList.contains('tv-mode')) toggleTVMode();
});
