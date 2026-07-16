document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('event') || 'default';
  const btnBackToPortal = document.getElementById('btn-back-to-portal');
  if (btnBackToPortal) {
    btnBackToPortal.href = `/event.html?event=${encodeURIComponent(eventId)}`;
  }

  function showToast(type, title, message, duration = 3000) {
    // Backwards compatibility for:
    // 1. showToast(message, type)
    // 2. showToast(message)
    if (!title && !message) {
      // Single argument call: showToast(message)
      message = type;
      type = 'success';
      title = '¡Éxito!';
    } else if (title === 'success' || title === 'error' || title === 'loading') {
      // Two arguments call: showToast(message, type)
      message = type;
      type = title;
      title = (type === 'success') ? '¡Éxito!' : (type === 'error') ? 'Error' : '';
    }

    const existingToast = document.getElementById('floating-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.id = 'floating-toast';
    toast.className = 'toast-notification';
    
    let iconHtml = '';
    if (type === 'loading') {
      iconHtml = `
        <div class="toast-icon-wrapper">
          <div class="toast-spinner"></div>
        </div>
      `;
    } else if (type === 'success') {
      iconHtml = `
        <div class="toast-icon-wrapper">
          <svg class="toast-checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="toast-checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="toast-checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
          </svg>
        </div>
      `;
    } else if (type === 'error') {
      iconHtml = `
        <div class="toast-icon-wrapper">
          <svg class="toast-error-cross" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
            <circle class="toast-error-circle" cx="26" cy="26" r="25" fill="none"/>
            <path class="toast-error-line" fill="none" d="M16 16l20 20M36 16L16 36"/>
          </svg>
        </div>
      `;
    }
    
    toast.innerHTML = `
      ${iconHtml}
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-message">${message}</div>
    `;
    
    document.body.appendChild(toast);
    
    toast.offsetHeight; // Force reflow
    toast.classList.add('active');
    
    if (duration && type !== 'loading') {
      setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 400);
      }, duration);
    }
  }

  // Elements
  let maxUploadSize = 15 * 1024 * 1024; // Default upload limit (dynamically updated by server config)
  const statGuests = document.getElementById('stat-guests');
  const statTables = document.getElementById('stat-tables');
  const tablesBreakdownList = document.getElementById('tables-breakdown-list');
  const qrCodeContainer = document.getElementById('qr-code-container');
  const btnPrintQr = document.getElementById('btn-print-qr');
  const printQrImg = document.getElementById('print-qr-img');
  
  // Phase 2 Elements
  const btnLogout = document.getElementById('btn-logout');
  const eventTitleInput = document.getElementById('event-title-input');
  const btnSaveTitle = document.getElementById('btn-save-title');
  const printEventTitle = document.getElementById('print-event-title');
  
  const adminGuestSearch = document.getElementById('admin-guest-search');
  const btnAddGuest = document.getElementById('btn-add-guest');
  const btnExportExcel = document.getElementById('btn-export-excel');
  const guestsTableBody = document.getElementById('guests-table-body');
  
  // Modal Elements
  const guestModal = document.getElementById('guest-modal');
  const guestForm = document.getElementById('guest-form');
  const guestIndexInput = document.getElementById('guest-index');
  const modalTitle = document.getElementById('modal-title');
  const modalFirstName = document.getElementById('modal-first-name');
  const modalLastName = document.getElementById('modal-last-name');
  const modalTable = document.getElementById('modal-table');
  const btnCloseModal = document.getElementById('btn-close-modal');

  const toggleTableDropdownBtn = document.getElementById('btn-toggle-table-dropdown');

  if (modalTable) {
    modalTable.addEventListener('focus', () => {
      showCustomDropdown();
    });
    modalTable.addEventListener('input', () => {
      showCustomDropdown();
    });
  }

  if (toggleTableDropdownBtn) {
    toggleTableDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dropdown = document.getElementById('table-custom-dropdown');
      if (dropdown && dropdown.classList.contains('active')) {
        hideCustomDropdown();
      } else {
        showCustomDropdown();
      }
    });
  }

  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('table-custom-dropdown');
    if (dropdown && dropdown.classList.contains('active')) {
      if (e.target !== modalTable && e.target !== toggleTableDropdownBtn && !dropdown.contains(e.target)) {
        hideCustomDropdown();
      }
    }
  });

  // Confirm Modal Elements
  const confirmModal = document.getElementById('confirm-modal');
  const confirmTitle = document.getElementById('confirm-modal-title');
  const confirmMessage = document.getElementById('confirm-modal-message');
  const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
  const btnConfirmAccept = document.getElementById('btn-confirm-accept');

  let activeConfirmCallback = null;

  // Guest List Modal Elements
  const guestListModal = document.getElementById('guest-list-modal');
  const btnCloseGuestListModal = document.getElementById('btn-close-guest-list-modal');
  const modalGuestSearch = document.getElementById('modal-guest-search');
  const btnModalAddGuest = document.getElementById('btn-modal-add-guest');
  const modalTabAll = document.getElementById('modal-tab-all');
  const modalTabTables = document.getElementById('modal-tab-tables');
  const modalTabNoMesa = document.getElementById('modal-tab-nomesa');
  const modalGuestListContent = document.getElementById('modal-guest-list-content');

  let activeModalTab = 'all'; // 'all', 'tables', 'nomesa'
  let activeInvitadosStatusFilter = 'all'; // 'all', 'confirmed', 'pending', 'declined'

  // Tabs elements
  const tabBtnMesas = document.getElementById('tab-btn-mesas');
  const tabBtnFotos = document.getElementById('tab-btn-fotos');
  const tabBtnInvitacion = document.getElementById('tab-btn-invitacion');
  const tabBtnTrivia = document.getElementById('tab-btn-trivia');
  const tabMesas = document.getElementById('tab-mesas');
  const tabFotos = document.getElementById('tab-fotos');
  const tabInvitacion = document.getElementById('tab-invitacion');
  const tabTrivia = document.getElementById('tab-trivia');

  // Photo grid elements
  const pendingPhotosGrid = document.getElementById('pending-photos-grid');
  const approvedPhotosGrid = document.getElementById('approved-photos-grid');

  // Photo polling state
  let photoIntervalId = null;
  let photoEventSource = null;
  let triviaIntervalId = null;
  let triviaQuestionsData = [];
  let triviaEventSource = null;

  function switchTab(tabId) {
    if (tabId === 'mesas') {
      if (tabBtnMesas) tabBtnMesas.classList.add('active');
      if (tabBtnFotos) tabBtnFotos.classList.remove('active');
      if (tabBtnInvitacion) tabBtnInvitacion.classList.remove('active');
      if (tabBtnTrivia) tabBtnTrivia.classList.remove('active');
      if (tabMesas) tabMesas.classList.add('active');
      if (tabFotos) tabFotos.classList.remove('active');
      if (tabInvitacion) tabInvitacion.classList.remove('active');
      if (tabTrivia) tabTrivia.classList.remove('active');
      stopPhotoPolling();
      stopTriviaPolling();
      loadStats();
      loadRsvps();
      loadGuests();
    } else if (tabId === 'fotos') {
      if (tabBtnMesas) tabBtnMesas.classList.remove('active');
      if (tabBtnFotos) tabBtnFotos.classList.add('active');
      if (tabBtnInvitacion) tabBtnInvitacion.classList.remove('active');
      if (tabBtnTrivia) tabBtnTrivia.classList.remove('active');
      if (tabMesas) tabMesas.classList.remove('active');
      if (tabFotos) tabFotos.classList.add('active');
      if (tabInvitacion) tabInvitacion.classList.remove('active');
      if (tabTrivia) tabTrivia.classList.remove('active');
      loadPhotos();
      startPhotoPolling();
      stopTriviaPolling();
    } else if (tabId === 'invitacion') {
      if (tabBtnMesas) tabBtnMesas.classList.remove('active');
      if (tabBtnFotos) tabBtnFotos.classList.remove('active');
      if (tabBtnInvitacion) tabBtnInvitacion.classList.add('active');
      if (tabBtnTrivia) tabBtnTrivia.classList.remove('active');
      if (tabMesas) tabMesas.classList.remove('active');
      if (tabFotos) tabFotos.classList.remove('active');
      if (tabInvitacion) tabInvitacion.classList.add('active');
      if (tabTrivia) tabTrivia.classList.remove('active');
      stopPhotoPolling();
      stopTriviaPolling();
      loadRsvps();
      loadGuests();
    } else if (tabId === 'trivia') {
      if (tabBtnMesas) tabBtnMesas.classList.remove('active');
      if (tabBtnFotos) tabBtnFotos.classList.remove('active');
      if (tabBtnInvitacion) tabBtnInvitacion.classList.remove('active');
      if (tabBtnTrivia) tabBtnTrivia.classList.add('active');
      if (tabMesas) tabMesas.classList.remove('active');
      if (tabFotos) tabFotos.classList.remove('active');
      if (tabInvitacion) tabInvitacion.classList.remove('active');
      if (tabTrivia) tabTrivia.classList.add('active');
      stopPhotoPolling();
      loadTriviaConfig();
      startTriviaPolling();
    }
  }

  window.switchSubTab = function(subTabId) {
    const subtabs = ['informacion', 'diseno', 'fotos-inv', 'regalos', 'confirmaciones', 'respuestas', 'invitados'];
    subtabs.forEach(t => {
      const btn = document.getElementById(`subtab-btn-${t}`);
      const wrapper = document.getElementById(`subtab-${t}`);
      if (t === subTabId) {
        if (btn) btn.classList.add('active');
        if (wrapper) {
          wrapper.style.display = ''; // Clear inline styles
          wrapper.classList.add('active-subtab');
          wrapper.offsetHeight; // Force reflow
          wrapper.classList.add('fade-in-subtab');
        }
      } else {
        if (btn) btn.classList.remove('active');
        if (wrapper) {
          wrapper.classList.remove('fade-in-subtab');
          setTimeout(() => {
            if (!wrapper.classList.contains('fade-in-subtab')) {
              wrapper.classList.remove('active-subtab');
              wrapper.style.display = ''; // Clear inline styles
            }
          }, 250);
        }
      }
    });
  };

  function startPhotoPolling() {
    stopPhotoPolling(); // Clean up any existing connection/polling
    
    if (typeof EventSource !== 'undefined') {
      console.log('Initializing Real-time Photo Stream...');
      photoEventSource = new EventSource(`/api/admin/photos/stream?event=${encodeURIComponent(eventId)}`);
      
      photoEventSource.onmessage = (e) => {
        try {
          const eventData = JSON.parse(e.data);
          if (eventData.type === 'INITIAL_STATE' || eventData.type === 'PHOTOS_UPDATE') {
            if (Array.isArray(eventData.data)) {
              renderPhotos(eventData.data);
            }
          }
        } catch (err) {
          console.error('Error parsing photo stream message:', err);
        }
      };

      photoEventSource.onerror = (err) => {
        console.warn('Photo Stream encountered an error, falling back to polling:', err);
        if (photoEventSource) {
          photoEventSource.close();
          photoEventSource = null;
        }
        // Fallback to interval polling
        if (!photoIntervalId) {
          photoIntervalId = setInterval(loadPhotos, 10000);
        }
      };
    } else {
      // Fallback directly for browsers without EventSource
      photoIntervalId = setInterval(loadPhotos, 10000);
    }
    
    // Perform an initial fetch just to be immediate while stream connects
    loadPhotos();
  }

  function stopPhotoPolling() {
    if (photoEventSource) {
      photoEventSource.close();
      photoEventSource = null;
    }
    if (photoIntervalId) {
      clearInterval(photoIntervalId);
      photoIntervalId = null;
    }
  }

  function loadPhotos() {
    if (!pendingPhotosGrid || !approvedPhotosGrid) return;
    
    fetch(`/api/admin/photos?event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(photos => {
        if (Array.isArray(photos)) {
          renderPhotos(photos);
        } else {
          console.error('Invalid photos response', photos);
        }
      })
      .catch(err => {
        console.error('Error fetching admin photos:', err);
      });
  }

  function renderPhotos(photos) {
    const pending = photos.filter(p => !p.approved);
    const approved = photos.filter(p => p.approved);

    // Render Pending
    if (pending.length === 0) {
      pendingPhotosGrid.innerHTML = '<div class="no-photos-msg">No hay fotos pendientes de aprobación.</div>';
    } else {
      pendingPhotosGrid.innerHTML = pending.map(p => `
        <div class="photo-card" id="photo-${p.id}">
          <div class="photo-card-img-wrapper">
            <img src="${p.photoUrl}" alt="Foto de ${p.guestName}" loading="lazy">
          </div>
          <div class="photo-card-info">
            <h4 class="photo-card-guest">${escapeHtml(p.guestName)}</h4>
            <p class="photo-card-message">${escapeHtml(p.message || '')}</p>
            <div class="photo-card-actions">
              <button class="btn btn-danger" onclick="rejectPhotoCard('${p.id}')">Rechazar</button>
              <button class="btn btn-primary" onclick="approvePhotoCard('${p.id}')">Aprobar</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    // Render Approved
    if (approved.length === 0) {
      approvedPhotosGrid.innerHTML = '<div class="no-photos-msg">No hay fotos aprobadas aún.</div>';
    } else {
      approvedPhotosGrid.innerHTML = approved.map(p => `
        <div class="photo-card" id="photo-${p.id}">
          <div class="photo-card-img-wrapper">
            <img src="${p.photoUrl}" alt="Foto de ${p.guestName}" loading="lazy">
          </div>
          <div class="photo-card-info">
            <h4 class="photo-card-guest">${escapeHtml(p.guestName)}</h4>
            <p class="photo-card-message">${escapeHtml(p.message || '')}</p>
            <div class="photo-card-actions">
              <button class="btn btn-danger" style="width: 100%;" onclick="rejectPhotoCard('${p.id}')">Eliminar</button>
            </div>
          </div>
        </div>
      `).join('');
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  window.approvePhotoCard = (id) => {
    fetch(`/api/admin/photos/${id}/approve?event=${encodeURIComponent(eventId)}`, {
      method: 'PUT'
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('Foto aprobada correctamente', 'success');
          loadPhotos();
        } else {
          showToast('Error al aprobar la foto.', 'error');
        }
      })
      .catch(err => {
        console.error(err);
        showToast('Error de red al aprobar foto.', 'error');
      });
  };

  window.rejectPhotoCard = (id) => {
    showConfirm(
      '¿Eliminar / Rechazar Foto?',
      '¿Estás seguro de que deseas eliminar o rechazar esta foto? Esta acción la removerá permanentemente de la pantalla.',
      () => {
        fetch(`/api/admin/photos/${id}?event=${encodeURIComponent(eventId)}`, {
          method: 'DELETE'
        })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              showToast('Foto eliminada correctamente', 'success');
              loadPhotos();
            } else {
              showToast('Error al eliminar la foto.', 'error');
            }
          })
          .catch(err => {
            console.error(err);
            showToast('Error de red al eliminar foto.', 'error');
          });
      }
    );
  };

  async function showConfirm(title, message, onAccept) {
    const accepted = await customConfirm(title, message);
    if (accepted && onAccept) onAccept();
  }

  function hideConfirm() {
    // Retained for compatibility
  }

  // Active guest list state
  let allGuests = [];
  let allRsvps = [];
  let allTables = [];
  let uniqueTableNamesList = [];

  // Set up QR codes pointing to Guest view
  const siteOrigin = window.location.origin;
  const qrBaseUrl = 'https://api.qrserver.com/v1/create-qr-code/';

  const qrInstructionsText = document.getElementById('qr-instructions-text');
  const btnPrintPhotosQr = document.getElementById('btn-print-photos-qr');
  const btnSavePhotosTitle = document.getElementById('btn-save-photos-title');
  const eventTitlePhotosInput = document.getElementById('event-title-photos-input');
  const btnClearPhotos = document.getElementById('btn-clear-photos');
  const btnViewGuestView = document.getElementById('btn-view-guest-view');
  const btnScreenMode = document.getElementById('btn-screen-mode');
  
  // Google Drive integration variables
  const btnSyncDrive = document.getElementById('btn-sync-drive');
  const syncDriveStatus = document.getElementById('sync-drive-status');
  const driveLinkContainer = document.getElementById('drive-link-container');
  const driveFolderUrl = document.getElementById('drive-folder-url');
  const btnCopyDriveUrl = document.getElementById('btn-copy-drive-url');

  // Phase 3 Invitation Elements
  const invTitleInput = document.getElementById('inv-title-input');
  const invDateOnlyInput = document.getElementById('inv-date-only-input');
  const invTimeOnlyInput = document.getElementById('inv-time-only-input');
  const invMusicInput = document.getElementById('inv-music-input');
  const invAudioUpload = document.getElementById('inv-audio-upload');
  const invAudioUploadStatus = document.getElementById('inv-audio-upload-status');
  const invAddressInput = document.getElementById('inv-address-input');
  const invMapsInput = document.getElementById('inv-maps-input');
  const invDressInput = document.getElementById('inv-dress-input');
  const invBankHolderInput = document.getElementById('inv-bank-holder-input');
  const invCbuInput = document.getElementById('inv-cbu-input');
  const invAliasInput = document.getElementById('inv-alias-input');
  const invThemeFont = document.getElementById('inv-theme-font');
  const invThemeColor = document.getElementById('inv-theme-color');
  const invBgEffect = document.getElementById('inv-bg-effect');
  const invWaxSeal = document.getElementById('inv-wax-seal');
  const invBgUrl = document.getElementById('inv-bg-url');
  const invCoverUrl = document.getElementById('inv-cover-url');
  const invPhoto1 = document.getElementById('inv-photo-1');
  const invPhoto2 = document.getElementById('inv-photo-2');
  const invPhoto3 = document.getElementById('inv-photo-3');
  const invPhoto4 = document.getElementById('inv-photo-4');
  const invPhoto5 = document.getElementById('inv-photo-5');
  const btnSaveInvitationConfig = document.getElementById('btn-save-invitation-config');
  
  // Real-Time Preview Elements
  const previewScreen = document.getElementById('preview-screen');
  const previewIframe = document.getElementById('preview-iframe');
  const btnPrevViewEnvelope = document.getElementById('btn-prev-view-envelope');
  const btnPrevViewCard = document.getElementById('btn-prev-view-card');
  let isIframeLoaded = false;

  if (previewIframe) {
    previewIframe.src = `/invitacion.html?event=${encodeURIComponent(eventId)}&preview=true`;
    previewIframe.addEventListener('load', () => {
      isIframeLoaded = true;
      updateRealTimePreview();
    });
  }

  // Handle messages from the iframe (e.g. envelope opened event)
  window.addEventListener('message', (event) => {
    if (!event.data) return;
    
    if (event.data.type === 'invitation-envelope-opened') {
      if (btnPrevViewCard && btnPrevViewEnvelope) {
        btnPrevViewCard.style.background = 'var(--gold-gradient)';
        btnPrevViewCard.style.color = '#0b0b0c';
        btnPrevViewCard.style.borderColor = 'rgba(255,255,255,0.1)';
        
        btnPrevViewEnvelope.style.background = 'rgba(255, 255, 255, 0.05)';
        btnPrevViewEnvelope.style.color = '#888';
        btnPrevViewEnvelope.style.borderColor = 'rgba(255,255,255,0.05)';
      }
    }
  });
  
  const invitationPublicUrl = document.getElementById('invitation-public-url');
  const btnCopyInvitationUrl = document.getElementById('btn-copy-invitation-url');
  const btnPrintInvitationQr = document.getElementById('btn-print-invitation-qr');
  const qrInvitationCodeContainer = document.getElementById('qr-invitation-code-container');
  
  const rsvpStatConfirmed = document.getElementById('rsvp-stat-confirmed');
  const rsvpStatDeclined = document.getElementById('rsvp-stat-declined');
  const rsvpStatTotalGuests = document.getElementById('rsvp-stat-total-guests');
  const rsvpDietBreakdown = document.getElementById('rsvp-diet-breakdown');
  const rsvpSongsList = document.getElementById('rsvp-songs-list');
  const rsvpSearchInput = document.getElementById('rsvp-search-input');
  const rsvpTableBody = document.getElementById('rsvp-table-body');

  const activeService = urlParams.get('service');

  function updateQR() {
    const isPhotos = (activeService === 'photos');
    const isInvitation = (activeService === 'invitacion' || activeService === 'invitation');
    const isTrivia = (activeService === 'trivia');
    
    let targetPath = '/mesas';
    if (isPhotos) targetPath = '/fotos';
    if (isInvitation) targetPath = '/invitacion.html';
    if (isTrivia) targetPath = '/trivia-client.html';
    
    const targetUrl = `${siteOrigin}${targetPath}?event=${encodeURIComponent(eventId)}`;

    // Generate QR code URLs
    const screenQrUrl = `${qrBaseUrl}?size=150x150&data=${encodeURIComponent(targetUrl)}&color=0b0b0c&bgcolor=ffffff`;
    const printQrUrl = `${qrBaseUrl}?size=500x500&data=${encodeURIComponent(targetUrl)}&color=000000&bgcolor=ffffff`;

    // 1. Set the correct QR images depending on active service
    if (isPhotos) {
      const qrPhotosContainer = document.getElementById('qr-photos-code-container');
      if (qrPhotosContainer) {
        qrPhotosContainer.innerHTML = `<img src="${screenQrUrl}" alt="QR Code" style="display: block; margin: 0 auto;">`;
      }
      
      const qrPhotosInstructionsText = document.getElementById('qr-photos-instructions-text');
      if (qrPhotosInstructionsText) {
        qrPhotosInstructionsText.textContent = 'Imprime el cartel con el QR oficial para ubicarlo en el salón. Los invitados podrán escanearlo para subir y compartir sus fotos al instante.';
      }
    } else if (isInvitation) {
      if (qrInvitationCodeContainer) {
        qrInvitationCodeContainer.innerHTML = `<img src="${screenQrUrl}" alt="QR Code" style="display: block; margin: 0 auto;">`;
      }
    } else {
      if (qrCodeContainer) {
        qrCodeContainer.innerHTML = `<img src="${screenQrUrl}" alt="QR Code" style="display: block; margin: 0 auto;">`;
      }
      
      if (qrInstructionsText) {
        qrInstructionsText.textContent = 'Imprime el cartel con el QR oficial para ubicarlo en la recepción del salón. Los invitados podrán escanearlo al llegar para encontrar su mesa asignada.';
      }
    }

    // Always keep invitation URL and QR input populated on invitation tab
    const invitationUrlVal = `${siteOrigin}/invitacion.html?event=${encodeURIComponent(eventId)}`;
    if (invitationPublicUrl) {
      invitationPublicUrl.value = invitationUrlVal;
    }
    if (qrInvitationCodeContainer) {
      const invScreenQrUrl = `${qrBaseUrl}?size=150x150&data=${encodeURIComponent(invitationUrlVal)}&color=0b0b0c&bgcolor=ffffff`;
      qrInvitationCodeContainer.innerHTML = `<img src="${invScreenQrUrl}" alt="QR Code" style="display: block; margin: 0 auto;">`;
    }

    // Common/Print QR image configuration for window.print()
    if (printQrImg) {
      printQrImg.src = printQrUrl;
    }

    // Update print poster contents dynamically
    const printTitle = document.getElementById('print-event-title');
    const printSubtitle = document.querySelector('.print-subtitle');
    const printInstructions = document.querySelector('.print-instructions');

    if (printTitle) {
      printTitle.textContent = isPhotos ? 'Muro de Fotos' : (isInvitation ? 'Invitación Interactiva' : (isTrivia ? 'Juego de Trivia' : 'Ubicación de Mesas'));
    }
    if (printSubtitle) {
      printSubtitle.textContent = isPhotos ? 'Comparte tus Momentos' : (isInvitation ? 'Accede a la Invitación' : (isTrivia ? 'Compite con tus amigos' : 'Encuentra tu Mesa'));
    }
    if (printInstructions) {
      printInstructions.innerHTML = isPhotos 
        ? 'Escanéa este código con la cámara de tu celular<br>para subir fotos y mensajes al muro.'
        : (isInvitation 
           ? 'Escanéa este código con la cámara de tu celular<br>para abrir la invitación interactiva y confirmar asistencia.'
           : (isTrivia 
              ? 'Escanéa este código con la cámara de tu celular<br>para unirte al juego de trivia y responder preguntas.'
              : 'Escanéa este código con la cámara de tu celular<br>para consultar tu mesa asignada.'));
    }
  }

  // Collapsible headers logic
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.target;
      const target = document.getElementById(targetId);
      if (target) {
        header.classList.toggle('collapsed');
        target.classList.toggle('collapsed');
      }
    });
  });

  // Trigger initial QR render
  updateQR();

  // Initialize page
  checkSession();
  loadConfig();

  // Hide the global navigation tabs container as services are isolated now
  const adminNav = document.querySelector('.admin-nav');
  if (adminNav) {
    adminNav.style.display = 'none';
  }

  // Switch display container and load data based on the service param
  if (activeService === 'photos') {
    switchTab('fotos');
  } else if (activeService === 'invitacion' || activeService === 'invitation') {
    switchTab('invitacion');
  } else if (activeService === 'trivia') {
    switchTab('trivia');
  } else {
    switchTab('mesas');
  }

  function openGuestListModal() {
    if (guestListModal) {
      guestListModal.classList.add('active');
      activeModalTab = 'all';
      updateModalTabsUI();
      if (modalGuestSearch) modalGuestSearch.value = '';
      renderModalGuestList();
    }
    document.body.style.overflow = 'hidden';
  }

  function closeGuestListModal() {
    if (guestListModal) {
      guestListModal.classList.remove('active');
    }
    document.body.style.overflow = '';
  }

  // Wire up guest list modal events
  if (btnViewGuestView) {
    btnViewGuestView.addEventListener('click', openGuestListModal);
  }

  if (btnCloseGuestListModal) {
    btnCloseGuestListModal.addEventListener('click', closeGuestListModal);
  }

  if (guestListModal) {
    guestListModal.addEventListener('click', (e) => {
      if (e.target === guestListModal) {
        closeGuestListModal();
      }
    });
  }

  if (modalTabAll) {
    modalTabAll.addEventListener('click', () => {
      activeModalTab = 'all';
      updateModalTabsUI();
      renderModalGuestList();
    });
  }
  if (modalTabTables) {
    modalTabTables.addEventListener('click', () => {
      activeModalTab = 'tables';
      updateModalTabsUI();
      renderModalGuestList();
    });
  }
  if (modalTabNoMesa) {
    modalTabNoMesa.addEventListener('click', () => {
      activeModalTab = 'nomesa';
      updateModalTabsUI();
      renderModalGuestList();
    });
  }

  if (modalGuestSearch) {
    modalGuestSearch.addEventListener('input', () => {
      renderModalGuestList();
    });
  }

  if (btnModalAddGuest) {
    btnModalAddGuest.addEventListener('click', () => {
      modalTitle.textContent = 'Agregar Invitado';
      guestIndexInput.value = '';
      modalFirstName.value = '';
      modalLastName.value = '';
      modalTable.value = '';
      hideCustomDropdown();
      guestModal.classList.add('active');
    });
  }

  if (btnSavePhotosTitle && eventTitlePhotosInput) {
    btnSavePhotosTitle.addEventListener('click', () => {
      const eventTitle = eventTitlePhotosInput.value.trim();
      if (!eventTitle) {
        showToast('error', '¡Atención!', 'Por favor, ingresa un nombre para el evento.', 4000);
        return;
      }

      showToast('loading', '', 'Guardando cambios...');

      fetch(`/api/config?event=${encodeURIComponent(eventId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventTitle })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showToast('success', '¡Éxito!', 'Título del evento guardado correctamente.', 3000);
            if (printEventTitle) printEventTitle.textContent = eventTitle;
            // Sync the tables title input too if it exists on page
            if (eventTitleInput) eventTitleInput.value = eventTitle;
          } else {
            showToast('error', 'Error', 'Error al guardar la configuración.', 4000);
          }
        })
        .catch(err => {
          console.error(err);
          showToast('error', 'Error', 'Error de red al guardar la configuración.', 4000);
        });
    });
  }



  if (btnCopyDriveUrl && driveFolderUrl) {
    btnCopyDriveUrl.addEventListener('click', () => {
      driveFolderUrl.select();
      driveFolderUrl.setSelectionRange(0, 99999); // For mobile devices
      
      navigator.clipboard.writeText(driveFolderUrl.value)
        .then(() => {
          const originalText = btnCopyDriveUrl.textContent;
          btnCopyDriveUrl.textContent = '¡Copiado!';
          btnCopyDriveUrl.style.background = '#28a745';
          btnCopyDriveUrl.style.color = 'white';
          
          setTimeout(() => {
            btnCopyDriveUrl.textContent = originalText;
            btnCopyDriveUrl.style.background = 'var(--accent-gold)';
            btnCopyDriveUrl.style.color = 'black';
          }, 2000);
        })
        .catch(err => {
          console.error('Failed to copy text: ', err);
        });
    });
  }

  if (btnClearPhotos) {
    btnClearPhotos.addEventListener('click', () => {
      showConfirm(
        'Limpiar Galería de Fotos',
        '¿Está seguro de que desea eliminar todas las fotos de la galería? Esta acción no se puede deshacer y vaciará el mural.',
        () => {
          fetch(`/api/admin/photos/clear?event=${encodeURIComponent(eventId)}`, {
            method: 'POST'
          })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                showToast('Galería de fotos limpiada correctamente.', 'success');
                loadPhotos();
              } else {
                showToast('Error al limpiar la galería de fotos.', 'error');
              }
            })
            .catch(err => {
              console.error('Error clearing photos:', err);
              showToast('Error de conexión con el servidor.', 'error');
            });
        }
      );
    });
  }

  // Print QR Poster triggers
  if (btnPrintQr) {
    btnPrintQr.addEventListener('click', () => {
      preparePrintPoster('tables');
      setTimeout(() => window.print(), 150);
    });
  }

  if (btnPrintPhotosQr) {
    btnPrintPhotosQr.addEventListener('click', () => {
      preparePrintPoster('photos');
      setTimeout(() => window.print(), 150);
    });
  }

  if (btnScreenMode) {
    btnScreenMode.addEventListener('click', () => {
      window.open(`/proyeccion?event=${encodeURIComponent(eventId)}`, '_blank');
    });
  }

  // Salir trigger (volver al home)
  btnLogout.addEventListener('click', () => {
    window.location.href = `/?event=${encodeURIComponent(eventId)}`;
  });

  btnSaveTitle.addEventListener('click', () => {
    const eventTitle = eventTitleInput.value.trim();
    if (!eventTitle) {
      showToast('error', '¡Atención!', 'Por favor, ingresa un nombre para el evento.', 4000);
      return;
    }

    showToast('loading', '', 'Guardando cambios...');

    fetch(`/api/config?event=${encodeURIComponent(eventId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventTitle })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('success', '¡Éxito!', 'Título del evento guardado correctamente.', 3000);
          printEventTitle.textContent = eventTitle;
        } else {
          showToast('error', 'Error', 'Error al guardar la configuración.', 4000);
        }
      })
      .catch(err => {
        console.error(err);
        showToast('error', 'Error', 'Error de red al guardar la configuración.', 4000);
      });
  });

  // Export Mapped Excel
  btnExportExcel.addEventListener('click', () => {
    window.location.href = `/api/admin/download-excel?event=${encodeURIComponent(eventId)}`;
  });


  // Search/Filter guest list table
  adminGuestSearch.addEventListener('input', () => {
    renderGuestsTable();
  });

  // Modal actions
  btnAddGuest.addEventListener('click', () => {
    modalTitle.textContent = 'Agregar Invitado';
    guestIndexInput.value = '';
    modalFirstName.value = '';
    modalLastName.value = '';
    modalTable.value = '';
    hideCustomDropdown();
    guestModal.classList.add('active');
  });

  btnCloseModal.addEventListener('click', () => {
    guestModal.classList.remove('active');
    hideCustomDropdown();
  });

  guestForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveGuestForm();
  });

  // Check if session is valid, redirect if not
  function checkSession() {
    fetch(`/api/admin/check?event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(data => {
        if (!data.loggedIn) {
          const serviceParam = activeService ? `&service=${encodeURIComponent(activeService)}` : '';
          window.location.href = `/login?event=${encodeURIComponent(eventId)}${serviceParam}`;
        }
      })
      .catch(() => {
        const serviceParam = activeService ? `&service=${encodeURIComponent(activeService)}` : '';
        window.location.href = `/login?event=${encodeURIComponent(eventId)}${serviceParam}`;
      });
  }

  // Load Config from API
  function loadConfig() {
    fetch(`/api/config?event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.error) {
          throw new Error(data.error);
        }
        if (data && data.maxUploadSize) {
          maxUploadSize = data.maxUploadSize;
        }
        if (eventTitleInput) eventTitleInput.value = data.eventTitle || '';
        if (eventTitlePhotosInput) eventTitlePhotosInput.value = data.eventTitle || '';
        
        // Populate Phase 3 Invitation Fields
        if (invTitleInput) invTitleInput.value = data.eventTitle || '';
        if (data.invitationEventDate) {
          try {
            const parts = data.invitationEventDate.split('T');
            let dateVal = '';
            let timeVal = '';
            if (parts.length >= 2) {
              dateVal = parts[0];
              timeVal = parts[1].substring(0, 5); // Keep HH:MM
            } else {
              const d = new Date(data.invitationEventDate);
              if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                dateVal = `${year}-${month}-${day}`;
                timeVal = `${hours}:${minutes}`;
              }
            }

            if (invDateOnlyInput && dateVal) {
              // Convert YYYY-MM-DD to DD/MM/YYYY
              const dp = dateVal.split('-');
              if (dp.length === 3) {
                invDateOnlyInput.value = `${dp[2]}/${dp[1]}/${dp[0]}`;
              } else {
                invDateOnlyInput.value = dateVal;
              }
            }
            if (invTimeOnlyInput && timeVal) {
              invTimeOnlyInput.value = timeVal;
            }
          } catch (e) {
            console.error('Error parsing date for input:', e);
          }
        }
        if (invMusicInput) invMusicInput.value = data.invitationMusicUrl || '';
        if (invAddressInput) invAddressInput.value = data.invitationPartyAddress || '';
        if (invMapsInput) invMapsInput.value = data.invitationPartyMapsUrl || '';
        if (invDressInput) invDressInput.value = data.invitationDressCode || '';
        if (invBankHolderInput) invBankHolderInput.value = data.invitationBankHolder || '';
        if (invCbuInput) invCbuInput.value = data.invitationCbu || '';
        if (invAliasInput) invAliasInput.value = data.invitationAlias || '';
        if (invThemeFont) {
          invThemeFont.value = data.invitationThemeFont || 'classic-editorial';
          invThemeFont.dispatchEvent(new Event('change'));
        }
        if (invThemeColor) {
          invThemeColor.value = data.invitationThemeColor || 'golden-luxury';
          invThemeColor.dispatchEvent(new Event('change'));
        }
        if (invBgEffect) {
          invBgEffect.value = data.invitationBgEffect || 'golden-dust';
          invBgEffect.dispatchEvent(new Event('change'));
        }
        if (invWaxSeal) {
          invWaxSeal.value = data.invitationWaxSealDesign || 'rings';
          invWaxSeal.dispatchEvent(new Event('change'));
        }
        if (invBgUrl) invBgUrl.value = data.invitationBgUrl || '';
        if (invCoverUrl) invCoverUrl.value = data.invitationCoverUrl || '';
        if (invPhoto1) invPhoto1.value = data.invitationPhoto1 || '';
        if (invPhoto2) invPhoto2.value = data.invitationPhoto2 || '';
        if (invPhoto3) invPhoto3.value = data.invitationPhoto3 || '';
        if (invPhoto4) invPhoto4.value = data.invitationPhoto4 || '';
        if (invPhoto5) invPhoto5.value = data.invitationPhoto5 || '';

        // Update real-time preview after population
        updateRealTimePreview();
        if (window.syncPhotoPreviewImages) {
          window.syncPhotoPreviewImages();
        }
        const prevTitle = document.getElementById('prev-event-title');
        if (prevTitle) {
          prevTitle.textContent = data.eventTitle || 'JANO\'S EVENTOS';
        }

        const driveLoadingContainer = document.getElementById('drive-loading-container');
        let pollCount = 0;
        
        function checkFolderUrl(currentUrl) {
          if (currentUrl) {
            if (driveLoadingContainer) driveLoadingContainer.style.display = 'none';
            if (driveLinkContainer) driveLinkContainer.style.display = 'block';
            if (driveFolderUrl) driveFolderUrl.value = currentUrl;
          } else {
            if (eventId === 'default') {
              if (driveLoadingContainer) {
                driveLoadingContainer.style.display = 'block';
                driveLoadingContainer.textContent = 'Carpeta de Google Drive no requerida en evento por defecto.';
              }
              return;
            }
            if (pollCount < 15) {
              pollCount++;
              setTimeout(() => {
                fetch(`/api/config?event=${encodeURIComponent(eventId)}`)
                  .then(res => res.json())
                  .then(newData => {
                    if (newData && newData.googleDriveFolderUrl) {
                      checkFolderUrl(newData.googleDriveFolderUrl);
                    } else {
                      checkFolderUrl(null);
                    }
                  })
                  .catch(() => {
                    checkFolderUrl(null);
                  });
              }, 3000);
            } else {
              if (driveLoadingContainer) {
                driveLoadingContainer.style.display = 'block';
                driveLoadingContainer.textContent = 'No se pudo generar la carpeta en Google Drive. Verifica la configuración de la cuenta de servicio.';
              }
            }
          }
        }
        
        checkFolderUrl(data ? data.googleDriveFolderUrl : null);
        
        if (printEventTitle) {
          printEventTitle.textContent = data.eventTitle || 'Ubicación de Mesas';
        }
        
        if (data.clientName) {
          const headerTitle = document.querySelector('.logo-group h1');
          const isPhotos = (activeService === 'photos');
          const isInvitation = (activeService === 'invitacion' || activeService === 'invitation');
          const isTrivia = (activeService === 'trivia');
          let serviceName = 'Control de Mesas';
          if (isPhotos) serviceName = 'Control de Fotos';
          if (isInvitation) serviceName = 'Invitación & RSVPs';
          if (isTrivia) serviceName = 'Control de Trivia';
          
          if (headerTitle) {
            headerTitle.textContent = `${serviceName} • ${data.clientName}`;
          }
          let pageTitle = 'Control de Mesas';
          if (isPhotos) pageTitle = 'Moderación de Fotos';
          if (isInvitation) pageTitle = 'Invitación & RSVPs';
          if (isTrivia) pageTitle = 'Control de Trivia';
          document.title = `${pageTitle} | ${data.clientName}`;
        }
      })
      .catch(err => console.error('Error config:', err));
  }

  // Load Stats from API
  function loadStats() {
    fetch(`/api/stats?event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(data => {
        statGuests.textContent = data.guestCount || 0;
        statTables.textContent = data.tableCount || 0;
        allTables = data.tables || [];
        renderTablesList(allTables);
        updateTablesDatalist();
      })
      .catch(err => {
        console.error('Error loading stats:', err);
      });
  }

  // Fetch all guests
  function loadGuests() {
    fetch(`/api/admin/guests?event=${encodeURIComponent(eventId)}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data && data.error) {
          throw new Error(data.error);
        }
        if (!Array.isArray(data)) {
          throw new Error('Response is not a valid guest list array');
        }
        allGuests = data;
        updateTablesDatalist();
        renderGuestsTable();
        renderModalGuestList();
        renderInvitadosTable();
      })
      .catch(err => {
        console.error('Error fetching guests:', err);
        guestsTableBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: var(--error); padding: 30px;">
              Error al cargar el listado de invitados: ${err.message || err}
            </td>
          </tr>
        `;
      });
  }

  function updateTablesDatalist() {
    const dropdown = document.getElementById('table-custom-dropdown');
    if (!dropdown) return;

    // Collect tables from created layout
    const layoutTableNames = allTables.map(t => t.name ? String(t.name).trim() : '');
    
    // Collect tables from guest assignments
    const guestTableNames = allGuests.map(g => g.table ? String(g.table).trim() : '');

    // Merge and filter duplicates / empty values / 'sin mesa'
    uniqueTableNamesList = [...new Set(
      [...layoutTableNames, ...guestTableNames]
        .filter(t => t && t.toLowerCase() !== 'sin mesa')
    )].sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });

    renderCustomDropdown();
  }

  function renderCustomDropdown(filter = '') {
    const dropdown = document.getElementById('table-custom-dropdown');
    if (!dropdown) return;

    const query = String(filter).trim().toLowerCase();
    
    // Filter tables list based on query
    const filteredTables = uniqueTableNamesList.filter(t => 
      t.toLowerCase().includes(query)
    );

    if (filteredTables.length === 0) {
      dropdown.innerHTML = '<div class="custom-dropdown-no-results">Sin resultados</div>';
      return;
    }

    dropdown.innerHTML = filteredTables
      .map(t => `<div class="custom-dropdown-item" data-value="${t}">${formatTableDisplay(t)}</div>`)
      .join('');

    // Attach click events to options
    dropdown.querySelectorAll('.custom-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        modalTable.value = item.getAttribute('data-value');
        hideCustomDropdown();
      });
    });
  }

  function showCustomDropdown() {
    const dropdown = document.getElementById('table-custom-dropdown');
    const toggleBtn = document.getElementById('btn-toggle-table-dropdown');
    if (!dropdown) return;
    
    // Populate/filter it before displaying
    renderCustomDropdown(modalTable.value);
    
    dropdown.classList.add('active');
    
    if (toggleBtn) {
      const svg = toggleBtn.querySelector('svg');
      if (svg) svg.style.transform = 'rotate(180deg)';
    }
  }

  function hideCustomDropdown() {
    const dropdown = document.getElementById('table-custom-dropdown');
    const toggleBtn = document.getElementById('btn-toggle-table-dropdown');
    if (!dropdown) return;
    
    dropdown.classList.remove('active');
    
    if (toggleBtn) {
      const svg = toggleBtn.querySelector('svg');
      if (svg) svg.style.transform = 'rotate(0deg)';
    }
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

  // Render guest list table (with search filtering)
  function renderGuestsTable() {
    if (!guestsTableBody) return;
    const filter = adminGuestSearch ? adminGuestSearch.value.trim().toLowerCase() : '';
    
    // Find confirmed guests (RSVPs with attending = true)
    const confirmedNames = new Set(
      allRsvps
        .filter(r => r.attending === true)
        .map(r => r.name.trim().toLowerCase())
    );

    const filteredGuests = allGuests.map((g, index) => ({ ...g, originalIndex: index }))
      .filter(g => {
        const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
        if (!confirmedNames.has(fullName)) return false;

        const table = String(g.table).toLowerCase();
        return fullName.includes(filter) || table.includes(filter);
      });

    if (filteredGuests.length === 0) {
      guestsTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">
            ${allGuests.length === 0 ? 'No hay invitados registrados en la base de datos.' : 'No se encontraron coincidencias.'}
          </td>
        </tr>
      `;
      return;
    }

    guestsTableBody.innerHTML = filteredGuests.map(g => `
      <tr>
        <td style="color: var(--text-main); font-weight: 500;">${g.firstName}</td>
        <td style="color: var(--text-main); font-weight: 500;">${g.lastName}</td>
        <td style="color: var(--gold-primary); font-weight: 600;">${formatTableDisplay(g.table)}</td>
        <td style="text-align: center; display: flex; justify-content: center; gap: 10px;">
          <button class="btn-action edit" onclick="openEditGuestModal(${g.originalIndex})">Editar</button>
          <button class="btn-action delete" onclick="confirmDeleteGuest(${g.originalIndex})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  }

  // Update modal tabs presentation
  function updateModalTabsUI() {
    const tabs = [modalTabAll, modalTabTables, modalTabNoMesa];
    const activeTab = activeModalTab === 'all' ? modalTabAll
                    : activeModalTab === 'tables' ? modalTabTables
                    : modalTabNoMesa;
    
    tabs.forEach(t => {
      if (t) {
        t.classList.remove('active');
        t.style.borderBottomColor = 'transparent';
        t.style.color = 'var(--text-muted)';
      }
    });
    
    if (activeTab) {
      activeTab.classList.add('active');
      activeTab.style.borderBottomColor = 'var(--gold-primary)';
      activeTab.style.color = 'white';
    }
  }

  // Render the detailed guest list in the modal with search and tab categorization
  function renderModalGuestList() {
    if (!modalGuestListContent) return;

    // Trigger smooth fade-in/slide-up transition on content change
    modalGuestListContent.classList.remove('modal-content-animate');
    void modalGuestListContent.offsetWidth; // Force reflow to restart CSS animation
    modalGuestListContent.classList.add('modal-content-animate');

    const filter = (modalGuestSearch ? modalGuestSearch.value : '').trim().toLowerCase();
    
    // Find confirmed guests (RSVPs with attending = true)
    const confirmedNames = new Set(
      allRsvps
        .filter(r => r.attending === true)
        .map(r => r.name.trim().toLowerCase())
    );

    // Filter the guests based on the search query first
    const filtered = allGuests.map((g, index) => ({ ...g, originalIndex: index }))
      .filter(g => {
        const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
        if (!confirmedNames.has(fullName)) return false;

        const table = String(g.table).toLowerCase();
        return fullName.includes(filter) || table.includes(filter);
      });

    modalGuestListContent.innerHTML = '';

    if (filtered.length === 0) {
      modalGuestListContent.innerHTML = `
        <div style="padding: 30px; text-align: center; color: var(--text-muted); font-family: 'Montserrat', sans-serif;">
          No se encontraron invitados.
        </div>
      `;
      return;
    }

    if (activeModalTab === 'all' || activeModalTab === 'nomesa') {
      const tabFiltered = filtered.filter(g => {
        if (activeModalTab === 'nomesa') {
          return !g.table || String(g.table).trim() === '' || String(g.table).toLowerCase() === 'sin mesa';
        }
        return true;
      });

      if (tabFiltered.length === 0) {
        modalGuestListContent.innerHTML = `
          <div style="padding: 30px; text-align: center; color: var(--text-muted); font-family: 'Montserrat', sans-serif;">
            No hay invitados en esta categoría.
          </div>
        `;
        return;
      }

      modalGuestListContent.innerHTML = tabFiltered.map(g => `
        <div class="modal-guest-item">
          <div>
            <div style="color: white; font-weight: 600; font-family: 'Montserrat', sans-serif; font-size: 0.95rem;">
              ${g.firstName} ${g.lastName}
            </div>
            <div style="color: var(--gold-primary); font-size: 0.8rem; font-weight: 500; margin-top: 3px; font-family: 'Montserrat', sans-serif;">
              ${formatTableDisplay(g.table)}
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-action edit" onclick="openEditGuestModal(${g.originalIndex})">Editar</button>
            <button class="btn-action delete" onclick="confirmDeleteGuest(${g.originalIndex})">Eliminar</button>
          </div>
        </div>
      `).join('');

    } else if (activeModalTab === 'tables') {
      const guestsWithTable = filtered.filter(g => g.table && String(g.table).trim() !== '' && String(g.table).toLowerCase() !== 'sin mesa');
      
      if (guestsWithTable.length === 0) {
        modalGuestListContent.innerHTML = `
          <div style="padding: 30px; text-align: center; color: var(--text-muted); font-family: 'Montserrat', sans-serif;">
            No hay mesas asignadas.
          </div>
        `;
        return;
      }

      const groups = {};
      guestsWithTable.forEach(g => {
        const tName = formatTableDisplay(g.table);
        if (!groups[tName]) groups[tName] = [];
        groups[tName].push(g);
      });

      const sortedTables = Object.keys(groups).sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''));
        const numB = parseInt(b.replace(/\D/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      });

      modalGuestListContent.innerHTML = sortedTables.map(tName => {
        const list = groups[tName];
        const count = list.length;
        const listHtml = list.map(g => `
          <div class="modal-guest-item">
            <div>
              <div style="color: white; font-weight: 600; font-family: 'Montserrat', sans-serif; font-size: 0.95rem;">
                ${g.firstName} ${g.lastName}
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn-action edit" onclick="openEditGuestModal(${g.originalIndex})">Editar</button>
              <button class="btn-action delete" onclick="confirmDeleteGuest(${g.originalIndex})">Eliminar</button>
            </div>
          </div>
        `).join('');

        return `
          <div class="modal-table-group">
            <div class="modal-table-header">
              <span>${tName}</span>
              <span class="modal-table-count">${count} ${count === 1 ? 'invitado' : 'invitados'}</span>
            </div>
            <div>
              ${listHtml}
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Render list of tables and guest counts
  function renderTablesList(tables) {
    if (tables.length === 0) {
      tablesBreakdownList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No hay datos de mesas disponibles.
        </div>
      `;
      return;
    }

    tablesBreakdownList.innerHTML = tables.map(t => {
      // Find all guests assigned to this table
      const guestsInTable = allGuests.filter(g => g.table === t.name);
      
      const guestsHtml = guestsInTable.map(g => {
        const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
        const rsvp = allRsvps.find(r => r.name.trim().toLowerCase() === fullName);
        
        let rsvpStatus = 'pending';
        let rsvpLabel = '⏳ Pendiente';
        let rsvpStyle = 'background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.1);';
        
        if (rsvp) {
          if (rsvp.attending) {
            rsvpStatus = 'confirmed';
            rsvpLabel = 'Asistirá';
            rsvpStyle = 'background: rgba(46, 196, 182, 0.15); color: #2ec4b6; border: 1px solid rgba(46, 196, 182, 0.3);';
          } else {
            rsvpStatus = 'declined';
            rsvpLabel = 'No Asistirá';
            rsvpStyle = 'background: rgba(231, 76, 60, 0.15); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3);';
          }
        }
        
        return `
          <div class="table-guest-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; font-size: 0.75rem; border-bottom: 1px dashed rgba(255,255,255,0.05);">
            <span style="color: var(--text-main); font-weight: 500;">${g.firstName} ${g.lastName}</span>
            <span class="rsvp-badge badge-${rsvpStatus}" style="font-size: 0.65rem; padding: 2px 8px; border-radius: 10px; font-weight: 500; ${rsvpStyle}">${rsvpLabel}</span>
          </div>
        `;
      }).join('');

      return `
        <div class="table-group">
          <div class="table-row table-collapsible-header" data-table-name="${t.name}">
            <span class="table-row-name" style="display: flex; align-items: center; gap: 8px;">
              <svg class="table-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="transition: transform 0.2s;"><path d="m9 18 6-6-6-6"/></svg>
              ${formatTableDisplay(t.name)}
            </span>
            <span class="table-row-count">${t.count} ${t.count === 1 ? 'confirmado' : 'confirmados'}</span>
          </div>
          <div class="table-row-details" style="display: none; padding: 5px 20px 10px 36px; background: rgba(0,0,0,0.15); border-bottom: 1px solid rgba(255,255,255,0.03);">
            ${guestsHtml || '<div style="padding: 10px 0; color: var(--text-muted); font-style: italic; font-size: 0.75rem;">No hay invitados asignados.</div>'}
          </div>
        </div>
      `;
    }).join('');
  }


  // Add/Edit guest save operation
  function saveGuestForm() {
    const idx = guestIndexInput.value;
    const guestData = {
      firstName: modalFirstName.value.trim(),
      lastName: modalLastName.value.trim(),
      table: modalTable.value.trim()
    };

    const isEdit = idx !== '';
    const url = isEdit ? `/api/guests/${idx}?event=${encodeURIComponent(eventId)}` : `/api/guests?event=${encodeURIComponent(eventId)}`;
    const method = isEdit ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guestData)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          guestModal.classList.remove('active');
          hideCustomDropdown();
          
          // Auto-confirm guest RSVP if a table is assigned
          const isTableAssigned = guestData.table && guestData.table.trim() !== '' && guestData.table.toLowerCase() !== 'sin mesa';
          if (isTableAssigned) {
            const fullName = `${guestData.firstName} ${guestData.lastName}`;
            const existingRsvp = allRsvps.find(r => r.name.trim().toLowerCase() === fullName.trim().toLowerCase());
            if (!existingRsvp || !existingRsvp.attending) {
              const payload = {
                name: fullName,
                attending: true,
                companionsCount: existingRsvp ? existingRsvp.companionsCount : 0,
                companionsNames: existingRsvp ? existingRsvp.companionsNames : '',
                dietaryRestrictions: existingRsvp ? existingRsvp.dietaryRestrictions : 'Ninguno',
                suggestedSong: existingRsvp ? existingRsvp.suggestedSong : ''
              };
              
              fetch(`/api/public/rsvp?event=${encodeURIComponent(eventId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              })
              .then(() => {
                loadRsvps();
                loadStats();
                loadGuests();
              });
            } else {
              loadStats();
              loadGuests();
            }
          } else {
            loadStats();
            loadGuests();
          }

          showToast('Invitado guardado correctamente', 'success');
        } else {
          showToast('Error al guardar el invitado: ' + (data.error || 'error desconocido'), 'error');
        }
      })
      .catch(err => {
        console.error(err);
        showToast('Error de red al intentar guardar.', 'error');
      });
  }


  // Expose CRUD helper triggers to window since table templates use them inline
  window.openEditGuestModal = (index) => {
    const guest = allGuests[index];
    modalTitle.textContent = 'Editar Invitado';
    guestIndexInput.value = index;
    modalFirstName.value = guest.firstName;
    modalLastName.value = guest.lastName;
    modalTable.value = guest.table;
    hideCustomDropdown();
    guestModal.classList.add('active');
  };

  window.confirmDeleteGuest = (index) => {
    const guest = allGuests[index];
    showConfirm(
      '¿Eliminar Invitado?',
      `¿Estás seguro de que deseas eliminar a ${guest.firstName} ${guest.lastName} de la lista de invitados? Esta acción no se puede deshacer.`,
      () => {
        fetch(`/api/guests/${index}?event=${encodeURIComponent(eventId)}`, { method: 'DELETE' })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              loadStats();
              loadGuests();
              showToast('Invitado eliminado correctamente', 'success');
            } else {
              showToast('Error al intentar eliminar.', 'error');
            }
          })
          .catch(err => {
            console.error(err);
            showToast('Error de red al intentar eliminar.', 'error');
          });
      }
    );
  };

  // Onboarding Modal logic
  const onboardingModal = document.getElementById('onboarding-modal');
  const btnCloseOnboarding = document.getElementById('btn-close-onboarding');

  if (onboardingModal && btnCloseOnboarding) {
    if (!localStorage.getItem(`onboarding_dismissed_${eventId}`)) {
      onboardingModal.classList.add('active');
    }
    
    btnCloseOnboarding.addEventListener('click', () => {
      onboardingModal.classList.remove('active');
      localStorage.setItem(`onboarding_dismissed_${eventId}`, 'true');
    });
  }

  // --- Phase 3: Invitation & RSVP Management Logic ---
  
  function saveInvitationConfig() {
    showToast('loading', '', 'Guardando cambios en tu invitación...');

    const payload = {
      eventTitle: invTitleInput ? invTitleInput.value.trim() : '',
      invitationEventDate: (function() {
        if (invDateOnlyInput && invDateOnlyInput.value) {
          // Convert DD/MM/YYYY to YYYY-MM-DD
          let isoDate = '';
          const parts = invDateOnlyInput.value.trim().split('/');
          if (parts.length === 3) {
            isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else {
            isoDate = invDateOnlyInput.value.trim();
          }

          const timeVal = (invTimeOnlyInput && invTimeOnlyInput.value) ? invTimeOnlyInput.value.trim() : '00:00';
          let formattedTime = '00:00';
          const timeParts = timeVal.split(':');
          if (timeParts.length >= 1) {
            let h = parseInt(timeParts[0], 10);
            if (isNaN(h) || h < 0 || h > 23) h = 0;
            let m = 0;
            if (timeParts.length >= 2) {
              m = parseInt(timeParts[1], 10);
              if (isNaN(m) || m < 0 || m > 59) m = 0;
            }
            formattedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
          return `${isoDate}T${formattedTime}`;
        }
        return '';
      })(),
      invitationMusicUrl: invMusicInput ? invMusicInput.value.trim() : '',
      invitationPartyAddress: invAddressInput ? invAddressInput.value.trim() : '',
      invitationPartyMapsUrl: invMapsInput ? invMapsInput.value.trim() : '',
      invitationCbu: invCbuInput ? invCbuInput.value.trim() : '',
      invitationAlias: invAliasInput ? invAliasInput.value.trim() : '',
      invitationBankHolder: invBankHolderInput ? invBankHolderInput.value.trim() : '',
      invitationDressCode: invDressInput ? invDressInput.value.trim() : '',
      invitationThemeFont: invThemeFont ? invThemeFont.value : 'classic-editorial',
      invitationThemeColor: invThemeColor ? invThemeColor.value : 'golden-luxury',
      invitationBgEffect: invBgEffect ? invBgEffect.value : 'golden-dust',
      invitationWaxSealDesign: invWaxSeal ? invWaxSeal.value : 'rings',
      invitationBgUrl: invBgUrl ? invBgUrl.value.trim() : '',
      invitationCoverUrl: invCoverUrl ? invCoverUrl.value.trim() : '',
      invitationPhoto1: invPhoto1 ? invPhoto1.value.trim() : '',
      invitationPhoto2: invPhoto2 ? invPhoto2.value.trim() : '',
      invitationPhoto3: invPhoto3 ? invPhoto3.value.trim() : '',
      invitationPhoto4: invPhoto4 ? invPhoto4.value.trim() : '',
      invitationPhoto5: invPhoto5 ? invPhoto5.value.trim() : ''
    };

    if (!payload.eventTitle) {
      showToast('error', '¡Atención!', 'El título del evento es obligatorio.', 4000);
      return;
    }

    fetch(`/api/config?event=${encodeURIComponent(eventId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast('success', '¡Éxito!', 'Configuración de la invitación guardada correctamente!', 3000);
        
        // Propagate event title updates to other tabs/inputs
        const eventTitleInput = document.getElementById('event-title-input');
        const eventTitlePhotosInput = document.getElementById('event-title-photos-input');
        if (eventTitleInput) eventTitleInput.value = payload.eventTitle;
        if (eventTitlePhotosInput) eventTitlePhotosInput.value = payload.eventTitle;
        if (printEventTitle) printEventTitle.textContent = payload.eventTitle;
      } else {
        showToast('error', 'Error', data.error || 'Error al guardar la configuración.', 4000);
      }
    })
    .catch(err => {
      console.error(err);
      showToast('error', 'Error', 'Error de red al intentar guardar.', 4000);
    });
  }

  function loadRsvps() {
    fetch(`/api/rsvps?event=${encodeURIComponent(eventId)}`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data && data.error) {
          throw new Error(data.error);
        }
        if (!Array.isArray(data)) {
          throw new Error('Response is not a valid RSVP list array');
        }
        allRsvps = data;
        renderRsvpStats();
        renderRsvpTable();
        renderInvitadosTable();
        renderGuestsTable();
        renderModalGuestList();
      })
      .catch(err => {
        console.error('Error fetching RSVPs:', err);
        if (rsvpTableBody) {
          rsvpTableBody.innerHTML = `
            <tr>
              <td colspan="5" style="text-align: center; color: var(--error); padding: 30px;">
                Error al cargar el listado de confirmaciones: ${err.message || err}
              </td>
            </tr>
          `;
        }
      });
  }

  function renderRsvpStats() {
    let confirmedCount = 0;
    let declinedCount = 0;
    let totalCount = 0;
    const dietaryMap = {};
    const songs = [];

    allRsvps.forEach(rsvp => {
      if (rsvp.attending) {
        const companions = parseInt(rsvp.companionsCount, 10) || 0;
        confirmedCount += (1 + companions);
        
        if (rsvp.dietaryRestrictions && rsvp.dietaryRestrictions !== 'Ninguno') {
          dietaryMap[rsvp.dietaryRestrictions] = (dietaryMap[rsvp.dietaryRestrictions] || 0) + 1;
        }
        
        if (rsvp.suggestedSong && rsvp.suggestedSong.trim() !== '') {
          songs.push({ name: rsvp.name, song: rsvp.suggestedSong.trim() });
        }
      } else {
        declinedCount += 1;
      }
      totalCount += 1;
    });

    if (rsvpStatConfirmed) rsvpStatConfirmed.textContent = confirmedCount;
    if (rsvpStatDeclined) rsvpStatDeclined.textContent = declinedCount;
    if (rsvpStatTotalGuests) rsvpStatTotalGuests.textContent = totalCount;

    if (rsvpDietBreakdown) {
      const dietaryKeys = Object.keys(dietaryMap);
      if (dietaryKeys.length === 0) {
        rsvpDietBreakdown.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 10px;">Ninguna restricción reportada.</div>`;
      } else {
        rsvpDietBreakdown.innerHTML = dietaryKeys.map(key => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.75rem;">
            <span>${key}</span>
            <span style="font-weight: bold; color: var(--accent-gold);">${dietaryMap[key]}</span>
          </div>
        `).join('');
      }
    }

    if (rsvpSongsList) {
      if (songs.length === 0) {
        rsvpSongsList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 10px;">No hay sugerencias musicales.</div>`;
      } else {
        rsvpSongsList.innerHTML = songs.map(s => `
          <div style="padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 0.75rem; line-height: 1.4;">
            <div style="font-weight: bold; color: white;">${s.song}</div>
            <div style="color: var(--text-muted); font-size: 0.65rem;">Sugerido por: ${s.name}</div>
          </div>
        `).join('');
      }
    }
  }

  function renderRsvpTable() {
    if (!rsvpTableBody) return;
    const filter = rsvpSearchInput ? rsvpSearchInput.value.trim().toLowerCase() : '';
    const filteredRsvps = allRsvps.filter(rsvp => {
      return rsvp.name.toLowerCase().includes(filter) || 
             (rsvp.companionsNames && rsvp.companionsNames.toLowerCase().includes(filter)) ||
             (rsvp.dietaryRestrictions && rsvp.dietaryRestrictions.toLowerCase().includes(filter));
    });

    if (filteredRsvps.length === 0) {
      rsvpTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">
            ${allRsvps.length === 0 ? 'No hay confirmaciones de asistencia recibidas.' : 'No se encontraron coincidencias.'}
          </td>
        </tr>
      `;
      return;
    }

    rsvpTableBody.innerHTML = filteredRsvps.map(rsvp => {
      const attendingText = rsvp.attending 
        ? `<span style="color: #2ec4b6; font-weight: bold;">Sí, asiste</span>` 
        : `<span style="color: var(--error); font-weight: bold;">No asiste</span>`;
      
      const companionsText = rsvp.companionsCount > 0 
        ? `<span>${rsvp.companionsCount} (${rsvp.companionsNames || ''})</span>` 
        : `<span style="color: var(--text-muted);">-</span>`;
      
      const dietText = rsvp.dietaryRestrictions && rsvp.dietaryRestrictions !== 'Ninguno'
        ? `<span style="color: #f3e5ab; font-weight: 500;">${rsvp.dietaryRestrictions}</span>`
        : `<span style="color: var(--text-muted);">-</span>`;

      return `
        <tr data-id="${rsvp.id}">
          <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.03); color: white;">${rsvp.name}</td>
          <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.03);">${attendingText}</td>
          <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.03); color: white;">${companionsText}</td>
          <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.03);">${dietText}</td>
          <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.03); text-align: center;">
            <button class="btn btn-delete-rsvp" data-id="${rsvp.id}" style="padding: 4px 8px; border-radius: 6px; font-size: 0.65rem; background: rgba(255,0,0,0.15); color: #ff4d4d; border: 1px solid rgba(255,0,0,0.3); cursor: pointer;">
              Eliminar
            </button>
          </td>
        </tr>
      `;
    }).join('');

    rsvpTableBody.querySelectorAll('.btn-delete-rsvp').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deleteRsvpEntry(id);
      });
    });
  }

  function deleteRsvpEntry(id) {
    showConfirm(
      '¿Eliminar Confirmación?',
      '¿Estás seguro de que deseas eliminar esta confirmación de asistencia? Esta acción no se puede deshacer.',
      () => {
        fetch(`/api/rsvps/${id}?event=${encodeURIComponent(eventId)}`, {
          method: 'DELETE'
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            loadRsvps();
            showToast('Confirmación eliminada correctamente', 'success');
          } else {
            showToast(data.error || 'Error al eliminar la confirmación.', 'error');
          }
        })
        .catch(err => {
          console.error('Error deleting RSVP:', err);
          showToast('Error de conexión con el servidor.', 'error');
        });
      }
    );
  }

  function preparePrintPoster(serviceType) {
    const isPhotos = (serviceType === 'photos');
    const isInvitation = (serviceType === 'invitation');
    
    let targetPath = '/mesas';
    if (isPhotos) targetPath = '/fotos';
    if (isInvitation) targetPath = '/invitacion.html';
    
    const targetUrl = `${siteOrigin}${targetPath}?event=${encodeURIComponent(eventId)}`;
    const printQrUrl = `${qrBaseUrl}?size=500x500&data=${encodeURIComponent(targetUrl)}&color=000000&bgcolor=ffffff`;

    if (printQrImg) {
      printQrImg.src = printQrUrl;
    }

    const printTitle = document.getElementById('print-event-title');
    const printSubtitle = document.querySelector('.print-subtitle');
    const printInstructions = document.querySelector('.print-instructions');

    if (printTitle) {
      printTitle.textContent = isPhotos ? 'Muro de Fotos' : (isInvitation ? 'Invitación Interactiva' : 'Ubicación de Mesas');
    }
    if (printSubtitle) {
      printSubtitle.textContent = isPhotos ? 'Comparte tus Momentos' : (isInvitation ? 'Accede a la Invitación' : 'Encuentra tu Mesa');
    }
    if (printInstructions) {
      printInstructions.innerHTML = isPhotos 
        ? 'Escanéa este código con la cámara de tu celular<br>para subir fotos y mensajes al muro.'
        : (isInvitation 
           ? 'Escanéa este código con la cámara de tu celular<br>para abrir la invitación interactiva y confirmar asistencia.'
           : 'Escanéa este código con la cámara de tu celular<br>para consultar tu mesa asignada.');
    }
  }

  // --- Bind Phase 3 Event Listeners ---
  
  if (tabBtnInvitacion) {
    tabBtnInvitacion.addEventListener('click', () => switchTab('invitacion'));
  }

  const btnSaveInvitationConfigs = document.querySelectorAll('.btn-save-invitation-config');
  btnSaveInvitationConfigs.forEach(btn => {
    btn.addEventListener('click', saveInvitationConfig);
  });

  // Dynamic audio compression helpers
  function loadLamejs() {
    return new Promise((resolve, reject) => {
      if (window.lamejs) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = '/js/lame.min.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar la librería de compresión de audio.'));
      document.head.appendChild(script);
    });
  }

  function floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  function getOptimalBitrate(maxBytes, duration) {
    const standardBitrates = [32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const maxBits = (maxBytes * 0.92) * 8; // 8% safety margin for MP3 headers
    const maxKbps = maxBits / (duration * 1000);
    
    let optimal = 32;
    for (const rate of standardBitrates) {
      if (rate <= maxKbps) {
        optimal = rate;
      } else {
        break;
      }
    }
    return optimal;
  }

  function createAudioUploadProgressModal() {
    // Remove existing if any
    const existing = document.getElementById('audio-upload-progress-modal');
    if (existing) {
      existing.remove();
    }

    // Backdrop
    const backdrop = document.createElement('div');
    backdrop.id = 'audio-upload-progress-modal';
    backdrop.className = 'audio-up-backdrop';

    // Modal Card
    const modal = document.createElement('div');
    modal.className = 'audio-up-modal';

    modal.innerHTML = `
      <div class="audio-up-header">
        <h3>Cargando Pista de Audio</h3>
        <button class="audio-up-close" style="display: none;">&times;</button>
      </div>
      <div class="audio-up-progress-wrap">
        <svg class="audio-up-svg" viewBox="0 0 100 100">
          <circle class="audio-up-bg-circle" cx="50" cy="50" r="40"></circle>
          <circle class="audio-up-fill-circle" id="audio-up-circle-fill" cx="50" cy="50" r="40"></circle>
        </svg>
        <div class="audio-up-progress-text" id="audio-up-text">0%</div>
      </div>
      <div class="audio-up-status-title" id="audio-up-status-title">Iniciando...</div>
      
      <ul class="audio-up-steps">
        <li class="audio-up-step" id="audio-up-step-analyze">
          <span class="audio-up-step-icon"></span>
          <span class="audio-up-step-label">Analizando pista de audio</span>
        </li>
        <li class="audio-up-step" id="audio-up-step-compress">
          <span class="audio-up-step-icon"></span>
          <span class="audio-up-step-label">Subiendo tu pista</span>
        </li>
        <li class="audio-up-step" id="audio-up-step-upload">
          <span class="audio-up-step-icon"></span>
          <span class="audio-up-step-label">Finalizando</span>
        </li>
      </ul>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Trigger CSS animations
    setTimeout(() => {
      backdrop.classList.add('active');
    }, 10);

    const fillCircle = document.getElementById('audio-up-circle-fill');
    const progressText = document.getElementById('audio-up-text');
    const statusTitle = document.getElementById('audio-up-status-title');
    const closeBtn = backdrop.querySelector('.audio-up-close');

    closeBtn.addEventListener('click', () => {
      closeModal();
    });

    const circumference = 251.2;
    fillCircle.style.strokeDasharray = circumference;
    fillCircle.style.strokeDashoffset = circumference;

    function setProgress(percent) {
      const offset = circumference - (percent / 100) * circumference;
      fillCircle.style.strokeDashoffset = offset;
      progressText.textContent = `${Math.round(percent)}%`;
    }

    function closeModal() {
      backdrop.classList.remove('active');
      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.remove();
        }
      }, 350);
    }

    return {
      updateProgress: (percent) => {
        setProgress(percent);
      },
      updateStep: (step, status, details = '') => {
        const stepEl = document.getElementById(`audio-up-step-${step}`);
        if (!stepEl) return;

        stepEl.classList.remove('active', 'completed', 'error');
        
        if (status === 'active') {
          stepEl.classList.add('active');
          if (details) {
            statusTitle.textContent = details;
          } else {
            statusTitle.textContent = stepEl.querySelector('.audio-up-step-label').textContent + '...';
          }
        } else if (status === 'completed') {
          stepEl.classList.add('completed');
        } else if (status === 'error') {
          stepEl.classList.add('error');
        }
      },
      setSuccess: () => {
        setProgress(100);
        statusTitle.textContent = '¡Pista guardada con éxito!';
        statusTitle.style.color = 'var(--success)';
        fillCircle.style.stroke = 'var(--success)';
        progressText.innerHTML = '✓';
        progressText.style.color = 'var(--success)';
        
        ['analyze', 'compress', 'upload'].forEach(s => {
          const el = document.getElementById(`audio-up-step-${s}`);
          if (el && !el.classList.contains('error')) {
            el.classList.remove('active');
            el.classList.add('completed');
          }
        });

        setTimeout(() => {
          closeModal();
        }, 2000);
      },
      setError: (msg) => {
        statusTitle.textContent = msg;
        statusTitle.style.color = 'var(--error)';
        fillCircle.style.stroke = 'var(--error)';
        progressText.innerHTML = '✕';
        progressText.style.color = 'var(--error)';
        closeBtn.style.display = 'block';
      },
      close: closeModal
    };
  }

  function uploadAudioWithProgress(uploadFile, progressModal, eventId) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('audio', uploadFile, 'audio.mp3');

      xhr.open('POST', `/api/audio/upload?event=${encodeURIComponent(eventId)}`);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const uploadPercent = (e.loaded / e.total) * 100;
          const overallPercent = 60 + (uploadPercent * 0.4);
          progressModal.updateProgress(overallPercent);
          progressModal.updateStep('upload', 'active', `Finalizando: ${Math.round(uploadPercent)}%`);
        }
      });

      xhr.onload = () => {
        let data;
        const contentType = xhr.getResponseHeader('content-type');
        if (contentType && contentType.includes('application/json')) {
          try {
            data = JSON.parse(xhr.responseText);
          } catch (e) {
            return reject(new Error('Respuesta de servidor inválida.'));
          }
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          if (data && data.success) {
            resolve(data);
          } else {
            reject(new Error((data && data.error) || 'Error al subir el archivo'));
          }
        } else {
          if (xhr.status === 413) {
            const maxMb = (maxUploadSize / (1024 * 1024)).toFixed(1);
            reject(new Error(`El archivo de audio es demasiado grande para el servidor (límite de ${maxMb}MB).`));
          } else {
            reject(new Error((data && data.error) || xhr.responseText.substring(0, 100) || `Error del servidor (código ${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Error de conexión con el servidor.'));
      };

      xhr.send(formData);
    });
  }

  if (invAudioUpload) {
    invAudioUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      let uploadFile = file;
      const progressModal = createAudioUploadProgressModal();

      try {
        // --- STEP 1: ANALYZE ---
        progressModal.updateStep('analyze', 'active', 'Analizando pista de audio...');
        progressModal.updateProgress(5);

        const arrayBuffer = await file.arrayBuffer();
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        let audioBuffer;
        try {
          audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (decodeErr) {
          throw new Error('No se pudo decodificar el archivo de audio. Asegúrate de que sea un archivo de sonido válido.');
        }

        progressModal.updateProgress(12);

        const targetSampleRate = audioBuffer.sampleRate > 32000 ? 32000 : audioBuffer.sampleRate;
        const offlineCtx = new OfflineAudioContext(
          1, // mono
          Math.round(audioBuffer.duration * targetSampleRate),
          targetSampleRate
        );

        const bufferSource = offlineCtx.createBufferSource();
        bufferSource.buffer = audioBuffer;
        bufferSource.connect(offlineCtx.destination);
        bufferSource.start();

        const renderedBuffer = await offlineCtx.startRendering();
        const duration = renderedBuffer.duration;
        const optimalBitrate = getOptimalBitrate(maxUploadSize, duration);

        progressModal.updateProgress(20);
        progressModal.updateStep('analyze', 'completed');

        // --- STEP 2: COMPRESS ---
        if (file.size > maxUploadSize) {
          progressModal.updateStep('compress', 'active', 'Subiendo tu pista...');
          
          await loadLamejs();
          
          const channelData = renderedBuffer.getChannelData(0);
          const pcmData = floatTo16BitPCM(channelData);
          
          const mp3encoder = new lamejs.Mp3Encoder(1, targetSampleRate, optimalBitrate);
          const mp3Data = [];
          const sampleBlockSize = 1152;
          
          const totalLength = pcmData.length;
          
          for (let i = 0; i < totalLength; i += sampleBlockSize) {
            const chunk = pcmData.subarray(i, i + sampleBlockSize);
            const mp3buf = mp3encoder.encodeBuffer(chunk);
            if (mp3buf.length > 0) {
              mp3Data.push(mp3buf);
            }
            
            // Map 0-100% of compression loop to 20-60% of total ring progress
            const compPercent = (i / totalLength) * 100;
            const overallPercent = 20 + (compPercent * 0.4);
            progressModal.updateProgress(overallPercent);
            progressModal.updateStep('compress', 'active', `Subiendo tu pista: ${Math.round(compPercent)}%`);
          }
          
          const endBuf = mp3encoder.flush();
          if (endBuf.length > 0) {
            mp3Data.push(endBuf);
          }

          const compressedBlob = new Blob(mp3Data, { type: 'audio/mp3' });
          
          if (compressedBlob.size > maxUploadSize) {
            const maxMb = (maxUploadSize / (1024 * 1024)).toFixed(1);
            throw new Error(`El archivo es demasiado largo (${Math.round(duration)}s) para comprimirse bajo el límite de ${maxMb}MB.`);
          }

          uploadFile = compressedBlob;
          console.log(`Audio compressed successfully: ${file.size} bytes -> ${compressedBlob.size} bytes (Bitrate: ${optimalBitrate}kbps)`);
          
          progressModal.updateProgress(60);
          progressModal.updateStep('compress', 'completed');
        } else {
          // Compression not required
          progressModal.updateStep('compress', 'active', 'Subiendo tu pista...');
          await new Promise(resolve => setTimeout(resolve, 600)); // small delay for visual rhythm
          progressModal.updateProgress(60);
          progressModal.updateStep('compress', 'completed');
        }

        // --- STEP 3: UPLOAD ---
        progressModal.updateStep('upload', 'active', 'Finalizando...');
        const data = await uploadAudioWithProgress(uploadFile, progressModal, eventId);

        // Success finalization
        progressModal.updateStep('upload', 'completed');
        progressModal.setSuccess();

        if (invMusicInput) {
          invMusicInput.value = data.url;
          invMusicInput.dispatchEvent(new Event('input'));
        }
        if (invAudioUploadStatus) {
          invAudioUploadStatus.textContent = '¡Pista subida con éxito!';
          invAudioUploadStatus.style.color = '#10b981';
        }
      } catch (err) {
        console.error('Audio process/upload failed:', err);
        
        // Find which step failed and mark it
        if (!document.getElementById('audio-up-step-analyze').classList.contains('completed')) {
          progressModal.updateStep('analyze', 'error');
        } else if (!document.getElementById('audio-up-step-compress').classList.contains('completed')) {
          progressModal.updateStep('compress', 'error');
        } else {
          progressModal.updateStep('upload', 'error');
        }

        progressModal.setError(err.message);

        if (invAudioUploadStatus) {
          invAudioUploadStatus.textContent = `Error: ${err.message}`;
          invAudioUploadStatus.style.color = '#ef4444';
        }
      } finally {
        invAudioUpload.value = '';
      }
    });
  }

  if (invTimeOnlyInput) {
    invTimeOnlyInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9:]/g, '');
      if (val.length === 4 && !val.includes(':')) {
        val = val.substring(0, 2) + ':' + val.substring(2);
      }
      e.target.value = val;
    });

    invTimeOnlyInput.addEventListener('blur', (e) => {
      let val = e.target.value.trim();
      if (!val) return;
      
      if (/^\d+$/.test(val)) {
        if (val.length === 1) val = '0' + val + ':00';
        else if (val.length === 2) val = val + ':00';
        else if (val.length === 3) val = '0' + val.substring(0,1) + ':' + val.substring(1);
        else if (val.length === 4) val = val.substring(0, 2) + ':' + val.substring(2);
      }
      
      const match = val.match(/^(\d{1,2}):(\d{2})$/);
      if (match) {
        let hrs = parseInt(match[1], 10);
        let mins = parseInt(match[2], 10);
        if (hrs > 23) hrs = 23;
        if (mins > 59) mins = 59;
        e.target.value = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      } else {
        e.target.value = '21:00';
      }
    });
  }

  if (rsvpSearchInput) {
    rsvpSearchInput.addEventListener('input', renderRsvpTable);
  }

  if (btnCopyInvitationUrl) {
    btnCopyInvitationUrl.addEventListener('click', () => {
      if (invitationPublicUrl) {
        invitationPublicUrl.select();
        navigator.clipboard.writeText(invitationPublicUrl.value).then(() => {
          const prevText = btnCopyInvitationUrl.textContent;
          btnCopyInvitationUrl.textContent = '¡Copiado!';
          btnCopyInvitationUrl.style.background = 'var(--success)';
          btnCopyInvitationUrl.style.color = '#0b0b0c';
          btnCopyInvitationUrl.style.borderColor = 'var(--success)';
          
          if (navigator.vibrate) navigator.vibrate(40);
          
          setTimeout(() => {
            btnCopyInvitationUrl.textContent = prevText;
            btnCopyInvitationUrl.style.background = 'var(--gold-gradient)';
            btnCopyInvitationUrl.style.color = '#0b0b0c';
            btnCopyInvitationUrl.style.borderColor = 'var(--gold-primary)';
          }, 2000);
        });
      }
    });
  }


  // --- REAL-TIME PREVIEW LOGIC ---
  const fontPairings = {
    'classic-editorial': {
      title: "'Playfair Display', serif",
      body: "'Montserrat', sans-serif"
    },
    'romantic-charms': {
      title: "'Great Vibes', cursive",
      body: "'Open Sans', sans-serif"
    },
    'cinematic-roman': {
      title: "'Cinzel', serif",
      body: "'Lora', serif"
    },
    'modern-minimalist': {
      title: "'Outfit', sans-serif",
      body: "'Outfit', sans-serif"
    }
  };

  const colorThemes = {
    'golden-luxury': {
      bgDark: '#0b0b0c',
      bgCard: 'rgba(22, 22, 25, 0.45)',
      goldPrimary: '#d4af37',
      goldGradient: 'linear-gradient(135deg, #f3e5ab 0%, #d4af37 50%, #aa7c11 100%)',
      borderGold: 'rgba(212, 175, 55, 0.15)',
      textMuted: '#a0a0a5'
    },
    'romantic-rose': {
      bgDark: '#1f1618',
      bgCard: 'rgba(40, 28, 30, 0.45)',
      goldPrimary: '#b76e79',
      goldGradient: 'linear-gradient(135deg, #ffd1dc 0%, #b76e79 50%, #8a4f58 100%)',
      borderGold: 'rgba(183, 110, 121, 0.15)',
      textMuted: '#c7b0b3'
    },
    'emerald-forest': {
      bgDark: '#071510',
      bgCard: 'rgba(12, 33, 26, 0.45)',
      goldPrimary: '#c5a059',
      goldGradient: 'linear-gradient(135deg, #f1dfbe 0%, #c5a059 50%, #8d6e32 100%)',
      borderGold: 'rgba(197, 160, 89, 0.15)',
      textMuted: '#a5b5af'
    },
    'midnight-blue': {
      bgDark: '#080d1a',
      bgCard: 'rgba(15, 23, 42, 0.45)',
      goldPrimary: '#a0aec0',
      goldGradient: 'linear-gradient(135deg, #edf2f7 0%, #a0aec0 50%, #718096 100%)',
      borderGold: 'rgba(160, 174, 192, 0.15)',
      textMuted: '#a0a5b5'
    },
    'minimalist-pearl': {
      bgDark: '#121212',
      bgCard: 'rgba(30, 30, 30, 0.45)',
      goldPrimary: '#ffffff',
      goldGradient: 'linear-gradient(135deg, #e2e8f0 0%, #ffffff 50%, #888888 100%)',
      borderGold: 'rgba(255, 255, 255, 0.10)',
      textMuted: '#a0a0a0'
    }
  };

  const waxSeals = {
    rings: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="12" r="5"></circle><circle cx="15" cy="12" r="5"></circle></svg>`,
    heart: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
    crown: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"></path><path d="M5 20h14"></path></svg>`,
    star: `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  };

  function updateRealTimePreview() {
    if (window.syncPhotoPreviewImages) {
      window.syncPhotoPreviewImages();
    }
    if (!previewIframe || !isIframeLoaded) return;

    const configPayload = {
      invThemeColor: invThemeColor ? invThemeColor.value : 'golden-luxury',
      invThemeFont: invThemeFont ? invThemeFont.value : 'classic-editorial',
      invWaxSeal: invWaxSeal ? invWaxSeal.value : 'rings',
      invBgEffect: invBgEffect ? invBgEffect.value : 'none',
      invBgUrl: invBgUrl ? invBgUrl.value.trim() : '',
      invCoverUrl: invCoverUrl ? invCoverUrl.value.trim() : '',
      invPhoto1: invPhoto1 ? invPhoto1.value.trim() : '',
      invPhoto2: invPhoto2 ? invPhoto2.value.trim() : '',
      invPhoto3: invPhoto3 ? invPhoto3.value.trim() : '',
      invPhoto4: invPhoto4 ? invPhoto4.value.trim() : '',
      invPhoto5: invPhoto5 ? invPhoto5.value.trim() : '',
      title: invTitleInput ? invTitleInput.value.trim() : '',
      date: invDateOnlyInput ? invDateOnlyInput.value.trim() : '',
      time: invTimeOnlyInput ? invTimeOnlyInput.value.trim() : '21:00'
    };

    previewIframe.contentWindow.postMessage({
      type: 'invitation-preview-update',
      config: configPayload
    }, '*');
  }

  // --- Real-time preview input listeners ---
  const inputsToListen = [
    invThemeFont, invThemeColor, invBgEffect, invWaxSeal,
    invBgUrl, invCoverUrl, invTitleInput, invDateOnlyInput, invTimeOnlyInput,
    invPhoto1, invPhoto2, invPhoto3, invPhoto4, invPhoto5
  ];

  inputsToListen.forEach(input => {
    if (input) {
      input.addEventListener('change', updateRealTimePreview);
      input.addEventListener('input', updateRealTimePreview);
    }
  });

  // --- View Toggle Buttons Logic ---
  if (btnPrevViewEnvelope && btnPrevViewCard) {
    btnPrevViewEnvelope.addEventListener('click', () => {
      if (previewIframe && isIframeLoaded) {
        previewIframe.contentWindow.postMessage({
          type: 'invitation-preview-toggle',
          view: 'envelope'
        }, '*');
      }
      
      btnPrevViewEnvelope.style.background = 'var(--gold-gradient)';
      btnPrevViewEnvelope.style.color = '#0b0b0c';
      btnPrevViewEnvelope.style.borderColor = 'rgba(255,255,255,0.1)';
      
      btnPrevViewCard.style.background = 'rgba(255, 255, 255, 0.05)';
      btnPrevViewCard.style.color = '#888';
      btnPrevViewCard.style.borderColor = 'rgba(255,255,255,0.05)';
    });

    btnPrevViewCard.addEventListener('click', () => {
      if (previewIframe && isIframeLoaded) {
        previewIframe.contentWindow.postMessage({
          type: 'invitation-preview-toggle',
          view: 'card'
        }, '*');
      }
      
      btnPrevViewCard.style.background = 'var(--gold-gradient)';
      btnPrevViewCard.style.color = '#0b0b0c';
      btnPrevViewCard.style.borderColor = 'rgba(255,255,255,0.1)';
      
      btnPrevViewEnvelope.style.background = 'rgba(255, 255, 255, 0.05)';
      btnPrevViewEnvelope.style.color = '#888';
      btnPrevViewEnvelope.style.borderColor = 'rgba(255,255,255,0.05)';
    });
  }

  if (btnPrintInvitationQr) {
    btnPrintInvitationQr.addEventListener('click', () => {
      preparePrintPoster('invitation');
      setTimeout(() => window.print(), 150);
    });
  }

  // Custom Datepicker Logic
  function initCustomDatePicker() {
    const container = document.getElementById('datepicker-container');
    const toggleBtn = document.getElementById('btn-datepicker-toggle');
    const dropdown = document.getElementById('custom-datepicker-dropdown');
    
    if (!container || !toggleBtn || !dropdown || !invDateOnlyInput) return;

    let currentDate = new Date(); // Month/year currently viewed in calendar
    
    // Toggle dropdown
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
      if (dropdown.classList.contains('active')) {
        // Parse current input date or default to today
        const parsed = parseInputDate(invDateOnlyInput.value);
        currentDate = parsed || new Date();
        renderCalendar(currentDate);
      }
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });

    // Format typing input: auto-adds slashes
    invDateOnlyInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, ''); // Numbers only
      if (val.length > 8) val = val.substring(0, 8);
      
      let formatted = '';
      if (val.length > 0) {
        formatted += val.substring(0, 2);
      }
      if (val.length > 2) {
        formatted += '/' + val.substring(2, 4);
      }
      if (val.length > 4) {
        formatted += '/' + val.substring(4, 8);
      }
      
      e.target.value = formatted;
      updateRealTimePreview();
    });

    // Parse DD/MM/YYYY to Date object
    function parseInputDate(str) {
      if (!str) return null;
      const parts = str.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) return d;
      }
      return null;
    }

    // Helper: format Date object to DD/MM/YYYY
    function formatDate(d) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    function renderCalendar(date) {
      dropdown.innerHTML = '';
      
      const year = date.getFullYear();
      const month = date.getMonth();

      // Header
      const header = document.createElement('div');
      header.className = 'calendar-header';

      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'btn-cal-prev';
      prevBtn.innerHTML = '‹';
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
      });

      const title = document.createElement('span');
      title.className = 'calendar-month-year';
      title.textContent = `${monthNames[month]} ${year}`;

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'btn-cal-next';
      nextBtn.innerHTML = '›';
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
      });

      header.appendChild(prevBtn);
      header.appendChild(title);
      header.appendChild(nextBtn);
      dropdown.appendChild(header);

      // Weekdays
      const weekdays = document.createElement('div');
      weekdays.className = 'calendar-weekdays';
      ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(day => {
        const span = document.createElement('span');
        span.textContent = day;
        weekdays.appendChild(span);
      });
      dropdown.appendChild(weekdays);

      // Days grid
      const daysGrid = document.createElement('div');
      daysGrid.className = 'calendar-days';

      // First day of month
      const firstDay = new Date(year, month, 1);
      let startDayIndex = firstDay.getDay() - 1;
      if (startDayIndex < 0) startDayIndex = 6; // Sunday becomes index 6

      // Days in current month
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      // Days in previous month
      const prevMonthDays = new Date(year, month, 0).getDate();

      // Selected date if matches month/year
      const selectedDate = parseInputDate(invDateOnlyInput.value);

      // Render previous month cells (padding)
      for (let i = startDayIndex - 1; i >= 0; i--) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'calendar-day-cell other-month';
        const cellDay = prevMonthDays - i;
        cell.textContent = cellDay;
        
        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetDate = new Date(year, month - 1, cellDay);
          invDateOnlyInput.value = formatDate(targetDate);
          updateRealTimePreview();
          dropdown.classList.remove('active');
        });
        
        daysGrid.appendChild(cell);
      }

      // Render current month cells
      const today = new Date();
      for (let i = 1; i <= daysInMonth; i++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'calendar-day-cell';
        cell.textContent = i;

        // Check if selected
        if (selectedDate && 
            selectedDate.getDate() === i && 
            selectedDate.getMonth() === month && 
            selectedDate.getFullYear() === year) {
          cell.classList.add('selected');
        }

        // Check if today
        if (today.getDate() === i && 
            today.getMonth() === month && 
            today.getFullYear() === year) {
          cell.classList.add('today');
        }

        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetDate = new Date(year, month, i);
          invDateOnlyInput.value = formatDate(targetDate);
          updateRealTimePreview();
          dropdown.classList.remove('active');
        });

        daysGrid.appendChild(cell);
      }

      // Render next month padding
      const totalCells = startDayIndex + daysInMonth;
      const remainingCells = 42 - totalCells; // Render full 6 rows (42 cells)
      for (let i = 1; i <= remainingCells; i++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'calendar-day-cell other-month';
        cell.textContent = i;

        cell.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetDate = new Date(year, month + 1, i);
          invDateOnlyInput.value = formatDate(targetDate);
          updateRealTimePreview();
          dropdown.classList.remove('active');
        });

        daysGrid.appendChild(cell);
      }

      dropdown.appendChild(daysGrid);
    }
  }

  // Initialize custom datepicker
  initCustomDatePicker();

  // Custom Select Dropdown logic
  function initCustomDropdown(selectId) {
    const select = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
    if (!select) return;

    // Check if we already initialized custom select for this element
    const containerId = select.id ? `${select.id}-custom-container` : null;
    if (containerId && document.getElementById(containerId)) return;
    
    // Fallback check: if there is a nextSibling with class 'custom-select-container'
    if (!containerId && select.nextSibling && select.nextSibling.classList && select.nextSibling.classList.contains('custom-select-container')) {
      return;
    }

    // Create wrapper container
    const container = document.createElement('div');
    container.className = 'custom-select-container';
    if (containerId) {
      container.id = containerId;
    }

    // Create trigger
    const trigger = document.createElement('div');
    trigger.className = 'custom-select-trigger';

    const triggerText = document.createElement('span');
    triggerText.className = 'custom-select-trigger-text';

    // Get active option text
    const activeOption = select.options[select.selectedIndex];
    triggerText.textContent = activeOption ? activeOption.textContent : '';

    const triggerArrow = document.createElement('span');
    triggerArrow.className = 'custom-select-trigger-arrow';
    triggerArrow.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;

    trigger.appendChild(triggerText);
    trigger.appendChild(triggerArrow);

    // Create dropdown menu
    const dropdown = document.createElement('div');
    dropdown.className = 'custom-select-dropdown';

    // Build options
    function rebuildOptions() {
      dropdown.innerHTML = '';
      Array.from(select.options).forEach(opt => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'custom-select-option';
        optionDiv.textContent = opt.textContent;
        optionDiv.dataset.value = opt.value;
        if (opt.selected) {
          optionDiv.classList.add('selected');
        }

        optionDiv.addEventListener('click', (e) => {
          e.stopPropagation();
          select.value = opt.value;
          select.dispatchEvent(new Event('change'));
          container.classList.remove('open');
        });

        dropdown.appendChild(optionDiv);
      });
    }

    rebuildOptions();

    // Append everything
    container.appendChild(trigger);
    container.appendChild(dropdown);

    // Insert custom container in the DOM right after the select, then hide the original select
    select.parentNode.insertBefore(container, select.nextSibling);
    select.style.display = 'none';

    // Toggle dropdown open state
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // Close other custom select dropdowns
      document.querySelectorAll('.custom-select-container').forEach(c => {
        if (c !== container) c.classList.remove('open');
      });
      
      container.classList.toggle('open');
    });

    // Handle outside clicks to close
    document.addEventListener('click', () => {
      container.classList.remove('open');
    });

    // Sync back when the underlying select value changes programmatically (e.g. on loadConfig)
    select.addEventListener('change', () => {
      const activeOpt = select.options[select.selectedIndex];
      triggerText.textContent = activeOpt ? activeOpt.textContent : '';
      
      // Rebuild classes on change to ensure "selected" class is updated
      Array.from(dropdown.children).forEach(child => {
        if (child.dataset.value === select.value) {
          child.classList.add('selected');
        } else {
          child.classList.remove('selected');
        }
      });
    });

    // Listen for changes that might reset options dynamically
    const observer = new MutationObserver(() => {
      const activeOpt = select.options[select.selectedIndex];
      triggerText.textContent = activeOpt ? activeOpt.textContent : '';
      rebuildOptions();
    });
    observer.observe(select, { childList: true });
  }

  // Initialize custom dropdowns
  ['inv-theme-font', 'inv-theme-color', 'inv-bg-effect', 'inv-wax-seal', 'trivia-enabled-toggle'].forEach(id => {
    initCustomDropdown(id);
  });

  // --- Módulo Invitados Subtab ---
  const invitadosGuestSearch = document.getElementById('invitados-guest-search');
  const btnAddGuestInvitados = document.getElementById('btn-add-guest-invitados');
  const fileDropZoneInvitados = document.getElementById('file-drop-zone-invitados');
  const fileInputInvitados = document.getElementById('excel-file-input-invitados');
  const btnClearDbInvitados = document.getElementById('btn-clear-db-invitados');
  const btnExportExcelInvitados = document.getElementById('btn-export-excel-invitados');

  if (invitadosGuestSearch) {
    invitadosGuestSearch.addEventListener('input', () => {
      renderInvitadosTable();
    });
  }

  if (btnExportExcelInvitados) {
    btnExportExcelInvitados.addEventListener('click', () => {
      window.location.href = `/api/admin/export-guests?event=${encodeURIComponent(eventId)}`;
    });
  }

  if (btnAddGuestInvitados) {
    btnAddGuestInvitados.addEventListener('click', () => {
      modalTitle.textContent = 'Agregar Invitado';
      guestIndexInput.value = '';
      modalFirstName.value = '';
      modalLastName.value = '';
      modalTable.value = '';
      hideCustomDropdown();
      guestModal.classList.add('active');
    });
  }

  if (fileDropZoneInvitados && fileInputInvitados) {
    fileDropZoneInvitados.addEventListener('click', (e) => {
      if (e.target !== fileInputInvitados) {
        fileInputInvitados.click();
      }
    });

    fileInputInvitados.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    fileInputInvitados.addEventListener('change', () => {
      if (fileInputInvitados.files.length > 0) {
        handleFileUploadInvitados(fileInputInvitados.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      fileDropZoneInvitados.addEventListener(eventName, (e) => {
        e.preventDefault();
        fileDropZoneInvitados.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      fileDropZoneInvitados.addEventListener(eventName, () => {
        fileDropZoneInvitados.classList.remove('dragover');
      });
    });

    fileDropZoneInvitados.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files.length > 0) {
        handleFileUploadInvitados(e.dataTransfer.files[0]);
      }
    });
  }

  function handleFileUploadInvitados(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      showToast('error', '¡Atención!', 'Tipo de archivo no permitido. Suba un .xlsx, .xls o .csv.', 4000);
      return;
    }

    showToast('loading', '', 'Subiendo y procesando lista de invitados...');
    fileDropZoneInvitados.style.opacity = '0.5';

    const formData = new FormData();
    formData.append('file', file);

    fetch(`/api/upload?event=${encodeURIComponent(eventId)}`, {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        fileDropZoneInvitados.style.opacity = '1';
        fileInputInvitados.value = '';
        
        if (data.success) {
          showToast('success', '¡Éxito!', `¡Lista cargada con éxito! Se procesaron ${data.count} invitados.`, 3000);
          loadStats();
          loadGuests();
        } else {
          showToast('error', 'Error', data.error || 'Error al procesar el archivo.', 4000);
        }
      })
      .catch(err => {
        fileDropZoneInvitados.style.opacity = '1';
        fileInputInvitados.value = '';
        console.error('Error uploading file:', err);
        showToast('error', 'Error', 'Error al subir el archivo al servidor.', 4000);
      });
  }

  if (btnClearDbInvitados) {
    btnClearDbInvitados.addEventListener('click', () => {
      showConfirm(
        'Limpiar Base de Datos',
        '¿Está seguro de que desea limpiar toda la base de datos de invitados? Esta acción no se puede deshacer.',
        () => {
          fetch(`/api/clear?event=${encodeURIComponent(eventId)}`, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                showToast('success', '¡Éxito!', 'Base de datos de invitados limpiada correctamente.', 3000);
                loadStats();
                loadGuests();
              } else {
                showToast('error', 'Error', 'Error al limpiar la base de datos.', 4000);
              }
            })
            .catch(err => {
              console.error('Error clearing database:', err);
              showToast('error', 'Error', 'Error de conexión con el servidor.', 4000);
            });
        }
      );
    });
  }

  function updateInvitadosFilterCounts() {
    let allCount = allGuests.length;
    let confirmedCount = 0;
    let pendingCount = 0;
    let declinedCount = 0;

    allGuests.forEach(g => {
      const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
      const rsvp = allRsvps.find(r => r.name.trim().toLowerCase() === fullName);
      if (!rsvp) {
        pendingCount++;
      } else if (rsvp.attending) {
        confirmedCount++;
      } else {
        declinedCount++;
      }
    });

    const elAll = document.getElementById('count-all');
    const elConfirmed = document.getElementById('count-confirmed');
    const elPending = document.getElementById('count-pending');
    const elDeclined = document.getElementById('count-declined');

    if (elAll) elAll.textContent = allCount;
    if (elConfirmed) elConfirmed.textContent = confirmedCount;
    if (elPending) elPending.textContent = pendingCount;
    if (elDeclined) elDeclined.textContent = declinedCount;
  }

  function renderInvitadosTable() {
    const tableBody = document.getElementById('invitados-table-body');
    if (!tableBody) return;

    // Update filter count labels
    updateInvitadosFilterCounts();

    const searchFilter = invitadosGuestSearch ? invitadosGuestSearch.value.trim().toLowerCase() : '';
    
    const filteredGuests = allGuests.map((g, index) => ({ ...g, originalIndex: index }))
      .filter(g => {
        // 1. Filter by RSVP Status
        const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
        const rsvp = allRsvps.find(r => r.name.trim().toLowerCase() === fullName);
        
        let status = 'pending';
        if (rsvp) {
          status = rsvp.attending ? 'confirmed' : 'declined';
        }

        if (activeInvitadosStatusFilter !== 'all' && status !== activeInvitadosStatusFilter) {
          return false;
        }

        // 2. Filter by search input
        const table = String(g.table).toLowerCase();
        return fullName.includes(searchFilter) || table.includes(searchFilter);
      });

    if (filteredGuests.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">
            ${allGuests.length === 0 ? 'No hay invitados registrados en la base de datos.' : 'No se encontraron coincidencias.'}
          </td>
        </tr>
      `;
      return;
    }

    const currentOrigin = window.location.origin;
    tableBody.innerHTML = filteredGuests.map(g => {
      const personalUrl = `${currentOrigin}/invitacion.html?event=${encodeURIComponent(eventId)}&n=${encodeURIComponent(g.firstName + ' ' + g.lastName)}`;
      
      const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
      const rsvp = allRsvps.find(r => r.name.trim().toLowerCase() === fullName);
      
      let rowClass = 'row-pending';
      if (rsvp) {
        rowClass = rsvp.attending ? 'row-confirmed' : 'row-declined';
      }

      let rsvpStatusHtml = `
        <select class="form-control-admin select-rsvp-status" 
                style="padding: 6px 12px; border-radius: 12px; font-size: 0.75rem; border: 1px solid var(--card-border); background: rgba(0,0,0,0.3); color: white; cursor: pointer; font-family: 'Montserrat', sans-serif; text-align: center; text-align-last: center;"
                data-guest-name="${g.firstName} ${g.lastName}"
                data-rsvp-id="${rsvp ? rsvp.id : ''}">
          <option value="pending" style="background: #111; color: var(--text-muted);" ${!rsvp ? 'selected' : ''}>⏳ Pendiente</option>
          <option value="confirmed" style="background: #111; color: #2ec4b6;" ${rsvp && rsvp.attending ? 'selected' : ''}>✅ Asistirá</option>
          <option value="declined" style="background: #111; color: var(--error);" ${rsvp && !rsvp.attending ? 'selected' : ''}>❌ No Asistirá</option>
        </select>
      `;

      return `
        <tr class="${rowClass}">
          <td style="color: var(--text-main); font-weight: 500;">${g.firstName}</td>
          <td style="color: var(--text-main); font-weight: 500;">${g.lastName}</td>
          <td style="color: var(--gold-primary); font-weight: 600;">${formatTableDisplay(g.table)}</td>
          <td style="text-align: center; vertical-align: middle;">${rsvpStatusHtml}</td>
          <td>
            <div style="display: flex; gap: 8px; align-items: center; width: 100%; max-width: 180px;">
              <input type="text" readonly value="${personalUrl}" class="form-control-admin" style="padding: 6px 12px; font-size: 0.7rem; border-radius: 12px; width: 100%; min-width: 0; border: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2); text-overflow: ellipsis; white-space: nowrap; overflow: hidden; pointer-events: none;" id="guest-url-${g.originalIndex}">
            </div>
          </td>
          <td style="text-align: center; vertical-align: middle;">
            <div style="display: flex; justify-content: center; gap: 6px; flex-wrap: nowrap;">
              <button class="btn-action edit" onclick="openEditGuestModal(${g.originalIndex})">Editar</button>
              <button class="btn-action edit" style="border-color: var(--gold-primary); color: var(--gold-primary);" onclick="copyGuestUrl(${g.originalIndex}, this)">Copiar</button>
              <button class="btn-action delete" onclick="confirmDeleteGuest(${g.originalIndex})">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Handle click on collapsible table headers
  document.addEventListener('click', (e) => {
    const header = e.target.closest('.table-collapsible-header');
    if (!header) return;

    const details = header.nextElementSibling;
    const chevron = header.querySelector('.table-chevron');
    if (!details || !chevron) return;

    const isExpanded = details.style.display !== 'none';
    if (isExpanded) {
      details.style.display = 'none';
      chevron.style.transform = 'rotate(0deg)';
      header.classList.remove('expanded');
    } else {
      details.style.display = 'block';
      chevron.style.transform = 'rotate(90deg)';
      header.classList.add('expanded');
    }
  });

  // Handle click on guest status filter tabs
  document.addEventListener('click', (e) => {
    const tabBtn = e.target.closest('[data-status-filter]');
    if (!tabBtn) return;

    // Remove active class from all filter tabs
    document.querySelectorAll('[data-status-filter]').forEach(btn => {
      btn.classList.remove('active');
    });

    // Add active class to clicked tab
    tabBtn.classList.add('active');

    // Update active filter value and re-render
    activeInvitadosStatusFilter = tabBtn.getAttribute('data-status-filter');
    renderInvitadosTable();
  });

  // Change event listener for interactive RSVP status update
  document.addEventListener('change', (e) => {
    if (e.target && e.target.classList.contains('select-rsvp-status')) {
      const select = e.target;
      const guestName = select.getAttribute('data-guest-name');
      const rsvpId = select.getAttribute('data-rsvp-id');
      const newValue = select.value;

      updateGuestRsvpStatus(guestName, rsvpId, newValue);
    }
  });

  function updateGuestRsvpStatus(guestName, rsvpId, statusValue) {
    if (statusValue === 'pending') {
      if (!rsvpId) {
        loadRsvps();
        return;
      }
      fetch(`/api/rsvps/${rsvpId}?event=${encodeURIComponent(eventId)}`, {
        method: 'DELETE'
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          loadRsvps();
          loadStats();
          showToast('Estado de confirmación actualizado', 'success');
        } else {
          showToast(data.error || 'Error al actualizar el estado', 'error');
          loadRsvps();
        }
      })
      .catch(err => {
        console.error('Error deleting RSVP:', err);
        showToast('Error al conectar con el servidor', 'error');
        loadRsvps();
      });
    } else {
      const existingRsvp = allRsvps.find(r => r.name.trim().toLowerCase() === guestName.trim().toLowerCase());
      const payload = {
        name: guestName,
        attending: statusValue === 'confirmed',
        companionsCount: existingRsvp ? existingRsvp.companionsCount : 0,
        companionsNames: existingRsvp ? existingRsvp.companionsNames : '',
        dietaryRestrictions: existingRsvp ? existingRsvp.dietaryRestrictions : 'Ninguno',
        suggestedSong: existingRsvp ? existingRsvp.suggestedSong : ''
      };

      fetch(`/api/public/rsvp?event=${encodeURIComponent(eventId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          loadRsvps();
          loadStats();
          showToast('Estado de confirmación actualizado', 'success');
        } else {
          showToast(data.error || 'Error al actualizar el estado', 'error');
          loadRsvps();
        }
      })
      .catch(err => {
        console.error('Error saving RSVP:', err);
        showToast('Error al conectar con el servidor', 'error');
        loadRsvps();
      });
    }
  }

  // --- TRIVIA MANAGEMENT FUNCTIONS ---

  function getDefaultQuestions() {
    return [
      {
        question: "¿Dónde se conocieron los novios/agasajados?",
        options: ["En el colegio/universidad", "En una fiesta/boliche", "Por redes sociales", "En el trabajo"],
        correctIndex: 0
      },
      {
        question: "¿Cuál es el plato de comida preferido del agasajado/a?",
        options: ["Asado", "Pastas", "Sushi", "Hamburguesa"],
        correctIndex: 1
      },
      {
        question: "¿Cuál es su destino soñado para viajar?",
        options: ["Caribe/Playa", "Europa/Histórico", "Asia/Aventura", "Bariloche/Nieve"],
        correctIndex: 0
      }
    ];
  }

  function loadTriviaConfig() {
    fetch(`/api/config?event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(data => {
        const toggle = document.getElementById('trivia-enabled-toggle');
        if (toggle) {
          toggle.value = (data.serviceTrivia === true || data.serviceTrivia === 'true') ? 'true' : 'false';
          toggle.dispatchEvent(new Event('change'));
        }

        try {
          triviaQuestionsData = JSON.parse(data.triviaQuestions || '[]');
        } catch (e) {
          triviaQuestionsData = [];
        }

        if (!Array.isArray(triviaQuestionsData) || triviaQuestionsData.length === 0) {
          triviaQuestionsData = getDefaultQuestions();
        }

        renderTriviaQuestionsEditor();
      })
      .catch(err => {
        console.error('Error loading trivia config:', err);
        showToast('Error al cargar la configuración de la trivia', 'error');
      });
  }
  window.loadTriviaConfig = loadTriviaConfig;

  function renderTriviaQuestionsEditor() {
    const listContainer = document.getElementById('trivia-questions-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    triviaQuestionsData.forEach((q, qIndex) => {
      const qDiv = document.createElement('div');
      qDiv.className = 'question-editor-card';
      qDiv.style.background = 'rgba(255,255,255,0.03)';
      qDiv.style.padding = '15px';
      qDiv.style.borderRadius = '15px';
      qDiv.style.border = '1px solid var(--card-border)';
      qDiv.style.position = 'relative';
      qDiv.style.marginBottom = '15px';

      qDiv.innerHTML = `
        <button type="button" class="btn-delete-q" onclick="deleteTriviaQuestion(${qIndex})" style="position: absolute; right: 10px; top: 10px; background: transparent; border: none; color: #ff4d4d; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0;">&times;</button>
        <div style="margin-bottom: 10px;">
          <label style="display: block; font-size: 0.7rem; text-transform: uppercase; color: var(--gold-light); margin-bottom: 4px; font-weight:600;">Pregunta ${qIndex + 1}</label>
          <input type="text" class="form-control-admin q-text-input" value="${q.question.replace(/"/g, '&quot;')}" style="width: 100%;" onchange="updateTriviaQuestionText(${qIndex}, this.value)">
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
          ${q.options.map((opt, oIndex) => `
            <div>
              <label style="display: block; font-size: 0.65rem; color: var(--text-muted); margin-bottom: 2px;">Opción ${String.fromCharCode(65 + oIndex)}</label>
              <input type="text" class="form-control-admin q-opt-input" value="${opt.replace(/"/g, '&quot;')}" style="width:100%; font-size:0.75rem; padding:8px 10px;" onchange="updateTriviaOptionText(${qIndex}, ${oIndex}, this.value)">
            </div>
          `).join('')}
        </div>
        <div>
          <label style="display: block; font-size: 0.7rem; text-transform: uppercase; color: var(--gold-light); margin-bottom: 4px; font-weight:600;">Respuesta Correcta</label>
          <select class="form-control-admin trivia-correct-select" style="width: 100%;" onchange="updateTriviaCorrectIndex(${qIndex}, parseInt(this.value))">
            ${q.options.map((opt, oIndex) => `
              <option value="${oIndex}" ${oIndex === q.correctIndex ? 'selected' : ''}>Opción ${String.fromCharCode(65 + oIndex)}: ${opt.substring(0, 30)}</option>
            `).join('')}
          </select>
        </div>
      `;

      listContainer.appendChild(qDiv);
    });

    // Initialize custom dropdowns for each question's select
    listContainer.querySelectorAll('.trivia-correct-select').forEach(select => {
      initCustomDropdown(select);
    });
  }

  window.deleteTriviaQuestion = function(index) {
    triviaQuestionsData.splice(index, 1);
    renderTriviaQuestionsEditor();
  };

  window.updateTriviaQuestionText = function(qIndex, val) {
    if (triviaQuestionsData[qIndex]) {
      triviaQuestionsData[qIndex].question = val;
    }
  };

  window.updateTriviaOptionText = function(qIndex, oIndex, val) {
    if (triviaQuestionsData[qIndex] && triviaQuestionsData[qIndex].options) {
      triviaQuestionsData[qIndex].options[oIndex] = val;
      renderTriviaQuestionsEditor(); // Refresh dropdown labels
    }
  };

  window.updateTriviaCorrectIndex = function(qIndex, val) {
    if (triviaQuestionsData[qIndex]) {
      triviaQuestionsData[qIndex].correctIndex = val;
    }
  };

  // Add Question Button
  const btnAddTriviaQuestion = document.getElementById('btn-add-trivia-question');
  if (btnAddTriviaQuestion) {
    btnAddTriviaQuestion.addEventListener('click', () => {
      triviaQuestionsData.push({
        question: "Nueva Pregunta",
        options: ["Opción A", "Opción B", "Opción C", "Opción D"],
        correctIndex: 0
      });
      renderTriviaQuestionsEditor();
      
      const listContainer = document.getElementById('trivia-questions-list');
      if (listContainer) {
        listContainer.scrollTop = listContainer.scrollHeight;
      }
    });
  }

  // Save Questions Button
  const btnSaveTriviaQuestions = document.getElementById('btn-save-trivia-questions');
  if (btnSaveTriviaQuestions) {
    btnSaveTriviaQuestions.addEventListener('click', async () => {
      const toggle = document.getElementById('trivia-enabled-toggle');
      const isEnabled = toggle ? toggle.value === 'true' : false;

      const titleEl = document.getElementById('event-title-input') || document.getElementById('event-title-photos-input') || document.getElementById('inv-title-input');
      const currentTitle = titleEl ? titleEl.value.trim() : 'Mi Gran Fiesta';

      const cleanedQuestions = triviaQuestionsData.map(q => ({
        question: q.question.trim(),
        options: q.options.map(opt => opt.trim()),
        correctIndex: q.correctIndex
      })).filter(q => q.question !== '');

      try {
        const response = await fetch(`/api/config?event=${encodeURIComponent(eventId)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            eventTitle: currentTitle,
            serviceTrivia: isEnabled,
            triviaQuestions: JSON.stringify(cleanedQuestions)
          })
        });

        const data = await response.json();
        if (data.success) {
          showToast('Configuración de Trivia guardada correctamente', 'success');
          // Reload state in memory coordinator!
          await fetch(`/api/trivia/control?event=${encodeURIComponent(eventId)}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'init' })
          });
        } else {
          showToast(data.error || 'Error al guardar configuración', 'error');
        }
      } catch (err) {
        console.error('Error saving trivia config:', err);
        showToast('Error al conectar con el servidor', 'error');
      }
    });
  }

  // Console control actions
  async function triggerTriviaAction(actionName) {
    try {
      const res = await fetch(`/api/trivia/control?event=${encodeURIComponent(eventId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: actionName })
      });
      const data = await res.json();
      if (!data.success) {
        showToast(data.error || `Error al realizar acción: ${actionName}`, 'error');
      } else {
        showToast(`Acción '${actionName}' ejecutada con éxito`, 'success');
      }
    } catch (err) {
      console.error(`Error sending trivia action ${actionName}:`, err);
      showToast('Error de comunicación con el servidor', 'error');
    }
  }

  function startTriviaPolling() {
    if (triviaEventSource) triviaEventSource.close();
    triviaEventSource = new EventSource(`/api/trivia/stream?event=${encodeURIComponent(eventId)}&role=admin`);
    
    triviaEventSource.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'INITIAL_STATE' || msg.type === 'STATE_UPDATE') {
          renderAdminTriviaState(msg.data);
        }
      } catch (err) {
        console.error('Error parsing SSE msg:', err);
      }
    };

    triviaEventSource.onerror = (e) => {
      console.warn('SSE Error/Disconnect, re-establishing...');
    };
  }
  window.startTriviaPolling = startTriviaPolling;

  function stopTriviaPolling() {
    if (triviaEventSource) {
      triviaEventSource.close();
      triviaEventSource = null;
    }
  }
  window.stopTriviaPolling = stopTriviaPolling;

  function renderAdminTriviaState(state) {
    const badge = document.getElementById('admin-trivia-status-badge');
    if (badge) {
      badge.textContent = state.status;
      if (state.status === 'LOBBY') {
        badge.style.background = '#4da6ff';
        badge.style.color = '#fff';
      } else if (state.status === 'QUESTION_ACTIVE') {
        badge.style.background = '#2ec7c9';
        badge.style.color = '#000';
      } else if (state.status === 'REVEAL_ANSWER') {
        badge.style.background = '#2ecc71';
        badge.style.color = '#fff';
      } else if (state.status === 'LEADERBOARD') {
        badge.style.background = '#f1c40f';
        badge.style.color = '#000';
      } else if (state.status === 'PODIUM') {
        badge.style.background = '#9b59b6';
        badge.style.color = '#fff';
      } else {
        badge.style.background = 'var(--gold-primary)';
        badge.style.color = '#000';
      }
    }

    const qIndexEl = document.getElementById('admin-trivia-question-index');
    if (qIndexEl) {
      if (state.status === 'LOBBY') {
        qIndexEl.textContent = 'Esperando jugadores (Lobby)';
      } else if (state.status === 'PODIUM') {
        qIndexEl.textContent = 'Juego Terminado (Podio)';
      } else {
        const total = state.totalQuestions || 0;
        const current = (state.currentQuestionIndex !== undefined) ? (state.currentQuestionIndex + 1) : '-';
        qIndexEl.textContent = `Pregunta ${current} de ${total}`;
      }
    }

    const tbody = document.getElementById('admin-trivia-players-tbody');
    const countEl = document.getElementById('admin-trivia-players-count');
    if (tbody) {
      tbody.innerHTML = '';
      const players = state.players || [];
      if (countEl) countEl.textContent = players.length;

      if (players.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align: center; padding: 15px; color: var(--text-muted);">Ningún jugador conectado.</td>
          </tr>
        `;
      } else {
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
        sortedPlayers.forEach((p, idx) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td style="font-weight: bold; color: var(--gold-light);">${idx + 1}</td>
            <td style="color: white; font-weight: 500;">${p.nickname}</td>
            <td style="text-align: right; color: var(--gold-primary); font-weight: 600;">${p.score} pts</td>
          `;
          tbody.appendChild(row);
        });
      }
    }
  }

  // Bind console controls
  const btnTriviaInit = document.getElementById('btn-admin-trivia-init');
  const btnTriviaStart = document.getElementById('btn-admin-trivia-start');
  const btnTriviaReveal = document.getElementById('btn-admin-trivia-reveal');
  const btnTriviaLeaderboard = document.getElementById('btn-admin-trivia-leaderboard');
  const btnTriviaNext = document.getElementById('btn-admin-trivia-next');

  if (btnTriviaInit) btnTriviaInit.addEventListener('click', () => triggerTriviaAction('init'));
  if (btnTriviaStart) btnTriviaStart.addEventListener('click', () => triggerTriviaAction('start'));
  if (btnTriviaReveal) btnTriviaReveal.addEventListener('click', () => triggerTriviaAction('reveal'));
  if (btnTriviaLeaderboard) btnTriviaLeaderboard.addEventListener('click', () => triggerTriviaAction('leaderboard'));
  if (btnTriviaNext) btnTriviaNext.addEventListener('click', () => triggerTriviaAction('next'));

  const btnTriviaProjector = document.getElementById('btn-admin-trivia-projector');
  if (btnTriviaProjector) {
    btnTriviaProjector.addEventListener('click', () => {
      window.open(`/trivia-screen.html?event=${encodeURIComponent(eventId)}`, '_blank');
    });
  }

  window.copyGuestUrl = (index, btnElement) => {
    const inputElement = document.getElementById(`guest-url-${index}`);
    if (!inputElement) return;

    const urlText = inputElement.value;
    navigator.clipboard.writeText(urlText)
      .then(() => {
        const originalText = btnElement.textContent;
        btnElement.textContent = '¡Copiado!';
        btnElement.style.background = 'var(--gold-gradient)';
        btnElement.style.color = '#0b0b0c';
        btnElement.style.borderColor = 'transparent';
        showToast('Enlace de invitación copiado al portapapeles', 'success');
        
        setTimeout(() => {
          btnElement.textContent = originalText;
          btnElement.style.background = 'transparent';
          btnElement.style.color = 'var(--gold-primary)';
          btnElement.style.borderColor = 'var(--gold-primary)';
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        showToast('Error al copiar el enlace', 'error');
      });
  };

  // --- Administrative Photo Carousel (Live 3D Preview) ---
  const defaultPhotos = [
    "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=600",
    "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600",
    "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=600",
    "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?q=80&w=600",
    "https://images.unsplash.com/photo-1504196606672-aef5c9cefc92?q=80&w=600"
  ];

  window.syncPhotoPreviewImages = function() {
    for (let i = 1; i <= 5; i++) {
      const input = document.getElementById(`inv-photo-${i}`);
      const thumbImg = document.getElementById(`prev-thumb-${i}`);
      const thumbIcon = document.getElementById(`prev-icon-${i}`);
      const previewImg = document.getElementById(`preview-carousel-img-${i - 1}`);
      
      const val = input ? input.value.trim() : '';
      const displayUrl = val || defaultPhotos[i - 1];
      
      // Update Thumbnail
      if (thumbImg && thumbIcon) {
        if (val) {
          thumbImg.src = val;
          thumbImg.style.display = 'block';
          thumbIcon.style.display = 'none';
        } else {
          thumbImg.style.display = 'none';
          thumbIcon.style.display = 'block';
        }
      }
      
      // Update Preview Image
      if (previewImg) {
        previewImg.src = displayUrl;
      }
    }
  };

  let previewActiveCarouselIndex = 0;
  const previewTotalCarouselItems = 5;
  let previewCarouselItems = [];
  let previewCarouselDots = [];
  
  function initPreviewCarousel() {
    previewCarouselItems = Array.from(document.querySelectorAll('#preview-carousel-track .carousel-item'));
    previewCarouselDots = Array.from(document.querySelectorAll('#preview-carousel-dots-container .carousel-dot'));
    
    updatePreviewCarousel();
    
    const prevBtn = document.getElementById('preview-carousel-prev-btn');
    const nextBtn = document.getElementById('preview-carousel-next-btn');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        previewActiveCarouselIndex = (previewActiveCarouselIndex - 1 + previewTotalCarouselItems) % previewTotalCarouselItems;
        updatePreviewCarousel();
      });
    }
    
    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        previewActiveCarouselIndex = (previewActiveCarouselIndex + 1) % previewTotalCarouselItems;
        updatePreviewCarousel();
      });
    }
    
    previewCarouselDots.forEach((dot, idx) => {
      dot.addEventListener('click', (e) => {
        e.preventDefault();
        previewActiveCarouselIndex = idx;
        updatePreviewCarousel();
      });
    });
    
    previewCarouselItems.forEach((item, idx) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        previewActiveCarouselIndex = idx;
        updatePreviewCarousel();
      });
    });

    // Swipe / Drag interactive control for preview
    const previewContainer = document.querySelector('.carousel-preview-card .carousel-container');
    if (previewContainer) {
      let startX = 0;
      let isDragging = false;
      const dragThreshold = 40;
      
      function handleStart(e) {
        isDragging = true;
        startX = e.pageX || (e.touches && e.touches[0] ? e.touches[0].pageX : 0);
      }
      
      function handleMove(e) {
        if (!isDragging) return;
        const currentX = e.pageX || (e.touches && e.touches[0] ? e.touches[0].pageX : 0);
        if (!currentX) return;
        
        const diffX = currentX - startX;
        
        if (Math.abs(diffX) > dragThreshold) {
          if (diffX > 0) {
            previewActiveCarouselIndex = (previewActiveCarouselIndex - 1 + previewTotalCarouselItems) % previewTotalCarouselItems;
          } else {
            previewActiveCarouselIndex = (previewActiveCarouselIndex + 1) % previewTotalCarouselItems;
          }
          updatePreviewCarousel();
          startX = currentX;
          isDragging = false;
        }
      }
      
      function handleEnd() {
        isDragging = false;
      }
      
      previewContainer.addEventListener('mousedown', handleStart);
      previewContainer.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      
      previewContainer.addEventListener('touchstart', handleStart, { passive: true });
      previewContainer.addEventListener('touchmove', handleMove, { passive: true });
      previewContainer.addEventListener('touchend', handleEnd, { passive: true });
    }
  }

  function updatePreviewCarousel() {
    if (!previewCarouselItems.length) return;
    previewCarouselItems.forEach((item, index) => {
      let diff = index - previewActiveCarouselIndex;
      if (diff < -2) diff += previewTotalCarouselItems;
      if (diff > 2) diff -= previewTotalCarouselItems;
      
      const absDiff = Math.abs(diff);
      
      const xVal = diff * 70; 
      const zVal = -absDiff * 80; 
      const rYVal = diff * -30;
      const scaleVal = 1 - absDiff * 0.18;
      const opacityVal = absDiff > 2 ? 0 : (1 - absDiff * 0.4);
      
      if (window.gsap) {
        gsap.to(item, {
          x: xVal,
          z: zVal,
          rotationY: rYVal,
          scale: scaleVal,
          opacity: opacityVal,
          zIndex: 10 - absDiff,
          duration: 0.6,
          ease: 'power2.out'
        });
      } else {
        item.style.transform = `translateX(${xVal}px) translateZ(${zVal}px) rotateY(${rYVal}deg) scale(${scaleVal})`;
        item.style.opacity = opacityVal;
        item.style.zIndex = 10 - absDiff;
      }
    });
    
    previewCarouselDots.forEach((dot, index) => {
      if (index === previewActiveCarouselIndex) dot.classList.add('active');
      else dot.classList.remove('active');
    });
  }

  // Initialize carousel on DOM load
  initPreviewCarousel();

  // Watch for title updates specifically to reflect in the preview card
  if (invTitleInput) {
    invTitleInput.addEventListener('input', () => {
      const prevTitle = document.getElementById('prev-event-title');
      if (prevTitle) {
        prevTitle.textContent = invTitleInput.value.trim() || 'JANO\'S EVENTOS';
      }
    });
  }

  // --- Photo Upload Modal and Compression Workflow ---
  const photoUploadModal = document.getElementById('photo-upload-modal');
  const uploadPhotoTitle = document.getElementById('upload-photo-title');
  const btnClosePhotoUpload = document.getElementById('btn-close-photo-upload');
  const photoDragDropZone = document.getElementById('photo-drag-drop-zone');
  const photoFileInput = document.getElementById('photo-file-input');
  
  const photoUploadLoading = document.getElementById('photo-upload-loading');
  const photoProgressBar = document.getElementById('photo-upload-progress-bar');
  const photoStepCompress = document.getElementById('photo-step-compress');
  const photoStepUpload = document.getElementById('photo-step-upload');
  const photoStepFinalize = document.getElementById('photo-step-finalize');

  let currentUploadPhotoId = null;

  // Open modal when any "Subir" button is clicked
  document.querySelectorAll('.btn-trigger-upload').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      currentUploadPhotoId = btn.getAttribute('data-photo-id');
      const photoName = currentUploadPhotoId === '1' ? 'Foto 1 (Principal)' : `Foto ${currentUploadPhotoId}`;
      uploadPhotoTitle.textContent = photoName;
      
      // Reset modal state
      photoFileInput.value = '';
      if (photoUploadLoading) photoUploadLoading.style.display = 'none';
      if (photoProgressBar) photoProgressBar.style.width = '0%';
      [photoStepCompress, photoStepUpload, photoStepFinalize].forEach(step => {
        if (step) step.className = 'audio-up-step';
      });
      
      // Open modal
      if (photoUploadModal) photoUploadModal.classList.add('active');
    });
  });

  // Close modal
  function closePhotoUploadModal() {
    if (photoUploadModal) photoUploadModal.classList.remove('active');
    currentUploadPhotoId = null;
  }
  
  if (btnClosePhotoUpload) {
    btnClosePhotoUpload.addEventListener('click', closePhotoUploadModal);
  }

  // Click on drop zone triggers file input
  if (photoDragDropZone && photoFileInput) {
    photoDragDropZone.addEventListener('click', () => {
      photoFileInput.click();
    });

    // Drag & Drop events
    ['dragenter', 'dragover'].forEach(eventName => {
      photoDragDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDragDropZone.style.borderColor = 'var(--gold-light)';
        photoDragDropZone.style.background = 'rgba(212,175,55,0.05)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      photoDragDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        photoDragDropZone.style.borderColor = 'rgba(212,175,55,0.4)';
        photoDragDropZone.style.background = 'rgba(0,0,0,0.2)';
      }, false);
    });

    photoDragDropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        handlePhotoUpload(files[0]);
      }
    });

    photoFileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handlePhotoUpload(files[0]);
      }
    });
  }

  // Client-side image compression
  function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize proportionally
          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('No se pudo comprimir la imagen.'));
            }
          }, 'image/jpeg', quality);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  }

  // Handle Photo Upload Workflow
  async function handlePhotoUpload(file) {
    if (!file.type.startsWith('image/')) {
      showToast('error', 'Error', 'El archivo seleccionado no es una imagen.');
      return;
    }

    // Show loading section
    if (photoUploadLoading) photoUploadLoading.style.display = 'block';
    if (photoProgressBar) photoProgressBar.style.width = '0%';
    
    // Reset steps status
    [photoStepCompress, photoStepUpload, photoStepFinalize].forEach(step => {
      if (step) step.className = 'audio-up-step';
    });

    try {
      // Step 1: Compress
      if (photoStepCompress) photoStepCompress.classList.add('active');
      if (photoProgressBar) photoProgressBar.style.width = '10%';
      
      console.log(`[Image Compressor] Original image size: ${(file.size / 1024).toFixed(2)} KB`);
      
      // Compress with 1200px max width/height and 80% quality
      const compressedBlob = await compressImage(file, 1200, 1200, 0.8);
      console.log(`[Image Compressor] Optimized image size: ${(compressedBlob.size / 1024).toFixed(2)} KB`);
      
      if (photoStepCompress) {
        photoStepCompress.classList.remove('active');
        photoStepCompress.classList.add('completed');
      }
      if (photoProgressBar) photoProgressBar.style.width = '30%';

      // Step 2: Upload
      if (photoStepUpload) photoStepUpload.classList.add('active');
      
      const formData = new FormData();
      formData.append('image', compressedBlob, file.name || 'photo.jpg');

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/admin/upload-image?event=${encodeURIComponent(eventId)}`);

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const uploadPercent = (e.loaded / e.total) * 100;
          // Scale from 30% to 90%
          const progressPercent = 30 + (uploadPercent * 0.6);
          if (photoProgressBar) photoProgressBar.style.width = `${progressPercent}%`;
        }
      });

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.success && res.url) {
                resolve(res.url);
              } else {
                reject(new Error(res.error || 'Error al subir la imagen.'));
              }
            } catch (err) {
              reject(new Error('Respuesta inválida del servidor.'));
            }
          } else {
            reject(new Error(`Error del servidor: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('Error de red.'));
      });

      xhr.send(formData);
      const imageUrl = await uploadPromise;

      if (photoStepUpload) {
        photoStepUpload.classList.remove('active');
        photoStepUpload.classList.add('completed');
      }
      if (photoProgressBar) photoProgressBar.style.width = '90%';

      // Step 3: Finalize
      if (photoStepFinalize) photoStepFinalize.classList.add('active');
      
      // Set value in the corresponding input
      const targetInput = document.getElementById(`inv-photo-${currentUploadPhotoId}`);
      if (targetInput) {
        targetInput.value = imageUrl;
        // Trigger input event to update thumbnail and live preview
        targetInput.dispatchEvent(new Event('input'));
      }

      if (photoStepFinalize) {
        photoStepFinalize.classList.remove('active');
        photoStepFinalize.classList.add('completed');
      }
      if (photoProgressBar) photoProgressBar.style.width = '100%';

      showToast('success', '¡Éxito!', 'Imagen subida y optimizada correctamente.');
      
      // Close modal automatically after 1.5s
      setTimeout(() => {
        closePhotoUploadModal();
      }, 1500);

    } catch (err) {
      console.error('[Photo Upload] Error in workflow:', err);
      showToast('error', 'Error', err.message || 'No se pudo subir la imagen.');
      
      // Mark active steps as error
      if (photoStepCompress && photoStepCompress.classList.contains('active')) {
        photoStepCompress.classList.remove('active');
        photoStepCompress.classList.add('error');
      } else if (photoStepUpload && photoStepUpload.classList.contains('active')) {
        photoStepUpload.classList.remove('active');
        photoStepUpload.classList.add('error');
      } else if (photoStepFinalize) {
        photoStepFinalize.classList.add('error');
      }
    }
  }
});

