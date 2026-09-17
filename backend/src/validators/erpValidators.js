const { z } = require('zod');

// Customer Schema
const createCustomerSchema = z.object({
  company_name: z.string().min(2, 'Company name is required').max(150),
  contact_person: z.string().min(2, 'Contact person name is required').max(100),
  mobile: z.string().min(8, 'Valid mobile number required').max(20),
  email: z.string().email('Valid email address required').max(100),
  city: z.string().min(2, 'City is required').max(100),
});

// Product Schema
const createProductSchema = z.object({
  product_code: z.string().min(2, 'Product code is required').max(50),
  product_name: z.string().min(2, 'Product name is required').max(150),
  category: z.string().min(2, 'Category is required').max(100),
  unit: z.string().default('PCS'),
  base_price: z.number().nonnegative('Base price cannot be negative'),
  initial_stock: z.number().int().nonnegative('Initial stock cannot be negative').optional().default(0),
});

// Enquiry Schema
const createEnquirySchema = z.object({
  customer_id: z.number().int().positive('Valid customer ID is required'),
  required_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Required date must be YYYY-MM-DD'),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.number().int().positive('Valid product ID is required'),
      quantity: z.number().int().positive('Quantity must be greater than zero'),
    })
  ).min(1, 'Enquiry must contain at least one product item'),
});

// Enquiry Status Update Schema
const updateEnquiryStatusSchema = z.object({
  status: z.enum(['NEW', 'QUOTED', 'WON', 'LOST']),
});

// Quotation Schema
const createQuotationSchema = z.object({
  enquiry_id: z.number().int().positive('Valid enquiry ID is required'),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid until date must be YYYY-MM-DD'),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      product_id: z.number().int().positive('Valid product ID is required'),
      quantity: z.number().int().positive('Quantity must be greater than zero'),
      unit_price: z.number().nonnegative('Unit price cannot be negative'),
      discount_percent: z.number().min(0).max(100).optional().default(0),
      gst_percent: z.number().min(0).max(100).optional().default(18),
    })
  ).min(1, 'Quotation must contain at least one item'),
});

// Quotation Status Update Schema
const updateQuotationStatusSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED']),
});

// Dispatch Schema
const dispatchOrderSchema = z.object({
  vehicle_number: z.string().min(3, 'Vehicle number is required').max(50),
  driver_name: z.string().min(2, 'Driver name is required').max(100),
  notes: z.string().optional(),
});

module.exports = {
  createCustomerSchema,
  createProductSchema,
  createEnquirySchema,
  updateEnquiryStatusSchema,
  createQuotationSchema,
  updateQuotationStatusSchema,
  dispatchOrderSchema,
};
