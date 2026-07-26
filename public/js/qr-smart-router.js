/**
 * miFiestAPP Smart QR Router
 * Resolves the optimal origin URL for QR code generation.
 * On production / cloud servers: Uses the actual domain protocol & hostname.
 * On local dev (localhost / 127.0.0.1): Resolves the host's WiFi LAN IP (e.g. http://192.168.1.4:3000)
 * so mobile devices scanning the QR on local WiFi connect seamlessly without "Safari cannot open page" errors.
 */
(function() {
  let cachedSmartOrigin = null;

  window.getSmartOrigin = async function() {
    if (cachedSmartOrigin) return cachedSmartOrigin;

    const hostname = window.location.hostname;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;

    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      cachedSmartOrigin = `${protocol}//${hostname}${port}`;
      return cachedSmartOrigin;
    }

    try {
      const res = await fetch('/api/debug/network-ip');
      const data = await res.json();
      if (data && data.localIp && data.localIp !== 'localhost') {
        cachedSmartOrigin = `http://${data.localIp}${port}`;
        return cachedSmartOrigin;
      }
    } catch (e) {
      console.warn('[miFiestAPP QR Router] Could not resolve network IP fallback:', e);
    }

    cachedSmartOrigin = window.location.origin;
    return cachedSmartOrigin;
  };

  /**
   * Helper to construct a full QR Server API URL for a given target path
   */
  window.generateSmartQRUrl = async function(targetPath, options = {}) {
    const origin = await window.getSmartOrigin();
    const size = options.size || '250x250';
    const color = options.color ? `&color=${options.color}` : '';
    const bgcolor = options.bgcolor ? `&bgcolor=${options.bgcolor}` : '';
    
    const fullTarget = `${origin}${targetPath.startsWith('/') ? targetPath : '/' + targetPath}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}&data=${encodeURIComponent(fullTarget)}${color}${bgcolor}`;
  };
})();
