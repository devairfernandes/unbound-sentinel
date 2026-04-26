#!/bin/bash
# ============================================================
#  UNBOUND SENTINEL DASHBOARD — Instalador Universal
#  Suporte: CentOS 7/8/9 · Rocky · AlmaLinux · Debian · Ubuntu
# ============================================================

set -e

INSTALL_DIR="/opt/unbound-dashboard"
SERVICE_NAME="unbound-dashboard"
CURRENT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "========================================================"
echo "  🛡️  UNBOUND SENTINEL DASHBOARD — Instalação"
echo "========================================================"
echo ""

# ---- 1. Detectar sistema operacional ----
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    elif [ -f /etc/centos-release ]; then
        OS="centos"
    else
        OS="unknown"
    fi
}
detect_os
echo "🖥️  Sistema detectado: $OS $OS_VERSION"

# ---- 2. Instalar Node.js 20 se necessário ----
install_nodejs() {
    if command -v node &>/dev/null && [[ $(node -v 2>/dev/null) == v20* ]]; then
        echo "✅ Node.js $(node -v) já instalado."
        return
    fi

    echo "📦 Instalando Node.js 20..."

    case "$OS" in
        centos|rhel|rocky|almalinux|fedora)
            if command -v dnf &>/dev/null; then
                sudo dnf module reset nodejs -y 2>/dev/null || true
                sudo dnf module enable nodejs:20 -y 2>/dev/null || true
                sudo dnf install -y nodejs npm 2>/dev/null || \
                curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && sudo dnf install -y nodejs
            else
                curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
                sudo yum install -y nodejs
            fi
            ;;
        debian|ubuntu|linuxmint|pop)
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
            sudo apt-get install -y nodejs
            ;;
        *)
            echo "⚠️  Distro não reconhecida. Tentando instalar via nodesource..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - 2>/dev/null || \
            curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
            sudo apt-get install -y nodejs 2>/dev/null || sudo yum install -y nodejs 2>/dev/null || true
            ;;
    esac
}
install_nodejs

# ---- 3. Verificar Node.js ----
if ! command -v node &>/dev/null; then
    echo "❌ Falha ao instalar Node.js. Instale manualmente e rode o script novamente."
    exit 1
fi
echo "✅ Node.js $(node -v) / npm $(npm -v)"

# ---- 4. Copiar arquivos para diretório de instalação ----
echo ""
echo "📁 Instalando em $INSTALL_DIR ..."
sudo mkdir -p "$INSTALL_DIR"
sudo cp -r "$CURRENT_DIR"/. "$INSTALL_DIR/" 2>/dev/null || true
cd "$INSTALL_DIR"

# ---- 5. Configurar .env ----
if [ ! -f "$INSTALL_DIR/.env" ]; then
    if [ -f "$INSTALL_DIR/.env.example" ]; then
        sudo cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
        echo ""
        echo "⚠️  IMPORTANTE: Configure o arquivo .env antes de usar!"
        echo "   nano $INSTALL_DIR/.env"
        echo ""
    else
        echo "PORT=3000" | sudo tee "$INSTALL_DIR/.env" > /dev/null
    fi
else
    echo "✅ Arquivo .env já existe — mantendo configurações existentes."
fi

# ---- 6. Instalar dependências Node.js ----
echo "📦 Instalando dependências npm..."
cd "$INSTALL_DIR"
sudo npm install --omit=dev

# ---- 7. Criar serviço systemd ----
echo "🔧 Configurando serviço systemd..."
NODE_BIN=$(which node)

sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=Unbound Sentinel Dashboard
After=network.target unbound.service

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${NODE_BIN} ${INSTALL_DIR}/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=unbound-dashboard

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"

# ---- 8. Configurar firewall ----
echo "🛡️  Configurando firewall..."
if command -v firewall-cmd &>/dev/null && sudo firewall-cmd --state &>/dev/null 2>&1; then
    sudo firewall-cmd --permanent --add-port=3000/tcp &>/dev/null
    sudo firewall-cmd --reload &>/dev/null
    echo "✅ Porta 3000 liberada no firewalld."
elif command -v ufw &>/dev/null; then
    sudo ufw allow 3000/tcp &>/dev/null
    echo "✅ Porta 3000 liberada no UFW."
else
    sudo iptables -I INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null || true
    echo "✅ Regra iptables adicionada para porta 3000."
fi

# ---- 9. Verificar status ----
sleep 2
STATUS=$(sudo systemctl is-active "$SERVICE_NAME" 2>/dev/null || echo "unknown")

echo ""
echo "========================================================"
if [ "$STATUS" = "active" ]; then
    PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
    echo "  ✅ Instalação concluída com sucesso!"
    echo ""
    echo "  🌐 Acesse o dashboard em:"
    echo "     http://${PUBLIC_IP}:3000"
    echo ""
    echo "  🔐 Login padrão:"
    echo "     Usuário: admin"
    echo "     Senha:   (definida no .env em DASH_PASS)"
    echo ""
    echo "  ⚙️  Para configurar SSH e senha de acesso:"
    echo "     nano $INSTALL_DIR/.env"
    echo "     systemctl restart $SERVICE_NAME"
else
    echo "  ⚠️  Instalação concluída, mas o serviço não iniciou."
    echo "  Verifique com: journalctl -u $SERVICE_NAME -n 50"
    echo "  Configure o .env e reinicie: systemctl restart $SERVICE_NAME"
fi
echo "========================================================"
echo ""
