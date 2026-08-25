const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Support loading env vars for local testing if dotenv is installed
try {
  require('dotenv').config();
} catch (e) {
  // Ignored if dotenv is not installed
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const isSupabaseEnabled = !!(SUPABASE_URL && SUPABASE_KEY) && process.env.FORCE_LOCAL !== 'true';

let supabase = null;
if (isSupabaseEnabled) {
  console.log('[miFiestAPP DB] Supabase database connection enabled.');
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.log('[miFiestAPP DB] Local JSON file storage enabled (Supabase credentials missing).');
}

// Local File Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('[miFiestAPP DB] Local DATA_DIR creation ignored/failed (read-only filesystem):', err.message);
  }
}
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

function getLocalEvents() {
  if (!fs.existsSync(EVENTS_FILE)) {
    const defaultEvents = [{ id: 'default', clientName: 'Default Event', active: true, createdAt: new Date().toISOString() }];
    try {
      fs.writeFileSync(EVENTS_FILE, JSON.stringify(defaultEvents, null, 2), 'utf8');
    } catch (err) {
      console.warn('[miFiestAPP DB] Local events.json write failed:', err.message);
    }
    return defaultEvents;
  }
  try {
    return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
  } catch (err) {
    console.error('Error reading local events file:', err);
    return [];
  }
}

function saveLocalEvents(events) {
  try {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2), 'utf8');
  } catch (err) {
    console.error('[miFiestAPP DB] Local saveLocalEvents write failed:', err.message);
  }
}

const LOCAL_PHOTOS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'photos');
if (!isSupabaseEnabled && !fs.existsSync(LOCAL_PHOTOS_DIR)) {
  try {
    fs.mkdirSync(LOCAL_PHOTOS_DIR, { recursive: true });
  } catch (err) {
    console.warn('[miFiestAPP DB] Local LOCAL_PHOTOS_DIR creation ignored/failed:', err.message);
  }
}

const LOCAL_AUDIO_DIR = path.join(__dirname, '..', 'public', 'uploads', 'audio');
if (!isSupabaseEnabled && !fs.existsSync(LOCAL_AUDIO_DIR)) {
  try {
    fs.mkdirSync(LOCAL_AUDIO_DIR, { recursive: true });
  } catch (err) {
    console.warn('[miFiestAPP DB] Local LOCAL_AUDIO_DIR creation ignored/failed:', err.message);
  }
}

// Migration logic for old/legacy flat files structure (copying to data/default/)
const defaultDir = path.join(DATA_DIR, 'default');
if (!fs.existsSync(defaultDir)) {
  try {
    fs.mkdirSync(defaultDir, { recursive: true });
  } catch (err) {
    console.warn('[miFiestAPP DB] Local defaultDir creation failed:', err.message);
  }
}
const oldGuests = path.join(DATA_DIR, 'guests.json');
const oldConfig = path.join(DATA_DIR, 'config.json');
const oldPhotos = path.join(DATA_DIR, 'photos.json');
try {
  if (fs.existsSync(oldGuests) && !fs.existsSync(path.join(defaultDir, 'guests.json'))) {
    fs.copyFileSync(oldGuests, path.join(defaultDir, 'guests.json'));
  }
  if (fs.existsSync(oldConfig) && !fs.existsSync(path.join(defaultDir, 'config.json'))) {
    fs.copyFileSync(oldConfig, path.join(defaultDir, 'config.json'));
  }
  if (fs.existsSync(oldPhotos) && !fs.existsSync(path.join(defaultDir, 'photos.json'))) {
    fs.copyFileSync(oldPhotos, path.join(defaultDir, 'photos.json'));
  }
} catch (err) {
  console.warn('[miFiestAPP DB] Legacy migration files copy ignored/failed:', err.message);
}

/**
 * Helper to get path endpoints isolated by eventId
 */
function getEventFiles(eventId) {
  const cleanId = (eventId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
  const eventDir = path.join(DATA_DIR, cleanId);
  if (!fs.existsSync(eventDir)) {
    try {
      fs.mkdirSync(eventDir, { recursive: true });
    } catch (err) {
      console.warn('[miFiestAPP DB] Local eventDir creation ignored/failed:', err.message);
    }
  }
  return {
    guestsFile: path.join(eventDir, 'guests.json'),
    configFile: path.join(eventDir, 'config.json'),
    photosFile: path.join(eventDir, 'photos.json'),
    photosDir: path.join(LOCAL_PHOTOS_DIR, cleanId)
  };
}

// Dynamically try to create the event-photos storage bucket on Supabase
if (isSupabaseEnabled) {
  (async () => {
    try {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      if (!listError && buckets) {
        const exists = buckets.some(b => b.name === 'event-photos');
        if (!exists) {
          await supabase.storage.createBucket('event-photos', { public: true });
          console.log("[miFiestAPP DB] Supabase 'event-photos' storage bucket created successfully.");
        }
      }
    } catch (e) {
      console.warn("[miFiestAPP DB] Storage bucket initial setup warning (might lack policy creation rights):", e.message);
    }
  })();
}

/**
 * Get all guests as an array of { firstName, lastName, table, id? }
/**
 * Normalizes table number/name to a standard format (e.g. "Mesa 1", "Mesa Principal", "Sin Mesa")
 */
function normalizeTable(table) {
  if (!table) return 'Sin Mesa';
  let t = String(table).trim();
  if (!t || t.toLowerCase() === 'sin mesa') return 'Sin Mesa';
  
  if (/^\d+$/.test(t)) return `Mesa ${t}`;
  if (/^mesa\b/i.test(t)) {
    return t.replace(/^mesa\s*/i, 'Mesa ');
  }
  if (t.toLowerCase() === 'mesa principal' || t.toLowerCase() === 'principal') {
    return 'Mesa Principal';
  }
  return t;
}

/**
 * Normalizes a guest full name to strip accents/diacritics, trim, lowercase and collapse spaces
 */
function normalizeName(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Deduplicates a list of guests by normalized full name or phone number
 */
function deduplicateGuests(guestsList) {
  if (!Array.isArray(guestsList)) return [];
  const seenMap = new Map();
  const result = [];

  for (const g of guestsList) {
    const fullName = `${g.firstName || ''} ${g.lastName || ''}`.trim();
    const normKey = normalizeName(fullName);
    const cleanPhone = (g.phone || '').replace(/[^0-9]/g, '');

    let primaryKey = normKey;
    if (!primaryKey && cleanPhone && cleanPhone.length >= 6) {
      primaryKey = `phone_${cleanPhone}`;
    }

    if (!primaryKey) continue;

    if (seenMap.has(primaryKey)) {
      const existing = seenMap.get(primaryKey);
      if ((!existing.table || existing.table === 'Sin Mesa') && g.table && g.table !== 'Sin Mesa') {
        existing.table = g.table;
      }
      if (!existing.phone && g.phone) {
        existing.phone = g.phone;
      }
    } else {
      const copy = { ...g };
      seenMap.set(primaryKey, copy);
      if (cleanPhone && cleanPhone.length >= 6) {
        seenMap.set(`phone_${cleanPhone}`, copy);
      }
      result.push(copy);
    }
  }

  return result;
}

/**
 * Raw internal fetch for guests (without sync trigger to prevent recursion)
 */
async function fetchGuestsRaw(eventId = 'default') {
  let list = [];
  if (isSupabaseEnabled) {
    const { data, error } = await supabase
      .from('guests')
      .select('*')
      .eq('event_id', eventId)
      .order('id', { ascending: true });
      
    if (error) {
      console.error('Error fetching guests from Supabase:', error);
      throw error;
    }
    
    const { guestsFile } = getEventFiles(eventId);
    let localGuests = [];
    if (fs.existsSync(guestsFile)) {
      try {
        localGuests = JSON.parse(fs.readFileSync(guestsFile, 'utf8')) || [];
      } catch (e) {}
    }
    
    list = (data || []).map(g => {
      const localMatch = localGuests.find(lg => 
        normalizeName(`${lg.firstName} ${lg.lastName}`) === normalizeName(`${g.first_name} ${g.last_name}`)
      );
      return {
        id: g.id,
        firstName: g.first_name || '',
        lastName: g.last_name || '',
        table: normalizeTable(g.table_number),
        phone: g.phone || g.telephone || g.telefono || (localMatch ? localMatch.phone : '') || ''
      };
    });
  } else {
    const { guestsFile } = getEventFiles(eventId);
    if (!fs.existsSync(guestsFile)) {
      return [];
    }
    try {
      const fileData = fs.readFileSync(guestsFile, 'utf8');
      const parsed = JSON.parse(fileData);
      list = (parsed || []).map(g => ({
        ...g,
        table: normalizeTable(g.table),
        phone: g.phone || ''
      }));
    } catch (err) {
      console.error('Error reading local guests file:', err);
      return [];
    }
  }

  return deduplicateGuests(list);
}

/**
 * Synchronize confirmed RSVPs into guests list so all confirmed attendees are present for table assignment
 */
async function syncConfirmedRsvpsToGuests(eventId = 'default') {
  try {
    const rsvps = await getRsvps(eventId);
    const confirmedRsvps = rsvps.filter(r => r.attending === true || String(r.attending).toUpperCase() === 'SI');
    if (confirmedRsvps.length === 0) return;

    let currentGuests = await fetchGuestsRaw(eventId);
    const existingNames = new Set(
      currentGuests.map(g => normalizeName(`${g.firstName} ${g.lastName}`))
    );
    const existingPhones = new Set(
      currentGuests
        .map(g => (g.phone || '').replace(/[^0-9]/g, ''))
        .filter(p => p.length >= 6)
    );

    let addedAny = false;

    for (const rsvp of confirmedRsvps) {
      const fullName = (rsvp.name || '').trim();
      if (fullName) {
        const normFullName = normalizeName(fullName);
        const cleanPhone = (rsvp.phone || '').replace(/[^0-9]/g, '');
        const existsByPhone = cleanPhone && cleanPhone.length >= 6 && existingPhones.has(cleanPhone);
        const existsByName = existingNames.has(normFullName);

        if (!existsByName && !existsByPhone) {
          const parts = fullName.split(/\s+/);
          const fName = parts[0] || '';
          const lName = parts.slice(1).join(' ') || '';
          currentGuests.push({
            firstName: fName,
            lastName: lName,
            table: 'Sin Mesa',
            phone: cleanPhone || ''
          });
          existingNames.add(normFullName);
          if (cleanPhone && cleanPhone.length >= 6) existingPhones.add(cleanPhone);
          addedAny = true;
        }
      }

      let compList = [];
      if (Array.isArray(rsvp.companionsNames)) {
        compList = rsvp.companionsNames;
      } else if (typeof rsvp.companionsNames === 'string' && rsvp.companionsNames.trim()) {
        compList = rsvp.companionsNames.split(',').map(s => s.trim());
      }

      for (const compName of compList) {
        const trimmedComp = (compName || '').trim();
        if (trimmedComp) {
          const normComp = normalizeName(trimmedComp);
          if (!existingNames.has(normComp)) {
            const parts = trimmedComp.split(/\s+/);
            const fName = parts[0] || '';
            const lName = parts.slice(1).join(' ') || '';
            currentGuests.push({
              firstName: fName,
              lastName: lName,
              table: 'Sin Mesa',
              phone: ''
            });
            existingNames.add(normComp);
            addedAny = true;
          }
        }
      }
    }

    const deduped = deduplicateGuests(currentGuests);
    if (addedAny || deduped.length !== currentGuests.length) {
      await saveGuests(eventId, deduped);
    }
  } catch (err) {
    console.error('Error syncing confirmed RSVPs to guests:', err);
  }
}

/**
 * Get all guests for an event (syncs confirmed RSVPs automatically)
 */
async function getGuests(eventId = 'default') {
  await syncConfirmedRsvpsToGuests(eventId);
  return await fetchGuestsRaw(eventId);
}

/**
 * Save / Overwrite the entire guests list
 */
async function saveGuests(eventId = 'default', guestsList) {
  const formattedGuests = guestsList.map(g => ({
    firstName: (g.firstName || '').trim(),
    lastName: (g.lastName || '').trim(),
    table: normalizeTable(g.table),
    phone: (g.phone || '').trim()
  }));

  if (isSupabaseEnabled) {
    // 1. Delete all existing records for this event
    const { error: deleteError } = await supabase
      .from('guests')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) {
      console.error('Error deleting guests from Supabase:', deleteError);
      throw deleteError;
    }

    if (formattedGuests.length === 0) return;

    // 2. Insert new records
    let rowsToInsert = formattedGuests.map(g => ({
      event_id: eventId,
      first_name: g.firstName,
      last_name: g.lastName,
      table_number: g.table,
      phone: g.phone || ''
    }));

    let { error: insertError } = await supabase
      .from('guests')
      .insert(rowsToInsert);

    if (insertError) {
      console.warn('[miFiestAPP DB] Bulk insert with phone column failed on Supabase, retrying without phone column:', insertError.message || insertError);
      rowsToInsert = formattedGuests.map(g => ({
        event_id: eventId,
        first_name: g.firstName,
        last_name: g.lastName,
        table_number: g.table
      }));
      const res = await supabase.from('guests').insert(rowsToInsert);
      if (res.error) {
        console.error('Error inserting guests into Supabase (fallback):', res.error);
      }
    }
  }

  // Always write to local storage as fallback/primary if environment allows
  try {
    const { guestsFile } = getEventFiles(eventId);
    fs.writeFileSync(guestsFile, JSON.stringify(formattedGuests, null, 2), 'utf8');
  } catch (err) {
    console.warn('[miFiestAPP DB] Local guests JSON file write ignored (Vercel read-only filesystem):', err.message);
  }
}

/**
 * Clear the database
 */
async function clearGuests(eventId = 'default') {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('guests')
      .delete()
      .eq('event_id', eventId);
    if (error) {
      console.error('Error clearing guests in Supabase:', error);
    }
  }
  try {
    const { guestsFile } = getEventFiles(eventId);
    if (fs.existsSync(guestsFile)) {
      fs.unlinkSync(guestsFile);
    }
  } catch (err) {
    console.warn('[miFiestAPP DB] Local guests file delete ignored (read-only filesystem):', err.message);
  }
}

