import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { HomeTag } from '@/components/ui/place-row';
import { BackButton, Screen, ScreenTitle } from '@/components/ui/screen';
import { SectionLabel } from '@/components/ui/card';
import { REGIONS } from '@/data/places';
import { fmtDrive } from '@/lib/format';
import { useAppState } from '@/state/app-state';
import { bodyFont, gutter, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function SearchScreen() {
  const s = useAppState();
  const theme = useTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const regions = REGIONS.map((g) => ({
    name: g.name,
    items: g.items.filter((i) => !q || (i.name + ' ' + i.area).toLowerCase().includes(q)),
  })).filter((g) => g.items.length);

  return (
    <Screen contentStyle={styles.content}>
      <BackButton label="My places" onPress={() => router.back()} />
      <ScreenTitle size={24}>Add a place</ScreenTitle>
      <AppText size={11.5} muted style={styles.intro}>
        Add the places you visit, and pick which one is your home hill — that is the one Today opens on.
      </AppText>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search centres and resorts"
        placeholderTextColor={theme.muted}
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={[styles.input, bodyFont(), { color: theme.text, backgroundColor: theme.surface, borderColor: theme.divider }]}
      />

      {regions.map((g) => (
        <View key={g.name} style={styles.region}>
          <SectionLabel>{g.name}</SectionLabel>
          {g.items.map((i) => {
            const on = s.saved.includes(i.id);
            const isHome = i.id === s.home;
            const mine = i.acts.filter((k) => s.myActs.includes(k)).length;
            return (
              <View key={i.id} style={[styles.item, { backgroundColor: theme.surface }, theme.shadowSm]}>
                <View style={styles.itemText}>
                  <View style={styles.nameRow}>
                    <AppText size={13.5} weight={700}>
                      {i.shortName}
                    </AppText>
                    {isHome && <HomeTag />}
                  </View>
                  <AppText size={11} muted>
                    {i.area + ' · ' + fmtDrive(i.drive) + ' · ' + mine + ' of your activities'}
                  </AppText>
                </View>
                {!isHome && (
                  <View style={styles.actions}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => s.setHome(i.id)}
                      style={({ pressed }) => [styles.pill, styles.homeBtn, pressed && styles.pressed]}>
                      <AppText size={11.5} weight={700} color={theme.accent}>
                        Set home
                      </AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      onPress={() => s.togglePin(i.id)}
                      style={({ pressed }) => [
                        styles.pill,
                        { backgroundColor: on ? theme.tagAccent.bg : theme.accent },
                        pressed && styles.pressed,
                      ]}>
                      <AppText size={11.5} weight={700} color={on ? theme.tagAccent.fg : '#fff'}>
                        {on ? 'Saved' : 'Add'}
                      </AppText>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
      {regions.length === 0 && (
        <AppText size={12.5} muted>
          Nothing by that name yet — try "nordic", "Whistler" or "Big".
        </AppText>
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
  region: { gap: 7 },
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
