import { Router } from 'express';
import { body, param } from 'express-validator';
import { validateRequest } from '../middleware/validate.middleware';
import * as sessionController from '../controllers/session.controller';

const router = Router();

// GET /sessions
router.get('/', sessionController.getUserSessions);

// GET /sessions/:id
router.get(
  '/:id',
  [param('id').isMongoId()],
  validateRequest,
  sessionController.getSessionById
);

// POST /sessions — accepts camelCase (preferred) or snake_case (legacy).
router.post(
  '/',
  [
    body().custom((value) => {
      const therapistId = value?.therapistId ?? value?.therapist_id;
      const scheduledAt = value?.scheduledAt ?? value?.scheduled_at;
      if (!therapistId) throw new Error('therapistId is required');
      if (!scheduledAt) throw new Error('scheduledAt is required');
      if (!/^[0-9a-fA-F]{24}$/.test(String(therapistId))) {
        throw new Error('therapistId must be a valid id');
      }
      if (Number.isNaN(Date.parse(String(scheduledAt)))) {
        throw new Error('scheduledAt must be a valid ISO date');
      }
      const sessionType = value?.sessionType ?? value?.session_type;
      if (sessionType && !['text', 'voice', 'video'].includes(sessionType)) {
        throw new Error('sessionType must be one of: text, voice, video');
      }
      if (value?.duration !== undefined) {
        const d = Number(value.duration);
        if (!Number.isFinite(d) || d < 5 || d > 600) {
          throw new Error('duration must be between 5 and 600 minutes');
        }
      }
      return true;
    }),
  ],
  validateRequest,
  sessionController.createSession
);

// PATCH /sessions/:id/cancel
router.patch(
  '/:id/cancel',
  [param('id').isMongoId()],
  validateRequest,
  sessionController.cancelSession
);

// PATCH /sessions/:id/complete
router.patch(
  '/:id/complete',
  [param('id').isMongoId(), body('notes').optional().isString()],
  validateRequest,
  sessionController.completeSession
);

export default router;
