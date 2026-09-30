// Loads the Market Time Machine inventory (content/events.json) into Postgres. Safe to re-run.
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL first.'); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const events = JSON.parse(readFileSync(new URL('../content/events.json', import.meta.url), 'utf8'));
let n = 0;
for (const e of events) {
  await sql`insert into tm_events (id, date, month, desk, head, status, link)
    values (${e.id}, ${e.date}, ${+e.date.slice(5, 7)}, ${e.desk}, ${e.head}, ${e.status}, ${e.link || ''})
    on conflict (id) do nothing`;
  n++;
}
console.log(`Seeded ${n} events.`);
await sql.end();
