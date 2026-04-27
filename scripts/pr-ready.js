function printGuidance() {
  console.error('npm run pr:ready is retired for agent shipping.');
  console.error('');
  console.error('Use the Phase 0B brokered PR-write lane instead:');
  console.error(
    '  npm run github:pr-write -- ready --pr <PR#> --execute --confirm github.write.pr',
  );
}

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  printGuidance();
  process.exit(0);
}

printGuidance();
process.exit(1);
