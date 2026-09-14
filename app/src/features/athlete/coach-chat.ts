import { useEffect } from 'react';

import { useDirectChat } from '@/features/chat/use-direct-chat';
import { onAppEvent } from '@/lib/app-events';

import { getCoach } from './queries';
import { sampleCoachThread, sampleHome } from './sample-data';

/** Conversation de l'athlète avec son coach. */
export function useCoachChat() {
  const chat = useDirectChat({
    key: 'coach-chat',
    loadPeer: () => getCoach(),
    demo: () => ({
      peer: sampleHome.coach ? { id: 'demo-coach', firstName: 'Camille', name: sampleHome.coach.name, initials: sampleHome.coach.initials, online: sampleHome.coach.online } : null,
      messages: sampleCoachThread,
    }),
  });
  const { refetch } = chat;

  useEffect(() => onAppEvent('coach:changed', refetch), [refetch]);

  return chat;
}
