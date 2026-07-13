const Anthropic = require('@anthropic-ai/sdk');
const { PACE_ZONES, ZONE_KEYS } = require('../constants/paceZones');

// Génération de plan d'entraînement par appel direct à l'API Claude.
// Le modèle raisonne comme un coach : il choisit des zones d'allure (%VMA),
// et le backend résout les allures exactes depuis la VMA de l'athlète —
// le modèle ne fait jamais l'arithmétique lui-même.

const MODEL = 'claude-opus-4-8';

// ---- Schéma de sortie structurée -------------------------------------------
// Contrainte API : max 16 champs union/nullable par schéma → on n'utilise AUCUN
// null. Les valeurs "absentes" sont des sentinelles (0, "", 'none') résolues
// côté serveur.

// Étape running (bloc de 1er niveau ou enfant d'un bloc « Répéter »)
const stepProperties = {
  role: { type: 'string', enum: ['warmup', 'main', 'cooldown'] },
  mode: { type: 'string', enum: ['distance', 'duration'] },
  value: { type: 'number', description: 'Distance en km si mode=distance (ex: 0.4 pour 400m), durée en minutes si mode=duration' },
  paceZone: { type: 'string', enum: ZONE_KEYS, description: "Zone d'allure cible" },
  paceVmaPercent: { type: 'number', description: '% de VMA cible, dans la fourchette de la zone choisie (ex: 85)' },
  paceAbsolute: { type: 'string', description: 'Allure "m:ss" par km si la VMA du coureur est inconnue, sinon chaîne vide ""' },
  repetitions: { type: 'integer', description: 'Nombre de répétitions (1 pour un bloc simple)' },
  description: { type: 'string', description: 'Consigne courte pour ce bloc (peut être vide)' },
  recoveryMode: { type: 'string', enum: ['none', 'distance', 'duration'], description: 'Récupération entre répétitions (none si aucune)' },
  recoveryValue: { type: 'number', description: 'Récup : km si distance, minutes si duration (ex: 1.5 pour 1min30), 0 si none' },
  recoveryPaceZone: { type: 'string', enum: [...ZONE_KEYS, 'none'] }
};

const stepRequired = Object.keys(stepProperties);

const childStepSchema = {
  type: 'object',
  additionalProperties: false,
  required: stepRequired,
  properties: stepProperties
};

const blockSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...stepRequired, 'children'],
  properties: {
    ...stepProperties,
    children: {
      type: 'array',
      description: 'Étapes d\'un bloc « Répéter » multi-étapes (vide pour un bloc simple). Si non vide, ces étapes sont répétées `repetitions` fois.',
      items: childStepSchema
    }
  }
};

const strengthExerciseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['exerciseId', 'targetSets', 'targetReps', 'targetRest', 'notes'],
  properties: {
    exerciseId: { type: 'string', description: 'ID exact issu du catalogue fourni' },
    targetSets: { type: 'integer' },
    targetReps: { type: 'string', description: 'ex: "8-12"' },
    targetRest: { type: 'string', description: 'ex: "90s"' },
    notes: { type: 'string' }
  }
};

const planSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sessions'],
  properties: {
    sessions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'date', 'activityType', 'sessionType', 'description',
          'targetDistance', 'targetDuration', 'weekNumber',
          'runBlocks', 'strengthExercises'
        ],
        properties: {
          date: { type: 'string', description: 'Date YYYY-MM-DD, obligatoirement une des dates fournies' },
          activityType: { type: 'string', enum: ['running', 'strength'] },
          sessionType: {
            type: 'string',
            enum: [
              'endurance', 'fractionne', 'tempo', 'recuperation', 'sortie_longue', 'cotes', 'fartlek',
              'upper_body', 'lower_body', 'full_body', 'push', 'pull', 'legs', 'core', 'hiit'
            ]
          },
          description: { type: 'string', description: 'Objectif et conseils de la séance, personnalisés (2-3 phrases)' },
          targetDistance: { type: 'number', description: 'Distance totale estimée en km (0 pour une séance strength)' },
          targetDuration: { type: 'number', description: 'Durée totale estimée en minutes' },
          weekNumber: { type: 'integer' },
          runBlocks: {
            type: 'array',
            description: 'Blocs structurés de la séance running (vide si strength). Toujours : échauffement, corps de séance, retour au calme.',
            items: blockSchema
          },
          strengthExercises: {
            type: 'array',
            description: 'Exercices de la séance muscu (vide si running)',
            items: strengthExerciseSchema
          }
        }
      }
    }
  }
};

