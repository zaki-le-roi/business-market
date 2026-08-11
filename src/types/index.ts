export type Language = 'ar' | 'fr' | 'en';

export type DeliveryType = 'home' | 'desk';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready_to_ship'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'partially_paid' | 'failed' | 'refunded';
export type PaymentMethod = 'cod' | 'cib' | 'edahabia' | 'ccp' | 'bank_transfer' | 'credit';

export type CustomerSegment = 'new' | 'regular' | 'vip' | 'risky';

export type CouponDiscountType = 'percentage' | 'fixed' | 'free_shipping';

export * from './support';
export * from './cms';

export interface Wilaya {
  id: number;
  code: string;
  name_ar: string;
  name_fr: string;
  region: string;
  home_delivery_price: number;
  desk_delivery_price: number;
  home_delivery_days: number;
  desk_delivery_days: number;
  is_active: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  name_ar: string;
  name_fr: string;
  slug: string;
  description_ar: string | null;
  description_fr: string | null;
  parent_id: string | null;
  image_url: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  name_ar: string;
  name_fr: string;
  slug: string;
  description_ar: string | null;
  description_fr: string | null;
  short_description_ar: string | null;
  short_description_fr: string | null;
  category_id: string | null;
  sku: string;
  price: number;
  compare_price: number | null;
  cost_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  weight: number;
  images: string[];
  attributes: Record<string, string>;
  tags: string[];
  rating: number;
  review_count: number;
  sales_count: number;
  is_active: boolean;
  is_featured: boolean;
  is_flash_sale: boolean;
  flash_sale_ends_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
  moq?: number;
  qty_increment?: number;
  wholesale_price?: number;
  stock?: number;
  image_url?: string;
}

export interface WholesaleActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: string;
  user?: string;
}

export interface Customer {
  id: string;
  phone: string;
  email: string | null;
  full_name: string | null;
  wilaya_id: number | null;
  address: string | null;
  city: string | null;
  is_verified: boolean;
  is_guest: boolean;
  total_orders: number;
  total_spent: number;
  segment: CustomerSegment;
  notes: string | null;
  created_at: string;
  updated_at: string;
  account_type?: 'retail' | 'wholesale';
  wholesale_status?: 'pending' | 'approved' | 'rejected' | null;
  company_name?: string | null;
  register_number?: string | null;
  tax_id?: string | null;
  nis?: string | null;
  vat_number?: string | null;
  status?: 'Active' | 'Suspended' | 'Blocked';
  credit_limit?: number;
  credit_balance?: number;
  customer_group_id?: string | null;
  price_list_id?: string | null;
  payment_terms_id?: string | null;
  is_active?: boolean;
  is_deleted?: boolean;
  deleted_at?: string | null;
  saved_addresses?: SavedAddress[];
  activity_log?: WholesaleActivityLog[];
  admin_notes?: string | null;
  is_wholesale?: boolean;
  orders_count?: number;
}

export interface OrderItem {
  product_id: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_phone: string;
  customer_name: string;
  customer_email: string | null;
  wilaya_id: number;
  delivery_type: DeliveryType;
  address: string | null;
  city: string | null;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  coupon_code: string | null;
  notes: string | null;
  admin_notes?: string | null;
  shipping_company?: string | null;
  commune?: string | null;
  customer_type?: 'retail' | 'wholesale' | 'guest';
  activity_log?: Array<{ id: string; action: string; details: string; timestamp: string; user?: string }>;
  fraud_risk_score: number;
  is_phone_verified: boolean;
  tracking_number: string | null;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  wilaya?: Wilaya;
  shipping_address?: string | null;
  shipping_cost?: number;
}

export interface OrderStatusHistoryEntry {
  id: string;
  order_id: string;
  status: OrderStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  product_id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  is_verified_purchase: boolean;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: CouponDiscountType;
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  used_count: number;
  per_customer_limit: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}



export interface CmsContent {
  id: string;
  type: string;
  key: string;
  title_ar: string | null;
  title_fr: string | null;
  content_ar: string | null;
  content_fr: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  sort_order: number;
}

export type BannerType = 'hero' | 'promo' | 'category' | 'wholesale' | 'retail' | 'announcement';
export type BannerTargetPage = 'homepage' | 'category' | 'retail' | 'wholesale' | 'all';

export interface HomepageBanner {
  id: string;
  title: string | null;
  title_ar: string | null;
  title_fr: string | null;
  title_en?: string | null;
  subtitle: string | null;
  subtitle_ar: string | null;
  subtitle_fr: string | null;
  subtitle_en?: string | null;
  description_ar?: string | null;
  description_fr?: string | null;
  description_en?: string | null;
  banner_type?: BannerType;
  target_page?: BannerTargetPage;
  image_url: string;
  mobile_image_url: string | null;
  button_text: string | null;
  button_text_ar: string | null;
  button_text_fr: string | null;
  button_text_en?: string | null;
  button_link: string | null;
  button_color: string | null;
  text_color: string | null;
  text_alignment: 'left' | 'center' | 'right' | string;
  display_order: number;
  active: boolean;
  desktop_visibility?: boolean;
  mobile_visibility?: boolean;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  description: string | null;
  is_public: boolean;
}

export interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  quantity: number;
  stock_quantity: number;
}

export interface CustomerGroup {
  id: string;
  name_ar: string;
  name_fr: string;
  discount_percentage: number;
  created_at: string;
}

export interface PriceList {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface PriceListEntry {
  id: string;
  price_list_id: string;
  product_id: string;
  wholesale_price: number;
  created_at: string;
}

export interface CustomerPriceOverride {
  id: string;
  customer_id: string;
  product_id: string;
  custom_price: number;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  customer_id: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  total_amount: number;
  payment_terms_id?: string;
  notes?: string;
  created_at: string;
}

export interface PaymentTerms {
  id: string;
  label: string;
  days: number;
  is_active: boolean;
}

export interface WholesaleInvoice {
  id: string;
  invoice_number: string;
  order_id: string;
  customer_id: string;
  total_amount: number;
  due_date: string;
  status: 'unpaid' | 'paid' | 'overdue';
  created_at: string;
}

export interface WholesaleSettings {
  min_order_amount: number;
  credit_limit_default: number;
  auto_approve_po: boolean;
  default_payment_terms_days: number;
  wholesale_terms_notes: string;
  b2b_contact_email?: string;
  b2b_contact_phone?: string;
  require_tax_id?: boolean;
}

export interface ShipmentHistoryItem {
  id: string;
  order_id: string;
  tracking_number?: string;
  trackingNumber?: string;
  carrier: string;
  status: string;
  labelUrl?: string;
  label_url?: string;
  created_at: string;
}

export interface RefundHistoryItem {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

export interface ReturnRequestItem {
  id: string;
  order_id: string;
  reason: string;
  status: string;
  created_at: string;
}

export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

export interface DeliveryHistoryItem {
  id: string;
  order_id: string;
  status: string;
  location: string;
  updated_at: string;
}

export interface LoginHistoryItem {
  date: string;
  ip: string;
  device: string;
}

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  city: string;
  state?: string;
  postal_code?: string;
  is_default?: boolean;
}

export interface ExtendedCustomerFields {
  profile_photo?: string;
  country?: string;
  state?: string;
  postal_code?: string;
  gps_location?: string;
  status?: 'Active' | 'Suspended' | 'Blocked';
  preferred_language?: string;
  preferred_currency?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
  admin_notes?: string;
  internal_tags?: string[];
  loyalty_points?: number;
  coupons_used?: string[];
  refund_history?: RefundHistoryItem[];
  return_requests?: ReturnRequestItem[];
  payment_methods?: SavedPaymentMethod[];
  delivery_history?: DeliveryHistoryItem[];
  login_history?: LoginHistoryItem[];
  wishlist?: string[];
  shopping_cart?: { product_id: string; quantity: number }[];
  saved_addresses?: SavedAddress[];
}

export function parseCustomerExtended(c: Customer): Customer & ExtendedCustomerFields {
  const extended: ExtendedCustomerFields = {};
  if (c.notes && c.notes.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(c.notes);
      Object.assign(extended, parsed);
    } catch {
      extended.admin_notes = c.notes;
    }
  } else {
    extended.admin_notes = c.notes || '';
  }
  
  return {
    ...c,
    profile_photo: extended.profile_photo || '',
    country: extended.country || 'Algeria',
    state: extended.state || '',
    postal_code: extended.postal_code || '',
    gps_location: extended.gps_location || '',
    status: extended.status || 'Active',
    preferred_language: extended.preferred_language || 'fr',
    preferred_currency: extended.preferred_currency || 'DZD',
    email_verified: extended.email_verified ?? (c.email ? true : false),
    phone_verified: extended.phone_verified ?? c.is_verified,
    admin_notes: extended.admin_notes || '',
    internal_tags: extended.internal_tags || [],
    loyalty_points: extended.loyalty_points ?? 0,
    coupons_used: extended.coupons_used || [],
    refund_history: extended.refund_history || [],
    return_requests: extended.return_requests || [],
    payment_methods: extended.payment_methods || [],
    delivery_history: extended.delivery_history || [],
    login_history: extended.login_history || [
      { date: new Date(Date.now() - 3600000).toISOString(), ip: '197.200.41.22', device: 'Android Device' },
      { date: c.created_at, ip: '197.200.41.22', device: 'Android Device' }
    ],
    wishlist: extended.wishlist || [],
    shopping_cart: extended.shopping_cart || [],
    saved_addresses: extended.saved_addresses || []
  };
}

