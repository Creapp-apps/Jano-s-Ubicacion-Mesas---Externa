# Cinematic Interactive Invitation & 3D Carousel Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the guest invitation from a standard scroll page into a high-end cinematic slide deck with 3D card flipping for Dress Code/Registry details, and a premium 3D photo carousel supporting up to 5 custom images.

**Architecture:** Group invitation DOM sections into sequential slides controlled by a bottom navigation state, utilizing GSAP for fluid exit/entry animations. The Dress Code/Registry will reside on a single 3D CSS card flipping on the Y-axis. The Photo Carousel will arrange 5 images in 3D space, updating their `translateX`, `scale`, `rotateY`, `zIndex` and `opacity` dynamically via GSAP for a cinematic Coverflow look.

**Tech Stack:** Vanilla HTML5, Vanilla CSS3 (3D Transforms & Perspective), JavaScript (ES6), GSAP (GreenSock Animation Platform)

---

### Task 1: Backend API Configuration Expansion

**Files:**
- Modify: `server.js:264-315` (GET Handler)
- Modify: `server.js:358-400` (POST Handler)
- Test: Manual curl configuration verification

**Step 1: Write verification commands**
Prepare a curl command to verify configuration:
```bash
curl -X GET "http://localhost:3000/api/config?event=default"
```

**Step 2: Update GET handler in server.js**
Add retrieval of `invitation_photo_1` to `invitation_photo_5` in `server.js`:
```javascript
    const invitationPhoto1 = await db.getConfigValue(eventId, 'invitation_photo_1', '');
    const invitationPhoto2 = await db.getConfigValue(eventId, 'invitation_photo_2', '');
    const invitationPhoto3 = await db.getConfigValue(eventId, 'invitation_photo_3', '');
    const invitationPhoto4 = await db.getConfigValue(eventId, 'invitation_photo_4', '');
    const invitationPhoto5 = await db.getConfigValue(eventId, 'invitation_photo_5', '');

    // Include in JSON response:
    res.json({
      // ... existing fields ...
      invitationPhoto1,
      invitationPhoto2,
      invitationPhoto3,
      invitationPhoto4,
      invitationPhoto5,
      // ... snapApiToken etc ...
    });
```

**Step 3: Update POST handler in server.js**
Add writing of `invitationPhoto1` to `invitationPhoto5` in `server.js`:
```javascript
  const { 
    // ... existing ...
    invitationPhoto1,
    invitationPhoto2,
    invitationPhoto3,
    invitationPhoto4,
    invitationPhoto5
  } = req.body;

  // ... inside try ...
  if (invitationPhoto1 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_1', invitationPhoto1);
  if (invitationPhoto2 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_2', invitationPhoto2);
  if (invitationPhoto3 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_3', invitationPhoto3);
  if (invitationPhoto4 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_4', invitationPhoto4);
  if (invitationPhoto5 !== undefined) await db.setConfigValue(eventId, 'invitation_photo_5', invitationPhoto5);
```

**Step 4: Verify endpoint returns new fields**
Expected: JSON payload contains `invitationPhoto1` to `invitationPhoto5` properties.

---

### Task 2: Admin Dashboard Carousel Customization UI

**Files:**
- Modify: `private/admin.html:430-441`
- Modify: `public/js/admin.js:305-320`
- Modify: `public/js/admin.js:845-855`
- Modify: `public/js/admin.js:1375-1390`
- Modify: `public/js/admin.js:1785-1815`

