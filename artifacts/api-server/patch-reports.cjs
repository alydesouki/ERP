const fs = require('fs');
const file = 'C:\\\\Users\\\\moham\\\\Downloads\\\\Shoe-Store-Design\\\\Shoe-Store-Design\\\\artifacts\\\\api-server\\\\src\\\\routes\\\\reports.ts';
let code = fs.readFileSync(file, 'utf8');

// Update endOfDay
code = code.replace(
  /function endOfDay\(d: Date\): Date \{[\s\S]*?return result;\s*\}/,
  `function endOfDay(d: Date): Date {
  const result = new Date(d);
  result.setHours(23, 59, 59, 999);
  return new Date(result.getTime() * 1000);
}`
);

// Add drizzleDate helper
code = code.replace(
  /function dateStr\(d: Date\): string \{/,
  `function drizzleDate(d: Date): Date {
  return new Date(d.getTime() * 1000);
}

function dateStr(d: Date): string {`
);

// Replace q.fromDate with drizzleDate(q.fromDate) ONLY in gte() calls, EXCEPT when inside dateStr()
code = code.replace(/gte\(([\w\.]+),\s*q\.fromDate\)/g, 'gte($1, drizzleDate(q.fromDate))');

fs.writeFileSync(file, code);

// Patch sales.ts too
const salesFile = 'C:\\\\Users\\\\moham\\\\Downloads\\\\Shoe-Store-Design\\\\Shoe-Store-Design\\\\artifacts\\\\api-server\\\\src\\\\routes\\\\sales.ts';
let salesCode = fs.readFileSync(salesFile, 'utf8');
salesCode = salesCode.replace(
  /gte\(([\w\.]+),\s*new Date\(dateFrom\)\)/g, 
  'gte($1, new Date(new Date(dateFrom).getTime() * 1000))'
);
salesCode = salesCode.replace(
  /lte\(([\w\.]+),\s*new Date\(dateTo\)\)/g, 
  'lte($1, new Date(new Date(dateTo).getTime() * 1000))'
);
fs.writeFileSync(salesFile, salesCode);

console.log('Patched correctly');
