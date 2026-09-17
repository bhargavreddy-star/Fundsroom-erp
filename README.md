# Fundsroom PERN Stack ERP Application
### Industrial Manufacturing & Supply Chain Workflow System

**Author:** G Bhargav Reddy  
**Role:** Full-Stack Developer Technical Case Study  
**Submission Date:** September 17, 2026  
**Technology Stack:** PostgreSQL, Express.js, React.js, Node.js (PERN)  

---

## 1. Project Overview

This application is a specialized Enterprise Resource Planning (ERP) solution designed for a manufacturing and supply company selling industrial products to business-to-business (B2B) customers.

The system manages the end-to-end commercial and fulfillment lifecycle:
```
Customer Enquiry → Commercial Quotation → Sales Order → Inventory Reservation → Physical Dispatch
```

The application strictly enforces:
- Server-side financial calculations (Base Amount, Discounts, GST, Grand Totals).
- Traceable relational workflow linking Customers, Enquiries, Quotations, Orders, and Dispatches.
- **ACID Transactions & Row-Level Concurrency Control** (`SELECT ... FOR UPDATE` in ascending product order) to eliminate race conditions and prevent over-allocation of stock.
- Backend Role-Based Access Control (RBAC) separating **ADMIN** and **SALES_USER** permissions.

---

## 2. Business Workflow Architecture

```mermaid
graph TD
    A[Customer Inbound Enquiry] -->|Sales User quotes products| B[Commercial Quotation Draft]
    B -->|Send to Customer| C{Customer Decision}
    C -->|Reject| D[Status: REJECTED / Enquiry: LOST]
    C -->|Accept| E[Status: ACCEPTED / Enquiry: WON]
    E -->|Convert 1:1| F[Official Sales Order - PENDING]
    F -->|Admin Confirms Order| G[Row-Level Lock: SELECT ... FOR UPDATE]
    G -->|Check: Available = Physical - Reserved >= Required| H{Stock Sufficient?}
    H -->|No| I[ROLLBACK Transaction - Status remains PENDING - 409 Conflict]
    H -->|Yes| J[Atomically Increment Reserved Stock - Status: CONFIRMED - COMMIT]
    J -->|Admin Processes Dispatch| K[Transaction: Atomic Decrement of Physical & Reserved Stock]
    K -->|Record Vehicle & Driver| L[Status: DISPATCHED - Generate DSP Number]
```

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Database** | **PostgreSQL (v14+)** | Relational data persistence, foreign key cascades, check constraints (`chk_available_qty`), row locking (`FOR UPDATE`), and ACID transactions. |
| **Backend** | **Node.js (v18+) & Express.js** | REST API micro-architecture, middleware pipeline, business logic validation. |
| **Frontend** | **React.js 18 + Vite** | High-performance SPA with client-side routing, modular state management, responsive admin UI. |
| **Security & Auth**| **JWT & bcryptjs** | Stateless Bearer token authentication, salt-hashed passwords (10 rounds), and backend RBAC middleware. |
| **Validation** | **Zod** | Strict schema validation for request bodies, query parameters, and route arguments. |
| **Testing** | **Jest & Supertest** | Automated unit and integration testing suite for business rules, calculations, and concurrency simulations. |
| **Documentation**| **Swagger & Postman** | OpenAPI 3.0 specification available at `/api-docs` and exportable Postman JSON collection. |

---

## 4. Database Design & Entity Relationship (ER) Diagram

The database utilizes relational tables with foreign keys, uniqueness constraints, and check constraints to preserve data integrity at the storage layer.

```mermaid
erDiagram
    USERS ||--o{ ENQUIRIES : creates
    USERS ||--o{ QUOTATIONS : creates
    USERS ||--o{ SALES_ORDERS : creates_confirms
    USERS ||--o{ DISPATCHES : dispatches

    CUSTOMERS ||--o{ ENQUIRIES : submits
    CUSTOMERS ||--o{ QUOTATIONS : receives
    CUSTOMERS ||--o{ SALES_ORDERS : places

    PRODUCTS ||--|| INVENTORY : maintains_stock
    PRODUCTS ||--o{ ENQUIRY_ITEMS : contains
    PRODUCTS ||--o{ QUOTATION_ITEMS : quotes
    PRODUCTS ||--o{ SALES_ORDER_ITEMS : orders
    PRODUCTS ||--o{ DISPATCH_ITEMS : delivers

    ENQUIRIES ||--o{ ENQUIRY_ITEMS : has_items
    ENQUIRIES ||--o{ QUOTATIONS : references

    QUOTATIONS ||--o{ QUOTATION_ITEMS : has_items
    QUOTATIONS ||--|| SALES_ORDERS : converts_to_unique

    SALES_ORDERS ||--o{ SALES_ORDER_ITEMS : has_items
    SALES_ORDERS ||--|| DISPATCHES : fulfilled_by_unique

    DISPATCHES ||--o{ DISPATCH_ITEMS : dispatches_items
```

