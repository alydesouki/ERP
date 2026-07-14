# Modules Documentation

> Each module fully documented: purpose, features, user flow, database tables, APIs, and dependencies.

---

## Module 1: POS / Point of Sale

**Page:** [`pos.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/pos.tsx) (40 KB)  
**API Route:** [`routes/sales.ts`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/src/routes/sales.ts)  
**Permission:** `sales.create`

### Purpose
The primary cashier terminal. Enables quick product lookup by barcode scan or search, building a cart, applying discounts, accepting multiple payment methods, and completing a sale in one atomic transaction.

### Features
- Barcode scanner input (keyboard wedge)
- Product search by name / barcode / SKU
- Cart: add/remove items, edit quantities, per-item discounts
- Invoice-level discount
- Tax calculation
- Multiple payment methods: Cash, Card, InstaPay, Wallet, Credit (on account)
- Credit sales with customer selection + credit limit enforcement
- Change calculation for cash payments
- Suspend and resume parked carts
- Print thermal receipt after checkout
- Customer selection for credit or loyalty

### User Flow
```
Open POS → Select warehouse → Scan/search product → Add to cart → 
Apply discount (optional) → Select customer (if credit) → 
Choose payment method(s) → Checkout → Print receipt
```

### Database Tables
- `invoices` (header)
- `invoice_items` (line items)
- `invoice_payments` (payment tenders)
- `inventory_items` (stock deducted)
- `inventory_movements` (SALE movement recorded)
- `treasury_transactions` (cash/card IN)
- `customer_transactions` (if credit)
- `accounting_transactions` + `accounting_transaction_lines`
- `suspended_orders` (parked carts)

---

## Module 2: Sales History

**Page:** [`sales-history.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/sales-history.tsx)  
**Permission:** `sales.view`

### Purpose
Browse and search all completed sales invoices. View full invoice detail including items, payments, and whether returns have been processed.

### Features
- Paginated invoice list
- Filter by: date range, customer, payment status (PAID/PARTIAL/UNPAID)
- Search by invoice number or barcode
- Invoice detail drawer: items, payments, return status
- Print/reprint receipt

---

## Module 3: Sales Returns

**Page:** [`sales-returns.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/sales-returns.tsx)  
**Permission:** `sales.return`

### Purpose
Process returned merchandise from customers. Looks up the original invoice by number/barcode, allows selecting which items to return, and processes a refund back to a treasury account or customer credit.

### Features
- Invoice lookup by scan/number
- Select specific items and quantities to return
- Partial returns supported
- Refund method: Cash, Card, InstaPay, Wallet, Credit
- Restocks inventory at original warehouse
- Reverses accounting entries

---

## Module 4: Purchases

**Page:** [`purchases.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/purchases.tsx) (38 KB)  
**Permission:** `purchases.view` / `purchases.create`

### Purpose
Manage purchase invoices from suppliers. Receive stock into a warehouse, record cost prices, and track payment to suppliers (full, partial, or credit).

### Features
- Create purchase invoice: supplier, warehouse, items+quantities+cost
- Receive goods: inventory immediately increased on creation
- Payment: multiple methods, partial payment increases supplier balance
- Supplier's own invoice number reference
- Invoice date and due date tracking
- View purchase history with filters

### Database Tables
- `purchase_invoices`, `purchase_invoice_items`, `purchase_payments`
- `inventory_items` (qty increased), `inventory_movements` (PURCHASE type)
- `treasury_transactions` (OUT for payment)
- `supplier_transactions`, `suppliers.current_balance`
- `accounting_transactions` (Inventory DR, AP CR, Cash CR)

---

## Module 5: Purchase Returns

