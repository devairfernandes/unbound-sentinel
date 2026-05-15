# 🛡️ Resumo da Migração: Unbound Sentinel Master-Client

Este documento detalha a arquitetura atualizada para garantir a separação entre o servidor Master (Notebook) e os servidores Clientes (Nós de monitoramento).

## 🌍 Arquitetura de Rede e Portas
Para evitar conflitos de IP e porta na mesma rede, as portas foram separadas:

*   **MASTER (Notebook/Windows)**: Rodando na porta **3300**.
    *   URL Local: `http://localhost:3300`
    *   URL Pública: `http://devairfernandestrabalho.duckdns.org:3300` (Requer Port Forwarding no Roteador).
*   **MONITOR/CLIENTE (Linux/Rocky)**: Rodando na porta **3000**.
    *   URL: `http://168.197.8.70:3000`

## 🆔 Lógica de Identidade (Blindada)
O sistema agora auto-detecta seu papel baseado no Sistema Operacional para evitar que clientes apareçam como Master:

*   **Windows**: Sempre inicia como **MASTER**.
*   **Linux**: Sempre inicia como **MONITOR** (Esconde abas de gestão e licenças).
*   **Visual**: O título no topo do painel exibe o papel, o IP e o SO (ex: `SENTINEL | MONITOR - 168.197.8.70 (linux)`).

## 🔑 Sincronização de Licenças
O servidor cliente (8.70) busca atualizações no Master usando a seguinte ordem de prioridade (configurada no `.env` remoto em `MASTER_URL`):

1.  **Túnel Temporário**: `https://nice-results-fetch.loca.lt` (Usado para testes de bypass).
2.  **DNS DuckDNS**: `http://devairfernandestrabalho.duckdns.org:3300`
3.  **IP Local**: `http://192.168.100.105:3300`

## 🛡️ Configurações de Segurança Realizadas
1.  **Firewall Windows**: Criada regra para permitir entrada na porta **3300** TCP.
2.  **Escuta Global**: O servidor Master agora escuta em `0.0.0.0` para aceitar conexões externas.
3.  **Bypass de Túnel**: Adicionado header `bypass-tunnel-reminder: true` para permitir sincronismo via Localtunnel.

## 🚀 Próximos Passos
*   **Túnel Permanente**: Se o Port Forwarding do roteador falhar, considerar o uso do **Cloudflare Tunnel** ou **Ngrok** com domínio fixo para o Master.
*   **Deploy**: Ao fazer novos deploys, o script `deploy-multi.js` já está configurado para manter a identidade de cliente nos servidores remotos.

---
*Gerado em: 28/04/2026*
