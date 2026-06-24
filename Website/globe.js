/* ==========================================================================
   TRAVELIA GLOBO INTERATIVO (MAPLIBRE GL JS + TURF.JS)
   ========================================================================== */

let map = null;
let currentRotationId = null;
let isRotating = false;
const originCoords = [-48.5482, -27.5954]; // Florianópolis, BR
let activeMarkers = [];
let referenceMarkers = [];
let animationFrameId = null;

// Initialize MapLibre Globe
function initGlobe() {
    if (map) return;

    // Define ArcGIS satellite imagery style
    const mapStyle = {
        'version': 8,
        'sources': {
            'satellite': {
                'type': 'raster',
                'tiles': [
                    'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                ],
                'tileSize': 256,
                'attribution': 'Tiles &copy; Esri &mdash; Source: Esri, GIS User Community'
            }
        },
        'layers': [
            {
                'id': 'satellite-layer',
                'type': 'raster',
                'source': 'satellite',
                'minzoom': 0,
                'maxzoom': 22
            }
        ]
    };

    map = new maplibregl.Map({
        container: 'map-container',
        style: mapStyle,
        center: originCoords,
        zoom: 3,
        pitch: 30,
        bearing: 0,
        antialias: true
    });

    map.on('style.load', () => {
        // Enable Globe projection (MapLibre v5+)
        if (typeof map.setProjection === 'function') {
            map.setProjection({ type: 'globe' });
        } else {
            console.warn("Projeção Globe não disponível nesta versão do MapLibre");
        }

        // Add Florianópolis Origin Marker
        addOriginMarker();

        // Add subtle reference markers for capitals
        addReferenceMarkers();
    });

    // Handle zoom controls
    document.getElementById('btn-zoom-in').addEventListener('click', () => map.zoomIn());
    document.getElementById('btn-zoom-out').addEventListener('click', () => map.zoomOut());
    document.getElementById('btn-rotate').addEventListener('click', toggleGlobeRotation);
}

// Add Origin Marker (Florianópolis)
function addOriginMarker() {
    const el = document.createElement('div');
    el.className = 'map-pulse-marker';
    el.style.backgroundColor = '#FFA666';

    const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
        .setHTML('<strong>Florianópolis (FLN)</strong><br>Origem da Viagem');

    const marker = new maplibregl.Marker({ element: el })
        .setLngLat(originCoords)
        .setPopup(popup)
        .addTo(map);

    popup.addTo(map); // Open initially
    activeMarkers.push(marker);
}

// Add subtle reference markers for capitals
function addReferenceMarkers() {
    const referenceDestinations = [
        { coords: [2.5500, 49.0097], name: "Paris", iata: "CDG" },
        { coords: [-9.1359, 38.7756], name: "Lisboa", iata: "LIS" },
        { coords: [12.2389, 41.8003], name: "Roma", iata: "FCO" },
        { coords: [139.7811, 35.5494], name: "Tóquio", iata: "HND" },
        { coords: [-58.5358, -34.8222], name: "Buenos Aires", iata: "EZE" }
    ];

    referenceDestinations.forEach(dest => {
        const el = document.createElement('div');
        el.className = 'map-reference-marker';
        
        const popup = new maplibregl.Popup({ 
            offset: 10, 
            closeButton: false, 
            closeOnClick: false, 
            className: 'map-ref-popup' 
        })
        .setHTML(`<span class="ref-label">${dest.name} (${dest.iata})</span>`);

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat(dest.coords)
            .setPopup(popup)
            .addTo(map);

        marker.togglePopup();
        referenceMarkers.push(marker);
    });
}

// Animate Flight Route (FLN to Destination)
function animateFlightRoute(destCoords, destName, iataCode) {
    // Clear previous flight paths and markers (except FLN)
    clearRoutes();

    if (!map) return;

    // Check prefers-reduced-motion accessibility preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Hide reference markers during active route animation
    referenceMarkers.forEach(marker => marker.remove());

    // 1. Calculate Great Circle path using Turf.js
    const originPoint = turf.point(originCoords);
    const destPoint = turf.point(destCoords);
    
    // Generate 80 intermediate points for smooth animation
    let routeGeoJSON;
    try {
        routeGeoJSON = turf.greatCircle(originPoint, destPoint, { npoints: 80 });
    } catch (e) {
        console.error("Erro ao calcular rota Turf.js:", e);
        // Fallback simple line
        routeGeoJSON = {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: [originCoords, destCoords]
            }
        };
    }

    const fullCoordinates = routeGeoJSON.geometry.coordinates;

    // 2. Add source and layers for line rendering
    map.addSource('route', {
        'type': 'geojson',
        'data': {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': []
            }
        }
    });

    // Glow backing layer
    map.addLayer({
        'id': 'route-glow',
        'type': 'line',
        'source': 'route',
        'layout': {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': '#FFA666',
            'line-width': 8,
            'line-opacity': 0.25,
            'line-blur': 4
        }
    });

    // Primary sharp line
    map.addLayer({
        'id': 'route-line',
        'type': 'line',
        'source': 'route',
        'layout': {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': '#FFA666',
            'line-width': 3.5,
            'line-opacity': 0.95
        }
    });

    // 3. Zoom out camera to view both points
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend(originCoords);
    bounds.extend(destCoords);
    
    // Fit bounds smoothly or instantly if reduced motion is requested
    map.fitBounds(bounds, {
        padding: 100,
        maxZoom: 5,
        duration: prefersReducedMotion ? 0 : 2000,
        pitch: 45
    });

    // Stop rotation when animating a route
    if (isRotating) stopGlobeRotation();

    // 4. Animate the line drawing over time (or instantly if reduced motion is preferred)
    if (prefersReducedMotion) {
        const geojson = {
            'type': 'Feature',
            'properties': {},
            'geometry': {
                'type': 'LineString',
                'coordinates': fullCoordinates
            }
        };
        if (map.getSource('route')) {
            map.getSource('route').setData(geojson);
        }
        addDestinationMarker(destCoords, destName, iataCode);
    } else {
        let progress = 0;
        const animationSpeed = 2; // Steps per frame

        function drawLine() {
            if (progress >= fullCoordinates.length) {
                // Animation finished: Add destination marker and popup
                addDestinationMarker(destCoords, destName, iataCode);
                return;
            }

            progress = Math.min(progress + animationSpeed, fullCoordinates.length);
            
            const animatedCoords = fullCoordinates.slice(0, progress);
            
            const geojson = {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': animatedCoords
                }
            };

            if (map.getSource('route')) {
                map.getSource('route').setData(geojson);
                animationFrameId = requestAnimationFrame(drawLine);
            }
        }

        // Start drawing animation after a slight delay for camera alignment
        setTimeout(() => {
            drawLine();
        }, 1500);
    }
}

