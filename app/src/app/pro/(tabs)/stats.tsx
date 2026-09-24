import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { FeelingChart, LoadChart, StackChart, TrendChart, type LineSeries } from '@/components/charts/form-charts';
import { Avatar, avatarToneFor, Button, Card, Chip, Icon, IconButton, Screen, Section, Segmented, StateView, Text, type IconName } from '@/components/ui';
import { FORM_STATE_STYLE, fmt, formHeadline, paceLabel, signed, type ApiAthleteForm, type ApiFormExercise, type FormCue, type FormState } from '@/features/coach/form';
import { useAthleteForm, useCoachActions, useCoachHome, useFormSummaries, useInviteOverview } from '@/features/coach/queries';
import { MainAppBar } from '@/features/shell/main-app-bar';
import { emitAppEvent, onAppEvent } from '@/lib/app-events';
import { useTheme } from '@/theme/theme-provider';
import { intensityRamp, layout, radius } from '@/theme/tokens';
import { fontFamily } from '@/theme/typography';

const PERIODS = [
  { value: '4', label: '4 sem.' },
  { value: '8', label: '8 sem.' },
  { value: '13', label: '3 mois' },
  { value: '26', label: '6 mois' },
] as const;

const SPORTS = [
  { value: 'run', label: 'Course' },
  { value: 'strength', label: 'Muscu' },
] as const;

type Sport = (typeof SPORTS)[number]['value'];

/**
 * Stats : la forme de chaque athlète, pour planifier ses prochaines séances.
 * Même contenu que l'écran web : les athlètes triés par forme en haut, puis
 * l'athlète choisi (forme du moment, repères, graphiques par sport). Les
 * demandes et invitations restent accessibles, repliées en une ligne.
 */