/**
 * Add a single guest
 */
async function addGuest(eventId = 'default', guest) {
  const newGuest = {
    firstName: (guest.firstName || '').trim(),
    lastName: (guest.lastName || '').trim(),
    table: normalizeTable(guest.table),
    phone: (guest.phone || '').trim()
  };

  if (isSupabaseEnabled) {
    const payload = {
      event_id: eventId,
      first_name: newGuest.firstName,
      last_name: newGuest.lastName,
      table_number: newGuest.table,
      phone: newGuest.phone
    };
    const { error } = await supabase.from('guests').insert([payload]);
    if (error) {
      console.warn('[miFiestAPP DB] Insert single guest with phone failed on Supabase, retrying without phone column:', error.message || error);
      delete payload.phone;
      const { error: retryErr } = await supabase.from('guests').insert([payload]);
      if (retryErr) {
        console.error('Error inserting single guest into Supabase (fallback):', retryErr);
      }
    }
  }

  // Always update local guests JSON file if environment allows
  try {
    const guests = await getGuests(eventId);
    const existingIdx = guests.findIndex(g => g.firstName.toLowerCase() === newGuest.firstName.toLowerCase() && g.lastName.toLowerCase() === newGuest.lastName.toLowerCase());
    if (existingIdx >= 0) {
      guests[existingIdx] = newGuest;
    } else {
      guests.push(newGuest);
    }
    const { guestsFile } = getEventFiles(eventId);
    fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2), 'utf8');
  } catch (err) {
    console.warn('[miFiestAPP DB] Local guests JSON file update ignored (read-only filesystem):', err.message);
  }
}

/**
 * Edit a single guest at index position
 */
async function updateGuest(eventId = 'default', index, updatedGuest) {
  const guests = await getGuests(eventId);
  let targetIdx = -1;

  if (typeof index === 'number' && index >= 0 && index < guests.length) {
    targetIdx = index;
  } else {
    targetIdx = guests.findIndex(g => g.id === index || String(g.id) === String(index));
  }

  if (targetIdx < 0 || targetIdx >= guests.length) {
    throw new Error('Invitado no encontrado.');
  }

  const target = guests[targetIdx];
  const newFields = {
    firstName: (updatedGuest.firstName || '').trim(),
    lastName: (updatedGuest.lastName || '').trim(),
    table: normalizeTable(updatedGuest.table),
    phone: (updatedGuest.phone || '').trim()
  };

  if (isSupabaseEnabled && target.id) {
    const payload = {
      first_name: newFields.firstName,
      last_name: newFields.lastName,
      table_number: newFields.table,
      phone: newFields.phone
    };
    const { error } = await supabase
      .from('guests')
      .update(payload)
      .eq('id', target.id)
      .eq('event_id', eventId);

    if (error) {
      console.warn('[miFiestAPP DB] Update guest with phone failed on Supabase, retrying without phone column:', error.message || error);
      delete payload.phone;
      const { error: retryErr } = await supabase
        .from('guests')
        .update(payload)
        .eq('id', target.id)
        .eq('event_id', eventId);
      if (retryErr) {
        console.error('Error updating guest in Supabase (fallback):', retryErr);
      }
    }
  }

  try {
    guests[index] = newFields;
    const { guestsFile } = getEventFiles(eventId);
    fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2), 'utf8');
  } catch (err) {
    console.warn('[miFiestAPP DB] Local guests JSON file update ignored (read-only filesystem):', err.message);
  }
}

/**
 * Delete a single guest at index position
 */
async function deleteGuest(eventId = 'default', index) {
  const guests = await getGuests(eventId);
  if (index < 0 || index >= guests.length) {
    throw new Error('Invitado no encontrado.');
  }

  const target = guests[index];

  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('guests')
      .delete()
      .eq('id', target.id)
      .eq('event_id', eventId);
    if (error) {
      console.error('Error deleting guest in Supabase:', error);
      throw error;
    }
  }
  
  try {
    guests.splice(index, 1);
    const { guestsFile } = getEventFiles(eventId);
    fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2), 'utf8');
  } catch (err) {
    console.warn('[miFiestAPP DB] Local guests file delete ignored (read-only filesystem):', err.message);
  }
}

/**
 * Get config key value
 */
