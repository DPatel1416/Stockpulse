/**
 * File purpose: Maps Auth HTTP endpoints to controller handlers and access-control middleware.
 */
import { Router } from 'express';
import { changePassword, demoSession, login, me, register, updateProfile } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/demo', demoSession);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, updateProfile);
router.patch('/password', requireAuth, changePassword);

export default router;
