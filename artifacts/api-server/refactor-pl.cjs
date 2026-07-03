const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'src/routes/reports.ts');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /const salesConds: SQL\[\] = \[eq\(invoicesTable\.storeId, storeId\)\];[\s\S]*?const netProfit = grossProfit - totalExpenses;/m;

const replacement = `      const salesAgg = await AnalyticsService.getSalesKPIs(storeId, q.fromDate, q.toDate);
      const returnAgg = await AnalyticsService.getSalesReturnsKPIs(storeId, q.fromDate, q.toDate);
      const expAgg = await AnalyticsService.getExpensesKPIs(storeId, q.fromDate, q.toDate);
      const salaryAgg = await AnalyticsService.getSalariesKPIs(storeId, q.fromDate, q.toDate);

      const revenue = salesAgg.revenue ?? 0;
      const salesReturns = returnAgg.total ?? 0;
      const netRevenue = revenue - salesReturns;
      const cogs = (salesAgg.cost ?? 0) - (returnAgg.cost ?? 0);
      const grossProfit = netRevenue - cogs;

      const operatingExpenses = expAgg.total ?? 0;
      const salaries = salaryAgg.total ?? 0;
      const totalExpenses = operatingExpenses + salaries;

      const netProfit = grossProfit - totalExpenses;`;

if (regex.test(content)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Profit-Loss endpoint refactored successfully.');
} else {
  console.log('Could not find the block to replace.');
}
