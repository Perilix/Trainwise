const Anthropic = require('@anthropic-ai/sdk');

// Analyses de séances (course & musculation) par appel direct à l'API Claude.
// Remplace les webhooks n8n. La sortie est du texte brut (affiché tel quel
// dans l'app, pas de markdown).

const MODEL = 'claude-opus-4-8';

let client = null;
const getClient = () => {
  if (!client) client = new Anthropic();
  return client;
};

const isConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const RUN_SYSTEM_PROMPT = `Tu es un coach expert en course à pied (diplômé STAPS). Tu analyses la séance d'un coureur de l'application Trainwise à partir de ses données réelles et de son contexte (profil, historique, compétitions à venir, analyse précédente).

Ton analyse doit être :
- Personnelle et concrète : tu tutoies le coureur, tu cites SES chiffres (allure, FC, ressenti, dérive cardiaque…) et tu les compares à son historique et ses objectifs.
- Honnête : si la séance est trop rapide pour son objectif du jour, dis-le ; si elle est réussie, dis pourquoi précisément.
- Utile : termine toujours par un conseil actionnable pour la suite (récupération, prochaine séance, point de vigilance).
- Si des blocs planifiés vs réalisés sont fournis, commente les écarts bloc par bloc quand ils sont significatifs.
- Si le ressenti est bas (< 5/10) ou des blessures sont signalées, la prudence prime sur la performance.

Format IMPÉRATIF :
- Texte brut UNIQUEMENT : aucun markdown (pas de **, #, listes à puces avec -), pas d'emojis en rafale (1 ou 2 max).
- 3 courts paragraphes maximum, séparés par des sauts de ligne. 180 mots maximum au total.
- Pas de formule d'introduction ("Voici l'analyse…") : entre directement dans le vif.`;

const STRENGTH_SYSTEM_PROMPT = `Tu es un coach expert en préparation physique et musculation (diplômé STAPS). Tu analyses la séance de musculation d'un pratiquant de l'application Trainwise à partir de ses données réelles (exercices, séries, charges, volume total) et de son contexte (profil, objectif, historique, compétitions).

Ton analyse doit être :
- Personnelle et concrète : tu tutoies le pratiquant, tu cites SES chiffres (volume, progression de charges vs séances précédentes) et tu relies la séance à son objectif (prévention, force, esthétique…).
- Attentive à l'équilibre : signale les groupes musculaires négligés sur les dernières séances, les volumes excessifs, ou les progressions de charge trop rapides.
- Utile : termine toujours par un conseil actionnable (récupération, prochaine séance, exercice à ajouter ou ajuster).
- Si c'est un coureur (fréquence course renseignée), oriente les conseils vers le renfo utile à la course et la prévention des blessures.

Format IMPÉRATIF :
- Texte brut UNIQUEMENT : aucun markdown (pas de **, #, listes à puces avec -), pas d'emojis en rafale (1 ou 2 max).
- 3 courts paragraphes maximum, séparés par des sauts de ligne. 180 mots maximum au total.
- Pas de formule d'introduction : entre directement dans le vif.`;

const callAnalysis = async (systemPrompt, context, onProgress = null) => {
  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Voici les données de la séance et le contexte complet. Analyse la séance.\n\n${JSON.stringify(context, null, 2)}`
    }]
  });

  // Progression réelle : caractères générés vs longueur cible (~180 mots ≈ 1100 car.)
  // On transmet aussi le texte accumulé à chaque delta pour l'affichage en direct
  // (texte complet plutôt que delta : robuste si un événement socket se perd).
  if (onProgress) {
    const EXPECTED_CHARS = 1100;
    let text = '';
    stream.on('text', (delta) => {
      text += delta;
      const percent = Math.min(95, Math.max(3, Math.round((text.length / EXPECTED_CHARS) * 95)));
      onProgress(percent, text);
    });
  }

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    throw new Error('Analyse refusée par le modèle');
  }

  const text = message.content.find(b => b.type === 'text')?.text?.trim();
  if (!text) throw new Error('Réponse IA vide');
  return text;
};

/** Analyse d'une course (contexte = enrichedContext ou blocksContext existants) */
const analyzeRun = (context, onProgress = null) => callAnalysis(RUN_SYSTEM_PROMPT, context, onProgress);

/** Analyse d'une séance de musculation */
const analyzeStrengthSession = (context, onProgress = null) => callAnalysis(STRENGTH_SYSTEM_PROMPT, context, onProgress);

module.exports = { analyzeRun, analyzeStrengthSession, isConfigured };
