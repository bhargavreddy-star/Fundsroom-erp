const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotationController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createQuotationSchema, updateQuotationStatusSchema } = require('../validators/erpValidators');

// Both roles can view quotations
router.get('/', authenticate, quotationController.getQuotations);
router.get('/:id', authenticate, quotationController.getQuotationById);

// SALES_USER and ADMIN can create quotations against enquiries
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SALES_USER'),
  validate(createQuotationSchema),
  quotationController.createQuotation
);

// SALES_USER and ADMIN can accept/reject or change quotation status
router.patch(
  '/:id/status',
  authenticate,
  authorize('ADMIN', 'SALES_USER'),
  validate(updateQuotationStatusSchema),
  quotationController.updateQuotationStatus
);

// Convert accepted quotation to Sales Order (SALES_USER and ADMIN)
router.post(
  '/:id/convert',
  authenticate,
  authorize('ADMIN', 'SALES_USER'),
  quotationController.convertToSalesOrder
);

module.exports = router;