### Key Database Constraints Enforced:
1. `inventory.chk_available_qty`: `CHECK (physical_quantity >= reserved_quantity)` guarantees that `Available Quantity` can never drop below zero at the database engine level.
2. `sales_orders.quotation_id`: `UNIQUE` constraint ensures that one quotation can **never** accidentally produce duplicate sales orders.
3. `dispatches.sales_order_id`: `UNIQUE` constraint prevents the same sales order from being dispatched multiple times.
4. Line Item Quantities: `CHECK (quantity > 0)` prevents zero or negative quantities.
5. Monetary values: `CHECK (base_price >= 0)`, `CHECK (line_total >= 0)`.

---

## 5. Seed Industrial Products

The database seeds 6 realistic industrial products with initial physical and reserved inventory:

| Product Code | Product Name | Category | Unit | Base Price | Physical | Reserved | Available |
|---|---|---|---|---|---|---|---|
| `IND-BRG-001` | Industrial Bearing 6205-2RS | Bearings | PCS | ₹450.00 | 200 | 60 | **140** |
| `HYD-PMP-002` | Hydraulic Pump HP-35 | Hydraulics | SET | ₹8,500.00 | 50 | 10 | **40** |
| `STL-GAR-003` | Steel Gear Assembly SGA-12 | Transmission | SET | ₹3,200.00 | 120 | 30 | **90** |
| `CNV-BLT-004` | Heavy-Duty Conveyor Belt 500mm | Conveyors | MTR | ₹1,250.00 | 300 | 50 | **250** |
| `IND-MTR-005` | Three-Phase Industrial Motor 5HP | Motors | PCS | ₹14,500.00 | 40 | 5 | **35** |
| `PRS-VLV-006` | High Pressure Safety Valve PV-10 | Valves | PCS | ₹1,800.00 | 150 | 20 | **130** |

---

## 6. Inventory Reservation & Concurrency Control

### The Business Challenge:
Consider two sales orders attempting to reserve stock simultaneously:
- **Available Stock:** 100 units
- **Request A:** Requires 80 units
- **Request B:** Requires 50 units
If both check stock simultaneously without database locking, both will see 100 available units and both will reserve, corrupting inventory to 130 reserved units (exceeding physical stock by 30 units).

### The Implementation Solution:
In `salesOrderController.confirmSalesOrder`:
1. Open an explicit transaction: `BEGIN`.
2. Lock the target Sales Order row (`SELECT ... FOR UPDATE`) to eliminate double-confirmation requests.
3. Extract unique product IDs required by the order and sort them in ascending order (`ORDER BY product_id ASC`). **Locking in a consistent sort order eliminates database deadlocks.**
4. Issue row-level lock on inventory:
   ```sql
   SELECT product_id, physical_quantity, reserved_quantity,
          (physical_quantity - reserved_quantity) AS available_quantity
   FROM inventory
   WHERE product_id = ANY($1)
   ORDER BY product_id ASC
   FOR UPDATE;
   ```
5. Compare `available_quantity` against the required quantity for **every** item:
   - If **any** item lacks sufficient stock, immediately issue `ROLLBACK` and return HTTP `409 Conflict` with `errorCode: 'INSUFFICIENT_STOCK'` detailing the deficit.
   - No partial reservation is ever written.
6. If all items have sufficient stock:
   ```sql
   UPDATE inventory
   SET reserved_quantity = reserved_quantity + $1, updated_at = CURRENT_TIMESTAMP
   WHERE product_id = $2;
   ```
7. Mark Sales Order as `CONFIRMED`, record `confirmed_by = req.user.id` and timestamp.
8. Issue `COMMIT`.

---

## 7. Dispatch Module Logic

