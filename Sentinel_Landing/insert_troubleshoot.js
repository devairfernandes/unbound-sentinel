const fs = require('fs');

const f = 'docs.html';
if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');

    const htmlToInsert = `
        <h2><i data-lucide="alert-triangle"></i> <span data-i18n="d.h_ts">Troubleshooting & Avançado</span></h2>

        <h3><span data-i18n="d.ts_1">Reset de Senha do Dashboard</span></h3>
        <p data-i18n="d.ts_2">Caso você perca o acesso administrador, você pode resetar o banco de usuários para o padrão (admin / admin123) excluindo o arquivo via SSH:</p>
        <div class="code-block" style="background: #0f172a; padding: 1rem; border-radius: 8px; border: 1px solid #334155; margin-bottom: 1.5rem; overflow-x: auto;">
            <pre style="margin: 0; color: #38bdf8; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap;"><code>rm -f /opt/unbound-dashboard/users.json
systemctl restart unbound-dashboard</code></pre>
        </div>

        <h3><span data-i18n="d.ts_3">Acompanhamento de Logs do Sistema</span></h3>
        <p data-i18n="d.ts_4">Para verificar eventuais erros na aplicação ou analisar tráfego DNS em tempo real, utilize o log do sistema (journald):</p>
        <div class="code-block" style="background: #0f172a; padding: 1rem; border-radius: 8px; border: 1px solid #334155; margin-bottom: 1.5rem; overflow-x: auto;">
            <pre style="margin: 0; color: #38bdf8; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap;"><code># Ver logs do Dashboard (Node.js) em tempo real:
journalctl -u unbound-dashboard -f

# Ver logs do motor DNS (Unbound) em tempo real:
journalctl -u unbound -f</code></pre>
        </div>

        <h3><span data-i18n="d.ts_5">Reconfiguração de Rede (Assistente Pós-Instalação)</span></h3>
        <p data-i18n="d.ts_6">Se você precisar alterar o IP de estático para DHCP (ou vice-versa) depois da instalação, basta remover a trava de execução e chamar o assistente novamente:</p>
        <div class="code-block" style="background: #0f172a; padding: 1rem; border-radius: 8px; border: 1px solid #334155; margin-bottom: 1.5rem; overflow-x: auto;">
            <pre style="margin: 0; color: #38bdf8; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap;"><code>rm -f /root/.firstboot_done && /root/firstboot-network.sh</code></pre>
        </div>
`;
    // Insert HTML
    content = content.replace('<h2><i data-lucide="crown"></i> <span data-i18n="d.h9">Comparativo de Planos</span></h2>', htmlToInsert + '\n        <h2><i data-lucide="crown"></i> <span data-i18n="d.h9">Comparativo de Planos</span></h2>');

    // Insert Translations PT
    const ptTrans = `        "d.m_9": "<strong>Acesso SSH:</strong> A porta padrão foi alterada para <code>51386</code> como proteção contra robôs de força bruta.",
        "d.h_ts": "Troubleshooting & Avançado",
        "d.ts_1": "Reset de Senha do Dashboard",
        "d.ts_2": "Caso você perca o acesso administrador, você pode resetar o banco de usuários para o padrão (admin / admin123) excluindo o arquivo via SSH:",
        "d.ts_3": "Acompanhamento de Logs do Sistema",
        "d.ts_4": "Para verificar eventuais erros na aplicação ou analisar tráfego DNS em tempo real, utilize o log do sistema (journald):",
        "d.ts_5": "Reconfiguração de Rede (Assistente Pós-Instalação)",
        "d.ts_6": "Se você precisar alterar o IP de estático para DHCP (ou vice-versa) depois da instalação, basta remover a trava de execução e chamar o assistente novamente:"`;
    content = content.replace('"d.m_9": "<strong>Acesso SSH:</strong> A porta padrão foi alterada para <code>51386</code> como proteção contra robôs de força bruta."', ptTrans);

    // EN Trans
    const enTrans = `        "d.m_9": "<strong>SSH Access:</strong> The default port was changed to <code>51386</code> as protection against brute force bots.",
        "d.h_ts": "Troubleshooting & Advanced",
        "d.ts_1": "Dashboard Password Reset",
        "d.ts_2": "If you lose admin access, you can reset the user database to the default (admin / admin123) by deleting the file via SSH:",
        "d.ts_3": "System Log Monitoring",
        "d.ts_4": "To check for application errors or analyze real-time DNS traffic, use the system log (journald):",
        "d.ts_5": "Network Reconfiguration (Post-Install Wizard)",
        "d.ts_6": "If you need to change the IP from static to DHCP (or vice versa) after installation, simply remove the execution lock and call the wizard again:"`;
    content = content.replace('"d.m_9": "<strong>SSH Access:</strong> The default port was changed to <code>51386</code> as protection against brute force bots."', enTrans);

    // ES Trans
    const esTrans = `        "d.m_9": "<strong>Acceso SSH:</strong> El puerto por defecto se ha cambiado a <code>51386</code> como protección contra bots de fuerza bruta.",
        "d.h_ts": "Solución de Problemas y Avanzado",
        "d.ts_1": "Restablecimiento de Contraseña del Dashboard",
        "d.ts_2": "Si pierde el acceso de administrador, puede restablecer la base de datos de usuarios a la predeterminada (admin / admin123) eliminando el archivo vía SSH:",
        "d.ts_3": "Monitoreo de Registros del Sistema",
        "d.ts_4": "Para comprobar errores de la aplicación o analizar tráfico DNS en tiempo real, utilice el registro del sistema (journald):",
        "d.ts_5": "Reconfiguración de Red (Asistente Post-Instalación)",
        "d.ts_6": "Si necesita cambiar la IP de estática a DHCP (o viceversa) después de la instalación, simplemente elimine el bloqueo de ejecución y vuelva a llamar al asistente:"`;
    content = content.replace('"d.m_9": "<strong>Acceso SSH:</strong> El puerto por defecto se ha cambiado a <code>51386</code> como protección contra bots de fuerza bruta."', esTrans);

    fs.writeFileSync(f, content, 'utf8');
}
