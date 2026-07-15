# API Documentation

> All API route files documented. Base path: `/api`. Authentication: `Authorization: Bearer <accessToken>` on all protected routes.
>
> **All endpoints are accessible at `http://localhost:5001/api/...` in both Localhost and Desktop modes.**

---

## Authentication Routes (`/auth`)

### `GET /auth/setup-status`
- **Auth:** None
- **Response:** `{ storeExists: bool, isSetupComplete: bool }`
- **Purpose:** Frontend checks this on load to decide: show setup wizard, login, or app

### `POST /auth/setup`
- **Auth:** None (runs before any user exists)
- **Body:** `{ storeName, adminUsername, adminPassword, adminFullName, phone?, address?, city?, currency?, taxRate?, logoUrl?, printerWidth?, paperType? }`
- **Response:** `{ storeId, message }` — 201
- **Guards:** 409 if setup already completed
- **Side effects:** Creates store, 5 default roles, admin user, audit log

### `POST /auth/login`
- **Auth:** None
- **Body:** `{ username, password }`
- **Response:** `{ accessToken, user: { id, storeId, username, fullName, role, permissions, storeName } }`
- **Side effects:** Issues session, sets HttpOnly refresh cookie, writes audit log
- **Errors:** 401 (wrong creds), 423 (locked), 401 (inactive)

### `POST /auth/refresh`
- **Auth:** HttpOnly cookie `refresh_token`
- **Response:** `{ accessToken, user }`
- **Side effects:** Rotates session (old revoked, new issued)

### `POST /auth/logout`
- **Auth:** Cookie (optional — clears regardless)
- **Response:** 204
- **Side effects:** Revokes session

### `GET /auth/me`
- **Auth:** Bearer
- **Response:** Current user object with permissions

---

## Users (`/users`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/users` | `users.view` | List all users (paginated) |
| POST | `/users` | `users.create` | Create new user |
| GET | `/users/:id` | `users.view` | Get user detail |
| PATCH | `/users/:id` | `users.edit` | Update user |
| DELETE | `/users/:id` | `users.delete` | Soft delete user |
| POST | `/users/:id/reset-password` | `users.edit` | Reset password |
| POST | `/users/:id/toggle-active` | `users.edit` | Activate/deactivate |

---

## Roles (`/roles`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/roles` | `roles.view` | List all roles |
| POST | `/roles` | `roles.manage` | Create custom role |
| GET | `/roles/:id` | `roles.view` | Get role detail |
| PATCH | `/roles/:id` | `roles.manage` | Update role permissions |
| DELETE | `/roles/:id` | `roles.manage` | Delete non-system role |

### `GET /permissions`
- Permission: `roles.view`
- Returns full permission groups catalog for the role editor UI

---

## Audit (`/audit`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/audit` | `audit.view` | Paginated audit log, filterable by action/user/entity/date |

---

## Catalog (`/catalog`)

Manages `categories`, `brands`, `colors`, `sizes`.

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/catalog/categories` | `products.view` | List categories |
| POST | `/catalog/categories` | `products.create` | Create category |
| PATCH | `/catalog/categories/:id` | `products.edit` | Update |
| DELETE | `/catalog/categories/:id` | `products.delete` | Deactivate |
| GET/POST/PATCH/DELETE | `/catalog/brands` | same | Brands CRUD |
| GET/POST/PATCH/DELETE | `/catalog/colors` | same | Colors CRUD |
| GET/POST/PATCH/DELETE | `/catalog/sizes` | same | Sizes CRUD |

---

## Products (`/products`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/products` | `products.view` | List products + variants (search, filter) |
| POST | `/products` | `products.create` | Create product with initial variants |
| GET | `/products/:id` | `products.view` | Product detail + all variants |
| PATCH | `/products/:id` | `products.edit` | Update product base info |
| POST | `/products/:id/variants` | `products.create` | Add variant to product |
| PATCH | `/products/variants/:id` | `products.edit` | Update variant (price, cost) |
| DELETE | `/products/variants/:id` | `products.delete` | Deactivate variant |
| GET | `/products/search` | `products.view` | Full-text search across name/SKU/barcode (POS search field) |
| GET | `/products/barcode/:barcode` | `sales.create` | Lookup by barcode (POS scan) |

