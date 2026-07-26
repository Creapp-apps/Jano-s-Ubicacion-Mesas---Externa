const assert = require('assert');
const tandaBattle = require('../utils/tanda-battle');

async function runTandaBattleTests() {
  console.log('🧪 Running Tanda Battle & Canonical Song Tests...');

  // Test 1: Search canonical music (simulated or real API check)
  console.log('- Test 1: Searching canonical music...');
  const searchResults = await tandaBattle.searchCanonicalMusic('La Morocha');
  assert(Array.isArray(searchResults), 'Search results should be an array');
  if (searchResults.length > 0) {
    const first = searchResults[0];
    assert(first.trackId, 'Result should have trackId');
    assert(first.title, 'Result should have title');
    assert(first.artist, 'Result should have artist');
    assert(first.albumCover, 'Result should have albumCover');
  }
  console.log('  ✓ Test 1 Passed: Canonical music search works.');

  // Test 2: Nomination & Deduplication
  console.log('- Test 2: Testing nomination and deduplication...');
  const testTrack = {
    trackId: 'itunes:999999',
    title: 'Me Escapé',
    artist: 'Doble P',
    albumCover: 'https://example.com/cover.jpg',
    previewUrl: 'https://example.com/audio.mp3'
  };

  const eventId = 'test-event-tanda-' + Date.now();
  
  // First nomination
  const res1 = tandaBattle.nominateTrack(eventId, testTrack, 'Juan', 'voter-juan');
  const state1 = res1.state;
  assert.strictEqual(state1.nominations.length, 1, 'Should have 1 nomination');
  assert.strictEqual(state1.nominations[0].title, 'Me Escapé');
  assert.strictEqual(state1.nominations[0].upvotes, 1);

  // Second nomination of SAME track by another guest
  const res2 = tandaBattle.nominateTrack(eventId, testTrack, 'Maria', 'voter-maria');
  const state2 = res2.state;
  assert.strictEqual(state2.nominations.length, 1, 'Should still have 1 unique nomination (deduplicated)');
  assert.strictEqual(state2.nominations[0].nominationsCount, 2, 'Nominations count should increase to 2');
  console.log('  ✓ Test 2 Passed: Deduplication by trackId working perfectly.');

  // Test 3: Live Voting & Percentage Calculation
  console.log('- Test 3: Testing live voting & approval percentage calculation...');
  // Upvote from voter 1
  tandaBattle.voteTrack(eventId, testTrack.trackId, 'up', 'voter-1');
  // Downvote from voter 2
  const res3 = tandaBattle.voteTrack(eventId, testTrack.trackId, 'down', 'voter-2');
  const state3 = res3.state;
  
  const item = state3.nominations.find(n => n.trackId === testTrack.trackId);
  assert(item, 'Track should exist in state');
  // Upvotes: 3 (2 from nominations + voter-1), Downvotes: 1 (from voter-2) -> Total 4 votes -> 3/4 = 75%
  assert.strictEqual(item.approvalPercentage, 75, 'Approval percentage should be 75%');
  console.log('  ✓ Test 3 Passed: Live approval percentages calculated accurately.');

  // Test 4: DJ Status Control
  console.log('- Test 4: Testing DJ status control...');
  const stateClosed = tandaBattle.setTandaStatus(eventId, 'closed');
  assert.strictEqual(stateClosed.status, 'closed');
  console.log('  ✓ Test 4 Passed: DJ status control works.');

  // Test 5: Genre Voting & Custom Genres
  console.log('- Test 5: Testing genre voting, mode switching & custom genres...');
  const stateMode = tandaBattle.setBattleMode(eventId, 'genres');
  assert.strictEqual(stateMode.mode, 'genres');

  const customState = tandaBattle.addCustomGenre(eventId, 'Tango & Milonga', '🎻');
  assert(customState.genres.some(g => g.name === 'Tango & Milonga'), 'Custom genre should be added');

  const resVoted = tandaBattle.voteGenre(eventId, 'g_cumbia', 'voter-1');
  const votedState = resVoted.state;
  const cumbia = votedState.genres.find(g => g.id === 'g_cumbia');
  assert.strictEqual(cumbia.votesCount, 1, 'Cumbia vote count should be 1');

  // Test 6: Rejection Modal Trigger on Duplicate Vote
  const resDup = tandaBattle.voteGenre(eventId, 'g_cumbia', 'voter-1');
  assert.strictEqual(resDup.alreadyVoted, true, 'Duplicate vote should set alreadyVoted to true');
  assert.strictEqual(resDup.optionName, 'Cumbia 90s & Clásicos');
  // Test 7: Edit and Delete Genre Controls
  const customGenre = customState.genres.find(g => g.name === 'Tango & Milonga');
  assert(customGenre, 'Custom genre should be found for editing');

  const editedState = tandaBattle.editCustomGenre(eventId, customGenre.id, 'Milonga & Tango Porteño', '💃');
  const editedGenre = editedState.genres.find(g => g.id === customGenre.id);
  assert.strictEqual(editedGenre.name, 'Milonga & Tango Porteño');
  assert.strictEqual(editedGenre.icon, '💃');

  const deletedState = tandaBattle.deleteCustomGenre(eventId, customGenre.id);
  assert(!deletedState.genres.some(g => g.id === customGenre.id), 'Genre should be deleted');
  console.log('  ✓ Test 7 Passed: Edit and Delete genre controls working as expected.');

  console.log('\n✅ ALL TANDA BATTLE UNIT TESTS PASSED SUCCESSFULLY! 🎵\n');
}

runTandaBattleTests().catch(err => {
  console.error('❌ Tanda Battle Unit Tests Failed:', err);
  process.exit(1);
});
