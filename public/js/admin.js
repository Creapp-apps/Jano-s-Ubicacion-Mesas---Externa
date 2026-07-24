document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('event') || 'default';
  let isFormDirty = false;
  let initialFormState = null;

  function captureFormState() {
    const form = document.getElementById('invitation-config-form');
    if (!form) return '';
    const formData = {};
    const elements = form.querySelectorAll('input, select, textarea');
    elements.forEach(el => {
      if (el.id) {
        if (el.type === 'checkbox' || el.type === 'radio') {
          formData[el.id] = el.checked;
        } else {
          formData[el.id] = el.value;
        }
      }
    });
    return JSON.stringify(formData);
  }

  function clearDirtyHighlights() {
    const form = document.getElementById('invitation-config-form');
    if (form) {
      const elements = form.querySelectorAll('.input-dirty');
      elements.forEach(el => {
        el.classList.remove('input-dirty');
      });
    }
  }

  function checkFormDirtyState() {
    if (!initialFormState) return;
    try {
      const initialObj = JSON.parse(initialFormState);
      const form = document.getElementById('invitation-config-form');
      if (!form) return;
      let dirty = false;
      const elements = form.querySelectorAll('input, select, textarea');
      elements.forEach(el => {
        if (el.id && initialObj.hasOwnProperty(el.id)) {
          let isFieldDirty = false;
          if (el.type === 'checkbox' || el.type === 'radio') {
            isFieldDirty = (el.checked !== initialObj[el.id]);
          } else {
            isFieldDirty = (el.value !== initialObj[el.id]);
          }

          const targetEl = (el.parentElement && el.parentElement.classList.contains('custom-datepicker-container')) ? el.parentElement : el;

          if (isFieldDirty) {
            targetEl.classList.add('input-dirty');
            dirty = true;
          } else {
            targetEl.classList.remove('input-dirty');
          }
        }
      });
      isFormDirty = dirty;
    } catch(e) {
      const currentState = captureFormState();
      isFormDirty = (currentState !== initialFormState);
    }
  }

  function restoreFormState() {
    if (!initialFormState) return;
    try {
      const data = JSON.parse(initialFormState);
      const form = document.getElementById('invitation-config-form');
      if (form) {
        Object.keys(data).forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            if (el.type === 'checkbox' || el.type === 'radio') {
              el.checked = data[id];
            } else {
              el.value = data[id];
            }
            const targetEl = (el.parentElement && el.parentElement.classList.contains('custom-datepicker-container')) ? el.parentElement : el;
            targetEl.classList.remove('input-dirty');
          }
        });
      }
    } catch(e){}
    isFormDirty = false;
  }

  function showUnsavedChangesModal(onSave, onDiscard, onCancel) {
    const existing = document.getElementById('unsaved-changes-modal');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'unsaved-changes-modal';
    backdrop.className = 'unsaved-modal-backdrop';

    const card = document.createElement('div');
    card.className = 'unsaved-modal-card';
    card.innerHTML = `
      <div class="unsaved-modal-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h2 class="unsaved-modal-title">Cambios sin guardar</h2>
      <p class="unsaved-modal-desc">Tienes cambios sin guardar en esta sección. ¿Deseas guardar los cambios antes de continuar?</p>
      <div class="unsaved-modal-actions">
        <button type="button" class="unsaved-btn-save" id="unsaved-btn-save">Guardar y Continuar</button>
        <button type="button" class="unsaved-btn-discard" id="unsaved-btn-discard">Descartar Cambios</button>
        <button type="button" class="unsaved-btn-cancel" id="unsaved-btn-cancel">Cancelar</button>
      </div>
    `;

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    const btnSave = card.querySelector('#unsaved-btn-save');
    const btnDiscard = card.querySelector('#unsaved-btn-discard');
    const btnCancel = card.querySelector('#unsaved-btn-cancel');

    const closeModal = () => backdrop.remove();

    btnSave.addEventListener('click', () => {
      closeModal();
      if (onSave) onSave();
    });

    btnDiscard.addEventListener('click', () => {
      closeModal();
      if (onDiscard) onDiscard();
    });

    btnCancel.addEventListener('click', () => {
      closeModal();
      if (onCancel) onCancel();
    });
  }

  window.addEventListener('beforeunload', (e) => {
    if (isFormDirty) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

  const btnBackToPortal = document.getElementById('btn-back-to-portal');
  if (btnBackToPortal) {
    btnBackToPortal.href = `/event.html?event=${encodeURIComponent(eventId)}`;
    btnBackToPortal.addEventListener('click', (e) => {
      if (isFormDirty) {
        e.preventDefault();
        showUnsavedChangesModal(
          () => {
            saveInvitationConfig();
            window.location.href = `/event.html?event=${encodeURIComponent(eventId)}`;
          },
          () => {
            isFormDirty = false;
            window.location.href = `/event.html?event=${encodeURIComponent(eventId)}`;
          },
          null
        );
      }
    });
  }

  function showToast(type, title, message, duration = 3000) {
    const validTypes = ['success', 'error', 'loading', 'warning', 'info'];

    if (!title && !message) {
      // Single argument call: showToast(message)
      message = type;
      type = 'success';
      title = '¡Éxito!';
    } else if (typeof title === 'string' && validTypes.includes(title.toLowerCase())) {
      // Two argument call: showToast(message, type)
      message = type;
      type = title.toLowerCase();
      title = (type === 'success') ? '¡Éxito!' : (type === 'error') ? 'Error' : (type === 'warning') ? '¡Atención!' : '';
    } else if (!message && title) {
      // Two argument call: showToast(title, message)
      message = title;
      title = (type && !validTypes.includes(type)) ? type : '¡Atención!';
      type = 'warning';
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
    } else if (type === 'warning') {
      iconHtml = `
        <div class="toast-icon-wrapper" style="color: var(--gold-primary);">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
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

  function setButtonLoading(button, isLoading, textOverride) {
    if (!button) return;
    if (isLoading) {
      button.disabled = true;
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }
      const text = textOverride || 'Cargando...';
      button.innerHTML = `<span class="spinner-loader"></span> ${text}`;
      button.style.pointerEvents = 'none';
      button.style.opacity = '0.7';
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml !== undefined) {
        button.innerHTML = button.dataset.originalHtml;
        button.removeAttribute('data-original-html');
      }
      button.style.pointerEvents = '';
      button.style.opacity = '';
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
  const btnSaveGuest = document.getElementById('btn-save-guest');

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
  const tabBtnCapitanes = document.getElementById('tab-btn-capitanes');
  const tabMesas = document.getElementById('tab-mesas');
  const tabFotos = document.getElementById('tab-fotos');
  const tabInvitacion = document.getElementById('tab-invitacion');
  const tabTrivia = document.getElementById('tab-trivia');
  const tabCapitanes = document.getElementById('tab-capitanes');

  // Photo grid elements
  const pendingPhotosGrid = document.getElementById('pending-photos-grid');
  const approvedPhotosGrid = document.getElementById('approved-photos-grid');

  // Photo polling state
  let photoIntervalId = null;
  let photoEventSource = null;
  let triviaIntervalId = null;
  let triviaQuestionsData = [];
  let triviaEventSource = null;
  let lastTriviaSseTime = Date.now();
  let adminTriviaPollInterval = null;

  // Capitanes de Mesa polling state
  let capitanesConfigData = {
    gameMode: 'general',
    timeLimit: 10,
    quests: []
  };
  let capitanesEventSource = null;
  let lastCapitanesSseTime = Date.now();
  let adminCapitanesPollInterval = null;
  let capitanesLocalTimerInterval = null;
  let capitanesStateExpiresAt = null;
  let activeCustomSelection = 'global'; // 'global' or table name (string)

  function switchTab(tabId) {
    if (isFormDirty) {
      showUnsavedChangesModal(
        () => {
          saveInvitationConfig();
          performSwitchTab(tabId);
        },
        () => {
          restoreFormState();
          performSwitchTab(tabId);
        },
        null
      );
      return;
    }
    performSwitchTab(tabId);
  }

  function performSwitchTab(tabId) {
    if (tabId === 'mesas') {
      if (tabBtnMesas) tabBtnMesas.classList.add('active');
      if (tabBtnFotos) tabBtnFotos.classList.remove('active');
      if (tabBtnInvitacion) tabBtnInvitacion.classList.remove('active');
      if (tabBtnTrivia) tabBtnTrivia.classList.remove('active');
      if (tabBtnCapitanes) tabBtnCapitanes.classList.remove('active');
      if (tabMesas) tabMesas.classList.add('active');
      if (tabFotos) tabFotos.classList.remove('active');
      if (tabInvitacion) tabInvitacion.classList.remove('active');
      if (tabTrivia) tabTrivia.classList.remove('active');
      if (tabCapitanes) tabCapitanes.classList.remove('active');
      stopPhotoPolling();
      stopTriviaPolling();
      stopCapitanesPolling();
      loadStats();
      loadRsvps();
      loadGuests();
    } else if (tabId === 'fotos') {
      if (tabBtnMesas) tabBtnMesas.classList.remove('active');
      if (tabBtnFotos) tabBtnFotos.classList.add('active');
      if (tabBtnInvitacion) tabBtnInvitacion.classList.remove('active');
      if (tabBtnTrivia) tabBtnTrivia.classList.remove('active');
      if (tabBtnCapitanes) tabBtnCapitanes.classList.remove('active');
      if (tabMesas) tabMesas.classList.remove('active');
      if (tabFotos) tabFotos.classList.add('active');
      if (tabInvitacion) tabInvitacion.classList.remove('active');
      if (tabTrivia) tabTrivia.classList.remove('active');
      if (tabCapitanes) tabCapitanes.classList.remove('active');
      loadPhotos();
      startPhotoPolling();
      stopTriviaPolling();
      stopCapitanesPolling();
    } else if (tabId === 'invitacion') {
      if (tabBtnMesas) tabBtnMesas.classList.remove('active');
      if (tabBtnFotos) tabBtnFotos.classList.remove('active');
      if (tabBtnInvitacion) tabBtnInvitacion.classList.add('active');
      if (tabBtnTrivia) tabBtnTrivia.classList.remove('active');
      if (tabBtnCapitanes) tabBtnCapitanes.classList.remove('active');
      if (tabMesas) tabMesas.classList.remove('active');
      if (tabFotos) tabFotos.classList.remove('active');
      if (tabInvitacion) tabInvitacion.classList.add('active');
      if (tabTrivia) tabTrivia.classList.remove('active');
      if (tabCapitanes) tabCapitanes.classList.remove('active');
      stopPhotoPolling();
      stopTriviaPolling();
      stopCapitanesPolling();
      loadStats();
      loadRsvps();
      loadGuests();
    } else if (tabId === 'trivia') {
      if (tabBtnMesas) tabBtnMesas.classList.remove('active');
      if (tabBtnFotos) tabBtnFotos.classList.remove('active');
      if (tabBtnInvitacion) tabBtnInvitacion.classList.remove('active');
      if (tabBtnTrivia) tabBtnTrivia.classList.add('active');
      if (tabBtnCapitanes) tabBtnCapitanes.classList.remove('active');
      if (tabMesas) tabMesas.classList.remove('active');
      if (tabFotos) tabFotos.classList.remove('active');
      if (tabInvitacion) tabInvitacion.classList.remove('active');
      if (tabTrivia) tabTrivia.classList.add('active');
      if (tabCapitanes) tabCapitanes.classList.remove('active');
      stopPhotoPolling();
      stopCapitanesPolling();
      loadTriviaConfig();
      startTriviaPolling();
    } else if (tabId === 'capitanes') {
      if (tabBtnMesas) tabBtnMesas.classList.remove('active');
      if (tabBtnFotos) tabBtnFotos.classList.remove('active');
      if (tabBtnInvitacion) tabBtnInvitacion.classList.remove('active');
      if (tabBtnTrivia) tabBtnTrivia.classList.remove('active');
      if (tabBtnCapitanes) tabBtnCapitanes.classList.add('active');
      if (tabMesas) tabMesas.classList.remove('active');
      if (tabFotos) tabFotos.classList.remove('active');
      if (tabInvitacion) tabInvitacion.classList.remove('active');
      if (tabTrivia) tabTrivia.classList.remove('active');
      if (tabCapitanes) tabCapitanes.classList.add('active');
      stopPhotoPolling();
      stopTriviaPolling();
      loadCapitanesConfig();
      startCapitanesPolling();
      loadStats();
      loadGuests();
    }
  }

  window.switchSubTab = function(subTabId) {
    if (isFormDirty) {
      showUnsavedChangesModal(
        () => {
          saveInvitationConfig();
          performSwitchSubTab(subTabId);
        },
        () => {
          restoreFormState();
          performSwitchSubTab(subTabId);
        },
        null
      );
      return;
    }
    performSwitchSubTab(subTabId);
  };

  // --- SUBTABS FOR MESAS & INVITADOS PANEL ---
  let activeAssignTableTarget = null;

  window.switchMesasSubtab = function(subtabId) {
    const subtabs = ['plano', 'invitados', 'qr'];
    subtabs.forEach(s => {
      const btn = document.getElementById(`subtab-btn-${s}`);
      const content = document.getElementById(`mesas-subtab-${s}`);
      if (s === subtabId) {
        if (btn) btn.classList.add('active');
        if (content) content.style.display = 'block';
      } else {
        if (btn) btn.classList.remove('active');
        if (content) content.style.display = 'none';
      }
    });

    if (subtabId === 'plano') {
      renderHallTablesGrid();
      loadHallLayout();
    } else if (subtabId === 'invitados') {
      renderGuestsTable();
    }
  };

  // --- INTERACTIVE HALL CANVAS BOARD ENGINE ---
  let hallCanvasItems = [];
  let tablePositionsMap = {};
  let currentBoardHeight = 540;

  function getTablePos(name) {
    if (!name || !tablePositionsMap) return null;
    if (tablePositionsMap[name]) return tablePositionsMap[name];
    const key = Object.keys(tablePositionsMap).find(k => k.trim().toLowerCase() === String(name).trim().toLowerCase());
    return key ? tablePositionsMap[key] : null;
  }

  function loadHallLayout() {
    fetch(`/api/admin/hall-layout?event=${encodeURIComponent(eventId)}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data) {
          hallCanvasItems = Array.isArray(data.items) ? data.items : [];
          tablePositionsMap = data.tablePositions || {};
          if (data.boardHeight && typeof data.boardHeight === 'number') {
            currentBoardHeight = data.boardHeight;
          }
        }
        renderHallCanvasBoard();
      })
      .catch(err => {
        console.error('Error loading hall layout:', err);
        renderHallCanvasBoard();
      });
  }

  window.addTableToCanvas = function(tableName) {
    const count = Object.keys(tablePositionsMap).length + hallCanvasItems.length;
    const defaultX = 20 + ((count * 15) % 55);
    const defaultY = 20 + ((count * 12) % 45);
    tablePositionsMap[tableName] = { x: defaultX, y: defaultY, rotation: 0 };
    renderHallCanvasBoard();
    saveHallLayoutPositions(true);
  };

  window.removeTableFromCanvas = function(tableName, event) {
    if (event) event.stopPropagation();
    delete tablePositionsMap[tableName];
    renderHallCanvasBoard();
    saveHallLayoutPositions(true);
  };

  window.renameTable = function(oldName, event) {
    if (event) event.stopPropagation();

    const currentFormatted = formatTableDisplay(oldName);

    // Remove any existing rename modal
    const existingModal = document.getElementById('rename-table-modal-overlay');
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rename-table-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(8, 8, 12, 0.8);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: modalFadeIn 0.25s ease-out forwards;
    `;

    overlay.innerHTML = `
      <div class="rename-modal-card" style="
        width: 90%;
        max-width: 420px;
        background: linear-gradient(145deg, rgba(26, 26, 36, 0.96) 0%, rgba(16, 16, 22, 0.98) 100%);
        border: 1.5px solid rgba(212, 175, 55, 0.5);
        border-radius: 20px;
        padding: 26px 28px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8), 0 0 25px rgba(212, 175, 55, 0.15);
        text-align: center;
        font-family: 'Montserrat', sans-serif;
        color: #ffffff;
        box-sizing: border-box;
      ">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">✏️</div>
        <h3 style="font-family: 'Cinzel', serif; color: var(--gold-primary, #d4af37); font-size: 1.25rem; margin: 0 0 6px 0; font-weight: 700; letter-spacing: 0.5px;">
          Renombrar Mesa
        </h3>
        <p style="font-size: 0.84rem; color: rgba(255, 255, 255, 0.7); margin: 0 0 18px 0; line-height: 1.4;">
          Ingresá el nuevo nombre identificatorio para <strong style="color: #fff;">"${escapeHtml(currentFormatted)}"</strong>:
        </p>

        <div style="position: relative; margin-bottom: 22px;">
          <input type="text" id="rename-table-input" value="${escapeHtml(currentFormatted)}" placeholder="Ej: PRIMOS, ABUELOS, VIP..." style="
            width: 100%;
            padding: 12px 16px;
            background: rgba(10, 10, 15, 0.8);
            border: 1px solid rgba(212, 175, 55, 0.4);
            border-radius: 12px;
            color: #ffffff;
            font-size: 1rem;
            font-weight: 600;
            outline: none;
            box-sizing: border-box;
            text-align: center;
            font-family: 'Montserrat', sans-serif;
            transition: all 0.2s ease;
          " onfocus="this.style.borderColor='#d4af37'; this.style.boxShadow='0 0 12px rgba(212,175,55,0.3)';" onblur="this.style.borderColor='rgba(212,175,55,0.4)'; this.style.boxShadow='none';" />
        </div>

        <div style="display: flex; gap: 12px; justify-content: center;">
          <button id="rename-cancel-btn" style="
            flex: 1;
            padding: 11px 18px;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 12px;
            color: rgba(255, 255, 255, 0.85);
            font-size: 0.88rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          ">Cancelar</button>

          <button id="rename-confirm-btn" style="
            flex: 1;
            padding: 11px 18px;
            background: linear-gradient(135deg, #d4af37 0%, #f59e0b 100%);
            border: none;
            border-radius: 12px;
            color: #0f111a;
            font-size: 0.88rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(212, 175, 55, 0.35);
            transition: all 0.2s ease;
          ">Guardar Nombre</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('rename-table-input');
    const confirmBtn = document.getElementById('rename-confirm-btn');
    const cancelBtn = document.getElementById('rename-cancel-btn');

    if (input) {
      setTimeout(() => {
        input.focus();
        input.select();
      }, 50);
    }

    const closeModal = () => {
      overlay.style.animation = 'modalFadeOut 0.2s ease-in forwards';
      setTimeout(() => overlay.remove(), 200);
    };

    cancelBtn.addEventListener('click', closeModal);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    const submitRename = async () => {
      const newName = input.value ? input.value.trim() : '';
      if (!newName) {
        showToast('Por favor ingresá un nombre válido', 'warning');
        return;
      }

      if (newName.toLowerCase() === currentFormatted.toLowerCase()) {
        closeModal();
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.style.opacity = '0.6';
      confirmBtn.textContent = 'Guardando...';

      try {
        const res = await fetch(`/api/admin/rename-table?event=${encodeURIComponent(eventId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ oldName, newName })
        });
        
        let data = {};
        try {
          data = await res.json();
        } catch (e) {
          console.warn('Could not parse JSON response:', e);
        }

        if (!res.ok || !data.success) {
          showToast(data.error || 'Servidor no actualizado. Por favor reiniciá npm start', 'error');
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = '1';
          confirmBtn.textContent = 'Guardar Nombre';
          return;
        }

        showToast(`✅ Mesa renombrada a "${newName}"`, 'success');

        // Update local tablePositionsMap
        const matchKey = Object.keys(tablePositionsMap).find(k => k.trim().toLowerCase() === oldName.toLowerCase());
        if (matchKey) {
          tablePositionsMap[newName] = tablePositionsMap[matchKey];
          if (matchKey !== newName) {
            delete tablePositionsMap[matchKey];
          }
        }

        // Update local allGuests table fields
        allGuests.forEach(g => {
          if (g.table && g.table.trim().toLowerCase() === oldName.toLowerCase()) {
            g.table = newName;
          }
        });

        closeModal();
        loadStats(false);
      } catch (err) {
        console.error('Error renaming table:', err);
        showToast('Error al renombrar la mesa', 'error');
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.textContent = 'Guardar Nombre';
      }
    };

    confirmBtn.addEventListener('click', submitRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitRename();
      if (e.key === 'Escape') closeModal();
    });
  };

  const LANDMARK_PALETTE_TYPES = [
    { type: 'mesa_principal', name: 'Mesa Principal', icon: '👑', isGold: true },
    { type: 'dj', name: 'Cabina DJ', icon: '🎧' },
    { type: 'barra', name: 'Barra de Tragos', icon: '🍷' },
    { type: 'banos', name: 'Sanitarios / Baños', icon: '🚻' },
    { type: 'entrada', name: 'Entrada Principal', icon: '🚪' },
    { type: 'candy', name: 'Mesa Dulce', icon: '🍰' },
    { type: 'pista', name: 'Pista de Baile', icon: '🪩' },
    { type: 'escaleras', name: 'Escaleras / Acceso', icon: '🪜' },
    { type: 'salida', name: 'Salida / Emergencia', icon: '🚨' },
    { type: 'camino', name: 'Camino Guiado', icon: '🛣️' }
  ];

  window.addLandmarkToCanvas = function(type, name, icon) {
    const allowMultiple = ['camino', 'escaleras', 'salida'].includes(type);
    const existingCount = hallCanvasItems.filter(i => i.type === type).length;
    
    if (existingCount > 0 && !allowMultiple) {
      showToast(`⚠️ "${name}" ya se encuentra ubicado en el plano`, 'warning');
      return;
    }

    const itemName = allowMultiple && existingCount > 0 ? `${name} ${existingCount + 1}` : name;
    const newId = 'lm_' + Date.now();
    const count = hallCanvasItems.length + Object.keys(tablePositionsMap).length;
    const defaultX = 15 + ((count * 12) % 65);
    const defaultY = 15 + ((count * 10) % 55);

    hallCanvasItems.push({
      id: newId,
      type: type,
      name: itemName,
      icon: icon,
      x: defaultX,
      y: defaultY,
      rotation: 0
    });

    renderHallCanvasBoard();
    saveHallLayoutPositions(true);
  };

  window.removeLandmarkFromCanvas = function(itemId, event) {
    if (event) event.stopPropagation();
    hallCanvasItems = hallCanvasItems.filter(i => i.id !== itemId);
    renderHallCanvasBoard();
    saveHallLayoutPositions(true);
  };

  window.saveHallLayoutPositions = function(silent = false) {
    fetch(`/api/admin/hall-layout?event=${encodeURIComponent(eventId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: hallCanvasItems,
        tablePositions: tablePositionsMap,
        boardHeight: currentBoardHeight
      })
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (!silent) {
        showToast('✅ Posiciones del salón guardadas con éxito', 'success');
      }
      loadStats(true);
    })
    .catch(err => console.error('Error saving hall layout:', err));
  };

  window.rotateItemOnCanvas = function(targetIdOrName, targetType, event) {
    if (event) event.stopPropagation();

    if (targetType === 'table') {
      const pos = tablePositionsMap[targetIdOrName] || { x: 20, y: 20, rotation: 0 };
      const currentRot = pos.rotation || 0;
      pos.rotation = (currentRot + 45) % 360;
      tablePositionsMap[targetIdOrName] = pos;
    } else if (targetType === 'landmark') {
      const item = hallCanvasItems.find(i => i.id === targetIdOrName);
      if (item) {
        const currentRot = item.rotation || 0;
        item.rotation = (currentRot + 45) % 360;
      }
    }

    renderHallCanvasBoard();
    saveHallLayoutPositions(true);
  };

  let isResizerInitialized = false;
  function initCanvasBoardResizer(board, resizeBar) {
    if (!board || !resizeBar || isResizerInitialized) return;
    isResizerInitialized = true;

    let isResizing = false;
    let startY = 0;
    let startHeight = 0;

    resizeBar.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing = true;
      startY = e.clientY;
      startHeight = board.offsetHeight;
      resizeBar.classList.add('resizing');

      try { resizeBar.setPointerCapture(e.pointerId); } catch(err){}

      const onMove = (moveEvt) => {
        if (!isResizing) return;
        const dy = moveEvt.clientY - startY;
        const newHeight = Math.max(380, Math.min(1400, startHeight + dy));
        board.style.height = `${newHeight}px`;
        currentBoardHeight = newHeight;
      };

      const onUp = (upEvt) => {
        if (isResizing) {
          isResizing = false;
          resizeBar.classList.remove('resizing');
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          try { resizeBar.releasePointerCapture(upEvt.pointerId); } catch(err){}
          saveHallLayoutPositions(true);
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
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

  function renderHallCanvasBoard() {
    const board = document.getElementById('hall-canvas-board');
    if (!board) return;
    board.style.height = `${currentBoardHeight}px`;

    const resizeBar = document.getElementById('canvas-resize-bar');
    initCanvasBoardResizer(board, resizeBar);

    // Render palette toolbar dynamically (only show unplaced items and tables)
    const paletteContainer = document.getElementById('canvas-palette-toolbar');
    if (paletteContainer) {
      let toolbarHtml = `<span style="font-size: 0.78rem; color: var(--gold-light); font-weight: 600; display: flex; align-items: center; white-space: nowrap; margin-right: 4px;">Añadir al Plano:</span>`;
      let countAvailable = 0;

      LANDMARK_PALETTE_TYPES.forEach(item => {
        const isPlaced = hallCanvasItems.some(i => i.type === item.type);
        if (!isPlaced) {
          countAvailable++;
          const style = item.isGold ? 'border-color: rgba(212, 175, 55, 0.4); color: var(--gold-primary);' : '';
          toolbarHtml += `<button class="palette-btn" onclick="addLandmarkToCanvas('${item.type}', '${escapeHtml(item.name)}', '${item.icon}')" style="${style}">${item.icon} ${escapeHtml(item.name)}</button>`;
        }
      });

      if (allTables && Array.isArray(allTables)) {
        allTables.forEach(t => {
          if (!getTablePos(t.name)) {
            countAvailable++;
            toolbarHtml += `<button class="palette-btn" onclick="addTableToCanvas('${escapeHtml(t.name)}')" style="border-color: rgba(212, 175, 55, 0.4); color: var(--gold-light);">🍽️ ${escapeHtml(formatTableDisplay(t.name))}</button>`;
          }
        });
      }

      if (countAvailable === 0) {
        toolbarHtml += `<span style="font-size: 0.78rem; color: rgba(255,255,255,0.4); font-style: italic; display: flex; align-items: center;">✨ Todos los componentes y mesas están ubicados en el plano</span>`;
      }

      paletteContainer.innerHTML = toolbarHtml;
    }

    let html = '';

    // Render tables placed on board with buildTableNumberMapping
    if (allTables && Array.isArray(allTables)) {
      const allTableNames = allTables.map(t => t.name);
      const tableMapping = buildTableNumberMapping(allTableNames);

      allTables.forEach((t) => {
        const pos = getTablePos(t.name);
        if (!pos) return; // Only render tables explicitly placed on board

        const isPresidencial = /principal|presidencial\b/i.test(t.name);
        const guestsInTable = allGuests.filter(g => formatTableDisplay(g.table).trim().toLowerCase() === formatTableDisplay(t.name).trim().toLowerCase());
        const count = guestsInTable.length;
        const capacity = t.capacity || 10;
        const rot = pos.rotation || 0;
        const scale = pos.scale || 1.0;

        const info = tableMapping[t.name] || { numberStr: `Mesa 1`, alias: t.name };

        if (isPresidencial) {
          html += `
            <div class="canvas-item canvas-item-presidencial" data-type="table" data-name="${escapeHtml(t.name)}" style="left: ${pos.x}%; top: ${pos.y}%; transform: rotate(${rot}deg) scale(${scale});">
              <span class="canvas-item-rotate" title="Mantener apretado y arrastrar para rotar 360°">🔄</span>
              <span style="font-size: 1.1rem; margin-top: -2px;">👑</span>
              <div class="canvas-item-title" title="Doble clic para renombrar" ondblclick="renameTable('${escapeHtml(t.name)}', event)">${escapeHtml(formatTableDisplay(t.name))}</div>
              <div class="canvas-item-count">${count}/${capacity} pers.</div>
              <span class="canvas-item-remove" onclick="removeTableFromCanvas('${escapeHtml(t.name)}', event)">✕</span>
              <span class="canvas-item-edit" title="Editar nombre de mesa" onclick="renameTable('${escapeHtml(t.name)}', event)">✏️</span>
              <span class="canvas-item-resize" title="Mantener apretado y arrastrar para redimensionar">↔️</span>
            </div>
          `;
        } else {
          const isCustomAlias = Boolean(info.alias && !/^mesa\s*\d+$/i.test(info.alias));
          const mainTitle = isCustomAlias ? escapeHtml(String(info.alias).trim().toUpperCase()) : escapeHtml(info.numberStr);
          const subNumHtml = isCustomAlias ? `<div class="canvas-item-number">(${info.numberStr})</div>` : '';

          html += `
            <div class="canvas-item canvas-item-table" data-type="table" data-name="${escapeHtml(t.name)}" style="left: ${pos.x}%; top: ${pos.y}%; transform: rotate(${rot}deg) scale(${scale});">
              <span class="canvas-item-rotate" title="Mantener apretado y arrastrar para rotar 360°">🔄</span>
              <span style="font-size: 1.1rem;">🍽️</span>
              <div class="canvas-item-title" title="Doble clic para renombrar" ondblclick="renameTable('${escapeHtml(t.name)}', event)">${mainTitle}</div>
              ${subNumHtml}
              <div class="canvas-item-count">${count}/${capacity}</div>
              <span class="canvas-item-remove" onclick="removeTableFromCanvas('${escapeHtml(t.name)}', event)">✕</span>
              <span class="canvas-item-edit" title="Editar nombre de mesa" onclick="renameTable('${escapeHtml(t.name)}', event)">✏️</span>
              <span class="canvas-item-resize" title="Mantener apretado y arrastrar para redimensionar">↔️</span>
            </div>
          `;
        }
      });
    }

    // Render landmarks
    hallCanvasItems.forEach(item => {
      const rot = item.rotation || 0;
      const scale = item.scale || 1.0;
      if (item.type === 'mesa_principal') {
        html += `
          <div class="canvas-item canvas-item-presidencial" data-type="landmark" data-id="${item.id}" style="left: ${item.x}%; top: ${item.y}%; transform: rotate(${rot}deg) scale(${scale});">
            <span class="canvas-item-rotate" title="Mantener apretado y arrastrar para rotar 360°">🔄</span>
            <span style="font-size: 1.1rem; margin-top: -2px;">👑</span>
            <div class="canvas-item-title">${escapeHtml(item.name)}</div>
            <div class="canvas-item-count">Homenajeados</div>
            <span class="canvas-item-remove" onclick="removeLandmarkFromCanvas('${item.id}', event)">✕</span>
            <span class="canvas-item-resize" title="Mantener apretado y arrastrar para redimensionar">↔️</span>
          </div>
        `;
      } else {
        html += `
          <div class="canvas-item canvas-item-landmark" data-type="landmark" data-id="${item.id}" style="left: ${item.x}%; top: ${item.y}%; transform: rotate(${rot}deg) scale(${scale});">
            <span class="canvas-item-rotate" title="Mantener apretado y arrastrar para rotar 360°">🔄</span>
            <span>${item.icon}</span>
            <span>${escapeHtml(item.name)}</span>
            <span class="canvas-item-remove" onclick="removeLandmarkFromCanvas('${item.id}', event)">✕</span>
            <span class="canvas-item-resize" title="Mantener apretado y arrastrar para redimensionar">↔️</span>
          </div>
        `;
      }
    });

    board.innerHTML = html;
    initBoardDragEngine(board);
  }

  function initBoardDragEngine(board) {
    const items = board.querySelectorAll('.canvas-item');
    items.forEach(item => {
      let isDragging = false;
      let startX, startY;
      let startLeft, startTop;

      // Photoshop / Figma Style 360-degree Rotation Drag Engine
      const rotateBtn = item.querySelector('.canvas-item-rotate');
      if (rotateBtn) {
        let isRotating = false;
        let itemCenterX, itemCenterY;
        let initialAngle = 0;
        let initialRot = 0;

        rotateBtn.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          isRotating = true;
          item.classList.add('rotating');

          try { rotateBtn.setPointerCapture(e.pointerId); } catch(err){}

          const itemRect = item.getBoundingClientRect();
          itemCenterX = itemRect.left + itemRect.width / 2;
          itemCenterY = itemRect.top + itemRect.height / 2;

          initialAngle = Math.atan2(e.clientY - itemCenterY, e.clientX - itemCenterX) * (180 / Math.PI);

          const targetType = item.dataset.type;
          if (targetType === 'table') {
            const name = item.dataset.name;
            const pos = tablePositionsMap[name] || {};
            initialRot = pos.rotation || 0;
          } else {
            const id = item.dataset.id;
            const found = hallCanvasItems.find(i => i.id === id);
            initialRot = found ? (found.rotation || 0) : 0;
          }

          // Create or select floating angle badge
          let angleBadge = document.getElementById('canvas-rotation-badge');
          if (!angleBadge) {
            angleBadge = document.createElement('div');
            angleBadge.id = 'canvas-rotation-badge';
            angleBadge.style.cssText = `
              position: fixed;
              z-index: 100000;
              background: rgba(16, 185, 129, 0.95);
              color: #ffffff;
              padding: 5px 12px;
              border-radius: 14px;
              font-size: 0.8rem;
              font-weight: 700;
              box-shadow: 0 4px 18px rgba(0,0,0,0.6);
              pointer-events: none;
              font-family: 'Montserrat', sans-serif;
              display: none;
              backdrop-filter: blur(8px);
              letter-spacing: 0.5px;
            `;
            document.body.appendChild(angleBadge);
          }

          const onRotateMove = (moveEvt) => {
            if (!isRotating) return;

            // 1. Anti-Giros Locos: Deadzone safety filter (ignore erratic movements near item center)
            const distFromCenter = Math.hypot(moveEvt.clientX - itemCenterX, moveEvt.clientY - itemCenterY);
            if (distFromCenter < 25) {
              return;
            }

            const currentAngle = Math.atan2(moveEvt.clientY - itemCenterY, moveEvt.clientX - itemCenterX) * (180 / Math.PI);
            let angleDiff = currentAngle - initialAngle;
            let rawRotation = Math.round((initialRot + angleDiff) % 360);
            if (rawRotation < 0) rawRotation += 360;

            let finalRotation = rawRotation;
            let isSnapped = false;

            // 2. Magnetic Angle Snap with True Circular Distance
            const cardinalAngles = [0, 45, 90, 135, 180, 225, 270, 315];
            const snapThreshold = moveEvt.shiftKey ? 8 : 4;

            for (const cardAngle of cardinalAngles) {
              let diff = Math.abs(rawRotation - cardAngle);
              if (diff > 180) diff = 360 - diff;
              if (diff <= snapThreshold) {
                finalRotation = cardAngle;
                isSnapped = true;
                break;
              }
            }

            let currentScale = 1.0;
            const itemType = item.dataset.type;
            if (itemType === 'table') {
              const name = item.dataset.name;
              const pos = tablePositionsMap[name] || {};
              currentScale = pos.scale || 1.0;
              if (!tablePositionsMap[name]) tablePositionsMap[name] = { x: 20, y: 20 };
              tablePositionsMap[name].rotation = finalRotation;
            } else {
              const id = item.dataset.id;
              const found = hallCanvasItems.find(i => i.id === id);
              currentScale = found ? (found.scale || 1.0) : 1.0;
              if (found) found.rotation = finalRotation;
            }

            item.style.transform = `rotate(${finalRotation}deg) scale(${currentScale})`;

            // 3. Floating Tooltip Badge Update
            if (angleBadge) {
              angleBadge.style.display = 'block';
              angleBadge.style.left = `${moveEvt.clientX + 16}px`;
              angleBadge.style.top = `${moveEvt.clientY - 28}px`;
              angleBadge.innerHTML = `${finalRotation}° ${isSnapped ? '🧲' : '📐'}`;
              angleBadge.style.background = isSnapped ? 'rgba(16, 185, 129, 0.95)' : 'rgba(20, 22, 34, 0.92)';
              angleBadge.style.border = isSnapped ? '1px solid #34d399' : '1px solid rgba(212, 175, 55, 0.4)';
              angleBadge.style.color = isSnapped ? '#ffffff' : '#d4af37';
            }
          };

          const onRotateUp = (upEvt) => {
            if (isRotating) {
              isRotating = false;
              item.classList.remove('rotating');
              if (angleBadge) angleBadge.style.display = 'none';
              window.removeEventListener('pointermove', onRotateMove);
              window.removeEventListener('pointerup', onRotateUp);
              try { rotateBtn.releasePointerCapture(upEvt.pointerId); } catch(err){}

              saveHallLayoutPositions(true);
            }
          };

          window.addEventListener('pointermove', onRotateMove);
          window.addEventListener('pointerup', onRotateUp);
        });
      }

      // Photoshop / Figma Style Scale / Resizing Drag Engine
      const resizeBtn = item.querySelector('.canvas-item-resize');
      if (resizeBtn) {
        let isScaling = false;
        let itemCenterX, itemCenterY;
        let initialDist = 0;
        let initialScale = 1.0;

        resizeBtn.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          e.preventDefault();
          isScaling = true;
          item.classList.add('scaling');

          try { resizeBtn.setPointerCapture(e.pointerId); } catch(err){}

          const itemRect = item.getBoundingClientRect();
          itemCenterX = itemRect.left + itemRect.width / 2;
          itemCenterY = itemRect.top + itemRect.height / 2;

          initialDist = Math.hypot(e.clientX - itemCenterX, e.clientY - itemCenterY);
          if (initialDist < 5) initialDist = 5;

          const targetType = item.dataset.type;
          if (targetType === 'table') {
            const name = item.dataset.name;
            const pos = tablePositionsMap[name] || {};
            initialScale = pos.scale || 1.0;
          } else {
            const id = item.dataset.id;
            const found = hallCanvasItems.find(i => i.id === id);
            initialScale = found ? (found.scale || 1.0) : 1.0;
          }

          // Create or select floating scale badge
          let scaleBadge = document.getElementById('canvas-scale-badge');
          if (!scaleBadge) {
            scaleBadge = document.createElement('div');
            scaleBadge.id = 'canvas-scale-badge';
            scaleBadge.style.cssText = `
              position: fixed;
              z-index: 100000;
              background: rgba(59, 130, 246, 0.95);
              color: #ffffff;
              padding: 5px 12px;
              border-radius: 14px;
              font-size: 0.8rem;
              font-weight: 700;
              box-shadow: 0 4px 18px rgba(0,0,0,0.6);
              pointer-events: none;
              font-family: 'Montserrat', sans-serif;
              display: none;
              backdrop-filter: blur(8px);
              letter-spacing: 0.5px;
              border: 1px solid #60a5fa;
            `;
            document.body.appendChild(scaleBadge);
          }

          const onScaleMove = (moveEvt) => {
            if (!isScaling) return;

            const currentDist = Math.hypot(moveEvt.clientX - itemCenterX, moveEvt.clientY - itemCenterY);
            const scaleRatio = currentDist / initialDist;
            let rawScale = initialScale * scaleRatio;

            // Clamp scale between 0.5x and 3.0x
            let finalScale = Math.max(0.5, Math.min(3.0, Math.round(rawScale * 100) / 100));

            // Get rotation
            let currentRot = 0;
            const targetType = item.dataset.type;
            if (targetType === 'table') {
              const name = item.dataset.name;
              const pos = tablePositionsMap[name] || {};
              currentRot = pos.rotation || 0;
            } else {
              const id = item.dataset.id;
              const found = hallCanvasItems.find(i => i.id === id);
              currentRot = found ? (found.rotation || 0) : 0;
            }

            item.style.transform = `rotate(${currentRot}deg) scale(${finalScale})`;

            // Floating Tooltip Badge Update
            if (scaleBadge) {
              scaleBadge.style.display = 'block';
              scaleBadge.style.left = `${moveEvt.clientX + 16}px`;
              scaleBadge.style.top = `${moveEvt.clientY - 28}px`;
              const percentage = Math.round(finalScale * 100);
              scaleBadge.innerHTML = `${percentage}% 📏`;
            }

            if (targetType === 'table') {
              const name = item.dataset.name;
              if (!tablePositionsMap[name]) tablePositionsMap[name] = { x: 20, y: 20 };
              tablePositionsMap[name].scale = finalScale;
            } else {
              const id = item.dataset.id;
              const found = hallCanvasItems.find(i => i.id === id);
              if (found) found.scale = finalScale;
            }
          };

          const onScaleUp = (upEvt) => {
            if (isScaling) {
              isScaling = false;
              item.classList.remove('scaling');
              if (scaleBadge) scaleBadge.style.display = 'none';
              window.removeEventListener('pointermove', onScaleMove);
              window.removeEventListener('pointerup', onScaleUp);
              try { resizeBtn.releasePointerCapture(upEvt.pointerId); } catch(err){}
              saveHallLayoutPositions(true);
            }
          };

          window.addEventListener('pointermove', onScaleMove);
          window.addEventListener('pointerup', onScaleUp);
        });
      }

      // Position Dragging
      let didDragInSession = false;

      item.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('canvas-item-remove') || e.target.classList.contains('canvas-item-rotate') || e.target.classList.contains('canvas-item-resize') || e.target.classList.contains('canvas-item-edit')) return;
        
        // Prevent native text selection or HTML5 drag interference
        e.preventDefault();

        isDragging = false;
        didDragInSession = false;
        startX = e.clientX;
        startY = e.clientY;

        try { item.setPointerCapture(e.pointerId); } catch(err){}

        const boardRect = board.getBoundingClientRect();
        
        // Read exact CSS percentage position from data model to avoid bounding box rotation distortion
        const type = item.dataset.type;
        if (type === 'table') {
          const name = item.dataset.name;
          const pos = tablePositionsMap[name] || {};
          startLeft = pos.x !== undefined ? pos.x : parseFloat(item.style.left) || 20;
          startTop = pos.y !== undefined ? pos.y : parseFloat(item.style.top) || 20;
        } else if (type === 'landmark') {
          const id = item.dataset.id;
          const found = hallCanvasItems.find(i => i.id === id);
          startLeft = found ? (found.x !== undefined ? found.x : parseFloat(item.style.left) || 20) : parseFloat(item.style.left) || 20;
          startTop = found ? (found.y !== undefined ? found.y : parseFloat(item.style.top) || 20) : parseFloat(item.style.top) || 20;
        } else {
          startLeft = parseFloat(item.style.left) || 0;
          startTop = parseFloat(item.style.top) || 0;
        }

        const onPointerMove = (moveEvt) => {
          const dist = Math.hypot(moveEvt.clientX - startX, moveEvt.clientY - startY);
          if (dist > 3) {
            if (!isDragging) {
              isDragging = true;
              didDragInSession = true;
              item.classList.add('dragging');
            }
          }

          if (isDragging) {
            const dx = ((moveEvt.clientX - startX) / boardRect.width) * 100;
            const dy = ((moveEvt.clientY - startY) / boardRect.height) * 100;

            let newLeft = Math.max(0, Math.min(88, startLeft + dx));
            let newTop = Math.max(0, Math.min(88, startTop + dy));

            // Use 2-decimal precision to match DOM style and data model, avoiding micro-snaps on release
            newLeft = Math.round(newLeft * 100) / 100;
            newTop = Math.round(newTop * 100) / 100;

            item.style.left = `${newLeft}%`;
            item.style.top = `${newTop}%`;

            const type = item.dataset.type;
            if (type === 'table') {
              const name = item.dataset.name;
              if (!tablePositionsMap[name]) tablePositionsMap[name] = { x: 20, y: 20 };
              tablePositionsMap[name].x = newLeft;
              tablePositionsMap[name].y = newTop;
            } else if (type === 'landmark') {
              const id = item.dataset.id;
              const found = hallCanvasItems.find(i => i.id === id);
              if (found) {
                found.x = newLeft;
                found.y = newTop;
              }
            }
          }
        };

        const onPointerUp = (upEvt) => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);

          try { item.releasePointerCapture(upEvt.pointerId); } catch(err){}

          if (isDragging) {
            isDragging = false;
            item.classList.remove('dragging');
            saveHallLayoutPositions(true);
          }
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
      });

      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('canvas-item-remove') || e.target.classList.contains('canvas-item-rotate')) return;
        if (didDragInSession) {
          didDragInSession = false;
          return;
        }
        if (item.dataset.type === 'table') {
          const tableName = item.dataset.name;
          openAssignGuestToTableModal(tableName);
        }
      });
    });
  }

  function renderHallTablesGrid() {
    const gridContainer = document.getElementById('hall-tables-grid');
    if (!gridContainer) return;

    // Confirmed guest names set
    const confirmedNames = new Set(
      allRsvps.filter(r => r.attending === true).map(r => r.name.trim().toLowerCase())
    );

    const confirmedGuests = allGuests.filter(g => {
      const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
      return confirmedNames.has(fullName) || allRsvps.length === 0;
    });

    let seatedCount = 0;
    let unassignedCount = 0;

    confirmedGuests.forEach(g => {
      if (g.table && String(g.table).trim() !== '' && String(g.table).toLowerCase() !== 'sin mesa') {
        seatedCount++;
      } else {
        unassignedCount++;
      }
    });

    const statSeated = document.getElementById('stat-seated-guests');
    const statUnassigned = document.getElementById('stat-unassigned-guests');
    if (statSeated) statSeated.textContent = seatedCount;
    if (statUnassigned) statUnassigned.textContent = unassignedCount;

    if (!allTables || allTables.length === 0) {
      gridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); background: rgba(0,0,0,0.2); border-radius: 20px; border: 1px dashed rgba(255,255,255,0.1);">
          <div style="font-size: 2rem; margin-bottom: 10px;">🏛️</div>
          <h3 style="color: white; margin-bottom: 6px;">No hay mesas creadas aún</h3>
          <p style="font-size: 0.85rem; margin-bottom: 20px;">Crea la primera mesa del salón para comenzar la organización.</p>
          <button class="btn btn-primary" onclick="openCreateTableModal()" style="padding: 10px 24px; border-radius: 20px; font-size: 0.85rem;">+ Crear Mesa</button>
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = allTables.map(t => {
      const guestsInTable = allGuests.filter(g => formatTableDisplay(g.table).trim().toLowerCase() === formatTableDisplay(t.name).trim().toLowerCase());
      const isPresidencial = /principal|presidencial\b/i.test(t.name);

      const count = guestsInTable.length;
      const capacity = t.capacity || 10;
      const pct = Math.min(100, Math.round((count / capacity) * 100));
      const isFull = count >= capacity;

      const guestsTagsHtml = guestsInTable.map(g => `
        <span class="seated-guest-tag">
          👤 ${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)}
          <span class="remove-btn" onclick="unassignGuestFromTable('${escapeHtml(g.firstName)}', '${escapeHtml(g.lastName)}')" title="Quitar de esta mesa">✕</span>
        </span>
      `).join('');

      return `
        <div class="table-card ${isPresidencial ? 'table-card-presidencial' : ''}">
          <div class="table-card-header">
            <div class="table-card-title-group">
              <span style="font-size: 1.2rem;">${isPresidencial ? '👑' : '🍽️'}</span>
              <h3 class="table-card-title">${escapeHtml(formatTableDisplay(t.name))}</h3>
            </div>
            <span class="table-capacity-pill ${isFull ? 'full' : 'available'}">
              ${count} / ${capacity} pers.
            </span>
          </div>

          <div class="table-progress-bar">
            <div class="table-progress-fill" style="width: ${pct}%;"></div>
          </div>

          <div class="seated-guests-container">
            ${guestsTagsHtml || '<span style="color: var(--text-muted); font-size: 0.75rem; font-style: italic;">Sin invitados asignados aún</span>'}
          </div>

          <div class="table-card-actions">
            <button class="table-action-btn" onclick="openAssignGuestToTableModal('${escapeHtml(t.name)}')">
              ➕ Ubicar Invitado
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.unassignGuestFromTable = function(firstName, lastName) {
    const guest = allGuests.find(g => 
      g.firstName.trim().toLowerCase() === firstName.trim().toLowerCase() &&
      g.lastName.trim().toLowerCase() === lastName.trim().toLowerCase()
    );
    if (!guest) return;

    const guestIdx = guest.originalIndex !== undefined ? guest.originalIndex : allGuests.indexOf(guest);

    fetch(`/api/guests/${guestIdx}?event=${encodeURIComponent(eventId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: guest.firstName,
        lastName: guest.lastName,
        table: 'Sin Mesa'
      })
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data.success) {
        showToast('Invitado removido de la mesa', 'success');
        loadGuests();
        loadStats();
      }
    })
    .catch(err => console.error('Error unassigning guest:', err));
  };

  window.toggleAssignGuestDropdown = function(event) {
    if (event) event.stopPropagation();
    const dropdown = document.getElementById('assign-guest-dropdown-menu');
    const trigger = document.getElementById('assign-guest-trigger');
    if (!dropdown) return;
    const isOpening = !dropdown.classList.contains('active');
    dropdown.classList.toggle('active', isOpening);
    if (trigger) trigger.classList.toggle('active', isOpening);
  };

  window.selectAssignGuestOption = function(guestIdx, guestName) {
    const valInput = document.getElementById('assign-guest-value');
    const textSpan = document.getElementById('assign-guest-selected-text');
    const dropdown = document.getElementById('assign-guest-dropdown-menu');
    const trigger = document.getElementById('assign-guest-trigger');

    if (valInput) valInput.value = guestIdx;
    if (textSpan) {
      textSpan.textContent = `👤 ${guestName}`;
      textSpan.style.color = '#ffffff';
    }

    if (dropdown) {
      dropdown.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.value === String(guestIdx));
      });
      dropdown.classList.remove('active');
    }
    if (trigger) trigger.classList.remove('active');
  };

  let selectedAssignGuestIndices = new Set();

  function updateAssignScrollIndicator() {
    const container = document.getElementById('assign-guest-multiselect-container');
    const indicator = document.getElementById('assign-guest-scroll-indicator');
    if (!container || !indicator) return;

    const hasMore = container.scrollHeight > container.clientHeight + 10 &&
                    (container.scrollTop + container.clientHeight) < (container.scrollHeight - 15);
    indicator.style.display = hasMore ? 'flex' : 'none';
  }

  function renderAssignGuestMultiselectList() {
    const container = document.getElementById('assign-guest-multiselect-container');
    const badge = document.getElementById('assign-selected-badge');
    const searchInput = document.getElementById('assign-guest-search-input');
    const submitBtn = document.getElementById('btn-submit-assign-guest');
    if (!container) return;

    container.onscroll = updateAssignScrollIndicator;

    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const unassignedGuests = allGuests.map((g, idx) => ({ ...g, originalIndex: idx }))
      .filter(g => !g.table || String(g.table).trim() === '' || String(g.table).toLowerCase() === 'sin mesa')
      .filter(g => {
        if (!query) return true;
        const fullName = `${g.firstName} ${g.lastName}`.toLowerCase();
        return fullName.includes(query);
      });

    if (badge) {
      badge.textContent = `${selectedAssignGuestIndices.size} / 10 Seleccionados`;
      badge.style.borderColor = selectedAssignGuestIndices.size > 0 ? 'var(--gold-primary)' : 'rgba(212, 175, 55, 0.4)';
    }

    if (submitBtn) {
      if (selectedAssignGuestIndices.size > 0) {
        submitBtn.disabled = false;
        submitBtn.textContent = `Ubicar ${selectedAssignGuestIndices.size} Invitado${selectedAssignGuestIndices.size > 1 ? 's' : ''}`;
      } else {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Ubicar Invitados';
      }
    }

    if (unassignedGuests.length === 0) {
      container.innerHTML = query 
        ? '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.82rem;">🔍 No se encontraron invitados que coincidan.</div>'
        : '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.82rem;">✨ ¡Todos los invitados ya tienen mesa asignada!</div>';
      updateAssignScrollIndicator();
      return;
    }

    container.innerHTML = unassignedGuests.map(g => {
      const idx = g.originalIndex;
      const name = `${g.firstName} ${g.lastName}`.trim();
      const isSelected = selectedAssignGuestIndices.has(idx);
      return `
        <div class="assign-guest-row ${isSelected ? 'selected' : ''}" onclick="toggleAssignGuestSelection(${idx}, event)">
          <div class="custom-gold-checkbox">
            <svg class="checkmark-svg" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <span style="font-size: 0.95rem;">👤</span>
          <span style="font-size: 0.84rem; font-weight: 600; flex: 1; color: #fff;">${escapeHtml(name)}</span>
          ${g.phone ? `<span style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(g.phone)}</span>` : ''}
        </div>
      `;
    }).join('');

    setTimeout(updateAssignScrollIndicator, 50);
  }

  window.toggleAssignGuestSelection = function(idx, event) {
    if (event) event.stopPropagation();
    if (selectedAssignGuestIndices.has(idx)) {
      selectedAssignGuestIndices.delete(idx);
    } else {
      if (selectedAssignGuestIndices.size >= 10) {
        showToast('Podés seleccionar hasta un máximo de 10 invitados por lote', 'warning');
        return;
      }
      selectedAssignGuestIndices.add(idx);
    }
    renderAssignGuestMultiselectList();
  };

  window.openAssignGuestToTableModal = function(tableName) {
    activeAssignTableTarget = tableName;
    selectedAssignGuestIndices.clear();
    const modal = document.getElementById('assign-guest-modal');
    const title = document.getElementById('assign-modal-title');
    const searchInput = document.getElementById('assign-guest-search-input');
    if (!modal) return;

    if (title) title.textContent = `Ubicar Invitados en ${formatTableDisplay(tableName)}`;
    if (searchInput) {
      searchInput.value = '';
      searchInput.oninput = () => renderAssignGuestMultiselectList();
    }

    renderAssignGuestMultiselectList();
    modal.style.display = 'flex';
    if (searchInput) setTimeout(() => searchInput.focus(), 50);
  };

  window.closeAssignGuestModal = function() {
    const modal = document.getElementById('assign-guest-modal');
    if (modal) modal.style.display = 'none';
    selectedAssignGuestIndices.clear();
    activeAssignTableTarget = null;
  };

  const btnSubmitAssignGuest = document.getElementById('btn-submit-assign-guest');
  if (btnSubmitAssignGuest) {
    btnSubmitAssignGuest.addEventListener('click', async () => {
      if (selectedAssignGuestIndices.size === 0 || !activeAssignTableTarget) {
        showToast('Seleccioná al menos un invitado para ubicar en la mesa', 'warning');
        return;
      }

      btnSubmitAssignGuest.disabled = true;
      btnSubmitAssignGuest.textContent = `Guardando (${selectedAssignGuestIndices.size})...`;

      const indices = Array.from(selectedAssignGuestIndices);
      let successCount = 0;

      for (const guestIdx of indices) {
        const guest = allGuests[guestIdx];
        if (!guest) continue;

        try {
          const res = await fetch(`/api/guests/${guestIdx}?event=${encodeURIComponent(eventId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName: guest.firstName,
              lastName: guest.lastName,
              table: activeAssignTableTarget
            })
          });
          if (res.ok) successCount++;
        } catch (err) {
          console.error(`Error updating guest at index ${guestIdx}:`, err);
        }
      }

      showToast(`✅ ${successCount} invitado(s) ubicado(s) en ${formatTableDisplay(activeAssignTableTarget)}`, 'success');
      closeAssignGuestModal();
      loadGuests();
      loadStats();
    });
  }

  // --- CREATE NEW TABLE MODAL HANDLERS ---
  window.openCreateTableModal = function() {
    const modal = document.getElementById('create-table-modal');
    const inputName = document.getElementById('create-table-name');
    const inputCapacity = document.getElementById('create-table-capacity');
    if (!modal) return;

    if (inputName) inputName.value = '';
    if (inputCapacity) inputCapacity.value = '10';
    modal.style.display = 'flex';
  };

  window.closeCreateTableModal = function() {
    const modal = document.getElementById('create-table-modal');
    if (modal) modal.style.display = 'none';
  };

  window.submitCreateTableForm = function() {
    const nameInput = document.getElementById('create-table-name');
    const capInput = document.getElementById('create-table-capacity');
    if (!nameInput || !nameInput.value.trim()) return;

    const tableName = nameInput.value.trim();
    const capacity = parseInt(capInput.value, 10) || 10;

    // Check if table limit (50) is reached
    if (allTables && Array.isArray(allTables) && allTables.length >= 50) {
      showToast('⚠️ Se ha alcanzado el límite máximo de 50 mesas para este evento', 'warning');
      return;
    }

    // Check if table already exists in allTables
    if (allTables && Array.isArray(allTables)) {
      const exists = allTables.find(t => String(t.name).toLowerCase() === tableName.toLowerCase());
      if (exists) {
        showToast(`La mesa "${tableName}" ya existe`, 'error');
        return;
      }
    }

    fetch(`/api/admin/tables?event=${encodeURIComponent(eventId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: tableName, capacity: capacity })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showToast(`✅ Mesa "${tableName}" creada con éxito`, 'success');
        closeCreateTableModal();
        if (!tablePositionsMap[tableName]) {
          const count = Object.keys(tablePositionsMap).length + hallCanvasItems.length;
          const defaultX = 20 + ((count * 15) % 55);
          const defaultY = 20 + ((count * 12) % 45);
          tablePositionsMap[tableName] = { x: defaultX, y: defaultY, rotation: 0 };
          saveHallLayoutPositions(true);
        }
        loadStats();
        loadGuests();
      } else {
        throw new Error(data.error || 'Error al crear la mesa');
      }
    })
    .catch(err => {
      console.error('Error creating table:', err);
      // Fallback local addition
      if (!allTables) allTables = [];
      allTables.push({ name: tableName, count: 0, totalCount: 0, capacity: capacity });
      renderHallTablesGrid();
      closeCreateTableModal();
      showToast(`✅ Mesa "${tableName}" creada`, 'success');
    });
  };

  function performSwitchSubTab(subTabId) {
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
          if (t === 'invitados') {
            setTimeout(() => {
              updateTableScrollHint('invitados-table-wrapper', 'invitados-scroll-hint');
            }, 50);
            setTimeout(() => {
              updateTableScrollHint('invitados-table-wrapper', 'invitados-scroll-hint');
            }, 250);
          }
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
  }

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
  let siteOrigin = window.location.origin;
  const qrBaseUrl = 'https://api.qrserver.com/v1/create-qr-code/';

  // Resolve local IP address dynamically to allow local Wi-Fi testing
  fetch('/api/debug/network-ip')
    .then(res => res.json())
    .then(data => {
      if (data.localIp && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        siteOrigin = `http://${data.localIp}:${window.location.port}`;
        if (typeof updateQR === 'function') {
          updateQR();
        }
      }
    })
    .catch(err => console.error('Could not resolve local network IP:', err));

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
  const invTimeEndInput = document.getElementById('inv-time-end-input');
  const invMusicInput = document.getElementById('inv-music-input');
  const invAudioUpload = document.getElementById('inv-audio-upload');
  const invAudioUploadStatus = document.getElementById('inv-audio-upload-status');
  const invAddressInput = document.getElementById('inv-address-input');
  const invMapsInput = document.getElementById('inv-maps-input');
  const invDressInput = document.getElementById('inv-dress-input');
  const invBankHolderInput = document.getElementById('inv-bank-holder-input');
  const invCbuInput = document.getElementById('inv-cbu-input');
  const invAliasInput = document.getElementById('inv-alias-input');
  const invTemplate = document.getElementById('inv-template');
  const invThemeFont = document.getElementById('inv-theme-font');
  const invThemeColor = document.getElementById('inv-theme-color');
  const invBgEffect = document.getElementById('inv-bg-effect');
  const invWaxSeal = document.getElementById('inv-wax-seal');
  const invBgUrl = document.getElementById('inv-bg-url');
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
    } else if (event.data.type === 'invitation-preview-ready') {
      isIframeLoaded = true;
      updateRealTimePreview();
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
  const activeSubtab = urlParams.get('subtab');

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
    if (activeSubtab) {
      switchSubTab(activeSubtab);
    }
  } else if (activeService === 'trivia') {
    switchTab('trivia');
  } else if (activeService === 'capitanes') {
    switchTab('capitanes');
  } else {
    switchTab('mesas');
    if (activeSubtab) {
      switchSubTab(activeSubtab);
    }
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
      setButtonLoading(btnSavePhotosTitle, true, 'Guardando...');

      fetch(`/api/config?event=${encodeURIComponent(eventId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventTitle })
      })
        .then(res => res.json())
        .then(data => {
          setButtonLoading(btnSavePhotosTitle, false);
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
          setButtonLoading(btnSavePhotosTitle, false);
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
          setButtonLoading(btnClearPhotos, true, 'Limpiando...');
          fetch(`/api/admin/photos/clear?event=${encodeURIComponent(eventId)}`, {
            method: 'POST'
          })
            .then(res => res.json())
            .then(data => {
              setButtonLoading(btnClearPhotos, false);
              if (data.success) {
                showToast('Galería de fotos limpiada correctamente.', 'success');
                loadPhotos();
              } else {
                showToast('Error al limpiar la galería de fotos.', 'error');
              }
            })
            .catch(err => {
              setButtonLoading(btnClearPhotos, false);
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
  btnLogout.addEventListener('click', (e) => {
    if (isFormDirty) {
      e.preventDefault();
      showUnsavedChangesModal(
        () => {
          saveInvitationConfig();
          window.location.href = `/?event=${encodeURIComponent(eventId)}`;
        },
        () => {
          isFormDirty = false;
          window.location.href = `/?event=${encodeURIComponent(eventId)}`;
        },
        null
      );
      return;
    }
    window.location.href = `/?event=${encodeURIComponent(eventId)}`;
  });

  btnSaveTitle.addEventListener('click', () => {
    const eventTitle = eventTitleInput.value.trim();
    if (!eventTitle) {
      showToast('error', '¡Atención!', 'Por favor, ingresa un nombre para el evento.', 4000);
      return;
    }

    showToast('loading', '', 'Guardando cambios...');
    setButtonLoading(btnSaveTitle, true, 'Guardando...');

    fetch(`/api/config?event=${encodeURIComponent(eventId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventTitle })
    })
      .then(res => res.json())
      .then(data => {
        setButtonLoading(btnSaveTitle, false);
        if (data.success) {
          showToast('success', '¡Éxito!', 'Título del evento guardado correctamente.', 3000);
          printEventTitle.textContent = eventTitle;
        } else {
          showToast('error', 'Error', 'Error al guardar la configuración.', 4000);
        }
      })
      .catch(err => {
        setButtonLoading(btnSaveTitle, false);
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
    const modalPhone = document.getElementById('modal-phone');
    if (modalPhone) {
      modalPhone.value = '';
      modalPhone.classList.remove('input-highlight-pulse');
    }
    hideCustomDropdown();
    guestModal.classList.add('active');
  });

  const modalPhoneInput = document.getElementById('modal-phone');
  if (modalPhoneInput) {
    modalPhoneInput.addEventListener('input', () => {
      modalPhoneInput.classList.remove('input-highlight-pulse');
    });
  }

  btnCloseModal.addEventListener('click', () => {
    guestModal.classList.remove('active');
    if (modalPhoneInput) modalPhoneInput.classList.remove('input-highlight-pulse');
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
            if (invTimeEndInput && data.invitationEventTimeEnd) {
              invTimeEndInput.value = data.invitationEventTimeEnd;
            }

            const onboardingHeading = document.getElementById('onboarding-title-heading');
            if (onboardingHeading && data.eventTimeMode) {
              onboardingHeading.textContent = data.eventTimeMode === 'dia' ? '¡Todo listo para tu gran día!' : '¡Todo listo para tu gran noche!';
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
        if (invTemplate) {
          invTemplate.value = data.invitationTemplate || 'interactivo-3d';
          invTemplate.dispatchEvent(new Event('change'));
        }
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

        // Update WhatsApp support links in admin
        const supportPhone = (data && data.supportWhatsappNumber) ? data.supportWhatsappNumber : '5491122334455';
        const title = (data && data.eventTitle) ? data.eventTitle : 'miFiestAPP';
        const id = eventId || 'default';
        const rawTemplate = (data && data.supportWhatsappTemplate) ? data.supportWhatsappTemplate : '¡Hola miFiestAPP! 👋 Necesito soporte técnico / ayuda con mi evento: "{EVENT_TITLE}" (ID: {EVENT_ID}).';
        const msg = rawTemplate.replace(/\{EVENT_TITLE\}/g, title).replace(/\{EVENT_ID\}/g, id);
        const whatsappUrl = `https://wa.me/${supportPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`;

        const adminSupportBtn = document.getElementById('btn-admin-support-header');
        if (adminSupportBtn) adminSupportBtn.href = whatsappUrl;

        setTimeout(() => {
          initialFormState = captureFormState();
          isFormDirty = false;

          const invForm = document.getElementById('invitation-config-form');
          if (invForm && !invForm.dataset.dirtyListenersBound) {
            invForm.dataset.dirtyListenersBound = 'true';
            invForm.addEventListener('input', checkFormDirtyState);
            invForm.addEventListener('change', checkFormDirtyState);
          }
        }, 150);

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
          const isCapitanes = (activeService === 'capitanes');
          let serviceName = 'Control de Mesas';
          if (isPhotos) serviceName = 'Control de Fotos';
          if (isInvitation) serviceName = 'Invitación & RSVPs';
          if (isTrivia) serviceName = 'Control de Trivia';
          if (isCapitanes) serviceName = 'Capitanes de Mesa';
          
          if (headerTitle) {
            headerTitle.textContent = `${serviceName} • ${data.clientName}`;
          }
          let pageTitle = 'Control de Mesas';
          if (isPhotos) pageTitle = 'Moderación de Fotos';
          if (isInvitation) pageTitle = 'Invitación & RSVPs';
          if (isTrivia) pageTitle = 'Control de Trivia';
          if (isCapitanes) pageTitle = 'Capitanes de Mesa';
          document.title = `${pageTitle} | ${data.clientName}`;
        }
      })
      .catch(err => console.error('Error config:', err));
  }

  // Load Stats from API
  function loadStats(skipLayoutReload = false) {
    fetch(`/api/stats?event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(data => {
        if (statGuests) statGuests.textContent = data.guestCount || 0;
        if (statTables) statTables.textContent = data.tableCount || 0;
        
        // Deduplicate tables by formatted name to prevent duplicates
        const uniqueTablesMap = {};
        (data.tables || []).forEach(t => {
          const formattedName = formatTableDisplay(t.name);
          if (!uniqueTablesMap[formattedName]) {
            uniqueTablesMap[formattedName] = { ...t, name: formattedName };
          } else {
            uniqueTablesMap[formattedName].count = Math.max(uniqueTablesMap[formattedName].count || 0, t.count || 0);
            uniqueTablesMap[formattedName].totalCount = Math.max(uniqueTablesMap[formattedName].totalCount || 0, t.totalCount || 0);
          }
        });

        // Also ensure Mesa Principal is included if placed on canvas
        const hasMesaPrincipalLandmark = (hallCanvasItems || []).some(i => i.type === 'mesa_principal' || i.name === 'Mesa Principal');
        if (hasMesaPrincipalLandmark && !uniqueTablesMap['Mesa Principal']) {
          uniqueTablesMap['Mesa Principal'] = { name: 'Mesa Principal', capacity: 10, count: 0, totalCount: 0 };
        }

        allTables = Object.values(uniqueTablesMap).sort((a, b) => {
          if (a.name.toLowerCase().includes('principal')) return -1;
          if (b.name.toLowerCase().includes('principal')) return 1;
          const numA = parseInt(a.name.replace(/\D/g, ''), 10);
          const numB = parseInt(b.name.replace(/\D/g, ''), 10);
          if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
          return a.name.localeCompare(b.name);
        });

        renderTablesList(allTables);
        renderHallTablesGrid();
        updateTablesDatalist();
        if (!skipLayoutReload) {
          loadHallLayout();
        }

        // Re-render capitanes quests to sync tables data
        if (tabCapitanes && tabCapitanes.classList.contains('active')) {
          renderConfigQuests();
        }
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
        renderHallTablesGrid();

        // Re-render capitanes quests to sync guest data
        if (tabCapitanes && tabCapitanes.classList.contains('active')) {
          renderConfigQuests();
        }
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

    if (dropdown.classList.contains('active')) {
      renderCustomDropdown(modalTable.value);
    }
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
    updateTablesDatalist();
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
    if (t.toLowerCase() === 'mesa principal' || t.toLowerCase() === 'principal') return 'Mesa Principal';
    if (/^mesa\b/i.test(t)) {
      return t.replace(/^mesa\s*/i, 'Mesa ');
    }
    return t;
  }

  // Render guest list table (with search filtering)
  function renderGuestsTable() {
    if (!guestsTableBody) return;
    const filter = adminGuestSearch ? adminGuestSearch.value.trim().toLowerCase() : '';

    const filteredGuests = allGuests.map((g, index) => ({ ...g, originalIndex: index }))
      .filter(g => {
        const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
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

    setTimeout(() => {
      updateTableScrollHint('guests-table-wrapper', 'guests-scroll-hint');
    }, 50);
  }

  function updateTableScrollHint(wrapperId, hintId, guestCount) {
    const wrapper = document.getElementById(wrapperId);
    const hint = document.getElementById(hintId);
    if (!wrapper || !hint) return;

    let count = guestCount;
    if (count === undefined || count === null) {
      const rows = wrapper.querySelectorAll('tbody tr');
      count = rows.length;
    }

    let hasMoreScroll = false;
    if (wrapper.clientHeight > 0) {
      hasMoreScroll = (wrapper.scrollHeight - wrapper.scrollTop - wrapper.clientHeight) > 15;
    } else if (count > 5) {
      hasMoreScroll = true;
    }

    if (hasMoreScroll) {
      hint.classList.add('visible');
    } else {
      hint.classList.remove('visible');
    }
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
    const listEl = document.getElementById('tables-breakdown-list') || tablesBreakdownList;
    if (!listEl) return;
    if (!tables || !Array.isArray(tables) || tables.length === 0) {
      listEl.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          No hay datos de mesas disponibles.
        </div>
      `;
      return;
    }

    listEl.innerHTML = tables.map(t => {
      // Find all guests assigned to this table
      const guestsInTable = allGuests.filter(g => formatTableDisplay(g.table).trim().toLowerCase() === formatTableDisplay(t.name).trim().toLowerCase());
      
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


  function saveGuestForm() {
    const idx = guestIndexInput.value;
    const modalPhone = document.getElementById('modal-phone');
    const guestData = {
      firstName: modalFirstName.value.trim(),
      lastName: modalLastName.value.trim(),
      table: modalTable.value.trim(),
      phone: modalPhone ? modalPhone.value.trim() : ''
    };

    const isEdit = idx !== '';
    const url = isEdit ? `/api/guests/${idx}?event=${encodeURIComponent(eventId)}` : `/api/guests?event=${encodeURIComponent(eventId)}`;
    const method = isEdit ? 'PUT' : 'POST';

    setButtonLoading(btnSaveGuest, true, 'Guardando...');

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(guestData)
    })
      .then(res => res.json())
      .then(data => {
        setButtonLoading(btnSaveGuest, false);
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
        setButtonLoading(btnSaveGuest, false);
        console.error(err);
        showToast('Error de red al intentar guardar.', 'error');
      });
  }

  function normalizeWhatsAppNumber(phone) {
    if (!phone) return '';
    let str = String(phone).trim();
    let cleaned = str.replace(/\D/g, '');
    if (!cleaned) return '';

    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    if (cleaned.length === 10 && !cleaned.startsWith('54')) {
      cleaned = '549' + cleaned;
    } else if (!cleaned.startsWith('54') && cleaned.length < 12) {
      cleaned = '549' + cleaned;
    }

    return cleaned;
  }

  function buildWhatsAppInvitationMessage(guestName, personalUrl) {
    const greeting = guestName ? `✨ ¡Hola ${guestName}! 👋` : `✨ ¡Hola! 👋`;
    return `${greeting}

Hay momentos que se sueñan durante mucho tiempo, y finalmente llegó el mío.

Con enorme alegría quiero invitarte a celebrar mis XV años, una noche que quedará para siempre en mi corazón y que deseo compartir junto a las personas que forman parte de mi vida.

En el siguiente enlace vas a encontrar toda la información de este día tan especial:

🔗 ${personalUrl}

Tu presencia hará que esta celebración sea aún más significativa.

💖 Te espero para vivir juntos una noche inolvidable.`;
  }

  window.sendWhatsAppInvite = (index) => {
    const guest = allGuests[index];
    if (!guest) return;

    if (!guest.phone || !guest.phone.trim()) {
      showToast('warning', '¡Sin Teléfono Asignado!', 'Este invitado no tiene un número de teléfono registrado. Ingresá el número a continuación para enviarle su invitación por WhatsApp.', 5000);
      window.openEditGuestModal(index, 'phone');
      return;
    }

    const normalizedPhone = normalizeWhatsAppNumber(guest.phone);
    if (!normalizedPhone) {
      showToast('error', '¡Teléfono Inválido!', 'El número de teléfono cargado no posee un formato válido. Editá el invitado para corregirlo.', 5000);
      window.openEditGuestModal(index, 'phone');
      return;
    }

    const currentOrigin = window.location.origin;
    const personalUrl = `${currentOrigin}/invitacion.html?event=${encodeURIComponent(eventId)}&n=${encodeURIComponent(guest.firstName + ' ' + guest.lastName)}`;
    const text = buildWhatsAppInvitationMessage(`${guest.firstName} ${guest.lastName}`, personalUrl);
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const baseUrl = isMobile ? 'https://api.whatsapp.com/send' : 'https://web.whatsapp.com/send';
    const waUrl = `${baseUrl}?phone=${normalizedPhone}&text=${encodeURIComponent(text)}`;

    window.open(waUrl, '_blank');
  };

  // Expose CRUD helper triggers to window since table templates use them inline
  window.openEditGuestModal = (index, highlightField) => {
    const guest = allGuests[index];
    modalTitle.textContent = 'Editar Invitado';
    guestIndexInput.value = index;
    modalFirstName.value = guest.firstName;
    modalLastName.value = guest.lastName;
    modalTable.value = guest.table;
    const modalPhone = document.getElementById('modal-phone');
    if (modalPhone) {
      modalPhone.value = guest.phone || '';
      modalPhone.classList.remove('input-highlight-pulse');
    }
    hideCustomDropdown();
    guestModal.classList.add('active');

    if (highlightField === 'phone' && modalPhone) {
      setTimeout(() => {
        modalPhone.classList.add('input-highlight-pulse');
        modalPhone.focus();
        modalPhone.select();
      }, 150);
    }
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

  // Onboarding Welcome Floating Modal logic
  const onboardingContainer = document.getElementById('onboarding-modal-container');
  const btnCloseOnboarding = document.getElementById('btn-close-onboarding');
  const btnOnboardingPrev = document.getElementById('btn-onboarding-prev');
  const btnOnboardingNext = document.getElementById('btn-onboarding-next');
  const btnToggleGuide = document.getElementById('btn-toggle-guide');
  const onboardingSlides = document.querySelectorAll('.onboarding-slide');
  const onboardingIndicators = document.querySelectorAll('.onboarding-indicators .indicator');

  let currentSlideIndex = 0;
  const totalSlides = onboardingSlides.length;

  function showSlide(index) {
    if (index < 0 || index >= totalSlides) return;
    currentSlideIndex = index;

    // Show/Hide slides
    onboardingSlides.forEach((slide, i) => {
      if (i === currentSlideIndex) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });

    // Update indicators
    onboardingIndicators.forEach((ind, i) => {
      if (i === currentSlideIndex) {
        ind.classList.add('active');
      } else {
        ind.classList.remove('active');
      }
    });

    // Navigation button text/visibility
    if (currentSlideIndex === 0) {
      btnOnboardingPrev.style.visibility = 'hidden';
    } else {
      btnOnboardingPrev.style.visibility = 'visible';
    }

    if (currentSlideIndex === totalSlides - 1) {
      btnOnboardingNext.textContent = 'Comenzar';
    } else {
      btnOnboardingNext.textContent = 'Siguiente';
    }
  }

  function openOnboarding() {
    showSlide(0);
    if (onboardingContainer) {
      onboardingContainer.style.display = 'flex';
      // Force reflow
      onboardingContainer.offsetHeight;
      onboardingContainer.classList.add('active');
    }
  }

  function closeOnboarding() {
    if (onboardingContainer) {
      onboardingContainer.classList.remove('active');
      setTimeout(() => {
        onboardingContainer.style.display = 'none';
      }, 400);
    }
  }

  function dismissOnboardingPermanently() {
    closeOnboarding();
    localStorage.setItem(`onboarding_dismissed_${eventId}`, 'true');
  }

  if (onboardingContainer) {
    // Show modal if not dismissed before
    if (!localStorage.getItem(`onboarding_dismissed_${eventId}`)) {
      setTimeout(() => {
        openOnboarding();
      }, 500); // smooth delay after load
    }

    // Dismiss handlers
    if (btnCloseOnboarding) {
      btnCloseOnboarding.addEventListener('click', dismissOnboardingPermanently);
    }

    // Prev / Next button handlers
    if (btnOnboardingPrev) {
      btnOnboardingPrev.addEventListener('click', () => {
        showSlide(currentSlideIndex - 1);
      });
    }

    if (btnOnboardingNext) {
      btnOnboardingNext.addEventListener('click', () => {
        if (currentSlideIndex === totalSlides - 1) {
          dismissOnboardingPermanently();
        } else {
          showSlide(currentSlideIndex + 1);
        }
      });
    }

    // Indicators click
    onboardingIndicators.forEach((ind, i) => {
      ind.addEventListener('click', () => {
        showSlide(i);
      });
    });

    // Header Help button trigger
    if (btnToggleGuide) {
      btnToggleGuide.addEventListener('click', (e) => {
        e.preventDefault();
        openOnboarding();
      });
    }
  }

  // --- Phase 3: Invitation & RSVP Management Logic ---
  
  function saveInvitationConfig(e) {
    showToast('loading', '', 'Guardando cambios en tu invitación...');

    const saveBtns = document.querySelectorAll('.btn-save-invitation-config');
    saveBtns.forEach(btn => setButtonLoading(btn, true, 'Guardando...'));

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
      invitationEventTimeEnd: invTimeEndInput ? invTimeEndInput.value.trim() : '',
      invitationMusicUrl: invMusicInput ? invMusicInput.value.trim() : '',
      invitationPartyAddress: invAddressInput ? invAddressInput.value.trim() : '',
      invitationPartyMapsUrl: invMapsInput ? invMapsInput.value.trim() : '',
      invitationCbu: invCbuInput ? invCbuInput.value.trim() : '',
      invitationAlias: invAliasInput ? invAliasInput.value.trim() : '',
      invitationBankHolder: invBankHolderInput ? invBankHolderInput.value.trim() : '',
      invitationDressCode: invDressInput ? invDressInput.value.trim() : '',
      invitationTemplate: invTemplate ? invTemplate.value : 'interactivo-3d',
      invitationThemeFont: invThemeFont ? invThemeFont.value : 'classic-editorial',
      invitationThemeColor: invThemeColor ? invThemeColor.value : 'golden-luxury',
      invitationBgEffect: invBgEffect ? invBgEffect.value : 'golden-dust',
      invitationWaxSealDesign: invWaxSeal ? invWaxSeal.value : 'rings',
      invitationBgUrl: invBgUrl ? invBgUrl.value.trim() : '',
      invitationPhoto1: invPhoto1 ? invPhoto1.value.trim() : '',
      invitationPhoto2: invPhoto2 ? invPhoto2.value.trim() : '',
      invitationPhoto3: invPhoto3 ? invPhoto3.value.trim() : '',
      invitationPhoto4: invPhoto4 ? invPhoto4.value.trim() : '',
      invitationPhoto5: invPhoto5 ? invPhoto5.value.trim() : ''
    };

    if (!payload.eventTitle) {
      saveBtns.forEach(btn => setButtonLoading(btn, false));
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
      saveBtns.forEach(btn => setButtonLoading(btn, false));
      if (data.success) {
        showToast('success', '¡Éxito!', 'Configuración de la invitación guardada correctamente!', 3000);
        
        // Propagate event title updates to other tabs/inputs
        const eventTitleInput = document.getElementById('event-title-input');
        const eventTitlePhotosInput = document.getElementById('event-title-photos-input');
        if (eventTitleInput) eventTitleInput.value = payload.eventTitle;
        if (eventTitlePhotosInput) eventTitlePhotosInput.value = payload.eventTitle;
        if (printEventTitle) printEventTitle.textContent = payload.eventTitle;

        setTimeout(() => {
          initialFormState = captureFormState();
          clearDirtyHighlights();
          isFormDirty = false;
        }, 100);
      } else {
        showToast('error', 'Error', data.error || 'Error al guardar la configuración.', 4000);
      }
    })
    .catch(err => {
      saveBtns.forEach(btn => setButtonLoading(btn, false));
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
      
      const countComp = parseInt(rsvp.companionsCount, 10) || 0;
      let compNamesList = [];
      if (Array.isArray(rsvp.companionsNames)) {
        compNamesList = rsvp.companionsNames.filter(n => n && typeof n === 'string' && n.trim());
      } else if (typeof rsvp.companionsNames === 'string' && rsvp.companionsNames.trim()) {
        compNamesList = rsvp.companionsNames.split(',').map(n => n.trim()).filter(Boolean);
      }

      let companionsText = `<span style="color: var(--text-muted);">-</span>`;
      if (countComp > 0) {
        if (compNamesList.length > 0) {
          const subitems = compNamesList.map((cName, idx) => {
            const connector = (idx === compNamesList.length - 1) ? '└─' : '├─';
            return `
              <div class="rsvp-companion-subitem" style="display: flex; align-items: center; gap: 6px; font-size: 0.76rem; color: #d4af37; margin-top: 4px; font-weight: 500;">
                <span style="opacity: 0.5; font-family: monospace; font-size: 0.85rem; color: var(--gold-primary);">${connector}</span>
                <span>👤 ${cName}</span>
              </div>
            `;
          }).join('');
          companionsText = `<div><span style="font-size: 0.72rem; color: var(--gold-primary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${countComp} ${countComp === 1 ? 'Acompañante' : 'Acompañantes'}</span>${subitems}</div>`;
        } else {
          companionsText = `<span style="color: #d4af37; font-weight: 600; font-size: 0.78rem;">${countComp} ${countComp === 1 ? 'Acompañante' : 'Acompañantes'}</span>`;
        }
      }
      
      const dietText = rsvp.dietaryRestrictions && rsvp.dietaryRestrictions !== 'Ninguno'
        ? `<span style="color: #f3e5ab; font-weight: 500;">${rsvp.dietaryRestrictions}</span>`
        : `<span style="color: var(--text-muted);">-</span>`;

      const isPublicQr = rsvp.source === 'public_qr';
      let sourceBadge = `<span style="display: inline-block; font-size: 0.62rem; background: rgba(212, 175, 55, 0.15); border: 1px solid rgba(212, 175, 55, 0.4); color: var(--gold-light); padding: 2px 6px; border-radius: 10px; margin-left: 6px; font-weight: 600;">👤 Individual</span>`;
      if (countComp > 0) {
        sourceBadge = `<span style="display: inline-block; font-size: 0.62rem; background: rgba(212, 175, 55, 0.2); border: 1px solid rgba(212, 175, 55, 0.5); color: #ffd700; padding: 2px 6px; border-radius: 10px; margin-left: 6px; font-weight: 600;">👥 +${countComp} ${countComp === 1 ? 'Acompañante' : 'Acompañantes'}</span>`;
      } else if (isPublicQr) {
        sourceBadge = `<span style="display: inline-block; font-size: 0.62rem; background: rgba(37, 211, 102, 0.15); border: 1px solid rgba(37, 211, 102, 0.4); color: #25D366; padding: 2px 6px; border-radius: 10px; margin-left: 6px; font-weight: 600;">🌐 QR Público</span>`;
      }

      const phoneText = rsvp.phone 
        ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">📱 ${rsvp.phone}</div>`
        : '';

      return `
        <tr data-id="${rsvp.id}">
          <td style="padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.03); color: white;">
            <div><strong>${rsvp.name}</strong>${sourceBadge}</div>
            ${phoneText}
          </td>
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

    const btnCopyPublicQr = document.getElementById('btn-copy-public-qr-link');
    if (btnCopyPublicQr) {
      btnCopyPublicQr.addEventListener('click', () => {
        const publicUrl = `${window.location.origin}/invitacion.html?event=${encodeURIComponent(eventId)}&mode=public`;
        navigator.clipboard.writeText(publicUrl).then(() => {
          showToast('📋 Enlace QR Genérico copiado al portapapeles', 'success');
        }).catch(() => {
          showToast('📋 Enlace: ' + publicUrl, 'info');
        });
      });
    }

  function preparePrintPoster(serviceType) {
    document.body.classList.add('print-mode-single');
    document.body.classList.remove('print-mode-multi-tables');

    const isPhotos = (serviceType === 'photos');
    const isInvitation = (serviceType === 'invitation');
    const isCapitanes = (serviceType === 'capitanes');
    
    let targetPath = '/mesas';
    if (isPhotos) targetPath = '/fotos';
    if (isInvitation) targetPath = '/invitacion.html';
    if (isCapitanes) targetPath = '/capitanes-client.html';
    
    const targetUrl = `${siteOrigin}${targetPath}?event=${encodeURIComponent(eventId)}`;
    const printQrUrl = `${qrBaseUrl}?size=500x500&data=${encodeURIComponent(targetUrl)}&color=000000&bgcolor=ffffff`;

    if (printQrImg) {
      printQrImg.src = printQrUrl;
    }

    const titleInput = document.getElementById('event-title-input');
    const subtitleInput = document.getElementById('qr-poster-subtitle-input');
    const customTitle = titleInput ? titleInput.value.trim() : '';
    const customSubtitle = subtitleInput ? subtitleInput.value.trim() : '';

    const printTitle = document.getElementById('print-event-title');
    const printSubtitle = document.querySelector('.print-subtitle');
    const printInstructions = document.querySelector('.print-instructions');

    if (printTitle) {
      printTitle.textContent = customTitle || (isPhotos ? 'Muro de Fotos' : (isInvitation ? 'Invitación Interactiva' : (isCapitanes ? 'Capitanes de Mesa' : 'Ubicación de Mesas')));
    }
    if (printSubtitle) {
      printSubtitle.textContent = customSubtitle || (isPhotos ? 'Comparte tus Momentos' : (isInvitation ? 'Accede a la Invitación' : (isCapitanes ? 'Competencia de Mesas' : 'Encuentra tu Mesa')));
    }
    if (printInstructions) {
      printInstructions.innerHTML = isPhotos 
        ? 'Escanéa este código con la cámara de tu celular<br>para subir fotos y mensajes al muro.'
        : (isInvitation 
           ? 'Escanéa este código con la cámara de tu celular<br>para abrir la invitación interactiva y confirmar asistencia.'
           : (isCapitanes 
              ? 'Escanéa este código con la cámara de tu celular<br>para ingresar a la competencia de Capitanes.'
              : 'Escanéa este código con la cámara de tu celular<br>para consultar tu mesa asignada.'));
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

  if (invTimeEndInput) {
    invTimeEndInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9:]/g, '');
      if (val.length === 4 && !val.includes(':')) {
        val = val.substring(0, 2) + ':' + val.substring(2);
      }
      e.target.value = val;
    });

    invTimeEndInput.addEventListener('blur', (e) => {
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
        e.target.value = '';
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
      invTemplate: invTemplate ? invTemplate.value : 'interactivo-3d',
      invThemeColor: invThemeColor ? invThemeColor.value : 'golden-luxury',
      invThemeFont: invThemeFont ? invThemeFont.value : 'classic-editorial',
      invWaxSeal: invWaxSeal ? invWaxSeal.value : 'rings',
      invBgEffect: invBgEffect ? invBgEffect.value : 'none',
      invBgUrl: invBgUrl ? invBgUrl.value.trim() : '',
      invPhoto1: invPhoto1 ? invPhoto1.value.trim() : '',
      invPhoto2: invPhoto2 ? invPhoto2.value.trim() : '',
      invPhoto3: invPhoto3 ? invPhoto3.value.trim() : '',
      invPhoto4: invPhoto4 ? invPhoto4.value.trim() : '',
      invPhoto5: invPhoto5 ? invPhoto5.value.trim() : '',
      title: invTitleInput ? invTitleInput.value.trim() : '',
      date: invDateOnlyInput ? invDateOnlyInput.value.trim() : '',
      time: invTimeOnlyInput ? invTimeOnlyInput.value.trim() : '21:00',
      timeEnd: invTimeEndInput ? invTimeEndInput.value.trim() : ''
    };

    previewIframe.contentWindow.postMessage({
      type: 'invitation-preview-update',
      config: configPayload
    }, '*');
  }

  // --- Real-time preview input listeners ---
  const inputsToListen = [
    invTemplate, invThemeFont, invThemeColor, invBgEffect, invWaxSeal,
    invBgUrl, invTitleInput, invDateOnlyInput, invTimeOnlyInput, invTimeEndInput,
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
  ['inv-theme-font', 'inv-theme-color', 'inv-bg-effect', 'inv-wax-seal', 'trivia-enabled-toggle', 'capitanes-mode-select'].forEach(id => {
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

  const btnExportMenus = document.getElementById('btn-export-menus');
  if (btnExportMenus) {
    btnExportMenus.addEventListener('click', () => {
      window.location.href = `/api/admin/export-menus?event=${encodeURIComponent(eventId)}`;
    });
  }

  const btnExportDjSongs = document.getElementById('btn-export-dj-songs');
  if (btnExportDjSongs) {
    btnExportDjSongs.addEventListener('click', () => {
      window.location.href = `/api/admin/export-dj-songs?event=${encodeURIComponent(eventId)}`;
    });
  }

  if (btnAddGuestInvitados) {
    btnAddGuestInvitados.addEventListener('click', () => {
      modalTitle.textContent = 'Agregar Invitado';
      guestIndexInput.value = '';
      modalFirstName.value = '';
      modalLastName.value = '';
      modalTable.value = '';
      const modalPhone = document.getElementById('modal-phone');
      if (modalPhone) modalPhone.value = '';
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
          setButtonLoading(btnClearDbInvitados, true, 'Limpiando...');
          fetch(`/api/clear?event=${encodeURIComponent(eventId)}`, { method: 'POST' })
            .then(res => res.json())
            .then(data => {
              setButtonLoading(btnClearDbInvitados, false);
              if (data.success) {
                showToast('success', '¡Éxito!', 'Base de datos de invitados limpiada correctamente.', 3000);
                loadStats();
                loadGuests();
              } else {
                showToast('error', 'Error', 'Error al limpiar la base de datos.', 4000);
              }
            })
            .catch(err => {
              setButtonLoading(btnClearDbInvitados, false);
              console.error('Error clearing database:', err);
              showToast('error', 'Error', 'Error de conexión con el servidor.', 4000);
            });
        }
      );
    });
  }

  function normalizeName(str) {
    if (!str) return '';
    return str
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function getUnifiedInvitadosList() {
    const unified = [];
    const matchedRsvpIds = new Set();

    // 1. Pre-registered guests
    allGuests.forEach((g, index) => {
      const first = (g.firstName || '').trim();
      const last = (g.lastName || '').trim();
      const fullGuestName = `${first} ${last}`.trim();
      const normGuestName = normalizeName(fullGuestName);
      const cleanGuestPhone = (g.phone || '').replace(/[^0-9]/g, '');

      let rsvp = allRsvps.find(r => {
        if (matchedRsvpIds.has(r.id)) return false;
        const normRsvpName = normalizeName(r.name);
        if (normRsvpName === normGuestName) return true;

        // Partial match check
        if (normGuestName && normRsvpName && (normRsvpName.includes(normGuestName) || normGuestName.includes(normRsvpName))) {
          return true;
        }

        // Clean phone match
        const cleanRsvpPhone = (r.phone || '').replace(/[^0-9]/g, '');
        if (cleanGuestPhone && cleanRsvpPhone && cleanGuestPhone.length >= 6 && cleanGuestPhone === cleanRsvpPhone) {
          return true;
        }

        return false;
      });

      if (rsvp) {
        matchedRsvpIds.add(rsvp.id);
      }

      let status = 'pending';
      if (rsvp) {
        status = rsvp.attending ? 'confirmed' : 'declined';
      }

      unified.push({
        ...g,
        firstName: first || fullGuestName || 'Invitado',
        lastName: last || '',
        originalIndex: index,
        isPreRegistered: true,
        displayName: fullGuestName || 'Invitado Sin Nombre',
        rsvp: rsvp || null,
        status: status
      });
    });

    // 2. Un-matched RSVPs (e.g. autoconfirmed via generic QR link)
    allRsvps.forEach(r => {
      if (matchedRsvpIds.has(r.id)) return;

      const normRsvpName = normalizeName(r.name);
      const exists = unified.some(u => normalizeName(u.displayName) === normRsvpName);
      if (exists) return;

      const status = r.attending ? 'confirmed' : 'declined';
      const nameParts = (r.name || 'Invitado QR').trim().split(' ');
      const fName = nameParts[0] || 'Invitado';
      const lName = nameParts.slice(1).join(' ') || '(QR Autoconfirmado)';

      unified.push({
        firstName: fName,
        lastName: lName,
        table: r.table || 'Sin Mesa',
        phone: r.phone || '',
        originalIndex: -1,
        isPreRegistered: false,
        displayName: r.name || 'Invitado QR',
        rsvp: r,
        status: status
      });
    });

    return unified;
  }

  function updateInvitadosFilterCounts() {
    const list = getUnifiedInvitadosList();
    let allCount = list.length;
    let confirmedCount = list.filter(item => item.status === 'confirmed').length;
    let pendingCount = list.filter(item => item.status === 'pending').length;
    let declinedCount = list.filter(item => item.status === 'declined').length;

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

    updateInvitadosFilterCounts();

    const searchFilter = invitadosGuestSearch ? invitadosGuestSearch.value.trim().toLowerCase() : '';
    const unifiedList = getUnifiedInvitadosList();

    const filteredGuests = unifiedList.filter(g => {
      if (activeInvitadosStatusFilter !== 'all' && g.status !== activeInvitadosStatusFilter) {
        return false;
      }
      const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
      const table = String(g.table).toLowerCase();
      return fullName.includes(searchFilter) || table.includes(searchFilter);
    });

    if (filteredGuests.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 30px;">
            ${unifiedList.length === 0 ? 'No hay invitados registrados en la base de datos.' : 'No se encontraron coincidencias.'}
          </td>
        </tr>
      `;
      return;
    }

    const currentOrigin = window.location.origin;
    tableBody.innerHTML = filteredGuests.map(g => {
      const personalUrl = `${currentOrigin}/invitacion.html?event=${encodeURIComponent(eventId)}&n=${encodeURIComponent(g.firstName + ' ' + g.lastName)}`;
      const rsvp = g.rsvp;
      const status = g.status;
      let rowClass = 'row-pending';
      if (status === 'confirmed') rowClass = 'row-confirmed';
      if (status === 'declined') rowClass = 'row-declined';

      let rsvpStatusHtml = `
        <select class="select-rsvp-status" 
                data-guest-name="${escapeHtml(g.firstName + ' ' + g.lastName)}"
                data-rsvp-id="${rsvp ? rsvp.id : ''}"
                onchange="onGuestRsvpSelectChange(this)">
          <option value="pending" ${status === 'pending' ? 'selected' : ''}>⏳ Pendiente</option>
          <option value="confirmed" ${status === 'confirmed' ? 'selected' : ''}>✅ Asistirá</option>
          <option value="declined" ${status === 'declined' ? 'selected' : ''}>❌ No Asistirá</option>
        </select>
      `;

      const sourceBadge = (!g.isPreRegistered) 
        ? `<span style="font-size: 0.65rem; background: rgba(212,175,55,0.15); border: 1px solid var(--border-gold); color: var(--gold-light); padding: 2px 6px; border-radius: 8px; margin-left: 6px;">📲 QR / Genérico</span>` 
        : '';

      const actionsHtml = g.isPreRegistered ? `
        <button class="btn-action edit" onclick="openEditGuestModal(${g.originalIndex})">Editar</button>
        <button class="btn-action whatsapp" title="${g.phone ? 'Enviar Invitación por WhatsApp (' + escapeHtml(g.phone) + ')' : 'Sin teléfono (haz clic para agregar)'}" onclick="sendWhatsAppInvite(${g.originalIndex})">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.842-1.001zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
          WhatsApp
        </button>
        <button class="btn-action edit" style="border-color: var(--gold-primary); color: var(--gold-primary);" onclick="copyGuestUrl(${g.originalIndex}, this)">Copiar</button>
        <button class="btn-action delete" onclick="confirmDeleteGuest(${g.originalIndex})">Eliminar</button>
      ` : `
        <button class="btn-action delete" onclick="deleteRsvpById('${rsvp ? rsvp.id : ''}')">Eliminar</button>
      `;

      return `
        <tr class="${rowClass}">
          <td style="color: var(--text-main); font-weight: 500;">${escapeHtml(g.firstName)} ${sourceBadge}</td>
          <td style="color: var(--text-main); font-weight: 500;">${escapeHtml(g.lastName)}</td>
          <td style="color: var(--gold-primary); font-weight: 600;">${formatTableDisplay(g.table)}</td>
          <td style="text-align: center; vertical-align: middle;">${rsvpStatusHtml}</td>
          <td>
            <div style="display: flex; gap: 8px; align-items: center; width: 100%; max-width: 180px;">
              <input type="text" readonly value="${personalUrl}" class="form-control-admin" style="padding: 6px 12px; font-size: 0.7rem; border-radius: 12px; width: 100%; min-width: 0; border: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2); text-overflow: ellipsis; white-space: nowrap; overflow: hidden; pointer-events: none;">
            </div>
          </td>
          <td style="text-align: center; vertical-align: middle;">
            <div style="display: flex; justify-content: center; gap: 6px; flex-wrap: nowrap;">
              ${actionsHtml}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    setTimeout(() => {
      updateTableScrollHint('invitados-table-wrapper', 'invitados-scroll-hint', filteredGuests.length);
    }, 50);
  }

  // Attach scroll & resize observers to table wrappers for automatic real-time hint updates
  const wrapperInvitados = document.getElementById('invitados-table-wrapper');
  if (wrapperInvitados) {
    wrapperInvitados.addEventListener('scroll', () => {
      updateTableScrollHint('invitados-table-wrapper', 'invitados-scroll-hint');
    });
  }

  const wrapperGuests = document.getElementById('guests-table-wrapper');
  if (wrapperGuests) {
    wrapperGuests.addEventListener('scroll', () => {
      updateTableScrollHint('guests-table-wrapper', 'guests-scroll-hint');
    });
  }

  if (typeof ResizeObserver !== 'undefined') {
    const tableResizeObserver = new ResizeObserver(() => {
      updateTableScrollHint('invitados-table-wrapper', 'invitados-scroll-hint');
      updateTableScrollHint('guests-table-wrapper', 'guests-scroll-hint');
    });
    if (wrapperInvitados) tableResizeObserver.observe(wrapperInvitados);
    if (wrapperGuests) tableResizeObserver.observe(wrapperGuests);
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

  window.onGuestRsvpSelectChange = function(selectElem) {
    if (!selectElem) return;
    const guestName = selectElem.getAttribute('data-guest-name');
    const rsvpId = selectElem.getAttribute('data-rsvp-id');
    const newValue = selectElem.value;
    updateGuestRsvpStatus(guestName, rsvpId, newValue);
  };

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

      setButtonLoading(btnSaveTriviaQuestions, true, 'Guardando...');

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
      } finally {
        setButtonLoading(btnSaveTriviaQuestions, false);
      }
    });
  }

  // Console control actions
  async function triggerTriviaAction(actionName, clickedBtn) {
    if (clickedBtn) setButtonLoading(clickedBtn, true);
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
    } finally {
      if (clickedBtn) setButtonLoading(clickedBtn, false);
    }
  }

  function startTriviaPolling() {
    if (triviaEventSource) triviaEventSource.close();
    
    lastTriviaSseTime = Date.now();
    triviaEventSource = new EventSource(`/api/trivia/stream?event=${encodeURIComponent(eventId)}&role=admin`);
    
    triviaEventSource.onmessage = (e) => {
      lastTriviaSseTime = Date.now();
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
      console.warn('SSE Error/Disconnect, waiting for fallback polling...');
    };

    if (!adminTriviaPollInterval) {
      adminTriviaPollInterval = setInterval(() => {
        const silenceDuration = Date.now() - lastTriviaSseTime;
        if (silenceDuration > 5000) {
          console.log('Admin SSE silent for 5s. Running fallback state poll.');
          syncAdminTriviaStateWithPoll();
        }
      }, 3000);
    }
  }
  window.startTriviaPolling = startTriviaPolling;

  function syncAdminTriviaStateWithPoll() {
    if (window.isAdminPolling) return;
    window.isAdminPolling = true;

    fetch(`/api/trivia/state?event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(data => {
        window.isAdminPolling = false;
        if (data.success && data.state) {
          lastTriviaSseTime = Date.now();
          renderAdminTriviaState(data.state);
        }
      })
      .catch(err => {
        window.isAdminPolling = false;
        console.error('Error syncing admin state via poll:', err);
      });
  }

  function stopTriviaPolling() {
    if (triviaEventSource) {
      triviaEventSource.close();
      triviaEventSource = null;
    }
    if (adminTriviaPollInterval) {
      clearInterval(adminTriviaPollInterval);
      adminTriviaPollInterval = null;
    }
  }
  window.stopTriviaPolling = stopTriviaPolling;

  function renderAdminTriviaState(state) {
    // Update autoMode slider UI
    const checkAuto = document.getElementById('check-admin-trivia-auto');
    const sliderAuto = document.getElementById('slider-admin-trivia-auto');
    const durationContainer = document.getElementById('container-admin-trivia-timer-duration');
    const inputDuration = document.getElementById('input-admin-trivia-duration');

    if (checkAuto) {
      checkAuto.checked = state.autoMode;
      if (sliderAuto) {
        const circle = sliderAuto.querySelector('span');
        if (state.autoMode) {
          sliderAuto.style.backgroundColor = 'var(--gold-primary)';
          sliderAuto.style.borderColor = 'var(--gold-primary)';
          circle.style.backgroundColor = '#0b0b0c';
          circle.style.transform = 'translateX(24px)';
        } else {
          sliderAuto.style.backgroundColor = 'rgba(255,255,255,0.15)';
          sliderAuto.style.borderColor = 'rgba(212, 175, 55, 0.4)';
          circle.style.backgroundColor = 'var(--text-muted)';
          circle.style.transform = 'translateX(0)';
        }
      }
      if (durationContainer) {
        // En el modo simplificado, el timer siempre está visible
        durationContainer.classList.add('visible');
      }
      if (inputDuration && state.customDuration && !inputDuration.matches(':focus')) {
        inputDuration.value = state.customDuration;
      }
    }

    const badge = document.getElementById('admin-trivia-status-badge');
    if (badge) {
      badge.textContent = state.status;
      if (state.status === 'LOBBY') {
        badge.style.background = '#4da6ff';
        badge.style.color = '#fff';
      } else if (state.status === 'COUNTDOWN') {
        badge.style.background = '#e74c3c';
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
      } else if (state.status === 'COUNTDOWN') {
        qIndexEl.textContent = 'Cuenta regresiva inicial...';
      } else if (state.status === 'PODIUM') {
        qIndexEl.textContent = 'Juego Terminado (Podio)';
      } else {
        const total = state.totalQuestions || 0;
        const current = (state.currentQuestionIndex !== undefined) ? (state.currentQuestionIndex + 1) : '-';
        qIndexEl.textContent = `Pregunta ${current} de ${total}`;
      }
    }

    // Actualizar el estado visual de los tres botones de juego
    const btnPlay = document.getElementById('btn-admin-trivia-play');
    const btnStop = document.getElementById('btn-admin-trivia-stop');
    const btnReset = document.getElementById('btn-admin-trivia-reset');

    if (btnPlay && btnStop && btnReset) {
      // Defaults
      btnPlay.disabled = false;
      btnPlay.style.opacity = '1';
      btnPlay.style.pointerEvents = 'auto';
      btnPlay.style.background = 'var(--gold-primary)';
      btnPlay.style.borderColor = 'var(--gold-primary)';
      btnPlay.style.color = '#000';
      btnPlay.style.boxShadow = '0 4px 15px rgba(212, 175, 55, 0.3)';
      btnPlay.innerHTML = 'Iniciar Juego ▶️';

      btnStop.disabled = false;
      btnStop.style.opacity = '1';
      btnStop.style.pointerEvents = 'auto';

      btnReset.disabled = false;
      btnReset.style.opacity = '1';
      btnReset.style.pointerEvents = 'auto';

      if (state.status === 'LOBBY' || state.status === 'INACTIVE' || state.status === 'Inactivo') {
        btnStop.disabled = true;
        btnStop.style.opacity = '0.4';
        btnStop.style.pointerEvents = 'none';
      } else if (state.status === 'COUNTDOWN') {
        btnPlay.disabled = true;
        btnPlay.style.opacity = '0.4';
        btnPlay.style.pointerEvents = 'none';
        btnPlay.style.boxShadow = 'none';
        btnPlay.innerHTML = 'Iniciando... ⏳';
        
        btnStop.disabled = true;
        btnStop.style.opacity = '0.4';
        btnStop.style.pointerEvents = 'none';
      } else if (state.paused) {
        btnPlay.innerHTML = 'Reanudar Juego ▶️';
        btnStop.disabled = true;
        btnStop.style.opacity = '0.4';
        btnStop.style.pointerEvents = 'none';
      } else if (state.status === 'QUESTION_ACTIVE') {
        btnPlay.disabled = true;
        btnPlay.style.opacity = '0.4';
        btnPlay.style.pointerEvents = 'none';
        btnPlay.style.boxShadow = 'none';
      } else if (state.status === 'REVEAL_ANSWER' || state.status === 'LEADERBOARD') {
        if (!state.autoMode) {
          btnPlay.innerHTML = 'Continuar Juego ▶️';
          btnStop.disabled = true;
          btnStop.style.opacity = '0.4';
          btnStop.style.pointerEvents = 'none';
        } else {
          btnPlay.disabled = true;
          btnPlay.style.opacity = '0.4';
          btnPlay.style.pointerEvents = 'none';
          btnPlay.style.boxShadow = 'none';
        }
      } else if (state.status === 'PODIUM') {
        btnPlay.disabled = true;
        btnPlay.style.opacity = '0.4';
        btnPlay.style.pointerEvents = 'none';
        btnPlay.style.boxShadow = 'none';
        
        btnStop.disabled = true;
        btnStop.style.opacity = '0.4';
        btnStop.style.pointerEvents = 'none';
      }

      // Tooltip handling and disabled override for 0 questions
      const tooltip = document.getElementById('trivia-play-tooltip');
      const totalQuestions = state.totalQuestions || 0;

      if (totalQuestions === 0) {
        btnPlay.disabled = true;
        btnPlay.style.opacity = '0.4';
        btnPlay.style.pointerEvents = 'none';
        btnPlay.style.boxShadow = 'none';
        btnPlay.style.cursor = 'not-allowed';

        const wrapper = document.getElementById('btn-admin-trivia-play-wrapper');
        if (wrapper && tooltip) {
          wrapper.onmouseenter = () => {
            tooltip.style.display = 'block';
            setTimeout(() => { tooltip.style.opacity = '1'; }, 10);
          };
          wrapper.onmouseleave = () => {
            tooltip.style.opacity = '0';
            setTimeout(() => { tooltip.style.display = 'none'; }, 200);
          };
        }
      } else {
        const wrapper = document.getElementById('btn-admin-trivia-play-wrapper');
        if (wrapper) {
          wrapper.onmouseenter = null;
          wrapper.onmouseleave = null;
        }
        if (tooltip) {
          tooltip.style.opacity = '0';
          tooltip.style.display = 'none';
        }
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

  // Keep hidden manual controls functional for fallback/testing
  if (btnTriviaInit) btnTriviaInit.addEventListener('click', (e) => triggerTriviaAction('init', e.currentTarget));
  if (btnTriviaStart) btnTriviaStart.addEventListener('click', (e) => {
    const inputDuration = document.getElementById('input-admin-trivia-duration');
    const duration = inputDuration ? parseInt(inputDuration.value) : null;
    const clickedBtn = e.currentTarget;
    if (clickedBtn) setButtonLoading(clickedBtn, true);
    fetch(`/api/trivia/control?event=${encodeURIComponent(eventId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', autoMode: true, duration })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        showToast(data.error || 'Error al lanzar la pregunta', 'error');
      } else {
        showToast('Pregunta lanzada con éxito (Modo Automático)', 'success');
      }
    })
    .catch(err => {
      console.error(err);
      showToast('Error de comunicación', 'error');
    })
    .finally(() => {
      if (clickedBtn) setButtonLoading(clickedBtn, false);
    });
  });
  if (btnTriviaReveal) btnTriviaReveal.addEventListener('click', (e) => triggerTriviaAction('reveal', e.currentTarget));
  if (btnTriviaLeaderboard) btnTriviaLeaderboard.addEventListener('click', (e) => triggerTriviaAction('leaderboard', e.currentTarget));
  if (btnTriviaNext) btnTriviaNext.addEventListener('click', (e) => triggerTriviaAction('next', e.currentTarget));

  // Bind the static three control buttons
  const btnTriviaPlay = document.getElementById('btn-admin-trivia-play');
  if (btnTriviaPlay) {
    btnTriviaPlay.addEventListener('click', (e) => {
      const clickedBtn = e.currentTarget;
      const inputDuration = document.getElementById('input-admin-trivia-duration');
      const duration = inputDuration ? parseInt(inputDuration.value) : 20;

      if (clickedBtn) setButtonLoading(clickedBtn, true, 'Iniciando...');
      fetch(`/api/trivia/control?event=${encodeURIComponent(eventId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', duration })
      })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          showToast(data.error || 'Error al iniciar la trivia', 'error');
        } else {
          showToast('¡Juego iniciado/continuado con éxito!', 'success');
        }
      })
      .catch(err => {
        console.error(err);
        showToast('Error de comunicación', 'error');
      })
      .finally(() => {
        if (clickedBtn) setButtonLoading(clickedBtn, false);
      });
    });
  }

  const btnTriviaStop = document.getElementById('btn-admin-trivia-stop');
  if (btnTriviaStop) {
    btnTriviaStop.addEventListener('click', (e) => {
      const clickedBtn = e.currentTarget;
      if (clickedBtn) setButtonLoading(clickedBtn, true, 'Deteniendo...');
      fetch(`/api/trivia/control?event=${encodeURIComponent(eventId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          showToast(data.error || 'Error al detener la trivia', 'error');
        } else {
          showToast('¡Juego detenido con éxito!', 'success');
        }
      })
      .catch(err => {
        console.error(err);
        showToast('Error de comunicación', 'error');
      })
      .finally(() => {
        if (clickedBtn) setButtonLoading(clickedBtn, false);
      });
    });
  }

  const btnTriviaReset = document.getElementById('btn-admin-trivia-reset');
  if (btnTriviaReset) {
    btnTriviaReset.addEventListener('click', (e) => {
      if (confirm('¿Estás seguro de que deseas reiniciar la trivia? Se perderán todos los puntajes actuales.')) {
        const clickedBtn = e.currentTarget;
        if (clickedBtn) setButtonLoading(clickedBtn, true, 'Reiniciando...');
        fetch(`/api/trivia/control?event=${encodeURIComponent(eventId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'init' })
        })
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            showToast(data.error || 'Error al reiniciar la trivia', 'error');
          } else {
            showToast('Trivia reiniciada correctamente', 'success');
          }
        })
        .catch(err => {
          console.error(err);
          showToast('Error de comunicación', 'error');
        })
        .finally(() => {
          if (clickedBtn) setButtonLoading(clickedBtn, false);
        });
      }
    });
  }

  const inputDuration = document.getElementById('input-admin-trivia-duration');
  if (inputDuration) {
    let durationTimer = null;
    inputDuration.addEventListener('input', () => {
      clearTimeout(durationTimer);
      durationTimer = setTimeout(() => {
        const val = parseInt(inputDuration.value);
        if (isNaN(val) || val < 5) return;
        
        fetch(`/api/trivia/control?event=${encodeURIComponent(eventId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'set_duration', duration: val })
        })
        .then(res => res.json())
        .then(data => {
          if (!data.success) {
            showToast(data.error || 'Error al actualizar duración', 'error');
          } else {
            showToast('Duración de timer actualizada', 'success');
          }
        })
        .catch(err => {
          console.error(err);
          showToast('Error de comunicación', 'error');
        });
      }, 500);
    });
  }

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

    // Sync Background image thumbnail
    const bgInput = document.getElementById('inv-bg-url');
    const bgThumb = document.getElementById('prev-thumb-bg');
    const bgIcon = document.getElementById('prev-icon-bg');
    if (bgInput && bgThumb && bgIcon) {
      const val = bgInput.value.trim();
      if (val) {
        bgThumb.src = val;
        bgThumb.style.display = 'block';
        bgIcon.style.display = 'none';
      } else {
        bgThumb.style.display = 'none';
        bgIcon.style.display = 'block';
      }
    }

    // Cover image sync is deprecated
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
      let photoName = '';
      if (currentUploadPhotoId === 'bg') {
        photoName = 'Imagen de Fondo';
      } else {
        photoName = currentUploadPhotoId === '1' ? 'Foto 1 (Principal)' : `Foto ${currentUploadPhotoId}`;
      }
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

  // Direct Drag & Drop for Background image panel
  const directDropZones = [
    { id: 'drop-zone-bg', type: 'bg', label: 'Imagen de Fondo' }
  ];

  directDropZones.forEach(zone => {
    const el = document.getElementById(zone.id);
    if (!el) return;

    // Drag highlights
    ['dragenter', 'dragover'].forEach(eventName => {
      el.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.style.borderColor = 'var(--gold-primary)';
        el.style.background = 'rgba(212,175,55,0.05)';
        el.style.boxShadow = '0 0 15px rgba(212,175,55,0.2)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      el.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.style.borderColor = 'var(--card-border)';
        el.style.background = 'rgba(255,255,255,0.02)';
        el.style.boxShadow = 'none';
      }, false);
    });

    // Drop handler
    el.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (!file.type.startsWith('image/')) {
          showToast('error', 'Error', 'Solo se permiten archivos de imagen.');
          return;
        }

        // Set target photo ID and name for the modal
        currentUploadPhotoId = zone.type;
        if (uploadPhotoTitle) {
          uploadPhotoTitle.textContent = zone.label;
        }

        // Reset and show upload progress modal
        if (photoFileInput) photoFileInput.value = '';
        if (photoUploadLoading) photoUploadLoading.style.display = 'none';
        if (photoProgressBar) photoProgressBar.style.width = '0%';
        [photoStepCompress, photoStepUpload, photoStepFinalize].forEach(step => {
          if (step) step.className = 'audio-up-step';
        });

        if (photoUploadModal) {
          photoUploadModal.classList.add('active');
        }

        // Trigger compression & upload workflow
        handlePhotoUpload(file);
      }
    });
  });

  // Direct Drag & Drop for individual photo rows
  document.querySelectorAll('.individual-photo-row').forEach(row => {
    // Drag highlights
    ['dragenter', 'dragover'].forEach(eventName => {
      row.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        row.style.borderColor = 'var(--gold-primary)';
        row.style.background = 'rgba(212,175,55,0.05)';
        row.style.boxShadow = '0 0 10px rgba(212,175,55,0.15)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      row.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        row.style.borderColor = 'var(--card-border)';
        row.style.background = 'rgba(255,255,255,0.02)';
        row.style.boxShadow = 'none';
      }, false);
    });

    // Drop handler
    row.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (!file.type.startsWith('image/')) {
          showToast('error', 'Error', 'Solo se permiten archivos de imagen.');
          return;
        }

        const photoId = row.getAttribute('data-photo-id');
        currentUploadPhotoId = photoId;
        
        if (uploadPhotoTitle) {
          uploadPhotoTitle.textContent = photoId === '1' ? 'Foto 1 (Principal)' : `Foto ${photoId}`;
        }

        // Reset and show upload progress modal
        if (photoFileInput) photoFileInput.value = '';
        if (photoUploadLoading) photoUploadLoading.style.display = 'none';
        if (photoProgressBar) photoProgressBar.style.width = '0%';
        [photoStepCompress, photoStepUpload, photoStepFinalize].forEach(step => {
          if (step) step.className = 'audio-up-step';
        });

        if (photoUploadModal) {
          photoUploadModal.classList.add('active');
        }

        // Trigger compression & upload workflow
        handlePhotoUpload(file);
      }
    });
  });

  // Bulk Upload functionality
  const bulkDropZone = document.getElementById('bulk-photo-dropzone');
  const bulkFileInput = document.getElementById('bulk-photo-file-input');

  if (bulkDropZone && bulkFileInput) {
    bulkDropZone.addEventListener('click', () => {
      bulkFileInput.click();
    });

    // Drag highlights
    ['dragenter', 'dragover'].forEach(eventName => {
      bulkDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        bulkDropZone.style.borderColor = 'var(--gold-primary)';
        bulkDropZone.style.background = 'rgba(212,175,55,0.05)';
        bulkDropZone.style.boxShadow = '0 0 15px rgba(212,175,55,0.2)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      bulkDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        bulkDropZone.style.borderColor = 'rgba(212,175,55,0.3)';
        bulkDropZone.style.background = 'rgba(255,255,255,0.01)';
        bulkDropZone.style.boxShadow = 'inset 0 0 15px rgba(0,0,0,0.2)';
      }, false);
    });

    bulkDropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        handleBulkPhotoUpload(files);
      }
    });

    bulkFileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleBulkPhotoUpload(files);
      }
    });
  }

  // Handle Bulk Photo Upload Workflow Sequentially
  async function handleBulkPhotoUpload(files) {
    const filesToUpload = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5);
    if (filesToUpload.length === 0) {
      showToast('error', 'Error', 'No se encontraron imágenes válidas.');
      return;
    }

    // Open upload progress modal
    if (photoUploadModal) {
      photoUploadModal.classList.add('active');
    }

    showToast('info', 'Subiendo Fotos', `Comenzando subida de ${filesToUpload.length} fotos...`);

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const photoId = i + 1;

      // Update current target ID
      currentUploadPhotoId = photoId.toString();

      // Update modal title
      if (uploadPhotoTitle) {
        uploadPhotoTitle.textContent = `Lote: Subiendo Foto ${photoId} de ${filesToUpload.length}`;
      }

      // Reset loading progress for this file
      if (photoUploadLoading) photoUploadLoading.style.display = 'block';
      if (photoProgressBar) photoProgressBar.style.width = '0%';
      [photoStepCompress, photoStepUpload, photoStepFinalize].forEach(step => {
        if (step) step.className = 'audio-up-step';
      });

      try {
        // Step 1: Compress
        if (photoStepCompress) photoStepCompress.classList.add('active');
        if (photoProgressBar) photoProgressBar.style.width = '10%';
        
        const compressedBlob = await compressImage(file, 1200, 1200, 0.8);
        
        if (photoStepCompress) {
          photoStepCompress.classList.remove('active');
          photoStepCompress.classList.add('completed');
        }
        if (photoProgressBar) photoProgressBar.style.width = '30%';

        // Step 2: Upload
        if (photoStepUpload) photoStepUpload.classList.add('active');
        
        const formData = new FormData();
        formData.append('image', compressedBlob, file.name || `photo_${photoId}.jpg`);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/admin/upload-image?event=${encodeURIComponent(eventId)}`);

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const uploadPercent = (e.loaded / e.total) * 100;
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
        
        const targetInput = document.getElementById(`inv-photo-${photoId}`);
        if (targetInput) {
          targetInput.value = imageUrl;
          targetInput.dispatchEvent(new Event('input'));
        }

        if (photoStepFinalize) {
          photoStepFinalize.classList.remove('active');
          photoStepFinalize.classList.add('completed');
        }
        if (photoProgressBar) photoProgressBar.style.width = '100%';

        // Wait brief delay before moving to the next photo
        await new Promise(resolve => setTimeout(resolve, 800));

      } catch (err) {
        console.error(`[Bulk Upload] Error uploading photo ${photoId}:`, err);
        showToast('error', `Error en Foto ${photoId}`, err.message || 'No se pudo subir la imagen.');
        
        if (photoStepFinalize) {
          photoStepFinalize.classList.add('error');
        }
        
        // Wait a bit so they can see the error, then close the modal
        await new Promise(resolve => setTimeout(resolve, 2000));
        closePhotoUploadModal();
        return;
      }
    }

    showToast('success', '¡Éxito!', `Se subieron y asignaron las ${filesToUpload.length} fotos correctamente.`);
    setTimeout(() => {
      closePhotoUploadModal();
    }, 1000);
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
      let targetInput;
      if (currentUploadPhotoId === 'bg') {
        targetInput = document.getElementById('inv-bg-url');
      } else {
        targetInput = document.getElementById(`inv-photo-${currentUploadPhotoId}`);
      }

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

  // ==========================================
  // Capitanes de Mesa Admin Integration
  // ==========================================
  // tabBtnCapitanes and tabCapitanes are already declared at the top of DOMContentLoaded
  const modeSelect = document.getElementById('capitanes-mode-select');
  const timeLimitInput = document.getElementById('capitanes-time-limit');
  const questsListContainer = document.getElementById('capitanes-quests-list');
  const btnAddQuest = document.getElementById('btn-add-capitanes-quest');
  const btnSaveConfig = document.getElementById('btn-save-capitanes-config');
  const statusBadge = document.getElementById('capitanes-admin-status-badge');
  const timerDisplay = document.getElementById('capitanes-admin-timer-display');
  const btnStart = document.getElementById('btn-capitanes-admin-start');
  const btnPause = document.getElementById('btn-capitanes-admin-pause');
  const btnReset = document.getElementById('btn-capitanes-admin-reset');
  const submissionsList = document.getElementById('capitanes-submissions-list');
  const validationCountSpan = document.getElementById('capitanes-validation-count');
  const btnCapitanesProjector = document.getElementById('btn-admin-capitanes-projector');
  const btnPrintCapitanesGeneralQr = document.getElementById('btn-print-capitanes-general-qr');
  const btnPrintCapitanesTablesQr = document.getElementById('btn-print-capitanes-tables-qr');
  const btnCustomSelectGlobal = document.getElementById('btn-custom-select-global');

  // Capitanes state variables are declared at the top of DOMContentLoaded to prevent TDZ issues

  // Add click event listeners to tabs to solve the original developer's missing click events!
  if (tabBtnMesas) tabBtnMesas.addEventListener('click', () => switchTab('mesas'));
  if (tabBtnFotos) tabBtnFotos.addEventListener('click', () => switchTab('fotos'));
  if (tabBtnTrivia) tabBtnTrivia.addEventListener('click', () => switchTab('trivia'));
  if (tabBtnCapitanes) tabBtnCapitanes.addEventListener('click', () => switchTab('capitanes'));

  // Handle mode select change (custom vs general)
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      capitanesConfigData.gameMode = modeSelect.value;
      renderConfigQuests();
    });
  }

  // Handle global custom select button
  if (btnCustomSelectGlobal) {
    btnCustomSelectGlobal.addEventListener('click', () => {
      activeCustomSelection = 'global';
      renderConfigQuests();
    });
  }

  // Add new quest button
  if (btnAddQuest) {
    btnAddQuest.addEventListener('click', () => {
      capitanesConfigData.quests.push({
        id: 'q_' + Math.random().toString(36).substr(2, 9),
        text: '',
        points: 100,
        mesa: 'Todas'
      });
      renderConfigQuests();
    });
  }

  // Render the current list of quests in the editor panel
  function createQuestRow(quest, index, isGuestQuest) {
    const item = document.createElement('div');
    item.className = 'form-group-inline';
    item.style.display = 'flex';
    item.style.flexDirection = 'column';
    item.style.gap = '10px';
    item.style.background = 'rgba(255,255,255,0.02)';
    item.style.border = '1px solid var(--card-border)';
    item.style.borderRadius = '15px';
    item.style.padding = '15px';
    item.style.marginBottom = '10px';
    item.style.transition = 'all 0.3s ease';

    // First Row: Mission Text & Action
    const row1 = document.createElement('div');
    row1.style.display = 'flex';
    row1.style.gap = '10px';
    row1.style.width = '100%';

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'form-control-admin';
    textInput.placeholder = 'Ej. Sacarse una foto con el DJ';
    textInput.value = quest.text || '';
    textInput.style.flex = '1';
    textInput.style.padding = '10px 15px';
    textInput.style.borderRadius = '12px';
    textInput.style.border = '1px solid var(--card-border)';
    textInput.style.background = 'rgba(0,0,0,0.3)';
    textInput.style.color = 'white';
    textInput.style.outline = 'none';
    textInput.style.fontFamily = 'Montserrat, sans-serif';
    textInput.style.fontSize = '0.85rem';
    textInput.style.transition = 'all 0.2s ease';
    
    textInput.addEventListener('focus', () => {
      textInput.style.borderColor = 'rgba(212, 175, 55, 0.5)';
      textInput.style.boxShadow = '0 0 10px rgba(212, 175, 55, 0.15)';
      textInput.style.background = 'rgba(0,0,0,0.4)';
    });
    textInput.addEventListener('blur', () => {
      textInput.style.borderColor = 'var(--card-border)';
      textInput.style.boxShadow = 'none';
      textInput.style.background = 'rgba(0,0,0,0.3)';
    });
    textInput.addEventListener('input', () => {
      quest.text = textInput.value;
    });

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'btn';
    btnDelete.style.padding = '0';
    btnDelete.style.borderRadius = '12px';
    btnDelete.style.cursor = 'pointer';
    btnDelete.style.width = '38px';
    btnDelete.style.height = '38px';
    btnDelete.style.display = 'flex';
    btnDelete.style.alignItems = 'center';
    btnDelete.style.justifyContent = 'center';
    btnDelete.style.flex = 'none';
    btnDelete.style.background = 'rgba(239, 68, 68, 0.1)';
    btnDelete.style.border = '1px solid rgba(239, 68, 68, 0.25)';
    btnDelete.style.color = '#ef4444';
    btnDelete.style.transition = 'all 0.2s ease';
    btnDelete.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
    `;
    
    btnDelete.addEventListener('mouseenter', () => {
      btnDelete.style.background = '#ef4444';
      btnDelete.style.color = '#white';
      btnDelete.style.transform = 'scale(1.05)';
    });
    btnDelete.addEventListener('mouseleave', () => {
      btnDelete.style.background = 'rgba(239, 68, 68, 0.1)';
      btnDelete.style.color = '#ef4444';
      btnDelete.style.transform = 'scale(1)';
    });
    btnDelete.addEventListener('click', () => {
      capitanesConfigData.quests.splice(index, 1);
      renderConfigQuests();
    });

    row1.appendChild(textInput);
    row1.appendChild(btnDelete);

    // Second Row: Points & Target Tag
    const row2 = document.createElement('div');
    row2.style.display = 'flex';
    row2.style.justifyContent = 'space-between';
    row2.style.alignItems = 'center';
    row2.style.width = '100%';
    row2.style.gap = '10px';

    const label = document.createElement('div');
    label.style.fontSize = '0.7rem';
    label.style.fontWeight = '600';
    label.style.display = 'inline-flex';
    label.style.alignItems = 'center';
    label.style.gap = '6px';
    label.style.padding = '4px 10px';
    label.style.borderRadius = '20px';
    label.style.letterSpacing = '0.5px';

    if (isGuestQuest) {
      label.style.background = 'rgba(212, 175, 55, 0.1)';
      label.style.border = '1px solid rgba(212, 175, 55, 0.25)';
      label.style.color = 'var(--gold-primary)';
      label.innerHTML = `👤 <span style="opacity: 0.85;">Integrante:</span> ${quest.invitado}`;
    } else if (capitanesConfigData.gameMode === 'custom' && quest.mesa !== 'Todas') {
      label.style.background = 'rgba(212, 175, 55, 0.05)';
      label.style.border = '1px solid rgba(212, 175, 55, 0.15)';
      label.style.color = 'var(--gold-light)';
      label.innerHTML = `📌 Mesa ${quest.mesa}`;
    } else {
      label.style.background = 'rgba(255, 255, 255, 0.03)';
      label.style.border = '1px solid rgba(255, 255, 255, 0.06)';
      label.style.color = 'var(--text-muted)';
      label.innerHTML = `📢 Todas las mesas`;
    }

    const pointsWrapper = document.createElement('div');
    pointsWrapper.style.display = 'flex';
    pointsWrapper.style.alignItems = 'center';
    pointsWrapper.style.gap = '6px';

    const pointsLabel = document.createElement('span');
    pointsLabel.textContent = 'Pts:';
    pointsLabel.style.fontSize = '0.7rem';
    pointsLabel.style.color = 'var(--text-muted)';
    pointsLabel.style.fontWeight = '600';

    const pointsInput = document.createElement('input');
    pointsInput.type = 'number';
    pointsInput.className = 'form-control-admin';
    pointsInput.placeholder = 'Puntos';
    pointsInput.value = quest.points || 100;
    pointsInput.min = '10';
    pointsInput.style.width = '70px';
    pointsInput.style.padding = '6px 10px';
    pointsInput.style.borderRadius = '10px';
    pointsInput.style.border = '1px solid var(--card-border)';
    pointsInput.style.background = 'rgba(0,0,0,0.3)';
    pointsInput.style.color = 'white';
    pointsInput.style.outline = 'none';
    pointsInput.style.fontFamily = 'Montserrat, sans-serif';
    pointsInput.style.fontSize = '0.8rem';
    pointsInput.style.textAlign = 'center';
    pointsInput.style.transition = 'all 0.2s ease';
    
    pointsInput.addEventListener('focus', () => {
      pointsInput.style.borderColor = 'rgba(212, 175, 55, 0.5)';
      pointsInput.style.boxShadow = '0 0 10px rgba(212, 175, 55, 0.15)';
      pointsInput.style.background = 'rgba(0,0,0,0.4)';
    });
    pointsInput.addEventListener('blur', () => {
      pointsInput.style.borderColor = 'var(--card-border)';
      pointsInput.style.boxShadow = 'none';
      pointsInput.style.background = 'rgba(0,0,0,0.3)';
    });
    pointsInput.addEventListener('input', () => {
      quest.points = parseInt(pointsInput.value) || 100;
    });

    pointsWrapper.appendChild(pointsLabel);
    pointsWrapper.appendChild(pointsInput);

    row2.appendChild(label);
    row2.appendChild(pointsWrapper);

    item.appendChild(row1);
    item.appendChild(row2);
    return item;
  }

  // Helper to style workspace sidebar buttons
  function styleNavButton(btn, isActive) {
    if (isActive) {
      btn.style.background = 'var(--gold-primary)';
      btn.style.border = '1px solid var(--gold-primary)';
      btn.style.color = '#0b0b0c';
      btn.style.fontWeight = '700';
    } else {
      btn.style.background = 'rgba(255, 255, 255, 0.02)';
      btn.style.border = '1px solid rgba(255,255,255,0.08)';
      btn.style.color = 'var(--text-muted)';
      btn.style.fontWeight = '500';
    }
  }

  // Render the current list of quests in the editor panel
  function renderConfigQuests() {
    if (!questsListContainer) return;

    // Update the list of tables ready to play
    updateReadyTablesList();

    const generalContainer = document.getElementById('capitanes-quests-general-container');
    const customContainer = document.getElementById('capitanes-quests-custom-container');

    if (capitanesConfigData.gameMode === 'general') {
      // Show general editor, hide custom editor
      if (generalContainer) generalContainer.style.display = 'block';
      if (customContainer) customContainer.style.display = 'none';

      questsListContainer.innerHTML = '';
      if (capitanesConfigData.quests.length === 0) {
        questsListContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 15px 0;">No hay misiones configuradas.</p>`;
      } else {
        capitanesConfigData.quests.forEach((quest, index) => {
          const item = createQuestRow(quest, index, false);
          questsListContainer.appendChild(item);
        });
      }
    } else {
      // Show custom editor, hide general editor
      if (generalContainer) generalContainer.style.display = 'none';
      if (customContainer) customContainer.style.display = 'block';

      // 1. Render Sidebar Table Buttons
      const btnCustomSelectGlobal = document.getElementById('btn-custom-select-global');
      if (btnCustomSelectGlobal) {
        styleNavButton(btnCustomSelectGlobal, activeCustomSelection === 'global');
        btnCustomSelectGlobal.style.transition = 'all 0.2s ease';
        btnCustomSelectGlobal.onmouseenter = () => {
          if (activeCustomSelection !== 'global') {
            btnCustomSelectGlobal.style.background = 'rgba(255, 255, 255, 0.06)';
            btnCustomSelectGlobal.style.color = '#fff';
            btnCustomSelectGlobal.style.borderColor = 'rgba(255,255,255,0.15)';
          }
        };
        btnCustomSelectGlobal.onmouseleave = () => {
          if (activeCustomSelection !== 'global') {
            btnCustomSelectGlobal.style.background = 'rgba(255, 255, 255, 0.02)';
            btnCustomSelectGlobal.style.color = 'var(--text-muted)';
            btnCustomSelectGlobal.style.borderColor = 'rgba(255,255,255,0.08)';
          }
        };
      }

      const tablesNav = document.getElementById('capitanes-custom-tables-nav');
      if (tablesNav) {
        tablesNav.innerHTML = '';
        const tablesList = allTables || [];

        if (tablesList.length === 0) {
          tablesNav.innerHTML = `
            <div style="font-size: 0.7rem; color: var(--text-muted); font-style: italic; text-align: center; padding: 10px 0;">
              No hay mesas configuradas.
            </div>
          `;
        } else {
          tablesList.forEach(table => {
            // Calculate quest count for this table
            const tableQuestsCount = capitanesConfigData.quests.filter(q => q.mesa === table.name && (!q.invitado || q.invitado === 'Todos')).length;
            const guestQuestsCount = capitanesConfigData.quests.filter(q => q.mesa === table.name && q.invitado && q.invitado !== 'Todos').length;
            const totalQuests = tableQuestsCount + guestQuestsCount;

            const navBtn = document.createElement('button');
            navBtn.type = 'button';
            navBtn.className = 'btn';
            navBtn.style.width = '100%';
            navBtn.style.padding = '10px 12px';
            navBtn.style.borderRadius = '12px';
            navBtn.style.fontSize = '0.75rem';
            navBtn.style.textAlign = 'left';
            navBtn.style.display = 'flex';
            navBtn.style.alignItems = 'center';
            navBtn.style.justifyContent = 'space-between';
            navBtn.style.transition = 'all 0.2s ease';
            navBtn.style.cursor = 'pointer';

            const labelSpan = document.createElement('span');
            labelSpan.textContent = `Mesa ${table.name}`;

            const badgesContainer = document.createElement('div');
            badgesContainer.style.display = 'flex';
            badgesContainer.style.gap = '5px';
            badgesContainer.style.alignItems = 'center';

            if (totalQuests > 0) {
              const questBadge = document.createElement('span');
              questBadge.textContent = `🎯 ${totalQuests}`;
              questBadge.style.fontSize = '0.65rem';
              questBadge.style.padding = '2px 6px';
              questBadge.style.borderRadius = '8px';
              questBadge.style.background = activeCustomSelection === table.name ? 'rgba(0,0,0,0.25)' : 'var(--gold-primary-alpha)';
              questBadge.style.color = activeCustomSelection === table.name ? '#000' : 'var(--gold-light)';
              questBadge.style.fontWeight = '700';
              badgesContainer.appendChild(questBadge);
            }

            navBtn.appendChild(labelSpan);
            navBtn.appendChild(badgesContainer);

            const isActive = activeCustomSelection === table.name;
            styleNavButton(navBtn, isActive);

            navBtn.onmouseenter = () => {
              if (activeCustomSelection !== table.name) {
                navBtn.style.background = 'rgba(255, 255, 255, 0.06)';
                navBtn.style.color = '#fff';
                navBtn.style.borderColor = 'rgba(255,255,255,0.15)';
              }
            };
            navBtn.onmouseleave = () => {
              if (activeCustomSelection !== table.name) {
                navBtn.style.background = 'rgba(255, 255, 255, 0.02)';
                navBtn.style.color = 'var(--text-muted)';
                navBtn.style.borderColor = 'rgba(255,255,255,0.08)';
              }
            };

            navBtn.addEventListener('click', () => {
              activeCustomSelection = table.name;
              renderConfigQuests();
            });

            tablesNav.appendChild(navBtn);
          });
        }
      }

      // 2. Render Workspace Body
      const workspaceBody = document.getElementById('capitanes-custom-workspace-body');
      if (workspaceBody) {
        workspaceBody.innerHTML = '';

        if (activeCustomSelection === 'global') {
          // --- Render Global Custom Quests (Todas las mesas) ---
          const header = document.createElement('div');
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'center';
          header.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
          header.style.paddingBottom = '10px';
          header.style.marginBottom = '15px';

          const title = document.createElement('h4');
          title.textContent = '📢 Misiones para Todas las Mesas';
          title.style.fontFamily = 'Cinzel, serif';
          title.style.fontSize = '0.9rem';
          title.style.color = 'var(--gold-light)';
          title.style.margin = '0';

          const btnAddGeneral = document.createElement('button');
          btnAddGeneral.type = 'button';
          btnAddGeneral.className = 'btn btn-header-action';
          btnAddGeneral.textContent = '+ Misión General';
          btnAddGeneral.style.padding = '5px 12px';
          btnAddGeneral.style.fontSize = '0.75rem';
          btnAddGeneral.style.borderRadius = '12px';
          btnAddGeneral.style.flex = 'none';
          btnAddGeneral.addEventListener('click', () => {
            capitanesConfigData.quests.push({
              id: 'q_' + Math.random().toString(36).substr(2, 9),
              text: '',
              points: 100,
              mesa: 'Todas',
              invitado: 'Todos'
            });
            renderConfigQuests();
          });

          header.appendChild(title);
          header.appendChild(btnAddGeneral);
          workspaceBody.appendChild(header);

          const generalQuests = capitanesConfigData.quests.filter(q => q.mesa === 'Todas');
          if (generalQuests.length === 0) {
            const emptyGeneral = document.createElement('div');
            emptyGeneral.innerHTML = `
              <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; font-style: italic; padding: 40px 10px; border: 1px dashed rgba(255,255,255,0.05); border-radius: 12px; background: rgba(0,0,0,0.15);">
                No hay misiones generales configuradas.
                <br>
                <span style="font-size: 0.7rem; font-weight: normal; opacity: 0.7; margin-top: 5px; display: inline-block;">Estas misiones se asignan automáticamente a todas las mesas.</span>
              </div>
            `;
            workspaceBody.appendChild(emptyGeneral);
          } else {
            const generalQuestsDiv = document.createElement('div');
            generalQuestsDiv.style.display = 'flex';
            generalQuestsDiv.style.flexDirection = 'column';
            generalQuestsDiv.style.gap = '10px';
            generalQuestsDiv.style.maxHeight = '350px';
            generalQuestsDiv.style.overflowY = 'auto';
            generalQuestsDiv.style.paddingRight = '3px';
            generalQuests.forEach(quest => {
              const idx = capitanesConfigData.quests.indexOf(quest);
              const item = createQuestRow(quest, idx, false);
              generalQuestsDiv.appendChild(item);
            });
            workspaceBody.appendChild(generalQuestsDiv);
          }
        } else {
          // --- Render Table Workspace ---
          const tableName = activeCustomSelection;
          const table = (allTables || []).find(t => t.name === tableName);

          if (!table) {
            workspaceBody.innerHTML = `
              <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 40px 10px;">
                Mesa seleccionada no encontrada o eliminada.
              </div>
            `;
            return;
          }

          // Calculate guests in this table
          const tableGuests = (allGuests || []).filter(g => {
            return g.table && (g.table.trim() === table.name.trim() || `mesa ${g.table.trim().toLowerCase()}` === table.name.trim().toLowerCase() || g.table.trim().toLowerCase() === `mesa ${table.name.trim().toLowerCase()}`);
          });

          const header = document.createElement('div');
          header.style.display = 'flex';
          header.style.justifyContent = 'space-between';
          header.style.alignItems = 'center';
          header.style.borderBottom = '1px solid rgba(255,255,255,0.08)';
          header.style.paddingBottom = '10px';
          header.style.marginBottom = '15px';
          header.style.gap = '15px';

          const titleContainer = document.createElement('div');
          titleContainer.style.display = 'flex';
          titleContainer.style.flexDirection = 'column';
          titleContainer.style.gap = '2px';

          const title = document.createElement('h4');
          title.textContent = `🛡️ Configurando Mesa ${table.name}`;
          title.style.fontFamily = 'Cinzel, serif';
          title.style.fontSize = '0.95rem';
          title.style.color = 'var(--gold-light)';
          title.style.margin = '0';

          const subtitle = document.createElement('span');
          subtitle.textContent = `${tableGuests.length} integrantes asignados`;
          subtitle.style.fontSize = '0.7rem';
          subtitle.style.color = 'var(--text-muted)';

          titleContainer.appendChild(title);
          titleContainer.appendChild(subtitle);

          // Print button specifically for this table
          const btnPrintTableQr = document.createElement('button');
          btnPrintTableQr.type = 'button';
          btnPrintTableQr.className = 'btn btn-header-action';
          btnPrintTableQr.style.display = 'flex';
          btnPrintTableQr.style.alignItems = 'center';
          btnPrintTableQr.style.gap = '5px';
          btnPrintTableQr.style.padding = '5px 10px';
          btnPrintTableQr.style.fontSize = '0.75rem';
          btnPrintTableQr.style.borderRadius = '12px';
          btnPrintTableQr.style.flex = 'none';
          btnPrintTableQr.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Imprimir QR
          `;
          btnPrintTableQr.addEventListener('click', () => {
            const container = document.getElementById('print-capitanes-grid-container');
            if (!container) return;

            container.innerHTML = '';
            const eventTitleVal = (eventTitleInput ? eventTitleInput.value.trim() : '') || 'Jano\'s Eventos';

            const targetUrl = `${siteOrigin}/capitanes-client.html?event=${encodeURIComponent(eventId)}&mesa=${encodeURIComponent(table.name)}`;
            const printQrUrl = `${qrBaseUrl}?size=450x450&data=${encodeURIComponent(targetUrl)}&color=000000&bgcolor=ffffff`;

            const card = document.createElement('div');
            card.className = 'print-capitanes-card';
            card.innerHTML = `
              <div>
                <div class="print-capitanes-card-header">Capitanes de Mesa</div>
                <div class="print-capitanes-card-event">${eventTitleVal}</div>
                <div class="print-capitanes-card-divider"></div>
                <div class="print-capitanes-card-table">Mesa ${table.name}</div>
              </div>
              <div class="print-capitanes-card-qr-container">
                <img src="${printQrUrl}" alt="Mesa ${table.name}" class="print-capitanes-card-qr">
              </div>
              <div class="print-capitanes-card-instructions">
                ¡Capitán de mesa ACTIVO! Todos los integrantes deberán escanear el código QR ubicado en sus mesas para descubrir quién es el CAPITÁN DE MESA asignado!
              </div>
            `;
            container.appendChild(card);

            document.body.classList.add('print-mode-multi-tables');
            document.body.classList.remove('print-mode-single');

            setTimeout(() => {
              window.print();
            }, 400);
          });

          header.appendChild(titleContainer);
          header.appendChild(btnPrintTableQr);
          workspaceBody.appendChild(header);

          // Scrollable area for workspace content
          const scrollableArea = document.createElement('div');
          scrollableArea.style.maxHeight = '350px';
          scrollableArea.style.overflowY = 'auto';
          scrollableArea.style.paddingRight = '3px';
          scrollableArea.style.display = 'flex';
          scrollableArea.style.flexDirection = 'column';
          scrollableArea.style.gap = '15px';

          // --- Table Quests Sub-section ---
          const tableQuestsDiv = document.createElement('div');
          const tableMissionsHeader = document.createElement('div');
          tableMissionsHeader.style.display = 'flex';
          tableMissionsHeader.style.justifyContent = 'space-between';
          tableMissionsHeader.style.alignItems = 'center';
          tableMissionsHeader.style.marginBottom = '10px';

          const tableMissionsTitle = document.createElement('span');
          tableMissionsTitle.textContent = '🎯 Misiones Grupales de la Mesa';
          tableMissionsTitle.style.fontSize = '0.78rem';
          tableMissionsTitle.style.fontWeight = '600';
          tableMissionsTitle.style.color = 'var(--gold-primary)';

          const btnAddTableQuest = document.createElement('button');
          btnAddTableQuest.type = 'button';
          btnAddTableQuest.className = 'btn btn-header-action';
          btnAddTableQuest.textContent = '+ Misión Grupal';
          btnAddTableQuest.style.padding = '4px 10px';
          btnAddTableQuest.style.fontSize = '0.7rem';
          btnAddTableQuest.style.borderRadius = '10px';
          btnAddTableQuest.style.flex = 'none';
          btnAddTableQuest.addEventListener('click', () => {
            capitanesConfigData.quests.push({
              id: 'q_' + Math.random().toString(36).substr(2, 9),
              text: '',
              points: 100,
              mesa: table.name,
              invitado: 'Todos'
            });
            renderConfigQuests();
          });

          tableMissionsHeader.appendChild(tableMissionsTitle);
          tableMissionsHeader.appendChild(btnAddTableQuest);
          tableQuestsDiv.appendChild(tableMissionsHeader);

          const tableQuests = capitanesConfigData.quests.filter(q => q.mesa === table.name && (!q.invitado || q.invitado === 'Todos'));
          if (tableQuests.length === 0) {
            const emptyTableQuests = document.createElement('div');
            emptyTableQuests.innerHTML = `
              <div style="text-align: center; color: var(--text-muted); font-size: 0.75rem; font-style: italic; padding: 15px 10px; border: 1px dashed rgba(255,255,255,0.05); border-radius: 12px; background: rgba(0,0,0,0.1); margin-bottom: 5px;">
                No hay misiones grupales configuradas.
              </div>
            `;
            tableQuestsDiv.appendChild(emptyTableQuests);
          } else {
            const tableQuestsList = document.createElement('div');
            tableQuestsList.style.display = 'flex';
            tableQuestsList.style.flexDirection = 'column';
            tableQuestsList.style.gap = '8px';
            tableQuests.forEach(quest => {
              const idx = capitanesConfigData.quests.indexOf(quest);
              const item = createQuestRow(quest, idx, false);
              tableQuestsList.appendChild(item);
            });
            tableQuestsDiv.appendChild(tableQuestsList);
          }
          scrollableArea.appendChild(tableQuestsDiv);

          // --- Guest Quests Sub-section ---
          const guestQuestsDiv = document.createElement('div');
          const guestMissionsTitle = document.createElement('div');
          guestMissionsTitle.textContent = '👤 Misiones Individuales por Integrante';
          guestMissionsTitle.style.fontSize = '0.78rem';
          guestMissionsTitle.style.fontWeight = '600';
          guestMissionsTitle.style.color = 'var(--gold-primary)';
          guestMissionsTitle.style.marginBottom = '10px';
          guestMissionsTitle.style.borderTop = '1px solid rgba(255,255,255,0.05)';
          guestMissionsTitle.style.paddingTop = '15px';
          guestQuestsDiv.appendChild(guestMissionsTitle);

          if (tableGuests.length === 0) {
            const emptyGuests = document.createElement('div');
            emptyGuests.innerHTML = `
              <div style="text-align: center; color: var(--text-muted); font-size: 0.75rem; font-style: italic; padding: 15px 10px; border: 1px dashed rgba(255,255,255,0.05); border-radius: 12px; background: rgba(0,0,0,0.1);">
                No hay invitados asignados en la Mesa ${table.name}.
              </div>
            `;
            guestQuestsDiv.appendChild(emptyGuests);
          } else {
            const guestsList = document.createElement('div');
            guestsList.style.display = 'flex';
            guestsList.style.flexDirection = 'column';
            guestsList.style.gap = '12px';

            tableGuests.forEach(guest => {
              const fullName = `${guest.firstName} ${guest.lastName}`.trim();
              const guestCard = document.createElement('div');
              guestCard.style.background = 'rgba(255, 255, 255, 0.02)';
              guestCard.style.border = '1px solid rgba(255, 255, 255, 0.04)';
              guestCard.style.borderRadius = '12px';
              guestCard.style.padding = '12px';

              const guestHeader = document.createElement('div');
              guestHeader.style.display = 'flex';
              guestHeader.style.justifyContent = 'space-between';
              guestHeader.style.alignItems = 'center';
              guestHeader.style.marginBottom = '8px';

              const nameContainer = document.createElement('div');
              nameContainer.style.display = 'flex';
              nameContainer.style.alignItems = 'center';
              nameContainer.style.gap = '8px';

              const guestNameSpan = document.createElement('span');
              guestNameSpan.textContent = fullName;
              guestNameSpan.style.fontSize = '0.75rem';
              guestNameSpan.style.fontWeight = '600';
              guestNameSpan.style.color = '#fff';
              
              nameContainer.appendChild(guestNameSpan);

              // Add crown button
              const isThisGuestCaptain = capitanesConfigData.captains && capitanesConfigData.captains[table.name] === fullName;
              const btnCrown = document.createElement('button');
              btnCrown.type = 'button';
              btnCrown.className = 'btn-assign-captain';
              btnCrown.style.background = 'none';
              btnCrown.style.border = 'none';
              btnCrown.style.cursor = 'pointer';
              btnCrown.style.fontSize = '1.05rem';
              btnCrown.style.padding = '0';
              btnCrown.style.display = 'inline-flex';
              btnCrown.style.alignItems = 'center';
              btnCrown.style.justifyContent = 'center';
              btnCrown.style.transition = 'all 0.2s ease';
              
              if (isThisGuestCaptain) {
                btnCrown.innerHTML = '👑';
                btnCrown.title = 'Capitán de Mesa Activo (Hacé clic para quitar)';
                btnCrown.style.filter = 'drop-shadow(0 0 4px rgba(212,175,55,0.6))';
              } else {
                btnCrown.innerHTML = '☆';
                btnCrown.title = 'Asignar como Capitán de Mesa';
                btnCrown.style.color = 'rgba(255,255,255,0.3)';
              }

              btnCrown.addEventListener('click', async () => {
                const newCaptain = isThisGuestCaptain ? '' : fullName;
                try {
                  const response = await fetch(`/api/capitanes/assign-captain?event=${encodeURIComponent(eventId)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ table: table.name, guestName: newCaptain })
                  });
                  if (!response.ok) {
                    throw new Error(`Error de servidor (${response.status})`);
                  }
                  const result = await response.json();
                  if (result.success) {
                    if (!capitanesConfigData.captains) {
                      capitanesConfigData.captains = {};
                    }
                    capitanesConfigData.captains = result.captains;
                    showToast('success', 'Asignación de Capitán', newCaptain ? `¡${newCaptain} ahora es el Capitán de la Mesa ${table.name}! 👑` : `Se quitó el rol de Capitán de la Mesa ${table.name}.`);
                    renderConfigQuests();
                  } else {
                    showToast('error', 'Error', result.error || 'Error al asignar capitán.');
                  }
                } catch (err) {
                  console.error(err);
                  showToast('error', 'Error', 'Error de red al asignar capitán. Asegúrate de reiniciar el servidor backend para aplicar los cambios.');
                }
              });

              nameContainer.appendChild(btnCrown);

              const btnAddGuestQuest = document.createElement('button');
              btnAddGuestQuest.type = 'button';
              btnAddGuestQuest.className = 'btn btn-header-action';
              btnAddGuestQuest.textContent = '+ Misión Personal';
              btnAddGuestQuest.style.padding = '3px 8px';
              btnAddGuestQuest.style.fontSize = '0.65rem';
              btnAddGuestQuest.style.borderRadius = '8px';
              btnAddGuestQuest.style.flex = 'none';
              btnAddGuestQuest.addEventListener('click', () => {
                capitanesConfigData.quests.push({
                  id: 'q_' + Math.random().toString(36).substr(2, 9),
                  text: '',
                  points: 100,
                  mesa: table.name,
                  invitado: fullName
                });
                renderConfigQuests();
              });

              guestHeader.appendChild(nameContainer);
              guestHeader.appendChild(btnAddGuestQuest);
              guestCard.appendChild(guestHeader);

              const guestQuests = capitanesConfigData.quests.filter(q => q.mesa === table.name && q.invitado === fullName);
              if (guestQuests.length === 0) {
                const noGuestQuests = document.createElement('div');
                noGuestQuests.textContent = 'Sin misiones individuales configuradas.';
                noGuestQuests.style.fontSize = '0.7rem';
                noGuestQuests.style.color = 'var(--text-muted)';
                noGuestQuests.style.fontStyle = 'italic';
                noGuestQuests.style.padding = '5px 0';
                guestCard.appendChild(noGuestQuests);
              } else {
                const guestQuestsList = document.createElement('div');
                guestQuestsList.style.display = 'flex';
                guestQuestsList.style.flexDirection = 'column';
                guestQuestsList.style.gap = '8px';
                guestQuests.forEach(quest => {
                  const idx = capitanesConfigData.quests.indexOf(quest);
                  const item = createQuestRow(quest, idx, true);
                  guestQuestsList.appendChild(item);
                });
                guestCard.appendChild(guestQuestsList);
              }
              guestsList.appendChild(guestCard);
            });
            guestQuestsDiv.appendChild(guestsList);
          }
          scrollableArea.appendChild(guestQuestsDiv);
          workspaceBody.appendChild(scrollableArea);
        }
      }
    }
  }

  // Update list of tables that have missions assigned and are ready to play
  function updateReadyTablesList() {
    const section = document.getElementById('capitanes-ready-tables-section');
    const listContainer = document.getElementById('capitanes-ready-tables-list');
    if (!section || !listContainer) return;

    if (capitanesConfigData.gameMode !== 'custom') {
      section.style.display = 'none';
      return;
    }

    listContainer.innerHTML = '';
    const readyTables = [];

    (allTables || []).forEach(table => {
      // Count table-specific missions
      const tableQuestsCount = capitanesConfigData.quests.filter(q => q.mesa === table.name && (!q.invitado || q.invitado === 'Todos')).length;
      
      // Count guest-specific missions
      const guestQuestsCount = capitanesConfigData.quests.filter(q => q.mesa === table.name && q.invitado && q.invitado !== 'Todos').length;

      const totalQuests = tableQuestsCount + guestQuestsCount;
      if (totalQuests > 0) {
        readyTables.push({
          table,
          tableQuestsCount,
          guestQuestsCount,
          totalQuests
        });
      }
    });

    if (readyTables.length === 0) {
      section.style.display = 'block';
      listContainer.innerHTML = `
        <div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; text-align: center; padding: 15px 10px;">
          No hay mesas listas para jugar. Asigná misiones a mesas o integrantes para verlas acá.
        </div>
      `;
      return;
    }

    section.style.display = 'block';

    readyTables.forEach(({ table, tableQuestsCount, guestQuestsCount, totalQuests }) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.background = 'rgba(255, 255, 255, 0.03)';
      row.style.border = '1px solid rgba(255, 255, 255, 0.05)';
      row.style.borderRadius = '12px';
      row.style.padding = '8px 12px';
      row.style.gap = '10px';

      // Left Column: Table Details
      const details = document.createElement('div');
      details.style.display = 'flex';
      details.style.flexDirection = 'column';
      details.style.gap = '2px';

      const tableName = document.createElement('span');
      tableName.textContent = `Mesa ${table.name}`;
      tableName.style.fontSize = '0.85rem';
      tableName.style.fontWeight = '600';
      tableName.style.color = 'white';

      const stats = document.createElement('span');
      stats.style.fontSize = '0.7rem';
      stats.style.color = 'var(--text-muted)';
      const parts = [];
      if (tableQuestsCount > 0) {
        parts.push(`${tableQuestsCount} de mesa`);
      }
      if (guestQuestsCount > 0) {
        parts.push(`${guestQuestsCount} personal${guestQuestsCount > 1 ? 'es' : ''}`);
      }
      stats.textContent = parts.join(' + ');

      details.appendChild(tableName);
      details.appendChild(stats);

      // Right Column: Print Button
      const btnPrint = document.createElement('button');
      btnPrint.type = 'button';
      btnPrint.className = 'btn';
      btnPrint.style.padding = '5px 10px';
      btnPrint.style.fontSize = '0.75rem';
      btnPrint.style.borderRadius = '8px';
      btnPrint.style.border = '1px solid rgba(212, 175, 55, 0.4)';
      btnPrint.style.background = 'transparent';
      btnPrint.style.color = 'var(--gold-primary)';
      btnPrint.style.cursor = 'pointer';
      btnPrint.style.display = 'flex';
      btnPrint.style.alignItems = 'center';
      btnPrint.style.gap = '5px';
      btnPrint.style.flex = 'none';
      btnPrint.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"></path><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Imprimir
      `;

      // Hover effects for print button
      btnPrint.style.transition = 'all 0.2s ease';
      btnPrint.addEventListener('mouseenter', () => {
        btnPrint.style.background = 'rgba(212, 175, 55, 0.1)';
      });
      btnPrint.addEventListener('mouseleave', () => {
        btnPrint.style.background = 'transparent';
      });

      btnPrint.addEventListener('click', () => {
        const container = document.getElementById('print-capitanes-grid-container');
        if (!container) return;

        container.innerHTML = '';
        const eventTitleVal = (eventTitleInput ? eventTitleInput.value.trim() : '') || 'Jano\'s Eventos';

        const targetUrl = `${siteOrigin}/capitanes-client.html?event=${encodeURIComponent(eventId)}&mesa=${encodeURIComponent(table.name)}`;
        const printQrUrl = `${qrBaseUrl}?size=450x450&data=${encodeURIComponent(targetUrl)}&color=000000&bgcolor=ffffff`;

        const card = document.createElement('div');
        card.className = 'print-capitanes-card';
        card.innerHTML = `
          <div>
            <div class="print-capitanes-card-header">Capitanes de Mesa</div>
            <div class="print-capitanes-card-event">${eventTitleVal}</div>
            <div class="print-capitanes-card-divider"></div>
            <div class="print-capitanes-card-table">Mesa ${table.name}</div>
          </div>
          <div class="print-capitanes-card-qr-container">
            <img src="${printQrUrl}" alt="Mesa ${table.name}" class="print-capitanes-card-qr">
          </div>
          <div class="print-capitanes-card-instructions">
            ¡Capitán de mesa ACTIVO! Todos los integrantes deberán escanear el código QR ubicado en sus mesas para descubrir quién es el CAPITÁN DE MESA asignado!
          </div>
        `;
        container.appendChild(card);

        document.body.classList.add('print-mode-multi-tables');
        document.body.classList.remove('print-mode-single');

        setTimeout(() => {
          window.print();
        }, 400);
      });

      row.appendChild(details);
      row.appendChild(btnPrint);
      listContainer.appendChild(row);
    });
  }

  // Load Capitanes Config from backend state
  function loadCapitanesConfig() {
    fetch(`/api/capitanes/state?event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(state => {
        if (state) {
          capitanesConfigData = {
            gameMode: state.gameMode || 'general',
            timeLimit: state.timeLimit || 10,
            quests: state.quests || [],
            captains: state.captains || {}
          };
          if (modeSelect) {
            modeSelect.value = capitanesConfigData.gameMode;
            modeSelect.dispatchEvent(new Event('change'));
          }
          if (timeLimitInput) timeLimitInput.value = capitanesConfigData.timeLimit;
          renderConfigQuests();
          renderAdminCapitanesState(state);
        }
      })
      .catch(err => {
        console.error('Error loading Capitanes configuration:', err);
        showToast('error', 'Error', 'Error al cargar la configuración de Capitanes.');
      });
  }

  // Save Config to Server
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', () => {
      setButtonLoading(btnSaveConfig, true, 'Guardando...');
      const gameMode = modeSelect ? modeSelect.value : 'general';
      const timeLimit = timeLimitInput ? parseInt(timeLimitInput.value) : 10;
      
      // Basic validation
      const invalid = capitanesConfigData.quests.some(q => !q.text.trim());
      if (invalid) {
        showToast('error', 'Error de Validación', 'Por favor escribe el texto de todas las misiones.');
        setButtonLoading(btnSaveConfig, false);
        return;
      }

      fetch(`/api/capitanes/config?event=${encodeURIComponent(eventId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameMode,
          timeLimit,
          quests: capitanesConfigData.quests,
          captains: capitanesConfigData.captains
        })
      })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.success) {
          showToast('success', '¡Éxito!', 'Configuración guardada correctamente.');
        } else {
          showToast('error', 'Error', data.error || 'Error al guardar la configuración.');
        }
      })
      .catch(err => {
        console.error('Error saving Capitanes config:', err);
        showToast('error', 'Error', 'Error de red al guardar la configuración. Asegúrate de reiniciar el servidor backend.');
      })
      .finally(() => {
        setButtonLoading(btnSaveConfig, false);
      });
    });
  }

  // --- Real-time Polling & SSE for Capitanes ---
  function startCapitanesPolling() {
    stopCapitanesPolling();
    lastCapitanesSseTime = Date.now();
    capitanesEventSource = new EventSource(`/api/capitanes/stream?event=${encodeURIComponent(eventId)}`);

    capitanesEventSource.onmessage = (e) => {
      lastCapitanesSseTime = Date.now();
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'INITIAL_STATE' || msg.type === 'STATE_UPDATE') {
          renderAdminCapitanesState(msg.data);
        }
      } catch (err) {
        console.error('Error parsing Capitanes SSE msg:', err);
      }
    };

    capitanesEventSource.onerror = () => {
      console.warn('Capitanes SSE disconnected, falling back to polling.');
    };

    if (!adminCapitanesPollInterval) {
      adminCapitanesPollInterval = setInterval(() => {
        const silence = Date.now() - lastCapitanesSseTime;
        if (silence > 5000) {
          syncAdminCapitanesStateWithPoll();
        }
      }, 3000);
    }
  }

  function stopCapitanesPolling() {
    if (capitanesEventSource) {
      capitanesEventSource.close();
      capitanesEventSource = null;
    }
    if (adminCapitanesPollInterval) {
      clearInterval(adminCapitanesPollInterval);
      adminCapitanesPollInterval = null;
    }
    if (capitanesLocalTimerInterval) {
      clearInterval(capitanesLocalTimerInterval);
      capitanesLocalTimerInterval = null;
    }
  }

  function syncAdminCapitanesStateWithPoll() {
    fetch(`/api/capitanes/state?event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(state => {
        lastCapitanesSseTime = Date.now();
        renderAdminCapitanesState(state);
      })
      .catch(err => {
        console.error('Error polling Capitanes state:', err);
      });
  }

  // Render the current live state of Capitanes in the admin panel
  function renderAdminCapitanesState(state) {
    if (!state) return;

    // Update captains mapping and trigger re-render if it changed
    if (state.captains) {
      const oldCaptains = JSON.stringify(capitanesConfigData.captains || {});
      const newCaptains = JSON.stringify(state.captains);
      if (oldCaptains !== newCaptains) {
        capitanesConfigData.captains = state.captains;
        renderConfigQuests();
      }
    }

    // Update status badge
    if (statusBadge) {
      statusBadge.textContent = state.status;
      statusBadge.className = 'badge';
      if (state.status === 'LOBBY') statusBadge.classList.add('badge-pending');
      else if (state.status === 'PLAYING') statusBadge.classList.add('badge-approved');
      else if (state.status === 'PAUSED') statusBadge.classList.add('badge-pending');
      else if (state.status === 'FINISHED') statusBadge.classList.add('badge-rejected');
    }

    // Set up local timers
    capitanesStateExpiresAt = state.stateExpiresAt;
    updateAdminTimerDisplay();

    if (state.status === 'PLAYING') {
      if (!capitanesLocalTimerInterval) {
        capitanesLocalTimerInterval = setInterval(updateAdminTimerDisplay, 1000);
      }
    } else {
      if (capitanesLocalTimerInterval) {
        clearInterval(capitanesLocalTimerInterval);
        capitanesLocalTimerInterval = null;
      }
    }

    // Render live validation list (submissions in SUBMITTED status)
    if (submissionsList) {
      submissionsList.innerHTML = '';
      const pendingSubmissions = [];

      if (state.progress) {
        Object.entries(state.progress).forEach(([mesa, questsProgress]) => {
          Object.entries(questsProgress).forEach(([questId, progress]) => {
            if (progress.status === 'SUBMITTED') {
              // Find the quest configuration details
              const configQuest = (state.quests || []).find(q => q.id === questId);
              pendingSubmissions.push({
                mesa,
                questId,
                questText: configQuest ? configQuest.text : 'Misión Desconocida',
                questGuest: configQuest ? configQuest.invitado : null,
                points: configQuest ? configQuest.points : 100,
                photoUrl: progress.photoUrl,
                submittedAt: progress.submittedAt
              });
            }
          });
        });
      }

      // Sort by submission time (oldest first)
      pendingSubmissions.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

      if (validationCountSpan) {
        validationCountSpan.textContent = pendingSubmissions.length;
      }

      if (pendingSubmissions.length === 0) {
        submissionsList.innerHTML = `<p style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">No hay misiones pendientes de aprobación.</p>`;
        return;
      }

      pendingSubmissions.forEach(sub => {
        const row = document.createElement('div');
        row.style.background = 'rgba(255,255,255,0.02)';
        row.style.border = '1px solid var(--card-border)';
        row.style.borderRadius = '15px';
        row.style.padding = '15px';
        row.style.display = 'flex';
        row.style.flexDirection = 'column';
        row.style.gap = '10px';

        // Header: Mesa name + Points badge
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const title = document.createElement('div');
        title.style.fontWeight = 'bold';
        title.style.color = 'white';
        const displayMesaName = sub.mesa.toLowerCase().startsWith('mesa') ? sub.mesa : `Mesa ${sub.mesa}`;
        title.textContent = displayMesaName;

        const pointsBadge = document.createElement('span');
        pointsBadge.className = 'badge badge-approved';
        pointsBadge.style.fontSize = '0.75rem';
        pointsBadge.textContent = `+${sub.points} pts`;

        header.appendChild(title);
        header.appendChild(pointsBadge);

        // Body: Quest Text
        const bodyText = document.createElement('p');
        bodyText.style.margin = '0';
        bodyText.style.fontSize = '0.85rem';
        bodyText.style.color = 'var(--text-muted)';
        bodyText.textContent = sub.questText;
        if (sub.questGuest && sub.questGuest !== 'Todos') {
          const guestTag = document.createElement('span');
          guestTag.style.color = 'var(--gold-primary)';
          guestTag.style.fontSize = '0.75rem';
          guestTag.style.fontWeight = '500';
          guestTag.style.marginLeft = '8px';
          guestTag.textContent = `(Invitado: ${sub.questGuest})`;
          bodyText.appendChild(guestTag);
        }

        // Image container (if photoUrl exists)
        let imgContainer = null;
        if (sub.photoUrl) {
          imgContainer = document.createElement('div');
          imgContainer.style.position = 'relative';
          imgContainer.style.width = '100%';
          imgContainer.style.maxHeight = '150px';
          imgContainer.style.borderRadius = '10px';
          imgContainer.style.overflow = 'hidden';
          imgContainer.style.border = '1px solid rgba(255,255,255,0.1)';
          imgContainer.style.cursor = 'pointer';

          const img = document.createElement('img');
          img.src = sub.photoUrl;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          
          imgContainer.appendChild(img);

          // Click to expand functionality using alerts or basic overlay
          imgContainer.addEventListener('click', () => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.background = 'rgba(0,0,0,0.9)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.zIndex = '99999';

            const bigImg = document.createElement('img');
            bigImg.src = sub.photoUrl;
            bigImg.style.maxWidth = '90%';
            bigImg.style.maxHeight = '90%';
            bigImg.style.borderRadius = '15px';
            bigImg.style.boxShadow = '0 0 30px rgba(0,0,0,0.5)';

            overlay.appendChild(bigImg);
            overlay.addEventListener('click', () => overlay.remove());
            document.body.appendChild(overlay);
          });
        }

        // Actions: Approve / Reject
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '10px';

        const btnApprove = document.createElement('button');
        btnApprove.type = 'button';
        btnApprove.className = 'btn btn-primary';
        btnApprove.style.flex = '1';
        btnApprove.style.padding = '8px 12px';
        btnApprove.style.fontSize = '0.8rem';
        btnApprove.style.borderRadius = '10px';
        btnApprove.textContent = 'Aprobar';
        btnApprove.addEventListener('click', () => {
          triggerCapitanesControl('approve', sub.mesa, sub.questId);
        });

        const btnReject = document.createElement('button');
        btnReject.type = 'button';
        btnReject.className = 'btn btn-danger';
        btnReject.style.flex = '1';
        btnReject.style.padding = '8px 12px';
        btnReject.style.fontSize = '0.8rem';
        btnReject.style.borderRadius = '10px';
        btnReject.textContent = 'Rechazar';
        btnReject.addEventListener('click', () => {
          triggerCapitanesControl('reject', sub.mesa, sub.questId);
        });

        actions.appendChild(btnApprove);
        actions.appendChild(btnReject);

        row.appendChild(header);
        row.appendChild(bodyText);
        if (imgContainer) row.appendChild(imgContainer);
        row.appendChild(actions);

        submissionsList.appendChild(row);
      });
    }
  }

  function updateAdminTimerDisplay() {
    if (!timerDisplay) return;
    if (!capitanesStateExpiresAt) {
      timerDisplay.textContent = '10:00';
      return;
    }
    const diff = Math.max(0, Math.round((new Date(capitanesStateExpiresAt).getTime() - Date.now()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // Send Admin control action (start, pause, reset, approve, reject)
  function triggerCapitanesControl(action, mesa = null, questId = null) {
    const body = { action };
    if (mesa) body.mesa = mesa;
    if (questId) body.questId = questId;

    fetch(`/api/capitanes/control?event=${encodeURIComponent(eventId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data.success) {
        showToast('success', '¡Éxito!', `Operación ${action} procesada con éxito.`);
        // Instantly sync state
        syncAdminCapitanesStateWithPoll();
      } else {
        showToast('error', 'Error', data.error || 'Error al procesar la acción.');
      }
    })
    .catch(err => {
      console.error('Error triggering Capitanes control:', err);
      showToast('error', 'Error', 'Error de comunicación con el servidor. Asegúrate de que el backend esté actualizado y corriendo.');
    });
  }

  // Wire Control Buttons
  if (btnStart) btnStart.addEventListener('click', () => triggerCapitanesControl('start'));
  if (btnPause) btnPause.addEventListener('click', () => triggerCapitanesControl('pause'));
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      showConfirm(
        '¿Reiniciar Capitanes de Mesa?',
        '¿Estás seguro de que deseas reiniciar la actividad? Se perderá todo el progreso de las mesas.',
        () => triggerCapitanesControl('reset')
      );
    });
  }
  if (btnCapitanesProjector) {
    btnCapitanesProjector.addEventListener('click', () => {
      window.open(`/capitanes-screen.html?event=${encodeURIComponent(eventId)}`, '_blank');
    });
  }

  if (btnPrintCapitanesGeneralQr) {
    btnPrintCapitanesGeneralQr.addEventListener('click', () => {
      document.body.classList.add('print-mode-single');
      document.body.classList.remove('print-mode-multi-tables');
      preparePrintPoster('capitanes');
      setTimeout(() => {
        window.print();
      }, 250);
    });
  }

  if (btnPrintCapitanesTablesQr) {
    btnPrintCapitanesTablesQr.addEventListener('click', () => {
      if (!allTables || allTables.length === 0) {
        showToast('error', '¡Atención!', 'No hay mesas configuradas en este evento para generar códigos QR.');
        return;
      }
      
      const container = document.getElementById('print-capitanes-grid-container');
      if (!container) return;
      
      container.innerHTML = '';
      const eventTitleVal = (eventTitleInput ? eventTitleInput.value.trim() : '') || 'Jano\'s Eventos';
      
      allTables.forEach(t => {
        const targetUrl = `${siteOrigin}/capitanes-client.html?event=${encodeURIComponent(eventId)}&mesa=${encodeURIComponent(t.name)}`;
        const printQrUrl = `${qrBaseUrl}?size=450x450&data=${encodeURIComponent(targetUrl)}&color=000000&bgcolor=ffffff`;
        
        const card = document.createElement('div');
        card.className = 'print-capitanes-card';
        card.innerHTML = `
          <div>
            <div class="print-capitanes-card-header">Capitanes de Mesa</div>
            <div class="print-capitanes-card-event">${eventTitleVal}</div>
            <div class="print-capitanes-card-divider"></div>
            <div class="print-capitanes-card-table">Mesa ${t.name}</div>
          </div>
          <div class="print-capitanes-card-qr-container">
            <img src="${printQrUrl}" alt="Mesa ${t.name}" class="print-capitanes-card-qr">
          </div>
          <div class="print-capitanes-card-instructions">
            <strong>Capitan de mesa ACTIVO!</strong> Todos los integrantes deberán escanear el codigo QR ubicado en sus mesas para descubrir quien es el <strong>CAPITAN DE MESA</strong> asignado!
          </div>
        `;
        container.appendChild(card);
      });
      
      document.body.classList.add('print-mode-multi-tables');
      document.body.classList.remove('print-mode-single');
      
      setTimeout(() => {
        window.print();
      }, 400);
    });
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('print-mode-single', 'print-mode-multi-tables');
  });
});