// Add Destination Marker
function addDestinationMarker(coords, name, iata) {
    const el = document.createElement('div');
    el.className = 'map-pulse-marker';
    el.style.backgroundColor = '#FFFFFF';
    el.style.borderColor = '#FFA666';

    const label = iata ? `${name} (${iata.toUpperCase()})` : name;
    const popup = new maplibregl.Popup({ offset: 15, closeButton: false })
        .setHTML(`<strong>${label}</strong><br>Destino Escolhido`);

    const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .setPopup(popup)
        .addTo(map);

    marker.togglePopup();
    activeMarkers.push(marker);

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Zoom into destination slightly or instantly if reduced motion is requested
    map.flyTo({
        center: coords,
        zoom: 4.5,
        pitch: 50,
        duration: prefersReducedMotion ? 0 : 2000
    });
}

// Clear all routes and markers (except FLN)
function clearRoutes() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    // Remove route layers and sources
    if (map) {
        if (map.getLayer('route-line')) map.removeLayer('route-line');
        if (map.getLayer('route-glow')) map.removeLayer('route-glow');
        if (map.getSource('route')) map.removeSource('route');
    }

    // Remove secondary markers (keep origin FLN at index 0)
    if (activeMarkers.length > 1) {
        for (let i = 1; i < activeMarkers.length; i++) {
            activeMarkers[i].remove();
        }
        activeMarkers = [activeMarkers[0]];
    }

    // Re-add reference markers when route is cleared
    referenceMarkers.forEach(marker => {
        marker.addTo(map);
        const popup = marker.getPopup();
        if (popup && !popup.isOpen()) {
            marker.togglePopup();
        }
    });
}

// Globe Auto Rotation Logic
function toggleGlobeRotation() {
    const btn = document.getElementById('btn-rotate');
    if (isRotating) {
        stopGlobeRotation();
        btn.innerHTML = '<i data-lucide="rotate-cw"></i>';
    } else {
        startGlobeRotation();
        btn.innerHTML = '<i data-lucide="square"></i>';
    }
    lucide.createIcons();
}

function startGlobeRotation() {
    if (isRotating) return;
    
    // Do not initiate auto-rotation if the user prefers reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        console.log("Auto-rotation prevented due to prefers-reduced-motion preference.");
        return;
    }
    
    isRotating = true;

    const rotationSpeed = 0.5; // degrees per frame
    
    function rotate() {
        if (!isRotating) return;
        const center = map.getCenter();
        center.lng += rotationSpeed;
        if (center.lng > 180) center.lng -= 360;
        map.setCenter(center);
        currentRotationId = requestAnimationFrame(rotate);
    }
    
    rotate();
}

function stopGlobeRotation() {
    isRotating = false;
    if (currentRotationId) {
        cancelAnimationFrame(currentRotationId);
        currentRotationId = null;
    }
}
