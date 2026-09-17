import { BlurView } from 'expo-blur';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Chip, Icon, Text } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';

import {
  clearPendingReview,
  confirmRunMatch,
  confirmStrengthMatch,
  dismissRunMatch,
  dismissStrengthMatch,
  getPendingMatches,
  linkRunToPlanned,
  runMatchCandidates,
  type MatchCandidate,
  type PendingReviewItem,
} from './planned-match';

/**
 * À l'ouverture de l'app : les sorties importées de Strava qui tombent le jour d'une
 * séance prévue sont proposées au rapprochement, une par une.
 */
export function PlannedMatchPrompt() {
  const { colors, scheme } = useTheme();
  const { status } = useSession();
  const [items, setItems] = useState<PendingReviewItem[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<MatchCandidate[] | null>(null);

  useEffect(() => {
    if (status !== 'signedIn') return;
    let cancelled = false;
    getPendingMatches()
      .then((pending) => {
        if (!cancelled) setItems(pending);
      })
      // L'API peut ne pas répondre : la proposition n'est pas assez importante pour alerter.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [status]);

  const item = items[index];
  if (!item) return null;

  // Chaque activité traitée est marquée relue, pour ne plus revenir à la prochaine ouverture.
  const next = async () => {
    setCandidates(null);
    await clearPendingReview(item.kind === 'run' ? [item.id] : [], item.kind === 'strength' ? [item.id] : []).catch(() => undefined);
    setIndex((value) => value + 1);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
      await next();
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => run(() => (item.kind === 'run' ? confirmRunMatch(item.id) : confirmStrengthMatch(item.id)));
  const dismiss = () => run(() => (item.kind === 'run' ? dismissRunMatch(item.id) : dismissStrengthMatch(item.id)));
  const link = (candidate: MatchCandidate) => run(() => linkRunToPlanned(item.id, candidate.id));

  const openPicker = async () => {
    setBusy(true);
    try {
      setCandidates(await runMatchCandidates(item.id));
    } catch {
      setCandidates([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={next}>
      <View style={styles.backdrop}>
        <BlurView intensity={40} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 25, 35, 0.35)' }]} />

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
            <Icon name="repeat" size={24} color={colors.accentInk} strokeWidth={2.2} />
          </View>

          <Text variant="h2" style={styles.centered}>
            Une séance était prévue
          </Text>
          <Text variant="body2" style={styles.centered}>
            {item.dayLabel} · {item.activityLabel}
          </Text>

          {candidates ? (
            <>
              <Text variant="sectionTitle" style={styles.pickerTitle}>
                Laquelle ?
              </Text>
              <ScrollView style={styles.picker} contentContainerStyle={styles.pickerContent}>
                {candidates.length ? (
                  candidates.map((candidate) => (
                    <Pressable
                      key={candidate.id}
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => link(candidate)}
                      style={({ pressed }) => [styles.candidate, { borderColor: colors.border }, pressed && { backgroundColor: colors.subtle }]}>
                      <View style={styles.flex}>
                        <Text variant="h3" numberOfLines={1}>
                          {candidate.title}
                        </Text>
                        <Text variant="small">{[candidate.dayLabel, candidate.meta].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <Icon name="chevronRight" size={18} color={colors.text3} />
                    </Pressable>
                  ))
                ) : (
                  <Text variant="body2">Aucune autre séance prévue autour de ce jour.</Text>
                )}
              </ScrollView>
              <Button label="Retour" variant="secondary" fullWidth disabled={busy} onPress={() => setCandidates(null)} />
            </>
          ) : (
            <>
              <View style={[styles.planned, { backgroundColor: colors.subtle }]}>
                <Text variant="h3" numberOfLines={2}>
                  {item.planned.title}
                </Text>
                {item.planned.meta ? <Text variant="small">{item.planned.meta}</Text> : null}
                <Chip label={item.planned.dayLabel} />
              </View>

              <Text variant="body2" style={styles.centered}>
                C’est bien cette séance que tu as faite ?
              </Text>

              <Button label={busy ? '…' : 'Oui, c’est celle-ci'} icon="check" fullWidth disabled={busy} onPress={confirm} style={styles.action} />
              {item.kind === 'run' ? <Button label="Une autre séance" variant="secondary" fullWidth disabled={busy} onPress={openPicker} /> : null}
              <Button label="Non, aucune" variant="ghost" fullWidth disabled={busy} onPress={dismiss} />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 28 },
  card: { zIndex: 1, width: '100%', maxWidth: 360, borderRadius: radius.xl, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8 },
  badge: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  centered: { textAlign: 'center' },
  planned: { alignSelf: 'stretch', alignItems: 'center', gap: 4, padding: 14, borderRadius: radius.md, marginVertical: 8 },
  action: { marginTop: 4 },
  pickerTitle: { alignSelf: 'flex-start', marginTop: 8 },
  picker: { alignSelf: 'stretch', maxHeight: 260 },
  pickerContent: { gap: 8, paddingVertical: 8 },
  candidate: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderRadius: radius.md },
});