export default function CoachStatsScreen() {
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const [weeks, setWeeks] = useState<(typeof PERIODS)[number]['value']>('8');
  const [choice, setChoice] = useState<string | null>(null);
  const [sportChoice, setSportChoice] = useState<Sport | null>(null);
  const [todoOpen, setTodoOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [width, setWidth] = useState(0);

  const { data: home, loading, error, refetch } = useCoachHome();
  const { data: invite, refetch: refetchInvite } = useInviteOverview();
  const { data: summaries, refetch: refetchSummaries } = useFormSummaries();
  const { respondToRequest } = useCoachActions();

  useEffect(
    () =>
      onAppEvent('athletes:changed', () => {
        refetch();
        refetchInvite();
        refetchSummaries();
      }),
    [refetch, refetchInvite, refetchSummaries],
  );

  const athletes = useMemo(() => {
    const byId = new Map((summaries ?? []).map((s) => [s.athleteId, s]));
    return (home?.athletes ?? [])
      .map((athlete) => {
        const summary = byId.get(athlete.id);
        const state: FormState = summary?.state ?? 'unknown';
        return { ...athlete, state, firstName: athlete.name.split(' ')[0] };
      })
      .sort((a, b) => FORM_STATE_STYLE[a.state].order - FORM_STATE_STYLE[b.state].order || a.name.localeCompare(b.name));
  }, [home, summaries]);

  const selected = athletes.find((a) => a.id === choice) ?? athletes[0] ?? null;
  const { data: form, loading: formLoading, error: formError, refetch: refetchForm } = useAthleteForm(selected?.id ?? null, Number(weeks));

  if (!home) {
    return (
      <Screen tabs>
        <MainAppBar />
        <StateView loading={loading} error={error} onRetry={refetch} />
      </Screen>
    );
  }

  const sport: Sport = form && !form.sports.run && form.sports.strength ? 'strength' : form && form.sports.run && !form.sports.strength ? 'run' : sportChoice ?? 'run';
  const pending = invite?.pending ?? [];
  const todoCount = home.requests.length + pending.length;
  // Largeur utile d'un graphique : l'écran, moins les marges de la section et de la carte.
  const inner = Math.max(0, width - 2 * layout.gutter - 32);
  const onMeasure = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));
  const ramp = intensityRamp[scheme];

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    try {
      await respondToRequest(id, accept);
      emitAppEvent('athletes:changed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen tabs>
      <MainAppBar />

      <Section style={styles.heading}>
        <Text variant="h1">Stats</Text>
        <Text variant="body2">La forme de vos athlètes, avant de planifier.</Text>
      </Section>

      {todoCount ? (
        <Section style={styles.tight}>
          <Card padding={0} style={styles.overflow}>
            <Pressable accessibilityRole="button" onPress={() => setTodoOpen((open) => !open)} style={styles.todoHead}>
              <View style={[styles.dot, { backgroundColor: home.requests.length ? colors.danger : colors.warning }]} />
              <Text variant="h3" style={styles.flex}>
                {[home.requests.length && `${home.requests.length} demande${home.requests.length > 1 ? 's' : ''}`, pending.length && `${pending.length} invitation${pending.length > 1 ? 's' : ''}`]
                  .filter(Boolean)
                  .join(' · ')}{' '}
                à traiter
              </Text>
              <Icon name={todoOpen ? 'chevronDown' : 'chevronRight'} size={18} color={colors.text3} />
            </Pressable>
            {todoOpen
              ? [
                  ...home.requests.map((request) => (
                    <View key={request.id} style={[styles.row, { borderTopColor: colors.border }]}>
                      <Avatar initials={request.initials} size={34} tone={avatarToneFor(request.id)} />
                      <View style={styles.flex}>
                        <Text variant="h3" numberOfLines={1}>
                          {request.name}
                        </Text>
                        <Text variant="small" numberOfLines={1}>
                          {request.offer}
                        </Text>
                      </View>
                      <Button label="Accepter" size="sm" disabled={busyId === request.id} onPress={() => respond(request.id, true)} />
                      <IconButton icon="x" accessibilityLabel="Refuser" size={36} bordered onPress={() => respond(request.id, false)} />
                    </View>
                  )),
                  ...pending.map((invitation) => (
                    <View key={invitation.id} style={[styles.row, { borderTopColor: colors.border }]}>
                      <Avatar initials={invitation.initials} size={34} />
                      <View style={styles.flex}>
                        <Text variant="h3" numberOfLines={1}>
                          {invitation.name}
                        </Text>
                        <Text variant="small">{invitation.sentLabel}</Text>
                      </View>
                      <Chip label="En attente" tone="warning" />
                    </View>
                  )),
                ]
              : null}
          </Card>
        </Section>
      ) : null}

      {!selected ? (
        <Section>
          <Card>
            <Text variant="body2">Invitez un athlète pour suivre sa forme ici.</Text>
          </Card>
        </Section>
      ) : (
        <>
          {/* Les athlètes, triés par forme */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {athletes.map((athlete) => {
              const on = athlete.id === selected.id;
              const dot = { overreached: colors.danger, loaded: colors.warning, inactive: colors.text3, rested: colors.accent, optimal: colors.success, unknown: colors.borderStrong }[athlete.state];
              return (
                <Pressable
                  key={athlete.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${athlete.name}, ${FORM_STATE_STYLE[athlete.state].label}`}
                  accessibilityState={{ selected: on }}
                  onPress={() => {
                    setChoice(athlete.id);
                    setSportChoice(null);
                  }}
                  style={styles.stripItem}>
                  <View style={[styles.stripAvatar, on && { borderColor: colors.primary }]}>
                    <Avatar initials={athlete.initials} size={46} tone={on ? 'primary' : avatarToneFor(athlete.id)} />
                    <View style={[styles.stripDot, { backgroundColor: dot, borderColor: colors.bg }]} />
                  </View>
                  <Text variant="caption" numberOfLines={1} style={on ? { color: colors.ink, fontFamily: fontFamily.semibold } : undefined}>
                    {athlete.firstName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Section style={styles.tight}>
            <View style={styles.whoLine}>
              <View style={styles.flex}>
                <View style={styles.nameLine}>
                  <Text variant="h2" numberOfLines={1} style={styles.shrink}>
                    {selected.name}
                  </Text>
                  {form ? <Chip label={FORM_STATE_STYLE[form.form.state].label} tone={FORM_STATE_STYLE[form.form.state].tone} /> : null}
                </View>
                {form?.goal ? (
                  <View style={styles.goal}>
                    <Icon name="flag" size={14} color={colors.text2} />
                    <Text variant="small" numberOfLines={1}>
                      {form.goal.name} · {daysLabel(form.goal.daysLeft)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <IconButton icon="user" accessibilityLabel="Fiche athlète" bordered onPress={() => router.push({ pathname: '/pro/athletes/[id]', params: { id: selected.id } })} />
            </View>
            {form?.sports.run && form.sports.strength ? <Segmented options={SPORTS} value={sport} onChange={setSportChoice} style={styles.segmented} /> : null}
            <Segmented options={PERIODS} value={weeks} onChange={setWeeks} style={styles.segmented} />
          </Section>

          {!form ? (
            <StateView loading={formLoading} error={formError} onRetry={refetchForm} />
          ) : (
            <View onLayout={onMeasure}>
              <Section style={styles.tight}>
                <Verdict form={form} sport={sport} />
              </Section>

              <Section style={styles.tight}>
                <Cues
                  form={form}
                  sport={sport}
                  onPlan={() => router.push({ pathname: '/pro/athletes/[id]/planning', params: { id: selected.id, name: selected.name } })}
                  onWrite={() => router.push({ pathname: '/pro/conversation/[id]', params: { id: selected.id } })}
                />
              </Section>

              {sport === 'run' ? (
                <>
                  <Section style={styles.tight}>
                    <Card style={styles.chartCard}>
                      <Text variant="h3">Charge d’entraînement</Text>
                      <Legend items={[{ label: 'Réalisé', color: colors.accent }, { label: 'Prévu', color: colors.accent, hatch: true }, { label: 'Habituelle', color: colors.ink, line: true }]} />
                      <LoadChart width={inner} weeks={form.load.weeks} remaining={form.load.currentRemaining} next={form.load.next} />
                      <LoadNote form={form} />
                    </Card>
                  </Section>
                  <Section style={styles.tight}>
                    <Card style={styles.chartCard}>
                      <Text variant="h3">FC à allure d’endurance</Text>
                      <Text variant="small">
                        {form.run.easyHr.paceRange ? `Entre ${paceLabel(form.run.easyHr.paceRange.from)} et ${paceLabel(form.run.easyHr.paceRange.to)}/km, sur le plat` : 'En endurance'}
                      </Text>
                      {form.run.easyHr.weeks.filter((w) => w.value != null).length >= 2 ? (
                        <TrendChart
                          width={inner}
                          labels={form.load.weeks.map((w) => w.label)}
                          series={[{ values: form.run.easyHr.weeks.map((w) => w.value), color: colors.danger, area: true }]}
                          refValue={form.run.easyHr.baseline}
                          refLabel={form.run.easyHr.baseline ? `Habitude · ${form.run.easyHr.baseline}` : undefined}
                        />
                      ) : (
                        <Text variant="body2">{!form.athlete.vma ? 'Renseignez sa VMA pour suivre sa FC à allure d’endurance.' : 'Pas encore assez de km en endurance avec cardio.'}</Text>
                      )}
                    </Card>
                  </Section>
                  <Section style={styles.tight}>
                    <Card style={styles.chartCard}>
                      <Text variant="h3">Ressenti après séance</Text>
                      <Text variant="small">Note de 1 à 10, séance par séance</Text>
                      {form.feeling.points.length ? (
                        <FeelingChart width={inner} points={form.feeling.points} average={form.feeling.average} from={form.load.weeks[0].start} to={form.generatedAt} />
                      ) : (
                        <Text variant="body2">Pas encore de ressenti noté sur la période.</Text>
                      )}
                    </Card>
                  </Section>
                  <Section>
                    <Card style={styles.chartCard}>
                      <Text variant="h3">Kilomètres par semaine</Text>
                      <Legend items={[{ label: 'Endurance', color: ramp[0] }, { label: 'Seuil', color: ramp[2] }, { label: 'VMA', color: ramp[4] }]} />
                      <StackChart width={inner} labels={form.run.km.weeks.map((w) => w.label)} stacks={form.run.km.weeks.map((w) => [w.easy, w.tempo, w.hard])} colors={[ramp[0], ramp[2], ramp[4]]} />
                      <View style={styles.facts}>
                        <Fact label="Moyenne" value={`${fmt(form.run.km.averagePerWeek)} km`} />
                        <Fact label="Endurance" value={`${form.run.km.easyShare ?? '—'} %`} />
                        <Fact label="Plus longue" value={`${fmt(form.run.km.longest)} km`} />
                      </View>
                    </Card>
                  </Section>
                </>
              ) : (
                <StrengthCharts form={form} width={inner} />
              )}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------

function Verdict({ form, sport }: { form: ApiAthleteForm; sport: Sport }) {
  const { colors } = useTheme();
  const { title, sentence } = formHeadline(form.form);
  const metrics = verdictMetrics(form, sport);
  const zones: [string, number, string][] = [
    ['Reposé', 22, 'rgba(127,211,253,0.35)'],
    ['Dans la zone', 36, 'rgba(110,231,183,0.55)'],
    ['Chargé', 24, 'rgba(252,211,77,0.75)'],
    ['Surmené', 18, 'rgba(248,113,113,0.75)'],
  ];
  return (
    <View style={[styles.verdict, { backgroundColor: colors.brand }]}>
      <Text variant="overline" style={{ color: colors.highlight }}>
        Forme du moment
      </Text>
      <Text variant="h1" style={styles.verdictTitle}>
        {title}
      </Text>
      <Text variant="body" style={styles.verdictText}>
        {sentence}
      </Text>
      {form.form.position != null ? (
        <View style={styles.gauge}>
          <View style={styles.gaugeBar}>
            {zones.map(([name, flex, color]) => (
              <View key={name} style={{ flex, backgroundColor: color, borderRadius: radius.pill }} />
            ))}
            <View style={[styles.cursor, { left: `${form.form.position * 100}%`, borderColor: colors.brand }]} />
          </View>
          <View style={styles.gaugeLabels}>
            {zones.map(([name, flex]) => (
              <Text key={name} variant="caption" numberOfLines={1} style={[styles.gaugeLabel, { flex }]}>
                {name}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      <View style={styles.metrics}>
        {metrics.map((m) => (
          <View key={m.label} style={styles.metric}>
            <Text variant="caption" numberOfLines={1} style={styles.onBrand2}>
              {m.label}
            </Text>
            <Text variant="stat" tabular style={styles.onBrand}>
              {m.value}
              <Text variant="caption" style={styles.onBrand2}>
                {' '}
                {m.unit}
              </Text>
            </Text>
            <Text variant="caption" numberOfLines={1} style={{ color: m.bad ? '#FCD34D' : '#6EE7B7' }}>
              {m.delta}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function verdictMetrics(f: ApiAthleteForm, sport: Sport) {
  if (sport === 'run') {
    const lastHr = [...f.run.easyHr.weeks].reverse().find((w) => w.value != null)?.value ?? null;
    const ratio = f.form.ratio;
    return [
      { label: 'Charge 7 j', value: String(f.form.acute ?? 0), unit: 'pts', delta: ratio != null ? `${signed(Math.round((ratio - 1) * 100), 0)} %` : '—', bad: ratio != null && ratio > 1.3 },
      { label: 'FC endurance', value: lastHr != null ? String(lastHr) : '—', unit: 'bpm', delta: f.run.easyHr.drift != null ? signed(f.run.easyHr.drift) : '—', bad: (f.run.easyHr.drift ?? 0) >= 4 },
      { label: 'Ressenti', value: fmt(f.feeling.now), unit: '/10', delta: f.feeling.now != null && f.feeling.before != null ? signed(f.feeling.now - f.feeling.before) : '—', bad: f.form.signals.includes('feeling') },
    ];
  }
  const avg = f.strength.tonnageAverage;
  const pct = avg ? Math.round(((f.strength.tonnage7d - avg) / avg) * 100) : null;
  const flat = f.strength.exercises.filter((e) => e.trend?.direction !== 'up').length;
  return [
    { label: 'Tonnage 7 j', value: fmt(f.strength.tonnage7d / 1000), unit: 't', delta: pct != null ? `${signed(pct, 0)} %` : '—', bad: pct != null && pct > 25 },
    { label: 'RPE moyen', value: fmt(f.strength.rpeNow), unit: '/10', delta: f.strength.rpeNow != null && f.strength.rpeBefore != null ? signed(f.strength.rpeNow - f.strength.rpeBefore) : '—', bad: (f.strength.rpeNow ?? 0) >= 8.5 },
    { label: 'En progrès', value: String(f.strength.progressing), unit: `/${f.strength.exercises.length}`, delta: flat ? `${flat} stagnent` : 'tous', bad: flat > f.strength.progressing },
  ];
}

function Cues({ form, sport, onPlan, onWrite }: { form: ApiAthleteForm; sport: Sport; onPlan: () => void; onWrite: () => void }) {
  const { colors } = useTheme();
  const cues = sport === 'run' ? form.run.cues : form.strength.cues;
  const next = form.load.next;
  const tone = (cue: FormCue): [string, string, IconName] =>
    cue.kind === 'down' ? [colors.warningSoft, colors.warningInk, 'trendDown'] : cue.kind === 'up' ? [colors.successSoft, colors.successInk, 'trendUp'] : [colors.accentSoft, colors.accentInk, 'arrowRight'];
  return (
    <Card>
      <Text variant="h3">{sport === 'run' ? `Repères pour la ${next.label}` : 'Repères pour la prochaine séance'}</Text>
      <Text variant="small">{sport === 'run' ? (next.sessions ? `Prévue à ${next.load} pts` : 'Rien de prévu pour l’instant') : 'D’après ses dernières séances'}</Text>
      <View style={styles.cueList}>
        {cues.length ? (
          cues.map((cue, index) => {
            const [bg, fg, icon] = tone(cue);
            return (
              <View key={cue.title} style={[styles.cue, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={[styles.cueIcon, { backgroundColor: bg }]}>
                  <Icon name={icon} size={16} color={fg} strokeWidth={2} />
                </View>
                <View style={styles.flex}>
                  <Text variant="h3">{cue.title}</Text>
                  <Text variant="small">{cue.detail}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text variant="body2" style={styles.cue}>
            {form.form.state === 'unknown'
              ? 'Pas encore assez d’historique pour proposer des repères.'
              : form.form.state === 'inactive'
                ? 'Aucune activité récente : un message pour reprendre contact ?'
                : 'Rien à signaler : le planning prévu reste dans sa zone.'}
          </Text>
        )}
      </View>
      <View style={styles.cueActions}>
        <Button label="Planifier la semaine" icon="calendar" size="sm" onPress={onPlan} style={styles.flex} />
        <IconButton icon="message" accessibilityLabel={`Écrire à ${form.athlete.firstName}`} size={36} bordered onPress={onWrite} />
      </View>
      <View style={styles.cueNote}>
        <Icon name="info" size={14} color={colors.text3} />
        <Text variant="caption" style={[styles.flex, { color: colors.text3 }]}>
          Repères calculés sur ses 4 dernières semaines. Rien n’est modifié sans vous.
        </Text>
      </View>
    </Card>
  );
}

function LoadNote({ form }: { form: ApiAthleteForm }) {
  const { colors } = useTheme();
  const n = form.load.next;
  let text: string;
  let warn = false;
  if (n.high == null) text = 'La zone de progression apparaît après 4 semaines d’historique.';
  else if (!n.sessions) text = `Rien de planifié en ${n.label}. Zone : ${n.low} à ${n.high} pts.`;
  else if (n.load > n.high) {
    warn = true;
    text = `La ${n.label} prévue dépasse la zone de progression de ${Math.round((n.load / n.high - 1) * 100)} %.`;
  } else text = `La ${n.label} prévue (${n.load} pts) reste dans la zone (${n.low} à ${n.high} pts).`;
  return (
    <View style={[styles.note, { backgroundColor: warn ? colors.warningSoft : colors.subtle }]}>
      <Icon name="info" size={15} color={warn ? colors.warningInk : colors.text2} />
      <Text variant="caption" style={[styles.flex, { color: warn ? colors.warningInk : colors.text2 }]}>
        {text}
      </Text>
    </View>
  );
}

function StrengthCharts({ form, width }: { form: ApiAthleteForm; width: number }) {
  const { colors } = useTheme();
  const labels = form.load.weeks.map((w) => w.label);
  const top = form.strength.exercises.filter((e) => e.weighted).slice(0, 3);
  const palette = [colors.ink, colors.accent, colors.accentInk];
  const e1rm: LineSeries[] = top.map((ex, i) => ({ values: ex.weekly, color: palette[i], dashed: i === 2 }));
  const rpeEx = top.find((ex) => ex.heavyRpe.some((v) => v != null));
  return (
    <>
      <Section style={styles.tight}>
        <Card style={styles.chartCard}>
          <Text variant="h3">Charge max estimée</Text>
          <Legend items={top.map((ex, i) => ({ label: ex.name, color: palette[i], line: true }))} />
          {e1rm.some((s) => s.values.filter((v) => v != null).length >= 2) ? (
            <TrendChart width={width} labels={labels} series={e1rm} height={170} />
          ) : (
            <Text variant="body2">Pas encore assez de séances avec charges.</Text>
          )}
        </Card>
      </Section>
      {rpeEx ? (
        <Section style={styles.tight}>
          <Card style={styles.chartCard}>
            <Text variant="h3">Effort perçu · {rpeEx.name}</Text>
            <Text variant="small">RPE de sa série la plus lourde</Text>
            <TrendChart width={width} labels={labels} series={[{ values: rpeEx.heavyRpe, color: colors.warningInk, area: true }]} min={5} max={10} refValue={8} />
          </Card>
        </Section>
      ) : null}
      <Section>
        <Card padding={0} style={styles.overflow}>
          <View style={styles.tableHead}>
            <Text variant="h3">Exercices suivis</Text>
          </View>
          {form.strength.exercises.length ? (
            form.strength.exercises.map((ex) => (
              <View key={ex.id} style={[styles.row, { borderTopColor: colors.border }]}>
                <View style={styles.flex}>
                  <Text variant="h3" numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text variant="small" numberOfLines={1}>
                    {lastSet(ex)}
                    {ex.last.rpe != null ? ` · RPE ${fmt(ex.last.rpe)}` : ''}
                  </Text>
                </View>
                <Chip label={trendLabel(ex)} tone={ex.trend?.direction === 'up' ? 'success' : ex.trend?.direction === 'down' ? 'warning' : 'neutral'} />
              </View>
            ))
          ) : (
            <Text variant="body2" style={styles.tableEmpty}>
              Pas encore d’exercice fait 3 fois sur la période.
            </Text>
          )}
        </Card>
      </Section>
    </>
  );
}

function Legend({ items }: { items: { label: string; color: string; line?: boolean; hatch?: boolean }[] }) {
  return (
    <View style={styles.legend}>
      {items.map((item) => (
        <View key={item.label} style={styles.legendItem}>
          <View
            style={
              item.line
                ? [styles.legendLine, { backgroundColor: item.color }]
                : item.hatch
                  ? [styles.swatch, { borderWidth: 1.5, borderStyle: 'dashed', borderColor: item.color }]
                  : [styles.swatch, { backgroundColor: item.color }]
            }
          />
          <Text variant="caption">{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text variant="caption">{label}</Text>
      <Text variant="h3" tabular>
        {value}
      </Text>
    </View>
  );
}

function lastSet(ex: ApiFormExercise) {
  const s = ex.lastHeaviest ?? ex.last;
  return s.weight ? `${fmt(s.weight)} kg × ${s.reps}` : `PDC × ${s.reps}`;
}

function trendLabel(ex: ApiFormExercise) {
  if (!ex.trend) return 'Nouveau';
  if (ex.trend.direction === 'flat') return 'Stagne';
  return `${signed(ex.trend.pct, 0)} %`;
}

function daysLabel(days: number) {
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  if (days < 14) return `dans ${days} jours`;
  return `dans ${Math.round(days / 7)} semaines`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  overflow: { overflow: 'hidden' },
  heading: { gap: 2, paddingTop: 4, paddingBottom: 14 },
  tight: { paddingBottom: 14 },
  todoHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1 },
  strip: { paddingHorizontal: layout.gutter, paddingTop: 4, paddingBottom: 14, gap: 12 },
  stripItem: { width: 58, alignItems: 'center', gap: 6 },
  stripAvatar: { borderRadius: 999, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  stripDot: { position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2.5 },
  whoLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  segmented: { marginTop: 12 },
  verdict: { borderRadius: radius.lg, padding: 18 },
  verdictTitle: { color: '#FFFFFF', marginTop: 6 },
  verdictText: { color: 'rgba(255,255,255,0.8)', marginTop: 6 },
  gauge: { marginTop: 18 },
  gaugeBar: { flexDirection: 'row', gap: 3, height: 8 },
  cursor: { position: 'absolute', top: -5, width: 18, height: 18, marginLeft: -9, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 3 },
  gaugeLabels: { flexDirection: 'row', gap: 3, marginTop: 8 },
  gaugeLabel: { color: 'rgba(255,255,255,0.64)', textAlign: 'center', fontSize: 10.5 },
  metrics: { flexDirection: 'row', gap: 12, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  metric: { flex: 1, minWidth: 0, gap: 2 },
  onBrand: { color: '#FFFFFF' },
  onBrand2: { color: 'rgba(255,255,255,0.64)' },
  cueList: { marginTop: 6 },
  cue: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  cueIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cueActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  cueNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12 },
  chartCard: { gap: 10 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLine: { width: 14, height: 2.5, borderRadius: 2 },
  facts: { flexDirection: 'row', gap: 8 },
  fact: { flex: 1, gap: 2 },
  tableHead: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  tableEmpty: { paddingHorizontal: 14, paddingBottom: 14 },
});