function saveLocalConfigValue(eventId, key, value) {
  try {
    const { configFile } = getEventFiles(eventId);
    let config = {};
    if (fs.existsSync(configFile)) {
      try {
        config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      } catch (e) {}
    }
    config[key] = value;
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error saving local config value for ${key}:`, e);
  }
}

async function getConfigValue(eventId = 'default', key, defaultValue = '') {
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('event_id', eventId)
        .eq('key', key)
        .order('updated_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        return data[0].value;
      }
    } catch (e) {
      console.warn(`[miFiestAPP DB] Supabase getConfigValue error for key ${key}:`, e.message);
    }
  }

  const { configFile } = getEventFiles(eventId);
  if (!fs.existsSync(configFile)) return defaultValue;
  try {
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    return config[key] !== undefined ? config[key] : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Get all config values for an event in a single batch query
 */
async function getConfigValues(eventId = 'default') {
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('key, value')
        .eq('event_id', eventId);
      if (!error && data) {
        const config = {};
        data.forEach(row => {
          config[row.key] = row.value;
        });
        return config;
      }
    } catch (e) {
      console.error('Error in getConfigValues batch query:', e);
    }
  }

  const { configFile } = getEventFiles(eventId);
  if (!fs.existsSync(configFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(configFile, 'utf8')) || {};
  } catch (e) {
    return {};
  }
}

/**
 * Set config key value
 */
async function setConfigValue(eventId = 'default', key, value) {
  if (isSupabaseEnabled) {
    try {
      const { data: existing } = await supabase
        .from('config')
        .select('id')
        .eq('event_id', eventId)
        .eq('key', key);

      let error;
      if (existing && existing.length > 0) {
        const res = await supabase
          .from('config')
          .update({
            value: value,
            updated_at: new Date().toISOString()
          })
          .eq('event_id', eventId)
          .eq('key', key);
        error = res.error;
      } else {
        const res = await supabase
          .from('config')
          .insert([{
            event_id: eventId,
            key: key,
            value: value,
            updated_at: new Date().toISOString()
          }]);
        error = res.error;
      }

      if (error) {
        console.warn(`[miFiestAPP DB] Supabase setConfigValue key ${key} notice (${error.message}). Saving to local JSON fallback.`);
        saveLocalConfigValue(eventId, key, value);
        return;
      }
    } catch (e) {
      console.warn(`[miFiestAPP DB] Supabase setConfigValue exception (${e.message}). Saving to local JSON fallback.`);
      saveLocalConfigValue(eventId, key, value);
      return;
    }
  }

  saveLocalConfigValue(eventId, key, value);
}

/**
 * Get dynamic event title
 */
async function getEventTitle(eventId = 'default') {
  return getConfigValue(eventId, 'event_title', 'Mi Gran Fiesta');
}

/**
 * Set dynamic event title
 */
async function setEventTitle(eventId = 'default', eventTitle) {
  return setConfigValue(eventId, 'event_title', (eventTitle || '').trim());
}

/**
 * Get photos
 */
async function getPhotos(eventId = 'default', onlyApproved = false) {
  if (isSupabaseEnabled) {
    let query = supabase
      .from('photos')
      .select('id, guest_name, message, photo_url, approved, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (onlyApproved) {
      query = query.eq('approved', true);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching photos from Supabase:', error);
      throw error;
    }

    return (data || []).map(p => ({
      id: p.id,
      guestName: p.guest_name,
      message: p.message,
      photoUrl: p.photo_url,
      approved: p.approved,
      createdAt: p.created_at
    }));
  } else {
    const { photosFile } = getEventFiles(eventId);
    if (!fs.existsSync(photosFile)) {
      return [];
    }
    try {
      const fileData = fs.readFileSync(photosFile, 'utf8');
      const photos = JSON.parse(fileData);
      if (onlyApproved) {
        return photos.filter(p => p.approved === true);
      }
      return photos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (err) {
      console.error('Error reading local photos file:', err);
      return [];
    }
  }
}

/**
 * Get a single photo by ID
 */
async function getPhoto(eventId = 'default', photoId) {
  if (isSupabaseEnabled) {
    const { data, error } = await supabase
      .from('photos')
      .select('id, guest_name, message, photo_url, approved, created_at')
      .eq('event_id', eventId)
      .eq('id', photoId)
      .maybeSingle();
    if (error) {
      console.error('Error fetching single photo from Supabase:', error);
      return null;
    }
    if (!data) return null;
    return {
      id: data.id,
      guestName: data.guest_name,
      message: data.message,
      photoUrl: data.photo_url,
      approved: data.approved,
      createdAt: data.created_at
    };
  } else {
    const { photosFile } = getEventFiles(eventId);
    if (!fs.existsSync(photosFile)) return null;
    try {
      const fileData = fs.readFileSync(photosFile, 'utf8');
      const photos = JSON.parse(fileData);
      return photos.find(p => String(p.id) === String(photoId)) || null;
    } catch (err) {
      console.error('Error reading local photos file for single photo:', err);
      return null;
    }
  }
}

/**
 * Add a photo submission
 */
async function addPhoto(eventId = 'default', { guestName, message, photoUrl }) {
  // Check if moderation is enabled (default: true). If disabled ('false'), auto-approve photos.
  const moderationEnabled = (await getConfigValue(eventId, 'photo_moderation_enabled', 'true')) !== 'false';
  const approvedInitial = !moderationEnabled;

  // Extract first name (omit surname/lastname) for informal projection mural
  let rawName = (guestName || 'Invitado').trim();
  const nameParts = rawName.split(/\s+/).filter(Boolean);
  let firstNameOnly = nameParts.length > 0 ? nameParts[0] : rawName;
  if (firstNameOnly.length > 0) {
    firstNameOnly = firstNameOnly.charAt(0).toUpperCase() + firstNameOnly.slice(1);
  }

  const photo = {
    guestName: firstNameOnly,
    message: (message || '').trim(),
    photoUrl: photoUrl,
    approved: approvedInitial,
    createdAt: new Date().toISOString()
  };

  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('photos')
      .insert([{
        event_id: eventId,
        guest_name: photo.guestName,
        message: photo.message,
        photo_url: photo.photoUrl,
        approved: approvedInitial
      }]);
    if (error) {
      console.error('Error adding photo to Supabase:', error);
      throw error;
    }
  } else {
    const { photosFile } = getEventFiles(eventId);
    if (!fs.existsSync(photosFile)) {
      fs.writeFileSync(photosFile, '[]', 'utf8');
    }
    const photos = JSON.parse(fs.readFileSync(photosFile, 'utf8'));
    photo.id = Date.now();
    photos.push(photo);
    fs.writeFileSync(photosFile, JSON.stringify(photos, null, 2), 'utf8');
  }
}

/**
 * Approve a photo by ID
 */
async function approvePhoto(eventId = 'default', photoId) {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('photos')
      .update({ approved: true })
      .eq('id', photoId)
      .eq('event_id', eventId);
    if (error) {
      console.error('Error approving photo in Supabase:', error);
      throw error;
    }
  } else {
    const { photosFile } = getEventFiles(eventId);
    if (!fs.existsSync(photosFile)) return;
    const photos = JSON.parse(fs.readFileSync(photosFile, 'utf8'));
    const idx = photos.findIndex(p => p.id === parseInt(photoId, 10));
    if (idx !== -1) {
      photos[idx].approved = true;
      fs.writeFileSync(photosFile, JSON.stringify(photos, null, 2), 'utf8');
    }
  }
}

/**
 * Delete / Reject a photo by ID
 */
async function deletePhoto(eventId = 'default', photoId) {
  if (isSupabaseEnabled) {
    // Fetch URL first to potentially delete from bucket
    const { data: photoData } = await supabase
      .from('photos')
      .select('photo_url')
      .eq('id', photoId)
      .eq('event_id', eventId)
      .single();

    if (photoData && photoData.photo_url) {
      try {
        const urlParts = photoData.photo_url.split('/');
        const fileName = urlParts[urlParts.length - 1];
        await supabase.storage.from('event-photos').remove([fileName]);
      } catch (storageErr) {
        console.warn('Error deleting photo from Supabase Storage:', storageErr.message);
      }
    }

    const { error } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId)
      .eq('event_id', eventId);
    if (error) {
      console.error('Error deleting photo in Supabase:', error);
      throw error;
    }
  } else {
    const { photosFile } = getEventFiles(eventId);
    if (!fs.existsSync(photosFile)) return;
    const photos = JSON.parse(fs.readFileSync(photosFile, 'utf8'));
    const idx = photos.findIndex(p => p.id === parseInt(photoId, 10));
    if (idx !== -1) {
      const photo = photos[idx];
      // Try to delete local image file
      try {
        const cleanId = (eventId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
        const fileName = path.basename(photo.photoUrl);
        const filePath = path.join(LOCAL_PHOTOS_DIR, cleanId, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn('Error deleting local photo file:', err.message);
      }
      photos.splice(idx, 1);
      fs.writeFileSync(photosFile, JSON.stringify(photos, null, 2), 'utf8');
    }
  }
}

/**
 * Delete all photos for an event
 */
async function clearPhotos(eventId = 'default') {
  if (isSupabaseEnabled) {
    // 1. Get all photos to delete their files from bucket
    const { data: photos } = await supabase
      .from('photos')
      .select('photo_url')
      .eq('event_id', eventId);

    if (photos && photos.length > 0) {
      const fileNames = photos
        .map(p => {
          if (!p.photo_url) return null;
          const urlParts = p.photo_url.split('/');
          return urlParts[urlParts.length - 1];
        })
        .filter(Boolean);

      if (fileNames.length > 0) {
        try {
          await supabase.storage.from('event-photos').remove(fileNames);
        } catch (storageErr) {
          console.warn('Error deleting photos from Supabase Storage:', storageErr.message);
        }
      }
    }

    // 2. Delete photos records from database
    const { error } = await supabase
      .from('photos')
      .delete()
      .eq('event_id', eventId);
    if (error) {
      console.error('Error clearing photos in Supabase:', error);
      throw error;
    }
  } else {
    // Local JSON implementation
    const { photosFile } = getEventFiles(eventId);
    if (!fs.existsSync(photosFile)) return;
    const photos = JSON.parse(fs.readFileSync(photosFile, 'utf8'));

    // Try to delete local image files
    const cleanId = (eventId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
    for (const photo of photos) {
      try {
        const fileName = path.basename(photo.photoUrl);
        const filePath = path.join(LOCAL_PHOTOS_DIR, cleanId, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        console.warn('Error deleting local photo file:', err.message);
      }
    }

    // Write empty array to photosFile
    fs.writeFileSync(photosFile, JSON.stringify([], null, 2), 'utf8');
  }
}

/**
 * Upload a photo file and return the public URL path
 */
async function uploadPhotoFile(eventId = 'default', fileName, fileBuffer, mimeType) {
  if (isSupabaseEnabled) {
    const cleanFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { data, error } = await supabase.storage
      .from('event-photos')
      .upload(cleanFileName, fileBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('Error uploading file to Supabase Storage:', error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from('event-photos')
      .getPublicUrl(cleanFileName);

    return publicUrlData.publicUrl;
  } else {
    // Local upload
    const cleanFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { photosDir } = getEventFiles(eventId);
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
    }
    const targetPath = path.join(photosDir, cleanFileName);
    fs.writeFileSync(targetPath, fileBuffer);
    const cleanId = (eventId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
    return `/uploads/photos/${cleanId}/${cleanFileName}`;
  }
}

async function uploadAudioFile(eventId = 'default', fileName, fileBuffer, mimeType) {
  if (isSupabaseEnabled) {
    const cleanFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { data, error } = await supabase.storage
      .from('event-photos')
      .upload(`audio/${cleanFileName}`, fileBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('Error uploading audio to Supabase Storage:', error);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage
      .from('event-photos')
      .getPublicUrl(`audio/${cleanFileName}`);

    return publicUrlData.publicUrl;
  } else {
    // Local upload
    const cleanFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const cleanId = (eventId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
    const audioDir = path.join(LOCAL_AUDIO_DIR, cleanId);
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    const targetPath = path.join(audioDir, cleanFileName);
    fs.writeFileSync(targetPath, fileBuffer);
    return `/uploads/audio/${cleanId}/${cleanFileName}`;
  }
}

async function uploadVideoFrameFile(fileName, fileBuffer, mimeType) {
  const cleanFileName = `frame-${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase.storage
        .from('event-photos')
        .upload(`frames/${cleanFileName}`, fileBuffer, {
          contentType: mimeType || 'video/mp4',
          upsert: true
        });

      if (!error) {
        const { data: publicUrlData } = supabase.storage
          .from('event-photos')
          .getPublicUrl(`frames/${cleanFileName}`);

        return publicUrlData.publicUrl;
      }
    } catch (e) {
      console.warn('[Supabase] Video frame upload fallback to local:', e);
    }
  }

  // Local fallback
  const framesDir = path.join(__dirname, '..', 'public', 'uploads', 'frames');
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }
  const targetPath = path.join(framesDir, cleanFileName);
  fs.writeFileSync(targetPath, fileBuffer);
  return `/uploads/frames/${cleanFileName}`;
}

async function isEventValid(eventId = 'default') {
  const cleanId = (eventId || 'default').trim().toLowerCase();
  if (cleanId === 'default') {
    return true;
  }
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('active')
        .eq('id', cleanId)
        .maybeSingle();

      if (error || !data) {
        return false;
      }
      return data.active;
    } catch (err) {
      console.error('Error validating event in Supabase:', err);
      return false;
    }
  } else {
    const events = getLocalEvents();
    const event = events.find(e => e.id === cleanId);
    return event ? event.active : false;
  }
}

async function getEvent(eventId) {
  const cleanId = (eventId || 'default').trim().toLowerCase();
  if (isSupabaseEnabled) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching event from Supabase:', error);
      throw error;
    }
    if (!data) return null;
    const eventName = await getEventTitle(cleanId);
    return {
      id: data.id,
      clientName: data.client_name,
      eventName: eventName,
      clientEmail: data.client_email || '',
      active: data.active,
      password: data.password || '',
      createdAt: data.created_at,
      serviceTables: data.service_tables !== false,
      servicePhotos: data.service_photos !== false,
      serviceInvitation: data.service_invitation !== false,
      serviceTrivia: data.service_trivia !== false,
      serviceMusic: data.service_music !== false
    };
  } else {
    const events = getLocalEvents();
    const e = events.find(event => event.id === cleanId);
    if (!e) return null;
    const eventName = await getEventTitle(cleanId);
    return {
      id: e.id,
      clientName: e.clientName,
      eventName: eventName,
      clientEmail: e.clientEmail || '',
      active: e.active,
      password: e.password || '',
      createdAt: e.createdAt,
      serviceTables: e.serviceTables !== false,
      servicePhotos: e.servicePhotos !== false,
      serviceInvitation: e.serviceInvitation !== false,
      serviceTrivia: e.serviceTrivia !== false,
      serviceMusic: e.serviceMusic !== false
    };
  }
}

async function getEvents() {
  if (isSupabaseEnabled) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching events from Supabase:', error);
      throw error;
    }
    
    // Fetch config values for title, drive url, and vendor metadata in one query
    let titlesMap = {};
    let driveUrlMap = {};
    let vendorIdMap = {};
    let approvalStatusMap = {};
    let isDemoMap = {};
    let demoExpiresAtMap = {};
    try {
      const { data: configData } = await supabase
        .from('config')
        .select('event_id, key, value')
        .in('key', ['event_title', 'google_drive_folder_url', 'vendor_id', 'approval_status', 'is_demo', 'demo_expires_at']);
      if (configData) {
        configData.forEach(row => {
          if (row.key === 'event_title') titlesMap[row.event_id] = row.value;
          if (row.key === 'google_drive_folder_url') driveUrlMap[row.event_id] = row.value;
          if (row.key === 'vendor_id') vendorIdMap[row.event_id] = row.value;
          if (row.key === 'approval_status') approvalStatusMap[row.event_id] = row.value;
          if (row.key === 'is_demo') isDemoMap[row.event_id] = row.value === 'true';
          if (row.key === 'demo_expires_at') demoExpiresAtMap[row.event_id] = row.value;
        });
      }
    } catch (err) {
      console.error('Error fetching event config:', err);
    }

    return (data || []).map(e => ({
      id: e.id,
      clientName: e.client_name,
      eventName: titlesMap[e.id] || '',
      googleDriveFolderUrl: driveUrlMap[e.id] || '',
      clientEmail: e.client_email || '',
      active: e.active,
      password: e.password || '',
      createdAt: e.created_at,
      serviceTables: e.service_tables !== false,
      servicePhotos: e.service_photos !== false,
      serviceInvitation: e.service_invitation !== false,
      serviceTrivia: e.service_trivia !== false,
      serviceMusic: e.service_music !== false,
      vendorId: e.vendor_id || e.vendorId || vendorIdMap[e.id] || null,
      approvalStatus: e.approval_status || e.approvalStatus || approvalStatusMap[e.id] || 'active',
      isDemo: !!(e.is_demo || e.isDemo || isDemoMap[e.id]),
      demoExpiresAt: e.demo_expires_at || e.demoExpiresAt || demoExpiresAtMap[e.id] || null
    }));
  } else {
    const events = getLocalEvents();
    return Promise.all(events.map(async e => {
      let eventName = '';
      let googleDriveFolderUrl = '';
      try {
        const { configFile } = getEventFiles(e.id);
        if (fs.existsSync(configFile)) {
          const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
          eventName = config['event_title'] || '';
          googleDriveFolderUrl = config['google_drive_folder_url'] || '';
        }
      } catch (err) {}
      return {
        id: e.id,
        clientName: e.clientName,
        eventName: eventName,
        googleDriveFolderUrl: googleDriveFolderUrl,
        clientEmail: e.clientEmail || '',
        active: e.active,
        password: e.password || '',
        createdAt: e.createdAt,
        serviceTables: e.serviceTables !== false,
        servicePhotos: e.servicePhotos !== false,
        serviceInvitation: e.serviceInvitation !== false,
        serviceTrivia: e.serviceTrivia !== false,
        serviceMusic: e.serviceMusic !== false,
        vendorId: e.vendorId || null,
        approvalStatus: e.approvalStatus || 'active',
        isDemo: !!e.isDemo,
        demoExpiresAt: e.demoExpiresAt || null
      };
    }));
  }
}

