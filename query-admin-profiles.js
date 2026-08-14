import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function run() {
  console.log("Querying admin_profiles...");
  const { data, error } = await supabase.from('admin_profiles').select('*');
  if (error) {
    console.error("Error querying admin_profiles:", error);
  } else {
    console.log("admin_profiles rows:", data);
  }
}

run();
