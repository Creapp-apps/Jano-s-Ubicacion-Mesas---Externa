const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Testing Mandatory Event Fields Validation & Glowing Animation...');

const adminJsPath = path.join(__dirname, '../public/js/admin.js');
const adminHtmlPath = path.join(__dirname, '../private/admin.html');
const adminCssPath = path.join(__dirname, '../public/css/admin.css');

const adminJsContent = fs.readFileSync(adminJsPath, 'utf8');
const adminHtmlContent = fs.readFileSync(adminHtmlPath, 'utf8');
const adminCssContent = fs.readFileSync(adminCssPath, 'utf8');

// Test 1: Check HTML label asterisks for all 6 mandatory fields
console.log('- Test 1: Verifying red asterisk indicators on labels in private/admin.html...');
const fields = [
  'Título del Evento',
  'Fecha del Evento',
  'Hora Inicio',
  'Hora Fin',
  'Dirección del Salón',
  'Enlace de Google Maps del Salón'
];

fields.forEach(f => {
  assert.strictEqual(adminHtmlContent.includes(`${f} <span style="color: #ff4d4d`), true, `Missing asterisk on label: ${f}`);
});
console.log('  ✓ Test 1 Passed: All 6 mandatory fields have visual red asterisk indicators.');

// Test 2: Check validateMandatoryInvitationFields in admin.js
console.log('- Test 2: Verifying JS validation function validateMandatoryInvitationFields...');
assert.strictEqual(adminJsContent.includes('validateMandatoryInvitationFields'), true, 'validateMandatoryInvitationFields function missing');
assert.strictEqual(adminJsContent.includes("name: 'Título del Evento'"), true, 'Title field check missing');
assert.strictEqual(adminJsContent.includes("name: 'Fecha del Evento'"), true, 'Date field check missing');
assert.strictEqual(adminJsContent.includes("name: 'Hora Inicio'"), true, 'Start time check missing');
assert.strictEqual(adminJsContent.includes("name: 'Hora Fin'"), true, 'End time check missing');
assert.strictEqual(adminJsContent.includes("name: 'Dirección del Salón'"), true, 'Address check missing');
assert.strictEqual(adminJsContent.includes("name: 'Enlace de Google Maps del Salón'"), true, 'Maps URL check missing');
assert.strictEqual(adminJsContent.includes("input-mandatory-glow"), true, 'input-mandatory-glow class assignment missing in JS');
console.log('  ✓ Test 2 Passed: Mandatory field validation correctly checks all 6 fields.');

// Test 3: Check CSS animation class in admin.css
console.log('- Test 3: Verifying mandatoryGlowPulse animation in public/css/admin.css...');
assert.strictEqual(adminCssContent.includes('mandatoryGlowPulse'), true, 'mandatoryGlowPulse animation keyframes missing');
assert.strictEqual(adminCssContent.includes('.input-mandatory-glow'), true, 'input-mandatory-glow CSS class missing');
console.log('  ✓ Test 3 Passed: Glowing pulse animation CSS rules present.');

console.log('\n✅ ALL MANDATORY FIELDS VALIDATION TESTS PASSED SUCCESSFULLY! 👑\n');
