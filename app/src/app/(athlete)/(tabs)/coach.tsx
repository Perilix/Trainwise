import { useFocusEffect, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, Icon, IconButton, StateView, Text } from '@/components/ui';
import { useCoachChat } from '@/features/athlete/coach-chat';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function CoachChatScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const chat = useCoachChat();
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendFailure, setSendFailure] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(chat.markRead);

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

  const coach = chat.coach;

  if (!coach) {
    return (
      <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
        {chat.loading || chat.error ? (
          <StateView loading={chat.loading} error={chat.error} onRetry={chat.refetch} />
        ) : (
          <View style={[styles.flex, styles.empty]}>
            <Icon name="users" size={28} color={colors.text3} />
            <Text variant="h2">Pas encore de coach</Text>
            <Text variant="body2" style={styles.centered}>
              Rejoins un coach avec son code d’invitation pour échanger avec lui ici.
            </Text>
            <Button label="Rejoindre un coach" icon="users" onPress={() => router.push('/rejoindre-coach')} style={styles.joinButton} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  const errorText = sendFailure ?? chat.sendError;
  const canSend = draft.trim().length > 0 && !submitting;

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Avatar initials={coach.initials} size={38} tone="violet" />
        <View style={styles.flex}>
          <Text variant="h3">{coach.name}</Text>
          <View style={styles.presence}>
            {chat.typing ? null : <View style={[styles.presenceDot, { backgroundColor: coach.online ? colors.success : colors.text3 }]} />}
            <Text variant="caption" color={chat.typing ? 'accentInk' : 'text2'}>
              {chat.typing ? 'écrit…' : coach.online ? 'En ligne' : 'Ton coach'}
            </Text>
          </View>
        </View>
        <IconButton icon="calendar" accessibilityLabel="Ouvrir le planning" onPress={() => router.push('/planning')} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.thread} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {chat.messages.length === 0 ? (
            <Text variant="body2" style={[styles.centered, styles.firstMessage]}>
              Écris ton premier message à {coach.firstName}.
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
                {message.sending || message.timeLabel ? (
                  <Text variant="caption" color="text3" style={styles.time}>
                    {message.sending ? 'Envoi…' : message.timeLabel}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
          {chat.typing ? (
            <View accessibilityLabel={`${coach.firstName} écrit`} style={[styles.bubble, styles.theirs, styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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

        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
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
            style={[styles.send, { backgroundColor: colors.primary, opacity: canSend ? 1 : 0.4 }]}>
            <Icon name="send" size={18} color={colors.onPrimary} strokeWidth={2} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 32 },
  centered: { textAlign: 'center' },
  joinButton: { marginTop: 14 },
  header: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
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
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fontFamily.regular, fontSize: 14 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
