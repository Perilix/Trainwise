import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, BackBar, Button, Card, Chip, Icon, IconButton, Screen, Section, SectionHeader, Text, type IconName } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { InviteCodeCard } from '@/features/coach/invite-code-card';
import { DIPLOMA_OPTIONS, DISCIPLINE_OPTIONS, optionLabel } from '@/features/coach/profile-options';
import { PlanCard } from '@/features/coach/plan-card';
import { useInviteOverview } from '@/features/coach/queries';
import { AppearanceCard } from '@/features/settings/appearance-card';
import { openLink, SITE_LINKS } from '@/lib/site';
import { initialsOf } from '@/features/athlete/mappers';
import { useTheme } from '@/theme/theme-provider';

export default function CoachProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, signOut } = useSession();
  const { data: invite, refetch } = useInviteOverview();

  if (!user) return null;

  const disciplines = user.disciplines ?? [];
  const diplomas = user.diplomas ?? [];

  return (
    <Screen>
      <BackBar
        title="Profil"
        right={<IconButton icon="settings" size={44} glass accessibilityLabel="Mon compte" onPress={() => router.push('/pro/compte')} />}
      />

      <Section style={styles.tight}>
        <Card style={styles.userCard}>
          <Avatar initials={initialsOf(user.firstName, user.lastName)} size={56} />
          <View style={styles.flex}>
            <Text variant="h2">{`${user.firstName} ${user.lastName}`.trim()}</Text>
            <Text variant="small" numberOfLines={1}>
              {user.email}
            </Text>
          </View>
          <Chip label="Coach" tone="violet" />
        </Card>
      </Section>

      <Section style={styles.tight}>
        <InviteCodeCard code={invite?.code ?? null} onChanged={refetch} />
      </Section>

      <Section style={styles.tight}>
        <Card>
          <SectionHeader title="Profil coach" actionLabel="Modifier" onAction={() => router.push('/pro/profil-edition')} />
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Text variant="caption">Expérience</Text>
              <Text variant="h3">{user.experience ? `${user.experience} an${user.experience > 1 ? 's' : ''}` : 'Non renseignée'}</Text>
            </View>
            <View style={styles.fact}>
              <Text variant="caption">Disciplines</Text>
              {disciplines.length ? (
                <View style={styles.chips}>
                  {disciplines.map((value) => (
                    <Chip key={value} label={optionLabel(DISCIPLINE_OPTIONS, value)} />
                  ))}
                </View>
              ) : (
                <Text variant="body2">Aucune</Text>
              )}
            </View>
            <View style={styles.fact}>
              <Text variant="caption">Diplômes</Text>
              {diplomas.length ? (
                <View style={styles.chips}>
                  {diplomas.map((value) => (
                    <Chip key={value} label={optionLabel(DIPLOMA_OPTIONS, value)} tone="accent" />
                  ))}
                </View>
              ) : (
                <Text variant="body2">Aucun</Text>
              )}
            </View>
            <View style={styles.fact}>
              <Text variant="caption">Présentation</Text>
              <Text variant="body2">{user.bio?.trim() || 'Présentez votre approche : elle est visible par les athlètes qui vous découvrent.'}</Text>
            </View>
          </View>
        </Card>
      </Section>

      <Section style={styles.tight}>
        <PlanCard />
      </Section>

      <Section style={styles.tight}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/pro/alertes')}>
          <Card style={styles.link}>
            <Icon name="bell" size={20} color={colors.text2} />
            <View style={styles.flex}>
              <Text variant="sectionTitle">Alertes</Text>
              <Text variant="small">Quand considérez-vous qu’un athlète décroche ?</Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.text3} />
          </Card>
        </Pressable>
      </Section>

      <Section style={styles.tight}>
        <AppearanceCard />
      </Section>

      <Section style={styles.tight}>
        <Card padding={0} style={styles.links}>
          <SiteLinkRow icon="info" title="À propos de Trainwise" onPress={() => openLink(SITE_LINKS.about)} />
          <SiteLinkRow icon="help" title="Support et questions fréquentes" divided onPress={() => openLink(SITE_LINKS.support)} />
          <SiteLinkRow icon="shield" title="Politique de confidentialité" divided onPress={() => openLink(SITE_LINKS.privacy)} />
          <SiteLinkRow icon="mail" title="Nous contacter" divided onPress={() => openLink(SITE_LINKS.contact)} />
        </Card>
      </Section>

      <Section>
        <Button label="Se déconnecter" variant="danger" icon="logout" fullWidth onPress={signOut} />
      </Section>
    </Screen>
  );
}

/** Une ligne qui mène hors de l'app : site public ou messagerie. */
function SiteLinkRow({ icon, title, divided, onPress }: { icon: IconName; title: string; divided?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.siteRow, divided ? { borderTopWidth: 1, borderTopColor: colors.border } : null]}>
      <Icon name={icon} size={20} color={colors.text2} />
      <Text variant="body" style={styles.flex}>
        {title}
      </Text>
      <Icon name="chevronRight" size={18} color={colors.text3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tight: { paddingBottom: 12 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  links: { overflow: 'hidden' },
  siteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  facts: { gap: 14, marginTop: 14 },
  fact: { gap: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
});
