import { createClient } from '@supabase/supabase-js';

const url = 'https://dyhpfgjogdiongmcmoti.supabase.co';
const anonKey = 'sb_publishable_-IPbcqQsh8YXpNZPqa9AMg_YIudLt4a';

const supabase = createClient(url, anonKey);

async function run() {
  console.log("Checking bucket 'cms-images'...");
  const { data, error } = await supabase.storage.getBucket('cms-images');
  if (error) {
    console.error("getBucket('cms-images') failed:", error);
  } else {
    console.log("getBucket('cms-images') success:", data);
  }

  console.log("Checking bucket 'cms'...");
  const { data: data2, error: error2 } = await supabase.storage.getBucket('cms');
  if (error2) {
    console.error("getBucket('cms') failed:", error2);
  } else {
    console.log("getBucket('cms') success:", data2);
  }
}

run();
