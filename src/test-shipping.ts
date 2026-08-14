import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

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
    'shipping_settings',
    'wilayas'
  ];

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`❌ Table '${t}':`, error.message, `(code: ${error.code})`);
    } else {
      console.log(`✅ Table '${t}': EXISTS! (Row count sample: ${data ? data.length : 0})`);
    }
  }
}

testShippingTables();
