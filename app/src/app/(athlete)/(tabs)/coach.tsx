import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, IconButton, Text } from '@/components/ui';
import { useAthleteHome, useCoachThread } from '@/features/athlete/queries';
import type { ChatMessage } from '@/features/athlete/types';
import { useTheme } from '@/theme/theme-provider';
import { radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

export default function CoachChatScreen() {
  const { colors } = useTheme();
  const { data: home } = useAthleteHome();
  const { data: thread } = useCoachThread();
  const [messages, setMessages] = useState<ChatMessage[]>(thread ?? []);
  const [draft, setDraft] = useState('');
  const coach = home?.coach;

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((current) => [...current, { id: `local-${current.length}`, fromMe: true, text }]);
    setDraft('');
  };

  if (!coach) {
    return (
      <SafeAreaView edges={['top']} style={[styles.flex, styles.empty, { backgroundColor: colors.bg }]}>
        <Text variant="h2">Pas encore de coach</Text>
        <Text variant="body2">Rejoins un coach avec son code d’invitation depuis ton profil.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Avatar initials={coach.initials} size={38} tone="violet" />
        <View style={styles.flex}>
          <Text variant="h3">{coach.name}</Text>
          <View style={styles.presence}>
            <View style={[styles.presenceDot, { backgroundColor: coach.online ? colors.success : colors.text3 }]} />
            <Text variant="caption">{coach.online ? 'En ligne' : 'Hors ligne'}</Text>
          </View>
        </View>
        <IconButton icon="calendar" accessibilityLabel="Planning" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.thread}>
          {messages.map((message) => (
            <View key={message.id} style={styles.messageBlock}>
              {message.dayLabel ? (
                <View style={[styles.dayPill, { backgroundColor: colors.subtle }]}>
                  <Text variant="caption">{message.dayLabel}</Text>
                </View>
              ) : null}
              <View style={[styles.bubbleWrap, message.fromMe ? styles.mine : styles.theirs]}>
                <View
                  style={[
                    styles.bubble,
                    message.fromMe
                      ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
                      : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 6 },
                  ]}>
                  <Text style={{ color: message.fromMe ? colors.onPrimary : colors.ink }}>{message.text}</Text>
                </View>
                {message.timeLabel ? (
                  <Text variant="caption" color="text3" style={styles.time}>
                    {message.timeLabel}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            accessibilityLabel="Message"
            placeholder="Écrire un message…"
            placeholderTextColor={colors.text3}
            value={draft}
            onChangeText={setDraft}
            multiline
            style={[styles.input, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.ink }]}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Envoyer" onPress={send} style={[styles.send, { backgroundColor: colors.primary }]}>
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
  header: { height: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderBottomWidth: 1 },
  presence: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  presenceDot: { width: 7, height: 7, borderRadius: 4 },
  thread: { padding: 16, gap: 10, flexGrow: 1, justifyContent: 'flex-end' },
  messageBlock: { gap: 10 },
  dayPill: { alignSelf: 'center', height: 24, paddingHorizontal: 10, borderRadius: radius.pill, justifyContent: 'center' },
  bubbleWrap: { maxWidth: '80%', gap: 4 },
  mine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  theirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  time: { paddingHorizontal: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, fontFamily: fontFamily.regular, fontSize: 14 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
