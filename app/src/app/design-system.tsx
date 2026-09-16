import { useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppBar, Avatar, Button, Card, Chip, Divider, FeelingSlider, Field, Icon, ICON_NAMES, IconButton, Screen, SectionHeader, Segmented, Stat, Text, WorkoutProfile, GlassSurface, liquidGlass } from '@/components/ui';
import { expand, formatDuration, formatKm, INTENSITY_LEVELS, SAMPLE_STRUCTURES, totals } from '@/lib/sessions';
import { AppThemeProvider, useTheme, type ThemePreference } from '@/theme/theme-provider';
import type { Palette } from '@/theme/tokens';
import { layout, radius } from '@/theme/tokens';
import type { TextVariant } from '@/theme/typography';

// Écran de contrôle du système : /design-system (?scheme=dark pour forcer le thème sombre).
export default function DesignSystemScreen() {
  const { scheme } = useLocalSearchParams<{ scheme?: string }>();
  const forced = scheme === 'dark' || scheme === 'light' ? scheme : undefined;
  return (
    <AppThemeProvider forcedScheme={forced}>
      <Gallery />
    </AppThemeProvider>
  );
}

const SWATCHES: { token: keyof Palette; label: string }[] = [
  { token: 'primary', label: 'Action' },
  { token: 'brand', label: 'Marque' },
  { token: 'accent', label: 'Bleu' },
  { token: 'accentInk', label: 'Lien' },
  { token: 'bg', label: 'Fond' },
  { token: 'surface', label: 'Surface' },
  { token: 'subtle', label: 'Discret' },
  { token: 'border', label: 'Bordure' },
  { token: 'ink', label: 'Encre' },
  { token: 'text2', label: 'Texte 2' },
  { token: 'success', label: 'Succès' },
  { token: 'warning', label: 'Vigilance' },
  { token: 'danger', label: 'Danger' },
  { token: 'violet', label: 'Coach' },
  { token: 'strava', label: 'Strava' },
  { token: 'text3', label: 'Texte 3' },
];

const TYPE_SAMPLES: { variant: TextVariant; sample: string; spec: string }[] = [
  { variant: 'display', sample: 'Bonjour, Thomas !', spec: 'Gulfs · 23/30' },
  { variant: 'h1', sample: 'Fractionné 10 × 400 m', spec: 'Gulfs · 22/29' },
  { variant: 'h2', sample: 'Camille Roux', spec: 'Gulfs · 17/24' },
  { variant: 'sectionTitle', sample: 'Prochains entraînements', spec: 'Poppins · 13/16' },
  { variant: 'h3', sample: 'Footing récupération', spec: 'Ligne · 15/20' },
  { variant: 'body', sample: 'Endurance fondamentale en aisance respiratoire.', spec: 'Texte · 14/21' },
  { variant: 'small', sample: 'Mer. 9 sept. · 11,2 km · 4:39 /km', spec: 'Secondaire · 13/18' },
  { variant: 'caption', sample: 'Séances sautées · 4 sem.', spec: 'Légende · 12/16' },
  { variant: 'overline', sample: 'Course à pied', spec: 'Surtitre · 11/14' },
  { variant: 'stat', sample: '1:52:40', spec: 'Gulfs · 18/24' },
];

