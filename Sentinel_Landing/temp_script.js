
        document.addEventListener('DOMContentLoaded', function() {
            const consent = localStorage.getItem('sentinel_lgpd_consent');
            if (!consent) {
                setTimeout(function() {
                    const banner = document.getElementById('lgpd-banner');
                    if (banner) banner.style.display = 'flex';
                }, 800);
            }
        });
        function lgpdAccept() {
            localStorage.setItem('sentinel_lgpd_consent', JSON.stringify({ accepted: true, date: new Date().toISOString() }));
            hideLgpdBanner();
        }
        function lgpdReject() {
            localStorage.setItem('sentinel_lgpd_consent', JSON.stringify({ accepted: false, date: new Date().toISOString() }));
            hideLgpdBanner();
        }
        function hideLgpdBanner() {
            const banner = document.getElementById('lgpd-banner');
            banner.style.opacity = '0';
            banner.style.transform = 'translateX(-50%) translateY(20px)';
            banner.style.transition = 'all 0.4s ease';
            setTimeout(() => banner.style.display = 'none', 400);
        }
    