import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

// Connect with storage schema
const supabase = createClient(url, anonKey, {
  db: { schema: 'storage' }
});

async function run() {
  console.log("Querying storage.buckets...");
  try {
    const { data, error } = await supabase.from('buckets').select('*');
    if (error) {
      console.error("Error querying buckets:", error);
    } else {
      console.log("Buckets:", data);
    }
  } catch (err) {
    console.error("Exception:", err);
  }
}

run();
