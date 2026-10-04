import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlaceToday } from '@/components/place-today';
import { AppText } from '@/components/ui/app-text';
import { BackButton, Screen } from '@/components/ui/screen';
import { placeFromArea, type Place } from '@/data/places';
import { getArea } from '@/db/inventory';
import { fromRouteId } from '@/lib/geo';
import { placeMetaAway } from '@/lib/place-text';
import { useAppState } from '@/state/app-state';
import { gutter } from '@/theme/tokens';
import { strings } from '@/strings';

export default function PlaceDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const s = useAppState();
  const key = fromRouteId(id);
  // Usually one of the user's places; fall back to the inventory for anything else.
  const saved = s.places.find((p) => p.key === key && p.listed) ?? null;
  const [loaded, setLoaded] = useState<Place | null>(null);
  useEffect(() => {
    if (saved) return;
    let cancelled = false;
    getArea(key).then((a) => { if (a && !cancelled) setLoaded(placeFromArea(a, s.location, [])); }).catch(() => {});
    return () => { cancelled = true; };
  }, [key, saved, s.location]);
  const l = saved ?? loaded;
  if (!l) return null;
  return <PlaceDetail l={l} from={from} />;
}

/** Any place, laid out as Today is for the home hill, under its own header. */
function PlaceDetail({ l, from }: { l: Place; from?: string }) {
  const s = useAppState();
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.gutter}>
        <BackButton label={from || strings.common.back} onPress={() => router.back()} />
      </View>
      <View style={[styles.gutter, styles.title]}>
        <AppText heading size={26} lh={1.15}>
          {l.name}
        </AppText>
        <AppText size={11.5} muted>
          {placeMetaAway(l, s.units)}
        </AppText>
      </View>

      <PlaceToday place={l} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: gutter },
  title: { gap: 2 },
});
