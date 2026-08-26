// ==========================================
// SENTINEL DNS ADDITIONS & EXTENSIONS
// ==========================================

window.logDnsDebug = function(msg) {
    console.log('[DNS_DEBUG]', msg);
    const el = document.getElementById('dns-debug-text');
    if (el) {
        if (el.innerText === 'Aguardando inicialização...') {
            el.innerText = '';
        }
        el.innerText += '[' + new Date().toLocaleTimeString() + '] ' + msg + '\n';
    }
};

// ==========================================
// HOOK: chamar loadDnsProfiles ao abrir a aba app-blocking
// ==========================================
(function() {
    // Aguarda o app.js estar pronto e então estende o switchSecurityTab
    function hookSecurityTab() {
        var originalSwitch = window.switchSecurityTab;
        window.switchSecurityTab = function(tabId) {
            // Chama a função original primeiro
            if (typeof originalSwitch === 'function') {
                originalSwitch(tabId);
            }
            // Quando o usuário abre a aba de bloqueio de apps, carrega os perfis
            if (tabId === 'app-blocking') {
                loadDnsProfiles();
            }
            // Quando abre a aba de sincronismo HA
            if (tabId === 'ha-sync') {
                if (typeof window.loadHaSyncConfig === 'function') {
                    window.loadHaSyncConfig();
                }
            }
        };
    }

    // O app.js é carregado antes do app_addition.js, então window.switchSecurityTab já existe
    if (typeof window.switchSecurityTab === 'function') {
        hookSecurityTab();
    } else {
        // Caso improvável: aguarda o DOM estar pronto
        document.addEventListener('DOMContentLoaded', hookSecurityTab);
    }
})();

// ==========================================
// DNS FILTERS & PROFILES
// ==========================================

// currentDnsProfile is already declared in app.js
let cachedDnsFilters = null;

async function loadDnsProfiles() {
    logDnsDebug('loadDnsProfiles chamada.');
    try {
        logDnsDebug('Fazendo requisição GET para ' + API_BASE + '/system/dns-filters...');
        const res = await apiFetch(`${API_BASE}/system/dns-filters`);
        logDnsDebug('Resposta recebida. Status: ' + res.status);
        if (!res.ok) throw new Error('Falha ao carregar filtros, status HTTP ' + res.status);
        cachedDnsFilters = await res.json();
        logDnsDebug('Filtros JSON decodificados com sucesso.');
        
        const listEl = document.getElementById('dns-profiles-list');
        if (!listEl) {
            logDnsDebug('ERRO: Elemento #dns-profiles-list não foi encontrado no DOM!');
            return;
        }
        logDnsDebug('Elemento #dns-profiles-list encontrado.');
        
        listEl.innerHTML = '';
        const profiles = cachedDnsFilters.profiles || [];
        logDnsDebug('Total de perfis encontrados na resposta: ' + profiles.length);
        
        if (!profiles.find(p => p.id === currentDnsProfile)) {
            logDnsDebug('Perfil atual "' + currentDnsProfile + '" não encontrado na lista. Resetando para "default".');
            currentDnsProfile = 'default';
        }
 
        profiles.forEach(p => {
            logDnsDebug('Renderizando botão para o perfil: ' + p.name + ' (' + p.id + ')');
            const btn = document.createElement('button');
            btn.className = 'btn ' + (p.id === currentDnsProfile ? 'btn-primary' : '');
            if (p.id !== currentDnsProfile) {
                btn.style.background = 'rgba(255,255,255,0.05)';
                btn.style.border = '1px solid rgba(255,255,255,0.1)';
                btn.style.color = '#cbd5e1';
            } else {
                btn.style.fontWeight = '700';
            }
            btn.style.padding = '6px 14px';
            btn.style.borderRadius = '8px';
            btn.style.fontSize = '0.75rem';
            btn.style.cursor = 'pointer';
            btn.innerText = p.name;
            btn.onclick = () => selectDnsProfile(p.id);
            listEl.appendChild(btn);
        });
 
        const btnDelete = document.getElementById('btn-delete-profile');
        if (btnDelete) {
            btnDelete.style.display = currentDnsProfile === 'default' ? 'none' : 'flex';
        }
 
        const activeProfile = profiles.find(p => p.id === currentDnsProfile);
        if (activeProfile) {
            logDnsDebug('Renderizando detalhes para o perfil ativo: ' + currentDnsProfile);
            renderProfileDetails(activeProfile);
        }
        logDnsDebug('Carregamento de perfis finalizado com sucesso.');
    } catch (err) {
        logDnsDebug('EXCEÇÃO EM loadDnsProfiles: ' + err.message + '\n' + err.stack);
        console.error('Erro ao carregar perfis DNS', err);
    }
}

