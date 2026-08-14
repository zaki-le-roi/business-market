import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function testShippingTables() {
  console.log('Testing Shipping tables on Supabase...');

  const tables = [
    'shipping_providers',
    'shipping_rates',
    'shipping_manifests',
    'shipments',
    'shipment_tracking_events',
    'treasury_accounts',
    'cod_settlements',
    'cod_settlement_items',
    'shipping_settings'
  ];

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`❌ Table '${t}' query error:`, error.message, `(code: ${error.code})`);
    } else {
      console.log(`✅ Table '${t}' EXISTS! Rows returned: ${data ? data.length : 0}`);
    }
  }
}

testShippingTables();
