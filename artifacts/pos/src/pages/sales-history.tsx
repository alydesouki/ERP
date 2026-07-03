import { useState } from "react";
import { Receipt, Search, Loader2, Eye, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { useListInvoices, useGetInvoice, useGetStoreSettings } from "@workspace/api-client-react";
import { normalizeBarcodeInput } from "@/lib/barcode-input";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/modal";
import { PrintPortal } from "@/components/print-portal";
import { printInvoice } from "@/lib/printer-settings";
import { A4Invoice } from "@/components/a4-invoice";

const CUR = "ج.م";

function money(v: string | number): string {
  const n = typeof v === "string" ? Number(v) : v;
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentBadge(status: string) {
  const map: Record<string, [string, string]> = {
    PAID: ["مدفوعة", "bg-green-50 text-green-700"],
    PARTIAL: ["جزئية", "bg-amber-50 text-amber-700"],
    UNPAID: ["آجلة", "bg-red-50 text-red-700"],
  };
  const [label, cls] = map[status] ?? [status, "bg-slate-100 text-slate-600"];
  return <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${cls}`}>{label}</span>;
}

function returnBadge(status: string) {
  if (status === "NONE") return null;
  const map: Record<string, [string, string]> = {
    PARTIAL: ["مرتجع جزئي", "bg-orange-50 text-orange-700"],
    FULL: ["مرتجع كامل", "bg-red-50 text-red-700"],
  };
  const [label, cls] = map[status] ?? [status, "bg-slate-100 text-slate-600"];
  return <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${cls}`}>{label}</span>;
}

export function SalesHistoryPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const query = useListInvoices({ page, pageSize, search: search || undefined });
  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [viewId, setViewId] = useState<string | null>(null);

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <PageHeader
          title="سجل المبيعات"
          subtitle="جميع فواتير البيع"
          icon={<Receipt size={24} />}
        />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={search}
              onChange={(e) => {
                setSearch(normalizeBarcodeInput(e.target.value));
                setPage(1);
              }}
              placeholder="بحث برقم الفاتورة أو الباركود..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              data-testid="input-search-invoices"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {query.isLoading ? (
            <div className="p-12 text-center text-slate-400">
              <Loader2 className="animate-spin inline" size={28} />
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center text-slate-400">لا توجد فواتير</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-bold">
                <tr>
                  <th className="text-right p-4">رقم الفاتورة</th>
                  <th className="text-right p-4">العميل</th>
                  <th className="text-right p-4">التاريخ</th>
                  <th className="text-left p-4">الإجمالي</th>
                  <th className="text-center p-4">الحالة</th>
                  <th className="text-center p-4">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50" data-testid={`invoice-row-${inv.id}`}>
                    <td className="p-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        {inv.invoiceNumber}
                        {returnBadge(inv.returnStatus)}
                      </div>
                    </td>
                    <td className="p-4 text-slate-600">{inv.customerName ?? "عميل نقدي"}</td>
                    <td className="p-4 text-slate-500 text-xs">{dateTime(inv.createdAt)}</td>
                    <td className="p-4 text-left font-bold text-slate-800">
                      {money(inv.totalAmount)} {CUR}
                    </td>
                    <td className="p-4 text-center">{paymentBadge(inv.paymentStatus)}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setViewId(inv.id)}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                        data-testid={`button-view-${inv.id}`}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <span className="text-sm text-slate-500">
                صفحة {page} من {totalPages} — {total} فاتورة
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  data-testid="button-prev-page"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                  data-testid="button-next-page"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {viewId && <InvoiceDetailModal id={viewId} onClose={() => setViewId(null)} />}
    </div>
  );
}

function InvoiceDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useGetInvoice(id);
  const settingsQuery = useGetStoreSettings();
  const inv = query.data;

  function handlePrint() {
    void printInvoice();
  }

  const pageStyle = `
    size: A4;
    margin: 0;
  `;

  const bodyHideStyle = `
    @media print {
      body > *:not(#print-portal) { display: none !important; }
      #print-portal { display: block !important; position: static !important; width: 100% !important; }
    }
  `;

  return (
    <Modal open onClose={onClose} title={inv ? `فاتورة ${inv.invoiceNumber}` : "تفاصيل الفاتورة"} maxWidth="max-w-2xl">
      {query.isLoading || !inv ? (
        <div className="py-8 text-center text-slate-400">
          <Loader2 className="animate-spin inline" size={24} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs">العميل</p>
              <p className="font-bold text-slate-800">{inv.customerName ?? "عميل نقدي"}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-slate-400 text-xs">المخزن</p>
              <p className="font-bold text-slate-800">{inv.warehouseName ?? "-"}</p>
            </div>
          </div>

          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs font-bold">
                <tr>
                  <th className="text-right p-3">المنتج</th>
                  <th className="text-center p-3">الكمية</th>
                  <th className="text-center p-3">السعر</th>
                  <th className="text-left p-3">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inv.items.map((it) => (
                  <tr key={it.id}>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{it.productName}</div>
                      <div className="text-xs text-slate-500">
                        {[it.sizeName && `مقاس ${it.sizeName}`, it.colorName].filter(Boolean).join(" • ")}
                        {(it.returnedQuantity ?? 0) > 0 && (
                          <span className="text-red-500 mr-2">(مرتجع {it.returnedQuantity})</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center font-bold">{it.quantity}</td>
                    <td className="p-3 text-center">{money(it.unitPrice)}</td>
                    <td className="p-3 text-left font-bold">{money(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">المجموع الفرعي</span>
              <span className="font-bold">{money(inv.subtotal)} {CUR}</span>
            </div>
            {Number(inv.discountAmount) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>الخصم</span>
                <span className="font-bold">- {money(inv.discountAmount)} {CUR}</span>
              </div>
            )}
            <div className="flex justify-between text-base border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-700">الإجمالي</span>
              <span className="font-black text-amber-600">{money(inv.totalAmount)} {CUR}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">المدفوع</span>
              <span className="font-bold">{money(inv.amountPaid)} {CUR}</span>
            </div>
          </div>

          {inv.payments.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">طرق الدفع</p>
              <div className="flex flex-wrap gap-2">
                {inv.payments.map((p) => (
                  <span
                    key={p.id}
                    className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700"
                  >
                    {p.method}: {money(p.amount)} {CUR}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition"
            >
              <Printer size={18} /> طباعة الفاتورة A4
            </button>
          </div>
          
          <PrintPortal pageStyle={pageStyle}>
            <style dangerouslySetInnerHTML={{ __html: bodyHideStyle }} />
            <A4Invoice invoice={inv} storeName={settingsQuery.data?.storeName} />
          </PrintPortal>
        </div>
      )}
    </Modal>
  );
}
