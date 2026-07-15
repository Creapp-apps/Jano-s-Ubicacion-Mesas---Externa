const assert = require('assert');
const { TriviaCoordinator } = require('../utils/trivia');

function testCoordinator() {
  console.log('Running Trivia Coordinator tests...');
  const coordinator = new TriviaCoordinator();
  coordinator.initializeSession('default', [
    { questionText: 'Q1', options: ['A', 'B'], correctOptionIndex: 0, timeLimit: 10 }
  ]);
  
  const state = coordinator.getSessionState('default');
  assert.strictEqual(state.status, 'LOBBY');
  assert.strictEqual(state.players.length, 0);
  
  coordinator.addPlayer('default', 'Sebas');
  assert.strictEqual(coordinator.getSessionState('default').players.some(p => p.nickname === 'Sebas'), true);
  console.log('Trivia Coordinator tests passed!');
}
testCoordinator();
