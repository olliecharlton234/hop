/* Web map (the web/PWA beta). Same API as MapCanvas.tsx, drawn with Leaflet. Tiles default
   to Esri's keyless Dark Gray basemap and can be swapped with EXPO_PUBLIC_MAP_TILE_URL
   (public, domain-restricted key). Markers render the same React Native views through
   portals, so they look identical across platforms. */
import { createContext, forwardRef, memo, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Text, View } from 'react-native';
import L from 'leaflet';
import { C } from '@/theme';
import { env } from '@/config/env';
import type { LatLng } from '@/types/models';
import type { MapCanvasProps, MapCanvasRef, MapHeatOverlayProps, MapMarkerProps, MapPolylineProps } from './mapTypes';

const Ctx = createContext<L.Map | null>(null);
/** Leaflet can't animate a map that hasn't been laid out yet (0×0 → NaN) */
const sized = (m: L.Map) => { m.invalidateSize(false); const z = m.getSize(); return z.x > 0 && z.y > 0; };
const CSS = `.leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-pane>svg,.leaflet-pane>canvas,.leaflet-zoom-box,.leaflet-image-layer,.leaflet-layer{position:absolute;left:0;top:0}.leaflet-container{overflow:hidden;background:${C.mapBg};outline:0}.leaflet-tile,.leaflet-marker-icon{user-select:none;-webkit-user-drag:none}.leaflet-tile{filter:inherit;visibility:hidden}.leaflet-tile-loaded{visibility:inherit}.leaflet-container img.leaflet-tile{max-width:none!important;max-height:none!important}.leaflet-zoom-anim .leaflet-zoom-animated{transition:transform .25s cubic-bezier(0,0,.25,1)}.leaflet-zoom-anim .leaflet-tile,.leaflet-pan-anim .leaflet-tile{transition:none}.leaflet-zoom-anim .leaflet-zoom-hide{visibility:hidden}.leaflet-interactive{cursor:pointer}.leaflet-grab{cursor:grab}.leaflet-pane{z-index:400}.leaflet-tile-pane{z-index:200;filter:brightness(.82) contrast(1.12)}.leaflet-overlay-pane{z-index:400}.leaflet-marker-pane{z-index:600}.leaflet-map-pane canvas{z-index:100}.leaflet-map-pane svg{z-index:200}.leaflet-control-container{display:none}.leaflet-image-layer{image-rendering:auto}`;

