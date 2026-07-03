const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'src/routes/reports.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace standard coalesce(sum(...),0)::float8
content = content.replace(/coalesce\(sum\((.*?)\),0\)::float8/g, 'CAST(coalesce(sum($1), 0) AS REAL)');

// Replace inventory quantity * cost price ::float8
content = content.replace(/\(`\(\$\{inventoryItemsTable\.quantity\} \* \$\{productVariantsTable\.costPrice\}\)::float8`\)/g, '(`CAST(${inventoryItemsTable.quantity} * CAST(${productVariantsTable.costPrice} AS REAL) AS REAL)`)');

// Replace top products sum::float8
content = content.replace(/revenue: sql<number>`coalesce\(sum\(\$\{invoiceItemsTable.lineTotal\}\),0\)::float8`/g, 'revenue: sql<number>`CAST(coalesce(sum(${invoiceItemsTable.lineTotal}), 0) AS REAL)`');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced ::float8 with CAST AS REAL in reports.ts');
