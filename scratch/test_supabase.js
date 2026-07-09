const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function testConnection() {
  console.log('Testing Supabase Connection & Schema...');
  
  // Test guests table
  try {
    const { data: guestsData, error: guestsError } = await supabase
      .from('guests')
      .select('*')
      .limit(1);
    
    if (guestsError) {
      console.error('Guests table check error:', guestsError.message);
    } else {
      console.log('Guests table is available. Sample data:', guestsData);
    }
  } catch (err) {
    console.error('Guests table catch error:', err.message);
  }

  // Test events table
  try {
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .limit(1);
    
    if (eventsError) {
      console.error('Events table check error:', eventsError.message);
    } else {
      console.log('Events table is available. Sample data:', eventsData);
    }
  } catch (err) {
    console.error('Events table catch error:', err.message);
  }
}

testConnection();
