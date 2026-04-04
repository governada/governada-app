function printLine(line = '') {
  console.log(line);
}

function main() {
  printLine('=== Supabase Migration Safety Test ===');
  printLine();
  printLine('This script is a reference for the agent migration workflow.');
  printLine('Agents should use Supabase MCP tools directly.');
  printLine();
  printLine('Procedure:');
  printLine("  1. Create a Supabase branch: create_branch(name: 'migration-test-<name>')");
  printLine('  2. Apply migration on branch: apply_migration(name, query)');
  printLine("  3. Validate: execute_sql('SELECT 1') on branch");
  printLine('  4. Delete branch: delete_branch(branch_id)');
  printLine('  5. If passed, apply to production: apply_migration(name, query)');
  printLine();
  printLine('Rollback SQL should be generated for every migration:');
  printLine('  - For CREATE TABLE: DROP TABLE IF EXISTS <table>');
  printLine('  - For ALTER TABLE ADD COLUMN: ALTER TABLE DROP COLUMN <col>');
  printLine('  - For CREATE INDEX: DROP INDEX IF EXISTS <index>');
  printLine('  - Store rollback SQL in: migrations/rollback/<migration_name>.sql');
}

if (require.main === module) {
  main();
}