**Step 1: Add inputs to admin.html**
Insert the HTML input fields for the 5 carousel photos in the "Diseño" subtab:
```html
<div class="moderation-section-header" style="margin-top: 25px; margin-bottom: 15px;">
  <h3>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
    Galería de Fotos de la Invitación (Carrusel)
  </h3>
</div>
<p style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.5; margin-bottom: 20px;">
  Ingresa las URLs de las 5 fotos para el carrusel interactivo 3D.
</p>
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; text-align: left; margin-bottom: 20px;">
  <div style="grid-column: span 2;">
    <label style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--gold-primary); margin-bottom: 8px; font-weight: 600;">Foto 1 (Portada del Carrusel)</label>
    <input type="url" id="inv-photo-1" class="form-control-admin" placeholder="Ej. https://tuservidor.com/foto1.jpg">
  </div>
  <div>
    <label style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--gold-primary); margin-bottom: 8px; font-weight: 600;">Foto 2</label>
    <input type="url" id="inv-photo-2" class="form-control-admin" placeholder="Ej. https://tuservidor.com/foto2.jpg">
  </div>
  <div>
    <label style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--gold-primary); margin-bottom: 8px; font-weight: 600;">Foto 3</label>
    <input type="url" id="inv-photo-3" class="form-control-admin" placeholder="Ej. https://tuservidor.com/foto3.jpg">
  </div>
  <div>
    <label style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--gold-primary); margin-bottom: 8px; font-weight: 600;">Foto 4</label>
    <input type="url" id="inv-photo-4" class="form-control-admin" placeholder="Ej. https://tuservidor.com/foto4.jpg">
  </div>
  <div>
    <label style="display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--gold-primary); margin-bottom: 8px; font-weight: 600;">Foto 5</label>
    <input type="url" id="inv-photo-5" class="form-control-admin" placeholder="Ej. https://tuservidor.com/foto5.jpg">
  </div>
</div>
```

**Step 2: Map inputs in admin.js**
Extract element references and map them to load, save, and real-time preview functions.
In DOM extraction:
```javascript
  const invPhoto1 = document.getElementById('inv-photo-1');
  const invPhoto2 = document.getElementById('inv-photo-2');
  const invPhoto3 = document.getElementById('inv-photo-3');
  const invPhoto4 = document.getElementById('inv-photo-4');
  const invPhoto5 = document.getElementById('inv-photo-5');
```
In load data handler:
```javascript
        if (invPhoto1) invPhoto1.value = data.invitationPhoto1 || '';
        if (invPhoto2) invPhoto2.value = data.invitationPhoto2 || '';
        if (invPhoto3) invPhoto3.value = data.invitationPhoto3 || '';
        if (invPhoto4) invPhoto4.value = data.invitationPhoto4 || '';
        if (invPhoto5) invPhoto5.value = data.invitationPhoto5 || '';
```
In save data payload builder:
```javascript
      invitationPhoto1: invPhoto1 ? invPhoto1.value.trim() : '',
      invitationPhoto2: invPhoto2 ? invPhoto2.value.trim() : '',
      invitationPhoto3: invPhoto3 ? invPhoto3.value.trim() : '',
      invitationPhoto4: invPhoto4 ? invPhoto4.value.trim() : '',
      invitationPhoto5: invPhoto5 ? invPhoto5.value.trim() : '',
```
In `updateRealTimePreview` payload:
```javascript
      invPhoto1: invPhoto1 ? invPhoto1.value.trim() : '',
      invPhoto2: invPhoto2 ? invPhoto2.value.trim() : '',
      invPhoto3: invPhoto3 ? invPhoto3.value.trim() : '',
      invPhoto4: invPhoto4 ? invPhoto4.value.trim() : '',
      invPhoto5: invPhoto5 ? invPhoto5.value.trim() : '',
```
Register change/input event listeners on `invPhoto1`-`invPhoto5`.

---

### Task 3: CSS Styles for Cinematic Decks, Flipping, and Carousels

**Files:**
- Modify: `public/css/invitacion.css` (Append new classes at the end)

