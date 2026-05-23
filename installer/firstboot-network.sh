#!/bin/bash

# Unbound Sentinel - Interactive Network Wizard
# Runs on first root login to configure static IP or DHCP

LOCK_FILE="/root/.firstboot_done"
if [ -f "$LOCK_FILE" ]; then
    exit 0
fi

# Colors
GREEN='\e[1;32m'
CYAN='\e[1;36m'
YELLOW='\e[1;33m'
RED='\e[1;31m'
NC='\e[0m' # No Color
BOLD='\e[1m'

# Clear screen
clear

echo -e "${CYAN}=====================================================================${NC}"
echo -e "  ${BOLD}🛡️  UNBOUND SENTINEL - ASSISTENTE DE CONFIGURAÇÃO DE REDE${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e " Bem-vindo ao Unbound Sentinel DNS Appliance!"
echo -e " Para garantir estabilidade como servidor DNS, recomendamos configurar"
echo -e " um ${GREEN}IP Estático${NC} para este servidor."
echo -e "${CYAN}--------------------------------------------------------------------=${NC}"
echo -e " [1] ${GREEN}Configurar IP Estático${NC} (Altamente Recomendado)"
echo -e " [2] Manter IP Dinâmico via DHCP"
echo -e " [3] Sair e configurar mais tarde"
echo -e "${CYAN}=====================================================================${NC}"

read -p " Escolha uma opção [1-3]: " OPTION

