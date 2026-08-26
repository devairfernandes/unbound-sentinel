#!/bin/bash
# ==============================================================================
# Sentinel DNS - AnaBlock (ANATEL Compliance Sync)
# ==============================================================================
# Este script baixa, formata, valida e aplica a lista de bloqueios judiciais 
# da ANATEL de forma 100% segura, com sistema de rollback integrado.
# ==============================================================================

# Configurações
LOG_FILE="/var/log/anablock.log"
UNBOUND_CONF_DIR="/etc/unbound/sentinel"
RPZ_FILE="$UNBOUND_CONF_DIR/anablock.zone"
BACKUP_FILE="$UNBOUND_CONF_DIR/anablock.zone.bak"
# URL fictícia para a API/Feed da ANATEL (substitua pela real de produção)
FEED_URL="https://api.anatel.gov.br/bloqueios/feed/v1" 

# Cria arquivo de log se não existir
touch "$LOG_FILE"
chmod 644 "$LOG_FILE"

# Função de Logging Estruturado
log() {
    local level="$1"
    shift
    local message="$@"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log "INFO" "Iniciando sincronizacao do modulo AnaBlock..."

# 1. Download do feed (simulado via curl)
TEMP_FEED=$(mktemp)
curl -s -f "$FEED_URL" -o "$TEMP_FEED"
if [ $? -ne 0 ]; then
    log "ERROR" "Falha ao fazer download do feed da ANATEL. Servidor inacessivel?"
    rm -f "$TEMP_FEED"
    exit 1
fi

log "INFO" "Download do feed concluido. Processando dominios..."

# 2. Processamento e Validação de Regex
# Gera arquivo RPZ temporário com formatação correta e apenas domínios válidos
TEMP_RPZ=$(mktemp)
DOMAINS_LOADED=0
DOMAINS_FAILED=0

# Cabeçalho da Zona RPZ
echo "\$TTL 300" > "$TEMP_RPZ"
echo "@ IN SOA localhost. root.localhost. ( 1 3600 600 86400 300 )" >> "$TEMP_RPZ"
echo "  IN NS localhost." >> "$TEMP_RPZ"

while read -r domain; do
    # Remove espaços em branco
    domain=$(echo "$domain" | tr -d '[:space:]')
    
    # Valida formato de domínio usando REGEX básica (evita quebra de sintaxe no unbound)
    if [[ "$domain" =~ ^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$ ]]; then
        # Formato sinkhole RPZ (bloqueio nxdomain)
        echo "$domain CNAME ." >> "$TEMP_RPZ"
        ((DOMAINS_LOADED++))
    else
        if [ -n "$domain" ]; then
            log "WARN" "Dominio ignorado por formato invalido: $domain"
            ((DOMAINS_FAILED++))
        fi
    fi
done < "$TEMP_FEED"

rm -f "$TEMP_FEED"

if [ "$DOMAINS_LOADED" -eq 0 ]; then
    log "ERROR" "Nenhum dominio valido carregado. Abortando atualizacao para seguranca."
    rm -f "$TEMP_RPZ"
    exit 1
fi

log "INFO" "Processamento concluido. Preparando para injecao no Unbound..."

# 3. Backup e Teste (Rollback)
if [ -f "$RPZ_FILE" ]; then
    cp "$RPZ_FILE" "$BACKUP_FILE"
fi

# Move o novo arquivo
mv "$TEMP_RPZ" "$RPZ_FILE"
chown unbound:unbound "$RPZ_FILE"

# Testa a sintaxe geral do Unbound
log "INFO" "Validando sintaxe global via unbound-checkconf..."
unbound-checkconf > /dev/null 2>&1
CHECK_STATUS=$?

if [ $CHECK_STATUS -ne 0 ]; then
    log "ERROR" "Falha na validacao de sintaxe do Unbound! Iniciando Rollback automatico..."
    if [ -f "$BACKUP_FILE" ]; then
        mv "$BACKUP_FILE" "$RPZ_FILE"
        log "INFO" "Rollback concluido: zona anterior restaurada em < 5 segundos."
    else
        # Se não houver backup (primeira rodada), remove a zona quebrada
        rm -f "$RPZ_FILE"
        log "WARN" "Rollback: nenhuma zona anterior encontrada, arquivo corrompido removido."
    fi
    # Restart do unbound não é acionado, serviço se mantém em pé
    exit 1
fi

# 4. Reload Seguro
log "INFO" "Sintaxe validada. Recarregando servico DNS (Hot-reload)..."
systemctl reload unbound

# Se o systemd falhar no reload (erro de serviço), avisa
if [ $? -ne 0 ]; then
    log "ERROR" "Falha no reload do Systemd para o servico Unbound."
    # Pode tentar um rollback manual do serviço, se suportado pelo SO
    exit 1
fi

# Limpa o backup após o sucesso
rm -f "$BACKUP_FILE"

# 5. Métrica de Sucesso Final
LAST_SYNC=$(date +"%Y-%m-%d %H:%M:%S")
log "INFO" "--- SINCRONIZACAO CONCLUIDA COM SUCESSO ---"
log "INFO" "Dominios carregados: $DOMAINS_LOADED | Falhas: $DOMAINS_FAILED | Ultima atualizacao: $LAST_SYNC"

echo ""
echo "✅ Atualização AnaBlock finalizada!"
echo "Domínios carregados: $DOMAINS_LOADED"
echo "Falhas/Ignorados: $DOMAINS_FAILED"
echo "Última atualização: $LAST_SYNC"
echo "Consulte /var/log/anablock.log para mais detalhes."

exit 0
