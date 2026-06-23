import express, { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../types';

const router = Router();

// Health check route
router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
import authRoutes from './auth.routes';
router.use('/auth', authRoutes);

// User routes (profile, change-password, profile-picture)
import userRoutes from './user.routes';
router.use('/users', authenticate, userRoutes);

// Therapist routes (public listing/search; authentication required at user discretion)
import therapistRoutes from './therapist.routes';
router.use('/therapists', therapistRoutes);

// Admin routes
import adminRoutes from './admin.routes';
router.use('/admin', authenticate, authorize([UserRole.ADMIN]), adminRoutes);

// Therapy session routes
import sessionRoutes from './session.routes';
router.use('/sessions', authenticate, sessionRoutes);

// Legacy message routes (kept for backward compatibility)
import messageRoutes from './message.routes';
router.use('/messages', authenticate, messageRoutes);

// Appointment routes
import appointmentRoutes from './appointment.routes';
router.use('/appointments', authenticate, appointmentRoutes);

// Notification routes
import notificationRoutes from './notification.routes';
router.use('/notifications', authenticate, notificationRoutes);

// Assessment routes
import assessmentRoutes from './assessment.routes';
router.use('/assessments', authenticate, assessmentRoutes);

// Chat / messaging routes
import chatRoutes from './chat.routes';
router.use('/chat', authenticate, chatRoutes);

// AI endpoints (Groq) — frontend should call backend at /api/v1/ai/chat
import aiRoutes from './ai.routes';
router.use('/ai', aiRoutes);

// Mood tracking routes
import moodRoutes from './mood.routes';
router.use('/mood', authenticate, moodRoutes);

// Resources routes (authentication is conditional inside the router)
import resourceRoutes from './resource.routes';
router.use('/resources', resourceRoutes);

// Export the router
const registerRoutes = (app: express.Application) => {
  console.log('Registering routes at /api/v1...');
  // Mount legacy root `/auth` for clients that use that path (keeps compatibility)
  app.use('/auth', authRoutes);

  app.use('/api/v1', router);
  console.log('Routes registered successfully');
};

export { registerRoutes };

export default router;
