# Business Logic

> Every important business rule explained — not just what the code does, but WHY the rule exists.

---

## 1. Atomic Sale Transaction

**Rule:** A sale MUST atomically write: invoice header + items, inventory OUT movements, treasury IN transactions, customer balance update, and double-entry journal entries — all in one `db.transaction()`.

**Why:** If any step fails (e.g., insufficient stock, treasury account missing), the entire operation rolls back. This prevents orphaned invoices with no matching stock deduction, or treasury balances out of sync with sales records. Partial commits would leave the database in an inconsistent state impossible to fix without manual SQL.

**Where:** [`sales.ts L301`](file:///c:/Users/moham/Downloads/Shoe-Store-Design/Shoe-Store-Design/artifacts/api-server/src/routes/sales.ts) — `db.transaction(async (tx) => { ... })`

---

## 2. Cost Snapshot at Sale Time

**Rule:** `unit_cost` is captured from the variant's current cost price at the moment of sale, not calculated later.

**Why:** Cost prices change over time as new purchase invoices arrive with different unit costs. If we didn't snapshot the cost, historical P&L calculations would be wrong — a sale from 6 months ago would show today's cost, not the cost at the time of the sale.

**Where:** `invoice_items.unit_cost` — populated from `product_variants.cost_price ?? products.base_cost_price`

---

## 3. Price at Sale Time (Not Lookup)

**Rule:** `unit_price` is sent by the cashier (from the POS cart) and stored in `invoice_items`. The API validates that the variant exists but does NOT override the cashier's entered price.

**Why:** Managers may apply ad-hoc discounts at the point of sale. The entered price is the contract price for that transaction. Historical reports need the actual price charged.

---

## 4. Credit Sales Require a Customer

**Rule:** If any payment line has `method = "CREDIT"`, a `customerId` must be provided.

**Why:** Credit (debt) must be tracked on a customer's ledger. Without knowing who owes the money, it's impossible to collect the debt later. The rule prevents financial records with unattributed receivables.

**Error:** `"البيع الآجل يتطلب اختيار عميل"` (credit sale requires a customer)

---

## 5. Credit Limit Enforcement

**Rule:** The credit amount being added to a customer's balance cannot cause `currentBalance + creditAmount > creditLimit`.

**Why:** Protects the store from extending unlimited credit to customers who may not repay. The credit limit is set per customer and can be adjusted by management.

**Bypass:** Credit limit ≤ 0 means NO credit is allowed for that customer (`"هذا العميل لا يسمح له بالشراء الآجل"`).

---

## 6. Change Requires Cash Tender

**Rule:** If `changeDue > 0`, at least one payment must be `method = "CASH"`.

**Why:** You cannot give cash change from a card or digital payment. This prevents the cashier from accidentally recording change on card transactions where the terminal would never issue physical change.

---

## 7. Insufficient Payment Guard

**Rule:** `tendered + creditAmount >= totalAmount`

**Why:** The invoice cannot be marked PAID if the amounts don't add up. Prevents creating invoices where the math doesn't work.

---

## 8. Immutable Inventory Movements

**Rule:** `inventory_movements` rows are never UPDATEd or DELETEd. Every stock change creates a new row.

**Why:** Provides a complete, tamper-evident audit trail of every stock movement. If there's a discrepancy, you can replay the entire movement history to find where the issue occurred. Allows point-in-time stock reconstruction.

---

## 9. Inventory Cached + Ledger Dual Write

**Rule:** Every stock change writes to both `inventory_items` (cached balance) AND `inventory_movements` (ledger) in the same transaction.

**Why:** `inventory_items` enables fast single-row reads for current stock without summing the entire movement log. `inventory_movements` is the source of truth for auditing and reconstruction. Both must stay in sync — hence the same transaction.

---

## 10. Negative Stock Control

**Rule:** By default, selling more units than are in stock is rejected (`"الكمية غير كافية في المخزن"`). A store setting `allow_negative_stock = true` overrides this.

**Why:** Most retail stores want to prevent selling items they don't physically have (it would create backorders they can't fulfill). Some store owners prefer to allow it (e.g., they know restocking is imminent) — so it's a configurable business rule, not a hard system constraint.

