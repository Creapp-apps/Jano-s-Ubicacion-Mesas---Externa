document.addEventListener('DOMContentLoaded', () => {
  const eventTitleEl = document.getElementById('event-title');
  const emptyEventTitleEl = document.getElementById('empty-event-title');
  
  const slideshowContainer = document.getElementById('slideshow-container');
  const slide1 = document.getElementById('slide-1');
  const slide2 = document.getElementById('slide-2');
  const emptyState = document.getElementById('empty-state');
  
  const dedicationCardWrapper = document.getElementById('dedication-card-wrapper');
  const dedicationCard = document.getElementById('dedication-card');
  const guestNameEl = document.getElementById('guest-name');
  const guestMessageEl = document.getElementById('guest-message');
  
  let photos = [];
  let currentIndex = 0;
  let activeSlide = 1;
  let slideshowTimeout = null;
  let isTransitioning = false;
  const loopSpeed = 8000; // 8 seconds per slide
  const screensaverInterval = 3; // Inject screensaver every 3 slides (approx 24-25 seconds)
  
  // Smart Queue & Screensaver variables
  let newPhotosQueue = [];
  const seenPhotoIds = new Set();
  let isFirstLoad = true;
  let slidesSinceLastScreensaver = 0;
  let isShowingScreensaver = false;
  
  // Extract event query parameter for multi-tenancy
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('event') || 'default';
  
  // Connectivity status elements
  const connectivityStatusEl = document.getElementById('connectivity-status');
  const connectivityTextEl = connectivityStatusEl?.querySelector('.status-text');

  const updateConnectivity = (isOnline) => {
    if (!connectivityStatusEl) return;
    if (isOnline) {
      if (connectivityStatusEl.classList.contains('offline')) {
        connectivityStatusEl.classList.remove('offline');
        if (connectivityTextEl) connectivityTextEl.textContent = 'En Línea';
      }
    } else {
      if (!connectivityStatusEl.classList.contains('offline')) {
        connectivityStatusEl.classList.add('offline');
        if (connectivityTextEl) connectivityTextEl.textContent = 'Sin Conexión';
      }
    }
  };

  // Generate dynamic QR Code pointing to the Guest View
  const generateDynamicQR = () => {
    const qrCodeContainer = document.getElementById('projector-qr-container');
    if (qrCodeContainer) {
      const siteOrigin = window.location.origin;
      const qrBaseUrl = 'https://api.qrserver.com/v1/create-qr-code/';
      const targetUrl = `${siteOrigin}/fotos?event=${encodeURIComponent(eventId)}`;
      const qrUrl = `${qrBaseUrl}?size=250x250&data=${encodeURIComponent(targetUrl)}&color=0b0b0c&bgcolor=ffffff`;
      qrCodeContainer.innerHTML = `<img src="${qrUrl}" alt="QR de Envío en Vivo" style="display: block;">`;
    }
  };

  generateDynamicQR();

  // 1. Fetch dynamic config title
  const fetchConfig = () => {
    fetch(`/api/config?event=${encodeURIComponent(eventId)}`)
      .then(r => {
        if (!r.ok) throw new Error('Config fetch failed');
        return r.json();
      })
      .then(data => {
        updateConnectivity(true);
        if (data && data.eventTitle) {
          eventTitleEl.textContent = data.eventTitle;
          emptyEventTitleEl.textContent = data.eventTitle;
        }
      })
      .catch(err => {
        console.error(err);
        updateConnectivity(false);
      });
  };
  
  fetchConfig();
  setInterval(fetchConfig, 60000); // refresh config once a minute

  // 2. Fetch approved photos
  const fetchPhotos = async () => {
    try {
      const response = await fetch(`/api/public/photos?event=${encodeURIComponent(eventId)}`);
      if (!response.ok) throw new Error('Photos fetch failed');
      const data = await response.json();
      
      updateConnectivity(true);
      
      if (Array.isArray(data)) {
        photos = data;
        
        if (photos.length === 0) {
          // No photos approved, show empty state standby screen
          isShowingScreensaver = true;
          emptyState.style.display = 'flex';
          // Force reflow
          emptyState.offsetHeight;
          emptyState.classList.add('visible');

          slideshowContainer.style.display = 'none';
          dedicationCardWrapper.style.display = 'none';
          stopSlideshow();
          seenPhotoIds.clear();
          newPhotosQueue = [];
          isFirstLoad = true;
        } else {
          // If we have photos and we are NOT currently in screensaver loop injection
          if (!isShowingScreensaver) {
            emptyState.classList.remove('visible');
            emptyState.style.display = 'none';
            slideshowContainer.style.display = 'block';
            dedicationCardWrapper.style.display = 'flex';
          }
          
          let hasNewPhotos = false;
          
          // Identify new photos
          data.forEach(photo => {
            if (!seenPhotoIds.has(photo.id)) {
              seenPhotoIds.add(photo.id);
              if (!isFirstLoad) {
                newPhotosQueue.push(photo);
                hasNewPhotos = true;
              }
            }
          });
          
          if (isFirstLoad) {
            isFirstLoad = false;
            currentIndex = 0;
            slidesSinceLastScreensaver = 0;
            startSlideshow();
          } else if (hasNewPhotos) {
            // Trigger immediate queue processing if new photos arrived
            triggerImmediateQueueProcessing();
          }
        }
      }
    } catch (err) {
      console.error('Error fetching approved photos:', err);
      updateConnectivity(false);
    }
  };

  // 3. Preload image to avoid white flickers
  const preloadImage = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve(url);
      img.onerror = () => reject(url);
    });
  };

  // 4. Display a single photo with cross-fade
  const displayPhoto = async (photo) => {
    try {
      // Preload image first
      await preloadImage(photo.photoUrl);
      
      // Select elements
      const activeElement = activeSlide === 1 ? slide1 : slide2;
      const inactiveElement = activeSlide === 1 ? slide2 : slide1;
      
      // Set background image of the inactive element
      inactiveElement.style.backgroundImage = `url('${photo.photoUrl}')`;
      
      // Animate dedication card out
      dedicationCard.classList.remove('visible');
      
      // Wait for card fadeout, then toggle active slide & update texts
      await new Promise((resolve) => {
        setTimeout(() => {
          // Switch slides
          inactiveElement.classList.add('active');
          activeElement.classList.remove('active');
          
          // Update text content
          guestNameEl.textContent = photo.guestName;
          
          if (photo.message && photo.message.trim().length > 0) {
            guestMessageEl.textContent = photo.message;
            guestMessageEl.style.display = 'block';
            dedicationCard.querySelector('.ornament').style.display = 'block';
          } else {
            guestMessageEl.style.display = 'none';
            dedicationCard.querySelector('.ornament').style.display = 'none';
          }
          
          // Toggle slide state tracker
          activeSlide = activeSlide === 1 ? 2 : 1;
          
          // Animate card back in
          setTimeout(() => {
            dedicationCard.classList.add('visible');
            resolve();
          }, 100);
          
        }, 1000); // allow transition overlap
      });
      
    } catch (err) {
      console.warn('Could not preload photo URL, skipping:', photo.photoUrl);
      // Let the caller handle the failure and proceed
      throw err;
    }
  };

  // 5. Slideshow loop execution
  const showNextPhoto = async () => {
    if (photos.length === 0 || isTransitioning) return;
    isTransitioning = true;
    
    // Check if we should inject the instructions screensaver slide
    // We show screensaver after screensaverInterval slides (approx 24-25 seconds of photo display)
    if (slidesSinceLastScreensaver >= screensaverInterval && !isShowingScreensaver) {
      isShowingScreensaver = true;
      slidesSinceLastScreensaver = 0;

      // Animate current dedication card out
      dedicationCard.classList.remove('visible');

      // Show and fade in the screensaver/instructions panel
      emptyState.style.display = 'flex';
      // Force repaint
      emptyState.offsetHeight;
      emptyState.classList.add('visible');

      isTransitioning = false;
      return;
    }

    // If we were showing the screensaver, fade it out and resume slideshow
    if (isShowingScreensaver) {
      isShowingScreensaver = false;
      emptyState.classList.remove('visible');
      setTimeout(() => {
        // Only hide if we haven't entered screensaver mode again
        if (!isShowingScreensaver && photos.length > 0) {
          emptyState.style.display = 'none';
        }
      }, 1200); // Wait for CSS transition
    }

    let photoToShow;
    let fromQueue = false;
    
    if (newPhotosQueue.length > 0) {
      photoToShow = newPhotosQueue.shift();
      fromQueue = true;
      // When showing a queued photo, adjust our currentIndex to its position in the list
      // so normal playback resumes nearby
      const idx = photos.findIndex(p => p.id === photoToShow.id);
      if (idx !== -1) currentIndex = idx;
    } else {
      // Loop normally
      currentIndex = (currentIndex + 1) % photos.length;
      photoToShow = photos[currentIndex];
    }
    
    if (!photoToShow) {
      isTransitioning = false;
      return;
    }
    
    try {
      await displayPhoto(photoToShow);
      slidesSinceLastScreensaver++;
    } catch (err) {
      // If display failed, try the next one immediately
      isTransitioning = false;
      showNextPhoto();
      return;
    }
    
    isTransitioning = false;
  };

  const runSlideshowCycle = async () => {
    await showNextPhoto();
    slideshowTimeout = setTimeout(runSlideshowCycle, loopSpeed);
  };

  const startSlideshow = () => {
    stopSlideshow();
    // Show first photo immediately
    showNextPhoto().then(() => {
      // Schedule subsequent photos
      slideshowTimeout = setTimeout(runSlideshowCycle, loopSpeed);
    });
  };

  const stopSlideshow = () => {
    if (slideshowTimeout) {
      clearTimeout(slideshowTimeout);
      slideshowTimeout = null;
    }
  };

  const triggerImmediateQueueProcessing = () => {
    // Only interrupt if we have a queued photo and we are not currently transitioning
    if (newPhotosQueue.length > 0 && !isTransitioning) {
      stopSlideshow();
      runSlideshowCycle();
    }
  };

  // 6. Setup polling for live updates (every 5 seconds)
  fetchPhotos();
  setInterval(fetchPhotos, 5000); 

  // 7. Fullscreen Toggle Logic
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const enterIcon = fullscreenBtn?.querySelector('.icon-enter');
  const exitIcon = fullscreenBtn?.querySelector('.icon-exit');

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => {
          if (enterIcon) enterIcon.style.display = 'none';
          if (exitIcon) exitIcon.style.display = 'block';
        })
        .catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
      document.exitFullscreen()
        .then(() => {
          if (enterIcon) enterIcon.style.display = 'block';
          if (exitIcon) exitIcon.style.display = 'none';
        })
        .catch(err => {
          console.error(`Error attempting to exit fullscreen: ${err.message}`);
        });
    }
  };

  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);
  }

  // Double click anywhere on the page to toggle fullscreen (ignoring clicks on the control button)
  document.addEventListener('dblclick', (e) => {
    if (fullscreenBtn && fullscreenBtn.contains(e.target)) return;
    toggleFullscreen();
  });

  // Sync state if user exits fullscreen using Esc key or browser controls
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      if (enterIcon) enterIcon.style.display = 'block';
      if (exitIcon) exitIcon.style.display = 'none';
    } else {
      if (enterIcon) enterIcon.style.display = 'none';
      if (exitIcon) exitIcon.style.display = 'block';
    }
  });

  // 8. Auto-hide mouse cursor and UI controls when idle (clean cinema presentation)
  let idleTimeout = null;
  const idleDelay = 3000; // 3 seconds of inactivity

  const resetIdleTimer = () => {
    document.body.classList.remove('user-idle');
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      document.body.classList.add('user-idle');
    }, idleDelay);
  };

  // Listen to mouse movement, clicks, and keys to reset the timer
  window.addEventListener('mousemove', resetIdleTimer);
  window.addEventListener('click', resetIdleTimer);
  window.addEventListener('keydown', resetIdleTimer);

  // Initialize idle timer
  resetIdleTimer();
});