async function createEvent(id, clientName, password = '', clientEmail = '', serviceTables = true, servicePhotos = true, serviceInvitation = true, serviceTrivia = true, eventName = '', options = {}, serviceMusic = true) {
  const cleanId = (id || '').trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) throw new Error('ID de evento inválido.');

  const vendorId = options.vendorId || null;
  const approvalStatus = options.approvalStatus || 'active';
  const isDemo = !!options.isDemo;
  const demoExpiresAt = options.demoExpiresAt || null;

  // Clean up any stale local files/directories from past deleted events with same id
  try {
    const eventDir = path.join(DATA_DIR, cleanId);
    if (fs.existsSync(eventDir) && cleanId !== 'default') {
      fs.rmSync(eventDir, { recursive: true, force: true });
    }
  } catch (e) {}

  if (isSupabaseEnabled) {
    // Clean up any stale configs, rsvps, or guest records from past deleted events with the same id
    try { await supabase.from('config').delete().eq('event_id', cleanId); } catch(e) {}
    try { await supabase.from('rsvps').delete().eq('event_id', cleanId); } catch(e) {}
    try { await supabase.from('guests').delete().eq('event_id', cleanId); } catch(e) {}
    try { await supabase.from('event_music').delete().eq('event_id', cleanId); } catch(e) {}
    try { await supabase.from('table_configs').delete().eq('event_id', cleanId); } catch(e) {}

    const payload = { 
      id: cleanId, 
      client_name: clientName.trim(), 
      client_email: (clientEmail || '').trim().toLowerCase(), 
      active: approvalStatus === 'pending_approval' ? false : true, 
      password: password.trim(),
      service_tables: serviceTables,
      service_photos: servicePhotos,
      service_invitation: serviceInvitation,
      service_trivia: serviceTrivia,
      service_music: serviceMusic,
      vendor_id: vendorId,
      approval_status: approvalStatus,
      is_demo: isDemo,
      demo_expires_at: demoExpiresAt
    };
    const { error } = await supabase
      .from('events')
      .insert([payload]);

    if (error) {
      console.warn('Error creating event with vendor/music fields in Supabase, retrying standard insert:', error.message);
      delete payload.service_music;
      delete payload.vendor_id;
      delete payload.approval_status;
      delete payload.is_demo;
      delete payload.demo_expires_at;
      const { error: retryError } = await supabase.from('events').insert([payload]);
      if (retryError) throw retryError;
    }
  } else {
    const events = getLocalEvents();
    if (events.some(e => e.id === cleanId)) {
      throw new Error('El ID de evento ya existe.');
    }
    events.push({
      id: cleanId,
      clientName: clientName.trim(),
      clientEmail: (clientEmail || '').trim().toLowerCase(),
      active: approvalStatus === 'pending_approval' ? false : true,
      password: password.trim(),
      createdAt: new Date().toISOString(),
      serviceTables,
      servicePhotos,
      serviceInvitation,
      serviceTrivia,
      serviceMusic,
      vendorId,
      approvalStatus,
      isDemo,
      demoExpiresAt
    });
    saveLocalEvents(events);
    // Auto-create local directories for isolation
    getEventFiles(cleanId);
  }

  // Save metadata to config table for fallback lookup
  if (serviceMusic !== undefined) await setConfigValue(cleanId, 'service_music', serviceMusic ? 'true' : 'false');
  if (vendorId) await setConfigValue(cleanId, 'vendor_id', vendorId);
  if (approvalStatus) await setConfigValue(cleanId, 'approval_status', approvalStatus);
  if (isDemo) await setConfigValue(cleanId, 'is_demo', 'true');
  if (demoExpiresAt) await setConfigValue(cleanId, 'demo_expires_at', demoExpiresAt);

  // Decoupled event title configuration
  if (eventName) {
    await setConfigValue(cleanId, 'event_title', eventName.trim());
  }

  return cleanId;
}

async function toggleEvent(id, active) {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('events')
      .update({ active })
      .eq('id', id);

    if (error) {
      console.error('Error toggling event in Supabase:', error);
      throw error;
    }
  } else {
    const events = getLocalEvents();
    const event = events.find(e => e.id === id);
    if (!event) throw new Error('Evento no encontrado.');
    event.active = active;
    saveLocalEvents(events);
  }
}

async function updateEventServiceTrivia(id, serviceTrivia) {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('events')
      .update({ service_trivia: serviceTrivia })
      .eq('id', id);

    if (error) {
      console.error('Error updating service_trivia in Supabase:', error);
      throw error;
    }
  } else {
    const events = getLocalEvents();
    const event = events.find(e => e.id === id);
    if (!event) throw new Error('Evento no encontrado.');
    event.serviceTrivia = serviceTrivia;
    saveLocalEvents(events);
  }
}

async function updateEventServiceMusic(id, serviceMusic) {
  await setConfigValue(id, 'service_music', serviceMusic ? 'true' : 'false');
  if (isSupabaseEnabled) {
    try {
      await supabase
        .from('events')
        .update({ service_music: serviceMusic })
        .eq('id', id);
    } catch (e) {}
  } else {
    const events = getLocalEvents();
    const event = events.find(e => e.id === id);
    if (event) {
      event.serviceMusic = serviceMusic;
      saveLocalEvents(events);
    }
  }
}

async function deleteEvent(id) {
  const cleanId = (id || '').trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId || cleanId === 'default') return;

  // Clear all photos (records and storage files) first to prevent orphaned files in bucket
  try {
    await clearPhotos(cleanId);
  } catch (clearErr) {
    console.warn(`[db] Error clearing photos during deletion of event ${cleanId}:`, clearErr.message);
  }

  if (isSupabaseEnabled) {
    try {
      await supabase.from('config').delete().eq('event_id', cleanId);
    } catch (e) {
      console.warn(`[db] Error deleting config for event ${cleanId}:`, e.message);
    }

    try {
      await supabase.from('rsvps').delete().eq('event_id', cleanId);
    } catch (e) {
      console.warn(`[db] Error deleting rsvps for event ${cleanId}:`, e.message);
    }

    try {
      await supabase.from('guests').delete().eq('event_id', cleanId);
    } catch (e) {
      console.warn(`[db] Error deleting guests for event ${cleanId}:`, e.message);
    }

    try {
      await supabase.from('event_music').delete().eq('event_id', cleanId);
    } catch (e) {
      console.warn(`[db] Error deleting music for event ${cleanId}:`, e.message);
    }

    try {
      await supabase.from('table_configs').delete().eq('event_id', cleanId);
    } catch (e) {
      console.warn(`[db] Error deleting table_configs for event ${cleanId}:`, e.message);
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', cleanId);

    if (error) {
      console.error('Error deleting event from Supabase:', error);
      throw error;
    }
  }

  // ALWAYS clean up local json files and directories, even if Supabase is enabled
  const events = getLocalEvents();
  const updatedEvents = events.filter(e => e.id !== cleanId);
  saveLocalEvents(updatedEvents);

  try {
    const eventDir = path.join(DATA_DIR, cleanId);
    if (fs.existsSync(eventDir) && cleanId !== 'default') {
      fs.rmSync(eventDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('Could not clean up local event directories:', err.message);
  }
}

async function approveEvent(id) {
  await setConfigValue(id, 'approval_status', 'active');
  await toggleEvent(id, true);
  if (isSupabaseEnabled) {
    try {
      await supabase.from('events').update({ approval_status: 'active', active: true }).eq('id', id);
    } catch (e) {}
  }
}

async function rejectEvent(id) {
  await setConfigValue(id, 'approval_status', 'rejected');
  await toggleEvent(id, false);
  if (isSupabaseEnabled) {
    try {
      await supabase.from('events').update({ approval_status: 'rejected', active: false }).eq('id', id);
    } catch (e) {}
  }
}

/**
 * Vendor Management DB Functions
 */
function getLocalVendors() {
  const file = path.join(__dirname, '..', 'data', 'vendors.json');
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveLocalVendors(vendors) {
  const dir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'vendors.json');
  fs.writeFileSync(file, JSON.stringify(vendors, null, 2), 'utf8');
}

async function getVendors() {
  let dbVendors = [];
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        dbVendors = data.map(v => ({
          id: v.id,
          name: v.name,
          email: (v.email || '').trim().toLowerCase(),
          passwordHash: v.password_hash,
          phone: v.phone || '',
          active: v.active !== false,
          createdAt: v.created_at
        }));
      }
    } catch (err) {
      console.warn('[miFiestAPP DB] Supabase getVendors error, falling back to local:', err.message);
    }
  }

  const localVendors = getLocalVendors();
  const mergedMap = new Map();

  // Load local vendors first
  localVendors.forEach(v => {
    if (v.email) mergedMap.set(v.email.trim().toLowerCase(), v);
  });

  // Merge/override with Supabase vendors
  dbVendors.forEach(v => {
    if (v.email) mergedMap.set(v.email.trim().toLowerCase(), v);
  });

  return Array.from(mergedMap.values());
}

async function createVendor(name, email, passwordHash, phone = '') {
  const cleanEmail = (email || '').trim().toLowerCase();
  const id = 'vendor_' + Date.now();
  const vendor = {
    id,
    name: (name || '').trim(),
    email: cleanEmail,
    passwordHash: passwordHash || '',
    phone: (phone || '').trim(),
    active: true,
    createdAt: new Date().toISOString()
  };

  // Always save locally to prevent data loss across restarts or migrations
  const localVendors = getLocalVendors();
  const existingIdx = localVendors.findIndex(v => v.email === cleanEmail);
  if (existingIdx >= 0) {
    localVendors[existingIdx] = vendor;
  } else {
    localVendors.push(vendor);
  }
  saveLocalVendors(localVendors);

  if (isSupabaseEnabled) {
    try {
      const { error } = await supabase.from('vendors').upsert([{
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        password_hash: vendor.passwordHash,
        phone: vendor.phone,
        active: vendor.active
      }]);
      if (error) {
        console.warn('[miFiestAPP DB] Supabase createVendor upsert warning:', error.message);
      }
    } catch (err) {
      console.warn('[miFiestAPP DB] Supabase createVendor exception:', err.message);
    }
  }
  return vendor;
}

async function toggleVendor(id, active) {
  if (isSupabaseEnabled) {
    await supabase.from('vendors').update({ active }).eq('id', id);
  }
  const vendors = getLocalVendors();
  const v = vendors.find(item => item.id === id);
  if (v) {
    v.active = active;
    saveLocalVendors(vendors);
  }
}

async function deleteVendor(id) {
  if (isSupabaseEnabled) {
    await supabase.from('vendors').delete().eq('id', id);
  }
  const vendors = getLocalVendors();
  const updated = vendors.filter(item => item.id !== id);
  saveLocalVendors(updated);
}

async function assignVendorToEvent(eventId, vendorId) {
  const cleanVendorId = vendorId ? String(vendorId).trim() : null;
  await setConfigValue(eventId, 'vendor_id', cleanVendorId || '');

  if (isSupabaseEnabled) {
    try {
      await supabase
        .from('events')
        .update({ vendor_id: cleanVendorId })
        .eq('id', eventId);
    } catch (e) {
      console.warn('Error updating vendor_id in Supabase events:', e.message);
    }
  }

  const events = getLocalEvents();
  const ev = events.find(e => e.id === eventId);
  if (ev) {
    ev.vendorId = cleanVendorId;
    saveLocalEvents(events);
  }
  return true;
}

async function validateEventPassword(eventId, password) {
  const cleanId = (eventId || '').trim().toLowerCase();
  
  if (cleanId === 'default' || !cleanId) {
    const adminPass = process.env.ADMIN_PASSWORD || 'mifiestapp2026';
    return password === adminPass;
  }
  
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('password')
        .eq('id', cleanId)
        .single();
        
      if (error) {
        // Safe fallback if column doesn't exist yet
        if (error.message && error.message.includes('column "password" does not exist')) {
          console.warn('WARNING: column "password" does not exist in events. Using ADMIN_PASSWORD.');
          const adminPass = process.env.ADMIN_PASSWORD || 'mifiestapp2026';
          return password === adminPass;
        }
        console.error('Error fetching event password from Supabase:', error);
        return false;
      }
      if (!data) return false;
      return data.password === password;
    } catch (err) {
      console.error('Error validating event password in Supabase:', err);
      return false;
    }
  } else {
    const events = getLocalEvents();
    const event = events.find(e => e.id === cleanId);
    if (!event) return false;
    return event.password === password;
  }
}

