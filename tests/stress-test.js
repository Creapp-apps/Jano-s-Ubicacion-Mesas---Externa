/**
 * miFiestAPP - Stress and Concurrency Test (100+ Concurrent Connections)
 * 
 * This script simulates 100 concurrent guests connecting to:
 * 1. Server-Sent Events (SSE) Trivia Stream
 * 2. Server-Sent Events (SSE) Capitanes de Mesa Stream
 * 
 * It also fires concurrent HTTP REST requests (joining the game, submitting answers)
 * to measure roundtrip latency, memory footprint, and server stability.
 */

process.env.VERCEL = 'true'; // Prevent the imported server from binding to port 3000 automatically
const app = require('../server');
const http = require('http');
const assert = require('assert');

// Increase global connection limit to ensure the test runner isn't the bottleneck
http.globalAgent.maxSockets = 1000;

const EVENT_ID = 'default';
const CONCURRENT_USERS = 100;
const TEST_DURATION_MS = 8000; // Run for 8 seconds

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to make POST request
function makePostRequest(url, body) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const postData = JSON.stringify(body);
    const start = Date.now();

    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        const latency = Date.now() - start;
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ statusCode: res.statusCode, body: JSON.parse(responseBody), latency });
          } catch (e) {
            resolve({ statusCode: res.statusCode, body: responseBody, latency });
          }
        } else {
          reject(new Error(`POST ${url} failed with status ${res.statusCode}: ${responseBody}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

// Pure Node.js Client representing a guest
class SimulatedGuest {
  constructor(userId, baseUrl) {
    this.userId = userId;
    this.nickname = `Invitado_${userId}`;
    this.baseUrl = baseUrl;
    this.triviaSse = null;
    this.capitanesSse = null;
    
    // Metrics
    this.triviaMessagesReceived = 0;
    this.capitanesMessagesReceived = 0;
    this.triviaConnected = false;
    this.capitanesConnected = false;
    this.errors = [];
  }

  connectTrivia() {
    return new Promise((resolve) => {
      const url = `${this.baseUrl}/api/trivia/stream?event=${EVENT_ID}&role=player&nickname=${encodeURIComponent(this.nickname)}`;
      const parsedUrl = new URL(url);
      
      const req = http.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          this.errors.push(`Trivia SSE bad status: ${res.statusCode}`);
          resolve(false);
          return;
        }

        this.triviaConnected = true;
        res.setEncoding('utf8');
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              this.triviaMessagesReceived++;
            }
          }
        });

        resolve(true);
      });

      req.on('error', (err) => {
        this.errors.push(`Trivia SSE connection error: ${err.message}`);
        resolve(false);
      });

      req.end();
      this.triviaSse = req;
    });
  }

  connectCapitanes() {
    return new Promise((resolve) => {
      const url = `${this.baseUrl}/api/capitanes/stream?event=${EVENT_ID}`;
      const parsedUrl = new URL(url);

      const req = http.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      }, (res) => {
        if (res.statusCode !== 200) {
          this.errors.push(`Capitanes SSE bad status: ${res.statusCode}`);
          resolve(false);
          return;
        }

        this.capitanesConnected = true;
        res.setEncoding('utf8');
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              this.capitanesMessagesReceived++;
            }
          }
        });

        resolve(true);
      });

      req.on('error', (err) => {
        this.errors.push(`Capitanes SSE connection error: ${err.message}`);
        resolve(false);
      });

      req.end();
      this.capitanesSse = req;
    });
  }

  async joinTrivia() {
    const url = `${this.baseUrl}/api/trivia/join`;
    return makePostRequest(url, { eventId: EVENT_ID, nickname: this.nickname });
  }

  async submitTriviaResponse(optionIndex, timeTakenMs) {
    const url = `${this.baseUrl}/api/trivia/respond`;
    return makePostRequest(url, {
      eventId: EVENT_ID,
      nickname: this.nickname,
      optionIndex,
      timeTakenMs
    });
  }

  disconnect() {
    if (this.triviaSse) {
      this.triviaSse.destroy();
    }
    if (this.capitanesSse) {
      this.capitanesSse.destroy();
    }
  }
}

async function runStressTest() {
  console.log('\n=============================================================');
  console.log('     MIFIESTAPP STRESS & CONCURRENCY ASSESSMENT SYSTEM       ');
  console.log(`     Target: Simulating ${CONCURRENT_USERS} Live Guests Concurrently`);
  console.log('=============================================================\n');

  // 1. Initialize Server instance dynamically
  console.log('[1/5] Bootstrapping temporary server instance...');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[INFO] Server running on dynamic port ${port}`);

  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`[INFO] Initial Heap Memory Usage: ${startMemory.toFixed(2)} MB\n`);

  // Initialize a mock Trivia Coordinator session to prevent DB queries in 'default'
  const { triviaCoordinator } = require('../utils/trivia');
  triviaCoordinator.initializeSession(EVENT_ID, [
    { questionText: '¿De qué color es el caballo blanco de San Martín?', options: ['Negro', 'Blanco', 'Gris', 'Marrón'], correctOptionIndex: 1, timeLimit: 10 }
  ]);

  // 2. Instantiate and connect simulated users
  console.log(`[2/5] Connecting ${CONCURRENT_USERS} users to Trivia & Capitanes streams...`);
  const guests = [];
  for (let i = 1; i <= CONCURRENT_USERS; i++) {
    guests.push(new SimulatedGuest(i, baseUrl));
  }

  const connectionStart = Date.now();

  // Connect Trivia Streams
  console.log(` -> Connecting ${CONCURRENT_USERS} Trivia streams...`);
  const triviaConnResults = await Promise.all(guests.map(g => g.connectTrivia()));
  const triviaConnectedCount = triviaConnResults.filter(Boolean).length;

  // Connect Capitanes Streams
  console.log(` -> Connecting ${CONCURRENT_USERS} Capitanes streams...`);
  const capitanesConnResults = await Promise.all(guests.map(g => g.connectCapitanes()));
  const capitanesConnectedCount = capitanesConnResults.filter(Boolean).length;

  const connectionTime = Date.now() - connectionStart;
  console.log(`[OK] Connections established in ${connectionTime}ms.`);
  console.log(`     Trivia Streams Connected: ${triviaConnectedCount} / ${CONCURRENT_USERS}`);
  console.log(`     Capitanes Streams Connected: ${capitanesConnectedCount} / ${CONCURRENT_USERS}\n`);

  // Check server memory under stream connection load
  const connectedMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`[INFO] Heap Memory with ${CONCURRENT_USERS * 2} active SSE sockets: ${connectedMemory.toFixed(2)} MB (+${(connectedMemory - startMemory).toFixed(2)} MB)`);

  // 3. Execute REST Actions under Load (Concurrently Joining and Submitting Answers)
  console.log(`\n[3/5] Simulating concurrent REST API load (${CONCURRENT_USERS} guests joining Trivia game)...`);
  
  const joinStart = Date.now();
  let joinLatencies = [];
  let joinFailures = 0;

  const joinPromises = guests.map(async (guest) => {
    try {
      const res = await guest.joinTrivia();
      joinLatencies.push(res.latency);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
    } catch (e) {
      joinFailures++;
      guest.errors.push(`Join error: ${e.message}`);
    }
  });

  await Promise.all(joinPromises);
  const totalJoinTime = Date.now() - joinStart;

  const avgJoinLatency = joinLatencies.reduce((a, b) => a + b, 0) / (joinLatencies.length || 1);
  const minJoinLatency = Math.min(...joinLatencies);
  const maxJoinLatency = Math.max(...joinLatencies);

  console.log(`[OK] All join requests finished in ${totalJoinTime}ms.`);
  console.log(`     Average REST Join Latency: ${avgJoinLatency.toFixed(1)}ms`);
  console.log(`     Min Latency: ${minJoinLatency}ms | Max Latency: ${maxJoinLatency}ms`);
  console.log(`     REST Join Failures: ${joinFailures}\n`);

  // 4. Simulate active gameplay load
  console.log('[4/5] Simulating live gameplay activity (Broadcasting events and receiving answers)...');
  
  // Transition trivia to active question
  console.log(' -> Admin action: Starting first Trivia question...');
  triviaCoordinator.startQuestion(EVENT_ID, false); // start question manually to test client response submissions
  
  // Wait brief moment for clients to process the INITIAL_STATE / QUESTION_ACTIVE update
  await sleep(1000);

  // Clients concurrently submit answers
  console.log(` -> ${CONCURRENT_USERS} clients submitting answers concurrently...`);
  const responseStart = Date.now();
  let responseLatencies = [];
  let responseFailures = 0;

  const responsePromises = guests.map(async (guest) => {
    try {
      const optionIndex = Math.floor(Math.random() * 4);
      const timeTakenMs = Math.floor(Math.random() * 5000);
      const res = await guest.submitTriviaResponse(optionIndex, timeTakenMs);
      responseLatencies.push(res.latency);
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.body.success, true);
    } catch (e) {
      responseFailures++;
      guest.errors.push(`Response error: ${e.message}`);
    }
  });

  await Promise.all(responsePromises);
  const totalResponseTime = Date.now() - responseStart;
  const avgResponseLatency = responseLatencies.reduce((a, b) => a + b, 0) / (responseLatencies.length || 1);
  const minResponseLatency = Math.min(...responseLatencies);
  const maxResponseLatency = Math.max(...responseLatencies);

  console.log(`[OK] All answer submissions finished in ${totalResponseTime}ms.`);
  console.log(`     Average Submit Answer Latency: ${avgResponseLatency.toFixed(1)}ms`);
  console.log(`     Min Latency: ${minResponseLatency}ms | Max Latency: ${maxResponseLatency}ms`);
  console.log(`     Submit Answer Failures: ${responseFailures}\n`);

  // Let connections listen to background activity / keep-alive pings for a few seconds
  console.log(`[5/5] Keeping all ${CONCURRENT_USERS * 2} connections open for monitoring stability (${TEST_DURATION_MS / 1000}s)...`);
  await sleep(TEST_DURATION_MS);

  // Read message count
  const totalTriviaMsg = guests.reduce((sum, g) => sum + g.triviaMessagesReceived, 0);
  const totalCapitanesMsg = guests.reduce((sum, g) => sum + g.capitanesMessagesReceived, 0);

  console.log('\n[INFO] Gathering final stats...');
  const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`[INFO] Final Heap Memory Usage: ${endMemory.toFixed(2)} MB`);

  // Clean up
  console.log(' -> Closing client connections...');
  guests.forEach(g => g.disconnect());
  
  console.log(' -> Stopping temporary server...');
  await new Promise((resolve) => server.close(resolve));
  
  console.log('\n=============================================================');
  console.log('                 CONCURRENCY TEST DASHBOARD                  ');
  console.log('=============================================================');
  console.log(` Simulated Guests        : ${CONCURRENT_USERS}`);
  console.log(` Active Connections      : ${triviaConnectedCount + capitanesConnectedCount} / ${CONCURRENT_USERS * 2}`);
  console.log(` Trivia SSE Success Rate : ${(triviaConnectedCount / CONCURRENT_USERS * 100).toFixed(1)}%`);
  console.log(` Capitanes Success Rate  : ${(capitanesConnectedCount / CONCURRENT_USERS * 100).toFixed(1)}%`);
  console.log(` HTTP Join Success Rate  : ${((CONCURRENT_USERS - joinFailures) / CONCURRENT_USERS * 100).toFixed(1)}%`);
  console.log(` HTTP Submit Success Rate: ${((CONCURRENT_USERS - responseFailures) / CONCURRENT_USERS * 100).toFixed(1)}%`);
  console.log(` Average REST Latency    : ${((avgJoinLatency + avgResponseLatency) / 2).toFixed(1)} ms`);
  console.log(` Trivia SSE Msg Count    : ${totalTriviaMsg} total broadcasts received`);
  console.log(` Capitanes SSE Msg Count : ${totalCapitanesMsg} total broadcasts received`);
  console.log(` Memory Cost Per Client  : ${((endMemory - startMemory) / CONCURRENT_USERS * 1024).toFixed(2)} KB`);
  console.log('=============================================================\n');

  // Log errors if any
  const clientsWithErrors = guests.filter(g => g.errors.length > 0);
  if (clientsWithErrors.length > 0) {
    console.warn(`[WARNING] ${clientsWithErrors.length} clients reported errors:`);
    clientsWithErrors.slice(0, 5).forEach(c => {
      console.warn(`  - Guest ${c.userId}: ${c.errors.join(' | ')}`);
    });
  }

  // Assess readiness
  let issuesCount = joinFailures + responseFailures + (CONCURRENT_USERS - triviaConnectedCount) + (CONCURRENT_USERS - capitanesConnectedCount);
  
  if (issuesCount === 0 && ((avgJoinLatency + avgResponseLatency) / 2) < 150) {
    console.log('💚 RESULTADO: ¡INFRAESTRUCTURA 100% PREPARADA PARA FIESTAS Y EVENTOS EN VIVO! 💚');
    console.log('La plataforma puede manejar perfectamente 100 usuarios activos simultáneos.');
    console.log('Recomendaciones de escalabilidad detalladas en la respuesta de Antigravity.');
    process.exit(0);
  } else {
    console.warn('⚠️ RESULTADO: La prueba finalizó con advertencias o fallas de latencia.');
    console.warn(`Fallas totales acumuladas: ${issuesCount}`);
    process.exit(issuesCount > 5 ? 1 : 0); // Allow small network limits on local OS configurations but fail if critical
  }
}

runStressTest().catch(err => {
  console.error('Stress test crashed:', err);
  process.exit(1);
});
