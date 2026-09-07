import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useNavigate } from 'react-router-dom';
import type { PublicProjectPin } from './types';

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
if (mapboxToken) mapboxgl.accessToken = mapboxToken;

interface PublicProjectMapProps {
  pins: PublicProjectPin[];
  height?: string;
}

/**
 * The public counterpart to PortfolioMap: no internal health colours, and every
 * pin is a link into the case study. Rendered only where published, geocoded work
 * exists, so an empty portfolio never ships a blank map to a marketing page.
 */
const PublicProjectMap = ({ pins, height = '460px' }: PublicProjectMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    if (!mapboxToken || !containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-75.16, 39.95],
      zoom: 10.5,
      attributionControl: false,
      cooperativeGestures: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    mapRef.current = map;
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds = new mapboxgl.LngLatBounds();
    pins.forEach((pin) => {
      const link = document.createElement('a');
      link.href = `/work/${pin.slug}`;
      link.title = `${pin.title} — ${pin.project_type}`;
      link.setAttribute('aria-label', `Open case study for ${pin.title}`);
      link.className = 'block h-4 w-4 rounded-full border-2 border-white bg-[#dfc48e] shadow-lg transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-white';
      link.addEventListener('click', (event) => {
        // Keep modified clicks (new tab, download) behaving like a normal link.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigateRef.current(`/work/${pin.slug}`);
      });
      const coordinates: [number, number] = [pin.longitude, pin.latitude];
      markersRef.current.push(new mapboxgl.Marker({ element: link }).setLngLat(coordinates).addTo(map));
      bounds.extend(coordinates);
    });

    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 72, maxZoom: 14, duration: 0 });
  }, [pins]);

  if (!mapboxToken || pins.length === 0) return null;

  return <div className="overflow-hidden rounded-lg border border-white/15" style={{ height }}><div ref={containerRef} className="h-full w-full" /></div>;
};

export default PublicProjectMap;
