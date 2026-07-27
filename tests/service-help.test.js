const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Testing Service Help Modal Guides & Content...');

const adminJsPath = path.join(__dirname, '../public/js/admin.js');
const adminHtmlPath = path.join(__dirname, '../private/admin.html');

const adminJsContent = fs.readFileSync(adminJsPath, 'utf8');
const adminHtmlContent = fs.readFileSync(adminHtmlPath, 'utf8');

// Test 1: Check HTML elements exist
console.log('- Test 1: Verifying HTML structure for service-help-modal...');
assert.strictEqual(adminHtmlContent.includes('id="service-help-modal"'), true, 'service-help-modal container missing in HTML');
assert.strictEqual(adminHtmlContent.includes('id="service-help-badge"'), true, 'service-help-badge missing in HTML');
assert.strictEqual(adminHtmlContent.includes('id="service-help-title"'), true, 'service-help-title missing in HTML');
assert.strictEqual(adminHtmlContent.includes('id="service-help-slides-wrapper"'), true, 'service-help-slides-wrapper missing in HTML');
assert.strictEqual(adminHtmlContent.includes('id="service-help-indicators"'), true, 'service-help-indicators missing in HTML');
console.log('  ✓ Test 1 Passed: HTML structure present.');

// Test 2: Check JS SERVICE_GUIDES definitions
console.log('- Test 2: Checking SERVICE_GUIDES content for all 5 services...');
const services = ['invitacion', 'mesas', 'fotos', 'trivia', 'tanda'];
services.forEach(svc => {
  assert.strictEqual(adminJsContent.includes(`${svc}: {`), true, `Service guide missing for ${svc}`);
});
console.log('  ✓ Test 2 Passed: All 5 service guides defined.');

// Test 3: Check controller functions
console.log('- Test 3: Checking controller functions...');
assert.strictEqual(adminJsContent.includes('window.openServiceHelpModal'), true, 'openServiceHelpModal function missing');
assert.strictEqual(adminJsContent.includes('window.closeServiceHelpModal'), true, 'closeServiceHelpModal function missing');
assert.strictEqual(adminJsContent.includes('window.navigateServiceHelpSlide'), true, 'navigateServiceHelpSlide function missing');
console.log('  ✓ Test 3 Passed: Controller functions exported.');

console.log('\n✅ ALL SERVICE HELP MODAL TESTS PASSED SUCCESSFULLY! 👑\n');
