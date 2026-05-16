# Sentinel DNS & CTI - Documentação Antigravity

Este documento serve como memória persistente para a inteligência artificial (Antigravity/Gemini) e para o desenvolvedor, mantendo o histórico de arquitetura, decisões técnicas e estado atual do projeto **Sentinel**.

## 📍 Arquitetura e Caminhos Importantes

*   **Frontend**: `frontend/app.js` e `frontend/index.html` (Vanilla JS / HTML / CSS)
*   **Backend**: `backend/server.js` (Express.js / Node.js rodando como root em produção)
*   **Inteligência CTI**: `backend/threat_intel.json` (Banco de ameaças: Onde fica a lista local e a lista atualizada diariamente pela URLhaus).
*   **DNS Master (Unbound)**:
    *   Configuração Principal: `/etc/unbound/unbound.conf`
    *   Sistemas Internos: `/etc/unbound/static-dns.conf`
    *   Blacklist / CTI Blocks: `/etc/unbound/local.d/local-zone.conf`
*   **Deploy Script**: `deploy-remoto.js` (Utilizado para build e push para o servidor `168.197.8.70:51386`).

## 🛡️ Últimas Implementações Críticas (v2.0.8 a v2.1.2)

### 1. Motor CTI & Gestor de Fontes OSINT
*   **Múltiplas Fontes**: O sistema agora possui um gestor de fontes (`cti_sources.json`) que permite ativar/desativar diferentes listas de inteligência (URLhaus, StevenBlack, Phishing Database, Gambling).
*   **Sincronização Dinâmica**: O backend baixa e processa automaticamente as fontes ativas, unificando-as no `threat_intel.json`.
*   **Motor de Busca**: O motor (`/api/security/threats`) utiliza a estrutura `Set` do Javascript para garantir alta performance (O(1)) na filtragem de logs ao processar milhares de domínios maliciosos.
*   **Filtros de Ruído:** Google, Facebook e domínios de infraestrutura local são ignorados automaticamente para evitar falsos positivos.

### 2. Retenção de Memória (12 Horas)
*   A leitura de logs do Unbound via `tail -n 2000` perdia ameaças rapidamente devido à alta rotatividade dos logs.
*   Implementamos um cache em memória no `server.js` (`threatHistory = []`) que retém as ameaças Críticas e Suspeitas detectadas por até **12 horas**.
*   Isso garante que o NOC tenha tempo para revisar os acessos e tomar decisões manuais sobre bloqueio de domínios.

### 3. Blacklist Visual Manager & Monitor de Bloqueios
*   **UI CTI**: Adicionamos um botão "Blacklist" do lado de cada ameaça detectada no painel, chamando a rota `/api/security/blacklist`.
*   **Monitor de Consultas**: Criamos a rota `/api/security/blocked` que cruza os logs do Unbound com a lista de bloqueios manuais, permitindo ver em tempo real quem (IP) tentou acessar o que foi bloqueado.
*   **UI Configurações**: Criamos um módulo visual inteiro dedicado ao gerenciamento da Blacklist no grid de Configurações, manipulando diretamente as regras `always_nxdomain`.
*   **Permissões**: O backend usa `echo '...' | sudo tee -a /etc/unbound/local.d/local-zone.conf > /dev/null` para contornar problemas de permissão e erros de _string escape_ do bash ao gravar aspas.

### 4. Resolução do "Syntax Error" no Unbound (`server:`)
*   **Causa:** Ao salvar o arquivo `local-zone.conf` limpo a partir do Frontend, o serviço de DNS do Unbound quebrava (parava de funcionar). Isso ocorria porque os arquivos _include_ do Unbound exigem que a diretiva `server:` seja declarada no topo caso o escopo anterior seja perdido.
*   **Solução:** Implementamos a injeção obrigatória de `server:` tanto na geração de templates pelo `app.js` (`syncStaticWithEditor` e `syncBlacklistWithEditor`) quanto diretamente via terminal pelo backend (usando `grep -q "^server:"`).

## 📌 Próximos Passos & Dicas Futuras
*   **Segurança no deploy:** Cuidado ao usar `bash -c` e `echo` com comandos compostos e aspas duplas, usar `tee` provou ser muito mais estável para injeções em arquivos de sistema remotos.
*   **Integração do Firewall:** O botão de bloqueio de IPs ainda é visual, os IPs ameaçadores poderão ser passados pro `iptables` ou via `unbound-control` para `access-control`.
*   Sempre verifique a porta (51386) e as chaves corretas ao disparar comandos SSH remotamente via Node.js.
