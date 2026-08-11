/**
 * Hash a password using the browser's native subtle crypto (SHA-256)
 */
export async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export interface CustomerProfileCheck {
  phone?: string | null;
  wilaya_id?: number | string | null;
  city?: string | null;
  address?: string | null;
}

/**
 * Helper to check if a customer has completed their essential profile details.
 */
export function isProfileComplete(customer: CustomerProfileCheck | null | undefined): boolean {
  if (!customer) return false;
  return !!(
    customer.phone &&
    !customer.phone.startsWith('pending-') &&
    customer.wilaya_id &&
    customer.city &&
    customer.address
  );
}
