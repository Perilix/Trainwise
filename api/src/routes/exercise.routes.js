const express = require('express');
const router = express.Router();
const exerciseController = require('../controllers/exercise.controller');
const { protect, coachOnly } = require('../middleware/auth.middleware');
const { uploadExerciseImage } = require('../config/cloudinary');

// Routes publiques (authentification requise)
router.use(protect);

/**
 * @swagger
 * /api/exercises:
 *   get:
 *     summary: Get all exercises (filterable)
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: muscleGroup
 *         schema:
 *           type: string
 *         description: Filter by muscle group
 *       - in: query
 *         name: equipment
 *         schema:
 *           type: string
 *         description: Filter by equipment type
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search by name
 *     responses:
 *       200:
 *         description: List of exercises
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 *   post:
 *     summary: Create a new exercise (coach/admin only)
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, muscleGroups]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               muscleGroups:
 *                 type: array
 *                 items:
 *                   type: string
 *               equipment:
 *                 type: string
 *               videoUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Exercise created
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Coach or admin role required
 *       500:
 *         description: Server error
 */
router.get('/', exerciseController.getExercises);
router.post('/', coachOnly, exerciseController.createExercise);

/**
 * @swagger
 * /api/exercises/muscle-groups:
 *   get:
 *     summary: Get all available muscle groups
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of muscle group names
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/muscle-groups', exerciseController.getMuscleGroups);

/**
 * @swagger
 * /api/exercises/equipment:
 *   get:
 *     summary: Get all available equipment types
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of equipment types
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.get('/equipment', exerciseController.getEquipment);

/**
 * @swagger
 * /api/exercises/upload-image:
 *   post:
 *     summary: Upload an exercise image (coach/admin only)
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [image]
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded, returns URL
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Coach or admin role required
 *       500:
 *         description: Server error
 */
router.post('/upload-image', coachOnly, uploadExerciseImage.single('image'), exerciseController.uploadExerciseImage);

/**
 * @swagger
 * /api/exercises/{id}:
 *   get:
 *     summary: Get an exercise by ID
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exercise data
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *   put:
 *     summary: Update an exercise (coach/admin only)
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               muscleGroups:
 *                 type: array
 *                 items:
 *                   type: string
 *               equipment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Exercise updated
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Coach or admin role required
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Delete an exercise (coach/admin only)
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Exercise deleted
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Coach or admin role required
 *       404:
 *         description: Not found
 *       500:
 *         description: Server error
 */
router.get('/:id', exerciseController.getExercise);
router.put('/:id', coachOnly, exerciseController.updateExercise);
router.delete('/:id', coachOnly, exerciseController.deleteExercise);

module.exports = router;
