/**
 * miFiestAPP - Official Mobile App Client Logic
 */

let appState = {
  eventId: null,
  eventData: null,
  guest: null,
  activeSection: 'home',
  awards: [],
  sseSource: null,
  cameraStream: null
};

// DOM Elements
const elements = {
  header: document.getElementById('app-header'),
  brandTitle: document.getElementById('app-brand-title'),
  burgerBtn: document.getElementById('burger-btn'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),
  sidebarDrawer: document.getElementById('sidebar-drawer'),
  headerAvatarBadge: document.getElementById('header-avatar-badge'),
  sidebarAvatar: document.getElementById('sidebar-avatar'),
  sidebarGuestName: document.getElementById('sidebar-guest-name'),
  sidebarTableTag: document.getElementById('sidebar-table-tag'),
  toast: document.getElementById('app-toast'),
  toastMessage: document.getElementById('toast-message'),

  // Screens
  screenGatekeeper: document.getElementById('screen-gatekeeper'),
  screenGuestWelcome: document.getElementById('screen-guest-welcome'),
  screenLookOnboarding: document.getElementById('screen-look-onboarding'),
  screenAppHub: document.getElementById('screen-app-hub'),

  // Code input
  eventCodeInput: document.getElementById('event-code-input'),
  btnVerifyCode: document.getElementById('btn-verify-code'),
  codeErrorMsg: document.getElementById('code-error-msg'),

  // Guest Welcome (Pase inicial)
  welcomeNameInput: document.getElementById('welcome-name-input'),
  welcomeTableInput: document.getElementById('welcome-table-input'),
  btnActivatePass: document.getElementById('btn-activate-pass'),

  // Look onboarding / Studio
  lookVideo: document.getElementById('look-video'),
  lookCanvas: document.getElementById('look-canvas'),
  lookImagePreview: document.getElementById('look-image-preview'),
  btnCaptureLook: document.getElementById('btn-capture-look'),
  btnRetakeLook: document.getElementById('btn-retake-look'),
  lookFileInput: document.getElementById('look-file-input'),
  btnSaveLookProfile: document.getElementById('btn-save-look-profile')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkInitialRouteAndState();
});

function setupEventListeners() {
  // Burger & Drawer
  if (elements.burgerBtn) {
    elements.burgerBtn.addEventListener('click', toggleSidebar);
  }
  if (elements.sidebarOverlay) {
    elements.sidebarOverlay.addEventListener('click', closeSidebar);
  }
  if (elements.headerAvatarBadge) {
    elements.headerAvatarBadge.addEventListener('click', () => navigateToSection('mis-datos'));
  }

  // Sidebar navigation links
  document.querySelectorAll('[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      navigateToSection(section);
      closeSidebar();
    });
  });

  // Event Code Gatekeeper
  if (elements.btnVerifyCode) {
    elements.btnVerifyCode.addEventListener('click', () => {
      const code = elements.eventCodeInput.value.trim();
      verifyAndLoadEvent(code);
    });
  }

  if (elements.eventCodeInput) {
    elements.eventCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = elements.eventCodeInput.value.trim();
        verifyAndLoadEvent(code);
      }
    });
    // Auto-uppercase
    elements.eventCodeInput.addEventListener('input', (e) => {
      elements.eventCodeInput.value = elements.eventCodeInput.value.toUpperCase();
      if (elements.codeErrorMsg) elements.codeErrorMsg.style.display = 'none';
    });
  }

  // Guest Welcome Activation
  if (elements.btnActivatePass) {
    elements.btnActivatePass.addEventListener('click', handleInitialPassActivation);
  }
  if (elements.welcomeNameInput) {
    elements.welcomeNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleInitialPassActivation();
    });
  }

  // Switch event
  const switchBtn = document.getElementById('switch-event-btn');
  if (switchBtn) {
    switchBtn.addEventListener('click', () => {
      localStorage.removeItem('mifiestapp_active_event');
      location.reload();
    });
  }

  // Look Camera Capture
  if (elements.btnCaptureLook) {
    elements.btnCaptureLook.addEventListener('click', captureSelfieFromVideo);
  }
  if (elements.btnRetakeLook) {
    elements.btnRetakeLook.addEventListener('click', startCameraPreview);
  }
  if (elements.lookFileInput) {
    elements.lookFileInput.addEventListener('change', handleFileInputLook);
  }
  if (elements.btnSaveLookProfile) {
    elements.btnSaveLookProfile.addEventListener('click', saveGuestProfile);
  }
}

