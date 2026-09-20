import { useLocalSearchParams } from 'expo-router';

import { GroupDetails } from '@/features/chat/group-details';

export default function CoachGroupDetailsScreen() {
  const { conversation, nom } = useLocalSearchParams<{ conversation: string; nom?: string }>();
  return <GroupDetails conversationId={conversation} name={nom ?? 'Groupe'} />;
}
