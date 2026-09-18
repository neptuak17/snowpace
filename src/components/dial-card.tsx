import { Pressable, StyleSheet } from 'react-native';

import { Card } from './ui/card';
import { MetricGrid } from './ui/metric-grid';
import { ScoreDial } from './ui/score-dial';

import type { Metric } from '@/lib/scoring';

type Props = {
  score: number | null;
  line: string;
  metrics: Metric[];
  onPressDial?: () => void;
};

/** The hero card: 136px dial on the left, four metric boxes on the right. */
export function DialCard({ score, line, metrics, onPressDial }: Props) {
  const dial = <ScoreDial score={score} size={136} line={line} />;
  return (
    <Card style={styles.card}>
      {onPressDial ? (
        <Pressable onPress={onPressDial} accessibilityRole="button" accessibilityLabel="Toggle breakdown">
          {dial}
        </Pressable>
      ) : (
        dial
      )}
      <MetricGrid metrics={metrics} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
  },
});
