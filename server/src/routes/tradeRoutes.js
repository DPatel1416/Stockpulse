/**
 * File purpose: Maps Trade HTTP endpoints to controller handlers and access-control middleware.
 */
import { Router } from 'express';
import { cancelTradeOrder, createTrade, listTrades, updateTradeOrder } from '../controllers/tradeController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);
router.get('/', listTrades);
router.post('/', createTrade);
router.patch('/:orderId', updateTradeOrder);
router.delete('/:orderId', cancelTradeOrder);

export default router;
