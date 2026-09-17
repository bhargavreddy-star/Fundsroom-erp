const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { createProductSchema } = require('../validators/erpValidators');

// Both ADMIN and SALES_USER can view products
router.get('/', authenticate, productController.getProducts);
router.get('/:id', authenticate, productController.getProductById);

// Only ADMIN can create products
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createProductSchema),
  productController.createProduct
);

module.exports = router;
