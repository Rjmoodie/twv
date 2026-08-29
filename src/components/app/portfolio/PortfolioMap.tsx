import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPinOff } from 'lucide-react';
import type { PortfolioProject } from './types';

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
if (mapboxToken) mapboxgl.accessToken = mapboxToken;

interface PortfolioMapProps {
  projects: PortfolioProject[];
  selectedId: string | null;
  onSelect: (project: PortfolioProject) => void;
  height?: string;
}

const colors: Record<string, string> = {
  on_track: '#16a34a',
  attention: '#f59e0b',
  at_risk: '#dc2626',
  needs_plan: '#6366f1',
};

const PortfolioMap = ({ projects, selectedId, onSelect, height = '620px' }: PortfolioMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const mappedProjects = projects.filter(
    (project) => project.latitude != null && project.longitude != null,
  );

  useEffect(() => {
    if (!mapboxToken || !containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [-96, 38],
      zoom: 3.5,
      attributionControl: false,
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
    mappedProjects.forEach((project) => {
      const point = document.createElement('button');
      point.type = 'button';
      point.setAttribute('aria-label', `Open ${project.project_name}`);
      point.title = `${project.project_name} — ${project.city}, ${project.state}`;
      point.className = 'rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary';
      const selected = project.project_id === selectedId;
      point.style.width = selected ? '24px' : '18px';
      point.style.height = selected ? '24px' : '18px';
      point.style.backgroundColor = colors[project.health] ?? colors.needs_plan;
      point.addEventListener('click', () => onSelectRef.current(project));
      const coordinates: [number, number] = [Number(project.longitude), Number(project.latitude)];
      const marker = new mapboxgl.Marker({ element: point }).setLngLat(coordinates).addTo(map);
      markersRef.current.push(marker);
      bounds.extend(coordinates);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 64, maxZoom: 13, duration: 500 });
    }
  }, [mappedProjects, selectedId]);

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed bg-muted/30" style={{ height }}>
        <div className="max-w-sm px-6 text-center">
          <MapPinOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-medium">Map view needs a Mapbox token</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add VITE_MAPBOX_TOKEN to enable property pins. The project list and every action remain available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border bg-muted/20" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      {mappedProjects.length === 0 && (
        <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-lg border bg-background/95 p-3 text-center text-sm shadow">
          Add latitude and longitude when creating a project to place it on the map.
        </div>
      )}
    </div>
  );
};

export default PortfolioMap;
