# QR Mesas Jano's Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a premium, high-craft web application for Jano's Eventos that allows guests to scan a QR code and enter their name to find their assigned table, with an Excel import panel for event organizers.

**Architecture:** A simple Node.js Express server with APIs for Excel uploads (parsed and saved to a local JSON file) and fuzzy guest name searching. The frontend is built with native HTML, CSS, and JS to ensure luxury styling, fluid transitions, and fast loading on mobile devices.

**Tech Stack:** Node.js, Express, Multer, xlsx, dotenv, Vanilla CSS, Vanilla JS.

---

### Task 1: Project Setup and package.json

**Files:**
- Create: `package.json`

**Step 1: Write the package.json content**
Create `package.json` with dependencies and start scripts.

```json
{
  "name": "qr-mesas-janos",
  "version": "1.0.0",
  "description": "Localizador de mesas QR para Jano's Eventos",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "csv-parser": "^3.0.0",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.0"
  }
}
```

**Step 2: Run npm install**
Run: `npm install`
Expected: Dependencies installed successfully, creating `package-lock.json` and `node_modules`.

**Step 3: Commit**
```bash
git add package.json
git commit -m "chore: initialize project and package.json"
```

---

### Task 2: Backend Test Setup and First Test

**Files:**
- Create: `tests/server.test.js`

**Step 1: Write a failing test for guest searching**
Create a test script that validates the fuzzy search helper function (which we will implement in server logic).

```javascript
// tests/server.test.js
const assert = require('assert');
const { searchGuests } = require('../utils/search');

// Mock data
const mockGuests = [
  { name: 'Sebastián Maza', table: 'Mesa 5' },
  { name: 'María Luz', table: 'Mesa 12' },
  { name: 'Juan Pérez', table: 'Mesa 5' }
];

try {
  console.log('Running test_fuzzy_search_matches...');
  const results = searchGuests('seba', mockGuests);
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].name, 'Sebastián Maza');
  console.log('test_fuzzy_search_matches passed!');
} catch (e) {
  console.error('test_fuzzy_search_matches failed:', e.message);
  process.exit(1);
}
```

**Step 2: Run test to verify it fails**
Run: `node tests/server.test.js`
Expected: FAIL with "Cannot find module '../utils/search'"

**Step 3: Write minimal implementation**
Create `utils/search.js`:

```javascript
function searchGuests(query, guests) {
  if (!query) return [];
  const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return guests.filter(g => {
    const cleanName = g.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return cleanName.includes(cleanQuery);
  });
}

module.exports = { searchGuests };
```

**Step 4: Run test to verify it passes**
Run: `node tests/server.test.js`
Expected: PASS with "test_fuzzy_search_matches passed!"

**Step 5: Commit**
```bash
git add tests/server.test.js utils/search.js
git commit -m "test: implement fuzzy search helper and unit tests"
```

---

### Task 3: Express Server Implementation

**Files:**
- Create: `server.js`
- Create: `.env`

**Step 1: Write tests for Express routing**
Create a simple server test to assert the API response for static serving and searching.

```javascript
// Append to tests/server.test.js
// Test express search endpoint once server is running
```
*(We will verify Express endpoints manually or write a mock integration test in tests)*.

**Step 2: Implement server.js and .env**
Create `.env`:
```env
PORT=3000
ADMIN_PIN=1234
```