// Check stored session or URL parameter
async function checkInitialRouteAndState() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramEvent = urlParams.get('event') || urlParams.get('code') || urlParams.get('fiesta');
  const paramName = urlParams.get('n') || urlParams.get('nombre') || urlParams.get('guest');
  const paramTable = urlParams.get('table') || urlParams.get('mesa') || '';
  const isCheckin = urlParams.get('checkin') === '1';

  const storedEvent = localStorage.getItem('mifiestapp_active_event');
  const storedGuest = localStorage.getItem('mifiestapp_guest_profile');

  if (storedGuest) {
    try {
      appState.guest = JSON.parse(storedGuest);
    } catch (e) {}
  }

  if (paramName && elements.welcomeNameInput) {
    elements.welcomeNameInput.value = paramName.trim();
  }

  if (isCheckin && paramName) {
    // Receptionist scanned QR pass
    showToast(`✅ ACCESO CONFIRMADO: ${paramName} ${paramTable ? '• ' + paramTable : ''} 🌟`);
  }

  if (paramEvent) {
    await verifyAndLoadEvent(paramEvent);
  } else if (storedEvent) {
    try {
      const parsed = JSON.parse(storedEvent);
      appState.eventId = parsed.eventId;
      appState.eventData = parsed;
      applyEventData(parsed);
      validateGuestOrShowHub();
    } catch (e) {
      showGatekeeper();
    }
  } else {
    showGatekeeper();
  }
}

// Verify Code via API
async function verifyAndLoadEvent(code) {
  if (!code) {
    showCodeError('Por favor ingresá un código de fiesta válido.');
    return;
  }

  if (elements.btnVerifyCode) {
    elements.btnVerifyCode.disabled = true;
    elements.btnVerifyCode.innerHTML = '<span>Verificando...</span>';
  }

  try {
    const res = await fetch('/api/app/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showCodeError(data.error || 'Código incorrecto o evento inactivo.');
      return;
    }

    appState.eventId = data.eventId;
    appState.eventData = data;
    localStorage.setItem('mifiestapp_active_event', JSON.stringify(data));

    applyEventData(data);
    validateGuestOrShowHub();
  } catch (err) {
    showCodeError('Error al conectar con el servidor. Reintentá.');
  } finally {
    if (elements.btnVerifyCode) {
      elements.btnVerifyCode.disabled = false;
      elements.btnVerifyCode.innerHTML = '<span>Ingresar a la Fiesta ➔</span>';
    }
  }
}

function showCodeError(msg) {
  if (elements.codeErrorMsg) {
    elements.codeErrorMsg.textContent = msg;
    elements.codeErrorMsg.style.display = 'block';
  } else {
    showToast(msg);
  }
}

// Apply Event branding and metadata
function applyEventData(data) {
  if (elements.brandTitle) {
    elements.brandTitle.textContent = data.title || data.clientName || 'miFiestAPP';
  }

  // Update hero texts
  const heroTitle = document.getElementById('hub-event-title');
  const heroDate = document.getElementById('hub-event-date');
  if (heroTitle) heroTitle.textContent = data.title || data.clientName || 'Nuestra Fiesta';
  
  const dateValue = (data.info && data.info.date) || data.date || (data.eventData && data.eventData.date);
  const timeValue = (data.info && data.info.time) || data.time;
  if (heroDate) {
    if (dateValue) {
      heroDate.textContent = `📅 ${dateValue} ${timeValue ? '• ' + timeValue + ' hs' : ''}`;
    } else {
      heroDate.textContent = '✨ ¡Bienvenidos a la Fiesta!';
    }
  }

  // Update dynamic content in sections
  renderEventInfo(data.info);
  renderTimeline(data.info ? data.info.timeline : []);
  renderGifts(data.info ? data.info.gifts : null);
  renderTransport(data.info ? data.info.transport : null);

  // Setup SSE stream for live updates
  setupSSEAwardsStream(data.eventId);

  // Apply dynamic official event theme
  const eventTheme = (data.info && data.info.theme) || data.theme || 'golden-luxury';
  applyMobileTheme(eventTheme);
}

