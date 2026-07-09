// Load environment variables
require('dotenv').config();

const { sendWelcomeEmail } = require('../utils/email');

async function runEmailTest() {
  console.log('--- Testing Resend Email Integration ---');
  console.log('RESEND_API_KEY present:', !!process.env.RESEND_API_KEY);
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM || 'onboarding@resend.dev');

  const testEmail = 'creapp.ar+combodigital@gmail.com'; // Authorized sandbox recipient
  const testClient = 'Cliente de Prueba Resend';
  const testId = 'boda-prueba-resend';
  const testPass = 'segura1234';

  console.log(`Sending test welcome email to ${testEmail}...`);
  const result = await sendWelcomeEmail(testEmail, testClient, testId, testPass);

  console.log('Result:', result);
  
  if (result.success) {
    if (result.simulated) {
      console.log('SUCCESS: Simulated email send completed (no API key configured).');
    } else {
      console.log(`SUCCESS: Email sent successfully! Message ID: ${result.messageId}`);
    }
  } else {
    console.error('FAILED: Email send failed:', result.error);
    process.exit(1);
  }
}

runEmailTest().catch(err => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});
