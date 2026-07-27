const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Testing Audio Progress Animated Friendly Messages...');

const adminJsPath = path.join(__dirname, '../public/js/admin.js');
const adminCssPath = path.join(__dirname, '../public/css/admin.css');

const adminJsContent = fs.readFileSync(adminJsPath, 'utf8');
const adminCssContent = fs.readFileSync(adminCssPath, 'utf8');

// Test 1: Check FRIENDLY_MESSAGES array in admin.js
console.log('- Test 1: Verifying FRIENDLY_MESSAGES array in public/js/admin.js...');
assert.strictEqual(adminJsContent.includes('FRIENDLY_MESSAGES'), true, 'FRIENDLY_MESSAGES array missing');
assert.strictEqual(adminJsContent.includes('Calibrando tu pista de audio... 🎵'), true, 'Message 1 missing');
assert.strictEqual(adminJsContent.includes('Preparando la mejor fiesta de tu vida... 🎉'), true, 'Message 2 missing');
assert.strictEqual(adminJsContent.includes('Ajustando los decibeles para la pista de baile... 🎧'), true, 'Message 3 missing');
assert.strictEqual(adminJsContent.includes('Sincronizando la música con tu invitación... ✨'), true, 'Message 4 missing');
console.log('  ✓ Test 1 Passed: FRIENDLY_MESSAGES array populated correctly.');

// Test 2: Check interval rotation and cleanup
console.log('- Test 2: Verifying message rotation interval & cleanup...');
assert.strictEqual(adminJsContent.includes('friendlyMsgInterval = setInterval'), true, 'friendlyMsgInterval missing');
assert.strictEqual(adminJsContent.includes('clearInterval(friendlyMsgInterval)'), true, 'clearInterval missing');
console.log('  ✓ Test 2 Passed: Rotation interval and cleanup implemented.');

// Test 3: Check breathing ring pulse animation in CSS
console.log('- Test 3: Verifying ringBreathingGlow animation in public/css/admin.css...');
assert.strictEqual(adminCssContent.includes('ringBreathingGlow'), true, 'ringBreathingGlow CSS animation missing');
assert.strictEqual(adminCssContent.includes('animation: ringBreathingGlow'), true, 'ringBreathingGlow animation attachment missing');
console.log('  ✓ Test 3 Passed: Breathing glow animation attached.');

console.log('\n✅ ALL AUDIO PROGRESS MESSAGE TESTS PASSED SUCCESSFULLY! 🎵\n');
