const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Force local mode for tests so we don't depend on live database migrations
process.env.FORCE_LOCAL = 'true';

const db = require('../utils/db');

async function runTests() {
  console.log('Running Multi-Tenancy Database Tests...');

  try {
    const testEvent1 = 'test_event_1';
    const testEvent2 = 'test_event_2';

    // Set config for testEvent1
    console.log('- Test setting event title for Event 1');
    await db.setEventTitle(testEvent1, 'Boda de Flor y Fran');
    
    // Set config for testEvent2
    console.log('- Test setting event title for Event 2');
    await db.setEventTitle(testEvent2, 'XV de Mía');

    // Retrieve and verify titles are isolated
    const title1 = await db.getEventTitle(testEvent1);
    const title2 = await db.getEventTitle(testEvent2);
    
    assert.strictEqual(title1, 'Boda de Flor y Fran');
    assert.strictEqual(title2, 'XV de Mía');
    console.log('  -> Config isolation PASSED');

    // Add guests to Event 1
    console.log('- Test guests list isolation');
    await db.saveGuests(testEvent1, [
      { firstName: 'Pedro', lastName: 'Gomez', table: 'Mesa 1' }
    ]);

    // Add guests to Event 2
    await db.saveGuests(testEvent2, [
      { firstName: 'Lucía', lastName: 'Fernandez', table: 'Mesa XV' }
    ]);

    const guests1 = await db.getGuests(testEvent1);
    const guests2 = await db.getGuests(testEvent2);

    assert.strictEqual(guests1.length, 1);
    assert.strictEqual(guests1[0].firstName, 'Pedro');
    
    assert.strictEqual(guests2.length, 1);
    assert.strictEqual(guests2[0].firstName, 'Lucía');
    console.log('  -> Guests isolation PASSED');

    // Add photo to Event 1
    console.log('- Test photo gallery isolation');
    await db.addPhoto(testEvent1, {
      guestName: 'Tío Roberto',
      message: 'Felicidades!',
      photoUrl: '/uploads/photos/test_event_1/123.jpg'
    });

    const photos1 = await db.getPhotos(testEvent1, false);
    const photos2 = await db.getPhotos(testEvent2, false);

    assert.strictEqual(photos1.length, 1);
    assert.strictEqual(photos1[0].guestName, 'Tío Roberto');
    assert.strictEqual(photos2.length, 0);
    console.log('  -> Photos isolation PASSED');

    // Test clearPhotos
    console.log('- Test clear photos isolation');
    await db.addPhoto(testEvent2, {
      guestName: 'Tía Marta',
      message: 'Felicidades Marta!',
      photoUrl: '/uploads/photos/test_event_2/456.jpg'
    });
    
    await db.clearPhotos(testEvent1);
    const photos1Cleared = await db.getPhotos(testEvent1, false);
    const photos2StillHere = await db.getPhotos(testEvent2, false);
    assert.strictEqual(photos1Cleared.length, 0);
    assert.strictEqual(photos2StillHere.length, 1);
    console.log('  -> clearPhotos isolation PASSED');
    
    // Clear Event 2 too
    await db.clearPhotos(testEvent2);
    const photos2Cleared = await db.getPhotos(testEvent2, false);
    assert.strictEqual(photos2Cleared.length, 0);

    // Clean up
    console.log('- Test database clearing');
    await db.clearGuests(testEvent1);
    const guests1Cleared = await db.getGuests(testEvent1);
    assert.strictEqual(guests1Cleared.length, 0);
    
    const guests2StillHere = await db.getGuests(testEvent2);
    assert.strictEqual(guests2StillHere.length, 1);
    console.log('  -> DB clearing isolation PASSED');

    // Remove test directories if not in Supabase mode
    if (!db.isSupabaseEnabled) {
      const dataDir1 = path.join(__dirname, '..', 'data', testEvent1);
      const dataDir2 = path.join(__dirname, '..', 'data', testEvent2);
      if (fs.existsSync(dataDir1)) {
        fs.rmSync(dataDir1, { recursive: true, force: true });
      }
      if (fs.existsSync(dataDir2)) {
        fs.rmSync(dataDir2, { recursive: true, force: true });
      }
    }

    console.log('\nAll Multi-Tenancy database tests passed successfully!');
  } catch (error) {
    console.error('\nTest failed:', error);
    process.exit(1);
  }
}

runTests();
