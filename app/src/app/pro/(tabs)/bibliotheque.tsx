import { useFocusEffect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, Card, Field, Screen, Section, Segmented, StateView, Text } from '@/components/ui';
import type { Sport } from '@/features/athlete/types';
import { TemplateItem } from '@/features/coach/template-item';
import { useTemplates } from '@/features/coach/templates';
import { MainAppBar } from '@/features/shell/main-app-bar';
import { layout } from '@/theme/tokens';

type SportFilter = 'all' | Sport;

export default function LibraryScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data, loading, error, refetch } = useTemplates();
  const [sport, setSport] = useState<SportFilter>('all');
  const [search, setSearch] = useState('');

  // Les séances types peuvent être modifiées depuis le web entre deux visites.
  useFocusEffect(refetch);

  const needle = search.trim().toLowerCase();
  const filtering = needle.length > 0 || sport !== 'all';
  const groups = (data ?? [])
    .map((group) => ({ ...group, templates: group.templates.filter((row) => (sport === 'all' || row.sport === sport) && (!needle || row.name.toLowerCase().includes(needle))) }))
    .filter((group) => group.templates.length > 0);
  const profileWidth = width - layout.gutter * 2 - 32 - 48;

  return (
    <Screen>
      <MainAppBar />
      <Section style={styles.heading}>
        <View style={styles.titleRow}>
          <Text variant="h1">Bibliothèque</Text>
          <Button label="Nouvelle" icon="plus" size="sm" onPress={() => router.push('/pro/seance-type/editeur')} />
        </View>
        <Text variant="body2">Vos séances types, prêtes à planifier.</Text>
      </Section>

      <Section style={styles.filters}>
        <Segmented<SportFilter>
          options={[
            { value: 'all', label: 'Toutes' },
            { value: 'running', label: 'Course' },
            { value: 'strength', label: 'Muscu' },
          ]}
          value={sport}
          onChange={setSport}
        />
        <Field icon="search" placeholder="Rechercher une séance" accessibilityLabel="Rechercher une séance" value={search} onChangeText={setSearch} />
      </Section>

      {data ? (
        groups.length ? (
          groups.map((group) => (
            <Section key={group.label} style={styles.group}>
              <Text variant="overline" style={styles.groupLabel}>
                {group.label}
              </Text>
              <Card padding={0} style={styles.list}>
                {group.templates.map((row, index) => (
                  <TemplateItem
                    key={row.id}
                    row={row}
                    divided={index > 0}
                    profileWidth={profileWidth}
                    onPress={() => router.push({ pathname: '/pro/seance-type/[id]', params: { id: row.id } })}
                  />
                ))}
              </Card>
            </Section>
          ))
        ) : (
          <Section>
            <Card>
              <Text variant="body2">
                {filtering ? 'Aucune séance ne correspond à ces filtres.' : 'Aucune séance type pour l’instant. Créez votre première séance avec « Nouvelle ».'}
              </Text>
            </Card>
          </Section>
        )
      ) : (
        <StateView loading={loading} error={error} onRetry={refetch} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 2, paddingTop: 4, paddingBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  filters: { gap: 10, paddingBottom: 18 },
  group: { paddingBottom: 16 },
  groupLabel: { marginBottom: 8 },
  list: { paddingHorizontal: 16 },
});
