import { Router } from 'express';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validate.middleware';
import { uploadProfilePicture } from '../middleware/upload.middleware';
import * as userController from '../controllers/user.controller';

const router = Router();

// GET /users/me — return fresh server-side profile of the authenticated user
router.get('/me', userController.getCurrentUser);

// PUT /users/profile
router.put(
  '/profile',
  [
    body('firstName').optional().isString().notEmpty(),
    body('lastName').optional().isString().notEmpty(),
    body('phoneNumber').optional().isString(),
    body('country').optional().isString(),
  ],
  validateRequest,
  userController.updateProfile
);

// POST /users/change-password
router.post(
  '/change-password',
  [
    body('currentPassword').isString().notEmpty().withMessage('currentPassword is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number'),
  ],
  validateRequest,
  userController.changePassword
);

// POST /users/profile-picture
router.post(
  '/profile-picture',
  uploadProfilePicture.single('profilePicture'),
  userController.uploadProfilePicture
);

export default router;
