/* =========================================================================
   PRODUCTION ($0 launch): free Google research + TradingView futures & charts.
   Appended after the experience; these function declarations wrap the originals
   (renamed *Claude by tools/build_experience.py). If ANTHROPIC_API_KEY is set,
   Market Files AI (Claude) is used; otherwise research runs on Google.
   ========================================================================= */
function aiOn(){return !!(window.MF_CONFIG&&MF_CONFIG.ai)}
/* ---------- TradingView widgets (free; TradingView handles market-data licensing) ---------- */
function mountTV(kind,el,cfg){if(!el)return;el.innerHTML='';const w=document.createElement('div');w.className='tradingview-widget-container';w.style.height='100%';
  const inner=document.createElement('div');inner.className='tradingview-widget-container__widget';inner.style.height='100%';w.appendChild(inner);
  const s=document.createElement('script');s.src=`https://s3.tradingview.com/external-embedding/embed-widget-${kind}.js`;s.async=true;
  s.textContent=JSON.stringify({locale:'en',isTransparent:true,colorTheme:document.documentElement.dataset.theme==='light'?'light':'dark',...cfg});w.appendChild(s);el.appendChild(w)}
function tvFutTabs(){return FUGROUPS.map(g=>({title:g.name,symbols:INSTR.filter(q=>q.fut&&q.fg===g.id&&TV[q.id]).map(q=>({s:TV[q.id],d:q.name}))})).filter(t=>t.symbols.length)}
function tvFuturesBlock(big){return `<section class="pnl tvw-p" data-holo><div class="pnl-h"><h3>Futures · prices &amp; charts</h3><span class="sess mono">Delayed data by TradingView · click any contract for its chart</span></div><div class="tvw ${big?'tvw-lg':''}" id="${big?'tv-fut-page':'tv-fut'}"></div></section>`}
function mountTVFutures(){$$('#tv-fut,#tv-fut-page').forEach(el=>{if(el.childElementCount)return;mountTV('market-overview',el,{dateRange:'1D',showChart:true,width:'100%',height:'100%',showSymbolLogo:false,showFloatingTooltip:true,plotLineColorGrowing:'rgba(47,191,119,1)',plotLineColorFalling:'rgba(229,83,75,1)',tabs:tvFutTabs()})})}
function mountTVSymbol(el,q){mountTV('symbol-overview',el,{symbols:[[q.name,(TV[q.id]||'AMEX:'+q.id)+'|1D']],chartOnly:false,width:'100%',height:'100%',autosize:true,showVolume:false,chartType:'area',lineWidth:2,scaleMode:'Normal',fontSize:'10',valuesTracking:'1',changeMode:'price-and-percent',dateRanges:['1d|1','1m|30','3m|60','12m|1D','60m|1W','all|1M']})}

/* ---------- Research: Claude when configured, otherwise free Google ---------- */
let GCSE_P=null,GCSE_N=0;
function loadCSE(){if(GCSE_P)return GCSE_P;GCSE_P=new Promise(res=>{window.__gcse={parsetags:'explicit',callback:()=>res(true)};const s=document.createElement('script');s.src='https://cse.google.com/cse.js?cx='+encodeURIComponent(MF_CONFIG.google);s.async=true;s.onerror=()=>res(false);document.head.appendChild(s);setTimeout(()=>res(!!(window.google&&google.search&&google.search.cse)),8000)});return GCSE_P}
const gLink=q=>`<a class="btn btn-p" href="https://www.google.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">Search Google for “${esc(q)}” ↗</a>`;
async function googleResearch(q){const th=$('#air-thread');if(!th||!q)return;const box=$('#air');if(box)box.hidden=false;
  if(!MF_CONFIG.google){th.innerHTML=gLink(q);return}
  const id='gcse-'+(++GCSE_N);th.innerHTML=`<div id="${id}" class="gcse-box"></div>`;const ok=await loadCSE();
  if(!ok){th.innerHTML=gLink(q);return}
  try{const el=google.search.cse.element;el.render({div:id,tag:'searchresults-only',gname:id});el.getElement(id).execute(q)}catch(e){th.innerHTML=gLink(q)}}
function aiPanel(){if(aiOn())return aiPanelClaude();
  return `<section class="air" id="air" data-holo><div class="air-h"><img src="${LOGO72}" alt="" width="28" height="28"><div><b>Research the web</b><span class="mono dim">${MF_CONFIG.google?'Google results, inside Market Files':'Opens Google in a new tab'}</span></div></div>
  <div class="air-thread" id="air-thread"></div><form class="air-f" id="air-f" hidden><input id="air-i"></form><div id="air-off" hidden></div><button id="air-stop" hidden></button></section>`}
async function askAI(q){return aiOn()?askAIClaude(q):googleResearch(q)}
function wireAIPanel(q,auto){if(aiOn())return wireAIPanelClaude(q,auto);const a=$('#air');if(!q){if(a)a.hidden=true;return}googleResearch(q)}
async function gpAsk(focus,free){if(aiOn())return gpAskClaude(focus,free);const label=($('#gp')||{dataset:{}}).dataset.label||'';location.hash=aiHref(free?`${label} ${free}`:`${label} ${focus} history`)}
