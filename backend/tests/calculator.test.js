const { calculateLineItem, calculateQuotationTotals, round2 } = require('../src/utils/calculator');

describe('TEST 1: Quotation Total Calculation Engine', () => {
  test('accurately calculates line item with base, discount, and GST', () => {
    // Product: 10 units @ 450.00 each, 5% discount, 18% GST
    // Base Amount = 10 * 450 = 4500.00
    // Discount = 4500 * 0.05 = 225.00
    // Taxable = 4500 - 225 = 4275.00
    // GST = 4275 * 0.18 = 769.50
    // Line Total = 4275 + 769.50 = 5044.50
    const item = {
      quantity: 10,
      unit_price: 450.00,
      discount_percent: 5,
      gst_percent: 18,
    };

    const result = calculateLineItem(item);

    expect(result.base_amount).toBe(4500.00);
    expect(result.discount_amount).toBe(225.00);
    expect(result.taxable_amount).toBe(4275.00);
    expect(result.gst_amount).toBe(769.50);
    expect(result.line_total).toBe(5044.50);
  });

  test('accurately calculates multi-item quotation grand totals', () => {
    const items = [
      { product_id: 1, quantity: 10, unit_price: 450.00, discount_percent: 5, gst_percent: 18 },
      { product_id: 2, quantity: 2, unit_price: 8500.00, discount_percent: 5, gst_percent: 18 },
    ];

    // Item 1: Line total = 5044.50
    // Item 2:
    // Base = 2 * 8500 = 17000.00
    // Discount = 17000 * 0.05 = 850.00
    // Taxable = 17000 - 850 = 16150.00
    // GST = 16150 * 0.18 = 2907.00
    // Line Total = 16150 + 2907 = 19057.00
    // Grand Total = 5044.50 + 19057.00 = 24101.50

    const totals = calculateQuotationTotals(items);

    expect(totals.subtotal_amount).toBe(21500.00); // 4500 + 17000
    expect(totals.discount_total).toBe(1075.00);   // 225 + 850
    expect(totals.taxable_total).toBe(20425.00);   // 4275 + 16150
    expect(totals.gst_total).toBe(3676.50);        // 769.50 + 2907
    expect(totals.grand_total).toBe(24101.50);     // 5044.50 + 19057.00
  });

  test('rejects negative unit price or zero quantity', () => {
    expect(() => calculateLineItem({ quantity: 0, unit_price: 100 })).toThrow(
      'Quantity must be greater than zero.'
    );
    expect(() => calculateLineItem({ quantity: 5, unit_price: -50 })).toThrow(
      'Unit price cannot be negative.'
    );
  });

  test('rejects invalid discount or GST percentages outside 0-100', () => {
    expect(() => calculateLineItem({ quantity: 1, unit_price: 100, discount_percent: 110 })).toThrow(
      'Discount percentage must be between 0 and 100.'
    );
    expect(() => calculateLineItem({ quantity: 1, unit_price: 100, gst_percent: -5 })).toThrow(
      'GST percentage must be between 0 and 100.'
    );
  });
});