function applyMobileTheme(themeId) {
  const THEME_PALETTES = {
    'golden-luxury': { primary: '#d4af37', secondary: '#aa7c11', bgColor: '#0b0b0c', glow1: 'rgba(212, 175, 55, 0.22)', glow2: 'rgba(170, 124, 17, 0.16)', crownFilter: 'drop-shadow(0 0 16px rgba(212, 175, 55, 0.55))', font: "'Cinzel', serif" },
    'rose-gold': { primary: '#e0a899', secondary: '#b76e79', bgColor: '#0d0b0f', glow1: 'rgba(224, 168, 153, 0.24)', glow2: 'rgba(183, 110, 121, 0.18)', crownFilter: 'hue-rotate(305deg) saturate(1.4) brightness(1.1) drop-shadow(0 0 18px rgba(224, 168, 153, 0.6))', font: "'Playfair Display', serif" },
    'cyber-neon': { primary: '#00f3ff', secondary: '#ff007f', bgColor: '#080511', glow1: 'rgba(0, 243, 255, 0.26)', glow2: 'rgba(255, 0, 127, 0.20)', crownFilter: 'hue-rotate(145deg) saturate(2.6) brightness(1.15) drop-shadow(0 0 22px rgba(0, 243, 255, 0.75))', font: "'Montserrat', sans-serif" },
    'emerald-royal': { primary: '#2ec4b6', secondary: '#0d5c46', bgColor: '#060d0a', glow1: 'rgba(46, 196, 182, 0.24)', glow2: 'rgba(212, 175, 55, 0.15)', crownFilter: 'hue-rotate(95deg) saturate(1.9) brightness(1.05) drop-shadow(0 0 18px rgba(46, 196, 182, 0.65))', font: "'Cinzel', serif" },
    'midnight-navy': { primary: '#4cc9f0', secondary: '#1e3a8a', bgColor: '#050a14', glow1: 'rgba(76, 201, 240, 0.26)', glow2: 'rgba(212, 175, 55, 0.14)', crownFilter: 'hue-rotate(185deg) saturate(2.2) brightness(1.1) drop-shadow(0 0 20px rgba(76, 201, 240, 0.7))', font: "'Cinzel', serif" },
    'boho-rust': { primary: '#e07a5f', secondary: '#81b29a', bgColor: '#0e0b09', glow1: 'rgba(224, 122, 95, 0.24)', glow2: 'rgba(238, 217, 196, 0.15)', crownFilter: 'hue-rotate(335deg) saturate(1.3) sepia(0.25) drop-shadow(0 0 16px rgba(224, 122, 95, 0.55))', font: "'Outfit', sans-serif" },
    'retro-disco': { primary: '#ff0080', secondary: '#7928ca', bgColor: '#0b0614', glow1: 'rgba(255, 0, 128, 0.28)', glow2: 'rgba(121, 40, 202, 0.22)', crownFilter: 'hue-rotate(265deg) saturate(2.8) brightness(1.2) drop-shadow(0 0 22px rgba(255, 0, 128, 0.75))', font: "'Syncopate', sans-serif" }
  };

  function hexToRgb(hex) {
    if (!hex) return '212, 175, 55';
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return '212, 175, 55';
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  const themeKey = (typeof themeId === 'string' ? themeId : (themeId && themeId.id)) || 'golden-luxury';
  const pal = THEME_PALETTES[themeKey] || THEME_PALETTES['golden-luxury'];
  const root = document.documentElement;

  const primRgb = hexToRgb(pal.primary);
  const secRgb = hexToRgb(pal.secondary);

  root.style.setProperty('--primary-rgb', primRgb);
  root.style.setProperty('--secondary-rgb', secRgb);
  root.style.setProperty('--gold-primary', pal.primary);
  root.style.setProperty('--gold-secondary', pal.secondary);
  root.style.setProperty('--gold-light', pal.primary);
  root.style.setProperty('--border-gold-bright', pal.primary);
  root.style.setProperty('--border-gold', `rgba(${primRgb}, 0.25)`);
  root.style.setProperty('--gold-gradient', `linear-gradient(135deg, #ffffff 0%, ${pal.primary} 50%, ${pal.secondary} 100%)`);
  root.style.setProperty('--gold-glow', `0 0 25px ${pal.glow1}`);
  root.style.setProperty('--bg-dark', pal.bgColor || '#09090b');
  if (pal.font) {
    root.style.setProperty('--accent-font', pal.font);
  }

  // Update Mesh Glows
  const glow1 = document.querySelector('.mesh-glow-1');
  const glow2 = document.querySelector('.mesh-glow-2');
  if (glow1) glow1.style.background = `radial-gradient(circle, ${pal.glow1} 0%, transparent 70%)`;
  if (glow2) glow2.style.background = `radial-gradient(circle, ${pal.glow2} 0%, transparent 70%)`;

  // Update Crowns & Logos
  document.querySelectorAll('.app-brand img, .gatekeeper-logo, #header-crown, #sidebar-avatar, #app-header-crown').forEach(img => {
    if (pal.crownFilter) {
      img.style.filter = pal.crownFilter;
    }
  });

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event') || (window.location.pathname.split('/')[1] || '').replace('.html', '') || 'default';
    if (eventId && eventId !== 'default') {
      localStorage.setItem('mifiestapp_theme_' + eventId, JSON.stringify(pal));
    }
    localStorage.setItem('mifiestapp_last_theme', JSON.stringify(pal));
  } catch (e) {}
}

