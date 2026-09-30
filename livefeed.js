/* Live market data: polls /api/quotes (server-side providers, delayed). Instruments without a
   provider show "—" rather than a made-up number. Falls back to the simulated board when
   MF_CONFIG.market !== 'live' (local development without API keys). */
const LiveFeed=(()=>{const subs=new Set();let started=false;
  const relabel=q=>{$$(`[data-id="${q.id}"] .kt-n`).forEach(el=>el.textContent=q.name);$$(`[data-id="${q.id}"] .n`).forEach(el=>{const t=[...el.childNodes].find(n=>n.nodeType===3);if(t)t.textContent=q.name})};
  async function poll(){try{const r=await fetch('/api/quotes',{cache:'no-store'});if(!r.ok)return;const j=await r.json();
    (j.quotes||[]).forEach(u=>{const q=INSTR.find(x=>x.id===u.id);if(!q||!isFinite(u.v))return;const first=!q._live,old=q.v;
      q._live=true;q.na=false;q.v=u.v;q.prev=isFinite(u.prev)?u.prev:u.v;q.src=u.source;if(u.label)q.name=u.label;if(isFinite(u.mc))q.mc=u.mc;
      if(first){q.series=[q.prev,q.v];if(q.intra)q.intra=[q.prev,q.v]}else{q.series.push(q.v);if(q.series.length>120)q.series.shift();if(q.intra){q.intra.push(q.v);if(q.intra.length>79)q.intra.shift()}}
      if(first&&u.label)relabel(q);q.dir=q.v>=old?1:-1;subs.forEach(f=>f(q))});
    const s=$('#tk-src');if(s)s.textContent='LIVE · DELAYED'}catch(e){}}
  return{name:'LIVE · DELAYED',live:true,quotes:INSTR,subscribe(f){subs.add(f)},start(){if(started)return;started=true;poll();setInterval(poll,20000)}}})();
const Feed=(window.MF_CONFIG&&MF_CONFIG.market==='live')?LiveFeed:SimulatedFeed;
if(Feed.live)INSTR.forEach(q=>{q.na=true});
