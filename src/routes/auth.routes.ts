import { Router } from 'express';
import { body, oneOf } from 'express-validator';
import { validateRequest } from '../middleware/validate.middleware';
import { UserRole, Gender, Country } from '../types';
import * as authController from '../controllers/auth.controller';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.middleware';
// import { verifyRecaptcha } from '../middleware/recaptcha.middleware'; // Temporarily disabled

const router = Router();

// Test route to verify auth routes are working
router.get('/test', (_req, res) => {
  res.json({ message: 'Auth routes are working!' });
});

// Simple POST test route
router.post('/test-post', (_req, res) => {
  res.json({ message: 'POST request working!', body: _req.body });
});

// Rate limit: 5 attempts/hour/IP for registration (production only).
// In dev/test the limit is too painful while iterating, so we bypass it.
const registerLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false })
    : ((_req: any, _res: any, next: any) => next());

// Login rate limiter - stricter for security
const loginLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({ 
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 attempts
        standardHeaders: true, 
        legacyHeaders: false,
        skipSuccessfulRequests: true, // Don't count successful logins
      })
    : ((_req: any, _res: any, next: any) => next());

// Email rate limiter for forgot password and resend verification
const emailLimiter =
  process.env.NODE_ENV === 'production'
    ? rateLimit({ 
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // 3 attempts per hour
        standardHeaders: true, 
        legacyHeaders: false 
      })
    : ((_req: any, _res: any, next: any) => next());

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user (email or phone)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - password
 *               - dateOfBirth
 *               - acceptTerms
 *             oneOf:
 *               - required: ['email']
 *               - required: ['phoneNumber']
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               phoneNumber:
 *                 type: string
 *                 pattern: '^\+234[789][01]\d{8}$'
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [male, female, other, prefer_not_to_say]
 *               country:
 *                 type: string
 *                 enum: [Nigeria, Ghana, Kenya, South Africa, Other]
 *               acceptTerms:
 *                 type: boolean
 *               role:
 *                 type: string
 *                 enum: [USER, THERAPIST]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email or phone already exists
 */
router.post(
  '/register',
  registerLimiter,
  [
    // Email validation (optional but must be valid if provided)
    body('email')
      .optional()
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    
    // Phone number validation (optional but must be valid Nigerian format if provided)
    body('phoneNumber')
      .optional()
      .matches(/^\+234[789][01]\d{8}$/)
      .withMessage('Valid Nigerian phone number is required (format: +234XXXXXXXXX, 11 digits total)'),
    
    // Custom validation to ensure at least one contact method is provided
    body().custom((value, { req }) => {
      if (!req.body.email && !req.body.phoneNumber) {
        throw new Error('Either email or phone number is required');
      }
      return true;
    }),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[^A-Za-z0-9]/)
      .withMessage('Password must contain at least one special character'),
    // Confirm password is optional in some clients; when provided it must match
    body('confirmPassword')
      .optional()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('dateOfBirth').isISO8601().toDate().withMessage('Valid date of birth is required'),
    // Gender is optional; if provided it must be one of the allowed values
    body('gender')
      .optional()
      .isIn(Object.values(Gender))
      .withMessage('Gender must be one of: male, female, other, prefer_not_to_say'),
    body('country')
      .optional()
      .isIn(Object.values(Country))
      .withMessage('Country must be one of: Nigeria, Ghana, Kenya, South Africa, Other'),
    body('acceptTerms')
      .custom((v) => v === true || v === 'true')
      .withMessage('You must accept the Terms of Service and Privacy Policy'),
    body('role')
      .optional()
      .isIn([UserRole.USER, UserRole.THERAPIST])
      .withMessage('Invalid user role'),
    body('recaptchaToken').optional().isString(),
  ],
  // verifyRecaptcha, // Temporarily disabled - causing 502 errors
  validateRequest,
  authController.register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account not verified or suspended
 */
router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  validateRequest,
  authController.login
);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Refresh access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New tokens generated
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post(
  '/refresh-token',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
      .isString()
      .withMessage('Refresh token must be a string'),
  ],
  validateRequest,
  authController.refreshToken
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user (invalidate refresh token)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Invalid refresh token
 */
router.post(
  '/logout',
  [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
      .isString()
      .withMessage('Refresh token must be a string'),
  ],
  validateRequest,
  authController.logout
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent (if email exists)
 *       429:
 *         description: Too many requests
 */
router.post(
  '/forgot-password',
  emailLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
  ],
  validateRequest,
  authController.forgotPassword
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[^A-Za-z0-9]/)
      .withMessage('Password must contain at least one special character'),
    body('confirmPassword')
      .optional()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],
  validateRequest,
  authController.resetPassword
);

/**
 * @swagger
 * /auth/verify-email/{token}:
 *   get:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get(
  '/verify-email/:token',
  authController.verifyEmail
);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: Resend verification email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Verification email sent
 *       429:
 *         description: Too many requests
 *       404:
 *         description: User not found
 */
router.post(
  '/resend-verification',
  emailLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
  ],
  validateRequest,
  authController.resendVerificationEmail
);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change password (authenticated)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Current password incorrect or not authenticated
 */
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[^A-Za-z0-9]/)
      .withMessage('Password must contain at least one special character'),
    body('confirmNewPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
  ],
  validateRequest,
  authController.changePassword
);

/**
 * @swagger
 * /auth/clerk-sync:
 *   post:
 *     summary: Sync Clerk user to MentWel (SSO)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clerkUserId
 *               - email
 *             properties:
 *               clerkUserId:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               profileImageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Clerk user synced successfully
 *       400:
 *         description: Validation error
 */
router.post(
  '/clerk-sync',
  [
    body('clerkUserId').isString().notEmpty().withMessage('clerkUserId is required'),
    body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('firstName').optional().isString(),
    body('lastName').optional().isString(),
    body('profileImageUrl').optional().isString().isURL().withMessage('Invalid profile image URL'),
  ],
  validateRequest,
  authController.clerkSync
);

export default router;