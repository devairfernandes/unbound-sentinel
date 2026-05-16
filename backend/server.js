require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client } = require('ssh2');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const crypto = require('crypto');
const os = require('os');
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

const ADMIN_USER = envConfig.DASH_USER || 'admin';
const ADMIN_PASS = envConfig.DASH_PASS || 'sentinel2026';
const USERS_FILE = path.join(__dirname, '..', 'users.json');

// --- HELPER DE USUÁRIOS & SEGURANÇA ---
function getUsers() {
    if (!fs.existsSync(USERS_FILE)) {
        // Se não existir, cria o admin padrão do .env
        const hash = crypto.createHash('sha256').update(ADMIN_PASS).digest('hex');
        const defaultUsers = { [ADMIN_USER]: { password: hash, role: 'admin', name: 'Administrador' } };
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 4));
        return defaultUsers;
    }
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function verifyPassword(user, plainPass) {
    const users = getUsers();
    if (!users[user]) {
        console.log(`[Auth] Usuário não encontrado: ${user}`);
        return false;
    }
    const hash = crypto.createHash('sha256').update(plainPass).digest('hex');
    const isValid = users[user].password === hash;
    if (!isValid) console.log(`[Auth] Senha incorreta para: ${user}`);
    return isValid;
}
let LICENSE_KEY = envConfig.SENTINEL_KEY || envConfig.SENTINEL_LICENSE_KEY || 'FREE';
let GITHUB_TOKEN = envConfig.GITHUB_TOKEN || '';

let currentLicenseStatus = { 
    type: 'free', 
    valid: true, 
    client: 'Versão Grátis',
    hwid: 'PENDING',
    features: { tv: false, config: false, update: false, charts: false, globe: false, benchmark: false }
};

const CACHE_FILE = path.join(__dirname, '..', 'license_cache.json');
const SESSIONS_FILE = path.join(__dirname, '..', 'active_sessions.json');

let activeSessions = {};
try {
    if (fs.existsSync(SESSIONS_FILE)) activeSessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
} catch (e) {}

function saveSessions() {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(activeSessions, null, 4), 'utf8');
    } catch (e) {}
}

// Limpeza de sessões inativas (mais de 2 minutos sem sinal)
setInterval(() => {
    const isMaster = process.env.IS_MASTER === 'true' || process.platform === 'win32';
    if (!isMaster) return;
    
    const now = Date.now();
    let changed = false;
    for (const hwid in activeSessions) {
        // Se o cliente não manda sinal há mais de 120 segundos, remove
        if (now - activeSessions[hwid].lastSeen > 2 * 60 * 1000) {
            console.log(`[Sessions] Removendo cliente inativo: ${activeSessions[hwid].hostname} (${hwid})`);
            delete activeSessions[hwid];
            changed = true;
        }
    }
    if (changed) saveSessions();
}, 30 * 1000); // Verifica a cada 30 segundos

function getHWID() {
    try {
        // No Linux, tenta usar o machine-id
        if (process.platform === 'linux') {
            if (fs.existsSync('/etc/machine-id')) return fs.readFileSync('/etc/machine-id', 'utf8').trim();
            if (fs.existsSync('/var/lib/dbus/machine-id')) return fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
        }
        // Fallback para outros sistemas: Hash do hostname + interfaces de rede
        const data = os.hostname() + JSON.stringify(os.networkInterfaces());
        return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
    } catch (e) {
        return 'UNKNOWN-ID-' + os.hostname();
    }
}

function saveLicenseCache(status) {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(status, null, 4), 'utf8');
    } catch (e) {}
}

function loadLicenseCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            console.log('📦 Status de licença carregado do cache local.');
            return cached;
        }
    } catch (e) {}
    return null;
}

