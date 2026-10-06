import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useReducer, useState } from 'react';
import { Linking, PixelRatio, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './ui/app-text';
import { SectionLabel } from './ui/card';

import { localHour, type Place } from '@/data/places';
import { WINDY_API_KEY } from '@/data/project';
import { ensureWebcam, refreshWebcam, subscribe, webcamFor, webcamImageFailed, type WebcamPlace } from '@/data/webcams';
import { isDaytime, minutesSince, pickImage } from '@/data/windy';
import { toRouteId } from '@/lib/geo';
import { TUNING } from '@/lib/tuning';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { useTheme } from '@/theme/use-theme';

const W = TUNING.webcam;

/** Windy's pages open in Safari, so any advertising there is plainly outside Snowpace. */
export function openWindy(url: string) {
  void Linking.openURL(url);
}

export function asWebcamPlace(p: Place): WebcamPlace {
  return { key: p.key, name: p.name, lat: p.lat, lon: p.lon, downhill: p.acts.includes('downhill') };
}

/** Whether webcams can appear at all: switched on, a key built in, and not the web build. */
export function useWebcamsOn(): boolean {
  return useAppState().webcams && !!WINDY_API_KEY && Platform.OS !== 'web';
}

/** Re-render when any camera in the session changes. */
export function useWebcamSession() {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => subscribe(bump), []);
}

/**
 * The place's webcam as one compact row: the image (which opens the camera's
 * Windy page), its title, how recent it is with Refresh, and Other cameras.
 * Omitted entirely when there is no camera, no network, or webcams are off,
 * so its spacing comes in through `style` rather than a wrapper.
 */
export function WebcamSection({ place, style }: { place: Place; style?: StyleProp<ViewStyle> }) {
  const on = useWebcamsOn();
  const theme = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  useWebcamSession();
  const wp = asWebcamPlace(place);

  useEffect(() => {
    if (on && place.listed) ensureWebcam(wp);
    // wp is rebuilt every render; the place key is what identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, place.key, place.listed]);

  const loaded = on ? webcamFor(place.key) : null;
  if (!loaded) return null;

  const cam = loaded.camera;
  const shown = pickImage(cam, W.box, PixelRatio.get(), W.strictPixels);
  if (!shown) return null;

  const w = strings.webcam;
  // The image is always the daylight one; day or night only decides how it is labelled.
  const day = isDaytime(place.hours, localHour(place.timezone));
  const recency = day ? w.updated(ago(minutesSince(cam.lastUpdatedOn))) : w.lastDaylight;

  const refresh = async () => {
    setRefreshing(true);
    await refreshWebcam(wp);
    setRefreshing(false);
  };

  return (
    <View style={[styles.wrap, style]}>
      <SectionLabel>{w.title}</SectionLabel>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={w.openLabel(cam.title)}
          onPress={() => openWindy(cam.detailUrl)}
          // The frame takes the image's own size, so no border shows round it;
          // the empty box after expiry keeps the full size.
          style={[
            styles.box,
            loaded.expired ? { width: W.box.w, height: W.box.h } : { width: shown.width, height: shown.height },
            { backgroundColor: theme.track },
          ]}>
          {!loaded.expired && (
            <Image
              source={{ uri: shown.uri }}
              style={{ width: shown.width, height: shown.height }}
              contentFit="contain"
              // Held in memory for the session, never written to disk (Windy's terms).
              cachePolicy="memory"
              onError={() => void webcamImageFailed(wp)}
              accessibilityIgnoresInvertColors
            />
          )}
        </Pressable>
        <View style={styles.side}>
          <AppText size={13} weight={700} lh={1.25} numberOfLines={2}>
            {cam.title}
          </AppText>
          <View style={styles.recency}>
            <AppText size={11.5} muted>
              {recency}
            </AppText>
            <Pressable accessibilityRole="button" disabled={refreshing} onPress={refresh} hitSlop={10}>
              <AppText size={11.5} weight={700} color={theme.accent} style={refreshing && styles.dim}>
                {w.refresh}
              </AppText>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => router.push({ pathname: '/webcams/[id]', params: { id: toRouteId(place.key) } })}>
            <AppText size={12} weight={700} color={theme.accent}>
              {w.others}
            </AppText>
          </Pressable>
        </View>
      </View>
      <WindyCredit />
    </View>
  );
}

/** "12 min ago" / "3 h ago". */
function ago(min: number): string {
  const w = strings.webcam;
  return min < 1 ? w.justNow : min < 60 ? w.minAgo(min) : w.hoursAgo(Math.round(min / 60));
}

/** Windy's courtesy line, required wherever its webcams are shown, with both parts linked. */
export function WindyCredit() {
  const theme = useTheme();
  const w = strings.webcam;
  return (
    <AppText size={11} muted lh={1.4}>
      {w.creditLead}
      <AppText size={11} lh={1.4} color={theme.accent} accessibilityRole="link" onPress={() => openWindy(w.creditSiteUrl)}>
        {w.creditSite}
      </AppText>
      {w.creditSep}
      <AppText size={11} lh={1.4} color={theme.accent} accessibilityRole="link" onPress={() => openWindy(w.creditAddUrl)}>
        {w.creditAdd}
      </AppText>
    </AppText>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  box: { borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  side: { flex: 1, gap: 6 },
  recency: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 },
  dim: { opacity: 0.5 },
});
