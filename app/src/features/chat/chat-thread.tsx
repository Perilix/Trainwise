import { useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, avatarToneFor, Icon, IconButton, TAB_BAR_HEIGHT, TAB_BAR_MARGIN, Text } from '@/components/ui';
import type { ChatMessage, CitedSession } from '@/features/athlete/types';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

import type { DirectChat } from './use-direct-chat';

type Props = {
  chat: DirectChat;
  /** Texte de présence quand l'interlocuteur n'est pas en ligne. */
  offlineLabel: string;
  headerRight?: ReactNode;
  /** Bouton retour dans l'en-tête ; sans lui, le fil vit sous la barre d'onglets. */
  onBack?: () => void;
  /** Qui est en face : un coach porte le violet, un athlète sa couleur propre. */
  peerRole?: 'coach' | 'athlete';
  /** Ouvre la séance citée dans un message (sans ce prop, la carte n'est pas cliquable). */
  onOpenSession?: (session: CitedSession) => void;
  /** Bouton « + » du champ de saisie : citer une séance dans la conversation. */
  onCite?: () => void;
  /** Déroulé affiché sous la carte d'une séance citée (le composant va chercher la séance). */
  CitedSessionBody?: ComponentType<{ session: CitedSession }>;
  /** Bandeau glissé entre l'en-tête et le fil — les discussions de groupe, côté athlète. */
  above?: ReactNode;
  /** Discussion à plusieurs : chaque bulle porte le nom de qui l'a écrite. */
  showSenders?: boolean;
  /** Toucher le titre ouvre les détails — les membres d'un groupe. */
  onOpenDetails?: () => void;
};

export function ChatThread({ chat, offlineLabel, headerRight, onBack, peerRole = 'athlete', onOpenSession, onCite, CitedSessionBody, above, showSenders, onOpenDetails }: Props) {
  // Qui a écrit : seulement dans un groupe, et seulement pour les autres.
  const speaking = (message: ChatMessage) => Boolean(showSenders) && !message.fromMe;
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendFailure, setSendFailure] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  // Clavier ouvert : la barre de saisie colle au clavier, sans la marge de la barre d'accueil.
  const [keyboardUp, setKeyboardUp] = useState(false);
  const peer = chat.peer;
  const fromCoach = peerRole === 'coach';

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => {
      setKeyboardUp(true);
      // Le fil rétrécit : sans ça, les derniers messages passent sous le clavier.
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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

  // Dans un onglet qui garde sa barre flottante, on lui dégage sa hauteur.
  const tabSpace = onBack ? 0 : TAB_BAR_HEIGHT + TAB_BAR_MARGIN * 2;
  const errorText = sendFailure ?? chat.sendError;
  const canSend = draft.trim().length > 0 && !submitting;

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, onBack && styles.headerWithBack, { borderBottomColor: colors.border }]}>
        {onBack ? <IconButton icon="chevronLeft" size={44} glass accessibilityLabel="Retour" onPress={onBack} /> : null}
        <Avatar initials={peer.initials} size={38} tone={fromCoach ? 'violet' : avatarToneFor(peer.id)} />
        <Pressable
          accessibilityRole={onOpenDetails ? 'button' : undefined}
          accessibilityLabel={onOpenDetails ? `Détails de ${peer.name}` : undefined}
          disabled={!onOpenDetails}
          onPress={onOpenDetails}
          style={styles.flex}>
          <View style={styles.titleRow}>
            <Text variant="h2" numberOfLines={1} style={styles.shrinkTitle}>
              {peer.name}
            </Text>
            {onOpenDetails ? <Icon name="chevronRight" size={16} color={colors.text3} /> : null}
          </View>
          <View style={styles.presence}>
            {chat.typing ? null : <View style={[styles.presenceDot, { backgroundColor: peer.online ? colors.success : colors.text3 }]} />}
            <Text variant="caption" color={chat.typing ? 'accentInk' : 'text2'}>
              {chat.typing ? 'écrit…' : peer.online ? 'En ligne' : offlineLabel}
            </Text>
          </View>
        </Pressable>
        {headerRight}
      </View>

      {above}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.thread}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
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
              {message.system ? (
                <Text variant="caption" style={styles.system}>
                  {message.text}
                </Text>
              ) : (
              <View style={[styles.bubbleWrap, message.fromMe ? styles.mine : styles.theirs, message.sending && styles.sending]}>
                {speaking(message) && message.senderName ? (
                  <Text variant="caption" color="accentInk" style={styles.sender}>
                    {message.senderName}
                  </Text>
                ) : null}
                <View style={styles.bubbleRow}>
                  {speaking(message) ? (
                    <Avatar initials={message.senderInitials ?? ''} size={38} tone={avatarToneFor(message.senderName ?? message.id)} />
                  ) : null}
                  <View
                    style={[
                      styles.bubble,
                      styles.shrink,
                      message.fromMe
                        ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
                        : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 6 },
                    ]}>
                    <Text style={{ color: message.fromMe ? colors.onPrimary : colors.ink }}>{message.text}</Text>
                  </View>
                </View>
                {message.session ? (
                  <SessionCard session={message.session} onPress={onOpenSession ? () => onOpenSession(message.session!) : undefined}>
                    {CitedSessionBody && message.session.kind === 'planned' ? <CitedSessionBody session={message.session} /> : null}
                  </SessionCard>
                ) : null}
                {message.sending || message.timeLabel ? (
                  <Text variant="caption" color="text3" style={[styles.time, speaking(message) && styles.indented]}>
                    {message.sending ? 'Envoi…' : message.timeLabel}
                  </Text>
                ) : null}
              </View>
              )}
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

        <View
          style={[
            styles.composer,
            // La barre de saisie couvre elle-même la zone de la barre d'accueil : pas de bande vide sous elle.
            { backgroundColor: colors.surface, borderTopColor: colors.border, marginBottom: tabSpace, paddingBottom: keyboardUp || tabSpace ? 10 : insets.bottom + 10 },
          ]}>
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
  /** La ligne d'un message : la pastille de l'auteur à gauche, la bulle à droite. */
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  shrinkTitle: { flexShrink: 1 },
  bubbleWrap: { maxWidth: '85%', gap: 4 },
  /** La pastille de l'auteur accompagne la bulle, alignée sur son bas. */
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  shrink: { flexShrink: 1 },
  /** Nom et heure se calent sur la bulle, pas sur la pastille. */
  indented: { paddingLeft: 46 },
  sender: { paddingLeft: 46 },
  /** Une arrivée, un départ : la conversation le dit, personne ne l'a écrit. */
  system: { alignSelf: 'center', textAlign: 'center', paddingVertical: 2 },
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
