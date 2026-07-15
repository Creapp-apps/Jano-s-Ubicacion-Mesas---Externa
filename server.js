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
const { triviaCoordinator } = require('./utils/trivia');

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
    console.warn('[MIFIESTAPP SERVER] Local UPLOADS_DIR creation ignored/failed (read-only filesystem):', err.message);
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

app.use(express.json());

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

  // If we are accessing the root or index.html and no custom eventId is provided (or eventId is 'default'),
  // we are requesting the landing page and don't need event validation.
  if ((filePath === '/' || filePath === '/index.html') && (!eventId || eventId === 'default')) {
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
app.get('/:eventId', async (req, res, next) => {
  const eventId = req.params.eventId;
  const staticRoutes = [
    'fotos', 'proyeccion', 'mesas', 'invitacion', 
    'admin', 'superadmin', 'superlogin', 'inactive', 
    'api', 'css', 'js', 'uploads', 'assets', 'favicon.ico', 
    'event.html', 'index.html', 'landing.html', '404.html', 'login.html'
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

app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
function requireAuth(req, res, next) {
  const eventId = req.query.event || req.body.event || 'default';
  const cookieName = `admin_session_${eventId}`;
  if (req.cookies && req.cookies[cookieName] === `${ADMIN_SESSION_TOKEN}_${eventId}`) {
    return next();
  }
  res.status(401).json({ error: 'No autorizado. Inicie sesión.' });
}

function requireSuperAuth(req, res, next) {
  if (req.cookies && req.cookies.superadmin_session === SUPERADMIN_SESSION_TOKEN) {
    return next();
  }
  res.status(401).json({ error: 'No autorizado. Inicie sesión como Superadmin.' });
}


// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

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

    if (confirmedGuests.length === 0) {
      return res.json({ guestCount: 0, tableCount: 0, tables: [] });
    }
    
    // Count unique tables and build tables list
    const tablesMap = {};
    confirmedGuests.forEach(g => {
      if (g.table) {
        tablesMap[g.table] = (tablesMap[g.table] || 0) + 1;
      }
    });
    
    const tables = Object.keys(tablesMap).map(name => ({
      name,
      count: tablesMap[name]
    })).sort((a, b) => {
      // Numerical sort if possible, otherwise alphabetical
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

    if (event) {
      clientName = event.clientName;
      serviceTables = event.serviceTables !== false;
      servicePhotos = event.servicePhotos !== false;
      serviceInvitation = event.serviceInvitation !== false;
      serviceTrivia = event.serviceTrivia !== false;
    }

    const triviaQuestions = config['trivia_questions'] || '[]';
    const invitationEventDate = config['invitation_event_date'] || '';
    const invitationMusicUrl = config['invitation_music_url'] || '';
    const invitationPartyAddress = config['invitation_party_address'] || '';
    const invitationPartyMapsUrl = config['invitation_party_maps_url'] || '';
    const invitationCbu = config['invitation_cbu'] || '';
    const invitationAlias = config['invitation_alias'] || '';
    const invitationBankHolder = config['invitation_bank_holder'] || '';
    const invitationDressCode = config['invitation_dress_code'] || 'Elegante';

    const invitationThemeColor = config['invitation_theme_color'] || 'golden-luxury';
    const invitationThemeFont = config['invitation_theme_font'] || 'classic-editorial';
    const invitationBgEffect = config['invitation_bg_effect'] || 'golden-dust';
    const invitationWaxSealDesign = config['invitation_wax_seal_design'] || 'rings';
    const invitationBgUrl = config['invitation_bg_url'] || '';
    const invitationCoverUrl = config['invitation_cover_url'] || '';

    const invitationPhoto1 = config['invitation_photo_1'] || '';
    const invitationPhoto2 = config['invitation_photo_2'] || '';
    const invitationPhoto3 = config['invitation_photo_3'] || '';
    const invitationPhoto4 = config['invitation_photo_4'] || '';
    const invitationPhoto5 = config['invitation_photo_5'] || '';

    res.json({
      eventTitle,
      googleDriveFolderUrl,
      clientName,
      serviceTables,
      servicePhotos,
      serviceInvitation,
      serviceTrivia,
      triviaQuestions,
      invitationEventDate,
      invitationMusicUrl,
      invitationPartyAddress,
      invitationPartyMapsUrl,
      invitationCbu,
      invitationAlias,
      invitationBankHolder,
      invitationDressCode,
      invitationThemeColor,
      invitationThemeFont,
      invitationBgEffect,
      invitationWaxSealDesign,
      invitationBgUrl,
      invitationCoverUrl,
      invitationPhoto1,
      invitationPhoto2,
      invitationPhoto3,
      invitationPhoto4,
      invitationPhoto5,
      snapApiToken: process.env.SNAP_API_TOKEN || '',
      snapGroupId: process.env.SNAP_GROUP_ID || '',
      snapLenses: {
        perrito: process.env.SNAP_LENS_PERRITO || '',
        cotillon: process.env.SNAP_LENS_COTILLON || '',
        makeup: process.env.SNAP_LENS_MAKEUP || process.env.SNAP_LENS_GLAM || '',
        angel: process.env.SNAP_LENS_ANGEL || '',
        demonio: process.env.SNAP_LENS_DEMONIO || '',
        payaso: process.env.SNAP_LENS_PAYASO || '',
        pirata: process.env.SNAP_LENS_PIRATA || '',
        cybervisor: process.env.SNAP_LENS_CYBERVISOR || process.env.SNAP_LENS_CYBER_VISOR || '',
        gato: process.env.SNAP_LENS_GATO || process.env.SNAP_LENS_GATITO || '',
        corona: process.env.SNAP_LENS_CORONA || '',
        vampiro: process.env.SNAP_LENS_VAMPIRO || ''
      }
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
        perrito: process.env.SNAP_LENS_PERRITO || '',
        cotillon: process.env.SNAP_LENS_COTILLON || '',
        makeup: process.env.SNAP_LENS_MAKEUP || process.env.SNAP_LENS_GLAM || '',
        angel: process.env.SNAP_LENS_ANGEL || '',
        demonio: process.env.SNAP_LENS_DEMONIO || '',
        payaso: process.env.SNAP_LENS_PAYASO || '',
        pirata: process.env.SNAP_LENS_PIRATA || '',
        cybervisor: process.env.SNAP_LENS_CYBERVISOR || process.env.SNAP_LENS_CYBER_VISOR || '',
        gato: process.env.SNAP_LENS_GATO || process.env.SNAP_LENS_GATITO || '',
        corona: process.env.SNAP_LENS_CORONA || '',
        vampiro: process.env.SNAP_LENS_VAMPIRO || ''
      }
    });
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
    invitationMusicUrl,
    invitationPartyAddress,
    invitationPartyMapsUrl,
    invitationCbu,
    invitationAlias,
    invitationBankHolder,
    invitationDressCode,
    invitationThemeColor,
    invitationThemeFont,
    invitationBgEffect,
    invitationWaxSealDesign,
    invitationBgUrl,
    invitationCoverUrl,
    invitationPhoto1,
    invitationPhoto2,
    invitationPhoto3,
    invitationPhoto4,
    invitationPhoto5,
    serviceTrivia,
    triviaQuestions
  } = req.body;
  const eventId = req.query.event || 'default';
  if (!eventTitle) {
    return res.status(400).json({ error: 'El título del evento es requerido' });
  }
  try {
    await db.setEventTitle(eventId, eventTitle);
    
    if (invitationEventDate !== undefined) await db.setConfigValue(eventId, 'invitation_event_date', invitationEventDate);
    if (invitationMusicUrl !== undefined) await db.setConfigValue(eventId, 'invitation_music_url', invitationMusicUrl);
    if (invitationPartyAddress !== undefined) await db.setConfigValue(eventId, 'invitation_party_address', invitationPartyAddress);
    if (invitationPartyMapsUrl !== undefined) await db.setConfigValue(eventId, 'invitation_party_maps_url', invitationPartyMapsUrl);
    if (invitationCbu !== undefined) await db.setConfigValue(eventId, 'invitation_cbu', invitationCbu);
    if (invitationAlias !== undefined) await db.setConfigValue(eventId, 'invitation_alias', invitationAlias);
    if (invitationBankHolder !== undefined) await db.setConfigValue(eventId, 'invitation_bank_holder', invitationBankHolder);
    if (invitationDressCode !== undefined) await db.setConfigValue(eventId, 'invitation_dress_code', invitationDressCode);

    if (invitationThemeColor !== undefined) await db.setConfigValue(eventId, 'invitation_theme_color', invitationThemeColor);
    if (invitationThemeFont !== undefined) await db.setConfigValue(eventId, 'invitation_theme_font', invitationThemeFont);
    if (invitationBgEffect !== undefined) await db.setConfigValue(eventId, 'invitation_bg_effect', invitationBgEffect);
    if (invitationWaxSealDesign !== undefined) await db.setConfigValue(eventId, 'invitation_wax_seal_design', invitationWaxSealDesign);
    if (invitationBgUrl !== undefined) await db.setConfigValue(eventId, 'invitation_bg_url', invitationBgUrl);
    if (invitationCoverUrl !== undefined) await db.setConfigValue(eventId, 'invitation_cover_url', invitationCoverUrl);

    if (invitationPhoto1 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_1', invitationPhoto1);
    if (invitationPhoto2 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_2', invitationPhoto2);
    if (invitationPhoto3 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_3', invitationPhoto3);
    if (invitationPhoto4 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_4', invitationPhoto4);
    if (invitationPhoto5 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_5', invitationPhoto5);
    if (serviceTrivia !== undefined) await db.updateEventServiceTrivia(eventId, serviceTrivia === true || serviceTrivia === 'true');
    if (triviaQuestions !== undefined) await db.setConfigValue(eventId, 'trivia_questions', triviaQuestions);

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving config:', error);
    res.status(500).json({ error: 'Error al guardar la configuración' });
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

// API: Public RSVP submit (No Auth)
app.post('/api/public/rsvp', async (req, res) => {
  const eventId = req.query.event || req.body.eventId || 'default';
  
  // Validate that the event exists and is active
  try {
    const isValid = await db.isEventValid(eventId);
    if (!isValid && eventId !== 'default') {
      return res.status(404).json({ error: 'El evento no existe o está inactivo' });
    }
  } catch (err) {
    console.error('Error validating event for RSVP:', err);
  }

  const { name, attending, companionsCount, companionsNames, dietaryRestrictions, suggestedSong } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  try {
    await db.addRsvp(eventId, {
      name,
      attending,
      companionsCount,
      companionsNames,
      dietaryRestrictions,
      suggestedSong
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding RSVP:', error);
    res.status(500).json({ error: 'Error al registrar tu confirmación' });
  }
});

// API: Public Song Suggestion submit (No Auth)
app.post('/api/public/suggest-song', async (req, res) => {
  const eventId = req.query.event || req.body.eventId || 'default';
  
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

  try {
    await db.saveSongSuggestion(eventId, name, song);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving song suggestion:', error);
    res.status(500).json({ error: 'Error al registrar tu sugerencia de canción' });
  }
});

// API: Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { password, email } = req.body;
  const eventId = req.query.event || req.body.eventId;
  
  try {
    if (email) {
      const event = await db.findEventByEmailAndPassword(email, password);
      if (!event) {
        return res.status(401).json({ error: 'Email o contraseña incorrectos.' });
      }
      if (!event.active) {
        return res.status(403).json({ error: 'El servicio está inactivo para este evento.' });
      }
      
      const cookieName = `admin_session_${event.id}`;
      res.setHeader('Set-Cookie', `${cookieName}=${ADMIN_SESSION_TOKEN}_${event.id}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Strict`);
      return res.json({ success: true, eventId: event.id });
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
  res.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; Max-Age=0`);
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
  res.setHeader('Set-Cookie', `superadmin_session=; Path=/; HttpOnly; Max-Age=0`);
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
  const { id, clientName, password, clientEmail, serviceTables, servicePhotos, serviceInvitation } = req.body;
  if (!id || !clientName) {
    return res.status(400).json({ error: 'El ID y el nombre del cliente son requeridos.' });
  }
  try {
    const sTables = serviceTables !== false;
    const sPhotos = servicePhotos !== false;
    const sInvitation = serviceInvitation !== false;
    
    const cleanId = await db.createEvent(id, clientName, password || '', clientEmail || '', sTables, sPhotos, sInvitation);
    
    // Create Google Drive folder in background immediately on event creation
    const { syncPhotosToDrive } = require('./utils/googleDrive');
    syncPhotosToDrive(cleanId).catch(err => {
      console.error(`[Google Drive] Error al crear la carpeta inicial para el evento ${cleanId}:`, err);
    });
    
    // Send welcome email and track status to inform UI
    let emailStatus = { sent: false };
    if (clientEmail && clientEmail.trim()) {
      try {
        const emailResult = await sendWelcomeEmail(clientEmail.trim(), clientName.trim(), cleanId, password || '');
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
app.post('/api/guests', requireAuth, async (req, res) => {
  const { firstName, lastName, table } = req.body;
  const eventId = req.query.event || 'default';
  if (!firstName && !lastName) {
    return res.status(400).json({ error: 'El nombre o apellido es requerido' });
  }
  try {
    await db.addGuest(eventId, { firstName, lastName, table });
    const guests = await db.getGuests(eventId);
    res.json({ success: true, count: guests.length });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar el invitado' });
  }
});

// API: Edit Guest (Admin)
app.put('/api/guests/:index', requireAuth, async (req, res) => {
  const index = parseInt(req.params.index, 10);
  const { firstName, lastName, table } = req.body;
  const eventId = req.query.event || 'default';
  if (!firstName && !lastName) {
    return res.status(400).json({ error: 'El nombre o apellido es requerido' });
  }
  try {
    await db.updateGuest(eventId, index, { firstName, lastName, table });
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating guest:', error);
    res.status(500).json({ error: 'Error al modificar el invitado' });
  }
});

// API: Delete Guest (Admin)
app.delete('/api/guests/:index', requireAuth, async (req, res) => {
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


// API: Upload Excel or CSV file
app.post('/api/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }

  const filePath = req.file.path;
  const fileExt = path.extname(req.file.originalname).toLowerCase();
  const eventId = req.query.event || 'default';

  try {
    let rawData = [];

    if (fileExt === '.csv') {
      // Parse CSV
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          processParsedData(eventId, results, filePath, res);
        })
        .on('error', (err) => {
          console.error(err);
          fs.unlinkSync(filePath);
          res.status(500).json({ error: 'Error al leer el archivo CSV' });
        });
    } else if (fileExt === '.xlsx' || fileExt === '.xls') {
      // Parse Excel
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      // Resilient check to see if row 1 is a title or merged banner
      let rangeOption = 0;
      const cellA1 = sheet['A1'] ? String(sheet['A1'].v || '').trim().toLowerCase() : '';
      const cellA2 = sheet['A2'] ? String(sheet['A2'].v || '').trim().toLowerCase() : '';
      const cellB2 = sheet['B2'] ? String(sheet['B2'].v || '').trim().toLowerCase() : '';
      
      if (cellA1.includes("plantilla") || cellA1.includes("jano") || cellA2.includes("nombre") || cellB2.includes("apellido")) {
        rangeOption = 1; // Skip title row, headers are on row 2
      }
      
      rawData = xlsx.utils.sheet_to_json(sheet, { range: rangeOption });
      processParsedData(eventId, rawData, filePath, res);
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

      return {
        firstName: nameKey ? String(row[nameKey]).trim() : '',
        lastName: surnameKey ? String(row[surnameKey]).trim() : '',
        table: tableKey ? String(row[tableKey]).trim() : 'Sin Mesa'
      };
    }).filter(g => g.firstName !== '' || g.lastName !== '');

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
      console.warn('[MiFiestAPP Server] Error unlinking temp files:', err.message);
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


// API: Upload guest photo
app.post('/api/photos/upload', upload.single('photo'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ninguna foto.' });
  }
  const { guestName, message } = req.body;
  const eventId = req.query.event || 'default';
  
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const photoUrl = await db.uploadPhotoFile(eventId, req.file.originalname, fileBuffer, req.file.mimetype);
    
    // Remove the temp file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    await db.addPhoto(eventId, { guestName, message, photoUrl });
    res.json({ success: true, photoUrl });
  } catch (error) {
    console.error('Error uploading photo:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Error al subir la foto y registrarla.' });
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
    
    // Automatically trigger Google Drive sync in background to upload the newly approved photo
    const { syncPhotosToDrive } = require('./utils/googleDrive');
    syncPhotosToDrive(eventId).catch(err => {
      console.error(`[Google Drive] Error sync-on-approval for event ${eventId}:`, err);
    });

    res.json({ success: true });
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
  } catch (error) {
    console.error('Error clearing photos:', error);
    res.status(500).json({ error: 'Error al limpiar la galería de fotos.' });
  }
});


// Serve main app pages
app.get('/fotos', async (req, res) => {
  const eventId = req.query.event || 'default';
  try {
    const events = await db.getEvents();
    const event = events.find(e => e.id === eventId);
    if (event && event.servicePhotos === false) {
      return res.redirect(`/event.html?event=${encodeURIComponent(eventId)}`);
    }
  } catch (err) {
    console.error('Error checking service availability:', err);
  }
  res.sendFile(path.join(__dirname, 'public', 'fotos.html'));
});

app.get('/proyeccion', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'proyeccion.html'));
});

app.get('/mesas', async (req, res) => {
  const eventId = req.query.event || 'default';
  try {
    const events = await db.getEvents();
    const event = events.find(e => e.id === eventId);
    if (event && event.serviceTables === false) {
      return res.redirect(`/event.html?event=${encodeURIComponent(eventId)}`);
    }
  } catch (err) {
    console.error('Error checking service availability:', err);
  }
  res.sendFile(path.join(__dirname, 'public', 'mesas.html'));
});

app.get('/invitacion', async (req, res) => {
  const eventId = req.query.event || 'default';
  try {
    const events = await db.getEvents();
    const event = events.find(e => e.id === eventId);
    if (event && event.serviceInvitation === false) {
      return res.redirect(`/event.html?event=${encodeURIComponent(eventId)}`);
    }
  } catch (err) {
    console.error('Error checking service availability:', err);
  }
  res.sendFile(path.join(__dirname, 'public', 'invitacion.html'));
});

app.get('/', (req, res) => {
  const eventId = req.query.event;
  if (eventId && eventId !== 'default') {
    return res.redirect(`/event.html?event=${encodeURIComponent(eventId)}`);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  const eventId = req.query.event || 'default';
  const cookieName = `admin_session_${eventId}`;
  if (req.cookies && req.cookies[cookieName] === `${ADMIN_SESSION_TOKEN}_${eventId}`) {
    return res.sendFile(path.join(__dirname, 'private', 'admin.html'));
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
    return res.redirect(`/admin${queryString}`);
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

app.get('/api/trivia/stream', (req, res) => {
  const eventId = req.query.event || 'default';
  const role = req.query.role || 'player';
  const nickname = req.query.nickname || '';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  if (!triviaCoordinator.sessions[eventId]) {
    triviaCoordinator.initializeSession(eventId, []);
  }

  const session = triviaCoordinator.sessions[eventId];
  const clientObj = { res, role, nickname };
  session.clients.push(clientObj);

  res.write(`data: ${JSON.stringify({ type: 'INITIAL_STATE', data: triviaCoordinator.getSessionState(eventId) })}\n\n`);

  req.on('close', () => {
    session.clients = session.clients.filter(c => c.res !== res);
  });
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

app.get('/api/trivia/leaderboard', (req, res) => {
  const eventId = req.query.event || 'default';
  const leaderboard = triviaCoordinator.getLeaderboard(eventId);
  res.json({ leaderboard });
});

app.post('/api/trivia/control', requireAuth, async (req, res) => {
  const eventId = req.query.event || req.body.eventId || 'default';
  const { action } = req.body;

  if (action === 'initialize') {
    try {
      const qStr = await db.getConfigValue(eventId, 'trivia_questions', '[]');
      const questions = JSON.parse(qStr);
      triviaCoordinator.initializeSession(eventId, questions);
      res.json({ success: true, state: triviaCoordinator.getSessionState(eventId) });
    } catch (err) {
      res.status(500).json({ error: 'Error al inicializar la trivia' });
    }
  } else if (action === 'start') {
    triviaCoordinator.startQuestion(eventId);
    res.json({ success: true });
  } else if (action === 'reveal') {
    triviaCoordinator.revealAnswer(eventId);
    res.json({ success: true });
  } else if (action === 'leaderboard') {
    triviaCoordinator.showLeaderboard(eventId);
    res.json({ success: true });
  } else if (action === 'next') {
    triviaCoordinator.nextQuestion(eventId);
    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Acción no válida' });
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
    console.log(`[MiFiestAPP] Server running on http://localhost:${port}`);
    console.log(`[MiFiestAPP] Local WiFi testing URL: http://${localIp}:${port}`);
    console.log(`=============================================================\n`);
  })
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[MiFiestAPP] Port ${port} is in use, trying next port http://localhost:${port + 1}...`);
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

