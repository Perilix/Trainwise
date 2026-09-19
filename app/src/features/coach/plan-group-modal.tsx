import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Field, FormError, Icon, Screen, Section, SectionHeader, Text } from '@/components/ui';
import { useCoachActions } from '@/features/coach/queries';
import { useTemplates } from '@/features/coach/templates';
import type { CoachGroup } from '@/features/coach/types';
import { emitAppEvent } from '@/lib/app-events';
import { toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';

type Props = {
  group: CoachGroup | null;
  onClose: () => void;
};

/**
 * Planifier une séance pour tout un groupe.
 *
 * La même séance type pour chacun, le même jour : le serveur résout l'allure
 * de chaque athlète depuis sa VMA. Seules les séances de course sont
 * proposées — une séance de muscu n'a pas d'allure à adapter.
 */
export function PlanGroupModal({ group, onClose }: Props) {
  const { colors } = useTheme();
  const { data: groups } = useTemplates();
  const { assignTemplateToAthletes } = useCoachActions();

  const [date, setDate] = useState(() => toIsoDay(new Date()));
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const templates = (groups ?? []).flatMap((entry) => entry.templates).filter((row) => row.sport === 'running');

  const assign = async () => {
    if (!group || !picked) return;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await assignTemplateToAthletes(
        picked,
        group.athletes.map((athlete) => athlete.id),
        date,
      );
      emitAppEvent('athletes:changed');
      setDone(`Séance planifiée pour ${group.athletes.length} athlète${group.athletes.length > 1 ? 's' : ''}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Planification impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={group !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Screen
        footer={
          <View style={styles.footer}>
            <FormError message={error} />
            {done ? (
              <Text variant="small" color="successInk">
                {done}
              </Text>
            ) : null}
            <View style={styles.footerRow}>
              <Button label="Fermer" variant="secondary" onPress={onClose} style={styles.flex} />
              <Button label={busy ? 'Planification…' : 'Planifier'} icon="check" disabled={!picked || busy} onPress={assign} style={styles.flex} />
            </View>
          </View>
        }>
        <Section style={styles.heading}>
          <Text variant="h1">Planifier</Text>
          <Text variant="body2">
            La même séance pour les {group?.athletes.length ?? 0} athlètes de {group?.name ?? 'ce groupe'}. Chacun la reçoit à son allure, calculée depuis sa
            VMA.
          </Text>
        </Section>

        <Section style={styles.tight}>
          <Card>
            <Field label="Date" placeholder="2026-09-22" value={date} onChangeText={setDate} autoCapitalize="none" />
          </Card>
        </Section>

        <Section>
          <SectionHeader title="Séance de la bibliothèque" />
          {templates.length ? (
            <Card padding={0} style={styles.list}>
              {templates.map((row, index) => {
                const on = picked === row.id;
                return (
                  <Pressable
                    key={row.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    onPress={() => setPicked(row.id)}
                    style={[styles.row, index > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null, on ? { backgroundColor: colors.subtle } : null]}>
                    <View style={[styles.radio, { borderColor: on ? colors.brand : colors.borderStrong, backgroundColor: on ? colors.brand : 'transparent' }]}>
                      {on ? <Icon name="check" size={12} color="#fff" strokeWidth={3} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Text variant="h3" numberOfLines={1}>
                        {row.name}
                      </Text>
                      <Text variant="small" numberOfLines={1}>
                        {row.meta}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          ) : (
            <Card>
              <Text variant="body2">Aucune séance type de course. Créez-en une depuis la bibliothèque.</Text>
            </Card>
          )}
        </Section>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  heading: { gap: 2, paddingTop: 16, paddingBottom: 14 },
  tight: { paddingBottom: 12 },
  list: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: 8, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  footerRow: { flexDirection: 'row', gap: 8 },
});
