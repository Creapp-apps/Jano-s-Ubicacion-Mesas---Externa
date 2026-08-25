const assert = require('assert');
const fs = require('fs');
const path = require('path');
const db = require('../utils/db');

console.log('💌 Running Guest Messages & VJ Stage Test Suite...');

async function runTests() {
  const testEventId = 'test-msg-event-' + Date.now();

  // Test 1: Add direct dedication message
  const msg1 = await db.addEventMessage(testEventId, {
    author: 'Juan Pérez',
    message: '¡Muchas felicidades y que disfruten de esta hermosa noche!',
    source: 'direct',
    phone: '+5491122334455'
  });

  assert.ok(msg1 && msg1.id, 'addEventMessage should return created message with unique id');
  assert.strictEqual(msg1.author, 'Juan Pérez');
  assert.strictEqual(msg1.approved, true);
  assert.strictEqual(msg1.featured, false);
  console.log('  ✓ Test 1 Passed: Direct message added and structured correctly.');

  // Test 2: Add dedication via RSVP submission
  await db.addRsvp(testEventId, {
    name: 'Carolina Gómez',
    attending: true,
    message: '¡Feliz cumple Caro! Te quiero un montón 🎉'
  });

  const messagesAll = await db.getEventMessages(testEventId, true);
  assert.strictEqual(messagesAll.length, 2, 'Should have 2 messages in total');
  const rsvpMsg = messagesAll.find(m => m.author === 'Carolina Gómez');
  assert.ok(rsvpMsg, 'Message from RSVP should be present in event messages');
  assert.strictEqual(rsvpMsg.message, '¡Feliz cumple Caro! Te quiero un montón 🎉');
  assert.strictEqual(rsvpMsg.source, 'rsvp');
  console.log('  ✓ Test 2 Passed: RSVP dedication auto-saved to messages collection.');

  // Test 3: Moderate Message (hide & feature)
  const updatedMsg = await db.moderateEventMessage(testEventId, msg1.id, {
    approved: false,
    featured: true
  });
  assert.strictEqual(updatedMsg.approved, false);
  assert.strictEqual(updatedMsg.featured, true);

  const approvedOnly = await db.getEventMessages(testEventId, false);
  assert.strictEqual(approvedOnly.length, 1, 'Only approved messages returned when includeHidden is false');
  assert.strictEqual(approvedOnly[0].author, 'Carolina Gómez');
  console.log('  ✓ Test 3 Passed: Moderation (approve/hide and feature) functions accurately.');

  // Test 4: Delete Message
  await db.deleteEventMessage(testEventId, msg1.id);
  const afterDelete = await db.getEventMessages(testEventId, true);
  assert.strictEqual(afterDelete.length, 1, 'Should have 1 message left after delete');
  console.log('  ✓ Test 4 Passed: Delete message works properly.');

  // Test 5: Verify Files and HTML structure
  const muroHtmlPath = path.join(__dirname, '..', 'public', 'muro-mensajes.html');
  assert.ok(fs.existsSync(muroHtmlPath), 'muro-mensajes.html must exist');
  const muroContent = fs.readFileSync(muroHtmlPath, 'utf8');
  assert.ok(muroContent.includes('stage-card'), 'muro-mensajes.html must contain stage-card');
  assert.ok(muroContent.includes('localStorage'), 'muro-mensajes.html must support offline-first local storage caching');
  assert.ok(muroContent.includes('ambient-canvas'), 'muro-mensajes.html must have ambient particles canvas');
  console.log('  ✓ Test 5 Passed: muro-mensajes.html VJ screen verified.');

  const videoExporterPath = path.join(__dirname, '..', 'public', 'js', 'video-exporter.js');
  assert.ok(fs.existsSync(videoExporterPath), 'video-exporter.js must exist');
  const videoExporterContent = fs.readFileSync(videoExporterPath, 'utf8');
  assert.ok(videoExporterContent.includes('startVideoRenderingProcess'), 'video-exporter.js must define startVideoRenderingProcess');
  assert.ok(videoExporterContent.includes('captureStream'), 'video-exporter.js must use Canvas captureStream for 1080p rendering');
  console.log('  ✓ Test 6 Passed: video-exporter.js engine verified.');

  const invHtmlPath = path.join(__dirname, '..', 'public', 'invitacion.html');
  const invContent = fs.readFileSync(invHtmlPath, 'utf8');
  assert.ok(invContent.includes('slide-messages'), 'invitacion.html must contain slide-messages');
  assert.ok(invContent.includes('slide-dedication-text'), 'invitacion.html must have slide-dedication-text');
  assert.ok(invContent.includes('btn-submit-slide-msg'), 'invitacion.html must have btn-submit-slide-msg');
  assert.ok(invContent.includes('msg-tab-switcher'), 'invitacion.html must have interactive tab switcher');
  console.log('  ✓ Test 7 Passed: invitacion.html Slide 7 interactive message box & wall verified.');

  console.log('\n🎉 ALL GUEST MESSAGES & VJ STAGE TESTS PASSED SUCCESSFULLY! 💌\n');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
