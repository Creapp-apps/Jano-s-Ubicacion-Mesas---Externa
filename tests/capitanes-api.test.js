process.env.VERCEL = 'true';
const assert = require('assert');
const app = require('../server');
const http = require('http');

async function runTests() {
  console.log('Running integration tests for Capitanes server endpoints using native fetch...');

  // Start the server on a dynamic random port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const eventId = 'default';
  // Use default session secret
  const sessionCookie = `admin_session_${eventId}=mifiestapp-default-admin-session-secret-2026_${eventId}`;

  try {
    // 0. Test GET /api/public/tables (unauthenticated)
    console.log('- Test 0: GET /api/public/tables');
    const tablesRes = await fetch(`${baseUrl}/api/public/tables?event=${eventId}`);
    assert.strictEqual(tablesRes.status, 200);
    const tablesData = await tablesRes.json();
    assert.ok(Array.isArray(tablesData));

    // 1. Test GET /api/capitanes/state (unauthenticated)
    console.log('- Test 1: GET /api/capitanes/state');
    const stateRes = await fetch(`${baseUrl}/api/capitanes/state?event=${eventId}`);
    assert.strictEqual(stateRes.status, 200);
    const stateData = await stateRes.json();
    assert.strictEqual(stateData.status, 'LOBBY');
    assert.ok(Array.isArray(stateData.quests));

    // 2. Test POST /api/capitanes/config (unauthenticated -> should fail)
    console.log('- Test 2: POST /api/capitanes/config (unauthenticated)');
    const configFailRes = await fetch(`${baseUrl}/api/capitanes/config?event=${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameMode: 'general', timeLimit: 600, quests: [] })
    });
    assert.strictEqual(configFailRes.status, 401);

    // 3. Test POST /api/capitanes/config (authenticated -> should succeed)
    console.log('- Test 3: POST /api/capitanes/config (authenticated)');
    const configSuccessRes = await fetch(`${baseUrl}/api/capitanes/config?event=${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({
        gameMode: 'general',
        timeLimit: 300,
        quests: [{ id: 'q1', text: 'Dance off with bride', points: 100 }]
      })
    });
    assert.strictEqual(configSuccessRes.status, 200);
    const configData = await configSuccessRes.json();
    assert.strictEqual(configData.success, true);

    // Verify config state update
    const stateRes2 = await fetch(`${baseUrl}/api/capitanes/state?event=${eventId}`);
    const stateData2 = await stateRes2.json();
    assert.strictEqual(stateData2.timeLimit, 300);
    assert.strictEqual(stateData2.quests[0].text, 'Dance off with bride');

    // 4. Test POST /api/capitanes/control - start game
    console.log('- Test 4: POST /api/capitanes/control (start)');
    const startRes = await fetch(`${baseUrl}/api/capitanes/control?event=${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({ action: 'start' })
    });
    assert.strictEqual(startRes.status, 200);
    const startData = await startRes.json();
    assert.strictEqual(startData.success, true);

    // Verify playing state
    const stateRes3 = await fetch(`${baseUrl}/api/capitanes/state?event=${eventId}`);
    const stateData3 = await stateRes3.json();
    assert.strictEqual(stateData3.status, 'PLAYING');

    // 5. Test POST /api/capitanes/submit (without captain assigned -> should fail 403)
    console.log('- Test 5a: POST /api/capitanes/submit (no captain assigned -> fail)');
    const submitFail1 = await fetch(`${baseUrl}/api/capitanes/submit?event=${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesa: 'Mesa 3', questId: 'q1', photoUrl: '/test.jpg', guestName: 'Crew Mate' })
    });
    assert.strictEqual(submitFail1.status, 403);

    // Now assign a captain
    console.log('- Test 5b: POST /api/capitanes/assign-captain (assign Captain Jack)');
    const assignRes = await fetch(`${baseUrl}/api/capitanes/assign-captain?event=${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({ table: 'Mesa 3', guestName: 'Captain Jack' })
    });
    assert.strictEqual(assignRes.status, 200);
    const assignData = await assignRes.json();
    assert.strictEqual(assignData.success, true);
    assert.strictEqual(assignData.captains['Mesa 3'], 'Captain Jack');

    // Test POST /api/capitanes/submit (unauthorized captain name -> should fail 403)
    console.log('- Test 5c: POST /api/capitanes/submit (wrong captain name -> fail)');
    const submitFail2 = await fetch(`${baseUrl}/api/capitanes/submit?event=${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesa: 'Mesa 3', questId: 'q1', photoUrl: '/test.jpg', guestName: 'Crew Mate' })
    });
    assert.strictEqual(submitFail2.status, 403);

    // Test POST /api/capitanes/submit (authorized captain -> should succeed)
    console.log('- Test 5d: POST /api/capitanes/submit (correct captain -> succeed)');
    const submitSuccess = await fetch(`${baseUrl}/api/capitanes/submit?event=${eventId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesa: 'Mesa 3', questId: 'q1', photoUrl: '/test.jpg', guestName: 'Captain Jack' })
    });
    assert.strictEqual(submitSuccess.status, 200);
    const submitData = await submitSuccess.json();
    assert.strictEqual(submitData.success, true);

    // Verify submission progress
    const stateRes4 = await fetch(`${baseUrl}/api/capitanes/state?event=${eventId}`);
    const stateData4 = await stateRes4.json();
    assert.ok(stateData4.progress['Mesa 3']);
    assert.strictEqual(stateData4.progress['Mesa 3']['q1'].status, 'SUBMITTED');

    // 6. Test POST /api/capitanes/control - approve quest
    console.log('- Test 6: POST /api/capitanes/control (approve)');
    const approveRes = await fetch(`${baseUrl}/api/capitanes/control?event=${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({ action: 'approve', mesa: 'Mesa 3', questId: 'q1' })
    });
    assert.strictEqual(approveRes.status, 200);
    
    // Verify approval
    const stateRes5 = await fetch(`${baseUrl}/api/capitanes/state?event=${eventId}`);
    const stateData5 = await stateRes5.json();
    assert.strictEqual(stateData5.progress['Mesa 3']['q1'].status, 'APPROVED');

    // 7. Test POST /api/capitanes/control - reset game
    console.log('- Test 7: POST /api/capitanes/control (reset)');
    const resetRes = await fetch(`${baseUrl}/api/capitanes/control?event=${eventId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': sessionCookie
      },
      body: JSON.stringify({ action: 'reset' })
    });
    assert.strictEqual(resetRes.status, 200);

    const stateRes6 = await fetch(`${baseUrl}/api/capitanes/state?event=${eventId}`);
    const stateData6 = await stateRes6.json();
    assert.strictEqual(stateData6.status, 'LOBBY');
    assert.deepStrictEqual(stateData6.progress, {});

    console.log('Capitanes server endpoints verified successfully!');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('Integration tests failed:', err);
  process.exit(1);
});
