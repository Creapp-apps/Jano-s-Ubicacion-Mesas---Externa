const assert = require('assert');
const { TriviaCoordinator } = require('../utils/trivia');

function testFlow() {
  console.log('Running Trivia Flow tests...');
  const c = new TriviaCoordinator();
  c.initializeSession('default', [
    { questionText: 'Q1', options: ['A', 'B'], correctOptionIndex: 0, timeLimit: 10 }
  ]);
  c.addPlayer('default', 'Sebas');
  c.startQuestion('default');
  
  const success = c.submitAnswer('default', 'Sebas', 0, 1000); // Correct A, after 1 sec
  assert.strictEqual(success, true);
  
  c.revealAnswer('default');
  const scores = c.getLeaderboard('default');
  assert.strictEqual(scores[0].nickname, 'Sebas');
  assert.ok(scores[0].score > 0);
  console.log('Trivia Flow tests passed!');
}
testFlow();
