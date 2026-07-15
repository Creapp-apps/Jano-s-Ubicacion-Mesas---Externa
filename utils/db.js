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
  console.log('[MiFiestAPP DB] Supabase database connection enabled.');
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.log('[MiFiestAPP DB] Local JSON file storage enabled (Supabase credentials missing).');
}

// Local File Paths
const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.warn('[MiFiestAPP DB] Local DATA_DIR creation ignored/failed (read-only filesystem):', err.message);
  }
}
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

function getLocalEvents() {
  if (!fs.existsSync(EVENTS_FILE)) {
    const defaultEvents = [{ id: 'default', clientName: 'Default Event', active: true, createdAt: new Date().toISOString() }];
    try {
      fs.writeFileSync(EVENTS_FILE, JSON.stringify(defaultEvents, null, 2), 'utf8');
    } catch (err) {
      console.warn('[MiFiestAPP DB] Local events.json write failed:', err.message);
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
    console.error('[MiFiestAPP DB] Local saveLocalEvents write failed:', err.message);
  }
}

const LOCAL_PHOTOS_DIR = path.join(__dirname, '..', 'public', 'uploads', 'photos');
if (!isSupabaseEnabled && !fs.existsSync(LOCAL_PHOTOS_DIR)) {
  try {
    fs.mkdirSync(LOCAL_PHOTOS_DIR, { recursive: true });
  } catch (err) {
    console.warn('[MiFiestAPP DB] Local LOCAL_PHOTOS_DIR creation ignored/failed:', err.message);
  }
}

const LOCAL_AUDIO_DIR = path.join(__dirname, '..', 'public', 'uploads', 'audio');
if (!isSupabaseEnabled && !fs.existsSync(LOCAL_AUDIO_DIR)) {
  try {
    fs.mkdirSync(LOCAL_AUDIO_DIR, { recursive: true });
  } catch (err) {
    console.warn('[MiFiestAPP DB] Local LOCAL_AUDIO_DIR creation ignored/failed:', err.message);
  }
}

// Migration logic for old/legacy flat files structure (copying to data/default/)
const defaultDir = path.join(DATA_DIR, 'default');
if (!fs.existsSync(defaultDir)) {
  try {
    fs.mkdirSync(defaultDir, { recursive: true });
  } catch (err) {
    console.warn('[MiFiestAPP DB] Local defaultDir creation failed:', err.message);
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
  console.warn('[MiFiestAPP DB] Legacy migration files copy ignored/failed:', err.message);
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
      console.warn('[MiFiestAPP DB] Local eventDir creation ignored/failed:', err.message);
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
          console.log("[MiFiestAPP DB] Supabase 'event-photos' storage bucket created successfully.");
        }
      }
    } catch (e) {
      console.warn("[MiFiestAPP DB] Storage bucket initial setup warning (might lack policy creation rights):", e.message);
    }
  })();
}

/**
 * Get all guests as an array of { firstName, lastName, table, id? }
/**
 * Normalizes table number/name to prevent duplicate prefixes like "Mesa"
 */
function normalizeTable(table) {
  if (!table) return 'Sin Mesa';
  let t = String(table).trim();
  if (!t || t.toLowerCase() === 'sin mesa') return 'Sin Mesa';
  
  // Strip "Mesa " or "Mesa" (case-insensitive) from the start
  t = t.replace(/^(mesa\s*)/i, '');
  return t || 'Sin Mesa';
}

/**
 * Get all guests for an event
 */
async function getGuests(eventId = 'default') {
  if (isSupabaseEnabled) {
    const { data, error } = await supabase
      .from('guests')
      .select('id, first_name, last_name, table_number')
      .eq('event_id', eventId)
      .order('id', { ascending: true });
      
    if (error) {
      console.error('Error fetching guests from Supabase:', error);
      throw error;
    }
    
    return (data || []).map(g => ({
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      table: normalizeTable(g.table_number)
    }));
  } else {
    const { guestsFile } = getEventFiles(eventId);
    if (!fs.existsSync(guestsFile)) {
      return [];
    }
    try {
      const fileData = fs.readFileSync(guestsFile, 'utf8');
      const parsed = JSON.parse(fileData);
      return (parsed || []).map(g => ({
        ...g,
        table: normalizeTable(g.table)
      }));
    } catch (err) {
      console.error('Error reading local guests file:', err);
      return [];
    }
  }
}

