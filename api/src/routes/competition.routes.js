const express = require('express');
const router = express.Router();
const competitionController = require('../controllers/competition.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);

/**
 * @swagger
 * /api/competitions:
 *   get:
 *     summary: List the authenticated user's competitions
 *     tags: [Competitions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [upcoming, completed, cancelled]
 *     responses:
 *       200:
 *         description: List of competitions
 *   post:
 *     summary: Create a competition for the authenticated user
 *     tags: [Competitions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Competition created
 */
router.get('/', competitionController.getMyCompetitions);
router.post('/', competitionController.createCompetition);

/**
 * @swagger
 * /api/competitions/{id}:
 *   get:
 *     summary: Get a competition by id
 *     tags: [Competitions]
 *     security:
 *       - bearerAuth: []
 *   patch:
 *     summary: Update a competition
 *     tags: [Competitions]
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     summary: Delete a competition
 *     tags: [Competitions]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', competitionController.getCompetitionById);
router.patch('/:id', competitionController.updateCompetition);
router.delete('/:id', competitionController.deleteCompetition);

module.exports = router;
