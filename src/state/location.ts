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

// A fresh fix can take a long time indoors, and the launch waits for it. Past
// this, settle for the last fix the phone has, however old, or go without.
const FIX_TIMEOUT_MS = 5_000;

export async function requestLocation(): Promise<LatLon | null> {
  if (Platform.OS === 'web') return null;
  try {
    // Not timed: the user may be reading the permission prompt.
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    // The last known fix is instant; fall back to a fresh one if there is none.
    const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
    const pos = last
      ?? (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }), FIX_TIMEOUT_MS))
      ?? (await Location.getLastKnownPositionAsync());
    return pos ? { lat: pos.coords.latitude, lon: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

/** The promise's value, or null if it has not settled within `ms`. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}
