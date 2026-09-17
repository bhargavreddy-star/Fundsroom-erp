const db = require('../config/db');

/**
 * Get all customers with optional search
 */
const getCustomers = async (req, res, next) => {
  try {
    const { search } = req.query;
    let queryText = 'SELECT * FROM customers';
    const params = [];

    if (search && search.trim()) {
      queryText += ' WHERE company_name ILIKE $1 OR contact_person ILIKE $1 OR city ILIKE $1';
      params.push(`%${search.trim()}%`);
    }

    queryText += ' ORDER BY company_name ASC';

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
 * Get single customer by ID
 */
const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM customers WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Customer with ID ${id} not found.`,
        errorCode: 'CUSTOMER_NOT_FOUND',
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
 * Create a new customer
 */
const createCustomer = async (req, res, next) => {
  try {
    const { company_name, contact_person, mobile, email, city } = req.body;

    const result = await db.query(
      `INSERT INTO customers (company_name, contact_person, mobile, email, city)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [company_name.trim(), contact_person.trim(), mobile.trim(), email.trim().toLowerCase(), city.trim()]
    );

    return res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
};
