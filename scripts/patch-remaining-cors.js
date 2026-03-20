#!/usr/bin/env node

/**
 * Script to add the missing x-connection-pool-size header to functions with custom CORS
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const FUNCTIONS_DIR = './supabase/functions';
const FUNCTIONS_TO_PATCH = ['create-portal', 'send-auth-email', 'check-usage-warnings', 'process-notifications'];

function patchFunction(functionName) {
  const indexPath = join(FUNCTIONS_DIR, functionName, 'index.ts');

  try {
    let content = readFileSync(indexPath, 'utf8');

    // Check if it already has the shared CORS import
    if (content.includes("from '../_shared/cors.ts'")) {
      console.log(`✓ ${functionName}: Already using shared CORS utilities`);
      return false;
    }

    // Look for existing CORS headers and add the missing header
    const corsHeaderPattern = /'Access-Control-Allow-Headers':\s*'([^']+)'/;
    const match = content.match(corsHeaderPattern);

    if (match && !match[1].includes('x-connection-pool-size')) {
      const oldHeaders = match[1];
      const newHeaders = oldHeaders + ', x-connection-pool-size';
      content = content.replace(corsHeaderPattern, `'Access-Control-Allow-Headers': '${newHeaders}'`);

      writeFileSync(indexPath, content);
      console.log(`✓ ${functionName}: Added x-connection-pool-size to CORS headers`);
      return true;
    } else if (match) {
      console.log(`✓ ${functionName}: Already has x-connection-pool-size header`);
      return false;
    } else {
      console.log(`- ${functionName}: No CORS headers pattern found`);
      return false;
    }

  } catch (error) {
    console.error(`✗ ${functionName}: Error patching - ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔧 Patching remaining CORS headers...\n');

  let patchedCount = 0;

  for (const functionName of FUNCTIONS_TO_PATCH) {
    const wasPatched = patchFunction(functionName);
    if (wasPatched) patchedCount++;
  }

  console.log(`\n📊 Patched ${patchedCount} out of ${FUNCTIONS_TO_PATCH.length} functions`);
  console.log('✨ CORS patching complete!');
}

main();