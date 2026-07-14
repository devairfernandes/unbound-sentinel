# 🛡️ Sentinel DNS — DNS Firewall Appliance para ISPs

<div align="center">

[![Website](https://img.shields.io/badge/Site%20Oficial-sentineldns.net-38bdf8?style=for-the-badge&logo=globe&logoColor=white)](https://sentineldns.net)
[![License](https://img.shields.io/badge/Licença-Proprietária-818cf8?style=for-the-badge)](https://sentineldns.net/privacidade.html)
[![Rocky Linux](https://img.shields.io/badge/Rocky%20Linux-9.7-10b981?style=for-the-badge&logo=rockylinux&logoColor=white)](https://rockylinux.org)
[![Unbound](https://img.shields.io/badge/Unbound-2.9.31-38bdf8?style=for-the-badge)](https://nlnetlabs.nl/projects/unbound/)
[![DNSSEC](https://img.shields.io/badge/DNSSEC-Ativo-10b981?style=for-the-badge&logo=shield&logoColor=white)](https://sentineldns.net/docs.html)

**DNS Firewall Recursivo de Alto Desempenho para Provedores de Internet (ISPs) e Redes Corporativas**

[📥 Baixar ISO](https://sentineldns.net/download.html) • [📖 Documentação](https://sentineldns.net/docs.html) • [🌐 Site Oficial](https://sentineldns.net) • [📧 Suporte](mailto:dnssentinel@sentineldns.net)

![Sentinel DNS Banner](https://sentineldns.net/banner-v2.webp)

</div>

---

## O que é o Sentinel DNS?

O **Sentinel DNS** é um appliance de DNS Firewall open-source baseado em **Rocky Linux 9.7**, distribuído como uma **ISO autoinstalável** pronta para produção em menos de 5 minutos.

Projetado especificamente para **Provedores de Internet (ISPs)**, operadoras de telecom e redes corporativas críticas que precisam de:

- ✅ Resolução DNS de alta performance com **auto-tuning de hardware**
- ✅ Bloqueio de malware e phishing em **tempo real via CTI feeds**
- ✅ Dashboard NOC com **Globo 3D holográfico** de ameaças geolocalizadas
- ✅ Instalação **100% offline e automatizada** (zero configuração manual)
- ✅ Conformidade judicial **ANATEL** com o módulo AnaBlock

---

## 📸 Screenshots

<div align="center">

| Dashboard NOC Master | Tráfego Global em Tempo Real |
|---|---|
| ![Dashboard](https://sentineldns.net/screen1-real.webp) | ![Tráfego](https://sentineldns.net/screen2-real.webp) |

</div>

---

## 💿 Recursos do Appliance

### Instalação e Deploy
- **Kickstart Unattended (ks.cfg)** — Particiona disco LVM, instala Node.js, Redis e Unbound, inicia o painel sem qualquer intervenção humana
- **100% Offline** — Não requer internet durante a instalação do cliente
- **Pronto para produção em < 5 minutos**

### Performance e Otimização
- **Dynamic Auto-Tuning** — Script de boot que mede CPU e RAM e configura automaticamente:
  - Buffers UDP do Kernel (`rmem_max`, `rmem_default`) até **16 MB**
  - Slabs de Cache mapeados em potência de 2 por núcleo de CPU
  - Limites de cache escalados dinamicamente até **4 GB de RAM**
- **RFC 8198 (Prefetch)** — Renova registros populares em background
- **RFC 8767 (Serve-Expired)** — Serve cache por até **24h** durante instabilidade mundial

### Segurança
- **DNSSEC de fábrica** — Validação criptográfica ativa por padrão com âncora raiz
- **RFC 7706 (Hyperlocal)** — Resolução de root servers em **0 ms** via zona raiz offline
- **Hardening SSH** — Porta SSH customizada + regras Firewalld agressivas pré-configuradas
- **Cyber Threat Intelligence (CTI)** — Motor assíncrono processa até 20.000 linhas de logs por execução
- **DGA Zero-Day Block** — Detecção e bloqueio de domínios gerados algoritmicamente

### Dashboard NOC
- **Globo 3D Holográfico (Three.js)** — Arcos geolocalizados em tempo real conectando clientes às ameaças
- **Gráficos Telemetria ICMP/TCP** — Latência, jitter e perda de pacotes em tempo real
- **AnaBlock** — Sincronização automática de bloqueios judiciais ANATEL
- **Cache Persistente** — Dump para disco no shutdown, restore na RAM no startup

---

## 📋 Requisitos de Hardware

| Porte | Clientes | CPU | RAM | Armazenamento |
|---|---|---|---|---|
| Pequeno | até 5.000 | 2–4 vCPUs | 4 GB | 30 GB SSD |
| Médio | 5k–20k | 4–8 Cores | 8–16 GB | 60 GB NVMe |
| Grande | 20k+ | 16+ Cores | 32+ GB | 120 GB NVMe |

---

## 🚀 Início Rápido

```bash
# 1. Baixe a ISO no site oficial
# https://sentineldns.net/download.html

# 2. Grave em mídia bootável (Linux)
dd if=sentinel-dns.iso of=/dev/sdX bs=4M status=progress

# 3. Boot no servidor → instalação automática em < 5 minutos

# 4. Acesse o painel
http://SEU_IP:3000
```

---

## 📁 Estrutura do Repositório

```
dns.sentineldns/
├── index.html          ← Landing Page principal
├── docs.html           ← Documentação técnica completa
├── download.html       ← Página de download da ISO
├── privacidade.html    ← Política de Privacidade (LGPD)
├── sitemap.xml         ← Sitemap para indexação
├── robots.txt          ← Diretivas para crawlers
└── banner-v2.webp      ← Banner oficial do projeto
```

---

## 🔗 Links

| Recurso | Link |
|---|---|
| 🌐 Site Oficial | [sentineldns.net](https://sentineldns.net) |
| 📥 Download ISO | [sentineldns.net/download.html](https://sentineldns.net/download.html) |
| 📖 Documentação | [sentineldns.net/docs.html](https://sentineldns.net/docs.html) |
| 📧 Suporte | [dnssentinel@sentineldns.net](mailto:dnssentinel@sentineldns.net) |

---

## 🌎 English Summary

**Sentinel DNS** is a self-deploying DNS Firewall Appliance based on Rocky Linux 9.7, purpose-built for Internet Service Providers (ISPs) and corporate networks.

Distributed as a remastered ISO with unattended Kickstart installation, it features:
- Unbound recursive resolver with automatic hardware auto-tuning
- Real-time Cyber Threat Intelligence (CTI) blocking
- DNSSEC, RFC 8767 (Serve-Expired) and RFC 7706 (Hyperlocal) out of the box
- 3D Holographic Globe NOC Dashboard powered by Three.js
- Judicial DNS blocking (ANATEL compliance) via AnaBlock module

👉 [Official Website](https://sentineldns.net) | [Download ISO](https://sentineldns.net/download.html)

---

<div align="center">

© 2026 Sentinel DNS — Advanced Engineering and DNS Intelligence

**[sentineldns.net](https://sentineldns.net)**

</div>