**Notes:**
- SKU auto-generated as `{productName}-{colorName}-{sizeName}` (normalized)
- Barcode auto-generated as EAN-13 format
- Variants store price/cost as override (NULL = inherit product base)
- **`GET /products/search` returns a plain array** (`SearchProductsResponseItem[]`), NOT `{ items: [...] }`. Always use the generated `useSearchProducts` hook which correctly types `data` as an array.

---

## Warehouses (`/warehouses`)

| Method | Route | Permission |
|---|---|---|
| GET | `/warehouses` | `inventory.view` |
| POST | `/warehouses` | `inventory.manage` |
| PATCH | `/warehouses/:id` | `inventory.manage` |
| DELETE | `/warehouses/:id` | `inventory.manage` |

---

## Inventory (`/inventory`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/inventory/stock` | `inventory.view` | Per-warehouse stock levels (join products+variants) |
| GET | `/inventory/movements` | `inventory.view` | Movement log (filterable by variant/warehouse/type/date) |
| POST | `/inventory/adjustments` | `inventory.manage` | Manual stock adjustment (IN or OUT) |

---

## Inventory Operations (`/inventory-ops`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/transfers` | `inventory.view` | List transfers |
| POST | `/transfers` | `inventory.manage` | Create transfer (books TRANSFER_OUT) |
| POST | `/transfers/:id/complete` | `inventory.manage` | Complete transfer (books TRANSFER_IN) |
| POST | `/transfers/:id/cancel` | `inventory.manage` | Cancel transfer (reverses TRANSFER_OUT) |
| GET | `/transfers/:id` | `inventory.view` | Transfer detail |
| GET | `/stock-counts` | `inventory.view` | List stock count sessions |
| POST | `/stock-counts` | `inventory.manage` | Open stock count session |
| POST | `/stock-counts/:id/complete` | `inventory.manage` | Apply corrections (STOCK_COUNT_CORRECTION) |
| POST | `/stock-counts/:id/cancel` | `inventory.manage` | Cancel count |

---

## Sales (`/sales`)

### Invoices
| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/sales/invoices` | `sales.view` | List invoices (page, search, customer, date, payment status) |
| POST | `/sales/invoices` | `sales.create` | Create sale (ATOMIC: inventory+treasury+accounting) |
| GET | `/sales/invoices/lookup` | `sales.return` | Find invoice by number or barcode |
| GET | `/sales/invoices/:id` | `sales.view` | Invoice detail with items + payments |

### Returns
| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/sales/returns` | `sales.return` | List sales returns |
| POST | `/sales/returns` | `sales.return` | Create return (reverses inventory+treasury+accounting) |
| GET | `/sales/returns/:id` | `sales.return` | Return detail |

### Suspended Orders
| Method | Route | Permission |
|---|---|---|
| GET | `/sales/suspended` | `sales.create` |
| POST | `/sales/suspended` | `sales.create` |
| DELETE | `/sales/suspended/:id` | `sales.create` |

---

## Purchases (`/purchases`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/purchases` | `purchases.view` | List purchase invoices |
| POST | `/purchases` | `purchases.create` | Create purchase (inventory IN + supplier balance) |
| GET | `/purchases/:id` | `purchases.view` | Detail with items + payments |
| POST | `/purchases/:id/payments` | `purchases.edit` | Add payment to existing purchase |
| GET | `/purchase-returns` | `purchases.return` | List purchase returns |
| POST | `/purchase-returns` | `purchases.return` | Create purchase return |
| GET | `/purchase-returns/:id` | `purchases.return` | Return detail |

**Important:** Every purchase (cash or credit) always creates:
1. A `supplier_transactions` row of type `PURCHASE` (full invoice amount as credit to supplier balance)
2. If any cash was tendered: a second `supplier_transactions` row of type `PAYMENT` (immediate debit)

