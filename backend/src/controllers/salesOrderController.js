const db = require('../config/db');

/**
 * Generate unique Dispatch Number: DSP-YYYYMMDD-XXXX
 */
const generateDispatchNumber = async (client) => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `DSP-${dateStr}`;

  const result = await client.query(
    `SELECT dispatch_number FROM dispatches WHERE dispatch_number LIKE $1 ORDER BY id DESC LIMIT 1`,
    [`${prefix}-%`]
  );

  let sequence = 1;
  if (result.rows.length > 0) {
    const lastNum = result.rows[0].dispatch_number;
    const parts = lastNum.split('-');
    if (parts.length === 3) {
      sequence = parseInt(parts[2], 10) + 1;
    }
  }

  return `${prefix}-${String(sequence).padStart(4, '0')}`;
};

/**
 * Get all Sales Orders with customer, quotation reference, and item counts
 */
const getSalesOrders = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let queryText = `
      SELECT 
        so.*,
        c.company_name,
        c.contact_person,
        c.email,
        c.city,
        q.quotation_number,
        u_creator.full_name AS created_by_name,
        u_confirmer.full_name AS confirmed_by_name,
        d.dispatch_number,
        d.dispatch_date,
        COUNT(soi.id) AS total_items,
        COALESCE(SUM(soi.quantity), 0) AS total_units
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id
      JOIN quotations q ON so.quotation_id = q.id
      LEFT JOIN users u_creator ON so.created_by = u_creator.id
      LEFT JOIN users u_confirmer ON so.confirmed_by = u_confirmer.id
      LEFT JOIN dispatches d ON so.id = d.sales_order_id
      LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id
    `;

    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`so.status = $${params.length}`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(so.order_number ILIKE $${params.length} OR c.company_name ILIKE $${params.length} OR q.quotation_number ILIKE $${params.length})`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += `
      GROUP BY so.id, c.id, q.id, u_creator.id, u_confirmer.id, d.id
      ORDER BY so.id DESC
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
 * Get single Sales Order details by ID with items, stock comparison, and dispatch info
 */
const getSalesOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const soResult = await db.query(`
      SELECT 
        so.*,
        c.company_name,
        c.contact_person,
        c.mobile,
        c.email,
        c.city,
        q.quotation_number,
        u_creator.full_name AS created_by_name,
        u_confirmer.full_name AS confirmed_by_name,
        d.id AS dispatch_id,
        d.dispatch_number,
        d.dispatch_date,
        d.vehicle_number,
        d.driver_name
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id
      JOIN quotations q ON so.quotation_id = q.id
      LEFT JOIN users u_creator ON so.created_by = u_creator.id
      LEFT JOIN users u_confirmer ON so.confirmed_by = u_confirmer.id
      LEFT JOIN dispatches d ON so.id = d.sales_order_id
      WHERE so.id = $1
    `, [id]);

    if (soResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Sales Order with ID ${id} not found.`,
        errorCode: 'SALES_ORDER_NOT_FOUND',
      });
    }

    const itemsResult = await db.query(`
      SELECT 
        soi.*,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        COALESCE(i.physical_quantity, 0) AS physical_quantity,
        COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
        (COALESCE(i.physical_quantity, 0) - COALESCE(i.reserved_quantity, 0)) AS available_quantity
      FROM sales_order_items soi
      JOIN products p ON soi.product_id = p.id
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE soi.sales_order_id = $1
      ORDER BY soi.id ASC
    `, [id]);

    return res.status(200).json({
      success: true,
      data: {
        ...soResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm Sales Order & Perform Inventory Reservation
 * 
 * CORE CONCURRENCY & TRANSACTION LOGIC:
 * 1. Begin transaction.
 * 2. Lock Sales Order row (prevent concurrent confirmation calls).
 * 3. Lock all required inventory rows in consistent ascending product_id order (FOR UPDATE) to prevent deadlocks.
 * 4. Check available stock (physical - reserved) against required quantity for each item.
 * 5. If ANY item lacks sufficient stock, ROLLBACK completely and return 409 Conflict.
 * 6. If all items pass, atomically increase reserved_quantity for all items.
 * 7. Mark order CONFIRMED and record confirming admin user.
 * 8. Commit transaction.
 */
const confirmSalesOrder = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 1. Lock and fetch Sales Order to verify status and prevent concurrent confirmation
    const soResult = await client.query(`
      SELECT * FROM sales_orders WHERE id = $1 FOR UPDATE
    `, [id]);

    if (soResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Sales Order with ID ${id} not found.`,
        errorCode: 'SALES_ORDER_NOT_FOUND',
      });
    }

    const order = soResult.rows[0];

    // Check if order is in PENDING status
    if (order.status === 'CONFIRMED') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'This Sales Order is already confirmed and inventory has already been reserved.',
        errorCode: 'ORDER_ALREADY_CONFIRMED',
      });
    }

    if (order.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot confirm Sales Order in '${order.status}' status. Only 'PENDING' orders can be confirmed.`,
        errorCode: 'INVALID_ORDER_STATUS_FOR_CONFIRMATION',
      });
    }

    // 2. Fetch order items
    const itemsResult = await client.query(`
      SELECT soi.*, p.product_name, p.product_code
      FROM sales_order_items soi
      JOIN products p ON soi.product_id = p.id
      WHERE soi.sales_order_id = $1
      ORDER BY soi.product_id ASC
    `, [id]);

    if (itemsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Sales Order contains no items.',
        errorCode: 'EMPTY_ORDER',
      });
    }

    const orderItems = itemsResult.rows;
    // Extract unique product IDs sorted in ascending order to prevent deadlocks
    const productIds = [...new Set(orderItems.map((item) => item.product_id))].sort((a, b) => a - b);

    // 3. ROW-LEVEL LOCKING in consistent order (product_id ASC)
    const inventoryResult = await client.query(`
      SELECT product_id, physical_quantity, reserved_quantity,
             (physical_quantity - reserved_quantity) AS available_quantity
      FROM inventory
      WHERE product_id = ANY($1)
      ORDER BY product_id ASC
      FOR UPDATE
    `, [productIds]);

    const inventoryMap = new Map();
    inventoryResult.rows.forEach((row) => {
      inventoryMap.set(row.product_id, {
        physical_quantity: parseInt(row.physical_quantity, 10),
        reserved_quantity: parseInt(row.reserved_quantity, 10),
        available_quantity: parseInt(row.available_quantity, 10),
      });
    });

    // 4. Verify stock availability for all items (All-or-Nothing Rule)
    const stockErrors = [];
    for (const item of orderItems) {
      const currentStock = inventoryMap.get(item.product_id);

      if (!currentStock) {
        stockErrors.push({
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          reason: 'No inventory record exists for this product',
        });
        continue;
      }

      const available = currentStock.available_quantity;
      const required = parseInt(item.quantity, 10);

      if (available < required) {
        stockErrors.push({
          product_id: item.product_id,
          product_name: item.product_name,
          product_code: item.product_code,
          required_quantity: required,
          physical_quantity: currentStock.physical_quantity,
          reserved_quantity: currentStock.reserved_quantity,
          available_quantity: available,
          deficit: required - available,
        });
      }
    }

    // 5. Reject if any item has insufficient stock
    if (stockErrors.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Insufficient inventory stock to confirm this order. Entire reservation rolled back.',
        errorCode: 'INSUFFICIENT_STOCK',
        details: stockErrors,
      });
    }

    // 6. All items have sufficient stock: Atomic increase of reserved_quantity
    for (const item of orderItems) {
      const required = parseInt(item.quantity, 10);
      await client.query(`
        UPDATE inventory
        SET reserved_quantity = reserved_quantity + $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $2
      `, [required, item.product_id]);
    }

    // 7. Update Sales Order status to CONFIRMED
    const updateOrderResult = await client.query(`
      UPDATE sales_orders
      SET status = 'CONFIRMED',
          confirmed_by = $1,
          confirmed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [req.user.id, id]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Sales Order confirmed successfully and inventory stock reserved.',
      data: updateOrderResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

/**
 * Dispatch Confirmed Sales Order
 * 
 * CORE DISPATCH LOGIC:
 * 1. Check user role is ADMIN.
 * 2. Lock Sales Order row.
 * 3. Verify status is CONFIRMED (cannot dispatch PENDING, CANCELLED, or already DISPATCHED orders).
 * 4. Lock inventory rows ordered by product_id ASC FOR UPDATE.
 * 5. Verify reserved_quantity >= order quantity.
 * 6. Atomically decrease physical_quantity AND reserved_quantity by the order quantity.
 * 7. Insert record into dispatches and dispatch_items tables.
 * 8. Update Sales Order status to DISPATCHED.
 * 9. Commit transaction.
 */
const dispatchSalesOrder = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { id } = req.params;
    const { vehicle_number, driver_name, notes } = req.body;

    await client.query('BEGIN');

    // 1. Lock and fetch Sales Order
    const soResult = await client.query(`
      SELECT * FROM sales_orders WHERE id = $1 FOR UPDATE
    `, [id]);

    if (soResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Sales Order with ID ${id} not found.`,
        errorCode: 'SALES_ORDER_NOT_FOUND',
      });
    }

    const order = soResult.rows[0];

    // Rule: Check if order has already been dispatched
    if (order.status === 'DISPATCHED') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'This Sales Order has already been dispatched. Duplicate dispatch is prevented.',
        errorCode: 'ALREADY_DISPATCHED',
      });
    }

    // Rule: Only CONFIRMED orders can be dispatched
    if (order.status !== 'CONFIRMED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot dispatch Sales Order in '${order.status}' status. Only 'CONFIRMED' orders with reserved inventory can be dispatched.`,
        errorCode: 'ORDER_NOT_CONFIRMED_FOR_DISPATCH',
      });
    }

    // Prevent duplicate dispatch by checking dispatches table
    const existingDispatch = await client.query(`
      SELECT id, dispatch_number FROM dispatches WHERE sales_order_id = $1
    `, [id]);

    if (existingDispatch.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: `Dispatch record (${existingDispatch.rows[0].dispatch_number}) already exists for this order.`,
        errorCode: 'DUPLICATE_DISPATCH',
      });
    }

    // 2. Fetch order items
    const itemsResult = await client.query(`
      SELECT soi.*, p.product_name, p.product_code
      FROM sales_order_items soi
      JOIN products p ON soi.product_id = p.id
      WHERE soi.sales_order_id = $1
      ORDER BY soi.product_id ASC
    `, [id]);

    const orderItems = itemsResult.rows;
    const productIds = [...new Set(orderItems.map((item) => item.product_id))].sort((a, b) => a - b);

    // 3. Lock inventory rows in consistent order (FOR UPDATE)
    const inventoryResult = await client.query(`
      SELECT product_id, physical_quantity, reserved_quantity
      FROM inventory
      WHERE product_id = ANY($1)
      ORDER BY product_id ASC
      FOR UPDATE
    `, [productIds]);

    const inventoryMap = new Map();
    inventoryResult.rows.forEach((row) => {
      inventoryMap.set(row.product_id, {
        physical_quantity: parseInt(row.physical_quantity, 10),
        reserved_quantity: parseInt(row.reserved_quantity, 10),
      });
    });

    // 4. Validate that reserved quantities are sufficient for dispatch
    for (const item of orderItems) {
      const stock = inventoryMap.get(item.product_id);
      const qty = parseInt(item.quantity, 10);

      if (!stock || stock.reserved_quantity < qty || stock.physical_quantity < qty) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: `Cannot dispatch: Insufficient reserved stock for product '${item.product_name}'. Reserved: ${stock ? stock.reserved_quantity : 0}, Required: ${qty}`,
          errorCode: 'INSUFFICIENT_RESERVED_FOR_DISPATCH',
        });
      }
    }

    // 5. Decrease Physical Quantity AND Reserved Quantity atomically
    for (const item of orderItems) {
      const qty = parseInt(item.quantity, 10);
      await client.query(`
        UPDATE inventory
        SET physical_quantity = physical_quantity - $1,
            reserved_quantity = reserved_quantity - $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE product_id = $2
      `, [qty, item.product_id]);
    }

    // 6. Generate unique Dispatch Number
    const dispatchNumber = await generateDispatchNumber(client);

    // 7. Insert Dispatch Record
    const dispatchResult = await client.query(`
      INSERT INTO dispatches (
        dispatch_number, sales_order_id, vehicle_number, driver_name, notes, dispatched_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      dispatchNumber,
      order.id,
      vehicle_number.trim(),
      driver_name.trim(),
      notes || null,
      req.user.id,
    ]);

    const dispatch = dispatchResult.rows[0];

    // 8. Insert Dispatch Items
    for (const item of orderItems) {
      await client.query(`
        INSERT INTO dispatch_items (dispatch_id, product_id, quantity)
        VALUES ($1, $2, $3)
      `, [dispatch.id, item.product_id, item.quantity]);
    }

    // 9. Update Sales Order status to DISPATCHED
    await client.query(`
      UPDATE sales_orders
      SET status = 'DISPATCHED', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [id]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Sales Order dispatched successfully. Physical and reserved inventory updated.',
      data: {
        ...dispatch,
        sales_order_status: 'DISPATCHED',
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
  getSalesOrders,
  getSalesOrderById,
  confirmSalesOrder,
  dispatchSalesOrder,
};
