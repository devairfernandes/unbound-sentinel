#!/bin/bash

# 🛡️ UNBOUND SENTINEL — INSTALADOR REMOTO (GITHUB)
# Versão: 2.2.6

echo "========================================================"
echo "   🛡️  INICIANDO INSTALAÇÃO DO UNBOUND SENTINEL"
echo "========================================================"

# 1. Definir URL do repositório (Main Branch)
REPO_URL="https://github.com/devairfernandes/unbound-sentinel/archive/refs/heads/main.tar.gz"
INSTALL_DIR="/opt/unbound-dashboard"

# 2. Verificar dependências básicas
echo "🔍 Verificando dependências (curl, tar)..."
if ! command -v curl &> /dev/null || ! command -v tar &> /dev/null; then
    echo "📦 Instalando dependências básicas..."
    if command -v yum &> /dev/null; then
        yum install -y curl tar
    elif command -v apt-get &> /dev/null; then
        apt-get update && apt-get install -y curl tar
    fi
fi

# 3. Criar diretório e baixar código
echo "📂 Preparando diretório $INSTALL_DIR..."
mkdir -p $INSTALL_DIR
cd /tmp

echo "🌐 Baixando Unbound Sentinel v2.2.6 do GitHub..."
curl -L $REPO_URL -o sentinel.tar.gz

# 4. Extrair arquivos
echo "📦 Extraindo arquivos..."
tar -xzf sentinel.tar.gz
cd unbound-sentinel-main

# 5. Mover para a pasta final
echo "🚚 Movendo arquivos para o destino..."
cp -r ./* $INSTALL_DIR/
[ -f .env.example ] && cp .env.example $INSTALL_DIR/

# 6. Dar permissão e executar o instalador oficial
echo "🚀 Iniciando instalador oficial..."
chmod +x $INSTALL_DIR/install.sh
cd $INSTALL_DIR
./install.sh

echo "========================================================"
echo "   ✅ INSTALAÇÃO REMOTA CONCLUÍDA COM SUCESSO!"
echo "========================================================"
