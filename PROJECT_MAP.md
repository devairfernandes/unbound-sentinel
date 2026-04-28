# 🛡️ UNBOUND SENTINEL | MAPA DE IMPLEMENTAÇÃO (IMM)

Este documento serve como a base de conhecimento técnica para o projeto **Unbound Sentinel**, um dashboard de monitoramento e gestão DNS de nível NOC (Network Operations Center).

## 📊 Visão Geral do Projeto
O Unbound Sentinel é uma interface web profissional projetada para administrar e visualizar em tempo real a performance de servidores DNS Unbound, com foco em alta densidade de dados e estética premium.

## 🛠️ Stack Tecnológica
- **Backend**: Node.js + Express.
- **Frontend**: Vanilla HTML5, CSS3 (Modern UI/UX), Javascript (ES6+).
- **Gráficos**: ApexCharts (Visualização de alta performance).
- **Comunicação**: SSH2 (Integração direta com o servidor Unbound).
- **Ícones**: Lucide Icons.

## 📁 Estrutura de Diretórios
- `/backend`: Lógica do servidor, API REST e ponte SSH.
- `/frontend`: Interface do usuário, estilos e lógica de dashboard.
- `deploy-remoto.js`: Script de automação de deploy para produção.
- `install.sh`: Script de instalação e configuração do ambiente Linux (Systemd, Npm).

## 🚀 Funcionalidades Chave
1. **Monitoramento em Tempo Real**:
   - TPS (Transações por segundo).
   - Taxa de Cache Hit/Miss.
   - Distribuição de RCODE (Sucesso, ServFail, NXDomain).
   - Tipos de Consulta (A, AAAA, HTTPS, etc.).
2. **Suporte Avançado IPv6**:
   - Monitoramento de transporte (IPv4 vs IPv6).
   - Gestão de Access-Control para blocos ISP.
3. **Gestão de Sistema**:
   - Visualização de logs em tempo real.
   - Limpeza automática de logs baseada em uso de disco (>90%).
   - Editor de configuração integrado para arquivos Unbound.
4. **Otimização DNS**:
   - Suporte a Hyper-local (RFC 8806) para resolução de root zone local.
   - Benchmark comparativo contra Google e Cloudflare.

## 🛡️ Segurança e Acesso
- **Autenticação**: Proteção via Basic Auth configurável por `.env`.
- **Acesso Remoto**: Conexão SSH via chaves/senhas para execução de `unbound-control`.
- **Trava de Segurança**: Validação automática de sintaxe (`unbound-checkconf`) antes de salvar qualquer configuração pelo dashboard.
- **Produção**: O serviço roda via Systemd na porta 3000.

## 📡 Detalhes do Servidor de Produção
- **IP**: Configurado via ambiente
- **Porta SSH**: Configurada via ambiente
- **Diretório de Instalação**: `/opt/unbound-dashboard`
- **Caminho Unbound**: `/etc/unbound/`

---
*Última Atualização: 28/04/2026 - Remoção de credenciais expostas para segurança.*
