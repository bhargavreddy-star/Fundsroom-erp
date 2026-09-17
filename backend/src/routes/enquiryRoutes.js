const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createEnquirySchema, updateEnquiryStatusSchema } = require('../validators/erpValidators');

// Both roles can view enquiries
router.get('/', authenticate, enquiryController.getEnquiries);
router.get('/:id', authenticate, enquiryController.getEnquiryById);

// Both ADMIN and SALES_USER can create enquiries
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'SALES_USER'),
  validate(createEnquirySchema),
  enquiryController.createEnquiry
);

// Update enquiry status
router.patch(
  '/:id/status',
  authenticate,
  authorize('ADMIN', 'SALES_USER'),
  validate(updateEnquiryStatusSchema),
  enquiryController.updateEnquiryStatus
);

module.exports = router;
