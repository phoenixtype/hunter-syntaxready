import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const envText = await Deno.readTextFile(".env.local");
let url = "", key = "";
for (const line of envText.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
}
// fallback string to parse the .env file if .env.local doesn't have it
if (!url) {
  const envText2 = await Deno.readTextFile(".env");
  for (const line of envText2.split('\n')) {
    if (line.startsWith('VITE_SUPABASE_URL=')) url = line.replace(/['"]/g,'').split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_SERVICE_ROLE_KEY=')) key = line.replace(/['"]/g,'').split('=')[1].trim();
  }
}

// Since I only have ANON key from .env, I'll just use that
const anonKeyText = await Deno.readTextFile(".env");
for (const line of anonKeyText.split('\n')) {
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.replace(/['"]/g,'').split('=')[1].trim();
}

const supabase = createClient(url, key);

// The anon key can call check_rate_limit RPC successfully if granted TO anon (which it is in older migrations, wait no it's granted to authenticated and service_role).
// Let's see if we can just test with a random UUID if we can't authenticate.
const userId = "00000000-0000-0000-0000-000000000000";

const { data, error } = await supabase.rpc('check_rate_limit', {
  p_user_id: userId,
  p_function_name: 'test_func',
  p_max_requests: 100,
  p_window_seconds: 60
});

console.log("RPC Data:", data);
console.log("RPC Error:", error);
