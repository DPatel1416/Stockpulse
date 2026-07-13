/**
 * File purpose: Maps Auth HTTP endpoints to controller handlers and access-control middleware.
 */
import { Router } from 'express';
import {
  changePassword,
  demoSession,
  login,
  logout,
  me,
  register,
  requestPasswordReset,
  resetPassword,
  resendVerification,
  updateProfile,
  validateEmail,
  verifyEmail,
} from '../controllers/authController.js';
import { requireAuth, requireCsrf } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', requireAuth, requireCsrf, logout);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.post('/validate-email', validateEmail);
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/demo', demoSession);
router.get('/me', requireAuth, me);
router.patch('/me', requireAuth, requireCsrf, updateProfile);
router.patch('/password', requireAuth, requireCsrf, changePassword);

export default router;

