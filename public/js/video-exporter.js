/**
 * miFiestAPP - Video Exporter Engine (Client-Side Full HD 1080p)
 * Genera videos cinemáticos de dedicatorias de invitados con transiciones y audio
 */

(function () {
  let activeMessagesList = [];
  let isRendering = false;

  window.openVideoExportModal = async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event') || 'default';

    const modal = document.getElementById('video-export-modal');
    const configView = document.getElementById('video-export-config-view');
    const progressView = document.getElementById('video-export-progress-view');
    const countLabel = document.getElementById('video-export-count-label');
    const badge = document.getElementById('video-export-badge');

    if (!modal) return;

    modal.style.display = 'flex';
    if (configView) configView.style.display = 'block';
    if (progressView) progressView.style.display = 'none';

    try {
      if (countLabel) countLabel.textContent = 'Cargando mensajes...';
      const res = await fetch(`/api/messages?event=${encodeURIComponent(eventId)}&all=true`);
      const data = await res.json();
      activeMessagesList = (data && data.messages) ? data.messages.filter(m => m.approved !== false) : [];

      if (activeMessagesList.length === 0) {
        if (countLabel) countLabel.textContent = 'No hay mensajes aprobados aún. Agregando mensaje de prueba.';
        if (badge) badge.textContent = '0 mensajes';
      } else {
        if (countLabel) countLabel.textContent = `${activeMessagesList.length} dedicatorias aprobadas listas para exportar.`;
        if (badge) badge.textContent = `${activeMessagesList.length} mensajes`;
      }
    } catch (e) {
      console.error('Error fetching messages for export:', e);
      if (countLabel) countLabel.textContent = 'Error al consultar mensajes.';
    }
  };

  window.closeVideoExportModal = function () {
    if (isRendering) {
      if (!confirm('¿Deseas cancelar el proceso de renderizado?')) return;
    }
    isRendering = false;
    const modal = document.getElementById('video-export-modal');
    if (modal) modal.style.display = 'none';
  };

  window.openMessagesWallScreen = function () {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event') || 'default';
    window.open(`/muro-mensajes.html?event=${encodeURIComponent(eventId)}`, '_blank');
  };

  window.startVideoRenderingProcess = async function () {
    if (isRendering) return;

    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('event') || 'default';
    const eventTitle = (document.getElementById('inv-title-input') ? document.getElementById('inv-title-input').value.trim() : '') || 'Mi Evento';

    const durationPerSlide = parseInt(document.getElementById('video-export-duration').value, 10) || 6;
    const includeAudio = document.getElementById('video-export-include-audio') ? document.getElementById('video-export-include-audio').checked : true;

    // Use active messages or fallback sample if empty
    let messagesToRender = activeMessagesList.length > 0 ? activeMessagesList : [
      { author: 'Familia & Amigos', message: '¡Que esta noche sea inolvidable y llena de felicidad!', featured: true },
      { author: 'Invitados Especiales', message: '¡Gracias por compartir este momento único con nosotros!', featured: false }
    ];

    const configView = document.getElementById('video-export-config-view');
    const progressView = document.getElementById('video-export-progress-view');
    const progressBar = document.getElementById('video-progress-bar');
    const progressPercent = document.getElementById('video-progress-percent');
    const progressStatus = document.getElementById('video-progress-status');

    if (configView) configView.style.display = 'none';
    if (progressView) progressView.style.display = 'block';

    isRendering = true;

    // Setup 1080p Canvas
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    // Get Theme Variables
    const computed = getComputedStyle(document.documentElement);
    const primaryRgb = computed.getPropertyValue('--primary-rgb').trim() || '212, 175, 55';
    const goldPrimary = computed.getPropertyValue('--gold-primary').trim() || '#d4af37';
    const goldLight = computed.getPropertyValue('--gold-light').trim() || '#f3e5ab';

    // Canvas Stream & Recorder
    const stream = canvas.captureStream(30);
    let audioCtx = null;
    let audioSourceNode = null;
    let audioDestination = null;

    if (includeAudio) {
      const audioPreview = document.getElementById('inv-audio-element');
      const audioSrc = (audioPreview && audioPreview.src) ? audioPreview.src : null;
      if (audioSrc && audioSrc.startsWith('http')) {
        try {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          audioDestination = audioCtx.createMediaStreamDestination();
          const response = await fetch(audioSrc);
          const arrayBuffer = await response.arrayBuffer();
          const decodedAudio = await audioCtx.decodeAudioData(arrayBuffer);
          audioSourceNode = audioCtx.createBufferSource();
          audioSourceNode.buffer = decodedAudio;
          audioSourceNode.loop = true;
          audioSourceNode.connect(audioDestination);
          audioSourceNode.start(0);

          const audioTracks = audioDestination.stream.getAudioTracks();
          if (audioTracks.length > 0) {
            stream.addTrack(audioTracks[0]);
          }
        } catch (audioErr) {
          console.warn('Could not attach background audio track to video render:', audioErr);
        }
      }
    }

    let mimeType = 'video/webm;codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
    }

    let mediaRecorder;
    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
    } catch (e) {
      mediaRecorder = new MediaRecorder(stream);
    }

    const recordedChunks = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      if (audioSourceNode) {
        try { audioSourceNode.stop(); } catch (e) {}
      }
      if (audioCtx) {
        try { audioCtx.close(); } catch (e) {}
      }

      const blob = new Blob(recordedChunks, { type: mimeType });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const cleanTitle = eventTitle.replace(/[^a-zA-Z0-9_\-]/g, '_');
      a.download = `${cleanTitle}-Mensajes-Show.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      isRendering = false;
      if (window.showToast) {
        window.showToast('success', '¡Video Descargado!', 'El video de dedicatorias se ha exportado con éxito en 1080p.', 4000);
      }
      window.closeVideoExportModal();
    };

    mediaRecorder.start();

    // Render loop per message
    const fps = 30;
    const fadeFrames = fps * 1; // 1 second fade in/out
    const totalSlideFrames = fps * durationPerSlide;
    const totalFramesAll = totalSlideFrames * messagesToRender.length;
    let globalFrameCounter = 0;

    for (let msgIdx = 0; msgIdx < messagesToRender.length; msgIdx++) {
      if (!isRendering) break;
      const msg = messagesToRender[msgIdx];

      for (let f = 0; f < totalSlideFrames; f++) {
        if (!isRendering) break;

        // Calculate opacity for smooth fade in / hold / fade out
        let opacity = 1.0;
        if (f < fadeFrames) {
          opacity = f / fadeFrames;
        } else if (f > totalSlideFrames - fadeFrames) {
          opacity = (totalSlideFrames - f) / fadeFrames;
        }

        // Render Slide onto 1080p Canvas
        renderCanvasSlide(ctx, msg, opacity, primaryRgb, goldPrimary, goldLight, eventTitle);

        globalFrameCounter++;
        const percent = Math.min(99, Math.round((globalFrameCounter / totalFramesAll) * 100));
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressPercent) progressPercent.textContent = `${percent}%`;
        if (progressStatus) progressStatus.textContent = `Renderizando mensaje ${msgIdx + 1} de ${messagesToRender.length}...`;

        // Advance 1 frame time
        await new Promise(r => setTimeout(r, 1000 / fps));
      }
    }

    if (progressBar) progressBar.style.width = '100%';
    if (progressPercent) progressPercent.textContent = '100%';
    if (progressStatus) progressStatus.textContent = 'Finalizando empaquetado del archivo .MP4...';

    setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }, 500);
  };

  function renderCanvasSlide(ctx, msg, opacity, primaryRgb, goldPrimary, goldLight, eventTitle) {
    const width = 1920;
    const height = 1080;

    ctx.save();
    ctx.globalAlpha = 1.0;

    // Background Gradient (Cinematic Luxury Dark)
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 900);
    bgGrad.addColorStop(0, `rgba(${primaryRgb}, 0.12)`);
    bgGrad.addColorStop(0.6, '#0c0c10');
    bgGrad.addColorStop(1, '#050507');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle Particle Glow or Accents
    ctx.strokeStyle = `rgba(${primaryRgb}, 0.25)`;
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 60, width - 120, height - 120);

    ctx.strokeStyle = `rgba(${primaryRgb}, 0.6)`;
    ctx.lineWidth = 1;
    ctx.strokeRect(75, 75, width - 150, height - 150);

    // Decorative Corner Diamonds
    drawDiamond(ctx, 60, 60, 10, goldPrimary);
    drawDiamond(ctx, width - 60, 60, 10, goldPrimary);
    drawDiamond(ctx, 60, height - 60, 10, goldPrimary);
    drawDiamond(ctx, width - 60, height - 60, 10, goldPrimary);

    // Event Header
    ctx.fillStyle = `rgba(${primaryRgb}, 0.8)`;
    ctx.font = '600 24px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '6px';
    ctx.fillText(eventTitle.toUpperCase() + ' • LIBRO DE DESEOS', width / 2, 140);

    // Central Glass Card with Opacity Transition
    ctx.globalAlpha = opacity;

    const cardW = 1400;
    const cardH = 650;
    const cardX = (width - cardW) / 2;
    const cardY = (height - cardH) / 2 + 10;

    // Card Glass Background
    ctx.fillStyle = 'rgba(18, 18, 24, 0.75)';
    roundRect(ctx, cardX, cardY, cardW, cardH, 30);
    ctx.fill();

    ctx.strokeStyle = `rgba(${primaryRgb}, 0.4)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Large Golden Quote Mark
    ctx.fillStyle = `rgba(${primaryRgb}, 0.35)`;
    ctx.font = 'bold 120px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('“', width / 2, cardY + 110);

    // Message Text (Wrapped)
    ctx.fillStyle = '#ffffff';
    ctx.font = '400 38px "Montserrat", sans-serif';
    ctx.textAlign = 'center';
    wrapText(ctx, `"${msg.message}"`, width / 2, cardY + 230, cardW - 160, 56);

    // Divider Line
    const divY = cardY + cardH - 150;
    const divGrad = ctx.createLinearGradient(width / 2 - 200, divY, width / 2 + 200, divY);
    divGrad.addColorStop(0, 'rgba(255,255,255,0)');
    divGrad.addColorStop(0.5, goldPrimary);
    divGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = divGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2 - 250, divY);
    ctx.lineTo(width / 2 + 250, divY);
    ctx.stroke();

    // Author Name
    ctx.fillStyle = goldLight;
    ctx.font = '700 34px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(msg.author || 'Invitado Especial', width / 2, cardY + cardH - 80);

    if (msg.featured) {
      ctx.fillStyle = `rgba(${primaryRgb}, 0.9)`;
      ctx.font = '600 18px "Montserrat", sans-serif';
      ctx.fillText('★ MENSAJE DESTACADO ★', width / 2, cardY + cardH - 45);
    }

    ctx.restore();
  }

  function drawDiamond(ctx, x, y, size, fill) {
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.lineTo(x + size, y);
    ctx.lineTo(x, y + size);
    ctx.lineTo(x - size, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let curY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line, x, curY);
        line = words[n] + ' ';
        curY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, x, curY);
  }
})();