async function validateLicenseRemote() {
    try {
        const hwid = getHWID();
        const _0x1a2b = ["aHR0cDovLzE2OC4xOTcuMTAuMjI0OjMzMDA=", "aHR0cDovL3NlcnZpZG9yLWxpY2VuY2FzLmR1Y2tkbnMub3JnOjMzMDA="];
        const DEFAULT_MASTERS = _0x1a2b.map(a => Buffer.from(a, 'base64').toString());
        const urls = (envConfig.SENTINEL_NODE || envConfig.MASTER_URL) ? (envConfig.SENTINEL_NODE || envConfig.MASTER_URL).split(',') : DEFAULT_MASTERS;

        console.log(`[Licença] Heartbeat/Check-in para HWID: ${hwid}`);

        let success = false;
        for (const baseUrl of urls) {
            if (success) break;
            try {
                const checkInUrl = `${baseUrl.trim()}/api/system/check-in`;
                const res = await fetch(checkInUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        hwid,
                        hostname: os.hostname(),
                        ip: 'auto',
                        version: require('../package.json').version
                    }),
                    timeout: 5000
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.status) {
                        // Se recebemos um status válido do Master, usamos ele
                        currentLicenseStatus = { ...data.status, hwid };
                        saveLicenseCache(currentLicenseStatus);
                        success = true;
                        console.log(`✅ Check-in realizado com sucesso via ${baseUrl}. Status: ${data.status.type.toUpperCase()}`);
                        
                        // Se o master retornou 'free' mas nós temos uma chave PRO local, 
                        // talvez o master ainda não tenha nosso HWID. Vamos tentar validar pela chave se necessário.
                        if (data.status.type === 'free' && LICENSE_KEY && LICENSE_KEY !== 'FREE') {
                             console.log(`ℹ️ Chave PRO detectada localmente (${LICENSE_KEY}), tentando validação estendida...`);
                             // Continua para a lógica de validação por chave abaixo se o check-in não resolveu como PRO
                        } else {
                            return; // Já resolveu
                        }
                    }
                }
            } catch (e) {
                console.log(`⚠️ Falha no check-in via ${baseUrl}`);
            }
        }

        // --- LÓGICA DE FALLBACK POR CHAVE (Se o check-in não resolveu como PRO) ---
        if (LICENSE_KEY && LICENSE_KEY !== 'FREE') {
            let db = null;
            for (const baseUrl of urls) {
                try {
                    const url = `${baseUrl.trim()}/api/system/licenses-db?t=${Date.now()}`;
                    const res = await fetch(url, { timeout: 5000 });
                    if (res.ok) {
                        db = await res.json();
                        break;
                    }
                } catch (e) {}
            }

            if (!db) {
                const localDbPath = path.join(__dirname, '..', 'licenses.json');
                if (fs.existsSync(localDbPath)) db = JSON.parse(fs.readFileSync(localDbPath, 'utf8'));
            }

            if (db && db[LICENSE_KEY]) {
                const lic = db[LICENSE_KEY];
                if (lic.valid || lic.status === 'active') {
                    const expiry = lic.expires_at || lic.expiry;
                    const isExpired = expiry && expiry !== 'never' && new Date() > new Date(expiry);
                    
                    if (!isExpired) {
                        currentLicenseStatus = { 
                            type: lic.type, 
                            valid: true, 
                            client: lic.client, 
                            expiry: expiry,
                            hwid,
                            features: { 
                                tv: lic.type === 'pro', 
                                config: true, 
                                update: lic.type === 'pro', 
                                charts: true,
                                globe: lic.type === 'pro',
                                benchmark: lic.type === 'pro',
                                ...(lic.features || {}) 
                            }
                        };
                        saveLicenseCache(currentLicenseStatus);
                        console.log(`✅ Licença PRO validada via chave: ${lic.client}`);
                        return;
                    }
                }
            }
        }

        // --- FALLBACK FINAL (Cache ou Free) ---
        if (!success) {
            const cached = loadLicenseCache();
            if (cached) {
                currentLicenseStatus = cached;
                return;
            }
        }

        if (currentLicenseStatus.type === 'free' && !success) {
            currentLicenseStatus = { 
                type: 'free', 
                valid: true, 
                client: 'Versão Grátis (Limitada)',
                hwid,
                features: { tv: false, config: false, update: false, charts: false, benchmark: false, globe: false } 
            };
        }
    } catch (err) {
        console.error('[Licença] Erro geral:', err.message);
    }
}
// Validate on startup
validateLicenseRemote();
// Re-validate every 1 minute to maintain "Online" status in the dashboard
setInterval(validateLicenseRemote, 60 * 1000);

