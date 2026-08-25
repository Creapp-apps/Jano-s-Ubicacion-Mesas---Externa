const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const csvParser = require('csv-parser');
const ExcelJS = require('exceljs');
const { searchGuests } = require('./utils/search');
const db = require('./utils/db');
const { sendWelcomeEmail } = require('./utils/email');
const { exec } = require('child_process');
const { triviaCoordinator, TRIVIA_TEMPLATES } = require('./utils/trivia');
const { capitanesCoordinator } = require('./utils/capitanes');
const tandaBattle = require('./utils/tanda-battle');
const awardsEngine = require('./utils/awards-engine');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mifiestapp2026';
// Persistent session tokens (resilient to server restarts in development)
const ADMIN_SESSION_TOKEN = process.env.ADMIN_SESSION_TOKEN || 'mifiestapp-default-admin-session-secret-2026';
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'mifiestapp-superadmin';
const SUPERADMIN_SESSION_TOKEN = process.env.SUPERADMIN_SESSION_TOKEN || 'super_mifiestapp-default-superadmin-session-secret-2026';

const UPLOADS_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'uploads');
if (UPLOADS_DIR !== '/tmp' && !fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    console.warn('[miFiestAPP Server] Local UPLOADS_DIR creation ignored/failed (read-only filesystem):', err.message);
  }
}

// Custom Cookie Parser middleware
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      req.cookies[parts[0].trim()] = (parts[1] || '').trim();
    });
  }
  next();
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Validation Middleware: Ensure the Event ID is registered and active
async function validateEventAccess(req, res, next) {
  const filePath = req.path;
  if (
    filePath.startsWith('/api/superadmin') ||
    filePath === '/api/admin/login' ||
    filePath === '/api/admin/logout' ||
    filePath === '/superadmin' ||
    filePath === '/superlogin' ||
    filePath === '/inactive' ||
    filePath === '/inactive.html' ||
    filePath === '/superlogin.html' ||
    filePath === '/favicon.ico' ||
    filePath === '/complementos' ||
    filePath === '/complementos.html' ||
    filePath.startsWith('/css') ||
    filePath.startsWith('/js') ||
    filePath.startsWith('/uploads')
  ) {
    return next();
  }

  let eventId = req.query.event;
  if (!eventId && req.headers.referer) {
    try {
      const refererUrl = new URL(req.headers.referer);
      eventId = refererUrl.searchParams.get('event');
    } catch (e) {
      // Ignore
    }
  }

  // If we are accessing the root or index.html or complementos and no custom eventId is provided (or eventId is 'default'),
  // we are requesting the landing / public catalog page and don't need event validation.
  if ((filePath === '/' || filePath === '/index.html' || filePath === '/complementos' || filePath === '/complementos.html') && (!eventId || eventId === 'default')) {
    return next();
  }

  eventId = eventId || 'default';

  try {
    const isValid = await db.isEventValid(eventId);
    if (!isValid) {
      // If it is a JSON API request
      if (req.xhr || req.headers.accept?.includes('application/json') || filePath.startsWith('/api/')) {
        return res.status(403).json({ error: 'El Combo Digital ha expirado o no está activo.' });
      }
      // Otherwise, redirect to the inactive page
      return res.redirect(`/inactive.html?event=${eventId}`);
    }
    next();
  } catch (err) {
    console.error('Error validating event access:', err);
    next(); // Fail open on error
  }
}

app.use(validateEventAccess);

app.get('/admin.html', (req, res) => {
  const queryParams = new URLSearchParams(req.query);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  res.redirect(`/admin${queryString}`);
});

// Clean slug routing (e.g. /xvmica -> /event.html?event=xvmica)
app.get(['/app', '/app.html'], async (req, res) => {
  const eventId = req.query.event || 'default';
  try {
    const filePath = path.join(__dirname, 'public', 'app.html');
    let html = await fs.promises.readFile(filePath, 'utf8');
    const config = await db.getConfigValues(eventId);
    const eventTheme = config['event_theme'] || 'golden-luxury';
    html = injectThemeIntoHtml(html, eventTheme);
    return res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
  }
});

app.get(['/event', '/event.html'], async (req, res) => {
  const eventId = req.query.event || 'default';
  try {
    const filePath = path.join(__dirname, 'public', 'event.html');
    let html = await fs.promises.readFile(filePath, 'utf8');
    const config = await db.getConfigValues(eventId);
    const eventTheme = config['event_theme'] || 'golden-luxury';
    html = injectThemeIntoHtml(html, eventTheme);
    return res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'public', 'event.html'));
  }
});

app.get(['/awards-screen', '/awards-screen.html'], async (req, res) => {
  const eventId = req.query.event || 'default';
  try {
    const filePath = path.join(__dirname, 'public', 'awards-screen.html');
    let html = await fs.promises.readFile(filePath, 'utf8');
    const config = await db.getConfigValues(eventId);
    const eventTheme = config['event_theme'] || 'golden-luxury';
    html = injectThemeIntoHtml(html, eventTheme);
    return res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'public', 'awards-screen.html'));
  }
});

app.get('/:eventId', async (req, res, next) => {
  const eventId = req.params.eventId;
  const staticRoutes = [
    'fotos', 'proyeccion', 'mesas', 'invitacion', 'app', 'awards-screen', 'awards',
    'admin', 'superadmin', 'superlogin', 'inactive', 'complementos',
    'api', 'css', 'js', 'uploads', 'assets', 'favicon.ico', 
    'event.html', 'index.html', 'landing.html', '404.html', 'login.html', 'complementos.html', 'app.html', 'awards-screen.html'
  ];
  if (staticRoutes.includes(eventId) || eventId.includes('.')) {
    return next();
  }

  try {
    const isValid = await db.isEventValid(eventId);
    if (isValid) {
      const queryParams = new URLSearchParams(req.query);
      queryParams.set('event', eventId);
      return res.redirect(`/event.html?${queryParams.toString()}`);
    }
  } catch (err) {
    console.error('Error in slug routing:', err);
  }
  next();
});

// Helper to format date beautifully in Spanish (e.g. YYYY-MM-DD to "DD de Mes de YYYY")
function formatDateToSpanish(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} de ${months[monthIndex]} de ${year}`;
    }
  }
  return dateStr;
}

// Serve dynamic invitation with premium rich metadata (Open Graph / WhatsApp)
app.get(['/invitacion', '/invitacion.html'], async (req, res) => {
  const eventId = req.query.event || 'default';
  let eventTitle = '';
  let config = {};
  
  try {
    const events = await db.getEvents();
    const event = events.find(e => e.id === eventId);
    if (event && event.serviceInvitation === false) {
      return res.redirect(`/event.html?event=${encodeURIComponent(eventId)}`);
    }
    config = await db.getConfigValues(eventId);
    eventTitle = config['event_title'] || '';
  } catch (err) {
    console.error('Error checking service availability or config:', err);
  }

  try {
    const filePath = path.join(__dirname, 'public', 'invitacion.html');
    let html = await fs.promises.readFile(filePath, 'utf8');

    // Guest name from query param 'n'
    const guestName = (req.query.n || '').trim();
    
    // Custom Titles and Descriptions for premium previews
    let displayTitle = '';
    let ogTitle = '';
    let ogDescription = '';
    
    const datePart = config['invitation_event_date'] ? formatDateToSpanish(config['invitation_event_date']) : '';
    const addressPart = config['invitation_party_address'] || '';
    const dateAndLoc = `${datePart ? ` (${datePart})` : ''}${addressPart ? ` en ${addressPart}` : ''}`;

    if (guestName) {
      displayTitle = `¡${guestName}, estás invitado/a! 💌 | ${eventTitle || 'miFiestAPP'}`;
      ogTitle = `✨ ¡${guestName}, tenés una invitación especial!`;
      ogDescription = `${eventTitle ? `${eventTitle} 🥂` : 'Te invitamos a celebrar este día tan especial 🥂'}${dateAndLoc} | Hacé clic para abrir tu tarjeta interactiva personalizada, ver detalles, mapas y confirmar asistencia.`;
    } else {
      displayTitle = eventTitle ? `Invitación Interactiva | ${eventTitle}` : 'Invitación Interactiva';
      ogTitle = eventTitle ? `✨ ¡Invitación Especial | ${eventTitle}! 🥂` : '✨ ¡Tenés una invitación especial! 🥂';
      ogDescription = `${eventTitle || 'Nuestra Fiesta'} ${dateAndLoc} | Hacé clic para abrir la invitación interactiva, ver ubicación, sugerir música y confirmar asistencia.`;
    }

    // Clean any existing Open Graph / Twitter tags to avoid duplicates
    html = html.replace(/<meta\s+(property|name)=["'](og|twitter):[^>]+>/gi, '');

    // Dynamic replacement of <title>
    html = html.replace(/<title>.*?<\/title>/, () => `<title>${displayTitle}</title>`);
    
    // Construct dynamic image URL (absolute URL required by crawlers like WhatsApp)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    
    const configuredImage = config['invitation_photo_1'] || config['invitation_cover_url'] || config['invitation_bg_url'] || '';
    let ogImageUrl = '';
    
    if (configuredImage) {
      if (configuredImage.startsWith('http://') || configuredImage.startsWith('https://')) {
        ogImageUrl = configuredImage;
      } else {
        const cleanImagePath = configuredImage.startsWith('/') ? configuredImage : `/${configuredImage}`;
        ogImageUrl = `${baseUrl}${cleanImagePath}`;
      }
    } else {
      ogImageUrl = `${baseUrl}/assets/coronamain.png`;
    }

    // Inject Open Graph tags for premium WhatsApp previews
    const ogMeta = `
  <!-- Open Graph / WhatsApp / Facebook -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}${req.originalUrl}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="miFiestAPP" />

  <!-- Twitter Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${ogImageUrl}" />`;

    // Inject Theme CSS and Pre-populate body classes
    const invThemeColor = config['invitation_theme_color'] || config['inv_theme_color'] || config['event_theme'] || 'golden-luxury';
    const invThemeFont = config['invitation_theme_font'] || config['inv_theme_font'] || 'classic-editorial';
    let invCardModel = (config['invitation_card_model'] || config['inv_card_model'] || 'imperial-gold').replace('card-model-', '');
    if (req.query.model || req.query.modelId || req.query.cardModel) {
      invCardModel = (req.query.model || req.query.modelId || req.query.cardModel).replace('card-model-', '');
    }

    const themeStyle = generateThemeCss(invThemeColor);
    html = html.replace('</head>', () => `${ogMeta}\n${themeStyle}\n</head>`);
    html = html.replace(/<body(\s+[^>]*)?>/i, () => `<body class="card-model-${invCardModel} theme-${invThemeColor} font-${invThemeFont}">`);
    
    res.send(html);
  } catch (err) {
    console.error('Error serving dynamic invitation page:', err);
    res.sendFile(path.join(__dirname, 'public', 'invitacion.html'));
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
async function requireAuth(req, res, next) {
  const eventId = req.query.event || req.body.event || 'default';
  const cookieName = `admin_session_${eventId}`;
  if (req.cookies && req.cookies[cookieName] === `${ADMIN_SESSION_TOKEN}_${eventId}`) {
    return next();
  }
  if (req.cookies && req.cookies.superadmin_session === SUPERADMIN_SESSION_TOKEN) {
    return next();
  }
  const vendorSession = req.cookies ? req.cookies.vendor_session : null;
  if (vendorSession) {
    try {
      const events = await db.getEvents();
      const targetEvent = events.find(e => e.id === eventId);
      if (targetEvent && targetEvent.vendorId === vendorSession) {
        return next();
      }
    } catch (e) {}
  }
  res.status(401).json({ error: 'No autorizado. Inicie sesión.' });
}

function requireSuperAuth(req, res, next) {
  if (req.cookies && req.cookies.superadmin_session === SUPERADMIN_SESSION_TOKEN) {
    return next();
  }
  res.status(401).json({ error: 'No autorizado. Inicie sesión como Superadmin.' });
}

async function requireVendorAuth(req, res, next) {
  const vendorSession = req.cookies ? req.cookies.vendor_session : null;
  if (!vendorSession) {
    return res.status(401).json({ error: 'No autorizado. Inicie sesión como vendedor.' });
  }

  try {
    const vendors = await db.getVendors();
    const vendor = vendors.find(v => v.id === vendorSession && v.active);

    if (!vendor) {
      return res.status(401).json({ error: 'Sesión de vendedor inválida o cuenta desactivada.' });
    }

    req.vendor = vendor;
    req.vendorId = vendor.id;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar sesión de vendedor.' });
  }
}


// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch (e) {}
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max limit
});

// API: Search guests
app.get('/api/guests/search', async (req, res) => {
  const query = req.query.q;
  const eventId = req.query.event || 'default';
  if (!query) {
    return res.json([]);
  }
  
  try {
    const guests = await db.getGuests(eventId);
    const results = searchGuests(query, guests);
    res.json(results);
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ error: 'Error al buscar invitados' });
  }
});

// API: Stats (For Admin)
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const guests = await db.getGuests(eventId);
    const rsvps = await db.getRsvps(eventId);

    const confirmedNames = new Set(
      rsvps
        .filter(r => r.attending === true)
        .map(r => r.name.trim().toLowerCase())
    );

    const confirmedGuests = guests.filter(g => {
      const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
      return confirmedNames.has(fullName);
    });

    // Helper to format table name consistently
    function formatTableName(name) {
      if (!name) return 'Sin Mesa';
      let t = String(name).trim();
      if (!t || t.toLowerCase() === 'sin mesa') return 'Sin Mesa';
      if (/^\d+$/.test(t)) return `Mesa ${t}`;
      if (/^mesa\b/i.test(t)) return t.replace(/^mesa\s*/i, 'Mesa ');
      if (t.toLowerCase() === 'mesa principal' || t.toLowerCase() === 'principal') return 'Mesa Principal';
      return t;
    }

    // Read custom defined tables from event config
    const customTablesRaw = await db.getConfigValue(eventId, 'custom_tables', '[]');
    let customTables = [];
    try { customTables = JSON.parse(customTablesRaw); } catch(e){}

    const tablesMap = {};

    if (Array.isArray(customTables)) {
      customTables.forEach(ct => {
        const formatted = formatTableName(ct.name);
        tablesMap[formatted] = { name: formatted, capacity: ct.capacity || 10, count: 0, totalCount: 0 };
      });
    }

    // Count unique tables from all guests, and track confirmed counts
    guests.forEach(g => {
      if (g.table) {
        const tableName = formatTableName(g.table);
        if (tableName && tableName.toLowerCase() !== 'sin mesa') {
          const existingKey = Object.keys(tablesMap).find(k => k.toLowerCase() === tableName.toLowerCase()) || tableName;
          if (!tablesMap[existingKey]) {
            tablesMap[existingKey] = { name: existingKey, capacity: 10, count: 0, totalCount: 0 };
          }
          tablesMap[existingKey].totalCount += 1;
          
          const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
          if (confirmedNames.has(fullName)) {
            tablesMap[existingKey].count += 1;
          }
        }
      }
    });
    
    // Also check if custom_hall_layout has mesa_principal placed on canvas
    const layoutRaw = await db.getConfigValue(eventId, 'custom_hall_layout', '{}');
    let layout = {};
    try { layout = JSON.parse(layoutRaw); } catch(e){}
    const layoutItems = Array.isArray(layout.items) ? layout.items : [];
    const hasMesaPrincipalLandmark = layoutItems.some(item => item.type === 'mesa_principal' || item.name === 'Mesa Principal');

    if (hasMesaPrincipalLandmark && !tablesMap['Mesa Principal']) {
      tablesMap['Mesa Principal'] = { name: 'Mesa Principal', capacity: 10, count: 0, totalCount: 0 };
    }

    const tables = Object.values(tablesMap).sort((a, b) => {
      if (a.name.toLowerCase().includes('principal')) return -1;
      if (b.name.toLowerCase().includes('principal')) return 1;
      const numA = parseInt(a.name.replace(/\D/g, ''), 10);
      const numB = parseInt(b.name.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.name.localeCompare(b.name);
    });

    res.json({
      guestCount: confirmedGuests.length,
      tableCount: tables.length,
      tables
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// API: Create new table
app.post('/api/admin/tables', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const { name, capacity } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nombre de mesa es requerido' });
    }

    const tableName = name.trim();
    const tableCap = parseInt(capacity, 10) || 10;

    const customTablesRaw = await db.getConfigValue(eventId, 'custom_tables', '[]');
    let customTables = [];
    try { customTables = JSON.parse(customTablesRaw); } catch(e){}

    const existingIdx = customTables.findIndex(t => t.name.toLowerCase() === tableName.toLowerCase());
    if (existingIdx >= 0) {
      customTables[existingIdx].capacity = tableCap;
    } else {
      customTables.push({ name: tableName, capacity: tableCap });
    }

    await db.setConfigValue(eventId, 'custom_tables', JSON.stringify(customTables));
    res.json({ success: true, table: { name: tableName, capacity: tableCap } });
  } catch (error) {
    console.error('Error creating table:', error);
    res.status(500).json({ error: 'Error al crear la mesa' });
  }
});

// API: Rename table
app.post('/api/admin/rename-table', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const { oldName, newName } = req.body;
    if (!oldName || !newName || !oldName.trim() || !newName.trim()) {
      return res.status(400).json({ error: 'Nombres de mesa requeridos' });
    }

    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();

    if (trimmedOld.toLowerCase() === trimmedNew.toLowerCase()) {
      return res.json({ success: true, message: 'Nombres idénticos' });
    }

    // 1. Update custom_tables in config
    const customTablesRaw = await db.getConfigValue(eventId, 'custom_tables', '[]');
    let customTables = [];
    try { customTables = JSON.parse(customTablesRaw); } catch(e){}

    const existingIdx = customTables.findIndex(t => t.name.toLowerCase() === trimmedOld.toLowerCase());
    if (existingIdx >= 0) {
      customTables[existingIdx].name = trimmedNew;
    } else {
      customTables.push({ name: trimmedNew, capacity: 10 });
    }
    await db.setConfigValue(eventId, 'custom_tables', JSON.stringify(customTables));

    // 2. Update custom_hall_layout in config
    const layoutRaw = await db.getConfigValue(eventId, 'custom_hall_layout', '{}');
    let layout = {};
    try { layout = JSON.parse(layoutRaw); } catch(e){}
    if (layout.tablePositions) {
      const oldClean = trimmedOld.toLowerCase().replace(/^mesa\s*/i, '');
      const matchingKeys = Object.keys(layout.tablePositions).filter(k => {
        const kClean = k.trim().toLowerCase().replace(/^mesa\s*/i, '');
        return kClean === oldClean || k.trim().toLowerCase() === trimmedOld.toLowerCase();
      });

      let posToKeep = { x: 20, y: 20, rotation: 0 };
      matchingKeys.forEach(key => {
        if (layout.tablePositions[key]) posToKeep = layout.tablePositions[key];
        delete layout.tablePositions[key];
      });

      layout.tablePositions[trimmedNew] = posToKeep;
      await db.setConfigValue(eventId, 'custom_hall_layout', JSON.stringify(layout));
    }

    // 3. Migrate assigned guests from oldName to newName
    const guests = await db.getGuests(eventId);
    let updatedGuestsCount = 0;
    for (let i = 0; i < guests.length; i++) {
      const g = guests[i];
      if (g.table && g.table.trim().toLowerCase() === trimmedOld.toLowerCase()) {
        const targetId = g.id !== undefined ? g.id : i;
        await db.updateGuest(eventId, targetId, { ...g, table: trimmedNew });
        updatedGuestsCount++;
      }
    }

    res.json({
      success: true,
      oldName: trimmedOld,
      newName: trimmedNew,
      updatedGuestsCount
    });
  } catch (error) {
    console.error('Error renaming table:', error);
    res.status(500).json({ error: 'Error al renombrar la mesa' });
  }
});

// API: Delete individual table
app.post('/api/admin/delete-table', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || (req.body && req.body.event) || 'default';
    const { tableName } = req.body;
    if (!tableName || !tableName.trim()) {
      return res.status(400).json({ error: 'Nombre de mesa es requerido' });
    }

    const targetTable = tableName.trim();

    // 1. Remove from custom_tables in config
    const customTablesRaw = await db.getConfigValue(eventId, 'custom_tables', '[]');
    let customTables = [];
    try { customTables = JSON.parse(customTablesRaw); } catch(e){}
    customTables = customTables.filter(t => t.name.trim().toLowerCase() !== targetTable.toLowerCase());
    await db.setConfigValue(eventId, 'custom_tables', JSON.stringify(customTables));

    // 2. Remove position from custom_hall_layout in config
    const layoutRaw = await db.getConfigValue(eventId, 'custom_hall_layout', '{}');
    let layout = {};
    try { layout = JSON.parse(layoutRaw); } catch(e){}
    if (layout.tablePositions) {
      const targetClean = targetTable.toLowerCase().replace(/^mesa\s*/i, '');
      Object.keys(layout.tablePositions).forEach(key => {
        const kClean = key.trim().toLowerCase().replace(/^mesa\s*/i, '');
        if (kClean === targetClean || key.trim().toLowerCase() === targetTable.toLowerCase()) {
          delete layout.tablePositions[key];
        }
      });
      await db.setConfigValue(eventId, 'custom_hall_layout', JSON.stringify(layout));
    }

    // 3. Unassign guests from this table
    const guests = await db.getGuests(eventId);
    let unassignedCount = 0;
    for (let i = 0; i < guests.length; i++) {
      const g = guests[i];
      if (g.table && g.table.trim().toLowerCase() === targetTable.toLowerCase()) {
        const targetId = g.id !== undefined ? g.id : i;
        await db.updateGuest(eventId, targetId, { ...g, table: 'Sin Mesa' });
        unassignedCount++;
      }
    }

    res.json({
      success: true,
      message: `Mesa "${targetTable}" eliminada correctamente`,
      unassignedGuests: unassignedCount
    });
  } catch (error) {
    console.error('Error deleting table:', error);
    res.status(500).json({ error: 'Error al eliminar la mesa' });
  }
});

