const assert = require('assert');
const db = require('../utils/db');
require('dotenv').config();

async function runTests() {
  console.log('Running Capitanes DB Tests...');
  const eventId = 'test_capitanes_event_' + Math.floor(Math.random() * 1000000);

  try {
    // 0. Create test event
    console.log('- Test 0: Create test event');
    await db.createEvent(eventId, 'Test Capitanes Event');

    // 1. Get default config when none exists
    console.log('- Test 1: Get default config');
    const config = await db.getCapitanesConfig(eventId);
    assert.strictEqual(config.gameMode, 'general');
    assert.strictEqual(config.timeLimit, 600);
    assert.deepStrictEqual(config.quests, []);

    // 2. Save and retrieve custom config
    console.log('- Test 2: Save and retrieve config');
    const customConfig = {
      gameMode: 'custom',
      timeLimit: 1200,
      quests: [{ id: 'q1', text: 'Bailar con la novia', points: 100 }]
    };
    await db.saveCapitanesConfig(eventId, customConfig);

    const savedConfig = await db.getCapitanesConfig(eventId);
    assert.strictEqual(savedConfig.gameMode, 'custom');
    assert.strictEqual(savedConfig.timeLimit, 1200);
    assert.strictEqual(savedConfig.quests.length, 1);
    assert.strictEqual(savedConfig.quests[0].text, 'Bailar con la novia');

    // 3. Get default progress
    console.log('- Test 3: Get default progress');
    const progress = await db.getCapitanesProgress(eventId);
    assert.deepStrictEqual(progress, {});

    // 4. Save and retrieve progress
    console.log('- Test 4: Save and retrieve progress');
    const customProgress = {
      'Mesa 1': {
        q1: { status: 'SUBMITTED', photoUrl: '/uploads/photos/test.jpg' }
      }
    };
    await db.saveCapitanesProgress(eventId, customProgress);

    const savedProgress = await db.getCapitanesProgress(eventId);
    assert.deepStrictEqual(savedProgress, customProgress);

    // Clean up
    console.log('- Cleaning up');
    await db.deleteEvent(eventId);

    console.log('\nAll Capitanes DB tests passed successfully!');
  } catch (e) {
    console.error('\nCapitanes DB test failed:', e);
    // Try cleaning up anyway
    try {
      await db.deleteEvent(eventId);
    } catch (_) {}
    process.exit(1);
  }
}

runTests();
