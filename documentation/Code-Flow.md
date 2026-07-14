# Code Flow

> Complete request-to-response flows for the most important operations.

---

## 1. Create Sale (Checkout)

```mermaid
flowchart TD
    A[Cashier clicks Checkout in POS] --> B[POST /api/sales/invoices]
    B --> C[requireAuth middleware]
    C --> D[requirePermission sales.create]
    D --> E[Zod validation: CreateSaleBody]
    E --> F{Items empty?}
    F -->|Yes| G[400 الفاتورة فارغة]
    F -->|No| H[db.transaction]
    
    H --> I[Validate warehouse exists]
    I --> J[Load store settings: allow_negative_stock]
    J --> K[Load all variants + cost prices]
    K --> L[Compute line totals + COGS]
    L --> M{Credit amount?}
    M -->|Yes| N[Load customer + credit limit check]
    M -->|No| O[Skip customer check]
    
    N --> P[Generate invoice number: nextDocumentNumber]
    O --> P
    P --> Q[INSERT invoices]
    Q --> R[For each item: INSERT invoice_items]
    R --> S[postInventoryMovement: SALE type]
    S --> T{allow_negative_stock?}
    T -->|No| U{qty in stock?}
    U -->|Insufficient| V[throw INSUFFICIENT_STOCK]
    U -->|OK| W[UPDATE inventory_items qty]
    T -->|Yes| W
    W --> X[INSERT inventory_movements]
    X --> Y[For each payment: INSERT invoice_payments]
    Y --> Z[postTreasuryTransaction IN]
    Z --> AA[If credit: INSERT customer_transactions, UPDATE customer balance]
    AA --> BB[postJournalEntry: revenue + COGS]
    BB --> CC[Return invoice ID]
    
    CC --> DD[writeAuditLog sale.created]
    DD --> EE[loadInvoiceDetail full join]
    EE --> FF[201 JSON response with full invoice]
```