// API: Get Hall Layout Positions & Landmarks
app.get('/api/admin/hall-layout', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const layoutRaw = await db.getConfigValue(eventId, 'custom_hall_layout', '{}');
    let layout = {};
    try { layout = JSON.parse(layoutRaw); } catch(e){}
    res.json(layout);
  } catch (error) {
    console.error('Error getting hall layout:', error);
    res.status(500).json({ error: 'Error al obtener distribución del salón' });
  }
});

// API: Save Hall Layout Positions & Landmarks
app.post('/api/admin/hall-layout', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const { items, tablePositions, boardHeight } = req.body;
    const layoutData = {
      items: items || [],
      tablePositions: tablePositions || {},
      boardHeight: boardHeight || null
    };
    await db.setConfigValue(eventId, 'custom_hall_layout', JSON.stringify(layoutData));
    res.json({ success: true, layout: layoutData });
  } catch (error) {
    console.error('Error saving hall layout:', error);
    res.status(500).json({ error: 'Error al guardar distribución del salón' });
  }
});

// API: Reset Hall Layout & Clear Tables
app.post('/api/admin/tables/reset', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || (req.body && req.body.event) || 'default';

    // 1. Reset custom_tables in config to empty array
    await db.setConfigValue(eventId, 'custom_tables', JSON.stringify([]));

    // 2. Unassign table for all guests of this event
    const guests = await db.getGuests(eventId);
    for (let i = 0; i < guests.length; i++) {
      const g = guests[i];
      if (g.table && String(g.table).toLowerCase() !== 'sin mesa') {
        const targetId = g.id !== undefined ? g.id : i;
        await db.updateGuest(eventId, targetId, { ...g, table: 'Sin Mesa' });
      }
    }

    // 3. Save completely cleared reset layout (no placed items, no table positions)
    const resetLayout = {
      items: [],
      tablePositions: {},
      boardHeight: 540
    };
    await db.setConfigValue(eventId, 'custom_hall_layout', JSON.stringify(resetLayout));

    res.json({
      success: true,
      message: 'Plano del salón restablecido correctamente',
      layout: resetLayout
    });
  } catch (error) {
    console.error('Error resetting hall layout:', error);
    res.status(500).json({ error: 'Error al restablecer el plano del salón' });
  }
});

// API: Public Get Hall Layout Positions & Landmarks (Read-only for guests)
app.get('/api/public/hall-layout', async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const layoutRaw = await db.getConfigValue(eventId, 'custom_hall_layout', '{}');
    let layout = {};
    try { layout = JSON.parse(layoutRaw); } catch(e){}
    res.json(layout);
  } catch (error) {
    console.error('Error getting public hall layout:', error);
    res.status(500).json({ error: 'Error al obtener distribución del salón' });
  }
});

// API: Public Get Tablemates / Guests for a specific table
app.get('/api/public/table-guests', async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const tableName = (req.query.table || '').trim();
    if (!tableName) {
      return res.status(400).json({ error: 'Mesa no especificada' });
    }
    const allGuests = await db.getGuests(eventId);
    const normTarget = tableName.toLowerCase();
    const tablemates = allGuests
      .filter(g => g.table && String(g.table).trim().toLowerCase() === normTarget)
      .map(g => ({
        firstName: g.firstName,
        lastName: g.lastName,
        rsvp: g.rsvp || null
      }));
    res.json({ table: tableName, guests: tablemates });
  } catch (error) {
    console.error('Error getting table guests:', error);
    res.status(500).json({ error: 'Error al obtener invitados de la mesa' });
  }
});


// API: Clear database
app.post('/api/clear', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    await db.clearGuests(eventId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: 'Error al limpiar los datos' });
  }
});

// API: Get network IP for local Wi-Fi testing (Public)
app.get('/api/debug/network-ip', (req, res) => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  let localIp = 'localhost';
  for (const name of Object.keys(networkInterfaces)) {
    for (const net of networkInterfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIp = net.address;
        break;
      }
    }
  }
  res.json({ localIp });
});

// Official Catalog of Curated miFiestAPP Event Themes
const OFFICIAL_THEMES = {
  'golden-luxury': {
    id: 'golden-luxury',
    name: 'Golden Luxury',
    icon: '👑',
    tagline: 'Elegancia Clásica & Oro Champagne',
    primaryColor: '#d4af37',
    secondaryColor: '#aa7c11',
    accentGlow: 'rgba(212, 175, 55, 0.25)',
    bgColor: '#0b0b0c',
    glow1: 'rgba(212, 175, 55, 0.16)',
    glow2: 'rgba(139, 92, 246, 0.10)',
    crownFilter: 'drop-shadow(0 0 16px rgba(212, 175, 55, 0.55))',
    fontFamily: "'Cinzel', serif",
    invitationModel: 'imperial-gold',
    invitationColor: 'golden-luxury',
    invitationEffect: 'golden-dust',
    invitationFont: 'classic-editorial'
  },
  'rose-gold': {
    id: 'rose-gold',
    name: 'Rose Gold Glam',
    icon: '🌸',
    tagline: 'Romántico, Chic & Oro Rosa',
    primaryColor: '#e0a899',
    secondaryColor: '#b76e79',
    accentGlow: 'rgba(224, 168, 153, 0.30)',
    bgColor: '#0d0b0f',
    glow1: 'rgba(224, 168, 153, 0.20)',
    glow2: 'rgba(183, 110, 121, 0.15)',
    crownFilter: 'hue-rotate(305deg) saturate(1.4) brightness(1.1) drop-shadow(0 0 18px rgba(224, 168, 153, 0.6))',
    fontFamily: "'Playfair Display', serif",
    invitationModel: 'editorial-luxe',
    invitationColor: 'rose-gold',
    invitationEffect: 'rose-petals',
    invitationFont: 'romantic-serif'
  },
  'cyber-neon': {
    id: 'cyber-neon',
    name: 'Cyber Neon Party',
    icon: '⚡',
    tagline: 'Moderno, Neón, Cian & Magenta',
    primaryColor: '#00f3ff',
    secondaryColor: '#ff007f',
    accentGlow: 'rgba(0, 243, 255, 0.35)',
    bgColor: '#080511',
    glow1: 'rgba(0, 243, 255, 0.22)',
    glow2: 'rgba(255, 0, 127, 0.18)',
    crownFilter: 'hue-rotate(145deg) saturate(2.6) brightness(1.15) drop-shadow(0 0 22px rgba(0, 243, 255, 0.75))',
    fontFamily: "'Montserrat', sans-serif",
    invitationModel: 'cyber-neon',
    invitationColor: 'cyber-neon',
    invitationEffect: 'neon-cyber-grid',
    invitationFont: 'modern-sans'
  },
  'emerald-royal': {
    id: 'emerald-royal',
    name: 'Emerald Royal',
    icon: '🌲',
    tagline: 'Verde Esmeralda Profundo & Dorado',
    primaryColor: '#2ec4b6',
    secondaryColor: '#0d5c46',
    accentGlow: 'rgba(46, 196, 182, 0.30)',
    bgColor: '#060d0a',
    glow1: 'rgba(46, 196, 182, 0.20)',
    glow2: 'rgba(212, 175, 55, 0.14)',
    crownFilter: 'hue-rotate(95deg) saturate(1.9) brightness(1.05) drop-shadow(0 0 18px rgba(46, 196, 182, 0.65))',
    fontFamily: "'Cinzel', serif",
    invitationModel: 'botanical',
    invitationColor: 'emerald-royal',
    invitationEffect: 'golden-dust',
    invitationFont: 'classic-editorial'
  },
  'midnight-navy': {
    id: 'midnight-navy',
    name: 'Midnight Navy',
    icon: '🌌',
    tagline: 'Azul Noche Zafiro & Oro Estelar',
    primaryColor: '#4cc9f0',
    secondaryColor: '#1e3a8a',
    accentGlow: 'rgba(76, 201, 240, 0.30)',
    bgColor: '#050a14',
    glow1: 'rgba(76, 201, 240, 0.22)',
    glow2: 'rgba(212, 175, 55, 0.12)',
    crownFilter: 'hue-rotate(185deg) saturate(2.2) brightness(1.1) drop-shadow(0 0 20px rgba(76, 201, 240, 0.7))',
    fontFamily: "'Cinzel', serif",
    invitationModel: 'editorial-luxe',
    invitationColor: 'midnight-navy',
    invitationEffect: 'stars-cosmic',
    invitationFont: 'classic-editorial'
  },
  'boho-rust': {
    id: 'boho-rust',
    name: 'Boho Chic Rust',
    icon: '🌾',
    tagline: 'Terracota, Arena & Cobre Cálido',
    primaryColor: '#e07a5f',
    secondaryColor: '#81b29a',
    accentGlow: 'rgba(224, 122, 95, 0.30)',
    bgColor: '#0e0b09',
    glow1: 'rgba(224, 122, 95, 0.20)',
    glow2: 'rgba(238, 217, 196, 0.12)',
    crownFilter: 'hue-rotate(335deg) saturate(1.3) sepia(0.25) drop-shadow(0 0 16px rgba(224, 122, 95, 0.55))',
    fontFamily: "'Outfit', sans-serif",
    invitationModel: 'terracotta',
    invitationColor: 'boho-rust',
    invitationEffect: 'golden-dust',
    invitationFont: 'boho-sans'
  },
  'retro-disco': {
    id: 'retro-disco',
    name: 'Retro Disco 80/90s',
    icon: '🪩',
    tagline: 'Púrpura Cósmico & Neón Flúor',
    primaryColor: '#ff0080',
    secondaryColor: '#7928ca',
    accentGlow: 'rgba(255, 0, 128, 0.35)',
    bgColor: '#0b0614',
    glow1: 'rgba(255, 0, 128, 0.22)',
    glow2: 'rgba(121, 40, 202, 0.20)',
    crownFilter: 'hue-rotate(265deg) saturate(2.8) brightness(1.2) drop-shadow(0 0 22px rgba(255, 0, 128, 0.75))',
    fontFamily: "'Syncopate', sans-serif",
    invitationModel: 'retro-disco',
    invitationColor: 'retro-disco',
    invitationEffect: 'disco-lights',
    invitationFont: 'modern-sans'
  }
};

/**
 * Generates an inline CSS block with root theme variables to prevent FOUC / theme flickering
 */
function generateThemeCss(themeDetailsOrId) {
  let themeObj = themeDetailsOrId;
  if (typeof themeDetailsOrId === 'string') {
    themeObj = OFFICIAL_THEMES[themeDetailsOrId] || OFFICIAL_THEMES['golden-luxury'];
  }
  if (!themeObj || typeof themeObj !== 'object') {
    themeObj = OFFICIAL_THEMES['golden-luxury'];
  }

  function hexToRgb(hex) {
    if (!hex) return '212, 175, 55';
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return '212, 175, 55';
    return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
  }

  const primColor = themeObj.primaryColor || '#d4af37';
  const secColor = themeObj.secondaryColor || '#aa7c11';
  const primRgb = hexToRgb(primColor);
  const secRgb = hexToRgb(secColor);
  const fontFam = themeObj.fontFamily || "'Cinzel', serif";
  const bgColor = themeObj.bgColor || '#0b0b0c';
  const crownFilter = themeObj.crownFilter || 'drop-shadow(0 0 16px rgba(212, 175, 55, 0.55))';

  return `
  <!-- SSR Injected Theme (Zero Flicker / Instant Color Palette) -->
  <style id="mifiestapp-injected-theme">
    :root {
      --primary-rgb: ${primRgb};
      --secondary-rgb: ${secRgb};
      --gold-primary: ${primColor};
      --gold-secondary: ${secColor};
      --gold-light: ${primColor};
      --gold-gradient: linear-gradient(135deg, #ffffff 0%, ${primColor} 50%, ${secColor} 100%);
      --card-border: rgba(${primRgb}, 0.15);
      --card-border-active: rgba(${primRgb}, 0.5);
      --border-gold: rgba(${primRgb}, 0.25);
      --border-gold-bright: ${primColor};
      --gold-glow: 0 0 25px rgba(${primRgb}, 0.25);
      --glow-shadow: 0 0 25px rgba(${primRgb}, 0.25);
      --accent-font: ${fontFam};
      --bg-dark: ${bgColor};
      --bg-color: ${bgColor};
      --bg-radial: radial-gradient(circle at 50% 10%, rgba(${primRgb}, 0.12) 0%, ${bgColor} 90%);
    }
    #admin-header-crown, #header-crown-logo, .logo-container img, .app-brand img, .gatekeeper-logo, #sidebar-avatar, #header-avatar-badge img {
      filter: ${crownFilter} !important;
    }
    .mesh-glow-1 {
      background: radial-gradient(circle, ${themeObj.glow1 || `rgba(${primRgb}, 0.22)`} 0%, transparent 70%) !important;
    }
    .mesh-glow-2 {
      background: radial-gradient(circle, ${themeObj.glow2 || `rgba(${secRgb}, 0.16)`} 0%, transparent 70%) !important;
    }
  </style>`;
}

function injectThemeIntoHtml(html, themeDetailsOrId) {
  if (!html) return html;
  const themeStyle = generateThemeCss(themeDetailsOrId);
  if (html.includes('</head>')) {
    return html.replace('</head>', `${themeStyle}\n</head>`);
  }
  return themeStyle + html;
}

