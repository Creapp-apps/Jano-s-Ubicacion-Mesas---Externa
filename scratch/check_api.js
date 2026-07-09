const db = require('../utils/db');

async function run() {
  console.log('Testing api/admin/guests directly...');
  try {
    const eventId = 'test_api_guests';
    // Clear any existing test event
    await db.deleteEvent(eventId);
    
    // Create new event
    await db.createEvent(
      eventId,
      'Test Client',
      'my-password',
      'test@example.com',
      true,
      true,
      true
    );
    
    console.log('Event created.');
    
    // Check what getGuests returns initially
    const initialGuests = await db.getGuests(eventId);
    console.log('db.getGuests returns:', initialGuests);
    
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

run();
