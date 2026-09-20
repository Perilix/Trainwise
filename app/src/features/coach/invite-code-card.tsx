import { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';

import { Button, Card, Chip, Icon, Text } from '@/components/ui';
import { useBringIntoView } from '@/components/ui/keyboard-scroll';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import { useCoachActions } from './queries';

type Props = {
  code: string | null;
  onChanged: () => void;
};

type Availability = { code: string; available: boolean; error?: string };

/**
 * Code d'invitation du coach : un athlète le saisit dans son app pour le
 * rejoindre. Il est modifiable sur place — un code choisi (« CAMILLE-2026 »)
 * se transmet de vive voix, pas les 24 caractères tirés au hasard à la
 * création du compte.
 */
export function InviteCodeCard({ code, onChanged }: Props) {
  const { colors } = useTheme();
  const areaRef = useRef<TextInput>(null);
  const bringIntoView = useBringIntoView();
  const { generateInviteCode, checkInviteCode, setInviteCode } = useCoachActions();

  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [checking, setChecking] = useState(false);
  const [state, setState] = useState<Availability | null>(null);

  const current = generated ?? code;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La disponibilité se demande pendant la frappe, mais pas à chaque touche.
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      setGenerated(await generateInviteCode());
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Génération impossible.');
    } finally {
      setBusy(false);
    }
  };

  const share = () => {
    if (!current) return;
    Share.share({ message: `Rejoins-moi sur Trainwise : dans l’app, ouvre « Rejoindre un coach » et saisis le code ${current}.` }).catch(() => undefined);
  };

  const onType = (value: string) => {
    setDraft(value);
    setState(null);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) return;
    setChecking(true);
    timer.current = setTimeout(async () => {
      try {
        setState(await checkInviteCode(value));
      } catch {
        // Un échec de vérification n'empêche pas d'essayer d'enregistrer.
      } finally {
        setChecking(false);
      }
    }, 400);
  };

  const canSave = Boolean(state?.available) && state?.code !== current && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      setGenerated(await setInviteCode(draft));
      setEditing(false);
      setState(null);
      onChanged();
    } catch (reason) {
      // Le code a pu être pris entre la vérification et l'enregistrement.
      setError(reason instanceof Error ? reason.message : 'Enregistrement impossible.');
      setState(null);
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <Card>
        <Text variant="sectionTitle">Modifier le code</Text>
        <Text variant="small" style={styles.hint}>
          Choisissez quelque chose que vos athlètes retiennent.
        </Text>

        <TextInput
          ref={areaRef}
          onFocus={() => bringIntoView(areaRef.current)}
          accessibilityLabel="Code d’invitation"
          value={draft}
          onChangeText={onType}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={16}
          placeholder="CAMILLE-2026"
          placeholderTextColor={colors.text3}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.borderStrong, color: colors.ink }]}
        />

        <View style={styles.statusRow}>
          {state ? (
            state.available ? (
              <Chip label="Disponible" tone="success" />
            ) : (
              <Chip label={state.error ?? 'Indisponible'} tone="warning" />
            )
          ) : checking ? (
            <Chip label="Vérification…" />
          ) : null}
        </View>

        <Text variant="caption" style={styles.hint}>
          4 à 16 caractères · lettres, chiffres et tirets · les majuscules et minuscules se valent.
        </Text>

        <View style={[styles.warn, { backgroundColor: colors.warningSoft }]}>
          <Icon name="warning" size={15} color={colors.warningInk} strokeWidth={2} />
          <Text variant="small" style={{ color: colors.warningInk, flex: 1 }}>
            L’ancien code {current ?? ''} cessera de fonctionner. Les athlètes déjà rattachés ne sont pas concernés.
          </Text>
        </View>

        {error ? (
          <Text variant="small" color="danger" style={styles.hint}>
            {error}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button
            label="Annuler"
            variant="secondary"
            onPress={() => {
              setEditing(false);
              setState(null);
              setError(null);
            }}
            style={styles.flex}
          />
          <Button label={busy ? 'Un instant…' : 'Enregistrer'} icon="check" disabled={!canSave} onPress={save} style={styles.flex} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text variant="sectionTitle">Code d’invitation</Text>
      <Text variant="small" style={styles.hint}>
        Vos athlètes saisissent ce code dans leur app pour vous rejoindre.
      </Text>
      {current ? (
        <View style={[styles.codeBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Text selectable style={[styles.code, { color: colors.ink }]} accessibilityLabel={`Code ${current.split('').join(' ')}`}>
            {current}
          </Text>
        </View>
      ) : null}
      {error ? (
        <Text variant="small" color="danger" style={styles.hint}>
          {error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        {current ? <Button label="Partager" icon="send" onPress={share} style={styles.flex} /> : null}
        <Button
          label="Modifier"
          variant="secondary"
          icon="pen"
          disabled={busy}
          onPress={() => {
            setDraft(current ?? '');
            setState(null);
            setError(null);
            setEditing(true);
          }}
          style={styles.flex}
        />
      </View>
      <Button
        label={busy ? 'Un instant…' : current ? 'Tirer un code au hasard' : 'Générer un code'}
        variant="ghost"
        icon="rotate"
        size="sm"
        disabled={busy}
        onPress={generate}
        style={styles.random}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hint: { marginTop: 4 },
  codeBox: { marginTop: 14, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  code: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 28, letterSpacing: 1 },
  input: { marginTop: 14, height: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, fontFamily: fontFamily.semibold, fontSize: 18, letterSpacing: 1, textAlign: 'center' },
  statusRow: { flexDirection: 'row', marginTop: 10, minHeight: 26 },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, borderRadius: radius.md },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  random: { marginTop: 8 },
});
