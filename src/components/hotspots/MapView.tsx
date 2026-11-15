import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONFeatureCollection } from '../../lib/hotspots/types';

interface MapViewProps {
  geojson: GeoJSONFeatureCollection | null;
  watchpoints?: Array<{ name: string; lat: number; lon: number; region: string }>;
  center?: [number, number];
  zoom?: number;
  onFeatureClick?: (feature: GeoJSONFeatureCollection['features'][0]) => void;
  onWatchpointClick?: (wp: { name: string; lat: number; lon: number; region: string }) => void;
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_CENTER: [number, number] = [100, 15];
const DEFAULT_ZOOM = 3;

export function MapView({
  geojson,
  watchpoints = [],
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  onFeatureClick,
  onWatchpointClick,
  className = '',
  style,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'background',
              type: 'raster',
              source: 'osm',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center,
        zoom,
        attributionControl: false,
      });

      map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.current.addControl(
        new maplibregl.ScaleControl({ unit: 'metric' }),
        'bottom-left'
      );

      map.current.on('load', () => {
        setMapLoaded(true);
        addLayers();
      });

      map.current.on('error', (e) => {
        setError(e.error?.message || 'Map error');
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize map');
    }

    return () => {
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Add/update layers when data changes
  const addLayers = () => {
    if (!map.current || !mapLoaded) return;

    const mapInstance = map.current;

    // Hotspots layer
    if (geojson) {
      const hotspotsSource = mapInstance.getSource('hotspots') as maplibregl.GeoJSONSource | undefined;
      if (hotspotsSource) {
        hotspotsSource.setData(geojson);
      } else {
        mapInstance.addSource('hotspots', {
          type: 'geojson',
          data: geojson,
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 14,
        });

        // Cluster circles
        mapInstance.addLayer({
          id: 'hotspots-clusters',
          type: 'circle',
          source: 'hotspots',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step',
              ['get', 'point_count'],
              '#51bbd6',
              100,
              '#f1f075',
              750,
              '#f28cb1',
            ],
            'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
          },
        });

        // Cluster labels
        mapInstance.addLayer({
          id: 'hotspots-cluster-count',
          type: 'symbol',
          source: 'hotspots',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
        });

        // Unclustered points
        mapInstance.addLayer({
          id: 'hotspots-unclustered',
          type: 'circle',
          source: 'hotspots',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['get', 'frp'],
              0, 3,
              50, 8,
              100, 12,
              200, 16,
            ],
            'circle-color': [
              'match',
              ['get', 'confidence'],
              'high', '#ff3333',
              'nominal', '#ffaa00',
              'low', '#ffff00',
              '#888888',
            ],
            'circle-opacity': 0.8,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Click handler for unclustered points
        mapInstance.on('click', 'hotspots-unclustered', (e) => {
          if (e.features && e.features[0] && onFeatureClick) {
            onFeatureClick(e.features[0] as any);
          }
        });

        mapInstance.on('mouseenter', 'hotspots-unclustered', () => {
          mapInstance.getCanvas().style.cursor = 'pointer';
        });
        mapInstance.on('mouseleave', 'hotspots-unclustered', () => {
          mapInstance.getCanvas().style.cursor = '';
        });
      }
    } else if (mapInstance.getSource('hotspots')) {
      mapInstance.removeLayer('hotspots-unclustered');
      mapInstance.removeLayer('hotspots-clusters');
      mapInstance.removeLayer('hotspots-cluster-count');
      mapInstance.removeSource('hotspots');
    }

    // Watchpoints layer
    if (watchpoints.length > 0) {
      const watchpointsGeoJSON = {
        type: 'FeatureCollection' as const,
        features: watchpoints.map((wp) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [wp.lon, wp.lat],
          },
          properties: wp,
        })),
      };

