const fs = require('fs');
const path = require('path');

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

const token = env.META_WA_ACCESS_TOKEN;
const phoneId = env.META_WA_PHONE_NUMBER_ID;
// Let's use a dummy or a real number to test.
// Let's try sending it to the phone number of the patient from our previous query: Monica (1136434314) -> Argentina: 5491136434314 or normalized 541136434314.
// Let's use 541136434314 or similar.
const targetPhone = '541136434314';

if (!token || !phoneId) {
    console.error("Error: Missing META_WA_ACCESS_TOKEN or META_WA_PHONE_NUMBER_ID");
    process.exit(1);
}

async function sendTest() {
    console.log(`Sending template "turno_confirmado" to ${targetPhone}...`);
    
    // Cuerpo: Hola {{1}}! Turno confirmado para {{2}} el día {{3}} a las {{4}} con el Dr. {{5}}... (5 params)
    const parameters = [
        { type: 'text', text: 'Monica' },
        { type: 'text', text: 'Consulta de Prueba' },
        { type: 'text', text: 'Miércoles, 24 de junio' },
        { type: 'text', text: '12:40' },
        { type: 'text', text: 'Pedro Álvarez' }
    ];

    try {
        const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: targetPhone,
                type: 'template',
                template: {
                    name: 'turno_confirmado',
                    language: { code: 'es_AR' },
                    components: [
                        {
                            type: 'body',
                            parameters: parameters
                        }
                    ]
                }
            })
        });

        const result = await response.json();
        console.log(`Status Code: ${response.status}`);
        console.log("Response:", JSON.stringify(result, null, 2));
    } catch (err) {
        console.error("Fetch Exception:", err);
    }
}

sendTest();
