import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, BackBar, Button, Card, Chip, Icon, IconButton, Screen, Section, SectionHeader, StateView, Text, type IconName } from '@/components/ui';
import { useAthleteActions, useAthleteProfile, type StravaImportResult } from '@/features/athlete/queries';
import { StravaImportModal } from '@/features/athlete/strava-import-modal';
import { useSession } from '@/features/auth/session';
import { onAppEvent } from '@/lib/app-events';
import { formatDayShort, formatDecimal } from '@/lib/format';
import { AppearanceCard } from '@/features/settings/appearance-card';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signOut } = useSession();
  const { data: profile, loading, error, refetch } = useAthleteProfile();
  const { connectStrava, disconnectStrava } = useAthleteActions();
  const [stravaBusy, setStravaBusy] = useState(false);
  const [stravaImport, setStravaImport] = useState<StravaImportResult | null>(null);

  // Liaison : autorisation Strava dans le navigateur système, puis import de l'historique.
  const linkStrava = async () => {
    setStravaBusy(true);
    try {
      // La fenêtre d'import s'ouvre dès le retour de Strava et suit l'avancement.
      const result = await connectStrava((progress) => setStravaImport(progress));
      if (!result) {
        setStravaImport(null);
        return;
      }
      setStravaImport(result);
      refetch();
    } catch (reason) {
      setStravaImport(null);
      Alert.alert('Strava', reason instanceof Error ? reason.message : 'Connexion impossible.');
    } finally {
      setStravaBusy(false);
    }
  };

  // Délier Strava coupe aussi l'import automatique : on demande confirmation.
  const askDisconnectStrava = () => {
    Alert.alert(
      'Délier Strava',
      'Tes sorties Strava ne seront plus importées automatiquement. Les séances déjà enregistrées sont conservées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Délier',
          style: 'destructive',
          onPress: async () => {
            setStravaBusy(true);
            try {
              await disconnectStrava();
              refetch();
            } catch (reason) {
              Alert.alert('Strava', reason instanceof Error ? reason.message : 'Déconnexion impossible.');
            } finally {
              setStravaBusy(false);
            }
          },
        },
      ],
    );
  };

  useEffect(() => onAppEvent('coach:changed', refetch), [refetch]);

  if (!profile) {
    return (
      <Screen>
        <BackBar title="Profil" />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const facts = [
    { label: 'Niveau', value: profile.level },
    { label: 'Fréquence', value: profile.runsPerWeek ? `${profile.runsPerWeek} séances/sem.` : 'Non définie' },
    { label: 'VMA', value: profile.vma ? `${formatDecimal(profile.vma)} km/h` : 'Non définie' },
    { label: 'FCmax', value: profile.fcMax ? `${profile.fcMax} bpm` : 'Non définie' },
    { label: 'Taille', value: profile.heightCm ? `${profile.heightCm} cm` : 'Non définie' },
    { label: 'Poids', value: profile.weightKg ? `${profile.weightKg} kg` : 'Non défini' },
  ];

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton icon="chevronLeft" size={44} accessibilityLabel="Retour" onPress={() => router.back()} />
        <Text variant="h1" style={styles.flex}>
          Profil
        </Text>
        <IconButton icon="settings" accessibilityLabel="Paramètres" />
      </View>

      <Section style={styles.tight}>
        <Card style={styles.userCard}>
          <Avatar initials={profile.initials} size={56} />
          <View style={styles.flex}>
            <Text variant="h2">{profile.fullName}</Text>
            <Text variant="small" numberOfLines={1}>
              {profile.email}
            </Text>
          </View>
        </Card>
      </Section>

      <Section style={styles.tight}>
        <AppearanceCard />
      </Section>

      <Section style={styles.tight}>
        <Card>
          <SectionHeader title="Profil sportif" actionLabel="Modifier" />
          <View style={styles.facts}>
            {facts.map((fact) => (
              <View key={fact.label} style={styles.fact}>
                <Text variant="caption">{fact.label}</Text>
                <Text variant="h3" tabular>
                  {fact.value}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </Section>

      {profile.competitions.length ? (
        <Section style={styles.tight}>
          <Card>
            <SectionHeader title="Compétitions" actionLabel="Ajouter" />
            {profile.competitions.map((competition, index) => {
              const main = competition.priority === 'A';
              return (
                <View key={competition.id} style={[styles.competition, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={[styles.priority, { backgroundColor: main ? colors.primary : colors.subtle }]}>
                    <Text style={{ fontFamily: fontFamily.bold, fontSize: 14, color: main ? colors.onPrimary : colors.primary }}>{competition.priority}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text variant="h3">{competition.name}</Text>
                    <Text variant="small">
                      {formatDayShort(competition.date)}
                      {competition.goal ? ` · Objectif ${competition.goal}` : ''}
                    </Text>
                  </View>
                  <Chip label={competition.weeksLeftLabel} />
                </View>
              );
            })}
          </Card>
        </Section>
      ) : null}

      <StravaImportModal result={stravaImport} onClose={() => setStravaImport(null)} />

      <Section style={styles.tight}>
        <Card padding={0} style={styles.linksCard}>
          <LinkRow
            icon="activity"
            iconColor={colors.stravaInk}
            iconBackground={colors.stravaSoft}
            title="Strava"
            subtitle={profile.strava.connected ? `Connecté depuis le ${profile.strava.since}` : 'Importer tes sorties automatiquement'}
            trailing={
              profile.strava.connected ? (
                <Button label={stravaBusy ? 'Déliaison…' : 'Délier'} variant="secondary" size="sm" disabled={stravaBusy} onPress={askDisconnectStrava} />
              ) : (
                <Button label={stravaBusy ? 'Import…' : 'Connecter'} size="sm" disabled={stravaBusy} onPress={linkStrava} />
              )
            }
          />
          <LinkRow
            icon="users"
            iconColor={colors.violetInk}
            iconBackground={colors.violetSoft}
            title="Mon coach"
            subtitle={profile.coach ? `${profile.coach.name} · depuis ${profile.coach.since}` : 'Rejoindre un coach avec un code'}
            onPress={() => router.push(profile.coach ? '/coach' : '/rejoindre-coach')}
            divided
          />
        </Card>
      </Section>

      <Section style={styles.tight}>
        <Card padding={0} style={styles.linksCard}>
          <LinkRow icon="info" title="À propos de Trainwise" />
          <LinkRow icon="help" title="Support et questions fréquentes" divided />
          <LinkRow icon="shield" title="Politique de confidentialité" divided />
          <LinkRow icon="mail" title="Nous contacter" divided />
        </Card>
      </Section>

      <Section>
        <Button label="Se déconnecter" variant="danger" icon="logout" fullWidth onPress={signOut} />
      </Section>
    </Screen>
  );
}

type LinkRowProps = {
  icon: IconName;
  title: string;
  subtitle?: string;
  iconColor?: string;
  iconBackground?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  divided?: boolean;
};

function LinkRow({ icon, title, subtitle, iconColor, iconBackground, trailing, onPress, divided }: LinkRowProps) {
  const { colors } = useTheme();
  // Sans action propre, la ligne n'est pas un bouton : elle peut alors en contenir un (« Délier »).
  const Container = onPress ? Pressable : View;
  return (
    <Container
      {...(onPress ? { accessibilityRole: 'button' as const, onPress } : {})}
      style={[styles.linkRow, divided && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      {iconBackground ? (
        <View style={[styles.linkTile, { backgroundColor: iconBackground }]}>
          <Icon name={icon} size={20} color={iconColor} />
        </View>
      ) : (
        <Icon name={icon} size={20} color={colors.text2} />
      )}
      <View style={styles.flex}>
        <Text variant={subtitle ? 'h3' : 'body'}>{title}</Text>
        {subtitle ? <Text variant="small">{subtitle}</Text> : null}
      </View>
      {trailing ?? (onPress ? <Icon name="chevronRight" size={18} color={colors.text3} /> : null)}
    </Container>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 12, gap: 4 },
  tight: { paddingBottom: 12 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 14 },
  fact: { width: '50%', gap: 2 },
  competition: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  priority: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  linksCard: { paddingHorizontal: 16 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  linkTile: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
