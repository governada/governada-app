/**
 * Bundle Report Script
 *
 * Parses `next build` output and reports page sizes.
 * Flags pages exceeding size thresholds.
 *
 * Usage:
 *   npm run build 2>&1 | npx tsx scripts/bundle-report.ts
 *   # Or standalone (reads from most recent build):
 *   npx tsx scripts/bundle-report.ts
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const THRESHOLD_FIRST_LOAD_KB = 200; // Flag pages over 200KB first-load JS
const THRESHOLD_PAGE_KB = 50; // Flag individual page chunks over 50KB

interface PageEntry {
  route: string;
  size: string;
  firstLoad: string;
  sizeKB: number;
  firstLoadKB: number;
  type: 'static' | 'dynamic' | 'ssr';
}

function parseSize(sizeStr: string): number {
  const match = sizeStr.match(/([\d.]+)\s*(kB|B|MB)/);
  if (!match) return 0;
  const [, num, unit] = match;
  const value = parseFloat(num);
  if (unit === 'MB') return value * 1024;
  if (unit === 'kB') return value;
  return value / 1024; // bytes to KB
}

function parseBuildOutput(input: string): PageEntry[] {
  const entries: PageEntry[] = [];
  const lines = input.split('\n');

  for (const line of lines) {
    // Match Next.js build output lines like:
    // ├ ○ /discover   4.2 kB   180 kB
    // ├ ƒ /drep/[drepId]   12 kB   220 kB
    const match = line.match(
      /[├└]\s*([○●ƒλ])\s+(\/\S+)\s+([\d.]+\s*(?:kB|B|MB))\s+([\d.]+\s*(?:kB|B|MB))/,
    );
    if (match) {
      const [, typeChar, route, size, firstLoad] = match;
      entries.push({
        route,
        size,
        firstLoad,
        sizeKB: parseSize(size),
        firstLoadKB: parseSize(firstLoad),
        type:
          typeChar === 'ƒ' || typeChar === 'λ' ? 'dynamic' : typeChar === '●' ? 'ssr' : 'static',
      });
    }
  }

  return entries;
}

function generateReport(entries: PageEntry[]): void {
  if (entries.length === 0) {
    console.log(
      'No build output found. Run: npm run build 2>&1 | npx tsx scripts/bundle-report.ts',
    );
    return;
  }

  const flagged = entries.filter((e) => e.firstLoadKB > THRESHOLD_FIRST_LOAD_KB);
  const largePages = entries.filter((e) => e.sizeKB > THRESHOLD_PAGE_KB);

  console.log('\n📊 Bundle Report');
  console.log('='.repeat(80));

  // Summary
  const totalPages = entries.length;
  const avgFirstLoad = entries.reduce((sum, e) => sum + e.firstLoadKB, 0) / totalPages;
  const maxFirstLoad = Math.max(...entries.map((e) => e.firstLoadKB));
  const maxPage = entries.reduce((max, e) => (e.firstLoadKB > max.firstLoadKB ? e : max));

  console.log(`\nTotal pages: ${totalPages}`);
  console.log(`Avg first-load JS: ${avgFirstLoad.toFixed(1)} kB`);
  console.log(`Max first-load JS: ${maxFirstLoad.toFixed(1)} kB (${maxPage.route})`);
  console.log(`Pages over ${THRESHOLD_FIRST_LOAD_KB}kB threshold: ${flagged.length}`);

  // Flagged pages
  if (flagged.length > 0) {
    console.log(`\n⚠️  Pages exceeding ${THRESHOLD_FIRST_LOAD_KB}kB first-load threshold:`);
    console.log('-'.repeat(80));
    for (const entry of flagged.sort((a, b) => b.firstLoadKB - a.firstLoadKB)) {
      const overBy = (entry.firstLoadKB - THRESHOLD_FIRST_LOAD_KB).toFixed(1);
      console.log(
        `  ${entry.type === 'dynamic' ? 'ƒ' : '○'} ${entry.route.padEnd(40)} ${entry.firstLoad.padStart(10)} (+${overBy}kB over)`,
      );
    }
  }

  // Large individual page chunks
  if (largePages.length > 0) {
    console.log(`\n📦 Large page chunks (>${THRESHOLD_PAGE_KB}kB):`);
    console.log('-'.repeat(80));
    for (const entry of largePages.sort((a, b) => b.sizeKB - a.sizeKB)) {
      console.log(`  ${entry.route.padEnd(40)} ${entry.size.padStart(10)}`);
    }
  }

  // All pages sorted by first-load size
  console.log('\n📋 All pages by first-load JS:');
  console.log('-'.repeat(80));
  for (const entry of entries.sort((a, b) => b.firstLoadKB - a.firstLoadKB).slice(0, 20)) {
    const indicator = entry.firstLoadKB > THRESHOLD_FIRST_LOAD_KB ? '⚠️ ' : '   ';
    console.log(
      `${indicator}${entry.route.padEnd(40)} ${entry.size.padStart(10)} / ${entry.firstLoad.padStart(10)}`,
    );
  }
  if (entries.length > 20) {
    console.log(`  ... and ${entries.length - 20} more pages`);
  }

  // Score recommendation
  console.log('\n📊 Audit Score Recommendation:');
  if (flagged.length === 0 && avgFirstLoad < 150) {
    console.log('  Performance: 8-9/10 (all pages under threshold, good average)');
  } else if (flagged.length <= 3) {
    console.log('  Performance: 6-7/10 (a few pages over threshold, optimize the flagged routes)');
  } else {
    console.log(
      '  Performance: 4-5/10 (multiple pages over threshold, bundle optimization needed)',
    );
  }

  console.log('\n' + '='.repeat(80));
}

// Read from stdin or from a cached build log
let input = '';
if (!process.stdin.isTTY) {
  input = readFileSync('/dev/stdin', 'utf-8');
} else {
  const buildLog = join(process.cwd(), '.next', 'build-log.txt');
  if (existsSync(buildLog)) {
    input = readFileSync(buildLog, 'utf-8');
  }
}

const entries = parseBuildOutput(input);
generateReport(entries);
