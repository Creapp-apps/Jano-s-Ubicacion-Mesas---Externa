const assert = require('assert');
const awardsEngine = require('../utils/awards-engine');
const db = require('../utils/db');

async function runMobileAppTests() {
  console.log('📱 Running miFiestAPP Mobile App & Awards Engine Tests...\n');

  const testEventId = 'test_app_event_' + Date.now();

  // Test 1: Awards Engine - Initialization & Defaults
  console.log('- Test 1: Awards Engine default categories initialization');
  const initialState = await awardsEngine.getAwardsState(testEventId);
  assert(initialState.awards && initialState.awards.length >= 6, 'Should load default award categories');
  const manijaAward = initialState.awards.find(a => a.id === 'award_manija');
  assert(manijaAward, 'Default category "award_manija" should exist');
  assert.strictEqual(manijaAward.status, 'idle', 'Initial status should be idle');
  console.log('  ✓ Test 1 Passed: Default categories initialized successfully.');

  // Test 2: Setting Nominees & Real Look Avatars
  console.log('- Test 2: Setting nominees for an award category');
  const nomineesPayload = [
    { id: 'nom_sofia', name: 'Sofía Gómez', avatarUrl: '/uploads/photos/test/sofia.jpg', tableNumber: 'Mesa 4' },
    { id: 'nom_lucas', name: 'Lucas Pérez', avatarUrl: '/uploads/photos/test/lucas.jpg', tableNumber: 'Mesa 8' }
  ];
  const updatedAward = await awardsEngine.setAwardNominees(testEventId, 'award_manija', nomineesPayload);
  assert.strictEqual(updatedAward.nominees.length, 2, 'Award should have 2 nominees');
  assert.strictEqual(updatedAward.nominees[0].name, 'Sofía Gómez');
  console.log('  ✓ Test 2 Passed: Nominees assigned to category.');

  // Test 3: Starting Live Voting
  console.log('- Test 3: Starting live voting countdown');
  const votingAward = await awardsEngine.startAwardVoting(testEventId, 'award_manija', 60);
  assert.strictEqual(votingAward.status, 'voting', 'Award status should be voting');
  assert(votingAward.timerEndsAt > Date.now(), 'Timer ends timestamp should be in the future');
  console.log('  ✓ Test 3 Passed: Live voting started with countdown timer.');

  // Test 4: Casting Live Votes & Deduplication
  console.log('- Test 4: Casting votes and checking vote counts');
  await awardsEngine.voteAwardNominee(testEventId, 'award_manija', 'nom_sofia', 'voter_guest_1');
  await awardsEngine.voteAwardNominee(testEventId, 'award_manija', 'nom_sofia', 'voter_guest_2');
  await awardsEngine.voteAwardNominee(testEventId, 'award_manija', 'nom_lucas', 'voter_guest_3');

  // Voter 1 changes vote from Sofia to Lucas
  await awardsEngine.voteAwardNominee(testEventId, 'award_manija', 'nom_lucas', 'voter_guest_1');

  const stateAfterVotes = await awardsEngine.getAwardsState(testEventId);
  const awardVotes = stateAfterVotes.awards.find(a => a.id === 'award_manija');
  const sofia = awardVotes.nominees.find(n => n.id === 'nom_sofia');
  const lucas = awardVotes.nominees.find(n => n.id === 'nom_lucas');

  assert.strictEqual(sofia.votesCount, 1, 'Sofia should have 1 vote after voter 1 switched');
  assert.strictEqual(lucas.votesCount, 2, 'Lucas should have 2 votes');
  console.log('  ✓ Test 4 Passed: Live votes cast and dynamic vote switching verified.');

  // Test 5: Declaring Winner & Fanfare
  console.log('- Test 5: Declaring winner (Automatic highest votes)');
  const winnerAward = await awardsEngine.declareAwardWinner(testEventId, 'award_manija');
  assert.strictEqual(winnerAward.status, 'awarded', 'Award status should be awarded');
  assert(winnerAward.winner, 'Winner object should be defined');
  assert.strictEqual(winnerAward.winner.id, 'nom_lucas', 'Winner should be Lucas with highest votes');
  console.log('  ✓ Test 5 Passed: Winner declared accurately.');

  // Test 6: DB Guest Profiles with Look Selfie & Table
  console.log('- Test 6: DB Guest Profile registration and retrieval');
  const profilePayload = {
    name: 'Valentina Rossi',
    tableNumber: 'Mesa 12',
    avatarUrl: 'https://example.com/valentina_look.jpg',
    dietary: 'Celíaca',
    phone: '+5491136125000'
  };
  const savedProfile = await db.saveGuestProfile(testEventId, profilePayload);
  assert(savedProfile.id, 'Saved profile must have an id');
  assert.strictEqual(savedProfile.name, 'Valentina Rossi');
  assert.strictEqual(savedProfile.tableNumber, 'Mesa 12');

  const fetchedProfile = await db.getGuestProfile(testEventId, savedProfile.id);
  assert(fetchedProfile, 'Should retrieve stored profile');
  assert.strictEqual(fetchedProfile.dietary, 'Celíaca');
  console.log('  ✓ Test 6 Passed: Guest profile with look and table saved in DB.');

  // Test 7: DB Event Timeline & App Info
  console.log('- Test 7: Event Timeline & Event Info for App');
  const timeline = await db.getEventTimeline(testEventId);
  assert(Array.isArray(timeline) && timeline.length > 0, 'Should return event timeline items');

  const appInfo = await db.getEventInfoForApp(testEventId);
  assert(appInfo.location, 'App info must include location');
  assert(appInfo.gifts, 'App info must include gifts bank details');
  assert(appInfo.dressCode, 'App info must include dresscode');
  assert(appInfo.transport, 'App info must include transport notes');
  console.log('  ✓ Test 7 Passed: Event Info payload for mobile app validated.');

  console.log('\n🎉 ALL miFiestAPP MOBILE APP TESTS PASSED SUCCESSFULLY!\n');
}

runMobileAppTests().catch(err => {
  console.error('\n❌ Test Error:', err);
  process.exit(1);
});
