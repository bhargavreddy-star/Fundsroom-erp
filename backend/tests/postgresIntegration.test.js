const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_jwt_key_for_fundsroom_erp_2026_secure';

const adminToken = jwt.sign(
  { id: 1, username: 'admin', role: 'ADMIN', full_name: 'Administrator' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const salesToken = jwt.sign(
  { id: 2, username: 'sales', role: 'SALES_USER', full_name: 'Sales Rep' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('PostgreSQL Real Integration Tests: Concurrency & Business Invariants', () => {
  let isDbConnected = false;

  beforeAll(async () => {
    try {
      const res = await db.query('SELECT 1');
      isDbConnected = res.rowCount === 1;
    } catch {
      isDbConnected = false;
    }
  });

  afterAll(async () => {
    await db.pool.end().catch(() => {});
  });

  test('0. Real PostgreSQL: Enquiry Status Machine enforces valid transitions (NEW -> QUOTED -> WON / LOST)', async () => {
    if (!isDbConnected) return;

    const ts = Date.now();
    // 1. Create Enquiry with status NEW
    const enqRes = await db.query(`
      INSERT INTO enquiries (enquiry_number, customer_id, required_date, status)
      VALUES ($1, 1, CURRENT_DATE + 10, 'NEW') RETURNING id
    `, [`ENQ-STATE-${ts}`]);
    const enqId = enqRes.rows[0].id;

    // 2. Direct NEW -> WON must be REJECTED (400 Bad Request)
    const resInvalid = await request(app)
      .patch(`/api/enquiries/${enqId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'WON' });

    expect(resInvalid.status).toBe(400);
    expect(resInvalid.body.errorCode).toBe('INVALID_STATUS_TRANSITION');

    // 3. NEW -> QUOTED must SUCCEED (200 OK)
    const resQuoted = await request(app)
      .patch(`/api/enquiries/${enqId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'QUOTED' });

    expect(resQuoted.status).toBe(200);
    expect(resQuoted.body.data.status).toBe('QUOTED');

    // 4. QUOTED -> WON must SUCCEED (200 OK)
    const resWon = await request(app)
      .patch(`/api/enquiries/${enqId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'WON' });

    expect(resWon.status).toBe(200);
    expect(resWon.body.data.status).toBe('WON');

    // 5. Terminal state WON -> NEW must be REJECTED (400 Bad Request)
    const resRevert = await request(app)
      .patch(`/api/enquiries/${enqId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'NEW' });

    expect(resRevert.status).toBe(400);
    expect(resRevert.body.errorCode).toBe('INVALID_STATUS_TRANSITION');
  });

  test('1a. Real PostgreSQL: Quotation Status Machine rejects direct DRAFT -> ACCEPTED', async () => {
    if (!isDbConnected) return;

    const ts = Date.now();
    const enqRes = await db.query(`
      INSERT INTO enquiries (enquiry_number, customer_id, required_date, status)
      VALUES ($1, 1, CURRENT_DATE + 10, 'NEW') RETURNING id
    `, [`ENQ-DRAFT-ACC-${ts}`]);
    const enqId = enqRes.rows[0].id;

    const quoRes = await db.query(`
      INSERT INTO quotations (quotation_number, enquiry_id, customer_id, valid_until, status, grand_total)
      VALUES ($1, $2, 1, CURRENT_DATE + 30, 'DRAFT', 1000) RETURNING id
    `, [`QUO-DRAFT-ACC-${ts}`, enqId]);
    const quoId = quoRes.rows[0].id;

    // Direct DRAFT -> ACCEPTED must be rejected (400 Bad Request)
    const res = await request(app)
      .patch(`/api/quotations/${quoId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'ACCEPTED' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errorCode).toBe('INVALID_STATUS_TRANSITION');
    expect(res.body.current_status).toBe('DRAFT');
    expect(res.body.allowed_transitions).toEqual(['SENT']);
  });

  test('1b. Real PostgreSQL: Quotation Status Machine allows DRAFT -> SENT -> ACCEPTED and updates Enquiry to WON', async () => {
    if (!isDbConnected) return;

    const ts = Date.now();
    const enqRes = await db.query(`
      INSERT INTO enquiries (enquiry_number, customer_id, required_date, status)
      VALUES ($1, 1, CURRENT_DATE + 10, 'QUOTED') RETURNING id
    `, [`ENQ-VALID-ACC-${ts}`]);
    const enqId = enqRes.rows[0].id;

    const quoRes = await db.query(`
      INSERT INTO quotations (quotation_number, enquiry_id, customer_id, valid_until, status, grand_total)
      VALUES ($1, $2, 1, CURRENT_DATE + 30, 'DRAFT', 1000) RETURNING id
    `, [`QUO-VALID-ACC-${ts}`, enqId]);
    const quoId = quoRes.rows[0].id;

    // 1. DRAFT -> SENT (Must succeed)
    const res1 = await request(app)
      .patch(`/api/quotations/${quoId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'SENT' });

    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe('SENT');

    // 2. SENT -> ACCEPTED (Must succeed)
    const res2 = await request(app)
      .patch(`/api/quotations/${quoId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'ACCEPTED' });

    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe('ACCEPTED');

    // 3. Verify enquiry is automatically updated to WON
    const enqCheck = await db.query('SELECT status FROM enquiries WHERE id = $1', [enqId]);
    expect(enqCheck.rows[0].status).toBe('WON');
  });

  test('1c. Real PostgreSQL: Quotation Status Machine allows DRAFT -> SENT -> REJECTED', async () => {
    if (!isDbConnected) return;

    const ts = Date.now();
    const enqRes = await db.query(`
      INSERT INTO enquiries (enquiry_number, customer_id, required_date, status)
      VALUES ($1, 1, CURRENT_DATE + 10, 'QUOTED') RETURNING id
    `, [`ENQ-VALID-REJ-${ts}`]);
    const enqId = enqRes.rows[0].id;

    const quoRes = await db.query(`
      INSERT INTO quotations (quotation_number, enquiry_id, customer_id, valid_until, status, grand_total)
      VALUES ($1, $2, 1, CURRENT_DATE + 30, 'DRAFT', 1000) RETURNING id
    `, [`QUO-VALID-REJ-${ts}`, enqId]);
    const quoId = quoRes.rows[0].id;

    // 1. DRAFT -> SENT
    const res1 = await request(app)
      .patch(`/api/quotations/${quoId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'SENT' });
    expect(res1.status).toBe(200);

    // 2. SENT -> REJECTED
    const res2 = await request(app)
      .patch(`/api/quotations/${quoId}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'REJECTED' });
    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe('REJECTED');
  });

  test('1d. Real PostgreSQL: Terminal-state modification prevention (ACCEPTED and REJECTED cannot revert)', async () => {
    if (!isDbConnected) return;

    const ts = Date.now();
    const enqRes = await db.query(`
      INSERT INTO enquiries (enquiry_number, customer_id, required_date, status)
      VALUES ($1, 1, CURRENT_DATE + 10, 'NEW') RETURNING id
    `, [`ENQ-TERM-${ts}`]);
    const enqId = enqRes.rows[0].id;

    // Accepted Quotation cannot transition to DRAFT or SENT
    const quoAcc = (await db.query(`
      INSERT INTO quotations (quotation_number, enquiry_id, customer_id, valid_until, status, grand_total)
      VALUES ($1, $2, 1, CURRENT_DATE + 30, 'ACCEPTED', 1000) RETURNING id
    `, [`QUO-TERM-ACC-${ts}`, enqId])).rows[0].id;

    const resAcc = await request(app)
      .patch(`/api/quotations/${quoAcc}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'DRAFT' });
    expect(resAcc.status).toBe(400);
    expect(resAcc.body.errorCode).toBe('INVALID_STATUS_TRANSITION');

    // Rejected Quotation cannot transition to SENT or ACCEPTED
    const quoRej = (await db.query(`
      INSERT INTO quotations (quotation_number, enquiry_id, customer_id, valid_until, status, grand_total)
      VALUES ($1, $2, 1, CURRENT_DATE + 30, 'REJECTED', 1000) RETURNING id
    `, [`QUO-TERM-REJ-${ts}`, enqId])).rows[0].id;

    const resRej = await request(app)
      .patch(`/api/quotations/${quoRej}/status`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({ status: 'SENT' });
    expect(resRej.status).toBe(400);
    expect(resRej.body.errorCode).toBe('INVALID_STATUS_TRANSITION');
  });

  test('2. Real PostgreSQL: Duplicate conversion of the same accepted quotation is strictly prevented', async () => {
    if (!isDbConnected) return;

    const ts = Date.now();
    // Setup enquiry & quotation
    const enqRes = await db.query(`
      INSERT INTO enquiries (enquiry_number, customer_id, required_date, status)
      VALUES ($1, 1, CURRENT_DATE + 10, 'QUOTED') RETURNING id
    `, [`ENQ-DUPE-${ts}`]);
    const enqId = enqRes.rows[0].id;

    const quoRes = await db.query(`
      INSERT INTO quotations (quotation_number, enquiry_id, customer_id, valid_until, status, grand_total)
      VALUES ($1, $2, 1, CURRENT_DATE + 30, 'ACCEPTED', 450) RETURNING id
    `, [`QUO-DUPE-${ts}`, enqId]);
    const quoId = quoRes.rows[0].id;

    await db.query(`
      INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, base_amount, discount_amount, taxable_amount, gst_amount, line_total)
      VALUES ($1, 1, 1, 450, 450, 0, 450, 81, 531)
    `, [quoId]);

    // Conversion 1: MUST SUCCEED (HTTP 201)
    const res1 = await request(app)
      .post(`/api/quotations/${quoId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);

    // Conversion 2: MUST FAIL (HTTP 409 DUPLICATE_SALES_ORDER)
    const res2 = await request(app)
      .post(`/api/quotations/${quoId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`);

    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.errorCode).toBe('DUPLICATE_SALES_ORDER');
  });

  test('3. Real PostgreSQL: Multi-product inventory reservation with all-or-nothing transaction rollback', async () => {
    if (!isDbConnected) return;

    const ts = Date.now();
    // Setup enquiry & quotation
    const enqRes = await db.query(`
      INSERT INTO enquiries (enquiry_number, customer_id, required_date, status)
      VALUES ($1, 1, CURRENT_DATE + 10, 'WON') RETURNING id
    `, [`ENQ-RES-${ts}`]);
    const enqId = enqRes.rows[0].id;

    const quoRes = await db.query(`
      INSERT INTO quotations (quotation_number, enquiry_id, customer_id, valid_until, status, grand_total)
      VALUES ($1, $2, 1, CURRENT_DATE + 30, 'ACCEPTED', 10000) RETURNING id
    `, [`QUO-RES-${ts}`, enqId]);
    const quoId = quoRes.rows[0].id;

    const soRes = await db.query(`
      INSERT INTO sales_orders (order_number, quotation_id, customer_id, total_amount, status)
      VALUES ($1, $2, 1, 10000, 'PENDING') RETURNING id
    `, [`SO-RES-${ts}`, quoId]);
    const soId = soRes.rows[0].id;

    // Item 1: Product 1 (5 units - SUFFICIENT)
    // Item 2: Product 2 (99999 units - INSUFFICIENT)
    await db.query(`INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, line_total) VALUES ($1, 1, 5, 450, 2250)`, [soId]);
    await db.query(`INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, line_total) VALUES ($1, 2, 99999, 8500, 849991500)`, [soId]);

    const p1Before = (await db.query('SELECT reserved_quantity, physical_quantity FROM inventory WHERE product_id = 1')).rows[0];

    // Attempt Admin confirmation via API
    const res = await request(app)
      .post(`/api/sales-orders/${soId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('INSUFFICIENT_STOCK');

    // Verify in PostgreSQL: Product 1 reserved stock MUST NOT have changed
    const p1After = (await db.query('SELECT reserved_quantity, physical_quantity FROM inventory WHERE product_id = 1')).rows[0];
    expect(p1After.reserved_quantity).toBe(p1Before.reserved_quantity);
    expect(p1After.physical_quantity).toBe(p1Before.physical_quantity);

    // Verify order status remains PENDING
    const soAfter = (await db.query('SELECT status FROM sales_orders WHERE id = $1', [soId])).rows[0];
    expect(soAfter.status).toBe('PENDING');
  });

  test('4. Real PostgreSQL: Concurrent simultaneous reservation requests on limited stock', async () => {
    if (!isDbConnected) return;

    // Create a temporary isolated product with exactly 10 units of physical stock
    const prodRes = await db.query(`
      INSERT INTO products (product_code, product_name, category, unit, base_price)
      VALUES ($1, 'Concurrency Test Product', 'Test', 'PCS', 100) RETURNING id
    `, [`CONCUR-${Date.now()}`]);
    const testProdId = prodRes.rows[0].id;

    await db.query(`
      INSERT INTO inventory (product_id, physical_quantity, reserved_quantity)
      VALUES ($1, 10, 0)
    `, [testProdId]);

    // Create Order A requiring 8 units
    const enqA = (await db.query(`INSERT INTO enquiries (enquiry_number, customer_id, required_date, status) VALUES ($1, 1, CURRENT_DATE + 5, 'WON') RETURNING id`, [`ENQ-A-${Date.now()}`])).rows[0].id;
    const quoA = (await db.query(`INSERT INTO quotations (quotation_number, enquiry_id, customer_id, valid_until, status, grand_total) VALUES ($1, $2, 1, CURRENT_DATE + 30, 'ACCEPTED', 800) RETURNING id`, [`QUO-A-${Date.now()}`, enqA])).rows[0].id;
    const soA = (await db.query(`INSERT INTO sales_orders (order_number, quotation_id, customer_id, total_amount, status) VALUES ($1, $2, 1, 800, 'PENDING') RETURNING id`, [`SO-A-${Date.now()}`, quoA])).rows[0].id;
    await db.query(`INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, line_total) VALUES ($1, $2, 8, 100, 800)`, [soA, testProdId]);

    // Create Order B requiring 5 units
    const enqB = (await db.query(`INSERT INTO enquiries (enquiry_number, customer_id, required_date, status) VALUES ($1, 1, CURRENT_DATE + 5, 'WON') RETURNING id`, [`ENQ-B-${Date.now()}`])).rows[0].id;
    const quoB = (await db.query(`INSERT INTO quotations (quotation_number, enquiry_id, customer_id, valid_until, status, grand_total) VALUES ($1, $2, 1, CURRENT_DATE + 30, 'ACCEPTED', 500) RETURNING id`, [`QUO-B-${Date.now()}`, enqB])).rows[0].id;
    const soB = (await db.query(`INSERT INTO sales_orders (order_number, quotation_id, customer_id, total_amount, status) VALUES ($1, $2, 1, 500, 'PENDING') RETURNING id`, [`SO-B-${Date.now()}`, quoB])).rows[0].id;
    await db.query(`INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, line_total) VALUES ($1, $2, 5, 100, 500)`, [soB, testProdId]);

    // Issue simultaneous confirmation requests
    const [resA, resB] = await Promise.all([
      request(app).post(`/api/sales-orders/${soA}/confirm`).set('Authorization', `Bearer ${adminToken}`),
      request(app).post(`/api/sales-orders/${soB}/confirm`).set('Authorization', `Bearer ${adminToken}`),
    ]);

    // Exactly one must return 200 (Success) and the other 409 (Conflict/Insufficient stock)
    const statuses = [resA.status, resB.status];
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    // Verify stock in PostgreSQL: reserved quantity must not exceed physical stock (10)
    const finalStock = (await db.query('SELECT * FROM inventory WHERE product_id = $1', [testProdId])).rows[0];
    expect(finalStock.reserved_quantity).toBeLessThanOrEqual(10);
  });
});
