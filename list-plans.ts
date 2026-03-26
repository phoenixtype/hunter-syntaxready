import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');
async function list() {
  const { data, error } = await supabase.from('subscription_plans').select('name, display_name');
  if (error) console.error('Error:', error);
  else console.log('Plans:', data);
}
list();
