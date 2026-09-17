import { test, expect } from '@playwright/test';

test.describe('Fundsroom ERP - Strict End-to-End Workflow Audit', () => {
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test('1. Authentication & Role-Based UI Display', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await expect(page).toHaveTitle(/Fundsroom ERP/);

    // Test invalid credentials
    await page.fill('input[placeholder="Enter username"]', 'invalid_user');
    await page.fill('input[placeholder="Enter password"]', 'wrong_password');
    await page.click('button[type="submit"]');
    
    // STRICT ASSERTION: Error alert must be shown
    const errorAlert = page.locator('.alert-error');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
    await expect(errorAlert).toContainText(/Invalid username or password/i);

    // Test quick login as Sales User
    await page.click('text=Sales User (sales / Sales@123)');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/enquiries', { timeout: 10000 });
    
    // STRICT ASSERTION: User role badge must be SALES_USER
    await expect(page.locator('.user-role-badge')).toHaveText('SALES_USER');

    // STRICT ASSERTION: Sales User MUST NOT see Admin action buttons on sales orders
    await page.goto('http://localhost:5173/sales-orders');
    await expect(page.locator('button:has-text("Confirm & Reserve")')).toHaveCount(0);
  });

  test('2. Strict Complete Business Flow: Enquiry -> Quotation -> Conversion -> Admin Confirm -> Dispatch', async ({ page }) => {
    // -------------------------------------------------------------
    // STEP 1: Login as Sales User
    // -------------------------------------------------------------
    await page.goto('http://localhost:5173/login');
    await page.click('text=Sales User (sales / Sales@123)');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/enquiries', { timeout: 10000 });
    await expect(page.locator('.user-role-badge')).toHaveText('SALES_USER');

    // -------------------------------------------------------------
    // STEP 2: Create a Multi-Product Customer Enquiry
    // -------------------------------------------------------------
    const newEnqBtn = page.locator('button:has-text("New Enquiry")');
    await expect(newEnqBtn).toBeVisible();
    await newEnqBtn.click();

    const enqModal = page.locator('.modal-title');
    await expect(enqModal).toHaveText('Create Customer Enquiry');

    // Select customer (Option 1)
    await page.selectOption('select:has-text("Select Customer")', { index: 1 });
    
    // Required delivery date (14 days ahead)
    const reqDate = new Date();
    reqDate.setDate(reqDate.getDate() + 14);
    await page.fill('input[type="date"]', reqDate.toISOString().slice(0, 10));

    // Notes
    await page.fill('textarea[placeholder*="Additional commercial notes"]', 'E2E Strict Pipeline Requirement');

    // Select Product 1 (IND-BRG-001) & set quantity (5 units)
    const productSelects = page.locator('table.items-table select');
    await productSelects.nth(0).selectOption('1');
    await page.fill('table.items-table input[type="number"]', '5');

    // Add Product 2 (CNV-BLT-004) & set quantity (2 units)
    const addProdBtn = page.locator('button:has-text("+ Add Product")');
    await expect(addProdBtn).toBeVisible();
    await addProdBtn.click();

    await expect(productSelects.nth(1)).toBeVisible();
    await productSelects.nth(1).selectOption('4');
    const qtyInputs = page.locator('table.items-table input[type="number"]');
    await qtyInputs.nth(1).fill('2');

    // Submit Enquiry - STRICT ASSERTION
    const saveEnqBtn = page.locator('button:has-text("Save Enquiry")');
    await expect(saveEnqBtn).toBeVisible();
    await saveEnqBtn.click();

    const enqSuccessAlert = page.locator('.alert-success');
    await expect(enqSuccessAlert).toBeVisible({ timeout: 10000 });
    await expect(enqSuccessAlert).toContainText(/Enquiry ENQ-.*created successfully/i);

    // -------------------------------------------------------------
    // STEP 3: Create Quotation against Enquiry
    // -------------------------------------------------------------
    const quoteBtn = page.locator('button:has-text("Quote")').first();
    await expect(quoteBtn).toBeVisible();
    await quoteBtn.click();

    await page.waitForURL('**/quotations?**', { timeout: 10000 });
    await expect(page.locator('.modal-title')).toHaveText('Generate Commercial Quotation');

    // Verify calculation preview is rendered
    await expect(page.locator('text=Estimated Grand Total')).toBeVisible();

    // Submit Quotation - STRICT ASSERTION
    const createDraftBtn = page.locator('button:has-text("Create Quotation (Draft)")');
    await expect(createDraftBtn).toBeVisible();
    await createDraftBtn.click();

    const quoSuccessAlert = page.locator('.alert-success');
    await expect(quoSuccessAlert).toBeVisible({ timeout: 10000 });
    await expect(quoSuccessAlert).toContainText(/Quotation QUO-.*created successfully/i);

    // -------------------------------------------------------------
    // STEP 4: Send and Accept Quotation (DRAFT -> SENT -> ACCEPTED)
    // -------------------------------------------------------------
    // 4a. Mark as SENT
    const sendBtn = page.locator('button:has-text("Send")').first();
    await expect(sendBtn).toBeVisible({ timeout: 5000 });
    await sendBtn.click();
    await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });

    // 4b. Mark as ACCEPTED
    const acceptBtn = page.locator('button[title="Mark as Accepted by Customer"]').first();
    await expect(acceptBtn).toBeVisible({ timeout: 5000 });
    await acceptBtn.click();
    await expect(page.locator('.alert-success')).toBeVisible({ timeout: 10000 });

    // -------------------------------------------------------------
    // STEP 5: Convert Accepted Quotation to Sales Order
    // -------------------------------------------------------------
    page.once('dialog', (dialog) => dialog.accept());
    const convertBtn = page.locator('button:has-text("Convert to Order")').first();
    await expect(convertBtn).toBeVisible();
    await convertBtn.click();

    await page.waitForURL('**/sales-orders', { timeout: 10000 });
    await expect(page.locator('.page-title')).toHaveText('Sales Orders & Inventory');

    // -------------------------------------------------------------
    // STEP 6: Logout Sales User & Login as Admin
    // -------------------------------------------------------------
    const logoutBtn = page.locator('button:has-text("Logout")');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    await page.waitForURL('**/login', { timeout: 10000 });

    await page.click('text=Admin (admin / Admin@123)');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sales-orders', { timeout: 10000 });
    await expect(page.locator('.user-role-badge')).toHaveText('ADMIN');

    // -------------------------------------------------------------
    // STEP 7: Confirm Order & Reserve Inventory (Admin)
    // -------------------------------------------------------------
    await expect(page.locator('text=Real-Time Inventory Stock Master')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    const confirmBtn = page.locator('button:has-text("Confirm & Reserve")').first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    const confirmSuccessAlert = page.locator('.alert-success');
    await expect(confirmSuccessAlert).toBeVisible({ timeout: 10000 });
    await expect(confirmSuccessAlert).toContainText(/confirmed successfully.*reserved/i);

    // -------------------------------------------------------------
    // STEP 8: Dispatch Order (Admin)
    // -------------------------------------------------------------
    const dispatchBtn = page.locator('button:has-text("Dispatch")').first();
    await expect(dispatchBtn).toBeVisible({ timeout: 5000 });
    await dispatchBtn.click();

    await expect(page.locator('.modal-title')).toContainText('Process Dispatch');

    await page.fill('input[placeholder*="MH-12-AB-9876"]', 'DL-01-AB-1234');
    await page.fill('input[placeholder*="Ramesh Kumar"]', 'Mohan Lal');

    const confirmDispatchBtn = page.locator('button:has-text("Confirm Dispatch & Update Stock")');
    await expect(confirmDispatchBtn).toBeVisible();
    await confirmDispatchBtn.click();

    const dispatchSuccessAlert = page.locator('.alert-success');
    await expect(dispatchSuccessAlert).toBeVisible({ timeout: 10000 });
    await expect(dispatchSuccessAlert).toContainText(/dispatched successfully/i);

    // -------------------------------------------------------------
    // STEP 9: Check Console Errors
    // -------------------------------------------------------------
    const filteredErrors = consoleErrors.filter((e) => !e.includes('favicon'));
    expect(filteredErrors).toHaveLength(0);
  });

  test('3. Page Refresh & Session State Persistence', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    await page.click('text=Admin (admin / Admin@123)');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/sales-orders', { timeout: 10000 });

    await page.reload();
    await expect(page.locator('.user-role-badge')).toHaveText('ADMIN');
    await expect(page.locator('.page-title')).toHaveText('Sales Orders & Inventory');
  });
});
