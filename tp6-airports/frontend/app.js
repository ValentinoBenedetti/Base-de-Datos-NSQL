// AeroPulse - Client Logic

// Config
const API_URL = '/api'; // Proxied via Nginx

// Global State
let map;
let markerClusterGroup;
const markersByIata = new Map();
let currentSearchCircle = null;
let activeSearchCoords = null;

// Modal State
let isEditMode = false;

// DOM Elements
const btnAddAirport = document.getElementById('btn-add-airport');
const airportModal = document.getElementById('airport-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const airportForm = document.getElementById('airport-form');
const modalTitle = document.getElementById('modal-title');
const searchRadiusInput = document.getElementById('search-radius');
const radiusValSpan = document.getElementById('radius-val');
const nearbyBadge = document.getElementById('nearby-mode-badge');
const nearbyResultsContainer = document.getElementById('nearby-results-container');
const nearbyResultsList = document.getElementById('nearby-results-list');
const btnClearNearby = document.getElementById('btn-clear-nearby');
const btnRefreshPop = document.getElementById('btn-refresh-pop');
const popularityList = document.getElementById('popularity-list');

// Show Premium Custom Toast (Airplane Theme)
function showToast(type, title, message) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  // Select airplane-themed icon based on type
  const icon = type === 'success' ? '<span>🛫</span>' : '<span>🚨</span>';

  toast.innerHTML = `
    <div class="toast-icon-wrapper">${icon}</div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-close">&times;</button>
  `;

  container.appendChild(toast);

  // Trigger reflow to start CSS transition
  toast.offsetHeight;
  toast.classList.add('show');

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => dismissToast(toast));

  // Auto dismiss after 4.5 seconds
  const autoDismiss = setTimeout(() => {
    dismissToast(toast);
  }, 4500);

  function dismissToast(el) {
    clearTimeout(autoDismiss);
    el.classList.remove('show');
    // Wait for transition to finish before removing from DOM
    el.addEventListener('transitionend', function handler() {
      el.removeEventListener('transitionend', handler);
      el.remove();
    });
  }
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadAllAirports();
  loadPopularAirports();
  setupEventListeners();
  
  // Poll popularity ranking every 10 seconds
  setInterval(loadPopularAirports, 10000);
});

// Initialize Leaflet Map
function initMap() {
  // Center world view
  map = L.map('map', {
    center: [20, 0],
    zoom: 3,
    minZoom: 2,
    maxZoom: 18
  });

  // Load Dark Matter Map Tile (Premium modern look)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Initialize Marker Cluster Group
  markerClusterGroup = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    // Custom cluster styling defined in style.css
    iconCreateFunction: function (cluster) {
      const childCount = cluster.getChildCount();
      let c = ' marker-cluster-';
      if (childCount < 10) {
        c += 'small';
      } else if (childCount < 100) {
        c += 'medium';
      } else {
        c += 'large';
      }
      return new L.DivIcon({ 
        html: `<div><span>${childCount}</span></div>`, 
        className: 'marker-cluster' + c, 
        iconSize: new L.Point(40, 40) 
      });
    }
  });
  
  map.addLayer(markerClusterGroup);

  // Map Click Listener for Proximity Search
  map.on('click', (e) => {
    // Only search if user didn't click on a marker (markers intercept clicks)
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    activeSearchCoords = { lat, lng };
    performNearbySearch();
  });
}

// Load all airports (Minimal payload for speed)
async function loadAllAirports() {
  try {
    const response = await fetch(`${API_URL}/airports?minimal=true`);
    if (!response.ok) throw new Error('Failed to load airports');
    const airports = await response.ok ? await response.json() : [];
    
    // Clear old layers
    markerClusterGroup.clearLayers();
    markersByIata.clear();
    
    airports.forEach(airport => {
      const lat = parseFloat(airport.lat);
      const lng = parseFloat(airport.lng);
      
      if (!isNaN(lat) && !isNaN(lng)) {
        // Create simple marker
        const marker = L.marker([lat, lng]);
        marker.iata = airport.iata_faa;
        
        // Fetch real details on click
        marker.on('click', (e) => {
          // Prevent map click handler from triggering
          L.DomEvent.stopPropagation(e);
          fetchAirportDetails(airport.iata_faa, marker);
        });

        markerClusterGroup.addLayer(marker);
        markersByIata.set(airport.iata_faa, marker);
      }
    });

    console.log(`Loaded ${markersByIata.size} airports on map.`);
  } catch (err) {
    console.error('Error loading airports:', err);
    showToast('error', 'Fallo de Radar 📡', 'No se pudieron descargar los datos de navegación de los aeropuertos.');
  }
}

