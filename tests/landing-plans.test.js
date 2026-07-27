const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🛡️ Running Commercial Landing Page Test Suite...');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

// 1. Verify 4 official plan names
const expectedPlans = ['Bronce', 'Silver', 'Gold', 'VIP'];
expectedPlans.forEach(planName => {
  assert.ok(indexContent.includes(planName), `index.html must contain Plan ${planName}`);
});
console.log('  ✓ Test 1 Passed: index.html contains all 4 plan names (Bronce, Silver, Gold, VIP).');

// 2. Verify official plan prices
const expectedPrices = ['$350.000', '$500.000', '$750.000', '$1.000.000'];
expectedPrices.forEach(price => {
  assert.ok(indexContent.includes(price), `index.html must contain price ${price}`);
});
console.log('  ✓ Test 2 Passed: index.html contains all official prices ($350k, $500k, $750k, $1M).');

// 3. Verify all 6 interactive modules are listed in features
const expectedModules = [
  'Invitación Digital Interactiva 3D',
  'Buscador de Mesas QR',
  'Fotos en Pantalla Gigante',
  'Trivia Show Interactivo',
  'Capitanes de Mesa',
  'Batalla Musical / Tandas'
];

expectedModules.forEach(modName => {
  assert.ok(indexContent.includes(modName), `index.html must describe module "${modName}"`);
});
console.log('  ✓ Test 3 Passed: index.html lists all 6 interactive modules.');

// 4. Verify landing.css contains 4-card pricing grid rules
const cssPath = path.join(__dirname, '..', 'public', 'css', 'landing.css');
const cssContent = fs.readFileSync(cssPath, 'utf8');
assert.ok(cssContent.includes('.price-card.vip'), 'landing.css must contain .price-card.vip styling');
assert.ok(cssContent.includes('grid-template-columns: repeat(4, 1fr)'), 'landing.css must set 4 columns for pricing grid');
console.log('  ✓ Test 4 Passed: landing.css styling for 4-column pricing grid and VIP card exist.');

console.log('\n✅ ALL COMMERCIAL LANDING TESTS PASSED SUCCESSFULLY! 🛡️\n');
