document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('event') || 'default';

  // Elements
  const fileDropZone = document.getElementById('file-drop-zone');
  const fileInput = document.getElementById('excel-file-input');
  const uploadStatus = document.getElementById('upload-status');
  const statGuests = document.getElementById('stat-guests');
  const statTables = document.getElementById('stat-tables');
  const tablesBreakdownList = document.getElementById('tables-breakdown-list');
  const btnClearDb = document.getElementById('btn-clear-db');
  const qrCodeContainer = document.getElementById('qr-code-container');
  const btnPrintQr = document.getElementById('btn-print-qr');
  const printQrImg = document.getElementById('print-qr-img');
  
  // Phase 2 Elements
  const btnLogout = document.getElementById('btn-logout');
  const eventTitleInput = document.getElementById('event-title-input');
  const btnSaveTitle = document.getElementById('btn-save-title');
  const titleStatus = document.getElementById('title-status');
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

  // Confirm Modal Elements
  const confirmModal = document.getElementById('confirm-modal');
  const confirmTitle = document.getElementById('confirm-modal-title');
  const confirmMessage = document.getElementById('confirm-modal-message');
  const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
  const btnConfirmAccept = document.getElementById('btn-confirm-accept');

  let activeConfirmCallback = null;

  // Tabs elements
  const tabBtnMesas = document.getElementById('tab-btn-mesas');
  const tabBtnFotos = document.getElementById('tab-btn-fotos');
  const tabMesas = document.getElementById('tab-mesas');
  const tabFotos = document.getElementById('tab-fotos');

  // Photo grid elements
  const pendingPhotosGrid = document.getElementById('pending-photos-grid');
  const approvedPhotosGrid = document.getElementById('approved-photos-grid');

  // Photo polling state
  let photoIntervalId = null;

  function switchTab(tabId) {
    if (tabId === 'mesas') {
      if (tabBtnMesas) tabBtnMesas.classList.add('active');
      if (tabBtnFotos) tabBtnFotos.classList.remove('active');
      if (tabMesas) tabMesas.classList.add('active');
      if (tabFotos) tabFotos.classList.remove('active');
      stopPhotoPolling();
    } else if (tabId === 'fotos') {
      if (tabBtnMesas) tabBtnMesas.classList.remove('active');
      if (tabBtnFotos) tabBtnFotos.classList.add('active');
      if (tabMesas) tabMesas.classList.remove('active');
      if (tabFotos) tabFotos.classList.add('active');
      loadPhotos();
      startPhotoPolling();
    }
  }

  function startPhotoPolling() {
    if (photoIntervalId) clearInterval(photoIntervalId);
    photoIntervalId = setInterval(loadPhotos, 10000);
  }

  function stopPhotoPolling() {
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
            <h4>${escapeHtml(p.guestName)}</h4>
            <p>${escapeHtml(p.message || '')}</p>
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
            <h4>${escapeHtml(p.guestName)}</h4>
            <p>${escapeHtml(p.message || '')}</p>
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

  // Set up QR codes pointing to Guest view
  const siteOrigin = window.location.origin;
  const qrBaseUrl = 'https://api.qrserver.com/v1/create-qr-code/';

  const qrInstructionsText = document.getElementById('qr-instructions-text');
  const btnPrintPhotosQr = document.getElementById('btn-print-photos-qr');
  const btnSavePhotosTitle = document.getElementById('btn-save-photos-title');
  const eventTitlePhotosInput = document.getElementById('event-title-photos-input');
  const photosTitleStatus = document.getElementById('photos-title-status');
  const btnClearPhotos = document.getElementById('btn-clear-photos');
  const btnViewGuestView = document.getElementById('btn-view-guest-view');

  const activeService = urlParams.get('service');

  function updateQR() {
    const isPhotos = (activeService === 'photos');
    const targetPath = isPhotos ? '/fotos' : '/mesas';
    const targetUrl = `${siteOrigin}${targetPath}?event=${encodeURIComponent(eventId)}`;

    // Generate QR code URLs
    const screenQrUrl = `${qrBaseUrl}?size=150x150&data=${encodeURIComponent(targetUrl)}&color=0b0b0c&bgcolor=ffffff`;
    const printQrUrl = `${qrBaseUrl}?size=500x500&data=${encodeURIComponent(targetUrl)}&color=000000&bgcolor=ffffff`;

    // 1. Set the correct QR images depending on active service
    if (isPhotos) {
      const qrPhotosContainer = document.getElementById('qr-photos-code-container');
      if (qrPhotosContainer) {
        qrPhotosContainer.innerHTML = `<img src="${screenQrUrl}" alt="QR Code" style="display: block;">`;
      }
      
      const qrPhotosInstructionsText = document.getElementById('qr-photos-instructions-text');
      if (qrPhotosInstructionsText) {
        qrPhotosInstructionsText.textContent = 'Imprime el cartel con el QR oficial para ubicarlo en el salón. Los invitados podrán escanearlo para subir y compartir sus fotos al instante.';
      }
    } else {
      if (qrCodeContainer) {
        qrCodeContainer.innerHTML = `<img src="${screenQrUrl}" alt="QR Code" style="display: block;">`;
      }
      
      if (qrInstructionsText) {
        qrInstructionsText.textContent = 'Imprime el cartel con el QR oficial para ubicarlo en la recepción del salón. Los invitados podrán escanearlo al llegar para encontrar su mesa asignada.';
      }
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
      printTitle.textContent = isPhotos ? 'Muro de Fotos' : 'Ubicación de Mesas';
    }
    if (printSubtitle) {
      printSubtitle.textContent = isPhotos ? 'Comparte tus Momentos' : 'Encuentra tu Mesa';
    }
    if (printInstructions) {
      printInstructions.innerHTML = isPhotos 
        ? 'Escanéa este código con la cámara de tu celular<br>para subir fotos y mensajes al muro.'
        : 'Escanéa este código con la cámara de tu celular<br>para consultar tu mesa asignada.';
    }
  }

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
  } else {
    switchTab('mesas');
    loadStats();
    loadGuests();
  }

  // Set header guest view link path
  if (btnViewGuestView) {
    btnViewGuestView.href = (activeService === 'photos')
      ? `/fotos?event=${encodeURIComponent(eventId)}`
      : `/mesas?event=${encodeURIComponent(eventId)}`;
  }

  // Wire Photos specific settings listeners
  if (btnSavePhotosTitle && eventTitlePhotosInput) {
    btnSavePhotosTitle.addEventListener('click', () => {
      const eventTitle = eventTitlePhotosInput.value.trim();
      if (!eventTitle) {
        showPhotosTitleStatus('Por favor, ingresa un nombre para el evento.', 'error');
        return;
      }

      fetch(`/api/config?event=${encodeURIComponent(eventId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventTitle })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            showPhotosTitleStatus('Título del evento guardado correctamente.', 'success');
            if (printEventTitle) printEventTitle.textContent = eventTitle;
            // Sync the tables title input too if it exists on page
            if (eventTitleInput) eventTitleInput.value = eventTitle;
          } else {
            showPhotosTitleStatus('Error al guardar la configuración.', 'error');
          }
        })
        .catch(err => {
          console.error(err);
          showPhotosTitleStatus('Error de red al guardar la configuración.', 'error');
        });
    });
  }

  function showPhotosTitleStatus(message, type) {
    if (!photosTitleStatus) return;
    photosTitleStatus.textContent = message;
    photosTitleStatus.className = 'status-msg';
    photosTitleStatus.classList.add(type);
    photosTitleStatus.style.display = 'block';
    setTimeout(() => {
      photosTitleStatus.style.display = 'none';
    }, 4000);
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

  // Print QR Poster trigger
  if (btnPrintQr) {
    btnPrintQr.addEventListener('click', () => {
      window.print();
    });
  }

  if (btnPrintPhotosQr) {
    btnPrintPhotosQr.addEventListener('click', () => {
      window.print();
    });
  }

  // Salir trigger (volver al home)
  btnLogout.addEventListener('click', () => {
    window.location.href = `/?event=${encodeURIComponent(eventId)}`;
  });

  // Save Event Title Config
  btnSaveTitle.addEventListener('click', () => {
    const eventTitle = eventTitleInput.value.trim();
    if (!eventTitle) {
      showTitleStatus('Por favor, ingresa un nombre para el evento.', 'error');
      return;
    }

    fetch(`/api/config?event=${encodeURIComponent(eventId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventTitle })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showTitleStatus('Título del evento guardado correctamente.', 'success');
          printEventTitle.textContent = eventTitle;
        } else {
          showTitleStatus('Error al guardar la configuración.', 'error');
        }
      })
      .catch(err => {
        console.error(err);
        showTitleStatus('Error de red al guardar la configuración.', 'error');
      });
  });

  // Export Mapped Excel
  btnExportExcel.addEventListener('click', () => {
    window.location.href = `/api/admin/download-excel?event=${encodeURIComponent(eventId)}`;
  });

  // Clear database button
  btnClearDb.addEventListener('click', () => {
    showConfirm(
      'Limpiar Base de Datos',
      '¿Está seguro de que desea limpiar toda la base de datos de invitados? Esta acción no se puede deshacer.',
      () => {
        clearDatabase();
      }
    );
  });

  // Drag and Drop events
  fileDropZone.addEventListener('click', (e) => {
    if (e.target !== fileInput) {
      fileInput.click();
    }
  });

  fileInput.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    fileDropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileDropZone.addEventListener(eventName, () => {
      fileDropZone.classList.remove('dragover');
    });
  });

  fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
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
    guestModal.classList.add('active');
  });

  btnCloseModal.addEventListener('click', () => {
    guestModal.classList.remove('active');
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
          window.location.href = `/login.html?event=${encodeURIComponent(eventId)}`;
        }
      })
      .catch(() => {
        window.location.href = `/login.html?event=${encodeURIComponent(eventId)}`;
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
        if (eventTitleInput) eventTitleInput.value = data.eventTitle || '';
        if (eventTitlePhotosInput) eventTitlePhotosInput.value = data.eventTitle || '';
        
        if (printEventTitle) {
          printEventTitle.textContent = data.eventTitle || 'Ubicación de Mesas';
        }
        
        if (data.clientName) {
          const headerTitle = document.querySelector('.logo-group h1');
          const isPhotos = (activeService === 'photos');
          if (headerTitle) {
            headerTitle.textContent = `${isPhotos ? 'Control de Fotos' : 'Control de Mesas'} • ${data.clientName}`;
          }
          document.title = `${isPhotos ? 'Moderación de Fotos' : 'Control de Mesas'} | ${data.clientName}`;
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
        renderTablesList(data.tables || []);
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
        renderGuestsTable();
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
    const filter = adminGuestSearch.value.trim().toLowerCase();
    const filteredGuests = allGuests.map((g, index) => ({ ...g, originalIndex: index }))
      .filter(g => {
        const fullName = `${g.firstName} ${g.lastName}`.toLowerCase();
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

    tablesBreakdownList.innerHTML = tables.map(t => `
      <div class="table-row">
        <span class="table-row-name">${formatTableDisplay(t.name)}</span>
        <span class="table-row-count">${t.count} ${t.count === 1 ? 'invitado' : 'invitados'}</span>
      </div>
    `).join('');
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
          loadStats();
          loadGuests();
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

  // Clear database logic
  function clearDatabase() {
    fetch(`/api/clear?event=${encodeURIComponent(eventId)}`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showStatus('Base de datos limpiada correctamente.', 'success');
          loadStats();
          loadGuests();
        } else {
          showStatus('Error al limpiar la base de datos.', 'error');
        }
      })
      .catch(err => {
        console.error('Error clearing database:', err);
        showStatus('Error de conexión con el servidor.', 'error');
      });
  }

  // Upload file logic
  function handleFileUpload(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      showStatus('Tipo de archivo no permitido. Suba un .xlsx, .xls o .csv.', 'error');
      return;
    }

    showStatus('Subiendo y procesando archivo...', 'success');
    fileDropZone.style.opacity = '0.5';

    const formData = new FormData();
    formData.append('file', file);

    fetch(`/api/upload?event=${encodeURIComponent(eventId)}`, {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(data => {
        fileDropZone.style.opacity = '1';
        fileInput.value = ''; // Clear file input
        
        if (data.success) {
          showStatus(`¡Lista cargada con éxito! Se procesaron ${data.count} invitados.`, 'success');
          loadStats();
          loadGuests();
        } else {
          showStatus(data.error || 'Error al procesar el archivo.', 'error');
        }
      })
      .catch(err => {
        fileDropZone.style.opacity = '1';
        fileInput.value = '';
        console.error('Error uploading file:', err);
        showStatus('Error al subir el archivo al servidor.', 'error');
      });
  }

  // Show status feedback helper
  function showStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = 'status-msg'; // reset classes
    uploadStatus.classList.add(type);
  }

  // Show title status helper
  function showTitleStatus(message, type) {
    titleStatus.textContent = message;
    titleStatus.className = 'status-msg';
    titleStatus.classList.add(type);
    titleStatus.style.display = 'block';
    setTimeout(() => {
      titleStatus.style.display = 'none';
    }, 4000);
  }

  // Expose CRUD helper triggers to window since table templates use them inline
  window.openEditGuestModal = (index) => {
    const guest = allGuests[index];
    modalTitle.textContent = 'Editar Invitado';
    guestIndexInput.value = index;
    modalFirstName.value = guest.firstName;
    modalLastName.value = guest.lastName;
    modalTable.value = guest.table;
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
});

