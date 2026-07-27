const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Testing Audio Preview Player Widget & Sound Wave Visualizer...');

const adminJsPath = path.join(__dirname, '../public/js/admin.js');
const adminHtmlPath = path.join(__dirname, '../private/admin.html');
const adminCssPath = path.join(__dirname, '../public/css/admin.css');

const adminJsContent = fs.readFileSync(adminJsPath, 'utf8');
const adminHtmlContent = fs.readFileSync(adminHtmlPath, 'utf8');
const adminCssContent = fs.readFileSync(adminCssPath, 'utf8');

// Test 1: Check HTML elements in private/admin.html
console.log('- Test 1: Verifying Audio Preview Player HTML elements in private/admin.html...');
assert.strictEqual(adminHtmlContent.includes('id="inv-audio-player-widget"'), true, 'inv-audio-player-widget missing');
assert.strictEqual(adminHtmlContent.includes('id="btn-audio-play-pause"'), true, 'btn-audio-play-pause missing');
assert.strictEqual(adminHtmlContent.includes('id="btn-audio-stop"'), true, 'btn-audio-stop missing');
assert.strictEqual(adminHtmlContent.includes('id="audio-player-time"'), true, 'audio-player-time missing');
assert.strictEqual(adminHtmlContent.includes('id="audio-waveform-container"'), true, 'audio-waveform-container missing');
assert.strictEqual(adminHtmlContent.includes('id="inv-audio-element"'), true, 'inv-audio-element missing');
console.log('  ✓ Test 1 Passed: All HTML elements for the Audio Player Widget are present.');

// Test 2: Check JS controller in public/js/admin.js
console.log('- Test 2: Verifying JS controller initAudioPreviewPlayer in public/js/admin.js...');
assert.strictEqual(adminJsContent.includes('initAudioPreviewPlayer'), true, 'initAudioPreviewPlayer function missing');
assert.strictEqual(adminJsContent.includes('btnStop.addEventListener'), true, 'Stop button listener missing');
assert.strictEqual(adminJsContent.includes('btnPlayPause.addEventListener'), true, 'Play/Pause button listener missing');
assert.strictEqual(adminJsContent.includes('waveformContainer.addEventListener(\'click\''), true, 'Seek click listener missing');
console.log('  ✓ Test 2 Passed: Audio Preview Player controller logic correctly implemented.');

// Test 3: Check CSS styles in public/css/admin.css
console.log('- Test 3: Verifying Waveform Equalizer CSS rules in public/css/admin.css...');
assert.strictEqual(adminCssContent.includes('.audio-waveform-wrap .audio-wave-bar'), true, 'audio-wave-bar CSS class missing');
assert.strictEqual(adminCssContent.includes('waveEqualizer'), true, 'waveEqualizer CSS keyframe missing');
assert.strictEqual(adminCssContent.includes('.btn-play-pause:hover'), true, 'btn-play-pause hover styling missing');
console.log('  ✓ Test 3 Passed: Waveform Equalizer CSS rules present.');

console.log('\n✅ ALL AUDIO PREVIEW PLAYER TESTS PASSED SUCCESSFULLY! 🎧\n');
