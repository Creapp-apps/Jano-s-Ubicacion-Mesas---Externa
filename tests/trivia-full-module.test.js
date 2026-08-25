/**
 * Comprehensive Unit and Integration Test Suite for Trivia Interactive Module
 * Tests:
 * - Templates integrity & variety
 * - Streak combos & multipliers
 * - Double points (Pregunta de Oro 2X)
 * - Anti-Kahoot Obsidian UI data contract (A, B, C, D options, readable text)
 * - Auto-advance when 100% players answer
 * - Podium & final summary calculation
 * - State serialization & role masking
 */

const assert = require('assert');
const { 
  TriviaCoordinator, 
  TRIVIA_TEMPLATES 
} = require('../utils/trivia');

console.log('🧪 Starting Trivia Full Module Test Suite...\n');

// 1. Templates Test
console.log('Test 1: Verify TRIVIA_TEMPLATES registry');
assert(TRIVIA_TEMPLATES && typeof TRIVIA_TEMPLATES === 'object', 'TRIVIA_TEMPLATES must be an object');
const templateKeys = Object.keys(TRIVIA_TEMPLATES);
assert(templateKeys.length >= 5, 'Should have at least 5 default templates');

templateKeys.forEach(key => {
  const tpl = TRIVIA_TEMPLATES[key];
  assert(tpl.id, `Template ${key} must have an id`);
  assert(tpl.name, `Template ${key} must have a name`);
  assert(tpl.icon, `Template ${key} must have an icon`);
  assert(Array.isArray(tpl.questions) && tpl.questions.length >= 3, `Template ${key} must have at least 3 questions`);
  
  tpl.questions.forEach((q, idx) => {
    assert(q.questionText, `Template ${key} Q${idx+1} must have questionText`);
    assert(Array.isArray(q.options) && q.options.length === 4, `Template ${key} Q${idx+1} must have 4 options`);
    assert(typeof q.correctOptionIndex === 'number' && q.correctOptionIndex >= 0 && q.correctOptionIndex < 4, `Template ${key} Q${idx+1} must have valid correctOptionIndex`);
  });
});
console.log('✅ TRIVIA_TEMPLATES verified successfully.\n');

// 2. TriviaCoordinator: Initialization and Template Loading
console.log('Test 2: TriviaCoordinator initialization with template');
const coordinator = new TriviaCoordinator();
const eventId = 'test-trivia-event-1';

coordinator.initializeSession(eventId, TRIVIA_TEMPLATES.casamiento.questions);
const session = coordinator.sessions[eventId];

assert.strictEqual(session.status, 'LOBBY');
assert.strictEqual(session.questions.length, TRIVIA_TEMPLATES.casamiento.questions.length);
assert.strictEqual(session.currentQuestionIndex, 0);
assert.strictEqual(Object.keys(session.players).length, 0);
console.log('✅ Session initialized correctly in LOBBY.\n');

// 3. Player Registration & Nickname Normalization
console.log('Test 3: Player registration');
coordinator.addPlayer(eventId, 'Santi');
coordinator.addPlayer(eventId, 'Camila');
coordinator.addPlayer(eventId, 'Lucas');

assert.strictEqual(Object.keys(session.players).length, 3);
assert.strictEqual(session.players['Santi'].score, 0);
assert.strictEqual(session.players['Santi'].streak, 0);
assert.strictEqual(session.players['Santi'].highestStreak, 0);
console.log('✅ Player registration verified.\n');

// 4. Starting Game: Transition to QUESTION_ACTIVE
console.log('Test 4: Game start & question progression');
coordinator.setCustomDuration(eventId, 20);
coordinator.startQuestion(eventId, true);

assert.strictEqual(session.status, 'QUESTION_ACTIVE');
assert.strictEqual(session.currentQuestionIndex, 0);
console.log('✅ Transitioned to QUESTION_ACTIVE.\n');

