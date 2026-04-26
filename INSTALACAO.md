# 🛡️ Unbound Sentinel — Guia de Instalação

**Versão:** 1.0  
**Compatível com:** CentOS 7/8/9 · Rocky Linux · AlmaLinux · Debian 11/12 · Ubuntu 20+  
**Requisitos:** Servidor Linux com Unbound DNS instalado e acesso root via SSH

---

## 📋 PRÉ-REQUISITOS

Antes de instalar, verifique se o servidor possui:

- ✅ **Unbound DNS** instalado e rodando (`systemctl status unbound`)
- ✅ Acesso **SSH** ao servidor com usuário `root` ou com `sudo`
- ✅ Porta **3000** liberada no firewall para acesso ao dashboard
- ✅ Conexão com a internet no servidor (para baixar Node.js)

---

## 📦 CONTEÚDO DO PACOTE

```
unbound-sentinel/
├── backend/
│   └── server.js          # API backend (Node.js)
├── frontend/
│   ├── index.html         # Interface do dashboard
│   ├── app.js             # Lógica do frontend
│   └── style.css          # Estilos
├── .env.example           # Modelo de configuração
├── package.json           # Dependências Node.js
├── index.js               # Ponto de entrada
├── install.sh             # Script de instalação automática
└── INSTALACAO.md          # Este arquivo
```

---

## 🚀 INSTALAÇÃO — PASSO A PASSO

### 1. Copiar o pacote para o servidor

No seu computador, copie a pasta do projeto para o servidor via SCP:

```bash
# No terminal do seu computador (Windows: use WinSCP ou PowerShell)
scp -P 22 -r unbound-sentinel/ root@IP_DO_SERVIDOR:/tmp/
```

> Substitua `IP_DO_SERVIDOR` pelo IP real e `-P 22` pela porta SSH correta.

---

### 2. Acessar o servidor via SSH

```bash
ssh root@IP_DO_SERVIDOR -p 22
```

---

### 3. Ir até a pasta copiada

```bash
cd /tmp/unbound-sentinel
```

---

### 4. Configurar credenciais e SSH

Edite o arquivo `.env` com as informações do seu servidor:

```bash
cp .env.example .env
nano .env
```

Preencha o arquivo `.env`:

```env
PORT=3000

# Credenciais de acesso ao dashboard (login pelo navegador)
DASH_USER=admin
DASH_PASS=SuaSenhaSegura123

# Dados SSH do servidor onde o Unbound está instalado
SSH_HOST=127.0.0.1
SSH_PORT=22
SSH_USER=root
SSH_PASS=SuaSenhaSSH
```

> ⚠️ **Importante:** Se o dashboard está no **mesmo servidor** do Unbound, use `SSH_HOST=127.0.0.1`.  
> Se estiver em servidor diferente, coloque o IP do servidor Unbound.

---

### 5. Executar o instalador

```bash
chmod +x install.sh
bash install.sh
```

O script irá automaticamente:
- 📦 Instalar Node.js 20 (se não estiver instalado)
- 📁 Copiar os arquivos para `/opt/unbound-dashboard/`
- 🔧 Instalar as dependências (`npm install`)
- ⚙️ Criar o serviço systemd (`unbound-dashboard`)
- 🔄 Iniciar e habilitar o serviço no boot
- 🛡️ Abrir a porta 3000 no firewall (se firewalld estiver ativo)

---

### 6. Verificar se está funcionando

```bash
systemctl status unbound-dashboard
```

Saída esperada:
```
● unbound-dashboard.service - Unbound Master Dashboard
   Active: active (running) ...
```

---

## 🌐 ACESSAR O DASHBOARD

Abra o navegador e acesse:

```
http://IP_DO_SERVIDOR:3000
```

Na tela de login, use as credenciais definidas no `.env`:
- **Usuário:** `admin` (ou o que você configurou)
- **Senha:** a senha que você definiu em `DASH_PASS`

---

## 🔧 COMANDOS ÚTEIS

| Ação | Comando |
|------|---------|
| Ver status | `systemctl status unbound-dashboard` |
| Reiniciar dashboard | `systemctl restart unbound-dashboard` |
| Parar dashboard | `systemctl stop unbound-dashboard` |
| Ver logs do dashboard | `journalctl -u unbound-dashboard -f` |
| Editar configuração | `nano /opt/unbound-dashboard/.env` |

---

## 🔄 ATUALIZAR O DASHBOARD

Para atualizar para uma nova versão:

```bash
cd /tmp/nova-versao
bash install.sh
```

O script sobrescreve os arquivos e reinicia o serviço automaticamente.

---

## ❓ PROBLEMAS COMUNS

### Dashboard não abre no navegador
- Verifique se a porta 3000 está aberta: `firewall-cmd --list-ports`
- Abra manualmente: `firewall-cmd --permanent --add-port=3000/tcp && firewall-cmd --reload`

### Erro de SSH / "Nenhum dado"
- Verifique as credenciais SSH no `.env`
- Teste manualmente: `ssh root@127.0.0.1`
- Confirme que o Unbound está rodando: `systemctl status unbound`

### Node.js não encontrado (Debian/Ubuntu)
Se o script falhar na instalação do Node.js em Debian/Ubuntu, instale manualmente:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```
Depois rode `bash install.sh` novamente.

---

## 📞 SUPORTE

Desenvolvido por **Devair Fernandes**  
📱 WhatsApp: [69 99221-4709](https://wa.me/5569992214709)

---

*Unbound Sentinel Dashboard © 2025 — Todos os direitos reservados*
