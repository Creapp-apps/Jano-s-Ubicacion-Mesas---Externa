// miFiestAPP Landing Page JS - Interactive Simulator Logic

document.addEventListener('DOMContentLoaded', () => {
  // --- NAV BAR LOGIC INITIATED ---

  // --- INTERACTIVE SIMULATOR SYSTEM ---
  const steps = document.querySelectorAll('.sim-step');
  const phoneScreenContent = document.getElementById('phone-screen-content');
  const giantScreenContent = document.getElementById('giant-screen-content');

  // Simulated Database for guests
  const mockGuests = {
    'sofia': { name: 'Sofía Rodríguez', table: 'Mesa 4', zone: 'Principal - Sector VIP' },
    'juan': { name: 'Juan Carlos Gómez', table: 'Mesa 12', zone: 'Sector Ventanales - Terraza' },
    'valentina': { name: 'Valentina Martínez', table: 'Mesa 8', zone: 'Cerca de la Pista de Baile' },
    'martin': { name: 'Martín Peralta', table: 'Mesa 1', zone: 'Sector Principal - Familiares' }
  };

  // Preloaded mock photos (beautiful gradient placeholders/illustrations)
  const mockPhotos = {
    toast: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%233b82f6"/><stop offset="100%" style="stop-color:%238b5cf6"/></linearGradient></defs><rect width="300" height="200" fill="url(%23g)"/><circle cx="150" cy="100" r="40" fill="none" stroke="white" stroke-width="4"/><path d="M130 90 L170 110 M170 90 L130 110" stroke="white" stroke-width="4" stroke-linecap="round"/><text x="150" y="170" fill="white" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">✨ ¡Salud y Felicidades! ✨</text></svg>',
    cake: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%23ec4899"/><stop offset="100%" style="stop-color:%23f43f5e"/></linearGradient></defs><rect width="300" height="200" fill="url(%23g)"/><path d="M100 150 L200 150 L180 90 L120 90 Z" fill="white" opacity="0.9"/><path d="M120 90 L180 90 L170 50 L130 50 Z" fill="white" opacity="0.8"/><circle cx="150" cy="35" r="10" fill="red"/><text x="150" y="180" fill="white" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">🍰 ¡Que vivan los novios! 🍰</text></svg>',
    selfie: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%23f59e0b"/><stop offset="100%" style="stop-color:%2310b981"/></linearGradient></defs><rect width="300" height="200" fill="url(%23g)"/><path d="M150 70 A 25 25 0 1 0 150 120 A 25 25 0 1 0 150 70 Z M110 170 C 110 140, 190 140, 190 170" fill="none" stroke="white" stroke-width="5" stroke-linecap="round"/><text x="150" y="185" fill="white" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">📸 ¡Selfie de la mesa! 📸</text></svg>'
  };

  let selectedPhotoUrl = null;

  // Active step change listener
  steps.forEach(step => {
    step.addEventListener('click', () => {
      // Remove active from all steps
      steps.forEach(s => s.classList.remove('active'));
      step.classList.add('active');

      const service = step.dataset.service;
      renderPhoneScreen(service);
    });
  });

  // Function to render content inside the Phone screen
  function renderPhoneScreen(service) {
    if (service === 'tables') {
      phoneScreenContent.innerHTML = `
        <div class="sim-screen-tables">
          <div class="sim-search-box">
            <input type="text" id="sim-guest-input" class="sim-search-input" placeholder="Escribí tu nombre..." autocomplete="off">
            <svg class="sim-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>
          <div class="sim-presets">
            <button class="sim-preset-btn" data-name="sofia">Sofía</button>
            <button class="sim-preset-btn" data-name="juan">Juan</button>
            <button class="sim-preset-btn" data-name="valentina">Valentina</button>
          </div>
          <div class="sim-tables-result" id="sim-tables-result">
            <div class="sim-empty-state">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              <span>Buscá tu nombre arriba para probar el localizador en tiempo real.</span>
            </div>
          </div>
        </div>
      `;

      // Setup searching logic
      const input = document.getElementById('sim-guest-input');
      const resultDiv = document.getElementById('sim-tables-result');

      input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        handleSearch(query, resultDiv);
      });

      // Preset click logic
      document.querySelectorAll('.sim-preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const name = btn.dataset.name;
          input.value = btn.textContent;
          handleSearch(name, resultDiv);
        });
      });

    } else if (service === 'photos') {
      phoneScreenContent.innerHTML = `
        <div class="sim-screen-photos">
          <div class="sim-photo-upload-zone" id="sim-upload-zone">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <div class="sim-photo-upload-label" id="sim-upload-text">Seleccionar Foto de Galería</div>
            <div class="sim-photo-upload-sub">Tocá para elegir una foto de prueba</div>
          </div>
          
          <div class="sim-photo-preview-box" id="sim-preview-box">
            <button class="sim-photo-preview-remove" id="sim-preview-remove">&times;</button>
          </div>

          <textarea id="sim-photo-msg" class="sim-input-msg" placeholder="Escribí un saludo o dedicatoria..." maxlength="70"></textarea>
          
          <button id="sim-photo-submit" class="sim-submit-btn" disabled>Enviar a Pantalla</button>
        </div>
      `;

      // Upload triggers
      const uploadZone = document.getElementById('sim-upload-zone');
      const previewBox = document.getElementById('sim-preview-box');
      const previewRemove = document.getElementById('sim-preview-remove');
      const submitBtn = document.getElementById('sim-photo-submit');
      const msgInput = document.getElementById('sim-photo-msg');

      // Setup simulated upload options
      uploadZone.addEventListener('click', () => {
        // Cycle mock photos for demonstration
        const photoKeys = Object.keys(mockPhotos);
        const randomKey = photoKeys[Math.floor(Math.random() * photoKeys.length)];
        selectedPhotoUrl = mockPhotos[randomKey];

        // UI change
        uploadZone.style.display = 'none';
        previewBox.style.backgroundImage = `url('${selectedPhotoUrl}')`;
        previewBox.style.display = 'block';
        submitBtn.removeAttribute('disabled');
      });

      // Remove preview logic
      previewRemove.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedPhotoUrl = null;
        previewBox.style.display = 'none';
        uploadZone.style.display = 'block';
        submitBtn.setAttribute('disabled', 'true');
      });

      // Submit photo logic
      submitBtn.addEventListener('click', () => {
        if (!selectedPhotoUrl) return;
        
        submitBtn.innerText = 'Enviando...';
        submitBtn.setAttribute('disabled', 'true');

        setTimeout(() => {
          // Project onto the Salon LED Screen Mockup next to the phone
          const ledPhoto = document.getElementById('led-live-photo');
          const ledMsg = document.getElementById('led-live-msg');
          const ledBadge = document.getElementById('led-live-badge');
          const ledPlaceholder = document.getElementById('led-placeholder-txt');

          if (ledPhoto && ledMsg && ledBadge && ledPlaceholder) {
            ledPlaceholder.style.display = 'none';
            
            ledPhoto.style.backgroundImage = `url('${selectedPhotoUrl}')`;
            ledPhoto.style.display = 'block';
            
            const message = msgInput.value.trim() || '¡Que disfruten mucho esta hermosa noche!';
            ledMsg.innerText = message;
            ledMsg.style.display = 'block';
            
            ledBadge.style.display = 'block';

            // Glow animation
            const giant = document.querySelector('.giant-screen-mockup');
            giant.style.boxShadow = '0 15px 35px rgba(0,0,0,0.8), 0 0 30px rgba(16, 185, 129, 0.4)';
            setTimeout(() => {
              giant.style.boxShadow = '0 15px 35px rgba(0,0,0,0.8), 0 0 20px rgba(212, 175, 55, 0.1)';
            }, 2000);
          }

          submitBtn.innerText = '¡Enviada con Éxito!';
          setTimeout(() => {
            // Reset phone form
            previewBox.style.display = 'none';
            uploadZone.style.display = 'block';
            msgInput.value = '';
            selectedPhotoUrl = null;
            submitBtn.innerText = 'Enviar a Pantalla';
          }, 1500);

        }, 1000);
      });

    } else if (service === 'invitation') {
      phoneScreenContent.innerHTML = `
        <div class="sim-screen-invitation">
          <div class="sim-inv-header">Invitación Digital</div>
          <div class="sim-inv-countdown">
            <div class="sim-countdown-box">
              <div class="sim-countdown-num" id="sim-days">24</div>
              <div class="sim-countdown-lbl">Días</div>
            </div>
            <div class="sim-countdown-box">
              <div class="sim-countdown-num" id="sim-hours">15</div>
              <div class="sim-countdown-lbl">Hrs</div>
            </div>
            <div class="sim-countdown-box">
              <div class="sim-countdown-num" id="sim-mins">32</div>
              <div class="sim-countdown-lbl">Min</div>
            </div>
          </div>
          <div class="sim-inv-details">
            <div class="sim-detail-row">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div class="sim-detail-txt">Sábado, 21:00 hs</div>
            </div>
            <div class="sim-detail-row">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <div class="sim-detail-txt">Salón Gold Palace, CABA</div>
            </div>
            <div class="sim-detail-row">
              <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"></path>
              </svg>
              <div class="sim-detail-txt">Dress Code: Elegante</div>
            </div>
          </div>
          <button class="sim-inv-map-btn" id="sim-map-btn">Ver Cómo Llegar</button>
        </div>
      `;

      // Interactive map button click
      const mapBtn = document.getElementById('sim-map-btn');
      mapBtn.addEventListener('click', () => {
        mapBtn.innerText = 'Abriendo Google Maps...';
        setTimeout(() => {
          mapBtn.innerText = '¡Ubicación cargada!';
          setTimeout(() => {
            mapBtn.innerText = 'Ver Cómo Llegar';
          }, 1500);
        }, 800);
      });

      // Update timer counts dynamically inside simulator
      startMockTimer();
    }
  }

  // Real-time searching simulation helper
  function handleSearch(query, resultContainer) {
    if (!query) {
      resultContainer.innerHTML = `
        <div class="sim-empty-state">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <span>Buscá tu nombre arriba para probar el localizador en tiempo real.</span>
        </div>
      `;
      return;
    }

    resultContainer.innerHTML = `
      <div class="sim-empty-state">
        <svg class="animate-spin" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="animation: spin 1s linear infinite; width: 20px; height: 20px;">
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.1)" stroke-dasharray="32" />
          <path d="M4 12a8 8 0 018-8v0" stroke="var(--gold-primary)" />
        </svg>
        <span>Buscando en la lista de invitados...</span>
      </div>
    `;

    // Add keyframe for spin dynamically if not present
    if (!document.getElementById('spin-keyframe')) {
      const style = document.createElement('style');
      style.id = 'spin-keyframe';
      style.innerHTML = `@keyframes spin { to { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    setTimeout(() => {
      // Find guest
      const matchedKey = Object.keys(mockGuests).find(k => query.includes(k) || k.includes(query));
      const guest = mockGuests[matchedKey];

      if (guest) {
        resultContainer.innerHTML = `
          <div class="sim-ticket-card">
            <div class="sim-ticket-logo">miFiestAPP SERVICES</div>
            <div class="sim-ticket-name">${guest.name}</div>
            <div class="sim-ticket-grid">
              <div>
                <div class="sim-ticket-label">Ubicación</div>
                <div class="sim-ticket-val">${guest.table}</div>
              </div>
              <div>
                <div class="sim-ticket-label">Referencia</div>
                <div class="sim-ticket-val" style="font-size: 0.55rem; color: #fff; font-weight: normal; margin-top: 2px;">${guest.zone}</div>
              </div>
            </div>
          </div>
        `;
      } else {
        resultContainer.innerHTML = `
          <div class="sim-empty-state">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #ef4444;">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <span style="color: #ef4444;">Invitado no encontrado</span>
            <span style="font-size: 0.6rem; max-width: 180px; margin-top: 4px;">Probá con "Sofía", "Juan" o "Valentina" para ver el resultado de ejemplo.</span>
          </div>
        `;
      }
    }, 400);
  }

  // Dynamic simulated countdown timer helper
  let timerInterval = null;
  function startMockTimer() {
    if (timerInterval) clearInterval(timerInterval);

    let days = 24;
    let hours = 15;
    let minutes = 32;

    const daysEl = document.getElementById('sim-days');
    const hoursEl = document.getElementById('sim-hours');
    const minsEl = document.getElementById('sim-mins');

    timerInterval = setInterval(() => {
      minutes--;
      if (minutes < 0) {
        minutes = 59;
        hours--;
        if (hours < 0) {
          hours = 23;
          days--;
          if (days < 0) {
            days = 30; // cycle back
          }
        }
      }

      if (daysEl) daysEl.innerText = days;
      if (hoursEl) hoursEl.innerText = hours;
      if (minsEl) minsEl.innerText = minutes;
    }, 60000); // update every minute simulation
  }

  // Initialize with the Tables Screen
  renderPhoneScreen('tables');

  // --- FAQ ACCORDION HANDLERS ---
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-q');
    question.addEventListener('click', () => {
      // Toggle active status
      const isActive = item.classList.contains('active');
      
      // Close all items
      faqItems.forEach(i => i.classList.remove('active'));
      
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // --- CLIENT LOGIN MODAL HANDLERS ---
  const clientLoginModal = document.getElementById('client-login-modal');
  const openClientLoginBtn = document.getElementById('open-client-login-btn');
  const closeClientLoginBtn = document.getElementById('close-client-login-btn');
  const modalLoginForm = document.getElementById('modal-login-form');
  const modalErrorMsg = document.getElementById('modal-error-message');

  // --- PASSWORD TOGGLE FOR CLIENT LOGIN MODAL ---
  const modalToggleBtn = document.getElementById('modal-toggle-password');
  const modalPasswordInput = document.getElementById('modal-password');
  const modalEyeIcon = document.getElementById('modal-eye-icon');

  const eyeOpenPath = 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z';
  const eyeClosedPath = 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.82l2.92 2.92c1.51-1.39 2.7-3.18 3.44-5.24-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15c.01-.06.01-.12.01-.17 0-1.66-1.34-3-3-3-.05 0-.11 0-.17.01z';

  if (modalToggleBtn && modalPasswordInput && modalEyeIcon) {
    modalToggleBtn.addEventListener('click', () => {
      if (modalPasswordInput.type === 'password') {
        modalPasswordInput.type = 'text';
        modalEyeIcon.innerHTML = `<path d="${eyeClosedPath}"/>`;
      } else {
        modalPasswordInput.type = 'password';
        modalEyeIcon.innerHTML = `<path d="${eyeOpenPath}"/>`;
      }
    });
  }

  if (openClientLoginBtn && clientLoginModal) {
    openClientLoginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clientLoginModal.classList.add('active');
      modalErrorMsg.classList.remove('visible');
      modalLoginForm.reset();
      if (modalPasswordInput) {
        modalPasswordInput.type = 'password';
        if (modalEyeIcon) modalEyeIcon.innerHTML = `<path d="${eyeOpenPath}"/>`;
      }
    });
  }

  if (closeClientLoginBtn && clientLoginModal) {
    closeClientLoginBtn.addEventListener('click', () => {
      clientLoginModal.classList.remove('active');
    });
    
    // Close on overlay click
    clientLoginModal.addEventListener('click', (e) => {
      if (e.target === clientLoginModal) {
        clientLoginModal.classList.remove('active');
      }
    });
  }

  if (modalLoginForm) {
    modalLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('modal-email').value.trim();
      const password = document.getElementById('modal-password').value;
      const submitBtn = modalLoginForm.querySelector('.modal-submit-btn');
      
      modalErrorMsg.classList.remove('visible');
      submitBtn.innerText = 'Ingresando...';
      submitBtn.setAttribute('disabled', 'true');
      
      try {
        const response = await fetch('/api/admin/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ password, email })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success && data.eventId) {
          // Success! Redirect to the event's guest portal home page using the returned slug
          window.location.href = `/event.html?event=${encodeURIComponent(data.eventId)}`;
        } else {
          modalErrorMsg.textContent = data.error || 'Email o contraseña incorrectos';
          modalErrorMsg.classList.add('visible');
          submitBtn.innerText = 'Ingresar al Panel';
          submitBtn.removeAttribute('disabled');
        }
      } catch (err) {
        modalErrorMsg.textContent = 'Error al conectar con el servidor';
        modalErrorMsg.classList.add('visible');
        submitBtn.innerText = 'Ingresar al Panel';
        submitBtn.removeAttribute('disabled');
      }
    });
  }

  // --- TUBELIGHT FLOATING NAVBAR & SCROLL SPY ---
  const sections = document.querySelectorAll('section[id]');
  const navItems = document.querySelectorAll('.nav-item-link');
  const indicator = document.querySelector('.nav-lamp-indicator');

  function updateIndicator() {
    const activeLink = document.querySelector('.nav-item-link.active');
    if (activeLink && indicator) {
      indicator.style.width = `${activeLink.offsetWidth}px`;
      indicator.style.left = `${activeLink.offsetLeft}px`;
    }
  }

  // Set active link and animate immediately on click
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(link => link.classList.remove('active'));
      item.classList.add('active');
      updateIndicator();
    });
  });

  // IntersectionObserver for active section tracking (Scroll Spy)
  const observerOptions = {
    root: null,
    rootMargin: '-25% 0px -55% 0px', // Focus window centered on the screen
    threshold: 0
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        const correspondingLink = document.querySelector(`.nav-item-link[href="#${id}"]`);
        
        if (correspondingLink) {
          navItems.forEach(link => link.classList.remove('active'));
          correspondingLink.classList.add('active');
          updateIndicator();
        }
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));

  // Handle initial state and updates on load, resize or font loading
  updateIndicator();
  window.addEventListener('resize', updateIndicator);
  window.addEventListener('load', updateIndicator);
  
  // Add small delays to guarantee rendering precision after page adjustments
  setTimeout(updateIndicator, 200);
  setTimeout(updateIndicator, 500);
});

