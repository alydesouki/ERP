import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Printer, X, Minus, Plus, Settings2, AlignJustify } from "lucide-react";
import { Modal } from "@/components/modal";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { PrintPortal } from "./print-portal";
import { printBarcode, labelPageSize } from "@/lib/printer-settings";

// ── Types ─────────────────────────────────────────────────────────────────────

type LabelSize =
  | "47x25"
  | "20x10"
  | "30x20"
  | "40x25"
  | "40x30"
  | "50x30"
  | "57x32"
  | "58x40"
  | "60x40"
  | "100x50";

const DEFAULT_LABEL_W_MM = 47;
const DEFAULT_LABEL_H_MM = 25;
const DEFAULT_LABEL_SIZE: LabelSize = "47x25";
const MAX_COPIES = 100;

/**
 * Standard thermal label sizes used widely in retail / POS environments.
 * Format: "WIDTHxHEIGHT" in mm (landscape orientation on the roll).
 */
const LABEL_SIZES: { value: LabelSize; label: string; note?: string }[] = [
  { value: "47x25", label: "47×25 مم",  note: "افتراضي" },
  { value: "20x10", label: "20×10 مم",  note: "مجوهرات" },
  { value: "30x20", label: "30×20 مم",  note: "أقراص / بطاقات صغيرة" },
  { value: "40x25", label: "40×25 مم",  note: "أحذية / ملابس" },
  { value: "40x30", label: "40×30 مم",  note: "بطاقة قياسية" },
  { value: "50x30", label: "50×30 مم",  note: "إلكترونيات" },
  { value: "57x32", label: "57×32 مم",  note: "POS حراري" },
  { value: "58x40", label: "58×40 مم",  note: "حراري عريض" },
  { value: "60x40", label: "60×40 مم",  note: "صيدلية / أغذية" },
  { value: "100x50", label: "100×50 مم", note: "علبة / شحن" },
];

export interface BarcodeLabelVariant {
  id: string;
  sku: string;
  barcode: string;
  colorName?: string | null;
  sizeName?: string | null;
  sellingPrice?: string | null;
}

export interface BarcodeLabelProps {
  open: boolean;
  onClose: () => void;
  storeName?: string | null;
  productName: string;
  variants: BarcodeLabelVariant[];
  currency?: string;
}

// ── Resolved label dimensions ─────────────────────────────────────────────────

interface LabelDims {
  /** Width in mm (the short edge of the label) */
  wMm: number;
  /** Height in mm (the tall edge of the label) */
  hMm: number;
}

function resolveDims(
  mode: "preset" | "custom",
  preset: LabelSize,
  customW: string,
  customH: string,
): LabelDims {
  if (mode === "custom") {
    const w = Math.max(10, Math.min(300, Number(customW) || DEFAULT_LABEL_W_MM));
    const h = Math.max(10, Math.min(300, Number(customH) || DEFAULT_LABEL_H_MM));
    return { wMm: w, hMm: h };
  }
  const [rawW, rawH] = preset.split("x").map(Number);
  return { wMm: rawW, hMm: rawH };
}

// ── px conversion for screen preview (96dpi → 3.779528px per mm) ──────────────

const MM_TO_PX = 3.779528;

// ── Single SVG Barcode ────────────────────────────────────────────────────────

function BarcodeDisplay({
  value,
  heightMm = 10,
}: {
  value: string;
  widthPx?: number;
  heightMm?: number;
  forPrint?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      const barcodeValue = value || "000000";
      const isEAN13 = /^\d{13}$/.test(barcodeValue);
      JsBarcode(ref.current, barcodeValue, {
        format: isEAN13 ? "EAN13" : "CODE128",
        width: 1.5,
        /*
         * height sets the bar height inside the viewBox.
         * After JsBarcode runs we remove the fixed width/height attributes
         * and set preserveAspectRatio="none" so that CSS width:100%/height:100%
         * stretches the barcode to fill whatever container it is placed in.
         */
        height: Math.round(heightMm * MM_TO_PX),
        displayValue: false,
        margin: 10,
        background: "transparent",
      });
      // Remove fixed pixel dimensions so CSS controls sizing via the viewBox
      ref.current.removeAttribute("width");
      ref.current.removeAttribute("height");
      // Allow the SVG to stretch non-uniformly to fill the container exactly
      ref.current.setAttribute("preserveAspectRatio", "none");
    } catch {
      // invalid barcode — silent fail
    }
  }, [value, heightMm]);
  // width:100% fills parent; height:100% fills the fixed-height container
  return <svg ref={ref} style={{ display: "block", width: "100%", height: "100%" }} />;
}