const auth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Acesso negado' });
    try {
        const [user, pass] = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const users = getUsers();
        
        if (users[user] && verifyPassword(user, pass)) {
            req.user = { id: user, ...users[user] };
            delete req.user.password; // Remove hash por segurança
            next();
        } else {
            res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (e) {
        res.status(401).json({ error: 'Erro de autenticação' });
    }
};

// Middleware para validar permissão mínima
const requireRole = (roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (roles.includes(req.user.role)) {
        next();
    } else {
        res.status(403).json({ error: 'Permissão insuficiente para esta ação' });
    }
};

app.use(cors());
app.use(express.json());

app.post('/api/login', (req, res) => {
    const { user, pass } = req.body;
    const users = getUsers();
    
    if (users[user] && verifyPassword(user, pass)) {
        const userData = { ...users[user] };
        delete userData.password;
        res.json({ message: 'Login realizado', user: userData });
    } else {
        res.status(401).json({ error: 'Usuário ou senha inválidos' });
    }
});

let sshConfig = {
    host: process.env.SSH_HOST,
    port: parseInt(process.env.SSH_PORT) || 22,
    username: process.env.SSH_USER,
    password: process.env.SSH_PASS
};

async function runSSHCommand(command) {
    // Se o host for local, usa exec do próprio node para maior performance e estabilidade
    if (sshConfig.host === '127.0.0.1' || sshConfig.host === 'localhost') {
        try {
            const { stdout, stderr } = await execPromise(command);
            return { stdout, stderr, code: 0 };
        } catch (err) {
            return { stdout: err.stdout || '', stderr: err.stderr || '', code: err.code || 1 };
        }
    }

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

app.get('/api/settings/credentials', auth, requireRole(['admin']), (req, res) => {
    res.json({
        dashUser: req.user.id,
        sshHost: sshConfig.host,
        sshPort: sshConfig.port,
        sshUser: sshConfig.username,
        githubToken: GITHUB_TOKEN ? '********' : '',
        masterUrl: process.env.MASTER_URL || '',
        isMaster: process.platform === 'win32',
        os: process.platform
    });
});

app.post('/api/settings/credentials', auth, requireRole(['admin']), (req, res) => {
    const { dashUser, dashPass, sshHost, sshPort, sshUser, sshPass } = req.body;
    let env = readEnvFile();

    if (dashUser)  { env = updateEnvKey(env, 'DASH_USER', dashUser); ADMIN_USER = dashUser; }
    if (dashPass)  { env = updateEnvKey(env, 'DASH_PASS', dashPass); ADMIN_PASS = dashPass; }
    if (sshHost)   { env = updateEnvKey(env, 'SSH_HOST',  sshHost);  sshConfig.host = sshHost; }
    if (sshPort)   { env = updateEnvKey(env, 'SSH_PORT',  sshPort);  sshConfig.port = parseInt(sshPort); }
    if (sshUser)   { env = updateEnvKey(env, 'SSH_USER',  sshUser);  sshConfig.username = sshUser; }
    if (sshPass)   { env = updateEnvKey(env, 'SSH_PASS',  sshPass);  sshConfig.password = sshPass; }
    if (req.body.githubToken !== undefined) { 
        env = updateEnvKey(env, 'GITHUB_TOKEN', req.body.githubToken); 
        GITHUB_TOKEN = req.body.githubToken; 
    }
    if (req.body.masterUrl !== undefined) {
        env = updateEnvKey(env, 'MASTER_URL', req.body.masterUrl);
        process.env.MASTER_URL = req.body.masterUrl;
    }

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
        status: currentLicenseStatus,
        isMaster: envConfig.IS_MASTER === 'true'
    });
});

app.post('/api/system/check-in', (req, res) => {
    const { hwid, hostname, ip, version } = req.body;
    if (!hwid) return res.status(400).json({ error: 'HWID missing' });

    if (envConfig.IS_MASTER === 'true') {
        const clientIp = req.ip.replace('::ffff:', '');
        const dbPath = path.join(__dirname, '..', 'licenses.json');
        let db = {};
        try {
            if (fs.existsSync(dbPath)) db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
        } catch (e) {}

        // Busca licença associada a este HWID ou IP
        let foundLicense = null;
        for (const key in db) {
            if (db[key].hwid === hwid || db[key].authorized_ip === clientIp) {
                foundLicense = { ...db[key], key };
                break;
            }
        }

        activeSessions[hwid] = {
            hwid,
            hostname,
            ip: ip === 'auto' ? clientIp : ip,
            version,
            lastSeen: Date.now(),
            status: foundLicense ? foundLicense.type : 'free',
            client: foundLicense ? foundLicense.client : (foundLicense ? foundLicense.client : 'Novo Cliente')
        };
        saveSessions();
        console.log(`[Check-in] Recebido de ${hostname} (${clientIp}) - Status: ${activeSessions[hwid].status}`);

        return res.json({ 
            status: foundLicense ? {
                type: foundLicense.type,
                valid: foundLicense.valid,
                client: foundLicense.client,
                features: foundLicense.features || { tv: true, config: true, update: true, charts: true, globe: true }
            } : { 
                type: 'free', 
                valid: true, 
                client: 'Versão Grátis',
                features: { tv: false, config: false, update: false, charts: false, globe: false }
            }
        });
    }
    
    res.status(403).json({ error: 'Not a master node' });
});

