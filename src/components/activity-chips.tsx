import { StyleSheet, View } from 'react-native';

import { Chip } from './ui/chip';

import { ACTS, type ActivityKey } from '@/data/places';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';

type Props = {
  /** Only these activities; defaults to everything the user has enabled. */
  only?: ActivityKey[];
  /** Append a score to each label, e.g. "Classic 74". */
  scores?: (k: ActivityKey) => number | null;
  small?: boolean;
};

/** The row of activity chips; tapping one switches the app's activity. */
export function ActivityChips({ only, scores, small = true }: Props) {
  const { activity, myActs, setActivity } = useAppState();
  const acts = ACTS.filter((a) => myActs.includes(a.key) && (!only || only.includes(a.key)));
  return (
    <View style={[styles.row, { gap: small ? 6 : 7 }]}>
      {acts.map((a) => {
        const s = scores ? scores(a.key) : undefined;
        const label = scores ? strings.common.chipWithScore(a.label, s === null ? strings.common.dash : String(s)) : a.short;
        return <Chip key={a.key} label={label} small={small} active={a.key === activity} onPress={() => setActivity(a.key)} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
