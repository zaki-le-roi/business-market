import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function run() {
  console.log("Connecting to Supabase...");
  
  try {
    console.log("Fetching products...");
    const { data, error } = await supabase.from('products').select('id, name_ar, name_fr, sku, slug');
    if (error) {
      console.error("Error fetching products:", error.message, error);
    } else {
      console.log(`Successfully fetched ${data.length} products! Rows:`, JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Exception during query:", err);
  }
}

run();
