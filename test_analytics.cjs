const { AnalyticsService } = require("./artifacts/api-server/dist/lib/analytics-service.js");
const { db } = require("@workspace/db");

async function run() {
  try {
    const storeId = "1"; // Assuming storeId is 1 for testing
    console.log("Fetching KPIs...");
    const salesAgg = await AnalyticsService.getSalesKPIs(storeId, new Date("2026-07-17"));
    console.log("salesAgg:", salesAgg);
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
run();
