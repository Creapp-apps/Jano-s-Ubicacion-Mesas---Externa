/**
 * miFiestAPP - Lógica Interactiva de la Tienda de Complementos
 */

(function () {
  'use strict';

  // State
  let currentCategory = 'all';
  let searchQuery = '';
  let selectedItems = []; // Array of product IDs

  // DOM Elements
  const productsGrid = document.getElementById('products-grid');
  const searchInput = document.getElementById('search-input');
  const categoryChips = document.querySelectorAll('.category-chip');
  const modalOverlay = document.getElementById('product-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const floatingBar = document.getElementById('quotation-bar');
  const drawerOverlay = document.getElementById('cart-drawer');
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  const drawerItemsList = document.getElementById('drawer-items-list');
  const drawerTotalAmount = document.getElementById('drawer-total-amount');
  const barTotalAmount = document.getElementById('bar-total-amount');
  const barCountBadge = document.getElementById('bar-count-badge');
  const navCartBadge = document.getElementById('nav-cart-badge');
  const openDrawerBtns = document.querySelectorAll('.trigger-open-drawer');
  const whatsappButtons = document.querySelectorAll('.trigger-whatsapp-quote');
  const inputEventDate = document.getElementById('drawer-event-date');
  const inputEventSalon = document.getElementById('drawer-event-salon');

  // SVG Icons Helper
  function getCategorySvg(icon) {
    switch (icon) {
      case 'arcade':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h4m-2-2v4"/><circle cx="15" cy="11" r="1"/><circle cx="18" cy="13" r="1"/></svg>';
      case 'camera':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';
      case 'mirror':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="3"/><circle cx="12" cy="12" r="3"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>';
      case 'bus':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="3" width="16" height="16" rx="2"/><line x1="4" y1="11" x2="20" y2="11"/><circle cx="8" cy="15" r="1.5"/><circle cx="16" cy="15" r="1.5"/><path d="M6 19v2m12-2v2"/></svg>';
      case 'van':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>';
      case 'cube':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
      case 'lamp':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 21h6m-3-3v3m-4-6l-2-6h12l-2 6H8z"/><circle cx="12" cy="7" r="2"/></svg>';
      case 'envelope':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
      case 'sparkle':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2v4m0 12v4M2 12h4m12 0h4m-3.17-6.83l-2.83 2.83m-8 8l-2.83 2.83m0-13.66l2.83 2.83m8 8l2.83 2.83"/></svg>';
      case 'fire':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/></svg>';
      case 'palette':
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>';
      default:
        return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }
  }

  // Currency Formatter
  function formatCurrency(num) {
    return '$' + num.toLocaleString('es-AR');
  }

  // Load Saved Cart from localStorage
  function loadSavedCart() {
    try {
      const saved = localStorage.getItem('mifiestapp_cart_items');
      if (saved) {
        selectedItems = JSON.parse(saved);
      }
    } catch (e) {
      selectedItems = [];
    }
  }

  // Save Cart to localStorage
  function saveCart() {
    try {
      localStorage.setItem('mifiestapp_cart_items', JSON.stringify(selectedItems));
    } catch (e) {}
  }

  // Render Product Cards
  function renderProducts() {
    if (!productsGrid) return;

    const filtered = COMPLEMENTOS_DATA.filter(item => {
      const matchesCategory = currentCategory === 'all' || item.category === currentCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.title.toLowerCase().includes(q) || 
        item.subtitle.toLowerCase().includes(q) || 
        item.shortDesc.toLowerCase().includes(q) ||
        item.categoryName.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
      productsGrid.innerHTML = `
        <div class="empty-state">
          <h3>No encontramos complementos para tu búsqueda</h3>
          <p>Probá buscando con otros términos o seleccioná otra categoría.</p>
        </div>
      `;
      return;
    }

    productsGrid.innerHTML = filtered.map(item => {
      const isSelected = selectedItems.includes(item.id);
      return `
        <article class="product-card" data-id="${item.id}">
          <div class="product-card-banner ${item.imageUrl ? 'has-image' : ''}">
            ${item.imageUrl ? `
              <img src="${item.imageUrl}" alt="${item.title}" class="product-card-img" loading="lazy">
            ` : `
              <div class="product-icon-display">
                ${getCategorySvg(item.icon)}
              </div>
            `}
            ${item.badge ? `<span class="product-badge">${item.badge}</span>` : ''}
            <span class="product-category-tag">${item.categoryName}</span>
          </div>
          <div class="product-card-body">
            <h3 class="product-title">${item.title}</h3>
            <div class="product-subtitle">${item.subtitle}</div>
            <p class="product-desc">${item.shortDesc}</p>
            
            <div class="product-price-box">
              <div>
                <span class="price-main">${item.priceFormatted}</span>
              </div>
              <span class="price-unit">${item.unit}</span>
            </div>

            <div class="product-actions">
              <button class="btn-detail" data-detail-id="${item.id}">Ver Detalle</button>
              <button class="btn-add-cart ${isSelected ? 'added' : ''}" data-add-id="${item.id}">
                ${isSelected ? '✓ Agregado' : '+ Agregar'}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Attach Event Listeners to Cards
    attachCardListeners();
  }

  // Attach Card Action Listeners
  function attachCardListeners() {
    // Detail Buttons
    document.querySelectorAll('[data-detail-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-detail-id');
        openDetailModal(id);
      });
    });

    // Add to Cart Buttons
    document.querySelectorAll('[data-add-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-add-id');
        toggleItemInCart(id);
      });
    });
  }

  // Toggle Cart Item
  function toggleItemInCart(id) {
    if (selectedItems.includes(id)) {
      selectedItems = selectedItems.filter(itemId => itemId !== id);
    } else {
      selectedItems.push(id);
    }
    saveCart();
    updateCartUI();
    renderProducts();
  }

  // Update Cart and Quotation UI
  function updateCartUI() {
    const total = selectedItems.reduce((acc, id) => {
      const item = COMPLEMENTOS_DATA.find(p => p.id === id);
      return acc + (item ? item.price : 0);
    }, 0);

    const count = selectedItems.length;

    // Badges & Counters
    if (barCountBadge) barCountBadge.textContent = `${count} ${count === 1 ? 'ítem' : 'ítems'}`;
    if (navCartBadge) navCartBadge.textContent = count;
    if (barTotalAmount) barTotalAmount.textContent = formatCurrency(total);
    if (drawerTotalAmount) drawerTotalAmount.textContent = formatCurrency(total);

    // Floating Bar Visibility
    if (floatingBar) {
      if (count > 0) {
        floatingBar.classList.remove('hidden');
      } else {
        floatingBar.classList.add('hidden');
      }
    }

    // Render Items in Drawer
    if (drawerItemsList) {
      if (count === 0) {
        drawerItemsList.innerHTML = `
          <div style="text-align: center; padding: 40px 10px; color: var(--text-muted);">
            <p style="margin-bottom: 8px;">Aún no agregaste complementos.</p>
            <span style="font-size: 0.8rem;">Elegí los servicios de la tienda para armar tu presupuesto interactivo.</span>
          </div>
        `;
      } else {
        drawerItemsList.innerHTML = selectedItems.map(id => {
          const item = COMPLEMENTOS_DATA.find(p => p.id === id);
          if (!item) return '';
          return `
            <div class="cart-item-card">
              <div class="cart-item-info">
                <span class="cart-item-title">${item.title}</span>
                <span class="cart-item-price">${item.priceFormatted} <small style="color: var(--text-muted); font-size: 0.7rem;">(${item.unit})</small></span>
              </div>
              <button class="cart-item-remove-btn" data-remove-id="${item.id}" title="Quitar">✕</button>
            </div>
          `;
        }).join('');

        // Attach Remove Listeners
        drawerItemsList.querySelectorAll('[data-remove-id]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-remove-id');
            toggleItemInCart(id);
          });
        });
      }
    }
  }

  // Open Detail Modal
  function openDetailModal(id) {
    const item = COMPLEMENTOS_DATA.find(p => p.id === id);
    if (!item || !modalOverlay) return;

    const modalBody = document.getElementById('modal-content-body');
    const isSelected = selectedItems.includes(item.id);

    modalBody.innerHTML = `
      ${item.imageUrl ? `
        <div class="modal-image-hero">
          <img src="${item.imageUrl}" alt="${item.title}" class="modal-hero-img">
        </div>
      ` : ''}
      <div class="modal-header">
        <div class="modal-category-badge">${item.categoryName} ${item.badge ? `• ${item.badge}` : ''}</div>
        <h2 class="modal-title">${item.title}</h2>
        <div class="modal-subtitle">${item.subtitle}</div>
      </div>
      <div class="modal-body">
        <div class="modal-section">
          <p style="font-size: 0.95rem; color: var(--text-secondary); line-height: 1.6;">${item.description}</p>
        </div>

        <div class="modal-section">
          <h4 class="modal-section-title">✨ ¿Qué incluye este servicio?</h4>
          <ul class="modal-includes-list">
            ${item.includes.map(inc => `<li>${inc}</li>`).join('')}
          </ul>
        </div>

        <div class="modal-section">
          <h4 class="modal-section-title">⚙️ Requisitos y Logística</h4>
          <div class="modal-spec-box" style="margin-bottom: 8px;">
            <strong>Espacio / Conexión:</strong> ${item.requirements}
          </div>
          <div class="modal-spec-box">
            <strong>Anticipación:</strong> ${item.leadTime}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <div class="modal-price-area">
          <span class="modal-price-amount">${item.priceFormatted}</span>
          <span class="modal-price-unit">${item.unit}</span>
        </div>
        <button class="btn-add-cart ${isSelected ? 'added' : ''}" id="modal-add-btn" data-modal-id="${item.id}" style="padding: 12px 24px; font-size: 0.9rem;">
          ${isSelected ? '✓ En mi Cotización' : '+ Agregar a mi Cotización'}
        </button>
      </div>
    `;

    // Modal add button listener
    const modalAddBtn = document.getElementById('modal-add-btn');
    if (modalAddBtn) {
      modalAddBtn.addEventListener('click', () => {
        toggleItemInCart(item.id);
        openDetailModal(item.id); // re-render modal state
      });
    }

    modalOverlay.classList.add('active');
  }

  // Close Detail Modal
  function closeDetailModal() {
    if (modalOverlay) modalOverlay.classList.remove('active');
  }

  // Build WhatsApp Quotation Link
  function generateWhatsAppUrl() {
    const phoneNumber = '5491136125026';
    const dateVal = inputEventDate ? inputEventDate.value : '';
    const salonVal = inputEventSalon ? inputEventSalon.value.trim() : '';

    if (selectedItems.length === 0) {
      const defaultMsg = '¡Hola miFiestAPP! Quiero consultar por el catálogo de complementos y atracciones para mi evento.';
      return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(defaultMsg)}`;
    }

    let itemsListText = '';
    let total = 0;

    selectedItems.forEach((id, idx) => {
      const item = COMPLEMENTOS_DATA.find(p => p.id === id);
      if (item) {
        itemsListText += `\n${idx + 1}. *${item.title}* (${item.priceFormatted} - ${item.unit})`;
        total += item.price;
      }
    });

    let message = `¡Hola *miFiestAPP*! 👋 Estuve armando mi cotización de complementos para mi fiesta:\n`;
    message += `\n📋 *COMPLEMENTOS SELECCIONADOS:*${itemsListText}\n`;
    message += `\n💰 *Total Estimado:* ${formatCurrency(total)}\n`;

    if (dateVal) {
      message += `📅 *Fecha aproximada:* ${dateVal}\n`;
    }
    if (salonVal) {
      message += `📍 *Salón / Zona:* ${salonVal}\n`;
    }

    message += `\n¿Tienen disponibilidad para esta fecha? ¡Muchas gracias!`;

    return `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
  }

  // Open WhatsApp in new tab
  function handleWhatsAppCheckout() {
    const url = generateWhatsAppUrl();
    window.open(url, '_blank');
  }

  // Initial Setup
  function init() {
    loadSavedCart();

    // Category Chips Filtering
    categoryChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        categoryChips.forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active');
        currentCategory = e.currentTarget.getAttribute('data-category');
        renderProducts();
      });
    });

    // Search Input
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderProducts();
      });
    }

    // Modal Events
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeDetailModal);
    }
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeDetailModal();
      });
    }

    // Drawer Open/Close
    openDrawerBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (drawerOverlay) drawerOverlay.classList.add('active');
      });
    });

    if (drawerCloseBtn) {
      drawerCloseBtn.addEventListener('click', () => {
        if (drawerOverlay) drawerOverlay.classList.remove('active');
      });
    }
    if (drawerOverlay) {
      drawerOverlay.addEventListener('click', (e) => {
        if (e.target === drawerOverlay) drawerOverlay.classList.remove('active');
      });
    }

    // WhatsApp Triggers
    whatsappButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleWhatsAppCheckout();
      });
    });

    // Render Initial State
    renderProducts();
    updateCartUI();
  }

  // Run on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