// API: Get config (Public)
app.get('/api/config', async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    
    // Fetch all config keys and the specific event details in parallel (single DB roundtrip)
    const [config, event] = await Promise.all([
      db.getConfigValues(eventId),
      db.getEvent(eventId).catch(e => {
        console.error('Error fetching event for config:', e);
        return null;
      })
    ]);

    const eventTitle = config['event_title'] || 'Mi Gran Fiesta';
    let googleDriveFolderUrl = config['google_drive_folder_url'] || '';

    // Auto-create folder in background if it doesn't exist yet (for non-default events)
    if (!googleDriveFolderUrl && eventId !== 'default') {
      const { syncPhotosToDrive } = require('./utils/googleDrive');
      syncPhotosToDrive(eventId).catch(err => {
        console.error(`[Google Drive] Error auto-creating folder for event ${eventId} on config load:`, err.message);
      });
    }

    let clientName = '';
    let serviceTables = true;
    let servicePhotos = true;
    let serviceInvitation = true;
    let serviceTrivia = true;
    let serviceCapitanes = true;

    if (event) {
      clientName = event.clientName;
      serviceTables = event.serviceTables !== false;
      servicePhotos = event.servicePhotos !== false;
      serviceInvitation = event.serviceInvitation !== false;
      serviceTrivia = event.serviceTrivia !== false;
      serviceCapitanes = event.serviceCapitanes !== false;
    }

    const triviaQuestions = config['trivia_questions'] || '[]';
    const invitationEventDate = config['invitation_event_date'] || '2026-08-30T21:30';
    const invitationEventTimeEnd = config['invitation_event_time_end'] || '';
    const invitationMusicUrl = config['invitation_music_url'] || '';
    const invitationPartyAddress = config['invitation_party_address'] || '';
    const invitationPartyMapsUrl = config['invitation_party_maps_url'] || '';
    const invitationCbu = config['invitation_cbu'] || '';
    const invitationAlias = config['invitation_alias'] || '';
    const invitationBankHolder = config['invitation_bank_holder'] || '';
    const invitationDressCode = config['invitation_dress_code'] || 'Elegante';

    // Calculate eventTimeMode ('dia' or 'noche') based on start hour (06:00 to 18:00 = 'dia', 18:00 to 06:00 = 'noche')
    let eventTimeMode = 'noche';
    if (invitationEventDate && invitationEventDate.includes('T')) {
      const timePart = invitationEventDate.split('T')[1];
      if (timePart) {
        const startHour = parseInt(timePart.split(':')[0], 10);
        if (!isNaN(startHour)) {
          if (startHour >= 6 && startHour < 18) {
            eventTimeMode = 'dia';
          } else {
            eventTimeMode = 'noche';
          }
        }
      }
    }

    const invitationTemplate = config['invitation_template'] || 'interactivo-3d';
    const invitationCardModel = config['invitation_card_model'] || 'imperial-gold';
    const invitationThemeColor = config['invitation_theme_color'] || 'golden-luxury';
    const invitationThemeFont = config['invitation_theme_font'] || 'classic-editorial';
    const invitationBgEffect = config['invitation_bg_effect'] || 'golden-dust';
    const invitationWaxSealDesign = config['invitation_wax_seal_design'] || 'rings';
    const invitationWaxSealInitials = config['invitation_wax_seal_initials'] || '';
    const invitationBgUrl = config['invitation_bg_url'] || '';
    const invitationCoverUrl = config['invitation_cover_url'] || '';

    const invitationPhoto1 = config['invitation_photo_1'] || '';
    const invitationPhoto2 = config['invitation_photo_2'] || '';
    const invitationPhoto3 = config['invitation_photo_3'] || '';
    const invitationPhoto4 = config['invitation_photo_4'] || '';
    const invitationPhoto5 = config['invitation_photo_5'] || '';
    const eventTheme = config['event_theme'] || '';
    const eventThemeLocked = config['event_theme_locked'] === 'true';
    const themeDetails = eventTheme ? (OFFICIAL_THEMES[eventTheme] || null) : null;

    const eventSupportPhone = config['support_whatsapp_number'] || '';
    let globalSupportPhone = eventSupportPhone;
    if (!globalSupportPhone) {
      const defaultSupportPhone = await db.getConfigValue('default', 'support_whatsapp_number', '');
      globalSupportPhone = defaultSupportPhone || process.env.SUPPORT_WHATSAPP_NUMBER || '5491122334455';
    }

    const defaultTemplateStr = '¡Hola miFiestAPP! 👋 Necesito soporte técnico / ayuda con mi evento: "{EVENT_TITLE}" (ID: {EVENT_ID}).';
    const eventSupportTemplate = config['support_whatsapp_template'] || '';
    let globalSupportTemplate = eventSupportTemplate;
    if (!globalSupportTemplate) {
      const defaultTemplateVal = await db.getConfigValue('default', 'support_whatsapp_template', '');
      globalSupportTemplate = defaultTemplateVal || defaultTemplateStr;
    }

    let selectedFilters = ['normal', 'jirafa', 'gato', 'makeup', 'payaso', 'vintage', 'cyberpunk', 'mono', 'bulldog_frances', 'sombrero_sonrisas'];
    if (config['selected_filters']) {
      try {
        const parsed = JSON.parse(config['selected_filters']);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const ALIAS_MAP = { perrito: 'bulldog_frances', cotillon: 'sombrero_sonrisas', corona: 'jirafa' };
          selectedFilters = parsed.map(id => ALIAS_MAP[id] || id);
        }
      } catch (e) {}
    }

    let enabledModules = { countdown: true, location: true, dresscode: true, photos: true, gifts: true, chest: true, rsvp: true, music: true, farewell: true };
    if (config['enabled_modules']) {
      try {
        const parsed = JSON.parse(config['enabled_modules']);
        if (parsed && typeof parsed === 'object') {
          enabledModules = { ...enabledModules, ...parsed };
        }
      } catch (e) {}
    }

    res.json({
      eventTitle,
      googleDriveFolderUrl,
      supportWhatsappNumber: globalSupportPhone,
      supportWhatsappTemplate: globalSupportTemplate,
      clientName,
      serviceTables,
      servicePhotos,
      serviceInvitation,
      serviceTrivia,
      serviceCapitanes,
      enabledModules,
      selectedFilters,
      triviaQuestions,
      invitationEventDate,
      invitationEventTimeEnd,
      eventTimeMode,
      invitationMusicUrl,
      invitationPartyAddress,
      invitationPartyMapsUrl,
      invitationCbu,
      invitationAlias,
      invitationBankHolder,
      invitationDressCode,
      invitationTemplate,
      invitationCardModel,
      invitationThemeColor,
      invitationThemeFont,
      invitationBgEffect,
      invitationWaxSealDesign,
      invitationWaxSealInitials,
      invitationBgUrl,
      invitationCoverUrl,
      invitationPhoto1,
      invitationPhoto2,
      invitationPhoto3,
      invitationPhoto4,
      invitationPhoto5,
      eventTheme,
      eventThemeLocked,
      themeDetails,
      officialThemes: OFFICIAL_THEMES,
      invitationWizardUnlocked: config['invitation_wizard_unlocked'] || '',
      invitationWizardCompleted: config['invitation_wizard_completed'] === 'true',
      snapApiToken: process.env.SNAP_API_TOKEN || '',
      snapGroupId: process.env.SNAP_GROUP_ID || '',
      snapLenses: {
        jirafa: process.env.SNAP_LENS_JIRAFA || process.env.SNAP_LENS_CORONA || '45a7db1b-a0ed-42a5-b7f9-b7dd419c02b8',
        gato: process.env.SNAP_LENS_GATO || process.env.SNAP_LENS_GATITO || 'f0132090-6519-4ad8-b41f-147b4c8759da',
        makeup: process.env.SNAP_LENS_MAKEUP || process.env.SNAP_LENS_GLAM || '5792cd48-93d4-421a-bf99-b20a7e900e5c',
        payaso: process.env.SNAP_LENS_PAYASO || '38cb3c38-bef8-4c61-ae74-fb0debb5df86',
        perrito: process.env.SNAP_LENS_PERRITO || '49414230875',
        cotillon: process.env.SNAP_LENS_COTILLON || '43281170875',
        angel: process.env.SNAP_LENS_ANGEL || '',
        demonio: process.env.SNAP_LENS_DEMONIO || '',
        pirata: process.env.SNAP_LENS_PIRATA || '',
        cybervisor: process.env.SNAP_LENS_CYBERVISOR || process.env.SNAP_LENS_CYBER_VISOR || '',
        corona: process.env.SNAP_LENS_CORONA || '45a7db1b-a0ed-42a5-b7f9-b7dd419c02b8',
        vampiro: process.env.SNAP_LENS_VAMPIRO || '76e9807a-e6b8-402f-a329-a0d134d9fed1',
        lentes_bigote_1: process.env.SNAP_LENS_LENTES_BIGOTE_1 || 'baff51d3-5226-43dc-9091-90e652ebf5e9',
        gigolo_face: process.env.SNAP_LENS_GIGOLO_FACE || '0f67caef-e403-47f9-ace2-7e679b56d999',
        lentes_bigote: process.env.SNAP_LENS_LENTES_BIGOTE || '1d8461a3-8732-4341-b802-1141591fdf2c',
        sombrero_sonrisas: process.env.SNAP_LENS_SOMBRERO_SONRISAS || '5c6715f3-5476-41d8-a6d7-d4722b9296fa',
        sombrero_barba: process.env.SNAP_LENS_SOMBRERO_BARBA || '4d16c1f9-16c8-4ce1-9681-74730a03dd2d',
        bulldog_frances: process.env.SNAP_LENS_BULLDOG_FRANCES || 'f0089bed-0f5e-4058-9300-686147c548eb',
        vaca: process.env.SNAP_LENS_VACA || '0736cd2e-7fae-4084-b7fd-9589cc32b6e3',
        narizota: process.env.SNAP_LENS_NARIZOTA || 'f31624ad-6690-4ae9-8d52-bd9ec48f5efa',
        cachetes_kiko: process.env.SNAP_LENS_CACHETES_KIKO || 'f9f52411-9cb5-40cc-b20b-b9a69fa71882',
        barba_lentes: process.env.SNAP_LENS_BARBA_LENTES || 'fa4b2dbd-d8a5-4efc-909e-5f911230bac1',
        cara_gato: process.env.SNAP_LENS_CARA_GATO || '876651a8-542e-4a28-9981-b72addbcb895',
        ruleta_filtros: process.env.SNAP_LENS_RULETA_FILTROS || '40fcc8f7-2875-44c8-9846-3336525e5473',
        sombrero_pollo: process.env.SNAP_LENS_SOMBRERO_POLLO || 'd2c85c6f-15a0-435d-8ac4-a63907f6fae3',
        sombrero_raton: process.env.SNAP_LENS_SOMBRERO_RATON || 'dc51212f-49a1-47d8-9c2c-14e4d017eec8',
        baby_face_2: process.env.SNAP_LENS_BABY_FACE_2 || '254b8e9b-5c6e-47b1-a109-b50b4bcb48a1',
        zebra: process.env.SNAP_LENS_ZEBRA || 'ef0809d5-f551-40df-a05e-fea1cb105a56',
        jumanji: process.env.SNAP_LENS_JUMANJI || '817eff5c-e4c8-4ee3-b60d-d312d6ec9b5e',
        pelado: process.env.SNAP_LENS_PELADO || 'a3c1ec09-867d-466d-b08f-e34a5b837b47',
        pirata_1: process.env.SNAP_LENS_PIRATA_1 || '5106d865-c6d7-4d77-81cc-95247b7eb094',
        words: process.env.SNAP_LENS_WORDS || 'a187bbcb-fd1f-461d-ba31-da9d71308040',
        baby_face: process.env.SNAP_LENS_BABY_FACE || '5a9aab9a-e7ba-4542-a02a-b625a323f609',
        filtro_viejo: process.env.SNAP_LENS_FILTRO_VIEJO || 'c6ffefce-d3d7-41f4-83e0-edb69945f228'
      },
      maxUploadSize: process.env.VERCEL ? 4 * 1024 * 1024 : 15 * 1024 * 1024
    });
  } catch (error) {
    res.json({
      eventTitle: 'Mi Gran Fiesta',
      clientName: '',
      serviceTables: true,
      servicePhotos: true,
      serviceInvitation: true,
      invitationEventDate: '',
      invitationMusicUrl: '',
      invitationPartyAddress: '',
      invitationPartyMapsUrl: '',
      invitationCbu: '',
      invitationAlias: '',
      invitationBankHolder: '',
      invitationDressCode: 'Elegante',
      invitationThemeColor: 'golden-luxury',
      invitationThemeFont: 'classic-editorial',
      invitationBgEffect: 'golden-dust',
      invitationWaxSealDesign: 'rings',
      invitationBgUrl: '',
      invitationCoverUrl: '',
      invitationPhoto1: '',
      invitationPhoto2: '',
      invitationPhoto3: '',
      invitationPhoto4: '',
      invitationPhoto5: '',
      snapApiToken: process.env.SNAP_API_TOKEN || '',
      snapGroupId: process.env.SNAP_GROUP_ID || '',
      snapLenses: {
        jirafa: process.env.SNAP_LENS_JIRAFA || process.env.SNAP_LENS_CORONA || '45a7db1b-a0ed-42a5-b7f9-b7dd419c02b8',
        gato: process.env.SNAP_LENS_GATO || process.env.SNAP_LENS_GATITO || 'f0132090-6519-4ad8-b41f-147b4c8759da',
        makeup: process.env.SNAP_LENS_MAKEUP || process.env.SNAP_LENS_GLAM || '5792cd48-93d4-421a-bf99-b20a7e900e5c',
        payaso: process.env.SNAP_LENS_PAYASO || '38cb3c38-bef8-4c61-ae74-fb0debb5df86',
        perrito: process.env.SNAP_LENS_PERRITO || '49414230875',
        cotillon: process.env.SNAP_LENS_COTILLON || '43281170875',
        angel: process.env.SNAP_LENS_ANGEL || '',
        demonio: process.env.SNAP_LENS_DEMONIO || '',
        pirata: process.env.SNAP_LENS_PIRATA || '',
        cybervisor: process.env.SNAP_LENS_CYBERVISOR || process.env.SNAP_LENS_CYBER_VISOR || '',
        corona: process.env.SNAP_LENS_CORONA || '45a7db1b-a0ed-42a5-b7f9-b7dd419c02b8',
        vampiro: process.env.SNAP_LENS_VAMPIRO || '76e9807a-e6b8-402f-a329-a0d134d9fed1',
        lentes_bigote_1: process.env.SNAP_LENS_LENTES_BIGOTE_1 || 'baff51d3-5226-43dc-9091-90e652ebf5e9',
        gigolo_face: process.env.SNAP_LENS_GIGOLO_FACE || '0f67caef-e403-47f9-ace2-7e679b56d999',
        lentes_bigote: process.env.SNAP_LENS_LENTES_BIGOTE || '1d8461a3-8732-4341-b802-1141591fdf2c',
        sombrero_sonrisas: process.env.SNAP_LENS_SOMBRERO_SONRISAS || '5c6715f3-5476-41d8-a6d7-d4722b9296fa',
        sombrero_barba: process.env.SNAP_LENS_SOMBRERO_BARBA || '4d16c1f9-16c8-4ce1-9681-74730a03dd2d',
        bulldog_frances: process.env.SNAP_LENS_BULLDOG_FRANCES || 'f0089bed-0f5e-4058-9300-686147c548eb',
        vaca: process.env.SNAP_LENS_VACA || '0736cd2e-7fae-4084-b7fd-9589cc32b6e3',
        narizota: process.env.SNAP_LENS_NARIZOTA || 'f31624ad-6690-4ae9-8d52-bd9ec48f5efa',
        cachetes_kiko: process.env.SNAP_LENS_CACHETES_KIKO || 'f9f52411-9cb5-40cc-b20b-b9a69fa71882',
        barba_lentes: process.env.SNAP_LENS_BARBA_LENTES || 'fa4b2dbd-d8a5-4efc-909e-5f911230bac1',
        cara_gato: process.env.SNAP_LENS_CARA_GATO || '876651a8-542e-4a28-9981-b72addbcb895',
        ruleta_filtros: process.env.SNAP_LENS_RULETA_FILTROS || '40fcc8f7-2875-44c8-9846-3336525e5473',
        sombrero_pollo: process.env.SNAP_LENS_SOMBRERO_POLLO || 'd2c85c6f-15a0-435d-8ac4-a63907f6fae3',
        sombrero_raton: process.env.SNAP_LENS_SOMBRERO_RATON || 'dc51212f-49a1-47d8-9c2c-14e4d017eec8',
        baby_face_2: process.env.SNAP_LENS_BABY_FACE_2 || '254b8e9b-5c6e-47b1-a109-b50b4bcb48a1',
        zebra: process.env.SNAP_LENS_ZEBRA || 'ef0809d5-f551-40df-a05e-fea1cb105a56',
        jumanji: process.env.SNAP_LENS_JUMANJI || '817eff5c-e4c8-4ee3-b60d-d312d6ec9b5e',
        pelado: process.env.SNAP_LENS_PELADO || 'a3c1ec09-867d-466d-b08f-e34a5b837b47',
        pirata_1: process.env.SNAP_LENS_PIRATA_1 || '5106d865-c6d7-4d77-81cc-95247b7eb094',
        words: process.env.SNAP_LENS_WORDS || 'a187bbcb-fd1f-461d-ba31-da9d71308040',
        baby_face: process.env.SNAP_LENS_BABY_FACE || '5a9aab9a-e7ba-4542-a02a-b625a323f609',
        filtro_viejo: process.env.SNAP_LENS_FILTRO_VIEJO || 'c6ffefce-d3d7-41f4-83e0-edb69945f228'
      },
      maxUploadSize: process.env.VERCEL ? 4 * 1024 * 1024 : 15 * 1024 * 1024
    });
  }
});

// API: Get public tables and guest names (Public)
app.get('/api/public/tables', async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const guests = await db.getGuests(eventId);
    const rsvps = await db.getRsvps(eventId);

    const confirmedNames = new Set(
      rsvps
        .filter(r => r.attending === true)
        .map(r => r.name.trim().toLowerCase())
    );

    const confirmedGuests = guests.filter(g => {
      const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
      return confirmedNames.has(fullName);
    });

    const tablesMap = {};
    confirmedGuests.forEach(g => {
      if (g.table) {
        const tableName = g.table.trim();
        if (!tablesMap[tableName]) {
          tablesMap[tableName] = [];
        }
        tablesMap[tableName].push(`${g.firstName} ${g.lastName}`.trim());
      }
    });

    const tables = Object.keys(tablesMap).map(name => ({
      name,
      guests: tablesMap[name]
    })).sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ''), 10);
      const numB = parseInt(b.name.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.name.localeCompare(b.name);
    });

    res.json(tables);
  } catch (error) {
    console.error('Error fetching public tables:', error);
    res.status(500).json({ error: 'Error al obtener las mesas' });
  }
});

