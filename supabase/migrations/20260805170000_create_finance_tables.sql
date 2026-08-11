/*
# Create Finance Tables (Invoices, Payments, Expenses) and RLS Policies

## Tables
1. `finance_invoices`: Manage all financial invoices (Sales, Wholesale, Services, Other).
2. `finance_payments`: Manage payments linked to invoices or direct customer payments.
3. `finance_expenses`: Manage business operational expenses and receipts.
*/

-- 1. Create finance_invoices table
CREATE TABLE IF NOT EXISTS finance_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    order_id TEXT,
    order_number TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    customer_type TEXT NOT NULL DEFAULT 'retail',
    issue_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date TIMESTAMPTZ,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    shipping_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    balance_due NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for finance_invoices
ALTER TABLE finance_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_invoices_select_authenticated" ON finance_invoices;
CREATE POLICY "finance_invoices_select_authenticated" ON finance_invoices
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "finance_invoices_insert_authenticated" ON finance_invoices;
CREATE POLICY "finance_invoices_insert_authenticated" ON finance_invoices
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "finance_invoices_update_authenticated" ON finance_invoices;
CREATE POLICY "finance_invoices_update_authenticated" ON finance_invoices
    FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "finance_invoices_delete_authenticated" ON finance_invoices;
CREATE POLICY "finance_invoices_delete_authenticated" ON finance_invoices
    FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);


-- 2. Create finance_payments table
CREATE TABLE IF NOT EXISTS finance_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_number TEXT,
    invoice_id TEXT,
    invoice_number TEXT,
    order_number TEXT,
    customer_name TEXT NOT NULL,
    customer_type TEXT NOT NULL DEFAULT 'retail',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    reference_number TEXT,
    payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'completed',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for finance_payments
ALTER TABLE finance_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_payments_select_authenticated" ON finance_payments;
CREATE POLICY "finance_payments_select_authenticated" ON finance_payments
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "finance_payments_insert_authenticated" ON finance_payments;
CREATE POLICY "finance_payments_insert_authenticated" ON finance_payments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "finance_payments_update_authenticated" ON finance_payments;
CREATE POLICY "finance_payments_update_authenticated" ON finance_payments
    FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "finance_payments_delete_authenticated" ON finance_payments;
CREATE POLICY "finance_payments_delete_authenticated" ON finance_payments
    FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);


-- 3. Create finance_expenses table
CREATE TABLE IF NOT EXISTS finance_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_number TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    expense_type TEXT NOT NULL DEFAULT 'operational',
    vendor_name TEXT NOT NULL DEFAULT '',
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    expense_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    payment_method TEXT NOT NULL DEFAULT 'cash',
    reference_number TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for finance_expenses
ALTER TABLE finance_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_expenses_select_authenticated" ON finance_expenses;
CREATE POLICY "finance_expenses_select_authenticated" ON finance_expenses
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "finance_expenses_insert_authenticated" ON finance_expenses;
CREATE POLICY "finance_expenses_insert_authenticated" ON finance_expenses
    FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "finance_expenses_update_authenticated" ON finance_expenses;
CREATE POLICY "finance_expenses_update_authenticated" ON finance_expenses
    FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "finance_expenses_delete_authenticated" ON finance_expenses;
CREATE POLICY "finance_expenses_delete_authenticated" ON finance_expenses
    FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
