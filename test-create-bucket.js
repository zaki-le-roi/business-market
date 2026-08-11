import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function run() {
  console.log("Attempting to create bucket as anon...");
  const b = 'cms-images';
  try {
    const { data, error } = await supabase.storage.createBucket(b, {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    });
    if (error) {
      console.error(`Failed to create bucket ${b}:`, error);
    } else {
      console.log(`Successfully created bucket ${b}!`, data);
    }
  } catch (e) {
    console.error(`Exception:`, e);
  }
}

run();