export const MapCanvas = forwardRef<MapCanvasRef, MapCanvasProps>(function MapCanvas({ initialCenter, initialZoom, padding, onRegionChange, onPress, children, testID }, ref) {
  const el = useRef<any>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  const pad = useRef(padding); pad.current = padding;
  const tries = useRef(0);
  const cb = useRef({ onRegionChange, onPress }); cb.current = { onRegionChange, onPress };

  useEffect(() => {
    if (!document.getElementById('hop-leaflet-css')) { const s = document.createElement('style'); s.id = 'hop-leaflet-css'; s.textContent = CSS; document.head.appendChild(s); }
    const m = L.map(el.current as HTMLElement, { zoomControl: false, attributionControl: false, minZoom: 11, maxZoom: 19, zoomSnap: 0.25 }).setView([initialCenter.lat, initialCenter.lng], initialZoom);
    const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
    const base = env.mapTiles || ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    const labels = env.mapTiles ? env.mapLabels : ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}';
    L.tileLayer(base, { maxNativeZoom: env.mapTiles ? 19 : 16, maxZoom: 19, detectRetina: false }).addTo(m);
    m.createPane('labels'); m.getPane('labels')!.style.zIndex = '300'; m.getPane('labels')!.style.pointerEvents = 'none';
    if (labels) L.tileLayer(labels, { maxNativeZoom: env.mapTiles ? 19 : 16, maxZoom: 19, pane: 'labels' }).addTo(m);
    m.createPane('heat'); m.getPane('heat')!.style.zIndex = '280'; m.getPane('heat')!.style.pointerEvents = 'none';
    const emit = () => { const c = m.getCenter(), b = m.getBounds(); cb.current.onRegionChange?.({ latitude: c.lat, longitude: c.lng, latitudeDelta: b.getNorth() - b.getSouth(), longitudeDelta: b.getEast() - b.getWest() }, m.getZoom()); };
    m.on('moveend', emit);
    m.on('click', (e: L.LeafletMouseEvent) => cb.current.onPress?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    setMap(m);
    (window as any).__hopMap = m; // tests
    setTimeout(() => { m.invalidateSize(); emit(); }, 50);
    return () => { m.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, (): MapCanvasRef => {
   const api: MapCanvasRef = {
    focus(p: LatLng, z?: number, animated = true) {
      if (!map) return;
      if (!sized(map)) { if (tries.current++ < 20) setTimeout(() => api.focus(p, z, false), 150); return; } // first layout not done yet (cold deep link)
      tries.current = 0;
      const zoom = z ?? Math.max(map.getZoom(), 15.5);
      const P = pad.current, size = map.getSize();
      const off = L.point((P.right - P.left) / 2, (P.bottom - P.top) / 2);
      const target = map.unproject(map.project([p.lat, p.lng], zoom).add(off), zoom);
      animated ? map.flyTo(target, zoom, { duration: 0.6 }) : map.setView(target, zoom);
      void size;
    },
    fitTo(points: LatLng[], opts = {}) {
      if (!map || !points.length) return;
      if (!sized(map)) { if (tries.current++ < 20) setTimeout(() => api.fitTo(points, { ...opts, animated: false }), 150); return; }
      tries.current = 0;
      if (points.length === 1) return api.focus(points[0], opts.maxZoom ? Math.min(16, opts.maxZoom) : 16, opts.animated);
      const P = pad.current;
      map.flyToBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { paddingTopLeft: [P.left + 40, P.top + 40], paddingBottomRight: [P.right + 70, P.bottom + 30], maxZoom: opts.maxZoom || 16.5, duration: opts.animated === false ? 0.01 : 0.7 });
    },
    zoom: () => map?.getZoom() ?? initialZoom,
   };
   return api;
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={{ flex: 1, backgroundColor: C.mapBg }} testID={testID}>
      <div ref={el} style={{ position: 'absolute', inset: 0 } as any} data-testid="hop-map" />
      <Text pointerEvents="none" style={{ position: 'absolute', right: 14, top: (padding?.top || 0) + 2, fontSize: 9, color: 'rgba(243,240,234,0.38)', fontFamily: 'system-ui' }}>{env.mapAttribution || (env.mapTiles ? '' : 'Esri, HERE, Garmin, © OpenStreetMap')}</Text>
      <Ctx.Provider value={map}>{map ? children : null}</Ctx.Provider>
    </View>
  );
});

export const MapMarker = memo(function MapMarker({ id, coordinate, width, height, anchorX, anchorY, zIndex = 0, onPress, children, testID }: MapMarkerProps) {
  const map = useContext(Ctx);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const press = useRef(onPress); press.current = onPress;
  const mk = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (!map) return;
    const m = L.marker([coordinate.lat, coordinate.lng], { icon: L.divIcon({ className: '', html: '', iconSize: [width, height], iconAnchor: [anchorX, anchorY] }), zIndexOffset: zIndex * 10, keyboard: false });
    m.on('click', (e) => { L.DomEvent.stopPropagation(e as any); press.current?.(); });
    m.addTo(map);
    mk.current = m;
    const elx = m.getElement()!;
    elx.setAttribute('data-marker', id);
    if (testID) elx.setAttribute('data-testid', testID);
    setHost(elx);
    return () => { m.remove(); };
  }, [map, width, height, anchorX, anchorY]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mk.current?.setLatLng([coordinate.lat, coordinate.lng]); }, [coordinate.lat, coordinate.lng]);
  useEffect(() => { mk.current?.setZIndexOffset(zIndex * 10); }, [zIndex]);
  return host ? createPortal(<View style={{ width, height }}>{children}</View>, host) : null;
});

export const MapPolyline = memo(function MapPolyline({ coordinates, color, width, dashed }: MapPolylineProps) {
  const map = useContext(Ctx);
  const key = coordinates.map((c) => `${c.lat},${c.lng}`).join('|');
  useEffect(() => {
    if (!map) return;
    const l = L.polyline(coordinates.map((p) => [p.lat, p.lng] as [number, number]), { color, weight: width, dashArray: dashed ? '2 8' : undefined, lineCap: 'round', interactive: false }).addTo(map);
    return () => { l.remove(); };
  }, [map, key, color, width, dashed]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
});

export const MapHeatOverlay = memo(function MapHeatOverlay({ uri, bounds, opacity = 1 }: MapHeatOverlayProps) {
  const map = useContext(Ctx);
  useEffect(() => {
    if (!map || !uri) return;
    const l = L.imageOverlay(uri, [[bounds.south, bounds.west], [bounds.north, bounds.east]], { opacity, pane: 'heat', interactive: false, className: 'hop-heat' }).addTo(map);
    return () => { l.remove(); };
  }, [map, uri, bounds.north, bounds.south, bounds.east, bounds.west, opacity]);
  return null;
});
