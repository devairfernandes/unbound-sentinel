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

## 🛡️ Últimas Implementações Críticas (v2.1.2 a v2.2.0)

### 1. Dashboard de Segurança Consolidado (NOC View)
*   **Novos Cards na Home**: Replicamos as métricas de CTI (Ameaças Críticas, Suspeitas, Bloqueios e IPs Monitorados) diretamente para a página inicial.
*   **Navegação Inteligente**: Implementamos o redirecionamento dos cards para a aba de segurança, garantindo que o menu lateral seja atualizado automaticamente para manter a consistência da UI.
*   **Vigilância Global**: O contador de "IPs Monitorados" foi expandido para mostrar todos os clientes ativos na rede (via processamento de logs), proporcionando uma percepção de segurança abrangente.

### 2. Sincronização de Versão e Correção do OTA
*   **Upgrade v2.2.0 (Sentinel Security Plus)**: Bump de versão no `package.json` e `version.json` para disparar o alerta de atualização nos clientes.
*   **Fim do Cache de Versão**: Removemos o uso de `require` no backend para leitura do `package.json`, substituindo por `fs.readFileSync`. Isso garante que o servidor Master sempre reporte a versão em disco em tempo real, sem depender de reinicialização para que os clientes vejam novos updates.
*   **Injeção de `server:`**: Reforçamos a estabilidade do Unbound garantindo que arquivos de configuração injetados via web sempre contenham o cabeçalho necessário para o parser do serviço.

## 📌 Próximos Passos & Dicas Futuras
*   **Alertas em Tempo Real:** Implementar Webhooks (Discord/Telegram) para notificações de ameaças Críticas.
*   **Bloqueio Automático:** Criar opção de "Auto-Block" para fontes OSINT de altíssima confiança (ex: URLhaus malware).
*   **Logs Otimizados:** Se o tráfego aumentar muito, considerar migrar o log em memória de 12h para um SQLite local para evitar consumo excessivo de RAM.
*   Sempre verifique a porta (51386) e as chaves corretas ao disparar comandos SSH remotamente via Node.js.