// API: Resolve Coordinates from address or Google Maps URL (follows redirects)
app.get('/api/resolve-coordinates', async (req, res) => {
  try {
    const { mapsUrl, address } = req.query;

    // 1. Try parsing or expanding Google Maps URL
    if (mapsUrl) {
      // First check if it already has precise pin coordinates
      const pinRegex = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/;
      let pinMatch = mapsUrl.match(pinRegex);
      if (pinMatch) {
        return res.json({ lat: parseFloat(pinMatch[1]), lng: parseFloat(pinMatch[2]), source: 'direct_pin' });
      }

      // Check if it has viewport center coordinates
      const coordRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
      let match = mapsUrl.match(coordRegex);
      if (match) {
        return res.json({ lat: parseFloat(match[1]), lng: parseFloat(match[2]), source: 'direct_url' });
      }

      const qRegex = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
      let qMatch = mapsUrl.match(qRegex);
      if (qMatch) {
        return res.json({ lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]), source: 'direct_q' });
      }

      // If it's a shortened URL (like maps.app.goo.gl or goo.gl), resolve it
      if (mapsUrl.includes('goo.gl') || mapsUrl.includes('maps.app.goo.gl')) {
        try {
          const response = await fetch(mapsUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          const resolvedUrl = response.url;
          
          // Check for precise pin coordinates first in resolved URL
          pinMatch = resolvedUrl.match(pinRegex);
          if (pinMatch) {
            return res.json({ lat: parseFloat(pinMatch[1]), lng: parseFloat(pinMatch[2]), source: 'expanded_pin' });
          }

          match = resolvedUrl.match(coordRegex);
          if (match) {
            return res.json({ lat: parseFloat(match[1]), lng: parseFloat(match[2]), source: 'expanded_url' });
          }

          qMatch = resolvedUrl.match(qRegex);
          if (qMatch) {
            return res.json({ lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]), source: 'expanded_q' });
          }
        } catch (err) {
          console.error('[MAPS] Redirection resolution failed:', err);
        }
      }
    }

    // 2. Try Geocoding via Nominatim API from the backend
    if (address) {
      try {
        const cleanAddr = address.split('\n')[0].split(',')[0];
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanAddr)}&format=json&limit=1`;
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'FiestApp-Location-Resolver/1.0'
          }
        });
        const data = await response.json();
        if (data && data.length > 0) {
          return res.json({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), source: 'geocoding' });
        }
      } catch (err) {
        console.error('[MAPS] Backend geocoding failed:', err);
      }
    }

    // 3. Fallback to Obelisco (Central Buenos Aires)
    return res.json({ lat: -34.603722, lng: -58.381592, source: 'fallback' });
  } catch (error) {
    console.error('[MAPS] Endpoint error:', error);
    res.status(500).json({ error: 'Error resolving coordinates' });
  }
});

// API: Update config (Admin)
app.post('/api/config', requireAuth, async (req, res) => {
  const { 
    eventTitle,
    invitationEventDate,
    invitationEventTimeEnd,
    invitationMusicUrl,
    invitationPartyAddress,
    invitationPartyMapsUrl,
    invitationCbu,
    invitationAlias,
    invitationBankHolder,
    invitationDressCode,
    invitationTemplate,
    invitationCardModel,
    invitationThemeColor,
    invitationThemeFont,
    invitationBgEffect,
    invitationWaxSealDesign,
    invitationWaxSealInitials,
    invitationBgUrl,
    invitationCoverUrl,
    invitationPhoto1,
    invitationPhoto2,
    invitationPhoto3,
    invitationPhoto4,
    invitationPhoto5,
    serviceTrivia,
    triviaQuestions,
    selectedFilters
  } = req.body;
  const eventId = req.query.event || 'default';
  if (!eventTitle) {
    return res.status(400).json({ error: 'El título del evento es requerido' });
  }
  try {
    await db.setEventTitle(eventId, eventTitle);
    
    if (selectedFilters !== undefined) {
      await db.setConfigValue(eventId, 'selected_filters', JSON.stringify(selectedFilters));
    }
    
    if (req.body.enabledModules !== undefined) {
      await db.setConfigValue(eventId, 'enabled_modules', JSON.stringify(req.body.enabledModules));
    }
    
    if (invitationEventDate !== undefined) await db.setConfigValue(eventId, 'invitation_event_date', invitationEventDate);
    if (invitationEventTimeEnd !== undefined) await db.setConfigValue(eventId, 'invitation_event_time_end', invitationEventTimeEnd);
    if (invitationMusicUrl !== undefined) await db.setConfigValue(eventId, 'invitation_music_url', invitationMusicUrl);
    if (invitationPartyAddress !== undefined) await db.setConfigValue(eventId, 'invitation_party_address', invitationPartyAddress);
    if (invitationPartyMapsUrl !== undefined) await db.setConfigValue(eventId, 'invitation_party_maps_url', invitationPartyMapsUrl);
    if (invitationCbu !== undefined) await db.setConfigValue(eventId, 'invitation_cbu', invitationCbu);
    if (invitationAlias !== undefined) await db.setConfigValue(eventId, 'invitation_alias', invitationAlias);
    if (invitationBankHolder !== undefined) await db.setConfigValue(eventId, 'invitation_bank_holder', invitationBankHolder);
    if (invitationDressCode !== undefined) await db.setConfigValue(eventId, 'invitation_dress_code', invitationDressCode);

    if (invitationTemplate !== undefined) await db.setConfigValue(eventId, 'invitation_template', invitationTemplate);
    if (invitationCardModel !== undefined) await db.setConfigValue(eventId, 'invitation_card_model', invitationCardModel);
    if (invitationThemeColor !== undefined) await db.setConfigValue(eventId, 'invitation_theme_color', invitationThemeColor);
    if (invitationThemeFont !== undefined) await db.setConfigValue(eventId, 'invitation_theme_font', invitationThemeFont);
    if (invitationBgEffect !== undefined) await db.setConfigValue(eventId, 'invitation_bg_effect', invitationBgEffect);
    if (invitationWaxSealDesign !== undefined) await db.setConfigValue(eventId, 'invitation_wax_seal_design', invitationWaxSealDesign);
    if (invitationWaxSealInitials !== undefined) await db.setConfigValue(eventId, 'invitation_wax_seal_initials', invitationWaxSealInitials);
    if (invitationBgUrl !== undefined) await db.setConfigValue(eventId, 'invitation_bg_url', invitationBgUrl);
    if (invitationCoverUrl !== undefined) await db.setConfigValue(eventId, 'invitation_cover_url', invitationCoverUrl);

    if (invitationPhoto1 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_1', invitationPhoto1);
    if (invitationPhoto2 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_2', invitationPhoto2);
    if (invitationPhoto3 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_3', invitationPhoto3);
    if (invitationPhoto4 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_4', invitationPhoto4);
    if (invitationPhoto5 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_5', invitationPhoto5);
    if (serviceTrivia !== undefined) await db.updateEventServiceTrivia(eventId, serviceTrivia === true || serviceTrivia === 'true');
    if (triviaQuestions !== undefined) await db.setConfigValue(eventId, 'trivia_questions', triviaQuestions);

    if (req.body.invitation_wizard_unlocked !== undefined) {
      await db.setConfigValue(eventId, 'invitation_wizard_unlocked', typeof req.body.invitation_wizard_unlocked === 'string' ? req.body.invitation_wizard_unlocked : JSON.stringify(req.body.invitation_wizard_unlocked));
    }
    if (req.body.invitation_wizard_completed !== undefined) {
      await db.setConfigValue(eventId, 'invitation_wizard_completed', String(req.body.invitation_wizard_completed));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Error al guardar la configuración' });
  }
});

// API: Set and Lock Event Theme (One-Time Selection / SuperAdmin override)
app.post('/api/event/theme', async (req, res) => {
  const { eventId, themeId } = req.body || {};
  const cleanId = (eventId || '').trim().toLowerCase();
  if (!cleanId) {
    return res.status(400).json({ error: 'Código de evento requerido.' });
  }

  const selectedTheme = OFFICIAL_THEMES[themeId];
  if (!selectedTheme) {
    return res.status(400).json({ error: 'Temática seleccionada no válida.' });
  }

  try {
    // Check if theme is already locked for this event
    const isLocked = await db.getConfigValue(cleanId, 'event_theme_locked', 'false');
    const isSuperAdmin = req.session && req.session.isSuperAdmin;

    if (isLocked === 'true' && !isSuperAdmin) {
      return res.status(403).json({
        error: 'La temática oficial ya ha sido confirmada y fijada. Para solicitar un cambio de diseño, contactá a Soporte Técnico.'
      });
    }

    // Save Theme Configuration
    await db.setConfigValue(cleanId, 'event_theme', selectedTheme.id);
    await db.setConfigValue(cleanId, 'event_theme_locked', 'true');

    // Auto-synchronize Invitation defaults to match theme aesthetics
    await db.setConfigValue(cleanId, 'invitation_theme_color', selectedTheme.invitationColor);
    await db.setConfigValue(cleanId, 'invitation_card_model', selectedTheme.invitationModel);
    await db.setConfigValue(cleanId, 'invitation_bg_effect', selectedTheme.invitationEffect);
    await db.setConfigValue(cleanId, 'invitation_theme_font', selectedTheme.invitationFont);

    console.log(`[miFiestAPP] Temática "${selectedTheme.name}" fijada y bloqueada para el evento: ${cleanId}`);

    res.json({
      success: true,
      message: `¡Temática "${selectedTheme.name}" confirmada y fijada con éxito!`,
      theme: selectedTheme,
      locked: true
    });
  } catch (error) {
    console.error('Error saving event theme:', error);
    res.status(500).json({ error: 'Error al guardar la temática del evento.' });
  }
});

// API: Get RSVPs (Admin only)
app.get('/api/rsvps', requireAuth, async (req, res) => {
  const eventId = req.query.event || 'default';
  try {
    const data = await db.getRsvps(eventId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching RSVPs:', error);
    res.status(500).json({ error: 'Error al obtener la lista de confirmados' });
  }
});

// API: Delete RSVP (Admin only)
app.delete('/api/rsvps/:id', requireAuth, async (req, res) => {
  const eventId = req.query.event || 'default';
  const rsvpId = req.params.id;
  try {
    await db.deleteRsvp(eventId, rsvpId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting RSVP:', error);
    res.status(500).json({ error: 'Error al eliminar la confirmación' });
  }
});

// API: Update RSVP (Admin only)
app.put('/api/rsvps/:id', requireAuth, async (req, res) => {
  const eventId = req.query.event || 'default';
  const rsvpId = req.params.id;
  try {
    await db.updateRsvp(eventId, rsvpId, req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating RSVP:', error);
    res.status(500).json({ error: 'Error al actualizar la confirmación' });
  }
});

// API: Public RSVP submit (No Auth)
app.post('/api/public/rsvp', async (req, res) => {
  const eventId = req.query.event || req.body.eventId || 'default';
  const isPreview = req.query.preview === 'true' || req.body.preview === true || req.body.isPreview === true;
  
  // Validate that the event exists and is active
  try {
    const isValid = await db.isEventValid(eventId);
    if (!isValid && eventId !== 'default') {
      return res.status(404).json({ error: 'El evento no existe o está inactivo' });
    }
  } catch (err) {
    console.error('Error validating event for RSVP:', err);
  }

  const { name, attending, companionsCount, companionsNames, companionsDetails, dietaryRestrictions, suggestedSong, message } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  if (isPreview) {
    console.log(`[Preview Mode] Simulated RSVP submission for event: ${eventId} by ${name}`);
    return res.json({ success: true, isPreview: true, message: '✨ Modo Vista Previa: Confirmación probada con éxito (No se guardó en la base de datos para no alterar las estadísticas reales)' });
  }

  try {
    await db.addRsvp(eventId, {
      name,
      attending,
      companionsCount,
      companionsNames,
      companionsDetails,
      dietaryRestrictions,
      suggestedSong,
      message
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding RSVP:', error);
    res.status(500).json({ error: 'Error al registrar tu confirmación' });
  }
});

// API: Public QR RSVP Auto-Registration submit (No Auth)
app.post('/api/public/rsvp-qr', async (req, res) => {
  const eventId = req.query.event || req.body.eventId || 'default';
  const isPreview = req.query.preview === 'true' || req.body.preview === true || req.body.isPreview === true;
  
  try {
    const isValid = await db.isEventValid(eventId);
    if (!isValid && eventId !== 'default') {
      return res.status(404).json({ error: 'El evento no existe o está inactivo' });
    }
  } catch (err) {
    console.error('Error validating event for Public QR RSVP:', err);
  }

  const { name, phone, attending, dietaryRestrictions, suggestedSong } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'El Nombre y Apellido es obligatorio' });
  }

  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (!cleanPhone || cleanPhone.length < 6) {
    return res.status(400).json({ error: 'El número de teléfono / WhatsApp es obligatorio (mínimo 6 dígitos)' });
  }

  if (isPreview) {
    console.log(`[Preview Mode] Simulated QR RSVP submission for event: ${eventId} by ${name}`);
    return res.json({ success: true, isPreview: true, message: '✨ Modo Vista Previa: Confirmación probada con éxito (No se guardó en la base de datos)' });
  }

  try {
    const result = await db.addOrUpdatePublicRsvp(eventId, {
      name,
      phone: cleanPhone,
      attending,
      dietaryRestrictions,
      suggestedSong
    });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error adding/updating Public QR RSVP:', error);
    res.status(500).json({ error: 'Error al registrar tu confirmación por QR' });
  }
});

// API: Public Song Suggestion submit (No Auth)
app.post('/api/public/suggest-song', async (req, res) => {
  const eventId = req.query.event || req.body.eventId || 'default';
  const isPreview = req.query.preview === 'true' || req.body.preview === true || req.body.isPreview === true;
  
  try {
    const isValid = await db.isEventValid(eventId);
    if (!isValid && eventId !== 'default') {
      return res.status(404).json({ error: 'El evento no existe o está inactivo' });
    }
  } catch (err) {
    console.error('Error validating event for song suggestion:', err);
  }

  const { name, song } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'El nombre del invitado es obligatorio' });
  }
  if (!song || song.trim() === '') {
    return res.status(400).json({ error: 'La canción sugerida es obligatoria' });
  }

  if (isPreview) {
    console.log(`[Preview Mode] Simulated Song Suggestion submission for event: ${eventId} by ${name}`);
    return res.json({ success: true, isPreview: true, message: '✨ Modo Vista Previa: Sugerencia probada con éxito (No se guardó en la base de datos)' });
  }

  try {
    await db.saveSongSuggestion(eventId, name, song);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving song suggestion:', error);
    res.status(500).json({ error: 'Error al registrar tu sugerencia de canción' });
  }
});

// API: Download Souvenir Image (Forced attachment header for iOS Safari / Mobile browsers)
app.post('/api/public/download-souvenir', (req, res) => {
  try {
    const { image, filename } = req.body;
    if (!image) {
      return res.status(400).send('Imagen no proporcionada');
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const downloadFilename = (filename && typeof filename === 'string') 
      ? filename.replace(/[^a-zA-Z0-9_\.-]/g, '_') 
      : 'Recuerdito-VIP.png';

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (err) {
    console.error('Error handling download-souvenir endpoint:', err);
    return res.status(500).send('Error procesando descarga');
  }
});

// API: Get Guest Messages & Dedications (Public approved list or Admin full list)
app.get('/api/messages', async (req, res) => {
  const eventId = req.query.event || 'default';
  const isAdmin = (req.session && req.session.authenticated) || (req.cookies && req.cookies.admin_session);
  const includeHidden = req.query.all === 'true' && isAdmin;

  try {
    const messages = await db.getEventMessages(eventId, includeHidden);
    res.json({ success: true, messages });
  } catch (err) {
    console.error('Error getting guest messages:', err);
    res.status(500).json({ error: 'Error al obtener mensajes de invitados' });
  }
});

// API: Public Guest Message submit (No Auth)
app.post('/api/public/message', async (req, res) => {
  const eventId = req.query.event || req.body.eventId || 'default';
  const isPreview = req.query.preview === 'true' || req.body.preview === true || req.body.isPreview === true;

  try {
    const isValid = await db.isEventValid(eventId);
    if (!isValid && eventId !== 'default') {
      return res.status(404).json({ error: 'El evento no existe o está inactivo' });
    }
  } catch (err) {
    console.error('Error validating event for message submit:', err);
  }

  const { author, message, phone } = req.body;
  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'El mensaje de dedicatoria es obligatorio' });
  }

  if (isPreview) {
    return res.json({ success: true, isPreview: true, message: '✨ Modo Vista Previa: Dedicatoria probada con éxito' });
  }

  try {
    const newMsg = await db.addEventMessage(eventId, {
      author: author || 'Invitado',
      message: message.trim(),
      phone: phone || '',
      source: 'direct'
    });
    res.json({ success: true, message: newMsg });
  } catch (err) {
    console.error('Error adding guest message:', err);
    res.status(500).json({ error: 'Error al enviar tu dedicatoria' });
  }
});

// API: Admin Moderate Guest Message (Auth required)
app.post('/api/admin/messages/moderate', requireAuth, async (req, res) => {
  const eventId = req.query.event || req.body.eventId || 'default';
  const { id, approved, featured } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID de mensaje requerido' });
  }

  try {
    const updated = await db.moderateEventMessage(eventId, id, { approved, featured });
    if (!updated) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }
    res.json({ success: true, message: updated });
  } catch (err) {
    console.error('Error moderating message:', err);
    res.status(500).json({ error: 'Error al moderar mensaje' });
  }
});

// API: Admin Delete Guest Message (Auth required)
app.delete('/api/admin/messages/:id', requireAuth, async (req, res) => {
  const eventId = req.query.event || req.body.eventId || 'default';
  const messageId = req.params.id;

  try {
    await db.deleteEventMessage(eventId, messageId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: 'Error al eliminar mensaje' });
  }
});

// API: Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { password, email } = req.body;
  const eventId = req.query.event || req.body.eventId;
  
  try {
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = (password || '').trim();

      // 1. Try client host event login
      const event = await db.findEventByEmailAndPassword(cleanEmail, cleanPassword);
      if (event) {
        if (!event.active) {
          return res.status(403).json({ error: 'El servicio está inactivo para este evento.' });
        }
        
        const cookieName = `admin_session_${event.id}`;
        res.setHeader('Set-Cookie', `${cookieName}=${ADMIN_SESSION_TOKEN}_${event.id}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict`);
        return res.json({ success: true, eventId: event.id });
      }

      // 2. Try vendor login
      const vendors = await db.getVendors();
      const vendor = vendors.find(v => v.email === cleanEmail && v.active);
      if (vendor && vendor.passwordHash === cleanPassword) {
        res.setHeader('Set-Cookie', `vendor_session=${vendor.id}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict`);
        return res.json({ success: true, isVendor: true, redirectUrl: '/vendedor', vendor: { id: vendor.id, name: vendor.name, email: vendor.email } });
      }

      return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
    }

    const targetEventId = eventId || 'default';
    const isValid = await db.validateEventPassword(targetEventId, password);
    if (isValid) {
      const cookieName = `admin_session_${targetEventId}`;
      res.setHeader('Set-Cookie', `${cookieName}=${ADMIN_SESSION_TOKEN}_${targetEventId}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict`);
      return res.json({ success: true, eventId: targetEventId });
    }
    res.status(401).json({ error: 'Contraseña incorrecta' });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// API: Admin Logout
app.post('/api/admin/logout', (req, res) => {
  const eventId = req.query.event || req.body.event || 'default';
  const cookieName = `admin_session_${eventId}`;
  res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  res.json({ success: true });
});

// API: Check Session
app.get('/api/admin/check', (req, res) => {
  const eventId = req.query.event || 'default';
  const cookieName = `admin_session_${eventId}`;
  if (req.cookies && req.cookies[cookieName] === `${ADMIN_SESSION_TOKEN}_${eventId}`) {
    return res.json({ loggedIn: true });
  }
  res.json({ loggedIn: false });
});

// API: Superadmin Login
app.post('/api/superadmin/login', (req, res) => {
  const { password } = req.body;
  if (password === SUPERADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', `superadmin_session=${SUPERADMIN_SESSION_TOKEN}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict`);
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Contraseña de Superadmin incorrecta' });
});

// API: Superadmin Logout
app.post('/api/superadmin/logout', (req, res) => {
  res.setHeader('Set-Cookie', `superadmin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  res.json({ success: true });
});

// API: Check Superadmin Session
app.get('/api/superadmin/check', (req, res) => {
  if (req.cookies && req.cookies.superadmin_session === SUPERADMIN_SESSION_TOKEN) {
    return res.json({ loggedIn: true });
  }
  res.json({ loggedIn: false });
});

// API: Superadmin Get Events
app.get('/api/superadmin/events', requireSuperAuth, async (req, res) => {
  try {
    const events = await db.getEvents();
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Error al obtener los eventos' });
  }
});

// API: Superadmin Create Event
app.post('/api/superadmin/events', requireSuperAuth, async (req, res) => {
  const { id, clientName, eventName, password, clientEmail, serviceTables, servicePhotos, serviceInvitation, serviceTrivia, serviceMusic } = req.body;
  if (!id || !clientName) {
    return res.status(400).json({ error: 'El ID y el nombre del cliente son requeridos.' });
  }
  try {
    const sTables = serviceTables !== false;
    const sPhotos = servicePhotos !== false;
    const sInvitation = serviceInvitation !== false;
    const sTrivia = serviceTrivia !== false;
    const sMusic = serviceMusic !== false;
    const resolvedEventName = (eventName || clientName || '').trim();
    
    const cleanId = await db.createEvent(id, clientName, password || '', clientEmail || '', sTables, sPhotos, sInvitation, sTrivia, resolvedEventName, {}, sMusic);
    
    // Create Google Drive folder immediately on event creation (awaited to guarantee completion on Vercel)
    const { syncPhotosToDrive } = require('./utils/googleDrive');
    try {
      await syncPhotosToDrive(cleanId);
    } catch (driveErr) {
      console.error(`[Google Drive] Error al crear la carpeta inicial para el evento ${cleanId}:`, driveErr);
    }
    
    // Send welcome email and track status to inform UI
    let emailStatus = { sent: false };
    if (clientEmail && clientEmail.trim()) {
      try {
        const emailResult = await sendWelcomeEmail(
          clientEmail.trim(), 
          clientName.trim(), 
          cleanId, 
          password || '', 
          resolvedEventName,
          'noche',
          {
            serviceTables: sTables,
            servicePhotos: sPhotos,
            serviceInvitation: sInvitation,
            serviceTrivia: sTrivia,
            serviceMusic: sMusic
          }
        );
        if (emailResult.success) {
          emailStatus.sent = true;
          emailStatus.simulated = !!emailResult.simulated;
        } else {
          emailStatus.error = emailResult.error;
        }
      } catch (err) {
        emailStatus.error = err.message;
        console.error('[EMAIL] Error sending welcome email:', err);
      }
    }
    
    res.json({ success: true, eventId: cleanId, emailStatus });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message || 'Error al crear el evento' });
  }
});

// API: Superadmin Toggle Event Active Status
app.put('/api/superadmin/events/:id', requireSuperAuth, async (req, res) => {
  const { id } = req.params;
  const { active } = req.body;
  if (active === undefined) {
    return res.status(400).json({ error: 'El estado "active" es requerido.' });
  }
  try {
    await db.toggleEvent(id, active);
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling event status:', error);
    res.status(500).json({ error: 'Error al actualizar el estado del evento' });
  }
});

// API: Superadmin Manual Google Drive Folder Sync/Create
app.post('/api/superadmin/events/:id/sync-drive', requireSuperAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const { syncPhotosToDrive } = require('./utils/googleDrive');
    const folderUrl = await syncPhotosToDrive(id);
    res.json({ success: true, folderUrl });
  } catch (error) {
    console.error(`[Google Drive] Error al sincronizar carpeta para ${id}:`, error);
    res.status(500).json({ error: error.message || 'Error al conectar con Google Drive' });
  }
});

// API: Superadmin Get Global Technical Support Settings
app.get('/api/superadmin/support-phone', requireSuperAuth, async (req, res) => {
  try {
    const phone = await db.getConfigValue('default', 'support_whatsapp_number', process.env.SUPPORT_WHATSAPP_NUMBER || '5491122334455');
    const defaultTemplate = '¡Hola miFiestAPP! 👋 Necesito soporte técnico / ayuda con mi evento: "{EVENT_TITLE}" (ID: {EVENT_ID}).';
    const messageTemplate = await db.getConfigValue('default', 'support_whatsapp_template', defaultTemplate);
    res.json({ phone, messageTemplate });
  } catch (error) {
    console.error('Error fetching support settings:', error);
    res.status(500).json({ error: 'Error al obtener los datos de soporte' });
  }
});

// API: Superadmin Save Global Technical Support Settings
app.post('/api/superadmin/support-phone', requireSuperAuth, async (req, res) => {
  const { phone, messageTemplate } = req.body;
  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'El número de teléfono es requerido.' });
  }
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (cleanPhone.length < 8) {
    return res.status(400).json({ error: 'Número de teléfono no válido. Ingrese solo dígitos con código de país (ej: 5491122334455).' });
  }
  const cleanTemplate = (messageTemplate && typeof messageTemplate === 'string' && messageTemplate.trim()) ? messageTemplate.trim() : '¡Hola miFiestAPP! 👋 Necesito soporte técnico / ayuda con mi evento: "{EVENT_TITLE}" (ID: {EVENT_ID}).';
  try {
    await db.setConfigValue('default', 'support_whatsapp_number', cleanPhone);
    await db.setConfigValue('default', 'support_whatsapp_template', cleanTemplate);
    process.env.SUPPORT_WHATSAPP_NUMBER = cleanPhone;
    res.json({ success: true, phone: cleanPhone, messageTemplate: cleanTemplate });
  } catch (error) {
    console.error('Error saving support settings:', error);
    res.status(500).json({ error: 'Error al guardar la configuración de soporte' });
  }
});

// API: Superadmin Delete Event
app.delete('/api/superadmin/events/:id', requireSuperAuth, async (req, res) => {
  const { id } = req.params;
  if (id === 'default') {
    return res.status(400).json({ error: 'No se puede eliminar el evento por defecto.' });
  }
  try {
    await db.deleteEvent(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Error al eliminar el evento' });
  }
});

// API: Superadmin Approve Pending Event Proposal
app.post('/api/superadmin/events/:id/approve', requireSuperAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await db.approveEvent(id);
    res.json({ success: true, message: 'Evento aprobado e instalado correctamente' });
  } catch (error) {
    console.error('Error approving event:', error);
    res.status(500).json({ error: 'Error al aprobar el evento' });
  }
});

// API: Superadmin Reject Pending Event Proposal
app.post('/api/superadmin/events/:id/reject', requireSuperAuth, async (req, res) => {
  const { id } = req.params;
  try {
    await db.rejectEvent(id);
    res.json({ success: true, message: 'Solicitud de evento rechazada' });
  } catch (error) {
    console.error('Error rejecting event:', error);
    res.status(500).json({ error: 'Error al rechazar el evento' });
  }
});

// API: Superadmin Vendor Management (Get All Vendors)
app.get('/api/superadmin/vendors', requireSuperAuth, async (req, res) => {
  try {
    const vendors = await db.getVendors();
    res.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Error al obtener vendedores' });
  }
});

// API: Superadmin Vendor Management (Create Vendor)
app.post('/api/superadmin/vendors', requireSuperAuth, async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
  }
  try {
    const vendor = await db.createVendor(name, email, password, phone || '');
    res.json({ success: true, vendor });
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({ error: 'Error al crear la cuenta de vendedor' });
  }
});

// API: Superadmin Vendor Management (Toggle Vendor Active)
app.put('/api/superadmin/vendors/:id', requireSuperAuth, async (req, res) => {
  const { active } = req.body;
  try {
    await db.toggleVendor(req.params.id, !!active);
    res.json({ success: true });
  } catch (error) {
    console.error('Error toggling vendor:', error);
    res.status(500).json({ error: 'Error al cambiar estado del vendedor' });
  }
});

// API: Superadmin Vendor Management (Delete Vendor)
app.delete('/api/superadmin/vendors/:id', requireSuperAuth, async (req, res) => {
  try {
    await db.deleteVendor(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ error: 'Error al eliminar vendedor' });
  }
});

// API: Superadmin Assign Vendor to Event
app.put('/api/superadmin/events/:id/vendor', requireSuperAuth, async (req, res) => {
  const eventId = req.params.id;
  const { vendorId } = req.body;
  try {
    await db.assignVendorToEvent(eventId, vendorId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning vendor to event:', error);
    res.status(500).json({ error: 'Error al asignar vendedor al evento' });
  }
});

// API: Superadmin Get Fine-Tuner Config for Template Model
app.get('/api/superadmin/fine-tuner', requireSuperAuth, async (req, res) => {
  const modelId = req.query.modelId || 'card-model-imperial-gold';
  const eventId = req.query.eventId || 'default';
  const formatId = req.query.formatId || null;
  try {
    const config = await db.getTemplateFineTuning(modelId, eventId, formatId);
    res.json(config);
  } catch (error) {
    console.error('Error fetching fine-tuner config:', error);
    res.status(500).json({ error: 'Error al obtener la calibración' });
  }
});

// API: Superadmin Save Fine-Tuner Config for Template Model
app.post('/api/superadmin/fine-tuner', requireSuperAuth, async (req, res) => {
  const { modelId, config, eventId, formatId } = req.body;
  if (!modelId) {
    return res.status(400).json({ error: 'Model ID requerido' });
  }
  try {
    const saved = await db.saveTemplateFineTuning(modelId, config || {}, eventId || 'default', formatId || null);
    res.json({ success: true, config: saved });
  } catch (error) {
    console.error('Error saving fine-tuner config:', error);
    res.status(500).json({ error: 'Error al guardar la calibración' });
  }
});

// API: Superadmin Upload Frame Video MP4
app.post('/api/superadmin/upload-frame-video', requireSuperAuth, upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo de video.' });
  }

  const filePath = req.file.path;
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const publicUrl = await db.uploadVideoFrameFile(req.file.originalname, fileBuffer, req.file.mimetype);

    // Clean up temporary local file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Error uploading frame video:', err);
    if (req.file && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({ error: 'Error al subir el video marco.' });
  }
});