When an ADMIN dispatches a confirmed order:
1. Verify order status is `CONFIRMED`. Reject `PENDING`, `CANCELLED`, or already `DISPATCHED` orders.
2. Open database transaction `BEGIN`.
3. Lock inventory rows (`FOR UPDATE`).
4. Atomically decrease **both** Physical and Reserved inventory:
   ```sql
   UPDATE inventory
   SET physical_quantity = physical_quantity - $1,
       reserved_quantity = reserved_quantity - $1,
       updated_at = CURRENT_TIMESTAMP
   WHERE product_id = $2;
   ```
5. Notice that Available Quantity remains unchanged:
   $$\text{Available} = (P - Q) - (R - Q) = P - R$$
6. Create an entry in `dispatches` with unique `DSP-YYYYMMDD-XXXX`, vehicle registration number, and driver name.
7. Mark order status as `DISPATCHED`.
8. Issue `COMMIT`.

---

## 8. Role-Based Access Control (RBAC)

The application implements two distinct security roles:

| Feature / Operation | ADMIN | SALES_USER |
|---|:---:|:---:|
| Login & View Profile | ✅ | ✅ |
| View Customers & Create Customers | ✅ | ✅ |
| View Products Master | ✅ | ✅ |
| Create New Products | ✅ | ❌ (403 Forbidden) |
| View Inventory Stock Master | ✅ | ✅ |
| Adjust Physical Inventory Stock | ✅ | ❌ (403 Forbidden) |
| Create & View Enquiries | ✅ | ✅ |
| Create & View Quotations | ✅ | ✅ |
| Update Quotation Status (Accept/Reject) | ✅ | ✅ |
| Convert Quotation to Sales Order | ✅ | ✅ |
| View Sales Orders | ✅ | ✅ |
| **Confirm Sales Order & Reserve Stock** | ✅ | ❌ (403 Forbidden) |
| **Process Order Dispatch** | ✅ | ❌ (403 Forbidden) |

### Test Credentials:
- **Administrator:** `admin` / `Admin@123` (Role: `ADMIN`)
- **Sales User:** `sales` / `Sales@123` (Role: `SALES_USER`)

---

## 9. Project Installation & Setup Guide

### Prerequisites:
- **Node.js:** v18 or higher (tested on Node v24)
- **npm:** v9 or higher
- **PostgreSQL:** v14 or higher (or a free cloud PostgreSQL connection string from Neon / Supabase)

### Step 1: Clone or Navigate to Project
```bash
cd "c:\Mine\Projects\Fundsroom Casestudy 2"
```

### Step 2: Configure Environment Variables
Create or edit `backend/.env`:
```ini
PORT=5000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/erp_db
PGUSER=postgres
PGPASSWORD=postgres
PGHOST=localhost
PGPORT=5432
PGDATABASE=erp_db
JWT_SECRET=supersecret_jwt_key_for_fundsroom_erp_2026_secure
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5173
```
*(If using cloud PostgreSQL like Supabase or Neon, simply set `DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`)*

### Step 3: Install Dependencies
```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Return to root
cd ..
```

### Step 4: Run Database Migration & Seeding
```bash
# Automated database creation, schema migration, and seeding
cd backend
npm run db:setup
```

### Step 5: Run Automated Tests
```bash
cd backend
npm test
```
*Executes all 13 unit, integration, and concurrency tests.*

### Step 6: Start Application
Open two terminal windows:

**Terminal 1 (Backend API Server):**
```bash
cd backend
npm run dev
# Server starts on http://localhost:5000
# Swagger API docs available at http://localhost:5000/api-docs
```

**Terminal 2 (Frontend React Application):**
```bash
cd frontend
npm run dev
# Frontend starts on http://localhost:5173
```

Open `http://localhost:5173` in your web browser. Use the 1-click test fill buttons on the login card to instantly sign in as either **Admin** or **Sales User**.

---

## 10. State Transition Rules & Lifecycle Matrix

### A. Enquiry Lifecycle
```
NEW → QUOTED → WON / LOST
```
- **NEW:** Initial state when an enquiry is created.
- **QUOTED:** Automatically transitioned when a Quotation is generated against the enquiry, or via authorized status update.
- **WON:** Automatically transitioned when the associated Quotation is marked `ACCEPTED`.
- **LOST:** Terminal state if customer declines or cancels the enquiry.
- **Terminal Enforcement:** Invariant check prevents reverting `WON` or `LOST` back to `NEW` or `QUOTED`.

