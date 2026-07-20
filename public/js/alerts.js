// Inject styles dynamically on load
(function injectStyles() {
  const styles = `
    .custom-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100000;
      opacity: 0;
      transition: opacity 0.25s ease;
    }
    .custom-modal-overlay.active {
      opacity: 1;
    }
    .custom-modal-card {
      background: rgba(18, 18, 18, 0.95);
      border: 1px solid #d4af37;
      border-radius: 20px;
      width: 90%;
      max-width: 440px;
      padding: 30px 25px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6), 0 0 35px rgba(212, 175, 55, 0.15);
      transform: scale(0.9);
      transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
      text-align: center;
      color: #ffffff;
    }
    .custom-modal-overlay.active .custom-modal-card {
      transform: scale(1);
    }
    .custom-modal-title {
      font-family: 'Cinzel', serif;
      color: #d4af37;
      font-size: 1.4rem;
      margin-top: 0;
      margin-bottom: 18px;
      font-weight: 600;
      letter-spacing: 1px;
    }
    .custom-modal-text {
      font-family: 'Montserrat', sans-serif;
      color: #cbd5e0;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 28px;
    }
    .custom-modal-footer {
      display: flex;
      justify-content: center;
      gap: 15px;
    }
    .custom-modal-btn {
      font-family: 'Montserrat', sans-serif;
      padding: 10px 26px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      outline: none;
    }
    .custom-modal-btn-cancel {
      background: transparent;
      border: 1px solid #4a5568;
      color: #a0aec0;
    }
    .custom-modal-btn-cancel:hover {
      border-color: #a0aec0;
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }
    .custom-modal-btn-confirm {
      background: linear-gradient(135deg, #d4af37, #aa8c2c);
      border: none;
      color: #000000;
      box-shadow: 0 4px 10px rgba(212, 175, 55, 0.2);
    }
    .custom-modal-btn-confirm:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba(212, 175, 55, 0.3);
      filter: brightness(1.1);
    }
    
    /* Toast alerts */
    .custom-toast-container {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 100001;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 350px;
      width: 90%;
    }
    .custom-toast {
      background: rgba(18, 18, 18, 0.95);
      border: 1px solid var(--card-border, #d4af37);
      border-left: 4px solid #d4af37;
      border-radius: 12px;
      padding: 15px 20px;
      color: #ffffff;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      font-family: 'Montserrat', sans-serif;
      font-size: 0.85rem;
      font-weight: 500;
      line-height: 1.4;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      transform: translateX(120%);
      opacity: 0;
      transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .custom-toast.active {
      transform: translateX(0);
      opacity: 1;
    }
    .custom-toast-success {
      border-left-color: #2ec4b6;
      border-color: rgba(46, 196, 182, 0.3);
    }
    .custom-toast-error {
      border-left-color: #e71d54;
      border-color: rgba(231, 29, 54, 0.3);
    }
    .custom-toast-close {
      background: transparent;
      border: none;
      color: #a0aec0;
      font-size: 1.1rem;
      cursor: pointer;
      line-height: 1;
      padding: 0;
    }
    .custom-toast-close:hover {
      color: #ffffff;
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.innerHTML = styles;
  document.head.appendChild(styleEl);
})();

// Custom Confirm implementation returning a Promise
window.customConfirm = function(title, message) {
  return new Promise((resolve) => {
    // Create DOM structure
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    
    overlay.innerHTML = `
      <div class="custom-modal-card">
        <h3 class="custom-modal-title">${title}</h3>
        <p class="custom-modal-text">${message}</p>
        <div class="custom-modal-footer">
          <button class="custom-modal-btn custom-modal-btn-cancel" id="custom-modal-cancel">Cancelar</button>
          <button class="custom-modal-btn custom-modal-btn-confirm" id="custom-modal-confirm">Aceptar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Force reflow and animate in
    overlay.offsetHeight; 
    overlay.classList.add('active');
    
    const cleanup = (value) => {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.remove();
        resolve(value);
      }, 250);
    };
    
    overlay.querySelector('#custom-modal-cancel').addEventListener('click', () => cleanup(false));
    overlay.querySelector('#custom-modal-confirm').addEventListener('click', () => cleanup(true));
  });
};

// Custom Alert implementation returning a Promise
window.customAlert = function(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    
    overlay.innerHTML = `
      <div class="custom-modal-card">
        <h3 class="custom-modal-title">${title}</h3>
        <p class="custom-modal-text">${message}</p>
        <div class="custom-modal-footer">
          <button class="custom-modal-btn custom-modal-btn-confirm" id="custom-modal-ok">Aceptar</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Force reflow and animate in
    overlay.offsetHeight;
    overlay.classList.add('active');
    
    const cleanup = () => {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 250);
    };
    
    overlay.querySelector('#custom-modal-ok').addEventListener('click', cleanup);
  });
};

// Toast Notification Manager
window.showToast = function(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.custom-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'custom-toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `custom-toast custom-toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button class="custom-toast-close">&times;</button>
  `;
  
  container.appendChild(toast);
  
  // Force reflow and animate in
  toast.offsetHeight;
  toast.classList.add('active');
  
  const closeToast = () => {
    toast.classList.remove('active');
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    }, 350);
  };
  
  toast.querySelector('.custom-toast-close').addEventListener('click', closeToast);
  
  if (duration > 0) {
    setTimeout(closeToast, duration);
  }
};

// Global override for native alert/confirm so any standard call is upgraded automatically!
window.alert = function(message) {
  window.customAlert('Notificación', message);
};

window.confirm = function(message) {
  console.warn('[miFiestAPP ALERTS] Native confirm overridden. Please use await customConfirm instead.');
  window.customAlert('Confirmar acción', message);
  return false;
};
