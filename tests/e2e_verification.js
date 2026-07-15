const http = require('http');
const { spawn } = require('child_process');
const assert = require('assert');

console.log('Starting verification test...');

// Start the server
const serverProcess = spawn('node', ['server.js'], {
  env: { ...process.env, PORT: '3005', NODE_ENV: 'test' }
});

let stdout = '';
serverProcess.stdout.on('data', (data) => {
  stdout += data.toString();
  console.log('[Server stdout]', data.toString().trim());
});

serverProcess.stderr.on('data', (data) => {
  console.error('[Server stderr]', data.toString().trim());
});

function cleanup() {
  console.log('Cleaning up server process...');
  serverProcess.kill();
}

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Wait for server to start
setTimeout(() => {
  console.log('Verifying /invitacion.html endpoint...');
  
  // Test invitacion.html loads
  const req1 = http.get('http://localhost:3005/invitacion.html', (res) => {
    assert.strictEqual(res.statusCode, 200, 'invitacion.html should return status 200');
    
    let html = '';
    res.on('data', chunk => html += chunk);
    res.on('end', () => {
      // Check HTML contains slide-5
      assert.ok(html.includes('id="slide-5"'), 'invitacion.html should contain slide-5 element');
      assert.ok(html.includes('seating-search-input'), 'invitacion.html should contain seating search input');
      assert.ok(html.includes('initSeatingLocatorModule'), 'invitacion.html should contain initSeatingLocatorModule script');
      assert.ok(html.includes('initNavigation'), 'invitacion.html should contain initNavigation script');
      console.log('✔ invitacion.html validation passed successfully!');
      
      // Test search api route
      console.log('Verifying /api/guests/search endpoint...');
      http.get('http://localhost:3005/api/guests/search?q=test&event=default', (res2) => {
        assert.strictEqual(res2.statusCode, 200, '/api/guests/search should return status 200');
        let body = '';
        res2.on('data', chunk => body += chunk);
        res2.on('end', () => {
          const guests = JSON.parse(body);
          assert.ok(Array.isArray(guests), 'Response should be a guest array');
          console.log('✔ /api/guests/search validation passed successfully!');
          
          cleanup();
          console.log('\nAll verification checks passed successfully!');
          process.exit(0);
        });
      });
    });
  });

  req1.on('error', (err) => {
    console.error('Request failed:', err);
    cleanup();
    process.exit(1);
  });
}, 3000);
