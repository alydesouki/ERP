const fs = require('fs');
const path = 'd:/Erp/ERP/artifacts/pos/src/pages/finance.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

const startIndex = lines.findIndex(l => l.includes('function AdvancesTab'));
const endIndex = lines.findIndex(l => l.includes('function EquityTab'));

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find start or end index!');
  process.exit(1);
}

const correctCode = `function AdvancesTab({ canManage }: { canManage: boolean }) {
  const { hasPermission } = useAuth();
  const canDelete = hasPermission("finance.delete");
  const queryClient = useQueryClient();
  const listQuery = useListAdvances({ page: 1, pageSize: 50 });
  const employeesQuery = useListEmployees();
  const createMutation = useCreateAdvance();
  const deleteMutation = useDeleteAdvance();

  const [modalOpen, setModalOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [advanceDate, setAdvanceDate] = useState(todayStr());
  const [treasuryAccountId, setTreasuryAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteAdvance, setPendingDeleteAdvance] = useState<{
    id: string;
    label: string;
  } | null>(null);

  const advances = listQuery.data?.items ?? [];
  const employees = (employeesQuery.data ?? []).filter((e) => e.isActive);

  function openAdd() {
    setEmployeeId("");
    setAmount("");
    setAdvanceDate(todayStr());
    setTreasuryAccountId("");
    setNotes("");
    setError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!employeeId) return setError("اختر الموظف.");
    if (!(amt > 0)) return setError("أدخل مبلغاً صحيحاً أكبر من صفر.");
    if (!treasuryAccountId) return setError("اختر الخزينة.");
    try {
      await createMutation.mutateAsync({
        data: {
          employeeId,
          amount: amt,
          advanceDate,
          treasuryAccountId,
          notes: notes.trim() || null,
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/finance/advances"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/finance/employees"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/treasury/accounts"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/reports/treasury"] });
      setModalOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err, "تعذّر تسجيل السلفة."));
    }
  }

  return (
    <Card>
      <SectionHead
        title="السلف"
        action={canManage ? <AddButton onClick={openAdd} label="سلفة جديدة" /> : undefined}
      />
      {listQuery.isLoading ? (
        <p className="text-slate-400 text-center py-12">جارٍ التحميل...</p>
      ) : advances.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-right font-bold px-6 py-3">التاريخ</th>
              <th className="text-right font-bold px-6 py-3">الموظف</th>
              <th className="text-right font-bold px-6 py-3">المبلغ</th>
              <th className="text-right font-bold px-6 py-3">ملاحظات</th>
              {canDelete && <th className="text-left font-bold px-6 py-3">إجراء</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {advances.map((a) => (
              <tr key={a.id} data-testid={\`row-advance-\${a.id}\`}>
                <td className="px-6 py-3 text-slate-600">{a.advanceDate}</td>
                <td className="px-6 py-3 font-medium text-slate-700">{a.employeeName ?? "—"}</td>
                <td className="px-6 py-3 font-bold text-amber-600">{money(a.amount)}</td>
                <td className="px-6 py-3 text-slate-500">{a.notes ?? "—"}</td>
                {canDelete && (
                  <td className="px-6 py-3">
                    <button
                      onClick={() =>
                        setPendingDeleteAdvance({
                          id: a.id,
                          label: \`\${a.employeeName ?? ""} — \${money(a.amount)}\`,
                        })
                      }
                      disabled={deleteMutation.isPending}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="إلغاء السلفة (عكس الحركة)"
                      data-testid={\`button-delete-advance-\${a.id}\`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-slate-400 text-center py-12">لا توجد سلف.</p>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="سلفة جديدة">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="الموظف" required>
            <select
              className={inputClass}
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              data-testid="select-advance-employee"
            >
              <option value="">اختر الموظف</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المبلغ" required>
            <input
              type="number"
              step="0.01"
              className={inputClass}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-advance-amount"
            />
          </Field>
          <Field label="التاريخ" required>
            <input
              type="date"
              className={inputClass}
              value={advanceDate}
              onChange={(e) => setAdvanceDate(e.target.value)}
              data-testid="input-advance-date"
            />
          </Field>
          <TreasurySelect value={treasuryAccountId} onChange={setTreasuryAccountId} />
          <Field label="ملاحظات">
            <input
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-advance-notes"
            />
          </Field>
          {error && <ErrorBox message={error} />}
          <SubmitButton busy={createMutation.isPending} label="تسجيل السلفة" />
        </form>
      </Modal>

      {pendingDeleteAdvance && (
        <ConfirmModal
          message={\`إلغاء سلفة — \${pendingDeleteAdvance.label}\`}
          detail="سيتم عكس حركة الخزينة والقيد المحاسبي، وتقليل رصيد السلف للموظف."
          busy={deleteMutation.isPending}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync({ id: pendingDeleteAdvance.id });
              void queryClient.invalidateQueries({ queryKey: ["/api/finance/advances"] });
              void queryClient.invalidateQueries({ queryKey: ["/api/finance/employees"] });
              void queryClient.invalidateQueries({ queryKey: ["/api/treasury/accounts"] });
              void queryClient.invalidateQueries({ queryKey: ["/api/reports/treasury"] });
              setPendingDeleteAdvance(null);
            } catch (err) {
              setPendingDeleteAdvance(null);
              setError(apiErrorMessage(err, "تعذّر إلغاء السلفة."));
            }
          }}
          onCancel={() => setPendingDeleteAdvance(null)}
        />
      )}
    </Card>
  );
}

// ── Equity Movements ────────────────────────────────────────────────────────

`;

const newLines = [
  ...lines.slice(0, startIndex),
  correctCode,
  ...lines.slice(endIndex)
];

fs.writeFileSync(path, newLines.join('\\n').replace(/\\r/g, ''), 'utf8');
console.log('Successfully fixed finance.tsx');
