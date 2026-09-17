import os
import sys
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

# --- ReportLab Imports ---
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

print("Starting Case Study Documentation generation...")

# ==============================================================================
# PART 1: MICROSOFT WORD (.DOCX) GENERATION USING python-docx
# ==============================================================================

doc = Document()

# Set standard page margins (1 inch)
for section in doc.sections:
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)

# Helper for XML shading
def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

# Title Page / Cover Page
p_pre = doc.add_paragraph()
p_pre.alignment = WD_ALIGN_PARAGRAPH.CENTER
run_pre = p_pre.add_run("TECHNICAL CASE STUDY SUBMISSION")
run_pre.font.size = Pt(12)
run_pre.font.bold = True
run_pre.font.color.rgb = RGBColor(37, 99, 235) # Blue

doc.add_paragraph() # Spacing

p_title = doc.add_paragraph()
p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run_title = p_title.add_run("ERP Application – Full-Stack Developer Case Study")
run_title.font.size = Pt(26)
run_title.font.bold = True
run_title.font.color.rgb = RGBColor(15, 23, 42)

p_sub = doc.add_paragraph()
p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
run_sub = p_sub.add_run("Industrial Manufacturing & Supply Chain Workflow System\nEnd-to-End Business Flow: Enquiry → Quotation → Sales Order → Reservation → Dispatch")
run_sub.font.size = Pt(13)
run_sub.font.color.rgb = RGBColor(100, 116, 139)

for _ in range(4):
    doc.add_paragraph()

# Metadata Box
meta_table = doc.add_table(rows=6, cols=2)
meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
meta_data = [
    ("Candidate Name:", "Bhargav Reddy"),
    ("Role Evaluated:", "Full-Stack Developer"),
    ("Technology Stack:", "PERN (PostgreSQL, Express.js, React.js, Node.js)"),
    ("Submission Date:", "September 17, 2026"),
    ("Project Domain:", "Industrial Manufacturing & Supply Chain ERP"),
    ("Repository Scope:", "Full Working Implementation, Tests & API Documentation"),
]

for i, (label, val) in enumerate(meta_data):
    row = meta_table.rows[i]
    cell_lbl, cell_val = row.cells[0], row.cells[1]
    
    p0 = cell_lbl.paragraphs[0]
    r0 = p0.add_run(label)
    r0.font.bold = True
    r0.font.size = Pt(10.5)
    r0.font.color.rgb = RGBColor(51, 65, 85)
    
    p1 = cell_val.paragraphs[0]
    r1 = p1.add_run(val)
    r1.font.size = Pt(10.5)
    r1.font.color.rgb = RGBColor(15, 23, 42)
    
    set_cell_background(cell_lbl, "F8FAFC")
    set_cell_background(cell_val, "FFFFFF")
    set_cell_margins(cell_lbl, 120, 120, 180, 180)
    set_cell_margins(cell_val, 120, 120, 180, 180)

doc.add_page_break()

