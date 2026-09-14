// Bibliothèque de séances types du coach.
import { SESSION_TYPE_LABELS } from '@/features/athlete/mappers';
import { blocksToSegments, mapPlannedDetail, mapStrengthPlan } from '@/features/athlete/session-detail';
import type { PlannedSessionDetail } from '@/features/athlete/types';
import { useSessionQuery } from '@/features/auth/use-session-query';
import { stepValueLabel, type EditableBlock, type EditableStep } from '@/features/sessions/run-blocks-model';
import { api } from '@/lib/api';
import type {
  ApiPaceConfig,
  ApiPaceSource,
  ApiPlanExercise,
  ApiRunBlock,
  ApiRunBlockStep,
  ApiSessionTemplate,
  ApiTemplateRunBlock,
  ApiTemplateRunBlockStep,
} from '@/lib/api-types';
import { formatDecimal, formatHoursMinutes } from '@/lib/format';
import { PACE_ZONES } from '@/lib/pace-zones';
import { totals, type Segment } from '@/lib/sessions';

import { sampleTemplates } from './sample-data';

export type TemplateRow = {
  id: string;
  name: string;
  sport: 'running' | 'strength';
  meta: string;
  segments: Segment[];
};

export type TemplateGroup = { label: string; templates: TemplateRow[] };

/** Corps de création / modification d'une séance type. */
export type TemplatePayload = Pick<ApiSessionTemplate, 'name' | 'description' | 'sport' | 'sessionType' | 'targetDistance' | 'targetDuration' | 'runBlocks' | 'strengthPlan'>;

// Ordre d'affichage des familles de séances de course ; la muscu vient en dernier.
const RUNNING_ORDER = ['fractionne', 'tempo', 'sortie_longue', 'endurance', 'cotes', 'fartlek', 'recuperation'];

function pacePercent(pace?: ApiPaceConfig) {
  if (!pace) return undefined;
  if (pace.mode === 'vmaPercent' && pace.vmaPercent) return pace.vmaPercent;
  if (pace.mode === 'zone' && pace.zone) return pace.vmaPercent ?? PACE_ZONES[pace.zone]?.percent;
  return undefined;
}

function toPaceSource(pace?: ApiPaceConfig): ApiPaceSource | null {
  const percent = pacePercent(pace);
  return percent ? { mode: 'zone', zone: pace?.zone ?? null, vmaPercent: percent } : null;
}

// Une séance type exprime l'allure en zone ou % VMA : on la ramène au format des séances planifiées.
function toPlannedStep(step: ApiTemplateRunBlockStep): ApiRunBlockStep {
  return {
    ...step,
    pace: step.pace?.mode === 'absolute' ? (step.pace.absolute ?? null) : null,
    recoveryPace: step.recoveryPace?.mode === 'absolute' ? (step.recoveryPace.absolute ?? null) : null,
    paceSource: toPaceSource(step.pace),
    recoveryPaceSource: toPaceSource(step.recoveryPace),
  };
}

export const templateRunBlocks = (blocks: ApiSessionTemplate['runBlocks']): ApiRunBlock[] =>
  blocks.map((block) => ({ ...toPlannedStep(block), children: block.children?.map(toPlannedStep) }));

// Éditeur → séance type : on stocke la zone ou le %, jamais une allure calculée.
function toPaceConfig(pace: string | null | undefined, source: ApiPaceSource | null | undefined): NonNullable<ApiPaceConfig> {
  if (source?.mode === 'zone' || source?.mode === 'vmaPercent') return { mode: 'zone', zone: source.zone ?? null, vmaPercent: source.vmaPercent ?? null, absolute: null };
  return { mode: 'absolute', zone: null, vmaPercent: null, absolute: pace || null };
}

function toTemplateStep(step: EditableStep, order: number): ApiTemplateRunBlockStep {
  return {
    role: step.role,
    mode: step.mode,
    distance: step.distance ?? null,
    duration: step.duration ?? null,
    pace: toPaceConfig(step.pace, step.paceSource),
    repetitions: Math.max(1, step.repetitions ?? 1),
    description: step.description || '',
    recoveryMode: step.recoveryMode ?? null,
    recoveryDistance: step.recoveryDistance ?? null,
    recoveryDuration: step.recoveryDuration ?? null,
    recoveryPace: step.recoveryMode ? toPaceConfig(step.recoveryPace, step.recoveryPaceSource) : null,
    recoveryDescription: step.recoveryDescription || '',
    order,
  };
}

export const toTemplateBlocks = (blocks: EditableBlock[]): ApiTemplateRunBlock[] =>
  blocks.map((block, order) => ({ ...toTemplateStep(block, order), children: block.children?.length ? block.children.map(toTemplateStep) : undefined }));

/** Étape principale de référence (première en zone VMA), pour les allures individualisées. */
export function mainPercent(template: ApiSessionTemplate): { percent: number; label: string } | undefined {
  for (const block of template.runBlocks ?? []) {
    if (block.role !== 'main') continue;
    for (const step of block.children?.length ? block.children : [block]) {
      const percent = pacePercent(step.pace);
      if (percent) return { percent, label: `${stepValueLabel(toPlannedStep(step))} à ${percent} % VMA` };
    }
  }
  return undefined;
}