async function findEventByEmailAndPassword(email, password) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPassword = (password || '').trim();
  if (!cleanEmail || !cleanPassword) return null;

  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, password, active')
        .ilike('client_email', cleanEmail);
        
      if (error) {
        console.error('Error fetching event by email from Supabase:', error);
        return null;
      }
      if (!data || data.length === 0) return null;
      
      const match = data.find(e => (e.password || '').trim() === cleanPassword);
      if (match) {
        return { id: match.id, active: match.active };
      }
      return null;
    } catch (err) {
      console.error('Error finding event by email in Supabase:', err);
      return null;
    }
  } else {
    const events = getLocalEvents();
    const match = events.find(e => (e.clientEmail || '').trim().toLowerCase() === cleanEmail && (e.password || '').trim() === cleanPassword);
    if (match) {
      return { id: match.id, active: match.active };
    }
    return null;
  }
}

/**
 * Get RSVPs for an event
 */
async function getRsvps(eventId = 'default') {
  if (isSupabaseEnabled) {
    let res = await supabase
      .from('rsvps')
      .select('id, name, phone, source, attending, companions_count, companions_names, dietary_restrictions, suggested_song, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (res.error && (res.error.code === '42703' || res.error.message.includes('column'))) {
      res = await supabase
        .from('rsvps')
        .select('id, name, attending, companions_count, companions_names, dietary_restrictions, suggested_song, created_at')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
    }

    if (res.error) {
      console.error('Error fetching RSVPs from Supabase:', res.error);
      throw res.error;
    }
    return (res.data || []).map(r => {
      let extractedPhone = r.phone || '';
      let cleanDiet = r.dietary_restrictions || '';
      if (!extractedPhone && cleanDiet.includes('[Tel:')) {
        const match = cleanDiet.match(/\[Tel:\s*([0-9\+\s]+)\]/);
        if (match) {
          extractedPhone = match[1].trim();
          cleanDiet = cleanDiet.replace(/\[Tel:\s*[0-9\+\s]+\]/, '').trim();
        }
      }
      return {
        id: r.id,
        name: r.name,
        phone: extractedPhone,
        source: r.source || 'individual',
        attending: r.attending,
        companionsCount: r.companions_count,
        companionsNames: r.companions_names,
        dietaryRestrictions: cleanDiet,
        suggestedSong: r.suggested_song,
        createdAt: r.created_at
      };
    });
  } else {
    const { configFile } = getEventFiles(eventId);
    const eventDir = path.dirname(configFile);
    const rsvpsFile = path.join(eventDir, 'rsvps.json');
    if (!fs.existsSync(rsvpsFile)) {
      return [];
    }
    try {
      const fileData = fs.readFileSync(rsvpsFile, 'utf8');
      const rsvps = JSON.parse(fileData);
      return (rsvps || []).map(r => ({
        id: r.id,
        name: r.name,
        phone: r.phone || '',
        source: r.source || 'individual',
        attending: r.attending,
        companionsCount: r.companions_count || r.companionsCount || 0,
        companionsNames: r.companions_names || r.companionsNames || '',
        dietaryRestrictions: r.dietary_restrictions || r.dietaryRestrictions || '',
        suggestedSong: r.suggested_song || r.suggestedSong || '',
        createdAt: r.created_at || r.createdAt
      })).sort((a, b) => new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at));
    } catch (err) {
      console.error('Error reading local RSVPs file:', err);
      return [];
    }
  }
}

/**
 * Add or Update an RSVP submission (Deduplicated by Phone or Name)
 */
async function addRsvp(eventId = 'default', rsvpData) {
  let companionsNamesStr = '';
  if (Array.isArray(rsvpData.companionsNames)) {
    companionsNamesStr = rsvpData.companionsNames.filter(name => name && name.trim()).map(name => name.trim()).join(', ');
  } else if (typeof rsvpData.companionsNames === 'string') {
    companionsNamesStr = rsvpData.companionsNames.trim();
  }

  const companionsDetails = Array.isArray(rsvpData.companionsDetails) ? rsvpData.companionsDetails : [];

  const cleanPhone = (rsvpData.phone || '').replace(/[^0-9]/g, '');
  const messageText = (rsvpData.message || rsvpData.dedication || '').trim();
  const rsvp = {
    name: (rsvpData.name || '').trim(),
    phone: cleanPhone,
    source: (rsvpData.source || 'individual').trim(),
    attending: !!rsvpData.attending,
    companionsCount: parseInt(rsvpData.companionsCount, 10) || 0,
    companionsNames: companionsNamesStr,
    companionsDetails: companionsDetails,
    dietaryRestrictions: (rsvpData.dietaryRestrictions || '').trim(),
    suggestedSong: (rsvpData.suggestedSong || '').trim(),
    message: messageText,
    createdAt: new Date().toISOString()
  };

  if (messageText) {
    try {
      await addEventMessage(eventId, {
        author: rsvp.name,
        message: messageText,
        phone: cleanPhone,
        source: 'rsvp'
      });
    } catch (msgErr) {
      console.warn('Notice saving dedication message from RSVP:', msgErr.message);
    }
  }

  const normName = rsvp.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  const rsvps = await getRsvps(eventId);

  // Match existing by phone or fallback to name if no phone set
  let existing = null;
  if (cleanPhone && cleanPhone.length >= 6) {
    existing = rsvps.find(r => (r.phone || '').replace(/[^0-9]/g, '') === cleanPhone);
  }
  if (!existing && normName) {
    existing = rsvps.find(r => {
      const existingNorm = (r.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
      const existingPhone = (r.phone || '').replace(/[^0-9]/g, '');
      return existingNorm === normName && (!existingPhone || existingPhone.length < 6);
    });
  }

  if (existing) {
    // Update existing record
    if (isSupabaseEnabled) {
      const payload = {
        name: rsvp.name,
        phone: rsvp.phone || existing.phone || '',
        attending: rsvp.attending,
        companions_count: rsvp.companionsCount,
        companions_names: rsvp.companionsNames,
        dietary_restrictions: rsvp.dietaryRestrictions || existing.dietary_restrictions || 'Ninguno',
        suggested_song: rsvp.suggestedSong || existing.suggested_song || ''
      };
      await supabase.from('rsvps').update(payload).eq('id', existing.id).eq('event_id', eventId);
    } else {
      const { configFile } = getEventFiles(eventId);
      const eventDir = path.dirname(configFile);
      const rsvpsFile = path.join(eventDir, 'rsvps.json');
      let currentRsvps = [];
      if (fs.existsSync(rsvpsFile)) {
        try {
          currentRsvps = JSON.parse(fs.readFileSync(rsvpsFile, 'utf8'));
        } catch (e) {}
      }
      const idx = currentRsvps.findIndex(r => String(r.id) === String(existing.id));
      if (idx !== -1) {
        currentRsvps[idx] = {
          ...currentRsvps[idx],
          name: rsvp.name,
          phone: rsvp.phone || currentRsvps[idx].phone || '',
          attending: rsvp.attending,
          companions_count: rsvp.companionsCount,
          companions_names: rsvp.companionsNames,
          dietary_restrictions: rsvp.dietaryRestrictions || currentRsvps[idx].dietary_restrictions || 'Ninguno',
          suggested_song: rsvp.suggestedSong || currentRsvps[idx].suggested_song || '',
          updated_at: rsvp.createdAt
        };
      }
      fs.writeFileSync(rsvpsFile, JSON.stringify(currentRsvps, null, 2), 'utf8');
    }
    return existing.id;
  }

  // Insert new record if no existing record found
  const newId = Date.now();
  if (isSupabaseEnabled) {
    const payload = {
      event_id: eventId,
      name: rsvp.name,
      phone: rsvp.phone,
      source: rsvp.source,
      attending: rsvp.attending,
      companions_count: rsvp.companionsCount,
      companions_names: rsvp.companionsNames,
      dietary_restrictions: rsvp.dietaryRestrictions,
      suggested_song: rsvp.suggestedSong
    };

    const { error } = await supabase.from('rsvps').insert([payload]);
    if (error) {
      delete payload.phone;
      delete payload.source;
      if (rsvp.phone && rsvp.phone.trim()) {
        payload.dietary_restrictions = `${payload.dietary_restrictions || ''} [Tel: ${rsvp.phone.trim()}]`.trim();
      }
      await supabase.from('rsvps').insert([payload]);
    }
  } else {
    const { configFile } = getEventFiles(eventId);
    const eventDir = path.dirname(configFile);
    const rsvpsFile = path.join(eventDir, 'rsvps.json');
    let currentRsvps = [];
    if (fs.existsSync(rsvpsFile)) {
      try {
        currentRsvps = JSON.parse(fs.readFileSync(rsvpsFile, 'utf8'));
      } catch (e) {}
    }
    currentRsvps.push({
      id: newId,
      name: rsvp.name,
      phone: rsvp.phone,
      source: rsvp.source,
      attending: rsvp.attending,
      companions_count: rsvp.companionsCount,
      companions_names: rsvp.companionsNames,
      dietary_restrictions: rsvp.dietaryRestrictions,
      suggested_song: rsvp.suggestedSong,
      created_at: rsvp.createdAt
    });
    fs.writeFileSync(rsvpsFile, JSON.stringify(currentRsvps, null, 2), 'utf8');
  }
  return newId;
}

/**
 * Add or Update a Public QR RSVP (Deduplicated strictly by Phone Number)
 */
async function addOrUpdatePublicRsvp(eventId = 'default', rsvpData) {
  const cleanPhone = (rsvpData.phone || '').replace(/[^0-9]/g, '');
  const rsvps = await getRsvps(eventId);

  // Check if an existing RSVP has this exact cleanPhone (only if cleanPhone has >= 6 digits)
  let existing = null;
  if (cleanPhone && cleanPhone.length >= 6) {
    existing = rsvps.find(r => (r.phone || '').replace(/[^0-9]/g, '') === cleanPhone);
  }

  // Fallback: If not found by phone, check if an existing RSVP has this exact name (case-insensitive) AND has no phone number set yet
  if (!existing && rsvpData.name) {
    const normName = rsvpData.name.trim().toLowerCase();
    existing = rsvps.find(r => (r.name || '').trim().toLowerCase() === normName && !(r.phone && r.phone.trim()));
  }

  let companionsNamesStr = '';
  if (Array.isArray(rsvpData.companionsNames)) {
    companionsNamesStr = rsvpData.companionsNames.filter(name => name && typeof name === 'string' && name.trim()).map(name => name.trim()).join(', ');
  } else if (typeof rsvpData.companionsNames === 'string') {
    companionsNamesStr = rsvpData.companionsNames.trim();
  }
  const companionsCountNum = parseInt(rsvpData.companionsCount, 10) || 0;

  if (existing) {
    // Update existing RSVP
    const updatedName = (rsvpData.name || existing.name).trim();
    const updatedAttending = !!rsvpData.attending;
    const updatedDiet = (rsvpData.dietaryRestrictions || '').trim();
    const updatedSong = (rsvpData.suggestedSong || existing.suggestedSong || '').trim();

    if (isSupabaseEnabled) {
      const payload = {
        name: updatedName,
        phone: cleanPhone,
        source: 'public_qr',
        attending: updatedAttending,
        companions_count: companionsCountNum,
        companions_names: companionsNamesStr,
        dietary_restrictions: updatedDiet,
        suggested_song: updatedSong
      };
      const { error } = await supabase
        .from('rsvps')
        .update(payload)
        .eq('id', existing.id)
        .eq('event_id', eventId);

      if (error) {
        delete payload.phone;
        delete payload.source;
        if (cleanPhone && cleanPhone.trim()) {
          payload.dietary_restrictions = `${payload.dietary_restrictions || ''} [Tel: ${cleanPhone.trim()}]`.trim();
        }
        await supabase.from('rsvps').update(payload).eq('id', existing.id).eq('event_id', eventId);
      }
    } else {
      const { configFile } = getEventFiles(eventId);
      const eventDir = path.dirname(configFile);
      const rsvpsFile = path.join(eventDir, 'rsvps.json');
      if (fs.existsSync(rsvpsFile)) {
        try {
          let list = JSON.parse(fs.readFileSync(rsvpsFile, 'utf8'));
          const idx = list.findIndex(r => r.id === existing.id);
          if (idx !== -1) {
            list[idx] = {
              ...list[idx],
              name: updatedName,
              phone: cleanPhone,
              source: 'public_qr',
              attending: updatedAttending,
              companions_count: companionsCountNum,
              companions_names: companionsNamesStr,
              dietary_restrictions: updatedDiet,
              suggested_song: updatedSong,
              updated_at: new Date().toISOString()
            };
            fs.writeFileSync(rsvpsFile, JSON.stringify(list, null, 2), 'utf8');
          }
        } catch (e) {
          console.error('Error updating local public RSVP:', e);
        }
      }
    }
    return { success: true, rsvpId: existing.id, isExisting: true };
  } else {
    // Insert new RSVP
    const newId = await addRsvp(eventId, {
      name: (rsvpData.name || '').trim(),
      phone: cleanPhone,
      source: 'public_qr',
      attending: !!rsvpData.attending,
      companionsCount: companionsCountNum,
      companionsNames: companionsNamesStr,
      dietaryRestrictions: (rsvpData.dietaryRestrictions || '').trim(),
      suggestedSong: (rsvpData.suggestedSong || '').trim()
    });
    return { success: true, rsvpId: newId, isExisting: false };
  }
}

/**
 * Delete an RSVP submission by ID
 */
async function deleteRsvp(eventId = 'default', rsvpId) {
  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('rsvps')
      .delete()
      .eq('id', rsvpId)
      .eq('event_id', eventId);

    if (error) {
      console.error('Error deleting RSVP in Supabase:', error);
      throw error;
    }
  } else {
    const { configFile } = getEventFiles(eventId);
    const eventDir = path.dirname(configFile);
    const rsvpsFile = path.join(eventDir, 'rsvps.json');
    if (!fs.existsSync(rsvpsFile)) return;
    try {
      let rsvps = JSON.parse(fs.readFileSync(rsvpsFile, 'utf8'));
      rsvps = rsvps.filter(r => r.id !== parseInt(rsvpId, 10));
      fs.writeFileSync(rsvpsFile, JSON.stringify(rsvps, null, 2), 'utf8');
    } catch (err) {
      console.error('Error deleting local RSVP:', err);
    }
  }
}

