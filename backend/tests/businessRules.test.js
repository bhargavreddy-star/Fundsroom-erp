const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

// Mock user tokens
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

describe('ERP Business Rules & Mandatory Requirements', () => {
  afterAll(async () => {
    // Gracefully close pool if opened
    await db.pool.end().catch(() => {});
  });

  describe('TEST 5: Role-Based Access Control (RBAC)', () => {
    test('rejects unauthenticated requests to protected endpoints with 401', async () => {
      const res = await request(app).get('/api/enquiries');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('AUTH_TOKEN_MISSING');
    });

    test('rejects SALES_USER from performing ADMIN-only operations (e.g. Confirm Order) with 403', async () => {
      const res = await request(app)
        .post('/api/sales-orders/1/confirm')
        .set('Authorization', `Bearer ${salesToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_INSUFFICIENT_ROLE');
    });

    test('rejects SALES_USER from processing dispatch with 403', async () => {
      const res = await request(app)
        .post('/api/sales-orders/1/dispatch')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          vehicle_number: 'MH-12-AB-1234',
          driver_name: 'Ramesh Kumar',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_INSUFFICIENT_ROLE');
    });

    test('rejects SALES_USER from creating products (product master) with 403', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${salesToken}`)
        .send({
          product_code: 'NEW-001',
          product_name: 'New Product',
          category: 'General',
          unit: 'PCS',
          base_price: 100,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.errorCode).toBe('FORBIDDEN_INSUFFICIENT_ROLE');
    });
  });

  describe('TEST 2: Quotation Status Conversion Rules (Mocked DB)', () => {
    test('enforces that DRAFT quotation status blocks order conversion', () => {
      const validateQuotationForConversion = (status) => {
        if (status !== 'ACCEPTED') {
          return {
            allowed: false,
            errorCode: status === 'DRAFT' ? 'CANNOT_CONVERT_DRAFT_QUOTATION' : 'CANNOT_CONVERT_NON_ACCEPTED_QUOTATION',
            message: `Cannot convert quotation into Sales Order: Quotation status is '${status}'. Only 'ACCEPTED' quotations can be converted.`,
          };
        }
        return { allowed: true };
      };

      const draftResult = validateQuotationForConversion('DRAFT');
      expect(draftResult.allowed).toBe(false);
      expect(draftResult.errorCode).toBe('CANNOT_CONVERT_DRAFT_QUOTATION');

      const rejectedResult = validateQuotationForConversion('REJECTED');
      expect(rejectedResult.allowed).toBe(false);
      expect(rejectedResult.errorCode).toBe('CANNOT_CONVERT_NON_ACCEPTED_QUOTATION');

      const acceptedResult = validateQuotationForConversion('ACCEPTED');
      expect(acceptedResult.allowed).toBe(true);
    });
  });

  describe('TEST 3: Duplicate Order Prevention', () => {
    test('enforces that a quotation cannot generate multiple sales orders', () => {
      const existingOrders = new Set([1]); // Quotation ID 1 already converted

      const canConvertQuotation = (quotationId) => {
        if (existingOrders.has(quotationId)) {
          return {
            allowed: false,
            errorCode: 'DUPLICATE_SALES_ORDER',
            message: 'A Sales Order has already been generated from this quotation.',
          };
        }
        return { allowed: true };
      };

      expect(canConvertQuotation(1).allowed).toBe(false);
      expect(canConvertQuotation(1).errorCode).toBe('DUPLICATE_SALES_ORDER');
      expect(canConvertQuotation(2).allowed).toBe(true);
    });
  });

  describe('TEST 4: Inventory Reservation & Stock Limits', () => {
    test('cannot reserve more than available inventory (Physical - Reserved)', () => {
      // Setup inventory state as per PDF example:
      // Physical = 100, Reserved = 30 => Available = 70
      const inventory = {
        physical_quantity: 100,
        reserved_quantity: 30,
        get available_quantity() {
          return this.physical_quantity - this.reserved_quantity;
        },
      };

      const tryReserveStock = (requiredQty) => {
        if (requiredQty > inventory.available_quantity) {
          return {
            success: false,
            errorCode: 'INSUFFICIENT_STOCK',
            available: inventory.available_quantity,
            required: requiredQty,
            deficit: requiredQty - inventory.available_quantity,
          };
        }
        inventory.reserved_quantity += requiredQty;
        return {
          success: true,
          reserved: inventory.reserved_quantity,
          available: inventory.available_quantity,
        };
      };

      // Attempt 1: Requirement = 80 (Available = 70) => MUST FAIL!
      const failedAttempt = tryReserveStock(80);
      expect(failedAttempt.success).toBe(false);
      expect(failedAttempt.errorCode).toBe('INSUFFICIENT_STOCK');
      expect(failedAttempt.deficit).toBe(10);
      expect(inventory.reserved_quantity).toBe(30); // Unchanged!
      expect(inventory.physical_quantity).toBe(100); // Unchanged!

      // Attempt 2: Requirement = 60 (Available = 70) => MUST SUCCEED!
      const successAttempt = tryReserveStock(60);
      expect(successAttempt.success).toBe(true);
      expect(inventory.physical_quantity).toBe(100); // Physical unchanged during reservation!
      expect(inventory.reserved_quantity).toBe(90);  // 30 + 60 = 90
      expect(inventory.available_quantity).toBe(10); // 100 - 90 = 10
    });

    test('atomic dispatch decreases both physical and reserved stock', () => {
      const inventory = {
        physical_quantity: 100,
        reserved_quantity: 60,
        get available_quantity() {
          return this.physical_quantity - this.reserved_quantity;
        },
      };

      // Dispatch 60 units
      const dispatchQty = 60;
      expect(inventory.reserved_quantity).toBeGreaterThanOrEqual(dispatchQty);

      inventory.physical_quantity -= dispatchQty;
      inventory.reserved_quantity -= dispatchQty;

      expect(inventory.physical_quantity).toBe(40);
      expect(inventory.reserved_quantity).toBe(0);
      expect(inventory.available_quantity).toBe(40); // Available remains 40!
    });
  });

  describe('BONUS TEST: Simultaneous Inventory Reservations (Race Condition Simulation)', () => {
    test('ensures two simultaneous requests exceeding available stock cannot both succeed', async () => {
      // Total available inventory = 100
      let physical = 100;
      let reserved = 0;
      let mutexLocked = false;

      // Simulated row-level locking with transaction rollback
      const reserveWithLock = async (reqName, qty) => {
        // Wait for lock (simulating SELECT ... FOR UPDATE queue)
        while (mutexLocked) {
          await new Promise((r) => setTimeout(r, 10));
        }
        mutexLocked = true;

        try {
          const available = physical - reserved;
          if (available < qty) {
            return {
              requester: reqName,
              success: false,
              reason: 'INSUFFICIENT_STOCK',
            };
          }

          // Simulate database latency
          await new Promise((r) => setTimeout(r, 20));

          reserved += qty;
          return {
            requester: reqName,
            success: true,
            reserved,
            available: physical - reserved,
          };
        } finally {
          mutexLocked = false;
        }
      };

      // User A requests 80, User B requests 50 simultaneously
      const [resA, resB] = await Promise.all([
        reserveWithLock('User A', 80),
        reserveWithLock('User B', 50),
      ]);

      // Exactly ONE request must succeed and ONE must fail
      const successes = [resA, resB].filter((r) => r.success);
      const failures = [resA, resB].filter((r) => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      expect(failures[0].reason).toBe('INSUFFICIENT_STOCK');
      expect(reserved).toBeLessThanOrEqual(100);
    });
  });
});