export function templateToDetail(template: ApiSessionTemplate): PlannedSessionDetail {
  return mapPlannedDetail({
    _id: template._id,
    date: new Date().toISOString(),
    activityType: template.sport,
    sessionType: template.sessionType,
    title: template.name,
    description: template.description,
    targetDistance: template.targetDistance,
    targetDuration: template.targetDuration,
    targetPace: null,
    status: 'planned',
    feeling: null,
    generatedBy: 'coach',
    createdBy: null,
    runBlocks: templateRunBlocks(template.runBlocks ?? []),
    strengthPlan: template.strengthPlan ?? undefined,
  });
}

// Les exercices peuplés reviennent en objets : l'API attend leurs identifiants.
const withExerciseId = (item?: ApiPlanExercise): ApiPlanExercise | undefined =>
  item?.exercise ? { ...item, exercise: typeof item.exercise === 'string' ? item.exercise : item.exercise._id } : undefined;

/** Copie d'une séance type, prête à être recréée. */
export function templateCopyPayload(template: ApiSessionTemplate): TemplatePayload {
  const plan = template.strengthPlan;
  return {
    name: `${template.name} (copie)`,
    description: template.description,
    sport: template.sport,
    sessionType: template.sessionType,
    targetDistance: template.targetDistance,
    targetDuration: template.targetDuration,
    runBlocks: template.runBlocks ?? [],
    strengthPlan: plan
      ? {
          ...plan,
          exercises: plan.exercises?.map(withExerciseId).filter((item): item is ApiPlanExercise => Boolean(item)),
          circuit: plan.circuit ? { ...plan.circuit, exercises: plan.circuit.exercises?.map(withExerciseId).filter((item): item is ApiPlanExercise => Boolean(item)) } : undefined,
          superset: plan.superset ? { ...plan.superset, pairs: plan.superset.pairs?.map((pair) => ({ a: withExerciseId(pair.a), b: withExerciseId(pair.b) })) } : undefined,
        }
      : null,
  };
}

function mapTemplateRow(template: ApiSessionTemplate): TemplateRow {
  const running = template.sport === 'running';
  const segments = running ? blocksToSegments(templateRunBlocks(template.runBlocks ?? [])) : [];
  const total = totals(segments);
  const plan = running ? undefined : mapStrengthPlan(template.strengthPlan ?? undefined);
  const exercises = plan
    ? plan.exercises.length + (plan.circuit?.exercises.length ?? 0) + (plan.superset?.pairs.reduce((count, pair) => count + (pair.a ? 1 : 0) + (pair.b ? 1 : 0), 0) ?? 0)
    : 0;
  const km = template.targetDistance ?? (total.dist ? total.dist / 1000 : undefined);
  const minutes = template.targetDuration ?? (total.sec ? total.sec / 60 : plan?.estimatedDuration);

  const parts = running
    ? [km ? `≈ ${formatDecimal(km)} km` : null, minutes ? `≈ ${formatHoursMinutes(minutes * 60)}` : null]
    : [exercises ? `${exercises} exercice${exercises > 1 ? 's' : ''}` : null, minutes ? `≈ ${formatHoursMinutes(minutes * 60)}` : null];
  if (template.usageCount) parts.push(`${template.usageCount}× utilisée`);

  return { id: template._id, name: template.name, sport: template.sport, meta: parts.filter(Boolean).join(' · '), segments };
}

export function groupTemplates(templates: ApiSessionTemplate[]): TemplateGroup[] {
  const rank = (template: ApiSessionTemplate) => (template.sport === 'strength' ? RUNNING_ORDER.length : Math.max(0, RUNNING_ORDER.indexOf(template.sessionType)));
  const groups = new Map<string, TemplateRow[]>();
  [...templates]
    .sort((a, b) => rank(a) - rank(b))
    .forEach((template) => {
      const label = template.sport === 'strength' ? 'Muscu' : (SESSION_TYPE_LABELS[template.sessionType] ?? 'Course');
      groups.set(label, [...(groups.get(label) ?? []), mapTemplateRow(template)]);
    });
  return [...groups].map(([label, rows]) => ({ label, templates: rows }));
}

export function useTemplates() {
  return useSessionQuery(
    'coach:templates',
    async () => groupTemplates(await api<ApiSessionTemplate[]>('/api/coach/session-templates')),
    () => groupTemplates(sampleTemplates),
  );
}

/** Séance type complète (exercices peuplés) ; null quand on en crée une nouvelle. */
export function useTemplate(id?: string) {
  return useSessionQuery<ApiSessionTemplate | null>(
    `coach:template:${id ?? 'nouvelle'}`,
    async () => (id ? api<ApiSessionTemplate>(`/api/coach/session-templates/${encodeURIComponent(id)}`) : null),
    () => (id ? (sampleTemplates.find((template) => template._id === id) ?? sampleTemplates[0]) : null),
  );
}
