import { useState } from "react";
import {
  FileBarChart,
  ShoppingCart,
  ShoppingBag,
  Boxes,
  AlertTriangle,
  Scale,
  Wallet,
  TrendingDown,
  Trophy,
} from "lucide-react";
import {
  useGetSalesSummaryReport,
  getGetSalesSummaryReportQueryKey,
  useGetPurchasesSummaryReport,
  getGetPurchasesSummaryReportQueryKey,
  useGetInventoryStockReport,
  getGetInventoryStockReportQueryKey,
  useGetLowStockReport,
  getGetLowStockReportQueryKey,
  useGetProfitLossReport,
  getGetProfitLossReportQueryKey,
  useGetTreasuryReport,
  getGetTreasuryReportQueryKey,
  useGetExpenseReport,
  getGetExpenseReportQueryKey,
  useGetTopProductsReport,
  getGetTopProductsReportQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";

function money(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthAgoStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

type ReportTab =
  | "sales"
  | "purchases"
  | "inventory"
  | "low-stock"
  | "profit-loss"
  | "treasury"
  | "expenses"
  | "top-products";

interface TabDef {
  key: ReportTab;
  label: string;
  icon: React.ReactNode;
  permission: string;
}

const TABS: TabDef[] = [
  { key: "sales", label: "ملخص المبيعات", icon: <ShoppingCart size={18} />, permission: "reports.sales" },
  { key: "top-products", label: "الأكثر مبيعاً", icon: <Trophy size={18} />, permission: "reports.sales" },
  { key: "purchases", label: "ملخص المشتريات", icon: <ShoppingBag size={18} />, permission: "reports.view" },
  { key: "inventory", label: "تقييم المخزون", icon: <Boxes size={18} />, permission: "reports.inventory" },
  { key: "low-stock", label: "نواقص المخزون", icon: <AlertTriangle size={18} />, permission: "reports.inventory" },
  { key: "profit-loss", label: "الأرباح والخسائر", icon: <Scale size={18} />, permission: "reports.view" },
  { key: "treasury", label: "حركة الخزينة", icon: <Wallet size={18} />, permission: "reports.view" },
  { key: "expenses", label: "المصروفات", icon: <TrendingDown size={18} />, permission: "reports.view" },
];

export function ReportsPage() {
  const { hasPermission } = useAuth();
  const visibleTabs = TABS.filter((t) => hasPermission(t.permission));
  const [active, setActive] = useState<ReportTab>(
    visibleTabs[0]?.key ?? "sales",
  );

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
          <FileBarChart className="text-amber-500" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-slate-800">التقارير</h2>
            <p className="text-slate-500 text-sm font-medium">
              تقارير تفصيلية عن المبيعات والمخزون والمالية
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              data-testid={`tab-${tab.key}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                active === tab.key
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          {active === "sales" && <SalesReport />}
          {active === "top-products" && <TopProductsReport />}
          {active === "purchases" && <PurchasesReport />}
          {active === "inventory" && <InventoryReport />}
          {active === "low-stock" && <LowStockReport />}
          {active === "profit-loss" && <ProfitLossReport />}
          {active === "treasury" && <TreasuryReport />}
          {active === "expenses" && <ExpensesReport />}
        </div>
      </div>
    </div>
  );
}

function DateRange({
  from,
  to,
  setFrom,
  setTo,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">من تاريخ</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          data-testid="input-from-date"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">إلى تاريخ</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          data-testid="input-to-date"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-5 py-3 border border-slate-100">
      <p className="text-xs text-slate-500 font-semibold">{label}</p>
      <p className="text-lg font-black text-slate-800">{value}</p>
    </div>
  );
}

function Table({
  headers,
  children,
  empty,
  loading,
}: {
  headers: string[];
  children: React.ReactNode;
  empty: boolean;
  loading: boolean;
}) {
  if (loading)
    return <p className="text-slate-400 text-sm py-8 text-center">جارٍ التحميل...</p>;
  if (empty)
    return (
      <p className="text-slate-400 text-sm py-8 text-center">
        لا توجد بيانات للفترة المحددة.
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-slate-500 border-b border-slate-200">
            {headers.map((h) => (
              <th key={h} className="text-right font-bold py-2 px-3 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

function SalesReport() {
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const params = { fromDate: from, toDate: to };
  const q = useGetSalesSummaryReport(params, {
    query: { queryKey: getGetSalesSummaryReportQueryKey(params) },
  });
  const d = q.data;
  return (
    <div>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="flex flex-wrap gap-3 mb-5">
        <SummaryStat label="عدد الفواتير" value={String(d?.count ?? 0)} />
        <SummaryStat label="إجمالي المبيعات" value={money(d?.total)} />
      </div>
      <Table
        headers={["رقم الفاتورة", "التاريخ", "العميل", "طريقة الدفع", "الحالة", "الإجمالي"]}
        loading={q.isLoading}
        empty={!d || d.rows.length === 0}
      >
        {d?.rows.map((r) => (
          <tr key={r.id} className="text-slate-700">
            <td className="py-2 px-3 font-bold">{r.invoiceNumber}</td>
            <td className="py-2 px-3">{formatDateTime(r.date)}</td>
            <td className="py-2 px-3">{r.customerName ?? "—"}</td>
            <td className="py-2 px-3">{r.paymentMethod ?? "—"}</td>
            <td className="py-2 px-3">{r.paymentStatus}</td>
            <td className="py-2 px-3 font-bold">{money(r.total)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function TopProductsReport() {
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const params = { fromDate: from, toDate: to };
  const q = useGetTopProductsReport(params, {
    query: { queryKey: getGetTopProductsReportQueryKey(params) },
  });
  const d = q.data;
  return (
    <div>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <Table
        headers={["#", "المنتج", "SKU", "الكمية المباعة", "الإيراد"]}
        loading={q.isLoading}
        empty={!d || d.rows.length === 0}
      >
        {d?.rows.map((r, i) => (
          <tr key={r.variantId} className="text-slate-700">
            <td className="py-2 px-3 text-slate-400">{i + 1}</td>
            <td className="py-2 px-3 font-bold">{r.productName}</td>
            <td className="py-2 px-3 font-mono text-xs">{r.sku ?? "—"}</td>
            <td className="py-2 px-3">{r.quantitySold}</td>
            <td className="py-2 px-3 font-bold">{money(r.revenue)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function PurchasesReport() {
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const params = { fromDate: from, toDate: to };
  const q = useGetPurchasesSummaryReport(params, {
    query: { queryKey: getGetPurchasesSummaryReportQueryKey(params) },
  });
  const d = q.data;
  return (
    <div>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="flex flex-wrap gap-3 mb-5">
        <SummaryStat label="عدد الفواتير" value={String(d?.count ?? 0)} />
        <SummaryStat label="إجمالي المشتريات" value={money(d?.total)} />
      </div>
      <Table
        headers={["رقم الفاتورة", "التاريخ", "المورد", "الحالة", "الإجمالي"]}
        loading={q.isLoading}
        empty={!d || d.rows.length === 0}
      >
        {d?.rows.map((r) => (
          <tr key={r.id} className="text-slate-700">
            <td className="py-2 px-3 font-bold">{r.invoiceNumber}</td>
            <td className="py-2 px-3">{formatDate(r.date)}</td>
            <td className="py-2 px-3">{r.supplierName ?? "—"}</td>
            <td className="py-2 px-3">{r.status}</td>
            <td className="py-2 px-3 font-bold">{money(r.total)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function InventoryReport() {
  const q = useGetInventoryStockReport(undefined, {
    query: { queryKey: getGetInventoryStockReportQueryKey() },
  });
  const d = q.data;
  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <SummaryStat label="إجمالي الكمية" value={String(d?.totalQuantity ?? 0)} />
        <SummaryStat label="قيمة المخزون" value={money(d?.totalValue)} />
      </div>
      <Table
        headers={["المنتج", "النوع", "SKU", "المخزن", "الفئة", "الكمية", "التكلفة", "القيمة"]}
        loading={q.isLoading}
        empty={!d || d.rows.length === 0}
      >
        {d?.rows.map((r) => (
          <tr key={`${r.variantId}-${r.warehouseName}`} className="text-slate-700">
            <td className="py-2 px-3 font-bold">{r.productName}</td>
            <td className="py-2 px-3">{r.variantLabel ?? "—"}</td>
            <td className="py-2 px-3 font-mono text-xs">{r.sku ?? "—"}</td>
            <td className="py-2 px-3">{r.warehouseName ?? "—"}</td>
            <td className="py-2 px-3">{r.categoryName ?? "—"}</td>
            <td className="py-2 px-3">{r.quantity}</td>
            <td className="py-2 px-3">{money(r.cost)}</td>
            <td className="py-2 px-3 font-bold">{money(r.value)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function LowStockReport() {
  const q = useGetLowStockReport(undefined, {
    query: { queryKey: getGetLowStockReportQueryKey() },
  });
  const d = q.data;
  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-5">
        <SummaryStat label="عدد النواقص" value={String(d?.count ?? 0)} />
      </div>
      <Table
        headers={["المنتج", "النوع", "SKU", "المخزن", "الكمية", "حد الطلب", "النقص"]}
        loading={q.isLoading}
        empty={!d || d.rows.length === 0}
      >
        {d?.rows.map((r) => (
          <tr key={`${r.variantId}-${r.warehouseName}`} className="text-slate-700">
            <td className="py-2 px-3 font-bold">{r.productName}</td>
            <td className="py-2 px-3">{r.variantLabel ?? "—"}</td>
            <td className="py-2 px-3 font-mono text-xs">{r.sku ?? "—"}</td>
            <td className="py-2 px-3">{r.warehouseName ?? "—"}</td>
            <td className="py-2 px-3">{r.quantity}</td>
            <td className="py-2 px-3">{r.reorderPoint}</td>
            <td className="py-2 px-3 font-bold text-rose-600">{r.shortage}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function ProfitLossReport() {
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const params = { fromDate: from, toDate: to };
  const q = useGetProfitLossReport(params, {
    query: { queryKey: getGetProfitLossReportQueryKey(params) },
  });
  const d = q.data;
  const rows: { label: string; value: number | undefined; strong?: boolean; neg?: boolean }[] = [
    { label: "الإيرادات", value: d?.revenue },
    { label: "مرتجعات المبيعات", value: d?.salesReturns, neg: true },
    { label: "صافي الإيرادات", value: d?.netRevenue, strong: true },
    { label: "تكلفة البضاعة المباعة", value: d?.cogs, neg: true },
    { label: "إجمالي الربح", value: d?.grossProfit, strong: true },
    { label: "المصروفات", value: d?.expenses, neg: true },
    { label: "الرواتب", value: d?.salaries, neg: true },
    { label: "صافي الربح", value: d?.netProfit, strong: true },
  ];
  return (
    <div>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      {q.isLoading ? (
        <p className="text-slate-400 text-sm py-8 text-center">جارٍ التحميل...</p>
      ) : (
        <div className="max-w-lg space-y-1">
          {rows.map((r) => (
            <div
              key={r.label}
              className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                r.strong ? "bg-slate-100 font-black" : ""
              }`}
            >
              <span className={r.strong ? "text-slate-800" : "text-slate-600"}>
                {r.label}
              </span>
              <span
                className={
                  r.neg
                    ? "text-rose-600 font-bold"
                    : r.strong
                      ? "text-emerald-700"
                      : "text-slate-800 font-bold"
                }
              >
                {r.neg ? "−" : ""}
                {money(r.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TreasuryReport() {
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const params = { fromDate: from, toDate: to };
  const q = useGetTreasuryReport(params, {
    query: { queryKey: getGetTreasuryReportQueryKey(params) },
  });
  const d = q.data;
  return (
    <div>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="flex flex-wrap gap-3 mb-5">
        <SummaryStat label="إجمالي الوارد" value={money(d?.totalIn)} />
        <SummaryStat label="إجمالي المنصرف" value={money(d?.totalOut)} />
      </div>
      <Table
        headers={["التاريخ", "الحساب", "الاتجاه", "المبلغ", "الرصيد بعد", "المرجع"]}
        loading={q.isLoading}
        empty={!d || d.rows.length === 0}
      >
        {d?.rows.map((r) => (
          <tr key={r.id} className="text-slate-700">
            <td className="py-2 px-3">{formatDateTime(r.date)}</td>
            <td className="py-2 px-3">{r.accountName}</td>
            <td className="py-2 px-3">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  r.direction === "IN"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-rose-100 text-rose-700"
                }`}
              >
                {r.direction === "IN" ? "وارد" : "منصرف"}
              </span>
            </td>
            <td className="py-2 px-3 font-bold">{money(r.amount)}</td>
            <td className="py-2 px-3">{money(r.balanceAfter)}</td>
            <td className="py-2 px-3 text-xs">{r.referenceType}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}

function ExpensesReport() {
  const [from, setFrom] = useState(monthAgoStr());
  const [to, setTo] = useState(todayStr());
  const params = { fromDate: from, toDate: to };
  const q = useGetExpenseReport(params, {
    query: { queryKey: getGetExpenseReportQueryKey(params) },
  });
  const d = q.data;
  return (
    <div>
      <DateRange from={from} to={to} setFrom={setFrom} setTo={setTo} />
      <div className="flex flex-wrap gap-3 mb-5">
        <SummaryStat label="إجمالي المصروفات" value={money(d?.total)} />
      </div>
      <Table
        headers={["التاريخ", "الفئة", "الوصف", "المبلغ"]}
        loading={q.isLoading}
        empty={!d || d.rows.length === 0}
      >
        {d?.rows.map((r) => (
          <tr key={r.id} className="text-slate-700">
            <td className="py-2 px-3">{formatDate(r.date)}</td>
            <td className="py-2 px-3">{r.categoryName ?? "—"}</td>
            <td className="py-2 px-3">{r.description ?? "—"}</td>
            <td className="py-2 px-3 font-bold">{money(r.amount)}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
