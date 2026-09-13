import { Redirect } from 'expo-router';

// Point d'entrée provisoire : l'écran système, en attendant les parcours athlète et coach.
export default function Index() {
  return <Redirect href="/design-system" />;
}