app.get('/api/system/active-clients', auth, requireRole(['admin', 'operator']), (req, res) => {
    if (envConfig.IS_MASTER !== 'true') return res.status(403).json({ error: 'Master only' });
    res.json(Object.values(activeSessions));
});

app.post('/api/system/license', auth, requireRole(['admin']), async (req, res) => {
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
        const MASTER_URLS = process.env.MASTER_URL ? process.env.MASTER_URL.split(',') : ['http://servidor-licencas.duckdns.org:3300'];
        let remotePkg = null;

        for (const baseUrl of MASTER_URLS) {
            try {
                const url = `${baseUrl.trim()}/api/system/package-info?t=${Date.now()}`;
                const response = await fetch(url, { 
                    timeout: 5000,
                    headers: { 'bypass-tunnel-reminder': 'true' }
                });
                if (response.ok) {
                    remotePkg = await response.json();
                    break;
                }
            } catch (e) {}
        }

        // Removido fallback via GitHub conforme solicitado.

        if (!remotePkg) throw new Error('Falha ao obter informações da versão');
        
        const isUpdateAvailable = remotePkg.version !== localPkg.version;
        res.json({ updateAvailable: isUpdateAvailable, currentVersion: localPkg.version, newVersion: remotePkg.version });
    } catch (e) {
        res.status(500).json({ error: 'Falha ao verificar atualizações.' });
    }
});

app.post('/api/system/update', auth, requireRole(['admin']), (req, res) => {
    try {
        const MASTER_URL = process.env.MASTER_URL || '';
        const ADMIN_USER = process.env.ADMIN_USER || 'admin';
        const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';
        
        res.json({ message: 'Atualização iniciada. O painel ficará indisponível por alguns segundos enquanto reinicia.' });
        
        setTimeout(() => {
            const cleanMasterUrl = MASTER_URL.replace(/\/$/, '');
            const isMasterUpdate = cleanMasterUrl !== '';
            const downloadUrl = isMasterUpdate 
                ? `${cleanMasterUrl}/api/system/download-package` 
                : 'https://github.com/devairfernandes/unbound-sentinel/archive/refs/heads/main.tar.gz';

            const authHeader = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');

            const updateScript = `(
                echo "--- INICIANDO ATUALIZAÇÃO SENTINEL ---" &&
                echo "Data: $(date)" &&
                cd /opt/unbound-dashboard && echo "[OK] Pasta /opt/unbound-dashboard acessada" || { echo "[ERRO] Pasta /opt/unbound-dashboard não encontrada"; exit 1; } &&
                
                # TRAVA DE AÇO: Salva .env e users.json originais em local seguro
                [ -f .env ] && cp .env /tmp/.env_backup_sentinel && echo "[OK] Backup do .env realizado"
                [ -f users.json ] && cp users.json /tmp/users_backup_sentinel && echo "[OK] Backup do users.json realizado"
                
                echo "Baixando atualização..." &&
                curl -L -k -s ${isMasterUpdate ? `-H "Authorization: Basic ${authHeader}"` : ''} -o update.tar.gz "${downloadUrl}" && echo "[OK] Download concluído" || { echo "[ERRO] Falha no download (curl)"; exit 1; } &&
                
                echo "Extraindo arquivos..." &&
                tar -xzf update.tar.gz --strip-components=1 && echo "[OK] Arquivos extraídos" || { echo "[ERRO] Falha na extração (tar)"; exit 1; } &&
                
                # TRAVA DE AÇO: Restaura arquivos originais
                [ -f /tmp/.env_backup_sentinel ] && mv /tmp/.env_backup_sentinel .env && echo "[OK] .env restaurado com sucesso"
                [ -f /tmp/users_backup_sentinel ] && mv /tmp/users_backup_sentinel users.json && echo "[OK] users.json restaurado com sucesso"
                
                rm -f update.tar.gz &&
                
                echo "Reiniciando sistema..." &&
                (
                    systemctl restart unbound-dashboard || 
                    sudo systemctl restart unbound-dashboard || 
                    pm2 restart all || 
                    pkill -f "node backend/server.js" ; nohup node backend/server.js > /dev/null 2>&1 &
                ) && echo "[OK] Comando de reinício enviado"
                
                echo "--- PROCESSO FINALIZADO ---"
            ) > /tmp/sentinel_update.log 2>&1`;

            console.log(`[UPDATE] Iniciando atualização via: ${isMasterUpdate ? 'MASTER' : 'GITHUB'}`);
            exec(updateScript, (err, stdout, stderr) => {
                if (err) console.error(`[UPDATE EXEC ERR] ${err.message}`);
            });
        }, 1000);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao acionar atualização' });
    }
});

