const db = require('../config/db');

/**
 * Get all products with current inventory numbers
 */
const getProducts = async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        p.id,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        p.base_price,
        p.created_at,
        COALESCE(i.physical_quantity, 0) AS physical_quantity,
        COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
        (COALESCE(i.physical_quantity, 0) - COALESCE(i.reserved_quantity, 0)) AS available_quantity
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
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
 * Get product by ID
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(`
      SELECT 
        p.id,
        p.product_code,
        p.product_name,
        p.category,
        p.unit,
        p.base_price,
        COALESCE(i.physical_quantity, 0) AS physical_quantity,
        COALESCE(i.reserved_quantity, 0) AS reserved_quantity,
        (COALESCE(i.physical_quantity, 0) - COALESCE(i.reserved_quantity, 0)) AS available_quantity
      FROM products p
      LEFT JOIN inventory i ON p.id = i.product_id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Product with ID ${id} not found.`,
        errorCode: 'PRODUCT_NOT_FOUND',
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
 * Create a new product (ADMIN only)
 */
const createProduct = async (req, res, next) => {
  const client = await db.getClient();
  try {
    const { product_code, product_name, category, unit, base_price, initial_stock } = req.body;

    await client.query('BEGIN');

    const prodResult = await client.query(`
      INSERT INTO products (product_code, product_name, category, unit, base_price)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [product_code.trim().toUpperCase(), product_name.trim(), category.trim(), unit || 'PCS', base_price]);

    const product = prodResult.rows[0];

    // Initialize inventory row
    const initialQty = initial_stock !== undefined ? parseInt(initial_stock, 10) : 0;
    await client.query(`
      INSERT INTO inventory (product_id, physical_quantity, reserved_quantity)
      VALUES ($1, $2, 0)
    `, [product.id, initialQty]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: {
        ...product,
        physical_quantity: initialQty,
        reserved_quantity: 0,
        available_quantity: initialQty,
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
  getProducts,
  getProductById,
  createProduct,
};