// API Public: Get Fine-Tuner Config for Public Invitation
app.get('/api/public/fine-tuner/:modelId', async (req, res) => {
  const modelId = req.params.modelId || 'card-model-imperial-gold';
  const eventId = req.query.eventId || 'default';
  const formatId = req.query.formatId || req.query.format || null;
  try {
    const config = await db.getTemplateFineTuning(modelId, eventId, formatId);
    res.json(config);
  } catch (error) {
    res.json({ paddingTop: 88, paddingBottom: 98, maxWidth: 275, btnOffsetY: 0, contentScale: 1.0 });
  }
});

// --- VENDOR PORTAL API ROUTES ---

// API: Vendor Login
app.post('/api/vendor/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña requeridos' });
  }
  const cleanEmail = email.trim().toLowerCase();
  try {
    const vendors = await db.getVendors();
    const vendor = vendors.find(v => v.email === cleanEmail && v.active);
    if (!vendor || vendor.passwordHash !== password.trim()) {
      return res.status(401).json({ error: 'Credenciales de vendedor incorrectas' });
    }

    res.setHeader('Set-Cookie', `vendor_session=${vendor.id}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict`);
    res.json({ success: true, vendor: { id: vendor.id, name: vendor.name, email: vendor.email } });
  } catch (error) {
    console.error('Error logging in vendor:', error);
    res.status(500).json({ error: 'Error al iniciar sesión de vendedor' });
  }
});

// API: Vendor Logout
app.post('/api/vendor/logout', (req, res) => {
  res.setHeader('Set-Cookie', `vendor_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
  res.json({ success: true });
});

// API: Vendor Check Session
app.get('/api/vendor/check', async (req, res) => {
  const vendorSession = req.cookies ? req.cookies.vendor_session : null;
  if (!vendorSession) return res.json({ loggedIn: false });

  try {
    const vendors = await db.getVendors();
    const vendor = vendors.find(v => v.id === vendorSession && v.active);
    if (vendor) {
      return res.json({ loggedIn: true, vendor: { id: vendor.id, name: vendor.name, email: vendor.email } });
    }
  } catch (err) {}
  res.json({ loggedIn: false });
});

// API: Vendor Get Assigned Events
app.get('/api/vendor/events', requireVendorAuth, async (req, res) => {
  try {
    const allEvents = await db.getEvents();
    const vendorEvents = allEvents.filter(e => e.vendorId === req.vendorId);
    res.json(vendorEvents);
  } catch (error) {
    console.error('Error fetching vendor events:', error);
    res.status(500).json({ error: 'Error al obtener los eventos del vendedor' });
  }
});

// API: Vendor Request New Event (Pending Superadmin Approval)
app.post('/api/vendor/events/request', requireVendorAuth, async (req, res) => {
  const { id, clientName, eventName, password, clientEmail, serviceTables, servicePhotos, serviceInvitation, serviceTrivia } = req.body;
  if (!id || !clientName) {
    return res.status(400).json({ error: 'El ID y el nombre del cliente son requeridos.' });
  }
  try {
    const cleanId = await db.createEvent(
      id,
      clientName,
      password || '',
      clientEmail || '',
      serviceTables !== false,
      servicePhotos !== false,
      serviceInvitation !== false,
      serviceTrivia !== false,
      eventName || clientName,
      {
        vendorId: req.vendorId,
        approvalStatus: 'pending_approval',
        isDemo: false
      }
    );
    res.json({ success: true, eventId: cleanId, status: 'pending_approval' });
  } catch (error) {
    console.error('Error requesting event creation:', error);
    res.status(500).json({ error: error.message || 'Error al solicitar el alta del evento' });
  }
});

// API: Vendor Create Instant Demo Event (Watermarked / Temporary)
app.post('/api/vendor/events/demo', requireVendorAuth, async (req, res) => {
  const { clientName, eventName } = req.body;
  const demoId = 'demo_' + Math.random().toString(36).substring(2, 8);
  const resolvedClient = (clientName || 'Cliente Prospecto').trim();
  const resolvedEventName = (eventName || `Demo - ${resolvedClient}`).trim();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const cleanId = await db.createEvent(
      demoId,
      resolvedClient,
      'demo123',
      '',
      true, true, true, true,
      resolvedEventName,
      {
        vendorId: req.vendorId,
        approvalStatus: 'demo',
        isDemo: true,
        demoExpiresAt: expiresAt
      }
    );

    // Seed sample demo configuration for an immediate WOW factor
    await db.setConfigValue(cleanId, 'event_date', '2026-12-31');
    await db.setConfigValue(cleanId, 'event_time', '21:00');
    await db.setConfigValue(cleanId, 'event_location_name', 'Jano\'s Salón Principal');
    await db.setConfigValue(cleanId, 'event_location_address', 'Av. Corrientes 1234, CABA');

    res.json({ success: true, eventId: cleanId, isDemo: true, demoExpiresAt: expiresAt });
  } catch (error) {
    console.error('Error creating demo event:', error);
    res.status(500).json({ error: 'Error al generar la invitación de demostración' });
  }
});

// API: Download Mapped Excel (Admin)
app.get('/api/admin/download-excel', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const guests = await db.getGuests(eventId);
    if (guests.length === 0) {
      return res.status(404).json({ error: 'No hay lista de invitados cargada' });
    }
    
    // Get dynamic event title from config
    let eventTitle = "MIFIESTAPP - LISTA DE INVITADOS";
    try {
      const configTitle = await db.getEventTitle(eventId);
      eventTitle = `MIFIESTAPP - INVITADOS: ${configTitle.toUpperCase()}`;
    } catch (err) {
      // Ignore
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invitados');

    worksheet.views = [{ showGridLines: true }];

    worksheet.columns = [
      { key: 'firstName', width: 25 },
      { key: 'lastName', width: 25 },
      { key: 'table', width: 20 }
    ];

    // Row 1: Merged Title
    worksheet.mergeCells('A1:C1');
    const titleRow = worksheet.getRow(1);
    titleRow.height = 45;

    const titleCell = worksheet.getCell('A1');
    titleCell.value = eventTitle;
    titleCell.font = {
      name: 'Segoe UI',
      family: 2,
      size: 13,
      bold: true,
      color: { argb: 'FFD4AF37' } // Gold
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A1A1A' } // Charcoal Dark
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 2: Headers
    const headerRow = worksheet.getRow(2);
    headerRow.height = 28;

    worksheet.getCell('A2').value = 'Nombre';
    worksheet.getCell('B2').value = 'Apellido';
    worksheet.getCell('C2').value = 'Numero de Mesa';

    const cols = ['A', 'B', 'C'];
    cols.forEach(col => {
      const cell = worksheet.getCell(`${col}2`);
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFD4AF37' } // Gold
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2A2A2A' } // Charcoal Medium
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF444444' } },
        left: { style: 'thin', color: { argb: 'FF444444' } },
        bottom: { style: 'medium', color: { argb: 'FFD4AF37' } },
        right: { style: 'thin', color: { argb: 'FF444444' } }
      };
    });

    // Populate data
    guests.forEach((g, index) => {
      const rowIndex = index + 3;
      const row = worksheet.getRow(rowIndex);
      row.height = 22;

      worksheet.getCell(`A${rowIndex}`).value = g.firstName;
      worksheet.getCell(`B${rowIndex}`).value = g.lastName;
      worksheet.getCell(`C${rowIndex}`).value = g.table;

      cols.forEach(col => {
        const cell = worksheet.getCell(`${col}${rowIndex}`);
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          color: { argb: 'FF333333' }
        };

        const isEven = rowIndex % 2 === 0;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF9F9F9' : 'FFFFFFFF' }
        };

        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDCDCDC' } },
          left: { style: 'thin', color: { argb: 'FFDCDCDC' } },
          bottom: { style: 'thin', color: { argb: 'FFDCDCDC' } },
          right: { style: 'thin', color: { argb: 'FFDCDCDC' } }
        };
      });
    });

    res.setHeader('Content-Disposition', 'attachment; filename="lista_invitados_mapeada.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ error: 'Error al generar el archivo Excel' });
  }
});

// API: Get all guests directly (Admin)
app.get('/api/admin/guests', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const guests = await db.getGuests(eventId);
    res.json(guests);
  } catch (error) {
    res.status(500).json({ error: 'Error al leer invitados' });
  }
});

// API: Add Guest (Admin)
// API: Add Guest (Admin)
app.post(['/api/guests', '/api/admin/guests'], requireAuth, async (req, res) => {
  const { firstName, lastName, table, phone } = req.body;
  const eventId = req.query.event || 'default';
  if (!firstName && !lastName) {
    return res.status(400).json({ error: 'El nombre o apellido es requerido' });
  }
  try {
    await db.addGuest(eventId, { firstName, lastName, table, phone: phone || '' });
    const guests = await db.getGuests(eventId);
    res.json({ success: true, count: guests.length });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar el invitado' });
  }
});

// API: Edit Guest (Admin)
app.put(['/api/guests/:index', '/api/admin/guests/:index'], requireAuth, async (req, res) => {
  const index = parseInt(req.params.index, 10);
  const { firstName, lastName, table, phone } = req.body;
  const eventId = req.query.event || 'default';
  if (!firstName && !lastName) {
    return res.status(400).json({ error: 'El nombre o apellido es requerido' });
  }
  try {
    await db.updateGuest(eventId, index, { firstName, lastName, table, phone: phone || '' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating guest:', error);
    res.status(500).json({ error: 'Error al modificar el invitado' });
  }
});

// API: Delete Guest (Admin)
app.delete(['/api/guests/:index', '/api/admin/guests/:index'], requireAuth, async (req, res) => {
  const index = parseInt(req.params.index, 10);
  const eventId = req.query.event || 'default';
  try {
    await db.deleteGuest(eventId, index);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting guest:', error);
    res.status(500).json({ error: 'Error al eliminar el invitado' });
  }
});

// API: Export Guests to Excel (Admin)
app.get('/api/admin/export-guests', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const guests = await db.getGuests(eventId);
    const rsvps = await db.getRsvps(eventId);

    const formatTableDisplay = (table) => {
      if (!table) return 'Sin Mesa';
      const t = String(table).trim();
      if (t.toLowerCase() === 'sin mesa') return 'Sin Mesa';
      if (/^mesa\b/i.test(t)) {
        return t.charAt(0).toUpperCase() + t.slice(1);
      }
      return `Mesa ${t}`;
    };

    // Get dynamic event title from config
    let eventTitle = "JANO'S EVENTOS - LISTADO FINAL DE INVITADOS";
    try {
      const configTitle = await db.getEventTitle(eventId);
      eventTitle = `JANO'S EVENTOS - LISTADO DE INVITADOS: ${configTitle.toUpperCase()}`;
    } catch (err) {
      // Ignore
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Invitados & Confirmaciones');

    worksheet.views = [{ showGridLines: true }];

    const columnsConfig = [
      { header: 'Nombre', key: 'firstName', width: 20 },
      { header: 'Apellido', key: 'lastName', width: 20 },
      { header: 'Mesa', key: 'table', width: 15 },
      { header: 'Confirmación', key: 'confirmation', width: 18 },
      { header: 'Cant. Acompañantes', key: 'companionsCount', width: 20 },
      { header: 'Nombres Acompañantes', key: 'companionsNames', width: 30 },
      { header: 'Restricciones Alimenticias', key: 'dietary', width: 30 },
      { header: 'Canción Sugerida', key: 'song', width: 28 },
      { header: 'Enlace de Invitación', key: 'url', width: 45 }
    ];

    worksheet.columns = columnsConfig.map(col => ({ key: col.key, width: col.width }));

    // Row 1: Merged Title
    const totalCols = columnsConfig.length;
    const endColLetter = String.fromCharCode(65 + totalCols - 1); // e.g. 'I'
    worksheet.mergeCells(`A1:${endColLetter}1`);
    const titleRow = worksheet.getRow(1);
    titleRow.height = 45;

    const titleCell = worksheet.getCell('A1');
    titleCell.value = eventTitle;
    titleCell.font = {
      name: 'Segoe UI',
      family: 2,
      size: 14,
      bold: true,
      color: { argb: 'FFD4AF37' } // Gold
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A1A1A' } // Charcoal Dark
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 2: Headers
    const headerRow = worksheet.getRow(2);
    headerRow.height = 28;

    const colLetters = Array.from({ length: totalCols }, (_, i) => String.fromCharCode(65 + i));
    
    colLetters.forEach((col, idx) => {
      const cell = worksheet.getCell(`${col}2`);
      cell.value = columnsConfig[idx].header;
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFD4AF37' } // Gold
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2A2A2A' } // Charcoal Medium
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF444444' } },
        left: { style: 'thin', color: { argb: 'FF444444' } },
        bottom: { style: 'medium', color: { argb: 'FFD4AF37' } },
        right: { style: 'thin', color: { argb: 'FF444444' } }
      };
    });

    // Populate data
    guests.forEach((g, index) => {
      const rowIndex = index + 3;
      const row = worksheet.getRow(rowIndex);
      row.height = 22;

      const fullName = `${g.firstName} ${g.lastName}`.trim().toLowerCase();
      const rsvp = rsvps.find((r) => r.name.trim().toLowerCase() === fullName);

      let confirmationStatus = 'Pendiente';
      let companionsCount = 0;
      let companionsNames = '';
      let dietaryRestrictions = '';
      let songSuggestion = '';

      if (rsvp) {
        confirmationStatus = rsvp.attending ? 'Asistirá' : 'No asistirá';
        companionsCount = rsvp.companionsCount || 0;
        companionsNames = rsvp.companionsNames || '';
        dietaryRestrictions = rsvp.dietaryRestrictions || '';
        songSuggestion = rsvp.suggestedSong || '';
      }

      // Generate the personal URL
      const host = req.get('host');
      const protocol = req.protocol;
      const personalUrl = `${protocol}://${host}/invitacion.html?event=${encodeURIComponent(eventId)}&n=${encodeURIComponent(g.firstName + ' ' + g.lastName)}`;

      worksheet.getCell(`A${rowIndex}`).value = g.firstName || '';
      worksheet.getCell(`B${rowIndex}`).value = g.lastName || '';
      worksheet.getCell(`C${rowIndex}`).value = formatTableDisplay(g.table);
      worksheet.getCell(`D${rowIndex}`).value = confirmationStatus;
      worksheet.getCell(`E${rowIndex}`).value = companionsCount;
      worksheet.getCell(`F${rowIndex}`).value = companionsNames;
      worksheet.getCell(`G${rowIndex}`).value = dietaryRestrictions;
      worksheet.getCell(`H${rowIndex}`).value = songSuggestion;
      worksheet.getCell(`I${rowIndex}`).value = personalUrl;

      // Color coding for confirmation status cell
      const confCell = worksheet.getCell(`D${rowIndex}`);
      if (confirmationStatus === 'Asistirá') {
        confCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1B4332' } };
        confCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD8F3DC' } }; // Light green
      } else if (confirmationStatus === 'No asistirá') {
        confCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF7209B7' } };
        confCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0E6FF' } }; // Light purple
      } else {
        confCell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF555555' } };
      }

      colLetters.forEach(col => {
        const cell = worksheet.getCell(`${col}${rowIndex}`);
        
        // If it's not the confirmation status cell (which has its own styling), apply zebra pattern
        if (col !== 'D') {
          cell.font = {
            name: 'Segoe UI',
            size: 10,
            color: { argb: 'FF333333' }
          };

          const isEven = rowIndex % 2 === 0;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? 'FFF9F9F9' : 'FFFFFFFF' }
          };
        }

        cell.alignment = { vertical: 'middle', horizontal: col === 'F' || col === 'G' || col === 'I' ? 'left' : 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDCDCDC' } },
          left: { style: 'thin', color: { argb: 'FFDCDCDC' } },
          bottom: { style: 'thin', color: { argb: 'FFDCDCDC' } },
          right: { style: 'thin', color: { argb: 'FFDCDCDC' } }
        };
      });
    });

    res.setHeader('Content-Disposition', `attachment; filename="invitados_${eventId}_final.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ error: 'Error al generar el archivo Excel' });
  }
});

// API: Export Dietary Restrictions & Menus to Excel (Admin - Black & Gold Theme)
app.get('/api/admin/export-menus', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const guests = await db.getGuests(eventId);
    const rsvps = await db.getRsvps(eventId);

    const formatTableDisplay = (table) => {
      if (!table) return 'Sin Mesa';
      const t = String(table).trim();
      if (t.toLowerCase() === 'sin mesa') return 'Sin Mesa';
      if (/^mesa\b/i.test(t)) {
        return t.charAt(0).toUpperCase() + t.slice(1);
      }
      return `Mesa ${t}`;
    };

    let eventTitle = "NUESTRO EVENTO";
    try {
      const configTitle = await db.getEventTitle(eventId);
      if (configTitle) eventTitle = configTitle.toUpperCase();
    } catch (err) {}

    const guestTableMap = {};
    guests.forEach(g => {
      const fn = `${g.firstName || ''} ${g.lastName || ''}`.trim().toLowerCase();
      if (fn) guestTableMap[fn] = formatTableDisplay(g.table);
    });

    const menuItems = [];
    const countsMap = {};

    rsvps.forEach(r => {
      const restriction = (r.dietaryRestrictions || '').trim();
      if (restriction) {
        const fn = (r.name || '').trim().toLowerCase();
        const table = guestTableMap[fn] || 'Sin Mesa';
        
        menuItems.push({
          guestName: r.name,
          table: table,
          attending: r.attending ? 'Confirmado' : 'No asistirá',
          restriction: restriction
        });

        const normKey = restriction.charAt(0).toUpperCase() + restriction.slice(1);
        countsMap[normKey] = (countsMap[normKey] || 0) + 1;
      }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Menúes Especiales');
    worksheet.views = [{ showGridLines: true }];

    const columnsConfig = [
      { header: 'Invitado / Titular', key: 'guestName', width: 32 },
      { header: 'Mesa', key: 'table', width: 18 },
      { header: 'Estado', key: 'attending', width: 18 },
      { header: 'Menú Especial / Restricción', key: 'restriction', width: 45 }
    ];

    worksheet.columns = columnsConfig.map(col => ({ key: col.key, width: col.width }));

    // Row 1: Main Header Banner (Onyx & Gold)
    worksheet.mergeCells('A1:D1');
    const titleRow = worksheet.getRow(1);
    titleRow.height = 42;
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `miFiestAPP  •  REPORTE DE MENÚES ESPECIALES & RESTRICCIONES`;
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFD4AF37' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111113' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 2: Subtitle Row (Event Info)
    worksheet.mergeCells('A2:D2');
    const subRow = worksheet.getRow(2);
    subRow.height = 24;
    const subCell = worksheet.getCell('A2');
    subCell.value = `EVENTO: ${eventTitle}  |  TOTAL RESTRICCIONES REGISTRADAS: ${menuItems.length}`;
    subCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFF3E5AB' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F1F24' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 3: Blank spacing
    worksheet.getRow(3).height = 10;

    // Row 4: Summary Header
    worksheet.mergeCells('A4:D4');
    const sumHeaderRow = worksheet.getRow(4);
    sumHeaderRow.height = 24;
    const sumHeaderCell = worksheet.getCell('A4');
    sumHeaderCell.value = `📊 RESUMEN EJECUTIVO PARA CATERING & COCINA`;
    sumHeaderCell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFD4AF37' } };
    sumHeaderCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2A220F' } };
    sumHeaderCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    // Row 5+: Summary Rows
    let currentRowIdx = 5;
    const summaryEntries = Object.entries(countsMap);
    if (summaryEntries.length === 0) {
      worksheet.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`);
      const emptySumCell = worksheet.getCell(`A${currentRowIdx}`);
      emptySumCell.value = 'No se registraron restricciones alimenticias especiales aún.';
      emptySumCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FFA0A0A5' } };
      emptySumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF161618' } };
      currentRowIdx++;
    } else {
      summaryEntries.forEach(([menuType, count]) => {
        worksheet.mergeCells(`A${currentRowIdx}:C${currentRowIdx}`);
        const typeCell = worksheet.getCell(`A${currentRowIdx}`);
        typeCell.value = `• ${menuType}`;
        typeCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFF0F0F5' } };
        typeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1E' } };
        
        const countCell = worksheet.getCell(`D${currentRowIdx}`);
        countCell.value = `${count} ${count === 1 ? 'persona' : 'personas'}`;
        countCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFD4AF37' } };
        countCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A1E' } };
        countCell.alignment = { horizontal: 'right', indent: 1 };
        currentRowIdx++;
      });
    }

    worksheet.getRow(currentRowIdx).height = 15;
    currentRowIdx++;

    // Table Header Row
    const headerRow = worksheet.getRow(currentRowIdx);
    headerRow.height = 26;
    ['A', 'B', 'C', 'D'].forEach((colLetter, idx) => {
      const cell = worksheet.getCell(`${colLetter}${currentRowIdx}`);
      cell.value = columnsConfig[idx].header;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFD4AF37' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F1A0A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF3A2F0F' } },
        bottom: { style: 'medium', color: { argb: 'FFD4AF37' } },
        left: { style: 'thin', color: { argb: 'FF3A2F0F' } },
        right: { style: 'thin', color: { argb: 'FF3A2F0F' } }
      };
    });
    currentRowIdx++;

    // Data Rows
    if (menuItems.length === 0) {
      worksheet.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`);
      const noDataCell = worksheet.getCell(`A${currentRowIdx}`);
      noDataCell.value = 'Sin solicitudes de menúes especiales.';
      noDataCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF888888' } };
      noDataCell.alignment = { horizontal: 'center' };
      currentRowIdx++;
    } else {
      menuItems.forEach((item, i) => {
        const row = worksheet.getRow(currentRowIdx);
        row.height = 22;
        const bgHex = (i % 2 === 0) ? 'FF161619' : 'FF1E1E23';

        worksheet.getCell(`A${currentRowIdx}`).value = item.guestName;
        worksheet.getCell(`B${currentRowIdx}`).value = item.table;
        worksheet.getCell(`C${currentRowIdx}`).value = item.attending;
        worksheet.getCell(`D${currentRowIdx}`).value = item.restriction;

        ['A', 'B', 'C', 'D'].forEach(col => {
          const c = worksheet.getCell(`${col}${currentRowIdx}`);
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } };
          c.font = { name: 'Segoe UI', size: 10, color: { argb: 'FFF0F0F5' } };
          c.border = {
            bottom: { style: 'thin', color: { argb: 'FF2A2A30' } },
            right: { style: 'thin', color: { argb: 'FF2A2A30' } }
          };
        });

        worksheet.getCell(`B${currentRowIdx}`).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFD4AF37' } };
        worksheet.getCell(`D${currentRowIdx}`).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFF3E5AB' } };
        
        currentRowIdx++;
      });
    }

    worksheet.getRow(currentRowIdx).height = 15;
    currentRowIdx++;

    worksheet.mergeCells(`A${currentRowIdx}:D${currentRowIdx}`);
    const footerCell = worksheet.getCell(`A${currentRowIdx}`);
    footerCell.value = `© 2026 miFiestAPP  •  Digitalizá Tu Fiesta  •  www.mifiestapp.com.ar`;
    footerCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFD4AF37' } };
    footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111113' } };
    footerCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(currentRowIdx).height = 28;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Menus-Especiales-${eventId}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Menus Excel:', error);
    res.status(500).json({ error: 'Error al exportar los menúes especiales' });
  }
});

// API: Export DJ Song Suggestions to Excel (Admin - Black & Gold Theme)
app.get('/api/admin/export-dj-songs', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const guests = await db.getGuests(eventId);
    const rsvps = await db.getRsvps(eventId);

    const formatTableDisplay = (table) => {
      if (!table) return 'Sin Mesa';
      const t = String(table).trim();
      if (t.toLowerCase() === 'sin mesa') return 'Sin Mesa';
      if (/^mesa\b/i.test(t)) {
        return t.charAt(0).toUpperCase() + t.slice(1);
      }
      return `Mesa ${t}`;
    };

    let eventTitle = "NUESTRO EVENTO";
    try {
      const configTitle = await db.getEventTitle(eventId);
      if (configTitle) eventTitle = configTitle.toUpperCase();
    } catch (err) {}

    const guestTableMap = {};
    guests.forEach(g => {
      const fn = `${g.firstName || ''} ${g.lastName || ''}`.trim().toLowerCase();
      if (fn) guestTableMap[fn] = formatTableDisplay(g.table);
    });

    const songItems = [];
    rsvps.forEach(r => {
      const song = (r.suggestedSong || '').trim();
      if (song) {
        songItems.push({
          song: song,
          guestName: r.name
        });
      }
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sugerencias DJ');
    worksheet.views = [{ showGridLines: true }];

    const columnsConfig = [
      { header: 'Canción / Tema Sugerido', key: 'song', width: 50 },
      { header: 'Sugerido Por (Invitado)', key: 'guestName', width: 35 }
    ];

    worksheet.columns = columnsConfig.map(col => ({ key: col.key, width: col.width }));

    // Row 1: Header Banner (Onyx & Gold)
    worksheet.mergeCells('A1:B1');
    const titleRow = worksheet.getRow(1);
    titleRow.height = 42;
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `miFiestAPP  •  LISTADO DE SUGERENCIAS PARA EL DJ`;
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFD4AF37' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111113' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 2: Subtitle Row
    worksheet.mergeCells('A2:B2');
    const subRow = worksheet.getRow(2);
    subRow.height = 24;
    const subCell = worksheet.getCell('A2');
    subCell.value = `EVENTO: ${eventTitle}  |  TOTAL CANCIONES SUGERIDAS: ${songItems.length}`;
    subCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFF3E5AB' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F1F24' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // Row 3: Blank
    worksheet.getRow(3).height = 10;

    // Row 4: Table Header
    let currentRowIdx = 4;
    const headerRow = worksheet.getRow(currentRowIdx);
    headerRow.height = 26;
    ['A', 'B'].forEach((colLetter, idx) => {
      const cell = worksheet.getCell(`${colLetter}${currentRowIdx}`);
      cell.value = columnsConfig[idx].header;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFD4AF37' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F1A0A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF3A2F0F' } },
        bottom: { style: 'medium', color: { argb: 'FFD4AF37' } },
        left: { style: 'thin', color: { argb: 'FF3A2F0F' } },
        right: { style: 'thin', color: { argb: 'FF3A2F0F' } }
      };
    });
    currentRowIdx++;

    // Data Rows
    if (songItems.length === 0) {
      worksheet.mergeCells(`A${currentRowIdx}:B${currentRowIdx}`);
      const noDataCell = worksheet.getCell(`A${currentRowIdx}`);
      noDataCell.value = 'Sin sugerencias de canciones registradas aún.';
      noDataCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF888888' } };
      noDataCell.alignment = { horizontal: 'center' };
      currentRowIdx++;
    } else {
      songItems.forEach((item, i) => {
        const row = worksheet.getRow(currentRowIdx);
        row.height = 22;
        const bgHex = (i % 2 === 0) ? 'FF161619' : 'FF1E1E23';

        worksheet.getCell(`A${currentRowIdx}`).value = item.song;
        worksheet.getCell(`B${currentRowIdx}`).value = item.guestName;

        ['A', 'B'].forEach(col => {
          const c = worksheet.getCell(`${col}${currentRowIdx}`);
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } };
          c.font = { name: 'Segoe UI', size: 10, color: { argb: 'FFF0F0F5' } };
          c.border = {
            bottom: { style: 'thin', color: { argb: 'FF2A2A30' } },
            right: { style: 'thin', color: { argb: 'FF2A2A30' } }
          };
        });

        worksheet.getCell(`A${currentRowIdx}`).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFD4AF37' } };

        currentRowIdx++;
      });
    }

    worksheet.getRow(currentRowIdx).height = 15;
    currentRowIdx++;

    worksheet.mergeCells(`A${currentRowIdx}:B${currentRowIdx}`);
    const footerCell = worksheet.getCell(`A${currentRowIdx}`);
    footerCell.value = `© 2026 miFiestAPP  •  Digitalizá Tu Fiesta  •  www.mifiestapp.com.ar`;
    footerCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFD4AF37' } };
    footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111113' } };
    footerCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(currentRowIdx).height = 28;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Sugerencias-DJ-${eventId}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating DJ Songs Excel:', error);
    res.status(500).json({ error: 'Error al exportar las sugerencias para el DJ' });
  }
});

// API: Download Guest List Template (Admin - Black & Gold Theme)
app.get(['/api/download-template', '/assets/plantilla_invitados.xlsx'], async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Plantilla Invitados');
    worksheet.views = [{ showGridLines: true }];

    const columnsConfig = [
      { header: 'Nombre', key: 'firstName', width: 28 },
      { header: 'Apellido', key: 'lastName', width: 28 },
      { header: 'Teléfono (Opcional)', key: 'phone', width: 28 }
    ];

    worksheet.columns = columnsConfig.map(col => ({ key: col.key, width: col.width }));

    // Row 1: Header Banner (Onyx & Gold)
    worksheet.mergeCells('A1:C1');
    const titleRow = worksheet.getRow(1);
    titleRow.height = 38;
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `miFiestAPP  •  REGISTRO DE INVITADOS`;
    titleCell.font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFD4AF37' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111113' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Row 2: Subtitle Row
    worksheet.mergeCells('A2:C2');
    const subRow = worksheet.getRow(2);
    subRow.height = 24;
    const subCell = worksheet.getCell('A2');
    subCell.value = `Completá nombres, apellidos y teléfonos de tus invitados`;
    subCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFF3E5AB' } };
    subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F1F24' } };
    subCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

    // Row 3: Blank spacing
    worksheet.getRow(3).height = 10;

    // Row 4: Table Header Row
    const headerRow = worksheet.getRow(4);
    headerRow.height = 26;
    ['A', 'B', 'C'].forEach((colLetter, idx) => {
      const cell = worksheet.getCell(`${colLetter}4`);
      cell.value = columnsConfig[idx].header;
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFD4AF37' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F1A0A' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF3A2F0F' } },
        bottom: { style: 'medium', color: { argb: 'FFD4AF37' } },
        left: { style: 'thin', color: { argb: 'FF3A2F0F' } },
        right: { style: 'thin', color: { argb: 'FF3A2F0F' } }
      };
    });

    // Rows 5-8: Example Rows
    const exampleGuests = [
      { firstName: 'Juan', lastName: 'Pérez', phone: '11 1234 5678' },
      { firstName: 'María', lastName: 'López', phone: '11 8765 4321' },
      { firstName: 'Esteban', lastName: 'Maza', phone: '11 9999 8888' },
      { firstName: 'Ana', lastName: 'Gómez', phone: '11 5555 4444' }
    ];

    exampleGuests.forEach((g, i) => {
      const rowIdx = 5 + i;
      const row = worksheet.getRow(rowIdx);
      row.height = 22;
      const bgHex = (i % 2 === 0) ? 'FF161619' : 'FF1E1E23';

      worksheet.getCell(`A${rowIdx}`).value = g.firstName;
      worksheet.getCell(`B${rowIdx}`).value = g.lastName;
      worksheet.getCell(`C${rowIdx}`).value = g.phone;

      ['A', 'B', 'C'].forEach(col => {
        const c = worksheet.getCell(`${col}${rowIdx}`);
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgHex } };
        c.font = { name: 'Segoe UI', size: 10, color: { argb: 'FFF0F0F5' } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.border = {
          bottom: { style: 'thin', color: { argb: 'FF2A2A30' } },
          right: { style: 'thin', color: { argb: 'FF2A2A30' } }
        };
      });
    });

    // Blank row
    worksheet.getRow(9).height = 15;

    // Footer row
    worksheet.mergeCells('A10:C10');
    const footerCell = worksheet.getCell('A10');
    footerCell.value = `© 2026 miFiestAPP  •  Digitalizá Tu Fiesta  •  www.mifiestapp.com.ar`;
    footerCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFD4AF37' } };
    footerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111113' } };
    footerCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(10).height = 28;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_invitados.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating template file:', error);
    res.status(500).json({ error: 'Error al generar la plantilla de invitados' });
  }
});

// API: Upload Excel or CSV file
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }

  const filePath = req.file.path;
  try {
    if (req.file.originalname.endsWith('.csv')) {
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          processParsedData(req.query.event || 'default', results, filePath, res);
        });
    } else if (req.file.originalname.endsWith('.xlsx') || req.file.originalname.endsWith('.xls')) {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Smart header row finder
      let rangeOption = 0;
      const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const rowStr = (rows[i] || []).join(' ').toLowerCase();
        if (rowStr.includes('nombre') && rowStr.includes('apellido')) {
          rangeOption = i;
          break;
        }
      }
      
      const rawData = xlsx.utils.sheet_to_json(sheet, { range: rangeOption });
      processParsedData(req.query.event || 'default', rawData, filePath, res);
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Formato de archivo no soportado. Suba un .xlsx, .xls o .csv' });
    }
  } catch (error) {
    console.error('Error processing upload:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: 'Error al procesar el archivo' });
  }
});

// Helper function to map columns and write guests
async function processParsedData(eventId, data, filePath, res) {
  try {
    if (data.length === 0) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'El archivo está vacío' });
    }

    const guests = data.map(row => {
      // Flexible column keys selection
      const nameKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'nombre') || 
                      Object.keys(row).find(k => /nombre|name/i.test(k));
      const surnameKey = Object.keys(row).find(k => k.trim().toLowerCase() === 'apellido') || 
                         Object.keys(row).find(k => /apellido|surname/i.test(k));
      const tableKey = Object.keys(row).find(k => k.trim().replace(/\s+/g, '').toLowerCase() === 'numerodemesa') || 
                       Object.keys(row).find(k => /mesa|table|ubicacion/i.test(k));
      const phoneKey = Object.keys(row).find(k => /teléfono|telefono|phone|celular|mobile|whatsapp/i.test(k));

      return {
        firstName: nameKey ? String(row[nameKey] || '').trim() : '',
        lastName: surnameKey ? String(row[surnameKey] || '').trim() : '',
        table: tableKey ? String(row[tableKey] || '').trim() : 'Sin Mesa',
        phone: phoneKey ? String(row[phoneKey] || '').trim() : ''
      };
    }).filter(g => {
      const fn = g.firstName.toLowerCase();
      const ln = g.lastName.toLowerCase();
      return (g.firstName !== '' || g.lastName !== '') && 
             !fn.includes('mifiestapp') && !ln.includes('mifiestapp') &&
             !fn.includes('©') && !ln.includes('©');
    });

    // Write file using db adapter
    await db.saveGuests(eventId, guests);

    // Remove uploaded file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ success: true, count: guests.length });
  } catch (error) {
    console.error('Error mapping data:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: 'Error al estructurar los datos del archivo' });
  }
}

// Helper: Compress audio file using ffmpeg to 96kbps MP3
function compressAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // -y: overwrite output file
    // -i inputPath: input file
    // -map_metadata -1: strip metadata to reduce file size
    // -codec:a libmp3lame: use high quality mp3 encoding
    // -b:a 96k: target constant bitrate 96 kbps (highly lightweight)
    // -ar 44100: standard sample rate
    // -ac 2: stereo channel encoding
    const cmd = `ffmpeg -y -i "${inputPath}" -map_metadata -1 -codec:a libmp3lame -b:a 96k -ar 44100 "${outputPath}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// API: Upload MP3 Audio File
app.post('/api/audio/upload', requireAuth, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo de audio.' });
  }

  const filePath = req.file.path;
  const eventId = req.query.event || 'default';
  let finalPathToUpload = filePath;
  let compressedPath = null;

  try {
    // If the file is larger than 8MB, compress it automatically using ffmpeg
    if (req.file.size > 8 * 1024 * 1024) {
      console.log(`[Audio Uploader] Compressing large audio file of size: ${(req.file.size / (1024 * 1024)).toFixed(2)}MB`);
      compressedPath = path.join(path.dirname(filePath), 'compressed_' + path.basename(filePath));
      try {
        await compressAudio(filePath, compressedPath);
        if (fs.existsSync(compressedPath)) {
          const stats = fs.statSync(compressedPath);
          console.log(`[Audio Uploader] Compression successful! New size: ${(stats.size / (1024 * 1024)).toFixed(2)}MB`);
          finalPathToUpload = compressedPath;
        }
      } catch (compressErr) {
        console.error('[Audio Uploader] Compression failed, falling back to original file:', compressErr.message);
      }
    }

    const fileBuffer = fs.readFileSync(finalPathToUpload);
    const publicUrl = await db.uploadAudioFile(eventId, req.file.originalname, fileBuffer, req.file.mimetype);
    
    // Clean up temporary local files
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (compressedPath && fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
    } catch (err) {
      console.warn('[miFiestAPP Server] Error unlinking temp files:', err.message);
    }

    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Error uploading audio:', err);
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      if (compressedPath && fs.existsSync(compressedPath)) fs.unlinkSync(compressedPath);
    } catch (unlinkErr) {}
    res.status(500).json({ error: 'Error al subir el archivo de audio' });
  }
});

