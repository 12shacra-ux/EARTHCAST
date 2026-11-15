
const map = L.map('map').setView(
  [-0.1807, -78.4678], 13
);

// MAPA PROVISIONAL: requiere internet.
// Después lo reemplazaremos por mapas locales.
L.tileLayer(
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }
).addTo(map);

let marcadorUsuario = null;
let circuloPrecision = null;
let gpsActivo = false;
let siguiendo = true;
let ultimaPosicion = null;

function iniciarGPS() {

  if (!navigator.geolocation) {
    document.getElementById('status').textContent =
      'GPS no disponible en este navegador.';
    return;
  }

  if (gpsActivo) return;

  gpsActivo = true;

  document.getElementById('status').textContent =
    'Buscando ubicación...';

  map.locate({
    watch: true,
    setView: false,
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 15000
  });

  map.on('locationfound', actualizarUbicacion);

  map.on('locationerror', function(e) {
    document.getElementById('status').textContent =
      'No se pudo obtener la ubicación: ' + e.message;
  });
}

function actualizarUbicacion(e) {

  ultimaPosicion = e.latlng;

  if (!marcadorUsuario) {

    marcadorUsuario = L.circleMarker(
      e.latlng,
      {
        radius: 9,
        color: '#ffffff',
        weight: 3,
        fillColor: '#168cff',
        fillOpacity: 1
      }
    ).addTo(map);

    circuloPrecision = L.circle(
      e.latlng,
      {
        radius: e.accuracy,
        color: '#168cff',
        fillOpacity: 0.10
      }
    ).addTo(map);

  } else {

    marcadorUsuario.setLatLng(e.latlng);

    circuloPrecision
      .setLatLng(e.latlng)
      .setRadius(e.accuracy);
  }

  if (siguiendo) {
    map.panTo(e.latlng);
  }

  document.getElementById('status').textContent =
    'GPS activo | Precisión: ' +
    Math.round(e.accuracy) + ' metros';
}

function centrarUsuario() {

  siguiendo = true;

  if (ultimaPosicion) {
    map.setView(ultimaPosicion, 17);
  }
}

map.on('dragstart', function() {
  siguiendo = false;
});
