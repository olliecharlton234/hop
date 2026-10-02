/* Native map (iOS: Apple Maps, Android: Google Maps) via react-native-maps.
   Runs in Expo Go with no API key. The web build swaps in MapCanvas.web.tsx (Leaflet). */
import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import MapView, { Marker, Overlay, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT, type MapStyleElement } from 'react-native-maps';
import { C } from '@/theme';
import type { LatLng } from '@/types/models';
import { deltaFromZoom, zoomFromDelta, type MapCanvasProps, type MapCanvasRef, type MapHeatOverlayProps, type MapMarkerProps, type MapPolylineProps, type Region } from './mapTypes';

// Dark, quiet base map: streets and water readable, points of interest off (HOP draws its own)
const DARK: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#14161a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7d8088' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b0d10' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#5a5f69' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#22262d' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2a2f37' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#30353e' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#6b6f78' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1923' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#121c16' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#121c16' }, { visibility: 'on' }] },
];

export const MapCanvas = forwardRef<MapCanvasRef, MapCanvasProps>(function MapCanvas({ initialCenter, initialZoom, padding, onRegionChange, onPress, children, testID }, ref) {
  const map = useRef<MapView>(null);
  const size = useRef({ w: 390, h: 844 });
  const region = useRef<Region | null>(null);
  const zoomRef = useRef(initialZoom);
  const pad = useRef(padding);
  pad.current = padding;

  const regionFor = (p: LatLng, z: number): Region => {
    const { w, h } = size.current;
    const lngD = deltaFromZoom(z, w);
    const latD = lngD * (h / w) * Math.cos((p.lat * Math.PI) / 180);
    // keep the point in the middle of what's visible, not behind the sheet
    const latPerPx = latD / h, lngPerPx = lngD / w;
    const P = pad.current;
    return { latitude: p.lat - ((P.bottom - P.top) / 2) * latPerPx, longitude: p.lng - ((P.right - P.left) / 2) * lngPerPx, latitudeDelta: latD, longitudeDelta: lngD };
  };
  const [initial] = useState(() => regionFor(initialCenter, initialZoom));

  useImperativeHandle(ref, (): MapCanvasRef => {
   const api: MapCanvasRef = {
    focus(p, z, animated = true) { map.current?.animateToRegion(regionFor(p, z ?? Math.max(zoomRef.current, 15.5)), animated ? 550 : 1); },
    fitTo(points, opts = {}) {
      if (!points.length) return;
      if (points.length === 1) { api.focus(points[0], opts.maxZoom ? Math.min(16, opts.maxZoom) : 16, opts.animated); return; }
      const P = pad.current;
      map.current?.fitToCoordinates(points.map((p) => ({ latitude: p.lat, longitude: p.lng })), { edgePadding: { top: P.top + 40, right: P.right + 70, bottom: P.bottom + 30, left: P.left + 40 }, animated: opts.animated !== false });
    },
    zoom: () => zoomRef.current,
   };
   return api;
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.mapBg }} onLayout={(e) => { size.current = { w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height }; }} testID={testID}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        customMapStyle={Platform.OS === 'android' ? DARK : undefined}
        userInterfaceStyle="dark"
        initialRegion={initial}
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsIndoors={false}
        showsCompass={false}
        toolbarEnabled={false}
        pitchEnabled={false}
        rotateEnabled={false}
        moveOnMarkerPress={false}
        loadingEnabled
        loadingBackgroundColor={C.mapBg}
        loadingIndicatorColor={C.accent}
        onPress={(e) => { if ((e.nativeEvent as any).action === 'marker-press') return; onPress?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude }); }}
        onRegionChangeComplete={(r) => {
          region.current = r;
          zoomRef.current = zoomFromDelta(r.longitudeDelta, size.current.w);
          onRegionChange?.(r, zoomRef.current);
        }}
      >
        {children}
      </MapView>
    </View>
  );
});

/** A marker drawn from React Native views. Snapshotted after it settles for smooth panning. */
export const MapMarker = memo(function MapMarker({ coordinate, width, height, anchorX, anchorY, zIndex, onPress, redrawKey, children, testID }: MapMarkerProps) {
  const [track, setTrack] = useState(true);
  useEffect(() => { setTrack(true); const t = setTimeout(() => setTrack(false), 1500); return () => clearTimeout(t); }, [redrawKey]);
  return (
    <Marker
      coordinate={{ latitude: coordinate.lat, longitude: coordinate.lng }}
      anchor={{ x: anchorX / width, y: anchorY / height }}
      centerOffset={{ x: width / 2 - anchorX, y: height / 2 - anchorY }}
      tracksViewChanges={track}
      zIndex={zIndex}
      onPress={(e) => { e.stopPropagation?.(); onPress?.(); }}
      testID={testID}
    >
      <View style={{ width, height }} collapsable={false}>{children}</View>
    </Marker>
  );
});

export const MapPolyline = memo(function MapPolyline({ coordinates, color, width, dashed, zIndex }: MapPolylineProps) {
  return <Polyline coordinates={coordinates.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={color} strokeWidth={width} lineDashPattern={dashed ? [2, 8] : undefined} lineCap="round" zIndex={zIndex} />;
});

export const MapHeatOverlay = memo(function MapHeatOverlay({ uri, bounds, opacity = 1 }: MapHeatOverlayProps) {
  return <Overlay image={{ uri }} bounds={[[bounds.north, bounds.east], [bounds.south, bounds.west]]} opacity={opacity} />;
});