// Check if Guest Profile is completed
function validateGuestOrShowHub() {
  if (!appState.guest || !appState.guest.name) {
    showGuestWelcome();
  } else {
    updateProfileUI();
    showAppHub();
  }
}

function showGatekeeper() {
  if (elements.header) elements.header.style.display = 'none';
  if (elements.screenGatekeeper) elements.screenGatekeeper.classList.add('active');
  if (elements.screenGuestWelcome) elements.screenGuestWelcome.classList.remove('active');
  if (elements.screenLookOnboarding) elements.screenLookOnboarding.classList.remove('active');
  if (elements.screenAppHub) elements.screenAppHub.classList.remove('active');
}

function showGuestWelcome() {
  if (elements.header) elements.header.style.display = 'none';
  if (elements.screenGatekeeper) elements.screenGatekeeper.classList.remove('active');
  if (elements.screenGuestWelcome) elements.screenGuestWelcome.classList.add('active');
  if (elements.screenLookOnboarding) elements.screenLookOnboarding.classList.remove('active');
  if (elements.screenAppHub) elements.screenAppHub.classList.remove('active');

  const urlParams = new URLSearchParams(window.location.search);
  const paramName = urlParams.get('n') || urlParams.get('nombre') || '';
  if (elements.welcomeNameInput && !elements.welcomeNameInput.value && paramName) {
    elements.welcomeNameInput.value = paramName.trim();
  }
}

// Activar Pase Inicial (Solo Nombre y Apellido)
async function handleInitialPassActivation() {
  const name = elements.welcomeNameInput ? elements.welcomeNameInput.value.trim() : '';

  if (!name) {
    showToast('Por favor, ingresá tu nombre y apellido.');
    return;
  }

  const profile = {
    id: appState.guest ? appState.guest.id : 'guest_' + Date.now(),
    name,
    tableNumber: appState.guest ? appState.guest.tableNumber : 'Sin Mesa Asignada',
    avatarUrl: (appState.guest && appState.guest.avatarUrl) ? appState.guest.avatarUrl : '/assets/coronamain.png'
  };

  appState.guest = profile;
  localStorage.setItem('mifiestapp_guest_profile', JSON.stringify(profile));

  // Sync with DB
  try {
    const res = await fetch('/api/app/guest-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: appState.eventId || 'default',
        guestId: profile.id,
        name: profile.name,
        tableNumber: profile.tableNumber,
        avatarUrl: profile.avatarUrl
      })
    });
    const data = await res.json();
    if (data.success && data.profile) {
      appState.guest = data.profile;
      localStorage.setItem('mifiestapp_guest_profile', JSON.stringify(data.profile));
    }
  } catch (e) {}

  showToast(`¡Pase VIP activado! Bienvenido/a ${name} 🌟`);
  updateProfileUI();
  showAppHub();
}

// Handler de descarga de la App Oficial
function handleDownloadAppClick() {
  showToast('🚀 Preparando descarga oficial de miFiestAPP...');
  // Check if iOS or Android for future Store links or PWA prompt
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);

  if (isIOS) {
    showToast('🍎 Próximamente disponible en App Store');
  } else if (isAndroid) {
    showToast('🤖 Próximamente disponible en Google Play');
  } else {
    showToast('✨ Aplicación oficial miFiestAPP para móviles');
  }
}

// Mostrar Estudio de Look de Gala (Día de la Fiesta o a pedido)
function showLookStudio() {
  if (elements.header) elements.header.style.display = 'none';
  if (elements.screenGatekeeper) elements.screenGatekeeper.classList.remove('active');
  if (elements.screenGuestWelcome) elements.screenGuestWelcome.classList.remove('active');
  if (elements.screenLookOnboarding) elements.screenLookOnboarding.classList.add('active');
  if (elements.screenAppHub) elements.screenAppHub.classList.remove('active');

  startCameraPreview();
}

function showAppHub() {
  if (elements.header) elements.header.style.display = 'flex';
  if (elements.screenGatekeeper) elements.screenGatekeeper.classList.remove('active');
  if (elements.screenGuestWelcome) elements.screenGuestWelcome.classList.remove('active');
  if (elements.screenLookOnboarding) elements.screenLookOnboarding.classList.remove('active');
  if (elements.screenAppHub) elements.screenAppHub.classList.add('active');

  stopCameraStream();
  navigateToSection('home');
  loadAwardsData();
}

