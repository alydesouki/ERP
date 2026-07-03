const fs = require('fs');

function patchReports() {
  const file = 'src/routes/reports.ts';
  let code = fs.readFileSync(file, 'utf8');

  // Fix PostgreSQL syntax
  code = code.replace(/coalesce\(sum\((.*?)\),0\)::float8/g, 'CAST(coalesce(sum($1),0) AS REAL)');
  code = code.replace(/\(\$\{inventoryItemsTable\.quantity\} \* \$\{productVariantsTable\.costPrice\}\)::float8/g, 'CAST((${inventoryItemsTable.quantity} * ${productVariantsTable.costPrice}) AS REAL)');

  // Fix endOfDay and add drizzleDate
  if (!code.includes('function drizzleDate')) {
    code = code.replace(
      /function endOfDay\(d: Date\): Date \{[\s\S]*?return result;\s*\}/,
      `function endOfDay(d: Date): Date {
  const result = new Date(d);
  result.setHours(23, 59, 59, 999);
  return new Date(result.getTime() * 1000);
}`
    );

    code = code.replace(
      /function dateStr\(d: Date\): string \{/,
      `function drizzleDate(d: Date): Date {
  return new Date(d.getTime() * 1000);
}

function dateStr(d: Date): string {`
    );
  }

  // Replace q.fromDate with drizzleDate(q.fromDate) ONLY in gte() calls
  code = code.replace(/gte\(([\w\.]+),\s*q\.fromDate\)/g, 'gte($1, drizzleDate(q.fromDate))');

  fs.writeFileSync(file, code);
  console.log('Patched reports.ts');
}

function patchSales() {
  const file = 'src/routes/sales.ts';
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(
    /gte\(([\w\.]+),\s*new Date\(dateFrom\)\)/g, 
    'gte($1, new Date(new Date(dateFrom).getTime() * 1000))'
  );
  code = code.replace(
    /lte\(([\w\.]+),\s*new Date\(dateTo\)\)/g, 
    'lte($1, new Date(new Date(dateTo).getTime() * 1000))'
  );
  fs.writeFileSync(file, code);
  console.log('Patched sales.ts');
}

function patchDashboard() {
  const file = 'src/routes/dashboard.ts';
  let code = fs.readFileSync(file, 'utf8');
  
  // Add drizzleDate helper at the top just after imports
  if (!code.includes('function drizzleDate')) {
    code = code.replace(
      /const router = Router\(\);/,
      `const router = Router();\n\nfunction drizzleDate(d: Date): Date {\n  return new Date(d.getTime() * 1000);\n}\n`
    );
  }

  // If the regex didn't find "const router = Router();", add it after the imports
  if (!code.includes('function drizzleDate')) {
    code = code.replace(
      /import \{ eq, and, .* \} from "drizzle-orm";/,
      `import { eq, and, desc, gte, sql } from "drizzle-orm";\n\nfunction drizzleDate(d: Date): Date {\n  return new Date(d.getTime() * 1000);\n}\n`
    );
  }

  // Multiply the dynamic dates used in queries
  code = code.replace(/const today = startOfToday\(\);/g, 'const today = drizzleDate(startOfToday());');
  code = code.replace(/const last30 = subDays\((.*?), 30\);/g, 'const last30 = drizzleDate(subDays($1, 30));');
  code = code.replace(/const last12mo = subMonths\((.*?), 12\);/g, 'const last12mo = drizzleDate(subMonths($1, 12));');
  code = code.replace(/const monthStart = startOfMonth\(\);/g, 'const monthStart = drizzleDate(startOfMonth());');

  fs.writeFileSync(file, code);
  console.log('Patched dashboard.ts');
}

patchReports();
patchSales();
patchDashboard();
