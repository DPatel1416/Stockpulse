/**
 * File purpose: Maps authenticated AI-insight HTTP requests to the educational insight controller.
 */
import { Router } from 'express';
import { insight } from '../controllers/aiController.js';
import { requireAuth, requireCsrf } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireCsrf);
router.post('/insight', insight);

export default router;
