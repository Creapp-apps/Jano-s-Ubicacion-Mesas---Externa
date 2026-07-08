const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse target .env.local
const envPath = '/Users/sebamaza/Desktop/PROYECTOS DEV/Consultorio Alvarez/consultorio-alvarez/.env.local';
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        env[match[1]] = value;
    }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing Supabase URL or Service Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runCheck() {
    console.log("Fetching recent notifications...");
    const { data: notifications, error: err1 } = await supabase
        .from('notificaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (err1) {
        console.error("Error fetching notifications:", err1);
    } else {
        console.log("Recent notifications:", JSON.stringify(notifications, null, 2));
    }

    console.log("\nFetching recent recordatorios_log...");
    const { data: logs, error: err2 } = await supabase
        .from('recordatorios_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (err2) {
        console.error("Error fetching recordatorios_log:", err2);
    } else {
        console.log("Recent recordatorios_log:", JSON.stringify(logs, null, 2));
    }
}

runCheck();
