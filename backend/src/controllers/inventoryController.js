const db = require('../config/db');

/**
 * Get full inventory stock report
 * Available Quantity = Physical Quantity - Reserved Quantity
 */
const getInventory = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        i.id AS inventory_id,
        p.id AS product_id,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        p.base_price,
        i.physical_quantity,
        i.reserved_quantity,
        (i.physical_quantity - i.reserved_quantity) AS available_quantity,
        i.updated_at
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      ORDER BY p.product_name ASC
    `);

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
 * Get inventory for single product
 */
const getProductInventory = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const result = await db.query(`
      SELECT 
        i.id AS inventory_id,
        p.id AS product_id,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        p.base_price,
        i.physical_quantity,
        i.reserved_quantity,
        (i.physical_quantity - i.reserved_quantity) AS available_quantity,
        i.updated_at
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      WHERE p.id = $1
    `, [productId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Inventory not found for product ID ${productId}.`,
        errorCode: 'INVENTORY_NOT_FOUND',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Adjust physical stock (ADMIN only)
 */
const updateStock = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { productId } = req.params;
    const { physical_quantity } = req.body;

    if (physical_quantity === undefined || physical_quantity < 0) {
      return res.status(400).json({
        success: false,
        message: 'Physical quantity must be a non-negative integer.',
        errorCode: 'INVALID_STOCK_VALUE',
      });
    }

    await client.query('BEGIN');

    // Lock the inventory row
    const checkResult = await client.query(`
      SELECT * FROM inventory WHERE product_id = $1 FOR UPDATE
    `, [productId]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Inventory row not found for product ID ${productId}.`,
        errorCode: 'INVENTORY_NOT_FOUND',
      });
    }

    const currentInv = checkResult.rows[0];

    if (physical_quantity < currentInv.reserved_quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot reduce physical stock (${physical_quantity}) below currently reserved stock (${currentInv.reserved_quantity}). Available stock would become negative.`,
        errorCode: 'CANNOT_REDUCE_BELOW_RESERVED',
      });
    }

    const updateResult = await client.query(`
      UPDATE inventory
      SET physical_quantity = $1, updated_at = CURRENT_TIMESTAMP
      WHERE product_id = $2
      RETURNING *, (physical_quantity - reserved_quantity) AS available_quantity
    `, [physical_quantity, productId]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Physical stock updated successfully',
      data: updateResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
};

module.exports = {
  getInventory,
  getProductInventory,
  updateStock,
};
