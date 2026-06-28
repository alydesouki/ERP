// SKU and barcode generation for product variants. Both must be unique per
// store; callers supply a uniqueness checker and these helpers retry until a
// free candidate is found.

function randomDigits(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

function randomAlnum(n: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// EAN-13 check digit for a 12-digit numeric string.
function ean13CheckDigit(d12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = d12.charCodeAt(i) - 48;
    sum += i % 2 === 0 ? n : n * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

// Short ASCII token derived from a (possibly Arabic) label. Falls back to a
// random token when the label has no usable ASCII alphanumerics.
function token(label: string | null | undefined, len: number): string {
  const ascii = (label ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (ascii.length >= len) return ascii.slice(0, len);
  return (ascii + randomAlnum(len)).slice(0, len);
}

export function generateSkuCandidate(parts: {
  category?: string | null;
  size?: string | null;
  color?: string | null;
}): string {
  return [
    token(parts.category, 3),
    token(parts.size, 3),
    token(parts.color, 2),
    randomAlnum(4),
  ].join("-");
}

// In-store EAN-13 barcode (prefix "200" marks internal use).
export function generateBarcodeCandidate(): string {
  const base = "200" + randomDigits(9);
  return base + ean13CheckDigit(base);
}

// Retry a generator until `isFree` accepts the candidate (or attempts run out).
export async function generateUnique(
  generate: () => string,
  isFree: (candidate: string) => Promise<boolean>,
  attempts = 12,
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const candidate = generate();
    if (await isFree(candidate)) return candidate;
  }
  throw new Error("تعذّر توليد رمز فريد");
}
