const fs = require('fs');

const f = 'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/lang.js';

if (fs.existsSync(f)) {
    let lang = fs.readFileSync(f, 'utf8');

    // The keys to insert for PT
    const ptTrans = `,\n        "d.h_ts": "Troubleshooting & Avançado",
        "d.ts_1": "Reset de Senha do Dashboard",
        "d.ts_2": "Caso você perca o acesso administrador, você pode resetar o banco de usuários para o padrão (admin / admin123) excluindo o arquivo via SSH:",
        "d.ts_3": "Acompanhamento de Logs do Sistema",
        "d.ts_4": "Para verificar eventuais erros na aplicação ou analisar tráfego DNS em tempo real, utilize o log do sistema (journald):",
        "d.ts_5": "Reconfiguração de Rede (Assistente Pós-Instalação)",
        "d.ts_6": "Se você precisar alterar o IP de estático para DHCP (ou vice-versa) depois da instalação, basta remover a trava de execução e chamar o assistente novamente:"`;

    // The keys to insert for EN
    const enTrans = `,\n        "d.h_ts": "Troubleshooting & Advanced",
        "d.ts_1": "Dashboard Password Reset",
        "d.ts_2": "If you lose admin access, you can reset the user database to the default (admin / admin123) by deleting the file via SSH:",
        "d.ts_3": "System Log Monitoring",
        "d.ts_4": "To check for application errors or analyze real-time DNS traffic, use the system log (journald):",
        "d.ts_5": "Network Reconfiguration (Post-Install Wizard)",
        "d.ts_6": "If you need to change the IP from static to DHCP (or vice versa) after installation, simply remove the execution lock and call the wizard again:"`;

    // The keys to insert for ES
    const esTrans = `,\n        "d.h_ts": "Solución de Problemas y Avanzado",
        "d.ts_1": "Restablecimiento de Contraseña del Dashboard",
        "d.ts_2": "Si pierde el acceso de administrador, puede restablecer la base de datos de usuarios a la predeterminada (admin / admin123) eliminando el archivo vía SSH:",
        "d.ts_3": "Monitoreo de Registros del Sistema",
        "d.ts_4": "Para comprobar errores de la aplicación o analizar tráfico DNS en tiempo real, utilice el registro del sistema (journald):",
        "d.ts_5": "Reconfiguración de Red (Asistente Post-Instalación)",
        "d.ts_6": "Si necesita cambiar la IP de estática a DHCP (o viceversa) después de la instalación, simplemente elimine el bloqueo de ejecución y vuelva a llamar al asistente:"`;

    const searchPT = '"faq.a4": "O plano FREE oferece proteção DNS básica para até 1 nó satélite, sem painel corporativo. O PRO Elite inclui proteção CTI avançada, bloqueio de malware Zero-Day e cluster de satélites ilimitado, com cobrança mensal. O PRO Lite é uma licença vitalícia de pagamento único, com recursos base do PRO e dashboard básico incluído."\n    }';
    lang = lang.replace(searchPT, searchPT.replace('\\n    }', '') + ptTrans + '\\n    }');

    // Let's use simple string split and join instead to avoid regex escape issues.
    lang = lang.split(searchPT).join('"faq.a4": "O plano FREE oferece proteção DNS básica para até 1 nó satélite, sem painel corporativo. O PRO Elite inclui proteção CTI avançada, bloqueio de malware Zero-Day e cluster de satélites ilimitado, com cobrança mensal. O PRO Lite é uma licença vitalícia de pagamento único, com recursos base do PRO e dashboard básico incluído."' + ptTrans + '\n    }');

    const searchEN = '"faq.a4": "The FREE plan offers basic DNS protection for up to 1 satellite node, with no corporate dashboard. PRO Elite includes advanced CTI protection, Zero-Day malware blocking, and an unlimited satellite cluster, billed monthly. PRO Lite is a one-time lifetime license with PRO base features and a basic dashboard included."\n    }';
    lang = lang.split(searchEN).join('"faq.a4": "The FREE plan offers basic DNS protection for up to 1 satellite node, with no corporate dashboard. PRO Elite includes advanced CTI protection, Zero-Day malware blocking, and an unlimited satellite cluster, billed monthly. PRO Lite is a one-time lifetime license with PRO base features and a basic dashboard included."' + enTrans + '\n    }');

    const searchES = '"faq.a4": "El plan FREE ofrece protección DNS básica para hasta 1 nodo satélite, sin panel corporativo. El PRO Elite incluye protección CTI avanzada, bloqueo de malware Zero-Day y clúster de satélites ilimitado, con facturación mensual. El PRO Lite es una licencia vitalicia de pago único, con las funciones base del PRO y un dashboard básico incluido."\n    }';
    lang = lang.split(searchES).join('"faq.a4": "El plan FREE ofrece protección DNS básica para hasta 1 nodo satélite, sin panel corporativo. El PRO Elite incluye protección CTI avanzada, bloqueo de malware Zero-Day y clúster de satélites ilimitado, con facturación mensual. El PRO Lite es una licencia vitalicia de pago único, con las funciones base del PRO y un dashboard básico incluido."' + esTrans + '\n    }');

    fs.writeFileSync(f, lang, 'utf8');
    console.log("Translation keys injected successfully.");
} else {
    console.log("lang.js not found.");
}
