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
- [`routes/sales.ts L266-580`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/src/routes/sales.ts)
- [`lib/inventory.ts`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/src/lib/inventory.ts)
- [`lib/treasury.ts`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/src/lib/treasury.ts)
- [`lib/accounting.ts`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/src/lib/accounting.ts)

---

## 2. Login Flow

```mermaid
flowchart TD
    A[User submits login form] --> B[POST /auth/login]
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
    N -->|Yes| O[SET locked_until = now+15min → 423]
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
    M --> N{Payment provided?}
    N -->|Yes| O[For each payment: INSERT purchase_payments]
    O --> P[postTreasuryTransaction OUT]
    P --> Q[INSERT supplier_transactions: PURCHASE credit]
    Q --> R[UPDATE supplier.current_balance]
    R --> S[postJournalEntry: Inventory DR + AP CR + Cash CR]
    N -->|No| Q
    S --> T[writeAuditLog purchase.created]
    T --> U[201 JSON response]
```

---

## 4. Token Refresh

```mermaid
flowchart TD
    A[Client: access token expired] --> B[POST /auth/refresh auto-sends cookie]
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
    D --> E[For each return item: validate qty ≤ sold - already returned]
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

## 7. Data Flow: Product → Sale → Report

```mermaid
flowchart LR
    A[categories + brands + colors + sizes] --> B[products]
    B --> C[product_variants SKU+barcode]
    C --> D[inventory_items initial stock via purchase]
    D --> E[POS: barcode scan → cart]
    E --> F[checkout → invoice + invoice_items]
    F --> G[inventory_items qty decreased]
    F --> H[inventory_movements SALE record]
    F --> I[treasury_transactions IN]
    F --> J[accounting_transaction_lines Dr.Cash Cr.Revenue]
    F --> K[accounting_transaction_lines Dr.COGS Cr.Inventory]
    
    G --> L[reports/low-stock if qty ≤ reorder_point]
    H --> M[reports/inventory-stock total qty]
    J --> N[reports/profit-loss revenue figure]
    K --> N
    I --> O[reports/treasury cash flow]
    F --> P[reports/sales-summary invoice total]
    F --> Q[reports/top-products qty sold]
```

---

## 8. Notification Generation Flow

```mermaid
flowchart TD
    A[POST /notifications/refresh] --> B[requireAuth]
    B --> C[Check low stock: inventory_items qty ≤ product.reorder_point]
    C --> D[Check negative treasury: treasury_accounts balance < 0]
    D --> E[Check high customer debt: customers balance > threshold]
    E --> F[For each alert: INSERT notifications WHERE NOT EXISTS active dedupe]
    F --> G[ON CONFLICT DO NOTHING dedupe_key constraint]
    G --> H[Return unread count]
    
    I[Bell polling every N seconds] --> J[GET /notifications?unread_only=true]
    J --> K[User reads notification]
    K --> L[PUT /notifications/id/read]
    L --> M[SET is_read=true, read_at=now]
    M --> N[Dedupe key freed — alert can re-fire]
```
