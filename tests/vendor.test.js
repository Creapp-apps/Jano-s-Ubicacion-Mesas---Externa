const assert = require('assert');
const db = require('../utils/db');

async function runVendorTests() {
  console.log('🧪 Running Vendor Portal & Approval Workflow Tests...');

  const testVendorEmail = 'vendedor_test_' + Date.now() + '@mifiestapp.com';
  const testVendorPass = 'vendedor123';
  const testVendorName = 'Carlos Vendedor';

  try {
    // 1. Create Vendor Account
    const vendor = await db.createVendor(testVendorName, testVendorEmail, testVendorPass, '5491122334455');
    assert.ok(vendor, 'Vendor should be created');
    assert.strictEqual(vendor.email, testVendorEmail);
    assert.strictEqual(vendor.name, testVendorName);

    // Fetch vendors list
    const vendors = await db.getVendors();
    const foundVendor = vendors.find(v => v.id === vendor.id);
    assert.ok(foundVendor, 'Created vendor should exist in DB');

    // 2. Request a new client event (Status: pending_approval)
    const reqEventId = 'test_req_event_' + Date.now();
    const cleanId = await db.createEvent(
      reqEventId,
      'Cliente Prueba Vendedor',
      'pass123',
      'client@test.com',
      true, true, true, true,
      'Fiesta Prueba Vendedor',
      {
        vendorId: vendor.id,
        approvalStatus: 'pending_approval',
        isDemo: false
      }
    );

    assert.strictEqual(cleanId, reqEventId);

    // Verify event is in pending_approval status
    let events = await db.getEvents();
    let targetEvent = events.find(e => e.id === reqEventId);
    assert.ok(targetEvent, 'Requested event should exist');
    assert.strictEqual(targetEvent.approvalStatus, 'pending_approval');
    assert.strictEqual(targetEvent.vendorId, vendor.id);

    // 3. Superadmin approves the event
    await db.approveEvent(reqEventId);

    events = await db.getEvents();
    targetEvent = events.find(e => e.id === reqEventId);
    assert.strictEqual(targetEvent.approvalStatus, 'active', 'Approved event should have active approvalStatus');
    assert.strictEqual(targetEvent.active, true, 'Approved event should be active');

    // 4. Create an Instant DEMO Event
    const demoId = 'demo_test_' + Date.now();
    await db.createEvent(
      demoId,
      'Prospecto Demo',
      'demo123',
      '',
      true, true, true, true,
      'Demo - Mis 15 Sofía',
      {
        vendorId: vendor.id,
        approvalStatus: 'demo',
        isDemo: true,
        demoExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    );

    events = await db.getEvents();
    const demoEvent = events.find(e => e.id === demoId);
    assert.ok(demoEvent, 'Demo event should exist');
    assert.strictEqual(demoEvent.isDemo, true);
    assert.strictEqual(demoEvent.approvalStatus, 'demo');

    // Clean up test events and vendor
    await db.deleteEvent(reqEventId);
    await db.deleteEvent(demoId);
    await db.deleteVendor(vendor.id);

    console.log('✅ ALL VENDOR PORTAL & APPROVAL WORKFLOW TESTS PASSED SUCCESSFULLY! 💼');
  } catch (err) {
    console.error('❌ Vendor test failed:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  runVendorTests();
}

module.exports = { runVendorTests };
