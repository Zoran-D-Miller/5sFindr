// Normalises a mobile number to E.164 (+27821234567) so WhatsApp links and any
// later messaging provider can use it as-is. South Africa is the default: the
// form shows a fixed +27 and people type their number the way they know it
// (082 123 4567). A number typed with + or 00 and another country code is kept.
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
  } else if (digits.length === 9) {
    digits = "27" + digits; // 82 123 4567, typed after the +27 prefix
  } else if (digits.startsWith("27") && digits.length === 11) {
    // 27821234567 without the plus
  } else {
    return null;
  }

  // +27 082… → +2782… (local trunk 0 kept after the country code)
  if (digits.startsWith("270") && digits.length === 12) digits = "27" + digits.slice(3);

  const e164 = "+" + digits;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) return null;
  // SA mobiles are +27 then 9 digits starting 6, 7 or 8.
  if (e164.startsWith("+27") && !/^\+27[678]\d{8}$/.test(e164)) return null;
  return e164;
}
