/**
 * miFiestAPP - Preloader Helper
 * Handles smooth dissolving of the preloader screen once page initialization completes,
 * ensuring a delightful animated intro and guaranteed 100% theme & DOM settling.
 */
(function() {
  const startTime = Date.now();
  const MIN_DISPLAY_TIME = 650; // Minimum time for smooth animation presentation

  window.hideMiFiestappPreloader = function(extraDelay = 500) {
    const preloader = document.getElementById('mifiestapp-preloader');
    if (!preloader) return;
    if (preloader.classList.contains('fade-out')) return;

    const elapsed = Date.now() - startTime;
    const delay = Math.max(0, MIN_DISPLAY_TIME - elapsed) + extraDelay;

    setTimeout(() => {
      if (preloader.classList.contains('fade-out')) return;
      preloader.classList.add('fade-out');
      setTimeout(() => {
        if (preloader && preloader.parentNode) {
          preloader.parentNode.removeChild(preloader);
        }
      }, 500);
    }, delay);
  };

  // Safety fallback: Ensure preloader is always dismissed after 3.2s maximum
  setTimeout(() => {
    if (typeof window.hideMiFiestappPreloader === 'function') {
      window.hideMiFiestappPreloader(0);
    }
  }, 3200);
})();