function selectDnsProfile(profileId) {
    currentDnsProfile = profileId;
    loadDnsProfiles();
}

function renderProfileDetails(profileData) {
    if (!profileData.filtersConfig) {
        profileData.filtersConfig = {};
    }
    const filters = profileData.filtersConfig;
    
    const elSafe = document.getElementById('filter-safesearch');
    if (elSafe) elSafe.checked = !!filters['safesearch'];
    
    const elBlock = document.getElementById('filter-blockpage');
    if (elBlock) elBlock.checked = !!filters['blockpage'];
    
    const elIps = document.getElementById('filter-target-ips');
    if (elIps) {
        elIps.value = Array.isArray(profileData.targetIps) ? profileData.targetIps.join('\n') : '';
    }

    const knownApps = ['adult', 'tiktok', 'youtube', 'facebook', 'instagram', 'netflix', 'roblox', 'tinder'];
    knownApps.forEach(app => {
        const sw = document.getElementById('block-service-' + app);
        if (sw) sw.checked = !!filters[app];
    });

    const customList = document.getElementById('custom-services-list-container');
    if (customList) {
        customList.innerHTML = '';
        const cServices = profileData.customServices || [];
        cServices.forEach(cs => {
            const div = document.createElement('div');
            div.className = 'service-item-row';
            div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15); padding:0.8rem 1rem; border-radius:10px; border:1px solid rgba(255,255,255,0.02); margin-top:0.6rem;';
            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
            
            const headerDiv = document.createElement('div');
            headerDiv.style.cssText = 'display:flex; align-items:center; gap:8px;';
            const nameSpan = document.createElement('span');
            nameSpan.style.cssText = 'font-weight:700; color:#f1f5f9; font-size:0.82rem;';
            nameSpan.textContent = cs.name;
            const badgeSpan = document.createElement('span');
            badgeSpan.style.cssText = 'font-size:0.65rem; color:#64748b; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px;';
            badgeSpan.textContent = 'CUSTOM';
            headerDiv.appendChild(nameSpan);
            headerDiv.appendChild(badgeSpan);
            
            const domainsSpan = document.createElement('span');
            domainsSpan.style.cssText = 'font-size:0.7rem; color:#64748b;';
            domainsSpan.textContent = (cs.domains || []).join(', ');
            
            infoDiv.appendChild(headerDiv);
            infoDiv.appendChild(domainsSpan);
            
            const actionsDiv = document.createElement('div');
            actionsDiv.style.cssText = 'display:flex; align-items:center; gap:10px;';
            
            const switchLabel = document.createElement('label');
            switchLabel.className = 'switch';
            const switchInput = document.createElement('input');
            switchInput.type = 'checkbox';
            switchInput.id = 'block-custom-' + cs.id;
            if (cs.enabled) switchInput.checked = true;
            const switchSlider = document.createElement('span');
            switchSlider.className = 'slider';
            switchLabel.appendChild(switchInput);
            switchLabel.appendChild(switchSlider);
            
            const btnDelete = document.createElement('button');
            btnDelete.title = 'Remover Serviço';
            btnDelete.style.cssText = 'background:none; border:none; color:#f87171; cursor:pointer; padding:4px;';
            btnDelete.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
            btnDelete.addEventListener('click', () => deleteCustomService(cs.id));
            
            actionsDiv.appendChild(switchLabel);
            actionsDiv.appendChild(btnDelete);
            
            div.appendChild(infoDiv);
            div.appendChild(actionsDiv);
            customList.appendChild(div);
        });
        if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    }
}

function openAddProfileModal() {
    const modal = document.getElementById('modal-add-dns-profile');
    if(modal) modal.style.display = 'flex';
}

function closeAddProfileModal() {
    const modal = document.getElementById('modal-add-dns-profile');
    if(modal) modal.style.display = 'none';
}

