const assert = require('assert');
const { searchGuests } = require('../utils/search');

// Mock guest database
const mockGuests = [
  { firstName: 'Sebastián', lastName: 'Maza', table: 'Mesa 5' },
  { firstName: 'María', lastName: 'Luz', table: 'Mesa 12' },
  { firstName: 'Juan José', lastName: 'Pérez', table: 'Mesa 5' },
  { firstName: 'Ana María', lastName: 'Gómez', table: 'Mesa 3' }
];

try {
  console.log('Running tests...');

  // Test 1: Simple exact matching (case-insensitive)
  console.log('- Test 1: exact match');
  let res = searchGuests('sebastian', mockGuests);
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].firstName, 'Sebastián');

  // Test 2: Accent normalization
  console.log('- Test 2: accent normalization');
  res = searchGuests('maria', mockGuests);
  assert.strictEqual(res.length, 2); // should match "María Luz" and "Ana María Gómez"

  // Test 3: Multi-word matching in different fields
  console.log('- Test 3: multi-word search across name and surname');
  res = searchGuests('maza seba', mockGuests);
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].firstName, 'Sebastián');
  assert.strictEqual(res[0].lastName, 'Maza');

  // Test 4: Partials
  console.log('- Test 4: partial match');
  res = searchGuests('pe', mockGuests);
  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].firstName, 'Juan José');

  console.log('\nAll tests passed successfully!');
} catch (e) {
  console.error('\nTest failed:', e);
  process.exit(1);
}
