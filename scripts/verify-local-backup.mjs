import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const source = process.argv[2] || path.join(root, 'backups', 'relay-local.sqlite');
const restore = process.argv[3] || path.join(root, 'backups', 'restore-drill', 'relay-restored.sqlite');

if (!fs.existsSync(source)) throw new Error(`Backup not found: ${source}`);
fs.mkdirSync(path.dirname(restore), { recursive: true });
fs.copyFileSync(source, restore);

const db = new DatabaseSync(restore, { readOnly: true });
const integrity = db.prepare('PRAGMA integrity_check').get();
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
db.close();

if (integrity.integrity_check !== 'ok') throw new Error(`Backup integrity check failed: ${integrity.integrity_check}`);
if (!tables.some((table) => table.name === 'workspaces')) throw new Error('Backup is missing the workspaces table.');

console.log(JSON.stringify({ source, restore, integrity: integrity.integrity_check, tableCount: tables.length }, null, 2));
