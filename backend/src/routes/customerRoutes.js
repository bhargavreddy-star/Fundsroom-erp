const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createCustomerSchema } = require('../validators/erpValidators');

// Both ADMIN and SALES_USER can view customers
router.get('/', authenticate, customerController.getCustomers);
router.get('/:id', authenticate, customerController.getCustomerById);

// Both ADMIN and SALES_USER can create customers
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SALES_USER'),
  validate(createCustomerSchema),
  customerController.createCustomer
);

module.exports = router;
