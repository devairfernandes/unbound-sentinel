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
2. **Visualização 3D (Sentinel Globe)**:
   - Mapa global em tempo real com malha digital e pulsos de rede.
   - Arcos dinâmicos representando fluxos de resolução mundial.
3. **Investigação de Cliente (Drill-down)**:
   - Análise profunda por IP com telemetria específica.
   - Identificação de domínios mais acessados por dispositivo.
   - Preparação para bloqueio rápido via Firewall.
4. **Gestão de Licenciamento (Master Mode)**:
   - Sistema de chaves PRO com controle de funcionalidades (Gating).
   - Gestão de expiração e permissões específicas por cliente.
5. **NOC View (Modo TV)**:
   - Interface de alta densidade otimizada para monitoramento em telas grandes.
   - Atalhos inteligentes (ESC) e botão flutuante para saída rápida.
6. **Suporte Avançado IPv6**:
   - Monitoramento de transporte (IPv4 vs IPv6).
   - Gestão de Access-Control para blocos ISP.
7. **Gestão de Sistema**:
   - Visualização de logs em tempo real.
   - Limpeza automática de logs baseada em uso de disco (>90%).
   - Editor de configuração integrado para arquivos Unbound.

## 🛡️ Segurança e Acesso
- **Autenticação**: Proteção via Basic Auth configurável por `.env`.
- **Acesso Remoto**: Conexão SSH via chaves/senhas para execução de `unbound-control`.
- **Trava de Segurança**: Validação automática de sintaxe (`unbound-checkconf`) antes de salvar qualquer configuração pelo dashboard.
- **Produção**: O serviço roda via Systemd na porta 3000.

## 📡 Detalhes do Servidor de Produção
- **IP Master**: 168.197.8.70
- **Porta Master**: 3300 (Local) / 3000 (Produção)
- **Diretório de Instalação**: `/opt/unbound-dashboard`
- **Caminho Unbound**: `/etc/unbound/`

---
*Última Atualização: 29/04/2026 - Implementação do Globo 3D, Drill-down de Clientes, Sistema de Licenciamento e Módulo de DNS Estático (Sistemas Internos).*

 