async function submitNewProfile() {
    const nameEl = document.getElementById('new-profile-name');
    if(!nameEl || !nameEl.value.trim()) return alert('Digite um nome para o perfil.');
    
    try {
        const res = await apiFetch(`${API_BASE}/system/dns-filters/custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', name: nameEl.value.trim() })
        });
        if(res.ok) {
            alert('Perfil criado com sucesso!');
            closeAddProfileModal();
            nameEl.value = '';
            loadDnsProfiles();
        } else {
            const data = await res.json().catch(() => ({}));
            alert('Erro ao criar perfil: ' + (data.error || 'Erro desconhecido'));
        }
    } catch (err) {
        alert('Erro de conexão ao criar perfil.');
    }
}

async function deleteActiveProfile() {
    if(currentDnsProfile === 'default' || !currentDnsProfile) return alert('Não é possível deletar o perfil padrão.');
    if(!confirm('Tem certeza que deseja deletar o perfil selecionado?')) return;
    
    try {
        const res = await apiFetch(`${API_BASE}/system/dns-filters/custom/` + encodeURIComponent(currentDnsProfile), {
            method: 'DELETE'
        });
        if(res.ok) {
            alert('Perfil removido.');
            currentDnsProfile = 'default';
            loadDnsProfiles();
        } else {
            const data = await res.json().catch(() => ({}));
            alert('Erro ao remover perfil: ' + (data.error || 'Erro desconhecido'));
        }
    } catch (err) {
        alert('Erro de conexão ao remover perfil.');
    }
}

async function saveDnsFilters() {
    if (!cachedDnsFilters) return;

    const activeProfile = cachedDnsFilters.profiles.find(p => p.id === currentDnsProfile);
    if (!activeProfile) return;

    if (!activeProfile.filtersConfig) {
        activeProfile.filtersConfig = {};
    }

    const elSafe = document.getElementById('filter-safesearch');
    if (elSafe) activeProfile.filtersConfig['safesearch'] = elSafe.checked;
    
    const elBlock = document.getElementById('filter-blockpage');
    if (elBlock) {
        activeProfile.filtersConfig['blockpage'] = elBlock.checked;
        activeProfile.blockPage = elBlock.checked; // sincroniza com o campo lido pelo backend
    }
    
    const knownApps = ['adult', 'tiktok', 'youtube', 'facebook', 'instagram', 'netflix', 'roblox', 'tinder'];
    knownApps.forEach(app => {
        const sw = document.getElementById('block-service-' + app);
        if (sw) activeProfile.filtersConfig[app] = sw.checked;
    });

    const ipsVal = document.getElementById('filter-target-ips')?.value;
    if (ipsVal !== undefined) {
        activeProfile.targetIps = ipsVal.split('\n').map(x => x.trim()).filter(Boolean);
    }

    if (activeProfile.customServices) {
        activeProfile.customServices.forEach(cs => {
            const sw = document.getElementById('block-custom-' + cs.id);
            if (sw) cs.enabled = sw.checked;
        });
    }

    try {
        const res = await apiFetch(`${API_BASE}/system/dns-filters`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                safeSearch: cachedDnsFilters.safeSearch, 
                profiles: cachedDnsFilters.profiles 
            })
        });
        if(res.ok) {
            alert('Configurações de filtros salvas com sucesso!');
            loadDnsProfiles();
        } else {
            const data = await res.json();
            alert('Erro ao salvar filtros: ' + (data.error || ''));
        }
    } catch (err) {
        alert('Erro de rede ao salvar filtros.');
    }
}

// ==========================================
// CUSTOM DNS SERVICES
// ==========================================

function openAddCustomServiceModal() {
    const modal = document.getElementById('modal-add-custom-service');
    if(modal) modal.style.display = 'flex';
}

function closeCustomServiceModal() {
    const modal = document.getElementById('modal-add-custom-service');
    if(modal) modal.style.display = 'none';
}

async function submitCustomService() {
    const serviceNameEl = document.getElementById('custom-service-name');
    const serviceDomainEl = document.getElementById('custom-service-domains');
    const serviceName = serviceNameEl?.value;
    const serviceDomainStr = serviceDomainEl?.value;
    
    if(!serviceName || !serviceDomainStr) return alert('Preencha os campos obrigatórios do serviço.');
    
    const domains = serviceDomainStr.split(/\r?\n|,/).map(d => d.trim()).filter(Boolean);
    
    try {
        const res = await apiFetch(`${API_BASE}/system/dns-filters/custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: serviceName, domains: domains, profileId: currentDnsProfile })
        });
        if(res.ok) {
            alert('Serviço customizado criado!');
            if (serviceNameEl) serviceNameEl.value = '';
            if (serviceDomainEl) serviceDomainEl.value = '';
            closeCustomServiceModal();
            loadDnsProfiles();
        } else {
            alert('Erro ao criar serviço customizado.');
        }
    } catch(err) {
        alert('Erro de conexão.');
    }
}

