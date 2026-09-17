const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, authorize } = require('../middleware/auth');

// Both ADMIN and SALES_USER can view inventory availability
router.get('/', authenticate, inventoryController.getInventory);
router.get('/:productId', authenticate, inventoryController.getProductInventory);

// Only ADMIN can adjust physical stock
router.patch('/:productId/stock', authenticate, authorize('ADMIN'), inventoryController.updateStock);

module.exports = router;
