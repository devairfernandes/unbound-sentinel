# 🛡️ Unbound Sentinel

**Versão 2.5.15 (CTI Elite Edition)**

![Sentinel Header](https://raw.githubusercontent.com/devairfernandes/unbound-sentinel/main/assets/banner-v2.png)

**Unbound Sentinel** é um painel CTI (Cyber Threat Intelligence) e NOC (Network Operations Center) de última geração para servidores de DNS Unbound. Projetado para oferecer visibilidade total, performance cirúrgica e segurança cibernética corporativa em tempo real. Com uma interface ultra-moderna (Dark Mode & Neon Aesthetics), o Sentinel transforma logs complexos de DNS em telemetria visual inteligente e interativa.

---

## ✨ Recursos de Elite (v2.5.x)

### 🌍 Globo 3D Holográfico Inteligente (PRO)
- **Visualização Cyberpunk**: Esfera translúcida estilo vidro com malha continental néon e efeito sonar de alta frequência.
- **Arcos de Tráfego CTI**: Exibe arcos tridimensionais conectando geograficamente os IPs dos clientes aos domínios de destino das ameaças.
- **Cores Reativas**: Vermelho para ameaças críticas ou bloqueadas, magenta para tráfego suspeito, e ciano para tráfego seguro de background.
- **Legenda Glassmorphism**: Painel flutuante lateral atualizado em tempo real exibindo as últimas conexões com bandeiras dos países.

### 🛡️ Cyber Threat Intelligence & DNSSEC Guard
- **Background Threat Parser**: Motor assíncrono em segundo plano que processa até 20.000 linhas de logs com buffer estendido de 10MB, operando com sub-milissegundos de latência.
- **Detecção de Malware**: Cruzamento instantâneo com bases de inteligência contra mais de 70 motores antivírus simultaneamente (via integração VirusTotal).
- **DNSSEC Validation Failure**: Captura reativa e tratamento de falhas criptográficas (*Bogus* / assinaturas expiradas) com diagnóstico técnico nos logs.
- **Zero Loopback Noise**: Filtro de loopbacks avançado que remove 100% dos ruídos de IPs locais (`127.0.0.1`, `::1` e `localhost`) nos gráficos, estatísticas e mapas.

### ⚡ NOC Telemetry Elite (Ping Master)
- **Motor Assíncrono Multi-Alvo**: Diagnóstico ultrarrápido por alvo com suporte a ICMP clássico e fallback de handshake TCP (portas customizáveis).
- **Sparklines Néon Reativas**: Gráficos de área preenchidos com gradiente dinâmico para acompanhamento estático e dinâmico de latência.
- **ApexCharts Detalhado**: Métricas corporativas de Perda de Pacotes, Jitter de Rede e médias matemáticas (Min/Max/Avg) em tempo real.

### 🗺️ GeoIP MaxMind & FlagCDN
- **GeoIP Integrado**: Painel autônomo com suporte a bancos locais `.mmdb` (offline/ilimitados), Web API oficial MaxMind e fallback dinâmico para `ip-api.com`.
- **Download com 1 Clique**: Baixa, descompacta e aplica o banco GeoLite2-City local em tempo real sem interrupção de serviço.
- **Suporte FlagCDN**: Renderização universal de bandeiras usando o FlagCDN via imagens para compatibilidade absoluta com sistemas Windows e Linux.

### 📺 Modo TV (NOC View)
- Interface otimizada sem barras de rolagem, com transições em glassmorphism e auto-refresh periódico, perfeita para dashboards de monitoramento corporativo em TVs e telões.

---

## 📸 Painel Sentinel em Ação

| Dashboard Principal | Globo 3D de Tráfego CTI |
|:---:|:---:|
| ![Dashboard](https://raw.githubusercontent.com/devairfernandes/unbound-sentinel/main/assets/screen1-real.png) | ![Globe](https://raw.githubusercontent.com/devairfernandes/unbound-sentinel/main/assets/screen2-real.png) |

---

## 🛠️ Instalação em 2 Minutos

O Sentinel foi desenvolvido com o foco em facilidade. O instalador automático é compatível com **CentOS, Rocky Linux, RHEL, Debian e Ubuntu**.

```bash
# Baixe o pacote instalador e execute
curl -L https://raw.githubusercontent.com/devairfernandes/unbound-sentinel/main/install.sh -o install.sh
chmod +x install.sh
./install.sh
```

> 💡 **Nota de Atualização (OTA)**: Clientes PRO possuem atualizações automáticas de 1 clique direto pelo painel web via mecanismo OTA seguro (Over-The-Air).

---

## 📋 Requisitos de Log CTI (Unbound)

Para extrair todo o poder do Threat Parser, certifique-se que o log de queries está habilitado no arquivo `/etc/unbound/unbound.conf`:

```unbound
server:
    log-queries: yes
    use-syslog: no
    logfile: "/var/log/unbound.log"
```

E aplique permissões corretas de leitura ao arquivo de log:
`chmod 644 /var/log/unbound.log`

---

## 💎 Comparativo de Planos

| Recurso | Versão FREE | Versão PRO / Enterprise |
| :--- | :---: | :---: |
| QPS, Cache & Latência | ✅ Sim | ✅ Sim |
| Gráficos de Tráfego de Rede | ✅ Sim | ✅ Sim |
| Gerenciador de Configuração DNS | ✅ Sim | ✅ Sim |
| Histórico CTI (Ameaças 2h) | ✅ Sim | ✅ Sim |
| **Globo 3D Holográfico** | ❌ Não | ✅ **Sim** |
| **NOC Telemetry Elite (Ping Master)** | ❌ Não | ✅ **Sim (Ilimitado)** |
| **Enriquecimento GeoIP & Scans VT** | ❌ Não | ✅ **Sim (Ilimitado)** |
| **Updates OTA em 1 Clique** | ❌ Não | ✅ **Sim** |

---

## 📞 Suporte & Parcerias

O Sentinel está em constante evolução corporativa. Para adquirir licenças PRO, fechar contratos de consultoria em DNS recursivo resiliente, ou solicitar suporte premium:

- **Desenvolvedor:** Devair Fernandes
- **WhatsApp Oficial:** [Falar com a Equipe Unbound Sentinel](https://wa.me/5569992214709)

---

*© 2026 Unbound Sentinel — Engenharia Avançada e Inteligência DNS.*
