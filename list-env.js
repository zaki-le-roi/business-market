console.log("Environment Variables:");
for (const key of Object.keys(process.env)) {
  if (key.includes("SUPABASE") || key.includes("KEY") || key.includes("SECRET") || key.includes("URL") || key.includes("PASSWORD")) {
    console.log(`${key}: ${process.env[key] ? 'PRESENTS' : 'EMPTY'}`);
  }
}
