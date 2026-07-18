const fs = require('fs');
let code = fs.readFileSync('artifacts/api-server/src/routes/reports.ts', 'utf8');

const replacement = \
    const conditions: SQL[] = [eq(purchaseInvoicesTable.storeId, storeId)];
    if (q.fromDate) conditions.push(gte(purchaseInvoicesTable.invoiceDate, dateStr(getShiftStart(q.fromDate))));
    if (q.toDate) conditions.push(lte(purchaseInvoicesTable.invoiceDate, dateStr(getShiftEnd(q.toDate))));
    if (q.supplierId) conditions.push(eq(purchaseInvoicesTable.supplierId, q.supplierId));

    const invoiceRows = await db
      .select({
        id: purchaseInvoicesTable.id,
        invoiceNumber: purchaseInvoicesTable.invoiceNumber,
        date: purchaseInvoicesTable.invoiceDate,
        supplierName: suppliersTable.name,
        total: purchaseInvoicesTable.totalAmount,
        status: purchaseInvoicesTable.status,
      })
      .from(purchaseInvoicesTable)
      .leftJoin(suppliersTable, eq(suppliersTable.id, purchaseInvoicesTable.supplierId))
      .where(and(...conditions))
      .orderBy(desc(purchaseInvoicesTable.invoiceDate));

    // Also get returns
    const retConditions: SQL[] = [eq(purchaseReturnsTable.storeId, storeId)];
    if (q.fromDate) retConditions.push(gte(purchaseReturnsTable.createdAt, getShiftStart(q.fromDate)));
    if (q.toDate) retConditions.push(lte(purchaseReturnsTable.createdAt, getShiftEnd(q.toDate)));
    // Note: purchaseReturnsTable doesn't have a direct supplierId in this schema, so we can't easily filter by supplier unless we join invoices.
    
    let returnQuery = db
      .select({
        id: purchaseReturnsTable.id,
        invoiceNumber: purchaseReturnsTable.returnNumber,
        date: sql<string>\\\strftime('%Y-%m-%d', \)\\\,
        supplierName: suppliersTable.name,
        total: purchaseReturnsTable.totalAmount,
        status: sql<string>\\\'مرتجع'\\\,
      })
      .from(purchaseReturnsTable)
      .leftJoin(purchaseInvoicesTable, eq(purchaseReturnsTable.purchaseId, purchaseInvoicesTable.id))
      .leftJoin(suppliersTable, eq(suppliersTable.id, purchaseInvoicesTable.supplierId));

    if (q.supplierId) {
       retConditions.push(eq(purchaseInvoicesTable.supplierId, q.supplierId));
    }
    
    const returnRows = await returnQuery.where(and(...retConditions)).orderBy(desc(purchaseReturnsTable.createdAt));

    // Make returns negative
    const formattedReturnRows = returnRows.map(r => ({
      ...r,
      total: -toNum(r.total)
    }));

    const rows = [...invoiceRows, ...formattedReturnRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = rows.reduce((s, r) => s + toNum(r.total), 0);
\;

code = code.replace(/const conditions: SQL\[\] = \[eq\(purchaseInvoicesTable\.storeId, storeId\)\];[\s\S]*?const total = rows\.reduce\(\(s, r\) => s \+ toNum\(r\.total\), 0\);/, replacement);

fs.writeFileSync('artifacts/api-server/src/routes/reports.ts', code);
console.log('Fixed reports.ts');
