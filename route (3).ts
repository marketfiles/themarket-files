import Anthropic from '@anthropic-ai/sdk';
import { AI_SYSTEM, TOOLS, runTool } from '@/lib/ai';
import { rateLimit, clientIp } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Turn = { role: 'user' | 'assistant'; content: string };

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return new Response('Market Files AI is not configured.', { status: 503 });
  const limit = Number(process.env.AI_RATE_LIMIT || 20);
  // Deep research counts as three requests toward the visitor's limit.
  if (!rateLimit(`ai:${clientIp(req.headers)}`, limit, 10 * 60_000)) return new Response('Too many requests', { status: 429 });

  let body: { messages?: Turn[]; mode?: string; tier?: string };
  try { body = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const turns = (body.messages || []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-12);
  const total = turns.reduce((n, m) => n + m.content.length, 0);
  if (!turns.length || turns[turns.length - 1].role !== 'user' || total > 60_000) return new Response('Bad request', { status: 400 });

  const json = body.mode === 'json';
  const deep = body.tier === 'complex';
  const model = body.tier === 'quick' ? process.env.ANTHROPIC_MODEL_QUICK || 'claude-haiku-4-5-20251001' : deep ? process.env.ANTHROPIC_MODEL_DEEP || 'claude-opus-5-5' : process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
  const system = AI_SYSTEM + (json ? '\n\nThis request is for structured data: reply with only the JSON requested — no prose, no code fences.' : '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any[] = json ? [] : [...TOOLS];
  if (!json && process.env.AI_WEB_SEARCH !== 'false') tools.push({ type: 'web_search_20250305', name: 'web_search', max_uses: Number(process.env.AI_WEB_SEARCH_MAX_USES || 3) * (deep ? 2 : 1) });

  const client = new Anthropic();
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let messages: any[] = turns.map((t) => ({ role: t.role, content: t.content }));
      let emitted = false, needSep = false;
      try {
        for (let round = 0; round < 6; round++) {
          const s = client.messages.stream({ model, max_tokens: json ? 1500 : deep ? 4000 : 2000, system, messages, ...(tools.length ? { tools } : {}) }, { signal: req.signal });
          s.on('text', (t: string) => {
            if (needSep && emitted) { controller.enqueue(enc.encode('\n\n')); needSep = false; }
            controller.enqueue(enc.encode(t)); emitted = true;
          });
          const msg = await s.finalMessage();
          if (msg.stop_reason === 'tool_use') {
            const uses = msg.content.filter((b) => b.type === 'tool_use') as { id: string; name: string; input: Record<string, unknown> }[];
            const results = await Promise.all(uses.map(async (u) => {
              try { return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(await runTool(u.name, u.input || {})).slice(0, 30_000) }; }
              catch (e) { return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: (e as Error).message }; }
            }));
            messages = [...messages, { role: 'assistant', content: msg.content }, { role: 'user', content: results }];
            needSep = true; continue;
          }
          if (msg.stop_reason === 'pause_turn') { messages = [...messages, { role: 'assistant', content: msg.content }]; continue; }
          break;
        }
      } catch (e) {
        if (!req.signal.aborted) { console.error('[ai]', (e as Error).message); controller.enqueue(enc.encode('\u0000ERR')); }
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' } });
}