/**
 * Update an RSVP entry by ID
 */
async function updateRsvp(eventId = 'default', rsvpId, fields = {}) {
  const { name, attending, companionsCount, companionsNames, dietaryRestrictions, phone, suggestedSong } = fields;

  if (isSupabaseEnabled) {
    const payload = {};
    if (name !== undefined) payload.name = (name || '').trim();
    if (attending !== undefined) payload.attending = Boolean(attending);
    if (companionsCount !== undefined) payload.companions_count = parseInt(companionsCount, 10) || 0;
    if (companionsNames !== undefined) payload.companions_names = typeof companionsNames === 'string' ? companionsNames : JSON.stringify(companionsNames || []);
    if (dietaryRestrictions !== undefined) payload.dietary_restrictions = (dietaryRestrictions || '').trim();
    if (phone !== undefined) payload.phone = (phone || '').trim();
    if (suggestedSong !== undefined) payload.suggested_song = (suggestedSong || '').trim();

    const { error } = await supabase
      .from('rsvps')
      .update(payload)
      .eq('id', rsvpId)
      .eq('event_id', eventId);

    if (error) {
      console.error('Error updating RSVP in Supabase:', error);
      throw error;
    }
  } else {
    const { configFile } = getEventFiles(eventId);
    const eventDir = path.dirname(configFile);
    const rsvpsFile = path.join(eventDir, 'rsvps.json');
    if (!fs.existsSync(rsvpsFile)) return;
    try {
      let rsvps = JSON.parse(fs.readFileSync(rsvpsFile, 'utf8'));
      const numId = parseInt(rsvpId, 10);
      const index = rsvps.findIndex(r => r.id === numId || String(r.id) === String(rsvpId));
      if (index !== -1) {
        if (name !== undefined) rsvps[index].name = (name || '').trim();
        if (attending !== undefined) rsvps[index].attending = Boolean(attending);
        if (companionsCount !== undefined) rsvps[index].companionsCount = parseInt(companionsCount, 10) || 0;
        if (companionsNames !== undefined) rsvps[index].companionsNames = companionsNames;
        if (dietaryRestrictions !== undefined) rsvps[index].dietaryRestrictions = (dietaryRestrictions || '').trim();
        if (phone !== undefined) rsvps[index].phone = (phone || '').trim();
        if (suggestedSong !== undefined) rsvps[index].suggestedSong = (suggestedSong || '').trim();
        rsvps[index].updated_at = new Date().toISOString();
        
        fs.writeFileSync(rsvpsFile, JSON.stringify(rsvps, null, 2), 'utf8');
      }
    } catch (err) {
      console.error('Error updating local RSVP:', err);
      throw err;
    }
  }
}

/**
 * Save a song suggestion for a guest (either update existing RSVP or add a new one)
 */
async function saveSongSuggestion(eventId = 'default', name, song) {
  const normalizedName = (name || '').trim();
  const normalizedSong = (song || '').trim();

  if (isSupabaseEnabled) {
    // Check if there is an existing RSVP for this name
    const { data: existing, error: fetchError } = await supabase
      .from('rsvps')
      .select('id')
      .eq('event_id', eventId)
      .ilike('name', normalizedName)
      .order('id', { ascending: false })
      .limit(1);

    if (!fetchError && existing && existing.length > 0) {
      // Update existing RSVP
      const { error } = await supabase
        .from('rsvps')
        .update({ suggested_song: normalizedSong })
        .eq('id', existing[0].id);

      if (error) {
        console.error('Error updating RSVP suggested song in Supabase:', error);
        throw error;
      }
    } else {
      // Insert new RSVP
      const { error } = await supabase
        .from('rsvps')
        .insert([{
          event_id: eventId,
          name: normalizedName,
          attending: true,
          suggested_song: normalizedSong,
          companions_count: 0,
          companions_names: '',
          dietary_restrictions: 'Ninguno'
        }]);

      if (error) {
        console.error('Error inserting song RSVP into Supabase:', error);
        throw error;
      }
    }
  } else {
    const { configFile } = getEventFiles(eventId);
    const eventDir = path.dirname(configFile);
    const rsvpsFile = path.join(eventDir, 'rsvps.json');
    let rsvps = [];
    if (fs.existsSync(rsvpsFile)) {
      try {
        rsvps = JSON.parse(fs.readFileSync(rsvpsFile, 'utf8'));
      } catch (e) {}
    }

    const existingIndex = rsvps.findIndex(r => r.name.toLowerCase() === normalizedName.toLowerCase());
    if (existingIndex !== -1) {
      rsvps[existingIndex].suggested_song = normalizedSong;
    } else {
      rsvps.push({
        id: Date.now(),
        name: normalizedName,
        attending: true,
        companions_count: 0,
        companions_names: '',
        dietary_restrictions: 'Ninguno',
        suggested_song: normalizedSong,
        created_at: new Date().toISOString()
      });
    }
    fs.writeFileSync(rsvpsFile, JSON.stringify(rsvps, null, 2), 'utf8');
  }
}

/**
 * Capitanes de Mesa configuration and progress helpers
 */
async function getCapitanesConfig(eventId = 'default') {
  const gameMode = await getConfigValue(eventId, 'capitanes_game_mode', 'general');
  const timeLimitStr = await getConfigValue(eventId, 'capitanes_time_limit', '600');
  const questsStr = await getConfigValue(eventId, 'capitanes_quests', '[]');
  const captainsStr = await getConfigValue(eventId, 'capitanes_captains', '{}');
  
  let quests = [];
  try {
    quests = JSON.parse(questsStr);
  } catch (e) {
    console.error('[DB Capitanes Config Parse Error]', e);
  }

  let captains = {};
  try {
    captains = JSON.parse(captainsStr);
  } catch (e) {
    console.error('[DB Capitanes Config Captains Parse Error]', e);
  }
  
  return {
    gameMode: gameMode || 'general',
    timeLimit: parseInt(timeLimitStr, 10) || 600,
    quests: quests || [],
    captains: captains || {}
  };
}

async function saveCapitanesConfig(eventId = 'default', config) {
  const { gameMode, timeLimit, quests, captains } = config;
  await setConfigValue(eventId, 'capitanes_game_mode', gameMode || 'general');
  await setConfigValue(eventId, 'capitanes_time_limit', String(timeLimit || 600));
  await setConfigValue(eventId, 'capitanes_quests', JSON.stringify(quests || []));
  if (captains !== undefined) {
    await setConfigValue(eventId, 'capitanes_captains', JSON.stringify(captains || {}));
  }
}

async function getCapitanesProgress(eventId = 'default') {
  const progressStr = await getConfigValue(eventId, 'capitanes_progress', '{}');
  try {
    return JSON.parse(progressStr) || {};
  } catch (e) {
    console.error('[DB Capitanes Progress Parse Error]', e);
    return {};
  }
}

async function saveCapitanesProgress(eventId = 'default', progress) {
  await setConfigValue(eventId, 'capitanes_progress', JSON.stringify(progress || {}));
}

module.exports = {
  isSupabaseEnabled,
  getGuests,
  saveGuests,
  clearGuests,
  addGuest,
  updateGuest,
  deleteGuest,
  getConfigValue,
  getConfigValues,
  setConfigValue,
  getEventTitle,
  setEventTitle,
  getPhotos,
  getPhoto,
  addPhoto,
  approvePhoto,
  deletePhoto,
  clearPhotos,
  uploadPhotoFile,
  uploadAudioFile,
  isEventValid,
  getEvent,
  getEvents,
  createEvent,
  toggleEvent,
  updateEventServiceTrivia,
  deleteEvent,
  approveEvent,
  rejectEvent,
  getVendors,
  createVendor,
  toggleVendor,
  deleteVendor,
  validateEventPassword,
  findEventByEmailAndPassword,
  getRsvps,
  addRsvp,
  addOrUpdatePublicRsvp,
  deleteRsvp,
  updateRsvp,
  saveSongSuggestion,
  getCapitanesConfig,
  saveCapitanesConfig,
  getCapitanesProgress,
  saveCapitanesProgress,
  assignVendorToEvent
};

/**
 * Fine-Tuner Visual Settings per Template Model or Event
 */
