export type CustomerType = 'retail' | 'wholesale';

export type InvoiceStatus = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'refunded' | 'cancelled';

export type PaymentStatusType = 'completed' | 'pending' | 'failed' | 'refunded';

export type FinancePaymentMethod = 'cod' | 'baridimob' | 'bank_transfer' | 'cib_edahabia' | 'cash' | 'check' | 'credit';

export type ExpenseCategory = 
  | 'shipping' 
  | 'marketing' 
  | 'inventory_purchase' 
  | 'operational' 
  | 'salaries' 
  | 'utilities' 
  | 'office_rent' 
  | 'other';

export type ExpenseType = 'supplier' | 'operational';

export interface FinanceInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface FinanceInvoice {
  id: string;
  invoice_number: string;
  order_id?: string;
  order_number?: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_type: CustomerType;
  issue_date: string;
  due_date: string;
  items: FinanceInvoiceItem[];
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: InvoiceStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FinancePayment {
  id: string;
  payment_number: string;
  invoice_id?: string;
  invoice_number?: string;
  order_number?: string;
  customer_name: string;
  customer_type: CustomerType;
  amount: number;
  payment_method: FinancePaymentMethod;
  reference_number: string;
  payment_date: string;
  status: PaymentStatusType;
  notes?: string;
  created_at: string;
}

export interface FinanceExpense {
  id: string;
  expense_number: string;
  title: string;
  category: ExpenseCategory;
  expense_type: ExpenseType;
  vendor_name: string;
  amount: number;
  expense_date: string;
  payment_method: FinancePaymentMethod;
  reference_number?: string;
  notes?: string;
  created_at: string;
}

export interface FinanceActivityLog {
  id: string;
  action: string;
  action_type?: string;
  details: string;
  amount?: number;
  entity_id?: string;
  user_name: string;
  created_at: string;
}

export interface FinanceSettings {
  tax_rate: number;
  currency: string;
  fiscal_number: string;
  invoice_prefix: string;
  auto_generate_invoices: boolean;
}
