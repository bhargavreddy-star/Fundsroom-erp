const db = require('../config/db');
const { calculateQuotationTotals } = require('../utils/calculator');

/**
 * Generate unique Quotation Number: QUO-YYYYMMDD-XXXX
 */
const generateQuotationNumber = async (client) => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `QUO-${dateStr}`;

  const result = await client.query(
    `SELECT quotation_number FROM quotations WHERE quotation_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}-%`]
  );

  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNum = result.rows[0].quotation_number;
    const parts = lastNum.split('-');
    if (parts.length === 3) {
      sequence = parseInt(parts[2], 10) + 1;
    }
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

/**
 * Generate unique Sales Order Number: SO-YYYYMMDD-XXXX
 */
const generateOrderNumber = async (client) => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `SO-${dateStr}`;

  const result = await client.query(
    `SELECT order_number FROM sales_orders WHERE order_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}-%`]
  );

  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNum = result.rows[0].order_number;
    const parts = lastNum.split('-');
    if (parts.length === 3) {
      sequence = parseInt(parts[2], 10) + 1;
    }
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

/**
 * Create a new Quotation against an Enquiry
 * Recalculates all totals server-side safely.
 */
const createQuotation = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { enquiry_id, valid_until, notes, items } = req.body;

    await client.query('BEGIN');

    // 1. Verify enquiry exists
    const enqCheck = await client.query(
      'SELECT id, customer_id, status FROM enquiries WHERE id = $1',
      [enquiry_id]
    );

    if (enqCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Enquiry with ID ${enquiry_id} not found.`,
        errorCode: 'ENQUIRY_NOT_FOUND',
      });
    }

    const customerId = enqCheck.rows[0].customer_id;

    // 2. Recalculate totals on backend using safe arithmetic
    let totals;
    try {
      totals = calculateQuotationTotals(items);
    } catch (calcErr) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: calcErr.message,
        errorCode: 'CALCULATION_ERROR',
      });
    }

    // 3. Generate unique quotation number
    const quotationNumber = await generateQuotationNumber(client);

    // 4. Insert quotation header
    const quoResult = await client.query(`
      INSERT INTO quotations (
        quotation_number, enquiry_id, customer_id, valid_until, status,
        subtotal_amount, discount_total, taxable_total, gst_total, grand_total,
        notes, created_by
      )
      VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      quotationNumber,
      enquiry_id,
      customerId,
      valid_until,
      totals.subtotal_amount,
      totals.discount_total,
      totals.taxable_total,
      totals.gst_total,
      totals.grand_total,
      notes || null,
      req.user ? req.user.id : null,
    ]);

    const quotation = quoResult.rows[0];

    // 5. Insert quotation line items
    const insertedItems = [];
    for (const item of totals.items) {
      const itemResult = await client.query(`
        INSERT INTO quotation_items (
          quotation_id, product_id, quantity, unit_price,
          discount_percent, gst_percent, base_amount, discount_amount,
          taxable_amount, gst_amount, line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        quotation.id,
        item.product_id,
        item.quantity,
        item.unit_price,
        item.discount_percent,
        item.gst_percent,
        item.base_amount,
        item.discount_amount,
        item.taxable_amount,
        item.gst_amount,
        item.line_total,
      ]);
      insertedItems.push(itemResult.rows[0]);
    }

    // 6. Update enquiry status to QUOTED if currently NEW
    if (enqCheck.rows[0].status === 'NEW') {
      await client.query(`
        UPDATE enquiries SET status = 'QUOTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `, [enquiry_id]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: {
        ...quotation,
        items: insertedItems,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Get all quotations with customer & enquiry references
 */
const getQuotations = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let queryText = `
      SELECT 
        q.*,
        c.company_name,
        c.contact_person,
        c.email,
        e.enquiry_number,
        u.full_name AS created_by_name,
        so.id AS sales_order_id,
        so.order_number AS sales_order_number
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
      JOIN enquiries e ON q.enquiry_id = e.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN sales_orders so ON q.id = so.quotation_id
    `;

    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`q.status = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(q.quotation_number ILIKE $${params.length} OR c.company_name ILIKE $${params.length} OR e.enquiry_number ILIKE $${params.length})`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY q.id DESC';

    const result = await db.query(queryText, params);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single quotation details by ID with line items
 */
const getQuotationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const quoResult = await db.query(`
      SELECT 
        q.*,
        c.company_name,
        c.contact_person,
        c.mobile,
        c.email,
        c.city,
        e.enquiry_number,
        u.full_name AS created_by_name,
        so.id AS sales_order_id,
        so.order_number AS sales_order_number,
        so.status AS sales_order_status
      FROM quotations q
      JOIN customers c ON q.customer_id = c.id
      JOIN enquiries e ON q.enquiry_id = e.id
      LEFT JOIN users u ON q.created_by = u.id
      LEFT JOIN sales_orders so ON q.id = so.quotation_id
      WHERE q.id = $1
    `, [id]);

    if (quoResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Quotation with ID ${id} not found.`,
        errorCode: 'QUOTATION_NOT_FOUND',
      });
    }

    const itemsResult = await db.query(`
      SELECT 
        qi.*,
        p.product_code,
        p.product_name,
        p.category,
        p.unit
      FROM quotation_items qi
      JOIN products p ON qi.product_id = p.id
      WHERE qi.quotation_id = $1
      ORDER BY qi.id ASC
    `, [id]);

    return res.status(200).json({
      success: true,
      data: {
        ...quoResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Quotation Status (DRAFT, SENT, ACCEPTED, REJECTED)
 */
const updateQuotationStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await db.query(`
      UPDATE quotations
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Quotation with ID ${id} not found.`,
        errorCode: 'QUOTATION_NOT_FOUND',
      });
    }

    // If quotation is accepted, mark enquiry as WON
    if (status === 'ACCEPTED') {
      await db.query(`
        UPDATE enquiries SET status = 'WON', updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `, [result.rows[0].enquiry_id]);
    } else if (status === 'REJECTED') {
      await db.query(`
        UPDATE enquiries SET status = 'LOST', updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `, [result.rows[0].enquiry_id]);
    }

    return res.status(200).json({
      success: true,
      message: `Quotation status updated to '${status}'.`,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Convert an ACCEPTED Quotation to a Sales Order
 * Enforces business rules:
 * 1. Only ACCEPTED quotations can be converted.
 * 2. DRAFT or REJECTED quotations are rejected.
 * 3. One quotation cannot generate duplicate Sales Orders.
 */
const convertToSalesOrder = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 1. Fetch quotation with lock to prevent race condition on double conversion
    const quoResult = await client.query(`
      SELECT * FROM quotations WHERE id = $1 FOR UPDATE
    `, [id]);

    if (quoResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Quotation with ID ${id} not found.`,
        errorCode: 'QUOTATION_NOT_FOUND',
      });
    }

    const quotation = quoResult.rows[0];

    // Rule: Only ACCEPTED quotations can be converted
    if (quotation.status !== 'ACCEPTED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot convert quotation into Sales Order: Quotation status is '${quotation.status}'. Only 'ACCEPTED' quotations can be converted.`,
        errorCode: quotation.status === 'DRAFT'
          ? 'CANNOT_CONVERT_DRAFT_QUOTATION'
          : 'CANNOT_CONVERT_NON_ACCEPTED_QUOTATION',
      });
    }

    // Rule: The same quotation must not generate duplicate Sales Orders
    const existingOrderCheck = await client.query(`
      SELECT id, order_number FROM sales_orders WHERE quotation_id = $1
    `, [id]);

    if (existingOrderCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `A Sales Order (${existingOrderCheck.rows[0].order_number}) has already been generated from this quotation.`,
        errorCode: 'DUPLICATE_SALES_ORDER',
      });
    }

    // 2. Fetch quotation items
    const itemsResult = await client.query(`
      SELECT * FROM quotation_items WHERE quotation_id = $1 ORDER BY id ASC
    `, [id]);

    if (itemsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Quotation contains no line items to convert.',
        errorCode: 'EMPTY_QUOTATION',
      });
    }

    // 3. Generate unique Sales Order Number
    const orderNumber = await generateOrderNumber(client);

    // 4. Create Sales Order in PENDING status
    const soResult = await client.query(`
      INSERT INTO sales_orders (
        order_number, quotation_id, customer_id, total_amount, status, created_by
      )
      VALUES ($1, $2, $3, $4, 'PENDING', $5)
      RETURNING *
    `, [
      orderNumber,
      quotation.id,
      quotation.customer_id,
      quotation.grand_total,
      req.user ? req.user.id : null,
    ]);

    const salesOrder = soResult.rows[0];

    // 5. Copy quotation items to sales_order_items preserving exact agreed prices
    const insertedOrderItems = [];
    for (const qItem of itemsResult.rows) {
      const orderItemResult = await client.query(`
        INSERT INTO sales_order_items (
          sales_order_id, product_id, quantity, unit_price, line_total
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        salesOrder.id,
        qItem.product_id,
        qItem.quantity,
        qItem.unit_price,
        qItem.line_total,
      ]);
      insertedOrderItems.push(orderItemResult.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Quotation successfully converted to Sales Order',
      data: {
        ...salesOrder,
        items: insertedOrderItems,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  createQuotation,
  getQuotations,
  getQuotationById,
  updateQuotationStatus,
  convertToSalesOrder,
};
