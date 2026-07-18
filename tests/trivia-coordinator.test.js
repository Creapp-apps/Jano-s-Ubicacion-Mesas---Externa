const assert = require('assert');
const { TriviaCoordinator } = require('../utils/trivia');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runCoordinatorTests() {
  console.log('Running TriviaCoordinator unit tests...');

  const coordinator = new TriviaCoordinator();
  const eventId = 'test-event';
  const questions = [
    { questionText: 'Q1', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 1, timeLimit: 1 },
    { questionText: 'Q2', options: ['A', 'B', 'C', 'D'], correctOptionIndex: 2, timeLimit: 1 }
  ];

  // 1. Initialize session
  coordinator.initializeSession(eventId, questions);
  let state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.status, 'LOBBY');
  assert.strictEqual(state.questionsCount, 2);

  // 2. Add players
  coordinator.addPlayer(eventId, 'Alice');
  coordinator.addPlayer(eventId, 'Bob');
  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.players.length, 2);

  // Add a fake client
  const fakeRes = { write: () => {} };
  coordinator.sessions[eventId].clients.push({ res: fakeRes, role: 'player', nickname: 'Alice' });

  // Re-initialize should keep the client and register Alice back
  coordinator.initializeSession(eventId, questions);
  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.status, 'LOBBY');
  // Check if Alice is auto-added
  const aliceExists = state.players.some(p => p.nickname === 'Alice');
  assert.ok(aliceExists, 'Alice should be preserved through client preservation');

  // Add Bob back manually for gameplay
  coordinator.addPlayer(eventId, 'Bob');

  // 3. Start question in auto mode
  // Using a timeLimit of 1 second for Q1
  coordinator.startQuestion(eventId, true);
  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.status, 'QUESTION_ACTIVE');
  assert.strictEqual(state.autoMode, true);

  // Submit answers (Alice correct, Bob incorrect)
  coordinator.submitAnswer(eventId, 'Alice', 1, 300); // correct
  coordinator.submitAnswer(eventId, 'Bob', 0, 500); // incorrect

  // Wait for automatic reveal (1s time limit + small buffer)
  console.log('Waiting for auto-reveal...');
  await sleep(1200);

  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.status, 'REVEAL_ANSWER', 'Should automatically transition to REVEAL_ANSWER');

  // Check scores
  const aliceScore = coordinator.sessions[eventId].players['Alice'].score;
  const bobScore = coordinator.sessions[eventId].players['Bob'].score;
  assert.ok(aliceScore > 0, 'Alice should have points');
  assert.strictEqual(bobScore, 0, 'Bob should have 0 points');

  // Wait for auto-leaderboard transition (occurs 6 seconds after reveal)
  console.log('Waiting for auto-leaderboard (6s)...');
  await sleep(6200);
  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.status, 'LEADERBOARD', 'Should automatically transition to LEADERBOARD');

  // Wait for auto-next-question transition (occurs 8 seconds after leaderboard)
  console.log('Waiting for auto-next-question (8s)...');
  await sleep(8200);
  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.status, 'QUESTION_ACTIVE', 'Should automatically transition to next QUESTION_ACTIVE');
  assert.strictEqual(coordinator.sessions[eventId].currentQuestionIndex, 1);

  // Answer second question (Alice correct, Bob correct)
  coordinator.submitAnswer(eventId, 'Alice', 2, 200);
  coordinator.submitAnswer(eventId, 'Bob', 2, 100);

  // Wait for Q2 auto-reveal (1s limit)
  console.log('Waiting for Q2 auto-reveal...');
  await sleep(1200);
  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.status, 'REVEAL_ANSWER');

  // Wait for Q2 auto-leaderboard (6s)
  console.log('Waiting for Q2 auto-leaderboard (6s)...');
  await sleep(6200);
  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.status, 'LEADERBOARD');

  // Wait for Q2 auto-next-question (8s) -> Should transition to PODIUM as it is the last question
  console.log('Waiting for PODIUM transition (8s)...');
  await sleep(8200);
  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.status, 'PODIUM', 'Should end at PODIUM');
  assert.strictEqual(state.autoMode, false, 'autoMode should be disabled on Podium');

  // 4. Test customDuration setting
  console.log('Testing custom duration settings...');
  coordinator.initializeSession(eventId, questions);
  coordinator.setCustomDuration(eventId, 15);
  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.customDuration, 15);

  // When starting a question, the timeLimit should reflect customDuration (15)
  coordinator.startQuestion(eventId, false);
  state = coordinator.getSessionState(eventId);
  assert.strictEqual(state.currentQuestion.timeLimit, 15);
  assert.strictEqual(state.currentQuestion.remainingTime, 15);

  // Clear timer/session to avoid background timers running
  if (coordinator.sessions[eventId] && coordinator.sessions[eventId].timerId) {
    clearTimeout(coordinator.sessions[eventId].timerId);
  }

  console.log('TriviaCoordinator automated transitions verified successfully!');
}

runCoordinatorTests().catch(err => {
  console.error('Coordinator tests failed:', err);
  process.exit(1);
});
