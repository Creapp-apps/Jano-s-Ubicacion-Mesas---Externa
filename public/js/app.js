document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('guest-name-input');
  const suggestionsBox = document.getElementById('suggestions-box');
  const searchCard = document.getElementById('search-card');
  const searchForm = document.getElementById('search-form');
  const ticketWrapper = document.getElementById('ticket-wrapper');
  const resultName = document.getElementById('result-name');
  const resultTable = document.getElementById('result-table');
  const btnSearchAgain = document.getElementById('btn-search-again');
  const eventSubtitle = document.getElementById('event-subtitle');
  const onboardingCard = document.getElementById('onboarding-card');
  const startSearchBtn = document.getElementById('btn-start-search');
  
  if (startSearchBtn && onboardingCard && searchCard) {
    startSearchBtn.addEventListener('click', () => {
      onboardingCard.style.opacity = '0';
      onboardingCard.style.transform = 'scale(0.95)';
      onboardingCard.style.transition = 'all 0.4s ease-in-out';
      
      setTimeout(() => {
        onboardingCard.style.display = 'none';
        searchCard.style.display = 'block';
        searchCard.style.opacity = '0';
        searchCard.style.transform = 'scale(0.95)';
        
        // Force reflow
        void searchCard.offsetWidth;
        
        searchCard.style.transition = 'all 0.4s ease-in-out';
        searchCard.style.opacity = '1';
        searchCard.style.transform = 'scale(1)';
        
        setTimeout(() => {
          nameInput.focus();
        }, 400);
      }, 400);
    });
  }
  
  // Extract event query parameter for multi-tenancy
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('event') || 'default';
  
  // Load dynamic event title config
  fetch(`/api/config?event=${encodeURIComponent(eventId)}`)
    .then(res => res.json())
    .then(data => {
      if (data && data.eventTitle) {
        eventSubtitle.textContent = data.eventTitle;
      }
    })
    .catch(err => console.error('Error loading event title:', err));
  
  let debounceTimeout = null;
  let activeSuggestions = [];

  // Debounced input handler for autocomplete
  nameInput.addEventListener('input', (e) => {
    const value = e.target.value.trim();
    
    clearTimeout(debounceTimeout);
    
    if (value.length < 2) {
      hideSuggestions();
      return;
    }
    
    debounceTimeout = setTimeout(() => {
      fetchSuggestions(value);
    }, 200);
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!nameInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
      hideSuggestions();
    }
  });

  // Handle Form Submission
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = nameInput.value.trim();
    
    if (!value) return;
    
    // If we have suggestions, check if the exact text matches one
    if (activeSuggestions.length > 0) {
      // Find exact or closest match
      const exactMatch = activeSuggestions.find(
        g => `${g.firstName} ${g.lastName}`.toLowerCase() === value.toLowerCase()
      );
      
      if (exactMatch) {
        selectGuest(exactMatch);
        return;
      }
    }
    
    // Otherwise query backend directly for search
    searchDirectly(value);
  });

  // Back button on ticket
  btnSearchAgain.addEventListener('click', () => {
    resetView();
  });

  // Fetch suggestions helper
  function fetchSuggestions(query) {
    fetch(`/api/guests/search?q=${encodeURIComponent(query)}&event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(data => {
        activeSuggestions = data;
        renderSuggestions(data);
      })
      .catch(err => {
        console.error('Error fetching suggestions:', err);
      });
  }

  // Render suggestions helper
  function renderSuggestions(guests) {
    suggestionsBox.innerHTML = '';
    
    if (guests.length === 0) {
      const emptyLi = document.createElement('li');
      emptyLi.className = 'suggestion-item';
      emptyLi.style.color = '#a0a0a5';
      emptyLi.style.cursor = 'default';
      emptyLi.textContent = 'No se encontraron coincidencias';
      suggestionsBox.appendChild(emptyLi);
      suggestionsBox.style.display = 'block';
      return;
    }
    
    guests.forEach(g => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
      li.textContent = `${g.firstName} ${g.lastName}`;
      li.addEventListener('click', () => {
        nameInput.value = `${g.firstName} ${g.lastName}`;
        hideSuggestions();
        selectGuest(g);
      });
      suggestionsBox.appendChild(li);
    });
    
    suggestionsBox.style.display = 'block';
  }

  function hideSuggestions() {
    suggestionsBox.style.display = 'none';
  }

  // Search directly on server
  function searchDirectly(query) {
    fetch(`/api/guests/search?q=${encodeURIComponent(query)}&event=${encodeURIComponent(eventId)}`)
      .then(res => res.json())
      .then(data => {
        if (data.length === 0) {
          showError('No se encontró ningún invitado con ese nombre.');
        } else if (data.length === 1) {
          selectGuest(data[0]);
        } else {
          // Multiple results, show suggestions so they can choose
          activeSuggestions = data;
          renderSuggestions(data);
          showError('Se encontraron múltiples coincidencias. Selecciona tu nombre de la lista.');
        }
      })
      .catch(err => {
        console.error('Error on search:', err);
        showError('Ocurrió un error al realizar la búsqueda.');
      });
  }

  // Show inline error feedback elegantly
  function showError(msg) {
    // Remove existing error if any
    const existingErr = document.getElementById('search-error');
    if (existingErr) existingErr.remove();

    const errDiv = document.createElement('div');
    errDiv.id = 'search-error';
    errDiv.style.color = '#e71d36';
    errDiv.style.fontSize = '0.85rem';
    errDiv.style.marginTop = '12px';
    errDiv.style.textAlign = 'center';
    errDiv.textContent = msg;
    
    searchForm.appendChild(errDiv);
    
    // Auto-remove error message on type
    nameInput.addEventListener('input', () => {
      errDiv.remove();
    }, { once: true });
  }

  function formatTableDisplay(table) {
    if (!table) return 'Sin Mesa';
    const t = String(table).trim();
    if (t.toLowerCase() === 'sin mesa') return 'Sin Mesa';
    if (/^mesa\b/i.test(t)) {
      return t.charAt(0).toUpperCase() + t.slice(1);
    }
    return `Mesa ${t}`;
  }

  // Select guest and animate VIP ticket reveal
  function selectGuest(guest) {
    // Remove errors
    const existingErr = document.getElementById('search-error');
    if (existingErr) existingErr.remove();

    // Set details
    resultName.textContent = `${guest.firstName} ${guest.lastName}`;
    resultTable.textContent = formatTableDisplay(guest.table);

    // Transition out search card and reveal ticket
    searchCard.style.opacity = '0';
    searchCard.style.transform = 'scale(0.95)';
    
    setTimeout(() => {
      searchCard.style.display = 'none';
      ticketWrapper.style.display = 'block';
    }, 400);
  }

  // Reset view to search again
  function resetView() {
    ticketWrapper.style.display = 'none';
    searchCard.style.display = 'block';
    
    // Trigger Reflow to animate entrance
    void searchCard.offsetWidth;
    
    searchCard.style.opacity = '1';
    searchCard.style.transform = 'scale(1)';
    nameInput.value = '';
    activeSuggestions = [];
    nameInput.focus();
  }
});
