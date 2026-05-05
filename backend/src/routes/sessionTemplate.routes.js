const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sessionTemplate.controller');
const { protect, coachOnly } = require('../middleware/auth.middleware');

router.use(protect, coachOnly);

/**
 * @swagger
 * /api/coach/session-templates/zones:
 *   get:
 *     summary: List the available pace zones (Cazorla-style)
 *     tags: [SessionTemplates]
 */
router.get('/zones', ctrl.getPaceZones);

/**
 * @swagger
 * /api/coach/session-templates:
 *   get:
 *     summary: List session templates available to the coach
 *     tags: [SessionTemplates]
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema: { type: string, enum: [running, strength] }
 *       - in: query
 *         name: scope
 *         schema: { type: string, enum: [mine, public, all] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *   post:
 *     summary: Create a new session template
 *     tags: [SessionTemplates]
 */
router.get('/', ctrl.listTemplates);
router.post('/', ctrl.createTemplate);

/**
 * @swagger
 * /api/coach/session-templates/{id}:
 *   get:
 *     summary: Get a session template by ID
 *     tags: [SessionTemplates]
 *   patch:
 *     summary: Update a session template
 *     tags: [SessionTemplates]
 *   delete:
 *     summary: Delete a session template
 *     tags: [SessionTemplates]
 */
router.get('/:id', ctrl.getTemplate);
router.patch('/:id', ctrl.updateTemplate);
router.delete('/:id', ctrl.deleteTemplate);

/**
 * @swagger
 * /api/coach/session-templates/{id}/preview:
 *   post:
 *     summary: Preview pace resolution for a list of athletes
 *     tags: [SessionTemplates]
 */
router.post('/:id/preview', ctrl.previewAssignment);

/**
 * @swagger
 * /api/coach/session-templates/{id}/assign:
 *   post:
 *     summary: Assign a template to one or more athletes (creates PlannedRuns)
 *     tags: [SessionTemplates]
 */
router.post('/:id/assign', ctrl.assignTemplate);

/**
 * @swagger
 * /api/coach/session-templates/from-planning/{plannedRunId}:
 *   post:
 *     summary: Create a session template from an existing PlannedRun
 *     tags: [SessionTemplates]
 */
router.post('/from-planning/:plannedRunId', ctrl.createTemplateFromPlanning);

module.exports = router;
