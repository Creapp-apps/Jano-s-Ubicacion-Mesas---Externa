const assert = require('assert');
const { sendWelcomeEmail } = require('../utils/email');

async function runEmailTests() {
  console.log('🧪 Testing Onboarding Email Template Updates...');

  // Test 1: Full Plan (All services enabled)
  console.log('- Test 1: Testing welcome email with full services...');
  const resFull = await sendWelcomeEmail('test@example.com', 'Juan Perez', 'event123', 'pass123', 'Boda Juan & Maria', 'noche', {
    serviceTables: true,
    servicePhotos: true,
    serviceInvitation: true,
    serviceTrivia: true
  });

  assert.strictEqual(resFull.success, true, 'Email send/simulation should succeed');

  // Test 2: Single Service (Only Invitation)
  console.log('- Test 2: Testing welcome email with only Invitation service...');
  const resInvitationOnly = await sendWelcomeEmail('test2@example.com', 'Maria Lopez', 'event456', 'pass456', 'XV Maria', 'noche', {
    serviceTables: false,
    servicePhotos: false,
    serviceInvitation: true,
    serviceTrivia: false
  });

  assert.strictEqual(resInvitationOnly.success, true, 'Email send/simulation should succeed');

  console.log('  ✓ All Onboarding Email Tests Passed Successfully! 📧');
}

runEmailTests().catch(err => {
  console.error('❌ Email Test Failed:', err);
  process.exit(1);
});
