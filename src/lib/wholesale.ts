import { Product, Customer, PriceListEntry, CustomerPriceOverride, CustomerGroup } from '../types';
import { supabase } from './supabase';

/**
 * Checks if a customer is an approved wholesale client.
 */
export function isWholesaleCustomer(customer: Customer | null): boolean {
  if (!customer) return false;
  return customer.account_type === 'wholesale' && customer.wholesale_status === 'approved';
}

/**
 * Calculates the active price for a product based on the customer type, groups, and specific overrides.
 */
export function getActiveProductPrice(
  product: Product,
  customer: Customer | null,
  overrides: CustomerPriceOverride[] = [],
  priceListEntries: PriceListEntry[] = [],
  customerGroups: CustomerGroup[] = []
): number {
  if (!customer || !isWholesaleCustomer(customer)) {
    return product.price; // Retail price
  }

  // 1. Check direct customer-product price override
  const directOverride = overrides.find(
    (o) => o.customer_id === customer.id && o.product_id === product.id
  );
  if (directOverride) {
    return directOverride.custom_price;
  }

  // 2. Check price list entries
  const priceListEntry = priceListEntries.find(
    (entry) => entry.product_id === product.id
  );
  if (priceListEntry) {
    return priceListEntry.wholesale_price;
  }

  // 3. Fallback to base wholesale price if set
  if (product.wholesale_price && product.wholesale_price > 0) {
    let baseWholesale = product.wholesale_price;
    // Apply customer group discount if assigned
    if (customer.customer_group_id) {
      const group = customerGroups.find((g) => g.id === customer.customer_group_id);
      if (group && group.discount_percentage > 0) {
        baseWholesale = baseWholesale * (1 - group.discount_percentage / 100);
      }
    }
    return baseWholesale;
  }

  // 4. Fallback to standard price with customer group discount
  if (customer.customer_group_id) {
    const group = customerGroups.find((g) => g.id === customer.customer_group_id);
    if (group && group.discount_percentage > 0) {
      return product.price * (1 - group.discount_percentage / 100);
    }
  }

  return product.price;
}

/**
 * Fetches data and returns the correct wholesale price for a product.
 */
export async function getProductPrice(
  product: Product,
  quantity: number,
  customer: Customer | null
): Promise<{ unitPrice: number; total: number }> {
  if (!customer || !isWholesaleCustomer(customer)) {
    const p = product.price;
    return { unitPrice: p, total: p * quantity };
  }

  try {
    const [overrideRes, entryRes, groupRes] = await Promise.all([
      supabase.from('customer_price_overrides').select('*'),
      supabase.from('price_list_entries').select('*'),
      supabase.from('customer_groups').select('*')
    ]);

    const overrides = (overrideRes.data || []) as CustomerPriceOverride[];
    const entries = (entryRes.data || []) as PriceListEntry[];
    const groups = (groupRes.data || []) as CustomerGroup[];

    const unitPrice = getActiveProductPrice(product, customer, overrides, entries, groups);
    return { unitPrice, total: unitPrice * quantity };
  } catch {
    // Fallback if DB fetch fails
    const unitPrice = product.wholesale_price || product.price;
    return { unitPrice, total: unitPrice * quantity };
  }
}

/**
 * Generates pricing tiers for a product B2B layout.
 */
export async function getProductPriceTiers(
  product: Product,
  _customer: Customer | null
): Promise<{ minQuantity: number; price: number }[]> {
  if (_customer) {
    // Future expansion: VIP specific tier discounts
  }
  const baseWholesale = product.wholesale_price || (product.price * 0.9);
  const moq = product.moq || 5;

  return [
    { minQuantity: moq, price: baseWholesale },
    { minQuantity: moq * 2, price: baseWholesale * 0.95 },
    { minQuantity: moq * 5, price: baseWholesale * 0.90 }
  ];
}

/**
 * Validates a quantity against MOQ and Increment rules.
 * Returns { valid: boolean; message: string }
 */
export function validateWholesaleQuantity(
  product: Product,
  quantity: number,
  isArabic = false
): { valid: boolean; message: string } {
  const moq = product.moq ?? 1;
  const increment = product.qty_increment ?? 1;

  if (quantity < moq) {
    return {
      valid: false,
      message: isArabic
        ? `الحد الأدنى للطلب (MOQ) هو ${moq}`
        : `La quantité minimale de commande (MOQ) est de ${moq}`
    };
  }

  if (increment > 1 && (quantity - moq) % increment !== 0) {
    return {
      valid: false,
      message: isArabic
        ? `الكمية يجب أن تكون بمضاعفات ${increment} بعد الحد الأدنى (${moq})`
        : `La quantité doit être un multiple de ${increment} après le MOQ (${moq})`
    };
  }

  return { valid: true, message: '' };
}
