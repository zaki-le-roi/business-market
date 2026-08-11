import { supabase } from './supabase';
import { FinanceInvoice, FinancePayment, FinanceExpense, FinanceActivityLog } from '../types/finance';

// Local storage fallback keys for offline/initial state
const INVOICES_STORAGE_KEY = 'store_finance_invoices';
const PAYMENTS_STORAGE_KEY = 'store_finance_payments';
const EXPENSES_STORAGE_KEY = 'store_finance_expenses';
const LOGS_STORAGE_KEY = 'store_finance_logs';

export function loadInvoicesLocal(): FinanceInvoice[] {
  try {
    const saved = localStorage.getItem(INVOICES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading invoices from localStorage:', e);
  }
  return [];
}

export function saveInvoicesLocal(invoices: FinanceInvoice[]) {
  localStorage.setItem(INVOICES_STORAGE_KEY, JSON.stringify(invoices));
}

export function loadPaymentsLocal(): FinancePayment[] {
  try {
    const saved = localStorage.getItem(PAYMENTS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading payments from localStorage:', e);
  }
  return [];
}

export function savePaymentsLocal(payments: FinancePayment[]) {
  localStorage.setItem(PAYMENTS_STORAGE_KEY, JSON.stringify(payments));
}

export function loadExpensesLocal(): FinanceExpense[] {
  try {
    const saved = localStorage.getItem(EXPENSES_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading expenses from localStorage:', e);
  }
  return [];
}

export function saveExpensesLocal(expenses: FinanceExpense[]) {
  localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expenses));
}

export function loadLogsLocal(): FinanceActivityLog[] {
  try {
    const saved = localStorage.getItem(LOGS_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Error reading logs from localStorage:', e);
  }
  return [];
}

export function saveLogsLocal(logs: FinanceActivityLog[]) {
  localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
}


// --- DB MAPPERS ---

function dbToInvoice(row: Record<string, unknown>): FinanceInvoice {
  return {
    id: String(row.id || ''),
    invoice_number: String(row.invoice_number || ''),
    order_id: row.order_id ? String(row.order_id) : undefined,
    order_number: row.order_number ? String(row.order_number) : undefined,
    customer_name: String(row.customer_name || ''),
    customer_phone: row.customer_phone ? String(row.customer_phone) : '',
    customer_email: row.customer_email ? String(row.customer_email) : '',
    customer_type: (row.customer_type as 'retail' | 'wholesale') || 'retail',
    issue_date: String(row.issue_date || row.created_at || ''),
    due_date: String(row.due_date || row.issue_date || row.created_at || ''),
    items: Array.isArray(row.items) ? (row.items as FinanceInvoice['items']) : [],
    subtotal: Number(row.subtotal || 0),
    tax_rate: Number(row.tax_rate || 0),
    tax_amount: Number(row.tax_amount || 0),
    shipping_amount: Number(row.shipping_amount || 0),
    discount_amount: Number(row.discount_amount || 0),
    total_amount: Number(row.total_amount || 0),
    paid_amount: Number(row.paid_amount || 0),
    balance_due: Number(row.balance_due || 0),
    status: (row.status as FinanceInvoice['status']) || 'unpaid',
    notes: row.notes ? String(row.notes) : '',
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || row.created_at || '')
  };
}

function dbToPayment(row: Record<string, unknown>): FinancePayment {
  return {
    id: String(row.id || ''),
    payment_number: String(row.payment_number || ''),
    invoice_id: row.invoice_id ? String(row.invoice_id) : undefined,
    invoice_number: row.invoice_number ? String(row.invoice_number) : undefined,
    order_number: row.order_number ? String(row.order_number) : undefined,
    customer_name: String(row.customer_name || ''),
    customer_type: (row.customer_type as 'retail' | 'wholesale') || 'retail',
    amount: Number(row.amount || 0),
    payment_method: (row.payment_method as FinancePayment['payment_method']) || 'cash',
    reference_number: String(row.reference_number || ''),
    payment_date: String(row.payment_date || row.created_at || ''),
    status: (row.status as FinancePayment['status']) || 'completed',
    notes: row.notes ? String(row.notes) : '',
    created_at: String(row.created_at || '')
  };
}

function dbToExpense(row: Record<string, unknown>): FinanceExpense {
  return {
    id: String(row.id || ''),
    expense_number: String(row.expense_number || ''),
    title: String(row.title || ''),
    category: (row.category as FinanceExpense['category']) || 'other',
    expense_type: (row.expense_type as FinanceExpense['expense_type']) || 'operational',
    vendor_name: String(row.vendor_name || ''),
    amount: Number(row.amount || 0),
    expense_date: String(row.expense_date || row.created_at || ''),
    payment_method: (row.payment_method as FinanceExpense['payment_method']) || 'cash',
    reference_number: String(row.reference_number || ''),
    notes: row.notes ? String(row.notes) : '',
    created_at: String(row.created_at || '')
  };
}


// --- SUPABASE DIRECT API FUNCTIONS WITH SYSTEM_SETTINGS FALLBACK ---

async function getFinanceSetting<T>(key: string): Promise<T[]> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      if (Array.isArray(parsed)) return parsed as T[];
    }
  } catch (e) {
    console.warn(`[financeStore] Error reading ${key} from system_settings:`, e);
  }
  return [];
}

