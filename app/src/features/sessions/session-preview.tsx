import { StyleSheet, View } from 'react-native';

import { Text, WorkoutProfile } from '@/components/ui';
import type { PlannedSessionDetail } from '@/features/athlete/types';
import { formatDuration, totals } from '@/lib/sessions';

import { BlockRow } from './planned-session-body';

/** Aperçu d'une séance citée dans le chat : profil d'intensité et déroulé des blocs. */
export function SessionPreview({ session, width }: { session: PlannedSessionDetail; width: number }) {
  if (!session.blocks.length) return null;
  const totalSec = totals(session.segments).sec;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text variant="overline">Déroulé</Text>
        {totalSec ? (
          <Text variant="caption" color="text3" tabular>
            ≈ {formatDuration(totalSec)}
          </Text>
        ) : null}
      </View>
      <WorkoutProfile segments={session.segments} width={width} height={44} />
      {session.blocks.map((block, index) => (
        <BlockRow key={block.key} block={block} first={index === 0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