const fineTunerDefaults = {
  paddingTop: 100,
  paddingBottom: 98,
  maxWidth: 275,
  s0TitleSize: 1.55,
  s0TitleOffsetY: 0,
  s0TitleOffsetX: 0,
  s0SubtitleSize: 0.76,
  s0SubtitleOffsetY: 0,
  s0PhraseSize: 1.25,
  s0PhraseOffsetY: 0,
  s0IntroSize: 0.76,
  s0IntroOffsetY: 0,
  s0CountdownSize: 50,
  s0CountdownOffsetY: 0,
  s0CountdownOffsetX: 0,
  s0BtnOffsetY: 0,
  s0BtnFontSize: 0.75,
  s0BtnScale: 1.0,
  s1TitleSize: 1.50,
  s1TitleOffsetY: 0,
  s1TitleOffsetX: 0,
  s1OrnamentSize: 1.00,
  s1OrnamentOffsetY: 0,
  s1OrnamentOffsetX: 0,
  s1CalendarScale: 1.00,
  s1CalendarOffsetY: 0,
  s1CalendarOffsetX: 0,
  s1CalBtnFontSize: 0.75,
  s1CalBtnScale: 1.00,
  s1CalBtnOffsetY: 0,
  s1CalBtnOffsetX: 0,
  s1BtnFontSize: 0.75,
  s1BtnScale: 1.00,
  s1BtnOffsetY: 0,
  s1BtnOffsetX: 0,
  s1ItemsOffsetY: 0,
  s1bTitleSize: 1.50,
  s1bTitleOffsetY: 0,
  s1bTitleOffsetX: 0,
  s1bCardScale: 1.00,
  s1bCardOffsetY: 0,
  s1bCardOffsetX: 0,
  s1bBtnFontSize: 0.75,
  s1bBtnScale: 1.00,
  s1bBtnOffsetY: 0,
  s1bBtnOffsetX: 0,
  s2TitleSize: 1.50,
  s2TitleOffsetY: 0,
  s2TitleOffsetX: 0,
  s2BadgeScale: 1.00,
  s2BadgeOffsetY: 0,
  s2BadgeOffsetX: 0,
  s2CardScale: 1.00,
  s2CardOffsetY: 0,
  s2CardOffsetX: 0,
  s2ChecklistScale: 1.00,
  s2ChecklistOffsetY: 0,
  s2ChecklistOffsetX: 0,
  s2BtnFontSize: 0.75,
  s2BtnScale: 1.00,
  s2BtnOffsetY: 0,
  s2BtnOffsetX: 0,
  s3TitleSize: 1.50,
  s3TitleOffsetY: 0,
  s3TitleOffsetX: 0,
  s3SubtitleSize: 0.75,
  s3SubtitleOffsetY: 0,
  s3SubtitleOffsetX: 0,
  s3CarouselScale: 1.00,
  s3CarouselOffsetY: 0,
  s3CarouselOffsetX: 0,
  s3ControlsScale: 1.00,
  s3ControlsOffsetY: 0,
  s3ControlsOffsetX: 0,
  s3BtnScale: 1.00,
  s3BtnOffsetY: 0,
  s3BtnOffsetX: 0,
  s4TitleSize: 1.10,
  s4TitleOffsetY: 0,
  s4TitleOffsetX: 0,
  s4SubtitleSize: 0.75,
  s4SubtitleOffsetY: 0,
  s4SubtitleOffsetX: 0,
  s4FormScale: 1.00,
  s4FormOffsetY: 0,
  s4FormOffsetX: 0,
  s4BtnScale: 1.00,
  s4BtnOffsetY: 0,
  s4BtnOffsetX: 0,
  s5TitleSize: 1.50,
  s5TitleOffsetY: 0,
  s5TitleOffsetX: 0,
  s5SubtitleSize: 0.76,
  s5SubtitleOffsetY: 0,
  s5SubtitleOffsetX: 0,
  s5CardScale: 1.00,
  s5CardOffsetY: 0,
  s5CardOffsetX: 0,
  s5BtnScale: 1.00,
  s5BtnOffsetY: 0,
  s5BtnOffsetX: 0,
  s5HintSize: 0.72,
  s5HintScale: 1.00,
  s5HintOffsetY: 0,
  s5HintOffsetX: 0,
  s5NextBtnScale: 1.00,
  s5NextBtnOffsetY: 0,
  s5NextBtnOffsetX: 0,
  s5bChestScale: 1.00,
  s5bChestOffsetY: 0,
  s5bChestOffsetX: 0,
  s6TitleSize: 1.50,
  s6TitleOffsetY: 0,
  s6TitleOffsetX: 0,
  s6SubtitleSize: 0.76,
  s6SubtitleOffsetY: 0,
  s6SubtitleOffsetX: 0,
  s6FormScale: 1.00,
  s6FormOffsetY: 0,
  s6FormOffsetX: 0,
  s6BtnScale: 1.00,
  s6BtnOffsetY: 0,
  s6BtnOffsetX: 0,
  s6NextBtnScale: 1.00,
  s6NextBtnOffsetY: 0,
  s6NextBtnOffsetX: 0,
  sfIconScale: 1.00,
  sfIconOffsetY: 0,
  sfIconOffsetX: 0,
  sfTitleSize: 1.55,
  sfTitleOffsetY: 0,
  sfTitleOffsetX: 0,
  sfSubtitleSize: 0.78,
  sfSubtitleOffsetY: 0,
  sfSubtitleOffsetX: 0,
  sfGalleryBtnScale: 1.00,
  sfGalleryBtnOffsetY: 0,
  sfGalleryBtnOffsetX: 0,
  sfCalendarBtnScale: 1.00,
  sfCalendarBtnOffsetY: 0,
  sfCalendarBtnOffsetX: 0,
  sfBtnScale: 1.00,
  sfBtnOffsetY: 0,
  sfBtnOffsetX: 0,
  // Marco Animado MP4
  frameVideoUrl: '',
  frameScale: 1.00,
  frameOffsetY: 0,
  frameOffsetX: 0,
  frameRotate: 0,
  frameOpacity: 0.88,
  frameBlendMode: 'screen',
  frameFit: 'fill',
  s0CountdownGap: 8,
  // Textos Personalizados Slide 0
  s0SubtitleText: '',
  s0PhraseText: '',
  s0IntroText: '',
  s0BtnText: '',
  // Texto Personalizado Despedida (Slide Farewell)
  sfSubtitleText: '',
  // Floating Scroll Badge ("Deslizá para seguir viendo")
  scrollMoreScale: 1.00,
  scrollMoreOffsetY: 0,
  scrollMoreOffsetX: 0
};

function normalizeFormatId(formatId) {
  if (!formatId) return 'interactivo-3d';
  let f = String(formatId).toLowerCase().trim();
  if (f === 'classic-slides' || f === 'slides-directo' || f === 'slides') return 'slides-directo';
  if (f === 'interactive-3d' || f === 'interactivo-3d' || f === '3d' || f === 'interactivo') return 'interactivo-3d';
  if (f === 'landing' || f === 'vertical-scroll' || f === 'scroll') return 'vertical-scroll';
  return f;
}

async function getTemplateFineTuning(modelId = 'card-model-imperial-gold', eventId = 'default', formatId = null) {
  let modelDefaults = { ...fineTunerDefaults };
  
  if (modelId === 'card-model-cyber-neon') {
    modelDefaults.frameVideoUrl = '/assets/invitaciones/Neon/Neon.mp4';
    modelDefaults.frameRotate = 90;
    modelDefaults.frameFit = 'fill';
    modelDefaults.frameBlendMode = 'screen';
    modelDefaults.frameOpacity = 0.88;
    modelDefaults.s0SubtitleText = '¡READY FOR THE PARTY!';
    modelDefaults.s0PhraseText = '“PREPARATE PARA LA MEJOR NOCHE DE TU VIDA. ¡ESTO ES UNA FIESTA! 🔥⚡”';
    modelDefaults.s0IntroText = 'COUNTDOWN PARA EL FIESTÓN:';
    modelDefaults.s0BtnText = 'VER DETALLES DE LA FIESTA ➔';
  } else if (modelId === 'card-model-boho-rust' || modelId === 'card-model-botanical') {
    modelDefaults.frameVideoUrl = '/assets/invitaciones/Botanical/borderbotanical_vertical.mp4';
    modelDefaults.frameRotate = 0;
    modelDefaults.frameFit = 'fill';
    modelDefaults.frameBlendMode = 'screen';
    modelDefaults.frameOpacity = 0.88;
    modelDefaults.s0SubtitleText = '¡NOS ENCANTARÍA QUE SEAS PARTE!';
    modelDefaults.s0PhraseText = '“Celebrar la vida es mejor cuando se comparte con quienes amamos”';
    modelDefaults.s0IntroText = 'Cuenta regresiva para nuestro gran día:';
    modelDefaults.s0BtnText = 'VER DETALLES DEL EVENTO ➔';
  } else if (modelId === 'card-model-editorial-luxe') {
    modelDefaults.frameVideoUrl = '/assets/invitaciones/Editorial/Editorial.mp4';
    modelDefaults.frameRotate = 0;
    modelDefaults.frameFit = 'fill';
    modelDefaults.frameBlendMode = 'screen';
    modelDefaults.frameOpacity = 0.88;
    modelDefaults.s0SubtitleText = 'AN EXCLUSIVE CELEBRATION';
    modelDefaults.s0PhraseText = '“Moments fade, memories stay forever.”';
    modelDefaults.s0IntroText = 'Counting down the days:';
    modelDefaults.s0BtnText = 'EXPLORE EVENT DETAILS ➔';
  } else if (modelId === 'card-model-imperial-gold') {
    modelDefaults.frameVideoUrl = '/assets/invitaciones/Imperial/ImperialBorder.mp4';
    modelDefaults.frameRotate = 90;
    modelDefaults.frameFit = 'fill';
    modelDefaults.frameBlendMode = 'screen';
    modelDefaults.frameOpacity = 0.88;
    modelDefaults.s0SubtitleText = '¡TE INVITAMOS A COMPARTIR ESTE MOMENTO!';
    modelDefaults.s0PhraseText = '“Hay momentos en la vida que son especiales, pero compartirlos con vos los hace inolvidables”';
    modelDefaults.s0IntroText = 'Faltan muy pocos días para compartir este momento especial:';
    modelDefaults.s0BtnText = 'VER DETALLES DEL EVENTO ➔';
  } else if (modelId === 'card-model-terracotta') {
    modelDefaults.frameVideoUrl = '/assets/invitaciones/Terracotta/Terracotta.mp4';
    modelDefaults.frameRotate = 0;
    modelDefaults.frameFit = 'fill';
    modelDefaults.frameBlendMode = 'screen';
    modelDefaults.frameOpacity = 0.88;
    modelDefaults.s0SubtitleText = '¡NUESTRA CELEBRACIÓN TERRACOTTA!';
    modelDefaults.s0PhraseText = '“Celebrar la vida y el amor con la Calidez y Elegancia de la Naturaleza”';
    modelDefaults.s0IntroText = 'Cuenta regresiva para nuestro día especial:';
    modelDefaults.s0BtnText = 'VER DETALLES DE LA INVITACIÓN ➔';
  } else if (modelId === 'card-model-glitz-glam') {
    modelDefaults.frameVideoUrl = '/assets/invitaciones/Glitz/Glitz.mp4';
    modelDefaults.frameRotate = 0;
    modelDefaults.frameFit = 'fill';
    modelDefaults.frameBlendMode = 'screen';
    modelDefaults.frameOpacity = 0.90;
    modelDefaults.s0SubtitleText = 'SHINE LIKE A DIAMOND';
    modelDefaults.s0PhraseText = '“Una noche llena de brillo, glamour y momentos inolvidables”';
    modelDefaults.s0IntroText = 'Countdown para brillar juntos:';
    modelDefaults.s0BtnText = 'DESPLEGAR INVITACIÓN VIP ➔';
  } else if (modelId === 'card-model-retro-disco') {
    modelDefaults.frameVideoUrl = '/assets/invitaciones/RetroDisco/Retrodisco.mp4';
    modelDefaults.frameRotate = 0;
    modelDefaults.frameFit = 'fill';
    modelDefaults.frameBlendMode = 'screen';
    modelDefaults.frameOpacity = 0.90;
    modelDefaults.s0SubtitleText = 'WELCOME TO THE FESTIVAL!';
    modelDefaults.s0PhraseText = '“Subí el volumen y preparate para la mejor fiesta del año”';
    modelDefaults.s0IntroText = 'COUNTDOWN PARA EL SHOW:';
    modelDefaults.s0BtnText = 'OBTENER PASE VIP ➔';
  }

  try {
    const normFormat = normalizeFormatId(formatId) || 'interactivo-3d';
    const formatKey = `fine_tuner_${modelId}_${normFormat}`;
    const defaultKey = `fine_tuner_${modelId}`;

    // 1. Check isolated format key first
    const storedFormat = await getConfigValue(eventId, formatKey);
    if (storedFormat) {
      const parsed = typeof storedFormat === 'string' ? JSON.parse(storedFormat) : storedFormat;
      let resConfig = { ...modelDefaults, ...parsed };
      if (modelId === 'card-model-editorial-luxe' && (!resConfig.frameVideoUrl || resConfig.frameVideoUrl.includes('Neon') || resConfig.frameRotate === 90)) {
        resConfig.frameVideoUrl = '/assets/invitaciones/Editorial/Editorial.mp4';
        resConfig.frameRotate = 0;
        resConfig.frameScale = 1.0;
        resConfig.frameFit = 'fill';
      }
      return resConfig;
    }

    // 2. Fallback to legacy root key (and auto-migrate to format-specific key for interactivo-3d)
    const stored = await getConfigValue(eventId, defaultKey);
    if (stored) {
      const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
      let resConfig = { ...modelDefaults, ...parsed };
      if (modelId === 'card-model-editorial-luxe' && (!resConfig.frameVideoUrl || resConfig.frameVideoUrl.includes('Neon') || resConfig.frameRotate === 90)) {
        resConfig.frameVideoUrl = '/assets/invitaciones/Editorial/Editorial.mp4';
        resConfig.frameRotate = 0;
        resConfig.frameScale = 1.0;
        resConfig.frameFit = 'fill';
      }
      if (normFormat === 'interactivo-3d') {
        try {
          await setConfigValue(eventId, formatKey, JSON.stringify(resConfig));
        } catch (e) {}
      }
      return resConfig;
    }
  } catch (err) {
    console.warn('[miFiestAPP DB] Error loading fine tuner config:', err.message);
  }
  return { ...modelDefaults };
}