**Step 1: CSS Implementation**
Add layout, flipping, and 3D carousel styles:
```css
/* Cinematic Slides Styling */
.invitation-deck {
  position: relative;
  width: 100%;
  min-height: 520px;
}
.invitation-slide {
  display: none;
  opacity: 0;
  transform: translateY(30px) scale(0.98);
  width: 100%;
}
.invitation-slide.active {
  display: block;
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Floating Navigation Bar */
.invitation-nav-bar {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 500px;
  background: rgba(11, 11, 12, 0.85);
  border: 1px solid var(--border-gold);
  border-radius: 20px;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  z-index: 999;
  box-shadow: 0 10px 30px rgba(0,0,0,0.8);
}
.nav-arrow {
  background: none;
  border: none;
  color: var(--gold-primary);
  font-family: var(--font-family-title), serif;
  font-size: 0.85rem;
  letter-spacing: 1px;
  cursor: pointer;
  padding: 6px 12px;
  transition: opacity 0.3s ease;
}
.nav-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.nav-dots {
  display: flex;
  gap: 8px;
}
.nav-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.2);
  cursor: pointer;
  transition: all 0.3s ease;
}
.nav-dot.active {
  background: var(--gold-primary);
  transform: scale(1.3);
  box-shadow: 0 0 8px var(--gold-primary);
}

/* 3D Flipping Card Styling */
.flip-card-container {
  perspective: 1500px;
  width: 100%;
  min-height: 420px;
  margin-bottom: 20px;
}
.flip-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}
.flip-card-inner.flipped {
  transform: rotateY(180deg);
}
.flip-card-front, .flip-card-back {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 24px;
  border: 1px solid var(--border-gold);
  background: var(--bg-card);
  padding: 30px 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.flip-card-back {
  transform: rotateY(180deg);
}

/* 3D Photo Carousel */
.carousel-container {
  position: relative;
  width: 100%;
  height: 300px;
  perspective: 1200px;
  overflow: hidden;
  margin: 20px 0;
}
.carousel-track {
  position: absolute;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}
.carousel-item {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 180px;
  height: 240px;
  margin-top: -120px;
  margin-left: -90px;
  border-radius: 16px;
  border: 2px solid var(--gold-primary);
  background: #111;
  overflow: hidden;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5), 0 0 15px rgba(212,175,55,0.2);
  transition: filter 0.5s ease;
  cursor: pointer;
}
.carousel-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.carousel-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-top: 15px;
}
.carousel-arrow {
  background: rgba(22, 22, 25, 0.6);
  border: 1px solid var(--border-gold);
  color: var(--gold-primary);
  font-size: 1.1rem;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}
.carousel-arrow:hover {
  background: var(--gold-primary);
  color: black;
}
.carousel-dots {
  display: flex;
  gap: 6px;
}
.carousel-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,255,255,0.3);
  cursor: pointer;
  transition: all 0.3s ease;
}
.carousel-dot.active {
  background: var(--gold-primary);
  transform: scale(1.2);
}
```

---

### Task 4: Interactive Scripting and Layout Restructuring in Invitation

**Files:**
- Modify: `public/invitacion.html:54-282` (HTML Restructuring)
- Modify: `public/invitacion.html:286-350` (DOM mapping)
- Modify: `public/invitacion.html:660-800` (Load URLs & Fallbacks)
- Modify: `public/invitacion.html:820-910` (Transition & Carousel logic)

