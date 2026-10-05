import fs from 'node:fs';

const file = process.argv[2] || '.dev.vars';
if (!fs.existsSync(file)) {
  console.error(`Provider configuration file not found: ${file}`);
  process.exit(1);
}

const values = new Map();
const required = [
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_ID',
  'STRIPE_WEBHOOK_SECRET',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
  'PUBLIC_BASE_URL',
];
for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
  if (!match) continue;
  const [, name, value] = match;
  if (required.includes(name)) {
    values.set(name, [...(values.get(name) || []), value]);
  }
}

let failed = false;
for (const [name, entries] of values) {
  if (entries.length > 1) {
    console.error(`${name}: duplicate entries (${entries.length}); keep exactly one.`);
    failed = true;
  }
  if (entries.some((value) => !value.trim())) {
    console.error(`${name}: empty value.`);
    failed = true;
  }
}

for (const name of required) {
  if (!values.has(name)) {
    console.error(`${name}: missing.`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`Provider configuration shape is valid: ${file}`);
