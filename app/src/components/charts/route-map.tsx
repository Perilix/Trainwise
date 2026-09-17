import { requireOptionalNativeModule } from 'expo';
import { useMemo } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { RoutePreview } from '@/components/charts/route-preview';
import { decodePolyline } from '@/lib/polyline';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

type Props = {
  width: number;
  height: number;
  polyline?: string | null;
};

/**
 * `expo-maps` est un module natif : absent du web et d'Expo Go, où son import
 * échouerait. `requireOptionalNativeModule` répond `null` au lieu de lever, ce
 * qui permet de ne charger le module que là où il peut vivre — sinon on retombe
 * sur le tracé dessiné.
 */
export const nativeMapAvailable = Platform.OS !== 'web' && requireOptionalNativeModule('ExpoMaps') !== null;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const maps: typeof import('expo-maps') | null = nativeMapAvailable ? require('expo-maps') : null;

/** Zoom qui fait tenir la boîte englobante du parcours dans la largeur donnée. */
const zoomFor = (spanLat: number, spanLng: number, width: number) => {
  const span = Math.max(spanLng, spanLat * 1.7, 0.0005);
  return Math.min(16, Math.max(10, Math.log2((360 * (width / 256)) / span)));
};

/** Parcours d'une sortie sur une carte (Plans sur iOS, Google Maps sur Android). */
export function RouteMap({ width, height, polyline }: Props) {
  const { colors } = useTheme();
  const points = useMemo(() => (polyline ? decodePolyline(polyline) : []), [polyline]);

  if (!maps || points.length < 2) {
    return <RoutePreview width={width} height={height} polyline={polyline} />;
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const center = { latitude: (Math.min(...lats) + Math.max(...lats)) / 2, longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
  const cameraPosition = { coordinates: center, zoom: zoomFor(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs), width) };
  const polylines = [{ id: 'route', coordinates: points.map((point) => ({ latitude: point.lat, longitude: point.lng })), color: colors.accent, width: 4 }];

  const MapView = Platform.OS === 'ios' ? maps.AppleMaps.View : maps.GoogleMaps.View;

  return (
    <View style={[styles.frame, { width, height, borderColor: colors.border }]}>
      <MapView style={StyleSheet.absoluteFill} cameraPosition={cameraPosition} polylines={polylines} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
});
