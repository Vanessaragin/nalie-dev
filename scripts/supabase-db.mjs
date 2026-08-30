import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const mode = process.argv[2];
const connectionMode = process.argv[3] ?? 'configured';
if (!['dry-run', 'apply'].includes(mode)) {
  process.stderr.write('Use: node scripts/supabase-db.mjs dry-run|apply\n');
  process.exit(2);
}

const envText = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const databaseLine = envText
  .split(/\r?\n/)
  .find((line) => line.startsWith('DATABASE_URL='));
let databaseUrl = databaseLine?.slice('DATABASE_URL='.length).trim() ?? '';
if (
  (databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
  (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))
) {
  databaseUrl = databaseUrl.slice(1, -1);
}
if (!databaseUrl || !databaseUrl.startsWith('postgres')) {
  process.stderr.write('DATABASE_URL não está configurada corretamente.\n');
  process.exit(1);
}
if (connectionMode === 'direct') {
  const configured = new URL(databaseUrl);
  const projectRef = configured.username.replace(/^postgres\./, '');
  configured.hostname = `db.${projectRef}.supabase.co`;
  configured.username = 'postgres';
  configured.port = '5432';
  databaseUrl = configured.toString();
}

const args = [
  '--yes',
  'supabase',
  'db',
  'push',
  '--db-url',
  databaseUrl,
  '--include-all',
];
if (mode === 'dry-run') args.push('--dry-run');

const result = spawnSync('npx', args, {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
  env: process.env,
});
process.exit(result.status ?? 1);
