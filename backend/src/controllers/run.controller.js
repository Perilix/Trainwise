const axios = require('axios');
const Run = require('../models/run.model');

// Créer une nouvelle course et demander l'analyse
exports.createRun = async (req, res) => {
  try {
    const run = new Run({
      ...req.body,
      user: req.user._id
    });
    await run.save();

    // Appeler n8n pour l'analyse si le webhook est configuré
    if (process.env.N8N_WEBHOOK_URL) {
      try {
        const response = await axios.post(process.env.N8N_WEBHOOK_URL, {
          runId: run._id,
          userId: req.user._id,
          userEmail: req.user.email,
          userName: `${req.user.firstName} ${req.user.lastName}`,
          ...req.body
        });

        // Mettre à jour avec l'analyse reçue
        if (response.data && response.data.analysis) {
          run.analysis = response.data.analysis;
          run.analyzedAt = new Date();
          await run.save();
        }
      } catch (webhookError) {
        console.error('N8N webhook error:', webhookError.message);
      }
    }

    res.status(201).json(run);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Récupérer toutes les courses de l'utilisateur connecté
exports.getAllRuns = async (req, res) => {
  try {
    const runs = await Run.find({ user: req.user._id }).sort({ date: -1 });
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Récupérer une course par ID (appartenant à l'utilisateur)
exports.getRunById = async (req, res) => {
  try {
    const run = await Run.findOne({ _id: req.params.id, user: req.user._id });
    if (!run) {
      return res.status(404).json({ error: 'Course non trouvée' });
    }
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mettre à jour l'analyse (appelé par n8n en callback)
exports.updateAnalysis = async (req, res) => {
  try {
    const run = await Run.findByIdAndUpdate(
      req.params.id,
      {
        analysis: req.body.analysis,
        analyzedAt: new Date()
      },
      { new: true }
    );

    if (!run) {
      return res.status(404).json({ error: 'Course non trouvée' });
    }

    res.json(run);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
