/**
 * File purpose: Maps Stock HTTP endpoints to controller handlers and access-control middleware.
 */
import { Router } from 'express';
import { chart, earnings, news, priceTargets, search, suggestions } from '../controllers/stockController.js';

const router = Router();

router.get('/suggest', suggestions);
router.get('/search/:ticker', search);
router.get('/:ticker/chart', chart);
router.get('/:ticker/news', news);
router.get('/:ticker/earnings', earnings);
router.get('/:ticker/price-targets', priceTargets);

export default router;