// Helper: Generar iniciales a partir del nombre
function getInitials(name) {
  if (!name) return 'VIP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Camera Management for Look
async function startCameraPreview() {
  if (elements.lookImagePreview) elements.lookImagePreview.style.display = 'none';
  if (elements.lookVideo) elements.lookVideo.style.display = 'block';
  if (elements.btnCaptureLook) elements.btnCaptureLook.style.display = 'inline-flex';
  if (elements.btnRetakeLook) elements.btnRetakeLook.style.display = 'none';

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      appState.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      if (elements.lookVideo) {
        elements.lookVideo.srcObject = appState.cameraStream;
        elements.lookVideo.play();
      }
    }
  } catch (err) {
    console.warn('[Camera Access]', err);
  }
}

function stopCameraStream() {
  if (appState.cameraStream) {
    appState.cameraStream.getTracks().forEach(t => t.stop());
    appState.cameraStream = null;
  }
}

function captureSelfieFromVideo() {
  if (!elements.lookVideo || !elements.lookCanvas) return;
  const canvas = elements.lookCanvas;
  const video = elements.lookVideo;
  const size = Math.min(video.videoWidth || 400, video.videoHeight || 400);

  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  
  // Center crop square
  const sx = ((video.videoWidth || 400) - size) / 2;
  const sy = ((video.videoHeight || 400) - size) / 2;

  // Mirror effect for frontal camera
  ctx.translate(400, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, sx, sy, size, size, 0, 0, 400, 400);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  elements.lookImagePreview.src = dataUrl;
  elements.lookImagePreview.style.display = 'block';
  elements.lookVideo.style.display = 'none';
  if (elements.btnCaptureLook) elements.btnCaptureLook.style.display = 'none';
  if (elements.btnRetakeLook) elements.btnRetakeLook.style.display = 'inline-flex';
  stopCameraStream();
}

function handleFileInputLook(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    elements.lookImagePreview.src = evt.target.result;
    elements.lookImagePreview.style.display = 'block';
    if (elements.lookVideo) elements.lookVideo.style.display = 'none';
    if (elements.btnCaptureLook) elements.btnCaptureLook.style.display = 'none';
    if (elements.btnRetakeLook) elements.btnRetakeLook.style.display = 'inline-flex';
    stopCameraStream();
  };
  reader.readAsDataURL(file);
}

// Guardar Foto de Look de Gala
async function saveGuestProfile() {
  const name = appState.guest ? appState.guest.name : 'Invitado VIP';
  const table = appState.guest ? appState.guest.tableNumber : 'Sin Mesa';
  const avatarUrl = elements.lookImagePreview && elements.lookImagePreview.src && elements.lookImagePreview.style.display !== 'none'
    ? elements.lookImagePreview.src
    : (appState.guest ? appState.guest.avatarUrl : '/assets/coronamain.png');

  if (elements.btnSaveLookProfile) {
    elements.btnSaveLookProfile.disabled = true;
    elements.btnSaveLookProfile.innerHTML = '<span>Guardando Look...</span>';
  }

  try {
    const payload = {
      eventId: appState.eventId || 'default',
      guestId: appState.guest ? appState.guest.id : undefined,
      name,
      tableNumber: table,
      avatarUrl
    };

    const res = await fetch('/api/app/guest-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      appState.guest = data.profile;
      localStorage.setItem('mifiestapp_guest_profile', JSON.stringify(data.profile));
      showToast('¡Tu look oficial de gala fue guardado con éxito! 🌟');
      updateProfileUI();
      showAppHub();
    } else {
      showToast(data.error || 'Error al guardar look.');
    }
  } catch (err) {
    showToast('Error de conexión al guardar look.');
  } finally {
    if (elements.btnSaveLookProfile) {
      elements.btnSaveLookProfile.disabled = false;
      elements.btnSaveLookProfile.innerHTML = '<span>Guardar Mi Look de Gala ✓</span>';
    }
  }
}

