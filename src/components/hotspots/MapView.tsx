import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJSONFeatureCollection, GeoJSONFeature, Watchpoint, HotspotRow } from '../../lib/hotspots';

interface MapViewProps {
  geojson: GeoJSONFeatureCollection | null;
  watchpoints: Watchpoint[];
  center?: [number, number];
  zoom?: number;
  onFeatureClick?: (feature: GeoJSONFeature) => void;
  clusterRadius?: number;
  maxClusterZoom?: number;
}

const DEFAULT_CENTER: [number, number] = [100.5, 13.75]; // Bangkok
const DEFAULT_ZOOM = 5;

const CONFIDENCE_COLORS: Record<string, string> = {
  low: '#ef4444',
  nominal: '#f59e0b',
  high: '#22c55e',
};

export function MapView({
  geojson,
  watchpoints,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  onFeatureClick,
  clusterRadius = 50,
  maxClusterZoom = 14,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredFeature, setHoveredFeature] = useState<GeoJSONFeature | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Check for MapLibre access token
    const accessToken = import.meta.env.VITE_MAPLIBRE_TOKEN || import.meta.env.VITE_MAPBOX_TOKEN;

    const style = accessToken
      ? `https://api.maptiler.com/maps/streets/style.json?key=${accessToken}`
      : 'https://demotiles.maplibre.org/style.json';

    const newMap = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center,
      zoom,
      attributionControl: false,
    });

    map.current = newMap;

    newMap.on('load', () => {
      setMapLoaded(true);

      // Add hotspots source and layers
      if (geojson) {
        addHotspotsLayer(newMap, geojson);
      }

      // Add watchpoints
      if (watchpoints.length) {
        addWatchpointsLayer(newMap, watchpoints);
      }
    });

    // Handle feature click
    if (onFeatureClick) {
      newMap.on('click', 'hotspots-cluster', (e) => {
        const features = e.features;
        if (features && features[0]) {
          onFeatureClick(features[0] as unknown as GeoJSONFeature);
        }
      });

      newMap.on('click', 'hotspots-point', (e) => {
        const features = e.features;
        if (features && features[0]) {
          onFeatureClick(features[0] as unknown as GeoJSONFeature);
        }
      });
    }

    // Hover effects
    newMap.on('mouseenter', 'hotspots-point', () => {
      newMap.getCanvas().style.cursor = 'pointer';
    });

    newMap.on('mouseleave', 'hotspots-point', () => {
      newMap.getCanvas().style.cursor = '';
    });

    newMap.on('mousemove', 'hotspots-point', (e) => {
      const features = e.features;
      if (features && features[0]) {
        setHoveredFeature(features[0] as unknown as GeoJSONFeature);
      } else {
        setHoveredFeature(null);
      }
    });

    return () => {
      newMap.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Update geojson data when it changes
  useEffect(() => {
    if (!map.current || !mapLoaded || !geojson) return;

    const source = map.current.getSource('hotspots') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }
  }, [geojson, mapLoaded]);

  // Update watchpoints when they change
  useEffect(() => {
    if (!map.current || !mapLoaded || !watchpoints.length) return;

    const source = map.current.getSource('watchpoints') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: watchpoints.map((wp) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [wp.lon, wp.lat],
          },
          properties: {
            name: wp.name,
            region: wp.region,
            country: wp.country,
          },
        })),
      });
    }
  }, [watchpoints, mapLoaded]);

  const addHotspotsLayer = useCallback((mapInstance: maplibregl.Map, data: GeoJSONFeatureCollection) => {
    // Add source with clustering
    mapInstance.addSource('hotspots', {
      type: 'geojson',
      data,
      cluster: true,
      clusterMaxZoom: maxClusterZoom,
      clusterRadius,
      clusterProperties: {
        count: ['+', ['case', ['==', ['get', 'confidence'], 'high'], 1, 0]],
        sumFrp: ['+', ['get', 'frp']],
        avgFrp: ['/', ['+', ['get', 'frp']], ['+', 1]],
      },
    });

    // Cluster circles
    mapInstance.addLayer({
      id: 'hotspots-cluster',
      type: 'circle',
      source: 'hotspots',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': [
          'step',
          ['get', 'point_count'],
          '#3b82f6',
          10,
          '#f59e0b',
          50,
          '#ef4444',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          16,
          10,
          20,
          50,
          28,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
      },
    });

    // Cluster count labels
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
      paint: {
        'text-color': '#fff',
        'text-halo-color': '#000',
        'text-halo-width': 1,
      },
    });

    // Individual points (unclustered)
    mapInstance.addLayer({
      id: 'hotspots-point',
      type: 'circle',
      source: 'hotspots',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'frp'],
          0, 4,
          10, 6,
          50, 8,
          100, 10,
          200, 12,
        ],
        'circle-color': [
          'match',
          ['get', 'confidence'],
          'low', '#ef4444',
          'nominal', '#f59e0b',
          'high', '#22c55e',
          '#6b7280',
        ],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.8,
      },
    });

    // Hover highlight for points
    mapInstance.addLayer({
      id: 'hotspots-point-hover',
      type: 'circle',
      source: 'hotspots',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['get', 'frp'],
          0, 8,
          10, 10,
          50, 12,
          100, 14,
          200, 16,
        ],
        'circle-color': '#fff',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#3b82f6',
        'circle-opacity': 0,
      },
    });
  }, [clusterRadius, maxClusterZoom]);

  const addWatchpointsLayer = useCallback((mapInstance: maplibregl.Map, wps: Watchpoint[]) => {
    mapInstance.addSource('watchpoints', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: wps.map((wp) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [wp.lon, wp.lat],
          },
          properties: {
            name: wp.name,
            region: wp.region,
            country: wp.country,
          },
        })),
      },
    });

    // Watchpoint markers
    mapInstance.addLayer({
      id: 'watchpoints-point',
      type: 'circle',
      source: 'watchpoints',
      paint: {
        'circle-radius': 10,
        'circle-color': '#8b5cf6',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#fff',
      },
    });

    // Watchpoint labels
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
        'text-color': '#1f2937',
        'text-halo-color': '#fff',
        'text-halo-width': 2,
      },
    });
  }, []);

  // Handle hover highlight
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const mapInstance = map.current;

    if (hoveredFeature) {
      const props = hoveredFeature.properties as HotspotRow;
      mapInstance.setFilter('hotspots-point-hover', [
        'all',
        ['!', ['has', 'point_count']],
        ['==', ['get', 'lat'], props.lat],
        ['==', ['get', 'lon'], props.lon],
      ]);
    } else {
      mapInstance.setFilter('hotspots-point-hover', ['==', 'confidence', 'none']);
    }
  }, [hoveredFeature, mapLoaded]);

  return (
    <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
      <div
        ref={mapContainer}
        className="w-full h-[500px]"
        style={{ width: '100%', height: '500px' }}
      />
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-gray-600 dark:text-gray-400">กำลังโหลดแผนที่...</p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-xs">
        <div className="font-medium text-gray-900 dark:text-white mb-2">จุดไฟ (Confidence)</div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CONFIDENCE_COLORS).map(([level, color]) => (
            <div key={level} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-gray-700 dark:text-gray-300 capitalize">
                {level === 'low' ? 'ต่ำ' : level === 'nominal' ? 'ปานกลาง' : 'สูง'}
              </span>
            </div>
          ))}
        </div>
        <div className="font-medium text-gray-900 dark:text-white mb-2 mt-2">จุดตรวจสอบ (Watchpoints)</div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-purple-600 border-2 border-white" />
          <span className="text-gray-700 dark:text-gray-300">Watchpoint</span>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredFeature && (
        <div className="absolute bottom-4 right-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-xs max-w-xs">
          <div className="font-medium text-gray-900 dark:text-white mb-1">
            {hoveredFeature.properties.date} {hoveredFeature.properties.time}
          </div>
          <div className="grid grid-cols-2 gap-1 text-gray-700 dark:text-gray-300">
            <span>พิกัด:</span>
            <span className="font-mono">
              {hoveredFeature.properties.lat.toFixed(4)}, {hoveredFeature.properties.lon.toFixed(4)}
            </span>
            <span>ความเชื่อมั่น:</span>
            <span className="capitalize">{hoveredFeature.properties.confidence}</span>
            <span>FRP:</span>
            <span className="font-mono">{hoveredFeature.properties.frp.toFixed(1)} MW</span>
            <span>ดาวเทียม:</span>
            <span>{hoveredFeature.properties.satellite}</span>
            <span>วัน/คืน:</span>
            <span>{hoveredFeature.properties.daynight === 'D' ? 'กลางวัน' : 'กลางคืน'}</span>
            <span>เครื่องมือ:</span>
            <span>{hoveredFeature.properties.instrument}</span>
            <span>ความสว่าง:</span>
            <span className="font-mono">{hoveredFeature.properties.brightness.toFixed(1)} K</span>
          </div>
        </div>
      )}

      {/* Cluster info */}
      {geojson && (
        <div className="absolute top-4 right-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 text-xs">
          <div className="font-medium text-gray-900 dark:text-white mb-1">ข้อมูลโคลัสเตอร์</div>
          <div className="text-gray-700 dark:text-gray-300">
            โคลัสเตอร์จะรวมจุดไฟที่อยู่ใกล้กัน
            <br />
            ซูมเข้าเพื่อดูจุดเดี่ยว
          </div>
        </div>
      )}
    </div>
  );
}