import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function run() {
  console.log("Signing up...");
  const email = 'zakidj181@gmail.com';
  const password = 'zakidj123@';
  
  const res = await supabase.auth.signUp({ email, password });
  console.log("Signup Result:", JSON.stringify(res, null, 2));
}

run();