      const watchpointsSource = mapInstance.getSource('watchpoints') as maplibregl.GeoJSONSource | undefined;
      if (watchpointsSource) {
        watchpointsSource.setData(watchpointsGeoJSON);
      } else {
        mapInstance.addSource('watchpoints', {
          type: 'geojson',
          data: watchpointsGeoJSON,
        });

        mapInstance.addLayer({
          id: 'watchpoints',
          type: 'circle',
          source: 'watchpoints',
          paint: {
            'circle-radius': 10,
            'circle-color': '#0066ff',
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        mapInstance.addLayer({
          id: 'watchpoints-label',
          type: 'symbol',
          source: 'watchpoints',
          layout: {
            'text-field': ['get', 'name'],
            'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
            'text-size': 11,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-allow-overlap': true,
          },
          paint: {
            'text-color': '#0066ff',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1,
          },
        });

        mapInstance.on('click', 'watchpoints', (e) => {
          if (e.features && e.features[0] && onWatchpointClick) {
            onWatchpointClick(e.features[0].properties as any);
          }
        });

        mapInstance.on('mouseenter', 'watchpoints', () => {
          mapInstance.getCanvas().style.cursor = 'pointer';
        });
        mapInstance.on('mouseleave', 'watchpoints', () => {
          mapInstance.getCanvas().style.cursor = '';
        });
      }
    } else if (mapInstance.getSource('watchpoints')) {
      mapInstance.removeLayer('watchpoints-label');
      mapInstance.removeLayer('watchpoints');
      mapInstance.removeSource('watchpoints');
    }
  };

  // Update layers when data changes
  useEffect(() => {
    if (mapLoaded) {
      addLayers();
    }
  }, [geojson, watchpoints, mapLoaded]);

  // Handle map resize
  useEffect(() => {
    const handleResize = () => map.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 ${className}`} style={{ ...style, minHeight: '400px' }}>
        <div className="text-center p-4">
          <p className="text-red-600 dark:text-red-400">Map Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className={`relative ${className}`}
      style={{ width: '100%', height: '100%', minHeight: '400px', ...style }}
    />
  );
}

// ==================== Legend Component ====================

interface MapLegendProps {
  showHotspots?: boolean;
  showWatchpoints?: boolean;
  className?: string;
}

export function MapLegend({ showHotspots = true, showWatchpoints = true, className = '' }: MapLegendProps) {
  return (
    <div className={`absolute bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 z-10 ${className}`}>
      {showHotspots && (
        <div className="mb-3">
          <div className="font-medium text-sm mb-2">Hotspots</div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded-full bg-red-500"></div>
            <span>High confidence</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
            <span>Nominal confidence</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded-full bg-yellow-300"></div>
            <span>Low confidence</span>
          </div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <div className="w-3 h-3 rounded-full border-2 border-white bg-transparent"></div>
            <span>Cluster</span>
          </div>
        </div>
      )}
      {showWatchpoints && (
        <div>
          <div className="font-medium text-sm mb-2">Watchpoints</div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white"></div>
            <span>Fire watchpoint</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Popup Component ====================

interface FeaturePopupProps {
  feature: GeoJSONFeatureCollection['features'][0] | null;
  onClose: () => void;
}

export function FeaturePopup({ feature, onClose }: FeaturePopupProps) {
  if (!feature) return null;

  const props = feature.properties;
  const coords = feature.geometry.coordinates;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 min-w-[200px]">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium">Hotspot Details</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">×</button>
      </div>
      <div className="space-y-1 text-sm">
        <div><strong>Date:</strong> {props.date} {props.time}</div>
        <div><strong>Confidence:</strong> <span className={`capitalize ${props.confidence === 'high' ? 'text-red-600' : props.confidence === 'nominal' ? 'text-yellow-600' : 'text-yellow-400'}`}>{props.confidence}</span></div>
        <div><strong>FRP:</strong> {props.frp.toFixed(1)} MW</div>
        <div><strong>Brightness:</strong> {props.brightness.toFixed(1)} K</div>
        <div><strong>Satellite:</strong> {props.satellite} ({props.instrument})</div>
        <div><strong>Time:</strong> {props.daynight === 'D' ? 'Day' : 'Night'}</div>
        <div><strong>Location:</strong> {coords[1].toFixed(4)}, {coords[0].toFixed(4)}</div>
      </div>
    </div>
  );
}