This ensures the supplier statement shows all invoices regardless of payment method.

---

## Customers (`/customers`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/customers` | `customers.view` | List customers (search, filter) |
| POST | `/customers` | `customers.create` | Create customer |
| GET | `/customers/:id` | `customers.view` | Customer detail |
| PATCH | `/customers/:id` | `customers.edit` | Update customer |
| DELETE | `/customers/:id` | `customers.delete` | Deactivate |
| GET | `/customers/:id/statement` | `customers.view` | Transaction ledger |
| POST | `/customers/:id/payments` | `customers.edit` | Record customer payment (reduces balance) |

**Customer List (`GET /customers`) pagination:**
- `pageSize` maximum is **100** (enforced by Zod validation — requests with `pageSize > 100` receive a 400 error).
- For dropdowns requiring all customers, always use `pageSize: 100`.

---

## Suppliers (`/suppliers`)

| Route | Description |
|---|---|
| GET/POST/PATCH/DELETE `/suppliers` | CRUD |
| GET `/suppliers/:id/statement` | Full ledger with invoice numbers |
| POST `/suppliers/:id/payments` | Record supplier payment |

**Supplier List (`GET /suppliers`) pagination:**
- `pageSize` maximum is **100** (enforced by Zod validation — requests with `pageSize > 100` receive a 400 error).
- For dropdowns requiring all suppliers, always use `pageSize: 100`.

**Supplier Statement (`GET /suppliers/:id/statement`) response:**
- Returns `{ supplier, items: SupplierTransaction[], total, page, pageSize }`
- Each `SupplierTransaction` item includes `invoiceNumber` (from a LEFT JOIN on `purchase_invoices`) — present only for `PURCHASE`-type transactions

---

## Treasury (`/treasury`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/treasury/accounts` | `treasury.view` | List accounts with balances |
| GET | `/treasury/transactions` | `treasury.view` | Transaction log (filterable) |
| GET | `/treasury/sessions` | `treasury.view` | List sessions |
| POST | `/treasury/sessions` | `treasury.session` | Open a cash session |
| POST | `/treasury/sessions/:id/close` | `treasury.session` | Close session with actual balance |
| **POST** | **`/treasury/transfers`** | `treasury.session` | **Transfer money between two treasury accounts** |
| **POST** | **`/treasury/adjustments`** | `treasury.session` | **Manual cash reconciliation (IN/OUT adjustment)** |

### `POST /treasury/transfers` body:
```json
{ "fromAccountId": "uuid", "toAccountId": "uuid", "amount": 500, "description": "optional" }
```

### `POST /treasury/adjustments` body:
```json
{ "treasuryAccountId": "uuid", "direction": "IN"|"OUT", "amount": 100, "reason": "required text" }
```

---

## Finance (`/finance`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET/POST/PATCH/DELETE | `/expense-categories` | `finance.manage` | Expense category CRUD |
| GET/POST | `/expenses` | `expenses.create` or `finance.view` | Expenses list + create |
| GET/POST/PATCH/DELETE | `/employees` | `finance.manage` | Employee CRUD |
| GET/POST | `/salary-records` | `finance.manage` | Salary records list + generate |
| POST | `/salary-records/:id/pay` | `finance.manage` | Mark salary as paid (deducts advance balance) |
| GET/POST | `/employee-advances` | `finance.manage` | Advance list + create |
| GET/POST | `/equity-movements` | `finance.manage` | Owner withdrawal/deposit |

### Salary Record Fields (POST `/salary-records`):
```json
{
  "employeeId": "uuid",
  "periodMonth": "2024-01",
  "payPeriodType": "MONTHLY" | "WEEKLY" | "DAILY",
  "advanceDeduction": 500,
  "otherDeductions": 100,
  "bonuses": 200
}
```