### B. Quotation Lifecycle
```
DRAFT → SENT → ACCEPTED / REJECTED
```
- **DRAFT:** Initial state when commercial quotation is generated.
- **SENT:** Quotation officially delivered to customer. `DRAFT` can **only** transition to `SENT`.
- **ACCEPTED:** Customer accepts the quotation. Triggers Enquiry status to `WON`. Can now be converted into a Sales Order.
- **REJECTED:** Customer rejects quotation. Terminal state.
- **Terminal & Conversion Enforcement:** Terminal states cannot be reverted. Quotations already converted to a Sales Order cannot have their status modified.

---

## 11. Automated Test Suite Summary

Our automated test suite includes **21 backend tests** across unit, integration, and concurrency scenarios, plus **Playwright E2E browser tests** and a **42-point live integration audit**:

| Test Suite | Test File | Scope / Assertions | Real Result |
|---|---|---|:---:|
| **Quotation Engine** | `backend/tests/calculator.test.js` | Base, Discount %, GST 18%, Grand Total, input validation | ✅ 4/4 PASS |
| **RBAC & Business Rules** | `backend/tests/businessRules.test.js` | Auth guards, 403 checks, DRAFT conversion block, 1:1 order uniqueness, stock limit invariant, concurrency race test | ✅ 9/9 PASS |
| **PostgreSQL Live Integration** | `backend/tests/postgresIntegration.test.js` | Real PostgreSQL state machines (Enquiry & Quotation), terminal state prevention, duplicate conversion block, all-or-nothing rollback, concurrent row locking | ✅ 8/8 PASS |
| **Playwright E2E Automation** | `qa_automation/tests/workflow.spec.js` | Browser E2E: Auth, multi-item Enquiry, Quotation (Draft->Sent->Accepted), Order Conversion, Admin Confirmation, Dispatch | ✅ 3/3 PASS |
| **Live Database & API Audit** | `qa_suite/live_audit.js` | 42-point live system validation against active PostgreSQL 18 & Express API | ✅ 42/42 PASS |

**Total Backend Unit & Integration Tests:** 21 Passed, 0 Failed.

---

## 12. REST API Specification

Interactive Swagger UI documentation is available at `http://localhost:5000/api-docs`.

| Method | Endpoint | Description | Auth | Allowed Roles |
|---|---|---|:---:|:---:|
| `POST` | `/api/auth/login` | Authenticate user & return JWT token | No | Public |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes | All |
| `GET` | `/api/customers` | List all customers with search filter | Yes | All |
| `POST` | `/api/customers` | Register a new business customer | Yes | All |
| `GET` | `/api/products` | List product master catalog & live stock | Yes | All |
| `POST` | `/api/products` | Create new product & init inventory row | Yes | ADMIN |
| `GET` | `/api/inventory` | Real-time stock (Physical, Reserved, Available)| Yes | All |
| `PATCH` | `/api/inventory/:id/stock`| Adjust physical stock level | Yes | ADMIN |
| `GET` | `/api/enquiries` | List enquiries with customer details | Yes | All |
| `POST` | `/api/enquiries` | Create customer enquiry with line items | Yes | All |
| `GET` | `/api/quotations` | List quotations with totals and status | Yes | All |
| `POST` | `/api/quotations` | Generate commercial quotation | Yes | All |
| `PATCH` | `/api/quotations/:id/status`| Update status (SENT, ACCEPTED, REJECTED) | Yes | All |
| `POST` | `/api/quotations/:id/convert`| Convert ACCEPTED quotation to Sales Order | Yes | All |
| `GET` | `/api/sales-orders` | List sales orders with stock breakdown | Yes | All |
| `POST` | `/api/sales-orders/:id/confirm`| **Lock inventory & atomically reserve stock** | Yes | **ADMIN** |
| `POST` | `/api/sales-orders/:id/dispatch`| **Process dispatch & decrease stock** | Yes | **ADMIN** |

---

## 12. Submission Documents

- **Word Document:** `ERP_Case_Study_Documentation.docx`
- **PDF Document:** `ERP_Case_Study_Documentation.pdf`
- **Postman Collection:** `docs/Fundsroom_ERP_Postman_Collection.json`
