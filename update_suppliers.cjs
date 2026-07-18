const fs = require('fs');

let content = fs.readFileSync('artifacts/pos/src/pages/suppliers.tsx', 'utf8');

// 1. Add state
content = content.replace('const [paying, setPaying] = useState<Supplier | null>(null);', 'const [paying, setPaying] = useState<Supplier | null>(null);\n  const [adjusting, setAdjusting] = useState<Supplier | null>(null);');

// 2. Add icon
if (!content.includes('Settings2')) {
    content = content.replace('Trash2,', 'Trash2,\n  Settings2,');
}

// 3. Add adjust button after editing button
const editBtn = {canEdit && (
                          <button
                            onClick={() => setEditing(s)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                            title="تعديل"
                            data-testid={\utton-edit-supplier-\\}
                          >
                            <Pencil size={16} />
                          </button>
                        )};
const adjustBtn = {canEdit && (
                          <button
                            onClick={() => setAdjusting(s)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition"
                            title="تسوية رصيد"
                            data-testid={\utton-adjust-supplier-\\}
                          >
                            <Settings2 size={16} />
                          </button>
                        )};

if (!content.includes('setAdjusting(s)')) {
    content = content.replace(editBtn, editBtn + '\n                        ' + adjustBtn);
}

// 4. Add Adjust modal render
const payingRender = {paying && (
        <SupplierPaymentModal
          supplier={paying}
          onClose={() => setPaying(null)}
          onSaved={() => {
            invalidate();
            setPaying(null);
          }}
        />
      )};
const adjustingRender = {adjusting && (
        <AdjustSupplierModal
          supplier={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            invalidate();
            setAdjusting(null);
          }}
        />
      )};

if (!content.includes('<AdjustSupplierModal')) {
    content = content.replace(payingRender, payingRender + '\n\n      ' + adjustingRender);
}

// 5. Append AdjustSupplierModal definition
if (!content.includes('function AdjustSupplierModal')) {
    const modalCode = \

function AdjustSupplierModal({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Supplier;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newBalance, setNewBalance] = useState((toNum(supplier.currentBalance)).toString());
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adjustApi = useAdjustSupplierBalance();

  const handle = async () => {
    setError(null);
    const balanceNum = parseFloat(newBalance);
    if (isNaN(balanceNum)) {
      setError("الرصيد الجديد غير صحيح");
      return;
    }

    setSubmitting(true);
    try {
      await adjustApi.mutateAsync({
        id: supplier.id,
        data: {
          newBalance: balanceNum,
          notes: notes || null,
        },
      });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, "حدث خطأ أثناء تعديل الرصيد."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title="تسوية رصيد مورد" onClose={onClose}>
      <div className="space-y-4 pt-2">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl flex items-start gap-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-xl mb-4 border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">المورد</p>
          <p className="font-bold text-slate-900 text-lg">{supplier.name}</p>
          <p className="text-sm text-slate-500 mt-2">الرصيد الحالي</p>
          <p className="font-bold text-amber-600 text-lg">{money(supplier.currentBalance)}</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">الرصيد الجديد</label>
          <input
            type="number"
            autoFocus
            step="0.01"
            value={newBalance}
            onChange={(e) => setNewBalance(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            data-testid="input-adjust-balance"
          />
          <p className="text-xs text-slate-500 mt-1">أدخل الرصيد النهائي المطلوب (بالموجب إذا كان لنا عنده، وبالسالب إذا كان له عندنا، أو صفر إذا تمت تصفيته)</p>
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">سبب التعديل (ملاحظات)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
            rows={2}
            data-testid="input-adjust-notes"
            placeholder="مثال: تصحيح خطأ في مرتجع"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
          >
            إلغاء
          </button>
          <button
            onClick={() => void handle()}
            disabled={submitting}
            className="flex-1 py-2.5 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 transition shadow-md shadow-amber-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
            data-testid="button-save-adjust"
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            حفظ التعديل
          </button>
        </div>
      </div>
    </Modal>
  );
}
\;
    content += modalCode;
}

fs.writeFileSync('artifacts/pos/src/pages/suppliers.tsx', content);
console.log('Fixed suppliers.tsx!');
