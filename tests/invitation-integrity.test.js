const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🛡️ Running Invitation Integrity & Structure Tests...');

const htmlPath = path.join(__dirname, '../public/invitacion.html');
const cssPath = path.join(__dirname, '../public/css/invitacion.css');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// --- Test 1: DOM Nesting Integrity (Ensures #invitation-main is NOT nested inside modals) ---
console.log('- Test 1: Checking DOM Nesting Integrity...');

const souvenirModalIndex = htmlContent.indexOf('id="souvenir-modal"');
const calendarModalIndex = htmlContent.indexOf('id="calendar-modal"');
const invitationMainIndex = htmlContent.indexOf('id="invitation-main"');

assert(souvenirModalIndex !== -1, '#souvenir-modal must exist in HTML');
assert(calendarModalIndex !== -1, '#calendar-modal must exist in HTML');
assert(invitationMainIndex !== -1, '#invitation-main must exist in HTML');

// Extract souvenir modal block
const souvenirBlock = htmlContent.substring(souvenirModalIndex, calendarModalIndex);
assert(!souvenirBlock.includes('id="invitation-main"'), 'CRITICAL: #invitation-main must NEVER be nested inside #souvenir-modal');
assert(!souvenirBlock.includes('id="calendar-modal"'), 'CRITICAL: #calendar-modal must NEVER be nested inside #souvenir-modal');

// Count opening and closing divs in souvenir modal block
const openingDivs = (souvenirBlock.match(/<div[\s>]/gi) || []).length;
const closingDivs = (souvenirBlock.match(/<\/div>/gi) || []).length;
assert.strictEqual(openingDivs, closingDivs, `#souvenir-modal must have balanced <div> tags (found ${openingDivs} opening, ${closingDivs} closing)`);

console.log('  ✓ Test 1 Passed: DOM Structure is clean and properly balanced.');

// --- Test 2: Envelope Opening Execution ---
console.log('- Test 2: Checking Envelope Opening Execution Logic...');
assert(htmlContent.includes("invitationMain.style.display = 'flex';"), 'triggerEnvelopeOpening must set display flex immediately');
assert(htmlContent.includes("invitationMain.style.opacity = '1';"), 'triggerEnvelopeOpening must set opacity 1 immediately');
assert(htmlContent.includes("gsap.set(invitationMain, { opacity: 1, y: 0 });"), 'triggerEnvelopeOpening must set GSAP opacity 1');

console.log('  ✓ Test 2 Passed: Envelope opening sets main content display immediately.');

// --- Test 3: Calendar & Farewell Slide Features ---
console.log('- Test 3: Checking Calendar & Farewell Slide Features...');
assert(htmlContent.includes('openCalendarModal'), 'openCalendarModal function must exist');
assert(htmlContent.includes('addToGoogleCalendar'), 'addToGoogleCalendar function must exist');
assert(htmlContent.includes('downloadIcsCalendar'), 'downloadIcsCalendar function must exist');
assert(htmlContent.includes('saveInvitationSouvenir'), 'saveInvitationSouvenir function must exist');
assert(htmlContent.includes('closeInvitation'), 'closeInvitation function must exist');

console.log('  ✓ Test 3 Passed: Calendar & Farewell slide interactions are intact.');

// --- Test 4: Gift Card 3D Flip & Touch Debounce ---
console.log('- Test 4: Checking Gift Card 3D Flip & Mobile Touch Debounce...');
assert(htmlContent.includes('toggleFlip'), 'Gift card flip toggle mechanism must exist');
assert(htmlContent.includes('lastTouchTime'), 'Touch synthetic mouse event suppression must exist');
assert(cssContent.includes('-webkit-backface-visibility: hidden;'), 'CSS must include -webkit-backface-visibility for mobile WebKit');
assert(cssContent.includes('-webkit-transform-style: preserve-3d;'), 'CSS must include -webkit-transform-style for 3D card rotation');

console.log('  ✓ Test 4 Passed: Gift Card 3D flip & Mobile WebKit styles are intact.');

// --- Test 5: HTML Inline Script Syntax Validation ---
console.log('- Test 5: Checking HTML Script Syntax Integrity...');
['../public/event.html', '../public/invitacion.html'].forEach(relPath => {
  const filePath = path.join(__dirname, relPath);
  const content = fs.readFileSync(filePath, 'utf8');
  const scriptMatches = content.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi);
  assert.ok(scriptMatches && scriptMatches.length > 0, `${relPath} must contain script tags`);
  scriptMatches.forEach((scriptTag, idx) => {
    const code = scriptTag.replace(/<script[\s\S]*?>/i, '').replace(/<\/script>/i, '');
    if (code.trim() && !scriptTag.includes('src=')) {
      assert.doesNotThrow(() => {
        new Function(code);
      }, `Syntax error in ${relPath} script block #${idx + 1}`);
    }
  });
});
console.log('  ✓ Test 5 Passed: HTML script tags have zero syntax errors.');

console.log('\n✅ ALL INVITATION INTEGRITY TESTS PASSED SUCCESSFULLY! 🛡️');
