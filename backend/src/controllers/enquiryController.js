const db = require('../config/db');

/**
 * Generate unique Enquiry Number: ENQ-YYYYMMDD-XXXX
 */
const generateEnquiryNumber = async (client) => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `ENQ-${dateStr}`;

  const result = await client.query(
    `SELECT enquiry_number FROM enquiries WHERE enquiry_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}-%`]
  );

  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNum = result.rows[0].enquiry_number;
    const parts = lastNum.split('-');
    if (parts.length === 3) {
      sequence = parseInt(parts[2], 10) + 1;
    }
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

/**
 * Create a new Customer Enquiry with multiple products
 */
const createEnquiry = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { customer_id, required_date, notes, items } = req.body;

    await client.query('BEGIN');

    // 1. Verify customer exists
    const custCheck = await client.query('SELECT id, company_name FROM customers WHERE id = $1', [customer_id]);
    if (custCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${customer_id} does not exist.`,
        errorCode: 'CUSTOMER_NOT_FOUND',
      });
    }

    // 2. Verify all products exist
    const productIds = items.map((i) => i.product_id);
    const prodCheck = await client.query(
      'SELECT id, product_name FROM products WHERE id = ANY($1)',
      [productIds]
    );

    if (prodCheck.rows.length !== productIds.length) {
      const foundIds = prodCheck.rows.map((p) => p.id);
      const missingIds = productIds.filter((id) => !foundIds.includes(id));
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `One or more products not found: [${missingIds.join(', ')}]`,
        errorCode: 'PRODUCT_NOT_FOUND',
      });
    }

    // 3. Generate unique enquiry number
    const enquiryNumber = await generateEnquiryNumber(client);

    // 4. Insert enquiry master
    const enqResult = await client.query(
      `INSERT INTO enquiries (enquiry_number, customer_id, required_date, notes, status, created_by)
       VALUES ($1, $2, $3, $4, 'NEW', $5)
       RETURNING *`,
      [enquiryNumber, customer_id, required_date, notes || null, req.user ? req.user.id : null]
    );

    const enquiry = enqResult.rows[0];

    // 5. Insert line items
    const insertedItems = [];
    for (const item of items) {
      const itemResult = await client.query(
        `INSERT INTO enquiry_items (enquiry_id, product_id, quantity)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [enquiry.id, item.product_id, item.quantity]
      );
      insertedItems.push(itemResult.rows[0]);
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Enquiry created successfully',
      data: {
        ...enquiry,
        customer: custCheck.rows[0],
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
 * Get all enquiries with customer and items summary
 */
const getEnquiries = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let queryText = `
      SELECT 
        e.*,
        c.company_name,
        c.contact_person,
        c.email,
        c.city,
        u.full_name AS created_by_name,
        COUNT(ei.id) AS total_items,
        COALESCE(SUM(ei.quantity), 0) AS total_quantity
      FROM enquiries e
      JOIN customers c ON e.customer_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN enquiry_items ei ON e.id = ei.enquiry_id
    `;

    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`e.status = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(e.enquiry_number ILIKE $${params.length} OR c.company_name ILIKE $${params.length})`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += `
      GROUP BY e.id, c.id, u.id
      ORDER BY e.id DESC
    `;

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
 * Get single enquiry details by ID with all line items
 */
const getEnquiryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const enqResult = await db.query(`
      SELECT 
        e.*,
        c.company_name,
        c.contact_person,
        c.mobile,
        c.email,
        c.city,
        u.full_name AS created_by_name
      FROM enquiries e
      JOIN customers c ON e.customer_id = c.id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.id = $1
    `, [id]);

    if (enqResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Enquiry with ID ${id} not found.`,
        errorCode: 'ENQUIRY_NOT_FOUND',
      });
    }

    const itemsResult = await db.query(`
      SELECT 
        ei.id AS item_id,
        ei.product_id,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        p.base_price,
        ei.quantity,
        COALESCE(i.physical_quantity, 0) AS physical_quantity,
        COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
        (COALESCE(i.physical_quantity, 0) - COALESCE(i.reserved_quantity, 0)) AS available_quantity
      FROM enquiry_items ei
      JOIN products p ON ei.product_id = p.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE ei.enquiry_id = $1
      ORDER BY ei.id ASC
    `, [id]);

    return res.status(200).json({
      success: true,
      data: {
        ...enqResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update enquiry status (NEW, QUOTED, WON, LOST)
 * Enforces valid state machine transitions:
 * NEW -> QUOTED, LOST
 * QUOTED -> WON, LOST
 * WON -> Terminal state
 * LOST -> Terminal state
 */
const validEnquiryTransitions = {
  NEW: ['QUOTED', 'LOST'],
  QUOTED: ['WON', 'LOST'],
  WON: [],
  LOST: [],
};

const updateEnquiryStatus = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { status } = req.body;

    await client.query('BEGIN');

    // 1. Fetch current enquiry with row-level lock
    const checkResult = await client.query(
      'SELECT id, status FROM enquiries WHERE id = $1 FOR UPDATE',
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Enquiry with ID ${id} not found.`,
        errorCode: 'ENQUIRY_NOT_FOUND',
      });
    }

    const currentStatus = checkResult.rows[0].status;
    const allowedTransitions = validEnquiryTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Invalid enquiry status transition from '${currentStatus}' to '${status}'. Allowed transitions: [${allowedTransitions.join(', ') || 'None - Terminal state'}]`,
        errorCode: 'INVALID_STATUS_TRANSITION',
        current_status: currentStatus,
        attempted_status: status,
        allowed_transitions: allowedTransitions,
      });
    }

    const result = await client.query(`
      UPDATE enquiries
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Enquiry status updated to '${status}'`,
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  createEnquiry,
  getEnquiries,
  getEnquiryById,
  updateEnquiryStatus,
};
