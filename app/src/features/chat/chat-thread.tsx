import { useRef, useState, type ComponentType, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, IconButton, TAB_BAR_HEIGHT, TAB_BAR_MARGIN, Text } from '@/components/ui';
import type { CitedSession } from '@/features/athlete/types';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import type { DirectChat } from './use-direct-chat';

type Props = {
  chat: DirectChat;
  /** Texte de présence quand l'interlocuteur n'est pas en ligne. */
  offlineLabel: string;
  headerRight?: ReactNode;
  /** Écran empilé (bouton retour, marge basse) plutôt qu'onglet. */
  onBack?: () => void;
  /** Ouvre la séance citée dans un message (sans ce prop, la carte n'est pas cliquable). */
  onOpenSession?: (session: CitedSession) => void;
  /** Bouton « + » du champ de saisie : citer une séance dans la conversation. */
  onCite?: () => void;
  /** Déroulé affiché sous la carte d'une séance citée (le composant va chercher la séance). */
  CitedSessionBody?: ComponentType<{ session: CitedSession }>;
};

export function ChatThread({ chat, offlineLabel, headerRight, onBack, onOpenSession, onCite, CitedSessionBody }: Props) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendFailure, setSendFailure] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const peer = chat.peer;

  if (!peer) return null;

  const submit = async () => {
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    setSendFailure(null);
    try {
      if (await chat.send(draft)) setDraft('');
    } catch (reason) {
      setSendFailure(reason instanceof Error ? reason.message : 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeDraft = (value: string) => {
    setDraft(value);
    if (value) chat.notifyTyping();
  };

  // Sans bouton retour, le fil vit dans un onglet : on dégage la hauteur de la barre flottante.
  const tabSpace = onBack ? 0 : TAB_BAR_HEIGHT + TAB_BAR_MARGIN * 2;
  const errorText = sendFailure ?? chat.sendError;
  const canSend = draft.trim().length > 0 && !submitting;

  return (
    <SafeAreaView edges={onBack ? ['top', 'bottom'] : ['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, onBack && styles.headerWithBack, { borderBottomColor: colors.border }]}>
        {onBack ? <IconButton icon="chevronLeft" size={44} glass accessibilityLabel="Retour" onPress={onBack} /> : null}
        <Avatar initials={peer.initials} size={38} tone={onBack ? 'accent' : 'violet'} />
        <View style={styles.flex}>
          <Text variant="h2" numberOfLines={1}>
            {peer.name}
          </Text>
          <View style={styles.presence}>
            {chat.typing ? null : <View style={[styles.presenceDot, { backgroundColor: peer.online ? colors.success : colors.text3 }]} />}
            <Text variant="caption" color={chat.typing ? 'accentInk' : 'text2'}>
              {chat.typing ? 'écrit…' : peer.online ? 'En ligne' : offlineLabel}
            </Text>
          </View>
        </View>
        {headerRight}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {chat.messages.length === 0 ? (
            <Text variant="body2" style={[styles.centered, styles.firstMessage]}>
              Écris ton premier message à {peer.firstName}.
            </Text>
          ) : null}
          {chat.messages.map((message) => (
            <View key={message.id} style={styles.messageBlock}>
              {message.dayLabel ? (
                <View style={[styles.dayPill, { backgroundColor: colors.subtle }]}>
                  <Text variant="caption">{message.dayLabel}</Text>
                </View>
              ) : null}
              <View style={[styles.bubbleWrap, message.fromMe ? styles.mine : styles.theirs, message.sending && styles.sending]}>
                <View
                  style={[
                    styles.bubble,
                    message.fromMe
                      ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
                      : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 6 },
                  ]}>
                  <Text style={{ color: message.fromMe ? colors.onPrimary : colors.ink }}>{message.text}</Text>
                </View>
                {message.session ? (
                  <SessionCard session={message.session} onPress={onOpenSession ? () => onOpenSession(message.session!) : undefined}>
                    {CitedSessionBody && message.session.kind === 'planned' ? <CitedSessionBody session={message.session} /> : null}
                  </SessionCard>
                ) : null}
                {message.sending || message.timeLabel ? (
                  <Text variant="caption" color="text3" style={styles.time}>
                    {message.sending ? 'Envoi…' : message.timeLabel}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {chat.typing ? (
            <View accessibilityLabel={`${peer.firstName} écrit`} style={[styles.bubble, styles.theirs, styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text variant="small" color="text3">
                •••
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {errorText ? (
          <View accessibilityRole="alert" style={[styles.error, { backgroundColor: colors.dangerSoft }]}>
            <Icon name="warning" size={16} color={colors.danger} />
            <Text variant="small" color="danger" style={styles.flex}>
              {errorText}
            </Text>
          </View>
        ) : null}

        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border, marginBottom: tabSpace }]}>
          {onCite ? <IconButton icon="plus" size={40} bordered accessibilityLabel="Citer une séance" onPress={onCite} /> : null}
          <TextInput
            accessibilityLabel="Message"
            placeholder="Écrire un message…"
            placeholderTextColor={colors.text3}
            value={draft}
            onChangeText={changeDraft}
            multiline
            style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={submit}
            style={[styles.send, { backgroundColor: canSend ? colors.accent : colors.subtle, opacity: canSend ? 1 : 0.7 }]}>
            <Icon name="send" size={18} color={canSend ? colors.ctaInk : colors.text3} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SessionCard({ session, onPress, children }: { session: CitedSession; onPress?: () => void; children?: ReactNode }) {
  const { colors } = useTheme();
  const running = session.sport !== 'strength';
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Ouvrir la séance ${session.title}` : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.sessionCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && { backgroundColor: colors.subtle }]}>
      <View style={styles.sessionHeader}>
        <View style={[styles.sessionTile, { backgroundColor: running ? colors.accentSoft : colors.subtle }]}>
          <Icon name={running ? 'route' : 'dumbbell'} size={18} color={running ? colors.accentInk : colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text variant="h3" numberOfLines={2}>
            {session.title}
          </Text>
          {session.meta ? (
            <Text variant="small" tabular numberOfLines={1}>
              {session.meta}
            </Text>
          ) : null}
        </View>
        {onPress ? <Icon name="chevronRight" size={18} color={colors.text3} /> : null}
      </View>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sessionCard: { gap: 10, padding: 10, borderWidth: 1, borderRadius: radius.md },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionTile: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  centered: { textAlign: 'center' },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  headerWithBack: { paddingLeft: 6, gap: 6 },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  presenceDot: { width: 7, height: 7, borderRadius: 4 },
  thread: { padding: 16, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
  firstMessage: { marginBottom: 12 },
  messageBlock: { gap: 10 },
  dayPill: { alignSelf: 'center', height: 24, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: 'center' },
  bubbleWrap: { maxWidth: '80%', gap: 4 },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  sending: { opacity: 0.6 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  typingBubble: { borderWidth: 1, borderBottomLeftRadius: 6, paddingVertical: 6 },
  time: { paddingHorizontal: 4 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fontFamily.regular, fontSize: 14 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
