const fs = require('fs');

const files = ['index.html', 'download.html', 'lang.js'];

files.forEach(f => {
    if (!fs.existsSync(f)) return;
    let content = fs.readFileSync(f, 'utf8');

    // Remove <li> items in Pricing
    content = content.replace(/.*<li data-i18n="price.f_3".*\n?/g, '');
    content = content.replace(/.*<li data-i18n="price.p_4".*\n?/g, '');
    
    // Remove from lang.js dictionary
    content = content.replace(/.*"price\.f_3".*\n?/g, '');
    content = content.replace(/.*"price\.p_4".*\n?/g, '');

    // Schema.org descriptions
    content = content.replace(/e at\u00E9 1 N\u00F3 Sat\u00E9lite\./g, '.');
    content = content.replace(/, Dashboard NOC Master e cluster sat\u00E9lite ilimitado\./g, ' e Dashboard NOC Master.');
    content = content.replace(/e suporte a cluster de n\u00F3s sat\u00E9lite ilimitado\./g, '.');

    // Schema.org without unicode
    content = content.replace(/e até 1 Nó Satélite\./g, '.');
    content = content.replace(/, Dashboard NOC Master e cluster satélite ilimitado/g, ' e Dashboard NOC Master');
    content = content.replace(/ e suporte a cluster de nós satélite ilimitado\./g, '.');
    content = content.replace(/Cluster de Nós Satélite ilimitado/g, 'Gerenciamento Centralizado');

    // download.html steps
    content = content.replace(/ para liberar a licença e ativar os nós satélite/g, ' para liberar a licença');
    content = content.replace(/ para liberar a licen\u00E7a e ativar os n\u00F3s sat\u00E9lite/g, ' para liberar a licença');
    content = content.replace(/ para activar la licencia y habilitar los nodos satélite/g, ' para activar la licencia');
    content = content.replace(/ to unlock the license and enable satellite nodes/g, ' to unlock the license');

    // lang.js faq
    content = content.replace(/ para até 1 nó satélite,/g, '');
    content = content.replace(/ e cluster de satélites ilimitado/g, '');
    content = content.replace(/ para at\u00E9 1 n\u00F3 sat\u00E9lite,/g, '');
    content = content.replace(/ e cluster de sat\u00E9lites ilimitado/g, '');
    
    content = content.replace(/ for up to 1 satellite node,/g, '');
    content = content.replace(/ and unlimited satellite cluster/g, '');
    
    content = content.replace(/ para hasta 1 nodo satélite,/g, '');
    content = content.replace(/ y clúster de satélites ilimitado/g, '');
    content = content.replace(/ y cl\u00FAster de sat\u00E9lites ilimitado/g, '');

    // Any remaining odd encoding from the terminal
    content = content.replace(/ para at\? 1 n\? sat\?lite,/g, '');
    content = content.replace(/ e cluster de sat\?lites ilimitado/g, '');
    content = content.replace(/ e ativar os n\?s sat\?lite/g, '');

    fs.writeFileSync(f, content, 'utf8');
});
console.log('Cleanup complete.');
