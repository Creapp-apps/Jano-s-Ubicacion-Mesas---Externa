const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const db = require('./db');

/**
 * Initialize Google Drive Client
 */
function getDriveClient() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  let auth;

  if (refreshToken) {
    auth = new google.auth.OAuth2(
      clientId,
      clientSecret
    );
    auth.setCredentials({
      refresh_token: refreshToken
    });
  } else {
    if (!clientEmail || !privateKey) {
      throw new Error('Las credenciales de Google Drive (Cuenta de Servicio o OAuth2) no están configuradas en las variables de entorno.');
    }

    // Replace literal '\n' characters in private key string
    const formattedKey = privateKey.replace(/\\n/g, '\n');

    auth = new google.auth.JWT({
      email: clientEmail,
      key: formattedKey,
      scopes: ['https://www.googleapis.com/auth/drive']
    });
  }

  return google.drive({ version: 'v3', auth });
}

/**
 * Synchronize approved photos of an event to Google Drive folder
 * @param {string} eventId 
 * @returns {Promise<string>} Shareable Google Drive folder URL
 */
async function syncPhotosToDrive(eventId = 'default') {
  const drive = getDriveClient();

  // 1. Get Event Details to build the folder name matching the ClientName - DD-MM-YYYY format
  const eventTitle = await db.getEventTitle(eventId);
  const event = await db.getEvent(eventId);
  let folderName = `Jano's - Mural de Fotos - ${eventTitle}`;

  if (event) {
    const clientName = event.clientName || eventTitle;
    let dateStr = '';
    if (event.createdAt) {
      const date = new Date(event.createdAt);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      dateStr = ` - ${day}-${month}-${year}`;
    }
    folderName = `${clientName}${dateStr}`;
  }
  
  // 2. Retrieve folder ID from config if it already exists
  let folderId = await db.getConfigValue(eventId, 'google_drive_folder_id', '');
  let folderUrl = await db.getConfigValue(eventId, 'google_drive_folder_url', '');

  // 3. Create Google Drive folder if not already existing
  if (!folderId) {
    console.log(`[Google Drive] Creando nueva carpeta para el evento: ${folderName}`);
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    
    const fileMetadata = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : []
    };

    const folderResponse = await drive.files.create({
      resource: fileMetadata,
      fields: 'id, webViewLink',
      supportsAllDrives: true
    });

    folderId = folderResponse.data.id;
    folderUrl = folderResponse.data.webViewLink;

    console.log(`[Google Drive] Carpeta creada con ID: ${folderId}`);

    // Make the folder publicly readable so anyone with the link can view it
    await drive.permissions.create({
      fileId: folderId,
      resource: {
        role: 'reader',
        type: 'anyone'
      }
    });
    console.log(`[Google Drive] Permisos de lectura pública otorgados.`);

    // Save folder ID and URL in event config
    await db.setConfigValue(eventId, 'google_drive_folder_id', folderId);
    await db.setConfigValue(eventId, 'google_drive_folder_url', folderUrl);
  } else {
    console.log(`[Google Drive] Usando carpeta existente: ${folderId}`);
  }

  // 4. Fetch list of files already uploaded to prevent duplicates
  const existingFilesResponse = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  const existingFileNames = new Set(
    (existingFilesResponse.data.files || []).map(f => f.name)
  );

  // 5. Get approved photos for the event
  const photos = await db.getPhotos(eventId, true);
  console.log(`[Google Drive] Encontradas ${photos.length} fotos aprobadas para sincronizar.`);

  // 6. Upload new photos
  let uploadCount = 0;
  for (const p of photos) {
    // Generate a unique filename using photo ID and guest name
    const sanitizedName = (p.guestName || 'Invitado')
      .replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${p.id}-${sanitizedName}.jpg`;

    // Skip if already uploaded
    if (existingFileNames.has(filename)) {
      continue;
    }

    try {
      let fileBuffer;
      if (p.photoUrl.startsWith('http://') || p.photoUrl.startsWith('https://')) {
        // Download from Supabase public URL
        const fetchRes = await fetch(p.photoUrl);
        if (!fetchRes.ok) {
          throw new Error(`Error descargando foto desde ${p.photoUrl}`);
        }
        fileBuffer = Buffer.from(await fetchRes.arrayBuffer());
      } else {
        // Read from local filesystem
        const localPath = path.join(
          process.cwd(),
          p.photoUrl.startsWith('/') ? p.photoUrl.substring(1) : p.photoUrl
        );

        if (fs.existsSync(localPath)) {
          fileBuffer = fs.readFileSync(localPath);
        } else {
          console.warn(`[Google Drive] Archivo local no encontrado: ${localPath}`);
          continue;
        }
      }

      // Apply message and guest name watermark overlay using Jimp
      let uploadBuffer = fileBuffer;
      try {
        const { Jimp, loadFont, HorizontalAlign } = require('jimp');
        const { SANS_32_WHITE, SANS_16_WHITE } = require('jimp/fonts');

        const image = await Jimp.read(fileBuffer);
        const w = image.width;
        const h = image.height;

        if (p.guestName || p.message) {
          const guestName = p.guestName || 'Invitado';
          const message = p.message || '';

          // Calculate banner height (e.g. 16% of height, clamped between 90px and 250px)
          const bannerH = Math.max(90, Math.min(250, Math.round(h * 0.16)));
          const bannerY = h - bannerH;

          // Create dark semi-transparent banner overlay (80% opacity)
          const banner = new Jimp({ width: w, height: bannerH, color: 0x000000cc });
          image.composite(banner, 0, bannerY);

          // Select font size based on image width
          const fontTitle = await loadFont(w >= 1000 ? SANS_32_WHITE : SANS_16_WHITE);
          const fontText = await loadFont(w >= 1000 ? SANS_16_WHITE : SANS_16_WHITE);

          if (message) {
            const nameY = bannerY + Math.round(bannerH * 0.2);
            const messageY = bannerY + Math.round(bannerH * 0.55);

            image.print({
              font: fontTitle,
              x: 20,
              y: nameY,
              text: {
                text: guestName.toUpperCase(),
                alignmentX: HorizontalAlign.CENTER
              },
              maxWidth: w - 40
            });

            image.print({
              font: fontText,
              x: 20,
              y: messageY,
              text: {
                text: message,
                alignmentX: HorizontalAlign.CENTER
              },
              maxWidth: w - 40
            });
          } else {
            // Only name, center vertically
            const nameY = bannerY + Math.round(bannerH * 0.35);
            image.print({
              font: fontTitle,
              x: 20,
              y: nameY,
              text: {
                text: guestName.toUpperCase(),
                alignmentX: HorizontalAlign.CENTER
              },
              maxWidth: w - 40
            });
          }

          uploadBuffer = await image.getBuffer('image/jpeg', { quality: 85 });
          console.log(`[Google Drive] Foto procesada con dedicatoria de ${guestName}.`);
        }
      } catch (jimpErr) {
        console.error(`[Google Drive] Error al estampar texto en foto ${p.id}, subiendo original:`, jimpErr);
        uploadBuffer = fileBuffer;
      }

      // Upload file to Google Drive
      const media = {
        mimeType: 'image/jpeg',
        body: require('stream').Readable.from(uploadBuffer)
      };

      await drive.files.create({
        resource: {
          name: filename,
          parents: [folderId]
        },
        media: media,
        fields: 'id',
        supportsAllDrives: true
      });

      uploadCount++;
      console.log(`[Google Drive] Foto subida con éxito: ${filename}`);
    } catch (err) {
      console.error(`[Google Drive] Error al subir foto ${filename}:`, err);
    }
  }

  console.log(`[Google Drive] Sincronización finalizada. Nuevas fotos subidas: ${uploadCount}`);
  return folderUrl;
}

module.exports = {
  syncPhotosToDrive,
  getDriveClient
};
