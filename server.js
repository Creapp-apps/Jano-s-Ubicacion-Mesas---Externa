const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const csvParser = require('csv-parser');
const ExcelJS = require('exceljs');
const { searchGuests } = require('./utils/search');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'janos2026';
// Random session token generated on startup
const ADMIN_SESSION_TOKEN = Math.random().toString(36).substring(2) + Date.now().toString(36);

// Ensure storage folders exist
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');

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

// Protect direct access to admin.html before serving static files
app.get('/admin.html', (req, res) => {
  res.redirect('/admin');
});

app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
function requireAuth(req, res, next) {
  if (req.cookies && req.cookies.admin_session === ADMIN_SESSION_TOKEN) {
    return next();
  }
  res.status(401).json({ error: 'No autorizado. Inicie sesión.' });
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
app.get('/api/guests/search', (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.json([]);
  }
  
  if (!fs.existsSync(GUESTS_FILE)) {
    return res.json([]);
  }
  
  try {
    const fileData = fs.readFileSync(GUESTS_FILE, 'utf8');
    const guests = JSON.parse(fileData);
    const results = searchGuests(query, guests);
    res.json(results);
  } catch (error) {
    console.error('Error in search:', error);
    res.status(500).json({ error: 'Error al buscar invitados' });
  }
});

