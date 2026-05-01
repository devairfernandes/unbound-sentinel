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
- ✅ Conexão com a internet no servidor

---

## 📦 CONTEÚDO DO PACOTE

```
unbound-sentinel/
├── backend/
├── frontend/
├── .env.example
├── package.json
├── index.js
├── install.sh
└── INSTALACAO.md
```

---

## 🚀 INSTALAÇÃO — PASSO A PASSO

### 1. Copiar o pacote para o servidor

Copie a pasta do projeto para o servidor via SCP:

```bash
scp -r unbound-sentinel/ root@IP_DO_SERVIDOR:/tmp/
```

### 2. Acessar o servidor via SSH

```bash
ssh root@IP_DO_SERVIDOR
```

### 3. Configurar Ambiente

Crie o arquivo de configuração inicial:

```bash
cd /tmp/unbound-sentinel
cp .env.example .env
nano .env
```

Preencha as credenciais de acesso ao dashboard e os dados SSH do servidor local.

### 4. Executar o instalador

```bash
chmod +x install.sh
bash install.sh
```

O script irá configurar automaticamente o Node.js, as dependências e o serviço do sistema.

---

## 🌐 ACESSAR O DASHBOARD

Abra o navegador e acesse:

```
http://IP_DO_SERVIDOR:3000
```

Na tela de login, use as credenciais definidas no seu arquivo `.env`.

---

## 🔧 COMANDOS ÚTEIS

| Ação | Comando |
|------|---------|
| Ver status | `systemctl status unbound-dashboard` |
| Reiniciar | `systemctl restart unbound-dashboard` |
| Ver logs | `journalctl -u unbound-dashboard -f` |

---

## 📞 SUPORTE

Desenvolvido por **Devair Fernandes**  
📱 WhatsApp: [69 99221-4709](https://wa.me/5569992214709)

---

*Unbound Sentinel Dashboard © 2025 — Todos os direitos reservados*
