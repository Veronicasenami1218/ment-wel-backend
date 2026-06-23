import { Router } from 'express';
import { handleChat } from '../controllers/ai.controller';

const router = Router();

// Temporarily expose AI endpoint without authentication for debugging
router.post('/chat', handleChat);

export default router;