Create `server.js`:
```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const { searchGuests } = require('./utils/search');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PIN = process.env.ADMIN_PIN || '1234';

// Ensure data folder exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
const GUESTS_FILE = path.join(DATA_DIR, 'guests.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer for upload
const upload = multer({ dest: 'uploads/' });

// API: Search guests
app.get('/api/guests/search', (req, res) => {
  const query = req.query.q;
  if (!fs.existsSync(GUESTS_FILE)) {
    return res.json([]);
  }
  const fileData = fs.readFileSync(GUESTS_FILE, 'utf8');
  const guests = JSON.parse(fileData);
  const results = searchGuests(query, guests);
  res.json(results);
});

// API: Upload Excel
app.post('/api/upload', upload.single('file'), (req, res) => {
  const pin = req.headers['x-admin-pin'];
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún archivo' });
  }

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Map rows to clean structure (Name, Table)
    const guests = data.map(row => {
      // Find name column dynamically
      const nameKey = Object.keys(row).find(k => /nombre|invitado|persona|name/i.test(k));
      const tableKey = Object.keys(row).find(k => /mesa|table|ubicacion/i.test(k));

      return {
        name: nameKey ? String(row[nameKey]).trim() : 'Sin Nombre',
        table: tableKey ? String(row[tableKey]).trim() : 'Sin Mesa'
      };
    }).filter(g => g.name !== 'Sin Nombre');

    fs.writeFileSync(GUESTS_FILE, JSON.stringify(guests, null, 2), 'utf8');
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ success: true, count: guests.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error procesando el archivo Excel' });
  }
});

// API: Stats
app.get('/api/stats', (req, res) => {
  if (!fs.existsSync(GUESTS_FILE)) {
    return res.json({ guestCount: 0, tableCount: 0 });
  }
  const guests = JSON.parse(fs.readFileSync(GUESTS_FILE, 'utf8'));
  const uniqueTables = new Set(guests.map(g => g.table));
  res.json({ guestCount: guests.length, tableCount: uniqueTables.size });
});

// API: Clear
app.post('/api/clear', (req, res) => {
  const pin = req.headers['x-admin-pin'];
  if (pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }
  if (fs.existsSync(GUESTS_FILE)) {
    fs.unlinkSync(GUESTS_FILE);
  }
  res.json({ success: true });
});

// Serve Guest view by default
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve Admin view
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Step 3: Run the tests & manual server verification**
Verify server boots correctly.
Expected: "Server running on port 3000"

**Step 4: Commit**
```bash
git add server.js .env
git commit -m "feat: implement express server with excel parser and endpoints"
```

---

### Task 4: Frontend Assets and Styled Typography

**Files:**
- Create: `public/assets/logo.svg`
- Create: `public/css/style.css`

**Step 1: Write styling structure (colors, fonts)**
Include Google Fonts and custom CSS variables for Luxury Refined branding. Write `public/css/style.css`.

**Step 2: Create a beautiful SVG logo**
Write `public/assets/logo.svg`.

**Step 3: Commit**
```bash
git add public/css/style.css public/assets/logo.svg
git commit -m "style: define luxury brand CSS variables and typographic SVG logo"
```

---

### Task 5: Guest View HTML & JS Implementation

**Files:**
- Create: `public/index.html`
- Create: `public/js/app.js`

**Step 1: Write HTML Structure**
Create `public/index.html` with luxurious dark mode containers, searching form, autocomplete list, and the VIP table ticket card.

**Step 2: Write Client JS logic**
Create `public/js/app.js` with inputs events, autocomplete fetching, and the luxury "reveal" animation.

**Step 3: Commit**
```bash
git add public/index.html public/js/app.js
git commit -m "feat: complete Guest view layout and search-reveal interaction"
```

---

### Task 6: Admin View HTML, CSS, JS Implementation

**Files:**
- Create: `public/admin.html`
- Create: `public/css/admin.css`
- Create: `public/js/admin.js`

**Step 1: Create Admin Panel Files**
Implement password lock prompt, file drag-and-drop area, stats charts, and QR code print layout.

**Step 2: Commit**
```bash
git add public/admin.html public/css/admin.css public/js/admin.js
git commit -m "feat: implement admin panel with excel upload, stats, and QR print generator"
```

## Execution Handoff

Plan complete and saved to `docs/plans/2026-07-08-qr-mesas-janos.md`. Two execution options:

1. **Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration
2. **Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
