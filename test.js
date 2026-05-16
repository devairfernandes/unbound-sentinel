const { Client } = require('ssh2'); 
const conn = new Client(); 
conn.on('ready', () => { 
    conn.exec('echo -e \'server:\\n  local-zone: "test.com" always_nxdomain\' > /etc/unbound/local.d/local-zone.conf && unbound-checkconf', (err, stream) => { 
        stream.on('data', (d)=>console.log(d.toString())).stderr.on('data', (d)=>console.error(d.toString())); 
        stream.on('close', ()=>conn.end()); 
    }); 
}).connect({host:'168.197.8.70',port:51386,username:'root',password:'Kfk30TIr'});