// API: Upload config image
app.post('/api/admin/upload-image', requireAuth, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo de imagen.' });
  }

  const filePath = req.file.path;
  const eventId = req.query.event || 'default';

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const publicUrl = await db.uploadPhotoFile(eventId, req.file.originalname, fileBuffer, req.file.mimetype);
    
    // Clean up temporary local file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ success: true, url: publicUrl });
  } catch (err) {
    console.error('Error uploading admin image:', err);
    if (req.file && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    res.status(500).json({ error: 'Error al subir la imagen.' });
  }
});


// Real-time photo stream managers
const photoAdminClients = {}; // eventId -> Array of res
const photoPublicClients = {}; // eventId -> Array of res

function broadcastPhotoUpdate(eventId) {
  db.getPhotos(eventId, false)
    .then(allPhotos => {
      // 1. Notify admins
      const adminClients = photoAdminClients[eventId] || [];
      const adminMessage = `data: ${JSON.stringify({ type: 'PHOTOS_UPDATE', data: allPhotos })}\n\n`;
      adminClients.forEach(clientRes => {
        try {
          clientRes.write(adminMessage);
        } catch (err) {
          console.error('[SSE Admin] Error writing update:', err);
        }
      });
      
      // 2. Notify public / projection clients
      const approvedPhotos = allPhotos.filter(p => p.approved);
      const publicClients = photoPublicClients[eventId] || [];
      const publicMessage = `data: ${JSON.stringify({ type: 'PHOTOS_UPDATE', data: approvedPhotos })}\n\n`;
      publicClients.forEach(clientRes => {
        try {
          clientRes.write(publicMessage);
        } catch (err) {
          console.error('[SSE Public] Error writing update:', err);
        }
      });
    })
    .catch(err => {
      console.error('[SSE Broadcast] Error loading photos for broadcast:', err);
    });
}

// Helper: Get all confirmed attending guests and companions for an event
async function getConfirmedAttendingList(eventId = 'default') {
  try {
    const guests = await db.getGuests(eventId);
    const rsvps = await db.getRsvps(eventId);

    const list = [];
    const addedSet = new Set();

    const addPerson = (name, type, table = '') => {
      if (!name || typeof name !== 'string') return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const key = normalizeString(trimmed);
      if (!addedSet.has(key)) {
        addedSet.add(key);
        list.push({
          name: trimmed,
          type: type,
          table: table || ''
        });
      }
    };

    // 1. RSVPs with attending === true
    if (Array.isArray(rsvps)) {
      rsvps.filter(r => r && r.attending === true).forEach(r => {
        const matchedGuest = Array.isArray(guests) ? guests.find(g => {
          const gFull = `${g.firstName || ''} ${g.lastName || ''}`.trim();
          return normalizeString(gFull) === normalizeString(r.name);
        }) : null;

        const tableName = matchedGuest && matchedGuest.table ? matchedGuest.table : (r.table || '');
        addPerson(r.name, 'Titular', tableName);

        // Companions
        let companionNames = [];
        if (Array.isArray(r.companionsDetails)) {
          r.companionsDetails.forEach(cd => {
            if (typeof cd === 'string') companionNames.push(cd);
            else if (cd && cd.name) companionNames.push(cd.name);
          });
        }
        if (Array.isArray(r.companionsNames)) {
          r.companionsNames.forEach(cn => companionNames.push(cn));
        } else if (typeof r.companionsNames === 'string' && r.companionsNames.trim()) {
          r.companionsNames.split(',').forEach(cn => companionNames.push(cn.trim()));
        }

        companionNames.forEach(cName => {
          if (cName && cName.trim()) {
            addPerson(cName.trim(), `Acompañante de ${r.name}`, tableName);
          }
        });
      });
    }

    // 2. Guests from guest list with confirmed rsvp
    if (Array.isArray(guests)) {
      guests.filter(g => g && (g.rsvp === true || g.status === 'confirmed')).forEach(g => {
        const fullName = `${g.firstName || ''} ${g.lastName || ''}`.trim();
        if (fullName) {
          addPerson(fullName, 'Titular', g.table || '');
        }
      });
    }

    return list;
  } catch (err) {
    console.error('Error fetching confirmed attending list:', err);
    return [];
  }
}

// API: Search confirmed attending guests & companions for photo mural upload
app.get('/api/public/search-attendance-guests', async (req, res) => {
  const eventId = req.query.event || 'default';
  const query = req.query.q ? req.query.q.trim() : '';

  try {
    const attendingList = await getConfirmedAttendingList(eventId);
    
    // If no query provided, return all (up to 50)
    if (!query) {
      return res.json(attendingList.slice(0, 50));
    }

    const queryClean = normalizeString(query);
    const queryWords = queryClean.split(/\s+/).filter(Boolean);

    const filtered = attendingList.filter(item => {
      const cleanName = normalizeString(item.name);
      return queryWords.every(word => cleanName.includes(word));
    });

    res.json(filtered.slice(0, 30));
  } catch (error) {
    console.error('Error searching attendance guests:', error);
    res.status(500).json({ error: 'Error al buscar invitados de la lista.' });
  }
});

// API: Upload guest photo
app.post('/api/photos/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ninguna foto.' });
  }
  const { guestName, message } = req.body;
  const eventId = req.query.event || 'default';

  // Validate that uploader is a confirmed attending guest or companion if guests exist in DB
  try {
    const attendingList = await getConfirmedAttendingList(eventId);
    if (attendingList.length > 0) {
      const cleanInputName = normalizeString(guestName || '');
      const isAttending = attendingList.some(p => normalizeString(p.name) === cleanInputName);
      if (!isAttending) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ 
          error: 'Para subir una foto al mural debes haber confirmado tu asistencia o ser un acompañante registrado.' 
        });
      }
    }
  } catch (valErr) {
    console.warn('Attendance validation check error (proceeding with upload):', valErr);
  }
  
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const photoUrl = await db.uploadPhotoFile(eventId, req.file.originalname, fileBuffer, req.file.mimetype);
    
    // Remove the temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    await db.addPhoto(eventId, { guestName, message, photoUrl });
    res.json({ success: true, photoUrl });
    broadcastPhotoUpdate(eventId);
  } catch (error) {
    console.error('Error uploading photo:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Error al subir la foto y registrarla.' });
  }
});

