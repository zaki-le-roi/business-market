import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function run() {
  console.log("Connecting to Supabase...");
  
  const email = 'zakidj181@gmail.com';
  const password = 'zakidj123@';
  
  console.log("Attempting sign up first...");
  const { data: suData, error: suErr } = await supabase.auth.signUp({ email, password });
  if (suErr) {
    console.log("Sign up warning/failure (user might already exist):", suErr.message);
  } else {
    console.log("Sign up response success!");
  }

  console.log("Attempting sign in...");
  const { data: { session }, error: loginErr } = await supabase.auth.signInWithPassword({ email, password });
  
  if (loginErr) {
    console.error("Login failed:", loginErr.message);
    return;
  }
  
  console.log("Login successful! User ID:", session.user.id);
  
  const bucketsToCreate = ['cms-images', 'product-images', 'category-images', 'products', 'categories', 'cms'];
  
  for (const b of bucketsToCreate) {
    console.log(`Creating bucket: ${b}...`);
    try {
      const { data, error } = await supabase.storage.createBucket(b, {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
      });
      if (error) {
        console.error(`Failed to create bucket ${b}:`, error.message);
      } else {
        console.log(`Successfully created bucket ${b}!`, data);
      }
    } catch (e) {
      console.error(`Exception creating bucket ${b}:`, e);
    }
  }
  
  // List buckets again
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log("Final Available Buckets:", JSON.stringify(buckets, null, 2));
}

run();