// Update UI with Guest Profile (Foto o Iniciales)
function updateProfileUI() {
  if (!appState.guest) return;
  const name = appState.guest.name || 'Invitado VIP';
  const table = appState.guest.tableNumber || 'Sin Mesa';
  const avatar = appState.guest.avatarUrl || '';
  const hasCustomPhoto = avatar && !avatar.includes('coronamain') && (avatar.startsWith('data:') || avatar.startsWith('http') || avatar.startsWith('/uploads') || avatar.startsWith('/assets/'));
  const initials = getInitials(name);

  if (elements.sidebarGuestName) elements.sidebarGuestName.textContent = name;
  if (elements.sidebarTableTag) elements.sidebarTableTag.textContent = table;

  // Sidebar Avatar
  const sidebarAvatarWrapper = document.querySelector('.sidebar-avatar-wrapper');
  if (sidebarAvatarWrapper) {
    if (hasCustomPhoto) {
      sidebarAvatarWrapper.innerHTML = `
        <img id="sidebar-avatar" src="${avatar}" class="sidebar-avatar" alt="Avatar">
        <div class="sidebar-avatar-edit-icon" onclick="showLookStudio();" title="Cambiar foto de gala">📷</div>
      `;
    } else {
      sidebarAvatarWrapper.innerHTML = `
        <div class="sidebar-avatar-initials" onclick="showLookStudio();" title="Sacar foto de gala">${initials}</div>
        <div class="sidebar-avatar-edit-icon" onclick="showLookStudio();" title="Sacar foto de gala">📷</div>
      `;
    }
  }

  // Header Avatar
  if (elements.headerAvatarBadge) {
    if (hasCustomPhoto) {
      elements.headerAvatarBadge.innerHTML = `<img src="${avatar}" alt="Avatar">`;
    } else {
      elements.headerAvatarBadge.innerHTML = `<div class="header-avatar-initials">${initials}</div>`;
    }
  }

  // Digital Pass Card
  const passAvatarContainer = document.getElementById('pass-avatar-container');
  const passName = document.getElementById('pass-guest-name');
  const passTable = document.getElementById('pass-table-badge');
  const passEvent = document.getElementById('pass-event-title');
  const passQrImage = document.getElementById('pass-qr-image');

  if (passAvatarContainer) {
    if (hasCustomPhoto) {
      passAvatarContainer.innerHTML = `<img id="pass-avatar" src="${avatar}" style="width: 85px; height: 85px; border-radius: 50%; border: 3px solid var(--gold-primary); object-fit: cover; box-shadow: var(--gold-glow); display: block;" alt="Avatar">`;
    } else {
      passAvatarContainer.innerHTML = `<div class="sidebar-avatar-initials" style="width: 85px; height: 85px; font-size: 1.7rem; border: 3px solid var(--gold-primary); margin: 0 auto; box-shadow: var(--gold-glow); display: flex; align-items: center; justify-content: center;">${initials}</div>`;
    }
  }

  if (passName) passName.textContent = name;
  if (passTable) passTable.textContent = table;
  if (passEvent && appState.eventData) passEvent.textContent = appState.eventData.title || 'Nuestra Fiesta';

  // Generate Real Dynamic QR Code for Guest Access
  if (passQrImage) {
    const origin = window.location.origin;
    const eventId = appState.eventId || 'default';
    const guestId = (appState.guest && appState.guest.id) ? appState.guest.id : 'guest_' + encodeURIComponent(name);
    const checkinUrl = `${origin}/app?checkin=1&event=${encodeURIComponent(eventId)}&guest=${encodeURIComponent(guestId)}&name=${encodeURIComponent(name)}&table=${encodeURIComponent(table)}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(checkinUrl)}&color=0b0b0c&bgcolor=ffffff&margin=1`;
    passQrImage.src = qrApiUrl;
  }

  // Load companions
  loadTableCompanions(table);
}