**Page:** [`purchase-returns.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/purchase-returns.tsx)  
**Permission:** `purchases.return`

### Purpose
Return defective or excess goods back to suppliers. Decreases stock and reduces the supplier payable balance.

---

## Module 6: Products & Catalog

**Pages:** [`products.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/products.tsx) (54 KB), [`master-data.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/master-data.tsx) (30 KB)  
**Permission:** `products.view`

### Purpose
Define the product catalog. Products are the parent entity; variants (size + color combinations) are the sellable/stockable units with individual SKUs and barcodes.

### Features

**Master Data** (categories, brands, colors, sizes):
- CRUD for all catalog entities
- Soft delete (preserves historical variant references)
- Color hex codes for visual display
- Size systems: EU, US, UK

**Products:**
- Create product with name, category, brand, base price, cost price, reorder point
- Add variants: each size+color combination = one SKU
- Auto-generated SKU: `{productName}-{colorName}-{sizeName}` (normalized)
- Auto-generated EAN-13 barcode
- Per-variant price/cost override (inherits product base if NULL)
- Barcode label printing (individual labels for each variant)
- Search by name, SKU, barcode (Arabic substring search)
- Product-level barcode scanning in POS

### Business Rules
- A product cannot be deleted once it has variants with sales history
- Deactivating a variant removes it from POS search
- SKU must be unique within a store
- Barcode must be unique within a store

---

## Module 7: Inventory Management

**Pages:** [`stock.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/stock.tsx), [`movements.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/movements.tsx), [`transfers.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/transfers.tsx), [`stock-counts.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/stock-counts.tsx), [`warehouses.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/warehouses.tsx)  
**Permission:** `inventory.view` / `inventory.manage`

### Sub-Modules

**Warehouses:** CRUD for physical warehouse locations

**Stock View:** 
- Current quantity per variant per warehouse
- Filter by warehouse, category, brand
- Visual reorder alerts (qty ≤ reorder_point highlighted)

**Movement Log:**
- Immutable history of every stock change
- Movement types: SALE, PURCHASE, ADJUSTMENT, TRANSFER, STOCK_COUNT_CORRECTION
- Filter by date, warehouse, variant, type
- Running balance shown per movement

**Manual Adjustments:**
- ADJUSTMENT_IN (found stock, receiving extras)
- ADJUSTMENT_OUT (damaged goods, write-off)
- Reason/notes required

**Transfers:**
- Move stock between warehouses
- Two-phase: create (TRANSFER_OUT books) → complete (TRANSFER_IN books)
- Cancel reverts the TRANSFER_OUT
- Items in transit not counted in either warehouse

**Stock Counts:**
- Open a count session for a warehouse (snapshot expected quantities)
- Enter physically counted quantities
- System calculates variance per item
- Complete: applies STOCK_COUNT_CORRECTION movements for variances
- Requires manager approval (approvedBy field)

---

## Module 8: Customers (CRM)

**Page:** [`customers.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/customers.tsx) (23 KB)  
**Permission:** `customers.view`

### Purpose
Track customer accounts for credit sales, debt collection, and purchase history.

### Features
- Customer CRUD (name, phone, address)
- Credit limit configuration per customer
- Running balance display (positive = customer owes store)
- Transaction ledger (INVOICE, PAYMENT, RETURN entries)
- Record customer payments (reduces balance, posts treasury IN)
- Search by name or phone

### Key Business Rule
Customers are optional — the POS supports anonymous (walk-in) cash sales. A customer account exists mainly for credit tracking.

---

## Module 9: Suppliers

**Page:** [`suppliers.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/suppliers.tsx) (23 KB)  
**Permission:** `suppliers.view`

### Purpose
Manage supplier accounts for purchase tracking and payables management.

### Features
- Supplier CRUD (name, phone, address, tax number)
- Running balance (positive = store owes supplier)
- Transaction ledger (PURCHASE, PAYMENT, RETURN)
- Record payments to suppliers (reduces payable, posts treasury OUT)

---

## Module 10: Treasury

