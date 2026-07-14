const fs = require('fs');
const indexHtmlPath = 'C:/Users/Administrator/Desktop/Projetos/dashbord/Sentinel_Landing/index.html';

if (fs.existsSync(indexHtmlPath)) {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    // Add floating-cta CSS to the end of the first <style> block
    const cssToAdd = `
        /* Floating CTA */
        .floating-cta {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: linear-gradient(135deg, var(--accent-primary) 0%, #1e40af 100%);
            color: #fff;
            padding: 1rem 1.5rem;
            border-radius: 50px;
            font-weight: 700;
            font-size: 1rem;
            text-decoration: none;
            box-shadow: 0 10px 25px rgba(56, 189, 248, 0.4);
            display: flex;
            align-items: center;
            gap: 0.5rem;
            z-index: 100;
            transition: all 0.3s ease;
            opacity: 0;
            visibility: hidden;
            transform: translateY(20px);
        }
        .floating-cta.visible {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        .floating-cta:hover {
            transform: translateY(-5px) scale(1.05);
            box-shadow: 0 15px 30px rgba(56, 189, 248, 0.6);
            color: #fff;
        }
    `;

    // Only add if not already present
    if (!html.includes('.floating-cta {')) {
        // We can just inject it right before the first </style>
        html = html.replace('</style>', cssToAdd + '\n    </style>');
        fs.writeFileSync(indexHtmlPath, html, 'utf8');
        console.log("CSS injected into index.html");
    } else {
        console.log("CSS already exists in index.html");
    }
}
