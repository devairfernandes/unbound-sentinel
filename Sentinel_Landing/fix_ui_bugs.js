const fs = require('fs');
const path = require('path');

const indexHtmlPath = 'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/index.html';

if (fs.existsSync(indexHtmlPath)) {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    // FIX LOGO PATH
    html = html.replace(/src="\/Logo\.png"/g, 'src="/Logo.webp"');

    // FIX TERMINAL JAVASCRIPT
    const jsSplit = html.split('// 4. TERMINAL LOG WIDGET');
    if (jsSplit.length > 1) {
        // Find the closing </script> after the terminal logic
        const scriptSplit = jsSplit[1].split('</script>');
        
        const newTerminalJS = `
        // ==========================================
        const lines = [
            '<span style="color:#22c55e">[OK]</span> sentinel-os: Kernel parameters loaded successfully.',
            '<span style="color:#818cf8">[INFO]</span> auto-tuning: Detected 16 Cores / 32GB RAM. Allocating 4 threads...',
            '<span style="color:#22c55e">[OK]</span> auto-tuning: Socket buffers optimized for 100k+ QPS.',
            '<span style="color:#818cf8">[INFO]</span> cti-engine: Connecting to Global Threat Network...',
            '<span style="color:#22c55e">[OK]</span> cti-engine: 4.2M malware signatures loaded.',
            '<span style="color:#818cf8">[INFO]</span> cache: Restoring persistent cache from disk...',
            '<span style="color:#22c55e">[OK]</span> cache: 850,000 records restored in 420ms.',
            '<span style="color:#eab308">[WARN]</span> shield: Minor DDoS attempt mitigated on port 53.',
            '<span style="color:#22c55e">[OK]</span> sentinel: Unbound DNS Master node is ONLINE and accepting queries.'
        ];
        
        const termOutput = document.getElementById('term-output');
        let lIndex = 0;
        
        const cursor = document.createElement('span');
        cursor.className = 'blinking-cursor';
        
        function addTermLine() {
            if (!termOutput) return;
            if (termOutput.contains(cursor)) {
                termOutput.removeChild(cursor);
            }
            
            let newLineHTML = '';
            if(lIndex < lines.length) {
                newLineHTML = \`<span class="term-prefix">root@sentinel:~#</span> \${lines[lIndex]}\`;
                lIndex++;
            } else {
                const pings = [
                    '<span style="color:#38bdf8">[NOC]</span> Real-time latency: ' + (Math.floor(Math.random()*4)+1) + 'ms (Ultra-Low)',
                    '<span style="color:#22c55e">[CACHE]</span> Hit Ratio: ' + (92 + Math.random()*7).toFixed(1) + '% | Memory: ' + (2 + Math.random()*2).toFixed(1) + 'GB',
                    '<span style="color:#f43f5e">[SHIELD]</span> Blocked domain: malicious-botnet.ru',
                    '<span style="color:#f43f5e">[SHIELD]</span> Blocked domain: phishing-auth-banco.com',
                    '<span style="color:#818cf8">[SYNC]</span> CTI Engine: Feeds atualizados em background.'
                ];
                const randPing = pings[Math.floor(Math.random() * pings.length)];
                newLineHTML = \`<span class="term-prefix">root@sentinel:~#</span> \${randPing}\`;
            }

            const div = document.createElement('div');
            div.className = 'term-line';
            div.innerHTML = newLineHTML;
            termOutput.appendChild(div);
            termOutput.appendChild(cursor);

            const termLines = termOutput.querySelectorAll('.term-line');
            if(termLines.length > 9) {
                termOutput.removeChild(termLines[0]);
            }
            
            termOutput.scrollTop = termOutput.scrollHeight;

            if(lIndex < lines.length) {
                setTimeout(addTermLine, Math.random() * 600 + 300);
            } else {
                setTimeout(addTermLine, Math.random() * 2000 + 1500);
            }
        }

        setTimeout(addTermLine, 1000);
    `;

        // Reconstruct HTML
        // scriptSplit[0] is the old JS. We replace it.
        // We must re-add </script> because we split on it.
        html = jsSplit[0] + '// 4. TERMINAL LOG WIDGET' + newTerminalJS + '\n</script>' + scriptSplit.slice(1).join('</script>');
    }

    fs.writeFileSync(indexHtmlPath, html, 'utf8');
    console.log("Fixed Logo and Terminal!");
} else {
    console.log("Index not found.");
}
