/**
 * One foreground location fix. Asks for permission on first use; a denial
 * is final for the session and returns null rather than nagging.
 *
 * Accuracy is deliberately coarse — a few hundred metres is plenty for
 * "45 km away" — which is also faster and kinder to the battery.
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import type { LatLon } from '@/lib/geo';

export async function requestLocation(): Promise<LatLon | null> {
  if (Platform.OS === 'web') return null;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    // The last known fix is instant; fall back to a fresh one if there is none.
    const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
    const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return null;
  }
}
