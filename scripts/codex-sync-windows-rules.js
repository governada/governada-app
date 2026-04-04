const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const rulesPath = path.join(CODEX_HOME, 'rules', 'default.rules');

const RULES = [
  'prefix_rule(pattern=["C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe", "-Command", "npm run git:stage"], decision="allow")',
  'prefix_rule(pattern=["C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe", "-Command", "npm run git:commit"], decision="allow")',
  'prefix_rule(pattern=["C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe", "-Command", "npm run git:push"], decision="allow")',
  'prefix_rule(pattern=["C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe", "-Command", "npm run health:ready"], decision="allow")',
  'prefix_rule(pattern=["C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe", "-Command", "npm run health:status"], decision="allow")',
  'prefix_rule(pattern=["C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe", "-Command", "npm run health:api"], decision="allow")',
  'prefix_rule(pattern=["C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe", "-Command", "npm run health:reconciliation"], decision="allow")',
  'prefix_rule(pattern=["C:\\\\WINDOWS\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe", "-Command", "npm run codex:sync-windows-rules"], decision="allow")',
];

function main() {
  if (!fs.existsSync(rulesPath)) {
    throw new Error(`Could not find Codex rules file at ${rulesPath}`);
  }

  let contents = fs.readFileSync(rulesPath, 'utf8');
  const added = [];

  for (const rule of RULES) {
    if (contents.includes(rule)) {
      continue;
    }

    contents += `${contents.endsWith('\n') ? '' : '\n'}${rule}\n`;
    added.push(rule);
  }

  if (added.length === 0) {
    console.log(`Codex Windows rules already up to date: ${rulesPath}`);
    return;
  }

  fs.writeFileSync(rulesPath, contents, 'utf8');
  console.log(`Added ${added.length} Codex Windows rule(s) to ${rulesPath}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