**Page:** [`treasury.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/treasury.tsx) (16 KB)  
**Permission:** `treasury.view`

### Purpose
Track all money movements across all payment channels (cash box, card terminal, digital wallets).

### Features
- Treasury accounts: one per channel (CASH, CARD, INSTAPAY, WALLET)
- Real-time balance display per account
- Transaction log (every money movement linked to its source)
- Cash sessions: open shift → operate → count cash → close (variance tracking)
- Sessions show expected vs actual closing balance

### Design Note
Every financial event that touches money (sale, purchase payment, expense, salary, customer payment, supplier payment) posts a `treasury_transaction`. The `balance_after` column on each row means you can replay the ledger to reconstruct the balance at any point in time.

---

## Module 11: Finance

**Page:** [`finance.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/finance.tsx) (47 KB — 5 tabs)  
**Permission:** `finance.view` / `finance.manage`

### Sub-Modules

**Expenses:**
- Expense categories (e.g., Rent, Utilities, Marketing)
- Record individual expenses with date, category, amount, treasury account
- Each expense posts treasury OUT + journal entry

**Employees:**
- Staff records with job title, salary, phone
- Optional link to a system user account
- Running advance balance

**Salaries:**
- Generate monthly salary records per employee
- Set base salary, bonuses, deductions → calculates net
- Pay: marks PAID, posts treasury OUT + journal entry

**Employee Advances:**
- Record cash advances given to staff
- Tracked in `advance_balance` on employee record
- Posts treasury OUT

**Owner Equity:**
- Owner capital deposits (inject cash into business)
- Owner withdrawals (personal drawings)
- Each posts treasury IN/OUT + equity journal entry

---

## Module 12: Reports Hub