// ===== GESTÃO DE USUÁRIOS (ADMIN ONLY) =====
app.get('/api/system/users', auth, requireRole(['admin']), (req, res) => {
    const users = getUsers();
    const list = Object.keys(users).map(id => ({ id, ...users[id] }));
    list.forEach(u => delete u.password);
    res.json(list);
});

app.post('/api/system/users', auth, requireRole(['admin']), (req, res) => {
    const { id, password, role, name } = req.body;
    if (!id || !password || !role) return res.status(400).json({ error: 'Dados incompletos' });
    
    const users = getUsers();
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    users[id] = { password: hash, role, name: name || id };
    
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 4));
    res.json({ message: 'Usuário salvo com sucesso!' });
});

app.delete('/api/system/users/:id', auth, requireRole(['admin']), (req, res) => {
    const id = req.params.id;
    if (id === req.user.id) return res.status(400).json({ error: 'Você não pode excluir a si mesmo' });
    
    const users = getUsers();
    if (!users[id]) return res.status(404).json({ error: 'Usuário não encontrado' });
    
    delete users[id];
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 4));
    res.json({ message: 'Usuário removido!' });
});

// ===== MULTI-SERVER MANAGEMENT =====
app.get('/api/servers', auth, requireRole(['admin', 'operator']), (req, res) => {
    try {
        const servers = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'servers.json'), 'utf8'));
        res.json(servers);
    } catch (e) {
        res.json([]);
    }
});

app.post('/api/servers', auth, requireRole(['admin']), (req, res) => {
    try {
        const servers = req.body;
        fs.writeFileSync(path.join(__dirname, '..', 'servers.json'), JSON.stringify(servers, null, 4), 'utf8');
        res.json({ message: 'Lista de servidores atualizada com sucesso!' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao salvar servidores' });
    }
});

app.post('/api/deploy/all', auth, requireRole(['admin']), async (req, res) => {
    try {
        res.json({ message: 'Deploy em massa iniciado para todos os clientes.' });
        exec(`node deploy-multi.js`, (err, stdout, stderr) => {
             console.log(`[Deploy Global] Finalizado.`);
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao iniciar deploy global' });
    }
});

app.post('/api/deploy/:index', auth, requireRole(['admin']), async (req, res) => {
    const index = req.params.index;
    try {
        // Passamos o índice para o script de deploy (precisamos ajustar o script para aceitar argumentos)
        res.json({ message: `Iniciando deploy para o cliente #${index}...` });
        exec(`node deploy-multi.js ${index}`, (err, stdout, stderr) => {
             console.log(`[Deploy Individual] Finalizado para índice ${index}`);
        });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao iniciar deploy individual' });
    }
});

// Rota para servir o banco de licenças local para os clientes
app.get('/api/system/licenses-db', (req, res) => {
    try {
        const db = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'licenses.json'), 'utf8'));
        res.json(db);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao ler banco de licenças' });
    }
});

// Rota para salvar alterações no banco de licenças (apenas Master)
app.post('/api/system/licenses-db', auth, requireRole(['admin']), (req, res) => {
    try {
        const db = req.body;
        fs.writeFileSync(path.join(__dirname, '..', 'licenses.json'), JSON.stringify(db, null, 4), 'utf8');
        
        // Sincroniza o status PRO nas sessões ativas imediatamente
        for (const hwid in activeSessions) {
            for (const key in db) {
                if (db[key].hwid === hwid) {
                    activeSessions[hwid].status = db[key].type;
                    activeSessions[hwid].client = db[key].client;
                    break;
                }
            }
        }
        saveSessions();
        
        res.json({ message: 'Banco de licenças atualizado e sessões sincronizadas!' });
    } catch (e) {
        res.status(500).json({ error: 'Erro ao salvar banco de licenças' });
    }
});

// Rota para servir informações do package.json local
app.get('/api/system/package-info', (req, res) => {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
        res.json(pkg);
    } catch (e) {
        res.status(500).json({ error: 'Erro ao ler package.json' });
    }
});

