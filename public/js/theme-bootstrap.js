/**
 * miFiestAPP - Theme Bootstrapper
 * Executes synchronously in <head> to prevent FOUC (Flash of Unstyled Content)
 * by applying cached event theme variables before the DOM is painted.
 */
(function() {
  try {
    // If SSR theme was already injected by the server, skip client bootstrap
    if (document.getElementById('mifiestapp-injected-theme')) {
      return;
    }

    const THEME_FALLBACKS = {
      'golden-luxury': { primaryColor: '#d4af37', secondaryColor: '#aa7c11', bgColor: '#0b0b0c', fontFamily: "'Cinzel', serif", crownFilter: 'drop-shadow(0 0 16px rgba(212, 175, 55, 0.55))' },
      'rose-gold': { primaryColor: '#e0a899', secondaryColor: '#b76e79', bgColor: '#0d0b0f', fontFamily: "'Playfair Display', serif", crownFilter: 'hue-rotate(305deg) saturate(1.4) brightness(1.1) drop-shadow(0 0 18px rgba(224, 168, 153, 0.6))' },
      'cyber-neon': { primaryColor: '#00f3ff', secondaryColor: '#ff007f', bgColor: '#080511', fontFamily: "'Montserrat', sans-serif", crownFilter: 'hue-rotate(145deg) saturate(2.6) brightness(1.15) drop-shadow(0 0 22px rgba(0, 243, 255, 0.75))' },
      'emerald-royal': { primaryColor: '#2ec4b6', secondaryColor: '#0d5c46', bgColor: '#060d0a', fontFamily: "'Cinzel', serif", crownFilter: 'hue-rotate(95deg) saturate(1.9) brightness(1.05) drop-shadow(0 0 18px rgba(46, 196, 182, 0.65))' },
      'midnight-navy': { primaryColor: '#4cc9f0', secondaryColor: '#1e3a8a', bgColor: '#050a14', fontFamily: "'Cinzel', serif", crownFilter: 'hue-rotate(185deg) saturate(2.2) brightness(1.1) drop-shadow(0 0 20px rgba(76, 201, 240, 0.7))' },
      'boho-rust': { primaryColor: '#e07a5f', secondaryColor: '#81b29a', bgColor: '#0e0b09', fontFamily: "'Outfit', sans-serif", crownFilter: 'hue-rotate(335deg) saturate(1.3) sepia(0.25) drop-shadow(0 0 16px rgba(224, 122, 95, 0.55))' },
      'retro-disco': { primaryColor: '#ff0080', secondaryColor: '#7928ca', bgColor: '#0b0614', fontFamily: "'Syncopate', sans-serif", crownFilter: 'hue-rotate(265deg) saturate(2.8) brightness(1.2) drop-shadow(0 0 22px rgba(255, 0, 128, 0.75))' }
    };

    function hexToRgb(hex) {
      if (!hex) return '212, 175, 55';
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map(x => x + x).join('');
      const num = parseInt(c, 16);
      if (isNaN(num)) return '212, 175, 55';
      return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event') || (window.location.pathname.split('/')[1] || '').replace('.html', '') || 'default';

    let cachedTheme = null;
    let cachedThemeStr = null;

    if (eventId && eventId !== 'default') {
      cachedThemeStr = localStorage.getItem('mifiestapp_theme_' + eventId);
    }
    if (!cachedThemeStr) {
      cachedThemeStr = localStorage.getItem('mifiestapp_last_theme');
    }

    if (cachedThemeStr) {
      try {
        cachedTheme = JSON.parse(cachedThemeStr);
      } catch (e) {
        if (typeof cachedThemeStr === 'string') cachedTheme = cachedThemeStr;
      }
    }

    if (cachedTheme) {
      let themeObj = cachedTheme;
      if (typeof cachedTheme === 'string') {
        themeObj = THEME_FALLBACKS[cachedTheme] || THEME_FALLBACKS['golden-luxury'];
      }

      const primColor = themeObj.primaryColor || '#d4af37';
      const secColor = themeObj.secondaryColor || '#aa7c11';
      const primRgb = hexToRgb(primColor);
      const secRgb = hexToRgb(secColor);

      const root = document.documentElement;
      root.style.setProperty('--primary-rgb', primRgb);
      root.style.setProperty('--secondary-rgb', secRgb);
      root.style.setProperty('--gold-primary', primColor);
      root.style.setProperty('--gold-secondary', secColor);
      root.style.setProperty('--gold-light', primColor);
      root.style.setProperty('--gold-gradient', `linear-gradient(135deg, #ffffff 0%, ${primColor} 50%, ${secColor} 100%)`);
      root.style.setProperty('--card-border', `rgba(${primRgb}, 0.15)`);
      root.style.setProperty('--card-border-active', `rgba(${primRgb}, 0.5)`);
      root.style.setProperty('--border-gold', `rgba(${primRgb}, 0.25)`);
      root.style.setProperty('--border-gold-bright', primColor);
      root.style.setProperty('--gold-glow', `0 0 25px rgba(${primRgb}, 0.25)`);
      root.style.setProperty('--glow-shadow', `0 0 25px rgba(${primRgb}, 0.25)`);

      if (themeObj.fontFamily) {
        root.style.setProperty('--accent-font', themeObj.fontFamily);
      }
      if (themeObj.bgColor) {
        root.style.setProperty('--bg-dark', themeObj.bgColor);
        root.style.setProperty('--bg-color', themeObj.bgColor);
        root.style.setProperty('--bg-radial', `radial-gradient(circle at 50% 10%, rgba(${primRgb}, 0.12) 0%, ${themeObj.bgColor} 90%)`);
      }

      // If on mobile app or invitation page, apply cached visuals as soon as DOM is ready
      document.addEventListener('DOMContentLoaded', () => {
        try {
          const glow1 = document.querySelector('.mesh-glow-1');
          const glow2 = document.querySelector('.mesh-glow-2');
          if (glow1 && themeObj.glow1) glow1.style.background = `radial-gradient(circle, ${themeObj.glow1} 0%, transparent 70%)`;
          if (glow2 && themeObj.glow2) glow2.style.background = `radial-gradient(circle, ${themeObj.glow2} 0%, transparent 70%)`;

          if (themeObj.crownFilter) {
            document.querySelectorAll('#admin-header-crown, #header-crown-logo, .logo-container img, .app-brand img, .gatekeeper-logo, #sidebar-avatar, #header-avatar-badge img').forEach(img => {
              img.style.filter = themeObj.crownFilter;
            });
          }

          const m = localStorage.getItem('mifiestapp_inv_card_model_' + eventId);
          const c = localStorage.getItem('mifiestapp_inv_theme_color_' + eventId);
          const f = localStorage.getItem('mifiestapp_inv_theme_font_' + eventId);
          if (document.body) {
            if (m && !document.body.className.includes('card-model-')) document.body.classList.add('card-model-' + m);
            if (c && !document.body.className.includes('theme-')) document.body.classList.add('theme-' + c);
            if (f && !document.body.className.includes('font-')) document.body.classList.add('font-' + f);
          }
        } catch(e) {}
      });
    }
  } catch (err) {
    console.warn('[ThemeBootstrap] Warn:', err);
  }
})();
