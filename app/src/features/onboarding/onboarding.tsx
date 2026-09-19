import { useAthleteActions } from '@/features/athlete/queries';
import { isCoach, useSession } from '@/features/auth/session';

import { GuidedTour, TOUR_STEPS } from './guided-tour';
import { OnboardingFlow } from './onboarding-flow';

/** Identifiant de la visite guidée de l'app, retenu sur le compte. */
export const APP_TOUR = 'app';

/**
 * Premier lancement d'un athlète : l'assistant de mise en route, puis la visite
 * guidée. Les deux états vivent sur le compte, donc ne se rejouent pas d'un
 * appareil à l'autre.
 */
export function Onboarding() {
  const { user, status } = useSession();
  const { markTourSeen } = useAthleteActions();

  // Le coach a son propre espace : ni l'assistant ni la visite ne le concernent.
  if (status !== 'signedIn' || !user || isCoach(user)) return null;

  if (!user.hasCompletedOnboarding) return <OnboardingFlow />;
  if (!user.toursSeen?.includes(APP_TOUR)) return <GuidedTour steps={TOUR_STEPS} onDone={() => markTourSeen(APP_TOUR)} />;
  return null;
}