// Fetch single airport details and open popup
async function fetchAirportDetails(iata, marker) {
  // Set loading content first
  marker.bindPopup(`<div class="loading-spinner-small">Cargando detalles...</div>`).openPopup();

  try {
    const response = await fetch(`${API_URL}/airports/${iata}`);
    if (!response.ok) throw new Error('Airport not found');
    const data = await response.json();
    
    const popupContent = `
      <div class="airport-popup">
        <div class="popup-header">
          <div class="popup-title">${escapeHTML(data.name)}</div>
          <div class="popup-subtitle">${escapeHTML(data.city || 'Ubicación no disponible')}</div>
        </div>
        <div class="popup-body">
          <div class="popup-row">
            <span class="popup-label">Código IATA:</span>
            <span class="popup-value" style="font-family: var(--font-mono); font-weight:700;">${data.iata_faa}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Código ICAO:</span>
            <span class="popup-value" style="font-family: var(--font-mono);">${data.icao || '-'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Coordenadas:</span>
            <span class="popup-value">${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Altitud:</span>
            <span class="popup-value">${data.alt ? data.alt.toLocaleString() + ' ft' : '0 ft'}</span>
          </div>
          <div class="popup-row">
            <span class="popup-label">Zona Horaria:</span>
            <span class="popup-value" style="font-size:11px;">${data.tz || '-'}</span>
          </div>
          <span class="popup-visits-badge">🔥 ${data.visits || 0} visitas</span>
        </div>
        <div class="popup-actions">
          <button class="btn btn-secondary btn-small" onclick="window.openEditAirport('${data.iata_faa}')">Editar</button>
          <button class="btn btn-secondary btn-small" style="color:var(--color-danger); border-color:rgba(239,68,68,0.2);" onclick="window.deleteAirport('${data.iata_faa}')">Eliminar</button>
        </div>
      </div>
    `;
    
    marker.setPopupContent(popupContent);
    // Refresh popularity panel since we just incremented visits
    loadPopularAirports();
  } catch (err) {
    console.error('Error fetching airport details:', err);
    marker.setPopupContent(`
      <div style="padding: 10px;">
        <p style="color:var(--color-danger); font-weight:600;">Error al cargar datos</p>
        <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">${escapeHTML(err.message)}</p>
      </div>
    `);
  }
}

// Fetch Popularity Rankings
async function loadPopularAirports() {
  try {
    const response = await fetch(`${API_URL}/airports/popular`);
    if (!response.ok) throw new Error('Failed to load popular airports');
    const popular = await response.json();
    
    popularityList.innerHTML = '';
    
    if (popular.length === 0) {
      popularityList.innerHTML = `<li class="info-text" style="border-left-color: var(--color-accent)">Sin visitas registradas hoy.</li>`;
      return;
    }

    popular.forEach((airport, index) => {
      const item = document.createElement('li');
      item.className = 'popular-item';
      item.onclick = () => focusAirport(airport.iata_faa);
      item.innerHTML = `
        <div class="rank-num">#${index + 1}</div>
        <div class="popular-info">
          <div class="popular-name">${escapeHTML(airport.name)}</div>
          <div class="popular-sub">${airport.iata_faa} • ${escapeHTML(airport.city || '')}</div>
        </div>
        <div class="popular-visits">
          <span>🔥</span>
          <span>${airport.visits}</span>
        </div>
      `;
      popularityList.appendChild(item);
    });
  } catch (err) {
    console.error('Error loading popularity ranking:', err);
    popularityList.innerHTML = `<li style="color:var(--color-danger); font-size:12px; padding:10px 0;">Error al cargar ranking.</li>`;
  }
}

