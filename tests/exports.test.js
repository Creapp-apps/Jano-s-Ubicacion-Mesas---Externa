const assert = require('assert');

// Helper to simulate data processing for Menus Export
function processMenuData(guests, rsvps) {
  const guestTableMap = {};
  guests.forEach(g => {
    const fn = `${g.firstName || ''} ${g.lastName || ''}`.trim().toLowerCase();
    if (fn) guestTableMap[fn] = g.table || 'Sin Mesa';
  });

  const menuItems = [];
  const countsMap = {};

  rsvps.forEach(r => {
    const restriction = (r.dietaryRestrictions || '').trim();
    if (restriction) {
      const fn = (r.name || '').trim().toLowerCase();
      const table = guestTableMap[fn] || 'Sin Mesa';
      
      menuItems.push({
        guestName: r.name,
        table: table,
        restriction: restriction
      });

      const normKey = restriction.charAt(0).toUpperCase() + restriction.slice(1);
      countsMap[normKey] = (countsMap[normKey] || 0) + 1;
    }
  });

  return { menuItems, countsMap };
}

// Helper to simulate data processing for DJ Songs Export
function processDjSongData(guests, rsvps) {
  const guestTableMap = {};
  guests.forEach(g => {
    const fn = `${g.firstName || ''} ${g.lastName || ''}`.trim().toLowerCase();
    if (fn) guestTableMap[fn] = g.table || 'Sin Mesa';
  });

  const songItems = [];
  rsvps.forEach(r => {
    const song = (r.suggestedSong || '').trim();
    if (song) {
      const fn = (r.name || '').trim().toLowerCase();
      const table = guestTableMap[fn] || 'Sin Mesa';
      
      songItems.push({
        song: song,
        guestName: r.name,
        table: table
      });
    }
  });

  return songItems;
}

console.log('Running Export Features Tests...');

// Mock data
const mockGuests = [
  { firstName: 'Laura', lastName: 'Gomez', table: 'Mesa 1' },
  { firstName: 'Martin', lastName: 'Perez', table: 'Mesa 2' },
  { firstName: 'Sofia', lastName: 'Rodriguez', table: 'Mesa 1' }
];

const mockRsvps = [
  { name: 'Laura Gomez', attending: true, dietaryRestrictions: 'Celíaco', suggestedSong: 'Daft Punk - One More Time' },
  { name: 'Martin Perez', attending: true, dietaryRestrictions: 'Vegetariano', suggestedSong: 'Coldplay - Viva La Vida' },
  { name: 'Sofia Rodriguez', attending: true, dietaryRestrictions: 'Celíaco', suggestedSong: '' }
];

// Test 1: Menus Processing
const menuResult = processMenuData(mockGuests, mockRsvps);
assert.strictEqual(menuResult.menuItems.length, 3, 'Must find 3 guests with dietary restrictions');
assert.strictEqual(menuResult.countsMap['Celíaco'], 2, 'Must count 2 Celíaco restrictions');
assert.strictEqual(menuResult.countsMap['Vegetariano'], 1, 'Must count 1 Vegetariano restriction');
assert.strictEqual(menuResult.menuItems[0].table, 'Mesa 1', 'Must correctly match table number');
console.log('- Test 1: Menus processing & executive summary count - Passed');

// Test 2: DJ Songs Processing
const songResult = processDjSongData(mockGuests, mockRsvps);
assert.strictEqual(songResult.length, 2, 'Must find 2 song suggestions');
assert.strictEqual(songResult[0].song, 'Daft Punk - One More Time', 'Must match song title');
assert.strictEqual(songResult[0].table, 'Mesa 1', 'Must match guest table');
console.log('- Test 2: DJ Songs processing - Passed');

console.log('\nAll export tests passed successfully!');
