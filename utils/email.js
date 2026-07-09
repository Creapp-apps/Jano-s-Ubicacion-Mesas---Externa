const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

/**
 * Sends a welcome email to the registered client.
 * @param {string} clientEmail 
 * @param {string} clientName 
 * @param {string} eventId 
 * @param {string} password 
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, simulated?: boolean}>}
 */
async function sendWelcomeEmail(clientEmail, clientName, eventId, password) {
  if (!clientEmail) {
    console.log('[EMAIL] No client email provided, skipping welcome email.');
    return { success: false, error: 'No client email provided' };
  }

  const subject = `¡Tu Combo Digital para "${clientName}" está listo! 🚀`;

  // HTML template matching Jano's / Combo Digital premium aesthetic
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; color: #1a202c;">
      <div style="text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="color: #d4af37; font-size: 24px; margin: 0; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">Combo Digital</h1>
        <p style="font-size: 14px; color: #718096; margin: 5px 0 0 0;">Gestión de Mesas y Eventos Premium</p>
      </div>
      
      <div style="line-height: 1.6; font-size: 16px;">
        <p>Hola <strong>${clientName}</strong>,</p>
        
        <p>¡Queremos darte la bienvenida a tu <strong>Combo Digital</strong>! Ya hemos dado de alta tu evento en nuestro sistema y está listo para ser configurado.</p>
        
        <div style="background-color: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #2d3748; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">🔑 Datos de Acceso al Panel de Administración</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 6px 0; color: #718096; width: 40%;"><strong>URL de Administración:</strong></td>
              <td style="padding: 6px 0;"><a href="https://mesas.combodigital.com.ar/admin?event=${eventId}" style="color: #3182ce; text-decoration: none; font-weight: 600;">Acceder al Panel</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #718096;"><strong>ID de Evento:</strong></td>
              <td style="padding: 6px 0; font-family: monospace; font-size: 15px; color: #2d3748;"><strong>${eventId}</strong></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #718096;"><strong>Contraseña de Acceso:</strong></td>
              <td style="padding: 6px 0; font-family: monospace; font-size: 15px; color: #2d3748;"><strong>${password}</strong></td>
            </tr>
          </table>
        </div>

        <p>Desde el panel de administración podrás:</p>
        <ul style="padding-left: 20px; color: #4a5568;">
          <li style="margin-bottom: 8px;">Cargar la lista de invitados desde un archivo de Excel para asignar las mesas.</li>
          <li style="margin-bottom: 8px;">Moderar en tiempo real las fotos enviadas por los invitados a la pantalla gigante.</li>
          <li style="margin-bottom: 8px;">Personalizar el banner de bienvenida y la música del evento.</li>
        </ul>

        <p style="margin-top: 25px;">Para tus invitados, el enlace de acceso directo al localizador de mesas es:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="https://mesas.combodigital.com.ar/?event=${eventId}" style="background-color: #d4af37; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 30px; font-weight: 600; display: inline-block; box-shadow: 0 4px 6px rgba(212, 175, 55, 0.2);">Ver Buscador de Mesas (Invitados)</a>
        </div>
      </div>
      
      <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px; text-align: center; font-size: 12px; color: #a0aec0;">
        <p>Este es un correo automático de bienvenida. Por favor, no respondas a este mensaje.</p>
        <p>&copy; 2026 Combo Digital. Todos los derechos reservados.</p>
      </div>
    </div>
  `;

  if (!RESEND_API_KEY) {
    console.log('[EMAIL] Resend API Key is missing. Skipping real send.');
    console.log(`[EMAIL] Simulated Welcome Email for ${clientEmail}:`, { subject, eventId, password });
    return { success: true, simulated: true };
  }

  // Use fetch if available, else fallback to native https module
  if (typeof fetch === 'function') {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [clientEmail],
          subject: subject,
          html: html
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('[EMAIL] Error response from Resend API:', data);
        return { success: false, error: data.message || 'Error from Resend service' };
      }

      console.log('[EMAIL] Welcome email sent successfully (via fetch):', data.id);
      return { success: true, messageId: data.id };
    } catch (error) {
      console.error('[EMAIL] Exception sending email (via fetch):', error);
      return { success: false, error: error.message };
    }
  } else {
    // Fallback using Node.js https module
    return new Promise((resolve) => {
      const payload = JSON.stringify({
        from: EMAIL_FROM,
        to: [clientEmail],
        subject: subject,
        html: html
      });

      const options = {
        hostname: 'api.resend.com',
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              console.log('[EMAIL] Welcome email sent successfully (via https):', parsed.id);
              resolve({ success: true, messageId: parsed.id });
            } else {
              console.error('[EMAIL] Error response from Resend API (via https):', parsed);
              resolve({ success: false, error: parsed.message || 'Error from Resend service' });
            }
          } catch (e) {
            resolve({ success: false, error: 'Failed to parse response body' });
          }
        });
      });

      req.on('error', (e) => {
        console.error('[EMAIL] Network error sending email (via https):', e);
        resolve({ success: false, error: e.message });
      });

      req.write(payload);
      req.end();
    });
  }
}

module.exports = {
  sendWelcomeEmail
};