// Proximity Search Implementation
async function performNearbySearch() {
  if (!activeSearchCoords) return;
  
  const radius = parseInt(searchRadiusInput.value, 10);
  nearbyBadge.textContent = 'Activo';
  nearbyBadge.classList.add('active');

  // Place/update search circle on map
  if (currentSearchCircle) {
    map.removeLayer(currentSearchCircle);
  }
  currentSearchCircle = L.circle([activeSearchCoords.lat, activeSearchCoords.lng], {
    radius: radius * 1000, // in meters
    color: 'var(--color-primary)',
    fillColor: 'var(--color-primary)',
    fillOpacity: 0.08,
    weight: 1.5,
    dashArray: '4, 4'
  }).addTo(map);

  nearbyResultsList.innerHTML = '<div class="loading-spinner-small">Buscando...</div>';
  nearbyResultsContainer.classList.remove('hidden');

  try {
    const response = await fetch(`${API_URL}/airports/nearby?lat=${activeSearchCoords.lat}&lng=${activeSearchCoords.lng}&radius=${radius}`);
    if (!response.ok) throw new Error('Error searching nearby airports');
    const results = await response.json();

    nearbyResultsList.innerHTML = '';
    if (results.length === 0) {
      nearbyResultsList.innerHTML = `<li style="padding:10px; color:var(--text-muted);">No se encontraron aeropuertos en ${radius} km.</li>`;
      return;
    }

    results.forEach(airport => {
      const item = document.createElement('li');
      item.onclick = () => focusAirport(airport.iata_faa);
      item.innerHTML = `
        <div style="min-width:0; flex:1;">
          <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHTML(airport.name)}</div>
          <div style="font-size:10px; color:var(--text-muted);">${airport.iata_faa} • ${escapeHTML(airport.city || '')}</div>
        </div>
        <span class="dist-badge">${airport.distance.toFixed(1)} km</span>
      `;
      nearbyResultsList.appendChild(item);
    });
  } catch (err) {
    console.error('Error nearby search:', err);
    nearbyResultsList.innerHTML = `<li style="color:var(--color-danger); padding:10px;">Error en la búsqueda.</li>`;
  }
}

// Focus on an airport marker
function focusAirport(iata) {
  const marker = markersByIata.get(iata);
  if (marker) {
    // Zoom in and center on marker
    map.setView(marker.getLatLng(), 8);
    // Expand cluster if marker is inside one
    markerClusterGroup.zoomToShowLayer(marker, () => {
      marker.fire('click');
    });
  } else {
    showToast('error', 'Plan de Vuelo Cancelado ❌', `El aeropuerto ${iata} no tiene coordenadas en el mapa de navegación.`);
  }
}

// Clear Proximity Search
function clearNearbySearch() {
  if (currentSearchCircle) {
    map.removeLayer(currentSearchCircle);
    currentSearchCircle = null;
  }
  activeSearchCoords = null;
  nearbyBadge.textContent = 'Inactivo';
  nearbyBadge.classList.remove('active');
  nearbyResultsContainer.classList.add('hidden');
  nearbyResultsList.innerHTML = '';
}

// Setup Dashboard Interactions
function setupEventListeners() {
  // Radius slider change
  searchRadiusInput.addEventListener('input', (e) => {
    radiusValSpan.textContent = e.target.value;
    if (activeSearchCoords) {
      performNearbySearch();
    }
  });

  // Clear Nearby Search button
  btnClearNearby.addEventListener('click', clearNearbySearch);

  // Manual refresh of popularity
  btnRefreshPop.addEventListener('click', loadPopularAirports);

  // Modal controls
  btnAddAirport.addEventListener('click', () => openCreateModal());
  btnCloseModal.addEventListener('click', hideModal);
  btnCancelModal.addEventListener('click', hideModal);
  
  // Submit modal form
  airportForm.addEventListener('submit', handleFormSubmit);
}

// Open modal for Create
function openCreateModal() {
  isEditMode = false;
  modalTitle.textContent = 'Agregar Aeropuerto';
  
  // Clear fields and enable IATA input
  airportForm.reset();
  document.getElementById('form-iata').readOnly = false;
  
  airportModal.classList.remove('hidden');
}

