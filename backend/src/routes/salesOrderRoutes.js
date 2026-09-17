const express = require('express');
const router = express.Router();
const salesOrderController = require('../controllers/salesOrderController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { dispatchOrderSchema } = require('../validators/erpValidators');

// Both roles can view Sales Orders
router.get('/', authenticate, salesOrderController.getSalesOrders);
router.get('/:id', authenticate, salesOrderController.getSalesOrderById);

// ONLY ADMIN can confirm Sales Orders and reserve inventory
router.post(
  '/:id/confirm',
  authenticate,
  authorize('ADMIN'),
  salesOrderController.confirmSalesOrder
);

// ONLY ADMIN can process dispatch
router.post(
  '/:id/dispatch',
  authenticate,
  authorize('ADMIN'),
  validate(dispatchOrderSchema),
  salesOrderController.dispatchSalesOrder
);

module.exports = router;
