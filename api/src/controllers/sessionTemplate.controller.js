const SessionTemplate = require('../models/sessionTemplate.model');
const PlannedRun = require('../models/plannedRun.model');
const User = require('../models/user.model');
const CoachAthlete = require('../models/coachAthlete.model');
const { resolveBlockPace } = require('../services/paceResolver');
const { PACE_ZONES } = require('../constants/paceZones');
const { createNotification } = require('./notification.controller');

exports.listTemplates = async (req, res) => {
  try {
    const { sport, search, scope } = req.query;

    let query;
    if (scope === 'public') {
      query = { isPublic: true };
    } else if (scope === 'all') {
      query = { $or: [{ coach: req.user._id }, { isPublic: true }] };
    } else {
      query = { coach: req.user._id };
    }

    if (sport) query.sport = sport;
    if (search) query.$text = { $search: search };

    const templates = await SessionTemplate.find(query)
      .sort({ updatedAt: -1 });

    res.json(templates);
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPaceZones = async (req, res) => {
  res.json(Object.values(PACE_ZONES));
};

exports.getTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await SessionTemplate.findById(id)
      .populate('strengthPlan.exercises.exercise', 'name primaryMuscle equipment')
      .populate('strengthPlan.circuit.exercises.exercise', 'name primaryMuscle equipment')
      .populate('strengthPlan.superset.pairs.a.exercise', 'name primaryMuscle equipment')
      .populate('strengthPlan.superset.pairs.b.exercise', 'name primaryMuscle equipment');

    if (!template) return res.status(404).json({ error: 'Séance non trouvée' });

    if (template.coach.toString() !== req.user._id.toString() && !template.isPublic) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const template = await SessionTemplate.create({
      ...req.body,
      coach: req.user._id
    });
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await SessionTemplate.findById(id);
    if (!template) return res.status(404).json({ error: 'Séance non trouvée' });

    if (template.coach.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Non autorisé à modifier cette séance' });
    }

    const { coach, usageCount, lastUsedAt, ...allowed } = req.body;
    Object.assign(template, allowed);
    await template.save();

    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await SessionTemplate.findById(id);
    if (!template) return res.status(404).json({ error: 'Séance non trouvée' });

    if (template.coach.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Non autorisé à supprimer cette séance' });
    }

    await template.deleteOne();
    res.json({ message: 'Séance supprimée' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.previewAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { athleteIds } = req.body;

    if (!Array.isArray(athleteIds) || athleteIds.length === 0) {
      return res.status(400).json({ error: 'Liste d\'athlètes requise' });
    }

    const template = await SessionTemplate.findById(id);
    if (!template) return res.status(404).json({ error: 'Séance non trouvée' });
    if (template.coach.toString() !== req.user._id.toString() && !template.isPublic) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const relationships = await CoachAthlete.find({
      coach: req.user._id,
      athlete: { $in: athleteIds },
      status: 'accepted'
    }).lean();
    const validAthleteIds = new Set(relationships.map(r => r.athlete.toString()));

    const athletes = await User.find({ _id: { $in: athleteIds } })
      .select('firstName lastName vma')
      .lean();

    const previews = athletes
      .filter(a => validAthleteIds.has(a._id.toString()))
      .map(athlete => {
        const blocks = (template.runBlocks || []).map((block, index) => ({
          blockIndex: index,
          role: block.role,
          paceConfig: block.pace,
          resolvedPace: resolveBlockPace(block.pace, athlete.vma),
          recoveryPaceConfig: block.recoveryPace,
          resolvedRecoveryPace: resolveBlockPace(block.recoveryPace, athlete.vma)
        }));

        return {
          athleteId: athlete._id,
          firstName: athlete.firstName,
          lastName: athlete.lastName,
          vma: athlete.vma,
          missingVma: !athlete.vma && template.sport === 'running',
          blocks
        };
      });

    res.json({ template, previews });
  } catch (error) {
    console.error('Error previewing assignment:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createTemplateFromPlanning = async (req, res) => {
  try {
    const { plannedRunId } = req.params;
    const { name, description } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Le nom du template est requis' });
    }

    const planned = await PlannedRun.findById(plannedRunId).lean();
    if (!planned) return res.status(404).json({ error: 'Séance source non trouvée' });

    const relationship = await CoachAthlete.findOne({
      coach: req.user._id,
      athlete: planned.user,
      status: 'accepted'
    });
    if (!relationship) return res.status(403).json({ error: 'Accès refusé' });

    const toTemplateBlock = (b) => {
      const pace = b.paceSource && b.paceSource.mode
        ? {
            mode: b.paceSource.mode,
            zone: b.paceSource.zone,
            vmaPercent: b.paceSource.vmaPercent,
            absolute: b.pace
          }
        : { mode: 'absolute', absolute: b.pace || null };

      const recoveryPace = b.recoveryPace
        ? (b.recoveryPaceSource && b.recoveryPaceSource.mode
            ? {
                mode: b.recoveryPaceSource.mode,
                zone: b.recoveryPaceSource.zone,
                vmaPercent: b.recoveryPaceSource.vmaPercent,
                absolute: b.recoveryPace
              }
            : { mode: 'absolute', absolute: b.recoveryPace })
        : null;

      const out = {
        role: b.role,
        mode: b.mode,
        distance: b.distance,
        duration: b.duration,
        pace,
        repetitions: b.repetitions,
        description: b.description,
        recoveryMode: b.recoveryMode,
        recoveryDistance: b.recoveryDistance,
        recoveryDuration: b.recoveryDuration,
        recoveryPace,
        recoveryDescription: b.recoveryDescription,
        order: b.order
      };
      if (b.children && b.children.length) out.children = b.children.map(toTemplateBlock);
      return out;
    };

    const runBlocks = (planned.runBlocks || []).map(toTemplateBlock);

    const template = await SessionTemplate.create({
      name: name.trim(),
      description: description?.trim() || planned.description || '',
      sport: planned.activityType || 'running',
      sessionType: planned.sessionType,
      targetDistance: planned.targetDistance,
      targetDuration: planned.targetDuration,
      warmup: planned.warmup,
      mainWorkout: planned.mainWorkout,
      cooldown: planned.cooldown,
      runBlocks: planned.activityType === 'running' ? runBlocks : [],
      strengthPlan: planned.activityType === 'strength' ? planned.strengthPlan : null,
      coach: req.user._id
    });

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template from planning:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.assignTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignments } = req.body;

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'Liste d\'assignations requise' });
    }

    const template = await SessionTemplate.findById(id);
    if (!template) return res.status(404).json({ error: 'Séance non trouvée' });
    if (template.coach.toString() !== req.user._id.toString() && !template.isPublic) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const athleteIds = [...new Set(assignments.map(a => a.athleteId))];
    const relationships = await CoachAthlete.find({
      coach: req.user._id,
      athlete: { $in: athleteIds },
      status: 'accepted'
    }).lean();
    const validAthleteIds = new Set(relationships.map(r => r.athlete.toString()));

    const athletes = await User.find({ _id: { $in: athleteIds } })
      .select('firstName lastName vma')
      .lean();
    const athleteMap = new Map(athletes.map(a => [a._id.toString(), a]));

    const created = [];
    for (const assign of assignments) {
      const athleteIdStr = assign.athleteId.toString();
      if (!validAthleteIds.has(athleteIdStr)) continue;
      if (!assign.date) continue;

      const athlete = athleteMap.get(athleteIdStr);
      if (!athlete) continue;

      const overrides = assign.paceOverrides || {};

      // override : surcharge d'allure manuelle (uniquement pour les blocs de 1er niveau ;
      // les enfants d'un groupe résolvent leur allure sans surcharge).
      const toPlannedBlock = (block, blockOverride) => {
        blockOverride = blockOverride || {};
        const resolved = resolveBlockPace(block.pace, athlete.vma);
        const finalPace = blockOverride.pace !== undefined ? blockOverride.pace : resolved;
        const overriddenPace = blockOverride.pace !== undefined && blockOverride.pace !== resolved;

        const resolvedRecovery = block.recoveryPace
          ? resolveBlockPace(block.recoveryPace, athlete.vma)
          : null;
        const finalRecoveryPace = blockOverride.recoveryPace !== undefined
          ? blockOverride.recoveryPace
          : resolvedRecovery;
        const overriddenRecovery = blockOverride.recoveryPace !== undefined
          && blockOverride.recoveryPace !== resolvedRecovery;

        const out = {
          role: block.role,
          mode: block.mode,
          distance: block.distance,
          duration: block.duration,
          pace: finalPace,
          repetitions: block.repetitions,
          description: block.description,
          recoveryMode: block.recoveryMode,
          recoveryDistance: block.recoveryDistance,
          recoveryDuration: block.recoveryDuration,
          recoveryPace: finalRecoveryPace,
          recoveryDescription: block.recoveryDescription,
          order: block.order,
          paceSource: block.pace ? {
            mode: block.pace.mode,
            zone: block.pace.zone,
            vmaPercent: block.pace.vmaPercent,
            resolvedFromVma: athlete.vma || null,
            overridden: overriddenPace
          } : undefined,
          recoveryPaceSource: block.recoveryPace ? {
            mode: block.recoveryPace.mode,
            zone: block.recoveryPace.zone,
            vmaPercent: block.recoveryPace.vmaPercent,
            resolvedFromVma: athlete.vma || null,
            overridden: overriddenRecovery
          } : undefined
        };
        if (block.children && block.children.length) {
          out.children = block.children.map(c => toPlannedBlock(c, {}));
        }
        return out;
      };

      const runBlocks = (template.runBlocks || []).map((block, index) => toPlannedBlock(block, overrides[index]));

      const mainBlock = runBlocks.find(b => b.role === 'main');
      const targetPace = mainBlock ? mainBlock.pace : null;

      const planned = await PlannedRun.create({
        user: assign.athleteId,
        date: new Date(assign.date),
        activityType: template.sport,
        sessionType: template.sessionType,
        targetDistance: template.targetDistance,
        targetDuration: template.targetDuration,
        targetPace,
        description: template.description,
        warmup: template.warmup,
        mainWorkout: template.mainWorkout,
        cooldown: template.cooldown,
        runBlocks: template.sport === 'running' ? runBlocks : [],
        strengthPlan: template.sport === 'strength' ? template.strengthPlan : undefined,
        templateRef: template._id,
        generatedBy: 'coach',
        createdBy: req.user._id
      });

      created.push(planned);

      const sessionDate = new Date(assign.date).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
      await createNotification({
        recipient: assign.athleteId,
        sender: req.user._id,
        type: 'session',
        action: 'session_created',
        title: 'Nouvelle séance planifiée',
        message: `${req.user.firstName} ${req.user.lastName} a planifié "${template.name}" pour le ${sessionDate}`,
        actionUrl: '/planning'
      });
    }

    template.usageCount = (template.usageCount || 0) + created.length;
    template.lastUsedAt = new Date();
    await template.save();

    res.status(201).json({ created: created.length, plannedRuns: created });
  } catch (error) {
    console.error('Error assigning template:', error);
    res.status(400).json({ error: error.message });
  }
};
