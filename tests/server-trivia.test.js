process.env.VERCEL = 'true';
const assert = require('assert');
const app = require('../server');
const http = require('http');

async function runTests() {
  console.log('Running integration tests for Trivia server endpoints using native fetch...');

  // Start the server on a dynamic random port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Test POST /api/trivia/join
    const joinRes = await fetch(`${baseUrl}/api/trivia/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'default', nickname: 'TestUser' })
    });
    
    assert.strictEqual(joinRes.status, 200);
    const joinData = await joinRes.json();
    assert.strictEqual(joinData.success, true);

    // 2. Test POST /api/trivia/respond
    const respondRes = await fetch(`${baseUrl}/api/trivia/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: 'default', nickname: 'TestUser', optionIndex: 0, timeTakenMs: 1200 })
    });
    assert.strictEqual(respondRes.status, 200);
    const respondData = await respondRes.json();
    assert.strictEqual(respondData.success, false); // Because question is not active in default session yet, returns false. This is correct!

    // 3. Test GET /api/trivia/leaderboard
    const lbRes = await fetch(`${baseUrl}/api/trivia/leaderboard?event=default`);
    assert.strictEqual(lbRes.status, 200);
    const lbData = await lbRes.json();
    assert.ok(Array.isArray(lbData.leaderboard));

    console.log('Trivia server endpoints verified successfully!');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('Integration tests failed:', err);
  process.exit(1);
});
