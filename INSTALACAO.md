# 🛡️ Unbound Sentinel — Guia de Instalação e Funcionalidades

**Versão:** 1.8.1 (Gold Edition — Steel Lock)  
**Compatível com:** CentOS 7/8/9 · Rocky Linux · AlmaLinux · Debian 11/12 · Ubuntu 20+  
**Requisitos:** Servidor Linux com Unbound DNS instalado e acesso root via SSH

---

## 📋 PRÉ-REQUISITOS

Antes de instalar, verifique se o servidor possui:

- ✅ **Unbound DNS** instalado e rodando (`systemctl status unbound`)
- ✅ Acesso **SSH** ao servidor com usuário `root` ou com `sudo`
- ✅ Porta **3000** liberada no firewall para acesso ao dashboard
- ✅ **Unbound Logs** ativos (`log-queries: yes`) para estatísticas de Top Domínios e Clientes
- ✅ Conexão com a internet no servidor

---

## ✨ FUNCIONALIDADES PRINCIPAIS (NEW)

O Unbound Sentinel evoluiu de um simples editor de texto para uma plataforma de gestão visual completa:

1. **Gestão Visual de IPs (Access Control):**
   - Adicione, remova e gerencie blocos de IP via interface de cards.
   - Suporte a ações: Permitir, Recusar, Bloquear e Estático.
   - Busca em tempo real e filtros inteligentes.

2. **Sistemas Internos (Static DNS):**
   - Mapeie nomes de rede (ERP, Servidores, Câmeras) para IPs internos sem precisar de internet.
   - Interface visual para gerenciar registros `local-zone` e `local-data`.
   - Identificação amigável por "Nome do Sistema".

3. **Dashboard Real-Time:**
   - Gráficos de consultas por segundo (QPS) e latência.
   - Monitoramento de largura de banda (RX/TX).
   - Mapa global (Globe View) para visualizar tráfego (Exclusivo PRO).

4. **Multi-Node Deployment:**
   - Gerencie múltiplos servidores Unbound a partir de um único painel mestre.
   - Deploy sincronizado de configurações.

---

## 📂 MAPEAMENTO DE PASTAS E CONFIGURAÇÕES

Para garantir a segurança e facilitar o suporte, o Sentinel utiliza um padrão rígido de diretórios:

### 1. Diretório do Painel (`/opt/unbound-dashboard`)
Aqui reside o "motor" do sistema:
- **`.env`**: Arquivo mestre de credenciais (Porta, Senha do Painel, Acesso SSH). *[Protegido pela Trava de Aço]*
- **`users.json`**: Banco de dados de usuários e permissões. *[Protegido pela Trava de Aço]*
- **`backend/server.js`**: Lógica principal e API.
- **`frontend/`**: Interface visual e arquivos web.

### 2. Configurações do Unbound (`/etc/unbound/local.d/`)
O Sentinel gerencia arquivos específicos para não interferir no seu `unbound.conf` principal:
- **`local.d/access_control.conf`**: Onde as regras de IPs (Permitir/Bloquear) são salvas.
- **`local.d/static_zones.conf`**: Onde os domínios internos (Sistemas Estáticos) são configurados.

### 3. Logs do Sistema
- **`/var/log/unbound.log`**: Onde o Sentinel lê os dados para gerar os gráficos de Top Domínios/Clientes.

---

## 🛡️ A TRAVA DE AÇO (STEEL LOCK)

A partir da v1.8.0, o Sentinel implementa uma tecnologia de **Auto-Preservação**:
- Durante atualizações OTA ou Manuais, o sistema detecta seus arquivos de configuração (`.env` e `users.json`).
- Eles são movidos para um local seguro (`/tmp`) antes da instalação dos novos arquivos.
- Após a atualização, eles são restaurados instantaneamente.
- **Resultado:** Você nunca mais perde suas senhas ou usuários ao atualizar o sistema.

---

### 1. Copiar o pacote para o servidor

Copie a pasta do projeto para o servidor via SCP ou Git:

```bash
scp -r unbound-sentinel/ root@IP_DO_SERVIDOR:/tmp/
```

### 2. Configurar Ambiente

Crie o arquivo de configuração inicial:

```bash
cd /tmp/unbound-sentinel
cp .env.example .env
nano .env
```

**Configurações Importantes no `.env`:**
- `DASH_USER`/`DASH_PASS`: Suas credenciais de acesso web.
- `SSH_HOST`: O IP do servidor local (geralmente `127.0.0.1`).
- `SSH_PASS`: Senha do root (para manipulação de arquivos do Unbound).

### 3. Executar o instalador

```bash
chmod +x install.sh
bash install.sh
```

---

## 🌐 ACESSO E USO

1. **Login:** Acesse `http://IP_DO_SERVIDOR:3000`.
2. **Configuração Visual:** No menu lateral, acesse **Configurações**.
3. **Módulos:** Use os cards **"Controle de Acesso (IPs)"** ou **"Sistemas Internos (Static)"** para gerenciar as regras de forma visual sem editar arquivos de texto.

---

## 🔧 COMANDOS ÚTEIS

| Ação | Comando |
|------|---------|
| Ver status | `systemctl status unbound-dashboard` |
| Reiniciar | `systemctl restart unbound-dashboard` |
| Ver logs | `journalctl -u unbound-dashboard -f` |
| Local das Configs | `/etc/unbound/` |

---

## 📞 SUPORTE E LICENCIAMENTO

Desenvolvido por **Devair Fernandes**  
📱 WhatsApp: [69 99221-4709](https://wa.me/5569992214709)

---

*Unbound Sentinel Dashboard © 2025 — Todos os direitos reservados*
 
