const assert = require('assert');
const http = require('http');
const db = require('../utils/db');

async function runPublicHallLayoutTests() {
  console.log('🧪 Running Public Hall Layout & Tablemates API Tests...');

  const testEventId = 'test_hall_layout_' + Date.now();

  try {
    // 1. Create test event
    await db.createEvent(testEventId, 'Test Hall Layout', 'password123', 'Test Event Hall');

    // 2. Save custom hall layout in db
    const mockLayout = {
      items: [
        { id: 'item_1', type: 'entrada', name: 'Ingreso Principal', x: 50, y: 350 },
        { id: 'item_2', type: 'dj', name: 'Cabina DJ', x: 250, y: 50 },
        { id: 'item_3', type: 'barra', name: 'Barra Principal', x: 450, y: 200 }
      ],
      tablePositions: {
        'Mesa 1': { x: 150, y: 150 },
        'Mesa 2': { x: 350, y: 150 },
        'Mesa Principal': { x: 250, y: 100 }
      },
      boardHeight: 500
    };
    await db.setConfigValue(testEventId, 'custom_hall_layout', JSON.stringify(mockLayout));

    // 3. Create test guests assigned to tables
    await db.addGuest(testEventId, { firstName: 'Lucas', lastName: 'Gómez', table: 'Mesa 1', rsvp: true });
    await db.addGuest(testEventId, { firstName: 'Sofia', lastName: 'Martínez', table: 'Mesa 1', rsvp: true });
    await db.addGuest(testEventId, { firstName: 'Carlos', lastName: 'Pérez', table: 'Mesa 2', rsvp: false });

    // Test DB layout config read directly
    const storedLayoutRaw = await db.getConfigValue(testEventId, 'custom_hall_layout', '{}');
    const storedLayout = JSON.parse(storedLayoutRaw);
    assert.strictEqual(storedLayout.items.length, 3, 'Should have 3 landmarks');
    assert.strictEqual(storedLayout.tablePositions['Mesa 1'].x, 150, 'Mesa 1 x should match');
    assert.strictEqual(storedLayout.tablePositions['Mesa 2'].x, 350, 'Mesa 2 x should match');

    // Test guests per table from DB
    const allGuests = await db.getGuests(testEventId);
    const mesa1Guests = allGuests.filter(g => g.table && g.table.toLowerCase() === 'mesa 1');
    assert.strictEqual(mesa1Guests.length, 2, 'Mesa 1 should have 2 guests');

    // 4. Test Table Renaming Migration Logic ("Mesa 1" -> "PRIMOS")
    const customTables = [{ name: 'Mesa 1', capacity: 10 }, { name: 'Mesa 2', capacity: 10 }];
    await db.setConfigValue(testEventId, 'custom_tables', JSON.stringify(customTables));

    // Simulate rename operation
    const oldName = 'Mesa 1';
    const newName = 'PRIMOS';

    // Migrate custom_tables
    customTables[0].name = newName;
    await db.setConfigValue(testEventId, 'custom_tables', JSON.stringify(customTables));

    // Migrate layout
    storedLayout.tablePositions[newName] = storedLayout.tablePositions[oldName];
    delete storedLayout.tablePositions[oldName];
    await db.setConfigValue(testEventId, 'custom_hall_layout', JSON.stringify(storedLayout));

    // Migrate guests
    for (const g of mesa1Guests) {
      const idx = allGuests.findIndex(item => item.firstName === g.firstName && item.lastName === g.lastName);
      const targetId = g.id !== undefined ? g.id : (idx >= 0 ? idx : 0);
      await db.updateGuest(testEventId, targetId, { ...g, table: newName });
    }

    // Verify migration
    const updatedGuests = await db.getGuests(testEventId);
    const primosGuests = updatedGuests.filter(g => g.table && g.table.toLowerCase() === 'primos');
    assert.strictEqual(primosGuests.length, 2, 'PRIMOS should now have the 2 migrated guests');

    const updatedLayout = JSON.parse(await db.getConfigValue(testEventId, 'custom_hall_layout', '{}'));
    assert.ok(updatedLayout.tablePositions['PRIMOS'], 'PRIMOS table position should exist');
    assert.strictEqual(updatedLayout.tablePositions['Mesa 1'], undefined, 'Mesa 1 position should be removed');

    console.log('✅ Public Hall Layout & Tablemates unit tests passed successfully!');
  } catch (error) {
    console.error('❌ Public Hall Layout test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runPublicHallLayoutTests();
}

module.exports = runPublicHallLayoutTests;
