const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const runSeeds = async () => {
  console.log('🌱 Seeding database...');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Seed Users (ADMIN and SALES_USER)
    console.log('  → Seeding users...');
    const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
    const salesPasswordHash = await bcrypt.hash('Sales@123', 10);

    const userAdmin = await client.query(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name
      RETURNING id
    `, ['admin', adminPasswordHash, 'System Administrator', 'ADMIN']);

    const userSales = await client.query(`
      INSERT INTO users (username, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, full_name = EXCLUDED.full_name
      RETURNING id
    `, ['sales', salesPasswordHash, 'Sales Representative', 'SALES_USER']);

    const adminId = userAdmin.rows[0].id;
    const salesId = userSales.rows[0].id;

    // 2. Seed 6 Industrial Products
    console.log('  → Seeding 6 industrial products & inventory...');
    const products = [
      {
        code: 'IND-BRG-001',
        name: 'Industrial Bearing 6205-2RS',
        category: 'Bearings',
        unit: 'PCS',
        price: 450.00,
        physical: 200,
        reserved: 60, // Available: 140 (Case study example)
      },
      {
        code: 'HYD-PMP-002',
        name: 'Hydraulic Pump HP-35',
        category: 'Hydraulics',
        unit: 'SET',
        price: 8500.00,
        physical: 50,
        reserved: 10, // Available: 40
      },
      {
        code: 'STL-GAR-003',
        name: 'Steel Gear Assembly SGA-12',
        category: 'Transmission',
        unit: 'SET',
        price: 3200.00,
        physical: 120,
        reserved: 30, // Available: 90
      },
      {
        code: 'CNV-BLT-004',
        name: 'Heavy-Duty Conveyor Belt 500mm',
        category: 'Conveyors',
        unit: 'MTR',
        price: 1250.00,
        physical: 300,
        reserved: 50, // Available: 250
      },
      {
        code: 'IND-MTR-005',
        name: 'Three-Phase Industrial Motor 5HP',
        category: 'Motors',
        unit: 'PCS',
        price: 14500.00,
        physical: 40,
        reserved: 5, // Available: 35
      },
      {
        code: 'PRS-VLV-006',
        name: 'High Pressure Safety Valve PV-10',
        category: 'Valves',
        unit: 'PCS',
        price: 1800.00,
        physical: 150,
        reserved: 20, // Available: 130
      },
    ];

    const seededProductMap = {};

    for (const p of products) {
      const prodRes = await client.query(`
        INSERT INTO products (product_code, product_name, category, unit, base_price)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (product_code) DO UPDATE
        SET product_name = EXCLUDED.product_name,
            category = EXCLUDED.category,
            unit = EXCLUDED.unit,
            base_price = EXCLUDED.base_price
        RETURNING id
      `, [p.code, p.name, p.category, p.unit, p.price]);

      const prodId = prodRes.rows[0].id;
      seededProductMap[p.code] = prodId;

      await client.query(`
        INSERT INTO inventory (product_id, physical_quantity, reserved_quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (product_id) DO UPDATE
        SET physical_quantity = EXCLUDED.physical_quantity,
            reserved_quantity = EXCLUDED.reserved_quantity,
            updated_at = CURRENT_TIMESTAMP
      `, [prodId, p.physical, p.reserved]);
    }

    // 3. Seed Customers
    console.log('  → Seeding customers...');
    const customers = [
      {
        name: 'ABC Engineering Pvt. Ltd.',
        contact: 'Rajesh Sharma',
        mobile: '+91-9876543210',
        email: 'rajesh@abcengg.com',
        city: 'Pune',
      },
      {
        name: 'Precision Machineries Corp.',
        contact: 'Sunil Mehta',
        mobile: '+91-9811223344',
        email: 'sunil@precisioncorp.in',
        city: 'Ahmedabad',
      },
      {
        name: 'Apex Heavy Industries',
        contact: 'Pooja Verma',
        mobile: '+91-9988776655',
        email: 'pooja.verma@apexheavy.com',
        city: 'Chennai',
      },
    ];

    const customerIds = [];
    for (const c of customers) {
      const custRes = await client.query(`
        INSERT INTO customers (company_name, contact_person, mobile, email, city)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [c.name, c.contact, c.mobile, c.email, c.city]);
      customerIds.push(custRes.rows[0].id);
    }

    // 4. Seed Initial Enquiry
    console.log('  → Seeding sample workflow records...');
    const enqRes = await client.query(`
      INSERT INTO enquiries (enquiry_number, customer_id, required_date, notes, status, created_by)
      VALUES ('ENQ-20260917-0001', $1, CURRENT_DATE + INTERVAL '14 days', 'Initial machinery maintenance requirement for Q3', 'QUOTED', $2)
      RETURNING id
    `, [customerIds[0], salesId]);
    const enquiryId = enqRes.rows[0].id;

    // Enquiry items
    await client.query(`
      INSERT INTO enquiry_items (enquiry_id, product_id, quantity)
      VALUES 
        ($1, $2, 10),
        ($1, $3, 2)
    `, [enquiryId, seededProductMap['IND-BRG-001'], seededProductMap['HYD-PMP-002']]);

    // 5. Seed Accepted Quotation
    const quoRes = await client.query(`
      INSERT INTO quotations (
        quotation_number, enquiry_id, customer_id, valid_until, status,
        subtotal_amount, discount_total, taxable_total, gst_total, grand_total,
        notes, created_by
      )
      VALUES (
        'QUO-20260917-0001', $1, $2, CURRENT_DATE + INTERVAL '30 days', 'ACCEPTED',
        21500.00, 1075.00, 20425.00, 3676.50, 24101.50,
        'Standard commercial quotation with 5% volume discount', $3
      )
      RETURNING id
    `, [enquiryId, customerIds[0], salesId]);
    const quotationId = quoRes.rows[0].id;

    // Quotation items
    // Item 1: 10 * 450 = 4500; 5% disc = 225; taxable = 4275; 18% GST = 769.50; total = 5044.50
    await client.query(`
      INSERT INTO quotation_items (
        quotation_id, product_id, quantity, unit_price, discount_percent, gst_percent,
        base_amount, discount_amount, taxable_amount, gst_amount, line_total
      )
      VALUES ($1, $2, 10, 450.00, 5.00, 18.00, 4500.00, 225.00, 4275.00, 769.50, 5044.50)
    `, [quotationId, seededProductMap['IND-BRG-001']]);

    // Item 2: 2 * 8500 = 17000; 5% disc = 850; taxable = 16150; 18% GST = 2907.00; total = 19057.00
    await client.query(`
      INSERT INTO quotation_items (
        quotation_id, product_id, quantity, unit_price, discount_percent, gst_percent,
        base_amount, discount_amount, taxable_amount, gst_amount, line_total
      )
      VALUES ($1, $2, 2, 8500.00, 5.00, 18.00, 17000.00, 850.00, 16150.00, 2907.00, 19057.00)
    `, [quotationId, seededProductMap['HYD-PMP-002']]);

    // 6. Seed PENDING Sales Order (Ready for Admin confirmation demo!)
    const soRes = await client.query(`
      INSERT INTO sales_orders (
        order_number, quotation_id, customer_id, total_amount, status, created_by
      )
      VALUES ('SO-20260917-0001', $1, $2, 24101.50, 'PENDING', $3)
      RETURNING id
    `, [quotationId, customerIds[0], salesId]);
    const salesOrderId = soRes.rows[0].id;

    await client.query(`
      INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, line_total)
      VALUES 
        ($1, $2, 10, 450.00, 5044.50),
        ($1, $3, 2, 8500.00, 19057.00)
    `, [salesOrderId, seededProductMap['IND-BRG-001'], seededProductMap['HYD-PMP-002']]);

    await client.query('COMMIT');

    console.log('✅ Seed data inserted successfully!');
    console.log('--------------------------------------------------');
    console.log('🔑 Test Credentials:');
    console.log('   Admin:      admin / Admin@123 (Role: ADMIN)');
    console.log('   Sales User: sales / Sales@123 (Role: SALES_USER)');
    console.log('📦 Products:   6 Industrial Products created');
    console.log('📋 Sample:     1 Enquiry, 1 Accepted Quotation, 1 Pending Order (SO-20260917-0001)');
    console.log('--------------------------------------------------');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  runSeeds()
    .then(() => pool.end())
    .catch(() => process.exit(1));
}

module.exports = runSeeds;
