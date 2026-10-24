// Normalises a mobile number to E.164 (+27821234567) so WhatsApp links and any
// later messaging provider can use it as-is. South African local formats are
// the default; anyone visiting from abroad can type their number with +country.
export function toE164(input: string): string | null {
  const raw = input.trim();
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (raw.startsWith("+")) {
    // already international
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2); // 0027… → 27…
  } else if (digits.startsWith("0") && digits.length === 10) {
    digits = "27" + digits.slice(1); // 082 123 4567 → 2782…
  } else if (digits.startsWith("27") && digits.length === 11) {
    // 27821234567 without the plus
  } else {
    return null;
  }

  const e164 = "+" + digits;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  // SA mobiles are +27 then 9 digits starting 6, 7 or 8.
  if (e164.startsWith("+27") && !/^\+27[678]\d{8}$/.test(e164)) return null;
  return e164;
}
