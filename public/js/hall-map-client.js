/**
 * Hall Map Client - Interactive 2D Map & GPS Experience for Guests
 * miFiestAPP / QR Mesas Jano's
 */

(function () {
  'use strict';

  let currentLayout = null;
  let targetTableName = '';
  let guestFullName = '';
  let currentEventId = 'default';

  // Pan & Zoom state
  let scale = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  // DOM Elements
  let modalEl = null;
  let viewportEl = null;
  let worldEl = null;
  let drawerEl = null;

  // Hito icons map
  const LANDMARK_ICONS = {
    dj: '🎧',
    barra: '🍷',
    escenario: '👑',
    entrada: '🚪',
    banos: '🚻',
    fotobooth: '📸',
    pantalla: '📺',
    pista: '🪩',
    candy: '🍰',
    escaleras: '🪜',
    salida: '🚨',
    camino: '🛣️',
    mesa_principal: '👑'
  };

  // Build deterministic table number mapping (Mesa 1..N) preserving explicit numbers
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

  /**
   * Initialize DOM elements for Hall Map Modal
   */
  function createModalDOM() {
    if (document.getElementById('hall-map-modal')) {
      return;
    }

    const modalHTML = `
      <div id="hall-map-modal" class="hall-map-modal">
        <!-- Header -->
        <div class="hall-map-header">
          <div class="hall-map-header-info">
            <div class="hall-map-title">
              <span>🗺️ MAPA DEL SALÓN</span>
            </div>
            <div class="hall-map-subtitle" id="hall-map-subtitle">Ubicación asignada en tiempo real</div>
          </div>
          <button type="button" class="hall-map-close-btn" id="hall-map-close" title="Cerrar mapa">✕</button>
        </div>

        <!-- Viewport -->
        <div class="hall-map-viewport" id="hall-map-viewport">
          <div class="hall-map-world" id="hall-map-world">
            <svg id="hall-svg-map" class="hall-svg-canvas"></svg>
          </div>

          <!-- Unified Bottom Floating Toolbar -->
          <div class="hall-map-unified-toolbar">
            <div class="toolbar-legend-group">
              <div class="legend-pill"><span class="legend-dot-entry"></span> Ingreso</div>
              <div class="legend-pill target-pill"><span class="legend-dot-target"></span> <span id="toolbar-target-pill-text">📍 Tu Mesa</span></div>
            </div>
            <div class="toolbar-actions-group">
              <button type="button" class="hall-ctrl-btn" id="btn-recenter-table">
                <span>🎯 Centrar mi Mesa</span>
              </button>
              <div class="zoom-buttons-wrapper">
                <button type="button" class="hall-ctrl-btn hall-ctrl-btn-icon" id="btn-zoom-in" title="Acercar">+</button>
                <button type="button" class="hall-ctrl-btn hall-ctrl-btn-icon" id="btn-zoom-out" title="Alejar">−</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tablemates Bottom Drawer -->
        <div class="tablemates-drawer" id="tablemates-drawer">
          <div class="drawer-drag-handle"></div>
          <div class="drawer-header">
            <div class="drawer-title">
              <span>👥 Compañeros de Mesa</span>
            </div>
            <span class="drawer-table-badge" id="drawer-table-name">Mesa 1</span>
            <button type="button" class="drawer-close" id="drawer-close">✕</button>
          </div>
          <div class="drawer-guests-list" id="drawer-guests-list">
            <div style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">Cargando lista de invitados...</div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    modalEl = document.getElementById('hall-map-modal');
    viewportEl = document.getElementById('hall-map-viewport');
    worldEl = document.getElementById('hall-map-world');
    drawerEl = document.getElementById('tablemates-drawer');

    // Attach Event Listeners
    document.getElementById('hall-map-close').addEventListener('click', closeHallMap);
    document.getElementById('drawer-close').addEventListener('click', closeDrawer);
    document.getElementById('btn-recenter-table').addEventListener('click', recenterOnTargetTable);
    document.getElementById('btn-zoom-in').addEventListener('click', () => zoom(1.2));
    document.getElementById('btn-zoom-out').addEventListener('click', () => zoom(0.83));

    // Pan & Zoom Listeners
    setupPanAndZoom();
  }

  /**
   * Setup Pan & Zoom handlers for desktop mouse and mobile touch
   */
  function setupPanAndZoom() {
    viewportEl.addEventListener('mousedown', (e) => {
      if (e.target.closest('.hall-map-unified-toolbar') || e.target.closest('.tablemates-drawer')) return;
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Touch events for mobile
    let touchStartDist = 0;

    viewportEl.addEventListener('touchstart', (e) => {
      if (e.target.closest('.hall-map-unified-toolbar') || e.target.closest('.tablemates-drawer')) return;
      if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - panY;
      } else if (e.touches.length === 2) {
        isDragging = false;
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    viewportEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isDragging) {
        panX = e.touches[0].clientX - startX;
        panY = e.touches[0].clientY - startY;
        applyTransform();
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (touchStartDist > 0) {
          const factor = dist / touchStartDist;
          zoom(factor);
          touchStartDist = dist;
        }
      }
    });

    viewportEl.addEventListener('touchend', () => {
      isDragging = false;
      touchStartDist = 0;
    });

    // Mouse Wheel Zoom
    viewportEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      zoom(zoomFactor);
    }, { passive: false });
  }

  function zoom(factor) {
    const newScale = Math.min(Math.max(scale * factor, 0.85), 2.2);
    scale = newScale;
    applyTransform();
  }

  function clampPan() {
    if (!viewportEl) return;
    const vpW = viewportEl.clientWidth || window.innerWidth;
    const vpH = viewportEl.clientHeight || window.innerHeight;
    const boardW = 900 * scale;
    const boardH = 600 * scale;

    const minX = vpW - boardW - (vpW * 0.35);
    const maxX = vpW * 0.35;
    const minY = vpH - boardH - (vpH * 0.35);
    const maxY = vpH * 0.35;

    panX = Math.min(Math.max(panX, minX), maxX);
    panY = Math.min(Math.max(panY, minY), maxY);
  }

  function applyTransform() {
    if (worldEl) {
      clampPan();
      worldEl.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }
  }

  /**
   * Fetch Hall Layout from Server
   */
  async function fetchLayout(eventId) {
    try {
      const res = await fetch(`/api/public/hall-layout?event=${encodeURIComponent(eventId)}`);
      if (!res.ok) throw new Error('Error al cargar plano');
      const data = await res.json();
      return data || { items: [], tablePositions: {} };
    } catch (err) {
      console.warn('Fallback hall layout fetch failed:', err);
      return { items: [], tablePositions: {} };
    }
  }

  /**
   * Fetch Tablemates for a specific table
   */
  async function fetchTablemates(eventId, tableName) {
    try {
      const res = await fetch(`/api/public/table-guests?event=${encodeURIComponent(eventId)}&table=${encodeURIComponent(tableName)}`);
      if (!res.ok) throw new Error('Error al cargar integrantes');
      const data = await res.json();
      return data.guests || [];
    } catch (err) {
      console.error('Error fetching tablemates:', err);
      return [];
    }
  }

  function toPixelX(val, width) {
    if (typeof val !== 'number') return 0;
    return val <= 100 ? (val / 100) * width : val;
  }

  function toPixelY(val, height) {
    if (typeof val !== 'number') return 0;
    return val <= 100 ? (val / 100) * height : val;
  }

  /**
   * Render SVG Map
   */
  function renderSvgMap() {
    const svgEl = document.getElementById('hall-svg-map');
    if (!svgEl) return;

    const items = currentLayout.items || [];
    const tablePositions = currentLayout.tablePositions || {};
    const boardHeight = currentLayout.boardHeight || 600;
    const boardWidth = 900; // standard width scale

    svgEl.setAttribute('viewBox', `0 0 ${boardWidth} ${boardHeight}`);
    svgEl.setAttribute('width', boardWidth);
    svgEl.setAttribute('height', boardHeight);

    let targetCoords = null;
    let entryCoords = null;

    // Build defs
    let svgContent = `
      <defs>
        <linearGradient id="gold-emerald-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#34d399" />
          <stop offset="100%" stop-color="#10b981" />
        </linearGradient>
        <filter id="glow-gold" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id="glow-emerald" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
    `;

    // 1. Find Entry point coordinates if available
    const entryItem = items.find(i => i.type === 'entrada' || (i.name && i.name.toLowerCase().includes('entrada')));
    if (entryItem) {
      const ePxX = toPixelX(entryItem.x, boardWidth);
      const ePxY = toPixelY(entryItem.y, boardHeight);
      entryCoords = { x: ePxX + 50, y: ePxY + 25 };
    } else {
      // Default entry point at bottom center if not explicitly placed
      entryCoords = { x: boardWidth / 2, y: boardHeight - 40 };
    }

    // 2. Render Landmarks (Items)
    items.forEach(item => {
      const icon = LANDMARK_ICONS[item.type] || '📌';
      const isMesaPrincipal = item.type === 'mesa_principal' || (item.name && item.name.toLowerCase().includes('mesa principal'));
      const isTargetMesa = isMesaPrincipal && isNormalizedTableMatch(targetTableName, item.name || 'Mesa Principal');
      const rot = item.rotation || 0;
      const scale = item.scale || 1.0;

      const pxX = toPixelX(item.x, boardWidth);
      const pxY = toPixelY(item.y, boardHeight);

      const itemWidth = isMesaPrincipal ? 140 : 100;
      const itemHeight = isMesaPrincipal ? 60 : 50;

      if (isTargetMesa) {
        targetCoords = { x: pxX + itemWidth / 2, y: pxY + itemHeight / 2 };
      }

      if (item.type === 'entrada' && !entryItem) {
        entryCoords = { x: pxX + itemWidth / 2, y: pxY + itemHeight / 2 };
      }

      const isEntry = item.type === 'entrada' || (item.name && (item.name.toLowerCase().includes('entrada') || item.name.toLowerCase().includes('ingreso')));

      svgContent += `
        <g class="landmark-group ${isTargetMesa ? 'target-landmark' : ''}" 
           transform="translate(${pxX}, ${pxY}) rotate(${rot}, ${itemWidth / 2}, ${itemHeight / 2}) scale(${scale})" 
           onclick="window.__hallMapSelectTable('${escapeHtml(item.name)}')">
          <rect width="${itemWidth}" height="${itemHeight}" rx="12" 
                fill="${isMesaPrincipal ? 'rgba(212, 175, 55, 0.25)' : 'rgba(30, 34, 52, 0.85)'}" 
                stroke="${isMesaPrincipal ? '#d4af37' : 'rgba(212, 175, 55, 0.35)'}" 
                stroke-width="${isMesaPrincipal ? '2.5' : '1.5'}" />
          <text x="${itemWidth / 2}" y="${itemHeight / 2}" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="12" font-weight="600">
            ${icon} ${escapeHtml(item.name || 'Hito')}
          </text>
        </g>
      `;
    });

    // 3. Render Numbered Tables using buildTableNumberMapping
    const processedNormalizedTables = new Set();
    const landmarkNames = new Set(
      items.map(i => (i.name || '').trim().toLowerCase().replace(/^mesa\s*/i, ''))
    );
    const uniqueTableKeys = [];
    const rawKeys = Object.keys(tablePositions);

    rawKeys.forEach(tName => {
      const normalized = tName.trim().toLowerCase().replace(/^mesa\s*/i, '');
      if (landmarkNames.has(normalized) && (normalized === 'principal' || normalized === 'mesa principal')) {
        return;
      }
      if (!processedNormalizedTables.has(normalized)) {
        processedNormalizedTables.add(normalized);
        uniqueTableKeys.push(tName);
      }
    });

    const tableMapping = buildTableNumberMapping(uniqueTableKeys);

    uniqueTableKeys.forEach(tName => {
      const pos = tablePositions[tName];
      const isTarget = isNormalizedTableMatch(tName, targetTableName);

      const pxX = toPixelX(pos.x, boardWidth);
      const pxY = toPixelY(pos.y, boardHeight);

      const radius = 34;
      const cx = pxX + radius;
      const cy = pxY + radius;
      const rot = pos.rotation || 0;
      const scale = pos.scale || 1.0;

      if (isTarget) {
        targetCoords = { x: cx, y: cy };
      }

      const isPresidencial = /principal|presidencial\b/i.test(tName);
      const info = tableMapping[tName] || { numOnly: '1' };
      const displayName = isPresidencial ? '👑' : info.numOnly;

      svgContent += `
        <g class="map-table-group ${isTarget ? 'target' : ''}" 
           transform="translate(${cx}, ${cy}) rotate(${rot}) scale(${scale})" 
           onclick="window.__hallMapSelectTable('${escapeHtml(tName)}')">
          ${isTarget ? `
            <circle class="radar-beacon" cx="0" cy="0" r="38" fill="none" stroke="#10b981" stroke-width="3" />
            <circle class="radar-beacon-delayed" cx="0" cy="0" r="38" fill="none" stroke="#34d399" stroke-width="2" />
          ` : ''}
          <circle class="map-table-circle" cx="0" cy="0" r="${radius}" />
          <text class="map-table-text" x="0" y="0" text-anchor="middle" dominant-baseline="central" font-size="${isPresidencial ? '16' : '15'}" font-weight="800">${displayName}</text>
        </g>
      `;
    });

    // 4. Render Animated Path Trail from Entry to Target Table
    if (entryCoords && targetCoords) {
      const midX = (entryCoords.x + targetCoords.x) / 2;
      const midY = (entryCoords.y + targetCoords.y) / 2 - 40;
      const pathD = `M ${entryCoords.x} ${entryCoords.y} Q ${midX} ${midY} ${targetCoords.x} ${targetCoords.y}`;

      svgContent += `
        <!-- Entry Point Marker -->
        <g transform="translate(${entryCoords.x}, ${entryCoords.y})">
          <circle r="14" fill="rgba(59, 130, 246, 0.25)" stroke="#3b82f6" stroke-width="2" />
          <text text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="10">🚪</text>
        </g>

        <!-- Route Trail Line -->
        <path class="hall-route-line-bg" d="${pathD}" />
        <path class="hall-route-line-animated" d="${pathD}" />
      `;
    }

    svgEl.innerHTML = svgContent;

    // Auto-center view on target table
    if (targetCoords) {
      setTimeout(() => {
        centerOnCoords(targetCoords.x, targetCoords.y);
      }, 100);
    }
  }

  function isNormalizedTableMatch(t1, t2) {
    if (!t1 || !t2) return false;
    const clean1 = String(t1).trim().toLowerCase().replace(/^mesa\s*/i, '');
    const clean2 = String(t2).trim().toLowerCase().replace(/^mesa\s*/i, '');
    return clean1 === clean2 || String(t1).trim().toLowerCase() === String(t2).trim().toLowerCase();
  }

  function centerOnCoords(x, y) {
    if (!viewportEl) return;
    const viewportWidth = viewportEl.clientWidth || window.innerWidth;
    const viewportHeight = viewportEl.clientHeight || window.innerHeight;

    scale = 1.35;
    panX = (viewportWidth / 2) - (x * scale);
    panY = (viewportHeight / 2) - (y * scale);
    applyTransform();
  }

  function recenterOnTargetTable() {
    renderSvgMap();
  }

  /**
   * Open Tablemates Bottom Sheet Drawer
   */
  async function openDrawerForTable(tableName) {
    if (!drawerEl) return;

    const tablePositions = currentLayout?.tablePositions || {};
    const tableMapping = buildTableNumberMapping(Object.keys(tablePositions));
    const info = tableMapping[tableName] || { numberStr: tableName, alias: tableName };
    const isCustomAlias = Boolean(info.alias && !/^mesa\s*\d+$/i.test(info.alias));
    const drawerTitleText = isCustomAlias ? `${info.numberStr} • ${info.alias}` : info.numberStr;

    document.getElementById('drawer-table-name').textContent = drawerTitleText;
    const listEl = document.getElementById('drawer-guests-list');
    listEl.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">Cargando invitados de ${escapeHtml(drawerTitleText)}...</div>`;
    drawerEl.classList.add('open');

    const guests = await fetchTablemates(currentEventId, tableName);

    if (guests.length === 0) {
      listEl.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">No hay integrantes registrados en esta mesa aún.</div>`;
      return;
    }

    listEl.innerHTML = guests.map(g => `
      <div class="drawer-guest-card">
        <div class="drawer-guest-name">
          <span>👤</span> ${escapeHtml(g.firstName)} ${escapeHtml(g.lastName)}
        </div>
        <span class="drawer-guest-status ${g.rsvp ? 'confirmed' : 'pending'}">
          ${g.rsvp ? '✓ Confirmado' : 'Pendiente'}
        </span>
      </div>
    `).join('');
  }

  function closeDrawer() {
    if (drawerEl) {
      drawerEl.classList.remove('open');
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // Global helper to handle table click inside SVG
  window.__hallMapSelectTable = function (tableName) {
    openDrawerForTable(tableName);
  };

  /**
   * PUBLIC API: Open Hall Map Modal
   */
  async function openHallMap(options = {}) {
    createModalDOM();

    currentEventId = options.eventId || 'default';
    targetTableName = options.tableName || 'Sin Mesa';
    guestFullName = options.guestName || 'Invitado VIP';

    currentLayout = await fetchLayout(currentEventId);

    // Resolve numeric table number for toolbar pill
    const tablePositions = currentLayout?.tablePositions || {};
    const tableMapping = buildTableNumberMapping(Object.keys(tablePositions));
    const info = tableMapping[targetTableName] || { numberStr: targetTableName };
    const targetNumStr = info.numberStr;

    const targetPillEl = document.getElementById('toolbar-target-pill-text');
    if (targetPillEl) {
      targetPillEl.textContent = targetTableName && targetTableName.toLowerCase() !== 'sin mesa' ? `📍 Tu Mesa: ${targetNumStr}` : '📍 Tu Mesa';
    }

    document.getElementById('hall-map-subtitle').textContent = `${guestFullName} • ${targetNumStr}`;

    modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';

    renderSvgMap();
  }

  /**
   * PUBLIC API: Close Hall Map Modal
   */
  function closeHallMap() {
    if (modalEl) {
      modalEl.classList.remove('active');
      document.body.style.overflow = '';
      closeDrawer();
    }
  }

  // Export functions to global window object
  window.HallMapClient = {
    open: openHallMap,
    close: closeHallMap
  };

})();
