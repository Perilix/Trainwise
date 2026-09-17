import { StyleSheet, View } from 'react-native';

import { Text, WorkoutProfile } from '@/components/ui';
import type { RunBlockView } from '@/features/athlete/types';
import { formatDuration, totals, type Segment } from '@/lib/sessions';

import { BlockRow } from './planned-session-body';

type Props = { blocks: RunBlockView[]; segments: Segment[]; width: number; title?: string };

/** Profil d'intensité et déroulé des blocs : séance citée dans le chat, ou sortie réalisée. */
export function SessionPreview({ blocks, segments, width, title = 'Déroulé' }: Props) {
  if (!blocks.length) return null;
  const totalSec = totals(segments).sec;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text variant="overline">{title}</Text>
        {totalSec ? (
          <Text variant="caption" color="text3" tabular>
            ≈ {formatDuration(totalSec)}
          </Text>
        ) : null}
      </View>
      <WorkoutProfile segments={segments} width={width} height={44} />
      {blocks.map((block, index) => (
        <BlockRow key={block.key} block={block} first={index === 0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
