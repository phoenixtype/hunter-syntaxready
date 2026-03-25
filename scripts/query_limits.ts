import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const envText = await Deno.readTextFile(".env.local");
let url = "", key = "";
for (const line of envText.split('\n')) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);
const { data, error } = await supabase
  .from("rate_limits")
  .select("*")
  .order("updated_at", { ascending: false })
  .limit(10);
  
console.log("Recent rate limits:");
console.log(JSON.stringify(data, null, 2));
if (error) console.error("Error:", error);
