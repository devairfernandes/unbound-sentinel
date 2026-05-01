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

        const globeQueriesEl = document.getElementById('globe-queries');
        if (globeQueriesEl) animateValue(globeQueriesEl, totalQueries.toLocaleString('pt-BR'));




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
    if (!element) return;
    if ((id === 'config' || id === 'servers') && !authCredentials) {
        showLogin();
        return;
    }
    document.querySelectorAll('section').forEach(s => s.classList.remove('active-section'));
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    const section = document.getElementById(`${id}-section`);
    if (section) section.classList.add('active-section');
    element.classList.add('active');
    if (id === 'config') loadConfig();
    if (id === 'servers') loadServers();
    if (id === 'licenses') loadLicenses();
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
    } else if (module === 'static-dns') {
        title.innerText = 'Sistemas Internos (Static DNS)';
        document.getElementById('config-selector').style.display = 'block';
        document.getElementById('config-selector').value = 'static-dns.conf';
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
        document.querySelector('.editor-actions').style.display = 'none';
        renderDDNS();
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

    if (dashUser) payload.dashUser = dashUser;
    if (dashPass) payload.dashPass = dashPass;
    if (sshHost)  payload.sshHost  = sshHost;
    if (sshPort)  payload.sshPort  = sshPort;
    if (sshUser)  payload.sshUser  = sshUser;
    if (sshPass)  payload.sshPass  = sshPass;
    if (githubToken) payload.githubToken = githubToken;
    if (masterUrl !== undefined) payload.masterUrl = masterUrl;

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
        
        if (file === 'static-dns.conf' && (!data.content || data.content.trim() === '')) {
            editor.value = `# ==========================================================
#  SENTINEL DNS - SISTEMAS INTERNOS (STATIC)
#  Estes domínios continuam funcionando mesmo sem internet.
# ==========================================================

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
            editor.value = data.content || '';
        }
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
    const resultsContainer = document.getElementById('benchmark-results');
    const targetInput = document.getElementById('benchmark-target');
    if (!btn || !loader || !charts.benchmark) return;

    if (!authCredentials) {
        showLogin();
        return;
    }

    if (!currentFeatures.benchmark) {
        alert("O recurso de Benchmark está disponível apenas na licença PRO.");
        return;
    }

    const target = targetInput ? targetInput.value.trim() : '';
    btn.disabled = true;
    loader.style.display = 'block';
    if (resultsContainer) resultsContainer.style.display = 'none';
    
    try {
        const query = target ? `?target=${encodeURIComponent(target)}` : '';
        const res = await apiFetch(`${API_BASE}/benchmark${query}`);
        const data = await res.json();
        
        // Update Main Chart
        charts.benchmark.updateOptions({
            xaxis: { categories: data.map(d => d.name) }
        });
        charts.benchmark.updateSeries([{
            name: 'Média (ms)',
            data: data.map(d => d.avg)
        }]);

        // Render Premium Leaderboard
        if (resultsContainer) {
            resultsContainer.style.display = 'grid';
            const sortedData = [...data].sort((a,b) => a.avg - b.avg);
            const winnerAvg = sortedData[0].avg;
            
            resultsContainer.innerHTML = sortedData.map(d => {
                const isWinner = d.avg === winnerAvg;
                let rank = 'D';
                if (d.avg < 15) rank = 'A+';
                else if (d.avg < 40) rank = 'A';
                else if (d.avg < 80) rank = 'B';
                else if (d.avg < 150) rank = 'C';

                const color = d.avg < 15 ? '#10b981' : (d.avg < 40 ? '#38bdf8' : '#f43f5e');

                return `
                    <div class="benchmark-card ${isWinner ? 'winner' : ''}" style="border-left: 4px solid ${color}">
                        <div class="rank-badge" style="color: ${color}">${rank}</div>
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
            if (window.lucide) lucide.createIcons();
        }
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
let currentFeatures = { tv: false, config: false, update: false, charts: false, globe: false };

// ===== SISTEMA DE ATUALIZAÇÃO =====
let currentVersion = "2.0.0"; // Versão base

// A verificação de atualização agora é tratada pela função no início do arquivo que usa a API /api/system/check-update

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
        const isPro = data.status.type === 'pro' && data.status.valid;
        const isFree = data.status.type === 'free';
        currentFeatures = data.status.features || { tv: false, config: false, update: false, charts: false };
        currentFeatures.isFree = isFree;

        const display = document.getElementById('license-display');
        if (display) {
            let label = data.status.client + (isPro ? ' (PRO)' : ' (GRÁTIS)');
            if (data.status.expiry && data.status.expiry !== 'never') {
                const date = new Date(data.status.expiry).toLocaleDateString('pt-BR');
                label += ` • Vencimento: ${date}`;
            }
            display.innerText = label;
            display.style.color = isPro ? 'var(--accent-success)' : 'var(--accent-primary)';
            
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
            configMenu.innerHTML = '<i data-lucide="settings"></i> <span>Configurações</span>';
        }

        const benchmarkBtn = document.getElementById('run-benchmark-btn');
        if (!currentFeatures.benchmark && benchmarkBtn) {
            benchmarkBtn.disabled = true;
            benchmarkBtn.title = "Recurso disponível apenas na versão PRO";
            benchmarkBtn.innerHTML = '<i data-lucide="lock"></i> BENCHMARK BLOQUEADO';
        }

        if (!currentFeatures.tv && tvMenu) {
            tvMenu.innerHTML = '<i data-lucide="lock"></i> <span>Modo TV</span>';
        } else if (currentFeatures.tv && tvMenu) {
            tvMenu.innerHTML = '<i data-lucide="tv"></i> <span>Modo TV</span>';
        }

        const globePanel = document.querySelector('.globe-panel');
        if (globePanel) {
            globePanel.style.display = currentFeatures.globe ? 'block' : 'none';
        }

        if (window.lucide) lucide.createIcons();

        // Verificar se é Master ou Cliente para mostrar/esconder menus de gestão
        fetch(`${API_BASE}/settings/credentials`, {
            headers: authCredentials ? { 'Authorization': `Basic ${authCredentials}` } : {}
        })
        .then(r => r.json())
        .then(config => {
            const masterMenus = document.querySelectorAll('.master-only');
            const clientOnly = document.querySelectorAll('.client-only');
            const logoText = document.querySelector('.logo span');
            
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
            
            // Se for Master, abre direto na gestão de clientes
            if (config.isMaster) {
                const serversMenu = document.querySelector('li[onclick*="servers"]');
                showSection('servers', serversMenu);
            }
        }).catch(() => {});

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
    if (id === 'monitoring') loadActiveClients();
    return originalShowSection(id, element);
};