/**
 * Save / Overwrite the entire guests list
 */
async function saveGuests(eventId = 'default', guestsList) {
  const formattedGuests = guestsList.map(g => ({
    firstName: (g.firstName || '').trim(),
    lastName: (g.lastName || '').trim(),
    table: normalizeTable(g.table)
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
    const rowsToInsert = formattedGuests.map(g => ({
      event_id: eventId,
      first_name: g.firstName,
      last_name: g.lastName,
      table_number: g.table
    }));

    const { error: insertError } = await supabase
      .from('guests')
      .insert(rowsToInsert);

    if (insertError) {
      console.error('Error inserting guests into Supabase:', insertError);
      throw insertError;
    }
  } else {
    const { guestsFile } = getEventFiles(eventId);
    fs.writeFileSync(guestsFile, JSON.stringify(formattedGuests, null, 2), 'utf8');
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
      throw error;
    }
  } else {
    const { guestsFile } = getEventFiles(eventId);
    if (fs.existsSync(guestsFile)) {
      fs.unlinkSync(guestsFile);
    }
  }
}

/**
 * Add a single guest
 */
async function addGuest(eventId = 'default', guest) {
  const newGuest = {
    firstName: (guest.firstName || '').trim(),
    lastName: (guest.lastName || '').trim(),
    table: normalizeTable(guest.table)
  };

  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('guests')
      .insert([{
        event_id: eventId,
        first_name: newGuest.firstName,
        last_name: newGuest.lastName,
        table_number: newGuest.table
      }]);
    if (error) {
      console.error('Error inserting single guest into Supabase:', error);
      throw error;
    }
  } else {
    const guests = await getGuests(eventId);
    guests.push(newGuest);
    const { guestsFile } = getEventFiles(eventId);
    fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2), 'utf8');
  }
}

/**
 * Edit a single guest at index position
 */
async function updateGuest(eventId = 'default', index, updatedGuest) {
  const guests = await getGuests(eventId);
  if (index < 0 || index >= guests.length) {
    throw new Error('Invitado no encontrado.');
  }

  const target = guests[index];
  const newFields = {
    firstName: (updatedGuest.firstName || '').trim(),
    lastName: (updatedGuest.lastName || '').trim(),
    table: normalizeTable(updatedGuest.table)
  };

  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('guests')
      .update({
        first_name: newFields.firstName,
        last_name: newFields.lastName,
        table_number: newFields.table
      })
      .eq('id', target.id)
      .eq('event_id', eventId);
    if (error) {
      console.error('Error updating guest in Supabase:', error);
      throw error;
    }
  } else {
    guests[index] = newFields;
    const { guestsFile } = getEventFiles(eventId);
    fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2), 'utf8');
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
  } else {
    guests.splice(index, 1);
    const { guestsFile } = getEventFiles(eventId);
    fs.writeFileSync(guestsFile, JSON.stringify(guests, null, 2), 'utf8');
  }
}

/**
 * Get config key value
 */
async function getConfigValue(eventId = 'default', key, defaultValue = '') {
  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('value')
        .eq('event_id', eventId)
        .eq('key', key)
        .single();
      if (error || !data) return defaultValue;
      return data.value;
    } catch (e) {
      return defaultValue;
    }
  } else {
    const { configFile } = getEventFiles(eventId);
    if (!fs.existsSync(configFile)) return defaultValue;
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      return config[key] !== undefined ? config[key] : defaultValue;
    } catch (e) {
      return defaultValue;
    }
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
      if (error || !data) return {};
      const config = {};
      data.forEach(row => {
        config[row.key] = row.value;
      });
      return config;
    } catch (e) {
      console.error('Error in getConfigValues batch query:', e);
      return {};
    }
  } else {
    const { configFile } = getEventFiles(eventId);
    if (!fs.existsSync(configFile)) return {};
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf8')) || {};
    } catch (e) {
      return {};
    }
  }
}

