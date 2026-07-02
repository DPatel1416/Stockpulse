/**
 * File purpose: Maps Portfolio HTTP endpoints to controller handlers and access-control middleware.
 */
import { Router } from 'express';
import { getPortfolio, getPortfolioPerformance } from '../controllers/portfolioController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', getPortfolio);
router.get('/performance', getPortfolioPerformance);

export default router;
