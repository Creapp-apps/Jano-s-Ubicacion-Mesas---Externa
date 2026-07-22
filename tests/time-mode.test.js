const assert = require('assert');

function calculateEventTimeMode(invitationEventDate) {
  let eventTimeMode = 'noche';
  if (invitationEventDate && invitationEventDate.includes('T')) {
    const timePart = invitationEventDate.split('T')[1];
    if (timePart) {
      const startHour = parseInt(timePart.split(':')[0], 10);
      if (!isNaN(startHour)) {
        if (startHour >= 6 && startHour < 18) {
          eventTimeMode = 'dia';
        } else {
          eventTimeMode = 'noche';
        }
      }
    }
  }
  return eventTimeMode;
}

function formatTimeLine(dateStr, timeEndStr = '') {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    let hours = date.getHours().toString().padStart(2, '0');
    let minutes = date.getMinutes().toString().padStart(2, '0');
    if (timeEndStr && timeEndStr.trim()) {
      return `${hours}:${minutes} a ${timeEndStr.trim()} hs`;
    }
    return `${hours}:${minutes} hs`;
  } catch (e) {
    return '';
  }
}

console.log('Running Time Mode & Range Tests...');

// Test 1: Daytime start (13:00)
assert.strictEqual(calculateEventTimeMode('2026-07-18T13:00'), 'dia', '13:00 must be DIA');
console.log('- Test 1: 13:00 is DIA - Passed');

// Test 2: Nighttime start (21:00)
assert.strictEqual(calculateEventTimeMode('2026-07-18T21:00'), 'noche', '21:00 must be NOCHE');
console.log('- Test 2: 21:00 is NOCHE - Passed');

// Test 3: Boundary 06:00 (DIA)
assert.strictEqual(calculateEventTimeMode('2026-07-18T06:00'), 'dia', '06:00 must be DIA');
console.log('- Test 3: 06:00 boundary is DIA - Passed');

// Test 4: Boundary 18:00 (NOCHE)
assert.strictEqual(calculateEventTimeMode('2026-07-18T18:00'), 'noche', '18:00 boundary is NOCHE');
console.log('- Test 4: 18:00 boundary is NOCHE - Passed');

// Test 5: Time range formatting with end time
assert.strictEqual(formatTimeLine('2026-07-18T21:00', '05:00'), '21:00 a 05:00 hs', 'Time range with end time');
console.log('- Test 5: Full time range formatting - Passed');

// Test 6: Time range formatting without end time
assert.strictEqual(formatTimeLine('2026-07-18T21:00', ''), '21:00 hs', 'Time range without end time');
console.log('- Test 6: Single start time formatting - Passed');

console.log('\nAll time-mode tests passed successfully!');
