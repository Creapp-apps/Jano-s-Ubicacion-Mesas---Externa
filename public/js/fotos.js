document.addEventListener('DOMContentLoaded', () => {
  const subtitleEl = document.getElementById('event-subtitle');
  const uploadForm = document.getElementById('photo-upload-form');
  const uploadCard = document.getElementById('upload-card');
  const successCard = document.getElementById('success-card');
  const onboardingCard = document.getElementById('onboarding-card');
  const startUploadBtn = document.getElementById('btn-start-upload');
  
  if (startUploadBtn && onboardingCard && uploadCard) {
    startUploadBtn.addEventListener('click', () => {
      onboardingCard.style.opacity = '0';
      onboardingCard.style.transform = 'scale(0.95)';
      onboardingCard.style.transition = 'all 0.4s ease-in-out';
      
      setTimeout(() => {
        onboardingCard.style.display = 'none';
        uploadCard.style.display = 'block';
        uploadCard.style.opacity = '0';
        uploadCard.style.transform = 'scale(0.95)';
        
        // Force reflow
        void uploadCard.offsetWidth;
        
        uploadCard.style.transition = 'all 0.4s ease-in-out';
        uploadCard.style.opacity = '1';
        uploadCard.style.transform = 'scale(1)';
        
        setTimeout(() => {
          guestNameInput.focus();
        }, 400);
      }, 400);
    });
  }
  
  const goAdminBtn = document.getElementById('btn-go-admin');
  if (goAdminBtn) {
    goAdminBtn.addEventListener('click', () => {
      window.location.href = `/admin?event=${encodeURIComponent(eventId)}&service=photos`;
    });
  }
  
  const guestNameInput = document.getElementById('guest-name-input');
  const guestMessageInput = document.getElementById('guest-message-input');
  const charCountEl = document.getElementById('char-count');
  
  const fileInput = document.getElementById('photo-file-input');
  const cameraTrigger = document.getElementById('btn-trigger-camera');
  const previewWrapper = document.getElementById('preview-wrapper');
  const imagePreview = document.getElementById('image-preview');
  const removePhotoBtn = document.getElementById('btn-remove-photo');
  
  const submitBtn = document.getElementById('btn-submit-upload');
  const uploadAnotherBtn = document.getElementById('btn-upload-another');
  
  let selectedFile = null;

  // Extract event query parameter for multi-tenancy
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('event') || 'default';

  // 1. Load dynamic event title
  fetch(`/api/config?event=${encodeURIComponent(eventId)}`)
    .then(r => r.json())
    .then(data => {
      if (data && data.eventTitle) {
        subtitleEl.textContent = data.eventTitle;
      }
    })
    .catch(() => {
      subtitleEl.textContent = "Salón de Eventos";
    });

  // 2. Character counter for the greeting message
  guestMessageInput.addEventListener('input', () => {
    const len = guestMessageInput.value.length;
    charCountEl.textContent = len;
    if (len >= 200) {
      charCountEl.style.color = '#ff3333';
    } else {
      charCountEl.style.color = 'var(--text-muted)';
    }
  });

  // 3. Trigger native camera / file chooser
  cameraTrigger.addEventListener('click', () => {
    fileInput.click();
  });

  // 4. File input change handler
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      showToast('Por favor, selecciona un archivo de imagen válido.', 'error');
      return;
    }

    selectedFile = file;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      previewWrapper.style.display = 'block';
      cameraTrigger.style.display = 'none';
      validateForm();
    };
    reader.readAsDataURL(file);
  });

  // 5. Remove photo action
  removePhotoBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    imagePreview.src = '';
    previewWrapper.style.display = 'none';
    cameraTrigger.style.display = 'flex';
    validateForm();
  });

  // 6. Form validation
  const validateForm = () => {
    const isNameValid = guestNameInput.value.trim().length > 0;
    const hasPhoto = selectedFile !== null;
    submitBtn.disabled = !(isNameValid && hasPhoto);
  };

  guestNameInput.addEventListener('input', validateForm);

  // Helper to resize/compress image before uploading
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_size = 1200; // Resize to a max size of 1200px for speed/storage
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

          // Convert to Blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas compression failed'));
            }
          }, 'image/jpeg', 0.82); // 82% JPEG quality is optimal size/quality ratio
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // 7. Handle upload submission
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      // Compress the image first
      const compressedBlob = await compressImage(selectedFile);
      
      const formData = new FormData();
      formData.append('guestName', guestNameInput.value.trim());
      formData.append('message', guestMessageInput.value.trim());
      // Append compressed image file
      formData.append('photo', compressedBlob, 'photo.jpg');

      const response = await fetch(`/api/photos/upload?event=${encodeURIComponent(eventId)}`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (response.ok && result.success) {
        // Clean form and show success card
        uploadForm.reset();
        selectedFile = null;
        fileInput.value = '';
        imagePreview.src = '';
        previewWrapper.style.display = 'none';
        cameraTrigger.style.display = 'flex';
        charCountEl.textContent = '0';
        
        uploadCard.style.display = 'none';
        successCard.style.display = 'block';
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

  // 8. Upload another photo click
  uploadAnotherBtn.addEventListener('click', () => {
    successCard.style.display = 'none';
    uploadCard.style.display = 'block';
    validateForm();
  });
});