// ── Screen Preview Label ──────────────────────────────────────────────────────

/**
 * Renders a scaled screen preview of the label at 2× its physical mm size.
 * Only shows: Product Name | Barcode SVG | Barcode Number | Price.
 * Variations (size/color) are intentionally excluded.
 */
function LabelPreview({
  productName,
  storeName,
  variant,
  dims,
  currency,
}: {
  productName: string;
  storeName?: string | null;
  variant: BarcodeLabelVariant;
  dims: LabelDims;
  currency: string;
}) {
  // Display at 2× mm for a comfortable preview on screen
  const previewScale = 2;
  const previewW = dims.wMm * previewScale;
  const previewH = dims.hMm * previewScale;
  const price = variant.sellingPrice
    ? `${Number(variant.sellingPrice).toFixed(2)} ${currency}`
    : null;

  const isSmall = dims.wMm <= 30;
  // Product name font scales with label width: 0.18pt per mm, clamped [6pt, 16pt]
  const nameFontSize = `${Math.max(6, Math.min(16, Math.round(dims.wMm * 0.18)))}pt`;

  // Barcode area: 40% of label height, min 4mm, max 18mm
  const barcodeAreaMm = Math.max(4, Math.min(dims.hMm * 0.40, 18));
  // Scale to screen preview pixels (2× mm)
  const barcodeAreaPx = barcodeAreaMm * previewScale;

  return (
    <div
      style={{
        width: previewW,
        height: previewH,
        border: "1px solid #e2e8f0",
        borderRadius: 4,
        padding: isSmall ? "3px 4px" : "6px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        background: "white",
        boxSizing: "border-box",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
        flexShrink: 0,
      }}
    >
      {storeName && (
        <div
          style={{
            fontSize: isSmall ? 6 : 8,
            textAlign: "center",
            lineHeight: 1.1,
            width: "100%",
            overflow: "hidden",
            opacity: 0.65,
          }}
        >
          {storeName}
        </div>
      )}
      <div
        style={{
          fontSize: nameFontSize,
          fontWeight: "bold",
          textAlign: "center",
          lineHeight: 1.2,
          width: "100%",
          overflow: "hidden",
          maxHeight: "2.4em",
        }}
      >
        {productName}
      </div>

      {/*
       * Fixed-height barcode container (40% of label height).
       * BarcodeDisplay fills it with width:100% height:100%.
       * flexShrink:0 prevents it from shrinking with space-between.
       */}
      <div style={{ width: "100%", height: barcodeAreaPx, flexShrink: 0 }}>
        <BarcodeDisplay value={variant.barcode} heightMm={barcodeAreaMm} />
      </div>

      <div style={{ fontSize: isSmall ? 6 : 7, fontFamily: "monospace", textAlign: "center", letterSpacing: 0.5 }}>
        {variant.barcode}
      </div>

      {price && (
        <div style={{ fontSize: isSmall ? 8 : 10, fontWeight: "bold", textAlign: "center" }}>
          {price}
        </div>
      )}
    </div>
  );
}

// ── Printable Label (injected into DOM for print portal) ──────────────────────

/**
 * Renders a single label at exact physical mm dimensions.
 * Only contains: Product Name | Barcode SVG | Barcode Number | Price.
 */
