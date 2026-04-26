const fs = require('node:fs');
const path = require('node:path');

const {
  outputPath: registryIndexPath,
  renderContent,
  stripFooter,
} = require('./generate-registry-index.js');
const { repoRoot, runCommand } = require('./lib/runtime');

const manifestPath = path.join(repoRoot, 'docs', 'strategy', 'context', 'build-manifest.md');
const visionPath = path.join(repoRoot, 'docs', 'strategy', 'ultimate-vision.md');

function listFilesRecursive(root, predicate) {
  const output = [];

  function walk(current) {
    if (!fs.existsSync(current)) {
      return;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (predicate(fullPath, entry.name)) {
        output.push(fullPath);
      }
    }
  }

  walk(root);
  return output;
}

function extractCountByPattern(filePath, pattern) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(pattern);
    if (match) {
      return Number.parseInt(match[1], 10);
    }
  }

  return null;
}

function record(results, ok, label, detail) {
  results.push({ ok, label, detail });
}

function compareMinimumCount(results, filePath, pattern, actualCount, label) {
  const expectedMinimum = extractCountByPattern(filePath, pattern);
  if (expectedMinimum == null) {
    record(results, false, label, 'Could not find documented count marker');
    return;
  }

  if (actualCount >= expectedMinimum) {
    record(results, true, label, `Document says ${expectedMinimum}+; actual is ${actualCount}`);
  } else {
    record(results, false, label, `Document says ${expectedMinimum}+; actual is ${actualCount}`);
  }
}

function compareExactCount(results, filePath, pattern, actualCount, label) {
  const expected = extractCountByPattern(filePath, pattern);
  if (expected == null) {
    record(results, false, label, 'Could not find documented count marker');
    return;
  }

  if (actualCount === expected) {
    record(results, true, label, `Document says ${expected}; actual is ${actualCount}`);
  } else {
    record(results, false, label, `Document says ${expected}; actual is ${actualCount}`);
  }
}

function checkManifestFreshness(results) {
  if (!fs.existsSync(manifestPath) || !fs.existsSync(visionPath)) {
    record(
      results,
      false,
      'Manifest freshness',
      'build-manifest.md or ultimate-vision.md is missing',
    );
    return;
  }

  const gitFreshness = getGitFreshness(manifestPath, visionPath);
  const manifestMtime = gitFreshness?.manifestTime ?? fs.statSync(manifestPath).mtimeMs;
  const visionMtime = gitFreshness?.visionTime ?? fs.statSync(visionPath).mtimeMs;
  if (manifestMtime >= visionMtime) {
    record(
      results,
      true,
      'Manifest freshness',
      gitFreshness
        ? 'build-manifest.md is up to date with ultimate-vision.md by Git history'
        : 'build-manifest.md is up to date with ultimate-vision.md',
    );
  } else {
    record(
      results,
      false,
      'Manifest freshness',
      'build-manifest.md is older than ultimate-vision.md',
    );
  }
}

function getGitFreshness(manifest, vision) {
  const relativeManifest = path.relative(repoRoot, manifest);
  const relativeVision = path.relative(repoRoot, vision);
  const dirty = runCommand(
    'git',
    ['status', '--porcelain', '--', relativeManifest, relativeVision],
    {
      cwd: repoRoot,
    },
  );

  if (dirty.status !== 0 || dirty.stdout.trim()) {
    return null;
  }

  const manifestTime = getGitFileTimestamp(relativeManifest);
  const visionTime = getGitFileTimestamp(relativeVision);
  if (manifestTime == null || visionTime == null) {
    return null;
  }

  return { manifestTime, visionTime };
}

function getGitFileTimestamp(relativePath) {
  const result = runCommand('git', ['log', '-1', '--format=%ct', '--', relativePath], {
    cwd: repoRoot,
  });
  const timestamp = Number.parseInt(result.stdout.trim(), 10);
  return result.status === 0 && Number.isFinite(timestamp) ? timestamp * 1000 : null;
}

function checkRegistryIndex(results) {
  if (!fs.existsSync(registryIndexPath)) {
    record(results, false, 'Registry index', 'registry index file is missing');
    return;
  }

  const current = fs.readFileSync(registryIndexPath, 'utf8');
  const rendered = renderContent();
  if (stripFooter(current) === stripFooter(rendered)) {
    record(results, true, 'Registry index', 'registry index is in sync');
  } else {
    record(results, false, 'Registry index', 'registry index is stale');
  }
}

function main() {
  const results = [];

  const inngestFunctionCount = listFilesRecursive(
    path.join(repoRoot, 'inngest', 'functions'),
    (fullPath, name) => name.endsWith('.ts'),
  ).length;
  compareExactCount(
    results,
    manifestPath,
    /- \[x\] (\d+) Inngest sync functions \|/,
    inngestFunctionCount,
    'Manifest Inngest function count',
  );

  const apiV1RouteCount = listFilesRecursive(
    path.join(repoRoot, 'app', 'api', 'v1'),
    (fullPath, name) => name === 'route.ts',
  ).length;
  compareExactCount(
    results,
    manifestPath,
    /- \[x\] (\d+) public routes at `\/api\/v1\/`/,
    apiV1RouteCount,
    'Manifest public API v1 route count',
  );

  const treasuryRouteCount = listFilesRecursive(
    path.join(repoRoot, 'app', 'api', 'treasury'),
    (fullPath, name) => name === 'route.ts',
  ).length;
  compareExactCount(
    results,
    manifestPath,
    /Treasury intelligence \| `\/api\/treasury\/\*` \((\d+) routes\)/,
    treasuryRouteCount,
    'Manifest treasury route count',
  );

  checkManifestFreshness(results);
  checkRegistryIndex(results);

  console.log('=== Docs Doctor ===');
  console.log('');
  for (const result of results) {
    console.log(`[${result.ok ? 'OK' : 'WARN'}] ${result.label}: ${result.detail}`);
  }

  const warningCount = results.filter((result) => !result.ok).length;
  console.log('');
  if (warningCount > 0) {
    console.log(`${warningCount} issue(s) found.`);
    console.log('Fix docs drift before treating workspace docs as authoritative.');
    process.exit(1);
  }

  console.log('No documentation drift detected.');
}

if (require.main === module) {
  main();
}
