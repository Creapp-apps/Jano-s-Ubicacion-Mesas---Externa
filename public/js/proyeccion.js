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
  let slideshowInterval = null;
  const loopSpeed = 8000; // 8 seconds per slide
  
  // Extract event query parameter for multi-tenancy
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('event') || 'default';
  
  // 1. Fetch dynamic config title
  const fetchConfig = () => {
    fetch(`/api/config?event=${encodeURIComponent(eventId)}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.eventTitle) {
          eventTitleEl.textContent = data.eventTitle;
          emptyEventTitleEl.textContent = data.eventTitle;
        }
      })
      .catch(console.error);
  };
  
  fetchConfig();
  setInterval(fetchConfig, 60000); // refresh config once a minute

  // 2. Fetch approved photos
  const fetchPhotos = async () => {
    try {
      const response = await fetch(`/api/public/photos?event=${encodeURIComponent(eventId)}`);
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const oldLength = photos.length;
        photos = data;
        
        if (photos.length === 0) {
          // No photos approved, show empty state standby screen
          emptyState.style.display = 'flex';
          slideshowContainer.style.display = 'none';
          dedicationCardWrapper.style.display = 'none';
          stopSlideshow();
        } else {
          emptyState.style.display = 'none';
          slideshowContainer.style.display = 'block';
          dedicationCardWrapper.style.display = 'flex';
          
          if (oldLength === 0) {
            // First load or transition from empty to active
            currentIndex = 0;
            startSlideshow();
          }
        }
      }
    } catch (err) {
      console.error('Error fetching approved photos:', err);
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

  // 4. Update the active slide & dedication text
  const transitionToSlide = async (index) => {
    if (photos.length === 0) return;
    const photo = photos[index % photos.length];
    
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
        }, 100);
        
      }, 1000); // allow transition overlap
      
    } catch (err) {
      console.warn('Could not preload photo URL, skipping:', photo.photoUrl);
      // Skip to next slide immediately
      currentIndex++;
      transitionToSlide(currentIndex);
    }
  };

  const nextSlide = () => {
    currentIndex++;
    transitionToSlide(currentIndex);
  };

  const startSlideshow = () => {
    if (slideshowInterval) clearInterval(slideshowInterval);
    // Trigger initial slide
    transitionToSlide(currentIndex);
    // Setup loop
    slideshowInterval = setInterval(nextSlide, loopSpeed);
  };

  const stopSlideshow = () => {
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      slideshowInterval = null;
    }
  };

  // 5. Setup polling for live updates
  fetchPhotos();
  setInterval(fetchPhotos, 10000); // check for newly approved photos every 10 seconds
});
