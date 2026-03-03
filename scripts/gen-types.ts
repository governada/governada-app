/**
 * Generate TypeScript types from the remote Supabase schema.
 *
 * Usage:  npx tsx scripts/gen-types.ts
 *
 * Requires SUPABASE_ACCESS_TOKEN in .env.local (or env).
 * Derives the project ref from NEXT_PUBLIC_SUPABASE_URL.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  console.error('NEXT_PUBLIC_SUPABASE_URL is not set');
  process.exit(1);
}

const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
if (!match) {
  console.error(`Cannot extract project ref from URL: ${supabaseUrl}`);
  process.exit(1);
}

const projectRef = match[1];
const outFile = path.join(__dirname, '..', 'types', 'database.ts');

console.log(`Generating types for project: ${projectRef}`);

try {
  const types = execSync(
    `npx supabase gen types typescript --project-id ${projectRef} --schema public`,
    { encoding: 'utf-8', env: { ...process.env }, stdio: ['pipe', 'pipe', 'inherit'] },
  );

  fs.writeFileSync(outFile, types);
  console.log(`Types written to ${outFile}`);
} catch (err) {
  console.error('Type generation failed. Ensure SUPABASE_ACCESS_TOKEN is set.');
  process.exit(1);
}
