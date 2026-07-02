/**
 * File purpose: Maps Market HTTP endpoints to controller handlers and access-control middleware.
 */
import { Router } from 'express';
import { active, earnings, news, status, summary } from '../controllers/marketController.js';

const router = Router();

router.get('/status', status);
router.get('/summary', summary);
router.get('/active', active);
router.get('/news', news);
router.get('/earnings', earnings);

export default router;