case "$OPTION" in
    1)
        echo ""
        echo -e " ${BOLD}=== Configurando IP Estático ===${NC}"
        
        # Detect connection name and active interface
        # In Rocky 9/RHEL 9 we want to get the connection name managed by NetworkManager
        CONN_NAME=$(nmcli -g NAME connection show --active | head -n1)
        if [ -z "$CONN_NAME" ]; then
            # Fallback to getting any connection name
            CONN_NAME=$(nmcli -g NAME connection show | head -n1)
        fi
        
        if [ -z "$CONN_NAME" ]; then
            echo -e " ${RED}Erro: Nenhuma interface de rede ativa foi detectada pelo NetworkManager.${NC}"
            read -p " Pressione ENTER para sair..."
            exit 1
        fi
        
        echo -e " Interface ativa detectada: ${CYAN}$CONN_NAME${NC}"
        echo ""
        
        # 1. IP Input & Validation
        while true; do
            read -p " Digite o IP Estático desejado (ex: 192.168.1.100): " IP_ADDR
            if [[ "$IP_ADDR" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                break
            else
                echo -e " ${RED}Formato de IP inválido. Tente novamente.${NC}"
            fi
        done
        
        # 2. Netmask Input
        while true; do
            read -p " Digite a Máscara de Rede CIDR (ex: 24 para 255.255.255.0): " NETMASK
            if [[ "$NETMASK" =~ ^[0-9]+$ ]] && [ "$NETMASK" -ge 1 ] && [ "$NETMASK" -le 32 ]; then
                break
            else
                echo -e " ${RED}Por favor, digite apenas o número CIDR (ex: 8, 16, 24, 30).${NC}"
            fi
        done
        
        # 3. Gateway Input
        while true; do
            read -p " Digite o IP do Gateway/Roteador (ex: 192.168.1.1): " GATEWAY
            if [[ "$GATEWAY" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                break
            else
                echo -e " ${RED}Formato de Gateway inválido. Tente novamente.${NC}"
            fi
        done
        
        echo ""
        echo -e " Aplicando configurações..."
        echo -e " IP: ${CYAN}$IP_ADDR/$NETMASK${NC}"
        echo -e " Gateway: ${CYAN}$GATEWAY${NC}"
        echo -e " DNS Local: ${CYAN}127.0.0.1${NC}"
        echo ""
        
        # Disable DHCP and configure static IP in NetworkManager
        nmcli connection modify "$CONN_NAME" \
            ipv4.addresses "$IP_ADDR/$NETMASK" \
            ipv4.gateway "$GATEWAY" \
            ipv4.dns "127.0.0.1" \
            ipv4.method manual \
            2>/dev/null
            
        if [ $? -eq 0 ]; then
            # Restart connection to apply
            echo -e " Reiniciando interface de rede..."
            nmcli connection down "$CONN_NAME" >/dev/null 2>&1
            nmcli connection up "$CONN_NAME" >/dev/null 2>&1
            
            # Verify and update MOTD
            REAL_IP=$(ip -o -4 addr show dev $(nmcli -g DEVICE connection show --active | head -n1) | awk '{print $4}' | cut -d/ -f1 | head -n1)
            if [ -z "$REAL_IP" ]; then
                REAL_IP="$IP_ADDR"
            fi
            
            # Re-generate MOTD with the real static IP
            cat << 'EOF' > /tmp/motd_temp
\033[1;36m╔══════════════════════════════════════════════════════════════════════╗\033[0m
║  \033[1;32m_    _ _   _ ____   ____  _    _ _   _ _____  \033[0m                        ║
║ \033[1;32m| |  | | \\ | |  _ \\ / __ \\| |  | | \\ | |  __ \\ \033[0m                        ║
║ \033[1;32m| |  | |  \\| | |_) | |  | | |  | |  \\| | |  | |\033[0m                        ║
║ \033[1;32m| |  | | . \` |  _ <| |  | | |  | | . \` | |  | |\033[0m                        ║
║ \033[1;32m| |__| | |\\  | |_) | |__| | |__| | |\\  | |__| |\033[0m                        ║
║ \033[1;32m \\____/|_| \\_|____/ \\____/ \\____/|_| \\_|_____/ \033[0m                        ║
║  \033[1;36m _____ ______ _   _ _______ _____ _   _ ______ _      \033[0m               ║
║ \033[1;36m  / ____|  ____| \\ | |__   __|_   _| \\ | |  ____| |     \033[0m               ║
║ \033[1;36m | (___ | |__  |  \\| |  | |    | | |  \\| | |__  | |     \033[0m               ║
║ \033[1;36m  \\___ \\|  __| | . \` |  | |    | | | . \` |  __| | |     \033[0m               ║
║ \033[1;36m  ____) | |____| |\\  |  | |   _| |_| |\\  | |____| |____ \033[0m               ║
║ \033[1;36m |_____/|______|_| \\_|  |_|  |_____|_| \\_|______|______|\033[0m               ║
\033[1;36m╠══════════════════════════════════════════════════════════════════════╣\033[0m
║\033[1;37m                       CONFIGURAÇÃO DO APPLIANCE                        \033[0m║
\033[1;36m╠══════════════════════════════════════════════════════════════════════╣\033[0m
║                                                                      ║
║  \033[1;33m» Painel Web:\033[0m       \033[1;32mhttp://IP_PLACEHOLDER:3300\033[0m                        ║
║  \033[1;33m» Login Padrão:\003[0m     \033[1;37madmin / admin123\033[0m                                ║
║                                                                      ║
║  \033[1;33m» Acesso SSH:\003[0m       \033[1;37mssh root@IP_PLACEHOLDER -p 51386\033[0m                  ║
║  \033[1;33m» Porta Unbound:\003[0m    \033[1;32m53 (DNS Otimizado & Anti-DDoS)\033[0m                  ║
║  \033[1;33m» Validar DNSSEC:\003[0m   \033[1;32mATIVO (100% Criptográfico)\033[0m                      ║
║                                                                      ║
║  \033[1;33m» Arquivo Env:\003[0m      \033[1;37m/opt/unbound-dashboard/.env\033[0m                      ║
║  \033[1;33m» Status Dashboard:\003[0m \033[1;37msystemctl status unbound-dashboard\033[0m             ║
║                                                                      ║
\033[1;36m╚══════════════════════════════════════════════════════════════════════╝\033[0m
EOF
            sed -i "s/IP_PLACEHOLDER/$REAL_IP/g" /tmp/motd_temp
            echo -e "$(cat /tmp/motd_temp)" > /etc/motd
            cp /etc/motd /etc/issue
            rm -f /tmp/motd_temp
            
            echo -e " ${GREEN}✔ Configuração concluída com sucesso!${NC}"
            echo -e " O painel Unbound Sentinel já está ativo em: ${GREEN}http://$REAL_IP:3300${NC}"
            echo ""
            touch "$LOCK_FILE"
        else
            echo -e " ${RED}❌ Falha ao aplicar as configurações no NetworkManager.${NC}"
            echo " Verifique as conexões com 'nmcli connection show'."
        fi
        
        read -p " Pressione [ENTER] para continuar para o terminal."
        ;;
    2)
        echo ""
        echo -e " Mantendo IP Dinâmico via DHCP..."
        
        # Auto-detect real IP address assigned by DHCP
        REAL_IP=$(ip -o -4 addr show dev $(nmcli -g DEVICE connection show --active | head -n1) | awk '{print $4}' | cut -d/ -f1 | head -n1)
        if [ -n "$REAL_IP" ]; then
            cat << 'EOF' > /tmp/motd_temp
\033[1;36m╔══════════════════════════════════════════════════════════════════════╗\033[0m
║  \033[1;32m_    _ _   _ ____   ____  _    _ _   _ _____  \033[0m                        ║
║ \033[1;32m| |  | | \\ | |  _ \\ / __ \\| |  | | \\ | |  __ \\ \033[0m                        ║
║ \033[1;32m| |  | |  \\| | |_) | |  | | |  | |  \\| | |  | |\033[0m                        ║
║ \033[1;32m| |  | | . \` |  _ <| |  | | |  | | . \` | |  | |\033[0m                        ║
║ \033[1;32m| |__| | |\\  | |_) | |__| | |__| | |\\  | |__| |\033[0m                        ║
║ \033[1;32m \\____/|_| \\_|____/ \\____/ \\____/|_| \\_|_____/ \033[0m                        ║
║  \033[1;36m _____ ______ _   _ _______ _____ _   _ ______ _      \033[0m               ║
║ \033[1;36m  / ____|  ____| \\ | |__   __|_   _| \\ | |  ____| |     \033[0m               ║
║ \033[1;36m | (___ | |__  |  \\| |  | |    | | |  \\| | |__  | |     \033[0m               ║
║ \033[1;36m  \\___ \\|  __| | . \` |  | |    | | | . \` |  __| | |     \033[0m               ║
║ \033[1;36m  ____) | |____| |\\  |  | |   _| |_| |\\  | |____| |____ \033[0m               ║
║ \033[1;36m |_____/|______|_| \\_|  |_|  |_____|_| \\_|______|______|\033[0m               ║
\033[1;36m╠══════════════════════════════════════════════════════════════════════╣\033[0m
║\033[1;37m                       CONFIGURAÇÃO DO APPLIANCE                        \033[0m║
\033[1;36m╠══════════════════════════════════════════════════════════════════════╣\033[0m
║                                                                      ║
║  \033[1;33m» Painel Web:\033[0m       \033[1;32mhttp://IP_PLACEHOLDER:3300\033[0m                        ║
║  \033[1;33m» Login Padrão:\003[0m     \033[1;37madmin / admin123\033[0m                                ║
║                                                                      ║
║  \033[1;33m» Acesso SSH:\003[0m       \033[1;37mssh root@IP_PLACEHOLDER -p 51386\033[0m                  ║
║  \033[1;33m» Porta Unbound:\003[0m    \033[1;32m53 (DNS Otimizado & Anti-DDoS)\033[0m                  ║
║  \033[1;33m» Validar DNSSEC:\003[0m   \033[1;32mATIVO (100% Criptográfico)\033[0m                      ║
║                                                                      ║
║  \033[1;33m» Arquivo Env:\003[0m      \033[1;37m/opt/unbound-dashboard/.env\033[0m                      ║
║  \033[1;33m» Status Dashboard:\003[0m \033[1;37msystemctl status unbound-dashboard\033[0m             ║
║                                                                      ║
\033[1;36m╚══════════════════════════════════════════════════════════════════════╝\033[0m
EOF
            sed -i "s/IP_PLACEHOLDER/$REAL_IP/g" /tmp/motd_temp
            echo -e "$(cat /tmp/motd_temp)" > /etc/motd
            cp /etc/motd /etc/issue
            rm -f /tmp/motd_temp
        fi
        
        echo -e " ${GREEN}✔ DHCP Mantido.${NC}"
        touch "$LOCK_FILE"
        sleep 1
        ;;
    3)
        echo ""
        echo -e " ${YELLOW}Configuração adiada. O assistente aparecerá no próximo login.${NC}"
        sleep 1
        ;;
    *)
        echo ""
        echo -e " ${RED}Opção inválida.${NC}"
        sleep 1
        ;;
esac
