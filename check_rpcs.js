import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function testRpcs() {
  console.log("Testing existing RPC functions on remote Supabase...");

  const rpcsToTest = [
    'get_active_promotions',
    'exec_sql',
    'execute_sql',
    'run_sql',
    'search_products',
    'get_app_config'
  ];

  for (const rpcName of rpcsToTest) {
    const { data, error } = await supabase.rpc(rpcName, {});
    console.log(`RPC [${rpcName}]:`, error ? `Error (${error.code}: ${error.message})` : `Success ->`, data);
  }
}

testRpcs();
