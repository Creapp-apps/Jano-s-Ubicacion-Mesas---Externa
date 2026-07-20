const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';

/**
 * Sends a welcome email to the registered client.
 * @param {string} clientEmail 
 * @param {string} clientName 
 * @param {string} eventId 
 * @param {string} password 
 * @param {string} [eventName]
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, simulated?: boolean}>}
 */
async function sendWelcomeEmail(clientEmail, clientName, eventId, password, eventName = '') {
  if (!clientEmail) {
    console.log('[EMAIL] No client email provided, skipping welcome email.');
    return { success: false, error: 'No client email provided' };
  }

  // Compute baseUrl prioritizing APP_URL env.
  // If we are on a production deployment in Vercel, force our custom domain (mifiestapp.com.ar).
  // Otherwise, use VERCEL_URL if it's a Vercel preview/dev environment, defaulting to mifiestapp.com.ar.
  let baseUrl = process.env.APP_URL;
  if (!baseUrl) {
    if (process.env.VERCEL_ENV === 'production') {
      baseUrl = 'https://mifiestapp.com.ar';
    } else if (process.env.VERCEL_URL) {
      baseUrl = `https://${process.env.VERCEL_URL}`;
    } else {
      baseUrl = 'https://mifiestapp.com.ar';
    }
  }

  const displayEventName = eventName || clientName || 'tu evento';
  const subject = `¡Tu servicio de miFiestAPP para "${displayEventName}" está listo! 🚀`;

  // HTML template matching miFiestAPP premium aesthetic
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tu evento está listo</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0b0c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0b0c; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background: #141416; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
              
              <!-- Header Section -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #1b0a3a 0%, #080214 100%); padding: 40px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                  <div style="background: linear-gradient(135deg, #4a90e2, #2ecc71); display: inline-block; padding: 6px 16px; border-radius: 30px; font-weight: 700; font-size: 11px; color: #ffffff; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 15px; box-shadow: 0 0 20px rgba(74, 144, 226, 0.3);">
                    Servicio Premium Activado
                  </div>
                  <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">
                    miFiest<span style="color: #d4af37;">APP</span>
                  </h1>
                  <p style="font-size: 14px; color: #a59cb5; margin: 8px 0 0 0; font-weight: 400; letter-spacing: 0.5px;">Gestión Exclusiva de Mesas y Eventos en Vivo</p>
                </td>
              </tr>
              
              <!-- Content Body -->
              <tr>
                <td style="padding: 40px 35px 30px 35px;">
                  <p style="font-size: 17px; line-height: 1.6; color: #f3f0fa; margin-top: 0; font-weight: 500;">
                    ¡Hola, <strong>${clientName}</strong>! 👋
                  </p>
                  <p style="font-size: 15px; line-height: 1.6; color: #a59cb5; margin-bottom: 25px;">
                    Te damos la bienvenida a la experiencia digital de tu gran noche. Tu evento ha sido registrado exitosamente y ya puedes acceder a toda la configuración interactiva.
                  </p>
                  
                  <!-- Credentials Card -->
                  <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 16px; padding: 25px; margin: 30px 0;">
                    <h3 style="margin-top: 0; margin-bottom: 15px; color: #d4af37; font-size: 15px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                      🔑 Tus Datos de Acceso
                    </h3>
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="35%" style="padding: 10px 0; font-size: 14px; color: #888096; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">ID del Evento:</td>
                        <td style="padding: 10px 0; font-size: 15px; font-family: monospace; color: #ffffff; font-weight: 700; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">${eventId}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; font-size: 14px; color: #888096; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">Contraseña:</td>
                        <td style="padding: 10px 0; font-size: 15px; font-family: monospace; color: #ffffff; font-weight: 700; border-bottom: 1px solid rgba(255, 255, 255, 0.04);">${password}</td>
                      </tr>
                      <tr>
                        <td style="padding: 10px 0; font-size: 14px; color: #888096;">Acceso Panel:</td>
                        <td style="padding: 10px 0; font-size: 14px;"><a href="${baseUrl}/admin?event=${eventId}" style="color: #4a90e2; text-decoration: none; font-weight: 600;">Ingresar al Administrador &rarr;</a></td>
                      </tr>
                    </table>
                  </div>

                  <p style="font-size: 15px; line-height: 1.6; color: #f3f0fa; font-weight: 600; margin-bottom: 15px;">
                    ¿Qué puedes controlar desde tu panel?
                  </p>
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                    <tr>
                      <td valign="top" style="padding: 5px 10px 10px 0; color: #2ecc71; font-size: 16px;">✦</td>
                      <td style="padding: 5px 0 10px 0; font-size: 14.5px; line-height: 1.5; color: #a59cb5;">
                        <strong style="color: #ffffff;">Gestión de Mesas:</strong> Descarga la plantilla simplificada de Excel, sube a tus invitados y organízalos fácilmente.
                      </td>
                    </tr>
                    <tr>
                      <td valign="top" style="padding: 5px 10px 10px 0; color: #2ecc71; font-size: 16px;">✦</td>
                      <td style="padding: 5px 0 10px 0; font-size: 14.5px; line-height: 1.5; color: #a59cb5;">
                        <strong style="color: #ffffff;">Fotos en Tiempo Real:</strong> Modera las fotos enviadas por los invitados para proyectarlas en la pantalla del salón.
                      </td>
                    </tr>
                    <tr>
                      <td valign="top" style="padding: 5px 10px 10px 0; color: #2ecc71; font-size: 16px;">✦</td>
                      <td style="padding: 5px 0 10px 0; font-size: 14.5px; line-height: 1.5; color: #a59cb5;">
                        <strong style="color: #ffffff;">Trivia Interactiva:</strong> Lanza preguntas, revela respuestas correctas y proyecta el podio de ganadores en vivo.
                      </td>
                    </tr>
                  </table>

                  <!-- Guest access -->
                  <p style="font-size: 14px; line-height: 1.5; color: #888096; text-align: center; margin-bottom: 25px;">
                    Tus invitados ingresarán para buscar sus mesas y jugar con el siguiente botón:
                  </p>

                  <div align="center" style="margin-bottom: 40px;">
                    <a href="${baseUrl}/?event=${eventId}" style="background: linear-gradient(135deg, #d4af37 0%, #b8931d 100%); color: #0b0b0c; text-decoration: none; padding: 15px 30px; border-radius: 35px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 10px 20px rgba(212, 175, 55, 0.25); text-transform: uppercase; letter-spacing: 0.5px;">
                      Acceso para Invitados
                    </a>
                  </div>

                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td align="center" style="background: #0e0e10; padding: 30px; border-top: 1px solid rgba(255, 255, 255, 0.04); font-size: 12px; color: #5c5567; line-height: 1.6;">
                  <p style="margin: 0 0 8px 0;">Este es un mensaje automático de bienvenida de tu plataforma contratada.</p>
                  <p style="margin: 0 0 15px 0;">Si tienes alguna duda o necesitas soporte técnico, por favor ponte en contacto con nosotros.</p>
                  <p style="margin: 0; color: #888096; font-weight: 600;">&copy; 2026 miFiestAPP. Todos los derechos reservados.</p>
                </td>
              </tr>
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
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
