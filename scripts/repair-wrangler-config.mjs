import { readFile, writeFile } from 'node:fs/promises';

const path = 'dist/server/wrangler.json';
const config = JSON.parse(await readFile(path, 'utf8'));
let changed = false;
for (const binding of config.d1_databases || []) {
  if (binding.migrations_dir === '../../migrations') {
    binding.migrations_dir = '../../drizzle';
    changed = true;
  }
}
if (changed) await writeFile(path, `${JSON.stringify(config)}\n`);
