// ============================================================
//  SENTINEL OTA UPLOADER — backend/upload_update.js
//  Gera o pacote ofuscado e envia para a CDN Cloudflare R2.
//  Uso: node backend/upload_update.js [--skip-build]
// ============================================================
const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const rootDir  = path.join(__dirname, '..');
const tarFile  = path.join(rootDir, 'sentinel-update.tar.gz');
const verFile  = path.join(rootDir, 'version.json');
const skipBuild = process.argv.includes('--skip-build');

function banner(msg) {
    const line = '═'.repeat(50);
    console.log(`\n╔${line}╗`);
    console.log(`║  ${msg.padEnd(48)}║`);
    console.log(`╚${line}╝`);
}

function getVersion() {
    try {
        return JSON.parse(fs.readFileSync(verFile, 'utf8')).version || '?.?.?';
    } catch (_) { return '?.?.?'; }
}

async function uploadToR2(s3, key, buffer, contentType = 'application/gzip') {
    await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: contentType,
    }));
    console.log(`  ✅ Enviado: ${key}`);
}

async function main() {
    banner('🔥  SENTINEL OTA — GERADOR DE ATUALIZAÇÕES  🔥');

    // ── Verificação das credenciais R2 ───────────────────────
    if (!process.env.R2_BUCKET || !process.env.R2_ACCESS_KEY || !process.env.R2_SECRET_KEY || !process.env.R2_ENDPOINT) {
        console.error('\n❌ ERRO: Cloudflare R2 não configurado no .env');
        console.log('   Variáveis necessárias: R2_BUCKET, R2_ACCESS_KEY, R2_SECRET_KEY, R2_ENDPOINT');
        process.exit(1);
    }

    const s3 = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
            accessKeyId:     process.env.R2_ACCESS_KEY,
            secretAccessKey: process.env.R2_SECRET_KEY,
        },
    });

    // ── [1] Build do pacote ──────────────────────────────────
    if (skipBuild) {
        console.log('\n[1/3] ⏩ Build ignorado (--skip-build).');
        const buildTar = path.join(rootDir, 'unbound-sentinel.tar.gz');
        if (!fs.existsSync(buildTar)) {
            console.error('❌ unbound-sentinel.tar.gz não encontrado. Execute sem --skip-build.');
            process.exit(1);
        }
        fs.copyFileSync(buildTar, tarFile);
    } else {
        console.log('\n[1/3] Compilando, ofuscando e empacotando...');
        try {
            if (fs.existsSync(tarFile)) fs.unlinkSync(tarFile);
            execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
            const buildTar = path.join(rootDir, 'unbound-sentinel.tar.gz');
            if (!fs.existsSync(buildTar)) {
                throw new Error('unbound-sentinel.tar.gz não foi gerado pelo build.');
            }
            fs.copyFileSync(buildTar, tarFile);
            console.log('  ✅ Pacote pronto para upload.');
        } catch (err) {
            console.error('❌ Falha ao gerar pacote:', err.message);
            process.exit(1);
        }
    }

    const version = getVersion();
    const sizeMB  = (fs.statSync(tarFile).size / 1024 / 1024).toFixed(2);
    console.log(`  📦 Pacote: ${tarFile} (${sizeMB} MB) — versão ${version}`);

    // ── [2] Upload do pacote ─────────────────────────────────
    console.log('\n[2/3] Enviando pacote para Cloudflare R2...');
    try {
        const tarBuffer = fs.readFileSync(tarFile);
        await uploadToR2(s3, 'update/sentinel-update.tar.gz', tarBuffer, 'application/gzip');
    } catch (err) {
        console.error('❌ Falha no upload do pacote:', err.message);
        process.exit(1);
    }

    // ── [3] Upload do version.json ───────────────────────────
    console.log('\n[3/3] Publicando version.json na CDN...');
    try {
        // Cria um version.json simplificado para a CDN (sem changelog)
        const verData = { version };
        const verBuf  = Buffer.from(JSON.stringify(verData));
        await uploadToR2(s3, 'update/version.json', verBuf, 'application/json');
    } catch (err) {
        console.error('❌ Falha no upload do version.json:', err.message);
        process.exit(1);
    }

    // ── Limpeza local ────────────────────────────────────────
    if (fs.existsSync(tarFile)) fs.unlinkSync(tarFile);

    banner(`🚀 OTA v${version} PUBLICADO COM SUCESSO!`);
    console.log(`\n   Os clientes PRO receberão a atualização v${version} automaticamente.`);
    console.log('   CDN: ' + process.env.R2_ENDPOINT.replace('https://', '').split('/')[0] + '\n');
}

main().catch(err => {
    console.error('\n❌ ERRO FATAL:', err);
    process.exit(1);
});
