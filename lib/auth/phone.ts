/**
 * Normalise a phone number to E.164. Kenyan numbers may be typed as 07xx / 01xx, 2547xx or +2547xx.
 * Other countries must be entered with a leading +. Returns null when the input is not a plausible number.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim().replace(/[\s().-]/g, "");
  if (/^0[17]\d{8}$/.test(raw)) return `+254${raw.slice(1)}`;
  if (/^254[17]\d{8}$/.test(raw)) return `+${raw}`;
  if (/^\+[1-9]\d{7,14}$/.test(raw)) return raw;
  return null;
}

/** Mask for logs and UI: +254712***678 */
export function maskPhone(phone: string): string {
  return phone.length <= 7 ? "***" : `${phone.slice(0, 7)}***${phone.slice(-3)}`;
}