async function saveTemplateFineTuning(modelId = 'card-model-imperial-gold', config = {}, eventId = 'default', formatId = null) {
  const normFormat = normalizeFormatId(formatId) || 'interactivo-3d';
  const key = `fine_tuner_${modelId}_${normFormat}`;
  
  const existingConfig = await getTemplateFineTuning(modelId, eventId, formatId);
  const payload = { ...fineTunerDefaults, ...existingConfig };
  const allKeys = new Set([...Object.keys(fineTunerDefaults), ...Object.keys(existingConfig), ...Object.keys(config || {})]);

  for (const k of allKeys) {
    if (k === 'updatedAt') continue;
    const rawVal = (config && config[k] !== undefined) ? config[k] : payload[k];
    if (rawVal !== undefined && rawVal !== null) {
      if (typeof rawVal === 'number') {
        payload[k] = rawVal;
      } else if (typeof rawVal === 'string') {
        const num = rawVal.includes('.') ? parseFloat(rawVal) : parseInt(rawVal, 10);
        payload[k] = !isNaN(num) ? num : rawVal;
      } else {
        payload[k] = rawVal;
      }
    }
  }

  payload.updatedAt = new Date().toISOString();
  await setConfigValue(eventId, key, JSON.stringify(payload));
  
  // For backward compatibility when interactivo-3d is saved, also mirror to legacy key
  if (normFormat === 'interactivo-3d') {
    await setConfigValue(eventId, `fine_tuner_${modelId}`, JSON.stringify(payload));
  }
  return payload;
}

/**
 * =========================================================================
 * MIFIESTAPP MOBILE APP HELPERS (Guest Profiles, Awards, Timeline & Info)
 * =========================================================================
 */

async function getGuestProfiles(eventId = 'default') {
  const cleanId = eventId || 'default';
  const profilesStr = await getConfigValue(cleanId, 'app_guest_profiles', '[]');
  try {
    return JSON.parse(profilesStr) || [];
  } catch (e) {
    return [];
  }
}

async function getGuestProfile(eventId = 'default', guestId) {
  const profiles = await getGuestProfiles(eventId);
  return profiles.find(p => p.id === guestId) || null;
}

async function saveGuestProfile(eventId = 'default', profileData) {
  const cleanId = eventId || 'default';
  const profiles = await getGuestProfiles(cleanId);
  const guestId = profileData.id || `guest_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  const existingIdx = profiles.findIndex(p => p.id === guestId || (profileData.name && p.name && p.name.trim().toLowerCase() === profileData.name.trim().toLowerCase()));

  const updatedProfile = {
    id: existingIdx >= 0 ? profiles[existingIdx].id : guestId,
    name: profileData.name || 'Invitado',
    tableNumber: normalizeTable(profileData.tableNumber || 'Sin Mesa'),
    avatarUrl: profileData.avatarUrl || '/assets/coronamain.png',
    dietary: profileData.dietary || '',
    phone: profileData.phone || '',
    deviceToken: profileData.deviceToken || '',
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    profiles[existingIdx] = { ...profiles[existingIdx], ...updatedProfile };
  } else {
    updatedProfile.createdAt = new Date().toISOString();
    profiles.push(updatedProfile);
  }

  await setConfigValue(cleanId, 'app_guest_profiles', JSON.stringify(profiles));
  return updatedProfile;
}

async function getAwardsFromDb(eventId = 'default') {
  const cleanId = eventId || 'default';
  const awardsStr = await getConfigValue(cleanId, 'app_event_awards', '[]');
  try {
    return JSON.parse(awardsStr) || [];
  } catch (e) {
    return [];
  }
}

async function saveAwardsToDb(eventId = 'default', awards) {
  const cleanId = eventId || 'default';
  await setConfigValue(cleanId, 'app_event_awards', JSON.stringify(awards || []));
  return awards;
}

const DEFAULT_TIMELINE = [
  { id: 'time_1', time: '21:30', title: 'Recepción & Alfombra Roja', description: 'Cocktail de bienvenida, fotos y encuentro en el salón.', icon: '🍸', isCurrent: false },
  { id: 'time_2', time: '22:30', title: 'Entrada Triunfal', description: 'Momento estelar de apertura y bienvenida.', icon: '✨', isCurrent: false },
  { id: 'time_3', time: '23:00', title: 'Cena & Show Gastronómico', description: 'Plato principal y brindis inicial.', icon: '🍽️', isCurrent: true },
  { id: 'time_4', time: '00:30', title: 'Primera Tanda de Baile', description: 'Apertura de la pista con DJ en vivo y cachengue.', icon: '💃', isCurrent: false },
  { id: 'time_5', time: '02:00', title: 'Entrega de miFiestAPP Awards', description: 'Revelación de ganadores y votación de ternas.', icon: '🏆', isCurrent: false },
  { id: 'time_6', time: '03:30', title: 'Torta, Brindis & Carioca', description: 'Momento emotivo del brindis y fiesta flúor.', icon: '🎂', isCurrent: false },
  { id: 'time_7', time: '05:30', title: 'Fin de Fiesta & Desayuno', description: 'Cierre de una noche mágica e inolvidable.', icon: '🌅', isCurrent: false }
];

async function getEventTimeline(eventId = 'default') {
  const cleanId = eventId || 'default';
  const timelineStr = await getConfigValue(cleanId, 'app_event_timeline', '');
  if (!timelineStr) {
    return DEFAULT_TIMELINE;
  }
  try {
    const parsed = JSON.parse(timelineStr);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TIMELINE;
  } catch (e) {
    return DEFAULT_TIMELINE;
  }
}

async function saveEventTimeline(eventId = 'default', timeline) {
  const cleanId = eventId || 'default';
  await setConfigValue(cleanId, 'app_event_timeline', JSON.stringify(timeline || []));
  return timeline;
}

async function getEventInfoForApp(eventId = 'default') {
  const cleanId = eventId || 'default';
  const event = await getEvent(cleanId);
  const title = await getEventTitle(cleanId);
  const dateStr = (event && (event.date || event.fecha))
    ? (event.date || event.fecha)
    : await getConfigValue(cleanId, 'event_date', '');
  const timeStr = (event && (event.time || event.hora))
    ? (event.time || event.hora)
    : await getConfigValue(cleanId, 'event_time', '');
  const locationName = await getConfigValue(cleanId, 'event_location_name', (event && event.location) ? event.location : 'Salón Principal');
  const locationAddress = await getConfigValue(cleanId, 'event_location_address', (event && event.address) ? event.address : 'Av. del Libertador 1234');
  const locationMapUrl = await getConfigValue(cleanId, 'event_location_map_url', '');
  const dressCode = await getConfigValue(cleanId, 'event_dresscode', 'Elegante / Gala');
  const dressCodeDetails = await getConfigValue(cleanId, 'event_dresscode_details', 'Venir listos para disfrutar y bailar toda la noche.');
  const giftsBankAlias = await getConfigValue(cleanId, 'event_bank_alias', 'MIFIESTAPP.EVENTO.MP');
  const giftsBankCbu = await getConfigValue(cleanId, 'event_bank_cbu', '0000003100012345678901');
  const giftsBankHolder = await getConfigValue(cleanId, 'event_bank_holder', title || 'Los Homenajeados');
  const giftsBankBank = await getConfigValue(cleanId, 'event_bank_name', 'Mercado Pago');
  const transportNotes = await getConfigValue(cleanId, 'event_transport_notes', 'Recomendamos utilizar Uber o Cabify seleccionando la dirección del salón.');
  const remisesPhone = await getConfigValue(cleanId, 'event_remises_phone', '+54 9 11 4000-0000');
  const eventTheme = await getConfigValue(cleanId, 'event_theme', 'golden-luxury');
  
  const timeline = await getEventTimeline(cleanId);
  const guests = await getGuests(cleanId);

  return {
    eventId: cleanId,
    clientName: event ? event.clientName : title,
    eventTitle: title,
    date: dateStr,
    time: timeStr,
    location: {
      name: locationName,
      address: locationAddress,
      mapUrl: locationMapUrl
    },
    dressCode: {
      title: dressCode,
      details: dressCodeDetails
    },
    gifts: {
      alias: giftsBankAlias,
      cbu: giftsBankCbu,
      holder: giftsBankHolder,
      bank: giftsBankBank
    },
    transport: {
      notes: transportNotes,
      remisesPhone: remisesPhone
    },
    theme: eventTheme,
    timeline,
    tablesCount: new Set(guests.map(g => g.table).filter(t => t && t !== 'Sin Mesa')).size,
    guestsCount: guests.length
  };
}

/**
 * Guest Messages & Dedications for Wall & Video
 */
async function getEventMessages(eventId = 'default', includeHidden = false) {
  const cleanId = String(eventId || 'default').trim();
  const raw = await getConfigValue(cleanId, 'app_event_messages', '[]');
  let messages = [];
  try {
    messages = typeof raw === 'string' ? JSON.parse(raw) : (Array.isArray(raw) ? raw : []);
  } catch (e) {
    messages = [];
  }
  if (!Array.isArray(messages)) messages = [];
  if (!includeHidden) {
    return messages.filter(m => m && m.approved !== false);
  }
  return messages;
}

async function addEventMessage(eventId = 'default', messageData = {}) {
  const cleanId = String(eventId || 'default').trim();
  const author = (messageData.author || messageData.name || 'Invitado').trim();
  const message = (messageData.message || messageData.text || '').trim();
  if (!message) return null;

  const messages = await getEventMessages(cleanId, true);
  const newMsg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    author: author || 'Invitado Especial',
    message: message,
    approved: messageData.approved !== undefined ? !!messageData.approved : true,
    featured: !!messageData.featured,
    source: messageData.source || 'rsvp',
    phone: messageData.phone || '',
    createdAt: new Date().toISOString()
  };

  messages.unshift(newMsg);
  await setConfigValue(cleanId, 'app_event_messages', JSON.stringify(messages));
  return newMsg;
}

async function moderateEventMessage(eventId = 'default', messageId, updates = {}) {
  const cleanId = String(eventId || 'default').trim();
  const messages = await getEventMessages(cleanId, true);
  const idx = messages.findIndex(m => String(m.id) === String(messageId));
  if (idx === -1) return null;

  messages[idx] = {
    ...messages[idx],
    approved: updates.approved !== undefined ? !!updates.approved : messages[idx].approved,
    featured: updates.featured !== undefined ? !!updates.featured : messages[idx].featured,
    updatedAt: new Date().toISOString()
  };

  await setConfigValue(cleanId, 'app_event_messages', JSON.stringify(messages));
  return messages[idx];
}

async function deleteEventMessage(eventId = 'default', messageId) {
  const cleanId = String(eventId || 'default').trim();
  let messages = await getEventMessages(cleanId, true);
  messages = messages.filter(m => String(m.id) !== String(messageId));
  await setConfigValue(cleanId, 'app_event_messages', JSON.stringify(messages));
  return true;
}

module.exports = {
  isSupabaseEnabled,
  getGuests,
  saveGuests,
  clearGuests,
  addGuest,
  updateGuest,
  deleteGuest,
  getConfigValue,
  getConfigValues,
  setConfigValue,
  getEventTitle,
  setEventTitle,
  getPhotos,
  getPhoto,
  addPhoto,
  approvePhoto,
  deletePhoto,
  clearPhotos,
  uploadPhotoFile,
  uploadAudioFile,
  uploadVideoFrameFile,
  isEventValid,
  getEvent,
  getEvents,
  createEvent,
  toggleEvent,
  updateEventServiceTrivia,
  updateEventServiceMusic,
  deleteEvent,
  approveEvent,
  rejectEvent,
  getVendors,
  createVendor,
  toggleVendor,
  deleteVendor,
  validateEventPassword,
  findEventByEmailAndPassword,
  getRsvps,
  addRsvp,
  addOrUpdatePublicRsvp,
  deleteRsvp,
  updateRsvp,
  saveSongSuggestion,
  getCapitanesConfig,
  saveCapitanesConfig,
  getCapitanesProgress,
  saveCapitanesProgress,
  assignVendorToEvent,
  getTemplateFineTuning,
  saveTemplateFineTuning,
  getGuestProfiles,
  getGuestProfile,
  saveGuestProfile,
  getAwardsFromDb,
  saveAwardsToDb,
  getEventTimeline,
  saveEventTimeline,
  getEventInfoForApp,
  getEventMessages,
  addEventMessage,
  moderateEventMessage,
  deleteEventMessage
};