async function deleteCustomService(serviceId) {
    if(!confirm('Tem certeza que deseja remover este serviço customizado?')) return;
    try {
        const res = await apiFetch(`${API_BASE}/system/dns-filters/custom/${serviceId}?profileId=${encodeURIComponent(currentDnsProfile)}`, {
            method: 'DELETE'
        });
        if(res.ok) {
            alert('Serviço removido.');
            loadDnsProfiles();
        } else {
            alert('Erro ao remover serviço.');
        }
    } catch(err) {
        alert('Erro de conexão ao remover serviço.');
    }
}

async function addCustomDnsRecord() {
    const domainEl = document.getElementById('custom-dns-domain');
    const ipEl = document.getElementById('custom-dns-ip');
    
    if(!domainEl || !domainEl.value) return alert('Domínio é obrigatório.');
    if(!ipEl || !ipEl.value) return alert('IP é obrigatório.');
    
    try {
        const res = await apiFetch(`${API_BASE}/system/custom-dns`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create_record', domain: domainEl.value.trim(), ip: ipEl.value.trim() })
        });
        if(res.ok) {
            alert('Registro DNS criado com sucesso!');
            domainEl.value = '';
            ipEl.value = '';
            if(typeof fetchSystem === 'function') fetchSystem(); else location.reload();
        } else {
            alert('Erro ao criar registro DNS.');
        }
    } catch(err) {
        alert('Erro de conexão.');
    }
}

// ==========================================
// SECURITY: GRAVITY, ADLISTS, LOCAL RULES
// ==========================================

async function syncGravity() {
    const btn = document.getElementById('btn-sync-gravity');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = 'Sincronizando... <i class="lucide-loader" style="animation: spin 1s linear infinite;"></i>';
    }
    
    try {
        const res = await apiFetch(`${API_BASE}/security/sync`, { method: 'POST' });
        const data = await res.json();
        
        if(res.ok) {
            alert('Sincronização do banco de dados (Gravity) finalizada com sucesso!\n' + (data.message || ''));
        } else {
            alert('Falha na sincronização: ' + (data.error || 'Erro desconhecido'));
        }
    } catch(err) {
        alert('Erro de rede ao tentar sincronizar o banco de ameaças.');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="lucide-refresh-cw"></i> Sincronizar Agora';
        }
    }
}

// Funções de adlist e regra local duplicadas foram removidas (são tratadas no app.js)


// ==========================================
// HIGH AVAILABILITY (HA SYNC)
// ==========================================

async function generateHaSyncToken() {
    const btn = document.getElementById('btn-generate-ha-token');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="lucide-loader" style="animation: spin 1s linear infinite;"></i> Gerando...';
    }
    
    try {
        const token = Array.from({length: 32}, () => Math.random().toString(36)[2] || '0').join('').substring(0, 32);
        const tokenInput = document.getElementById('ha-sync-token');
        if(tokenInput) {
            tokenInput.value = token;
            tokenInput.style.borderColor = '#10b981';
            setTimeout(() => { tokenInput.style.borderColor = 'var(--glass-border)'; }, 2000);
        }
    } catch(err) {
        alert('Erro ao gerar token.');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="lucide-key"></i> Gerar Novo Token';
        }
    }
}
window.generateHaSyncToken = generateHaSyncToken;

// Ajustar visibilidade dos inputs dependendo do tipo do nó selecionado
function adjustHaSyncUI() {
    const roleEl = document.getElementById('ha-sync-role');
    const peerIpGroup = document.getElementById('ha-peer-ip-group');
    const tokenGroup = document.getElementById('ha-token-group');
    const btnGenerateToken = document.getElementById('btn-generate-ha-token');
    
    if (!roleEl) return;
    
    const role = roleEl.value;
    
    if (role === 'master') {
        if (peerIpGroup) peerIpGroup.style.display = 'block';
        if (tokenGroup) tokenGroup.style.display = 'block';
        if (btnGenerateToken) btnGenerateToken.style.display = 'none';
    } else if (role === 'replica') {
        if (peerIpGroup) peerIpGroup.style.display = 'none';
        if (tokenGroup) tokenGroup.style.display = 'block';
        if (btnGenerateToken) btnGenerateToken.style.display = 'block';
    } else {
        if (peerIpGroup) peerIpGroup.style.display = 'none';
        if (tokenGroup) tokenGroup.style.display = 'none';
    }
}
window.adjustHaSyncUI = adjustHaSyncUI;

