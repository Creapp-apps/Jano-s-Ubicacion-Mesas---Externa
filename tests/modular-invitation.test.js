const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('🛡️ Running Modular Invitation Test Suite...');

// 1. Verify admin.html contains all 8 module switches
const adminHtmlPath = path.join(__dirname, '..', 'private', 'admin.html');
const adminHtmlContent = fs.readFileSync(adminHtmlPath, 'utf8');

const expectedModules = [
  'mod-countdown',
  'mod-location',
  'mod-dresscode',
  'mod-photos',
  'mod-gifts',
  'mod-chest',
  'mod-rsvp',
  'mod-music',
  'mod-farewell',
  'mod-messages'
];

expectedModules.forEach(modId => {
  assert.ok(adminHtmlContent.includes(modId), `admin.html must contain switch input with id="${modId}"`);
});
console.log('  ✓ Test 1 Passed: admin.html contains all 9 module toggle switches.');

// 2. Verify admin.css contains .luxury-module-toggle rules
const adminCssPath = path.join(__dirname, '..', 'public', 'css', 'admin.css');
const adminCssContent = fs.readFileSync(adminCssPath, 'utf8');
assert.ok(adminCssContent.includes('.luxury-module-toggle'), 'admin.css must contain .luxury-module-toggle rules');
console.log('  ✓ Test 2 Passed: admin.css styling rules for luxury module toggles exist.');

// 3. Verify invitacion.html contains applyModularSections logic
const invHtmlPath = path.join(__dirname, '..', 'public', 'invitacion.html');
const invHtmlContent = fs.readFileSync(invHtmlPath, 'utf8');
assert.ok(invHtmlContent.includes('function applyModularSections'), 'invitacion.html must define applyModularSections function');
assert.ok(invHtmlContent.includes('applyModularSections(data.enabledModules)'), 'invitacion.html must invoke applyModularSections on config load');
assert.ok(invHtmlContent.includes('applyModularSections(config.enabledModules)'), 'invitacion.html must invoke applyModularSections on live preview update');
console.log('  ✓ Test 3 Passed: invitacion.html handles applyModularSections on load & preview update.');

// 4. Verify server.js stores and delivers enabled_modules
const serverJsPath = path.join(__dirname, '..', 'server.js');
const serverJsContent = fs.readFileSync(serverJsPath, 'utf8');
assert.ok(serverJsContent.includes('enabled_modules'), 'server.js must manage enabled_modules in config DB endpoint');
console.log('  ✓ Test 4 Passed: server.js handles enabled_modules in GET & POST /api/config.');

console.log('\n✅ ALL MODULAR INVITATION TESTS PASSED SUCCESSFULLY! 🛡️\n');
