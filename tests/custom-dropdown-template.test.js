const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Testing Custom Select Dropdown & Template Guidance...');

const adminJsPath = path.join(__dirname, '../public/js/admin.js');
const adminHtmlPath = path.join(__dirname, '../private/admin.html');
const adminCssPath = path.join(__dirname, '../public/css/admin.css');

const adminJsContent = fs.readFileSync(adminJsPath, 'utf8');
const adminHtmlContent = fs.readFileSync(adminHtmlPath, 'utf8');
const adminCssContent = fs.readFileSync(adminCssPath, 'utf8');

// Test 1: Check inv-template-info-box element in HTML
console.log('- Test 1: Verifying inv-template-info-box element in private/admin.html...');
assert.strictEqual(adminHtmlContent.includes('id="inv-template-info-box"'), true, 'inv-template-info-box missing');
console.log('  ✓ Test 1 Passed: Template Info Box HTML structure present.');

// Test 2: Check convertSelectToCustomDropdown and initCustomTemplateSelectAndGuides in admin.js
console.log('- Test 2: Verifying JS convertSelectToCustomDropdown & TEMPLATE_META in public/js/admin.js...');
assert.strictEqual(adminJsContent.includes('convertSelectToCustomDropdown'), true, 'convertSelectToCustomDropdown function missing');
assert.strictEqual(adminJsContent.includes('initCustomTemplateSelectAndGuides'), true, 'initCustomTemplateSelectAndGuides function missing');
assert.strictEqual(adminJsContent.includes('TEMPLATE_META'), true, 'TEMPLATE_META object missing');
assert.strictEqual(adminJsContent.includes('interactivo-3d'), true, 'interactivo-3d meta missing');
assert.strictEqual(adminJsContent.includes('slides-directo'), true, 'slides-directo meta missing');
assert.strictEqual(adminJsContent.includes('vertical-scroll'), true, 'vertical-scroll meta missing');
console.log('  ✓ Test 2 Passed: Custom dropdown converter & TEMPLATE_META implemented.');

// Test 3: Check CSS custom-select rules in admin.css
console.log('- Test 3: Verifying Custom Select CSS rules in public/css/admin.css...');
assert.strictEqual(adminCssContent.includes('.custom-select-container'), true, 'custom-select-container CSS class missing');
assert.strictEqual(adminCssContent.includes('.custom-select-trigger'), true, 'custom-select-trigger CSS class missing');
assert.strictEqual(adminCssContent.includes('.custom-select-dropdown'), true, 'custom-select-dropdown CSS class missing');
assert.strictEqual(adminCssContent.includes('.custom-select-option'), true, 'custom-select-option CSS class missing');
console.log('  ✓ Test 3 Passed: Custom Luxury Select CSS styling present.');

console.log('\n✅ ALL CUSTOM SELECT & TEMPLATE GUIDE TESTS PASSED SUCCESSFULLY! 👑\n');