function PrintableLabel({
  productName,
  storeName,
  variant,
  dims,
  currency,
}: {
  productName: string;
  storeName?: string | null;
  variant: BarcodeLabelVariant;
  dims: LabelDims;
  currency: string;
}) {
  const price = variant.sellingPrice
    ? `${Number(variant.sellingPrice).toFixed(2)} ${currency}`
    : null;
  const isSmall = dims.wMm <= 30;
  const isTiny  = dims.wMm <= 20;

  // Product name font scales with label width: 0.18pt per mm, clamped to [6pt, 16pt].
  const nameFontSize = `${Math.max(6, Math.min(16, Math.round(dims.wMm * 0.18)))}pt`;

  // Barcode container height: 40% of label height, min 4mm, max 18mm.
  // Using a FIXED height (not flex-grow) ensures:
  //   1. space-between distributes gaps correctly around text items.
  //   2. The barcode always occupies a predictable portion of the label.
  const barcodeAreaMm = Math.max(4, Math.min(dims.hMm * 0.40, 18));

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      const barcodeValue = variant.barcode || "000000";
      const isEAN13 = /^\d{13}$/.test(barcodeValue);
      JsBarcode(svgRef.current, barcodeValue, {
        format: isEAN13 ? "EAN13" : "CODE128",
        width: dims.wMm <= 20 ? 0.8 : dims.wMm <= 30 ? 1.0 : 1.5,
        // Bar height fills the container; the viewBox will be scaled to fit.
        height: Math.round(barcodeAreaMm * MM_TO_PX),
        displayValue: false,
        // margin:10 preserves ISO-compliant quiet zones that scale with the barcode.
        margin: 10,
        background: "transparent",
      });
      // KEY FIX: Remove JsBarcode's fixed pixel width/height attributes.
      // With these removed, CSS width:100%;height:100% takes full control.
      svgRef.current.removeAttribute("width");
      svgRef.current.removeAttribute("height");
      // preserveAspectRatio="none" lets the SVG stretch to fill the container
      // in both dimensions. Bar width RATIOS are preserved (uniform scale),
      // so CODE128/EAN13 barcodes remain scannable.
      svgRef.current.setAttribute("preserveAspectRatio", "none");
    } catch {
      // ignore invalid barcode
    }
  }, [variant.barcode, dims.wMm, dims.hMm, barcodeAreaMm]);

  return (
    <div
      className="barcode-label"
      style={{
        width: `${dims.wMm}mm`,
        height: `${dims.hMm}mm`,
        padding: isTiny ? "0.8mm 1mm" : isSmall ? "1mm 1.5mm" : "1.5mm 2mm",
      }}
    >
      {storeName && (
        <div
          className="label-store-name"
          style={{ fontSize: isTiny ? "4pt" : isSmall ? "5pt" : "6pt" }}
        >
          {storeName}
        </div>
      )}

      <div
        className="label-product-name"
        style={{ fontSize: nameFontSize }}
      >
        {productName}
      </div>

      {/*
       * Fixed-height barcode container — a plain flexShrink:0 flex child.
       * This is the critical difference from the broken flex:1 1 auto approach:
       * space-between now correctly distributes gaps around the text items.
       * The SVG fills this container exactly via width:100%;height:100%.
       */}
      <div
        className="label-barcode-area"
        style={{ height: `${barcodeAreaMm}mm` }}
      >
        <svg
          ref={svgRef}
          className="label-barcode-svg"
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      </div>

      <div className="label-sku" style={{ fontSize: isTiny ? "5pt" : isSmall ? "6pt" : "6.5pt" }}>
        {variant.barcode}
      </div>

      {price && (
        <div className="label-price" style={{ fontSize: isTiny ? "6pt" : isSmall ? "7pt" : "9pt" }}>
          {price}
        </div>
      )}
    </div>
  );
}