**Step 1: Restructure HTML into Slides & Cards**
Re-organize Sections inside `.invitation-content` into slides, and combine dresscode + registry into a flip card:
```html
  <div class="invitation-content" id="invitation-main" style="padding-bottom: 120px;">
    <!-- Deck Wrapper -->
    <div class="invitation-deck">
      
      <!-- Slide 1: Portada y Cuenta Regresiva -->
      <div class="invitation-slide active" id="slide-0">
        <!-- Hero Section content -->
        <!-- Countdown Section content -->
      </div>

      <!-- Slide 2: Ubicación y Calendario -->
      <div class="invitation-slide" id="slide-1">
        <!-- Location Section content -->
      </div>

      <!-- Slide 3: Detalles (Girar) -->
      <div class="invitation-slide" id="slide-2">
        <div class="flip-card-container">
          <div class="flip-card-inner" id="flip-card-inner">
            <!-- Front: Dress Code -->
            <div class="flip-card-front">
              <!-- Dress code content -->
              <button class="btn-gold" id="btn-flip-gift" style="margin-top: 20px;">Mesa de Regalos &rarr;</button>
            </div>
            <!-- Back: Gift Registry -->
            <div class="flip-card-back">
              <!-- Gift registry bank card content -->
              <button class="btn-gold btn-secondary-lux" id="btn-flip-dress" style="margin-top: 20px;">&larr; Vestimenta</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Slide 4: Galería de Fotos (3D Carousel) -->
      <div class="invitation-slide" id="slide-3">
        <h2 class="hero-subtitle" style="margin-bottom: 10px;">Nuestra Galería</h2>
        <p class="event-details" style="font-size: 0.8rem; color: var(--text-muted);">Desliza o presiona para navegar por las fotos</p>
        
        <div class="carousel-container">
          <div class="carousel-track" id="carousel-track">
            <div class="carousel-item" data-idx="0"><img id="carousel-img-0" src="" alt="Foto 1"></div>
            <div class="carousel-item" data-idx="1"><img id="carousel-img-1" src="" alt="Foto 2"></div>
            <div class="carousel-item" data-idx="2"><img id="carousel-img-2" src="" alt="Foto 3"></div>
            <div class="carousel-item" data-idx="3"><img id="carousel-img-3" src="" alt="Foto 4"></div>
            <div class="carousel-item" data-idx="4"><img id="carousel-img-4" src="" alt="Foto 5"></div>
          </div>
          <div class="carousel-controls">
            <button class="carousel-arrow" id="carousel-prev-btn">&larr;</button>
            <div class="carousel-dots" id="carousel-dots-container">
              <span class="carousel-dot active" data-idx="0"></span>
              <span class="carousel-dot" data-idx="1"></span>
              <span class="carousel-dot" data-idx="2"></span>
              <span class="carousel-dot" data-idx="3"></span>
              <span class="carousel-dot" data-idx="4"></span>
            </div>
            <button class="carousel-arrow" id="carousel-next-btn">&rarr;</button>
          </div>
        </div>
      </div>

      <!-- Slide 5: Confirmaciones y Fotos en vivo -->
      <div class="invitation-slide" id="slide-4">
        <!-- RSVP Form Section content -->
        <!-- Live Photos Section content -->
        <!-- Spotify Embed container -->
      </div>
      
    </div>

    <!-- Navigation dots / Arrows bar -->
    <div class="invitation-nav-bar" id="invitation-nav-bar">
      <button class="nav-arrow" id="btn-slide-prev" disabled>&larr; Anterior</button>
      <div class="nav-dots" id="slide-nav-dots">
        <span class="nav-dot active" data-slide="0"></span>
        <span class="nav-dot" data-slide="1"></span>
        <span class="nav-dot" data-slide="2"></span>
        <span class="nav-dot" data-slide="3"></span>
        <span class="nav-dot" data-slide="4"></span>
      </div>
      <button class="nav-arrow" id="btn-slide-next">Siguiente &rarr;</button>
    </div>
  </div>
```

**Step 2: Map variables and assets fallbacks**
Define default high-quality asset URLs if config is empty:
```javascript
      const defaultPhotos = [
        "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=600", // Wedding couple
        "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=600", // Rings/decoration
        "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?q=80&w=600", // Party/fiesta
        "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?q=80&w=600", // Champagne toast
        "https://images.unsplash.com/photo-1504196606672-aef5c9cefc92?q=80&w=600"  // Party lights
      ];
```

**Step 3: Implement Flip Card & Slide Transitions**
Map elements and bind event listeners:
```javascript
      // Slide State
      let activeSlide = 0;
      const totalSlides = 5;
      
      const slides = Array.from({ length: totalSlides }, (_, i) => document.getElementById(`slide-${i}`));
      const dots = Array.from(document.querySelectorAll('#slide-nav-dots .nav-dot'));
      const btnPrev = document.getElementById('btn-slide-prev');
      const btnNext = document.getElementById('btn-slide-next');
      
      // Card Flip
      const flipInner = document.getElementById('flip-card-inner');
      const btnFlipGift = document.getElementById('btn-flip-gift');
      const btnFlipDress = document.getElementById('btn-flip-dress');
      
      if (btnFlipGift && flipInner) btnFlipGift.addEventListener('click', () => flipInner.classList.add('flipped'));
      if (btnFlipDress && flipInner) btnFlipDress.addEventListener('click', () => flipInner.classList.remove('flipped'));

      function goToSlide(index) {
        if (index < 0 || index >= totalSlides || index === activeSlide) return;
        
        const currentSlide = slides[activeSlide];
        const nextSlide = slides[index];
        
        // GSAP transition
        gsap.timeline()
          .to(currentSlide, { opacity: 0, y: -20, duration: 0.4, onComplete: () => {
            currentSlide.classList.remove('active');
            nextSlide.classList.add('active');
            
            // Trigger 3D carousel initial draw if revealing slide 3
            if (index === 3) updateCarousel();
          }})
          .fromTo(nextSlide, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 });
        
        // Update nav dots & button states
        dots[activeSlide].classList.remove('active');
        dots[index].classList.add('active');
        
        activeSlide = index;
        btnPrev.disabled = (activeSlide === 0);
        btnNext.disabled = (activeSlide === totalSlides - 1);
      }
      
      if (btnPrev) btnPrev.addEventListener('click', () => goToSlide(activeSlide - 1));
      if (btnNext) btnNext.addEventListener('click', () => goToSlide(activeSlide + 1));
      dots.forEach((dot, idx) => dot.addEventListener('click', () => goToSlide(idx)));
```

