// Forme allégée d'une PlannedRun renvoyée populée dans le champ pendingPlannedMatch
// d'un Run ou d'une StrengthSession (suggestion de mapping après import Strava).
export interface PlannedMatchSummary {
  _id: string;
  date: Date | string;
  activityType?: 'running' | 'strength';
  sessionType?: string;
  targetDistance?: number | null;
  targetDuration?: number | null;
  targetPace?: string | null;
  description?: string;
  generatedBy?: 'ai' | 'manual' | 'coach';
}