function clampCopies(value: number): number {
  return Math.max(1, Math.min(MAX_COPIES, Math.floor(value) || 1));
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export function BarcodeLabelPrintModal({
  open,
  onClose,
  storeName,
  productName,
  variants,
  currency = "ج.م",
}: BarcodeLabelProps) {
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? "");
  const [copies, setCopies] = useState(1);
  const [sizeMode, setSizeMode] = useState<"preset" | "custom">("preset");
  const [labelSize, setLabelSize] = useState<LabelSize>(DEFAULT_LABEL_SIZE);
  const [customW, setCustomW] = useState(String(DEFAULT_LABEL_W_MM));
  const [customH, setCustomH] = useState(String(DEFAULT_LABEL_H_MM));

  useEffect(() => {
    if (!open) return;
    setSelectedVariantId(variants[0]?.id ?? "");
    setCopies(1);
    setSizeMode("preset");
    setLabelSize(DEFAULT_LABEL_SIZE);
    setCustomW(String(DEFAULT_LABEL_W_MM));
    setCustomH(String(DEFAULT_LABEL_H_MM));
  }, [open, variants]);

  const selectedVariant =
    variants.find((v) => v.id === selectedVariantId) ?? variants[0];

  const dims = resolveDims(sizeMode, labelSize, customW, customH);

  function handlePrint() {
    // Quantity is encoded in the print portal (N label elements). Do not pass
    // `copies` to Electron — that would duplicate the whole document N times (N²).
    void printBarcode({
      pageSize: labelPageSize(dims.wMm, dims.hMm),
    });
  }

  if (!selectedVariant) return null;

  /*
   * The @page rule:
   * - size: {W}mm {H}mm → exact label paper size; Chrome/Edge respects this
   *   and shows a preview that matches the label dimensions 1:1.
   * - margin: 0 → no browser-added whitespace around the label.
   *
   * We also inject body > * hiding so the app shell disappears during print,
   * same pattern as ThermalReceipt.
   */
  const pageStyle = `
    size: ${dims.wMm}mm ${dims.hMm}mm;
    margin: 0;
  `;

  const bodyHideStyle = `
    @media print {
      body > *:not(#print-portal) { display: none !important; }
      #print-portal { display: block !important; position: static !important; width: ${dims.wMm}mm !important; }
      html, body { width: ${dims.wMm}mm !important; margin: 0 !important; padding: 0 !important; }
    }
  `;

  return (
    <Modal open={open} onClose={onClose} title="طباعة بطاقة باركود" maxWidth="max-w-lg">
      <div className="space-y-4" dir="rtl">

        {/* Variant picker — shown only when multiple variants */}
        {variants.length > 1 && (
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">اختر التنويع</label>
            <select
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {[v.sizeName && `مقاس ${v.sizeName}`, v.colorName]
                    .filter(Boolean)
                    .join(" • ") || v.sku}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Size mode toggle */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">حجم البطاقة</label>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setSizeMode("preset")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${
                sizeMode === "preset"
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <AlignJustify size={15} /> قياسي
            </button>
            <button
              onClick={() => setSizeMode("custom")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${
                sizeMode === "custom"
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <Settings2 size={15} /> مخصص
            </button>
          </div>

          {sizeMode === "preset" ? (
            <div className="grid grid-cols-3 gap-2">
              {LABEL_SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setLabelSize(s.value)}
                  className={`p-2 rounded-xl border-2 text-right transition ${
                    labelSize === s.value
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="text-[11px] font-black">{s.label}</div>
                  {s.note && (
                    <div className="text-[9px] text-slate-400 mt-0.5">{s.note}</div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs font-bold text-slate-600 mb-1">العرض (مم)</Label>
                <Input
                  type="number"
                  min={10}
                  max={300}
                  value={customW}
                  onChange={(e) => setCustomW(e.target.value)}
                  className="text-center font-bold"
                  placeholder={String(DEFAULT_LABEL_W_MM)}
                />
              </div>
              <div className="text-slate-400 font-bold pb-3">×</div>
              <div className="flex-1">
                <Label className="text-xs font-bold text-slate-600 mb-1">الارتفاع (مم)</Label>
                <Input
                  type="number"
                  min={10}
                  max={300}
                  value={customH}
                  onChange={(e) => setCustomH(e.target.value)}
                  className="text-center font-bold"
                  placeholder={String(DEFAULT_LABEL_H_MM)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Copies */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">عدد النسخ</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCopies((c) => clampCopies(c - 1))}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              <Minus size={16} />
            </button>
            <Input
              type="number"
              min={1}
              max={MAX_COPIES}
              value={copies}
              onChange={(e) => setCopies(clampCopies(Number(e.target.value)))}
              className="w-20 text-center font-black text-xl text-slate-800"
            />
            <button
              onClick={() => setCopies((c) => clampCopies(c + 1))}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">
            معاينة — {dims.wMm}×{dims.hMm} مم
          </label>
          <div className="flex justify-center items-center bg-slate-50 rounded-xl p-4 border border-slate-200 min-h-[80px]">
            <LabelPreview
              productName={productName}
              storeName={storeName}
              variant={selectedVariant}
              dims={dims}
              currency={currency}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center gap-2"
          >
            <X size={16} /> إلغاء
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 transition flex items-center justify-center gap-2 shadow-md shadow-amber-500/20"
          >
            <Printer size={16} /> طباعة {copies} نسخة
          </button>
        </div>
      </div>

      {/*
       * Hidden print portal — renders the actual labels that will be printed.
       *
       * Each label gets its own page (break-after: page) so copies print
       * cleanly. The style tag inside PrintPortal injects the @page rule
       * with exact label dimensions.
       *
       * We also inject the body-hiding rule here (via a separate <style>)
       * so the app shell is hidden during print, identical to how
       * ThermalReceipt handles it.
       */}
      <PrintPortal pageStyle={pageStyle}>
        <style dangerouslySetInnerHTML={{ __html: bodyHideStyle }} />
        <div className="barcode-label-print-root">
          <div className="barcode-label-page">
            {Array.from({ length: copies }).map((_, i) => (
              <PrintableLabel
                key={i}
                productName={productName}
                storeName={storeName}
                variant={selectedVariant}
                dims={dims}
                currency={currency}
              />
            ))}
          </div>
        </div>
      </PrintPortal>
    </Modal>
  );
}
