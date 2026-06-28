import { useState } from "react";
import {
  Package,
  Search,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Layers,
  X,
} from "lucide-react";
import {
  useListProducts,
  useGetProduct,
  useListCategories,
  useListBrands,
  useListColors,
  useListSizes,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useCreateVariant,
  useUpdateVariant,
  useDeleteVariant,
  ApiError,
  type Product,
  type ProductVariant,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Modal } from "@/components/modal";

const PAGE_SIZE = 10;
const inputClass =
  "w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition";

function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: string } | undefined;
    return data?.error ?? fallback;
  }
  return fallback;
}

function money(value: string | null | undefined): string {
  if (value == null) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProductsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = hasPermission("products.create");
  const canEdit = hasPermission("products.edit");
  const canDelete = hasPermission("products.delete");
  const canManage = canEdit || canDelete;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [managingVariants, setManagingVariants] = useState<Product | null>(null);

  const categoriesQuery = useListCategories({ includeInactive: false });
  const brandsQuery = useListBrands({ includeInactive: false });
  const productsQuery = useListProducts({
    page,
    pageSize: PAGE_SIZE,
    search: appliedSearch || undefined,
    categoryId: categoryId || undefined,
    brandId: brandId || undefined,
    includeInactive,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
  };

  const totalPages = productsQuery.data
    ? Math.max(Math.ceil(productsQuery.data.total / PAGE_SIZE), 1)
    : 1;

  function applySearch() {
    setPage(1);
    setAppliedSearch(search.trim());
  }

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="المنتجات"
          subtitle="إدارة المنتجات والتنويعات والأسعار"
          icon={<Package size={24} />}
          action={
            canCreate ? (
              <button
                onClick={() => setCreating(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 transition shadow-md shadow-amber-500/20 shrink-0"
                data-testid="button-add-product"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">منتج جديد</span>
              </button>
            ) : undefined
          }
        />

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={18}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="بحث بالاسم أو رمز الصنف أو الباركود..."
              className={inputClass}
              style={{ paddingRight: "2.5rem" }}
              data-testid="input-product-search"
            />
          </div>
          <select
            value={categoryId}
            onChange={(e) => {
              setPage(1);
              setCategoryId(e.target.value);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none font-medium text-slate-700"
            data-testid="select-filter-category"
          >
            <option value="">كل الفئات</option>
            {(categoriesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={brandId}
            onChange={(e) => {
              setPage(1);
              setBrandId(e.target.value);
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 outline-none font-medium text-slate-700"
            data-testid="select-filter-brand"
          >
            <option value="">كل الماركات</option>
            {(brandsQuery.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-600 px-2 cursor-pointer select-none whitespace-nowrap">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setPage(1);
                setIncludeInactive(e.target.checked);
              }}
              className="w-4 h-4 accent-amber-500"
              data-testid="checkbox-include-inactive"
            />
            عرض المعطّلة
          </label>
          <button
            onClick={applySearch}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition"
            data-testid="button-product-search"
          >
            بحث
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {productsQuery.isLoading ? (
            <p className="text-slate-400 text-center py-16">جارٍ التحميل...</p>
          ) : productsQuery.isError ? (
            <p className="text-red-500 text-center py-16">تعذّر تحميل المنتجات.</p>
          ) : productsQuery.data && productsQuery.data.items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-right font-bold px-6 py-4">المنتج</th>
                    <th className="text-right font-bold px-6 py-4">الفئة / الماركة</th>
                    <th className="text-center font-bold px-6 py-4">التنويعات</th>
                    <th className="text-right font-bold px-6 py-4">السعر</th>
                    <th className="text-center font-bold px-6 py-4">المخزون</th>
                    <th className="text-left font-bold px-6 py-4">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productsQuery.data.items.map((p) => (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50 ${!p.isActive ? "opacity-60" : ""}`}
                      data-testid={`row-product-${p.id}`}
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-800">{p.name}</p>
                        {p.nameEn && (
                          <p className="text-xs text-slate-400">{p.nameEn}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-700">
                          {p.categoryName ?? "—"}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {p.brandName ?? "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-600 font-bold">
                        {p.variantCount ?? 0}
                      </td>
                      <td className="px-6 py-4 font-black text-slate-800">
                        {money(p.basePrice)}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700">
                        {p.totalStock ?? 0}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setManagingVariants(p)}
                            className="p-2 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition"
                            title="التنويعات"
                            data-testid={`button-variants-${p.id}`}
                          >
                            <Layers size={16} />
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => setEditing(p)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition"
                              title="تعديل"
                              data-testid={`button-edit-product-${p.id}`}
                            >
                              <Pencil size={16} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleting(p)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition"
                              title="حذف"
                              data-testid={`button-delete-product-${p.id}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-16">لا توجد منتجات.</p>
          )}

          {productsQuery.data && productsQuery.data.total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
              <span className="text-sm text-slate-500">
                صفحة {page} من {totalPages} — {productsQuery.data.total} منتج
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  data-testid="button-products-prev"
                >
                  <ChevronRight size={18} />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                  data-testid="button-products-next"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {(creating || editing) && (
        <ProductFormModal
          product={editing}
          categories={categoriesQuery.data ?? []}
          brands={brandsQuery.data ?? []}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            invalidate();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <DeleteProductModal
          product={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            invalidate();
            setDeleting(null);
          }}
        />
      )}

      {managingVariants && (
        <VariantsModal
          product={managingVariants}
          canEdit={canEdit}
          onClose={() => setManagingVariants(null)}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}

function ProductFormModal({
  product,
  categories,
  brands,
  onClose,
  onSaved,
}: {
  product: Product | null;
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(product);
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(product?.name ?? "");
  const [nameEn, setNameEn] = useState(product?.nameEn ?? "");
  const [categoryId, setCategoryId] = useState(
    product?.categoryId ?? categories[0]?.id ?? "",
  );
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [basePrice, setBasePrice] = useState(
    product ? String(product.basePrice) : "0",
  );
  const [baseCostPrice, setBaseCostPrice] = useState(
    product ? String(product.baseCostPrice) : "0",
  );
  const [reorderPoint, setReorderPoint] = useState(
    product ? String(product.reorderPoint) : "0",
  );
  const [isActive, setIsActive] = useState(product?.isActive ?? true);

  const submitting = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("اسم المنتج مطلوب.");
    if (!categoryId) return setError("يجب اختيار فئة.");
    try {
      if (isEdit && product) {
        await updateMutation.mutateAsync({
          id: product.id,
          data: {
            name: name.trim(),
            nameEn: nameEn.trim() || null,
            categoryId,
            brandId: brandId || null,
            description: description.trim() || null,
            basePrice: Number(basePrice) || 0,
            baseCostPrice: Number(baseCostPrice) || 0,
            reorderPoint: Number(reorderPoint) || 0,
            isActive,
          },
        });
      } else {
        await createMutation.mutateAsync({
          data: {
            name: name.trim(),
            nameEn: nameEn.trim() || null,
            categoryId,
            brandId: brandId || null,
            description: description.trim() || null,
            basePrice: Number(basePrice) || 0,
            baseCostPrice: Number(baseCostPrice) || 0,
            reorderPoint: Number(reorderPoint) || 0,
          },
        });
      }
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, "تعذّر حفظ المنتج."));
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "تعديل المنتج" : "منتج جديد"}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            اسم المنتج <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="input-product-name"
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            الاسم بالإنجليزية
          </label>
          <input
            className={inputClass}
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            data-testid="input-product-nameEn"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              الفئة <span className="text-red-500">*</span>
            </label>
            <select
              className={inputClass}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              data-testid="select-product-category"
            >
              <option value="" disabled>
                اختر فئة
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              الماركة
            </label>
            <select
              className={inputClass}
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              data-testid="select-product-brand"
            >
              <option value="">بدون ماركة</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              سعر البيع
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              data-testid="input-product-price"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              سعر التكلفة
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={baseCostPrice}
              onChange={(e) => setBaseCostPrice(e.target.value)}
              data-testid="input-product-cost"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              حد إعادة الطلب
            </label>
            <input
              type="number"
              min={0}
              className={inputClass}
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
              data-testid="input-product-reorder"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            الوصف
          </label>
          <textarea
            className={inputClass}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="input-product-description"
          />
        </div>
        {!isEdit && (
          <p className="text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-3">
            بعد إنشاء المنتج، أضف التنويعات (الألوان والمقاسات) من زر «التنويعات».
          </p>
        )}
        {isEdit && (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-amber-500"
              data-testid="checkbox-product-active"
            />
            منتج نشط
          </label>
        )}
        {error && (
          <div
            className="bg-red-50 text-red-700 text-sm font-medium rounded-xl px-4 py-3 border border-red-100"
            data-testid="text-product-form-error"
          >
            {error}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
          >
            إلغاء
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="flex-1 py-2.5 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 transition shadow-md shadow-amber-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
            data-testid="button-save-product"
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            حفظ
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteProductModal({
  product,
  onClose,
  onDeleted,
}: {
  product: Product;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const mutation = useDeleteProduct();
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    setError(null);
    try {
      await mutation.mutateAsync({ id: product.id });
      onDeleted();
    } catch (err) {
      setError(apiErrorMessage(err, "تعذّر حذف المنتج."));
    }
  }

  return (
    <Modal open onClose={onClose} title="تأكيد الحذف">
      <div className="space-y-4">
        <p className="text-slate-600">
          هل تريد حذف المنتج{" "}
          <span className="font-bold text-slate-800">{product.name}</span>؟ سيتم
          تعطيله مع تنويعاته.
        </p>
        {error && (
          <div className="bg-red-50 text-red-700 text-sm font-medium rounded-xl px-4 py-3 border border-red-100">
            {error}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition"
          >
            إلغاء
          </button>
          <button
            onClick={() => void handle()}
            disabled={mutation.isPending}
            className="flex-1 py-2.5 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition disabled:opacity-60 flex items-center justify-center gap-2"
            data-testid="button-confirm-delete-product"
          >
            {mutation.isPending && <Loader2 size={18} className="animate-spin" />}
            حذف
          </button>
        </div>
      </div>
    </Modal>
  );
}

function VariantsModal({
  product,
  canEdit,
  onClose,
  onChanged,
}: {
  product: Product;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const detailQuery = useGetProduct(product.id);
  const colorsQuery = useListColors({ includeInactive: false });
  const sizesQuery = useListSizes({ includeInactive: false });
  const createVariant = useCreateVariant();
  const deleteVariant = useDeleteVariant();

  const [colorId, setColorId] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidateDetail = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    onChanged();
  };

  async function handleAdd() {
    setError(null);
    if (!colorId) return setError("اختر لوناً.");
    if (!sizeId) return setError("اختر مقاساً.");
    try {
      await createVariant.mutateAsync({
        id: product.id,
        data: {
          colorId,
          sizeId,
          sellingPrice: sellingPrice ? Number(sellingPrice) : null,
        },
      });
      setColorId("");
      setSizeId("");
      setSellingPrice("");
      invalidateDetail();
    } catch (err) {
      setError(apiErrorMessage(err, "تعذّر إضافة التنويع."));
    }
  }

  async function handleDelete(variantId: string) {
    setError(null);
    try {
      await deleteVariant.mutateAsync({ id: variantId });
      invalidateDetail();
    } catch (err) {
      setError(apiErrorMessage(err, "تعذّر حذف التنويع."));
    }
  }

  const variants = detailQuery.data?.variants ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      title={`تنويعات: ${product.name}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {canEdit && (
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
            <label className="block text-sm font-bold text-slate-700">
              إضافة تنويع جديد
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                className={inputClass}
                value={colorId}
                onChange={(e) => setColorId(e.target.value)}
                data-testid="select-variant-color"
              >
                <option value="">اللون</option>
                {(colorsQuery.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={sizeId}
                onChange={(e) => setSizeId(e.target.value)}
                data-testid="select-variant-size"
              >
                <option value="">المقاس</option>
                {(sizesQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="سعر خاص (اختياري)"
                data-testid="input-variant-price"
              />
            </div>
            <button
              onClick={() => void handleAdd()}
              disabled={createVariant.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 transition shadow-md shadow-amber-500/20 text-sm disabled:opacity-60"
              data-testid="button-add-variant"
            >
              {createVariant.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              إضافة
            </button>
          </div>
        )}

        {error && (
          <div
            className="bg-red-50 text-red-700 text-sm font-medium rounded-xl px-4 py-3 border border-red-100"
            data-testid="text-variant-error"
          >
            {error}
          </div>
        )}

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {detailQuery.isLoading ? (
            <p className="text-slate-400 text-center py-8">جارٍ التحميل...</p>
          ) : variants.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="text-right font-bold px-4 py-2.5">اللون / المقاس</th>
                  <th className="text-right font-bold px-4 py-2.5">رمز الصنف</th>
                  <th className="text-right font-bold px-4 py-2.5">الباركود</th>
                  <th className="text-center font-bold px-4 py-2.5">المخزون</th>
                  {canEdit && <th className="px-4 py-2.5 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variants.map((v: ProductVariant) => (
                  <tr key={v.id} data-testid={`row-variant-${v.id}`}>
                    <td className="px-4 py-2.5 font-bold text-slate-800">
                      {[v.colorName, v.sizeName].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">
                      {v.sku}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">
                      {v.barcode}
                    </td>
                    <td className="px-4 py-2.5 text-center font-bold text-slate-700">
                      {v.totalStock ?? 0}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => void handleDelete(v.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                          title="حذف التنويع"
                          data-testid={`button-delete-variant-${v.id}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-400 text-center py-8">
              لا توجد تنويعات بعد.
            </p>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition flex items-center gap-2"
            data-testid="button-close-variants"
          >
            <X size={16} />
            إغلاق
          </button>
        </div>
      </div>
    </Modal>
  );
}
