require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
let prevNet = { rx: 0, tx: 0, time: Date.now() };
let currentBandwidth = { rx: 0, tx: 0 };
let autoCleanupEnabled = true;
const CLEANUP_THRESHOLD = 90;

const HISTORY_SIZE = 60; // 10 minutos (1 ponto a cada 10s)
const globalHistory = {
    requests: Array(HISTORY_SIZE).fill(0),
    net_rx: Array(HISTORY_SIZE).fill(0),
    net_tx: Array(HISTORY_SIZE).fill(0),
    cpu: Array(HISTORY_SIZE).fill(0),
    mem: Array(HISTORY_SIZE).fill(0),
    labels: Array(HISTORY_SIZE).fill('')
};
let lastStatsTotal = 0;

const ENV_PATH = path.join(__dirname, '..', '.env');
const envConfig = require('dotenv').config({ path: ENV_PATH }).parsed || {};

let ADMIN_USER = envConfig.DASH_USER || 'admin';
let ADMIN_PASS = envConfig.DASH_PASS || 'sentinel2026';
let LICENSE_KEY = envConfig.SENTINEL_LICENSE_KEY || 'FREE';

let currentLicenseStatus = { 
    type: 'free', 
    valid: true, 
    client: 'Versão Grátis',
    features: { tv: false, config: false, update: false, charts: false }
};

async function validateLicenseRemote() {
    try {
        if (LICENSE_KEY === 'FREE') {
            currentLicenseStatus = { type: 'free', valid: true, client: 'Versão Grátis', features: { tv: false, config: false, update: false, charts: false } };
            return;
        }
        const res = await fetch(`https://raw.githubusercontent.com/devairfernandes/unbound-sentinel/main/licenses.json?t=${Date.now()}`);
        const db = await res.json();
        
        const lic = db[LICENSE_KEY];
        if (lic && lic.status === 'active') {
            currentLicenseStatus = { type: lic.type, valid: true, client: lic.client, features: lic.features || { tv: lic.type==='pro', config: lic.type==='pro', update: lic.type==='pro', charts: lic.type==='pro' } };
        } else {
            currentLicenseStatus = { type: 'free', valid: false, client: 'Licença Inválida/Revogada', features: { tv: false, config: false, update: false, charts: false } };
        }
    } catch (err) {
        console.error('Falha ao validar licença remota:', err.message);
    }
}
// Validate on startup
validateLicenseRemote();
// Re-validate every 5 minutes
setInterval(validateLicenseRemote, 5 * 60 * 1000);

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Acesso negado' });
    try {
        const [user, pass] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        if (user === ADMIN_USER && pass === ADMIN_PASS) {
            next();
        } else {
            res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (e) {
        res.status(401).json({ error: 'Erro de autenticação' });
    }
};

app.use(cors());
app.use(express.json());

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        res.json({ message: 'Login realizado com sucesso' });
    } else {
        res.status(401).json({ error: 'Usuário ou senha incorretos' });
    }
});

let sshConfig = {
    host: process.env.SSH_HOST,
    port: parseInt(process.env.SSH_PORT) || 22,
    username: process.env.SSH_USER,
    password: process.env.SSH_PASS
};

async function runSSHCommand(command) {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) { conn.end(); return reject(err); }
                let stdout = '', stderr = '';
                stream.on('close', (code) => {
                    conn.end();
                    resolve({ stdout, stderr, code });
                }).on('data', (data) => {
                    stdout += data.toString();
                }).stderr.on('data', (data) => {
                    stderr += data.toString();
                });
            });
        }).on('error', (err) => reject(err)).connect(sshConfig);
    });
}

function parseStats(stdout) {
    const stats = {};
    stdout.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length === 2) stats[parts[0].trim()] = parseFloat(parts[1].trim());
    });
    return stats;
}

// ===== CREDENTIALS & SSH SETTINGS =====

function readEnvFile() {
    try { return fs.readFileSync(ENV_PATH, 'utf8'); } catch { return ''; }
}

function updateEnvKey(content, key, value) {
    const re = new RegExp(`^${key}=.*$`, 'm');
    const line = `${key}=${value}`;
    return re.test(content) ? content.replace(re, line) : content + `\n${line}`;
}

app.get('/api/settings/credentials', auth, (req, res) => {
    res.json({
        dashUser: ADMIN_USER,
        sshHost: sshConfig.host,
        sshPort: sshConfig.port,
        sshUser: sshConfig.username
    });
});

