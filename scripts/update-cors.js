#!/usr/bin/env node

/**
 * Script to update all Supabase edge functions to use standardized CORS handling
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const FUNCTIONS_DIR = './supabase/functions';
const EXCLUDED_DIRS = ['_shared'];
const EXCLUDED_FILES = ['generate-content', 'generate-resume', 'parse-resume']; // Already updated

// CORS patterns to find and replace
const OLD_CORS_PATTERNS = [
  {
    // Old import pattern
    find: /^(import.*\n)*const corsHeaders = \{[\s\S]*?\};/m,
    replace: `import { corsHeaders, handleCorsPrelight, jsonWithCors, errorWithCors } from '../_shared/cors.ts';`
  },
  {
    // Old OPTIONS handling
    find: /if \(req\.method === 'OPTIONS'\) \{\s*return new Response\([^}]*\);\s*\}/,
    replace: `if (req.method === 'OPTIONS') {\n    return handleCorsPrelight();\n  }`
  },
  {
    // Old JSON response with CORS
    find: /return new Response\(JSON\.stringify\(([^)]+)\),\s*\{\s*status:\s*(\d+),\s*headers:\s*\{\s*\.\.\.corsHeaders,\s*'Content-Type':\s*'application\/json'\s*\}\s*\}\);/g,
    replace: (match, data, status) => {
      if (status === '200') {
        return `return jsonWithCors(${data});`;
      } else {
        return `return jsonWithCors(${data}, { status: ${status} });`;
      }
    }
  },
  {
    // Old JSON response without status
    find: /return new Response\(JSON\.stringify\(([^)]+)\),\s*\{\s*headers:\s*\{\s*\.\.\.corsHeaders,\s*'Content-Type':\s*'application\/json'\s*\}\s*\}\);/g,
    replace: (match, data) => `return jsonWithCors(${data});`
  },
  {
    // Error responses
    find: /return new Response\(JSON\.stringify\(\{[^}]*error:[^}]*\}\),\s*\{\s*status:\s*(\d+),\s*headers:[^}]*\}\);/g,
    replace: (match, status) => {
      // Extract error message from the match
      const errorMatch = match.match(/error:\s*([^,}]*)/);
      const errorMsg = errorMatch ? errorMatch[1].trim() : "'Unknown error'";
      return `return errorWithCors(${errorMsg}, ${status});`;
    }
  }
];

function getFunctionDirs() {
  return readdirSync(FUNCTIONS_DIR)
    .filter(item => {
      const path = join(FUNCTIONS_DIR, item);
      return statSync(path).isDirectory() && !EXCLUDED_DIRS.includes(item) && !EXCLUDED_FILES.includes(item);
    });
}

function updateFunction(functionName) {
  const indexPath = join(FUNCTIONS_DIR, functionName, 'index.ts');

  try {
    let content = readFileSync(indexPath, 'utf8');
    let updated = false;

    // Check if already imports CORS utilities
    if (content.includes("from '../_shared/cors.ts'")) {
      console.log(`✓ ${functionName}: Already uses new CORS utilities`);
      return false;
    }

    // Apply patterns
    for (const pattern of OLD_CORS_PATTERNS) {
      if (typeof pattern.replace === 'function') {
        const newContent = content.replace(pattern.find, pattern.replace);
        if (newContent !== content) {
          content = newContent;
          updated = true;
        }
      } else {
        const newContent = content.replace(pattern.find, pattern.replace);
        if (newContent !== content) {
          content = newContent;
          updated = true;
        }
      }
    }

    if (updated) {
      writeFileSync(indexPath, content);
      console.log(`✓ ${functionName}: Updated CORS handling`);
      return true;
    } else {
      console.log(`- ${functionName}: No CORS patterns found to update`);
      return false;
    }

  } catch (error) {
    console.error(`✗ ${functionName}: Error updating - ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔧 Updating CORS handling in Supabase edge functions...\n');

  const functions = getFunctionDirs();
  let updatedCount = 0;

  for (const functionName of functions) {
    const wasUpdated = updateFunction(functionName);
    if (wasUpdated) updatedCount++;
  }

  console.log(`\n📊 Updated ${updatedCount} out of ${functions.length} functions`);
  console.log('✨ CORS update complete!');

  if (updatedCount > 0) {
    console.log('\n📤 Next steps:');
    console.log('1. Review the changes in git diff');
    console.log('2. Test the updated functions locally if needed');
    console.log('3. Deploy with: supabase functions deploy --project-ref ffjsgjsiemtxqbhimvhb');
  }
}

main();