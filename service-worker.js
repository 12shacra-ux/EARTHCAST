const CACHE_NAME = 'earthcast-v7';
const TILE_CACHE_NAME = 'earthcast-map-tiles-v1';
const MAP_DATA_CACHE_NAME = 'earthcast-cartography-data-v1';
const MAX_CACHED_TILES = 256;
const CARTOGRAPHY_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
const CARTOGRAPHY_FILES = new Set([
  'curvas_NASA.geojson',
  'curvas_nasa.geojson',
  'parroqurbana_quito.geojson',
  'parroqurural_quito.geojson',
  'rutas_quito.geojson'
]);
const ARCHIVOS = [
  './',
  './index.html',
  './nasa.html',
  './manifest.json',
  './delta.json',
  './datos/puntos-encuentro.geojson',
  './datos/rutas-evacuacion.geojson',
  './vendor/leaflet/LICENSE',
  './vendor/leaflet/leaflet.css',
  './vendor/leaflet/leaflet.js',
  './vendor/leaflet/images/layers.png',
  './vendor/leaflet/images/layers-2x.png',
  './vendor/leaflet/images/marker-icon.png',
  './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('earthcast-')
            && key !== CACHE_NAME
            && key !== TILE_CACHE_NAME
            && key !== MAP_DATA_CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isMapTile(url) {
  const isEsriTile = url.hostname.endsWith('.arcgisonline.com')
    && url.pathname.includes('/MapServer/tile/');
  const isCartoTile = url.hostname.endsWith('.basemaps.cartocdn.com')
    && url.pathname.endsWith('.png');
  return isEsriTile || isCartoTile;
}

function isCartographyData(url) {
  return url.origin === self.location.origin
    && CARTOGRAPHY_FILES.has(url.pathname.split('/').pop());
}

function tileExpiry(response) {
  const maxAge = response.headers.get('cache-control')?.match(/max-age=(\d+)/i);
  return maxAge ? Number(maxAge[1]) * 1000 : 0;
}

async function storeTile(cache, request, response) {
  const lifetime = tileExpiry(response);
  if (!response.ok || response.type === 'opaque' || lifetime === 0) return;

  const headers = new Headers(response.headers);
  headers.set('x-earthcast-cached-at', String(Date.now()));
  await cache.put(request, new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers
  }));

  const keys = await cache.keys();
  if (keys.length > MAX_CACHED_TILES) {
    await cache.delete(keys[0]);
  }
}

async function getCartographyData(request, event) {
  const cache = await caches.open(MAP_DATA_CACHE_NAME);
  const cached = await cache.match(request);
  const cachedAt = Number(cached?.headers.get('x-earthcast-cached-at'));
  const lifetime = cached ? tileExpiry(cached) : 0;
  const cacheIsFresh = cached && Number.isFinite(cachedAt)
    && Date.now() - cachedAt < lifetime;

  if (cacheIsFresh) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      if (tileExpiry(response) === 0) {
        headers.set('cache-control', `max-age=${CARTOGRAPHY_CACHE_MAX_AGE / 1000}`);
      }
      headers.set('x-earthcast-cached-at', String(Date.now()));
      const cachedResponse = new Response(response.clone().body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
      event.waitUntil(
        cache.put(request, cachedResponse)
          .catch((error) => console.error('No se pudo guardar la capa cartográfica para uso offline:', error))
      );
    }
    return response;
  } catch (error) {
    if (cached) {
      console.info('Sin conexión; se usa la capa cartográfica guardada.');
      return cached;
    }
    throw error;
  }
}

async function getMapTile(request) {
  const cache = await caches.open(TILE_CACHE_NAME);
  const cached = await cache.match(request);
  const cachedAt = Number(cached?.headers.get('x-earthcast-cached-at'));
  const lifetime = cached ? tileExpiry(cached) : 0;
  const cacheIsFresh = cached && Number.isFinite(cachedAt)
    && Date.now() - cachedAt < lifetime;

  if (cacheIsFresh) return cached;

  if (cached) await cache.delete(request);

  try {
    const response = await fetch(request);
    await storeTile(cache, request, response.clone());
    return response;
  } catch (error) {
    if (cached) {
      console.info('La tesela expiró, pero se usa como respaldo sin conexión.');
      return cached;
    }
    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (isMapTile(url)) {
    event.respondWith(getMapTile(event.request));
    return;
  }

  if (isCartographyData(url)) {
    event.respondWith(getCartographyData(event.request, event));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch((error) => {
        if (event.request.mode === 'navigate') {
          return caches.match('./nasa.html').then((appShell) => appShell || Promise.reject(error));
        }
        throw error;
      });
    })
  );
});
