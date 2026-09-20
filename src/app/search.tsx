import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { SectionLabel } from '@/components/ui/card';
import { HomeTag } from '@/components/ui/place-row';
import { BackButton, Screen, ScreenTitle } from '@/components/ui/screen';
import type { SkiArea } from '@/data/openskidata';
import { activitiesOf } from '@/data/places';
import { searchAreas } from '@/db/inventory';
import { fmtDistance } from '@/lib/format';
import { distanceKm } from '@/lib/geo';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { bodyFont, gutter, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const NEARBY_LIMIT = 30;
const SEARCH_LIMIT = 50;

export default function SearchScreen() {
  const s = useAppState();
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SkiArea[] | null>(null);
  const [searching, setSearching] = useState(false);
  const q = query.trim();

  // Debounced query against SQLite. With no text and a location, show the
  // nearest places; with no text and no location, wait for the user to type.
  useEffect(() => {
    if (!q && !s.location) { setResults(null); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const rows = await searchAreas(q, s.location, q ? SEARCH_LIMIT : NEARBY_LIMIT);
        if (!cancelled) setResults(rows);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, q ? 250 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q, s.location]);

  return (
    <Screen contentStyle={styles.content}>
      <BackButton label={strings.search.backLabel} onPress={() => router.back()} />
      <ScreenTitle size={24}>{strings.search.title}</ScreenTitle>
      <AppText size={11.5} muted style={styles.intro}>
        {strings.search.intro}
      </AppText>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={strings.search.placeholder}
        placeholderTextColor={theme.muted}
        autoCorrect={false}
        autoCapitalize="words"
        clearButtonMode="while-editing"
        returnKeyType="search"
        style={[styles.input, bodyFont(), { color: theme.text, backgroundColor: theme.surface, borderColor: theme.divider }]}
      />

      {results === null && !searching && (
        <AppText size={12.5} muted>
          {strings.search.typeToSearch}
        </AppText>
      )}
      {searching && results === null && (
        <AppText size={12.5} muted>
          {strings.search.searching}
        </AppText>
      )}
      {results !== null && (
        <View style={styles.list}>
          {!q && <SectionLabel>{strings.search.nearby}</SectionLabel>}
          {results.map((a) => {
            const saved = s.savedKeys.has(a.key);
            const isHome = s.home?.key === a.key;
            const mine = activitiesOf(a).filter((k) => s.myActs.includes(k)).length;
            const dist = s.location ? fmtDistance(distanceKm(s.location, a), s.units) : null;
            return (
              <View key={a.key} style={[styles.item, { backgroundColor: theme.surface }, theme.shadowSm]}>
                <View style={styles.itemText}>
                  <View style={styles.nameRow}>
                    <AppText size={13.5} weight={700} style={styles.name}>
                      {a.name}
                    </AppText>
                    {isHome && <HomeTag />}
                  </View>
                  <AppText size={11} muted>
                    {strings.search.meta([a.locality ?? a.regionName, dist], mine)}
                  </AppText>
                </View>
                {!isHome && (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => s.setHome(a.key)}
                      style={({ pressed }) => [styles.pill, styles.homeBtn, pressed && styles.pressed]}>
                      <AppText size={11.5} weight={700} color={theme.accent}>
                        {strings.search.setHome}
                      </AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: saved }}
                      onPress={() => (saved ? s.removeFavourite(a.key) : s.addFavourite(a.key))}
                      style={({ pressed }) => [
                        styles.pill,
                        { backgroundColor: saved ? theme.tagAccent.bg : theme.accent },
                        pressed && styles.pressed,
                      ]}>
                      <AppText size={11.5} weight={700} color={saved ? theme.tagAccent.fg : '#fff'}>
                        {saved ? strings.search.saved : strings.search.add}
                      </AppText>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
          {results.length === 0 && (
            <AppText size={12.5} muted>
              {strings.search.noResults}
            </AppText>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: gutter, gap: 13 },
  intro: { marginTop: -6 },
  input: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 14,
    fontSize: 14,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  list: { gap: 7 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: radius.md,
  },
  itemText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name: { flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  pill: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 17,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeBtn: { paddingHorizontal: 14 },
  pressed: { opacity: 0.7 },
});
