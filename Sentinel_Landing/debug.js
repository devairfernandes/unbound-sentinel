
        lucide.createIcons();

        // Floating CTA Logic
        const floatCta = document.querySelector('.floating-cta');
        if(floatCta) {
            window.addEventListener('scroll', () => {
                if(window.scrollY > 600) floatCta.classList.add('visible');
                else floatCta.classList.remove('visible');
            });
        }
        

                // Fetch Social Proof from API
        fetch('/api/public/stats')
            .then(r => r.json())
            .then(data => {
                if(data && data.clients) {
                    const count = data.clients.length;
                    // Update Stats Bar
                    const elNodes = document.getElementById('stat-nodes');
                    if (elNodes) elNodes.innerText = count > 0 ? count : '0';
                    
                    const elThreats = document.getElementById('stat-threats');
                    if (elThreats) elThreats.innerHTML = '> 10M';
                    
                    const elLatency = document.getElementById('stat-latency');
                    if (elLatency) elLatency.innerHTML = '< 2<span style="font-size:0.5em">ms</span>';
                    
                    const elQueries = document.getElementById('stat-queries');
                    if (elQueries) elQueries.innerHTML = '> 500M';
                    
                    // Update B2B Social Proof
                    const socialB2b = document.getElementById('b2b-client-names');
                    if (socialB2b && count > 0) {
                        const names = Array.from(new Set(data.clients.map(c => c.name).filter(n => n && n !== 'Desconhecido')));
                        if(names.length > 0) {
                            socialB2b.innerHTML = names.map(n => '<span class="b2b-badge">' + n + '</span>').join('');
                        }
                    }
                }
            })
            .catch(e => { console.log('API inacessivel'); });

        // ==========================================
        // 1. PARTICLES BACKGROUND
        // ==========================================
        const partCanvas = document.getElementById('particles-bg');
        const pCtx = partCanvas.getContext('2d');
        let width, height, particles;

        function initParticles() {
            width = partCanvas.width = window.innerWidth;
            height = partCanvas.height = window.innerHeight;
            particles = [];
            const particleCount = Math.floor(width / 15);
            for(let i=0; i<particleCount; i++) {
                particles.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * 0.5,
                    vy: (Math.random() - 0.5) * 0.5,
                    radius: Math.random() * 2 + 1
                });
            }
        }
        
        function drawParticles() {
            pCtx.clearRect(0, 0, width, height);
            pCtx.fillStyle = 'rgba(56, 189, 248, 0.5)';
            pCtx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
            pCtx.lineWidth = 1;

            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                if(p.x < 0 || p.x > width) p.vx *= -1;
                if(p.y < 0 || p.y > height) p.vy *= -1;

                pCtx.beginPath();
                pCtx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
                pCtx.fill();

                for(let j=i+1; j<particles.length; j++) {
                    const p2 = particles[j];
                    const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
                    if(dist < 120) {
                        pCtx.beginPath();
                        pCtx.moveTo(p.x, p.y);
                        pCtx.lineTo(p2.x, p2.y);
                        pCtx.stroke();
                    }
                }
            });
            requestAnimationFrame(drawParticles);
        }
        window.addEventListener('resize', initParticles);
        initParticles();
        drawParticles();

        // ==========================================
        // 2. LIVE DATA ANIMATION & API FETCH
        // ==========================================
        
        async function fetchLiveStats() {
            try {
                // Tenta buscar os dados reais da API
                const response = await fetch('/api/landing-stats');
                if (response.ok) {
                    const data = await response.json();
                    document.getElementById('stat-threats').innerText = data.threatsBlocked;
                    document.getElementById('stat-nodes').innerText = data.nodes + " Ativos";
                    document.getElementById('stat-latency').innerText = data.latency;
                    document.getElementById('stat-queries').innerText = data.queries;
                    
                    const socialProof = document.getElementById('social-proof-nodes');
                    if (socialProof) {
                        socialProof.innerText = data.nodes;
                    }
                    
                    // Simular QPS baseado na resposta ou valor random realista
                    let targetQps = Math.floor(Math.random() * 50) + 400;
                    document.getElementById('stat-live-qps').innerText = targetQps + " QPS";
                }
            } catch (err) {
                // Fallback gracioso para dados locais caso a API esteja offline (Página servida estaticamente)
                let baseThreats = 2450300;
                let baseQueries = 18500200;
                document.getElementById('stat-threats').innerText = (baseThreats / 1000000).toFixed(2) + "M+";
                document.getElementById('stat-nodes').innerText = "12 Ativos";
                document.getElementById('stat-latency').innerText = "< 2ms";
                document.getElementById('stat-queries').innerText = (baseQueries / 1000000).toFixed(2) + "M+";
                document.getElementById('stat-live-qps').innerText = "450 QPS";
                
                const socialProof = document.getElementById('social-proof-nodes');
                if (socialProof) socialProof.innerText = "12";
            }
        }
        
        // Chamada inicial e atualização a cada 10 segundos
        fetchLiveStats();
        setInterval(fetchLiveStats, 10000);

        // API PRICING REMOVIDO: A Cloudflare Pages hospeda conteúdo estático.
        // Os preços já estão definidos no próprio HTML da página.

        // ==========================================
        // 3. TRAFFIC CHART (WAVES)
        // ==========================================
        const chartCanvas = document.getElementById('trafficChart');
        const cCtx = chartCanvas.getContext('2d');
        let chartW, chartH;
        let trafficData = Array(50).fill(0).map(() => Math.random() * 50 + 20);

        function initChart() {
            chartW = chartCanvas.width = chartCanvas.offsetWidth;
            chartH = chartCanvas.height = chartCanvas.offsetHeight;
        }

        function drawChart() {
            cCtx.clearRect(0, 0, chartW, chartH);
            
            // Add new data point, remove old
            let targetQps = Math.random() * 100 + 400; // Fake 400-500 QPS
            document.getElementById('stat-live-qps').innerText = Math.floor(targetQps) + " QPS";
            
            trafficData.push(Math.random() * 60 + 20);
            trafficData.shift();

            cCtx.beginPath();
            cCtx.moveTo(0, chartH);
            
            const slice = chartW / (trafficData.length - 1);
            for(let i=0; i<trafficData.length; i++) {
                const x = i * slice;
                const y = chartH - (trafficData[i] / 100) * chartH * 0.8;
                cCtx.lineTo(x, y);
            }
            cCtx.lineTo(chartW, chartH);
            cCtx.closePath();

            const grad = cCtx.createLinearGradient(0, 0, 0, chartH);
            grad.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
            grad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
            cCtx.fillStyle = grad;
            cCtx.fill();

            cCtx.beginPath();
            for(let i=0; i<trafficData.length; i++) {
                const x = i * slice;
                const y = chartH - (trafficData[i] / 100) * chartH * 0.8;
                if(i===0) cCtx.moveTo(x, y);
                else cCtx.lineTo(x, y);
            }
            cCtx.strokeStyle = 'rgba(16, 185, 129, 1)';
            cCtx.lineWidth = 2;
            cCtx.stroke();
        }
        
        window.addEventListener('resize', initChart);
        initChart();
        setInterval(drawChart, 1000);

        // ==========================================
        // 4. TERMINAL LOG WIDGET
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
                newLineHTML = `<span class="term-prefix">root@sentinel:~#</span> ${lines[lIndex]}`;
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
                newLineHTML = `<span class="term-prefix">root@sentinel:~#</span> ${randPing}`;
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
    
