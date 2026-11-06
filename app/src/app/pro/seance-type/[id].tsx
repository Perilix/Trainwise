import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, avatarToneFor, BackBar, Button, Card, Chip, FormError, Screen, Section, StateView, Text } from '@/components/ui';
import { SESSION_TYPE_LABELS } from '@/features/athlete/mappers';
import { useCoachActions, useCoachAthleteList } from '@/features/coach/queries';
import { mainPercent, templateCopyPayload, templateToDetail, useTemplate } from '@/features/coach/templates';
import { POOL_LABELS, formatMeters, formatSwimPace, relativeIntensity, resolvedTarget, targetLabel } from '@/features/athlete/sport-blocks';
import { PlannedSessionBody } from '@/features/sessions/planned-session-body';
import type { ApiSessionTemplate, ApiSportStep } from '@/lib/api-types';
import { formatDuration } from '@/lib/sessions';
import { paceFromPercent } from '@/features/sessions/run-blocks-model';
import { emitAppEvent, onAppEvent } from '@/lib/app-events';
import { formatDayShort, formatDecimal, toIsoDay } from '@/lib/format';
import { useTheme } from '@/theme/theme-provider';
import { layout } from '@/theme/tokens';

export default function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { data: template, loading, error, refetch } = useTemplate(id);
  const { data: athletes } = useCoachAthleteList();
  const { createTemplate, deleteTemplate } = useCoachActions();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => onAppEvent('templates:changed', refetch), [refetch]);

  if (!template) {
    return (
      <Screen>
        <BackBar />
        <StateView loading={loading} error={error ?? (loading ? null : 'Séance introuvable.')} onRetry={refetch} />
      </Screen>
    );
  }

  const running = template.sport === 'running';
  const main = running ? mainPercent(template) : undefined;
  const endurance = template.sport === 'bike' || template.sport === 'swim' ? template.sport : null;
  const enduranceMain = endurance ? hardestStep(template) : null;
  // Aperçu chiffré avec la FTP / CSS du premier athlète qui l'a renseignée.
  const reference = { ftp: athletes?.find((athlete) => athlete.ftp)?.ftp ?? null, css: athletes?.find((athlete) => athlete.css)?.css ?? null };
  const sportChip = SPORT_CHIPS[template.sport];
  const lastUsed = template.lastUsedAt ? formatDayShort(toIsoDay(new Date(template.lastUsedAt))).split(' ').slice(1).join(' ') : null;
  const usage = template.usageCount ? `Utilisée ${template.usageCount} fois${lastUsed ? ` · dernière le ${lastUsed}` : ''}` : 'Pas encore planifiée';

  const duplicate = async () => {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      await createTemplate(templateCopyPayload(template));
      emitAppEvent('templates:changed');
      setNotice('Copie ajoutée à la bibliothèque.');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Duplication impossible.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await deleteTemplate(template._id);
      emitAppEvent('templates:changed');
      router.back();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Suppression impossible.');
      setBusy(false);
    }
  };

  const footer = confirmDelete ? (
    <View style={styles.footer}>
      <Text variant="body2">Supprimer « {template.name} » de la bibliothèque ? Les séances déjà planifiées restent dans le planning des athlètes.</Text>
      <FormError message={actionError} />
      <View style={styles.actions}>
        <Button label="Annuler" variant="secondary" disabled={busy} onPress={() => setConfirmDelete(false)} style={styles.flex} />
        <Button label={busy ? 'Suppression…' : 'Supprimer'} icon="x" disabled={busy} onPress={remove} style={styles.flex} />
      </View>
    </View>
  ) : (
    <View style={styles.footer}>
      {notice ? (
        <Text variant="small" color="successInk" accessibilityRole="alert">
          {notice}
        </Text>
      ) : null}
      <FormError message={actionError} />
      <Button label="Planifier pour des athlètes" icon="users" fullWidth onPress={() => router.push({ pathname: '/pro/seance-type/assigner', params: { id: template._id } })} />
      <View style={styles.actions}>
        <Button label="Modifier" variant="secondary" size="sm" icon="pen" onPress={() => router.push({ pathname: '/pro/seance-type/editeur', params: { id: template._id } })} style={styles.flex} />
        <Button label="Dupliquer" variant="secondary" size="sm" icon="copy" disabled={busy} onPress={duplicate} style={styles.flex} />
      </View>
      <Button label="Supprimer de la bibliothèque" variant="danger" size="sm" icon="x" fullWidth onPress={() => setConfirmDelete(true)} />
    </View>
  );

  return (
    <Screen footer={footer}>
      <BackBar />

      <PlannedSessionBody
        session={templateToDetail(template, endurance ? reference : null)}
        plannedByLabel=""
        hideHeader
        hero={{
          title: template.name,
          overline: usage,
          chips: (
            <>
              <Chip label={sportChip.label} tone={template.sport === 'strength' ? 'neutral' : 'accent'} icon={sportChip.icon} />
              {endurance === 'swim' && template.pool ? <Chip label={`Bassin ${POOL_LABELS[template.pool]}`} /> : null}
              {endurance ? null : <Chip label={SESSION_TYPE_LABELS[template.sessionType] ?? template.sessionType} />}
            </>
          ),
        }}
      />

      {endurance && enduranceMain && athletes?.length ? (
        <Section>
          <Card>
            <Text variant="sectionTitle">{endurance === 'bike' ? 'Puissances individualisées' : 'Allures individualisées'}</Text>
            <Text variant="small" style={styles.hint}>
              {[endurance === 'bike' ? (enduranceMain.duration ? formatDuration(enduranceMain.duration) : null) : enduranceMain.distance ? formatMeters(enduranceMain.distance) : null, targetLabel(enduranceMain)]
                .filter(Boolean)
                .join(' à ')}
              , selon la {endurance === 'bike' ? 'FTP' : 'CSS'} de chaque athlète.
            </Text>
            {athletes.map((athlete, index) => {
              const known = endurance === 'bike' ? athlete.ftp : athlete.css;
              const value = known ? resolvedTarget(enduranceMain, endurance === 'bike' ? { ftp: known } : { css: known }) : null;
              return (
                <View key={athlete.id} style={[styles.athlete, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Avatar initials={athlete.initials} size={32} tone={avatarToneFor(athlete.id)} />
                  <View style={styles.flex}>
                    <Text variant="h3">{athlete.name}</Text>
                    <Text variant="caption" color={known ? 'text2' : 'warningInk'}>
                      {known ? (endurance === 'bike' ? `FTP ${known} W` : `CSS ${formatSwimPace(known)} /100 m`) : endurance === 'bike' ? 'FTP manquante' : 'CSS manquante'}
                    </Text>
                  </View>
                  {value ? (
                    <Text variant="h3" tabular>
                      {value}
                    </Text>
                  ) : (
                    <Chip label="À saisir" tone="warning" icon="warning" />
                  )}
                </View>
              );
            })}
          </Card>
        </Section>
      ) : null}

      {main && athletes?.length ? (
        <Section>
          <Card>
            <Text variant="sectionTitle">Allures individualisées</Text>
            <Text variant="small" style={styles.hint}>
              {main.label}, selon la VMA de chaque athlète.
            </Text>
            {athletes.map((athlete, index) => {
              const pace = paceFromPercent(athlete.vma, main.percent);
              return (
                <View key={athlete.id} style={[styles.athlete, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Avatar initials={athlete.initials} size={32} tone={avatarToneFor(athlete.id)} />
                  <View style={styles.flex}>
                    <Text variant="h3">{athlete.name}</Text>
                    <Text variant="caption" color={athlete.vma ? 'text2' : 'warningInk'}>
                      {athlete.vma ? `VMA ${formatDecimal(athlete.vma)} km/h` : 'VMA manquante'}
                    </Text>
                  </View>
                  {pace ? (
                    <Text variant="h3" tabular>
                      {pace} /km
                    </Text>
                  ) : (
                    <Chip label="À saisir" tone="warning" icon="warning" />
                  )}
                </View>
              );
            })}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

const SPORT_CHIPS = {
  running: { label: 'Course', icon: 'route' },
  strength: { label: 'Muscu', icon: 'dumbbell' },
  bike: { label: 'Vélo', icon: 'bike' },
  swim: { label: 'Natation', icon: 'swim' },
} as const;

/** Étape la plus intense du corps de séance : celle qu'on chiffre pour chaque athlète. */
function hardestStep(template: ApiSessionTemplate): ApiSportStep | null {
  const sport = template.sport === 'bike' ? 'bike' : 'swim';
  let best: ApiSportStep | null = null;
  let bestValue = -1;
  for (const block of template.sportBlocks ?? []) {
    if (block.role !== 'main') continue;
    for (const step of block.children?.length ? block.children : [block]) {
      const value = relativeIntensity(step, sport) ?? 0;
      if (value > bestValue) {
        best = step;
        bestValue = value;
      }
    }
  }
  return best;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hint: { marginTop: 2, marginBottom: 6 },
  athlete: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  footer: { gap: 10, paddingHorizontal: layout.gutter, paddingTop: 12, paddingBottom: 8 },
  actions: { flexDirection: 'row', gap: 8 },
});
