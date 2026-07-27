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
 * @param {string} [eventTimeMode]
 * @returns {Promise<{success: boolean, messageId?: string, error?: string, simulated?: boolean}>}
 */
async function sendWelcomeEmail(clientEmail, clientName, eventId, password, eventName = '', eventTimeMode = 'noche', services = {}) {
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
  const timePhrase = eventTimeMode === 'dia' ? 'tu gran día' : 'tu gran noche';

  // Dynamic features list based on contracted services
  const hasServicesPassed = services && typeof services === 'object' && Object.keys(services).length > 0;
  
  const showInvitation = hasServicesPassed ? services.serviceInvitation !== false : true;
  const showTables = hasServicesPassed ? services.serviceTables !== false : true;
  const showPhotos = hasServicesPassed ? services.servicePhotos !== false : true;
  const showTrivia = hasServicesPassed ? services.serviceTrivia !== false : true;

  let servicesRowsHtml = '';

  if (showInvitation) {
    servicesRowsHtml += `
      <tr>
        <td valign="top" style="padding: 6px 12px 12px 0; color: #d4af37; font-size: 16px;">✦</td>
        <td style="padding: 6px 0 12px 0; font-size: 14.5px; line-height: 1.5; color: #a59cb5;">
          <strong style="color: #ffffff;">Invitación Interactiva & RSVPs:</strong> Personalizá tu tarjeta digital, cuenta regresiva, mapas de ubicación, pase de regalos (CBU/Alias) y gestioná las confirmaciones de asistencia en tiempo real.
        </td>
      </tr>
    `;
  }

  if (showTables) {
    servicesRowsHtml += `
      <tr>
        <td valign="top" style="padding: 6px 12px 12px 0; color: #d4af37; font-size: 16px;">✦</td>
        <td style="padding: 6px 0 12px 0; font-size: 14.5px; line-height: 1.5; color: #a59cb5;">
          <strong style="color: #ffffff;">Gestión de Mesas:</strong> Descargá la plantilla simplificada de Excel, cargá a tus invitados y organizá la distribución de mesas de tu evento fácilmente.
        </td>
      </tr>
    `;
  }

  if (showPhotos) {
    servicesRowsHtml += `
      <tr>
        <td valign="top" style="padding: 6px 12px 12px 0; color: #d4af37; font-size: 16px;">✦</td>
        <td style="padding: 6px 0 12px 0; font-size: 14.5px; line-height: 1.5; color: #a59cb5;">
          <strong style="color: #ffffff;">Fotos en Tiempo Real:</strong> Moderá las fotos enviadas por los invitados desde sus celulares para proyectarlas en la pantalla del salón.
        </td>
      </tr>
    `;
  }

  if (showTrivia) {
    servicesRowsHtml += `
      <tr>
        <td valign="top" style="padding: 6px 12px 12px 0; color: #d4af37; font-size: 16px;">✦</td>
        <td style="padding: 6px 0 12px 0; font-size: 14.5px; line-height: 1.5; color: #a59cb5;">
          <strong style="color: #ffffff;">Trivia Interactiva:</strong> Lanzá preguntas en vivo, revelá respuestas correctas y proyectá el podio de ganadores en tiempo real.
        </td>
      </tr>
    `;
  }

  if (!servicesRowsHtml) {
    servicesRowsHtml = `
      <tr>
        <td valign="top" style="padding: 6px 12px 12px 0; color: #d4af37; font-size: 16px;">✦</td>
        <td style="padding: 6px 0 12px 0; font-size: 14.5px; line-height: 1.5; color: #a59cb5;">
          <strong style="color: #ffffff;">Panel de Control miFiestAPP:</strong> Accedé a la configuración completa de tu evento y servicios contratados.
        </td>
      </tr>
    `;
  }

  // HTML template matching miFiestAPP premium aesthetic
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenido a miFiestAPP</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0b0c; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e1e1e6; -webkit-font-smoothing: antialiased;">
      <table width="100%" border="0" cellpadding="0" cellspacing="0" style="background-color: #0b0b0c; padding: 40px 10px;">
        <tr>
          <td align="center">
            <table width="100%" border="0" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #121214; border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
              <!-- Header -->
              <tr>
                <td align="center" style="padding: 40px 30px 25px 30px; background: linear-gradient(180deg, rgba(212, 175, 55, 0.1) 0%, rgba(18, 18, 20, 0) 100%); border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                  <img src="${baseUrl}/assets/completomain.png" alt="miFiestAPP" width="220" style="max-width: 220px; height: auto; border: 0; outline: none; text-decoration: none; display: block; margin: 0 auto 10px auto;" />
                  <p style="font-size: 12px; color: #a59cb5; margin: 0; font-weight: 500; letter-spacing: 1px; text-transform: uppercase;">Gestión Exclusiva de Mesas y Eventos en Vivo</p>
                </td>
              </tr>
              
              <!-- Content Body -->
              <tr>
                <td style="padding: 40px 35px 30px 35px;">
                  <p style="font-size: 17px; line-height: 1.6; color: #f3f0fa; margin-top: 0; font-weight: 500;">
                    ¡Hola, <strong>${clientName}</strong>! 👋
                  </p>
                  <p style="font-size: 15px; line-height: 1.6; color: #a59cb5; margin-bottom: 25px;">
                    Te damos la bienvenida a la experiencia digital de ${timePhrase}. Tu evento ha sido registrado exitosamente y ya puedes acceder a toda la configuración interactiva.
                  </p>
                  
                  <!-- Credentials Card -->
                  <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 16px; padding: 22px 25px; margin: 30px 0;">
                    <h3 style="margin-top: 0; margin-bottom: 15px; color: #d4af37; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px;">
                      🔑 Tus Datos de Acceso
                    </h3>
                    <table width="100%" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="35%" style="padding: 10px 0; font-size: 14px; color: #888096; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">Contraseña:</td>
                        <td style="padding: 10px 0; font-size: 15px; font-family: monospace; color: #ffffff; font-weight: 700; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">${password}</td>
                      </tr>
                      <tr>
                        <td style="padding: 12px 0 4px 0; font-size: 14px; color: #888096;">Acceso Panel:</td>
                        <td style="padding: 12px 0 4px 0; font-size: 14px;"><a href="${baseUrl}/admin?event=${eventId}" style="color: #d4af37; text-decoration: underline; font-weight: 700;">Ingresar al Panel Administrador &rarr;</a></td>
                      </tr>
                    </table>
                  </div>

                  <p style="font-size: 15px; line-height: 1.6; color: #f3f0fa; font-weight: 600; margin-bottom: 15px;">
                    ¿Qué puedes controlar desde tu panel?
                  </p>
                  
                  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                    ${servicesRowsHtml}
                  </table>

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
