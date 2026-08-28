import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { ScoredLead } from '@/lib/dealSourcingInsights';

const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
if (mapboxToken) {
  mapboxgl.accessToken = mapboxToken;
}

export interface MapBounds {
  north: number; south: number; east: number; west: number;
}

interface Props {
  leads:          ScoredLead[];
  selectedId:     string | null;
  onLeadSelect:   (lead: ScoredLead) => void;
  onLeadHover?:   (lead: ScoredLead | null) => void;
  onBoundsChange: (bounds: MapBounds) => void;
  fitBoundsKey?:  string; // change this value to trigger a re-fit to current leads
  height?:        string;
}

// Build GeoJSON FeatureCollection from scored leads that have coordinates
function toGeoJSON(leads: ScoredLead[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: leads
      .filter(({ lead }) => lead.latitude != null && lead.longitude != null)
      .map(({ lead, score }) => ({
        type:       'Feature',
        id:         lead.id,
        geometry:   { type: 'Point', coordinates: [lead.longitude!, lead.latitude!] },
        properties: {
          id:      lead.id,
          score:   score.score,
          address: lead.property_address ?? '',
          city:    [lead.city, lead.state].filter(Boolean).join(', '),
          value:   lead.property_value ?? null,
          label:   score.label,
        },
      })),
  };
}

const SCORE_COLOR_EXPR: mapboxgl.Expression = [
  'case',
  ['>=', ['get', 'score'], 70], '#ef4444',
  ['>=', ['get', 'score'], 45], '#f59e0b',
  '#6366f1',
];

const DealSourcingMap: React.FC<Props> = ({
  leads,
  selectedId,
  onLeadSelect,
  onLeadHover,
  onBoundsChange,
  fitBoundsKey,
  height = '100%',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const popupRef     = useRef<mapboxgl.Popup | null>(null);
  // Keep latest callbacks in refs so map event listeners don't go stale
  const onLeadSelectRef   = useRef(onLeadSelect);
  const onLeadHoverRef    = useRef(onLeadHover);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const leadsRef          = useRef(leads);
  onLeadSelectRef.current   = onLeadSelect;
  onLeadHoverRef.current    = onLeadHover;
  onBoundsChangeRef.current = onBoundsChange;
  leadsRef.current          = leads;

  // ── Init map (once) ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style:     'mapbox://styles/mapbox/light-v11',
      center:    [-96, 38],   // center of continental US
      zoom:      4,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      // ── GeoJSON source with clustering ──────────────────────────────────
      map.addSource('leads', {
        type:    'geojson',
        data:    toGeoJSON(leadsRef.current),
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius:  40,
      });

      // Cluster circles
      map.addLayer({
        id:     'clusters',
        type:   'circle',
        source: 'leads',
        filter: ['has', 'point_count'],
        paint:  {
          'circle-color': [
            'step', ['get', 'point_count'],
            '#6366f1', 10,
            '#f59e0b', 50,
            '#ef4444',
          ],
          'circle-radius': [
            'step', ['get', 'point_count'],
            16, 10, 22, 50, 28,
          ],
          'circle-opacity': 0.85,
        },
      });

      // Cluster count labels
      map.addLayer({
        id:     'cluster-count',
        type:   'symbol',
        source: 'leads',
        filter: ['has', 'point_count'],
        layout: {
          'text-field':  ['get', 'point_count_abbreviated'],
          'text-size':   12,
          'text-font':   ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': '#ffffff' },
      });

      // Individual lead circles
      map.addLayer({
        id:     'lead-points',
        type:   'circle',
        source: 'leads',
        filter: ['!', ['has', 'point_count']],
        paint:  {
          'circle-color':        SCORE_COLOR_EXPR,
          'circle-radius':       7,
          'circle-opacity':      0.85,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Selected lead highlight (separate layer, filtered by id)
      map.addLayer({
        id:     'lead-selected',
        type:   'circle',
        source: 'leads',
        filter: ['==', ['get', 'id'], ''],
        paint:  {
          'circle-color':        '#ffffff',
          'circle-radius':       10,
          'circle-opacity':      1,
          'circle-stroke-width': 3,
          'circle-stroke-color': SCORE_COLOR_EXPR,
        },
      });

      // ── Cursor ──────────────────────────────────────────────────────────
      ['clusters', 'lead-points'].forEach(layerId => {
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
      });

      // ── Cluster click → zoom in ──────────────────────────────────────────
      map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId == null) return;
        (map.getSource('leads') as mapboxgl.GeoJSONSource).getClusterExpansionZoom(
          clusterId,
          (err, zoom) => {
            if (err || zoom == null) return;
            map.easeTo({ center: (features[0].geometry as GeoJSON.Point).coordinates as [number, number], zoom });
          }
        );
      });

      // ── Lead click → detail sheet ────────────────────────────────────────
      map.on('click', 'lead-points', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const id   = feature.properties?.id as string;
        const lead = leadsRef.current.find(l => l.lead.id === id);
        if (lead) {
          onLeadSelectRef.current(lead);
          if (popupRef.current) { popupRef.current.remove(); popupRef.current = null; }
        }
      });

      // ── Hover → fire callback so parent can show inline detail ─────────
      map.on('mouseenter', 'lead-points', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const id   = feature.properties?.id as string;
        const lead = leadsRef.current.find(l => l.lead.id === id);
        if (lead) onLeadHoverRef.current?.(lead);
      });

      map.on('mouseleave', 'lead-points', () => {
        onLeadHoverRef.current?.(null);
      });

      // ── Viewport change → parent ─────────────────────────────────────────
      const emitBounds = () => {
        const b = map.getBounds();
        onBoundsChangeRef.current({
          north: b.getNorth(), south: b.getSouth(),
          east:  b.getEast(),  west:  b.getWest(),
        });
      };
      map.on('moveend', emitBounds);
      emitBounds(); // emit initial bounds once loaded
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);  

  // ── Update GeoJSON when leads change ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource('leads') as mapboxgl.GeoJSONSource | undefined;
    src?.setData(toGeoJSON(leads));
  }, [leads]);

  // ── Highlight selected lead ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    map.setFilter('lead-selected', ['==', ['get', 'id'], selectedId ?? '']);

    if (selectedId) {
      const lead = leads.find(l => l.lead.id === selectedId);
      if (lead?.lead.latitude && lead.lead.longitude) {
        map.easeTo({ center: [lead.lead.longitude, lead.lead.latitude], zoom: Math.max(map.getZoom(), 13), duration: 500 });
      }
    }
  }, [selectedId, leads]);

  // ── Fit bounds to mapped leads ────────────────────────────────────────────
  // Fires on initial data load AND whenever fitBoundsKey changes (filter/source change)
  const fittedRef    = useRef(false);
  const lastFitKey   = useRef<string | undefined>(undefined);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const mapped = leads.filter(l => l.lead.latitude && l.lead.longitude);
    if (!mapped.length) return;

    const isFirstFit  = !fittedRef.current;
    const keyChanged  = fitBoundsKey !== undefined && fitBoundsKey !== lastFitKey.current;

    if (!isFirstFit && !keyChanged) return;

    fittedRef.current  = true;
    lastFitKey.current = fitBoundsKey;

    const bounds = new mapboxgl.LngLatBounds();
    mapped.forEach(({ lead }) => bounds.extend([lead.longitude!, lead.latitude!]));
    map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 600 });
  }, [leads, fitBoundsKey]);

  return <div ref={containerRef} style={{ width: '100%', height }} className="rounded-2xl overflow-hidden" />;
};

export default DealSourcingMap;