// Sidebar Drawer Control
function toggleSidebar() {
  if (elements.sidebarDrawer.classList.contains('active')) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function openSidebar() {
  elements.sidebarDrawer.classList.add('active');
  elements.sidebarOverlay.classList.add('active');
}

function closeSidebar() {
  elements.sidebarDrawer.classList.remove('active');
  elements.sidebarOverlay.classList.remove('active');
}

// Section Navigation Router
function navigateToSection(sectionId) {
  appState.activeSection = sectionId;

  // Hide all sections
  document.querySelectorAll('.app-sub-section').forEach(sec => sec.style.display = 'none');

  // Highlight active nav in sidebar
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('data-section') === sectionId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  const targetSec = document.getElementById(`section-${sectionId}`);
  if (targetSec) {
    targetSec.style.display = 'block';
    targetSec.scrollIntoView({ behavior: 'smooth' });
  }

  // Specific section triggers
  if (sectionId === 'awards') {
    loadAwardsData();
  }
}

// AWARDS ENGINE (Voting & List)
async function loadAwardsData() {
  if (!appState.eventId) return;
  try {
    const res = await fetch(`/api/app/awards/${appState.eventId}`);
    const data = await res.json();
    if (data.success && data.state) {
      appState.awards = data.state.awards || [];
      renderAwards(appState.awards);
    }
  } catch (e) {}
}

function renderAwards(awards) {
  const container = document.getElementById('awards-list-container');
  if (!container) return;

  if (!awards || awards.length === 0) {
    container.innerHTML = `<div class="empty-state">No hay categorías configuradas aún.</div>`;
    return;
  }

  container.innerHTML = awards.map(award => {
    const isVoting = award.status === 'voting';
    const isAwarded = award.status === 'awarded';
    const hasWinner = isAwarded && award.winner;

    let contentHtml = '';

    if (hasWinner) {
      contentHtml = `
        <div class="winner-box">
          <div class="winner-title-badge">👑 GANADOR OFICIAL</div>
          <img src="${award.winner.avatarUrl || '/assets/coronamain.png'}" class="winner-avatar" alt="${award.winner.name}">
          <h4 style="font-size: 1.1rem; color: #fff; font-weight: 700;">${award.winner.name}</h4>
          <span style="font-size: 0.75rem; color: var(--gold-light);">${award.winner.tableNumber || ''}</span>
        </div>
      `;
    } else if (award.nominees && award.nominees.length > 0) {
      contentHtml = `
        <div class="nominees-list">
          ${award.nominees.map(nom => {
            const hasVotedThis = nom.voters && appState.guest && nom.voters[appState.guest.id];
            return `
              <div class="nominee-row ${hasVotedThis ? 'voted' : ''}" onclick="castAwardVote('${award.id}', '${nom.id}')">
                <div class="nominee-left">
                  <img src="${nom.avatarUrl || '/assets/coronamain.png'}" class="nominee-avatar" alt="${nom.name}">
                  <div class="nominee-info">
                    <h4>${nom.name}</h4>
                    <span>${nom.tableNumber || 'Invitado'}</span>
                  </div>
                </div>
                ${isVoting ? `
                  <button class="nominee-vote-btn">${hasVotedThis ? '✓ Votado' : 'Votar'}</button>
                ` : `
                  <span style="font-size: 0.75rem; color: var(--text-muted);">${nom.votesCount || 0} votos</span>
                `}
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else {
      contentHtml = `<p style="font-size: 0.78rem; color: var(--text-muted); text-align: center; padding: 10px;">Nominados en preparación por los anfitriones ✨</p>`;
    }

    return `
      <div class="award-card ${isVoting ? 'live-voting' : ''}">
        <div class="award-header">
          <div class="award-title-group">
            <div class="award-icon-badge">${award.icon || '🏆'}</div>
            <div>
              <h3>${award.title}</h3>
              <p class="award-desc">${award.description || ''}</p>
            </div>
          </div>
          ${isVoting ? `<span class="nav-badge-pill nav-badge-live">VOTACIÓN EN VIVO</span>` : ''}
        </div>
        ${contentHtml}
      </div>
    `;
  }).join('');
}

async function castAwardVote(awardId, nomineeId) {
  if (!appState.guest) {
    showToast('Registrá tu perfil para poder votar.');
    return;
  }
  try {
    const res = await fetch(`/api/app/awards/${appState.eventId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        awardId,
        nomineeId,
        voterId: appState.guest.id
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('¡Voto registrado con éxito! 🎉');
      loadAwardsData();
    } else {
      showToast(data.error || 'No se pudo registrar el voto.');
    }
  } catch (e) {
    showToast('Error al conectar con la votación.');
  }
}

// SSE Stream Setup
function setupSSEAwardsStream(eventId) {
  if (appState.sseSource) {
    appState.sseSource.close();
  }
  try {
    appState.sseSource = new EventSource(`/api/app/awards-stream/${eventId}`);
    appState.sseSource.onmessage = (event) => {
      try {
        const state = JSON.parse(event.data);
        if (state && state.awards) {
          appState.awards = state.awards;
          if (appState.activeSection === 'awards' || appState.activeSection === 'home') {
            renderAwards(state.awards);
          }
        }
      } catch (e) {}
    };
  } catch (err) {
    console.warn('[SSE Connection]', err);
  }
}

// Table Companions
async function loadTableCompanions(tableNumber) {
  const container = document.getElementById('table-companions-list');
  const tableTitle = document.getElementById('hub-table-title');
  const hasValidTable = tableNumber && tableNumber !== 'Sin Mesa Asignada' && !tableNumber.toLowerCase().includes('sin mesa');

  if (tableTitle) {
    tableTitle.textContent = hasValidTable ? tableNumber : 'Mesa en Asignación';
  }

  if (!container) return;

  if (!hasValidTable) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px 14px; background: rgba(255, 255, 255, 0.03); border-radius: 14px; border: 1px dashed rgba(212, 175, 55, 0.35);">
        <div style="font-size: 1.8rem; margin-bottom: 8px;">✨</div>
        <div style="font-size: 0.9rem; font-weight: 700; color: var(--gold-light); margin-bottom: 5px;">Mesa en Asignación</div>
        <div style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.45; max-width: 280px; margin: 0 auto;">
          Tu anfitrión te ubicará en una mesa especial antes del inicio del evento.
        </div>
      </div>
    `;
    return;
  }

  try {
    const res = await fetch(`/api/app/table-companions/${appState.eventId || 'default'}/${encodeURIComponent(tableNumber)}`);
    const data = await res.json();
    if (container && data.success && data.companions) {
      const currentGuestName = appState.guest ? appState.guest.name.trim().toLowerCase() : '';
      const companions = data.companions.filter(c => c.name.trim().toLowerCase() !== currentGuestName);

      if (companions.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 22px 14px; background: rgba(255, 255, 255, 0.03); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.06);">
            <div style="font-size: 1.6rem; margin-bottom: 6px;">🎉</div>
            <p style="font-size: 0.85rem; font-weight: 600; color: #fff; margin-bottom: 4px;">¡Sos el/la primer/a en llegar a tu mesa!</p>
            <p style="font-size: 0.75rem; color: var(--text-muted);">A medida que tus compañeros ingresen con su pase, los verás acá.</p>
          </div>
        `;
      } else {
        container.innerHTML = companions.map(c => `
          <div class="nominee-row" style="cursor: default;">
            <div class="nominee-left">
              <div style="width: 38px; height: 38px; border-radius: 50%; background: rgba(212, 175, 55, 0.15); border: 1px solid var(--border-gold); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; color: var(--gold-light);">
                ${getInitials(c.name)}
              </div>
              <div class="nominee-info">
                <h4>${c.name}</h4>
                <span style="font-size: 0.72rem; color: var(--text-muted);">Compañero/a de mesa</span>
              </div>
            </div>
            <span style="font-size: 0.72rem; font-weight: 600; color: var(--gold-primary); background: rgba(212, 175, 55, 0.12); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(212, 175, 55, 0.25);">${tableNumber}</span>
          </div>
        `).join('');
      }
    } else {
      container.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted);">No se pudieron cargar los compañeros de mesa.</p>`;
    }
  } catch (e) {
    container.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted);">No se pudieron cargar los compañeros de mesa.</p>`;
  }
}

// Render Event Helpers
function renderEventInfo(info) {
  if (!info) return;
  const locName = document.getElementById('info-location-name');
  const locAddr = document.getElementById('info-location-address');
  const locMapBtn = document.getElementById('info-map-btn');
  const dressTitle = document.getElementById('info-dress-title');
  const dressDesc = document.getElementById('info-dress-desc');

  if (locName) locName.textContent = info.location.name || 'Salón Principal';
  if (locAddr) locAddr.textContent = info.location.address || '';
  if (locMapBtn) {
    locMapBtn.href = info.location.mapUrl || `https://maps.google.com/?q=${encodeURIComponent(info.location.address || info.location.name)}`;
  }
  if (dressTitle) dressTitle.textContent = info.dressCode.title || 'Elegante';
  if (dressDesc) dressDesc.textContent = info.dressCode.details || '';
}

function renderTimeline(timeline) {
  const container = document.getElementById('timeline-container');
  if (!container || !timeline) return;

  container.innerHTML = timeline.map(item => `
    <div class="timeline-item ${item.isCurrent ? 'current' : ''}">
      <div class="timeline-dot">${item.icon || '✨'}</div>
      <div class="timeline-time">${item.time || ''} ${item.isCurrent ? '• (EN CURSO)' : ''}</div>
      <div class="timeline-title">${item.title}</div>
      <div class="timeline-desc">${item.description || ''}</div>
    </div>
  `).join('');
}

function renderGifts(gifts) {
  if (!gifts) return;
  const aliasEl = document.getElementById('gift-alias-text');
  const cbuEl = document.getElementById('gift-cbu-text');
  const holderEl = document.getElementById('gift-holder-text');
  if (aliasEl) aliasEl.textContent = gifts.alias || 'MIFIESTAPP.ALIAS';
  if (cbuEl) cbuEl.textContent = gifts.cbu || '0000003100012345678901';
  if (holderEl) holderEl.textContent = gifts.holder || '';
}

function renderTransport(transport) {
  if (!transport) return;
  const notesEl = document.getElementById('transport-notes-text');
  const callBtn = document.getElementById('transport-call-remises');
  if (notesEl) notesEl.textContent = transport.notes || '';
  if (callBtn && transport.remisesPhone) {
    callBtn.href = `tel:${transport.remisesPhone.replace(/[^0-9+]/g, '')}`;
  }
}

// Copy to Clipboard with Toast
window.copyToClipboard = function(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`¡${label || 'Dato'} copiado al portapapeles! 📋`);
  }).catch(() => {
    showToast(`Copiado: ${text}`);
  });
};

// Toast Alert Helper
function showToast(message) {
  if (!elements.toast || !elements.toastMessage) return;
  elements.toastMessage.textContent = message;
  elements.toast.classList.add('active');
  setTimeout(() => {
    elements.toast.classList.remove('active');
  }, 3200);
}
