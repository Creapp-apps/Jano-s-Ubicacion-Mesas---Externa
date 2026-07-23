const assert = require('assert');
const db = require('../utils/db');

async function runPublicQrRsvpTests() {
  console.log('🧪 Running Public QR RSVP & Deduplication Tests...');

  const testEventId = 'test_qr_rsvp_' + Date.now();

  try {
    // Create test event first so foreign key constraint in Supabase is satisfied
    await db.createEvent(testEventId, 'Test Client', 'password123', 'Test Public QR Event');

    // 1. Create a test public QR RSVP for "Juan Pérez" with Phone A
    const phoneA = '5491199887766';
    const rsvp1 = await db.addOrUpdatePublicRsvp(testEventId, {
      name: 'Juan Pérez',
      phone: phoneA,
      attending: true,
      dietaryRestrictions: 'Vegetariano',
      suggestedSong: 'De Música Ligera'
    });

    assert.strictEqual(rsvp1.success, true, 'First RSVP should succeed');
    assert.strictEqual(rsvp1.isExisting, false, 'First RSVP should create a new record');

    // Fetch RSVPs and check
    let rsvps = await db.getRsvps(testEventId);
    assert.strictEqual(rsvps.length, 1, 'Should have 1 RSVP');
    assert.strictEqual(rsvps[0].name, 'Juan Pérez');
    assert.strictEqual(rsvps[0].attending, true);

    // 2. Create another "Juan Pérez" with a DIFFERENT Phone B (Should create a 2nd record!)
    const phoneB = '5491155443322';
    const rsvp2 = await db.addOrUpdatePublicRsvp(testEventId, {
      name: 'Juan Pérez',
      phone: phoneB,
      attending: true,
      dietaryRestrictions: 'Celíaco',
      suggestedSong: 'La Cumparsita'
    });

    assert.strictEqual(rsvp2.success, true, 'Second RSVP should succeed');
    assert.strictEqual(rsvp2.isExisting, false, 'Second RSVP with different phone should create a separate record');

    rsvps = await db.getRsvps(testEventId);
    assert.strictEqual(rsvps.length, 2, 'Should have 2 distinct RSVPs for the two Juan Pérez with different phones');

    // 3. Re-submit RSVP using Phone A (Same phone -> Should UPDATE existing record 1)
    const rsvp3 = await db.addOrUpdatePublicRsvp(testEventId, {
      name: 'Juan Pérez Actualizado',
      phone: phoneA,
      attending: false,
      dietaryRestrictions: 'Vegano',
      suggestedSong: 'Sin Cadenas'
    });

    assert.strictEqual(rsvp3.success, true, 'Third RSVP update should succeed');
    assert.strictEqual(rsvp3.isExisting, true, 'RSVP with matching phone should be marked as existing');

    rsvps = await db.getRsvps(testEventId);
    assert.strictEqual(rsvps.length, 2, 'Should still have 2 RSVPs (no duplicate created)');
    
    const updatedRecord = rsvps.find(r => r.name.includes('Actualizado') || r.id === rsvp1.rsvpId);
    assert.ok(updatedRecord, 'Updated record should exist');
    assert.strictEqual(updatedRecord.attending, false, 'Attendance should be updated to false');

    // 4. Test deduplication when a song is suggested first (generating an RSVP without phone),
    // and then the RSVP form is submitted with a phone number.
    const nameD = 'María Gómez';
    const phoneC = '5491144445555';
    const songD = 'Get Lucky';

    // A. Suggest song (inserts a record without phone)
    await db.saveSongSuggestion(testEventId, nameD, songD);

    // Fetch and check that it was inserted
    rsvps = await db.getRsvps(testEventId);
    const songRsvp = rsvps.find(r => r.name === nameD);
    assert.ok(songRsvp, 'Song suggestion RSVP record should exist');
    assert.strictEqual(songRsvp.suggested_song || songRsvp.suggestedSong, songD, 'Suggested song should be saved');
    assert.ok(!(songRsvp.phone && songRsvp.phone.trim()), 'Phone should be empty initially');

    // B. Submit public QR RSVP (should UPDATE the existing record instead of duplicating)
    const rsvp4 = await db.addOrUpdatePublicRsvp(testEventId, {
      name: nameD,
      phone: phoneC,
      attending: true,
      dietaryRestrictions: 'Sin sal',
      suggestedSong: ''
    });

    assert.strictEqual(rsvp4.success, true, 'RSVP submit after song suggestion should succeed');
    assert.strictEqual(rsvp4.isExisting, true, 'Should update the existing record (match by name fallback with empty phone)');

    // Fetch and verify no duplicate was created, and details were merged
    rsvps = await db.getRsvps(testEventId);
    const mariaRecords = rsvps.filter(r => r.name === nameD);
    assert.strictEqual(mariaRecords.length, 1, 'Should only have 1 record for María Gómez (no duplicate created)');
    assert.strictEqual(mariaRecords[0].phone, phoneC, 'Phone should be updated');
    assert.strictEqual(mariaRecords[0].dietary_restrictions || mariaRecords[0].dietaryRestrictions, 'Sin sal', 'Diet should be updated');
    assert.strictEqual(mariaRecords[0].suggested_song || mariaRecords[0].suggestedSong, songD, 'Song suggestion should be preserved');

    console.log('✅ ALL PUBLIC QR RSVP & DEDUPLICATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    // Cleanup test event data
    try {
      await db.deleteEvent(testEventId);
    } catch(e){}
  }
}

runPublicQrRsvpTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
