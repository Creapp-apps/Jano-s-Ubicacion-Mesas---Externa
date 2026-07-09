const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkEventsTable() {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying events:', error);
    } else {
      console.log('Events row sample:', data);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

checkEventsTable();
