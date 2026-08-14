export type ShippingAuthType = 'bearer' | 'apikey' | 'none';
export type ShippingPricingMode = 'automatic' | 'per_wilaya';
export type ShippingServiceType = 'home' | 'desk' | 'express';

export interface ShippingProvider {
  id: string;
  code: string;
  name_ar: string;
  name_fr: string;
  is_active: boolean;
  is_default: boolean;
  supports_home_delivery: boolean;
  supports_stop_desk: boolean;
  supports_cod: boolean;
  supports_tracking: boolean;
  supports_automated_manifest: boolean;
  api_endpoint?: string;
  tracking_url_template?: string;
  notes?: string;
  api_key_configured?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ShippingRate {
  id: string;
  provider_id: string;
  wilaya_id: number;
  home_fee: number;
  desk_fee: number;
  return_fee: number;
  stop_desk_fee?: number;
  estimated_delivery_days_min?: number;
  estimated_delivery_days_max?: number;
  estimated_days_min?: number;
  estimated_days_max?: number;
  is_active: boolean;
  free_shipping_threshold?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ShippingSettings {
  id: number;
  default_provider_id?: string;
  free_shipping_min_amount: number;
  free_shipping_threshold?: number;
  enable_free_shipping?: boolean;
  enable_home_delivery: boolean;
  enable_stop_desk: boolean;
  default_origin_wilaya_id: number;
  default_origin_address?: string;
  updated_at?: string;
}

export interface ShippingManifest {
  id: string;
  manifest_number: string;
  provider_id: string;
  provider_name?: string;
  status: 'draft' | 'generated' | 'submitted' | 'picked_up' | 'closed' | 'cancelled';
  order_count: number;
  total_cod_amount: number;
  driver_name?: string;
  driver_phone?: string;
  vehicle_plate?: string;
  created_by?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type ShipmentStatus =
  | 'pending'
  | 'prepared'
  | 'manifested'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'cancelled';

export type ShipmentCodStatus =
  | 'pending'
  | 'collected_by_courier'
  | 'transferred'
  | 'settled'
  | 'failed'
  | 'refunded';

export interface Shipment {
  id: string;
  order_id: string;
  order_number?: string;
  manifest_id?: string;
  provider_id: string;
  provider_name?: string;
  tracking_number?: string;
  carrier_ref_id?: string;
  delivery_type: 'home' | 'stop_desk';
  stop_desk_id?: string;
  stop_desk_name?: string;
  shipping_fee: number;
  cod_amount: number;
  cod_collected_amount: number;
  status: ShipmentStatus;
  carrier_status_raw?: string;
  cod_status: ShipmentCodStatus;
  recipient_name?: string;
  recipient_phone?: string;
  recipient_wilaya_id?: number;
  recipient_commune?: string;
  recipient_address?: string;
  weight_kg: number;
  packages_count: number;
  label_url?: string;
  stock_restored?: boolean;
  shipped_at?: string;
  delivered_at?: string;
  returned_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ShipmentTrackingEvent {
  id: string;
  shipment_id: string;
  status: string;
  location?: string;
  description?: string;
  actor?: string;
  event_timestamp: string;
  created_at?: string;
}

export interface TreasuryAccount {
  id: string;
  code: string;
  name_ar: string;
  name_fr: string;
  account_type: 'cash_drawer' | 'bank' | 'postal_ccp' | 'carrier_settlement';
  balance: number;
  currency: string;
  is_active: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CodSettlement {
  id: string;
  settlement_number: string;
  provider_id: string;
  provider_name?: string;
  treasury_account_id?: string;
  treasury_account_name?: string;
  status: 'draft' | 'reconciled' | 'deposited' | 'disputed' | 'cancelled';
  total_orders_count: number;
  gross_cod_collected: number;
  total_shipping_fees_deducted: number;
  net_payout_amount: number;
  reference_number?: string;
  finance_payment_id?: string;
  settled_at?: string;
  reconciled_by?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CodSettlementItem {
  id: string;
  settlement_id: string;
  shipment_id: string;
  order_id?: string;
  order_number?: string;
  expected_cod: number;
  collected_cod: number;
  shipping_fee: number;
  net_amount: number;
  status: 'matched' | 'discrepancy' | 'rejected';
  notes?: string;
  created_at?: string;
}

export interface ShippingQuoteRequest {
  providerId?: string;
  wilayaId: number;
  deliveryType: 'home' | 'stop_desk';
  subtotal: number;
}

export interface ShippingQuoteResponse {
  shippingFee: number;
  isFreeShipping: boolean;
  deliveryType: 'home' | 'stop_desk';
  providerId: string;
}

export interface ShippingQuote {
  providerId: string;
  providerName: string;
  price: number;
  isFreeShipping: boolean;
  deliveryDays: number;
  success: boolean;
}