**Page:** [`reports.tsx`](file:///d:/Erp/ERP/artifacts/pos/src/pages/reports.tsx)  
**Permission:** `reports.view` / `reports.sales` / `reports.inventory`

### Reports Available

| Report | Key Metrics |
|---|---|
| Sales Summary | Date-ranged invoice list, total revenue, payment method breakdown |
| Purchases Summary | Date-ranged purchase list, total spend by supplier |
| Inventory Stock | Current qty, cost per unit, selling price per unit, **total purchase cost**, **total sales value** per variant per warehouse |
| Low Stock | Items at/below reorder point sorted by severity |
| Profit & Loss | Revenue, returns, COGS, gross profit, expenses, salaries, net profit |
| Treasury | Cash flow movements by account and date |
| Expenses | Categorized expense list with totals |
| Top Products | Top 50 variants by quantity sold |
| Daily Sales | Revenue, cost, and profit grouped by day |
| Account Statement | Journal entries for a specific account with running balance |
| Supplier Overview | Purchasing and payment history for a specific supplier |
| Product Inquiry | Stock, pricing, and movement history for a specific product variant |
| Customer Statement | Invoicing and payment history for a specific customer |
| Salary Summary | Payroll records, base, bonuses, and deductions over a period |
| Supplier Aging | Payables bucketed into 0-30, 30-60, 60-90, and 90+ days |

### Report-Specific UI Details

#### Inventory Stock Valuation (تقييم المخزون)
The report table now includes the following columns:

| Column | Arabic Label | Description |
|---|---|---|
| Product | المنتج | Product name |
| Variant | النوع | Color / size label |
| SKU | SKU | Stock-keeping unit code |
| Warehouse | المخزن | Warehouse name |
| Category | الفئة | Product category |
| Quantity | الكمية | Current stock quantity |
| Cost Price | سعر التكلفة | Effective cost per unit = `COALESCE(variant.costPrice, product.baseCostPrice)` |
| Selling Price | سعر البيع | Effective selling price per unit = `COALESCE(variant.sellingPrice, product.basePrice)` |
| **Total Purchase Cost** | **إجمالي تكلفة الشراء** | `quantity × effectiveCostPrice` — inventory book value at cost |
| **Total Sales Value** | **إجمالي قيمة البيع** | `quantity × effectiveSellingPrice` — potential revenue if all stock is sold |

**Summary stats:**
- **إجمالي الكمية** — total units across all warehouses
- **إجمالي تكلفة الشراء** — sum of `totalPurchaseCost` across all rows
- **إجمالي قيمة البيع** — sum of `totalSalesValue` across all rows

**Effective price logic (both cost and selling):**
- If the variant has its own price override stored in `product_variants.costPrice` / `product_variants.sellingPrice`, that value is used.
- Otherwise, the product's base price from `products.baseCostPrice` / `products.basePrice` is used.
- Implemented in SQL as `COALESCE(variant_col, product_base_col)` to ensure correct handling of NULL overrides.

#### Supplier Overview (نظرة مورد)
- Supplier is selected from a dropdown populated via `GET /api/suppliers`.
- **API constraint:** `pageSize` max is **100**. The hook must be called with `pageSize: 100` (not 500).
- After supplier selection, fetches full statement from `GET /api/suppliers/:id/statement`.
- Supports optional client-side date filtering of statement items.

#### Product Inquiry (استعلام عن منتج)
- **Two-step selection flow:**
  1. User types in a search box → triggers `GET /api/products/search?q=...&limit=30` via `useSearchProducts` hook.
  2. Matching products appear as a clickable autocomplete list (not a select element).
  3. Clicking a product selects it and calls `GET /api/products/:id` to load its variants.
  4. A variant dropdown appears; user selects a specific variant.
- **Critical:** `GET /api/products/search` returns a **plain array** (not `{ items: [...] }`). Always use the `useSearchProducts` generated hook (which returns `data` as an array), not `customFetch` with `{ items }` wrapping.
- Once a variant is chosen, the main report is fetched from `GET /api/reports/product-inquiry?variantId=...`.

#### Customer Statement (كشف عميل)
- Customer is selected from a dropdown populated via `GET /api/customers`.
- **API constraint:** `pageSize` max is **100**. The hook must be called with `pageSize: 100` (not 500).
- After customer selection, statement data is fetched from `GET /api/reports/customer-statement?customerId=...`.

#### Account Statement (كشف حساب)
- Account selected from dropdown loaded via `GET /api/reports/accounting-accounts`.
- Statement fetched from `GET /api/reports/account-statement?accountId=...`.

---


## Module 13: Notifications

**Component:** [`notification-bell.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/components/notification-bell.tsx)  
**API:** [`routes/notifications.ts`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/src/routes/notifications.ts)

### Alert Types
| Type | Trigger |
|---|---|
| `LOW_STOCK` | `inventory_items.quantity <= products.reorder_point` |
| `NEGATIVE_TREASURY` | `treasury_accounts.balance < 0` |
| `CUSTOMER_DEBT` | Customer balance above threshold |
| `SUPPLIER_DEBT` | Supplier balance above threshold |
| `DAILY_SUMMARY` | Scheduled (manual trigger) |

### Deduplication
A partial unique index prevents duplicate active alerts per user per key. Reading a notification frees the key for re-firing.

---

## Module 14: Admin (Users, Roles, Audit, Settings)

**Pages:** [`users.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/users.tsx), [`roles.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/roles.tsx), [`audit.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/audit.tsx), [`settings.tsx`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/pos/src/pages/settings.tsx)

### Users
- CRUD with role assignment
- Password reset (manager or admin)
- Activate/deactivate without deletion
- Self-protection: cannot delete/deactivate own account
- Soft delete preserves audit/invoice history

### Roles
- Custom role creation
- Permission group editor (40+ keys organized by module)
- System roles (Admin, Manager, Cashier, etc.) protected from deletion
- Admin role permissions cannot be edited (always `["*"]`)

### Audit Log
- Immutable record of all sensitive actions
- Filter by user, action type, entity, date
- View old/new value JSON for data changes

### Settings
**Store Profile:** Name, phone, address, currency, logo, tax rate  
**Tax:** Enable/disable, tax rate, inclusive/exclusive  
**Receipt:** Paper size (58mm/80mm), footer text, numeral format  
**Business Rules:**
- Allow negative stock
- Allow below-cost discounts
- Allow negative treasury
- Require cash session for sales

**Document Sequences:** Custom prefix and number padding per document type
