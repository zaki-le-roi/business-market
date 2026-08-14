import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function probeRPCs() {
  const candidates = [
    'exec_sql', 'execute_sql', 'run_sql', 'sql', 'query', 'exec',
    'admin_exec_sql', 'pg_exec', 'create_table', 'apply_migration'
  ];

  for (const name of candidates) {
    const { data, error } = await supabase.rpc(name, { query: 'SELECT 1', sql: 'SELECT 1' });
    if (error && error.code !== 'PGRST202') {
      console.log(`Found function '${name}'! Result/Error:`, error);
    } else if (!error) {
      console.log(`Found function '${name}'! Data:`, data);
    }
  }
  console.log("RPC probing complete.");
}

probeRPCs();
