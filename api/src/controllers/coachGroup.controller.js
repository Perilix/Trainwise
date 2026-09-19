const CoachAthlete = require('../models/coachAthlete.model');
const CoachGroup = require('../models/coachGroup.model');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const { createNotification } = require('./notification.controller');
const { groupRoom } = require('../services/coachPlan.service');

// Ce que l'app affiche d'un membre : de quoi dessiner une pastille et un nom.
const ATHLETE_FIELDS = 'firstName lastName email profilePicture';

/** Les athlètes réellement suivis par ce coach : un groupe ne peut contenir qu'eux. */
const followedIds = async (coachId) => {
  const links = await CoachAthlete.find({ coach: coachId, status: 'accepted' }).select('athlete').lean();
  return new Set(links.map((link) => link.athlete.toString()));
};

/** Garde les identifiants envoyés qui correspondent à des athlètes suivis, sans doublon. */
const keepFollowed = (raw, allowed) => {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : [])
    .map(String)
    .filter((id) => allowed.has(id) && !seen.has(id) && seen.add(id));
};

const COLORS = ['rouge', 'bleu', 'vert', 'jaune', 'orange', 'violet', 'rose'];

// L'ancienne palette, rendue dans la nouvelle : un groupe déjà créé garde un
// repère proche de celui que le coach avait choisi.
const LEGACY = { indigo: 'violet', turquoise: 'vert', sable: 'jaune', ardoise: 'bleu' };

const keepColor = (raw) => (COLORS.includes(raw) ? raw : LEGACY[raw] || 'bleu');

/**
 * Aligne la conversation du groupe sur ses membres.
 *
 * Un athlète ajouté au groupe rejoint la discussion, un athlète retiré en
 * sort, et le renommage du groupe la suit. Sans cet appel à chaque
 * modification, un athlète ajouté après coup ne verrait jamais la discussion.
 */
const syncConversation = async (group, coach, allowed) => {
  if (!group.conversation) return null;
  const conversation = await Conversation.findById(group.conversation);
  if (!conversation) return null;

  const before = new Set(conversation.participants.map(String));
  const participants = [String(coach._id), ...(group.athletes || []).map(String).filter((id) => allowed.has(id))];

  const arrived = participants.filter((id) => !before.has(id) && id !== String(coach._id));
  const left = [...before].filter((id) => !participants.includes(id) && id !== String(coach._id));

  conversation.participants = participants;
  conversation.name = group.name;
  // Un ancien membre ne doit plus traîner de compteur de non-lus.
  for (const id of conversation.unreadCounts.keys()) {
    if (!participants.includes(id)) conversation.unreadCounts.delete(id);
  }

  // Le fil raconte qui entre et qui sort : sans ça, un message d'un inconnu
  // tombe du ciel.
  if (arrived.length || left.length) {
    const names = await User.find({ _id: { $in: [...arrived, ...left] } }).select('firstName lastName').lean();
    const nameOf = (id) => {
      const user = names.find((item) => String(item._id) === id);
      return user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Un athlète';
    };
    for (const id of arrived) await postSystemMessage(conversation, coach._id, `${nameOf(id)} a rejoint la discussion.`);
    for (const id of left) await postSystemMessage(conversation, coach._id, `${nameOf(id)} a quitté la discussion.`);
  }

  await conversation.save();

  // Les nouveaux venus n'ont pas demandé cette discussion : on les prévient.
  await Promise.all(arrived.map((athleteId) => notifyGroupChat(athleteId, coach, group.name, conversation._id)));

  return conversation;
};

/**
 * Pose une ligne dans le fil : « Untel a rejoint la discussion ».
 *
 * C'est un message de type `system` : il appartient à la conversation, pas à
 * une personne, et s'affiche au centre sans bulle. Il ne compte pas comme non
 * lu — personne n'a à y répondre.
 */
const postSystemMessage = async (conversation, coachId, content) => {
  await Message.create({ conversation: conversation._id, sender: coachId, content, type: 'system' });
  conversation.lastMessage = { content, sender: coachId, sentAt: new Date(), type: 'system' };
};

/** Prévient un athlète qu'il vient d'entrer dans la discussion d'un groupe. */
const notifyGroupChat = (athleteId, coach, groupName, conversationId) =>
  createNotification({
    recipient: athleteId,
    sender: coach._id,
    type: 'message',
    action: 'group_conversation_created',
    title: `Discussion « ${groupName} »`,
    message: `${coach.firstName} vous a ajouté à la discussion du groupe ${groupName}.`,
    actionUrl: `/chat/${conversationId}`
  });

