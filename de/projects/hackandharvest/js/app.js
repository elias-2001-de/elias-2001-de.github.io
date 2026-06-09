'use strict';

const TYPE_LABELS = { urban: 'Stadt', trail: 'Natur', mixed: 'Gemischt' };

let map         = null;
let mapLayers   = [];
let sectionRefs = [];
let allRoutes   = [];
let selectedId  = null;

// ── Entry point ───────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);

async function init() {
  map = L.map('map', { zoomControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(map);
  map.setView([47.670, 9.195], 12);

  try {
    allRoutes = await fetch('routes/routes.json').then(r => r.json());
  } catch {
    document.getElementById('route-list').textContent = 'Routen konnten nicht geladen werden.';
    return;
  }

  renderRouteList(allRoutes);
  if (allRoutes.length > 0) selectRoute(allRoutes[0].id);
}

// ── Route list ────────────────────────────────────────────────────────────────

function renderRouteList(routes) {
  const list = document.getElementById('route-list');
  list.innerHTML = routes.map(routeItemHTML).join('');
  list.querySelectorAll('.route-item').forEach(btn =>
    btn.addEventListener('click', () => selectRoute(btn.dataset.id))
  );
}

function routeItemHTML(r) {
  const typeLabel = TYPE_LABELS[r.type] || r.type;
  return `
    <button class="route-item" data-id="${r.id}" aria-label="${r.name} auswählen">
      <div class="route-item__thumb">
        <img src="${r.heroImage}" alt="" />
      </div>
      <div class="route-item__info">
        <span class="route-item__name">${r.name}</span>
        <span class="route-item__desc">${r.shortDescription}</span>
        <div class="route-item__badges">
          <span class="badge badge--type">${typeLabel}</span>
          <span class="badge badge--drive">${r.driveDuration} Fahrt</span>
        </div>
      </div>
    </button>`;
}

// ── Route selection ───────────────────────────────────────────────────────────

async function selectRoute(id) {
  if (id === selectedId) return;
  selectedId = id;

  document.querySelectorAll('.route-item').forEach(btn =>
    btn.classList.toggle('route-item--active', btn.dataset.id === id)
  );

  const entry = allRoutes.find(r => r.id === id);
  if (!entry) return;

  const baseDir = entry.metaFile.slice(0, entry.metaFile.lastIndexOf('/') + 1);

  const [meta, gpxText] = await Promise.all([
    fetch(entry.metaFile).then(r => r.json()),
    fetch(entry.gpxFile).then(r => r.text())
  ]);

  const points   = parseGPX(gpxText);
  const sections = meta.sections || [];

  clearMapLayers();
  drawBaseRoute(points);
  sectionRefs = drawSectionOverlays(points, sections);
  map.invalidateSize();

  showDetail(meta, entry, baseDir, sections);
}

// ── GPX ───────────────────────────────────────────────────────────────────────

function parseGPX(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  return Array.from(doc.querySelectorAll('trkpt')).map(pt => ({
    lat: parseFloat(pt.getAttribute('lat')),
    lon: parseFloat(pt.getAttribute('lon'))
  }));
}

// ── Map helpers ───────────────────────────────────────────────────────────────

function clearMapLayers() {
  mapLayers.forEach(l => map.removeLayer(l));
  mapLayers = [];
  map.closePopup();
}

function drawBaseRoute(points) {
  const latlngs = points.map(p => [p.lat, p.lon]);
  const line = L.polyline(latlngs, { color: '#00B4A6', weight: 4, opacity: 0.85 }).addTo(map);
  line.on('mouseover', () => line.setStyle({ weight: 6 }));
  line.on('mouseout',  () => line.setStyle({ weight: 4 }));
  mapLayers.push(line);
  map.fitBounds(line.getBounds(), { padding: [20, 20] });
}

function drawSectionOverlays(points, sections) {
  return sections.map(s => {
    const slice = points.slice(s.fromIndex, s.toIndex + 1);
    if (!slice.length) return null;
    const color = s.type === 'warning' ? '#F5A623' : '#4CAF50';
    const line  = L.polyline(slice.map(p => [p.lat, p.lon]), { color, weight: 6, opacity: 0.9 }).addTo(map);
    mapLayers.push(line);
    const mid   = slice[Math.floor(slice.length / 2)];
    const popup = L.popup().setContent(
      `<strong>${s.label}</strong><p style="margin:.3rem 0 0;font-size:.85rem">${s.detail}</p>`
    );
    line.on('click', () => popup.setLatLng([mid.lat, mid.lon]).openOn(map));
    return { section: s, line, popup, mid };
  }).filter(Boolean);
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function showDetail(meta, entry, baseDir, sections) {
  document.getElementById('empty-state').style.display    = 'none';
  document.getElementById('detail-content').style.display = 'block';

  document.getElementById('detail-name').textContent        = meta.name;
  document.getElementById('detail-distance').textContent    = meta.distance       || '—';
  document.getElementById('detail-drive').textContent       = meta.driveDuration  || '—';
  document.getElementById('detail-difficulty').textContent  = meta.difficulty     || '—';
  document.getElementById('detail-surface').textContent     = meta.surface        || '—';
  document.getElementById('detail-description').textContent = meta.description    || '';

  const hasSections = sections.length > 0;
  document.getElementById('section-legend').style.display = hasSections ? 'flex' : 'none';
  document.getElementById('sections-panel').style.display = hasSections ? 'block' : 'none';
  if (hasSections) renderSectionList(sections);

  renderGallery(meta, baseDir);

  const btn  = document.getElementById('download-btn');
  btn.href     = entry.gpxFile;
  btn.download = `${entry.id}.gpx`;
}

function renderSectionList(sections) {
  const list = document.getElementById('section-list');
  list.innerHTML = sections.map((s, i) => {
    const icon = s.type === 'warning' ? '&#9888;' : '&#9733;';
    return `
      <li class="section-item section-item--${s.type}" data-idx="${i}"
          tabindex="0" role="button" aria-label="${s.label} auf Karte anzeigen">
        <span class="section-item__icon" aria-hidden="true">${icon}</span>
        <div>
          <strong class="section-item__label">${s.label}</strong>
          <p class="section-item__detail">${s.detail}</p>
        </div>
      </li>`;
  }).join('');

  list.querySelectorAll('.section-item').forEach(el => {
    const activate = () => {
      const ref = sectionRefs[parseInt(el.dataset.idx, 10)];
      if (!ref) return;
      ref.popup.setLatLng([ref.mid.lat, ref.mid.lon]).openOn(map);
      map.panTo([ref.mid.lat, ref.mid.lon]);
    };
    el.addEventListener('click', activate);
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') activate(); });
  });
}

function renderGallery(meta, baseDir) {
  const gallery = document.getElementById('gallery');
  const images  = meta.images || [];
  gallery.style.display = images.length ? 'flex' : 'none';
  gallery.innerHTML = images.map(img => `
    <figure class="gallery__item" role="listitem">
      <img src="${baseDir}${img.file}" alt="${img.caption || ''}" loading="lazy" />
      ${img.caption ? `<figcaption>${img.caption}</figcaption>` : ''}
    </figure>`).join('');
}