// API: Get photo moderation config (Admin)
app.get('/api/admin/photos/moderation-config', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const val = await db.getConfigValue(eventId, 'photo_moderation_enabled', 'true');
    res.json({ moderationEnabled: val !== 'false' });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la configuración de moderación.' });
  }
});

// API: Set photo moderation config (Admin)
app.post('/api/admin/photos/moderation-config', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const { moderationEnabled } = req.body;
    const valStr = String(Boolean(moderationEnabled));
    await db.setConfigValue(eventId, 'photo_moderation_enabled', valStr);
    res.json({ success: true, moderationEnabled: Boolean(moderationEnabled) });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la configuración de moderación.' });
  }
});

// API: Get all photos (Admin)
app.get('/api/admin/photos', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const photos = await db.getPhotos(eventId, false); // get all
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener fotos de administración.' });
  }
});

// API: Get approved photos (Public Slideshow)
app.get('/api/public/photos', async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const photos = await db.getPhotos(eventId, true); // only approved
    res.json(photos);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener galería de fotos.' });
  }
});

// SSE: Admin photos stream
app.get('/api/admin/photos/stream', requireAuth, (req, res) => {
  const eventId = req.query.event || 'default';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!photoAdminClients[eventId]) {
    photoAdminClients[eventId] = [];
  }
  photoAdminClients[eventId].push(res);

  // Send initial state
  db.getPhotos(eventId, false)
    .then(allPhotos => {
      res.write(`data: ${JSON.stringify({ type: 'INITIAL_STATE', data: allPhotos })}\n\n`);
    })
    .catch(err => {
      console.error('[SSE Admin] Error fetching initial photos:', err);
    });

  req.on('close', () => {
    if (photoAdminClients[eventId]) {
      photoAdminClients[eventId] = photoAdminClients[eventId].filter(c => c !== res);
    }
  });
});

// SSE: Public/Projection photos stream
app.get('/api/public/photos/stream', (req, res) => {
  const eventId = req.query.event || 'default';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!photoPublicClients[eventId]) {
    photoPublicClients[eventId] = [];
  }
  photoPublicClients[eventId].push(res);

  // Send initial state (approved only)
  db.getPhotos(eventId, true)
    .then(approvedPhotos => {
      res.write(`data: ${JSON.stringify({ type: 'INITIAL_STATE', data: approvedPhotos })}\n\n`);
    })
    .catch(err => {
      console.error('[SSE Public] Error fetching initial photos:', err);
    });

  req.on('close', () => {
    if (photoPublicClients[eventId]) {
      photoPublicClients[eventId] = photoPublicClients[eventId].filter(c => c !== res);
    }
  });
});

// API: Sync photos to Google Drive (Admin)
app.post('/api/admin/photos/sync-drive', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const { syncPhotosToDrive } = require('./utils/googleDrive');
    const folderUrl = await syncPhotosToDrive(eventId);
    res.json({ success: true, folderUrl });
  } catch (error) {
    console.error('Error in Google Drive sync API:', error);
    res.status(500).json({ error: error.message || 'Error al sincronizar con Google Drive.' });
  }
});

// API: Approve a photo (Admin)
app.put('/api/admin/photos/:id/approve', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    await db.approvePhoto(eventId, req.params.id);
    
    // Await the Google Drive sync for this specific photo to ensure Vercel doesn't freeze the environment before the upload is completed.
    const { syncPhotosToDrive } = require('./utils/googleDrive');
    try {
      await syncPhotosToDrive(eventId, req.params.id);
    } catch (driveErr) {
      console.error(`[Google Drive] Error syncing photo ${req.params.id} on approval:`, driveErr);
      // We don't block the API response if Google Drive sync has an issue, so the moderation interface remains responsive.
    }

    res.json({ success: true });
    broadcastPhotoUpdate(eventId);
  } catch (error) {
    res.status(500).json({ error: 'Error al aprobar la foto.' });
  }
});

// API: Delete / Reject a photo (Admin)
app.delete('/api/admin/photos/:id', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    await db.deletePhoto(eventId, req.params.id);
    res.json({ success: true });
    broadcastPhotoUpdate(eventId);
  } catch (error) {
    res.status(500).json({ error: 'Error al rechazar la foto.' });
  }
});

// API: Clear all photos (Admin)
app.post('/api/admin/photos/clear', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    await db.clearPhotos(eventId);
    res.json({ success: true });
    broadcastPhotoUpdate(eventId);
  } catch (error) {
    console.error('Error clearing photos:', error);
    res.status(500).json({ error: 'Error al limpiar la galería de fotos.' });
  }
});


// Serve main app pages
app.get(['/fotos', '/fotos.html'], async (req, res) => {
  const eventId = req.query.event || 'default';
  try {
    const events = await db.getEvents();
    const event = events.find(e => e.id === eventId);
    if (event && event.servicePhotos === false) {
      return res.redirect(`/event.html?event=${encodeURIComponent(eventId)}`);
    }
    const filePath = path.join(__dirname, 'public', 'fotos.html');
    let html = await fs.promises.readFile(filePath, 'utf8');
    const config = await db.getConfigValues(eventId);
    const eventTheme = config['event_theme'] || 'golden-luxury';
    html = injectThemeIntoHtml(html, eventTheme);
    return res.send(html);
  } catch (err) {
    console.error('Error checking service availability or injecting theme into fotos.html:', err);
    res.sendFile(path.join(__dirname, 'public', 'fotos.html'));
  }
});

app.get('/proyeccion', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'proyeccion.html'));
});

app.get(['/mesas', '/mesas.html'], async (req, res) => {
  const eventId = req.query.event || 'default';
  try {
    const events = await db.getEvents();
    const event = events.find(e => e.id === eventId);
    if (event && event.serviceTables === false) {
      return res.redirect(`/event.html?event=${encodeURIComponent(eventId)}`);
    }
    const filePath = path.join(__dirname, 'public', 'mesas.html');
    let html = await fs.promises.readFile(filePath, 'utf8');
    const config = await db.getConfigValues(eventId);
    const eventTheme = config['event_theme'] || 'golden-luxury';
    html = injectThemeIntoHtml(html, eventTheme);
    return res.send(html);
  } catch (err) {
    console.error('Error checking service availability or injecting theme into mesas.html:', err);
    res.sendFile(path.join(__dirname, 'public', 'mesas.html'));
  }
});

app.get(['/complementos', '/complementos.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'complementos.html'));
});

app.get('/', (req, res) => {
  const eventId = req.query.event;
  if (eventId && eventId !== 'default') {
    return res.redirect(`/event.html?event=${encodeURIComponent(eventId)}`);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', async (req, res) => {
  const eventId = req.query.event || 'default';
  const cookieName = `admin_session_${eventId}`;
  
  const isSuperadmin = req.cookies && req.cookies.superadmin_session === SUPERADMIN_SESSION_TOKEN;
  const isClientAdmin = req.cookies && req.cookies[cookieName] === `${ADMIN_SESSION_TOKEN}_${eventId}`;
  let isVendorAdmin = false;

  const vendorSession = req.cookies ? req.cookies.vendor_session : null;
  if (vendorSession) {
    try {
      const events = await db.getEvents();
      const targetEvent = events.find(e => e.id === eventId);
      if (targetEvent && targetEvent.vendorId === vendorSession) {
        isVendorAdmin = true;
      }
    } catch (e) {}
  }

  if (isSuperadmin || isClientAdmin || isVendorAdmin) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
      const filePath = path.join(__dirname, 'private', 'admin.html');
      let html = await fs.promises.readFile(filePath, 'utf8');
      const config = await db.getConfigValues(eventId);
      const eventTheme = config['event_theme'] || 'golden-luxury';
      html = injectThemeIntoHtml(html, eventTheme);
      return res.send(html);
    } catch (err) {
      console.error('Error injecting theme into admin.html:', err);
      return res.sendFile(path.join(__dirname, 'private', 'admin.html'));
    }
  }
  const queryParams = new URLSearchParams();
  if (req.query.event) queryParams.set('event', req.query.event);
  if (req.query.service) queryParams.set('service', req.query.service);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  res.redirect(`/login${queryString}`);
});

app.get('/login', (req, res) => {
  const eventId = req.query.event || 'default';
  const cookieName = `admin_session_${eventId}`;
  if (req.cookies && req.cookies[cookieName] === `${ADMIN_SESSION_TOKEN}_${eventId}`) {
    const queryParams = new URLSearchParams();
    if (req.query.event) queryParams.set('event', req.query.event);
    if (req.query.service) queryParams.set('service', req.query.service);
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return res.redirect(`/event.html${queryString}`);
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login.html', (req, res) => {
  const queryParams = new URLSearchParams();
  if (req.query.event) queryParams.set('event', req.query.event);
  if (req.query.service) queryParams.set('service', req.query.service);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  res.redirect(`/login${queryString}`);
});

// Serve Superadmin & Inactive views
app.get(['/vendedor', '/vendedor/panel', '/vendedor.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'vendedor.html'));
});

app.get('/superadmin', (req, res) => {
  if (req.cookies && req.cookies.superadmin_session === SUPERADMIN_SESSION_TOKEN) {
    return res.sendFile(path.join(__dirname, 'private', 'superadmin.html'));
  }
  res.redirect('/superlogin');
});

app.get('/superlogin', (req, res) => {
  if (req.cookies && req.cookies.superadmin_session === SUPERADMIN_SESSION_TOKEN) {
    return res.redirect('/superadmin');
  }
  res.sendFile(path.join(__dirname, 'public', 'superlogin.html'));
});

app.get('/inactive', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'inactive.html'));
});

// ==========================================
// TRIVIA GAME SERVICE API ENDPOINTS
// ==========================================

function normalizeString(str) {
  if (!str) return '';
  return str.trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "");
}

app.get('/api/trivia/stream', async (req, res) => {
  const eventId = req.query.event || 'default';
  const role = req.query.role || 'player';
  const nickname = req.query.nickname || '';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!triviaCoordinator.sessions[eventId]) {
    try {
      const qStr = await db.getConfigValue(eventId, 'trivia_questions', '[]');
      const questions = JSON.parse(qStr);
      triviaCoordinator.initializeSession(eventId, questions);
    } catch (err) {
      console.error('[Trivia Stream Init Error]', err);
      triviaCoordinator.initializeSession(eventId, []);
    }
  }

  const session = triviaCoordinator.sessions[eventId];
  const clientObj = { res, role, nickname };
  session.clients.push(clientObj);

  if (role === 'player' && nickname) {
    // Transparently auto-rejoin player on stream connection/reconnection
    triviaCoordinator.addPlayer(eventId, nickname);
  }

  res.write(`data: ${JSON.stringify({ type: 'INITIAL_STATE', data: triviaCoordinator.getSessionState(eventId) })}\n\n`);

  req.on('close', () => {
    session.clients = session.clients.filter(c => c.res !== res);
  });
});

app.get('/api/trivia/search-guests', async (req, res) => {
  const { event, q } = req.query;
  const eventId = event || 'default';
  const query = q ? q.trim() : '';

  if (!query) {
    return res.json([]);
  }

  try {
    const guests = await db.getGuests(eventId);
    const rsvps = await db.getRsvps(eventId);

    const confirmedGuestsList = guests.filter(g => {
      const fullName = `${g.firstName} ${g.lastName}`;
      const isConfirmed = rsvps.some(r => r.attending === true && (
        normalizeString(r.name) === normalizeString(fullName) || 
        normalizeString(r.name).includes(normalizeString(g.firstName))
      ));
      return isConfirmed;
    });

    const otherConfirmedRsvps = rsvps.filter(r => r.attending === true && !confirmedGuestsList.some(g => {
      const fullName = `${g.firstName} ${g.lastName}`;
      return normalizeString(r.name) === normalizeString(fullName);
    }));

    const allConfirmedNames = [
      ...confirmedGuestsList.map(g => `${g.firstName} ${g.lastName}`),
      ...otherConfirmedRsvps.map(r => r.name)
    ];

    const queryClean = normalizeString(query);
    const queryWords = queryClean.split(/\s+/).filter(Boolean);

    const results = allConfirmedNames.filter(name => {
      const cleanName = normalizeString(name);
      return queryWords.every(word => cleanName.includes(word));
    });

    const uniqueResults = Array.from(new Set(results));
    res.json(uniqueResults.slice(0, 10));
  } catch (error) {
    console.error('Error in trivia search guests:', error);
    res.status(500).json({ error: 'Error al buscar invitados confirmados' });
  }
});

app.post('/api/trivia/join', async (req, res) => {
  const { eventId, nickname } = req.body;
  const normalizedNick = normalizeString(nickname);
  
  if (!normalizedNick) {
    return res.status(400).json({ error: 'Por favor, ingresa tu nombre.' });
  }

  if (eventId === 'default') {
    const success = triviaCoordinator.addPlayer(eventId, nickname);
    return res.json({ success });
  }

  try {
    const guests = await db.getGuests(eventId);
    const rsvps = await db.getRsvps(eventId);

    const confirmedNames = rsvps
      .filter(r => r.attending === true)
      .map(r => normalizeString(r.name));

    let found = confirmedNames.some(name => {
      return name === normalizedNick || name.includes(normalizedNick) || normalizedNick.includes(name);
    });

    if (!found) {
      found = guests.some(g => {
        const fullName = normalizeString(`${g.firstName} ${g.lastName}`);
        const isConfirmed = rsvps.some(r => r.attending === true && (normalizeString(r.name) === fullName || normalizeString(r.name).includes(normalizeString(g.firstName))));
        if (!isConfirmed) return false;
        return fullName.includes(normalizedNick) || normalizedNick.includes(normalizeString(g.firstName));
      });
    }

    if (!found) {
      return res.status(403).json({ 
        error: 'Acceso Denegado: Solo los invitados confirmados pueden participar en la Trivia.' 
      });
    }

    const success = triviaCoordinator.addPlayer(eventId, nickname);
    res.json({ success });
  } catch (err) {
    console.error('[TRIVIA JOIN ERROR]', err);
    res.status(500).json({ error: 'Error al verificar la lista de invitados.' });
  }
});

app.post('/api/trivia/respond', (req, res) => {
  const { eventId, nickname, optionIndex, timeTakenMs } = req.body;
  const success = triviaCoordinator.submitAnswer(eventId, nickname, optionIndex, timeTakenMs);
  res.json({ success });
});

app.get('/api/trivia/state', async (req, res) => {
  const eventId = req.query.event || 'default';
  if (!triviaCoordinator.sessions[eventId]) {
    try {
      const qStr = await db.getConfigValue(eventId, 'trivia_questions', '[]');
      const questions = JSON.parse(qStr);
      triviaCoordinator.initializeSession(eventId, questions);
    } catch (err) {
      console.error('[Trivia State Init Error]', err);
      triviaCoordinator.initializeSession(eventId, []);
    }
  }
  const state = triviaCoordinator.getSessionState(eventId);
  res.json({ success: true, state });
});

app.get('/api/trivia/leaderboard', (req, res) => {
  const eventId = req.query.event || 'default';
  const leaderboard = triviaCoordinator.getLeaderboard(eventId);
  res.json({ leaderboard });
});

app.post('/api/trivia/control', requireAuth, async (req, res) => {
  const eventId = req.query.event || req.body.eventId || 'default';
  const { action } = req.body;

  try {
    if (action === 'initialize' || action === 'init') {
      const qStr = await db.getConfigValue(eventId, 'trivia_questions', '[]');
      const questions = JSON.parse(qStr);
      triviaCoordinator.initializeSession(eventId, questions);
      return res.json({ success: true, state: triviaCoordinator.getSessionState(eventId) });
    }

    if (!triviaCoordinator.sessions[eventId]) {
      const qStr = await db.getConfigValue(eventId, 'trivia_questions', '[]');
      const questions = JSON.parse(qStr);
      triviaCoordinator.initializeSession(eventId, questions);
    }

    const session = triviaCoordinator.sessions[eventId];

    if (action === 'start') {
      const duration = req.body.duration ? parseInt(req.body.duration) : null;
      if (duration !== null) {
        triviaCoordinator.setCustomDuration(eventId, duration);
      }
      
      if (session) {
        if (session.status === 'PODIUM') {
          return res.status(400).json({ error: 'La trivia ya ha finalizado. Usa "Reiniciar Juego" para volver a jugar.' });
        }
        
        if (session.paused) {
          session.paused = false;
          triviaCoordinator.startQuestion(eventId, true);
          return res.json({ success: true });
        }
        
        if (session.status === 'REVEAL_ANSWER') {
          session.autoMode = true;
          triviaCoordinator.showLeaderboard(eventId);
          return res.json({ success: true });
        }
        
        if (session.status === 'LEADERBOARD') {
          session.autoMode = true;
          triviaCoordinator.nextQuestion(eventId);
          return res.json({ success: true });
        }
      }

      if (session && session.status === 'LOBBY' && session.currentQuestionIndex === 0) {
        triviaCoordinator.startCountdown(eventId);
      } else {
        triviaCoordinator.startQuestion(eventId, true);
      }
      res.json({ success: true });
    } else if (action === 'stop') {
      triviaCoordinator.stopTrivia(eventId);
      res.json({ success: true });
    } else if (action === 'toggle_auto') {
      const autoMode = triviaCoordinator.toggleAutoMode(eventId);
      res.json({ success: true, autoMode });
    } else if (action === 'set_duration') {
      const duration = req.body.duration ? parseInt(req.body.duration) : null;
      triviaCoordinator.setCustomDuration(eventId, duration);
      res.json({ success: true, customDuration: duration });
    } else if (action === 'reveal') {
      // Manual action disables autoMode
      if (session) {
        session.autoMode = false;
        if (session.timerId) {
          clearTimeout(session.timerId);
          session.timerId = null;
        }
      }
      triviaCoordinator.revealAnswer(eventId);
      res.json({ success: true });
    } else if (action === 'leaderboard') {
      // Manual action disables autoMode
      if (session) {
        session.autoMode = false;
        if (session.timerId) {
          clearTimeout(session.timerId);
          session.timerId = null;
        }
      }
      triviaCoordinator.showLeaderboard(eventId);
      res.json({ success: true });
    } else if (action === 'next') {
      // Manual action disables autoMode
      if (session) {
        session.autoMode = false;
        if (session.timerId) {
          clearTimeout(session.timerId);
          session.timerId = null;
        }
      }
      triviaCoordinator.nextQuestion(eventId);
      res.json({ success: true });
    } else if (action === 'jump_podium') {
      triviaCoordinator.jumpToPodium(eventId);
      res.json({ success: true, state: triviaCoordinator.getSessionState(eventId) });
    } else if (action === 'load_template') {
      const templateId = req.body.templateId;
      const tpl = TRIVIA_TEMPLATES[templateId];
      if (!tpl) {
        return res.status(404).json({ error: 'Plantilla no encontrada' });
      }
      await db.setConfigValue(eventId, 'trivia_questions', JSON.stringify(tpl.questions));
      triviaCoordinator.initializeSession(eventId, tpl.questions, templateId);
      res.json({ success: true, questions: tpl.questions, state: triviaCoordinator.getSessionState(eventId) });
    } else {
      res.status(400).json({ error: 'Acción no válida' });
    }
  } catch (err) {
    console.error('[Trivia Control Error]', err);
    res.status(500).json({ error: err.message || 'Error al procesar la acción de control de trivia' });
  }
});

// Templates Catalog Endpoint
app.get('/api/trivia/templates', (req, res) => {
  res.json({ success: true, templates: TRIVIA_TEMPLATES });
});

// Game Summary & Statistics Endpoint
app.get('/api/trivia/summary', (req, res) => {
  const eventId = req.query.event || 'default';
  const summary = triviaCoordinator.getGameSummary(eventId);
  if (!summary) {
    return res.status(404).json({ error: 'No hay datos de sesión activos' });
  }
  res.json({ success: true, summary });
});