/**
 * Set config key value
 */
async function setConfigValue(eventId = 'default', key, value) {
  if (isSupabaseEnabled) {
    const { data: existing } = await supabase
      .from('config')
      .select('id')
      .eq('event_id', eventId)
      .eq('key', key)
      .maybeSingle();

    let error;
    if (existing) {
      const res = await supabase
        .from('config')
        .update({
          value: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
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
      console.error(`Error updating config key ${key} in Supabase:`, error);
      throw error;
    }
  } else {
    const { configFile } = getEventFiles(eventId);
    let config = {};
    if (fs.existsSync(configFile)) {
      try {
        config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      } catch (e) {}
    }
    config[key] = value;
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
  }
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
  const photo = {
    guestName: (guestName || 'Invitado').trim(),
    message: (message || '').trim(),
    photoUrl: photoUrl,
    approved: false,
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
        approved: false
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
    return {
      id: data.id,
      clientName: data.client_name,
      clientEmail: data.client_email || '',
      active: data.active,
      password: data.password || '',
      createdAt: data.created_at,
      serviceTables: data.service_tables !== false,
      servicePhotos: data.service_photos !== false,
      serviceInvitation: data.service_invitation !== false,
      serviceTrivia: data.service_trivia !== false
    };
  } else {
    const events = getLocalEvents();
    const e = events.find(event => event.id === cleanId);
    if (!e) return null;
    return {
      id: e.id,
      clientName: e.clientName,
      clientEmail: e.clientEmail || '',
      active: e.active,
      password: e.password || '',
      createdAt: e.createdAt,
      serviceTables: e.serviceTables !== false,
      servicePhotos: e.servicePhotos !== false,
      serviceInvitation: e.serviceInvitation !== false,
      serviceTrivia: e.serviceTrivia !== false
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
    return (data || []).map(e => ({
      id: e.id,
      clientName: e.client_name,
      clientEmail: e.client_email || '',
      active: e.active,
      password: e.password || '',
      createdAt: e.created_at,
      serviceTables: e.service_tables !== false,
      servicePhotos: e.service_photos !== false,
      serviceInvitation: e.service_invitation !== false,
      serviceTrivia: e.service_trivia !== false
    }));
  } else {
    const events = getLocalEvents();
    return events.map(e => ({
      id: e.id,
      clientName: e.clientName,
      clientEmail: e.clientEmail || '',
      active: e.active,
      password: e.password || '',
      createdAt: e.createdAt,
      serviceTables: e.serviceTables !== false,
      servicePhotos: e.servicePhotos !== false,
      serviceInvitation: e.serviceInvitation !== false,
      serviceTrivia: e.serviceTrivia !== false
    }));
  }
}

async function createEvent(id, clientName, password = '', clientEmail = '', serviceTables = true, servicePhotos = true, serviceInvitation = true, serviceTrivia = true) {
  const cleanId = (id || '').trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleanId) throw new Error('ID de evento inválido.');

  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('events')
      .insert([{ 
        id: cleanId, 
        client_name: clientName.trim(), 
        client_email: clientEmail.trim(), 
        active: true, 
        password: password.trim(),
        service_tables: serviceTables,
        service_photos: servicePhotos,
        service_invitation: serviceInvitation,
        service_trivia: serviceTrivia
      }]);

    if (error) {
      console.error('Error creating event in Supabase:', error);
      throw error;
    }
  } else {
    const events = getLocalEvents();
    if (events.some(e => e.id === cleanId)) {
      throw new Error('El ID de evento ya existe.');
    }
    events.push({
      id: cleanId,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      active: true,
      password: password.trim(),
      createdAt: new Date().toISOString(),
      serviceTables,
      servicePhotos,
      serviceInvitation,
      serviceTrivia
    });
    saveLocalEvents(events);
    // Auto-create local directories for isolation
    getEventFiles(cleanId);
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

async function deleteEvent(id) {
  // Clear all photos (records and storage files) first to prevent orphaned files in bucket
  try {
    await clearPhotos(id);
  } catch (clearErr) {
    console.warn(`[db] Error clearing photos during deletion of event ${id}:`, clearErr.message);
  }

  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting event from Supabase:', error);
      throw error;
      }
  } else {
    let events = getLocalEvents();
    events = events.filter(e => e.id !== id);
    saveLocalEvents(events);

    // Delete local directory if exists
    try {
      const cleanId = (id || '').replace(/[^a-zA-Z0-9_-]/g, '');
      const eventDir = path.join(DATA_DIR, cleanId);
      if (fs.existsSync(eventDir) && cleanId !== 'default') {
        fs.rmSync(eventDir, { recursive: true, force: true });
      }
    } catch (err) {
      console.warn('Could not clean up local event directories:', err.message);
    }
  }
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
  if (!cleanEmail || !password) return null;

  if (isSupabaseEnabled) {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, password, active')
        .eq('client_email', cleanEmail);
        
      if (error) {
        console.error('Error fetching event by email from Supabase:', error);
        return null;
      }
      if (!data || data.length === 0) return null;
      
      const match = data.find(e => e.password === password);
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
    const match = events.find(e => (e.clientEmail || '').trim().toLowerCase() === cleanEmail && e.password === password);
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
    const { data, error } = await supabase
      .from('rsvps')
      .select('id, name, attending, companions_count, companions_names, dietary_restrictions, suggested_song, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching RSVPs from Supabase:', error);
      throw error;
    }

    return (data || []).map(r => ({
      id: r.id,
      name: r.name,
      attending: r.attending,
      companionsCount: r.companions_count,
      companionsNames: r.companions_names,
      dietaryRestrictions: r.dietary_restrictions,
      suggestedSong: r.suggested_song,
      createdAt: r.created_at
    }));
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
 * Add an RSVP submission
 */
async function addRsvp(eventId = 'default', rsvpData) {
  let companionsNamesStr = '';
  if (Array.isArray(rsvpData.companionsNames)) {
    companionsNamesStr = rsvpData.companionsNames.filter(name => name && name.trim()).map(name => name.trim()).join(', ');
  } else if (typeof rsvpData.companionsNames === 'string') {
    companionsNamesStr = rsvpData.companionsNames.trim();
  }

  const rsvp = {
    name: (rsvpData.name || '').trim(),
    attending: !!rsvpData.attending,
    companionsCount: parseInt(rsvpData.companionsCount, 10) || 0,
    companionsNames: companionsNamesStr,
    dietaryRestrictions: (rsvpData.dietaryRestrictions || '').trim(),
    suggestedSong: (rsvpData.suggestedSong || '').trim(),
    createdAt: new Date().toISOString()
  };

  if (isSupabaseEnabled) {
    const { error } = await supabase
      .from('rsvps')
      .insert([{
        event_id: eventId,
        name: rsvp.name,
        attending: rsvp.attending,
        companions_count: rsvp.companionsCount,
        companions_names: rsvp.companionsNames,
        dietary_restrictions: rsvp.dietaryRestrictions,
        suggested_song: rsvp.suggestedSong
      }]);

    if (error) {
      console.error('Error inserting RSVP into Supabase:', error);
      throw error;
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
    const newRsvp = {
      id: Date.now(),
      name: rsvp.name,
      attending: rsvp.attending,
      companions_count: rsvp.companionsCount,
      companions_names: rsvp.companionsNames,
      dietary_restrictions: rsvp.dietaryRestrictions,
      suggested_song: rsvp.suggestedSong,
      created_at: rsvp.createdAt
    };
    rsvps.push(newRsvp);
    fs.writeFileSync(rsvpsFile, JSON.stringify(rsvps, null, 2), 'utf8');
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
  validateEventPassword,
  findEventByEmailAndPassword,
  getRsvps,
  addRsvp,
  deleteRsvp,
  saveSongSuggestion
};