// API: Stats (For Admin)
app.get('/api/stats', requireAuth, (req, res) => {
  if (!fs.existsSync(GUESTS_FILE)) {
    return res.json({ guestCount: 0, tableCount: 0, tables: [] });
  }
  
  try {
    const fileData = fs.readFileSync(GUESTS_FILE, 'utf8');
    const guests = JSON.parse(fileData);
    
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
app.post('/api/clear', requireAuth, (req, res) => {
  try {
    if (fs.existsSync(GUESTS_FILE)) {
      fs.unlinkSync(GUESTS_FILE);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing data:', error);
    res.status(500).json({ error: 'Error al limpiar los datos' });
  }
});

// Define Event Config File
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// API: Get config (Public)
app.get('/api/config', (req, res) => {
  try {
    let config = { eventTitle: 'Mi Gran Fiesta Jano\'s' };
    if (fs.existsSync(CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    res.json(config);
  } catch (error) {
    res.json({ eventTitle: 'Mi Gran Fiesta Jano\'s' });
  }
});

// API: Update config (Admin)
app.post('/api/config', requireAuth, (req, res) => {
  const { eventTitle } = req.body;
  if (!eventTitle) {
    return res.status(400).json({ error: 'El título del evento es requerido' });
  }
  try {
    const config = { eventTitle: eventTitle.trim() };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar la configuración' });
  }
});

// API: Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', `admin_session=${ADMIN_SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Strict`);
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Contraseña incorrecta' });
});

// API: Admin Logout
app.post('/api/admin/logout', (req, res) => {
  res.setHeader('Set-Cookie', `admin_session=; Path=/; HttpOnly; Max-Age=0`);
  res.json({ success: true });
});

// API: Check Session
app.get('/api/admin/check', (req, res) => {
  if (req.cookies && req.cookies.admin_session === ADMIN_SESSION_TOKEN) {
    return res.json({ loggedIn: true });
  }
  res.json({ loggedIn: false });
});

// API: Download Mapped Excel (Admin)
app.get('/api/admin/download-excel', requireAuth, async (req, res) => {
  if (!fs.existsSync(GUESTS_FILE)) {
    return res.status(404).json({ error: 'No hay lista de invitados cargada' });
  }
  try {
    const fileData = fs.readFileSync(GUESTS_FILE, 'utf8');
    const guests = JSON.parse(fileData);
    
    // Get dynamic event title from config
    let eventTitle = "JANO'S EVENTOS - LISTA DE INVITADOS";
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        if (config.eventTitle) {
          eventTitle = `JANO'S - INVITADOS: ${config.eventTitle.toUpperCase()}`;
        }
      } catch (err) {
        // Ignore
      }
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
app.get('/api/admin/guests', requireAuth, (req, res) => {
  if (!fs.existsSync(GUESTS_FILE)) {
    return res.json([]);
  }
  try {
    const fileData = fs.readFileSync(GUESTS_FILE, 'utf8');
    res.json(JSON.parse(fileData));
  } catch (error) {
    res.status(500).json({ error: 'Error al leer invitados' });
  }
});

// API: Add Guest (Admin)
app.post('/api/guests', requireAuth, (req, res) => {
  const { firstName, lastName, table } = req.body;
  if (!firstName && !lastName) {
    return res.status(400).json({ error: 'El nombre o apellido es requerido' });
  }
  try {
    let guests = [];
    if (fs.existsSync(GUESTS_FILE)) {
      guests = JSON.parse(fs.readFileSync(GUESTS_FILE, 'utf8'));
    }
    guests.push({
      firstName: (firstName || '').trim(),
      lastName: (lastName || '').trim(),
      table: (table || 'Sin Mesa').trim()
    });
    fs.writeFileSync(GUESTS_FILE, JSON.stringify(guests, null, 2), 'utf8');
    res.json({ success: true, count: guests.length });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar el invitado' });
  }
});

// API: Edit Guest (Admin)
app.put('/api/guests/:index', requireAuth, (req, res) => {
  const index = parseInt(req.params.index, 10);
  const { firstName, lastName, table } = req.body;
  if (!firstName && !lastName) {
    return res.status(400).json({ error: 'El nombre o apellido es requerido' });
  }
  try {
    if (!fs.existsSync(GUESTS_FILE)) {
      return res.status(404).json({ error: 'No hay lista de invitados cargada' });
    }
    const guests = JSON.parse(fs.readFileSync(GUESTS_FILE, 'utf8'));
    if (index < 0 || index >= guests.length) {
      return res.status(404).json({ error: 'Invitado no encontrado' });
    }
    guests[index] = {
      firstName: (firstName || '').trim(),
      lastName: (lastName || '').trim(),
      table: (table || 'Sin Mesa').trim()
    };
    fs.writeFileSync(GUESTS_FILE, JSON.stringify(guests, null, 2), 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al modificar el invitado' });
  }
});

// API: Delete Guest (Admin)
app.delete('/api/guests/:index', requireAuth, (req, res) => {
  const index = parseInt(req.params.index, 10);
  try {
    if (!fs.existsSync(GUESTS_FILE)) {
      return res.status(404).json({ error: 'No hay lista de invitados cargada' });
    }
    const guests = JSON.parse(fs.readFileSync(GUESTS_FILE, 'utf8'));
    if (index < 0 || index >= guests.length) {
      return res.status(404).json({ error: 'Invitado no encontrado' });
    }
    guests.splice(index, 1);
    fs.writeFileSync(GUESTS_FILE, JSON.stringify(guests, null, 2), 'utf8');
    res.json({ success: true });
  } catch (error) {
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

  try {
    let rawData = [];

    if (fileExt === '.csv') {
      // Parse CSV
      const results = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          processParsedData(results, filePath, res);
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
      processParsedData(rawData, filePath, res);
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

// Helper function to map columns and write guests.json
function processParsedData(data, filePath, res) {
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

    // Write file (Overwrite by default)
    fs.writeFileSync(GUESTS_FILE, JSON.stringify(guests, null, 2), 'utf8');

    // Remove uploaded file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    res.json({ success: true, count: guests.length });
  } catch (error) {
    console.error('Error mapping data:', error);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: 'Error al estructurar los datos del archivo' });
  }
}

// Serve main app pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  if (req.cookies && req.cookies.admin_session === ADMIN_SESSION_TOKEN) {
    return res.sendFile(path.join(__dirname, 'private', 'admin.html'));
  }
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.cookies && req.cookies.admin_session === ADMIN_SESSION_TOKEN) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login.html', (req, res) => {
  res.redirect('/login');
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
startServer(START_PORT);