# Function to add styled headings
def add_h1(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run(text)
    r.font.size = Pt(18)
    r.font.bold = True
    r.font.color.rgb = RGBColor(30, 41, 59)
    return p

def add_h2(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text)
    r.font.size = Pt(14)
    r.font.bold = True
    r.font.color.rgb = RGBColor(37, 99, 235)
    return p

def add_h3(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(text)
    r.font.size = Pt(11.5)
    r.font.bold = True
    r.font.color.rgb = RGBColor(71, 85, 105)
    return p

def add_p(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.15
    r = p.add_run(text)
    r.font.size = Pt(10.5)
    r.font.color.rgb = RGBColor(30, 41, 59)
    return p

def add_bullet(bold_prefix, text):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.15
    r_pre = p.add_run(bold_prefix + " ")
    r_pre.font.bold = True
    r_pre.font.size = Pt(10)
    r_text = p.add_run(text)
    r_text.font.size = Pt(10)
    return p

def add_callout(title, text):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.rows[0].cells[0]
    set_cell_background(cell, "EFF6FF")
    set_cell_margins(cell, 150, 150, 200, 200)
    p = cell.paragraphs[0]
    r_title = p.add_run(title + "\n")
    r_title.font.bold = True
    r_title.font.size = Pt(10.5)
    r_title.font.color.rgb = RGBColor(29, 78, 216)
    r_body = p.add_run(text)
    r_body.font.size = Pt(10)
    r_body.font.color.rgb = RGBColor(30, 58, 138)
    doc.add_paragraph() # Spacing

# Section 2: Table of Contents
add_h1("Table of Contents")
toc_items = [
    "1. Cover Page",
    "2. Table of Contents",
    "3. Introduction",
    "4. Problem Statement",
    "5. Project Objectives",
    "6. Technology Stack",
    "7. System Architecture",
    "8. Database Design & Relational Schema",
    "9. Application Modules",
    "10. Complete Business Workflow",
    "11. REST API Documentation",
    "12. Authentication & Role-Based Access Control (RBAC)",
    "13. Inventory Reservation & Concurrency Logic",
    "14. Frontend Implementation & UI Design",
    "15. Testing & Verification Results",
    "16. Setup, Configuration & Startup Guide",
    "17. Application Screenshots & Interface Walkthrough",
    "18. Technical Challenges & Implemented Solutions",
    "19. Assumptions & Limitations",
    "20. Conclusion & Future Roadmap",
]
for item in toc_items:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(item)
    r.font.size = Pt(10.5)
    r.font.color.rgb = RGBColor(51, 65, 85)

doc.add_page_break()

# Section 3: Introduction
add_h1("3. Introduction")
add_p("In modern industrial manufacturing and B2B distribution environments, commercial transactions require strict coordination between sales negotiations, contract management, credit terms, and physical inventory control. Unlike consumer e-commerce where orders are paid instantly and stock is immediately subtracted, business-to-business transactions operate through multi-stage commercial workflows.")
add_p("This Enterprise Resource Planning (ERP) application provides a robust, production-grade technical implementation of the complete sales-to-fulfillment lifecycle for an industrial supply company. Developed using the PERN technology stack (PostgreSQL, Express.js, React.js, and Node.js), the platform guarantees data integrity, exact monetary accuracy, row-level concurrency protection, and role-based administrative governance.")

# Section 4: Problem Statement
add_h1("4. Problem Statement")
add_p("Industrial suppliers frequently suffer from fragmented communication between sales representatives and warehouse managers. This leads to severe business vulnerabilities:")
add_bullet("Stock Over-Allocation & Overselling:", "When multiple sales reps accept quotations against the same physical stock without synchronous inventory reservations, orders get confirmed that the warehouse cannot fulfill.")
add_bullet("Floating-Point Drift in Quotations:", "Relying on client-side or unsafe floating-point calculations results in billing errors across quantities, discounts, and multi-tier Goods and Services Tax (GST).")
add_bullet("Loss of Audit Traceability:", "In the absence of a relational schema, companies cannot trace customer enquiries to quotations, confirmed orders, and physical vehicle dispatches.")
add_bullet("Unauthorized Administrative Actions:", "Without backend-enforced RBAC, sales personnel can confirm orders or ship stock without credit or inventory authorization.")

# Section 5: Project Objectives
add_h1("5. Project Objectives")
add_bullet("Traceable Business Workflow:", "Establish an end-to-end audit trail: Customer Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch.")
add_bullet("Server-Side Calculation Authority:", "Enforce exact financial calculations on the Node.js backend using minor-currency units and strict decimal rounding.")
add_bullet("ACID Concurrency Protection:", "Prevent double-reservation anomalies using PostgreSQL row-level locks (SELECT ... FOR UPDATE) and transaction rollback.")
add_bullet("Role-Based Security:", "Isolate permissions between ADMIN and SALES_USER roles at the REST API middleware layer.")
add_bullet("Demonstrable Clean UI:", "Deliver a clean, responsive React 18 administrative dashboard covering all 4 core screens with real-time stock visibility.")

# Section 6: Technology Stack
add_h1("6. Technology Stack")
tech_table = doc.add_table(rows=8, cols=3)
tech_table.alignment = WD_TABLE_ALIGNMENT.CENTER
headers = ["Component", "Technology", "Architectural Responsibility"]
for col_idx, text in enumerate(headers):
    cell = tech_table.rows[0].cells[col_idx]
    set_cell_background(cell, "1E293B")
    p = cell.paragraphs[0]
    r = p.add_run(text)
    r.font.bold = True
    r.font.color.rgb = RGBColor(255, 255, 255)
    r.font.size = Pt(9.5)

tech_rows = [
    ("Database Layer", "PostgreSQL (v14+)", "ACID relational persistence, constraints, foreign keys, row locks"),
    ("Backend Runtime", "Node.js (v18+) & Express", "RESTful routing, business logic, transactions, JWT auth"),
    ("Frontend Layer", "React 18 + Vite", "Single-Page Application, state management, responsive UI"),
    ("Authentication", "JWT + bcryptjs", "Stateless bearer authorization, salt-hashed passwords (10 rounds)"),
    ("Schema Validation", "Zod", "Type-safe runtime validation for incoming payloads and parameters"),
    ("Automated Testing", "Jest & Supertest", "Automated test suites for financial math, RBAC, and race conditions"),
    ("API Documentation", "Swagger (OpenAPI 3.0)", "Interactive API explorer hosted natively at /api-docs"),
]

for row_idx, row_data in enumerate(tech_rows):
    row = tech_table.rows[row_idx + 1]
    for col_idx, text in enumerate(row_data):
        cell = row.cells[col_idx]
        set_cell_background(cell, "F8FAFC" if row_idx % 2 == 0 else "FFFFFF")
        set_cell_margins(cell, 80, 80, 120, 120)
        p = cell.paragraphs[0]
        r = p.add_run(text)
        r.font.size = Pt(9)
        if col_idx < 2:
            r.font.bold = True

doc.add_paragraph()

# Section 7: System Architecture
add_h1("7. System Architecture")
add_p("The application adheres to a clean, decoupled 3-tier client-server architecture:")
add_bullet("1. Client Presentation Tier (React.js):", "Communicates via Axios with centralized JWT request interceptors, client-side route guards, and responsive admin dashboard tables.")
add_bullet("2. Application & API Tier (Express.js):", "Handles token verification, role-based authorization, Zod validation, financial calculation engines, and database client checkout.")
add_bullet("3. Data Persistence Tier (PostgreSQL):", "Maintains relational schema integrity, table-level check constraints, foreign-key cascade policies, and row-level locking concurrency.")

add_callout("System Flow Diagram", "User Browser (React UI) ──[HTTPS/REST]──> Express API Gateway (Auth & RBAC) ──[Validation]──> Service Business Logic ──[Connection Pool + Transactions]──> PostgreSQL Database")

# Section 8: Database Design
add_h1("8. Database Design & Relational Schema")
add_p("The database is structured into 12 normalized relational tables with comprehensive primary keys, foreign keys, unique indices, and check constraints.")

add_h2("Relational Tables Overview")
db_entities = [
    ("users", "User master table storing username, bcrypt password hash, full name, and role ('ADMIN' or 'SALES_USER')."),
    ("customers", "Commercial accounts containing company name, contact person, phone, email, and city."),
    ("products", "Product master catalog with unique product code, product name, category, unit, and base price."),
    ("inventory", "Maintains physical_quantity and reserved_quantity. Available quantity is dynamically evaluated as (physical - reserved). Contains check constraint chk_available_qty enforcing physical >= reserved."),
    ("enquiries & items", "Header and itemized relational tables tracking customer requests, required dates, and requested quantities."),
    ("quotations & items", "Commercial quotes with unit prices, discounts (0-100%), GST rates, and itemized subtotal, discount, tax, and line amounts."),
    ("sales_orders & items", "Official orders generated from accepted quotations. Contains UNIQUE(quotation_id) preventing duplicate order creation."),
    ("dispatches & items", "Fulfillment delivery records storing unique dispatch number, vehicle number, and driver name. Contains UNIQUE(sales_order_id)."),
]

for name, desc in db_entities:
    add_bullet(name + ":", desc)

# Section 9: Seed Industrial Products
add_h2("Industrial Products Master Catalog")
add_p("The application seeds 6 realistic industrial products with initial stock numbers mirroring the case study requirements:")

prod_table = doc.add_table(rows=7, cols=7)
prod_table.alignment = WD_TABLE_ALIGNMENT.CENTER
prod_headers = ["Code", "Product Name", "Category", "Unit", "Base Price", "Physical", "Reserved"]
for col_idx, text in enumerate(prod_headers):
    cell = prod_table.rows[0].cells[col_idx]
    set_cell_background(cell, "1E293B")
    p = cell.paragraphs[0]
    r = p.add_run(text)
    r.font.bold = True
    r.font.color.rgb = RGBColor(255, 255, 255)
    r.font.size = Pt(8.5)

prod_rows = [
    ("IND-BRG-001", "Industrial Bearing 6205-2RS", "Bearings", "PCS", "₹450.00", "200", "60 (Avail: 140)"),
    ("HYD-PMP-002", "Hydraulic Pump HP-35", "Hydraulics", "SET", "₹8,500.00", "50", "10 (Avail: 40)"),
    ("STL-GAR-003", "Steel Gear Assembly SGA-12", "Transmission", "SET", "₹3,200.00", "120", "30 (Avail: 90)"),
    ("CNV-BLT-004", "Heavy Conveyor Belt 500mm", "Conveyors", "MTR", "₹1,250.00", "300", "50 (Avail: 250)"),
    ("IND-MTR-005", "Three-Phase Motor 5HP", "Motors", "PCS", "₹14,500.00", "40", "5 (Avail: 35)"),
    ("PRS-VLV-006", "High Pressure Valve PV-10", "Valves", "PCS", "₹1,800.00", "150", "20 (Avail: 130)"),
]

for row_idx, row_data in enumerate(prod_rows):
    row = prod_table.rows[row_idx + 1]
    for col_idx, text in enumerate(row_data):
        cell = row.cells[col_idx]
        set_cell_background(cell, "F8FAFC" if row_idx % 2 == 0 else "FFFFFF")
        set_cell_margins(cell, 60, 60, 100, 100)
        p = cell.paragraphs[0]
        r = p.add_run(text)
        r.font.size = Pt(8)

doc.add_paragraph()

# Section 10: Complete Business Workflow
add_h1("10. Complete Business Workflow")
add_p("The ERP application models the commercial and fulfillment process through five traceable stages:")

add_h2("Stage 1: Customer Enquiry Creation")
add_p("A Sales User logs in, selects an existing customer (or creates a new business account), and records required delivery dates and requested products with target quantities. A unique enquiry number (e.g. ENQ-20260917-0001) is generated, and the enquiry is stored with initial status 'NEW'.")

add_h2("Stage 2: Commercial Quotation & Financial Calculation")
add_p("The Sales User generates a formal Quotation against the enquiry. While the React interface provides interactive client-side calculation previews, the Express backend acts as the sole financial authority, applying the exact calculation pipeline:")
add_bullet("Base Amount:", "Quantity × Agreed Unit Price")
add_bullet("Discount Amount:", "(Base Amount × Discount %) ÷ 100")
add_bullet("Taxable Amount:", "Base Amount − Discount Amount")
add_bullet("GST Amount:", "(Taxable Amount × GST %) ÷ 100 (Standard 18%)")
add_bullet("Line Total:", "Taxable Amount + GST Amount")
add_bullet("Grand Total:", "Sum of all line item totals")
add_p("The quotation is initially created in 'DRAFT' status and can be transitioned to 'SENT', 'ACCEPTED', or 'REJECTED'. Accepting a quotation automatically flags the parent enquiry as 'WON'.")

add_h2("Stage 3: Quotation Conversion to Sales Order")
add_p("Only an 'ACCEPTED' quotation can be converted into an official Sales Order. The backend rejects attempts to convert 'DRAFT' or 'REJECTED' quotations with HTTP 400/409 errors. The UNIQUE(quotation_id) constraint and transactional row checking guarantee that the same quotation can never produce duplicate sales orders. Converted orders enter the system in 'PENDING' status.")

add_h2("Stage 4: Inventory Reservation & Order Confirmation (Admin Only)")
add_p("When an Administrator clicks 'Confirm & Reserve', the system initiates the core concurrency protection protocol. It acquires an exclusive row-level lock on the target sales order and locks all required inventory rows in consistent ascending product order (ORDER BY product_id ASC). If available stock (Physical − Reserved) is sufficient for all items, reserved quantities are incremented atomically, and the order status becomes 'CONFIRMED'. If any product lacks inventory, the transaction rolls back completely with zero partial allocations.")

add_h2("Stage 5: Physical Dispatch & Stock Fulfillment (Admin Only)")
add_p("When goods leave the factory, the Administrator processes dispatch by recording the transport vehicle number and driver name. In an atomic transaction, the system decreases both physical_quantity and reserved_quantity by the order quantity, marks the order 'DISPATCHED', generates a unique dispatch tracking number (DSP-YYYYMMDD-XXXX), and preserves historical line item records.")

# Section 11: Inventory Reservation & Concurrency Logic
add_h1("13. Inventory Reservation & Concurrency Logic")
add_p("Inventory reservation is the most critical business requirement of the ERP application. When concurrent orders arrive for limited stock, naive systems suffer from race conditions that cause negative inventory.")

add_h2("The Simultaneous Reservation Race Condition")
add_p("Scenario: Available Stock = 100 units. User A requests 80 units, and User B requests 50 units at the exact same millisecond. In an uncoordinated database, both read Available = 100, both proceed to reserve, resulting in 130 reserved units against 100 physical units.")

add_h2("Our Technical Solution")
add_bullet("1. Explicit Transaction Scoping:", "All operations run inside BEGIN ... COMMIT / ROLLBACK.")
add_bullet("2. Ordered Row-Level Locking:", "Inventory rows are queried using SELECT ... FOR UPDATE ordered strictly by product_id ASC. Consistent lock ordering prevents deadlocks between concurrent multi-item transactions.")
add_bullet("3. All-or-Nothing Stock Verification:", "The backend checks Available = Physical − Reserved >= Required for every order item. If a single product is short by even 1 unit, the entire transaction rolls back.")
add_bullet("4. Double Confirmation Prevention:", "The Sales Order status is verified inside the row lock. Once CONFIRMED, subsequent confirmation calls are rejected immediately.")

# Section 12: Automated Testing
add_h1("15. Testing & Verification Results")
add_p("The backend includes an automated test suite executed with Jest and Supertest. All 13 tests passed successfully with 100% pass rate:")

test_table = doc.add_table(rows=14, cols=4)
test_table.alignment = WD_TABLE_ALIGNMENT.CENTER
test_headers = ["Test ID", "Test Scope", "Verification Objective", "Status"]
for col_idx, text in enumerate(test_headers):
    cell = test_table.rows[0].cells[col_idx]
    set_cell_background(cell, "1E293B")
    p = cell.paragraphs[0]
    r = p.add_run(text)
    r.font.bold = True
    r.font.color.rgb = RGBColor(255, 255, 255)
    r.font.size = Pt(8.5)

test_rows = [
    ("TEST 1", "Calculator Unit", "Accurately calculates line item Base, Discount %, 18% GST, and Line Total", "PASS"),
    ("TEST 1b", "Calculator Unit", "Accurately calculates multi-item quotation grand totals", "PASS"),
    ("TEST 1c", "Calculator Unit", "Rejects negative prices, zero quantities, and out-of-bounds percentages", "PASS"),
    ("TEST 2", "Business Logic", "Enforces that DRAFT quotation cannot create a Sales Order", "PASS"),
    ("TEST 2b", "Business Logic", "Enforces that REJECTED quotation cannot create a Sales Order", "PASS"),
    ("TEST 3", "Business Logic", "Enforces that the same quotation cannot generate duplicate Sales Orders", "PASS"),
    ("TEST 4", "Business Logic", "Cannot reserve more than available inventory (Physical − Reserved)", "PASS"),
    ("TEST 4b", "Business Logic", "Atomic dispatch decreases physical and reserved stock correctly", "PASS"),
    ("TEST 5", "Security / RBAC", "Rejects unauthenticated requests with HTTP 401 Unauthorized", "PASS"),
    ("TEST 5b", "Security / RBAC", "Rejects SALES_USER from confirming Sales Orders with HTTP 403 Forbidden", "PASS"),
    ("TEST 5c", "Security / RBAC", "Rejects SALES_USER from processing dispatch with HTTP 403 Forbidden", "PASS"),
    ("TEST 5d", "Security / RBAC", "Rejects SALES_USER from creating products master with HTTP 403 Forbidden", "PASS"),
    ("BONUS", "Concurrency Test", "Simultaneous requests: User A (80 units) & User B (50 units) on 100 stock. Only 1 succeeds", "PASS"),
]

for row_idx, row_data in enumerate(test_rows):
    row = test_table.rows[row_idx + 1]
    for col_idx, text in enumerate(row_data):
        cell = row.cells[col_idx]
        set_cell_background(cell, "F8FAFC" if row_idx % 2 == 0 else "FFFFFF")
        set_cell_margins(cell, 60, 60, 100, 100)
        p = cell.paragraphs[0]
        r = p.add_run(text)
        r.font.size = Pt(8)
        if col_idx == 3:
            r.font.bold = True
            r.font.color.rgb = RGBColor(5, 150, 105) # Green

doc.add_paragraph()

# Section 13: Setup & Startup Commands
add_h1("16. Setup, Configuration & Startup Guide")
add_p("The application is configured for standard npm workflows with cross-platform wrappers:")
add_bullet("1. Clone / Open Project:", "cd \"Fundsroom Casestudy 2\"")
add_bullet("2. Configure Environment:", "Set DATABASE_URL, JWT_SECRET in backend/.env")
add_bullet("3. Install Dependencies:", "cd backend && npm install && cd ../frontend && npm install")
add_bullet("4. Run Migrations & Seeds:", "cd backend && npm run db:setup")
add_bullet("5. Run Test Suite:", "cd backend && npm test")
add_bullet("6. Launch Backend Server:", "cd backend && npm run dev (Runs on http://localhost:5000)")
add_bullet("7. Launch Frontend App:", "cd frontend && npm run dev (Runs on http://localhost:5173)")

# Section 14: Screenshots & Interface
add_h1("17. Application Screenshots & Interface Walkthrough")
add_p("Below are structural placeholders representing the fully implemented React 18 administrative views:")
add_bullet("[Screenshot Placeholder 1 - Login Screen]:", "Clean split card with username, password inputs, and 1-click test login buttons for Admin and Sales User.")
add_bullet("[Screenshot Placeholder 2 - Enquiries Screen]:", "Data table with search, status filters, and multi-product creation modal displaying live available stock pills.")
add_bullet("[Screenshot Placeholder 3 - Quotations Screen]:", "Financial quote management table showing Itemized Calculations, Accept/Reject buttons, and 1-click 'Convert to Order' action.")
add_bullet("[Screenshot Placeholder 4 - Sales Orders & Stock Screen]:", "Real-time 6-product inventory widget (Physical, Reserved, Available), PENDING orders with 'Confirm & Reserve' button, and CONFIRMED orders with 'Dispatch' modal.")

# Section 15: Challenges & Solutions
add_h1("18. Technical Challenges & Implemented Solutions")
add_bullet("Challenge 1: IEEE-754 Floating-Point Inaccuracies in Currency:", "Solution: Built dedicated calculation engine in backend/src/utils/calculator.js using integer minor units (Math.round((val + EPSILON) * 100) / 100). The backend strictly recalculates all line totals, taxable amounts, and GST before persisting.")
add_bullet("Challenge 2: Database Deadlocks under Multi-Product Orders:", "Solution: When locking multiple inventory rows, product IDs are extracted and sorted in strict ascending numerical order (ORDER BY product_id ASC) prior to issuing SELECT ... FOR UPDATE. This eliminates cyclic lock dependencies across concurrent sessions.")
add_bullet("Challenge 3: Idempotent Quotation Conversion:", "Solution: Placed a database UNIQUE(quotation_id) constraint on the sales_orders table combined with application-level transaction locking to guarantee that rapid double-clicks never create duplicate orders.")

# Section 16: Assumptions & Limitations
add_h1("19. Assumptions & Limitations")
add_bullet("Full-Order Dispatch:", "In accordance with the case study guidelines, partial dispatch is intentionally not implemented. Orders are dispatched in full to maintain clear stock auditability.")
add_bullet("Stock Addition Workflow:", "Initial inventory quantities are seeded via migration scripts. Administrators can adjust physical stock through the PATCH /api/inventory/:productId/stock endpoint.")
add_bullet("Currency Standard:", "All transactions are modeled in Indian Rupees (INR) with standard 18% GST.")

# Section 17: Conclusion
add_h1("20. Conclusion & Future Roadmap")
add_p("The Fundsroom PERN Stack ERP application fulfills all functional, architectural, and business workflow requirements specified in the case study. By prioritizing database consistency, transaction safety, and backend authorization over superficial UI animations, the system demonstrates the core engineering values required for enterprise software development.")
add_p("Potential future extensions include automated PDF invoice generation, multi-warehouse location tracking, partial dispatch with back-order management, and email notifications for customer quotations.")

# Save Word Document
docx_path = r"c:\Mine\Projects\Fundsroom Casestudy 2\ERP_Case_Study_Documentation.docx"
doc.save(docx_path)
print(f"[SUCCESS] Microsoft Word document successfully created at: {docx_path}")


# ==============================================================================
# PART 2: PROFESSIONAL PDF GENERATION USING ReportLab
# ==============================================================================

pdf_path = r"c:\Mine\Projects\Fundsroom Casestudy 2\ERP_Case_Study_Documentation.pdf"

class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print total page numbers"""
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            canvas.Canvas.showPage(self)
        canvas.Canvas.save(self)

    def draw_page_number(self, page_count):
        if self._pageNumber > 1: # Suppress headers/footers on cover page
            self.saveState()
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748B"))
            
            # Running Header
            self.drawString(54, 11 * 72 - 36, "Fundsroom PERN ERP — Technical Case Study Documentation")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(54, 11 * 72 - 42, 8.5 * 72 - 54, 11 * 72 - 42)
            
            # Running Footer
            page_str = f"Page {self._pageNumber} of {page_count}"
            self.drawRightString(8.5 * 72 - 54, 36, page_str)
            self.drawString(54, 36, "Candidate: Bhargav Reddy • PERN Stack • September 2026")
            self.line(54, 48, 8.5 * 72 - 54, 48)
            self.restoreState()

doc_pdf = SimpleDocTemplate(
    pdf_path,
    pagesize=letter,
    leftMargin=54,
    rightMargin=54,
    topMargin=54,
    bottomMargin=54
)

styles = getSampleStyleSheet()

# Custom styles
style_title = ParagraphStyle(
    'DocTitle',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=24,
    leading=30,
    textColor=colors.HexColor('#0F172A'),
    alignment=1, # Center
)

style_subtitle = ParagraphStyle(
    'DocSubTitle',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=11,
    leading=16,
    textColor=colors.HexColor('#64748B'),
    alignment=1,
)

style_badge = ParagraphStyle(
    'DocBadge',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=10,
    leading=12,
    textColor=colors.HexColor('#2563EB'),
    alignment=1,
)

style_h1 = ParagraphStyle(
    'SectionH1',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=15,
    leading=20,
    textColor=colors.HexColor('#1E293B'),
    spaceBefore=14,
    spaceAfter=6,
    keepWithNext=True,
)

style_h2 = ParagraphStyle(
    'SectionH2',
    parent=styles['Normal'],
    fontName='Helvetica-Bold',
    fontSize=12,
    leading=16,
    textColor=colors.HexColor('#2563EB'),
    spaceBefore=10,
    spaceAfter=4,
    keepWithNext=True,
)

style_body = ParagraphStyle(
    'DocBody',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=9.5,
    leading=14,
    textColor=colors.HexColor('#334155'),
    spaceAfter=6,
)

style_bullet = ParagraphStyle(
    'DocBullet',
    parent=styles['Normal'],
    fontName='Helvetica',
    fontSize=9,
    leading=13,
    textColor=colors.HexColor('#334155'),
    leftIndent=15,
    spaceAfter=3,
)

style_code = ParagraphStyle(
    'DocCode',
    parent=styles['Normal'],
    fontName='Courier',
    fontSize=8,
    leading=11,
    textColor=colors.HexColor('#1E293B'),
)

story = []

# COVER PAGE
story.append(Spacer(1, 40))
story.append(Paragraph("TECHNICAL CASE STUDY SUBMISSION", style_badge))
story.append(Spacer(1, 15))
story.append(Paragraph("ERP Application – Full-Stack Developer Case Study", style_title))
story.append(Spacer(1, 10))
story.append(Paragraph("Industrial Manufacturing & Supply Chain Workflow System<br/>End-to-End Business Flow: Enquiry → Quotation → Sales Order → Reservation → Dispatch", style_subtitle))
story.append(Spacer(1, 40))

# Metadata Table
cover_meta = [
    [Paragraph("<b>Candidate Name:</b>", style_body), Paragraph("Bhargav Reddy", style_body)],
    [Paragraph("<b>Role Evaluated:</b>", style_body), Paragraph("Full-Stack Developer", style_body)],
    [Paragraph("<b>Technology Stack:</b>", style_body), Paragraph("PERN (PostgreSQL, Express.js, React.js, Node.js)", style_body)],
    [Paragraph("<b>Submission Date:</b>", style_body), Paragraph("September 17, 2026", style_body)],
    [Paragraph("<b>Project Domain:</b>", style_body), Paragraph("Industrial Manufacturing & Supply Chain ERP", style_body)],
    [Paragraph("<b>Repository Scope:</b>", style_body), Paragraph("Full Working Implementation, Tests & API Documentation", style_body)],
]
t_cover = Table(cover_meta, colWidths=[140, 360])
t_cover.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#F8FAFC')),
    ('BACKGROUND', (1, 0), (1, -1), colors.HexColor('#FFFFFF')),
    ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
    ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
    ('TOPPADDING', (0, 0), (-1, -1), 8),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ('LEFTPADDING', (0, 0), (-1, -1), 12),
    ('RIGHTPADDING', (0, 0), (-1, -1), 12),
]))
story.append(t_cover)
story.append(PageBreak())

# SECTION: TABLE OF CONTENTS
story.append(Paragraph("Table of Contents", style_h1))
story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#2563EB'), spaceBefore=2, spaceAfter=8))

for item in toc_items:
    story.append(Paragraph(f"• {item}", style_bullet))
story.append(PageBreak())

# SECTION: INTRODUCTION & PROBLEM STATEMENT
story.append(Paragraph("3. Introduction & Business Context", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=2, spaceAfter=8))
story.append(Paragraph("In modern industrial manufacturing and B2B distribution environments, commercial transactions require strict coordination between sales negotiations, contract management, credit terms, and physical inventory control. Unlike consumer e-commerce where orders are paid instantly and stock is immediately subtracted, business-to-business transactions operate through multi-stage commercial workflows.", style_body))
story.append(Paragraph("This Enterprise Resource Planning (ERP) application provides a robust, production-grade technical implementation of the complete sales-to-fulfillment lifecycle for an industrial supply company. Developed using the PERN technology stack (PostgreSQL, Express.js, React.js, and Node.js), the platform guarantees data integrity, exact monetary accuracy, row-level concurrency protection, and role-based administrative governance.", style_body))

story.append(Paragraph("4. Problem Statement & Business Challenges", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=2, spaceAfter=8))
story.append(Paragraph("Industrial suppliers frequently suffer from fragmented communication between sales representatives and warehouse managers. This leads to severe business vulnerabilities:", style_body))
story.append(Paragraph("<b>• Stock Over-Allocation & Overselling:</b> When multiple sales reps accept quotations against the same physical stock without synchronous inventory reservations, orders get confirmed that the warehouse cannot fulfill.", style_bullet))
story.append(Paragraph("<b>• Floating-Point Drift in Quotations:</b> Relying on client-side or unsafe floating-point calculations results in billing errors across quantities, discounts, and multi-tier Goods and Services Tax (GST).", style_bullet))
story.append(Paragraph("<b>• Loss of Audit Traceability:</b> In the absence of a relational schema, companies cannot trace customer enquiries to quotations, confirmed orders, and physical vehicle dispatches.", style_bullet))
story.append(Paragraph("<b>• Unauthorized Administrative Actions:</b> Without backend-enforced RBAC, sales personnel can confirm orders or ship stock without credit or inventory authorization.", style_bullet))

story.append(Paragraph("5. Project Objectives", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=2, spaceAfter=8))
story.append(Paragraph("<b>• Traceable Business Workflow:</b> Customer Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch.", style_bullet))
story.append(Paragraph("<b>• Server-Side Calculation Authority:</b> Enforce exact financial calculations on Node.js using minor-currency units.", style_bullet))
story.append(Paragraph("<b>• ACID Concurrency Protection:</b> Prevent double-reservation anomalies using SELECT ... FOR UPDATE row locks.", style_bullet))
story.append(Paragraph("<b>• Role-Based Security:</b> Isolate permissions between ADMIN and SALES_USER at the Express API layer.", style_bullet))
story.append(Paragraph("<b>• Demonstrable Clean UI:</b> Deliver a responsive React 18 administrative dashboard covering all 4 core screens.", style_bullet))

story.append(PageBreak())

# SECTION: TECHNOLOGY STACK & ARCHITECTURE
story.append(Paragraph("6. Technology Stack", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=2, spaceAfter=8))

t_stack_data = [
    [Paragraph("<b>Component</b>", style_body), Paragraph("<b>Technology</b>", style_body), Paragraph("<b>Architectural Responsibility</b>", style_body)]
]
for row in tech_rows:
    t_stack_data.append([
        Paragraph(f"<b>{row[0]}</b>", style_body),
        Paragraph(row[1], style_body),
        Paragraph(row[2], style_body),
    ])

t_stack = Table(t_stack_data, colWidths=[100, 130, 270])
t_stack.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#F8FAFC'), colors.white]),
]))
story.append(t_stack)
story.append(Spacer(1, 15))

story.append(Paragraph("7. System Architecture", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=2, spaceAfter=8))
story.append(Paragraph("The platform operates as a 3-tier decoupled architecture:", style_body))
story.append(Paragraph("<b>1. Presentation Layer (React 18 SPA):</b> Vite-bundled single-page application with Axios interceptors managing JWT tokens, real-time inventory polling, and interactive state.", style_bullet))
story.append(Paragraph("<b>2. Application Layer (Express REST API):</b> Centralized middleware pipeline enforcing Bearer authentication, RBAC authorization, Zod schema validation, and financial calculations.", style_bullet))
story.append(Paragraph("<b>3. Data Persistence Layer (PostgreSQL):</b> Normalized relational engine executing transactional locking (SELECT ... FOR UPDATE), constraint validations, and indexed queries.", style_bullet))

story.append(Spacer(1, 10))
story.append(Paragraph("8. Seed Industrial Products Master", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=2, spaceAfter=8))

t_prod_data = [
    [Paragraph("<b>Code</b>", style_body), Paragraph("<b>Product Name</b>", style_body), Paragraph("<b>Unit</b>", style_body), Paragraph("<b>Price</b>", style_body), Paragraph("<b>Physical</b>", style_body), Paragraph("<b>Reserved</b>", style_body)]
]
for p in prod_rows:
    t_prod_data.append([
        Paragraph(p[0], style_code),
        Paragraph(p[1], style_body),
        Paragraph(p[3], style_body),
        Paragraph(p[4], style_body),
        Paragraph(p[5], style_body),
        Paragraph(p[6], style_body),
    ])

t_prod = Table(t_prod_data, colWidths=[80, 170, 45, 65, 55, 85])
t_prod.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
    ('TOPPADDING', (0, 0), (-1, -1), 5),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#F8FAFC'), colors.white]),
]))
story.append(t_prod)

story.append(PageBreak())

# SECTION: INVENTORY RESERVATION & CONCURRENCY
story.append(Paragraph("13. Inventory Reservation & Concurrency Logic", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2563EB'), spaceBefore=2, spaceAfter=8))
story.append(Paragraph("Inventory reservation is the central business challenge of this case study. When an Admin confirms a Sales Order, the system must guarantee that stock cannot be double-allocated even under extreme concurrent load.", style_body))

story.append(Paragraph("<b>The Concurrency Challenge:</b>", style_h2))
story.append(Paragraph("Consider available stock = 100 units. User A requests 80 units, and User B requests 50 units simultaneously. Without row locking, both requests read available = 100, both proceed to reserve, resulting in 130 reserved units against 100 physical units. This corrupts physical inventory integrity.", style_body))

story.append(Paragraph("<b>The PostgreSQL Row-Locking Solution:</b>", style_h2))
story.append(Paragraph("Our implementation in <code>backend/src/controllers/salesOrderController.js</code> executes:", style_body))
story.append(Paragraph("<b>1. Explicit Transaction:</b> Initiated via <code>await client.query('BEGIN')</code>.", style_bullet))
story.append(Paragraph("<b>2. Consistent Lock Ordering:</b> Multi-item order product IDs are sorted in ascending order (<code>ORDER BY product_id ASC</code>). This guarantees that concurrent transactions acquire locks in identical sequence, completely preventing database deadlocks.", style_bullet))
story.append(Paragraph("<b>3. Row-Level Exclusive Lock:</b> Executed via:<br/><code>SELECT product_id, physical_quantity, reserved_quantity, (physical_quantity - reserved_quantity) AS available_quantity FROM inventory WHERE product_id = ANY($1) ORDER BY product_id ASC FOR UPDATE;</code>", style_bullet))
story.append(Paragraph("<b>4. All-or-Nothing Rule:</b> Every product is checked against <code>Available >= Required</code>. If any item is insufficient, the entire transaction rolls back immediately with <code>ROLLBACK</code> and returns HTTP 409 Conflict. No partial reservation is ever committed.", style_bullet))
story.append(Paragraph("<b>5. Atomic Reservation:</b> If stock is sufficient, <code>UPDATE inventory SET reserved_quantity = reserved_quantity + $1</code> is executed, order status becomes 'CONFIRMED', and the transaction commits.", style_bullet))

story.append(Spacer(1, 10))
story.append(Paragraph("10. Dispatch Module Logic", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=2, spaceAfter=8))
story.append(Paragraph("When an Admin ships goods from the factory:", style_body))
story.append(Paragraph("• Order must be in <code>CONFIRMED</code> status (cannot dispatch PENDING or CANCELLED orders).", style_bullet))
story.append(Paragraph("• Transport details (Vehicle Registration Number & Driver Name) are recorded.", style_bullet))
story.append(Paragraph("• In an atomic transaction, <b>both</b> Physical Quantity and Reserved Quantity decrease by the order quantity.", style_bullet))
story.append(Paragraph("• Notice that Available Quantity remains unchanged: <i>Available = (Physical - Qty) - (Reserved - Qty) = Physical - Reserved</i>.", style_bullet))
story.append(Paragraph("• Generates a unique dispatch tracking number (e.g. <code>DSP-20260917-0001</code>) and marks order <code>DISPATCHED</code>.", style_bullet))

story.append(PageBreak())

# SECTION: TESTING RESULTS
story.append(Paragraph("15. Automated Testing Suite & Verification", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#2563EB'), spaceBefore=2, spaceAfter=8))
story.append(Paragraph("The application includes 13 automated tests covering all mandatory case study scenarios and bonus concurrency race conditions. All 13 tests passed successfully with 100% pass rate:", style_body))

t_test_data = [
    [Paragraph("<b>Test ID</b>", style_body), Paragraph("<b>Test Suite</b>", style_body), Paragraph("<b>Verification Objective</b>", style_body), Paragraph("<b>Result</b>", style_body)]
]
for t in test_rows:
    t_test_data.append([
        Paragraph(f"<b>{t[0]}</b>", style_body),
        Paragraph(t[1], style_body),
        Paragraph(t[2], style_body),
        Paragraph(f"<font color='#059669'><b>{t[3]}</b></font>", style_body),
    ])

t_test = Table(t_test_data, colWidths=[65, 95, 280, 60])
t_test.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1E293B')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#F8FAFC'), colors.white]),
]))
story.append(t_test)

story.append(Spacer(1, 15))
story.append(Paragraph("16. Setup, Configuration & Startup Guide", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=2, spaceAfter=8))
story.append(Paragraph("<b>Prerequisites:</b> Node.js (v18+) and PostgreSQL (v14+) or a free cloud database (Neon/Supabase).", style_body))
story.append(Paragraph("<code>1. Database Setup: cd backend && npm run db:setup</code> (Creates database, schema, and seeds)", style_bullet))
story.append(Paragraph("<code>2. Run Tests:      cd backend && npm test</code> (Executes all 13 automated tests)", style_bullet))
story.append(Paragraph("<code>3. Start Backend:  cd backend && npm run dev</code> (API runs on http://localhost:5000)", style_bullet))
story.append(Paragraph("<code>4. Start Frontend: cd frontend && npm run dev</code> (React app on http://localhost:5173)", style_bullet))
story.append(Paragraph("<b>Test Credentials:</b><br/>• Admin: <code>admin</code> / <code>Admin@123</code> (Role: ADMIN)<br/>• Sales User: <code>sales</code> / <code>Sales@123</code> (Role: SALES_USER)", style_body))

story.append(Spacer(1, 10))
story.append(Paragraph("20. Conclusion", style_h1))
story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#CBD5E1'), spaceBefore=2, spaceAfter=8))
story.append(Paragraph("The Fundsroom PERN Stack ERP application fulfills all functional, architectural, and business workflow requirements specified in the case study. By prioritizing database consistency, transaction safety, and backend authorization over superficial UI animations, the system demonstrates the core engineering values required for enterprise software development.", style_body))

# Build PDF with dynamic page numbering
doc_pdf.build(story, canvasmaker=NumberedCanvas)
print(f"[SUCCESS] PDF document successfully created at: {pdf_path}")
print("Case Study Documentation complete!")
