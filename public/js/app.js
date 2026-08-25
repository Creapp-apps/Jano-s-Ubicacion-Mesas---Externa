document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('guest-name-input');
  const suggestionsBox = document.getElementById('suggestions-box');
  const searchCard = document.getElementById('search-card');
  const searchForm = document.getElementById('search-form');
  const ticketWrapper = document.getElementById('ticket-wrapper');
  const resultName = document.getElementById('result-name');
  const resultTable = document.getElementById('result-table');
  const btnSearchAgain = document.getElementById('btn-search-again');
  const eventSubtitle = document.getElementById('event-subtitle');
  const onboardingCard = document.getElementById('onboarding-card');
  const startSearchBtn = document.getElementById('btn-start-search');
  
  if (startSearchBtn && onboardingCard && searchCard) {
    startSearchBtn.addEventListener('click', () => {
      onboardingCard.style.opacity = '0';
      onboardingCard.style.transform = 'scale(0.95)';
      onboardingCard.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
      
      setTimeout(() => {
        onboardingCard.style.display = 'none';
        searchCard.style.display = 'block';
        searchCard.style.opacity = '0';
        searchCard.style.transform = 'scale(0.95)';
        
        // Force reflow
        void searchCard.offsetWidth;
        
        searchCard.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        searchCard.style.opacity = '1';
        searchCard.style.transform = 'scale(1)';
        
        setTimeout(() => {
          nameInput.focus();
        }, 500);
      }, 500);
    });
  }
  
  function hexToRgb(hex) {
    if (!hex) return '212, 175, 55';
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return '212, 175, 55';
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  function applyGuestAppTheme(theme) {
    if (!theme) return;
    const root = document.documentElement;
    let themeObj = theme;
    if (typeof theme === 'string') {
      const THEME_FALLBACKS = {
        'golden-luxury': { primaryColor: '#d4af37', secondaryColor: '#aa7c11', bgColor: '#0b0b0c', fontFamily: "'Cinzel', serif", crownFilter: 'drop-shadow(0 0 16px rgba(212, 175, 55, 0.55))' },
        'rose-gold': { primaryColor: '#e0a899', secondaryColor: '#b76e79', bgColor: '#0d0b0f', fontFamily: "'Playfair Display', serif", crownFilter: 'hue-rotate(305deg) saturate(1.4) brightness(1.1) drop-shadow(0 0 18px rgba(224, 168, 153, 0.6))' },
        'cyber-neon': { primaryColor: '#00f3ff', secondaryColor: '#ff007f', bgColor: '#080511', fontFamily: "'Montserrat', sans-serif", crownFilter: 'hue-rotate(145deg) saturate(2.6) brightness(1.15) drop-shadow(0 0 22px rgba(0, 243, 255, 0.75))' },
        'emerald-royal': { primaryColor: '#2ec4b6', secondaryColor: '#0d5c46', bgColor: '#060d0a', fontFamily: "'Cinzel', serif", crownFilter: 'hue-rotate(95deg) saturate(1.9) brightness(1.05) drop-shadow(0 0 18px rgba(46, 196, 182, 0.65))' },
        'midnight-navy': { primaryColor: '#4cc9f0', secondaryColor: '#1e3a8a', bgColor: '#050a14', fontFamily: "'Cinzel', serif", crownFilter: 'hue-rotate(185deg) saturate(2.2) brightness(1.1) drop-shadow(0 0 20px rgba(76, 201, 240, 0.7))' },
        'boho-rust': { primaryColor: '#e07a5f', secondaryColor: '#81b29a', bgColor: '#0e0b09', fontFamily: "'Outfit', sans-serif", crownFilter: 'hue-rotate(335deg) saturate(1.3) sepia(0.25) drop-shadow(0 0 16px rgba(224, 122, 95, 0.55))' },
        'retro-disco': { primaryColor: '#ff0080', secondaryColor: '#7928ca', bgColor: '#0b0614', fontFamily: "'Syncopate', sans-serif", crownFilter: 'hue-rotate(265deg) saturate(2.8) brightness(1.2) drop-shadow(0 0 22px rgba(255, 0, 128, 0.75))' }
      };
      themeObj = THEME_FALLBACKS[theme] || THEME_FALLBACKS['golden-luxury'];
    }

    try {
      const qEv = new URLSearchParams(window.location.search).get('event') || 'default';
      if (qEv && qEv !== 'default') {
        localStorage.setItem('mifiestapp_theme_' + qEv, JSON.stringify(themeObj));
      }
      localStorage.setItem('mifiestapp_last_theme', JSON.stringify(themeObj));
    } catch (e) {}

    const primColor = themeObj.primaryColor || '#d4af37';
    const secColor = themeObj.secondaryColor || '#aa7c11';
    const primRgb = hexToRgb(primColor);
    const secRgb = hexToRgb(secColor);
    root.style.setProperty('--primary-rgb', primRgb);
    root.style.setProperty('--secondary-rgb', secRgb);
    root.style.setProperty('--gold-primary', primColor);
    root.style.setProperty('--gold-light', primColor);
    root.style.setProperty('--gold-gradient', `linear-gradient(135deg, #ffffff 0%, ${primColor} 50%, ${secColor} 100%)`);
    root.style.setProperty('--card-border', `rgba(${primRgb}, 0.15)`);
    root.style.setProperty('--card-border-active', `rgba(${primRgb}, 0.5)`);
    root.style.setProperty('--gold-glow', `0 0 25px rgba(${primRgb}, 0.25)`);
    root.style.setProperty('--glow-shadow', `0 0 25px rgba(${primRgb}, 0.25)`);
    if (themeObj.fontFamily) {
      root.style.setProperty('--accent-font', themeObj.fontFamily);
    }
    if (themeObj.bgColor) {
      root.style.setProperty('--bg-color', themeObj.bgColor);
      root.style.setProperty('--bg-radial', `radial-gradient(circle at 50% 10%, rgba(${primRgb}, 0.12) 0%, ${themeObj.bgColor} 90%)`);
    }
    const crown = document.querySelector('.logo-container img');
    if (crown && themeObj.crownFilter) {
      crown.style.filter = themeObj.crownFilter;
    }
  }

  // Extract event query parameter for multi-tenancy
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('event') || 'default';
  
  // Load dynamic event title & theme config
  fetch(`/api/config?event=${encodeURIComponent(eventId)}`)
    .then(res => res.json())
    .then(data => {
      if (data) {
        if (data.eventTitle) {
          eventSubtitle.textContent = data.eventTitle;
        }
        applyGuestAppTheme(data.themeDetails || data.eventTheme);
      }
      if (typeof window.hideMiFiestappPreloader === 'function') {
        window.hideMiFiestappPreloader();
      }
    })
    .catch(err => {
      console.error('Error loading event title/theme:', err);
      if (typeof window.hideMiFiestappPreloader === 'function') {
        window.hideMiFiestappPreloader();
      }
    });
  
  let debounceTimeout = null;
  let activeSuggestions = [];

  // Debounced input handler for autocomplete
  nameInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    
    clearTimeout(debounceTimeout);
    
    if (value.length < 2) {
      hideSuggestions();
      return;
    }
    
    debounceTimeout = setTimeout(() => {
      fetchSuggestions(value);
    }, 200);
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!nameInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
      hideSuggestions();
    }
  });

  // Handle Form Submission
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = nameInput.value.trim();
    
    if (!value) return;
    
    // If we have suggestions, check if the exact text matches one
    if (activeSuggestions.length > 0) {
      // Find exact or closest match
      const exactMatch = activeSuggestions.find(
        g => `${g.firstName} ${g.lastName}`.toLowerCase() === value.toLowerCase()
      );
      
      if (exactMatch) {
        selectGuest(exactMatch);
        return;
      }
    }
    
    // Otherwise query backend directly for search
    searchDirectly(value);
  });

  // Back button on ticket
  btnSearchAgain.addEventListener('click', () => {
    resetView();
  });

  // Fetch suggestions helper
  function fetchSuggestions(query) {
    fetch(`/api/guests/search?q=${encodeURIComponent(query)}&event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(data => {
        activeSuggestions = data;
        renderSuggestions(data);
      })
      .catch(err => {
        console.error('Error fetching suggestions:', err);
      });
  }

  // Render suggestions helper
  function renderSuggestions(guests) {
    suggestionsBox.innerHTML = '';
    
    if (guests.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'suggestion-item';
      emptyLi.style.color = '#a0a0a5';
      emptyLi.style.cursor = 'default';
      emptyLi.textContent = 'No se encontraron coincidencias';
      suggestionsBox.appendChild(emptyLi);
      suggestionsBox.style.display = 'block';
      return;
    }
    
    guests.forEach(g => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
      li.textContent = `${g.firstName} ${g.lastName}`;
      li.addEventListener('click', () => {
        nameInput.value = `${g.firstName} ${g.lastName}`;
        hideSuggestions();
        selectGuest(g);
      });
      suggestionsBox.appendChild(li);
    });
    
    suggestionsBox.style.display = 'block';
  }

  function hideSuggestions() {
    suggestionsBox.style.display = 'none';
  }

  // Search directly on server
  function searchDirectly(query) {
    fetch(`/api/guests/search?q=${encodeURIComponent(query)}&event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.length === 0) {
          showError('No se encontró ningún invitado con ese nombre.');
        } else if (data.length === 1) {
          selectGuest(data[0]);
        } else {
          // Multiple results, show suggestions so they can choose
          activeSuggestions = data;
          renderSuggestions(data);
          showError('Se encontraron múltiples coincidencias. Selecciona tu nombre de la lista.');
        }
      })
      .catch(err => {
        console.error('Error on search:', err);
        showError('Ocurrió un error al realizar la búsqueda.');
      });
  }

  // Show inline error feedback elegantly
  function showError(msg) {
    // Remove existing error if any
    const existingErr = document.getElementById('search-error');
    if (existingErr) existingErr.remove();

    const errDiv = document.createElement('div');
    errDiv.id = 'search-error';
    errDiv.style.color = '#e71d36';
    errDiv.style.fontSize = '0.85rem';
    errDiv.style.marginTop = '12px';
    errDiv.style.textAlign = 'center';
    errDiv.textContent = msg;
    
    searchForm.appendChild(errDiv);
    
    // Auto-remove error message on type
    nameInput.addEventListener('input', () => {
      errDiv.remove();
    }, { once: true });
  }

  function buildTableNumberMapping(tableList = []) {
    const mapping = {};
    const usedNumbers = new Set();
    const customAliasTables = [];

    tableList.forEach(tName => {
      const raw = String(tName || '').trim();
      if (!raw || raw.toLowerCase() === 'sin mesa') return;

      if (/principal|presidencial\b/i.test(raw)) {
        mapping[raw] = { number: 0, numberStr: 'Mesa Principal', numOnly: '👑', alias: 'Mesa Principal' };
        return;
      }

      const match = raw.match(/^mesa\s*(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        usedNumbers.add(num);
        mapping[raw] = { number: num, numberStr: `Mesa ${num}`, numOnly: String(num), alias: '' };
      } else {
        customAliasTables.push(raw);
      }
    });

    let nextNum = 1;
    customAliasTables.forEach(raw => {
      while (usedNumbers.has(nextNum)) {
        nextNum++;
      }
      usedNumbers.add(nextNum);
      mapping[raw] = {
        number: nextNum,
        numberStr: `Mesa ${nextNum}`,
        numOnly: String(nextNum),
        alias: raw
      };
    });

    return mapping;
  }

  async function resolveGuestTableNumber(guestTable) {
    if (!guestTable) return { numberStr: 'Sin Mesa', alias: '' };
    const raw = String(guestTable).trim();
    if (raw.toLowerCase() === 'sin mesa') return { numberStr: 'Sin Mesa', alias: '' };
    if (/principal|presidencial\b/i.test(raw)) return { numberStr: 'Mesa Principal', alias: '' };

    if (!cachedHallLayout) {
      try {
        const res = await fetch(`/api/public/hall-layout?event=${encodeURIComponent(eventId)}`);
        const data = await res.json();
        cachedHallLayout = data || {};
      } catch(e) {}
    }

    const tablePositions = cachedHallLayout?.tablePositions || {};
    const tableMapping = buildTableNumberMapping(Object.keys(tablePositions));
    const info = tableMapping[raw] || { numberStr: formatTableDisplay(raw), alias: raw };

    return {
      numberStr: info.numberStr,
      alias: info.alias
    };
  }

  function formatTableDisplay(table) {
    if (!table) return 'Sin Mesa';
    const t = String(table).trim();
    if (t.toLowerCase() === 'sin mesa') return 'Sin Mesa';
    if (/^mesa\b/i.test(t)) {
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
    return `Mesa ${t}`;
  }

  // Select guest and animate VIP ticket reveal
  function selectGuest(guest) {
    // Remove errors
    const existingErr = document.getElementById('search-error');
    if (existingErr) existingErr.remove();

    // Set details
    resultName.textContent = `${guest.firstName} ${guest.lastName}`;
    
    const openMapBtn = document.getElementById('btn-open-hall-map');
    if (openMapBtn) {
      openMapBtn.dataset.rawTable = guest.table || '';
    }
    if (resultTable) {
      resultTable.dataset.rawTable = guest.table || '';
    }

    resolveGuestTableNumber(guest.table).then(({ numberStr, alias }) => {
      resultTable.textContent = numberStr;
      const aliasEl = document.getElementById('result-table-alias');
      if (aliasEl) {
        if (alias && !/^mesa\s*\d+$/i.test(alias)) {
          aliasEl.textContent = `(${alias})`;
          aliasEl.style.display = 'block';
        } else {
          aliasEl.style.display = 'none';
        }
      }
    });

    // Transition out search card and reveal ticket
    searchCard.style.opacity = '0';
    searchCard.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      searchCard.style.display = 'none';
      ticketWrapper.style.display = 'block';
    }, 400);
  }

  // Reset view to search again
  function resetView() {
    ticketWrapper.style.display = 'none';
    searchCard.style.display = 'block';
    
    // Trigger Reflow to animate entrance
    void searchCard.offsetWidth;
    
    searchCard.style.opacity = '1';
    searchCard.style.transform = 'scale(1)';
    nameInput.value = '';
    activeSuggestions = [];
    nameInput.focus();
  }
});