app.post('/api/settings/credentials', auth, (req, res) => {
    const { dashUser, dashPass, sshHost, sshPort, sshUser, sshPass } = req.body;
    let env = readEnvFile();

    if (dashUser)  { env = updateEnvKey(env, 'DASH_USER', dashUser); ADMIN_USER = dashUser; }
    if (dashPass)  { env = updateEnvKey(env, 'DASH_PASS', dashPass); ADMIN_PASS = dashPass; }
    if (sshHost)   { env = updateEnvKey(env, 'SSH_HOST',  sshHost);  sshConfig.host = sshHost; }
    if (sshPort)   { env = updateEnvKey(env, 'SSH_PORT',  sshPort);  sshConfig.port = parseInt(sshPort); }
    if (sshUser)   { env = updateEnvKey(env, 'SSH_USER',  sshUser);  sshConfig.username = sshUser; }
    if (sshPass)   { env = updateEnvKey(env, 'SSH_PASS',  sshPass);  sshConfig.password = sshPass; }

    try {
        fs.writeFileSync(ENV_PATH, env, 'utf8');
        res.json({ message: 'Configurações salvas com sucesso! Faça login novamente.' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar .env: ' + err.message });
    }
});

// ===== LICENÇA =====
app.get('/api/system/license', auth, (req, res) => {
    res.json({
        key: LICENSE_KEY === 'FREE' ? '' : LICENSE_KEY,
        status: currentLicenseStatus
    });
});

app.post('/api/system/license', auth, async (req, res) => {
    const { key } = req.body;
    let env = readEnvFile();
    const newKey = (key || 'FREE').trim();
    env = updateEnvKey(env, 'SENTINEL_LICENSE_KEY', newKey);
    LICENSE_KEY = newKey;
    
    try {
        fs.writeFileSync(ENV_PATH, env, 'utf8');
        await validateLicenseRemote();
        res.json({ message: 'Licença atualizada!', status: currentLicenseStatus });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar licença: ' + err.message });
    }
});

// ===== AUTO-UPDATER =====
app.get('/api/system/check-update', auth, async (req, res) => {
    try {
        const localPkg = require(path.join(__dirname, '..', 'package.json'));
        const response = await fetch(`https://raw.githubusercontent.com/devairfernandes/unbound-sentinel/main/package.json?t=${Date.now()}`);
        const remotePkg = await response.json();
        
        const isUpdateAvailable = remotePkg.version !== localPkg.version;
        
        res.json({ 
            updateAvailable: isUpdateAvailable, 
            currentVersion: localPkg.version, 
            newVersion: remotePkg.version 
        });
    } catch (e) {
        res.status(500).json({ error: 'Falha ao verificar atualizações no GitHub' });
    }
});

app.post('/api/system/update', auth, (req, res) => {
    try {
        res.json({ message: 'Atualização iniciada. O painel ficará indisponível por alguns segundos enquanto reinicia.' });
        
        // Dispara o script de atualização em background após 1 segundo
        setTimeout(() => {
            const updateScript = `
                cd /opt/unbound-dashboard &&
                curl -sL -o update.tar.gz https://github.com/devairfernandes/unbound-sentinel/archive/refs/heads/main.tar.gz &&
                tar -xzf update.tar.gz --strip-components=1 &&
                rm update.tar.gz &&
                npm install --omit=dev &&
                systemctl restart unbound-dashboard
            `;
            exec(updateScript, (err) => {
                if (err) console.error('Erro na atualização:', err);
            });
        }, 1000);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao acionar atualização' });
    }
});


function parseLogsForTop(stdout) {
    const domains = {}, clients = {};
    const lines = stdout.split('\n');
    lines.forEach(line => {
        const match = line.match(/info: ([0-9.]+) (\S+) (\S+) (\S+)/);
        if (match) {
            const client = match[1], domain = match[2];
            domains[domain] = (domains[domain] || 0) + 1;
            clients[client] = (clients[client] || 0) + 1;
        }
    });

    const sort = (obj) => Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

    return { domains: sort(domains), clients: sort(clients) };
}

app.get('/api/stats', async (req, res) => {
    try {
        const result = await runSSHCommand('unbound-control stats_noreset');
        res.json(parseStats(result.stdout));
    } catch (err) {
        res.status(500).json({ error: 'Erro ao conectar ao Unbound' });
    }
});

app.get('/api/system', async (req, res) => {
    try {
        // Cálculo de CPU mais robusto: soma o %CPU de todos os processos
        const cpuRaw = await execPromise("ps -A -o %cpu | awk '{s+=$1} END {print s}'");
        const cpu = parseFloat(cpuRaw.stdout.trim()) || 0;
        
        const freeData = await execPromise("free -m").catch(() => ({ stdout: '' }));
        const memory = freeData.stdout.split('\n')[1]?.split(/\s+/) || [0,0,0,0,0,0];
        
        const dfData = await execPromise("df -h / | tail -1").catch(() => ({ stdout: '' }));
        const disk = dfData.stdout.trim().split(/\s+/) || [0,0,0,0,0];
        
        const uptimeData = await execPromise("uptime -p").catch(() => ({ stdout: '' }));
        const uptime = uptimeData.stdout.trim();
        
        const logData = await runSSHCommand('tail -n 5000 /var/log/unbound.log').catch(() => ({ stdout: '' }));
        const top = parseLogsForTop(logData.stdout);

        res.json({ 
            cpu: cpu.toFixed(1), 
            memory: memory, 
            disk: disk, 
            uptime: uptime || 'Desconhecido', 
            bandwidth: currentBandwidth, 
            top 
        });
    } catch (err) {
        console.error('System API Error:', err);
        res.status(500).json({ error: 'Erro ao coletar dados do sistema' });
    }
});

app.get('/api/config/:file', auth, async (req, res) => {
    const fileName = req.params.file;
    const allowedFiles = ['unbound.conf', 'local-zone.conf', 'forward-zone.conf', 'access-control.conf'];
    if (!allowedFiles.includes(fileName)) return res.status(403).json({ error: 'Arquivo não permitido' });
    try {
        const result = await runSSHCommand(`cat /etc/unbound/${fileName}`);
        res.json({ content: result.stdout });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao ler arquivo' });
    }
});

app.post('/api/config/:file', auth, async (req, res) => {
    const fileName = req.params.file;
    const { content } = req.body;
    const allowedFiles = ['unbound.conf', 'local-zone.conf', 'forward-zone.conf', 'access-control.conf'];
    if (!allowedFiles.includes(fileName)) return res.status(403).json({ error: 'Arquivo não permitido' });

    try {
        const escapedContent = content.replace(/'/g, "'\\''");
        const tempFile = `/tmp/${fileName}.tmp`;
        
        // 1. Escreve em um arquivo temporário
        await runSSHCommand(`echo '${escapedContent}' > ${tempFile}`);
        
        // 2. Valida a sintaxe (se for o arquivo principal ou se pudermos testar isolado)
        // Nota: unbound-checkconf no arquivo temporário
        const check = await runSSHCommand(`sudo unbound-checkconf ${tempFile}`);
        
        if (check.stderr && check.stderr.includes('error')) {
            return res.status(400).json({ 
                error: 'Erro de sintaxe detectado. Operação cancelada para proteger a produção.',
                details: check.stderr 
            });
        }

        // 3. Se estiver OK, move para o diretório oficial
        await runSSHCommand(`sudo mv ${tempFile} /etc/unbound/${fileName}`);
        
        // 4. Reload opcional ou apenas aviso
        res.json({ message: 'Arquivo validado e salvo com sucesso! Lembre-se de dar Reload no serviço.' });
    } catch (err) {
        console.error('Config Save Error:', err);
        res.status(500).json({ error: 'Erro ao processar arquivo de configuração', details: err.message });
    }
});

app.get('/api/firewall', auth, async (req, res) => {
    try {
        const result = await runSSHCommand('sudo iptables -S');
        res.json({ content: result.stdout });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao ler firewall' });
    }
});

app.post('/api/firewall/rule', auth, async (req, res) => {
    const { action, chain, protocol, port, target } = req.body;
    // Validate inputs
    const validChains = ['INPUT', 'OUTPUT', 'FORWARD'];
    const validTargets = ['ACCEPT', 'DROP', 'REJECT'];
    const validProtocols = ['tcp', 'udp', 'all'];
    if (!validChains.includes(chain) || !validTargets.includes(target) || !validProtocols.includes(protocol)) {
        return res.status(400).json({ error: 'Parâmetros inválidos' });
    }
    try {
        const portStr = (port && protocol !== 'all') ? `--dport ${parseInt(port)}` : '';
        const protoStr = protocol !== 'all' ? `-p ${protocol}` : '';
        const flag = action === 'add' ? '-A' : '-D';
        const cmd = `sudo iptables ${flag} ${chain} ${protoStr} ${portStr} -j ${target}`.replace(/\s+/g, ' ').trim();
        await runSSHCommand(cmd);
        // Persist rules
        await runSSHCommand('sudo sh -c "iptables-save > /etc/iptables/rules.v4" 2>/dev/null || true');
        res.json({ message: `Regra ${action === 'add' ? 'adicionada' : 'removida'} com sucesso!` });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao modificar regra de firewall', details: err.message });
    }
});

app.get('/api/network', auth, async (req, res) => {
    try {
        const addr = await runSSHCommand('ip -4 addr show && ip -6 addr show');
        const routes = await runSSHCommand('ip route show');
        res.json({ content: `=== INTERFACES E ENDEREÇOS ===\n${addr.stdout}\n\n=== ROTAS ===\n${routes.stdout}` });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao ler rede' });
    }
});

app.get('/api/network/config', auth, async (req, res) => {
    try {
        // CentOS/RHEL: find ifcfg-eth0 or ifcfg-ens* files
        const ifcfgResult = await runSSHCommand(
            'ls /etc/sysconfig/network-scripts/ifcfg-* 2>/dev/null | grep -v "ifcfg-lo" | head -1'
        ).catch(() => ({ stdout: '' }));
        const ifcfgFile = ifcfgResult.stdout.trim();

        if (ifcfgFile) {
            // Read all ifcfg files (not loopback) and concatenate
            const all = await runSSHCommand(
                'for f in /etc/sysconfig/network-scripts/ifcfg-*; do grep -v "^#" "$f" 2>/dev/null | grep -v "^$" && echo ""; done'
            ).catch(() => ({ stdout: '' }));
            // Use just the main interface file for editing
            const content = await runSSHCommand(`cat "${ifcfgFile}"`);
            return res.json({ content: content.stdout, file: ifcfgFile, type: 'ifcfg' });
        }

        // Netplan (Ubuntu)
        const netplanGlob = await runSSHCommand('ls /etc/netplan/*.yaml 2>/dev/null | head -1').catch(() => ({ stdout: '' }));
        const netplanFile = netplanGlob.stdout.trim();
        if (netplanFile) {
            const content = await runSSHCommand(`cat "${netplanFile}"`);
            return res.json({ content: content.stdout, file: netplanFile, type: 'netplan' });
        }

        // Debian/Ubuntu fallback
        const interfaces = await runSSHCommand('cat /etc/network/interfaces 2>/dev/null').catch(() => ({ stdout: '' }));
        if (interfaces.stdout && interfaces.stdout.trim()) {
            return res.json({ content: interfaces.stdout, file: '/etc/network/interfaces', type: 'interfaces' });
        }

        res.json({ content: '# Nenhum arquivo de configuração de rede encontrado.', file: '', type: 'unknown' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao ler configuração de rede: ' + err.message });
    }
});


app.post('/api/network/config', auth, async (req, res) => {
    const { content, file } = req.body;
    const allowed = /^\/etc\/(netplan\/[\w.-]+\.yaml|network\/interfaces|sysconfig\/network-scripts\/ifcfg-[\w.-]+)$/;
    if (!file || !allowed.test(file)) {
        return res.status(400).json({ error: 'Arquivo não permitido: ' + file });
    }
    try {
        const escaped = content.replace(/'/g, "'\\''");
        const tempFile = `/tmp/netcfg.tmp`;
        await runSSHCommand(`echo '${escaped}' > ${tempFile}`);
        await runSSHCommand(`sudo cp ${tempFile} ${file}`);
        res.json({ message: `Configuração salva em ${file}. Reinicie a rede para aplicar.` });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao salvar configuração de rede', details: err.message });
    }
});

app.post('/api/service/:action', auth, async (req, res) => {
    const action = req.params.action;
    const allowedActions = ['start', 'stop', 'restart', 'reload'];
    if (!allowedActions.includes(action)) return res.status(400).json({ error: 'Ação inválida' });
    try {
        await runSSHCommand(`sudo systemctl ${action} unbound`);
        res.json({ message: `Serviço: ${action} executado com sucesso` });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao executar ação no serviço' });
    }
});

app.post('/api/logs/clear', auth, async (req, res) => {
    try {
        await runSSHCommand('sudo truncate -s 0 /var/log/unbound.log');
        res.json({ message: 'Logs limpos com sucesso!' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao limpar logs' });
    }
});

app.get('/api/logs', auth, async (req, res) => {
    try {
        const result = await runSSHCommand('tail -n 50 /var/log/unbound.log');
        res.json({ logs: result.stdout });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao ler logs' });
    }
});

async function monitorBandwidth() {
    try {
        const data = await execPromise("cat /proc/net/dev | grep eth0 || cat /proc/net/dev | grep ens");
        const stats = data.stdout.trim().split(/\s+/);
        const rx = parseInt(stats[1]), tx = parseInt(stats[9]), now = Date.now();
        if (prevNet.rx > 0) {
            const dt = (now - prevNet.time) / 1000;
            currentBandwidth = { rx: ((rx - prevNet.rx) * 8) / (1024 * 1024 * dt), tx: ((tx - prevNet.tx) * 8) / (1024 * 1024 * dt) };
        }
        prevNet = { rx, tx, time: now };
    } catch (e) {}
}
setInterval(monitorBandwidth, 5000);

async function monitorDiskUsage() {
    if (!autoCleanupEnabled) return;
    try {
        const { stdout } = await execPromise("df / | tail -1 | awk '{print $5}' | sed 's/%//'");
        if (parseInt(stdout) > CLEANUP_THRESHOLD) {
            console.log(`Disco acima de ${CLEANUP_THRESHOLD}%. Iniciando limpeza...`);
            await runSSHCommand('sudo truncate -s 0 /var/log/unbound.log');
        }
    } catch (e) {}
}
setInterval(monitorDiskUsage, 15 * 60 * 1000);

app.get('/api/settings', (req, res) => {
    res.json({ autoCleanup: autoCleanupEnabled, threshold: CLEANUP_THRESHOLD });
});
app.post('/api/settings', auth, (req, res) => {
    autoCleanupEnabled = !!req.body.autoCleanup;
    res.json({ message: `Limpeza automática ${autoCleanupEnabled ? 'ativada' : 'desativada'}` });
});

app.get('/api/benchmark', auth, async (req, res) => {
    const domains = ['google.com', 'facebook.com', 'youtube.com', 'netflix.com', 'wikipedia.org'];
    const servers = [
        { name: 'Sentinel (Local)', ip: '127.0.0.1' },
        { name: 'Google DNS', ip: '8.8.8.8' },
        { name: 'Cloudflare', ip: '1.1.1.1' }
    ];

    const results = [];
    try {
        for (const server of servers) {
            let totalTime = 0;
            for (const domain of domains) {
                // Dig output usually has "Query time: 12 msec"
                const cmd = `dig @${server.ip} ${domain} | grep "Query time" | awk '{print $4}'`;
                const { stdout } = await runSSHCommand(cmd).catch(() => ({ stdout: '0' }));
                totalTime += parseInt(stdout.trim()) || 0;
            }
            let avg = totalTime / domains.length;
            if (avg === 0 && server.ip === '127.0.0.1') avg = 0.5; // Valor mínimo para visibilidade
            results.push({ name: server.name, avg: avg });
        }
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao rodar benchmark' });
    }
});

app.get('/api/history', (req, res) => {
    res.json(globalHistory);
});

async function monitorHistory() {
    try {
        // 1. CPU & Memory
        const cpuRaw = await execPromise("ps -A -o %cpu | awk '{s+=$1} END {print s}'").catch(() => ({ stdout: '0' }));
        const cpu = parseFloat(cpuRaw.stdout.trim()) || 0;
        
        const freeData = await execPromise("free -m").catch(() => ({ stdout: '' }));
        const memoryLines = freeData.stdout.split('\n');
        const memory = memoryLines[1]?.split(/\s+/) || [0,0,1,0,0,0];
        const memTotal = parseInt(memory[1]) || 1;
        const memUsed = parseInt(memory[2]) || 0;
        const memPercent = (memUsed / memTotal * 100);

        // 2. TPS (Requests)
        const statsRes = await runSSHCommand('unbound-control stats_noreset').catch(() => ({ stdout: '' }));
        const stats = parseStats(statsRes.stdout);
        const currentTotal = stats['total.num.queries'] || 0;
        let tps = 0;
        if (lastStatsTotal > 0) {
            tps = (currentTotal - lastStatsTotal) / 10;
        }
        lastStatsTotal = currentTotal;

        // 3. Update Global Object
        const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        globalHistory.cpu.push(cpu); globalHistory.cpu.shift();
        globalHistory.mem.push(memPercent); globalHistory.mem.shift();
        globalHistory.requests.push(tps); globalHistory.requests.shift();
        globalHistory.net_rx.push(currentBandwidth.rx); globalHistory.net_rx.shift();
        globalHistory.net_tx.push(currentBandwidth.tx); globalHistory.net_tx.shift();
        globalHistory.labels.push(now); globalHistory.labels.shift();

    } catch (e) {
        console.error('Monitor History Error:', e);
    }
}
setInterval(monitorHistory, 10000); // Sincronizado com o refresh do frontend


app.use(express.static(path.join(__dirname, '../frontend')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Dashboard running on port ${PORT}`));
