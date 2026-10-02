import type { ReactNode } from 'react';
import type { LatLng } from '@/types/models';

export type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
export type Padding = { top: number; right: number; bottom: number; left: number };

export interface MapCanvasRef {
  /** Centre a point in the visible area (between the top bar and the sheet) at a zoom */
  focus: (p: LatLng, zoom?: number, animated?: boolean) => void;
  fitTo: (points: LatLng[], opts?: { maxZoom?: number; animated?: boolean }) => void;
  zoom: () => number;
}
export interface MapCanvasProps {
  initialCenter: LatLng;
  initialZoom: number;
  padding: Padding;
  onRegionChange?: (r: Region, zoom: number) => void;
  onPress?: (p: LatLng) => void;
  children?: ReactNode;
  testID?: string;
}
export interface MapMarkerProps {
  id: string;
  coordinate: LatLng;
  /** fixed view size (needed so the anchor lands on the pin, not the label) */
  width: number;
  height: number;
  /** where the coordinate sits inside the view, in px from the top-left */
  anchorX: number;
  anchorY: number;
  zIndex?: number;
  onPress?: () => void;
  /** change this when the marker's look changes (native snapshots the view) */
  redrawKey?: string;
  children: ReactNode;
  testID?: string;
}
export interface MapPolylineProps { coordinates: LatLng[]; color: string; width: number; dashed?: boolean; zIndex?: number }
export interface MapHeatOverlayProps { uri: string; bounds: { north: number; south: number; east: number; west: number }; opacity?: number }

export const zoomFromDelta = (lngDelta: number, widthPx: number) => Math.log2((360 * (widthPx / 256)) / Math.max(1e-6, lngDelta));
export const deltaFromZoom = (zoom: number, widthPx: number) => (360 * (widthPx / 256)) / 2 ** zoom;
