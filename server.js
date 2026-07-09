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

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'janos2026';
// Random session token generated on startup
const ADMIN_SESSION_TOKEN = Math.random().toString(36).substring(2) + Date.now().toString(36);

const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'janos-superadmin';
const SUPERADMIN_SESSION_TOKEN = 'super_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
    if (guests.length === 0) {
      return res.json({ guestCount: 0, tableCount: 0, tables: [] });
    }
    
    // Count unique tables and build tables list
    const tablesMap = {};
    guests.forEach(g => {
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
      guestCount: guests.length,
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
    const eventTitle = await db.getEventTitle(eventId);
    let clientName = '';
    let serviceTables = true;
    let servicePhotos = true;
    let serviceInvitation = true;
    try {
      const events = await db.getEvents();
      const event = events.find(e => e.id === eventId);
      if (event) {
        clientName = event.clientName;
        serviceTables = event.serviceTables !== false;
        servicePhotos = event.servicePhotos !== false;
        serviceInvitation = event.serviceInvitation !== false;
      }
    } catch (e) {
      console.error('Error fetching clientName for config:', e);
    }
    res.json({ eventTitle, clientName, serviceTables, servicePhotos, serviceInvitation });
  } catch (error) {
    res.json({ eventTitle: 'Mi Gran Fiesta Jano\'s', clientName: '', serviceTables: true, servicePhotos: true, serviceInvitation: true });
  }
});

// API: Update config (Admin)
app.post('/api/config', requireAuth, async (req, res) => {
  const { eventTitle } = req.body;
  const eventId = req.query.event || 'default';
  if (!eventTitle) {
    return res.status(400).json({ error: 'El título del evento es requerido' });
  }
  try {
    await db.setEventTitle(eventId, eventTitle);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar la configuración' });
  }
});

// API: Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const eventId = req.query.event || req.body.eventId || 'default';
  
  try {
    const isValid = await db.validateEventPassword(eventId, password);
    if (isValid) {
      const cookieName = `admin_session_${eventId}`;
      res.setHeader('Set-Cookie', `${cookieName}=${ADMIN_SESSION_TOKEN}_${eventId}; Path=/; HttpOnly; SameSite=Strict`);
      return res.json({ success: true });
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
    res.setHeader('Set-Cookie', `superadmin_session=${SUPERADMIN_SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Strict`);
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
    let eventTitle = "JANO'S EVENTOS - LISTA DE INVITADOS";
    try {
      const configTitle = await db.getEventTitle(eventId);
      eventTitle = `JANO'S - INVITADOS: ${configTitle.toUpperCase()}`;
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

// API: Approve a photo (Admin)
app.put('/api/admin/photos/:id/approve', requireAuth, async (req, res) => {
  try {
    const eventId = req.query.event || 'default';
    await db.approvePhoto(eventId, req.params.id);
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
      return res.redirect(`/?event=${encodeURIComponent(eventId)}`);
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
      return res.redirect(`/?event=${encodeURIComponent(eventId)}`);
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
      return res.redirect(`/?event=${encodeURIComponent(eventId)}`);
    }
  } catch (err) {
    console.error('Error checking service availability:', err);
  }
  res.sendFile(path.join(__dirname, 'public', 'invitacion.html'));
});

app.get('/', (req, res) => {
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
    console.log(`[JANO'S] Server running on http://localhost:${port}`);
    console.log(`[JANO'S] Local WiFi testing URL: http://${localIp}:${port}`);
    console.log(`=============================================================\n`);
  })
  .on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[JANO'S] Port ${port} is in use, trying next port http://localhost:${port + 1}...`);
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