---

## 11. Double-Entry Accounting on Every Financial Event

**Rule:** Every sale, purchase, expense, salary payment, and equity movement creates balanced journal entries in `accounting_transactions` + `accounting_transaction_lines`.

**Why:** The store needs a proper P&L report. Without double-entry, you'd only have cash flow — you wouldn't know the true cost of goods sold, outstanding receivables, or net profit. The journal is what makes the Reports → P&L report accurate.

**Example — Sale of 1000 EGP (cost 600 EGP), paid cash:**
```
Dr. Cash (1000)     Cr. Sales Revenue (1000)
Dr. COGS (600)      Cr. Inventory (600)
```

---

## 12. Sales Return ≤ Sold Quantity

**Rule:** `returnQuantity <= (originalQuantity - alreadyReturnedQuantity)` for each invoice item.

**Why:** You cannot return more items than were sold. The `returned_quantity` field on `invoice_items` tracks cumulative returns to enforce this limit across multiple return operations on the same invoice.

---

## 13. Return Restocks the Original Warehouse

**Rule:** Returned items are added back to `invoice.warehouse_id` (the warehouse the goods were shipped from in the original sale).

**Why:** Restocking to the original source maintains warehouse-level accuracy. An alternative design (restocking to any warehouse) would make multi-warehouse balances hard to reconcile.

---

## 14. Purchase: Inventory IN Only After Confirmation

**Rule:** Stock increases only when a purchase invoice is confirmed, not at DRAFT status.

**Why:** A DRAFT purchase may never materialize. Increasing stock prematurely would give a false picture of available inventory, potentially leading to overselling items not yet received.

---

## 15. Warehouse Transfer: Two-Phase Confirm

**Rule:** Creating a transfer books `TRANSFER_OUT` from the source warehouse immediately. The destination warehouse only gets `TRANSFER_IN` when the transfer is marked COMPLETED (confirmed by destination).

**Why:** In multi-warehouse retail, items physically in transit should not be counted as available at either warehouse. The PENDING state represents "goods in transit." Only when received does destination stock increase.

---

## 16. Treasury Sessions (Cash Shifts)

**Rule:** Cash transactions can optionally require an open treasury session (`require_session_for_cash = true` in settings).

**Why:** Daily shift management. A cashier opens a session with the counted opening cash, operates all day, then closes the session by counting the actual cash. The system calculates the expected balance and shows any variance (shrinkage or counting errors).

---

## 17. Notification Deduplication

**Rule:** Only one active (unread) notification per `dedupe_key` per user exists at a time.

**Why:** Without deduplication, checking for low-stock every few minutes would flood the notification bell with thousands of identical alerts. The partial unique index on `(user_id, dedupe_key) WHERE is_read = false` prevents duplicates while allowing the alert to re-fire after a user reads and dismisses it.

---

## 18. Sequence Numbers Are Atomic

**Rule:** Invoice/return/transfer numbers are generated inside the same transaction as the document creation using `SELECT ... FOR UPDATE` semantics.

**Why:** Prevents duplicate invoice numbers in concurrent scenarios. The number is the human-readable reference (e.g., "INV-00042") that cashiers and customers use to identify a transaction.

---

## 19. Soft Delete for Users

**Rule:** Users are never hard-deleted. `is_deleted = true` hides them from all lists.

**Why:** Historical invoices, audit logs, and journal entries reference `user_id`. Hard-deleting a user would orphan these references and corrupt financial history. Soft delete preserves referential integrity.

---

## 20. Supplier Balance = Store's Payable

**Rule:** `suppliers.current_balance` is a positive number representing what the store owes the supplier (accounts payable).

**Why:** Common accounting convention — a supplier ledger balance means the store has an outstanding obligation. When the store pays the supplier, this balance decreases.

**Contrast:** `customers.current_balance` is what the customer owes the store (accounts receivable). Both are positive in the direction of the obligation.
