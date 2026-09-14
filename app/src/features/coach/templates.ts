// Bibliothèque de séances types du coach.
import { SESSION_TYPE_LABELS } from '@/features/athlete/mappers';
import { blocksToSegments, mapStrengthPlan } from '@/features/athlete/session-detail';
import { useSessionQuery } from '@/features/auth/use-session-query';
import { api } from '@/lib/api';
import type { ApiPaceConfig, ApiRunBlock, ApiRunBlockStep, ApiSessionTemplate, ApiTemplateRunBlockStep } from '@/lib/api-types';
import { formatDecimal, formatHoursMinutes } from '@/lib/format';
import { totals, type Segment } from '@/lib/sessions';

import { PACE_ZONES } from './pace-zones';
import { sampleTemplates } from './sample-data';

export type TemplateRow = {
  id: string;
  name: string;
  sport: 'running' | 'strength';
  meta: string;
  segments: Segment[];
};

export type TemplateGroup = { label: string; templates: TemplateRow[] };

// Ordre d'affichage des familles de séances de course ; la muscu vient en dernier.
const RUNNING_ORDER = ['fractionne', 'tempo', 'sortie_longue', 'endurance', 'cotes', 'fartlek', 'recuperation'];

function pacePercent(pace?: ApiPaceConfig) {
  if (!pace) return undefined;
  if (pace.mode === 'vmaPercent' && pace.vmaPercent) return pace.vmaPercent;
  if (pace.mode === 'zone' && pace.zone) return PACE_ZONES[pace.zone]?.percent;
  return undefined;
}

// Une séance type exprime l'allure en zone ou % VMA : on la ramène au format des séances planifiées.
function toPlannedStep(step: ApiTemplateRunBlockStep): ApiRunBlockStep {
  const percent = pacePercent(step.pace);
  return {
    ...step,
    pace: step.pace?.mode === 'absolute' ? (step.pace.absolute ?? null) : null,
    recoveryPace: step.recoveryPace?.mode === 'absolute' ? (step.recoveryPace.absolute ?? null) : null,
    paceSource: percent ? { mode: 'vmaPercent', vmaPercent: percent } : null,
  };
}

export const templateRunBlocks = (blocks: ApiSessionTemplate['runBlocks']): ApiRunBlock[] =>
  blocks.map((block) => ({ ...toPlannedStep(block), children: block.children?.map(toPlannedStep) }));

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