function Gallery() {
  const { colors, scheme, preference, setPreference, ramp } = useTheme();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [feeling, setFeeling] = useState(7);
  const [email, setEmail] = useState('');

  const contentWidth = Math.min(width, 480) - layout.gutter * 2;
  const segments = expand(SAMPLE_STRUCTURES.vma12x400, 17);
  const sessionTotals = totals(segments);

  return (
    <Screen>
      <AppBar initials="TD" unreadNotifications />
      <Section>
        <Text variant="h1">Système Trainwise</Text>
        <Text variant="body2">Jetons, typographie et composants de l’app mobile · thème {scheme === 'dark' ? 'sombre' : 'clair'}.</Text>
      </Section>

      <Section title="Apparence">
        <Segmented<ThemePreference>
          options={[
            { value: 'light', label: 'Clair' },
            { value: 'dark', label: 'Sombre' },
            { value: 'system', label: 'Auto' },
          ]}
          value={preference}
          onChange={setPreference}
        />
      </Section>

      <Section title="Couleurs">
        <View style={styles.swatches}>
          {SWATCHES.map((swatch) => (
            <View key={swatch.token} style={styles.swatch}>
              <View style={[styles.swatchColor, { backgroundColor: colors[swatch.token], borderColor: colors.border }]} />
              <Text variant="caption" numberOfLines={1}>
                {swatch.label}
              </Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Typographie">
        <Card padding={0}>
          {TYPE_SAMPLES.map((item, index) => (
            <View key={item.variant} style={[styles.typeRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <Text variant={item.variant} tabular={item.variant === 'stat'}>
                {item.sample}
              </Text>
              <Text variant="caption" color="text3">
                {item.spec}
              </Text>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Verre liquide">
        <Text variant="small" style={styles.glassNote}>
          {liquidGlass ? 'Verre natif iOS 26 actif.' : 'Verre natif indisponible ici : repli sur une surface pleine.'}
        </Text>
        <View style={styles.glassRow}>
          <GlassSurface intensity="strong" radius={radius.pill} style={styles.glassButton}>
            <Text variant="h3">JD</Text>
          </GlassSurface>
          <GlassSurface intensity="strong" radius={radius.pill} style={styles.glassButton}>
            <Icon name="bell" size={22} color={colors.ink} strokeWidth={1.9} />
          </GlassSurface>
          <GlassSurface radius={radius.lg} style={styles.glassPill}>
            <Icon name="flame" size={20} color={colors.warning} fill={colors.warning} strokeWidth={1.25} />
            <Text variant="stat">6</Text>
          </GlassSurface>
        </View>
      </Section>

      <Section title="Boutons">
        <View style={styles.stack}>
          <Button label="Enregistrer la séance" fullWidth />
          <View style={styles.row}>
            <Button label="Voir la séance" variant="accent" shape="pill" icon="arrowRight" iconPosition="trailing" style={styles.flex} />
            <Button label="Passer" variant="secondary" style={styles.flex} />
            <Button label="Détailler" style={styles.flex} />
          </View>
          <View style={styles.wrap}>
            <Button label="Importer" variant="tonal" icon="rotate" size="sm" />
            <Button label="Ajouter" variant="ghost" icon="plus" size="sm" />
            <Button label="Supprimer" variant="danger" size="sm" />
            <Button label="Désactivé" size="sm" disabled />
          </View>
        </View>
      </Section>

      <Section title="Puces, avatars, actions">
        <View style={styles.stack}>
          <View style={styles.wrap}>
            <Chip label="Effectuée" tone="success" icon="check" />
            <Chip label="Planifiée par Camille" tone="violet" icon="user" />
            <Chip label="À faire" icon="clock" />
            <Chip label="Vigilance" tone="warning" icon="warning" />
            <Chip label="Strava" tone="strava" />
            <Chip label="Negative split" tone="accent" icon="trendUp" />
            <Chip label="Recommandé" tone="primary" />
          </View>
          <View style={styles.row}>
            <Avatar initials="TD" />
            <Avatar initials="CR" tone="violet" />
            <Avatar initials="LM" tone="accent" />
            <Avatar initials="CR" tone="highlight" />
            <View style={styles.flex} />
            <IconButton icon="message" accessibilityLabel="Message" bordered />
            <IconButton icon="bell" accessibilityLabel="Notifications" badge />
          </View>
        </View>
      </Section>

      <Section title="Champs et sélecteurs">
        <Card>
          <View style={styles.stack}>
            <Field label="Email" icon="mail" placeholder="ton@email.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
            <Segmented
              options={[
                { value: 'week', label: 'Semaine' },
                { value: 'month', label: 'Mois' },
                { value: 'year', label: 'Année' },
              ]}
              value={period}
              onChange={setPeriod}
            />
            <View style={styles.row}>
              <Text variant="h2" style={styles.flex}>
                Ressenti
              </Text>
              <Text variant="stat" tabular>
                {feeling}
              </Text>
              <Text variant="small">/10</Text>
            </View>
            <FeelingSlider value={feeling} onChange={setFeeling} />
          </View>
        </Card>
      </Section>

      <Section title="Chiffres">
        <Card>
          <View style={styles.row}>
            <Stat label="Distance" value="21,1" unit="km" style={styles.flex} />
            <Stat label="Durée" value="1:52:40" style={styles.flex} />
            <Stat label="Allure" value="5:20" unit="/km" style={styles.flex} />
          </View>
        </Card>
      </Section>

      <Section title="Profil de séance">
        <Card>
          <SectionHeader title="Fractionné 12 × 400 m" />
          <Text variant="small">
            ≈ {formatKm(sessionTotals.dist)} · ≈ {formatDuration(sessionTotals.sec)} · VMA 17
          </Text>
          <View style={[styles.profileBox, { backgroundColor: colors.bg }]}>
            <WorkoutProfile segments={segments} width={contentWidth - 32 - 24} height={56} />
          </View>
          <Divider style={styles.divider} />
          <View style={styles.wrap}>
            {INTENSITY_LEVELS.map((level, index) => (
              <View key={level} style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: ramp[index] }]} />
                <Text variant="caption">{level}</Text>
              </View>
            ))}
          </View>
        </Card>
      </Section>

      <Section title="Icônes">
        <View style={styles.icons}>
          {ICON_NAMES.map((name) => (
            <View key={name} style={[styles.iconCell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name={name} size={22} />
            </View>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text variant="overline">{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: layout.gutter, paddingBottom: 24, gap: 10, width: '100%', maxWidth: 480, alignSelf: 'center' },
  stack: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  flex: { flex: 1 },
  glassRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  glassButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  glassPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8 },
  glassNote: { marginTop: 4 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  swatch: { width: '25%', alignItems: 'center', gap: 6 },
  swatchColor: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1 },
  typeRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  profileBox: { marginTop: 12, padding: 12, borderRadius: radius.md },
  divider: { marginVertical: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconCell: { width: 48, height: 48, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
