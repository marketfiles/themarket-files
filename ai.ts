import { searchContent, MONTHS } from './content';
import { listEvents } from './db';
import { getQuotes } from './market/quotes';

export const AI_SYSTEM = `You are Market Files AI, the research desk of Market Files (Markets • Money • History) — a financial library and media company covering Wall Street, global finance, futures, financial history, Bitcoin and blockchain.
You research and answer ANY question about finance and economics at ANY level — from a beginner's first question to professional and academic depth: markets and asset classes, price histories as far back as records go, companies and industries, the economic history of any country, state or city, central banks and monetary systems, fiscal policy and sovereign debt, derivatives and futures, quantitative methods, valuation, risk, accounting, regulation, market microstructure, crises, and crypto and blockchain.
Rules:
- Use search_archive whenever Market Files may have a record, and cite records inline with their id exactly as returned, e.g. [MF-1929-1029] or [day:2008-09-15].
- Use get_quote for the current board; it returns delayed data with its source — name the source and time when you use it.
- If web search is available, use it for anything recent, time-sensitive or data-heavy, and name the outlet or dataset and date you relied on.
- Give real numbers, dates and named sources; show formulas or worked examples when they help. Separate fact from estimate; say when something is uncertain. Never invent sources, quotes or data.
- Educational only: no personalized buy/sell recommendations.
- If a question has no financial or economic angle, say in one sentence that Market Files AI covers finance, markets and economic history.
Format: open with a direct 1–3 sentence answer, then structured sections ("### " headings, "- " bullets, **bold**) as the question requires. Follow any "Mode:" instruction in the reader's message for length.`;

export const TOOLS = [
  { name: 'search_archive', description: 'Search the Market Files archive of files and dated Market Time Machine events. Returns up to 8 records: id, title, date, desk, status, summary.', input_schema: { type: 'object' as const, properties: { query: { type: 'string', description: 'keywords, e.g. "Panic of 1907" or "Federal Reserve"' } }, required: ['query'] } },
  { name: 'events_on_date', description: 'List Market Files events on a calendar date (every year) or on an exact day when year is given.', input_schema: { type: 'object' as const, properties: { month: { type: 'integer' }, day: { type: 'integer' }, year: { type: 'integer' } }, required: ['month', 'day'] } },
  { name: 'get_quote', description: 'Latest delayed value on the Market Files board for a board id or name (SPX, US10Y, EURUSD, BTC, "gold"…). Returns value, previous close, source and time.', input_schema: { type: 'object' as const, properties: { symbol: { type: 'string' } }, required: ['symbol'] } },
];

export async function runTool(name: string, input: Record<string, unknown>) {
  if (name === 'search_archive') return searchContent(String(input.query || ''), await listEvents());
  if (name === 'events_on_date') {
    const m = Number(input.month), d = Number(input.day), y = Number(input.year) || 0;
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) throw new Error('month 1–12 and day 1–31 required');
    const events = (await listEvents()).filter((e) => +e.date.slice(5, 7) === m && +e.date.slice(8, 10) === d && (!y || +e.date.slice(0, 4) === y));
    return { date: `${MONTHS[m - 1]} ${d}${y ? ', ' + y : ''}`, events: events.map((e) => ({ id: `day:${e.date}`, date: e.date, title: e.head, status: e.status })) };
  }
  if (name === 'get_quote') {
    const s = String(input.symbol || '').toLowerCase();
    const { quotes } = await getQuotes();
    const q = quotes.find((x) => x.id.toLowerCase() === s || (x.label || '').toLowerCase().includes(s));
    if (!q) throw new Error('No live quote for that symbol on the board');
    return { id: q.id, label: q.label, value: q.v, previous: q.prev, changePct: +(((q.v - q.prev) / q.prev) * 100).toFixed(2), source: q.source, asOf: q.asOf };
  }
  throw new Error('Unknown tool');
}
