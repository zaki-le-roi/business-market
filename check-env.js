console.log("Supabase URL in process.env:", process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
console.log("Supabase Service Key in process.env:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "EXISTS" : "MISSING");
console.log("Supabase Anon Key in process.env:", process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY ? "EXISTS" : "MISSING");
console.log("Full process.env keys:", Object.keys(process.env).filter(k => k.includes("SUPABASE") || k.includes("KEY") || k.includes("URL") || k.includes("VITE")));
