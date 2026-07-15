document.addEventListener('DOMContentLoaded', () => {
  const subtitleEl = document.getElementById('event-subtitle');
  const uploadForm = document.getElementById('photo-upload-form');
  const uploadCard = document.getElementById('upload-card');
  const successCard = document.getElementById('success-card');
  const onboardingCard = document.getElementById('onboarding-card');
  const startUploadBtn = document.getElementById('btn-start-upload');
  
  const goAdminBtn = document.getElementById('btn-go-admin');
  const guestNameInput = document.getElementById('guest-name-input');
  const guestMessageInput = document.getElementById('guest-message-input');
  const charCountEl = document.getElementById('char-count');
  
  const fileInput = document.getElementById('photo-file-input');
  const openCameraOverlayBtn = document.getElementById('btn-open-camera-overlay');
  const closeCameraOverlayBtn = document.getElementById('btn-close-camera-overlay');
  const galleryFallbackBtn = document.getElementById('btn-trigger-gallery-fallback');
  const retakePhotoBtn = document.getElementById('btn-retake-photo');
  const usePhotoBtn = document.getElementById('btn-use-photo');
  const postCaptureControls = document.getElementById('camera-post-capture-controls');
  const activeFilterBadge = document.getElementById('active-filter-badge');
  const previewWrapper = document.getElementById('preview-wrapper');
  const imagePreview = document.getElementById('image-preview');
  const removePhotoBtn = document.getElementById('btn-remove-photo');
  
  const submitBtn = document.getElementById('btn-submit-upload');
  const uploadAnotherBtn = document.getElementById('btn-upload-another');
  
  // Camera stream elements
  const cameraStreamContainer = document.getElementById('camera-stream-container');
  const cameraVideo = document.getElementById('camera-video');
  const capturePhotoBtn = document.getElementById('camera-shutter-visual-ring');
  const switchCameraBtn = document.getElementById('btn-switch-camera');
  
  // Camera Filter selectors
  const filterSelectorBar = document.getElementById('filter-selector-bar');
  const filterBtns = document.querySelectorAll('.filter-btn');
  
  // AR & Face Tracking Elements
  const overlayCanvas = document.getElementById('camera-overlay-canvas');
  const overlayCtx = overlayCanvas ? overlayCanvas.getContext('2d') : null;
  const cameraLoader = document.getElementById('camera-loader');
  const cameraLoaderText = document.getElementById('camera-loader-text');
  
  let selectedFile = null;
  let tempCapturedBlob = null;
  let stream = null;
  let currentFacingMode = 'user'; // default to front camera for selfie-style experience

  // Snap Camera Kit variables
  let snapApiToken = '';
  let snapGroupId = '';
  let snapLenses = {};
  let snapCameraKit = null;
  let snapSession = null;
  let snapSource = null;


  // AR Model / Detection states
  let faceLandmarker = null;
  let isFaceLandmarkerLoading = false;
  let isFaceLandmarkerReady = false;
  let activeAnimationId = null;
  let lastVideoTime = -1;
  
  const arFilters = ['perrito', 'cotillon', 'makeup', 'angel', 'demonio', 'payaso', 'pirata', 'cybervisor', 'gato', 'corona', 'vampiro'];
  const isArFilter = (filter) => arFilters.includes(filter);
  
  // Filter settings map
  let activeFilter = 'normal';
  const filtersMap = {
    normal: 'none',
    vintage: 'sepia(0.5) contrast(1.1) brightness(0.95)',
    cyberpunk: 'hue-rotate(280deg) saturate(1.6) contrast(1.1)',
    mono: 'grayscale(1) contrast(1.2)',
    perrito: 'none',
    cotillon: 'none',
    makeup: 'none',
    angel: 'none',
    demonio: 'none',
    payaso: 'none',
    pirata: 'none',
    cybervisor: 'none',
    gato: 'none',
    corona: 'none',
    vampiro: 'none'
  };

  // Extract event query parameter for multi-tenancy
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('event') || 'default';

  // Conditionally hide the moderation card for public guests
  const adminOnboardingCard = document.getElementById('admin-onboarding-card');
  const isAdmin = urlParams.get('admin') === 'true';
  if (adminOnboardingCard) {
    if (isAdmin) {
      adminOnboardingCard.style.display = 'flex';
    } else {
      adminOnboardingCard.style.display = 'none';
      if (onboardingCard) {
        onboardingCard.style.setProperty('max-width', '480px', 'important');
        onboardingCard.style.setProperty('grid-template-columns', '1fr', 'important');
      }
    }
  }

  // 1. Load dynamic event title
  fetch(`/api/config?event=${encodeURIComponent(eventId)}`)
    .then(r => r.json())
    .then(data => {
      if (data && data.eventTitle) {
        subtitleEl.textContent = data.eventTitle;
      }
      if (data && data.snapApiToken) {
        snapApiToken = data.snapApiToken;
        snapGroupId = data.snapGroupId || '';
        snapLenses = data.snapLenses || {};
        console.log("Snap API Token loaded successfully.");
      }
    })
    .catch(() => {
      subtitleEl.textContent = "Salón de Eventos";
    });

  // Loader helpers
  function showCameraLoader(text) {
    if (cameraLoaderText) cameraLoaderText.textContent = text;
    if (cameraLoader) {
      cameraLoader.style.display = 'flex';
    }
  }

  function hideCameraLoader() {
    if (cameraLoader) {
      cameraLoader.style.display = 'none';
    }
  }

  // Load MediaPipe Face Landmarker Model
  async function loadFaceLandmarker() {
    if (faceLandmarker) return;
    if (isFaceLandmarkerLoading) return;
    isFaceLandmarkerLoading = true;
    showCameraLoader("Cargando Filtros 3D...");

    try {
      const visionModule = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/vision_bundle.mjs");
      const { FaceLandmarker, FilesetResolver } = visionModule;

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm"
      );

      faceLandmarker = await FaceLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 6
        }
      );

      isFaceLandmarkerReady = true;
      hideCameraLoader();
    } catch (err) {
      console.error("Error loading MediaPipe FaceLandmarker:", err);
      showToast("No se pudieron iniciar los filtros faciales.", "error");
      hideCameraLoader();
      isFaceLandmarkerLoading = false;
    }
  }

  // Snapchat Camera Kit integration logic
  async function initSnapCamera() {
    isApplyingFilter = true;
    try {
      stopCamera();
      showCameraLoader("Iniciando cámara AR...");

      const snapCanvas = document.getElementById('snap-canvas');
      if (!snapCanvas) throw new Error("snap-canvas element not found");

      if (cameraVideo) cameraVideo.style.display = 'none';
      if (overlayCanvas) overlayCanvas.style.display = 'none';

      try {
        snapCanvas.width = 1280;
        snapCanvas.height = 960;
      } catch (err) {
        console.warn("Could not set snap-canvas dimensions (already transferred offscreen):", err.message);
      }
      snapCanvas.style.display = 'block';

      if (!snapCameraKit) {
        if (typeof window.SnapCameraHelper === 'undefined') {
          throw new Error("SnapCameraHelper SDK is not loaded");
        }

        snapCameraKit = await withTimeout(
          window.SnapCameraHelper.bootstrap({ apiToken: snapApiToken }),
          10000,
          "SnapCameraHelper bootstrap timed out"
        );
        window.snapCameraKit = snapCameraKit;
        window.snapGroupId = snapGroupId;
      }

      if (!snapSession) {
        snapSession = await withTimeout(
          snapCameraKit.createSession({ liveRenderTarget: snapCanvas }),
          10000,
          "Snap session creation timed out"
        );
      }

      const constraints = {
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      };

      stream = await withTimeout(
        navigator.mediaDevices.getUserMedia(constraints),
        10000,
        "Camera stream acquisition timed out"
      );
      await withTimeout(
        snapSession.setSource(stream),
        10000,
        "Snap session setSource timed out"
      );
      await withTimeout(
        snapSession.play(),
        10000,
        "Snap session play timed out"
      );

      // Configure background video stream for MediaPipe fallback
      if (cameraVideo) {
        cameraVideo.srcObject = stream;
        cameraVideo.autoplay = true;
        cameraVideo.playsInline = true;
        cameraVideo.muted = true;
        
        // Style to be active but invisible underneath the overlays / snap-canvas
        cameraVideo.style.position = 'absolute';
        cameraVideo.style.top = '0';
        cameraVideo.style.left = '0';
        cameraVideo.style.width = '100%';
        cameraVideo.style.height = '100%';
        cameraVideo.style.objectFit = 'cover';
        cameraVideo.style.opacity = '0';
        cameraVideo.style.pointerEvents = 'none';
        cameraVideo.style.display = 'block';

        // Mirror settings for background tracking video
        if (currentFacingMode === 'user') {
          cameraVideo.classList.add('mirror');
          if (overlayCanvas) overlayCanvas.classList.add('mirror');
        } else {
          cameraVideo.classList.remove('mirror');
          if (overlayCanvas) overlayCanvas.classList.remove('mirror');
        }

        cameraVideo.play().catch(err => console.log("Background video play deferred:", err));
      }

      if (cameraStreamContainer) cameraStreamContainer.style.display = 'flex';
      if (filterSelectorBar) filterSelectorBar.style.display = 'flex';
      if (previewWrapper) previewWrapper.style.display = 'none';

      isApplyingFilter = false;
      await applyActiveFilter();
      hideCameraLoader();
    } catch (err) {
      isApplyingFilter = false;
      console.error("Snap Camera Kit initialization failed:", err);
      hideCameraLoader();
      throw err;
    }
  }

  // Helper to wrap promises with a timeout
  function withTimeout(promise, ms, errorMessage = "Timeout exceeded") {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(errorMessage));
      }, ms);
    });
    return Promise.race([
      promise.then(result => {
        clearTimeout(timeoutId);
        return result;
      }),
      timeoutPromise
    ]);
  }

  async function applySnapLens(filterKey) {
    console.log(`[SnapCamera] applySnapLens called with key: ${filterKey}. snapSession: ${!!snapSession}, snapCameraKit: ${!!snapCameraKit}`);
    if (!snapSession || !snapCameraKit) return false;
    try {
      const lensId = snapLenses[filterKey];
      console.log(`[SnapCamera] lensId for ${filterKey}: ${lensId}. snapGroupId: ${snapGroupId}`);
      if (lensId) {
        showCameraLoader("Aplicando lente...");
        console.log(`[SnapCamera] loading lens: ${lensId} inside group: ${snapGroupId}`);
        const lens = await withTimeout(
          snapCameraKit.lensRepository.loadLens(lensId, snapGroupId),
          12000,
          `Loading lens ${lensId} timed out`
        );
        console.log(`[SnapCamera] lens loaded successfully: ${lens.name || lens.id}. Applying to session...`);
        await withTimeout(
          snapSession.applyLens(lens),
          12000,
          `Applying lens ${lensId} timed out`
        );
        console.log(`[SnapCamera] lens applied successfully!`);
        hideCameraLoader();
        return true;
      } else {
        console.log(`[SnapCamera] no lensId for ${filterKey}, removing lens.`);
        await snapSession.removeLens();
        return false;
      }
    } catch (err) {
      console.error(`[SnapCamera] Error switching Snap lens for ${filterKey}:`, err);
      try {
        await snapSession.removeLens();
      } catch (e) {}
      hideCameraLoader();
      return false;
    }
  }

  let isApplyingFilter = false;
  let pendingFilterToApply = null;

  async function runFilterApplication(filterKey) {
    console.log(`[SnapCamera] runFilterApplication: ${filterKey}`);
    if (activeFilterBadge) {
      activeFilterBadge.textContent = filterKey.toUpperCase();
    }
    
    // 1. If Snap Camera is active
    if (snapSession && snapApiToken) {
      const snapCanvas = document.getElementById('snap-canvas');
      if (snapCanvas) {
        snapCanvas.style.filter = filtersMap[filterKey];
      }
      
      const success = await applySnapLens(filterKey);
      
      if (success) {
        // Snap lens is active! Turn off MediaPipe drawing & hide overlay canvas
        console.log(`[SnapCamera] Lens application successful. Disabling MediaPipe overlays.`);
        if (activeAnimationId) {
          cancelAnimationFrame(activeAnimationId);
          activeAnimationId = null;
        }
        if (overlayCanvas) overlayCanvas.style.display = 'none';
        if (overlayCtx) {
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
      } else {
        // Fallback to MediaPipe/CSS filters for this specific filter (since Snap lens failed or is not set)
        console.log(`[SnapCamera] Lens application unsuccessful. Falling back to MediaPipe for ${filterKey}.`);
        if (isArFilter(filterKey)) {
          if (overlayCanvas) {
            overlayCanvas.style.display = 'block';
            // Match overlay dimensions to stream / video
            overlayCanvas.width = cameraVideo.videoWidth || 1280;
            overlayCanvas.height = cameraVideo.videoHeight || 960;
          }
          if (!isFaceLandmarkerReady) {
            await loadFaceLandmarker();
          }
          if (isFaceLandmarkerReady) {
            startFaceTracking();
          }
        } else {
          // Plain color filters: stop tracking loop & clear overlay
          if (activeAnimationId) {
            cancelAnimationFrame(activeAnimationId);
            activeAnimationId = null;
          }
          if (overlayCanvas) overlayCanvas.style.display = 'none';
          if (overlayCtx) {
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          }
        }
      }
      return;
    }

    // 2. If Snap Camera is NOT active (Fallback to normal camera & MediaPipe)
    if (cameraVideo) {
      cameraVideo.style.filter = filtersMap[filterKey];
    }

    if (isArFilter(filterKey)) {
      if (overlayCanvas) {
        overlayCanvas.style.display = 'block';
      }
      if (!isFaceLandmarkerReady) {
        await loadFaceLandmarker();
      }
      if (isFaceLandmarkerReady) {
        startFaceTracking();
      }
    } else {
      if (activeAnimationId) {
        cancelAnimationFrame(activeAnimationId);
        activeAnimationId = null;
      }
      if (overlayCtx) {
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
    }
  }

  async function applyActiveFilter() {
    if (isApplyingFilter) {
      pendingFilterToApply = activeFilter;
      console.log(`[SnapCamera] applyActiveFilter queued request for: ${activeFilter}`);
      return;
    }
    isApplyingFilter = true;
    
    try {
      while (true) {
        const filterToLoad = activeFilter;
        await runFilterApplication(filterToLoad);
        
        if (pendingFilterToApply === null || pendingFilterToApply === filterToLoad) {
          break;
        }
        activeFilter = pendingFilterToApply;
        pendingFilterToApply = null;
      }
    } finally {
      isApplyingFilter = false;
      pendingFilterToApply = null;
    }
  }


  // Camera Management
  async function initCamera() {
    isApplyingFilter = true;
    tempCapturedBlob = null;
    if (cameraVideo) {
      try {
        cameraVideo.play();
      } catch (e) {}
    }
    if (capturePhotoBtn) {
      capturePhotoBtn.style.display = 'block';
      capturePhotoBtn.disabled = false;
      capturePhotoBtn.style.pointerEvents = 'auto';
      capturePhotoBtn.style.opacity = '1';
    }
    if (postCaptureControls) postCaptureControls.style.display = 'none';
    if (switchCameraBtn) switchCameraBtn.style.display = 'flex';
    if (filterSelectorBar) {
      filterSelectorBar.style.opacity = '1';
      filterSelectorBar.style.pointerEvents = 'auto';
      // Center the active filter button in the carousel when camera modal opens
      const activeBtn = Array.from(filterBtns).find(btn => btn.classList.contains('active'));
      if (activeBtn) {
        setTimeout(() => {
          activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        }, 100);
      }
    }

    if (snapApiToken) {
      try {
        await initSnapCamera();
        return;
      } catch (err) {
        console.error("Snap Camera Kit initialization failed, falling back to MediaPipe:", err);
      }
    }

    // Fallback layout config
    const snapCanvas = document.getElementById('snap-canvas');
    if (snapCanvas) snapCanvas.style.display = 'none';
    if (cameraVideo) {
      cameraVideo.style.position = '';
      cameraVideo.style.top = '';
      cameraVideo.style.left = '';
      cameraVideo.style.width = '100%';
      cameraVideo.style.height = '100%';
      cameraVideo.style.objectFit = 'cover';
      cameraVideo.style.opacity = '1';
      cameraVideo.style.pointerEvents = '';
      cameraVideo.style.display = 'block';
    }
    if (overlayCanvas) overlayCanvas.style.display = 'block';

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      isApplyingFilter = false;
      showFallback();
      return;
    }

    try {
      stopCamera();

      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: currentFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });

      if (cameraVideo) {
        cameraVideo.srcObject = stream;
        
        cameraVideo.onloadedmetadata = () => {
          if (overlayCanvas) {
            overlayCanvas.width = cameraVideo.videoWidth || 1280;
            overlayCanvas.height = cameraVideo.videoHeight || 960;
          }
        };

        // Mirror front camera view
        if (currentFacingMode === 'user') {
          cameraVideo.classList.add('mirror');
          if (overlayCanvas) overlayCanvas.classList.add('mirror');
        } else {
          cameraVideo.classList.remove('mirror');
          if (overlayCanvas) overlayCanvas.classList.remove('mirror');
        }

        // Apply active filter
        cameraVideo.style.filter = filtersMap[activeFilter];

        if (cameraStreamContainer) cameraStreamContainer.style.display = 'flex';
        if (filterSelectorBar) filterSelectorBar.style.display = 'flex';
        if (previewWrapper) previewWrapper.style.display = 'none';

        // Auto-start face tracking if active filter is AR
        if (isArFilter(activeFilter)) {
          if (isFaceLandmarkerReady) {
            startFaceTracking();
          } else {
            await loadFaceLandmarker();
            if (isFaceLandmarkerReady) {
              startFaceTracking();
            }
          }
        }
      }
      isApplyingFilter = false;
      await applyActiveFilter();
    } catch (err) {
      isApplyingFilter = false;
      console.warn('Camera stream setup failed, showing fallback selector:', err);
      showFallback();
    }
  }

   function stopCamera() {
    isApplyingFilter = false;
    pendingFilterToApply = null;
    if (snapSession) {
      try {
        snapSession.pause();
      } catch (err) {
        console.error("Error pausing Snap session:", err);
      }
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
    if (filterSelectorBar) {
      filterSelectorBar.style.display = 'none';
    }
    if (activeAnimationId) {
      cancelAnimationFrame(activeAnimationId);
      activeAnimationId = null;
    }
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    lastVideoTime = -1;
    hideCameraLoader();
  }

  function showFallback() {
    if (cameraStreamContainer) cameraStreamContainer.style.display = 'none';
    if (filterSelectorBar) filterSelectorBar.style.display = 'none';
    if (openCameraOverlayBtn) openCameraOverlayBtn.style.display = 'flex';
  }

  function resetFilter() {
    activeFilter = 'normal';
    if (filterBtns) {
      filterBtns.forEach(btn => {
        if (btn.dataset.filter === 'normal') {
          btn.classList.add('active');
          // Center normal button in the carousel
          setTimeout(() => {
            btn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
          }, 50);
        } else {
          btn.classList.remove('active');
        }
      });
    }
    if (cameraVideo) {
      cameraVideo.style.filter = 'none';
    }
    if (activeAnimationId) {
      cancelAnimationFrame(activeAnimationId);
      activeAnimationId = null;
    }
    if (overlayCtx) {
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    lastVideoTime = -1;
  }

  // Face Tracking render loop
  function startFaceTracking() {
    if (activeAnimationId) {
      cancelAnimationFrame(activeAnimationId);
    }

    const predictLoop = () => {
      if (!stream || !faceLandmarker || !cameraVideo) return;

      try {
        if (cameraVideo.readyState >= 2 && isArFilter(activeFilter)) {
          const now = performance.now();
          if (cameraVideo.currentTime !== lastVideoTime) {
            lastVideoTime = cameraVideo.currentTime;
            const results = faceLandmarker.detectForVideo(cameraVideo, now);

            if (overlayCtx) {
              overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
              if (results && results.faceLandmarks && results.faceLandmarks.length > 0) {
                results.faceLandmarks.forEach(landmarks => {
                  drawAROverlay(overlayCtx, landmarks);
                });
              }
            }
          }
        } else {
          if (overlayCtx) {
            overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
          }
        }
      } catch (err) {
        console.error("Error in face landmark tracking loop:", err);
      }

      activeAnimationId = requestAnimationFrame(predictLoop);
    };

    activeAnimationId = requestAnimationFrame(predictLoop);
  }

  // Draw overlay items based on facial landmarks
  function drawAROverlay(ctx, landmarks) {
    if (!landmarks || landmarks.length === 0) return;

    // Calculate dimensions
    // Left eye center (midpoint of landmarks 33 and 133)
    const leftEye = {
      x: ((landmarks[33].x + landmarks[133].x) / 2) * overlayCanvas.width,
      y: ((landmarks[33].y + landmarks[133].y) / 2) * overlayCanvas.height
    };
    
    // Right eye center (midpoint of landmarks 263 and 362)
    const rightEye = {
      x: ((landmarks[263].x + landmarks[362].x) / 2) * overlayCanvas.width,
      y: ((landmarks[263].y + landmarks[362].y) / 2) * overlayCanvas.height
    };

    const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

    const drawStar = (cx, cy, spikes, outerRadius, innerRadius, strokeColor, fillColor) => {
      let rot = Math.PI / 2 * 3;
      let x = cx;
      let y = cy;
      let step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      
      if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
      }
      if (strokeColor) {
        ctx.lineWidth = 4;
        ctx.strokeStyle = strokeColor;
        ctx.stroke();
      }
    };

    const drawDiamondStar = (cx, cy, r) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r * 0.5, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r * 0.5, cy);
      ctx.closePath();
      ctx.fill();
    };
    
    const forehead = {
      x: landmarks[10].x * overlayCanvas.width,
      y: landmarks[10].y * overlayCanvas.height
    };
    
    const leftTemple = {
      x: landmarks[234].x * overlayCanvas.width,
      y: landmarks[234].y * overlayCanvas.height
    };
    const rightTemple = {
      x: landmarks[454].x * overlayCanvas.width,
      y: landmarks[454].y * overlayCanvas.height
    };

    const noseTip = {
      x: landmarks[1].x * overlayCanvas.width,
      y: landmarks[1].y * overlayCanvas.height
    };

    const mouthTop = {
      x: landmarks[13].x * overlayCanvas.width,
      y: landmarks[13].y * overlayCanvas.height
    };
    const mouthBottom = {
      x: landmarks[14].x * overlayCanvas.width,
      y: landmarks[14].y * overlayCanvas.height
    };

    const headWidth = Math.hypot(rightTemple.x - leftTemple.x, rightTemple.y - leftTemple.y);

    if (activeFilter === 'perrito') {
      // 1. Draw ears
      const earSize = headWidth * 0.35;
      
      // Left floppy ear
      ctx.save();
      ctx.translate(leftTemple.x, leftTemple.y - earSize * 0.3);
      ctx.rotate(-0.35 + angle);
      ctx.fillStyle = '#8B5A2B'; // dark brown
      ctx.strokeStyle = '#5C3317';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, earSize * 0.45, earSize * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = '#FFC0CB'; // pink inner
      ctx.beginPath();
      ctx.ellipse(0, earSize * 0.1, earSize * 0.25, earSize * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Right floppy ear
      ctx.save();
      ctx.translate(rightTemple.x, rightTemple.y - earSize * 0.3);
      ctx.rotate(0.35 + angle);
      ctx.fillStyle = '#8B5A2B';
      ctx.strokeStyle = '#5C3317';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, earSize * 0.45, earSize * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = '#FFC0CB';
      ctx.beginPath();
      ctx.ellipse(0, earSize * 0.1, earSize * 0.25, earSize * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Draw snout
      const noseSize = headWidth * 0.16;
      ctx.save();
      ctx.translate(noseTip.x, noseTip.y);
      ctx.rotate(angle);
      ctx.fillStyle = '#1A1A1A';
      ctx.beginPath();
      ctx.moveTo(-noseSize * 0.5, -noseSize * 0.1);
      ctx.quadraticCurveTo(0, -noseSize * 0.4, noseSize * 0.5, -noseSize * 0.1);
      ctx.quadraticCurveTo(noseSize * 0.6, noseSize * 0.3, 0, noseSize * 0.4);
      ctx.quadraticCurveTo(-noseSize * 0.6, noseSize * 0.3, -noseSize * 0.5, -noseSize * 0.1);
      ctx.fill();
      
      // Nose highlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-noseSize * 0.15, -noseSize * 0.05, noseSize * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Tongue
      const mouthOpenness = Math.abs(mouthBottom.y - mouthTop.y);
      if (mouthOpenness > headWidth * 0.06) {
        const mouthCenterX = (mouthTop.x + mouthBottom.x) / 2;
        const mouthCenterY = (mouthTop.y + mouthBottom.y) / 2;
        const tongueLength = headWidth * 0.32;
        const tongueWidth = headWidth * 0.18;
        
        ctx.save();
        ctx.translate(mouthCenterX, mouthCenterY);
        ctx.rotate(angle);
        ctx.fillStyle = '#FF4D4D';
        ctx.beginPath();
        ctx.moveTo(-tongueWidth * 0.5, 0);
        ctx.bezierCurveTo(-tongueWidth * 0.5, tongueLength, tongueWidth * 0.5, tongueLength, tongueWidth * 0.5, 0);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#B30000';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, tongueLength * 0.85);
        ctx.stroke();
        ctx.restore();
      }
    } 
    else if (activeFilter === 'cotillon') {
      // 1. Star glasses
      const bridgeX = landmarks[168].x * overlayCanvas.width;
      const bridgeY = landmarks[168].y * overlayCanvas.height;

      ctx.save();
      ctx.translate(bridgeX, bridgeY);
      ctx.rotate(angle);

      // Draw glasses bridge connection
      ctx.strokeStyle = '#FF00FF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-eyeDist * 0.35, 0);
      ctx.quadraticCurveTo(0, -eyeDist * 0.1, eyeDist * 0.35, 0);
      ctx.stroke();

      // Star frames with translucent lens fills
      drawStar(-eyeDist * 0.6, 0, 5, eyeDist * 0.48, eyeDist * 0.22, '#FF00FF', 'rgba(255, 0, 255, 0.25)'); // Left star
      drawStar(eyeDist * 0.6, 0, 5, eyeDist * 0.48, eyeDist * 0.22, '#00FFFF', 'rgba(0, 255, 255, 0.25)'); // Right star
      ctx.restore();

      // 2. Hat (galera violeta) on forehead
      ctx.save();
      ctx.translate(forehead.x, forehead.y);
      ctx.rotate(angle);
      const hatWidth = eyeDist * 2.1;
      const hatHeight = eyeDist * 1.5;
      
      // Position hat sitting on the forehead
      ctx.translate(0, -eyeDist * 0.95);
      
      // Draw top hat base (brim)
      ctx.fillStyle = '#9400D3';
      ctx.strokeStyle = '#4B0082';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, hatHeight * 0.42, hatWidth * 0.72, hatHeight * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Hat body
      ctx.fillStyle = '#4B0082';
      ctx.beginPath();
      ctx.moveTo(-hatWidth * 0.45, hatHeight * 0.4);
      ctx.lineTo(-hatWidth * 0.5, -hatHeight * 0.4);
      ctx.quadraticCurveTo(0, -hatHeight * 0.5, hatWidth * 0.5, -hatHeight * 0.4);
      ctx.lineTo(hatWidth * 0.45, hatHeight * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Hat band
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(-hatWidth * 0.46, hatHeight * 0.4);
      ctx.lineTo(-hatWidth * 0.48, hatHeight * 0.22);
      ctx.quadraticCurveTo(0, hatHeight * 0.15, hatWidth * 0.48, hatHeight * 0.22);
      ctx.lineTo(hatWidth * 0.46, hatHeight * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    else if (activeFilter === 'makeup') {
      // 1. 3D Volumetric Lipstick with creases and drop shadow
      ctx.save();
      
      const lipTop = landmarks[0].y * overlayCanvas.height;
      const lipBottom = landmarks[17].y * overlayCanvas.height;
      
      // Outer drop shadow to give 3D depth
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      
      // Linear gradient for 3D rounded fullness
      const lipGrad = ctx.createLinearGradient(0, lipTop, 0, lipBottom);
      lipGrad.addColorStop(0, 'rgba(180, 5, 45, 0.9)');    // Shadow top edge of upper lip
      lipGrad.addColorStop(0.32, 'rgba(255, 50, 105, 0.95)'); // Peak color of upper lip
      lipGrad.addColorStop(0.5, 'rgba(140, 2, 30, 0.95)');   // Dark mouth crease shadow
      lipGrad.addColorStop(0.68, 'rgba(255, 75, 125, 0.95)'); // Light highlight center lower lip
      lipGrad.addColorStop(1, 'rgba(145, 2, 35, 0.9)');     // Shadow bottom edge of lower lip
      
      ctx.fillStyle = lipGrad;
      
      // Draw outer lip loop and inner mouth cutout using evenodd winding
      ctx.beginPath();
      // Outer lip path
      const outerIndices = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
      outerIndices.forEach((idx, i) => {
        const pt = landmarks[idx];
        const lx = pt.x * overlayCanvas.width;
        const ly = pt.y * overlayCanvas.height;
        if (i === 0) ctx.moveTo(lx, ly);
        else ctx.lineTo(lx, ly);
      });
      ctx.closePath();

      // Inner mouth path cutout
      const innerIndices = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308];
      innerIndices.forEach((idx, i) => {
        const pt = landmarks[idx];
        const lx = pt.x * overlayCanvas.width;
        const ly = pt.y * overlayCanvas.height;
        if (i === 0) ctx.moveTo(lx, ly);
        else ctx.lineTo(lx, ly);
      });
      ctx.closePath();

      ctx.fill('evenodd');
      ctx.restore();

      // Draw subtle vertical lip line creases (realistic texture)
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 1;
      
      const lowerLipPoints = [146, 91, 181, 84, 17, 314, 405, 321, 375];
      const innerLowerLipPoints = [95, 88, 178, 87, 14, 317, 402, 318, 324];
      
      for (let k = 0; k < lowerLipPoints.length; k++) {
        const outerPt = landmarks[lowerLipPoints[k]];
        const innerPt = landmarks[innerLowerLipPoints[innerLowerLipPoints.length - 1 - k]];
        if (outerPt && innerPt) {
          ctx.beginPath();
          ctx.moveTo(innerPt.x * overlayCanvas.width, innerPt.y * overlayCanvas.height);
          ctx.lineTo(outerPt.x * overlayCanvas.width, outerPt.y * overlayCanvas.height);
          ctx.stroke();
        }
      }
      
      // Add subtle white highlight crease lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      for (let k = 1; k < lowerLipPoints.length - 1; k += 2) {
        const outerPt = landmarks[lowerLipPoints[k]];
        const innerPt = landmarks[innerLowerLipPoints[innerLowerLipPoints.length - 1 - k]];
        if (outerPt && innerPt) {
          ctx.beginPath();
          ctx.moveTo(innerPt.x * overlayCanvas.width + 0.8, innerPt.y * overlayCanvas.height);
          ctx.lineTo(outerPt.x * overlayCanvas.width + 0.8, outerPt.y * overlayCanvas.height);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Shiny gloss specular reflections
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = eyeDist * 0.07;
      ctx.lineCap = 'round';
      ctx.filter = 'blur(1px)';
      
      const cLower = { x: landmarks[17].x * overlayCanvas.width, y: landmarks[17].y * overlayCanvas.height };
      const cUpperLeft = { x: landmarks[37].x * overlayCanvas.width, y: landmarks[37].y * overlayCanvas.height };
      const cUpperRight = { x: landmarks[267].x * overlayCanvas.width, y: landmarks[267].y * overlayCanvas.height };
      
      // Bottom lip shiny highlight arc
      ctx.beginPath();
      ctx.moveTo(cLower.x - eyeDist * 0.18, cLower.y - eyeDist * 0.02);
      ctx.quadraticCurveTo(cLower.x, cLower.y + eyeDist * 0.015, cLower.x + eyeDist * 0.18, cLower.y - eyeDist * 0.02);
      ctx.stroke();

      // Cupid's bow shiny line
      ctx.beginPath();
      ctx.moveTo(cUpperLeft.x, cUpperLeft.y + eyeDist * 0.015);
      ctx.lineTo(cUpperRight.x, cUpperRight.y + eyeDist * 0.015);
      ctx.stroke();
      ctx.restore();

      // 2. Cheek Blush
      const cheekL = landmarks[205];
      const cheekR = landmarks[425];
      const cheekRadius = eyeDist * 0.38;
      
      ctx.save();
      let gradL = ctx.createRadialGradient(
        cheekL.x * overlayCanvas.width, cheekL.y * overlayCanvas.height, 0,
        cheekL.x * overlayCanvas.width, cheekL.y * overlayCanvas.height, cheekRadius
      );
      gradL.addColorStop(0, 'rgba(255, 105, 180, 0.45)');
      gradL.addColorStop(1, 'rgba(255, 105, 180, 0)');
      ctx.fillStyle = gradL;
      ctx.beginPath();
      ctx.arc(cheekL.x * overlayCanvas.width, cheekL.y * overlayCanvas.height, cheekRadius, 0, Math.PI * 2);
      ctx.fill();

      let gradR = ctx.createRadialGradient(
        cheekR.x * overlayCanvas.width, cheekR.y * overlayCanvas.height, 0,
        cheekR.x * overlayCanvas.width, cheekR.y * overlayCanvas.height, cheekRadius
      );
      gradR.addColorStop(0, 'rgba(255, 105, 180, 0.45)');
      gradR.addColorStop(1, 'rgba(255, 105, 180, 0)');
      ctx.fillStyle = gradR;
      ctx.beginPath();
      ctx.arc(cheekR.x * overlayCanvas.width, cheekR.y * overlayCanvas.height, cheekRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Gold Diamond Stars
      ctx.save();
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;
      
      const leftOuterEye = landmarks[33];
      const rightOuterEye = landmarks[263];
      
      drawDiamondStar(leftOuterEye.x * overlayCanvas.width - eyeDist * 0.1, leftOuterEye.y * overlayCanvas.height + eyeDist * 0.08, eyeDist * 0.08);
      drawDiamondStar(rightOuterEye.x * overlayCanvas.width + eyeDist * 0.1, rightOuterEye.y * overlayCanvas.height + eyeDist * 0.08, eyeDist * 0.08);
      ctx.restore();
    }
    else if (activeFilter === 'angel') {
      // 1. Floating Glowing Golden Halo
      ctx.save();
      ctx.translate(forehead.x, forehead.y - headWidth * 0.45);
      ctx.rotate(angle);
      ctx.scale(1, 0.28); // Flatten loop for 3D perspective
      
      // Outer glow
      ctx.lineWidth = headWidth * 0.09;
      ctx.strokeStyle = '#FFD700';
      ctx.shadowColor = '#FFF7A3';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(0, 0, headWidth * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      
      // White inner core line
      ctx.lineWidth = headWidth * 0.035;
      ctx.strokeStyle = '#FFFFFF';
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(0, 0, headWidth * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 2. Rising Glitter Sparkles
      ctx.save();
      const time = performance.now() * 0.0015;
      ctx.fillStyle = 'rgba(255, 235, 120, 0.85)';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 8;
      for (let i = 0; i < 6; i++) {
        const px = noseTip.x + Math.sin(time + i * 2) * headWidth * 0.65;
        const py = noseTip.y - headWidth * 0.3 - ((time * 45 + i * 65) % 240);
        drawDiamondStar(px, py, headWidth * 0.045);
      }
      ctx.restore();
    }
    else if (activeFilter === 'demonio') {
      // 1. Left Horn
      const leftHornBase = {
        x: landmarks[109].x * overlayCanvas.width,
        y: landmarks[109].y * overlayCanvas.height
      };
      ctx.save();
      ctx.translate(leftHornBase.x, leftHornBase.y);
      ctx.rotate(-0.25 + angle);
      
      let hornGradL = ctx.createLinearGradient(0, 0, -headWidth * 0.3, -headWidth * 0.4);
      hornGradL.addColorStop(0, '#7b085c');
      hornGradL.addColorStop(1, '#ff003c');
      
      ctx.fillStyle = hornGradL;
      ctx.shadowColor = '#ff003c';
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.moveTo(-headWidth * 0.06, 0);
      ctx.bezierCurveTo(-headWidth * 0.08, -headWidth * 0.25, -headWidth * 0.35, -headWidth * 0.3, -headWidth * 0.3, -headWidth * 0.42);
      ctx.bezierCurveTo(-headWidth * 0.2, -headWidth * 0.3, headWidth * 0.02, -headWidth * 0.2, headWidth * 0.06, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 2. Right Horn
      const rightHornBase = {
        x: landmarks[338].x * overlayCanvas.width,
        y: landmarks[338].y * overlayCanvas.height
      };
      ctx.save();
      ctx.translate(rightHornBase.x, rightHornBase.y);
      ctx.rotate(0.25 + angle);
      
      let hornGradR = ctx.createLinearGradient(0, 0, headWidth * 0.3, -headWidth * 0.4);
      hornGradR.addColorStop(0, '#7b085c');
      hornGradR.addColorStop(1, '#ff003c');
      
      ctx.fillStyle = hornGradR;
      ctx.shadowColor = '#ff003c';
      ctx.shadowBlur = 15;
      
      ctx.beginPath();
      ctx.moveTo(headWidth * 0.06, 0);
      ctx.bezierCurveTo(headWidth * 0.08, -headWidth * 0.25, headWidth * 0.35, -headWidth * 0.3, headWidth * 0.3, -headWidth * 0.42);
      ctx.bezierCurveTo(headWidth * 0.2, -headWidth * 0.3, -headWidth * 0.02, -headWidth * 0.2, -headWidth * 0.06, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 3. Glowing neon eyeliner
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 0, 60, 0.75)';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#ff003c';
      ctx.shadowBlur = 8;
      
      // Left eye outline
      ctx.beginPath();
      const leftEyeIndices = [33, 246, 161, 160, 159, 158, 157, 173, 133];
      leftEyeIndices.forEach((idx, i) => {
        const pt = landmarks[idx];
        if (i === 0) ctx.moveTo(pt.x * overlayCanvas.width, pt.y * overlayCanvas.height);
        else ctx.lineTo(pt.x * overlayCanvas.width, pt.y * overlayCanvas.height);
      });
      ctx.stroke();

      // Right eye outline
      ctx.beginPath();
      const rightEyeIndices = [362, 398, 384, 385, 386, 387, 388, 466, 263];
      rightEyeIndices.forEach((idx, i) => {
        const pt = landmarks[idx];
        if (i === 0) ctx.moveTo(pt.x * overlayCanvas.width, pt.y * overlayCanvas.height);
        else ctx.lineTo(pt.x * overlayCanvas.width, pt.y * overlayCanvas.height);
      });
      ctx.stroke();
      ctx.restore();
    }
    else if (activeFilter === 'payaso') {
      // 1. Shiny 3D Clown Nose
      ctx.save();
      ctx.translate(noseTip.x, noseTip.y);
      ctx.rotate(angle);
      const clownNoseRadius = headWidth * 0.13;
      
      const clownGrad = ctx.createRadialGradient(
        -clownNoseRadius * 0.2, -clownNoseRadius * 0.3, 0,
        0, 0, clownNoseRadius
      );
      clownGrad.addColorStop(0, '#ff6666'); // Highlight shine core
      clownGrad.addColorStop(0.3, '#ff0000'); // Core red
      clownGrad.addColorStop(1, '#800000'); // Shadowed edge
      
      ctx.fillStyle = clownGrad;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 5;
      
      ctx.beginPath();
      ctx.arc(0, 0, clownNoseRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Reflection dot
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-clownNoseRadius * 0.35, -clownNoseRadius * 0.35, clownNoseRadius * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 2. Blue and Magenta face paint stars over eyes
      ctx.save();
      drawStar(leftEye.x, leftEye.y, 4, eyeDist * 0.38, eyeDist * 0.16, '#00FFFF', 'rgba(0, 255, 255, 0.35)');
      drawStar(rightEye.x, rightEye.y, 4, eyeDist * 0.38, eyeDist * 0.16, '#FF00FF', 'rgba(255, 0, 255, 0.35)');
      
      // Rosy Cheeks
      const cheekRadius = eyeDist * 0.35;
      const cheekL = landmarks[205];
      const cheekR = landmarks[425];
      
      let cGradL = ctx.createRadialGradient(cheekL.x * overlayCanvas.width, cheekL.y * overlayCanvas.height, 0, cheekL.x * overlayCanvas.width, cheekL.y * overlayCanvas.height, cheekRadius);
      cGradL.addColorStop(0, 'rgba(255, 50, 50, 0.55)');
      cGradL.addColorStop(1, 'rgba(255, 50, 50, 0)');
      ctx.fillStyle = cGradL;
      ctx.beginPath();
      ctx.arc(cheekL.x * overlayCanvas.width, cheekL.y * overlayCanvas.height, cheekRadius, 0, Math.PI * 2);
      ctx.fill();

      let cGradR = ctx.createRadialGradient(cheekR.x * overlayCanvas.width, cheekR.y * overlayCanvas.height, 0, cheekR.x * overlayCanvas.width, cheekR.y * overlayCanvas.height, cheekRadius);
      cGradR.addColorStop(0, 'rgba(255, 50, 50, 0.55)');
      cGradR.addColorStop(1, 'rgba(255, 50, 50, 0)');
      ctx.fillStyle = cGradR;
      ctx.beginPath();
      ctx.arc(cheekR.x * overlayCanvas.width, cheekR.y * overlayCanvas.height, cheekRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    else if (activeFilter === 'pirata') {
      // 1. Leather Eyepatch over Left Eye with straps
      ctx.save();
      ctx.strokeStyle = '#1d1d1d';
      ctx.lineWidth = headWidth * 0.035;
      
      // Eyepatch strap line
      ctx.beginPath();
      ctx.moveTo(leftTemple.x, leftTemple.y - headWidth * 0.08);
      ctx.lineTo(rightTemple.x, rightTemple.y + headWidth * 0.12);
      ctx.stroke();
      
      // Eyepatch shape
      ctx.translate(leftEye.x, leftEye.y);
      ctx.rotate(angle);
      const patchRadius = eyeDist * 0.52;
      
      let patchGrad = ctx.createRadialGradient(
        -patchRadius * 0.15, -patchRadius * 0.15, 0,
        0, 0, patchRadius
      );
      patchGrad.addColorStop(0, '#444444');
      patchGrad.addColorStop(0.7, '#222222');
      patchGrad.addColorStop(1, '#080808');
      
      ctx.fillStyle = patchGrad;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      
      ctx.beginPath();
      ctx.arc(0, 0, patchRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Trim/Stitches
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, patchRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 2. Curly mustache
      const mustacheCenter = {
        x: landmarks[164].x * overlayCanvas.width,
        y: landmarks[164].y * overlayCanvas.height
      };
      ctx.save();
      ctx.translate(mustacheCenter.x, mustacheCenter.y);
      ctx.rotate(angle);
      
      const mustGrad = ctx.createLinearGradient(-headWidth * 0.45, 0, headWidth * 0.45, 0);
      mustGrad.addColorStop(0, '#050505');
      mustGrad.addColorStop(0.5, '#333333');
      mustGrad.addColorStop(1, '#050505');
      ctx.fillStyle = mustGrad;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      
      // Left mustache curl
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-headWidth * 0.25, -headWidth * 0.05, -headWidth * 0.45, -headWidth * 0.05, -headWidth * 0.42, -headWidth * 0.12);
      ctx.bezierCurveTo(-headWidth * 0.44, headWidth * 0.02, -headWidth * 0.2, headWidth * 0.08, 0, headWidth * 0.025);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Right mustache curl
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(headWidth * 0.25, -headWidth * 0.05, headWidth * 0.45, -headWidth * 0.05, headWidth * 0.42, -headWidth * 0.12);
      ctx.bezierCurveTo(headWidth * 0.44, headWidth * 0.02, headWidth * 0.2, headWidth * 0.08, 0, headWidth * 0.025);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    else if (activeFilter === 'cybervisor') {
      // Holographic sci-fi visor centered on nose bridge
      const bridgeX = landmarks[168].x * overlayCanvas.width;
      const bridgeY = landmarks[168].y * overlayCanvas.height;
      
      ctx.save();
      ctx.translate(bridgeX, bridgeY);
      ctx.rotate(angle);
      
      const visorW = eyeDist * 2.3;
      const visorH = eyeDist * 0.95;
      
      // Translucent cyan neon gradient
      let visorGrad = ctx.createLinearGradient(-visorW * 0.5, 0, visorW * 0.5, 0);
      visorGrad.addColorStop(0, 'rgba(0, 240, 255, 0.18)');
      visorGrad.addColorStop(0.5, 'rgba(0, 150, 255, 0.38)');
      visorGrad.addColorStop(1, 'rgba(0, 240, 255, 0.18)');
      
      ctx.fillStyle = visorGrad;
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 15;
      
      // Hexagonal visor path
      ctx.beginPath();
      ctx.moveTo(-visorW * 0.5, -visorH * 0.35);
      ctx.lineTo(-visorW * 0.3, -visorH * 0.5);
      ctx.lineTo(visorW * 0.3, -visorH * 0.5);
      ctx.lineTo(visorW * 0.5, -visorH * 0.35);
      ctx.lineTo(visorW * 0.45, visorH * 0.4);
      ctx.lineTo(0, visorH * 0.65);
      ctx.lineTo(-visorW * 0.45, visorH * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // HUD interior details
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.moveTo(-visorW * 0.42, 0);
      ctx.lineTo(visorW * 0.42, 0);
      ctx.stroke();
      
      // Pulsing scanning laser line
      const scanOffset = (performance.now() * 0.02) % (visorW * 0.7);
      ctx.fillStyle = '#00f0ff';
      ctx.fillRect(-visorW * 0.35 + scanOffset, -visorH * 0.38, 4, visorH * 0.18);
      
      // Visor targeting grids
      ctx.beginPath();
      ctx.arc(-eyeDist * 0.55, 0, eyeDist * 0.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(eyeDist * 0.55, 0, eyeDist * 0.15, 0, Math.PI * 2);
      ctx.stroke();
      
      // Visor digital UI text
      ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
      ctx.font = `600 ${Math.max(10, eyeDist * 0.13)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText("TARGET ACQUIRED", 0, -visorH * 0.2);
      ctx.fillText("SYS OK", -visorW * 0.26, visorH * 0.26);
      ctx.fillText("98.6%", visorW * 0.26, visorH * 0.26);
      
      ctx.restore();
    }
    else if (activeFilter === 'gato') {
      // 1. Cat Ears on temple areas pointing up
      const earSize = headWidth * 0.35;
      
      // Left pointy ear
      ctx.save();
      ctx.translate(leftTemple.x, leftTemple.y - earSize * 0.4);
      ctx.rotate(-0.15 + angle);
      ctx.fillStyle = '#FF7F50'; // coral orange base
      ctx.strokeStyle = '#D35400';
      ctx.lineWidth = 4;
      
      ctx.beginPath();
      ctx.moveTo(-earSize * 0.45, earSize * 0.45);
      ctx.lineTo(0, -earSize * 0.65);
      ctx.lineTo(earSize * 0.45, earSize * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Inner pink triangle
      ctx.fillStyle = '#FFB6C1';
      ctx.beginPath();
      ctx.moveTo(-earSize * 0.25, earSize * 0.35);
      ctx.lineTo(0, -earSize * 0.4);
      ctx.lineTo(earSize * 0.25, earSize * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Right pointy ear
      ctx.save();
      ctx.translate(rightTemple.x, rightTemple.y - earSize * 0.4);
      ctx.rotate(0.15 + angle);
      ctx.fillStyle = '#FF7F50';
      ctx.strokeStyle = '#D35400';
      ctx.lineWidth = 4;
      
      ctx.beginPath();
      ctx.moveTo(-earSize * 0.45, earSize * 0.45);
      ctx.lineTo(0, -earSize * 0.65);
      ctx.lineTo(earSize * 0.45, earSize * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Inner pink triangle
      ctx.fillStyle = '#FFB6C1';
      ctx.beginPath();
      ctx.moveTo(-earSize * 0.25, earSize * 0.35);
      ctx.lineTo(0, -earSize * 0.4);
      ctx.lineTo(earSize * 0.25, earSize * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // 2. Cute tiny pink nose
      const noseSize = headWidth * 0.08;
      ctx.save();
      ctx.translate(noseTip.x, noseTip.y + noseSize * 0.1);
      ctx.rotate(angle);
      ctx.fillStyle = '#FF69B4'; // hot pink
      ctx.strokeStyle = '#C71585';
      ctx.lineWidth = 2.5;
      
      ctx.beginPath();
      ctx.moveTo(-noseSize * 0.6, -noseSize * 0.3);
      ctx.lineTo(noseSize * 0.6, -noseSize * 0.3);
      ctx.quadraticCurveTo(0, noseSize * 0.5, 0, noseSize * 0.4);
      ctx.quadraticCurveTo(0, noseSize * 0.5, -noseSize * 0.6, -noseSize * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Small highlight
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-noseSize * 0.15, -noseSize * 0.1, noseSize * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 3. Cute whiskers (3 lines on each side)
      ctx.save();
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      
      // Left whiskers
      ctx.beginPath();
      ctx.moveTo(noseTip.x - headWidth * 0.08, noseTip.y + headWidth * 0.06);
      ctx.lineTo(noseTip.x - headWidth * 0.42, noseTip.y + headWidth * 0.04);
      ctx.moveTo(noseTip.x - headWidth * 0.08, noseTip.y + headWidth * 0.08);
      ctx.lineTo(noseTip.x - headWidth * 0.44, noseTip.y + headWidth * 0.1);
      ctx.moveTo(noseTip.x - headWidth * 0.08, noseTip.y + headWidth * 0.1);
      ctx.lineTo(noseTip.x - headWidth * 0.41, noseTip.y + headWidth * 0.16);
      ctx.stroke();
      
      // Right whiskers
      ctx.beginPath();
      ctx.moveTo(noseTip.x + headWidth * 0.08, noseTip.y + headWidth * 0.06);
      ctx.lineTo(noseTip.x + headWidth * 0.42, noseTip.y + headWidth * 0.04);
      ctx.moveTo(noseTip.x + headWidth * 0.08, noseTip.y + headWidth * 0.08);
      ctx.lineTo(noseTip.x + headWidth * 0.44, noseTip.y + headWidth * 0.1);
      ctx.moveTo(noseTip.x + headWidth * 0.08, noseTip.y + headWidth * 0.1);
      ctx.lineTo(noseTip.x + headWidth * 0.41, noseTip.y + headWidth * 0.16);
      ctx.stroke();
      
      ctx.restore();

      // 4. Subtle rosy blush on cheeks
      const cheekRadius = eyeDist * 0.35;
      const cheekL = landmarks[205];
      const cheekR = landmarks[425];
      
      ctx.save();
      let gradL = ctx.createRadialGradient(
        cheekL.x * overlayCanvas.width, cheekL.y * overlayCanvas.height, 0,
        cheekL.x * overlayCanvas.width, cheekL.y * overlayCanvas.height, cheekRadius
      );
      gradL.addColorStop(0, 'rgba(255, 105, 180, 0.35)');
      gradL.addColorStop(1, 'rgba(255, 105, 180, 0)');
      ctx.fillStyle = gradL;
      ctx.beginPath();
      ctx.arc(cheekL.x * overlayCanvas.width, cheekL.y * overlayCanvas.height, cheekRadius, 0, Math.PI * 2);
      ctx.fill();

      let gradR = ctx.createRadialGradient(
        cheekR.x * overlayCanvas.width, cheekR.y * overlayCanvas.height, 0,
        cheekR.x * overlayCanvas.width, cheekR.y * overlayCanvas.height, cheekRadius
      );
      gradR.addColorStop(0, 'rgba(255, 105, 180, 0.35)');
      gradR.addColorStop(1, 'rgba(255, 105, 180, 0)');
      ctx.fillStyle = gradR;
      ctx.beginPath();
      ctx.arc(cheekR.x * overlayCanvas.width, cheekR.y * overlayCanvas.height, cheekRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    else if (activeFilter === 'corona') {
      // 1. Golden Tiara sitting above the forehead
      ctx.save();
      ctx.translate(forehead.x, forehead.y - headWidth * 0.2);
      ctx.rotate(angle);
      
      const crownW = headWidth * 0.9;
      const crownH = headWidth * 0.55;
      
      // Metallic golden gradient
      let goldGrad = ctx.createLinearGradient(-crownW * 0.5, 0, crownW * 0.5, 0);
      goldGrad.addColorStop(0, '#B8860B'); // dark golden rod
      goldGrad.addColorStop(0.25, '#FFD700'); // gold
      goldGrad.addColorStop(0.5, '#FFF8DC'); // corn silk (shine)
      goldGrad.addColorStop(0.75, '#FFD700');
      goldGrad.addColorStop(1, '#B8860B');
      
      ctx.fillStyle = goldGrad;
      ctx.strokeStyle = '#DAA520';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 4;
      
      // Draw premium tiara geometry (5 peaks)
      ctx.beginPath();
      ctx.moveTo(-crownW * 0.42, 0);
      
      // Peak 1 (Leftmost)
      ctx.lineTo(-crownW * 0.35, -crownH * 0.32);
      ctx.lineTo(-crownW * 0.24, -crownH * 0.12);
      
      // Peak 2 (Left middle)
      ctx.lineTo(-crownW * 0.16, -crownH * 0.58);
      ctx.lineTo(-crownW * 0.08, -crownH * 0.22);
      
      // Peak 3 (Center peak - Tallest)
      ctx.lineTo(0, -crownH * 0.88);
      ctx.lineTo(crownW * 0.08, -crownH * 0.22);
      
      // Peak 4 (Right middle)
      ctx.lineTo(crownW * 0.16, -crownH * 0.58);
      ctx.lineTo(crownW * 0.24, -crownH * 0.12);
      
      // Peak 5 (Rightmost)
      ctx.lineTo(crownW * 0.35, -crownH * 0.32);
      ctx.lineTo(crownW * 0.42, 0);
      
      // Base arc curves slightly around head
      ctx.quadraticCurveTo(0, -crownH * 0.06, -crownW * 0.42, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // 2. Add ruby and sapphire gem ornaments on the tips
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      
      const drawGem = (cx, cy, r, color) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Specular dot
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.25, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
      
      const gemRadius = headWidth * 0.045;
      
      // Gems on 5 tips
      drawGem(-crownW * 0.35, -crownH * 0.32, gemRadius, '#00FFFF'); // Cyan
      drawGem(-crownW * 0.16, -crownH * 0.58, gemRadius, '#FF003C'); // Ruby
      drawGem(0, -crownH * 0.88, gemRadius * 1.3, '#E67E22'); // Diamond center
      drawGem(crownW * 0.16, -crownH * 0.58, gemRadius, '#FF003C'); // Ruby
      drawGem(crownW * 0.35, -crownH * 0.32, gemRadius, '#00FFFF'); // Cyan
      
      // Gems along base
      drawGem(-crownW * 0.2, -crownH * 0.03, gemRadius * 0.8, '#FF00FF');
      drawGem(0, -crownH * 0.05, gemRadius * 0.9, '#DAF7A6');
      drawGem(crownW * 0.2, -crownH * 0.03, gemRadius * 0.8, '#FF00FF');
      
      ctx.restore();
      
      // 3. Floating gold sparkles in background
      ctx.save();
      const time = performance.now() * 0.002;
      ctx.fillStyle = '#FFD700';
      ctx.shadowColor = '#FFF568';
      ctx.shadowBlur = 10;
      for (let i = 0; i < 5; i++) {
        const sx = forehead.x + Math.sin(time + i * 1.5) * headWidth * 0.55;
        const sy = forehead.y - headWidth * 0.45 - ((time * 30 + i * 50) % 150);
        drawDiamondStar(sx, sy, headWidth * 0.045);
      }
      ctx.restore();
    }
    else if (activeFilter === 'vampiro') {
      // 1. Spooky red eyeshadow
      ctx.save();
      ctx.fillStyle = 'rgba(150, 0, 20, 0.42)';
      ctx.filter = 'blur(4px)';
      
      const leftEyeLid = landmarks[159];
      const rightEyeLid = landmarks[386];
      const lidRadius = eyeDist * 0.45;
      
      ctx.beginPath();
      ctx.arc(leftEyeLid.x * overlayCanvas.width, leftEyeLid.y * overlayCanvas.height, lidRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(rightEyeLid.x * overlayCanvas.width, rightEyeLid.y * overlayCanvas.height, lidRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      
      // 2. Neon Red Eyeliner & Glowing red pupil spots
      ctx.save();
      ctx.strokeStyle = '#FF003C';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#FF003C';
      ctx.shadowBlur = 6;
      
      ctx.beginPath();
      const leftEyeIndices = [33, 246, 161, 160, 159, 158, 157, 173, 133];
      leftEyeIndices.forEach((idx, i) => {
        const pt = landmarks[idx];
        if (i === 0) ctx.moveTo(pt.x * overlayCanvas.width, pt.y * overlayCanvas.height);
        else ctx.lineTo(pt.x * overlayCanvas.width, pt.y * overlayCanvas.height);
      });
      ctx.stroke();

      ctx.beginPath();
      const rightEyeIndices = [362, 398, 384, 385, 386, 387, 388, 466, 263];
      rightEyeIndices.forEach((idx, i) => {
        const pt = landmarks[idx];
        if (i === 0) ctx.moveTo(pt.x * overlayCanvas.width, pt.y * overlayCanvas.height);
        else ctx.lineTo(pt.x * overlayCanvas.width, pt.y * overlayCanvas.height);
      });
      ctx.stroke();
      ctx.restore();

      // 3. Vampire Fangs on upper lip corners
      const mouthLeft = {
        x: landmarks[78].x * overlayCanvas.width,
        y: landmarks[78].y * overlayCanvas.height
      };
      const mouthRight = {
        x: landmarks[308].x * overlayCanvas.width,
        y: landmarks[308].y * overlayCanvas.height
      };
      
      const fangLength = headWidth * 0.11;
      const fangWidth = headWidth * 0.038;
      
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 2;
      
      // Draw Left Fang
      ctx.beginPath();
      ctx.moveTo(mouthLeft.x, mouthLeft.y);
      ctx.lineTo(mouthLeft.x + fangWidth * 0.3, mouthLeft.y + fangLength);
      ctx.lineTo(mouthLeft.x + fangWidth * 0.7, mouthLeft.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Draw Right Fang
      ctx.beginPath();
      ctx.moveTo(mouthRight.x, mouthRight.y);
      ctx.lineTo(mouthRight.x - fangWidth * 0.7, mouthRight.y);
      ctx.lineTo(mouthRight.x - fangWidth * 0.3, mouthRight.y + fangLength);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 4. Drip of blood running down the left chin/lip corner
      ctx.save();
      ctx.fillStyle = '#990000'; // dark blood red
      ctx.strokeStyle = '#550000';
      ctx.lineWidth = 1;
      ctx.shadowColor = '#550000';
      ctx.shadowBlur = 2;
      
      ctx.beginPath();
      ctx.moveTo(mouthLeft.x, mouthLeft.y + 2);
      ctx.bezierCurveTo(
        mouthLeft.x - fangWidth * 0.5, mouthLeft.y + fangLength * 0.6,
        mouthLeft.x - fangWidth * 0.4, mouthLeft.y + fangLength * 1.5,
        mouthLeft.x - fangWidth * 0.2, mouthLeft.y + fangLength * 1.5
      );
      ctx.arc(mouthLeft.x - fangWidth * 0.2, mouthLeft.y + fangLength * 1.5 + 2, 2.5, 0, Math.PI * 2);
      ctx.bezierCurveTo(
        mouthLeft.x - fangWidth * 0.1, mouthLeft.y + fangLength * 1.4,
        mouthLeft.x + fangWidth * 0.3, mouthLeft.y + fangLength * 0.6,
        mouthLeft.x + 3, mouthLeft.y + 2
      );
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

  }

  // Handle click on onboarding button to show uploader and launch camera
  if (startUploadBtn && onboardingCard && uploadCard) {
    startUploadBtn.addEventListener('click', () => {
      onboardingCard.style.opacity = '0';
      onboardingCard.style.transform = 'scale(0.95)';
      onboardingCard.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
      
      setTimeout(() => {
        onboardingCard.style.display = 'none';
        uploadCard.style.display = 'block';
        uploadCard.style.opacity = '0';
        uploadCard.style.transform = 'scale(0.95)';
        
        // Force reflow
        void uploadCard.offsetWidth;
        
        uploadCard.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        uploadCard.style.opacity = '1';
        uploadCard.style.transform = 'scale(1)';
        
        setTimeout(() => {
          if (guestNameInput) guestNameInput.focus();
        }, 500);
      }, 500);
    });
  }
  
  if (goAdminBtn) {
    goAdminBtn.addEventListener('click', () => {
      window.location.href = `/admin?event=${encodeURIComponent(eventId)}&service=photos`;
    });
  }

  // Character counter for the greeting message
  if (guestMessageInput && charCountEl) {
    guestMessageInput.addEventListener('input', () => {
      const len = guestMessageInput.value.length;
      charCountEl.textContent = len;
      if (len >= 200) {
        charCountEl.style.color = '#ff3333';
      } else {
        charCountEl.style.color = 'var(--text-muted)';
      }
    });
  }

  // Scroll snapping auto-detection of centered active filter
  let scrollTimeout = null;
  if (filterSelectorBar && filterBtns) {
    filterSelectorBar.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Calculate the center point of the scroll view
        const containerRect = filterSelectorBar.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        
        let closestBtn = null;
        let minDistance = Infinity;
        
        // Find the filter button closest to the viewport horizontal center
        filterBtns.forEach(btn => {
          const btnRect = btn.getBoundingClientRect();
          const btnCenter = btnRect.left + btnRect.width / 2;
          const distance = Math.abs(btnCenter - containerCenter);
          if (distance < minDistance) {
            minDistance = distance;
            closestBtn = btn;
          }
        });
        
        // Update active filter if settled on a different item
        if (closestBtn && !closestBtn.classList.contains('active')) {
          filterBtns.forEach(b => b.classList.remove('active'));
          closestBtn.classList.add('active');
          activeFilter = closestBtn.dataset.filter || 'normal';
          applyActiveFilter();
        }
      }, 150); // settle delay to prevent loading heavy WebGL filters while swiping fast
    });
  }

  // Camera Filter Selection Setup with Double-tap/Active click to snap photo
  if (filterBtns) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.classList.contains('active')) {
          // Double-tap or tap on active filter triggers instant countdown/shutter capture!
          await triggerCaptureSequence();
        } else {
          // Center the clicked filter carousel item smoothly
          clearTimeout(scrollTimeout);
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          
          activeFilter = btn.dataset.filter || 'normal';
          await applyActiveFilter();
        }
      });
    });
  }



  // Web Audio API Synthesizer for premium camera sound effects
  let audioCtx = null;

  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Plays a clean cinematic beep sound
  function playCountdownBeep(freq = 880, duration = 0.15) {
    try {
      initAudioContext();
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.type = 'sine'; // sine waves sound very clean
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      
      // Smooth volume envelope: rise quickly, decay to 0
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + duration);
    } catch (err) {
      console.warn("Could not play synthesized countdown beep:", err);
    }
  }

  // Plays a simulated camera shutter "shutter-click-whoosh" sound
  function playShutterClick() {
    try {
      initAudioContext();
      const now = audioCtx.currentTime;
      
      // Shutter "click" - oscillator + envelope
      const osc = audioCtx.createOscillator();
      const clickGain = audioCtx.createGain();
      osc.connect(clickGain);
      clickGain.connect(audioCtx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
      
      clickGain.gain.setValueAtTime(0, now);
      clickGain.gain.linearRampToValueAtTime(0.45, now + 0.01);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
      
      osc.start(now);
      osc.stop(now + 0.08);
      
      // Shutter "whoosh/noise" - white noise burst
      const bufferSize = audioCtx.sampleRate * 0.12; // 0.12 seconds
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1; // random white noise
      }
      
      const noiseNode = audioCtx.createBufferSource();
      noiseNode.buffer = buffer;
      
      const noiseFilter = audioCtx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1200;
      
      const noiseGain = audioCtx.createGain();
      
      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(audioCtx.destination);
      
      noiseGain.gain.setValueAtTime(0, now);
      noiseGain.gain.linearRampToValueAtTime(0.25, now + 0.01);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      
      noiseNode.start(now);
      noiseNode.stop(now + 0.12);
    } catch (err) {
      console.warn("Could not play synthesized shutter click:", err);
    }
  }

  // Function that handles the actual photo capture and preview loading
  async function capturePhotoNow() {
    if (snapSession && snapApiToken) {
      try {
        showCameraLoader("Capturando foto...");
        const captureCanvas = snapSession.output.live || snapSession.output.capture;
        
        let finalBlob = await new Promise(resolve => {
          captureCanvas.toBlob(resolve, 'image/jpeg', 0.85);
        });

        // Check if overlayCanvas is currently active (e.g. display is block, meaning MediaPipe fallback is drawn on top)
        const isOverlayActive = overlayCanvas && overlayCanvas.style.display !== 'none' && isArFilter(activeFilter);

        if (isOverlayActive || (activeFilter && filtersMap[activeFilter] && filtersMap[activeFilter] !== 'none')) {
          const tempImg = new Image();
          await new Promise((resolve, reject) => {
            tempImg.onload = resolve;
            tempImg.onerror = reject;
            tempImg.src = URL.createObjectURL(finalBlob);
          });

          const canvas = document.createElement('canvas');
          canvas.width = tempImg.width;
          canvas.height = tempImg.height;
          const ctx = canvas.getContext('2d');
          
          // Draw Snap camera capture (applying filters if needed)
          if (activeFilter && filtersMap[activeFilter] && filtersMap[activeFilter] !== 'none') {
            ctx.filter = filtersMap[activeFilter];
          }
          ctx.drawImage(tempImg, 0, 0);
          ctx.filter = 'none';

          // Draw MediaPipe overlays on top
          if (isOverlayActive) {
            ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height);
          }
          
          finalBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        }

        if (finalBlob) {
          tempCapturedBlob = finalBlob;
          
          // Freeze the snap session live rendering
          try {
            snapSession.pause();
          } catch (e) {
            console.warn("Could not pause snap session:", e);
          }

          // Show confirmation controls, hide shutter and others
          if (capturePhotoBtn) capturePhotoBtn.style.display = 'none';
          if (postCaptureControls) postCaptureControls.style.display = 'flex';
          if (filterSelectorBar) {
            filterSelectorBar.style.opacity = '0.3';
            filterSelectorBar.style.pointerEvents = 'none';
          }
          if (switchCameraBtn) switchCameraBtn.style.display = 'none';
        }
        hideCameraLoader();
        return;
      } catch (err) {
        console.error("Snap Camera Kit screenshot failed:", err);
        hideCameraLoader();
      }
    }

    if (!cameraVideo || !stream) return;

    const canvas = document.createElement('canvas');
    canvas.width = cameraVideo.videoWidth || 1280;
    canvas.height = cameraVideo.videoHeight || 960;

    const ctx = canvas.getContext('2d');
    
    // Apply color filter ONLY to the video draw
    if (activeFilter && filtersMap[activeFilter] && filtersMap[activeFilter] !== 'none') {
      ctx.filter = filtersMap[activeFilter];
    }

    // Mirror the context if using user (front) facing camera
    if (currentFacingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
    
    // Reset filter so overlays are drawn in high quality original colors
    ctx.filter = 'none';

    // Draw AR overlay if it is an AR filter and we have detections
    if (isArFilter(activeFilter)) {
      ctx.drawImage(overlayCanvas, 0, 0, canvas.width, canvas.height);
    }

    await new Promise(resolve => {
      canvas.toBlob((blob) => {
        if (blob) {
          tempCapturedBlob = blob;
          
          // Freeze standard camera feed
          cameraVideo.pause();
          if (activeAnimationId) {
            cancelAnimationFrame(activeAnimationId);
            activeAnimationId = null;
          }

          // Show confirmation controls, hide shutter and others
          if (capturePhotoBtn) capturePhotoBtn.style.display = 'none';
          if (postCaptureControls) postCaptureControls.style.display = 'flex';
          if (filterSelectorBar) {
            filterSelectorBar.style.opacity = '0.3';
            filterSelectorBar.style.pointerEvents = 'none';
          }
          if (switchCameraBtn) switchCameraBtn.style.display = 'none';
        }
        resolve();
      }, 'image/jpeg', 0.85);
    });
  }

  // Modular hoisted function to trigger the capture sequence with interactive countdown
  async function triggerCaptureSequence() {
    const visualRing = document.getElementById('camera-shutter-visual-ring');
    if (visualRing && visualRing.classList.contains('active-press')) return; // prevent concurrent triggers

    // Add visual press feedback
    if (visualRing) visualRing.classList.add('active-press');

    // Initialize AudioContext on user gesture
    initAudioContext();

    // Hide other control triggers during the countdown
    if (switchCameraBtn) switchCameraBtn.style.display = 'none';
    if (filterSelectorBar) {
      filterSelectorBar.style.pointerEvents = 'none';
      filterSelectorBar.style.opacity = '0.4';
    }

    // Get countdown elements
    const countdownOverlay = document.getElementById('camera-countdown-overlay');
    const countdownNumberDisplay = document.getElementById('countdown-number-display');
    const countdownMessageDisplay = document.getElementById('countdown-message-display');
    const countdownProgressBar = document.getElementById('countdown-progress-bar');
    const cameraFlash = document.getElementById('camera-flash');

    if (!countdownOverlay || !countdownNumberDisplay || !countdownMessageDisplay || !countdownProgressBar) {
      // Fallback capture if UI is somehow missing elements
      await capturePhotoNow();
      if (visualRing) visualRing.classList.remove('active-press');
      if (switchCameraBtn) switchCameraBtn.style.display = 'flex';
      if (filterSelectorBar) {
        filterSelectorBar.style.pointerEvents = 'auto';
        filterSelectorBar.style.opacity = '1';
      }
      return;
    }

    // Show countdown overlay
    countdownOverlay.style.display = 'flex';

    // Reset & Start SVG circular progress ring transition smoothly over 3s
    countdownProgressBar.style.transition = 'none';
    countdownProgressBar.style.strokeDashoffset = '0';
    void countdownProgressBar.offsetWidth; // force browser layout reflow
    countdownProgressBar.style.transition = 'stroke-dashoffset 3s linear';
    countdownProgressBar.style.strokeDashoffset = '314';

    const countdownSequence = [
      { num: '3', text: '¡Posá, ponete lindo/linda!', freq: 880 },
      { num: '2', text: '¡Sonreí!', freq: 880 },
      { num: '1', text: '¡FOTO!', freq: 1100 }
    ];

    const runTick = (stepIdx) => {
      if (stepIdx >= countdownSequence.length) {
        // Play synthesized camera shutter sound
        playShutterClick();

        // Trigger flash visual effect
        if (cameraFlash) {
          cameraFlash.style.display = 'block';
          cameraFlash.classList.add('camera-flash-active');
        }

        // Execute photo capture
        capturePhotoNow().then(() => {
          // Restore controls and clean up overlays after flash animation finishes
          setTimeout(() => {
            countdownOverlay.style.display = 'none';
            if (cameraFlash) {
              cameraFlash.style.display = 'none';
              cameraFlash.classList.remove('camera-flash-active');
            }
            // Restore buttons
            if (visualRing) visualRing.classList.remove('active-press');
            if (switchCameraBtn) switchCameraBtn.style.display = 'flex';
            if (filterSelectorBar) {
              filterSelectorBar.style.pointerEvents = 'auto';
              filterSelectorBar.style.opacity = '1';
            }
          }, 350);
        });
        return;
      }

      const data = countdownSequence[stepIdx];

      // Update displays
      countdownNumberDisplay.textContent = data.num;
      countdownMessageDisplay.textContent = data.text;

      // Reset and trigger animations for this tick
      countdownNumberDisplay.classList.remove('animate-tick');
      countdownMessageDisplay.classList.remove('animate-tick');
      void countdownNumberDisplay.offsetWidth; // force browser layout reflow
      void countdownMessageDisplay.offsetWidth;

      countdownNumberDisplay.classList.add('animate-tick');
      countdownMessageDisplay.classList.add('animate-tick');

      // Play synth beep sound
      playCountdownBeep(data.freq, 0.12);

      // Schedule next tick
      setTimeout(() => {
        runTick(stepIdx + 1);
      }, 1000);
    };

    // Start the tick sequence
    runTick(0);
  }

  // Shutter Capture Button Action (click listener fallback for the visual ring)
  if (capturePhotoBtn) {
    capturePhotoBtn.addEventListener('click', async () => {
      await triggerCaptureSequence();
    });
  }

  // Switch camera action
  if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', async () => {
      currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
      initCamera();
    });
  }

  // Open camera overlay button (Sacar Foto)
  if (openCameraOverlayBtn) {
    openCameraOverlayBtn.addEventListener('click', () => {
      if (cameraStreamContainer) {
        cameraStreamContainer.style.display = 'flex';
      }
      initCamera();
    });
  }

  // Close camera overlay button (X)
  if (closeCameraOverlayBtn) {
    closeCameraOverlayBtn.addEventListener('click', () => {
      if (cameraStreamContainer) {
        cameraStreamContainer.style.display = 'none';
      }
      stopCamera();
    });
  }

  // Fallback to gallery selection button
  if (galleryFallbackBtn) {
    galleryFallbackBtn.addEventListener('click', () => {
      if (fileInput) fileInput.click();
    });
  }

  // Retake photo action inside camera overlay
  if (retakePhotoBtn) {
    retakePhotoBtn.addEventListener('click', async () => {
      isApplyingFilter = true;
      try {
        tempCapturedBlob = null;
        if (postCaptureControls) postCaptureControls.style.display = 'none';
        if (capturePhotoBtn) {
          capturePhotoBtn.style.display = 'block';
          capturePhotoBtn.disabled = false;
          capturePhotoBtn.style.pointerEvents = 'auto';
          capturePhotoBtn.style.opacity = '1';
        }
        if (switchCameraBtn) switchCameraBtn.style.display = 'flex';
        if (filterSelectorBar) {
          filterSelectorBar.style.opacity = '1';
          filterSelectorBar.style.pointerEvents = 'auto';
        }
        
        // Enforce a stable camera hardware re-acquisition sequence
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          stream = null;
        }

        const constraints = {
          video: {
            facingMode: currentFacingMode,
            width: { ideal: 1280 },
            height: { ideal: 960 }
          },
          audio: false
        };

        stream = await withTimeout(
          navigator.mediaDevices.getUserMedia(constraints),
          10000,
          "Camera stream re-acquisition timed out"
        );

        if (snapSession && snapApiToken) {
          await withTimeout(
            snapSession.setSource(stream),
            10000,
            "Snap session setSource during retake timed out"
          );
          await withTimeout(
            snapSession.play(),
            10000,
            "Snap session play during retake timed out"
          );
          
          if (cameraVideo) {
            cameraVideo.srcObject = stream;
            cameraVideo.play().catch(err => console.log("Background video play deferred:", err));
          }
        } else if (cameraVideo) {
          cameraVideo.srcObject = stream;
          await cameraVideo.play();
        }
      } catch (err) {
        console.error("Error during retake re-acquisition:", err);
        showToast("No se pudo reiniciar la cámara.", "error");
      } finally {
        isApplyingFilter = false;
        await applyActiveFilter();
      }
    });
  }

  // Use captured photo action inside camera overlay
  if (usePhotoBtn) {
    usePhotoBtn.addEventListener('click', () => {
      if (tempCapturedBlob) {
        selectedFile = tempCapturedBlob;
        if (imagePreview) imagePreview.src = URL.createObjectURL(selectedFile);
        if (previewWrapper) previewWrapper.style.display = 'block';
        
        stopCamera();
        if (cameraStreamContainer) cameraStreamContainer.style.display = 'none';
        validateForm();
      }
    });
  }

  // File input change handler (Fallback file upload)
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecciona un archivo de imagen válido.', 'error');
        return;
      }

      selectedFile = file;
      stopCamera();
      if (cameraStreamContainer) cameraStreamContainer.style.display = 'none';

      const reader = new FileReader();
      reader.onload = (event) => {
        if (imagePreview) imagePreview.src = event.target.result;
        if (previewWrapper) previewWrapper.style.display = 'block';
        validateForm();
      };
      reader.readAsDataURL(file);
    });
  }

  // Remove photo action
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
      selectedFile = null;
      if (fileInput) fileInput.value = '';
      if (imagePreview) imagePreview.src = '';
      if (previewWrapper) previewWrapper.style.display = 'none';
      validateForm();
      
      // Reset filter selection back to Normal
      resetFilter();
    });
  }

  // Form validation
  const validateForm = () => {
    if (!guestNameInput || !submitBtn) return;
    const isNameValid = guestNameInput.value.trim().length > 0;
    const hasPhoto = selectedFile !== null;
    submitBtn.disabled = !(isNameValid && hasPhoto);
  };

  if (guestNameInput) {
    guestNameInput.addEventListener('input', validateForm);
  }

  // Helper to resize/compress image before uploading (only if uploaded via file chooser)
  const compressImage = (fileOrBlob) => {
    return new Promise((resolve, reject) => {
      // If it's already a compressed blob captured from the canvas, skip re-compression
      if (fileOrBlob instanceof Blob && !(fileOrBlob instanceof File)) {
        resolve(fileOrBlob);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(fileOrBlob);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_size = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas compression failed'));
            }
          }, 'image/jpeg', 0.82);
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // Handle upload submission
  if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedFile) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';

      try {
        const compressedBlob = await compressImage(selectedFile);
        
        const formData = new FormData();
        formData.append('guestName', guestNameInput.value.trim());
        formData.append('message', guestMessageInput ? guestMessageInput.value.trim() : '');
        formData.append('photo', compressedBlob, 'photo.jpg');

        const response = await fetch(`/api/photos/upload?event=${encodeURIComponent(eventId)}`, {
          method: 'POST',
          body: formData
        });

        const result = await response.json();
        if (response.ok && result.success) {
          uploadForm.reset();
          selectedFile = null;
          if (fileInput) fileInput.value = '';
          if (imagePreview) imagePreview.src = '';
          if (previewWrapper) previewWrapper.style.display = 'none';
          if (charCountEl) charCountEl.textContent = '0';
          
          resetFilter();

          // Restore submit button text
          submitBtn.textContent = 'Enviar a la Pantalla';

          if (uploadCard) uploadCard.style.display = 'none';
          if (successCard) successCard.style.display = 'block';
        } else {
          showToast(result.error || 'Hubo un error al subir la foto.', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enviar a la Pantalla';
        }
      } catch (err) {
        console.error(err);
        showToast('Error de conexión al subir la foto.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar a la Pantalla';
      }
    });
  }

  // Upload another photo click
  if (uploadAnotherBtn) {
    uploadAnotherBtn.addEventListener('click', () => {
      if (successCard) successCard.style.display = 'none';
      if (uploadCard) uploadCard.style.display = 'block';
      if (submitBtn) submitBtn.textContent = 'Enviar a la Pantalla';
      validateForm();
      resetFilter();
    });
  }
});

