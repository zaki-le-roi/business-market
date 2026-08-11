export interface Warehouse {
  id: string;
  code: string;
  name_ar: string;
  name_fr: string;
  address?: string;
  city?: string;
  wilaya_id?: number;
  manager_name?: string;
  phone?: string;
  is_main: boolean;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  sku?: string;
  name_ar: string;
  name_fr: string;
  options: Record<string, string>;
  price_override?: number;
  stock_quantity: number;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryLevel {
  id: string;
  product_id: string;
  variant_id?: string;
  warehouse_id: string;
  quantity: number;
  damaged_quantity: number;
  quantity_on_hand?: number;
  quantity_reserved?: number;
  rack_location?: string;
  created_at?: string;
  updated_at?: string;
}

export type MovementType = 
  | 'initial_seed' 
  | 'manual_adjustment' 
  | 'order_deduction' 
  | 'order_cancellation' 
  | 'order_refund' 
  | 'supplier_receipt' 
  | 'warehouse_transfer' 
  | 'damaged_loss' 
  | 'csv_bulk_update'
  | 'return_restock'
  | 'customer_return'
  | 'transfer_out'
  | 'transfer_in';

export interface InventoryMovement {
  id: string;
  product_id: string;
  variant_id?: string;
  warehouse_id?: string;
  target_warehouse_id?: string;
  movement_type: MovementType;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reference_number?: string;
  created_by?: string;
  notes?: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  payment_terms?: string;
  notes?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SupplierPOItem {
  product_id: string;
  variant_id?: string;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
}

export type SupplierPOStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface SupplierPO {
  id: string;
  po_number: string;
  supplier_id: string;
  warehouse_id: string;
  status: SupplierPOStatus;
  items: SupplierPOItem[];
  total_cost: number;
  expected_delivery_date?: string;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}