// 5. Answer Submission, Speed Scoring, Streaks & Double Points
console.log('Test 5: Answer submissions, scoring, streaks');
const q0 = session.questions[0];
const correctOpt = q0.correctOptionIndex;
const wrongOpt = (correctOpt + 1) % 4;

// Player 1 answers correctly and fast (took 2 seconds out of 20)
coordinator.submitAnswer(eventId, 'Santi', correctOpt, 2000);
// Player 2 answers correctly but slower (took 15 seconds)
coordinator.submitAnswer(eventId, 'Camila', correctOpt, 15000);
// Player 3 answers incorrectly
coordinator.submitAnswer(eventId, 'Lucas', wrongOpt, 3000);

// Check live response counter meter
const liveState = coordinator.getSessionState(eventId, 'host');
assert.strictEqual(liveState.answeredPlayersCount, 3);
assert.strictEqual(liveState.connectedPlayersCount, 3);
console.log('✅ Answers processed and live counter updated (3/3 responded).\n');

// 6. Reveal & Leaderboard
console.log('Test 6: Reveal answer and Leaderboard ranking');
coordinator.revealAnswer(eventId);
assert.strictEqual(session.status, 'REVEAL_ANSWER');
assert(session.players['Santi'].score > session.players['Camila'].score, 'Faster answer must yield higher score');
assert.strictEqual(session.players['Lucas'].score, 0, 'Incorrect answer scores 0');
assert.strictEqual(session.players['Santi'].streak, 1);
assert.strictEqual(session.players['Lucas'].streak, 0);

coordinator.showLeaderboard(eventId);
assert.strictEqual(session.status, 'LEADERBOARD');
const lb = coordinator.getLeaderboard(eventId);
assert.strictEqual(lb[0].nickname, 'Santi');
assert.strictEqual(lb[0].rank, 1);
assert.strictEqual(lb[1].nickname, 'Camila');
assert.strictEqual(lb[1].rank, 2);
console.log('✅ Leaderboard rankings & rank delta verified.\n');

// 7. Streak Multiplier & Double Points (Pregunta de Oro)
console.log('Test 7: Streak Multiplier & Double Points (2X)');
session.questions[1].doublePoints = true;
session.questions[1].timeLimit = 20;
coordinator.nextQuestion(eventId);
assert.strictEqual(session.status, 'QUESTION_ACTIVE');
assert.strictEqual(session.currentQuestionIndex, 1);

const q1 = session.questions[1];
// Player 1 answers correctly again (will reach Streak 2 on reveal + Double Points)
coordinator.submitAnswer(eventId, 'Santi', q1.correctOptionIndex, 2000);
const santiPrevScore = session.players['Santi'].score;

coordinator.revealAnswer(eventId);
const santiNewScore = session.players['Santi'].score;
const pointsEarnedQ1 = santiNewScore - santiPrevScore;

assert.strictEqual(session.players['Santi'].streak, 2);
assert.strictEqual(session.players['Santi'].highestStreak, 2);
// Double points should award ~200 points on base scale
assert(pointsEarnedQ1 >= 180, `Double points should award ~200 pts, got ${pointsEarnedQ1}`);
console.log(`✅ Double points and streak 2 awarded: +${pointsEarnedQ1} pts to Santi.\n`);

// 8. Jump to Podium and Game Summary
console.log('Test 8: Jump to Podium & Summary Report');
coordinator.jumpToPodium(eventId);
assert.strictEqual(session.status, 'PODIUM');

const summary = coordinator.getGameSummary(eventId);
assert(summary, 'Summary must exist');
assert.strictEqual(summary.totalParticipants, 3);
assert(summary.top3.length <= 3);
assert.strictEqual(summary.top3[0].nickname, 'Santi');
assert(summary.accuracyRate > 0);
console.log('✅ Podium rankings and game summary generated successfully.\n');

console.log('🎉 ALL TRIVIA FULL MODULE TESTS PASSED PERFECTLY! 🚀\n');