// Export Final Results as CSV or JSON
app.get('/api/trivia/export', (req, res) => {
  const eventId = req.query.event || 'default';
  const format = req.query.format || 'csv';
  const summary = triviaCoordinator.getGameSummary(eventId);

  if (!summary || !summary.leaderboard) {
    return res.status(400).send('No hay resultados de trivia disponibles para exportar.');
  }

  if (format === 'json') {
    return res.json(summary);
  }

  // Generate clean CSV format
  const rows = [
    ['Posición', 'Invitado / Jugador', 'Puntaje Total', 'Racha Máxima', 'Tiempo Acumulado (s)']
  ];

  summary.leaderboard.forEach((p, idx) => {
    rows.push([
      idx + 1,
      `"${(p.nickname || '').replace(/"/g, '""')}"`,
      p.score || 0,
      p.highestStreak || p.streak || 0,
      ((p.totalTimeMs || 0) / 1000).toFixed(2)
    ]);
  });

  const csvContent = rows.map(r => r.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ranking-trivia-${eventId}.csv"`);
  res.send('\uFEFF' + csvContent);
});

// Intelligent Question Generator Endpoint
app.post('/api/trivia/generate', requireAuth, async (req, res) => {
  const { eventType, names, details, count = 5 } = req.body;
  const cleanType = eventType || 'casamiento';
  const cleanNames = (names || '').trim();
  const cleanDetails = (details || '').trim();

  // Smart algorithmic question synthesizer tailored for Argentine events
  const generated = [];
  const baseTpl = TRIVIA_TEMPLATES[cleanType] ? TRIVIA_TEMPLATES[cleanType].questions : TRIVIA_TEMPLATES.casamiento.questions;

  baseTpl.forEach((q, idx) => {
    let customText = q.questionText;
    if (cleanNames) {
      if (cleanType === 'casamiento') {
        customText = customText.replace(/los novios/gi, cleanNames).replace(/la pareja/gi, cleanNames);
      } else if (cleanType === 'quince_anos') {
        customText = customText.replace(/la Quinceañera/gi, cleanNames).replace(/ella/gi, cleanNames);
      } else if (cleanType === 'cumple_adultos') {
        customText = customText.replace(/el cumpleañero\/a/gi, cleanNames);
      }
    }
    generated.push({
      questionText: customText,
      options: [...q.options],
      correctOptionIndex: q.correctOptionIndex || 0,
      timeLimit: q.timeLimit || 20,
      doublePoints: !!q.doublePoints,
      category: q.category || 'Trivia'
    });
  });

  if (cleanDetails) {
    generated.push({
      questionText: `🌟 ANÉCDOTA ESPECIAL: ¿Cuál es el secreto mejor guardado de ${cleanNames || 'la noche'}?`,
      options: [
        cleanDetails.substring(0, 45),
        'Nadie se lo esperaba esa noche',
        'Se enteraron todos por una foto',
        'Fue el secreto mejor guardado por años'
      ],
      correctOptionIndex: 0,
      timeLimit: 20,
      doublePoints: true,
      category: 'Anécdotas VIP'
    });
  }

  res.json({ success: true, questions: generated.slice(0, Math.max(3, parseInt(count) || 5)) });
});


// ==========================================
// Capitanes de Mesa (Table Captains) Routes
// ==========================================

// Get Capitanes de Mesa Current State
app.get('/api/capitanes/state', async (req, res) => {
  const eventId = req.query.event || 'default';
  try {
    const state = await capitanesCoordinator.getOrInitializeSession(eventId);
    res.json(capitanesCoordinator.getSessionState(eventId));
  } catch (err) {
    console.error('[Capitanes State Route Error]', err);
    res.status(500).json({ error: 'Error al obtener el estado del juego.' });
  }
});

// SSE Stream for real-time updates
app.get('/api/capitanes/stream', async (req, res) => {
  const eventId = req.query.event || 'default';
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const session = await capitanesCoordinator.getOrInitializeSession(eventId);
    capitanesCoordinator.addClient(eventId, res);
    
    // Send initial state immediately
    const initialState = JSON.stringify({
      type: 'INITIAL_STATE',
      data: capitanesCoordinator.getSessionState(eventId)
    });
    res.write(`data: ${initialState}\n\n`);
  } catch (err) {
    console.error('[Capitanes Stream Route Error]', err);
  }

  req.on('close', () => {
    capitanesCoordinator.removeClient(eventId, res);
  });
});

// Update Capitanes Configuration
app.post('/api/capitanes/config', requireAuth, async (req, res) => {
  const eventId = req.query.event || req.body.event || 'default';
  const { gameMode, timeLimit, quests } = req.body;
  try {
    await db.saveCapitanesConfig(eventId, { gameMode, timeLimit, quests });
    await capitanesCoordinator.reloadConfig(eventId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Capitanes Config Route Error]', err);
    res.status(500).json({ error: 'Error al guardar la configuración.' });
  }
});

// Assign a guest as Captain to a table
app.post('/api/capitanes/assign-captain', requireAuth, async (req, res) => {
  const eventId = req.query.event || req.body.event || 'default';
  const { table, guestName } = req.body;
  if (!table) {
    return res.status(400).json({ error: 'La mesa es requerida.' });
  }
  try {
    const config = await db.getCapitanesConfig(eventId);
    if (!config.captains) {
      config.captains = {};
    }
    if (guestName) {
      config.captains[table] = guestName;
    } else {
      delete config.captains[table];
    }
    await db.saveCapitanesConfig(eventId, config);
    await capitanesCoordinator.reloadConfig(eventId);
    res.json({ success: true, captains: config.captains });
  } catch (err) {
    console.error('[Capitanes Assign Captain Route Error]', err);
    res.status(500).json({ error: 'Error al asignar el capitán de mesa.' });
  }
});

// Submit a Quest Verification (Guest Client)
app.post('/api/capitanes/submit', async (req, res) => {
  const eventId = req.query.event || req.body.event || 'default';
  const { mesa, questId, photoUrl, guestName } = req.body;
  if (!mesa || !questId) {
    return res.status(400).json({ error: 'Mesa y Quest ID son requeridos.' });
  }
  try {
    const session = await capitanesCoordinator.getOrInitializeSession(eventId);
    const cleanKey = s => s.toString().trim().toLowerCase().replace(/^mesa\s+/i, '');
    const mesaClean = cleanKey(mesa);
    const assignedCaptain = Object.entries(session.captains || {}).find(([tName]) => cleanKey(tName) === mesaClean)?.[1];

    if (!assignedCaptain) {
      return res.status(403).json({ error: 'Aún no se ha asignado un Capitán de Mesa para esta mesa.' });
    }
    if (assignedCaptain !== guestName) {
      return res.status(403).json({ error: `Solo el Capitán asignado (${assignedCaptain}) puede subir evidencias.` });
    }

    await capitanesCoordinator.submitQuest(eventId, mesa, questId, photoUrl);
    res.json({ success: true });
  } catch (err) {
    console.error('[Capitanes Submit Route Error]', err);
    res.status(500).json({ error: 'Error al enviar la misión.' });
  }
});

// Game Admin Control API
app.post('/api/capitanes/control', requireAuth, async (req, res) => {
  const eventId = req.query.event || req.body.event || 'default';
  const { action, mesa, questId } = req.body;

  try {
    const session = await capitanesCoordinator.getOrInitializeSession(eventId);

    if (action === 'start') {
      capitanesCoordinator.startGame(eventId);
    } else if (action === 'pause') {
      capitanesCoordinator.pauseGame(eventId);
    } else if (action === 'resume') {
      capitanesCoordinator.resumeGame(eventId);
    } else if (action === 'reset') {
      await capitanesCoordinator.resetGame(eventId);
    } else if (action === 'approve') {
      if (!mesa || !questId) {
        return res.status(400).json({ error: 'Mesa y Quest ID son requeridos para aprobar.' });
      }
      await capitanesCoordinator.approveQuest(eventId, mesa, questId);
    } else if (action === 'reject') {
      if (!mesa || !questId) {
        return res.status(400).json({ error: 'Mesa y Quest ID son requeridos para rechazar.' });
      }
      await capitanesCoordinator.rejectQuest(eventId, mesa, questId);
    } else {
      return res.status(400).json({ error: 'Acción inválida.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('[Capitanes Control Route Error]', err);
    res.status(500).json({ error: 'Error al procesar el control de capitanes.' });
  }
});

// Upload proof photo
app.post('/api/capitanes/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ninguna foto.' });
  }
  const eventId = req.query.event || 'default';
  
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const photoUrl = await db.uploadPhotoFile(eventId, req.file.originalname, fileBuffer, req.file.mimetype);
    
    // Remove the temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.json({ success: true, photoUrl });
  } catch (error) {
    console.error('Error uploading Capitanes photo:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Error al subir la foto.' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);

  // Handle multer error (e.g. file too large)
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'El archivo es demasiado grande. El límite permitido es de 15MB.'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Error de carga: ${err.message}`
    });
  }

  // Handle express body-parser 413 error (Request Entity Too Large)
  if (err.status === 413 || err.statusCode === 413) {
    return res.status(413).json({
      success: false,
      error: 'El cuerpo de la solicitud supera el tamaño máximo permitido.'
    });
  }

  // Generic fallback
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Ha ocurrido un error en el servidor.'
  });
});

// ============================================================================
// LA BATALLA DEL PLAYLIST / PEDÍ TU CANCIÓN API ENDPOINTS
// ============================================================================

// Search canonical music (iTunes Search API default)
app.get('/api/music/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const tracks = await tandaBattle.searchCanonicalMusic(query);
    res.json(tracks);
  } catch (err) {
    res.status(500).json({ error: 'Error al buscar canciones' });
  }
});

// Get active tanda battle state for event
app.get('/api/tanda/state', (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    const state = tandaBattle.getTandaState(eventId);
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener estado de la tanda' });
  }
});

// Nominate / add track to tanda ranking
app.post('/api/tanda/nominate', express.json(), (req, res) => {
  try {
    const { eventId, track, guestName, voterId } = req.body;
    if (!track || !track.trackId) {
      return res.status(400).json({ error: 'Canción canónica requerida' });
    }
    const result = tandaBattle.nominateTrack(eventId || 'default', track, guestName || 'Invitado', voterId || req.ip);
    res.json({ success: true, alreadyVoted: result.alreadyVoted, optionName: result.optionName, state: result.state });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al postular canción' });
  }
});

// Cast vote (up / down) on nominated track
app.post('/api/tanda/vote', express.json(), (req, res) => {
  try {
    const { eventId, trackId, voteType, voterId } = req.body;
    if (!trackId || !['up', 'down'].includes(voteType)) {
      return res.status(400).json({ error: 'Parámetros de voto inválidos' });
    }
    const result = tandaBattle.voteTrack(eventId || 'default', trackId, voteType, voterId || req.ip);
    res.json({ success: true, alreadyVoted: result.alreadyVoted, optionName: result.optionName, state: result.state });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al votar canción' });
  }
});

// DJ Control to change battle status
app.post('/api/tanda/control', express.json(), (req, res) => {
  try {
    const { eventId, status, durationMinutes } = req.body;
    if (!['idle', 'nominating', 'voting', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Estado de tanda inválido' });
    }
    const updatedState = tandaBattle.setTandaStatus(eventId || 'default', status, durationMinutes || 15);
    res.json({ success: true, state: updatedState });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar control de tanda' });
  }
});

// Cast vote on a musical genre
app.post('/api/tanda/vote-genre', express.json(), (req, res) => {
  try {
    const { eventId, genreId, voterId } = req.body;
    if (!genreId) {
      return res.status(400).json({ error: 'Género musical requerido' });
    }
    const result = tandaBattle.voteGenre(eventId || 'default', genreId, voterId || req.ip);
    res.json({ success: true, alreadyVoted: result.alreadyVoted, optionName: result.optionName, state: result.state });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al votar género musical' });
  }
});

// Add, edit, delete, or toggle custom genre (Admin control)
app.post('/api/tanda/genre', express.json(), (req, res) => {
  try {
    const { eventId, action, name, icon, genreId, active } = req.body;
    let updatedState;
    if (action === 'edit' || (genreId && name && active === undefined)) {
      updatedState = tandaBattle.editCustomGenre(eventId || 'default', genreId, name, icon);
    } else if (action === 'delete') {
      updatedState = tandaBattle.deleteCustomGenre(eventId || 'default', genreId);
    } else if (genreId !== undefined && active !== undefined) {
      updatedState = tandaBattle.toggleGenreActive(eventId || 'default', genreId, active);
    } else if (name) {
      updatedState = tandaBattle.addCustomGenre(eventId || 'default', name, icon || '🎵');
    } else {
      return res.status(400).json({ error: 'Parámetros de género inválidos' });
    }
    res.json({ success: true, state: updatedState });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al gestionar género' });
  }
});

// Set battle mode ('songs' | 'genres') (Admin control)
app.post('/api/tanda/mode', express.json(), (req, res) => {
  try {
    const { eventId, mode } = req.body;
    if (!['songs', 'genres'].includes(mode)) {
      return res.status(400).json({ error: 'Modo de batalla inválido' });
    }
    const updatedState = tandaBattle.setBattleMode(eventId || 'default', mode);
    res.json({ success: true, state: updatedState });
  } catch (err) {
    res.status(500).json({ error: 'Error al cambiar modo de batalla' });
  }
});

/**
 * =========================================================================
 * MIFIESTAPP MOBILE APP & AWARDS API ENDPOINTS (/api/app/*)
 * =========================================================================
 */

// 1. Verify Event Code (e.g. 'ALMA15')
app.post('/api/app/verify-code', express.json(), async (req, res) => {
  try {
    const rawCode = (req.body && req.body.code) ? String(req.body.code).trim() : '';
    if (!rawCode) {
      return res.status(400).json({ success: false, error: 'Por favor, ingresá el código de tu fiesta.' });
    }

    const cleanCode = rawCode.toLowerCase();
    const normalizedCode = cleanCode.replace(/[^a-z0-9]/g, '');

    const events = await db.getEvents();
    const matchedEvent = events.find(e => {
      const eId = (e.id || '').toLowerCase();
      const eClean = eId.replace(/[^a-z0-9]/g, '');
      return eId === cleanCode || eClean === normalizedCode;
    });

    if (!matchedEvent) {
      return res.status(404).json({ success: false, error: `No encontramos ningún evento con el código "${rawCode}". Verificá e intentá nuevamente.` });
    }

    if (matchedEvent.active === false) {
      return res.status(403).json({ success: false, error: 'Este evento se encuentra inactivo en este momento.' });
    }

    const eventId = matchedEvent.id;
    const info = await db.getEventInfoForApp(eventId);
    const coverUrl = await db.getConfigValue(eventId, 'event_cover_image', '/assets/coronamain.png');
    const brandColor = await db.getConfigValue(eventId, 'event_brand_color', '#d4af37');

    res.json({
      success: true,
      eventId,
      clientName: matchedEvent.clientName,
      title: info.eventTitle,
      coverUrl,
      brandColor,
      info,
      services: {
        tables: matchedEvent.serviceTables !== false,
        photos: matchedEvent.servicePhotos !== false,
        invitation: matchedEvent.serviceInvitation !== false,
        trivia: matchedEvent.serviceTrivia !== false,
        music: matchedEvent.serviceMusic !== false
      }
    });
  } catch (err) {
    console.error('[API App Verify Code Error]', err);
    res.status(500).json({ success: false, error: 'Error al verificar el código del evento.' });
  }
});

// 2. Upload Look / Selfie file for Guest Profile
app.post('/api/app/upload-look', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No se recibió ninguna imagen.' });
  }
  const eventId = req.query.event || 'default';
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const photoUrl = await db.uploadPhotoFile(eventId, `look_${Date.now()}_${req.file.originalname}`, fileBuffer, req.file.mimetype);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.json({ success: true, photoUrl });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: 'Error al procesar la foto de perfil.' });
  }
});

// 3. Save or Update Guest Profile (Name, Table, Look photo, Dietary, Device Token)
app.post('/api/app/guest-profile', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const { eventId = 'default', guestId, name, tableNumber, avatarUrl, dietary, phone, deviceToken } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'El nombre del invitado es requerido.' });
    }

    let finalAvatarUrl = avatarUrl;

    // Handle base64 selfie data URL if uploaded directly
    if (avatarUrl && avatarUrl.startsWith('data:image/')) {
      try {
        const matches = avatarUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const mimeType = matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = `avatar_${Date.now()}.jpg`;
          finalAvatarUrl = await db.uploadPhotoFile(eventId, filename, buffer, mimeType);
        }
      } catch (uploadErr) {
        console.warn('[App Profile Avatar Base64 Upload Warning]:', uploadErr.message);
      }
    }

    const savedProfile = await db.saveGuestProfile(eventId, {
      id: guestId,
      name: name.trim(),
      tableNumber,
      avatarUrl: finalAvatarUrl,
      dietary,
      phone,
      deviceToken
    });

    res.json({ success: true, profile: savedProfile });
  } catch (err) {
    console.error('[API App Save Guest Profile Error]', err);
    res.status(500).json({ success: false, error: 'Error al guardar el perfil del invitado.' });
  }
});

// 4. Get Guest Profile
app.get('/api/app/guest-profile/:eventId/:guestId', async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const profile = await db.getGuestProfile(eventId, guestId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Perfil no encontrado.' });
    }
    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener el perfil.' });
  }
});

// 5. Get All Guest Profiles for an Event (Admin & Avatar Picker)
app.get('/api/app/guest-profiles/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const profiles = await db.getGuestProfiles(eventId);
    res.json({ success: true, profiles });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener listado de perfiles.' });
  }
});

// 6. Get Event Info for App (Timeline, Location, Gifts, Dresscode, Transport)
app.get('/api/app/event-info/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const info = await db.getEventInfoForApp(eventId);
    res.json({ success: true, info });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener información del evento.' });
  }
});

// 7. Get Table Companions
app.get('/api/app/table-companions/:eventId/:tableNumber', async (req, res) => {
  try {
    const { eventId, tableNumber } = req.params;
    const guests = await db.getGuests(eventId);
    const companions = guests.filter(g => {
      const t1 = (g.table || '').toLowerCase().trim();
      const t2 = (tableNumber || '').toLowerCase().trim();
      return t1 === t2 && t1 !== 'sin mesa';
    }).map(g => ({
      name: `${g.firstName || ''} ${g.lastName || ''}`.trim(),
      table: g.table
    }));

    res.json({ success: true, companions });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener compañeros de mesa.' });
  }
});

// 8. Awards State (Categories, Nominees, Winner)
app.get('/api/app/awards/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const state = await awardsEngine.getAwardsState(eventId);
    res.json({ success: true, state });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al obtener los premios.' });
  }
});

// 9. Vote for an Award Nominee (Guest Action)
app.post('/api/app/awards/:eventId/vote', express.json(), async (req, res) => {
  try {
    const { eventId } = req.params;
    const { awardId, nomineeId, voterId } = req.body;
    if (!awardId || !nomineeId) {
      return res.status(400).json({ success: false, error: 'Premio y nominado requeridos.' });
    }
    const result = await awardsEngine.voteAwardNominee(eventId, awardId, nomineeId, voterId || 'anon_guest');
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message || 'Error al emitir el voto.' });
  }
});

// 10. Manage Awards (Admin Control Actions)
app.post('/api/app/awards/:eventId/manage', express.json(), async (req, res) => {
  try {
    const { eventId } = req.params;
    const { action, awardData, awardId, nominees, durationSeconds, winnerNomineeId } = req.body;

    switch (action) {
      case 'save_category':
        const saved = await awardsEngine.saveAwardCategory(eventId, awardData);
        return res.json({ success: true, awards: saved });
      case 'delete_category':
        const afterDelete = await awardsEngine.deleteAwardCategory(eventId, awardId);
        return res.json({ success: true, awards: afterDelete });
      case 'set_nominees':
        const updatedNominees = await awardsEngine.setAwardNominees(eventId, awardId, nominees);
        return res.json({ success: true, award: updatedNominees });
      case 'start_voting':
        const votingAward = await awardsEngine.startAwardVoting(eventId, awardId, durationSeconds || 90);
        return res.json({ success: true, award: votingAward });
      case 'declare_winner':
        const winnerAward = await awardsEngine.declareAwardWinner(eventId, awardId, winnerNomineeId);
        return res.json({ success: true, award: winnerAward });
      case 'reset':
        const resetAward = await awardsEngine.resetAward(eventId, awardId);
        return res.json({ success: true, award: resetAward });
      default:
        return res.status(400).json({ success: false, error: 'Acción de administración no reconocida.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Error en la gestión del premio.' });
  }
});

// 11. SSE Stream for Salon Big Screen & Mobile Sync
app.get('/api/app/awards-stream/:eventId', (req, res) => {
  const { eventId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  awardsEngine.subscribeAwardsStream(eventId, res);
});

// 12. Update Event Timeline (Admin)
app.post('/api/app/timeline/:eventId', express.json(), async (req, res) => {
  try {
    const { eventId } = req.params;
    const { timeline } = req.body;
    if (!Array.isArray(timeline)) {
      return res.status(400).json({ success: false, error: 'El cronograma debe ser una lista.' });
    }
    const saved = await db.saveEventTimeline(eventId, timeline);
    res.json({ success: true, timeline: saved });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Error al guardar el cronograma.' });
  }
});

// Handle 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Recursive server startup to handle occupied port
function startServer(port) {
  const server = app.listen(port, () => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIp = 'localhost';
    for (const name of Object.keys(networkInterfaces)) {
      for (const net of networkInterfaces[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          localIp = net.address;
          break;
        }
      }
    }
    console.log(`\n=============================================================`);
    console.log(`[miFiestAPP] Server running on http://localhost:${port}`);
    console.log(`[miFiestAPP] Local WiFi testing URL: http://${localIp}:${port}`);
    console.log(`=============================================================\n`);
  })
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[miFiestAPP] Port ${port} is in use, trying next port http://localhost:${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error(err);
    }
  });
}

const START_PORT = parseInt(PORT, 10);
if (!process.env.VERCEL) {
  startServer(START_PORT);
}

module.exports = app;