**Key files:**
- [`routes/sales.ts`](file:///d:/Erp/ERP/artifacts/api-server/src/routes/sales.ts)
- [`lib/inventory.ts`](file:///d:/Erp/ERP/artifacts/api-server/src/lib/inventory.ts)
- [`lib/treasury.ts`](file:///d:/Erp/ERP/artifacts/api-server/src/lib/treasury.ts)
- [`lib/accounting.ts`](file:///d:/Erp/ERP/artifacts/api-server/src/lib/accounting.ts)

---

## 2. Login Flow

```mermaid
flowchart TD
    A[User submits login form] --> B[POST /api/auth/login]
    B --> C[Zod parse LoginBody]
    C --> D[SELECT user WHERE username=X AND is_deleted=false]
    D --> E{User found?}
    E -->|No| F[Dummy bcrypt compare to prevent timing attack]
    F --> G[401 بيانات خاطئة]
    E -->|Yes| H{lockedUntil > now?}
    H -->|Yes| I[423 الحساب مقفل]
    H -->|No| J{isActive?}
    J -->|No| K[401 حساب غير مفعّل]
    J -->|Yes| L[bcrypt.compare password]
    L -->|Fail| M[Increment failed_attempts]
    M --> N{>= 5 attempts?}
    N -->|Yes| O[SET locked_until = now+15min - 423]
    N -->|No| P[401 generic error]
    L -->|Success| Q[Reset failed_attempts, update last_login_at]
    Q --> R[issueSession: INSERT sessions row]
    R --> S[signAccessToken JWT 15min]
    S --> T[signRefreshToken JWT 7days]
    T --> U[Set HttpOnly refresh cookie]
    U --> V[writeAuditLog auth.login]
    V --> W[200 JSON: accessToken + user object]
```

---

## 3. Purchase Invoice (Receive Stock)

```mermaid
flowchart TD
    A[Manager creates purchase invoice] --> B[POST /api/purchases]
    B --> C[requirePermission purchases.create]
    C --> D[Zod validation]
    D --> E[db.transaction]
    E --> F[Validate supplier + warehouse]
    F --> G[Compute subtotal, tax, total]
    G --> H[nextDocumentNumber PURCHASE]
    H --> I[INSERT purchase_invoices]
    I --> J[For each item: INSERT purchase_invoice_items]
    J --> K[postInventoryMovement: PURCHASE type]
    K --> L[UPDATE inventory_items qty+]
    L --> M[INSERT inventory_movements]
    M --> N[For each cash payment: postTreasuryTransaction OUT]
    N --> O[INSERT supplier_transactions PURCHASE credit=totalAmount]
    O --> P[If any cash paid: INSERT supplier_transactions PAYMENT debit=tendered]
    P --> Q[UPDATE supplier.current_balance]
    Q --> R[If credit portion > 0: INSERT purchase_payments CREDIT type]
    R --> S[postJournalEntry: Inventory DR + AP/Cash CR]
    S --> T[writeAuditLog purchase.created]
    T --> U[201 JSON response]
```

> **Note:** Both cash and credit purchases always create a PURCHASE supplier transaction for the full amount, ensuring all invoices appear in the supplier statement.

---

## 4. Token Refresh

```mermaid
flowchart TD
    A[Client: access token expired] --> B[POST /api/auth/refresh auto-sends cookie]
    B --> C[Read refresh cookie]
    C --> D{Cookie present?}
    D -->|No| E[401 جلسة غير صالحة]
    D -->|Yes| F[verifyRefreshToken JWT]
    F --> G{JWT valid?}
    G -->|No| H[clearCookie + 401]
    G -->|Yes| I[SELECT session WHERE id=sid]
    I --> J{Session valid?}
    J -->|No: revoked/expired/hash mismatch| K[clearCookie + 401]
    J -->|Yes| L[resolveUser userId]
    L --> M[UPDATE old session: revokedAt=now]
    M --> N[issueSession new session]
    N --> O[signAccessToken new]
    O --> P[Set new refresh cookie]
    P --> Q[200 JSON: new accessToken + user]
```

---

## 5. Inventory Adjustment (Manual)

```mermaid
flowchart TD
    A[POST /api/inventory/adjustments] --> B[requirePermission inventory.manage]
    B --> C[Validate variant exists in warehouse]
    C --> D[db.transaction]
    D --> E{adjustmentType?}
    E -->|ADJUSTMENT_IN| F[quantityChange = +qty]
    E -->|ADJUSTMENT_OUT| G[quantityChange = -qty]
    G --> H{allow_negative_stock check}
    H -->|insufficient| I[throw error]
    F --> J[postInventoryMovement]
    J --> K[UPDATE inventory_items.quantity]
    K --> L[INSERT inventory_movements]
    L --> M[writeAuditLog inventory.adjusted]
    M --> N[200 OK]
```

---

## 6. Sales Return

```mermaid
flowchart TD
    A[POST /api/sales/returns] --> B[requirePermission sales.return]
    B --> C[Validate invoice exists]
    C --> D[Load invoice items]
    D --> E[For each return item: validate qty within allowed range]
    E --> F[Compute totalAmount + totalCost]
    F --> G[nextDocumentNumber SALES_RETURN]
    G --> H[INSERT sales_returns]
    H --> I[For each item: INSERT sales_return_items]
    I --> J[UPDATE invoice_items.returned_quantity]
    J --> K[postInventoryMovement SALE_RETURN IN]
    K --> L{refundMethod?}
    L -->|CASH/CARD etc| M[postTreasuryTransaction OUT refund]
    L -->|CREDIT| N[UPDATE customer balance minus refund]
    M --> O[postJournalEntry: reverse COGS + revenue entries]
    N --> O
    O --> P[UPDATE invoice.return_status]
    P --> Q[writeAuditLog sale.return_created]
    Q --> R[201 response]
```

---

## 7. Treasury Transfer (Between Accounts)

```mermaid
flowchart TD
    A[Manager submits TransferModal form] --> B[POST /api/treasury/transfers]
    B --> C[requirePermission treasury.session]
    C --> D[Zod: fromAccountId, toAccountId, amount, description]
    D --> E{same account?}
    E -->|Yes| F[400 error]
    E -->|No| G[db.transaction]
    G --> H[Load + validate fromAcct belongs to store]
    H --> I[Load + validate toAcct belongs to store]
    I --> J[INSERT treasury_transfers record]
    J --> K[postTreasuryTransaction OUT from source account]
    K --> L[postTreasuryTransaction IN to destination account]
    L --> M[postJournalEntry balance transfer]
    M --> N[writeAuditLog treasury.transfer]
    N --> O[201 response]
    O --> P[Frontend: invalidate /api/treasury/accounts + /api/treasury/transactions]
```

**Key file:** [`routes/treasury.ts:407`](file:///d:/Erp/ERP/artifacts/api-server/src/routes/treasury.ts)

---

## 8. Treasury Adjustment (Cash Reconciliation)

```mermaid
flowchart TD
    A[Manager submits AdjustmentModal] --> B[POST /api/treasury/adjustments]
    B --> C[requirePermission treasury.session]
    C --> D[Zod: treasuryAccountId, direction IN/OUT, amount, reason]
    D --> E[Load treasury account + verify store ownership]
    E --> F{Found?}
    F -->|No| G[404]
    F -->|Yes| H[db.transaction]
    H --> I[INSERT treasury_adjustments record]
    I --> J[postTreasuryTransaction IN or OUT per direction]
    J --> K[postJournalEntry balance correction]
    K --> L[writeAuditLog treasury.adjustment]
    L --> M[201 response]
    M --> N[Frontend: invalidate /api/treasury/accounts + /api/treasury/transactions]
```

**Key file:** [`routes/treasury.ts:534`](file:///d:/Erp/ERP/artifacts/api-server/src/routes/treasury.ts)

---

## 9. Salary Record Creation and Payment

```mermaid
flowchart TD
    A[Manager creates salary] --> B[POST /api/salary-records]
    B --> C[requirePermission finance.manage]
    C --> D[Zod: payPeriodType, advanceDeduction, otherDeductions, bonuses]
    D --> E[Load employee]
    E --> F{payPeriodType?}
    F -->|MONTHLY| G[base = employee.salary]
    F -->|WEEKLY| H[base = employee.salary / 4]
    F -->|DAILY| I[base = employee.salary / 30]
    G --> J[If advanceDeduction omitted: use employee.advanceBalance]
    H --> J
    I --> J
    J --> K[net = base + bonuses - deductions - advanceDeduction - otherDeductions]
    K --> L[INSERT salary_records status=PENDING]
    L --> M[201 response]

    M --> N[Manager marks salary as paid]
    N --> O[POST /api/salary-records/:id/pay]
    O --> P[Load record + treasury account]
    P --> Q[db.transaction]
    Q --> R[postTreasuryTransaction OUT]
    R --> S[If advanceDeduction > 0: UPDATE employee.advanceBalance -= advanceDeduction]
    S --> T[UPDATE salary_records: status=PAID, paid_at, treasury_account_id]
    T --> U[postJournalEntry: Salaries Expense DR + Cash CR]
    U --> V[writeAuditLog finance.salary_paid]
    V --> W[200 response]
```

**Key file:** [`routes/finance.ts`](file:///d:/Erp/ERP/artifacts/api-server/src/routes/finance.ts)

---

## 10. Data Flow: Product → Sale → Report

```mermaid
flowchart LR
    A[categories + brands + colors + sizes] --> B[products]
    B --> C[product_variants SKU+barcode]
    C --> D[inventory_items initial stock via purchase]
    D --> E[POS: barcode scan - cart]
    E --> F[checkout - invoice + invoice_items]
    F --> G[inventory_items qty decreased]
    F --> H[inventory_movements SALE record]
    F --> I[treasury_transactions IN]
    F --> J[accounting Dr.Cash Cr.Revenue]
    F --> K[accounting Dr.COGS Cr.Inventory]
    
    G --> L[reports/low-stock]
    H --> M[reports/inventory-stock]
    J --> N[reports/profit-loss]
    K --> N
    I --> O[reports/treasury]
    F --> P[reports/sales-summary]
    F --> Q[reports/top-products]
```

---

## 11. Notification Generation Flow

```mermaid
flowchart TD
    A[POST /api/notifications/refresh] --> B[requireAuth]
    B --> C[Check low stock items]
    C --> D[Check negative treasury balances]
    D --> E[Check high customer debt]
    E --> F[INSERT notifications with dedupe ON CONFLICT DO NOTHING]
    F --> G[Return unread count]
    
    H[Bell polling] --> I[GET /api/notifications?unread_only=true]
    I --> J[User reads notification]
    J --> K[PATCH /api/notifications/id/read]
    K --> L[SET is_read=true, dedupe key freed]
```