async function loadActiveClients() {
    const list = document.getElementById('active-clients-list');
    const countEl = document.getElementById('online-count');
    if (!list) return;

    try {
        const res = await apiFetch('/api/system/active-clients');
        const clients = await res.json();
        
        if (countEl) countEl.innerText = clients.length;

        if (clients.length === 0) {
            list.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:3rem; opacity:0.5;">Nenhum cliente conectado no momento.</td></tr>';
            return;
        }

        list.innerHTML = clients.map(c => {
            const lastSeen = new Date(c.lastSeen).toLocaleTimeString();
            const isPending = c.status === 'free';
            return `
                <tr>
                    <td>
                        <div style="font-weight:700;">${c.client}</div>
                        <div style="font-size:0.7rem; opacity:0.5;">${c.hostname}</div>
                    </td>
                    <td style="font-family:'JetBrains Mono';">${c.ip}</td>
                    <td><span class="badge" style="background:rgba(255,255,255,0.05);">${c.version || 'v2.0'}</span></td>
                    <td><span class="badge ${c.status}">${c.status.toUpperCase()}</span></td>
                    <td>${lastSeen}</td>
                    <td>
                        <div style="display:flex; gap:8px;">
                            ${isPending ? `
                                <button class="btn btn-primary btn-small" onclick="approveClient('${c.hwid}', '${c.hostname}')">
                                    <i data-lucide="check-circle" style="width:12px;"></i> ATIVAR PRO
                                </button>
                            ` : `
                                <button class="btn btn-secondary btn-small" onclick="openEditLicenseByHWID('${c.hwid}')">
                                    <i data-lucide="settings" style="width:12px;"></i> GERIR
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        list.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--accent-danger);">Erro ao carregar monitoramento.</td></tr>';
    }
}

// Inicia o polling do monitoramento se estiver na seção correta
setInterval(() => {
    const monitorSection = document.getElementById('monitoring-section');
    if (monitorSection && monitorSection.classList.contains('active-section')) {
        loadActiveClients();
    }
}, 10000);

async function approveClient(hwid, hostname) {
    const clientName = prompt("Nome comercial para este cliente:", hostname);
    if (!clientName) return;

    try {
        const res = await apiFetch(`${API_BASE}/system/licenses-db`);
        const db = await res.json();
        
        // Gera uma chave interna baseada no HWID
        const key = 'AUTO-' + hwid.substring(0, 8).toUpperCase();
        db[key] = {
            hwid: hwid,
            client: clientName,
            type: 'pro',
            valid: true,
            features: { tv: true, config: true, update: true, charts: true, globe: true, benchmark: true }
        };

        await apiFetch(`${API_BASE}/system/licenses-db`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(db)
        });

        alert("Servidor ativado com sucesso como PRO!");
        loadActiveClients();
    } catch (e) {
        alert("Erro ao aprovar cliente.");
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
setInterval(updateClock, 1000);
setInterval(checkForSystemUpdate, 30000); // Verifica atualizações a cada 30 segundos
setInterval(checkLicenseStatus, 60000); // Re-valida a licença a cada 1 minuto (mais responsivo)


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
        return `
            <div class="server-card">
                <div class="server-card-header">
                    <h3>${lic.client}</h3>
                    <span class="badge ${lic.type === 'pro' ? 'accept' : 'reject'}">${lic.type.toUpperCase()}</span>
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
                        <label>Tipo de Plano</label>
                        <select id="edit-lic-type" class="modern-input">
                            <option value="pro" ${lic.type === 'pro' ? 'selected' : ''}>Pro / Premium</option>
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
            <div class="bar-list">
                ${data.topDomains.map(d => `
                    <div class="bar-item" style="padding:12px 0;">
                        <div class="bar-name" style="font-size:0.85rem; font-weight:500;">${d.name}</div>
                        <div class="bar-wrapper" style="height:6px; background:rgba(255,255,255,0.05);">
                            <div class="bar-fill" style="width: ${(d.count / data.topDomains[0].count * 100).toFixed(1)}%; background: linear-gradient(90deg, var(--accent-primary), #60a5fa);"></div>
                        </div>
                        <div class="bar-count" style="font-size:0.85rem; font-family:'JetBrains Mono'; font-weight:700;">${d.count}</div>
                    </div>
                `).join('')}
            </div>

            <div class="modal-footer" style="margin-top:3rem; display:flex; gap:12px;">
                <button class="btn btn-secondary" onclick="closeModal('client-drilldown-modal')" style="flex:1; justify-content:center; padding:14px; border-radius:12px;">VOLTAR</button>
                <button class="btn btn-primary" style="flex:1; justify-content:center; background:rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color:#f87171; padding:14px; border-radius:12px;" onclick="alert('Funcionalidade de bloqueio rápido será integrada ao módulo de Firewall em breve.')">
                    <i data-lucide="shield-alert"></i> BLOQUEAR DISPOSITIVO
                </button>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    } catch (e) {
        document.getElementById('client-drilldown-body').innerHTML = '<div style="text-align:center; color:var(--accent-danger); padding:2rem;">Erro ao carregar telemetria do cliente. Verifique a conexão com o servidor Master.</div>';
    }
}

async function saveLicenseEdit(key) {
    const status = document.getElementById('edit-lic-status');
    status.innerText = 'Sincronizando com Master...';
    status.style.color = 'var(--accent-primary)';

    try {
        const res = await apiFetch(`${API_BASE}/system/licenses-db`);
        const db = await res.json();
        
        db[key] = {
            ...db[key],
            client: document.getElementById('edit-lic-client').value,
            type: document.getElementById('edit-lic-type').value,
            expiry: document.getElementById('edit-lic-expiry').value,
            features: {
                tv: document.getElementById('p-tv').checked,
                config: document.getElementById('p-config').checked,
                update: document.getElementById('p-update').checked,
                charts: document.getElementById('p-charts').checked,
                globe: document.getElementById('p-globe').checked,
                benchmark: document.getElementById('p-benchmark').checked
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
    const key = 'SENTINEL-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    
    try {
        const res = await apiFetch(`${API_BASE}/system/licenses-db`);
        const db = await res.json();
        db[key] = {
            type: 'pro',
            valid: true,
            client: client,
            features: { tv: true, config: true, update: true, charts: true, globe: true }
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
    list.innerHTML = servers.map((s, i) => `
        <div class="server-card">
            <div class="server-card-header">
                <h3>${s.name}</h3>
                <i data-lucide="server" style="width:16px;color:var(--text-muted);"></i>
            </div>
            <div class="server-info-row">
                <span class="server-info-label">Host:</span>
                <span class="server-info-value">${s.host}</span>
            </div>
            <div class="server-info-row">
                <span class="server-info-label">Porta:</span>
                <span class="server-info-value">${s.port || 22}</span>
            </div>
            <div class="server-info-row">
                <span class="server-info-label">Usuário:</span>
                <span class="server-info-value">${s.user}</span>
            </div>
            <div class="server-actions">
                <button class="btn btn-primary" onclick="runRemoteDeploy(${i})">
                    <i data-lucide="upload-cloud"></i> DEPLOY
                </button>
                <button class="btn btn-secondary" onclick="removeServer(${i})" style="color:var(--accent-danger);">
                    <i data-lucide="trash-2"></i> REMOVER
                </button>
            </div>
        </div>
    `).join('');
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
            .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
            .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
            .backgroundColor('rgba(0,0,0,0)')
            .showAtmosphere(true)
            .atmosphereColor('#38bdf8');

        sentinelGlobe.controls().autoRotate = true;
        sentinelGlobe.controls().autoRotateSpeed = 0.5;
        sentinelGlobe.controls().enableZoom = false;

        // Configuração de Hubs e Arcos (Sync)
        sentinelGlobe.pointsData(hubs)
            .pointAltitude(0.01)
            .pointColor(() => '#38bdf8')
            .pointRadius(0.4)
            .pointResolution(32)
            .pointLabel(d => `<div style="background:rgba(0,0,0,0.9); padding:8px; border:1px solid #38bdf8; border-radius:8px; box-shadow:0 0 15px rgba(56,189,248,0.3);">
                <strong style="color:#38bdf8; font-size:14px;">${d.name}</strong><br>
                <span style="color:#fff; font-size:11px; opacity:0.8;">Sentinel Node Active</span>
            </div>`);

        sentinelGlobe
            .arcColor(d => d.color)
            .arcDashLength(0.4)
            .arcDashGap(2)
            .arcDashAnimateTime(2000)
            .arcStroke(1.5)
            .arcAltitude(0.25);

        // Inicia Arcos Imediatamente
        updateGlobeArcs();

        // Pulsação (Sync)
        sentinelGlobe.ringsData(hubs)
            .ringColor(() => '#38bdf8')
            .ringMaxRadius(5)
            .ringPropagationSpeed(1.5)
            .ringRepeatPeriod(2000);

        // Ajuste de Dimensões
        updateDimensions();
        setTimeout(updateDimensions, 500);
        setTimeout(updateDimensions, 2000);

        // Efeito de Malha Digital (Async - Non-blocking)
        fetch('https://raw.githubusercontent.com/vasturiano/three-globe/master/example/country-polygons/ne_110m_admin_0_countries.geojson')
            .then(res => res.json())
            .then(countries => {
                if (sentinelGlobe) {
                    sentinelGlobe.hexPolygonsData(countries.features)
                        .hexPolygonResolution(3)
                        .hexPolygonMargin(0.7)
                        .hexPolygonColor(() => 'rgba(56, 189, 248, 0.4)');
                }
            })
            .catch(err => console.warn('Erro ao carregar malha digital:', err));

    } catch (e) {
        console.error('Erro na inicialização do Globo:', e);
    }
}

function updateGlobeArcs() {
    if (!sentinelGlobe) return;
    const hubs = [
        { lat: -23.5505, lng: -46.6333 },
        { lat: 40.7128, lng: -74.0060 },
        { lat: 51.5074, lng: -0.1278 },
        { lat: 35.6762, lng: 139.6503 },
        { lat: -33.8688, lng: 151.2093 },
        { lat: 25.2048, lng: 55.2708 }
    ];

    const arcs = Array.from({ length: 15 }, () => {
        const start = hubs[Math.floor(Math.random() * hubs.length)];
        let end = hubs[Math.floor(Math.random() * hubs.length)];
        
        while (end === start) {
            end = hubs[Math.floor(Math.random() * hubs.length)];
        }

        return {
            startLat: start.lat, startLng: start.lng,
            endLat: end.lat, endLng: end.lng,
            color: ["#38bdf8", "#10b981", "#f59e0b"][Math.floor(Math.random() * 3)]
        };
    });

    sentinelGlobe.arcsData(arcs);

    setTimeout(updateGlobeArcs, 5000);
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

setTimeout(initGlobe, 1000);
