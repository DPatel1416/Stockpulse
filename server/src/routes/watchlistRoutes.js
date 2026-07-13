/**
 * File purpose: Maps Watchlist HTTP endpoints to controller handlers and access-control middleware.
 */
import { Router } from 'express';
import { addWatchlistItem, listWatchlist, removeWatchlistItem } from '../controllers/watchlistController.js';
import { requireAuth, requireCsrf } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireCsrf);
router.get('/', listWatchlist);
router.post('/', addWatchlistItem);
router.delete('/:ticker', removeWatchlistItem);

export default router;
