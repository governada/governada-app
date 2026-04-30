function printGuidance() {
  console.error('npm run pr:merge is retired for agent shipping.');
  console.error('');
  console.error('Use the Phase 0B brokered merge lane instead:');
  console.error(
    '  npm run github:merge -- --pr <PR#> --expected-head <40-char-sha> --execute --confirm github.merge --approval-file <approval-file>',
  );
  console.error('');
  console.error('Before requesting approval, run: npm run github:merge-ready -- --pr <PR#>');
  console.error(
    'If the stable-host doctor fails closed in a human-present Codex process without OP_SERVICE_ACCOUNT_TOKEN, run: npm run github:merge-ready:legacy -- --pr <PR#>',
  );
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printGuidance();
  process.exit(0);
}

printGuidance();
process.exit(1);
