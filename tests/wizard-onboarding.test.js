const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧙 Running Invitation Wizard Onboarding Tests...');

// 1. Check CSS integrity for wizard styles
const adminCss = fs.readFileSync(path.join(__dirname, '../public/css/admin.css'), 'utf8');
assert(adminCss.includes('.subtab-btn.locked'), 'admin.css must define .subtab-btn.locked');
assert(adminCss.includes('.subtab-btn.completed'), 'admin.css must define .subtab-btn.completed');
assert(adminCss.includes('subtabShake'), 'admin.css must define shake animation for locked subtabs');
console.log('  ✓ Test 1 Passed: CSS styles for locked/completed subtabs and shake animation verified.');

// 2. Check HTML buttons and structure
const adminHtml = fs.readFileSync(path.join(__dirname, '../private/admin.html'), 'utf8');
assert(adminHtml.includes('id="subtab-btn-informacion"'), 'admin.html must have subtab-btn-informacion');
assert(adminHtml.includes('id="subtab-btn-diseno"'), 'admin.html must have subtab-btn-diseno');
assert(adminHtml.includes('id="subtab-btn-fotos-inv"'), 'admin.html must have subtab-btn-fotos-inv');
assert(adminHtml.includes('id="subtab-btn-regalos"'), 'admin.html must have subtab-btn-regalos');
assert(adminHtml.includes('id="subtab-btn-confirmaciones"'), 'admin.html must have subtab-btn-confirmaciones');
assert(adminHtml.includes('id="subtab-btn-respuestas"'), 'admin.html must have subtab-btn-respuestas');
assert(adminHtml.includes('id="subtab-btn-invitados"'), 'admin.html must have subtab-btn-invitados');

assert(adminHtml.includes("saveAndAdvanceWizard('diseno')"), 'admin.html must include advance to diseno');
assert(adminHtml.includes("saveAndAdvanceWizard('fotos-inv')"), 'admin.html must include advance to fotos-inv');
assert(adminHtml.includes("saveAndAdvanceWizard('regalos')"), 'admin.html must include advance to regalos');
assert(adminHtml.includes("saveAndAdvanceWizard('confirmaciones')"), 'admin.html must include advance to confirmaciones');
assert(adminHtml.includes("saveAndAdvanceWizard('respuestas')"), 'admin.html must include advance to respuestas');
console.log('  ✓ Test 2 Passed: HTML structure and Wizard advance handlers verified.');

// 3. Check JS logic in admin.js
const adminJs = fs.readFileSync(path.join(__dirname, '../public/js/admin.js'), 'utf8');
assert(adminJs.includes('WIZARD_SUBTABS_ORDER'), 'admin.js must declare WIZARD_SUBTABS_ORDER');
assert(adminJs.includes('initWizardState'), 'admin.js must implement initWizardState');
assert(adminJs.includes('unlockNextWizardStep'), 'admin.js must implement unlockNextWizardStep');
assert(adminJs.includes('isWizardStepUnlocked'), 'admin.js must implement isWizardStepUnlocked');
assert(adminJs.includes('saveAndAdvanceWizard'), 'admin.js must implement saveAndAdvanceWizard');
console.log('  ✓ Test 3 Passed: JavaScript Wizard Controller logic declared properly.');

// 4. Simulate Wizard State transitions
const WIZARD_SUBTABS_ORDER = ['informacion', 'diseno', 'fotos-inv', 'regalos', 'confirmaciones', 'respuestas', 'invitados'];
let unlocked = new Set(['informacion']);
let completed = new Set();

function unlockNext(current) {
  const idx = WIZARD_SUBTABS_ORDER.indexOf(current);
  if (idx !== -1) {
    completed.add(current);
    if (idx + 1 < WIZARD_SUBTABS_ORDER.length) {
      const next = WIZARD_SUBTABS_ORDER[idx + 1];
      unlocked.add(next);
      if (next === 'confirmaciones') {
        unlocked.add('respuestas');
        unlocked.add('invitados');
      }
    }
  }
}

// Initial state
assert.strictEqual(unlocked.has('informacion'), true);
assert.strictEqual(unlocked.has('diseno'), false);
assert.strictEqual(unlocked.has('fotos-inv'), false);

// After saving Informacion
unlockNext('informacion');
assert.strictEqual(unlocked.has('informacion'), true);
assert.strictEqual(unlocked.has('diseno'), true);
assert.strictEqual(completed.has('informacion'), true);
assert.strictEqual(unlocked.has('fotos-inv'), false);

// After saving Diseno
unlockNext('diseno');
assert.strictEqual(unlocked.has('fotos-inv'), true);
assert.strictEqual(completed.has('diseno'), true);

// After saving Fotos
unlockNext('fotos-inv');
assert.strictEqual(unlocked.has('regalos'), true);

// After saving Regalos
unlockNext('regalos');
assert.strictEqual(unlocked.has('confirmaciones'), true);
assert.strictEqual(unlocked.has('respuestas'), true);
assert.strictEqual(unlocked.has('invitados'), true);

console.log('  ✓ Test 4 Passed: Step by step sequential unlocking simulation passed.');

console.log('🎉 ALL INVITATION WIZARD ONBOARDING TESTS PASSED SUCCESSFULLY! 🧙');
