document.addEventListener('DOMContentLoaded', () => {
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

  function showConfirm(title, message, onAccept) {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    activeConfirmCallback = onAccept;
    confirmModal.classList.add('active');
  }

  function hideConfirm() {
    confirmModal.classList.remove('active');
    activeConfirmCallback = null;
  }

  if (btnConfirmCancel) btnConfirmCancel.addEventListener('click', hideConfirm);
  if (btnConfirmAccept) {
    btnConfirmAccept.addEventListener('click', () => {
      if (activeConfirmCallback) activeConfirmCallback();
      hideConfirm();
    });
  }

  // Active guest list state
  let allGuests = [];

  // Set up QR codes pointing to Guest view
  const siteOrigin = window.location.origin;
  const qrBaseUrl = 'https://api.qrserver.com/v1/create-qr-code/';
  
  // Set screen QR
  const screenQrUrl = `${qrBaseUrl}?size=150x150&data=${encodeURIComponent(siteOrigin)}&color=0b0b0c&bgcolor=ffffff`;
  qrCodeContainer.innerHTML = `<img src="${screenQrUrl}" alt="QR Code" style="display: block;">`;

  // Set print QR
  const printQrUrl = `${qrBaseUrl}?size=500x500&data=${encodeURIComponent(siteOrigin)}&color=000000&bgcolor=ffffff`;
  printQrImg.src = printQrUrl;

  // Initialize page
  checkSession();
  loadStats();
  loadConfig();
  loadGuests();

  // Print QR Poster trigger
  btnPrintQr.addEventListener('click', () => {
    window.print();
  });

  // Logout trigger
  btnLogout.addEventListener('click', () => {
    fetch('/api/admin/logout', { method: 'POST' })
      .then(() => {
        window.location.href = '/login.html';
      });
  });

  // Save Event Title Config
  btnSaveTitle.addEventListener('click', () => {
    const eventTitle = eventTitleInput.value.trim();
    if (!eventTitle) {
      showTitleStatus('Por favor, ingresa un nombre para el evento.', 'error');
      return;
    }

    fetch('/api/config', {
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
    window.location.href = '/api/admin/download-excel';
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
  fileDropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });

  fileDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDropZone.classList.add('dragover');
  });

  fileDropZone.addEventListener('dragleave', () => {
    fileDropZone.classList.remove('dragover');
  });

  fileDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDropZone.classList.remove('dragover');
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
    fetch('/api/admin/check')
      .then(res => res.json())
      .then(data => {
        if (!data.loggedIn) {
          window.location.href = '/login.html';
        }
      })
      .catch(() => {
        window.location.href = '/login.html';
      });
  }

  // Load Config from API
  function loadConfig() {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => {
        eventTitleInput.value = data.eventTitle || '';
        printEventTitle.textContent = data.eventTitle || 'Ubicación de Mesas';
      })
      .catch(err => console.error('Error config:', err));
  }

  // Load Stats from API
  function loadStats() {
    fetch('/api/stats')
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
    fetch('/api/admin/guests')
      .then(res => res.json())
      .then(data => {
        allGuests = data;
        renderGuestsTable();
      })
      .catch(err => {
        console.error('Error fetching guests:', err);
      });
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
        <td style="color: var(--gold-primary); font-weight: 600;">Mesa ${g.table}</td>
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
        <span class="table-row-name">Mesa ${t.name}</span>
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
    const url = isEdit ? `/api/guests/${idx}` : '/api/guests';
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
        } else {
          alert('Error al guardar el invitado: ' + (data.error || 'error desconocido'));
        }
      })
      .catch(err => {
        console.error(err);
        alert('Error de red al intentar guardar.');
      });
  }

  // Clear database logic
  function clearDatabase() {
    fetch('/api/clear', { method: 'POST' })
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

    fetch('/api/upload', {
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
        fetch(`/api/guests/${index}`, { method: 'DELETE' })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              loadStats();
              loadGuests();
            } else {
              alert('Error al intentar eliminar.');
            }
          })
          .catch(err => {
            console.error(err);
            alert('Error de red al intentar eliminar.');
          });
      }
    );
  };
});
