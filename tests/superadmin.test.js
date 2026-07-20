const assert = require('assert');
const http = require('http');

// Force local mode for tests so we don't depend on live database migrations
process.env.FORCE_LOCAL = 'true';

const db = require('../utils/db');
const app = require('../server');

// Helper to make HTTP requests in tests
function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let parsedBody = null;
        if (data) {
          try {
            parsedBody = JSON.parse(data);
          } catch (e) {
            parsedBody = data;
          }
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsedBody,
          rawBody: data
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('Running Superadmin & Event Validation Tests...');
  let server;
  const port = 4999;

  try {
    // -------------------------------------------------------------
    // Part 1: Database Adapter Tests
    // -------------------------------------------------------------
    console.log('\n--- Part 1: Database Adapter ---');
    const testId = 'test-event-super';
    
    // Cleanup if exists
    try { await db.deleteEvent(testId); } catch(e) {}

    console.log('- Test event creation');
    await db.createEvent(testId, 'Cliente de Prueba', '', 'testemail@example.com', true, true, true, true, 'Boda de Prueba Decoupled');
    
    console.log('- Test event validation (should be active by default)');
    const isValidDefault = await db.isEventValid(testId);
    assert.strictEqual(isValidDefault, true, 'Created event must be active');

    console.log('- Test getEvents list');
    const events = await db.getEvents();
    const createdEvent = events.find(e => e.id === testId);
    assert.ok(createdEvent, 'Created event must be in getEvents list');
    assert.strictEqual(createdEvent.clientName, 'Cliente de Prueba');
    assert.strictEqual(createdEvent.eventName, 'Boda de Prueba Decoupled');
    assert.strictEqual(createdEvent.clientEmail, 'testemail@example.com', 'clientEmail must be saved correctly');

    console.log('- Test toggling event to inactive');
    await db.toggleEvent(testId, false);
    const isValidInactive = await db.isEventValid(testId);
    assert.strictEqual(isValidInactive, false, 'Inactive event must return false on validation');

    console.log('- Test toggling event back to active');
    await db.toggleEvent(testId, true);
    const isValidActiveAgain = await db.isEventValid(testId);
    assert.strictEqual(isValidActiveAgain, true, 'Reactived event must return true');

    console.log('- Test event creation with password');
    const testWithPassId = 'test-pass-event';
    try { await db.deleteEvent(testWithPassId); } catch(e) {}
    await db.createEvent(testWithPassId, 'Evento con Contraseña', 'cliente123');
    
    console.log('- Test validating correct password');
    const isCorrect = await db.validateEventPassword(testWithPassId, 'cliente123');
    assert.strictEqual(isCorrect, true, 'Correct password must validate');

    console.log('- Test validating incorrect password');
    const isIncorrect = await db.validateEventPassword(testWithPassId, 'wrongpass');
    assert.strictEqual(isIncorrect, false, 'Incorrect password must fail');
    
    console.log('- Test event creation with custom services');
    const testCustomServicesId = 'test-services-event';
    try { await db.deleteEvent(testCustomServicesId); } catch(e) {}
    await db.createEvent(testCustomServicesId, 'Custom Services Event', 'mypass', 'custom@example.com', true, false, true);
    
    const eventsList = await db.getEvents();
    const customEvent = eventsList.find(e => e.id === testCustomServicesId);
    assert.ok(customEvent, 'Custom services event must be in list');
    assert.strictEqual(customEvent.serviceTables, true, 'serviceTables should be true');
    assert.strictEqual(customEvent.servicePhotos, false, 'servicePhotos should be false');
    assert.strictEqual(customEvent.serviceInvitation, true, 'serviceInvitation should be true');
    
    // Clean up
    await db.deleteEvent(testCustomServicesId);
    await db.deleteEvent(testWithPassId);

    // -------------------------------------------------------------
    // Part 2: API & Middleware Tests
    // -------------------------------------------------------------
    console.log('\n--- Part 2: API & Middleware ---');
    
    // Start Express server on a test port
    server = app.listen(port);
    console.log(`- Test server started on port ${port}`);

    // Test API: Check Unauthorized
    console.log('- Test unauthorized access to events endpoint');
    const unauthRes = await request({
      hostname: 'localhost',
      port: port,
      path: '/api/superadmin/events',
      method: 'GET'
    });
    assert.strictEqual(unauthRes.statusCode, 401, 'Events endpoint must return 401 without auth');

    // Test API: Superadmin Login
    console.log('- Test superadmin login with correct password');
    const loginRes = await request({
      hostname: 'localhost',
      port: port,
      path: '/api/superadmin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { password: 'mifiestapp-superadmin' });
    
    assert.strictEqual(loginRes.statusCode, 200, 'Login should succeed');
    assert.ok(loginRes.body.success, 'Login success field must be true');

    // Extract session cookie
    const setCookie = loginRes.headers['set-cookie'];
    assert.ok(setCookie, 'Login response must set a cookie');
    const sessionCookie = setCookie[0].split(';')[0];
    
    // Test API: Check Session (Authorized)
    console.log('- Test session check endpoint with valid session');
    const checkRes = await request({
      hostname: 'localhost',
      port: port,
      path: '/api/superadmin/check',
      method: 'GET',
      headers: { 'Cookie': sessionCookie }
    });
    assert.strictEqual(checkRes.statusCode, 200);
    assert.strictEqual(checkRes.body.loggedIn, true, 'Should return loggedIn: true');

    // Test API: Get Events (Authorized)
    console.log('- Test authenticated getEvents API');
    const getEventsRes = await request({
      hostname: 'localhost',
      port: port,
      path: '/api/superadmin/events',
      method: 'GET',
      headers: { 'Cookie': sessionCookie }
    });
    assert.strictEqual(getEventsRes.statusCode, 200);
    assert.ok(Array.isArray(getEventsRes.body));
    assert.ok(getEventsRes.body.some(e => e.id === testId));

    // Test API: Create Event
    console.log('- Test creating event via API');
    const apiTestId = 'test-api-event';
    // Cleanup if exists
    try { await db.deleteEvent(apiTestId); } catch(e) {}

    const createRes = await request({
      hostname: 'localhost',
      port: port,
      path: '/api/superadmin/events',
      method: 'POST',
      headers: { 
        'Cookie': sessionCookie,
        'Content-Type': 'application/json'
      }
    }, { 
      id: apiTestId, 
      clientName: 'API Test Client', 
      eventName: 'API Test Event Name',
      password: 'cliente-api-pass', 
      clientEmail: 'api-client@example.com' 
    });
    
    assert.strictEqual(createRes.statusCode, 200);
    assert.strictEqual(createRes.body.success, true);
    assert.strictEqual(createRes.body.eventId, apiTestId);

    // Verify clientEmail and eventName saved in DB via API
    const dbEvent = (await db.getEvents()).find(e => e.id === apiTestId);
    assert.strictEqual(dbEvent.clientEmail, 'api-client@example.com', 'Client email must be saved correctly via API');
    assert.strictEqual(dbEvent.eventName, 'API Test Event Name', 'Event name must be saved correctly via API');

    // Test API: Client Admin Login
    console.log('- Test client admin login with correct password');
    const clientLoginRes = await request({
      hostname: 'localhost',
      port: port,
      path: `/api/admin/login?event=${apiTestId}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { password: 'cliente-api-pass' });
    
    assert.strictEqual(clientLoginRes.statusCode, 200, 'Client login should succeed');
    assert.ok(clientLoginRes.headers['set-cookie'], 'Client login must set a cookie');
    const clientCookie = clientLoginRes.headers['set-cookie'][0].split(';')[0];
    assert.ok(clientCookie.startsWith(`admin_session_${apiTestId}=`), 'Client session cookie name must match the event');

    console.log('- Test client admin login with incorrect password');
    const clientLoginFailRes = await request({
      hostname: 'localhost',
      port: port,
      path: `/api/admin/login?event=${apiTestId}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { password: 'wrong-pass' });
    assert.strictEqual(clientLoginFailRes.statusCode, 401, 'Incorrect client login must fail');

    // Test API: Client Admin Login by Email
    console.log('- Test client admin login by email with correct credentials');
    const clientLoginEmailRes = await request({
      hostname: 'localhost',
      port: port,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'api-client@example.com', password: 'cliente-api-pass' });
    
    assert.strictEqual(clientLoginEmailRes.statusCode, 200, 'Client login by email should succeed');
    assert.strictEqual(clientLoginEmailRes.body.success, true);
    assert.strictEqual(clientLoginEmailRes.body.eventId, apiTestId, 'Returned eventId must match');
    assert.ok(clientLoginEmailRes.headers['set-cookie'], 'Client login by email must set cookie');
    const clientEmailCookie = clientLoginEmailRes.headers['set-cookie'][0].split(';')[0];
    assert.ok(clientEmailCookie.startsWith(`admin_session_${apiTestId}=`), 'Cookie name must match event ID');

    console.log('- Test client admin login by email with incorrect credentials');
    const clientLoginEmailFailRes = await request({
      hostname: 'localhost',
      port: port,
      path: '/api/admin/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'api-client@example.com', password: 'wrong-password' });
    assert.strictEqual(clientLoginEmailFailRes.statusCode, 401, 'Incorrect credentials must fail');

    console.log('- Test authenticated login redirection to event.html');
    const authLoginRedirectRes = await request({
      hostname: 'localhost',
      port: port,
      path: `/login?event=${apiTestId}`,
      method: 'GET',
      headers: { 'Cookie': clientEmailCookie }
    });
    assert.strictEqual(authLoginRedirectRes.statusCode, 302, 'Should return 302 redirect for logged in admin');
    assert.ok(authLoginRedirectRes.headers.location.includes('/event.html'), 'Should redirect to event.html');


    // Test Middleware: Validate event routing (Active event)
    console.log('- Test page routing for active event (should serve landing page)');
    const activeRouteRes = await request({
      hostname: 'localhost',
      port: port,
      path: `/?event=${apiTestId}`,
      method: 'GET'
    });
    // Since we're asking for standard HTML, it should return 200 OK
    assert.strictEqual(activeRouteRes.statusCode, 200, 'Active event pages should return 200');

    // Test Middleware: Validate event routing (Deactivated event)
    console.log('- Test page routing for deactivated event (should redirect to inactive page)');
    // Deactivate it
    await db.toggleEvent(apiTestId, false);
    
    const inactiveRouteRes = await request({
      hostname: 'localhost',
      port: port,
      path: `/?event=${apiTestId}`,
      method: 'GET'
    });
    // Should be redirected to /inactive.html?event=...
    assert.strictEqual(inactiveRouteRes.statusCode, 302, 'Deactivated event pages must redirect');
    assert.ok(inactiveRouteRes.headers.location.includes('/inactive.html'));

    // Test API validation block: Deactivated event API requests should return 403
    console.log('- Test API block for deactivated event');
    const apiBlockedRes = await request({
      hostname: 'localhost',
      port: port,
      path: `/api/guests/search?event=${apiTestId}&q=Pedro`,
      method: 'GET'
    });
    assert.strictEqual(apiBlockedRes.statusCode, 403, 'API requests for deactivated events must return 403');
    assert.strictEqual(apiBlockedRes.body.error, 'El Combo Digital ha expirado o no está activo.');

    // Test API: Client admin logout clears session
    console.log('- Test client admin logout clears session cookie');
    const clientLogoutRes = await request({
      hostname: 'localhost',
      port: port,
      path: `/api/admin/logout?event=${apiTestId}`,
      method: 'POST'
    });
    assert.strictEqual(clientLogoutRes.statusCode, 200, 'Logout endpoint should return status 200');
    assert.ok(clientLogoutRes.headers['set-cookie'], 'Logout must clear cookie');
    const clearedClientCookieHeader = clientLogoutRes.headers['set-cookie'][0];
    assert.ok(clearedClientCookieHeader.includes('Max-Age=0') || clearedClientCookieHeader.includes('Expires='), 'Cookie should be expired');
    assert.ok(clearedClientCookieHeader.includes('SameSite=Strict'), 'Cookie clearance must preserve SameSite attributes');

    // Test API: Superadmin logout clears session
    console.log('- Test superadmin logout clears session cookie');
    const superadminLogoutRes = await request({
      hostname: 'localhost',
      port: port,
      path: '/api/superadmin/logout',
      method: 'POST'
    });
    assert.strictEqual(superadminLogoutRes.statusCode, 200, 'Superadmin logout should succeed');
    assert.ok(superadminLogoutRes.headers['set-cookie'], 'Superadmin logout must clear cookie');
    const clearedSuperCookieHeader = superadminLogoutRes.headers['set-cookie'][0];
    assert.ok(clearedSuperCookieHeader.includes('Max-Age=0') || clearedSuperCookieHeader.includes('Expires='), 'Superadmin cookie should be expired');
    assert.ok(clearedSuperCookieHeader.includes('SameSite=Strict'), 'Superadmin cookie clearance must preserve SameSite attributes');

    // -------------------------------------------------------------
    // Part 3: Cleanup
    // -------------------------------------------------------------
    console.log('\n--- Part 3: Cleanup ---');
    console.log('- Delete test events');
    await db.deleteEvent(testId);
    await db.deleteEvent(apiTestId);
    
    server.close();
    console.log('\nAll Superadmin & Event Validation tests passed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\nTest failed:', error);
    if (server) server.close();
    process.exit(1);
  }
}

runTests();
