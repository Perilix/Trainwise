const User = require('../models/user.model');
const CoachAthlete = require('../models/coachAthlete.model');
const { createNotification } = require('./notification.controller');

// Obtenir les invitations en attente pour l'athlète
exports.getPendingInvitations = async (req, res) => {
  try {
    const invitations = await CoachAthlete.find({
      athlete: req.user._id,
      status: 'pending'
    }).populate('coach', 'firstName lastName email profilePicture');

    res.json(invitations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Accepter une invitation
exports.acceptInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    // Vérifier que l'athlète n'a pas déjà un coach
    const existingCoach = await CoachAthlete.findOne({
      athlete: req.user._id,
      status: 'accepted'
    });

    if (existingCoach) {
      return res.status(400).json({ error: 'Vous avez déjà un coach. Quittez-le d\'abord pour en accepter un nouveau.' });
    }

    const invitation = await CoachAthlete.findOneAndUpdate(
      {
        _id: invitationId,
        athlete: req.user._id,
        status: 'pending'
      },
      {
        status: 'accepted',
        respondedAt: new Date()
      },
      { new: true }
    ).populate('coach', 'firstName lastName email profilePicture');

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation non trouvée ou déjà traitée' });
    }

    // Rejeter automatiquement les autres invitations en attente
    await CoachAthlete.updateMany(
      {
        athlete: req.user._id,
        status: 'pending',
        _id: { $ne: invitationId }
      },
      {
        status: 'rejected',
        respondedAt: new Date()
      }
    );

    // Notifier le coach
    await createNotification({
      recipient: invitation.coach._id,
      sender: req.user._id,
      type: 'invitation_response',
      action: 'invitation_accepted',
      title: 'Invitation acceptée',
      message: `${req.user.firstName} ${req.user.lastName} a accepté votre invitation`,
      actionUrl: '/coach'
    });

    res.json(invitation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Refuser une invitation
exports.rejectInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;

    const invitation = await CoachAthlete.findOneAndUpdate(
      {
        _id: invitationId,
        athlete: req.user._id,
        status: 'pending'
      },
      {
        status: 'rejected',
        respondedAt: new Date()
      },
      { new: true }
    ).populate('coach', '_id');

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation non trouvée ou déjà traitée' });
    }

    // Notifier le coach
    await createNotification({
      recipient: invitation.coach._id,
      sender: req.user._id,
      type: 'invitation_response',
      action: 'invitation_rejected',
      title: 'Invitation refusée',
      message: `${req.user.firstName} ${req.user.lastName} a refusé votre invitation`,
      actionUrl: '/coach'
    });

    res.json({ message: 'Invitation refusée' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Rejoindre un coach via code d'invitation
exports.joinViaCode = async (req, res) => {
  try {
    const { code } = req.params;

    // Vérifier que l'utilisateur n'est pas un coach
    if (req.user.role === 'coach') {
      return res.status(400).json({ error: 'Un coach ne peut pas rejoindre un autre coach' });
    }

    // Vérifier que l'athlète n'a pas déjà un coach
    const existingCoach = await CoachAthlete.findOne({
      athlete: req.user._id,
      status: 'accepted'
    });

    if (existingCoach) {
      return res.status(400).json({ error: 'Vous avez déjà un coach. Quittez-le d\'abord pour en rejoindre un nouveau.' });
    }

    // Trouver le coach avec ce code
    const coach = await User.findOne({
      coachInviteCode: code.toUpperCase(),
      role: 'coach'
    });

    if (!coach) {
      return res.status(404).json({ error: 'Code d\'invitation invalide' });
    }

    // Vérifier s'il y a déjà une relation
    const existingRelation = await CoachAthlete.findOne({
      coach: coach._id,
      athlete: req.user._id
    });

    if (existingRelation) {
      if (existingRelation.status === 'accepted') {
        return res.status(400).json({ error: 'Vous êtes déjà avec ce coach' });
      }
      if (existingRelation.status === 'pending') {
        return res.status(400).json({ error: 'Une invitation est déjà en attente avec ce coach' });
      }
      // Si rejected, on peut recréer
      await CoachAthlete.deleteOne({ _id: existingRelation._id });
    }

    // Créer la relation directement acceptée (car c'est l'athlète qui rejoint)
    const relationship = await CoachAthlete.create({
      coach: coach._id,
      athlete: req.user._id,
      status: 'accepted',
      respondedAt: new Date(),
      inviteMethod: 'code'
    });

    // Rejeter automatiquement les autres invitations en attente
    await CoachAthlete.updateMany(
      {
        athlete: req.user._id,
        status: 'pending'
      },
      {
        status: 'rejected',
        respondedAt: new Date()
      }
    );

    const populatedRelationship = await CoachAthlete.findById(relationship._id)
      .populate('coach', 'firstName lastName email profilePicture');

    res.status(201).json({
      message: `Vous avez rejoint le coach ${coach.firstName} ${coach.lastName}`,
      relationship: populatedRelationship
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Obtenir le coach actuel
exports.getCurrentCoach = async (req, res) => {
  try {
    const relationship = await CoachAthlete.findOne({
      athlete: req.user._id,
      status: 'accepted'
    }).populate('coach', 'firstName lastName email profilePicture');

    if (!relationship) {
      return res.json(null);
    }

    res.json({
      _id: relationship.coach._id,
      firstName: relationship.coach.firstName,
      lastName: relationship.coach.lastName,
      email: relationship.coach.email,
      profilePicture: relationship.coach.profilePicture,
      connectedSince: relationship.respondedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Quitter le coach actuel
exports.leaveCoach = async (req, res) => {
  try {
    const result = await CoachAthlete.findOneAndDelete({
      athlete: req.user._id,
      status: 'accepted'
    });

    if (!result) {
      return res.status(404).json({ error: 'Vous n\'avez pas de coach actuellement' });
    }

    res.json({ message: 'Vous avez quitté votre coach' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
