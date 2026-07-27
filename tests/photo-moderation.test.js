const assert = require('assert');
const db = require('../utils/db');

async function runPhotoModerationTests() {
  console.log('🧪 Testing Photo Moderation Config & Auto-Approval...');

  const testEventId = 'default';

  // Test 1: Default moderation should be ENABLED (photo approved = false)
  console.log('- Test 1: Uploading photo with default moderation (enabled)...');
  await db.addPhoto(testEventId, { guestName: 'Juan Perez', message: 'Test Default', photoUrl: '/uploads/test1.jpg' });
  let photos = await db.getPhotos(testEventId, false);
  assert.strictEqual(photos.length, 1);
  assert.strictEqual(photos[0].approved, false, 'Photo should be pending approval by default');
  console.log('  ✓ Test 1 Passed: Moderation enabled by default.');

  // Test 2: Disable moderation (photo_moderation_enabled = false)
  console.log('- Test 2: Disabling moderation (Auto-Approve ON)...');
  await db.setConfigValue(testEventId, 'photo_moderation_enabled', 'false');
  const isEnabled = (await db.getConfigValue(testEventId, 'photo_moderation_enabled', 'true')) !== 'false';
  assert.strictEqual(isEnabled, false, 'Photo moderation should be disabled');

  // Test 3: Upload photo with moderation DISABLED -> Auto-approved!
  console.log('- Test 3: Uploading photo with moderation disabled...');
  await db.addPhoto(testEventId, { guestName: 'Maria Gomez', message: 'Test Auto Approved', photoUrl: '/uploads/test2.jpg' });
  photos = await db.getPhotos(testEventId, false);
  assert.strictEqual(photos.length, 2);
  const autoApprovedPhoto = photos.find(p => p.message === 'Test Auto Approved');
  assert.ok(autoApprovedPhoto, 'Auto-approved photo should exist');
  assert.strictEqual(autoApprovedPhoto.approved, true, 'Photo uploaded when moderation is disabled MUST be auto-approved');
  console.log('  ✓ Test 3 Passed: Photo auto-approved successfully when moderation is disabled!');

  // Test 4: Re-enable moderation -> new photo pending approval
  console.log('- Test 4: Re-enabling moderation...');
  await db.setConfigValue(testEventId, 'photo_moderation_enabled', 'true');
  await db.addPhoto(testEventId, { guestName: 'Carlos Test', message: 'Test Re-enabled', photoUrl: '/uploads/test3.jpg' });
  photos = await db.getPhotos(testEventId, false);
  const reEnabledPhoto = photos.find(p => p.message === 'Test Re-enabled');
  assert.strictEqual(reEnabledPhoto.approved, false, 'Photo should be pending when moderation is re-enabled');
  console.log('  ✓ Test 4 Passed: Moderation re-enabled successfully!');

  console.log('\n✅ ALL PHOTO MODERATION TESTS PASSED SUCCESSFULLY! 📸\n');
}

runPhotoModerationTests().catch(err => {
  console.error('❌ Photo Moderation Test Failed:', err);
  process.exit(1);
});
