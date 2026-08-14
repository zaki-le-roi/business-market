import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function run() {
  const buckets = ['product-images', 'products', 'category-images', 'categories'];
  for (const b of buckets) {
    console.log(`Checking bucket '${b}'...`);
    const { data, error } = await supabase.storage.getBucket(b);
    if (error) {
      console.error(`getBucket('${b}') failed:`, error.message);
    } else {
      console.log(`getBucket('${b}') success:`, data);
    }
  }
}

run();
