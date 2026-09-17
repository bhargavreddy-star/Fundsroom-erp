/**
 * Safe Financial Calculations Engine for ERP Quotations & Invoicing
 * Uses cents/minor units (multiplication by 100 and Math.round) to avoid IEEE-754 floating-point drift.
 */

/**
 * Rounds a number to exactly two decimal places safely.
 * @param {number} value
 * @returns {number}
 */
const round2 = (value) => {
  return Math.round((value + Number.EPSILON) * 100) / 100;
};

/**
 * Calculates all monetary breakdown values for a quotation line item.
 * 
 * Formula:
 * 1. Base Amount = Quantity * Unit Price
 * 2. Discount Amount = (Base Amount * Discount %) / 100
 * 3. Taxable Amount = Base Amount - Discount Amount
 * 4. GST Amount = (Taxable Amount * GST %) / 100
 * 5. Line Total = Taxable Amount + GST Amount
 * 
 * @param {Object} item
 * @param {number} item.quantity
 * @param {number} item.unit_price
 * @param {number} [item.discount_percent=0]
 * @param {number} [item.gst_percent=18]
 * @returns {Object}
 */
const calculateLineItem = (item) => {
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unit_price);
  const discountPercent = Number(item.discount_percent || 0);
  const gstPercent = Number(item.gst_percent !== undefined ? item.gst_percent : 18);

  if (quantity <= 0) {
    throw new Error('Quantity must be greater than zero.');
  }
  if (unitPrice < 0) {
    throw new Error('Unit price cannot be negative.');
  }
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount percentage must be between 0 and 100.');
  }
  if (gstPercent < 0 || gstPercent > 100) {
    throw new Error('GST percentage must be between 0 and 100.');
  }

  // 1. Base Amount
  const baseAmount = round2(quantity * unitPrice);

  // 2. Discount Amount
  const discountAmount = round2((baseAmount * discountPercent) / 100);

  // 3. Taxable Amount
  const taxableAmount = round2(baseAmount - discountAmount);

  // 4. GST Amount
  const gstAmount = round2((taxableAmount * gstPercent) / 100);

  // 5. Line Total
  const lineTotal = round2(taxableAmount + gstAmount);

  return {
    quantity,
    unit_price: round2(unitPrice),
    discount_percent: round2(discountPercent),
    gst_percent: round2(gstPercent),
    base_amount: baseAmount,
    discount_amount: discountAmount,
    taxable_amount: taxableAmount,
    gst_amount: gstAmount,
    line_total: lineTotal,
  };
};

/**
 * Calculates complete quotation totals across all line items.
 * @param {Array<Object>} items
 * @returns {Object}
 */
const calculateQuotationTotals = (items) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('At least one item is required in the quotation.');
  }

  let subtotalAmount = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let gstTotal = 0;
  let grandTotal = 0;

  const calculatedItems = items.map((rawItem) => {
    const calculated = calculateLineItem(rawItem);
    subtotalAmount += calculated.base_amount;
    discountTotal += calculated.discount_amount;
    taxableTotal += calculated.taxable_amount;
    gstTotal += calculated.gst_amount;
    grandTotal += calculated.line_total;

    return {
      product_id: rawItem.product_id,
      ...calculated,
    };
  });

  return {
    subtotal_amount: round2(subtotalAmount),
    discount_total: round2(discountTotal),
    taxable_total: round2(taxableTotal),
    gst_total: round2(gstTotal),
    grand_total: round2(grandTotal),
    items: calculatedItems,
  };
};

module.exports = {
  round2,
  calculateLineItem,
  calculateQuotationTotals,
};
