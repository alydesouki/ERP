/**
 * barcode-input.ts
 *
 * Utility for normalizing barcode scanner input regardless of the active
 * keyboard language. When a physical Arabic keyboard layout is active the OS
 * maps each key press to an Arabic character (e.g. pressing the 'q' key
 * produces 'ض'). Barcode scanners act as keyboards, so their output gets
 * mis-translated when Arabic is the active layout.
 *
 * Solution: map every Arabic character that appears at an English key position
 * back to the English character it represents. This is safe to apply to any
 * text field used for barcode scanning because barcodes only ever contain
 * ASCII digits and upper/lower-case letters.
 */

/**
 * Arabic-to-English character map.
 * Key   = Arabic character produced when typing on an Arabic keyboard layout.
 * Value = English character at the same physical key position.
 */
const ARABIC_TO_ENGLISH: Record<string, string> = {
  // ── Arabic-Indic digits → Western Arabic digits ──────────────────────────
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",

  // ── Top row (Q → P) ──────────────────────────────────────────────────────
  "ض": "q",
  "ص": "w",
  "ث": "e",
  "ق": "r",
  "ف": "t",
  "غ": "y",
  "ع": "u",
  "ه": "i",
  "خ": "o",
  "ح": "p",
  "ج": "[",
  "د": "]",

  // ── Home row (A → L) ─────────────────────────────────────────────────────
  "ش": "a",
  "س": "s",
  "ي": "d",
  "ب": "f",
  "ل": "g",
  "ا": "h",
  "ت": "j",
  "ن": "k",
  "م": "l",

  // ── Bottom row (Z → M) ───────────────────────────────────────────────────
  "ئ": "z",
  "ء": "x",
  "ؤ": "c",
  "ر": "v",
  // "لا" → "b" (lam-alef ligature; some layouts produce this)
  "ى": "n",
  "ة": "m",

  // ── Punctuation that may appear in some barcode formats ──────────────────
  "و": ",",
  "ز": ".",
  "ظ": "/",
};

/**
 * Converts any Arabic keyboard characters in `value` to their English
 * equivalents. Non-Arabic characters pass through unchanged.
 *
 * Usage (React controlled input):
 *
 *   onChange={(e) => setValue(normalizeBarcodeInput(e.target.value))}
 */
export function normalizeBarcodeInput(value: string): string {
  if (!value) return value;
  let changed = false;
  const result = value
    .split("")
    .map((ch) => {
      const mapped = ARABIC_TO_ENGLISH[ch];
      if (mapped !== undefined) {
        changed = true;
        return mapped;
      }
      return ch;
    })
    .join("");
  return changed ? result : value; // return original reference if nothing changed
}
