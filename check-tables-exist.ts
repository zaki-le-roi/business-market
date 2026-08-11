import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function findExistingTables() {
  const commonTables = [
    'products', 'categories', 'orders', 'customers', 'reviews', 'coupons',
    'support_tickets', 'cms_settings', 'system_settings', 'warehouses',
    'suppliers', 'supplier_purchase_orders', 'inventory_levels', 'inventory_movements',
    'marketing_campaigns', 'finance_transactions', 'wilayas', 'shipping_providers'
  ];

  console.log("Checking tables in Supabase:");
  for (const t of commonTables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (!error) {
      console.log(`  ✅ ${t} EXISTS (rows: ${data ? data.length : 0})`);
    } else {
      console.log(`  ❌ ${t}: ${error.code} - ${error.message}`);
    }
  }
}

findExistingTables();
