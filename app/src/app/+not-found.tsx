import { Redirect } from 'expo-router';

import { isCoach, useSession } from '@/features/auth/session';

// Lien inconnu : on retombe sur l'accueil de l'espace ouvert plutôt que sur l'écran « Unmatched Route ».
export default function NotFound() {
  const { status, user } = useSession();
  const signedIn = status === 'signedIn' || status === 'demo';
  return <Redirect href={!signedIn ? '/login' : isCoach(user) ? '/pro' : '/'} />;
}
