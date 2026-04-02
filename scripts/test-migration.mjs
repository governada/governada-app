const args = process.argv.slice(2);
const cleanup = args.includes('--cleanup');

console.log('=== Supabase Migration Safety Test ===');
console.log('');
console.log('This script is a reference for the agent migration workflow.');
console.log('Agents should use Supabase MCP tools directly.');
console.log('');
console.log('Procedure:');
console.log("  1. Create a Supabase branch: create_branch(name: 'migration-test-<name>')");
console.log('  2. Apply migration on branch: apply_migration(name, query)');
console.log("  3. Validate: execute_sql('SELECT 1') on branch");
console.log('  4. Delete branch: delete_branch(branch_id)');
console.log('  5. If passed, apply to production: apply_migration(name, query)');
console.log('');

if (cleanup) {
  console.log('Cleanup mode requested: remove the temporary branch once validation is complete.');
  console.log('');
}

console.log('Rollback SQL should be generated for every migration:');
console.log('  - For CREATE TABLE: DROP TABLE IF EXISTS <table>');
console.log('  - For ALTER TABLE ADD COLUMN: ALTER TABLE DROP COLUMN <col>');
console.log('  - For CREATE INDEX: DROP INDEX IF EXISTS <index>');
console.log('  - Store rollback SQL in: migrations/rollback/<migration_name>.sql');