- `payPeriodType`: Controls base salary division (MONTHLY = base, WEEKLY = base/4, DAILY = base/30)
- `advanceDeduction`: Amount to deduct from employee advance balance. If omitted, auto-fills from `employee.advanceBalance`
- Advance balance is decremented on the employee record **when the salary is marked as PAID** (not at creation)

---

## Dashboard (`/dashboard`)

| Route | Permission | Response |
|---|---|---|
| GET `/dashboard/kpis` | `dashboard.view_sales` | Today's revenue, sales count, avg sale, total customers |
| GET `/dashboard/chart-data` | `dashboard.view_sales` | Daily revenue for last 30 days |
| GET `/dashboard/stock-alerts` | `dashboard.view_stock` | Low stock item count |

---

## Reports (`/reports`)

| Route | Permission | Report |
|---|---|---|
| GET `/reports/sales-summary` | `reports.sales` | Invoice list with totals, filterable |
| GET `/reports/purchases-summary` | `reports.view` | Purchase list with totals |
| GET `/reports/inventory-stock` | `reports.inventory` | Stock valuation per variant — includes cost price, selling price, total purchase cost, and total sales value per row |
| GET `/reports/low-stock` | `reports.inventory` | Items at or below reorder point |
| GET `/reports/profit-loss` | `reports.view` | P&L: revenue, returns, COGS, expenses, salaries, net profit |
| GET `/reports/treasury` | `reports.view` | Treasury movements with IN/OUT totals |
| GET `/reports/expenses` | `reports.view` | Expense list by category |
| GET `/reports/top-products` | `reports.sales` | Top 50 products by quantity sold |
| GET `/reports/accounting-accounts` | `reports.view` | All chart-of-accounts entries for this store |
| GET `/reports/account-statement` | `reports.view` | Journal lines for one account with running balance. Params: `accountId` (required), `fromDate`, `toDate` |
| GET `/reports/product-inquiry` | `reports.inventory` | Variant details + stock by warehouse + movement history. Params: `variantId` (required), `fromDate`, `toDate` |
| GET `/reports/customer-statement` | `reports.view` | Customer AR ledger with running balance. Params: `customerId` (required), `fromDate`, `toDate` |
| GET `/reports/daily-sales` | `reports.sales` | Revenue/cost/profit grouped by day. Params: `fromDate`, `toDate` |
| GET `/reports/salary-summary` | `reports.view` | Salary records with totals. Params: `employeeId` (optional), `fromDate`, `toDate` |
| GET `/reports/supplier-aging` | `reports.view` | Outstanding supplier payables bucketed: 0-30, 30-60, 60-90, 90+ days |

### `GET /reports/inventory-stock` response schema

Each row in `rows[]` contains:

| Field | Type | Description |
|---|---|---|
| `variantId` | string | Variant UUID |
| `productName` | string | Product name |
| `sku` | string \| null | SKU |
| `variantLabel` | string \| null | Color/size label |
| `warehouseName` | string \| null | Warehouse |
| `categoryName` | string \| null | Category |
| `brandName` | string \| null | Brand |
| `quantity` | number | Current stock quantity |
| `cost` | string \| null | Raw variant-level cost override (NULL if inheriting) |
| `effectiveCost` | string | Effective cost = `COALESCE(variant.costPrice, product.baseCostPrice)` |
| `sellingPrice` | string | Effective selling price = `COALESCE(variant.sellingPrice, product.basePrice)` |
| `totalPurchaseCost` | number | `quantity × effectiveCost` |
| `totalSalesValue` | number | `quantity × sellingPrice` |
| `value` | number | Legacy alias for `totalPurchaseCost` (backward compat) |

Top-level response also includes:
- `totalQuantity` — sum of all quantities
- `totalPurchaseCost` — sum of all `totalPurchaseCost` rows
- `totalSalesValue` — sum of all `totalSalesValue` rows
- `totalValue` — alias for `totalPurchaseCost` (backward compat)

---

## Settings (`/settings`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/settings` | `settings.view` | Store settings + sequences |
| PATCH | `/settings` | `settings.manage` | Update store settings |
| PATCH | `/settings/sequences/:kind` | `settings.manage` | Reset sequence prefix/padding |