// Expose openEditAirport globally so it is clickable inside Leaflet popup templates
window.openEditAirport = async function(iata) {
  try {
    const response = await fetch(`${API_URL}/airports/${iata}`);
    if (!response.ok) throw new Error('Failed to fetch details');
    const data = await response.json();
    
    isEditMode = true;
    modalTitle.textContent = `Editar Aeropuerto ${data.iata_faa}`;
    
    // Fill fields
    document.getElementById('form-iata').value = data.iata_faa;
    document.getElementById('form-iata').readOnly = true; // Primary key, block modifications
    document.getElementById('form-icao').value = data.icao || '';
    document.getElementById('form-name').value = data.name;
    document.getElementById('form-city').value = data.city || '';
    document.getElementById('form-lat').value = data.lat;
    document.getElementById('form-lng').value = data.lng;
    document.getElementById('form-alt').value = data.alt || '';
    document.getElementById('form-tz').value = data.tz || '';
    
    airportModal.classList.remove('hidden');
  } catch (err) {
    showToast('error', 'Fallo de Comunicación 📞', `Error de enlace con el aeropuerto ${iata}: ${err.message}`);
  }
};

// Expose deleteAirport globally so it is clickable inside Leaflet popup templates
window.deleteAirport = async function(iata) {
  if (!confirm(`¿Estás seguro de que deseas eliminar el aeropuerto ${iata}?`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}/airports/${iata}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete');
    }
    
    // Remove marker from map
    const marker = markersByIata.get(iata);
    if (marker) {
      markerClusterGroup.removeLayer(marker);
      markersByIata.delete(iata);
    }
    
    showToast('success', 'Plan de Vuelo Eliminado 🛬', `El aeropuerto ${iata} fue removido de la red de navegación aérea.`);
    
    // Refresh components
    loadPopularAirports();
    if (activeSearchCoords) performNearbySearch();
  } catch (err) {
    showToast('error', 'Turbulencia al Eliminar 🚨', `No pudimos desvincular el aeropuerto de la red: ${err.message}`);
  }
};

// Hide Form Modal
function hideModal() {
  airportModal.classList.add('hidden');
}

// Handle Form Submission (Create or Update)
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const iata = document.getElementById('form-iata').value.toUpperCase().trim();
  
  const bodyData = {
    name: document.getElementById('form-name').value.trim(),
    city: document.getElementById('form-city').value.trim(),
    iata_faa: iata,
    icao: document.getElementById('form-icao').value.toUpperCase().trim(),
    lat: parseFloat(document.getElementById('form-lat').value),
    lng: parseFloat(document.getElementById('form-lng').value),
    alt: document.getElementById('form-alt').value ? parseInt(document.getElementById('form-alt').value, 10) : 0,
    tz: document.getElementById('form-tz').value.trim()
  };

  const url = isEditMode ? `${API_URL}/airports/${iata}` : `${API_URL}/airports`;
  const method = isEditMode ? 'PUT' : 'POST';

  try {
    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to save');
    }

    const savedAirport = await response.json();
    
    // Update Map Markers
    if (isEditMode) {
      // Modify existing marker coords
      const marker = markersByIata.get(iata);
      if (marker) {
        // Move marker
        const newLatLng = [savedAirport.lat, savedAirport.lng];
        marker.setLatLng(newLatLng);
        
        // Re-bind click event to use updated details
        marker.off('click');
        marker.on('click', (ev) => {
          L.DomEvent.stopPropagation(ev);
          fetchAirportDetails(iata, marker);
        });

        // Force cluster recalculation
        markerClusterGroup.removeLayer(marker);
        markerClusterGroup.addLayer(marker);
      }
    } else {
      // Create new marker
      const marker = L.marker([savedAirport.lat, savedAirport.lng]);
      marker.iata = savedAirport.iata_faa;
      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        fetchAirportDetails(savedAirport.iata_faa, marker);
      });
      
      markerClusterGroup.addLayer(marker);
      markersByIata.set(savedAirport.iata_faa, marker);
    }

    hideModal();
    showToast('success', 'Despegue Exitoso 🛫', `El aeropuerto ${savedAirport.iata_faa} ha sido incorporado a la red de rutas.`);
    
    // Auto-focus on saved airport
    focusAirport(savedAirport.iata_faa);
    
  } catch (err) {
    showToast('error', 'Turbulencia en Ruta 🚨', `Error al procesar el plan de vuelo: ${err.message}`);
  }
}

// Utility to escape HTML and prevent XSS
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
