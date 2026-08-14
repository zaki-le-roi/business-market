import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function testSuppliers() {
  console.log("=== TESTING SUPABASE SUPPLIERS & PURCHASE ORDERS ===");

  // 1. SELECT Suppliers
  console.log("\n1. Querying 'suppliers' table...");
  const { data: supList, error: supErr } = await supabase.from('suppliers').select('*');
  if (supErr) {
    console.error("  ❌ SELECT suppliers error:", supErr);
  } else {
    console.log(`  ✅ SELECT suppliers success! Count: ${supList ? supList.length : 0}`);
    console.log("  Sample row:", supList && supList[0] ? supList[0] : "None");
  }

  // 2. SELECT Purchase Orders
  console.log("\n2. Querying 'supplier_purchase_orders' table...");
  const { data: poList, error: poErr } = await supabase.from('supplier_purchase_orders').select('*');
  if (poErr) {
    console.error("  ❌ SELECT supplier_purchase_orders error:", poErr);
  } else {
    console.log(`  ✅ SELECT supplier_purchase_orders success! Count: ${poList ? poList.length : 0}`);
    console.log("  Sample row:", poList && poList[0] ? poList[0] : "None");
  }
}

testSuppliers();