---

## Notifications (`/notifications`)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/notifications` | requireAuth | List notifications (unread filter) |
| POST | `/notifications/refresh` | requireAuth | Re-check and generate new alerts |
| PATCH | `/notifications/:id/read` | requireAuth | Mark one as read |
| PATCH | `/notifications/read-all` | requireAuth | Mark all as read |

---

## Association Accounts (`/associations`)

> **Purpose:** Manage money withdrawn from the company cash register to participate in savings associations (ROSCA). Withdrawals are receivables — not expenses — and are tracked independently of P&L.

### Associations (Master)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/associations` | `associations.view` | List all associations with computed summaries (balance, totalWithdrawals, totalReturns) |
| POST | `/associations` | `associations.create` | Create a new association. Validates name uniqueness per store. Status defaults to ACTIVE. |
| GET | `/associations/:id` | `associations.view` | Get single association with computed summary |
| PUT | `/associations/:id` | `associations.edit` | Update association name, dates, status, or contribution details |

#### `POST /associations` — Request Body
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "startDate": "YYYY-MM-DD (required)",
  "endDate": "YYYY-MM-DD (optional)",
  "expectedReturnDate": "YYYY-MM-DD (optional)",
  "contributionFrequency": "DAILY|WEEKLY|MONTHLY|CUSTOM|NONE (default: NONE)",
  "contributionAmount": "decimal string (optional)",
  "notes": "string (optional)"
}
```

#### GET list/single response shape
```json
{
  "id": "uuid",
  "storeId": "uuid",
  "name": "string",
  "status": "ACTIVE|CLOSED",
  "startDate": "YYYY-MM-DD",
  "totalWithdrawals": 1500.00,
  "totalReturns": 500.00,
  "balance": 1000.00
}
```
> `totalWithdrawals`, `totalReturns`, and `balance` are always computed from `association_transactions`. They are **never stored** on the associations row.

### Association Transactions (Ledger)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/associations/:id/transactions` | `associations.transactions` | Paginated transaction ledger for one association with running balance column |
| POST | `/associations/:id/transactions` | `associations.transactions` | Record a WITHDRAWAL or RETURN. Posts a corresponding treasury movement automatically. |
| POST | `/associations/:id/transactions/:txId/reverse` | `associations.transactions` | Reverse an existing transaction. Never deletes — posts an opposite entry and marks original `isReversed=true`. |

#### `POST /associations/:id/transactions` — Request Body
```json
{
  "type": "WITHDRAWAL|RETURN",
  "amount": "decimal string",
  "transactionDate": "YYYY-MM-DD (defaults to today)",
  "treasuryAccountId": "uuid (required)",
  "referenceNumber": "string (optional)",
  "notes": "string (optional)"
}
```

#### Accounting Effect of Each Transaction Type
| Type | Treasury Effect | Balance Effect |
|---|---|---|
| WITHDRAWAL | Treasury OUT | Balance increases (more owed to store) |
| RETURN | Treasury IN | Balance decreases |
| Reversal of WITHDRAWAL | Treasury IN (opposite) | Balance decreases |
| Reversal of RETURN | Treasury OUT (opposite) | Balance increases |

### Association Summary (Dashboard KPIs)

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/associations/summary` | `associations.report` | Aggregate KPIs: active count, total withdrawn, total returned, net outstanding balance |

#### Response shape
```json
{
  "activeAssociationsCount": 3,
  "totalWithdrawn": 15000.00,
  "totalReturned": 8000.00,
  "totalOutstandingBalance": 7000.00
}
```

> **Important:** `/associations/summary` is registered **before** `/associations/:id` in the router. This ensures the literal `summary` segment is not parsed as an `:id` parameter.

---

## Health (`/health` and `/healthz`)

| Route | Auth | Response |
|---|---|---|
| GET `/health` | None | `{ ok: true }` — used for uptime checks |
| GET `/healthz` | None | `{ ok: true }` — used by Electron startup health polling |