const shape = (group) => ({
  id: group._id,
  name: group.name,
  color: keepColor(group.color),
  race: group.race?.name ? { name: group.race.name, date: group.race.date } : null,
  athletes: (group.athletes || []).map((athlete) => ({
    id: athlete._id,
    firstName: athlete.firstName,
    lastName: athlete.lastName
  }))
});

// GET /api/coach/groups
exports.listGroups = async (req, res) => {
  try {
    const groups = await CoachGroup.find({ coach: req.user._id })
      .populate('athletes', ATHLETE_FIELDS)
      .sort({ name: 1 })
      .lean();

    // Un athlète qui n'est plus suivi ne doit plus peser dans le compte.
    const allowed = await followedIds(req.user._id);
    res.json(
      groups.map((group) => shape({ ...group, athletes: (group.athletes || []).filter((a) => allowed.has(a._id.toString())) }))
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/coach/groups
exports.createGroup = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Le nom du groupe est requis.' });

    // Les groupes font partie des plans payants : la limite se vérifie ici.
    const room = await groupRoom(req.user._id);
    if (!room.ok) {
      return res.status(402).json({
        error: room.limit === 0
          ? 'Les groupes font partie du plan Coach.'
          : `Le plan ${room.plan.name} permet ${room.limit} groupes.`,
        plan: room.limit === 0 ? 'coach' : 'studio'
      });
    }

    const allowed = await followedIds(req.user._id);
    const group = await CoachGroup.create({
      coach: req.user._id,
      name,
      color: keepColor(req.body.color),
      race: { name: req.body.raceName?.trim() || null, date: req.body.raceDate || null },
      athletes: keepFollowed(req.body.athletes, allowed)
    });

    await group.populate('athletes', ATHLETE_FIELDS);
    res.status(201).json(shape(group.toObject()));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Vous avez déjà un groupe de ce nom.' });
    res.status(400).json({ error: error.message });
  }
};

// PATCH /api/coach/groups/:id
exports.updateGroup = async (req, res) => {
  try {
    const group = await CoachGroup.findOne({ _id: req.params.id, coach: req.user._id });
    if (!group) return res.status(404).json({ error: 'Groupe non trouvé' });

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) return res.status(400).json({ error: 'Le nom du groupe est requis.' });
      group.name = name;
    }
    if (req.body.color !== undefined) group.color = keepColor(req.body.color);
    if (req.body.athletes !== undefined) {
      group.athletes = keepFollowed(req.body.athletes, await followedIds(req.user._id));
    }
    if (req.body.raceName !== undefined || req.body.raceDate !== undefined) {
      group.race = { name: req.body.raceName?.trim() || null, date: req.body.raceDate || null };
    }

    await group.save();
    // La discussion du groupe suit ses membres, sans attendre qu'on la rouvre.
    await syncConversation(group, req.user, await followedIds(req.user._id));
    await group.populate('athletes', ATHLETE_FIELDS);
    res.json(shape(group.toObject()));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Vous avez déjà un groupe de ce nom.' });
    res.status(400).json({ error: error.message });
  }
};

/**
 * POST /api/coach/groups/:id/conversation
 *
 * La discussion du groupe : une vraie conversation à plusieurs, pas N messages
 * individuels. Elle se crée à la première demande, puis se met à jour — un
 * athlète ajouté au groupe rejoint la conversation, un athlète retiré en sort,
 * et le renommage du groupe la suit.
 */
exports.openConversation = async (req, res) => {
  try {
    const group = await CoachGroup.findOne({ _id: req.params.id, coach: req.user._id });
    if (!group) return res.status(404).json({ error: 'Groupe non trouvé' });

    const allowed = await followedIds(req.user._id);
    const members = (group.athletes || []).map(String).filter((id) => allowed.has(id));
    if (!members.length) {
      return res.status(400).json({ error: 'Ce groupe n\'a aucun athlète avec qui discuter.' });
    }

    const participants = [req.user._id.toString(), ...members];
    let conversation = group.conversation ? await Conversation.findById(group.conversation) : null;

    if (!conversation) {
      conversation = await Conversation.create({ type: 'group', name: group.name, participants });
      group.conversation = conversation._id;
      await group.save();

      await Promise.all(members.map((athleteId) => notifyGroupChat(athleteId, req.user, group.name, conversation._id)));
    } else {
      conversation = await syncConversation(group, req.user, allowed);
    }

    res.json({ conversationId: conversation._id, name: conversation.name, participants: participants.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/coach/groups/:id — le groupe disparaît, les athlètes restent suivis.
exports.deleteGroup = async (req, res) => {
  try {
    const group = await CoachGroup.findOneAndDelete({ _id: req.params.id, coach: req.user._id });
    if (!group) return res.status(404).json({ error: 'Groupe non trouvé' });
    res.json({ message: 'Groupe supprimé' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
