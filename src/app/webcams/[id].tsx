import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { PixelRatio, Pressable, StyleSheet, View } from 'react-native';

import { asWebcamPlace, openWindy, WindyCredit } from '@/components/webcam-section';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { BackButton, Screen, ScreenTitle } from '@/components/ui/screen';
import { listWebcams, pickWebcam, radiusFor, type CameraList } from '@/data/webcams';
import { pickImage, type Ranked } from '@/data/windy';
import { fmtDistance } from '@/lib/format';
import { fromRouteId } from '@/lib/geo';
import { TUNING } from '@/lib/tuning';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { gutter } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const W = TUNING.webcam;

/**
 * Other cameras: every usable camera near a place, best match first. It is
 * both a way to look around and the override the handoff requires — the
 * user's choice is remembered for the place and always wins over ranking.
 * A picture opens the camera on windy.com (the terms link every image there);
 * the camera's name is what chooses it.
 */
export default function OtherCamerasScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useAppState();
  const router = useRouter();
  const theme = useTheme();
  const place = s.places.find((p) => p.key === fromRouteId(id) && p.listed) ?? null;
  const [list, setList] = useState<CameraList | null>(null);
  const [failed, setFailed] = useState(false);
  // Cameras whose picture would not load. Windy sometimes lists a daylight
  // image that is not there (404); Snowpace only shows daylight images, so
  // such a camera cannot be shown and is not offered.
  const [broken, setBroken] = useState<number[]>([]);
  const w = strings.webcam;

  useEffect(() => {
    if (!place) return;
    let cancelled = false;
    listWebcams(asWebcamPlace(place))
      .then((l) => { if (!cancelled) setList(l); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
    // The place key identifies the place; the object is rebuilt on every state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.key]);

  if (!place) return null;
  const wp = asWebcamPlace(place);
  const ranked = list ? list.ranked.filter((r) => !broken.includes(r.cam.id)) : [];

  const choose = async (camId: number | null) => {
    if (!list) return;
    await pickWebcam(wp, list, camId);
    router.back();
  };

  return (
    <Screen contentStyle={styles.content}>
      <BackButton label={place.shortName} onPress={() => router.back()} />
      <ScreenTitle>{w.listTitle}</ScreenTitle>
      <AppText size={13.5} lh={1.5}>
        {w.listIntro(place.shortName)}
      </AppText>

      {!list && !failed && (
        <AppText size={12.5} muted>
          {w.loading(place.shortName)}
        </AppText>
      )}
      {failed && (
        <AppText size={12.5} muted>
          {w.failed}
        </AppText>
      )}

      {list && ranked.length === 0 && (
        <AppText size={12.5} muted>
          {w.none(fmtDistance(radiusFor(wp), s.units))}
        </AppText>
      )}

      {list && ranked.length > 0 && (
        <Card style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: list.pick === null }}
            onPress={() => choose(null)}
            style={({ pressed }) => [styles.best, pressed && styles.pressed]}>
            <View style={styles.flex}>
              <AppText size={13.5} weight={700}>
                {w.bestMatch}
              </AppText>
              <AppText size={11.5} muted lh={1.4}>
                {w.bestMatchNote}
              </AppText>
            </View>
            {list.pick === null && <Tick />}
          </Pressable>
          {ranked.map((r) => (
            <CameraRow
              key={r.cam.id} r={r} chosen={list.pick === r.cam.id} onChoose={() => choose(r.cam.id)} dividerColor={theme.divider}
              onBroken={() => setBroken((b) => [...b, r.cam.id])}
            />
          ))}
        </Card>
      )}

      {list && ranked.length > 0 && <WindyCredit />}
    </Screen>
  );
}

function CameraRow({ r, chosen, onChoose, onBroken, dividerColor }: {
  r: Ranked; chosen: boolean; onChoose: () => void; onBroken: () => void; dividerColor: string;
}) {
  const s = useAppState();
  const theme = useTheme();
  const shown = pickImage(r.cam, W.thumb, PixelRatio.get(), W.strictPixels);
  return (
    <View style={[styles.row, { borderTopColor: dividerColor }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={strings.webcam.openLabel(r.cam.title)}
        onPress={() => openWindy(r.cam.detailUrl)}
        style={[styles.thumb, { backgroundColor: theme.track }]}>
        {shown && (
          <Image
            source={{ uri: shown.uri }}
            style={{ width: shown.width, height: shown.height }}
            contentFit="contain"
            cachePolicy="memory"
            onError={onBroken}
            accessibilityIgnoresInvertColors
          />
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: chosen }}
        onPress={onChoose}
        style={({ pressed }) => [styles.pick, pressed && styles.pressed]}>
        <View style={styles.flex}>
          <AppText size={13} weight={700} lh={1.25} numberOfLines={2}>
            {r.cam.title}
          </AppText>
          {r.distanceKm !== null && (
            <AppText size={11.5} muted>
              {strings.webcam.away(fmtDistance(r.distanceKm, s.units))}
            </AppText>
          )}
        </View>
        {chosen && <Tick />}
      </Pressable>
    </View>
  );
}

function Tick() {
  const theme = useTheme();
  return (
    <AppText size={16} weight={800} color={theme.accent} accessibilityLabel={strings.webcam.showing}>
      ✓
    </AppText>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: gutter, gap: 13 },
  card: { gap: 0, paddingVertical: 4 },
  flex: { flex: 1, gap: 2 },
  best: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, paddingVertical: 10 },
  thumb: {
    width: W.thumb.w, height: W.thumb.h, borderRadius: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  pick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54 },
  pressed: { opacity: 0.6 },
});
