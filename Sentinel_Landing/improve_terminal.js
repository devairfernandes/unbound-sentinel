const fs = require('fs');

const indexHtmlPath = 'index.html';

if (fs.existsSync(indexHtmlPath)) {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    // Update CSS for Terminal
    const newCss = `
        .terminal-body {
            padding: 1.5rem;
            font-family: 'JetBrains Mono', 'Courier New', monospace;
            font-size: 0.95rem;
            color: #cbd5e1;
            line-height: 1.8;
            height: 350px;
            overflow-y: hidden;
            position: relative;
            background: rgba(15, 23, 42, 0.95);
            box-shadow: inset 0 0 50px rgba(0,0,0,0.5);
        }

        .terminal-body::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 80px;
            background: linear-gradient(to top, rgba(15, 23, 42, 1), transparent);
            pointer-events: none;
        }

        .term-line {
            opacity: 0;
            transform: translateY(10px);
            animation: term-type 0.3s forwards;
            margin-bottom: 2px;
        }

        .term-prefix {
            color: #38bdf8;
            font-weight: bold;
            margin-right: 8px;
            text-shadow: 0 0 5px rgba(56, 189, 248, 0.5);
        }

        .term-cursor {
            display: inline-block;
            width: 8px;
            height: 15px;
            background: #22c55e;
            margin-left: 5px;
            vertical-align: text-bottom;
            animation: blink 1s step-end infinite;
        }

        @keyframes blink { 50% { opacity: 0; } }
        @keyframes term-type {
            to { opacity: 1; transform: translateY(0); }
        }
`;

    // Replace old terminal CSS block
    // Specifically looking for `.terminal-body {` down to `@keyframes term-type {`
    html = html.replace(/\.terminal-body \{[\s\S]*?@keyframes term-type \{[\s\S]*?\}/, newCss + '\n        @keyframes term-type {');
    // Ensure we don't break the term-type keyframes end bracket, so the above replace assumes the rest of the file is intact. Wait, it's safer to just inject at the bottom of the style tag.

    // Let's use a safer replacement strategy: just append the new styles to the end of <style>
    // Actually, CSS cascade means we can just add a block right before </style> to override!
    const overrideCss = `
        /* OVERRIDE TERMINAL CSS */
        .terminal-body {
            height: 320px !important;
            font-family: 'Courier New', monospace;
            background: #0b1121 !important;
            box-shadow: inset 0 0 40px rgba(0,0,0,0.8);
            border-bottom-left-radius: 8px;
            border-bottom-right-radius: 8px;
        }
        .term-line {
            text-shadow: 0 0 2px rgba(255,255,255,0.2);
        }
        .term-prefix {
            color: #22c55e !important;
            text-shadow: 0 0 5px rgba(34, 197, 94, 0.5);
        }
        .blinking-cursor {
            display: inline-block;
            width: 8px;
            height: 15px;
            background: #22c55e;
            margin-left: 5px;
            vertical-align: middle;
            animation: blink 1s step-end infinite;
            box-shadow: 0 0 8px #22c55e;
        }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
    `;
    if(!html.includes('OVERRIDE TERMINAL CSS')) {
        html = html.replace('</style>', overrideCss + '\n    </style>');
    }

    // Now, replace the JS Logic
    const oldJsStart = '// 4. TERMINAL LOG WIDGET';
    const oldJsEnd = '}, 2000);'; // This is roughly the end of the setTimeout block

    const newJs = `// 4. TERMINAL LOG WIDGET
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
        
        // Create cursor element
        const cursor = document.createElement('span');
        cursor.className = 'blinking-cursor';
        
        function addTermLine() {
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

            // Keep max 9 lines to prevent overflow
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

        setTimeout(addTermLine, 1000);`;

    const regexJS = /\/\/ 4\. TERMINAL LOG WIDGET[\s\S]*?setTimeout\(addTermLine,\s*2000\);/m;
    html = html.replace(regexJS, newJs);

    fs.writeFileSync(indexHtmlPath, html, 'utf8');
}
console.log("Terminal improved!");
