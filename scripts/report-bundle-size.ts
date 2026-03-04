/**
 * Report Next.js bundle sizes from the build output.
 * Reads .next/BUILD_ID and .next/build-manifest.json to compute page sizes.
 * Outputs a markdown summary suitable for GitHub Actions step summaries.
 */

import * as fs from 'fs';
import * as path from 'path';

const nextDir = path.join(__dirname, '..', '.next');

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileSize(filePath: string): number {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return 0;
  }
}

function main() {
  if (!fs.existsSync(nextDir)) {
    console.error('.next directory not found — run `npm run build` first');
    process.exit(1);
  }

  const staticDir = path.join(nextDir, 'static');
  let totalSize = 0;
  const chunks: { name: string; size: number }[] = [];

  if (fs.existsSync(staticDir)) {
    const walkDir = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(full);
        } else if (entry.name.endsWith('.js')) {
          const size = getFileSize(full);
          totalSize += size;
          chunks.push({ name: path.relative(staticDir, full), size });
        }
      }
    };
    walkDir(staticDir);
  }

  chunks.sort((a, b) => b.size - a.size);
  const top10 = chunks.slice(0, 10);

  const lines: string[] = [];
  lines.push('## Bundle Size Report');
  lines.push('');
  lines.push(`**Total JS:** ${formatBytes(totalSize)}`);
  lines.push('');
  lines.push('| Chunk | Size |');
  lines.push('|-------|------|');
  for (const c of top10) {
    lines.push(`| \`${c.name}\` | ${formatBytes(c.size)} |`);
  }
  if (chunks.length > 10) {
    lines.push(`| ... ${chunks.length - 10} more chunks | |`);
  }

  const output = lines.join('\n');
  console.log(output);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, output + '\n');
  }

  const baselineFile = path.join(__dirname, '..', '.bundle-baseline.json');
  const currentBaseline = {
    totalSize,
    timestamp: new Date().toISOString(),
    chunkCount: chunks.length,
  };

  if (fs.existsSync(baselineFile)) {
    const prev = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
    const prevTotal = prev.totalSize as number;
    const delta = totalSize - prevTotal;
    const pctChange = ((delta / prevTotal) * 100).toFixed(1);
    const status = delta > prevTotal * 0.1 ? 'REGRESSION' : delta < 0 ? 'IMPROVED' : 'OK';

    const regressionLine = `\n**Bundle delta:** ${formatBytes(delta)} (${pctChange}%) — ${status}`;
    console.log(regressionLine);
    if (summaryPath) fs.appendFileSync(summaryPath, regressionLine + '\n');

    if (status === 'REGRESSION') {
      console.error(`Bundle size regression: ${pctChange}% increase exceeds 10% threshold`);
      process.exit(1);
    }
  } else {
    fs.writeFileSync(baselineFile, JSON.stringify(currentBaseline, null, 2));
    console.log(`\nBaseline recorded: ${formatBytes(totalSize)} (${chunks.length} chunks)`);
  }
}

main();