// Rota para que clientes possam baixar a atualização diretamente desta máquina (Master)
app.get('/api/system/download-package', (req, res) => {
    console.log(`[MASTER] Recebida solicitação de download de pacote de atualização de: ${req.ip}`);
    const tarFile = path.join(__dirname, '..', 'update-package.tar.gz');
    const parentDir = path.join(__dirname, '../..');
    const folderName = path.basename(path.join(__dirname, '..'));
    
    // Cria um tar.gz que inclui a pasta raiz, excluindo arquivos de configuração local e dados
    const cmd = `tar -czf "${tarFile}" --exclude="node_modules" --exclude=".git" --exclude=".env" --exclude="users.json" --exclude="servers.json" --exclude="licenses.json" --exclude="license_cache.json" -C "${parentDir}" "${folderName}"`;
    
    exec(cmd, (err) => {
        if (err) {
            console.error('Erro ao gerar pacote:', err);
            return res.status(500).send('Erro ao gerar pacote');
        }
        res.download(tarFile, 'sentinel-update.tar.gz', () => {
            if (fs.existsSync(tarFile)) fs.unlinkSync(tarFile);
        });
    });
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

app.get('/api/stats/client/:ip', auth, async (req, res) => {
    const ip = req.params.ip;
    try {
        if (process.platform === 'win32') return res.json({ ip, total: 0, topDomains: [] });
        
        // Busca as últimas 2000 linhas de log para este IP específico
        const logData = await runSSHCommand(`grep "info: ${ip} " /var/log/unbound.log | tail -n 2000`).catch(() => ({ stdout: '' }));
        const domains = {};
        let total = 0;
        const lines = logData.stdout.split('\n');
        
        lines.forEach(line => {
            const match = line.match(/info: ([0-9.]+) (\S+) (\S+) (\S+)/);
            if (match) {
                const domain = match[2];
                domains[domain] = (domains[domain] || 0) + 1;
                total++;
            }
        });

        const topDomains = Object.entries(domains)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([name, count]) => ({ name, count }));
        
        res.json({ 
            ip, 
            total, 
            topDomains,
            lastUpdate: new Date().toISOString()
        });
    } catch (err) {
        console.error('Client Stats Error:', err);
        res.status(500).json({ error: 'Erro ao processar dados do cliente' });
    }
});

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
        if (process.platform === 'win32') {
            return res.json({ cpu: '0.0', memory: [0, 0, 0, 0, 0, 0], disk: [0, 0, 0, 0, 0], uptime: 'N/A (Windows)', bandwidth: 0, top: { domains: [], clients: [] } });
        }
        
        const isFree = currentLicenseStatus.type === 'free';
        
        // Cálculo de CPU mais robusto
        const cpuRaw = await execPromise("ps -A -o %cpu | awk '{s+=$1} END {print s}'");
        const cpu = parseFloat(cpuRaw.stdout.trim()) || 0;
        
        const freeData = await execPromise("free -m").catch(() => ({ stdout: '' }));
        const memory = freeData.stdout.split('\n')[1]?.split(/\s+/) || [0,0,0,0,0,0];
        
        const dfData = await execPromise("df -h / | tail -1").catch(() => ({ stdout: '' }));
        const disk = dfData.stdout.trim().split(/\s+/) || [0,0,0,0,0];
        
        const uptimeData = await execPromise("uptime -p").catch(() => ({ stdout: '' }));
        const uptime = uptimeData.stdout.trim();
        
        // Coleta Top Domínios/Clientes (Disponível em todas as versões)
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

function getUnboundFilePath(fileName) {
    const paths = {
        'unbound.conf': '/etc/unbound/unbound.conf',
        'static-dns.conf': '/etc/unbound/static-dns.conf',
        'access-control.conf': '/etc/unbound/local.d/access-control.conf',
        'local-zone.conf': '/etc/unbound/local.d/local-zone.conf',
        'forward-zone.conf': '/etc/unbound/local.d/forward-zone.conf'
    };
    return paths[fileName] || `/etc/unbound/${fileName}`;
}

app.get('/api/config/:file', auth, async (req, res) => {
    const fileName = req.params.file;
    // Restrição Grátis: Só permite editar unbound.conf
    const isFree = currentLicenseStatus.type === 'free';
    const allowedFiles = isFree ? ['unbound.conf'] : ['unbound.conf', 'local-zone.conf', 'forward-zone.conf', 'access-control.conf', 'static-dns.conf'];
    
    if (!allowedFiles.includes(fileName)) {
        return res.status(403).json({ error: isFree ? 'Este arquivo só pode ser editado na versão PRO.' : 'Arquivo não permitido' });
    }
    try {
        const fullPath = getUnboundFilePath(fileName);
        console.log(`[Config] Lendo arquivo: ${fullPath}`);
        
        let content = '';
        if (sshConfig.host === '127.0.0.1' || sshConfig.host === 'localhost') {
            // Leitura direta via sistema de arquivos (Muito mais rápido e confiável)
            if (fs.existsSync(fullPath)) {
                content = fs.readFileSync(fullPath, 'utf8');
            } else {
                console.error(`[Config] Arquivo não encontrado: ${fullPath}`);
            }
        } else {
            // Leitura via SSH
            const result = await runSSHCommand(`sudo cat ${fullPath}`).catch((err) => {
                console.error(`[Config] Erro ao ler ${fullPath} via SSH:`, err);
                return { stdout: '' };
            });
            content = result.stdout;
        }
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao ler arquivo' });
    }
});

app.post('/api/config/:file', auth, async (req, res) => {
    const fileName = req.params.file;
    const { content } = req.body;
    const allowedFiles = ['unbound.conf', 'local-zone.conf', 'forward-zone.conf', 'access-control.conf', 'static-dns.conf'];
    if (!allowedFiles.includes(fileName)) return res.status(403).json({ error: 'Arquivo não permitido' });

    try {
        const escapedContent = content.replace(/'/g, "'\\''");
        const tempFile = `/tmp/${fileName}.tmp`;
        
        // 1. Escreve em um arquivo temporário
        await runSSHCommand(`echo '${escapedContent}' > ${tempFile}`);
        
        // 2. Valida a sintaxe (se for o arquivo principal ou se pudermos testar isolado)
        let checkCommand = `sudo unbound-checkconf ${tempFile}`;
        
        // Se for um arquivo de include, precisamos envolver em "server:" para o checkconf não reclamar
        if (fileName !== 'unbound.conf') {
            const validationFile = `${tempFile}_val`;
            checkCommand = `echo "server: " > ${validationFile} && cat ${tempFile} >> ${validationFile} && sudo unbound-checkconf ${validationFile}`;
        }

        const check = await runSSHCommand(checkCommand).catch(err => ({ stderr: err.message }));
        
        if (check.stderr && (check.stderr.toLowerCase().includes('error') || check.stderr.toLowerCase().includes('fatal'))) {
            return res.status(400).json({ 
                error: 'Erro de sintaxe detectado. Operação cancelada para proteger a produção.',
                details: check.stderr 
            });
        }

        // 3. Se estiver OK, move para o diretório oficial
        const fullPath = getUnboundFilePath(fileName);
        
        if (sshConfig.host === '127.0.0.1' || sshConfig.host === 'localhost') {
            // Salvamento direto via sistema de arquivos
            fs.writeFileSync(fullPath, content, 'utf8');
            // Garante permissões (644 para configs do Unbound)
            try { await execPromise(`sudo chmod 644 ${fullPath}`); } catch(e) {}
        } else {
            // Salvamento via SSH
            await runSSHCommand(`sudo mv ${tempFile} ${fullPath}`);
        }
        
        // 4. Reload do Unbound para aplicar as mudanças
        await runSSHCommand('sudo systemctl restart unbound').catch(() => {});
        
        res.json({ message: 'Arquivo validado e salvo com sucesso! O Unbound foi reiniciado.' });
    } catch (err) {
        console.error('Config Save Error:', err);
        res.status(500).json({ error: 'Erro ao processar arquivo de configuração', details: err.message });
    }
});

// ==========================================
// ROTA DE SEGURANÇA: DETECÇÃO DE AMEAÇAS
// ==========================================
app.get('/api/security/threats', async (req, res) => {
    try {
        const threatIntel = JSON.parse(fs.readFileSync(path.join(__dirname, 'threat_intel.json'), 'utf8'));
        
        // Usando tail direto via shell para máxima compatibilidade e performance
        const { exec } = require('child_process');
        const logContent = await new Promise((resolve) => {
            exec('sudo tail -n 2000 /var/log/unbound.log', (err, stdout) => {
                resolve(stdout || '');
            });
        });
        
        const lines = logContent.split('\n');
        const threats = [];
        const suspects = {};

        lines.forEach(line => {
            // Regex ajustado para o seu formato exato: info: [IP] [DOMAIN]
            const match = line.match(/info:\s+([0-9a-fA-F.:]+)\s+([a-zA-Z0-9.-]+)/);
            
            if (match) {
                const ip = match[1];
                let domain = match[2].toLowerCase();
                
                // Limpeza rigorosa: remove pontos finais e espaços
                domain = domain.replace(/\.$/, '').trim();

                const isSuspicious = threatIntel.suspicious_patterns.some(p => domain.includes(p.toLowerCase())) || 
                                   threatIntel.malware_domains.includes(domain);

                if (isSuspicious) {
                    threats.push({
                        time: new Date().toLocaleTimeString(),
                        ip: ip,
                        domain: domain,
                        severity: threatIntel.malware_domains.includes(domain) ? 'CRITICAL' : 'SUSPICIOUS'
                    });

                    if (!suspects[ip]) suspects[ip] = { count: 0, domains: new Set() };
                    suspects[ip].count++;
                    suspects[ip].domains.add(domain);
                }
            }
        });

        // Formatar suspeitos para o frontend
        const topSuspects = Object.keys(suspects).map(ip => ({
            ip: ip,
            count: suspects[ip].count,
            uniqueDomains: suspects[ip].domains.size
        })).sort((a, b) => b.count - a.count).slice(0, 5);

        res.json({
            alerts: threats.slice(-20).reverse(),
            topSuspects: topSuspects,
            totalAlerts: threats.length
        });
    } catch (error) {
        console.error('Erro ao processar ameaças:', error);
        res.status(500).json({ error: 'Erro ao processar inteligência de ameaças' });
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
    const customTarget = req.query.target;
    const baseDomains = ['google.com', 'facebook.com', 'youtube.com', 'netflix.com', 'wikipedia.org'];
    const domains = customTarget ? [customTarget] : baseDomains;
    
    const servers = [
        { name: 'Sentinel (Local)', ip: '127.0.0.1' },
        { name: 'Google DNS', ip: '8.8.8.8' },
        { name: 'Cloudflare', ip: '1.1.1.1' },
        { name: 'Quad9', ip: '9.9.9.9' },
        { name: 'OpenDNS', ip: '208.67.222.222' }
    ];

    const results = [];
    try {
        for (const server of servers) {
            let totalTime = 0;
            const details = [];
            for (const domain of domains) {
                const cmd = `dig @${server.ip} ${domain} | grep "Query time" | awk '{print $4}'`;
                const { stdout } = await runSSHCommand(cmd).catch(() => ({ stdout: '0' }));
                const time = parseInt(stdout.trim()) || 0;
                totalTime += time;
                details.push({ domain, time });
            }
            let avg = totalTime / domains.length;
            if (avg === 0 && server.ip === '127.0.0.1') avg = 0.5; 
            results.push({ name: server.name, avg: avg, details: details });
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
const PORT = process.env.PORT || 3300;
// Remover rota de update duplicada para evitar conflitos

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Sentinel Backend rodando em todas as interfaces na porta ${PORT}`);
    validateLicenseRemote();
});
 