async function saveFinanceSetting<T>(key: string, dataArray: T[]): Promise<boolean> {
  try {
    const { error } = await supabase.from('system_settings').upsert({
      key,
      value: JSON.stringify(dataArray),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

    if (error) {
      console.warn(`[financeStore] Error saving ${key} to system_settings:`, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[financeStore] Exception saving ${key}:`, e);
    return false;
  }
}

// 1. Invoices
export async function fetchInvoicesFromDB(): Promise<FinanceInvoice[]> {
  try {
    const { data, error } = await supabase
      .from('finance_invoices')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = data.map((row) => dbToInvoice(row as Record<string, unknown>));
      saveInvoicesLocal(mapped);
      return mapped;
    }
  } catch {
    // fallback
  }

  const fallback = await getFinanceSetting<FinanceInvoice>('finance_invoices_data');
  if (fallback.length > 0) {
    saveInvoicesLocal(fallback);
    return fallback;
  }
  return loadInvoicesLocal();
}

export async function upsertInvoiceInDB(invoice: Partial<FinanceInvoice>): Promise<{ success: boolean; data?: FinanceInvoice; error?: string }> {
  const isTempId = !invoice.id || invoice.id.startsWith('inv-') || invoice.id.startsWith('invoice-');
  const targetId = isTempId ? `inv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` : invoice.id!;

  const fullInvoice: FinanceInvoice = {
    id: targetId,
    invoice_number: invoice.invoice_number || `INV-${Date.now().toString().slice(-6)}`,
    order_id: invoice.order_id,
    order_number: invoice.order_number,
    customer_name: invoice.customer_name || 'عميل محلي',
    customer_phone: invoice.customer_phone || '',
    customer_email: invoice.customer_email || '',
    customer_type: invoice.customer_type || 'retail',
    issue_date: invoice.issue_date || new Date().toISOString(),
    due_date: invoice.due_date || new Date().toISOString(),
    items: invoice.items || [],
    subtotal: Number(invoice.subtotal || 0),
    tax_rate: Number(invoice.tax_rate || 0),
    tax_amount: Number(invoice.tax_amount || 0),
    shipping_amount: Number(invoice.shipping_amount || 0),
    discount_amount: Number(invoice.discount_amount || 0),
    total_amount: Number(invoice.total_amount || 0),
    paid_amount: Number(invoice.paid_amount || 0),
    balance_due: Number(invoice.balance_due || 0),
    status: invoice.status || 'unpaid',
    notes: invoice.notes || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Try DB table first
  try {
    const payload: Record<string, unknown> = {
      invoice_number: fullInvoice.invoice_number,
      order_id: fullInvoice.order_id || null,
      order_number: fullInvoice.order_number || null,
      customer_name: fullInvoice.customer_name,
      customer_phone: fullInvoice.customer_phone || null,
      customer_email: fullInvoice.customer_email || null,
      customer_type: fullInvoice.customer_type,
      issue_date: fullInvoice.issue_date,
      due_date: fullInvoice.due_date,
      items: fullInvoice.items,
      subtotal: fullInvoice.subtotal,
      tax_rate: fullInvoice.tax_rate,
      tax_amount: fullInvoice.tax_amount,
      shipping_amount: fullInvoice.shipping_amount,
      discount_amount: fullInvoice.discount_amount,
      total_amount: fullInvoice.total_amount,
      paid_amount: fullInvoice.paid_amount,
      balance_due: fullInvoice.balance_due,
      status: fullInvoice.status,
      notes: fullInvoice.notes || null,
      updated_at: new Date().toISOString()
    };
    if (!isTempId) payload.id = fullInvoice.id;

    const { data, error } = await supabase
      .from('finance_invoices')
      .upsert(payload)
      .select()
      .single();

    if (!error && data) {
      const saved = dbToInvoice(data as Record<string, unknown>);
      return { success: true, data: saved };
    }
  } catch {
    // fallback
  }

  // 2. Fallback to system_settings in Supabase
  try {
    const current = await fetchInvoicesFromDB();
    const existingIndex = current.findIndex((i) => i.id === targetId);
    let updatedList: FinanceInvoice[];
    if (existingIndex >= 0) {
      updatedList = [...current];
      updatedList[existingIndex] = fullInvoice;
    } else {
      updatedList = [fullInvoice, ...current];
    }

    const savedToSystemSettings = await saveFinanceSetting('finance_invoices_data', updatedList);
    saveInvoicesLocal(updatedList);

    if (savedToSystemSettings) {
      return { success: true, data: fullInvoice };
    }
    return { success: false, error: 'فشل حفظ الفاتورة في قاعدة البيانات' };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'فشل حفظ الفاتورة' };
  }
}

export async function deleteInvoiceFromDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('finance_invoices').delete().eq('id', id);
    if (!error) return { success: true };
  } catch {
    // fallback
  }

  try {
    const current = await fetchInvoicesFromDB();
    const updated = current.filter((i) => i.id !== id);
    await saveFinanceSetting('finance_invoices_data', updated);
    saveInvoicesLocal(updated);
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'فشل حذف الفاتورة' };
  }
}

// 2. Payments
export async function fetchPaymentsFromDB(): Promise<FinancePayment[]> {
  try {
    const { data, error } = await supabase
      .from('finance_payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = data.map((row) => dbToPayment(row as Record<string, unknown>));
      savePaymentsLocal(mapped);
      return mapped;
    }
  } catch {
    // fallback
  }

  const fallback = await getFinanceSetting<FinancePayment>('finance_payments_data');
  if (fallback.length > 0) {
    savePaymentsLocal(fallback);
    return fallback;
  }
  return loadPaymentsLocal();
}

export async function upsertPaymentInDB(payment: Partial<FinancePayment>): Promise<{ success: boolean; data?: FinancePayment; error?: string }> {
  const isTempId = !payment.id || payment.id.startsWith('pay-') || payment.id.startsWith('payment-');
  const targetId = isTempId ? `pay-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` : payment.id!;

  const fullPayment: FinancePayment = {
    id: targetId,
    payment_number: payment.payment_number || `PAY-${Date.now().toString().slice(-6)}`,
    invoice_id: payment.invoice_id,
    invoice_number: payment.invoice_number,
    order_number: payment.order_number,
    customer_name: payment.customer_name || 'عميل',
    customer_type: payment.customer_type || 'retail',
    amount: Number(payment.amount || 0),
    payment_method: payment.payment_method || 'cash',
    reference_number: payment.reference_number || '',
    payment_date: payment.payment_date || new Date().toISOString(),
    status: payment.status || 'completed',
    notes: payment.notes || '',
    created_at: new Date().toISOString()
  };

  try {
    const payload: Record<string, unknown> = {
      payment_number: fullPayment.payment_number,
      invoice_id: fullPayment.invoice_id || null,
      invoice_number: fullPayment.invoice_number || null,
      order_number: fullPayment.order_number || null,
      customer_name: fullPayment.customer_name,
      customer_type: fullPayment.customer_type,
      amount: fullPayment.amount,
      payment_method: fullPayment.payment_method,
      reference_number: fullPayment.reference_number || null,
      payment_date: fullPayment.payment_date,
      status: fullPayment.status,
      notes: fullPayment.notes || null,
    };
    if (!isTempId) payload.id = fullPayment.id;

    const { data, error } = await supabase
      .from('finance_payments')
      .upsert(payload)
      .select()
      .single();

    if (!error && data) {
      const saved = dbToPayment(data as Record<string, unknown>);
      return { success: true, data: saved };
    }
  } catch {
    // fallback
  }

  try {
    const current = await fetchPaymentsFromDB();
    const existingIndex = current.findIndex((p) => p.id === targetId);
    let updatedList: FinancePayment[];
    if (existingIndex >= 0) {
      updatedList = [...current];
      updatedList[existingIndex] = fullPayment;
    } else {
      updatedList = [fullPayment, ...current];
    }

    const savedToSystemSettings = await saveFinanceSetting('finance_payments_data', updatedList);
    savePaymentsLocal(updatedList);

    if (savedToSystemSettings) {
      return { success: true, data: fullPayment };
    }
    return { success: false, error: 'فشل حفظ عملية الدفع' };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'فشل حفظ عملية الدفع' };
  }
}

export async function deletePaymentFromDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('finance_payments').delete().eq('id', id);
    if (!error) return { success: true };
  } catch {
    // fallback
  }

  try {
    const current = await fetchPaymentsFromDB();
    const updated = current.filter((p) => p.id !== id);
    await saveFinanceSetting('finance_payments_data', updated);
    savePaymentsLocal(updated);
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'فشل حذف عملية الدفع' };
  }
}

// 3. Expenses
export async function fetchExpensesFromDB(): Promise<FinanceExpense[]> {
  try {
    const { data, error } = await supabase
      .from('finance_expenses')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = data.map((row) => dbToExpense(row as Record<string, unknown>));
      saveExpensesLocal(mapped);
      return mapped;
    }
  } catch {
    // fallback
  }

  const fallback = await getFinanceSetting<FinanceExpense>('finance_expenses_data');
  if (fallback.length > 0) {
    saveExpensesLocal(fallback);
    return fallback;
  }
  return loadExpensesLocal();
}

export async function upsertExpenseInDB(expense: Partial<FinanceExpense>): Promise<{ success: boolean; data?: FinanceExpense; error?: string }> {
  const isTempId = !expense.id || expense.id.startsWith('exp-') || expense.id.startsWith('expense-');
  const targetId = isTempId ? `exp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` : expense.id!;

  const fullExpense: FinanceExpense = {
    id: targetId,
    expense_number: expense.expense_number || `EXP-${Date.now().toString().slice(-6)}`,
    title: expense.title || 'مصروف جديد',
    category: expense.category || 'other',
    expense_type: expense.expense_type || 'operational',
    vendor_name: expense.vendor_name || '',
    amount: Number(expense.amount || 0),
    expense_date: expense.expense_date || new Date().toISOString(),
    payment_method: expense.payment_method || 'cash',
    reference_number: expense.reference_number || '',
    notes: expense.notes || '',
    created_at: new Date().toISOString()
  };

  try {
    const payload: Record<string, unknown> = {
      expense_number: fullExpense.expense_number,
      title: fullExpense.title,
      category: fullExpense.category,
      expense_type: fullExpense.expense_type,
      vendor_name: fullExpense.vendor_name,
      amount: fullExpense.amount,
      expense_date: fullExpense.expense_date,
      payment_method: fullExpense.payment_method,
      reference_number: fullExpense.reference_number || null,
      notes: fullExpense.notes || null,
    };
    if (!isTempId) payload.id = fullExpense.id;

    const { data, error } = await supabase
      .from('finance_expenses')
      .upsert(payload)
      .select()
      .single();

    if (!error && data) {
      const saved = dbToExpense(data as Record<string, unknown>);
      return { success: true, data: saved };
    }
  } catch {
    // fallback
  }

  try {
    const current = await fetchExpensesFromDB();
    const existingIndex = current.findIndex((e) => e.id === targetId);
    let updatedList: FinanceExpense[];
    if (existingIndex >= 0) {
      updatedList = [...current];
      updatedList[existingIndex] = fullExpense;
    } else {
      updatedList = [fullExpense, ...current];
    }

    const savedToSystemSettings = await saveFinanceSetting('finance_expenses_data', updatedList);
    saveExpensesLocal(updatedList);

    if (savedToSystemSettings) {
      return { success: true, data: fullExpense };
    }
    return { success: false, error: 'فشل حفظ المصروف' };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'فشل حفظ المصروف' };
  }
}

export async function deleteExpenseFromDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('finance_expenses').delete().eq('id', id);
    if (!error) return { success: true };
  } catch {
    // fallback
  }

  try {
    const current = await fetchExpensesFromDB();
    const updated = current.filter((e) => e.id !== id);
    await saveFinanceSetting('finance_expenses_data', updated);
    saveExpensesLocal(updated);
    return { success: true };
  } catch (e: unknown) {
    const err = e as Error;
    return { success: false, error: err?.message || 'فشل حذف المصروف' };
  }
}

// 4. Audit Logs
export async function fetchFinanceLogsFromDB(): Promise<FinanceActivityLog[]> {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'finance')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data && data.length > 0) {
      const mapped: FinanceActivityLog[] = data.map((log) => ({
        id: log.id,
        action: log.action || 'Finance Action',
        details: typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || ''),
        user_name: log.actor || 'Admin',
        created_at: log.created_at
      }));
      saveLogsLocal(mapped);
      return mapped;
    }
  } catch (e) {
    console.warn('Error reading audit logs for finance:', e);
  }
  return loadLogsLocal();
}

export async function addFinanceLogToDB(action: string, actor: string, details: string): Promise<void> {
  // Update local
  const current = loadLogsLocal();
  const newLog: FinanceActivityLog = {
    id: `log-${Date.now()}`,
    action,
    details,
    user_name: actor,
    created_at: new Date().toISOString()
  };
  const updated = [newLog, ...current].slice(0, 100);
  saveLogsLocal(updated);

  // Update Supabase
  try {
    await supabase.from('audit_logs').insert([{
      actor,
      action,
      entity_type: 'finance',
      details: { details, timestamp: new Date().toISOString() }
    }]);
  } catch (e) {
    console.warn('Could not save finance audit log to DB:', e);
  }
}
