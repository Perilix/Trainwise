import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import { useCoachActions } from './queries';

type Props = {
  code: string | null;
  onChanged: () => void;
};

// Code d'invitation du coach : un athlète le saisit dans son app pour le rejoindre.
export function InviteCodeCard({ code, onChanged }: Props) {
  const { colors } = useTheme();
  const { generateInviteCode } = useCoachActions();
  const [generated, setGenerated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = generated ?? code;

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

  return (
    <Card>
      <Text variant="h2">Code d’invitation</Text>
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
        <Button label={busy ? 'Un instant…' : current ? 'Changer' : 'Générer un code'} variant={current ? 'secondary' : 'primary'} icon="rotate" disabled={busy} onPress={generate} style={styles.flex} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hint: { marginTop: 4 },
  codeBox: { marginTop: 14, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  code: { fontFamily: fontFamily.semibold, fontSize: 20, lineHeight: 28, letterSpacing: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
});
