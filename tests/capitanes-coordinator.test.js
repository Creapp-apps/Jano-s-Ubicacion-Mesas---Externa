const assert = require('assert');
const { CapitanesCoordinator } = require('../utils/capitanes');

// Mock db module
const mockDb = {
  getCapitanesConfig: async (eventId) => ({
    gameMode: 'general',
    timeLimit: 600,
    quests: [
      { id: 'q1', text: 'Quest 1', points: 100 },
      { id: 'q2', text: 'Quest 2', points: 200 }
    ]
  }),
  saveCapitanesConfig: async () => {},
  getCapitanesProgress: async (eventId) => ({}),
  saveCapitanesProgress: async () => {}
};

async function runTests() {
  console.log('Running Capitanes Coordinator Tests...');
  const coordinator = new CapitanesCoordinator(mockDb);
  const eventId = 'test-event-id';

  try {
    // 1. Initialize session
    console.log('- Test 1: Initialize session');
    await coordinator.getOrInitializeSession(eventId);
    const state = coordinator.getSessionState(eventId);
    assert.strictEqual(state.status, 'LOBBY');
    assert.strictEqual(state.gameMode, 'general');
    assert.strictEqual(state.timeLimit, 600);
    assert.strictEqual(state.quests.length, 2);
    assert.deepStrictEqual(state.progress, {});

    // 2. Start game
    console.log('- Test 2: Start game');
    coordinator.startGame(eventId);
    const playingState = coordinator.getSessionState(eventId);
    assert.strictEqual(playingState.status, 'PLAYING');
    assert.ok(playingState.stateExpiresAt > Date.now());

    // 3. Pause game
    console.log('- Test 3: Pause game');
    coordinator.pauseGame(eventId);
    const pausedState = coordinator.getSessionState(eventId);
    assert.strictEqual(pausedState.status, 'PAUSED');
    assert.ok(pausedState.pausedRemainingTime > 0);
    assert.strictEqual(pausedState.stateExpiresAt, null);

    // 4. Resume game
    console.log('- Test 4: Resume game');
    coordinator.resumeGame(eventId);
    const resumedState = coordinator.getSessionState(eventId);
    assert.strictEqual(resumedState.status, 'PLAYING');
    assert.ok(resumedState.stateExpiresAt > Date.now());

    // 5. Submit quest (by guest)
    console.log('- Test 5: Submit quest');
    const photoUrl = '/uploads/photos/my-quest.jpg';
    await coordinator.submitQuest(eventId, 'Mesa 1', 'q1', photoUrl);
    const submittedState = coordinator.getSessionState(eventId);
    assert.ok(submittedState.progress['Mesa 1']);
    assert.strictEqual(submittedState.progress['Mesa 1']['q1'].status, 'SUBMITTED');
    assert.strictEqual(submittedState.progress['Mesa 1']['q1'].photoUrl, photoUrl);

    // 6. Approve quest (by admin)
    console.log('- Test 6: Approve quest');
    await coordinator.approveQuest(eventId, 'Mesa 1', 'q1');
    const approvedState = coordinator.getSessionState(eventId);
    assert.strictEqual(approvedState.progress['Mesa 1']['q1'].status, 'APPROVED');

    // 7. Reject quest (by admin)
    console.log('- Test 7: Reject quest');
    // submit again
    await coordinator.submitQuest(eventId, 'Mesa 1', 'q2', photoUrl);
    await coordinator.rejectQuest(eventId, 'Mesa 1', 'q2');
    const rejectedState = coordinator.getSessionState(eventId);
    assert.strictEqual(rejectedState.progress['Mesa 1']['q2'].status, 'PENDING');

    // 8. Reset game
    console.log('- Test 8: Reset game');
    await coordinator.resetGame(eventId);
    const resetState = coordinator.getSessionState(eventId);
    assert.strictEqual(resetState.status, 'LOBBY');
    assert.deepStrictEqual(resetState.progress, {});

    console.log('\nAll Capitanes Coordinator tests passed successfully!');
  } catch (e) {
    console.error('\nCapitanes Coordinator test failed:', e);
    process.exit(1);
  }
}

runTests();
