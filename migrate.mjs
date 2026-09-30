import postgres from 'postgres';
import { readFileSync } from 'node:fs';
if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL first.'); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
console.log('Schema applied.');
await sql.end();