// Carregar configurações do Backend
async function loadHaSyncConfig() {
    try {
        const res = await apiFetch(`${API_BASE}/system/ha-sync`);
        if (res.ok) {
            const data = await res.json();
            
            const roleEl = document.getElementById('ha-sync-role');
            const peerIpEl = document.getElementById('ha-sync-peer-ip');
            const tokenEl = document.getElementById('ha-sync-token');
            const enabledEl = document.getElementById('ha-sync-enabled');
            const statusEl = document.getElementById('ha-cluster-status');
            const lastSyncEl = document.getElementById('ha-last-sync');
            
            if (roleEl) roleEl.value = data.role || 'none';
            if (peerIpEl) peerIpEl.value = data.peerIp || '';
            if (tokenEl) tokenEl.value = data.token || '';
            if (enabledEl) enabledEl.checked = !!data.syncEnabled;
            
            if (statusEl) {
                statusEl.innerText = data.role === 'master' ? 'Master Ativo' : 
                                    (data.role === 'replica' ? 'Replica Ativa' : 'Aguardando Configuração');
                                    
                if (data.role === 'master') {
                    statusEl.style.background = 'rgba(16,185,129,0.1)';
                    statusEl.style.color = '#10b981';
                    statusEl.style.borderColor = 'rgba(16,185,129,0.2)';
                } else if (data.role === 'replica') {
                    statusEl.style.background = 'rgba(56,189,248,0.1)';
                    statusEl.style.color = '#38bdf8';
                    statusEl.style.borderColor = 'rgba(56,189,248,0.2)';
                } else {
                    statusEl.style.background = 'rgba(100,116,139,0.1)';
                    statusEl.style.color = '#94a3b8';
                    statusEl.style.borderColor = 'rgba(100,116,139,0.2)';
                }
            }
            
            if (lastSyncEl) {
                lastSyncEl.innerText = data.lastSync ? new Date(data.lastSync).toLocaleString('pt-BR') : 'Nunca';
            }
            
            adjustHaSyncUI();
        }
    } catch (err) {
        console.error('Erro ao carregar HA Config:', err);
    }
}
window.loadHaSyncConfig = loadHaSyncConfig;

async function saveHaSyncConfig() {
    const roleEl = document.getElementById('ha-sync-role');
    const peerIpEl = document.getElementById('ha-sync-peer-ip');
    const tokenEl = document.getElementById('ha-sync-token');
    const enabledEl = document.getElementById('ha-sync-enabled');
    
    if(!roleEl || !tokenEl) return;
    
    const configData = {
        role: roleEl.value,
        peerIp: peerIpEl ? peerIpEl.value.trim() : '',
        token: tokenEl.value.trim(),
        syncEnabled: enabledEl ? enabledEl.checked : false
    };
    
    try {
        const res = await apiFetch(`${API_BASE}/system/ha-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        
        if(res.ok) {
            alert('Configuração HA salva com sucesso!');
            loadHaSyncConfig();
        } else {
            const data = await res.json();
            alert('Erro ao salvar HA: ' + (data.error || 'Desconhecido'));
        }
    } catch(err) {
        alert('Erro de conexão ao salvar HA Sync.');
    }
}
window.saveHaSyncConfig = saveHaSyncConfig;

async function forceHaSyncNow() {
    const btn = document.getElementById('btn-force-sync');
    if(btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="lucide-loader" style="animation: spin 1s linear infinite;"></i> Sincronizando...';
    }
    
    try {
        const res = await apiFetch(`${API_BASE}/system/ha-sync/force`, { method: 'POST' });
        const data = await res.json();
        
        if(res.ok) {
            alert('Sincronização manual iniciada/concluída com sucesso!\n' + (data.message || ''));
            loadHaSyncConfig();
        } else {
            alert('Falha ao sincronizar: ' + (data.error || 'Verifique as configurações.'));
        }
    } catch(err) {
        alert('Erro de rede ao tentar forçar sincronização HA.');
    } finally {
        if(btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="lucide-refresh-cw"></i> Sincronizar Agora';
        }
    }
}
window.forceHaSyncNow = forceHaSyncNow;

// Inicialização automática caso já esteja na aba
document.addEventListener('DOMContentLoaded', () => {
    const roleEl = document.getElementById('ha-sync-role');
    if (roleEl) {
        adjustHaSyncUI();
    }
});
