const assert = require('assert');

// Phone normalization logic
function normalizeWhatsAppNumber(phone) {
  if (!phone) return '';
  let str = String(phone).trim();
  let cleaned = str.replace(/\D/g, '');
  if (!cleaned) return '';

  // Remove leading 0 (e.g. 01112345678 -> 1112345678)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Handle Argentina area code + number (10 digits) -> prepend 549
  if (cleaned.length === 10 && !cleaned.startsWith('54')) {
    cleaned = '549' + cleaned;
  } else if (!cleaned.startsWith('54') && cleaned.length < 12) {
    cleaned = '549' + cleaned;
  }

  return cleaned;
}

function buildWhatsAppInvitationMessage(guestName, personalUrl) {
  const text = `✨ Hay momentos que se sueñan durante mucho tiempo, y finalmente llegó el mío.

Con enorme alegría quiero invitarte a celebrar mis XV años, una noche que quedará para siempre en mi corazón y que deseo compartir junto a las personas que forman parte de mi vida.

En el siguiente enlace vas a encontrar toda la información de este día tan especial:

🔗 ${personalUrl}

Tu presencia hará que esta celebración sea aún más significativa.

💖 Te espero para vivir juntos una noche inolvidable.`;
  return text;
}

console.log('Running WhatsApp Normalization & Message Tests...');

// Test 1: Argentine local formats
assert.strictEqual(normalizeWhatsAppNumber('11 1234 5678'), '5491112345678', 'Test 1 Failed: 11 1234 5678');
assert.strictEqual(normalizeWhatsAppNumber('011 1234 5678'), '5491112345678', 'Test 2 Failed: 011 1234 5678');
assert.strictEqual(normalizeWhatsAppNumber('+54 9 11 1234-5678'), '5491112345678', 'Test 3 Failed: +54 9 11 1234-5678');
assert.strictEqual(normalizeWhatsAppNumber('5491112345678'), '5491112345678', 'Test 4 Failed: 5491112345678');
assert.strictEqual(normalizeWhatsAppNumber(''), '', 'Test 5 Failed: Empty string');
assert.strictEqual(normalizeWhatsAppNumber(null), '', 'Test 6 Failed: null');

// Test 2: Message generation containing personalUrl
const message = buildWhatsAppInvitationMessage('Juan Pérez', 'https://www.mifiestapp.com.ar/invitacion?event=xvdetati&n=Juan%20P%C3%A9rez');
assert.ok(message.includes('🔗 https://www.mifiestapp.com.ar/invitacion?event=xvdetati&n=Juan%20P%C3%A9rez'), 'Message should contain the personal URL');
assert.ok(message.includes('Hay momentos que se sue\u00f1an durante mucho tiempo'), 'Message should contain intro');

// Test 3: DB Guest Phone Field Persistence
const db = require('../utils/db');
(async () => {
  const testEventId = 'xvdetati';
  try {
    await db.addGuest(testEventId, { firstName: 'SebaTestPhone', lastName: 'MazaTestPhone', table: '1', phone: '1136434314' });
    let guests = await db.getGuests(testEventId);
    assert.ok(guests.length > 0, 'Guest should be added');
    const addedGuest = guests.find(g => g.firstName === 'SebaTestPhone');
    assert.ok(addedGuest, 'Added guest found');
    assert.strictEqual(addedGuest.phone, '1136434314', 'Guest phone should be persisted');

    const guestIdx = guests.findIndex(g => g.firstName === 'SebaTestPhone');
    await db.updateGuest(testEventId, guestIdx, { firstName: 'SebaTestPhone', lastName: 'MazaTestPhone', table: '1', phone: '1199998888' });
    guests = await db.getGuests(testEventId);
    const updatedGuest = guests.find(g => g.firstName === 'SebaTestPhone');
    assert.strictEqual(updatedGuest.phone, '1199998888', 'Guest phone should be updated');

    const delIdx = guests.findIndex(g => g.firstName === 'SebaTestPhone');
    if (delIdx >= 0) {
      await db.deleteGuest(testEventId, delIdx);
    }
    console.log('All WhatsApp & DB Phone tests passed successfully!');
  } catch (err) {
    console.error('WhatsApp Test error:', err);
    process.exit(1);
  }
})();
