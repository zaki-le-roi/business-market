export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function isValidAlgerianPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(0)(5|6|7)[0-9]{8}$/.test(cleaned) || /^(213)(5|6|7)[0-9]{8}$/.test(cleaned);
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s-]/g, '');
  if (cleaned.startsWith('+213')) cleaned = '0' + cleaned.slice(4);
  else if (cleaned.startsWith('213')) cleaned = '0' + cleaned.slice(3);
  return cleaned;
}

export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.length === 10) {
    return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 10)}`;
  }
  return normalized;
}
