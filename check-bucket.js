import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function run() {
  console.log("Checking cms-images bucket...");
  try {
    const { data, error } = await supabase.storage.from('cms-images').list();
    if (error) {
      console.error("Error listing files in cms-images:", error.message);
    } else {
      console.log("Successfully connected and listed files in cms-images! Files found:", data.length);
      console.log("Files:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Exception listing files in cms-images:", err);
  }

  console.log("Checking products bucket...");
  try {
    const { data, error } = await supabase.storage.from('products').list();
    if (error) {
      console.error("Error listing files in products:", error.message);
    } else {
      console.log("Successfully listed files in products! Files found:", data.length);
    }
  } catch (err) {
    console.error("Exception listing files in products:", err);
  }
}

run();
