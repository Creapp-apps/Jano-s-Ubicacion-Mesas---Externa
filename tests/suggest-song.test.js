const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('../utils/db');
require('dotenv').config();

async function runTests() {
  console.log('Running Suggest Song Tests...');
  const eventId = 'default';
  
  // Make sure we have a clean state/test directory
  const dataDir = path.join(__dirname, '../data', eventId);
  const rsvpsFile = path.join(dataDir, 'rsvps.json');
  let originalRsvps = null;

  // Initialize test Supabase client if enabled
  let testSupabase = null;
  if (db.isSupabaseEnabled) {
    const { createClient } = require('@supabase/supabase-js');
    testSupabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }

  // Backup existing local RSVP if it exists
  if (!db.isSupabaseEnabled && fs.existsSync(rsvpsFile)) {
    try {
      originalRsvps = fs.readFileSync(rsvpsFile, 'utf8');
    } catch (e) {}
  }

  try {
    // Clean up local file for test
    if (!db.isSupabaseEnabled) {
      fs.mkdirSync(dataDir, { recursive: true });
      if (fs.existsSync(rsvpsFile)) {
        fs.unlinkSync(rsvpsFile);
      }
    }

    const testName = 'Lucas Perez ' + Math.floor(Math.random() * 1000000);

    // Test 1: Save song suggestion when RSVP doesn't exist
    console.log('- Test 1: Save suggestion when RSVP does not exist');
    await db.saveSongSuggestion(eventId, testName, 'Daft Punk - One More Time');

    // Verify it saved
    if (!db.isSupabaseEnabled) {
      assert.strictEqual(fs.existsSync(rsvpsFile), true, 'rsvps.json should be created');
      const rsvps = JSON.parse(fs.readFileSync(rsvpsFile, 'utf8'));
      const added = rsvps.find(r => r.name.toLowerCase() === testName.toLowerCase());
      assert.ok(added, 'RSVP should be added');
      assert.strictEqual(added.suggested_song, 'Daft Punk - One More Time');
      assert.strictEqual(added.attending, true);
    } else {
      // Query Supabase directly to check
      const { data, error } = await testSupabase
        .from('rsvps')
        .select('*')
        .eq('event_id', eventId)
        .ilike('name', testName);
      assert.strictEqual(error, null);
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].suggested_song, 'Daft Punk - One More Time');
    }

    // Test 2: Save song suggestion updating an existing RSVP
    console.log('- Test 2: Update existing RSVP song suggestion');
    await db.saveSongSuggestion(eventId, testName, 'Daft Punk - Get Lucky');

    if (!db.isSupabaseEnabled) {
      const rsvps = JSON.parse(fs.readFileSync(rsvpsFile, 'utf8'));
      const updated = rsvps.find(r => r.name.toLowerCase() === testName.toLowerCase());
      assert.ok(updated, 'RSVP should be present');
      assert.strictEqual(updated.suggested_song, 'Daft Punk - Get Lucky');
    } else {
      const { data, error } = await testSupabase
        .from('rsvps')
        .select('*')
        .eq('event_id', eventId)
        .ilike('name', testName);
      assert.strictEqual(error, null);
      assert.strictEqual(data.length, 1);
      assert.strictEqual(data[0].suggested_song, 'Daft Punk - Get Lucky');

      // Clean up Supabase
      await testSupabase
        .from('rsvps')
        .delete()
        .eq('event_id', eventId)
        .ilike('name', testName);
    }

    console.log('\nAll suggest-song tests passed successfully!');
  } catch (e) {
    console.error('\nSuggest-song test failed:', e);
    process.exit(1);
  } finally {
    // Restore backup if any
    if (!db.isSupabaseEnabled) {
      if (originalRsvps) {
        fs.writeFileSync(rsvpsFile, originalRsvps, 'utf8');
      } else if (fs.existsSync(rsvpsFile)) {
        fs.unlinkSync(rsvpsFile);
      }
    }
  }
}

runTests();