**Step 4: Implement 3D Photo Carousel**
```javascript
      // 3D Carousel State
      let activeCarouselIndex = 0;
      const totalCarouselItems = 5;
      const carouselTrack = document.getElementById('carousel-track');
      const carouselItems = Array.from(document.querySelectorAll('.carousel-item'));
      const carouselDots = Array.from(document.querySelectorAll('#carousel-dots-container .carousel-dot'));
      
      function updateCarousel() {
        carouselItems.forEach((item, index) => {
          let diff = index - activeCarouselIndex;
          
          // circular distance
          if (diff < -2) diff += totalCarouselItems;
          if (diff > 2) diff -= totalCarouselItems;
          
          const absDiff = Math.abs(diff);
          
          const xVal = diff * 70; // translation spacing in px
          const zVal = -absDiff * 80; // depth spacing
          const rYVal = diff * -25; // 3D Y rotation angle
          const scaleVal = 1 - absDiff * 0.15;
          const opacityVal = absDiff > 2 ? 0 : (1 - absDiff * 0.35);
          
          gsap.to(item, {
            x: xVal,
            z: zVal,
            rotationY: rYVal,
            scale: scaleVal,
            opacity: opacityVal,
            zIndex: 10 - absDiff,
            duration: 0.6,
            ease: 'power2.out'
          });
        });
        
        carouselDots.forEach((dot, index) => {
          if (index === activeCarouselIndex) dot.classList.add('active');
          else dot.classList.remove('active');
        });
      }
      
      document.getElementById('carousel-prev-btn').addEventListener('click', () => {
        activeCarouselIndex = (activeCarouselIndex - 1 + totalCarouselItems) % totalCarouselItems;
        updateCarousel();
      });
      document.getElementById('carousel-next-btn').addEventListener('click', () => {
        activeCarouselIndex = (activeCarouselIndex + 1) % totalCarouselItems;
        updateCarousel();
      });
      carouselDots.forEach((dot, idx) => dot.addEventListener('click', () => {
        activeCarouselIndex = idx;
        updateCarousel();
      }));
      carouselItems.forEach((item, idx) => item.addEventListener('click', () => {
        activeCarouselIndex = idx;
        updateCarousel();
      }));
```

**Step 5: Bind config photo loads & postMessage update listeners**
When loading initial config:
```javascript
          const p1 = data.invitationPhoto1 || defaultPhotos[0];
          const p2 = data.invitationPhoto2 || defaultPhotos[1];
          const p3 = data.invitationPhoto3 || defaultPhotos[2];
          const p4 = data.invitationPhoto4 || defaultPhotos[3];
          const p5 = data.invitationPhoto5 || defaultPhotos[4];
          document.getElementById('carousel-img-0').src = p1;
          document.getElementById('carousel-img-1').src = p2;
          document.getElementById('carousel-img-2').src = p3;
          document.getElementById('carousel-img-3').src = p4;
          document.getElementById('carousel-img-4').src = p5;
```
Inside the `invitation-preview-update` event receiver, update images:
```javascript
          if (config.invPhoto1) document.getElementById('carousel-img-0').src = config.invPhoto1;
          if (config.invPhoto2) document.getElementById('carousel-img-1').src = config.invPhoto2;
          if (config.invPhoto3) document.getElementById('carousel-img-2').src = config.invPhoto3;
          if (config.invPhoto4) document.getElementById('carousel-img-3').src = config.invPhoto4;
          if (config.invPhoto5) document.getElementById('carousel-img-4').src = config.invPhoto5;
```

---

## Execution Handoff

After reviewing the plan, select the desired execution option:

**1. Subagent-Driven (this session)** - I dispatch fresh subagents per task, review between tasks, and keep fast iterations.

**2. Parallel Session (separate)** - Open a new session with `executing-plans`, performing batch execution with checkpoints.