// ---- Résolution des allures (serveur, pas le modèle) ------------------------

const computePace = (vma, percent) => {
  if (!vma || !percent) return null;
  const speed = vma * (percent / 100);
  if (speed <= 0) return null;
  const secPerKm = 3600 / speed;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Formate des minutes décimales en texte lisible (1.5 → "1min30", 0.5 → "30s")
const formatRecoveryMinutes = (minutes) => {
  if (!minutes || minutes <= 0) return null;
  const totalSec = Math.round(minutes * 60);
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return s === 0 ? `${m}min` : `${m}min${String(s).padStart(2, '0')}`;
};

const resolveStep = (step, vma, order) => {
  const zone = PACE_ZONES[step.paceZone] || null;
  const percent = step.paceVmaPercent || zone?.defaultPercent || null;
  const absolutePace = step.paceAbsolute && step.paceAbsolute.trim() !== '' ? step.paceAbsolute : null;
  const pace = vma ? computePace(vma, percent) : absolutePace;

  const hasRecovery = step.recoveryMode && step.recoveryMode !== 'none';
  const recoveryZoneKey = step.recoveryPaceZone && step.recoveryPaceZone !== 'none' ? step.recoveryPaceZone : null;
  const recoveryPercent = recoveryZoneKey ? (PACE_ZONES[recoveryZoneKey]?.defaultPercent || null) : null;

  return {
    role: step.role,
    mode: step.mode,
    distance: step.mode === 'distance' ? step.value : null,
    duration: step.mode === 'duration' ? step.value : null,
    pace,
    repetitions: Math.max(1, step.repetitions || 1),
    description: step.description || '',
    recoveryMode: hasRecovery ? step.recoveryMode : null,
    recoveryDistance: hasRecovery && step.recoveryMode === 'distance' ? step.recoveryValue : null,
    recoveryDuration: hasRecovery && step.recoveryMode === 'duration' ? formatRecoveryMinutes(step.recoveryValue) : null,
    recoveryPace: vma && recoveryPercent ? computePace(vma, recoveryPercent) : null,
    recoveryDescription: '',
    order,
    paceSource: {
      mode: vma || !absolutePace ? 'zone' : 'absolute',
      zone: step.paceZone || null,
      vmaPercent: percent,
      resolvedFromVma: vma || null,
      overridden: false
    },
    recoveryPaceSource: recoveryZoneKey ? {
      mode: 'zone',
      zone: recoveryZoneKey,
      vmaPercent: recoveryPercent,
      resolvedFromVma: vma || null,
      overridden: false
    } : { mode: null, zone: null, vmaPercent: null, resolvedFromVma: null, overridden: false }
  };
};

const resolveRunBlocks = (blocks, vma) => {
  return (blocks || []).map((b, i) => {
    const resolved = resolveStep(b, vma, i);
    if (b.children && b.children.length > 0) {
      resolved.children = b.children.map((c, ci) => resolveStep(c, vma, ci));
    }
    return resolved;
  });
};

// ---- Prompt -----------------------------------------------------------------

const zoneDoc = ZONE_KEYS
  .map(k => `- ${k} : ${PACE_ZONES[k].label} (${PACE_ZONES[k].minPercent}–${PACE_ZONES[k].maxPercent}% VMA)`)
  .join('\n');

const SYSTEM_PROMPT = `Tu es un coach expert en course à pied et préparation physique (diplômé STAPS, spécialiste de l'entraînement structuré). Tu conçois des plans d'entraînement personnalisés pour l'application Trainwise.

Principes de programmation que tu appliques systématiquement :
- Périodisation : si une compétition approche, oriente le plan vers elle (spécificité croissante, affûtage la dernière semaine avant la course).
- Progressivité : le volume hebdomadaire ne doit pas dépasser ~+10% par rapport à la moyenne récente du coureur. Ne surestime jamais le niveau.
- Polarisation : la majorité du volume en endurance fondamentale ; 1 à 2 séances de qualité par semaine maximum selon le niveau et la fréquence.
- Récupération : jamais deux séances de qualité consécutives ; après une sortie longue, séance facile ou repos.
- Blessures : si le coureur signale des blessures, adapte (moins d'intensité, pas de côtes si fragilité, renfo ciblé).
- Ressenti : si les dernières séances montrent des ressentis bas (< 5/10), réduis la charge.

Structure des séances running — TOUJOURS en blocs structurés :
- Un bloc "warmup" (échauffement, généralement 10-20 min en endurance/récupération active).
- Un ou plusieurs blocs "main". Pour du fractionné, utilise un bloc avec children (ex: 8×400m) ou plusieurs répétitions avec récupération. Les pyramides utilisent children multi-étapes (ex: 2×(400/600/800/600/400)).
- Un bloc "cooldown" (retour au calme, 5-15 min très facile).

Zones d'allure disponibles (tu choisis la zone et un % VMA précis, le serveur calcule l'allure exacte) :
${zoneDoc}

Séances de musculation (si des dates strength sont fournies) :
- Choisis 4 à 7 exercices dans le catalogue fourni (utilise les IDs exacts), cohérents avec le sessionType, le niveau et l'objectif du pratiquant.
- Pour un coureur : privilégie le renfo utile à la course (jambes, gainage, prévention blessures) sauf objectif contraire.

Règles impératives :
- Utilise UNIQUEMENT les dates fournies (runningDates pour le running, strengthDates pour la muscu). Une séance par date fournie, aucune date inventée.
- Varie les séances d'une semaine à l'autre.
- Les descriptions sont en français, personnelles et concrètes (tu t'adresses directement au coureur, tutoiement).
- Ne mets JAMAIS d'allure chiffrée dans les descriptions : indique la zone (le serveur affiche l'allure exacte).`;

// ---- Appel API ---------------------------------------------------------------

let client = null;
const getClient = () => {
  if (!client) client = new Anthropic();
  return client;
};

const isConfigured = () => !!process.env.ANTHROPIC_API_KEY;

/**
 * Génère un plan d'entraînement structuré.
 * @param {object} planningContext - contexte coureur (profil, historique, dates, compétitions)
 * @param {Array} exerciseCatalog - [{ _id, name, primaryMuscle, equipment, difficulty }]
 * @returns {Array} sessions prêtes pour la preview (runBlocks résolus avec allures)
 */
const generateTrainingPlan = async (planningContext, exerciseCatalog = []) => {
  const userContent = [
    'Voici le contexte complet du coureur. Génère son plan d\'entraînement.',
    '',
    '## Contexte',
    JSON.stringify(planningContext, null, 2)
  ];

  if (planningContext.strengthDates?.length > 0 && exerciseCatalog.length > 0) {
    userContent.push(
      '',
      '## Catalogue d\'exercices de musculation disponibles',
      JSON.stringify(exerciseCatalog.map(e => ({
        id: String(e._id),
        name: e.name,
        muscle: e.primaryMuscle,
        equipment: e.equipment,
        difficulty: e.difficulty
      })))
    );
  }

  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 32000,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: planSchema } },
    messages: [{ role: 'user', content: userContent.join('\n') }]
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error('La génération a été refusée par le modèle');
  }

  const text = message.content.find(b => b.type === 'text')?.text;
  if (!text) throw new Error('Réponse IA vide');

  const parsed = JSON.parse(text);
  const vma = planningContext.runner?.vma || null;
  const validDates = new Set([
    ...(planningContext.runningDates || []),
    ...(planningContext.strengthDates || [])
  ]);
  const validExerciseIds = new Set(exerciseCatalog.map(e => String(e._id)));

  // Post-traitement : filtrage des dates inventées + résolution des allures
  return (parsed.sessions || [])
    .filter(s => validDates.has(s.date))
    .map(s => {
      const isStrength = s.activityType === 'strength';
      return {
        date: s.date,
        activityType: s.activityType,
        sessionType: s.sessionType,
        description: s.description,
        targetDistance: isStrength || !s.targetDistance ? null : s.targetDistance,
        targetDuration: s.targetDuration || null,
        weekNumber: s.weekNumber,
        runBlocks: isStrength ? [] : resolveRunBlocks(s.runBlocks, vma),
        strengthExercises: isStrength
          ? (s.strengthExercises || []).filter(e => validExerciseIds.has(e.exerciseId))
          : []
      };
    });
};

module.exports = { generateTrainingPlan, isConfigured };
