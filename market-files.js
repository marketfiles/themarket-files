/* Market Files production runtime — provides the same capability interface the experience was
   designed against (sample / db / user), backed by the Market Files API routes. */
(function(){
  const CFG=window.MF_CONFIG||{};
  window.MF_TV=CFG.tradingview!==false;
  const err=(code,message,text)=>Object.assign(new Error(message||code),{code,text});
  async function sample(input,opts={}){
    const messages=(typeof input==='string'?[{role:'user',content:input}]:input).map(m=>({role:m.role,content:String(m.content)}));
    let res;try{res=await fetch('/api/ai',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages,mode:opts.mode||'research',tier:opts.modelTier||'default'}),signal:opts.signal})}
    catch(e){throw err(e&&e.name==='AbortError'?'cancelled':'unavailable',String(e))}
    if(res.status===429)throw err('rate_limited','Too many requests');if(!res.ok||!res.body)throw err('unavailable',await res.text().catch(()=>''));
    const rd=res.body.getReader(),dec=new TextDecoder();let text='';
    try{for(;;){const {done,value}=await rd.read();if(done)break;const delta=dec.decode(value,{stream:true});text+=delta;opts.onText&&opts.onText({text,delta})}}
    catch(e){throw err(e&&e.name==='AbortError'?'cancelled':'unavailable',String(e),text)}
    if(text.includes('\u0000ERR'))throw err('unavailable','AI error',text.split('\u0000ERR')[0]);
    return{text,truncated:false}}
  sample.json=async(input,opts={})=>{const r=await sample(input,{...opts,mode:'json'});const t=r.text.replace(/```json|```/g,'').trim();const i=t.search(/[\[{]/);return JSON.parse(i>0?t.slice(i):t)};
  function db(){const listeners=new Set();
    async function load(l){try{const r=await fetch('/api/tm',{cache:'no-store'});if(!r.ok)throw err('unavailable','load failed');const j=await r.json();
      const docs=(j.docs||[]).map(d=>({id:d.id,exists:true,data:()=>d.data,metadata:{fromCache:false,hasPendingWrites:false}}));
      (l?[l]:[...listeners]).forEach(x=>x.next({docs,size:docs.length,empty:!docs.length,metadata:{fromCache:false,hasPendingWrites:false},docChanges:()=>[]}))}
      catch(e){(l?[l]:[...listeners]).forEach(x=>x.error&&x.error({code:'unavailable',message:String(e)}))}}
    setInterval(()=>listeners.size&&load(),60000);
    return{collection:()=>({onSnapshot(next,error){const l={next,error};listeners.add(l);load(l);return()=>listeners.delete(l)},
      doc:id=>({id,async get(){const r=await fetch('/api/tm/'+encodeURIComponent(id),{cache:'no-store'});const j=await r.json().catch(()=>({}));return{id,exists:!!j.data,data:()=>j.data,metadata:{fromCache:false,hasPendingWrites:false}}},
        async set(data){const r=await fetch('/api/tm/'+encodeURIComponent(id),{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(data)});if(!r.ok)throw err(r.status===401||r.status===403?'invalid_argument':'unavailable','write failed');load()}})})}}
  let DBI=null,MEP=null;
  window.claude={use:async name=>{
    if(name==='sample')return CFG.ai?sample:null;
    if(name==='db')return DBI||(DBI=db());
    if(name==='user'){MEP=MEP||fetch('/api/me',{cache:'no-store'}).then(r=>r.json()).catch(()=>({}));const me=await MEP;const ed=!!me.editor;return{isOwner:()=>ed,canEdit:()=>ed,can:()=>ed,id:async()=>null,me:async()=>({id:null})}}
    return null}};
})();

/* =========================================================================
   MARKET FILES — preview build
   Structure: config → content models & sample data → market data layer →
   plates (illustrative imagery) → components → pages → router.
   ========================================================================= */
const LOGO72='/logo-72.png';
const LOGO240='/logo-240.png';
const SITE_URL=(window.MF_CONFIG&&MF_CONFIG.siteUrl)||location.origin;
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
function rng(seed){let s=(seed>>>0)||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296}}
function hash(str){let h=2166136261;for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}

/* ---------- desks (one newsroom, six accounts) ---------- */
const DESKS={
  hub:{name:'Market Files',handle:'TheMarketFiles',hex:'#E9EDF2'},
  wallst:{name:'Wall Street',handle:'NowOnWallSt',hex:'#2FBF77',route:'wall-street',blurb:'Current Wall Street and U.S. market reporting.'},
  then:{name:'Then on Wall Street',handle:'ThenOnWallSt',hex:'#C9A55C',route:'history',blurb:'Wall Street and American financial history.'},
  global:{name:'Global Finance',handle:'OnGlobalFinance',hex:'#4C8DFF',route:'global-finance',blurb:'Central banks, currencies, sovereign debt and the crises that crossed borders.'},
  btc:{name:'Bitcoin',handle:'NowOnBTC',hex:'#F2A03D',route:'bitcoin',blurb:'Bitcoin news, history, monetary design and market structure.'},
  chain:{name:'On-Chain',handle:'NowOnChain',hex:'#8E7CF7',route:'blockchain',blurb:'Protocols, infrastructure, digital assets and DeFi.'}
};
const xUrl=h=>`https://x.com/${h}`;
Object.values(DESKS).forEach(d=>{const f=(window.MF_CONFIG&&MF_CONFIG.pfps||{})[d.handle];if(f)d.pfp=f});
const handleLink=d=>`<a class="handle" style="--dc:${d.hex}" href="${xUrl(d.handle)}" target="_blank" rel="noopener">@${d.handle}</a>`;

const ERAS=[
  {id:'1600',label:'1600–1799',from:1600,to:1799},{id:'1800',label:'1800–1899',from:1800,to:1899},
  {id:'1900',label:'1900–1949',from:1900,to:1949},{id:'1950',label:'1950–1999',from:1950,to:1999},
  {id:'2000',label:'2000–2009',from:2000,to:2009},{id:'2010',label:'2010–2019',from:2010,to:2019},
  {id:'2020',label:'2020–Present',from:2020,to:2100}];
const eraOf=y=>ERAS.find(e=>y>=e.from&&y<=e.to)?.id;

/* ---------- content models (mirror the CMS schema) ----------
   Article { slug, desk, cat, type:'hist'|'live', date, prec, loc, head, deck, plate, alt,
             body:[[heading,text]], keyDates, inst, people, assets, countries, crisis,
             sources:[SourceRecord], img:{status,note}, research, flag, sym, ago }
   SourceRecord { claim, source, doc, date, evidence, conf, rights }
   Status: 'review' = in editorial review · 'verified' · 'pending' · 'sample' */
const S=(claim,source,doc,date,evidence,conf,rights)=>({claim,source,doc,date,evidence,conf,rights});
const PLACEHOLDER='Illustrative placeholder. Event-specific archival image pending provenance and rights review.';

const A=[
/* ---- Then on Wall Street ---- */
{slug:'nyse-reopens-1873',desk:'then',cat:'Market History',type:'hist',date:'1873-09-30',loc:'New York',plate:'exchange',status:'review',
 head:'Wall Street reopens after ten days of financial panic',
 deck:'The New York Stock Exchange returns to trading after one of the most extraordinary shutdowns in American financial history.',
 body:[['What happened','On September 18, 1873, Jay Cooke & Company — the banking house that had sold much of the Union’s Civil War borrowing — suspended payments after it could not sell enough bonds to finance the Northern Pacific Railway. Failures spread through New York’s banks and brokerages. On September 20 the New York Stock Exchange closed. It stayed shut for ten days and reopened on September 30.'],
  ['Why it mattered','The panic opened a long contraction. The National Bureau of Economic Research dates the downturn from October 1873 to March 1879 — 65 months, the longest contraction in its U.S. business-cycle chronology.'],
  ['The mechanism','Railroad construction had been financed with bonds sold to investors at home and abroad. When buyers disappeared, banks that had advanced money against those bonds could not recover it. Under the national banking system, country banks kept reserves on deposit in New York; when they called them home at once, New York banks faced demands for cash they could not meet.']],
 keyDates:[['1873-09-18','Jay Cooke & Company suspends payments'],['1873-09-20','NYSE closes'],['1873-09-30','NYSE reopens'],['1873-10','NBER-dated contraction begins']],
 inst:['New York Stock Exchange','Jay Cooke & Company','Northern Pacific Railway'],people:['Jay Cooke'],assets:['Equities','Railroad bonds'],countries:['United States'],crisis:'Panic of 1873',
 facts:[['Closed','Sep 20, 1873'],['Reopened','Sep 30, 1873'],['Days shut','10'],['Contraction','65 months']],
 sources:[S('NYSE closed Sept. 20 and reopened Sept. 30, 1873','Contemporaneous New York press','Daily coverage, Sept. 20 – Oct. 1, 1873','1873','Newspaper reporting','High','Public domain'),
  S('Jay Cooke & Co. suspended Sept. 18, 1873','Contemporaneous New York press','Financial columns, Sept. 19, 1873','1873','Newspaper reporting','High','Public domain'),
  S('Contraction Oct. 1873 – Mar. 1879, 65 months','National Bureau of Economic Research','U.S. Business Cycle Expansions and Contractions','Current table','Official chronology','High','Cite with attribution')]},
{slug:'buttonwood-agreement-1792',desk:'then',cat:'Market History',type:'hist',date:'1792-05-17',loc:'New York',plate:'ledger',status:'review',
 head:'Twenty-four brokers sign the Buttonwood Agreement',
 deck:'A two-sentence pact set a floor commission and a promise to trade with one another — the seed of the New York Stock Exchange.',
 body:[['What happened','On May 17, 1792, twenty-four New York brokers signed an agreement to give one another preference in trading securities and to charge commissions of no less than one quarter of one percent.'],
  ['Why it mattered','The pact created a self-governing circle of dealers. In 1817 their successors adopted a formal constitution as the New York Stock & Exchange Board, the body later renamed the New York Stock Exchange.'],
  ['The mechanism','The early market’s problems were trust and price. Dealing inside a fixed membership at a fixed floor commission reduced counterparty risk and shut out the auctioneers who had been competing for the same business.']],
 keyDates:[['1792-05-17','Agreement signed'],['1817-03-08','New York Stock & Exchange Board constitution']],
 inst:['New York Stock Exchange'],people:[],assets:['Equities','Government securities'],countries:['United States'],crisis:'',
 sources:[S('24 brokers signed on May 17, 1792','New York Stock Exchange','The Buttonwood Agreement (original document)','1792','Primary document','High','Rights holder to confirm'),
  S('Minimum commission of one quarter of one percent','New York Stock Exchange','The Buttonwood Agreement text','1792','Primary document','High','Rights holder to confirm')]},
{slug:'knickerbocker-run-1907',desk:'then',cat:'Banking Crisis',type:'hist',date:'1907-10-22',loc:'New York',plate:'crowd',status:'review',research:true,
 head:'Depositors run on the Knickerbocker Trust Company',
 deck:'A failed copper speculation exposed New York’s trust companies — and a private banker, not a central bank, organized the rescue.',
 body:[['What happened','In mid-October 1907 a failed attempt to corner the stock of United Copper damaged banks tied to the speculators behind it. On October 22 depositors ran on the Knickerbocker Trust Company, which suspended payments.'],
  ['Why it mattered','With no central bank, J. P. Morgan assembled New York’s bankers to lend to institutions judged solvent. The episode produced the Aldrich–Vreeland Act of 1908 and the National Monetary Commission, and led to the Federal Reserve Act of 1913.'],
  ['The mechanism','Trust companies kept thinner cash reserves than national banks and sat outside the clearinghouse’s system of mutual support. When confidence broke there was no lender of last resort to turn their sound assets into cash quickly.']],
 keyDates:[['1907-10-16','United Copper corner collapses'],['1907-10-22','Run on Knickerbocker Trust'],['1908-05-30','Aldrich–Vreeland Act'],['1913-12-23','Federal Reserve Act']],
 inst:['Knickerbocker Trust Company','J. P. Morgan & Co.','Federal Reserve'],people:['J. P. Morgan'],assets:['Equities','Deposits'],countries:['United States'],crisis:'Panic of 1907',
 sources:[S('Run on Knickerbocker Trust, Oct. 22, 1907','Federal Reserve History','“The Panic of 1907”','—','Authoritative secondary','High','Cite with attribution'),
  S('Panic led to Aldrich–Vreeland Act and Federal Reserve Act','Federal Reserve History','“The Panic of 1907”','—','Authoritative secondary','High','Cite with attribution')]},
{slug:'black-tuesday-1929',desk:'then',cat:'Market Crash',type:'hist',date:'1929-10-29',loc:'New York',plate:'crash',status:'review',research:true,
 head:'Black Tuesday seals the Great Crash of 1929',
 deck:'A second day of historic selling closed the book on the 1920s bull market — and began a three-year fall of nearly 90%.',
 body:[['What happened','The Dow Jones Industrial Average fell about 13% on Monday, October 28, 1929, and about 12% more on Tuesday, October 29, as a then-record volume of roughly 16 million shares changed hands.'],
  ['Why it mattered','The Dow had peaked at 381.17 on September 3, 1929. It did not bottom until July 8, 1932, at 41.22 — a loss of about 89%.'],
  ['The mechanism','Many investors had bought shares on margin, with borrowed money secured by the shares themselves. As prices fell, lenders called loans and brokers sold collateral, turning a decline into compulsory selling that pushed prices lower still.']],
 keyDates:[['1929-09-03','Dow peaks at 381.17'],['1929-10-24','Black Thursday'],['1929-10-28','Dow falls ~13%'],['1929-10-29','Black Tuesday'],['1932-07-08','Dow bottoms at 41.22']],
 inst:['New York Stock Exchange'],people:[],assets:['Equities','Broker loans'],countries:['United States'],crisis:'Crash of 1929',
 sources:[S('Dow peak 381.17 (Sept. 3, 1929) and trough 41.22 (July 8, 1932)','S&P Dow Jones Indices','DJIA historical closes','—','Index data','High','Licensed data'),
  S('Oct. 29 volume of roughly 16 million shares','Federal Reserve History','“Stock Market Crash of 1929”','—','Authoritative secondary','High','Cite with attribution')]},
{slug:'black-monday-1987',desk:'then',cat:'Market Crash',type:'hist',date:'1987-10-19',loc:'New York',plate:'crash',status:'review',
 head:'Black Monday: the Dow falls 22.6% in one session',
 deck:'The largest one-day percentage decline in the Dow’s history exposed how automated hedging could feed on itself.',
 body:[['What happened','On October 19, 1987, the Dow Jones Industrial Average fell 508 points, or 22.6%, to close at 1,738.74.'],
  ['Why it mattered','Before markets opened on October 20, the Federal Reserve announced its readiness to serve as a source of liquidity to the economic and financial system. The crash led to the market-wide circuit breakers adopted in 1988.'],
  ['The mechanism','Portfolio insurance strategies sold stock-index futures as prices fell. Selling in Chicago futures pulled New York prices down through index arbitrage, which triggered more hedging sales in a loop.']],
 keyDates:[['1987-10-19','Dow falls 22.6%'],['1987-10-20','Fed liquidity statement'],['1988-01','Brady Commission report']],
 inst:['New York Stock Exchange','Federal Reserve','Chicago Mercantile Exchange'],people:['Alan Greenspan'],assets:['Equities','Index futures'],countries:['United States'],crisis:'Black Monday',
 sources:[S('Dow fell 508 points (22.6%) on Oct. 19, 1987','Federal Reserve History','“Stock Market Crash of 1987”','—','Authoritative secondary','High','Cite with attribution'),
  S('Portfolio insurance and index arbitrage amplified selling','Presidential Task Force on Market Mechanisms','Brady Commission report','January 1988','Official report','High','Public document')]},
{slug:'nasdaq-peak-2000',desk:'then',cat:'Bubble',type:'hist',date:'2000-03-10',loc:'New York',plate:'tape',status:'review',
 head:'The Nasdaq closes at its dot-com peak: 5,048.62',
 deck:'The index had more than doubled in fifteen months. It would take another fifteen years to see that level again.',
 body:[['What happened','On March 10, 2000, the Nasdaq Composite closed at 5,048.62, more than double its level at the end of 1998.'],
  ['Why it mattered','By October 9, 2002, the index had fallen to 1,114.11, a decline of about 78%. It did not close above its 2000 peak again until April 2015.'],
  ['The mechanism','Valuations rested on expected future growth rather than current earnings. When financing tightened, companies that depended on new equity to fund their losses could no longer raise it, and the expected growth was repriced all at once.']],
 keyDates:[['2000-03-10','Nasdaq closes at 5,048.62'],['2002-10-09','Nasdaq bottoms at 1,114.11'],['2015-04-23','New closing high']],
 inst:['Nasdaq'],people:[],assets:['Equities','Technology stocks'],countries:['United States'],crisis:'Dot-com crash',
 sources:[S('Close of 5,048.62 on March 10, 2000','Nasdaq','Nasdaq Composite historical data','—','Index data','High','Licensed data'),
  S('Trough of 1,114.11 on Oct. 9, 2002','Nasdaq','Nasdaq Composite historical data','—','Index data','High','Licensed data')]},
{slug:'lehman-bankruptcy-2008',desk:'then',cat:'Financial Crisis',type:'hist',date:'2008-09-15',loc:'New York',plate:'vault',status:'review',research:true,
 head:'Lehman Brothers files for Chapter 11',
 deck:'The largest bankruptcy filing in U.S. history turned a mortgage-market crisis into a global run on short-term funding.',
 body:[['What happened','Lehman Brothers Holdings filed for Chapter 11 protection in the U.S. Bankruptcy Court for the Southern District of New York early on September 15, 2008, listing about $639 billion in assets.'],
  ['Why it mattered','The next day the Reserve Primary Fund, which held Lehman debt, fell below $1 a share. Outflows from money-market funds froze the commercial-paper market and carried the shock worldwide.'],
  ['The mechanism','Lehman financed long-term real-estate and securities positions with short-term borrowing, much of it overnight repo. When lenders demanded more collateral or declined to roll funding, the firm could not sell assets fast enough to repay them.']],
 keyDates:[['2008-09-15','Chapter 11 filing'],['2008-09-16','Reserve Primary Fund breaks the buck'],['2008-10-03','EESA signed']],
 inst:['Lehman Brothers','Reserve Primary Fund','Federal Reserve','U.S. Treasury'],people:['Richard Fuld','Henry Paulson'],assets:['Repo','Commercial paper','Mortgage securities'],countries:['United States'],crisis:'Global Financial Crisis',
 sources:[S('Chapter 11 filed Sept. 15, 2008; ~$639bn assets','U.S. Bankruptcy Court, S.D.N.Y.','In re Lehman Brothers Holdings Inc., Case 08-13555','2008-09-15','Court filing','High','Public record'),
  S('Reserve Primary Fund fell below $1 on Sept. 16, 2008','Financial Crisis Inquiry Commission','Final Report, 2011','2011','Official report','High','Public document')]},
{slug:'pandemic-crash-2020',desk:'then',cat:'Market Crash',type:'hist',date:'2020-03-16',loc:'New York',plate:'crash',status:'review',
 head:'The Dow falls nearly 3,000 points as pandemic fear peaks',
 deck:'A market-wide halt within minutes of the open marked the most violent day of the 2020 crash.',
 body:[['What happened','On March 16, 2020, the Dow fell 2,997.10 points, or 12.9% — at the time its largest point decline on record. A market-wide circuit breaker halted trading minutes after the open.'],
  ['Why it mattered','It was one of four market-wide halts that month, on March 9, 12, 16 and 18 — the first since 1997.'],
  ['The mechanism','A Level 1 circuit breaker pauses all U.S. equity trading for 15 minutes when the S&P 500 falls 7% from the prior close before 3:25 p.m., giving participants time to reprice rather than trade into an empty order book.']],
 keyDates:[['2020-03-09','First halt'],['2020-03-12','Second halt'],['2020-03-16','Third halt; Dow −12.9%'],['2020-03-18','Fourth halt']],
 inst:['New York Stock Exchange','Federal Reserve'],people:[],assets:['Equities'],countries:['United States'],crisis:'2020 pandemic crash',
 sources:[S('Dow −2,997.10 (−12.9%) on March 16, 2020','S&P Dow Jones Indices','DJIA historical closes','—','Index data','High','Licensed data'),
  S('Level 1 halt: 7% decline, 15-minute pause','New York Stock Exchange','Market-wide circuit breaker rules','—','Exchange rule','High','Cite with attribution')]},
/* ---- Global Finance ---- */
{slug:'nixon-gold-window-1971',desk:'global',cat:'Monetary System',type:'hist',date:'1971-08-15',loc:'Washington',plate:'gold',status:'review',research:true,
 head:'Nixon closes the gold window',
 deck:'The United States suspended the dollar’s convertibility into gold, ending the core of the Bretton Woods system.',
 body:[['What happened','In a televised address on the evening of Sunday, August 15, 1971, President Richard Nixon announced that the United States would suspend the convertibility of the dollar into gold, together with a 90-day wage and price freeze and a 10% surcharge on imports.'],
  ['Why it mattered','The Smithsonian Agreement of December 1971 tried to rebuild fixed rates, but it did not hold. By 1973 the major currencies were floating.'],
  ['The mechanism','Under Bretton Woods, foreign central banks could exchange dollars for gold at $35 an ounce. As dollars held abroad grew far larger than U.S. gold reserves, the promise could not be honored for everyone at once — and the risk of a run grew with every dollar.']],
 keyDates:[['1944-07','Bretton Woods conference'],['1971-08-15','Gold window closed'],['1971-12-18','Smithsonian Agreement'],['1973-03','Major currencies float']],
 inst:['U.S. Treasury','Federal Reserve','International Monetary Fund'],people:['Richard Nixon','John Connally','Paul Volcker'],assets:['Gold','U.S. dollar'],countries:['United States'],crisis:'End of Bretton Woods',
 sources:[S('Convertibility suspended Aug. 15, 1971','Federal Reserve History','“Nixon Ends Convertibility of US Dollars to Gold and Announces Wage/Price Controls”','—','Authoritative secondary','High','Cite with attribution'),
  S('Wage/price freeze and 10% import surcharge','The American Presidency Project','Address to the Nation, Aug. 15, 1971','1971-08-15','Primary document','High','Public domain')]},
{slug:'plaza-accord-1985',desk:'global',cat:'Currencies',type:'hist',date:'1985-09-22',loc:'New York',plate:'globe',status:'review',
 head:'The Plaza Accord: five nations agree to push the dollar down',
 deck:'Finance ministers met at a Manhattan hotel and told markets they wanted a weaker dollar — and markets listened.',
 body:[['What happened','On September 22, 1985, finance ministers and central bank governors of France, West Germany, Japan, the United Kingdom and the United States met at the Plaza Hotel in New York and agreed that an orderly appreciation of other currencies against the dollar was desirable.'],
  ['Why it mattered','The dollar fell sharply over the following two years. The Louvre Accord of February 1987 then tried to stabilize it.'],
  ['The mechanism','Coordinated intervention — central banks selling dollars together — was paired with a public statement that changed what markets believed officials would tolerate.']],
 keyDates:[['1985-09-22','Plaza Accord'],['1987-02-22','Louvre Accord']],
 inst:['G5','U.S. Treasury','Bank of Japan','Deutsche Bundesbank'],people:['James Baker'],assets:['U.S. dollar','Japanese yen','Deutsche Mark'],countries:['United States','Japan','West Germany','France','United Kingdom'],crisis:'',
 sources:[S('G5 meeting at the Plaza Hotel, Sept. 22, 1985','G5 communiqué','Announcement of the Ministers of Finance and Central Bank Governors','1985-09-22','Primary document','High','Public document'),
  S('Louvre Accord, Feb. 1987','G6 communiqué','Louvre statement','1987-02-22','Primary document','High','Public document')]},
{slug:'black-wednesday-1992',desk:'global',cat:'Currencies',type:'hist',date:'1992-09-16',loc:'London',plate:'tape',status:'review',
 head:'Black Wednesday: sterling leaves the ERM',
 deck:'Two emergency rate increases in a single day could not hold the pound inside Europe’s exchange-rate band.',
 body:[['What happened','On September 16, 1992, the UK government raised its base rate from 10% to 12% and announced a further rise to 15%. That evening it suspended sterling’s membership of the European Exchange Rate Mechanism.'],
  ['Why it mattered','The pound fell sharply and the 15% rate never took effect. Within weeks the government adopted an explicit inflation target, the framework that shaped British monetary policy afterward.'],
  ['The mechanism','The ERM held sterling within a band against the Deutsche Mark. With German rates high after reunification, defending the band required UK rates the domestic economy could not bear — and speculators bet the government would not pay that price.']],
 keyDates:[['1990-10-08','UK joins the ERM'],['1992-09-16','Sterling suspended from the ERM'],['1992-10-08','Inflation target announced']],
 inst:['Bank of England','HM Treasury'],people:['Norman Lamont','John Major'],assets:['British pound','Deutsche Mark'],countries:['United Kingdom','Germany'],crisis:'ERM crisis',
 sources:[S('Rate raised to 12%, 15% announced, ERM exit same day','HM Treasury','Chancellor’s statements, Sept. 16, 1992','1992-09-16','Primary statement','High','Crown copyright'),
  S('Inflation target adopted Oct. 1992','Bank of England','Monetary policy framework history','—','Authoritative','High','Cite with attribution')]},
{slug:'ireland-bank-guarantee-2008',desk:'global',cat:'Banking Crisis',type:'hist',date:'2008-09-30',loc:'Dublin',plate:'vault',status:'review',
 head:'Ireland guarantees its banks’ liabilities',
 deck:'Overnight, the Irish state extended a guarantee over the deposits and most debts of six domestic institutions.',
 body:[['What happened','In the early hours of September 30, 2008, after an overnight meeting, the Irish government announced a guarantee covering deposits and a wide range of other liabilities at six Irish-owned banks and building societies.'],
  ['Why it mattered','The guarantee tied the solvency of the state to its banks. As losses at Anglo Irish Bank and others emerged, they became public debts; in late 2010 Ireland entered an EU–IMF assistance programme.'],
  ['The mechanism','A blanket guarantee stops a run by removing the reason to withdraw. But it transfers the banks’ credit risk to taxpayers — and when the underlying property losses proved enormous, the sovereign absorbed them.']],
 keyDates:[['2008-09-30','Guarantee announced'],['2008-10-02','Credit Institutions (Financial Support) Act'],['2010-11','EU–IMF programme']],
 inst:['Department of Finance (Ireland)','Anglo Irish Bank','Allied Irish Banks','Bank of Ireland'],people:['Brian Lenihan','Brian Cowen'],assets:['Bank debt','Irish government bonds'],countries:['Ireland'],crisis:'Global Financial Crisis',
 sources:[S('Guarantee announced Sept. 30, 2008','Government of Ireland','Department of Finance statement, 30 September 2008','2008-09-30','Primary statement','High','Government copyright'),
  S('Six covered institutions','Oireachtas','Credit Institutions (Financial Support) Act 2008','2008-10','Legislation','High','Public document')]},
{slug:'whatever-it-takes-2012',desk:'global',cat:'Central Banks',type:'hist',date:'2012-07-26',loc:'London',plate:'globe',status:'review',
 head:'Draghi: “Whatever it takes”',
 deck:'Three words from the ECB president turned the euro crisis without a single bond being bought.',
 body:[['What happened','Speaking at the Global Investment Conference in London on July 26, 2012, European Central Bank President Mario Draghi said the ECB was ready, within its mandate, to do whatever it takes to preserve the euro.'],
  ['Why it mattered','In September the ECB announced Outright Monetary Transactions. Spanish and Italian bond yields fell — and the programme was never activated.'],
  ['The mechanism','A credible promise of unlimited bond purchases removes the payoff from betting on a country’s exit from the euro. If investors believe the backstop, the central bank may never have to use it.']],
 keyDates:[['2012-07-26','London speech'],['2012-09-06','OMT announced']],
 inst:['European Central Bank'],people:['Mario Draghi'],assets:['Euro','Sovereign bonds'],countries:['Spain','Italy','Euro area'],crisis:'Euro-area debt crisis',
 sources:[S('Speech at the Global Investment Conference, July 26, 2012','European Central Bank','Verbatim of the remarks','2012-07-26','Primary document','High','ECB — reuse with attribution'),
  S('OMT announced Sept. 6, 2012','European Central Bank','Press release, Technical features of OMT','2012-09-06','Primary document','High','ECB — reuse with attribution')]},
{slug:'snb-removes-floor-2015',desk:'global',cat:'Central Banks',type:'hist',date:'2015-01-15',loc:'Zurich',plate:'tape',status:'review',
 head:'The Swiss National Bank abandons its franc cap',
 deck:'A policy the SNB had defended for more than three years ended without warning on a Thursday morning.',
 body:[['What happened','On January 15, 2015, the Swiss National Bank discontinued the minimum exchange rate of CHF 1.20 per euro it had held since September 2011, and lowered its deposit rate to −0.75%.'],
  ['Why it mattered','The franc surged against the euro within minutes. Several retail currency brokers took heavy losses as client accounts went negative.'],
  ['The mechanism','Defending a floor meant creating francs to buy euros without limit. With the ECB moving toward quantitative easing, the size of that defense — and the balance sheet behind it — threatened to grow without bound.']],
 keyDates:[['2011-09-06','Minimum rate introduced'],['2015-01-15','Minimum rate discontinued']],
 inst:['Swiss National Bank'],people:['Thomas Jordan'],assets:['Swiss franc','Euro'],countries:['Switzerland'],crisis:'',
 sources:[S('Minimum rate discontinued; deposit rate −0.75%','Swiss National Bank','Press release, 15 January 2015','2015-01-15','Primary document','High','SNB — reuse with attribution'),
  S('Minimum rate introduced Sept. 6, 2011','Swiss National Bank','Press release, 6 September 2011','2011-09-06','Primary document','High','SNB — reuse with attribution')]},
{slug:'south-sea-bubble-1720',desk:'global',cat:'Bubble',type:'hist',date:'1720-01-01',prec:'y',loc:'London',plate:'ledger',status:'review',
 head:'The South Sea Bubble',
 deck:'A scheme to swap government debt for company shares produced one of history’s defining manias.',
 body:[['What happened','In 1720 shares of the South Sea Company rose from about £128 in January to near £1,000 by the summer, then collapsed by the autumn.'],
  ['Why it mattered','Parliament investigated the company’s directors, and the Bubble Act restricted the formation of joint-stock companies until its repeal in 1825.'],
  ['The mechanism','The company took on government debt in exchange for its own shares. The higher its share price, the fewer shares it had to issue per pound of debt — giving insiders every reason to push the price up.']],
 keyDates:[['1720-01','Shares near £128'],['1720-06','Bubble Act passed'],['1720-summer','Shares near £1,000'],['1825','Bubble Act repealed']],
 inst:['South Sea Company','Parliament of Great Britain'],people:['John Blunt'],assets:['Equities','Government debt'],countries:['United Kingdom'],crisis:'South Sea Bubble',
 sources:[S('Price path ~£128 to near £1,000 in 1720','Contemporary price lists','Course of the Exchange (1720)','1720','Primary price record','Medium','Public domain'),
  S('Bubble Act repealed 1825','UK Parliament','Statute records','1825','Legislation','High','Public document')]},
{slug:'voc-charter-1602',desk:'global',cat:'Market History',type:'hist',date:'1602-03-20',loc:'Amsterdam',plate:'ledger',status:'review',
 head:'The Dutch East India Company is chartered',
 deck:'A public share subscription gave Amsterdam one of the world’s earliest markets in transferable company shares.',
 body:[['What happened','On March 20, 1602, the States General of the Dutch Republic granted a charter to the Verenigde Oostindische Compagnie, giving it a monopoly on Dutch trade in Asia.'],
  ['Why it mattered','The company raised capital from a broad public subscription. Investors who wanted their money back sold their shares to someone else, and a secondary market formed in Amsterdam.'],
  ['The mechanism','Long voyages tied up capital for years. Transferable shares let the company keep its capital permanently while investors kept the option to exit — the basic design of the modern public company.']],
 keyDates:[['1602-03-20','Charter granted']],
 inst:['Dutch East India Company (VOC)','States General'],people:[],assets:['Equities'],countries:['Netherlands'],crisis:'',
 sources:[S('Charter granted March 20, 1602','Dutch National Archives','VOC charter (Octrooi)','1602','Primary document','High','Archive terms apply'),
  S('Secondary share market formed in Amsterdam','Academic literature','Economic history of the VOC share market','—','Scholarly secondary','High','Cite only')]},
/* ---- Bitcoin ---- */
{slug:'bitcoin-white-paper-2008',desk:'btc',cat:'Bitcoin History',type:'hist',date:'2008-10-31',loc:'Online',plate:'ledger',status:'review',
 head:'Satoshi Nakamoto publishes the Bitcoin white paper',
 deck:'A nine-page paper, sent to a cryptography mailing list, described electronic cash with no trusted third party.',
 body:[['What happened','On October 31, 2008, a message to a cryptography mailing list announced a new peer-to-peer electronic cash system with no trusted third party, and linked to a nine-page paper signed Satoshi Nakamoto.'],
  ['Why it mattered','The paper proposed a way to prevent double-spending without a central authority — the problem that had defeated earlier designs for digital cash.'],
  ['The mechanism','Transactions are grouped into blocks linked by proof-of-work. Rewriting history would require redoing that work faster than the rest of the network, which becomes impractical as blocks accumulate.']],
 keyDates:[['2008-10-31','White paper announced'],['2009-01-03','Genesis block']],
 inst:[],people:['Satoshi Nakamoto'],assets:['Bitcoin'],countries:[],crisis:'',
 sources:[S('Announced Oct. 31, 2008 on the Cryptography Mailing List','Cryptography Mailing List archive','“Bitcoin P2P e-cash paper”','2008-10-31','Primary document','High','Cite with attribution'),
  S('Paper is nine pages','bitcoin.org','Bitcoin: A Peer-to-Peer Electronic Cash System (PDF)','2008','Primary document','High','MIT-licensed distribution; confirm')]},
{slug:'bitcoin-genesis-block-2009',desk:'btc',cat:'Bitcoin History',type:'hist',date:'2009-01-03',loc:'Block 0',plate:'chain',status:'review',
 head:'The Bitcoin genesis block is mined',
 deck:'The first block carried a newspaper headline about bank bailouts — a timestamp and a statement of purpose.',
 body:[['What happened','On January 3, 2009, the first block of the Bitcoin blockchain was mined. Its coinbase transaction carried a line of text quoting that day’s front page of The Times: “Chancellor on brink of second bailout for banks.”'],
  ['Why it mattered','The embedded headline proved the block could not have been created before that date, and read as a statement of intent: a monetary system without the bailouts on the front page.'],
  ['The mechanism','The genesis block is hard-coded into Bitcoin’s software. Each later block commits to the hash of the one before it, so the whole chain can be verified back to this point. Its 50-bitcoin reward cannot be spent.']],
 keyDates:[['2009-01-03','Block 0 mined'],['2009-01-12','First person-to-person transaction']],
 inst:[],people:['Satoshi Nakamoto','Hal Finney'],assets:['Bitcoin'],countries:[],crisis:'',
 sources:[S('Block 0 timestamp Jan. 3, 2009 with embedded Times headline','Bitcoin blockchain','Block 0 coinbase data','2009-01-03','Primary on-chain record','High','Public data'),
  S('Genesis reward is unspendable','Bitcoin Core source code','chainparams / consensus rules','—','Primary source code','High','MIT License')]},
{slug:'bitcoin-pizza-day-2010',desk:'btc',cat:'Bitcoin History',type:'hist',date:'2010-05-22',loc:'Jacksonville, Florida',plate:'chain',status:'review',
 head:'10,000 bitcoin buys two pizzas',
 deck:'A programmer’s forum request produced the first widely cited purchase of physical goods with bitcoin.',
 body:[['What happened','On May 22, 2010, programmer Laszlo Hanyecz reported on the BitcoinTalk forum that he had paid 10,000 bitcoin for two pizzas, arranged through another forum member.'],
  ['Why it mattered','It is widely cited as the first documented purchase of physical goods with bitcoin, and May 22 is now marked each year as Bitcoin Pizza Day.'],
  ['The mechanism','Bitcoin had almost no market price in 2010. A voluntary trade between two strangers set a real-world exchange rate — the way any new money first acquires value.']],
 keyDates:[['2010-05-18','Forum request posted'],['2010-05-22','Purchase reported']],
 inst:['BitcoinTalk'],people:['Laszlo Hanyecz'],assets:['Bitcoin'],countries:['United States'],crisis:'',
 sources:[S('Purchase reported May 22, 2010','BitcoinTalk forum','“Pizza for bitcoins?” thread','2010-05-22','Primary post','High','Forum terms — screenshot rights to confirm'),
  S('10,000 BTC paid','Bitcoin blockchain','Transaction record','2010-05-22','On-chain record','High','Public data')]},
{slug:'mt-gox-bankruptcy-2014',desk:'btc',cat:'Exchange Failure',type:'hist',date:'2014-02-28',loc:'Tokyo',plate:'servers',status:'review',
 head:'Mt. Gox files for bankruptcy protection in Tokyo',
 deck:'The collapse of bitcoin’s dominant early exchange became the defining lesson in custody risk.',
 body:[['What happened','After halting withdrawals earlier in the month, the Tokyo-based exchange Mt. Gox filed for bankruptcy protection on February 28, 2014, reporting that about 850,000 bitcoin were missing.'],
  ['Why it mattered','Mt. Gox had once handled most of the world’s bitcoin trading. Its failure made custody — who actually holds the coins — the central question for every exchange that followed.'],
  ['The mechanism','An exchange that pools customers’ coins can lose them to theft or mismanagement without customers seeing it. Without proof of reserves, an exchange balance is only a claim on the exchange.']],
 keyDates:[['2014-02-07','Withdrawals halted'],['2014-02-28','Bankruptcy filing in Tokyo']],
 inst:['Mt. Gox'],people:['Mark Karpelès'],assets:['Bitcoin'],countries:['Japan'],crisis:'Mt. Gox collapse',
 sources:[S('Filed Feb. 28, 2014; ~850,000 BTC reported missing','Tokyo District Court / Mt. Gox trustee','Civil rehabilitation filing; trustee notices','2014-02-28','Court record','High','Public record'),
  S('Withdrawals halted Feb. 2014','Mt. Gox','Company announcements','2014-02','Primary statement','Medium','Archived web page')]},
{slug:'spot-bitcoin-etfs-2024',desk:'btc',cat:'Market Structure',type:'hist',date:'2024-01-10',loc:'Washington',plate:'vault',status:'review',
 head:'The SEC approves spot bitcoin ETFs',
 deck:'Eleven products won approval in one order, bringing bitcoin exposure into ordinary brokerage accounts.',
 body:[['What happened','On January 10, 2024, the U.S. Securities and Exchange Commission approved the listing and trading of eleven spot bitcoin exchange-traded products. Trading began the next day.'],
  ['Why it mattered','Brokerage accounts, retirement plans and advisers gained regulated access to bitcoin through ordinary securities, without holding the asset directly.'],
  ['The mechanism','Authorized participants create and redeem ETF shares in large blocks, which keeps each fund’s market price close to the value of the bitcoin held by its custodian.']],
 keyDates:[['2024-01-10','SEC approval order'],['2024-01-11','Trading begins']],
 inst:['U.S. Securities and Exchange Commission'],people:['Gary Gensler'],assets:['Bitcoin','ETFs'],countries:['United States'],crisis:'',
 sources:[S('Approval of eleven spot bitcoin ETPs, Jan. 10, 2024','U.S. Securities and Exchange Commission','Order Granting Accelerated Approval (Release No. 34-99306)','2024-01-10','Regulatory order','High','Public document'),
  S('Trading began Jan. 11, 2024','Listing exchanges','Exchange notices','2024-01-11','Primary notice','High','Cite with attribution')]},
/* ---- On-Chain ---- */
{slug:'ethereum-frontier-2015',desk:'chain',cat:'Protocols',type:'hist',date:'2015-07-30',loc:'Online',plate:'chain',status:'review',
 head:'Ethereum’s Frontier network goes live',
 deck:'A public blockchain with a built-in programming environment became the base layer for tokens and DeFi.',
 body:[['What happened','The Ethereum network launched on July 30, 2015, with its Frontier release, adding a general-purpose virtual machine to a public blockchain.'],
  ['Why it mattered','Programmable smart contracts became the foundation for tokens, decentralized exchanges and on-chain lending.'],
  ['The mechanism','Every node runs the same code on the same inputs. Users pay gas — fees for computation — which prices the network’s shared resources and stops programs from running forever.']],
 keyDates:[['2015-07-30','Frontier launch']],
 inst:['Ethereum Foundation'],people:['Vitalik Buterin'],assets:['Ether'],countries:[],crisis:'',
 sources:[S('Frontier launched July 30, 2015','Ethereum Foundation blog','Frontier launch announcement','2015-07-30','Primary statement','High','Cite with attribution'),
  S('Gas meters computation','Ethereum Yellow Paper','Formal specification','2014–','Primary technical document','High','Cite with attribution')]},
{slug:'the-dao-exploit-2016',desk:'chain',cat:'Security',type:'hist',date:'2016-06-17',loc:'Online',plate:'servers',status:'review',
 head:'The DAO is drained',
 deck:'A reentrancy bug in a crowdfunded contract forced Ethereum’s first contested hard fork.',
 body:[['What happened','On June 17, 2016, an attacker began draining ether from The DAO, a crowdfunded investment contract, by exploiting how it handled withdrawals.'],
  ['Why it mattered','Ethereum adopted a hard fork on July 20, 2016, to return the funds. Those who rejected it kept the original chain running as Ethereum Classic.'],
  ['The mechanism','The contract sent ether before updating its balance record. A malicious contract re-entered the withdrawal function repeatedly — the reentrancy bug now taught as a canonical smart-contract failure.']],
 keyDates:[['2016-06-17','Exploit begins'],['2016-07-20','Hard fork']],
 inst:['The DAO'],people:[],assets:['Ether','Ethereum Classic'],countries:[],crisis:'The DAO exploit',
 sources:[S('Exploit began June 17, 2016','Ethereum blockchain','Transaction records','2016-06-17','On-chain record','High','Public data'),
  S('Hard fork on July 20, 2016','Ethereum Foundation blog','Hard fork completed','2016-07-20','Primary statement','High','Cite with attribution')]},
{slug:'the-merge-2022',desk:'chain',cat:'Protocols',type:'hist',date:'2022-09-15',loc:'Online',plate:'servers',status:'review',
 head:'The Merge: Ethereum moves to proof-of-stake',
 deck:'The network swapped its consensus engine while running, ending mining on Ethereum.',
 body:[['What happened','On September 15, 2022, Ethereum’s execution layer merged with the Beacon Chain, ending proof-of-work mining on the network.'],
  ['Why it mattered','The Ethereum Foundation estimated the change cut the network’s energy consumption by about 99.95%.'],
  ['The mechanism','Validators lock ether as collateral and take turns proposing and attesting to blocks. Misbehavior can be punished by destroying part of that stake — security from capital at risk rather than electricity spent.']],
 keyDates:[['2020-12-01','Beacon Chain launch'],['2022-09-15','The Merge']],
 inst:['Ethereum Foundation'],people:[],assets:['Ether'],countries:[],crisis:'',
 sources:[S('Merge completed Sept. 15, 2022','Ethereum Foundation','The Merge (ethereum.org)','2022-09-15','Primary statement','High','CC BY 4.0 — confirm'),
  S('~99.95% energy reduction estimate','Ethereum Foundation','Energy consumption page','—','Primary estimate','Medium','CC BY 4.0 — confirm')]},
/* ---- Live desk samples (placeholder copy for the CMS template) ---- */
{slug:'sample-treasury-quarter-end',desk:'wallst',cat:'Rates',type:'live',ago:14,flag:'UPDATE',sym:'US10Y',loc:'New York',plate:'tape',status:'sample',
 head:'Treasury yields steady into quarter-end as the auction calendar clears',deck:'Sample story showing how the live desk template handles rates coverage.'},
{slug:'sample-closing-auction',desk:'wallst',cat:'Equities',type:'live',ago:31,flag:'LIVE',sym:'SPX',loc:'New York',plate:'exchange',status:'sample',
 head:'Quarter-end rebalancing flows in focus for the closing auction',deck:'Sample story showing live coverage with a ticker attached.'},
{slug:'sample-euro-inflation',desk:'global',cat:'Central Banks',type:'live',ago:46,flag:'UPDATE',sym:'EURUSD',loc:'Frankfurt',plate:'globe',status:'sample',
 head:'Euro-area inflation data frames the ECB’s next meeting',deck:'Sample story for the Global Finance live desk.'},
{slug:'sample-yen-watch',desk:'global',cat:'Currencies',type:'live',ago:62,flag:'UPDATE',sym:'USDJPY',loc:'Tokyo',plate:'tape',status:'sample',
 head:'Yen traders watch official commentary near key levels',deck:'Sample story for currency coverage.'},
{slug:'sample-etf-flows',desk:'btc',cat:'Flows',type:'live',ago:78,flag:'UPDATE',sym:'BTC',loc:'New York',plate:'vault',status:'sample',
 head:'Spot bitcoin ETF flows: the daily tally',deck:'Sample recurring data story for the Bitcoin desk.'},
{slug:'sample-l2-fees',desk:'chain',cat:'Protocols',type:'live',ago:104,flag:'UPDATE',sym:'ETH',loc:'Online',plate:'chain',status:'sample',
 head:'Layer-2 fees after the latest network upgrade',deck:'Sample explainer for the On-Chain desk.'},
{slug:'sample-earnings-week',desk:'wallst',cat:'Earnings',type:'live',ago:150,flag:'UPDATE',sym:'COMP',loc:'New York',plate:'tape',status:'sample',
 head:'Earnings calendar: the reports that matter this week',deck:'Sample preview story for the Wall Street desk.'}
];
/* extra dated events for On This Date (files in preparation) */
const EXTRA=[
 {date:'1873-09-18',desk:'then',head:'Jay Cooke & Company suspends payments',status:'review',link:'nyse-reopens-1873'},
 {date:'1873-09-20',desk:'then',head:'The NYSE closes as the Panic of 1873 spreads',status:'review',link:'nyse-reopens-1873'},
 {date:'1929-10-24',desk:'then',head:'Black Thursday: a bankers’ pool steadies a falling market',status:'review'},
 {date:'1929-10-28',desk:'then',head:'The Dow falls about 13% in a single session',status:'review',link:'black-tuesday-1929'},
 {date:'2008-09-16',desk:'then',head:'The Reserve Primary Fund breaks the buck',status:'review'},
 {date:'2008-09-29',desk:'then',head:'The House rejects the bank rescue bill; the Dow falls 777.68 points',status:'review'},
 {date:'2008-09-30',desk:'then',head:'The Dow rebounds a day after the rescue bill’s defeat',status:'review'},
 {date:'2013-09-30',desk:'btc',head:'Silk Road case: civil forfeiture action (date under verification)',status:'pending'},
 {date:'2012-09-06',desk:'global',head:'The ECB announces Outright Monetary Transactions',status:'review',link:'whatever-it-takes-2012'},
 {date:'1992-10-08',desk:'global',head:'The UK adopts an inflation target',status:'review',link:'black-wednesday-1992'},
 {date:'2016-07-20',desk:'chain',head:'Ethereum hard fork returns The DAO’s funds',status:'review',link:'the-dao-exploit-2016'},
 {date:'2024-01-11',desk:'btc',head:'Spot bitcoin ETFs begin trading',status:'review',link:'spot-bitcoin-etfs-2024'}
];
/* ---------- Market Time Machine seed index (status: in review — confirm against primary sources before publishing) ---------- */
const EXTRA2=`1999-01-01|global|The euro launches as an accounting currency in 11 countries
2002-01-01|global|Euro banknotes and coins enter circulation
1994-01-01|global|NAFTA takes effect
1995-01-01|global|The World Trade Organization begins operating
2001-01-03|then|The Fed makes a surprise half-point cut between meetings
1782-01-07|then|The Bank of North America opens in Philadelphia
1835-01-08|then|The U.S. national debt is paid off under President Jackson
2000-01-10|then|AOL agrees to acquire Time Warner
1973-01-11|then|The Dow closes at 1,051.70 before the 1973–74 bear market
2008-01-11|then|Bank of America agrees to buy Countrywide Financial
2009-01-12|btc|First bitcoin transaction between two people: Satoshi to Hal Finney
1999-01-13|global|Brazil devalues the real
2000-01-14|then|The Dow closes at a record 11,722.98 at the height of the dot-com boom
1991-01-17|then|The Dow rallies 114.60 points as the Gulf War air campaign begins
2008-01-21|global|Global stocks plunge while U.S. markets are closed for a holiday
2008-01-22|then|The Fed cuts rates by three-quarters of a point in an emergency move
2015-01-22|global|The ECB announces large-scale quantitative easing
2008-01-24|global|Société Générale discloses a €4.9 billion loss from unauthorized trading
2021-01-27|then|The GameStop short squeeze peaks with a close of $347.51
2021-01-28|then|Robinhood restricts buying of GameStop and other meme stocks
2016-01-29|global|The Bank of Japan adopts negative interest rates
1934-01-30|then|The Gold Reserve Act is signed
1934-01-31|then|The dollar is devalued as gold is reset to $35 an ounce
1913-02-03|then|The Sixteenth Amendment is ratified, permitting a federal income tax
1994-02-04|then|The Fed raises rates for the first time since 1989, starting the 1994 bond rout
2018-02-05|then|The Dow falls 1,175 points as a volatility trade unravels
1992-02-07|global|The Maastricht Treaty is signed, setting the path to the euro
1971-02-08|then|Nasdaq begins operating as an electronic quotation market
2011-02-09|btc|Bitcoin reaches parity with the U.S. dollar
1971-02-15|global|Decimal Day: Britain switches to decimal currency
2009-02-17|then|The American Recovery and Reinvestment Act is signed
2020-02-19|then|The S&P 500 closes at a record before the pandemic crash
1987-02-22|global|The Louvre Accord seeks to stabilize the dollar
2024-02-22|global|The Nikkei 225 finally closes above its 1989 record
2022-02-24|global|Russia invades Ukraine; commodity prices surge
1791-02-25|then|The First Bank of the United States is chartered
1862-02-25|then|The Legal Tender Act authorizes greenback paper money
1863-02-25|then|The National Currency Act creates nationally chartered banks
1995-02-26|global|Barings Bank collapses after Nick Leeson’s trading losses
2007-02-27|global|Shanghai stocks plunge about 9%, dragging the Dow down 416 points
2020-03-03|then|The Fed makes an emergency half-point cut as the pandemic spreads
1933-03-04|then|Roosevelt takes office amid a nationwide banking crisis
1933-03-06|then|Roosevelt declares a national bank holiday
1817-03-08|then|The New York Stock & Exchange Board adopts its constitution
2009-03-09|then|The S&P 500 hits its financial-crisis low of 676.53
2023-03-10|then|Silicon Valley Bank is closed by regulators
2021-03-11|chain|A Beeple NFT sells for $69.3 million at Christie’s
1933-03-12|then|Roosevelt’s first fireside chat explains the banking crisis
2023-03-12|then|The Fed creates the Bank Term Funding Program after SVB’s failure
1933-03-13|then|Banks begin reopening after the national holiday
2024-03-13|chain|Ethereum’s Dencun upgrade cuts layer-2 data costs
1933-03-15|then|The Dow jumps about 15% as the NYSE reopens — its biggest one-day percentage gain
2020-03-15|then|The Fed cuts rates to near zero in a Sunday announcement
2008-03-16|then|JPMorgan agrees to buy Bear Stearns with Fed support
2013-03-16|global|Cyprus bailout deal includes a levy on bank deposits
2022-03-16|then|The Fed begins raising rates to fight inflation
1968-03-17|global|The London Gold Pool ends; a two-tier gold market begins
2023-03-19|global|UBS agrees to take over Credit Suisse
2024-03-19|global|The Bank of Japan ends negative interest rates
2020-03-23|then|The Fed pledges open-ended asset purchases; the S&P 500 hits its pandemic low
2000-03-24|then|The S&P 500 peaks at 1,527.46
1957-03-25|global|The Treaty of Rome creates the European Economic Community
1980-03-27|then|Silver Thursday: the Hunt brothers’ silver bet collapses
1999-03-29|then|The Dow closes above 10,000 for the first time
1792-04-02|then|The Coinage Act establishes the U.S. Mint and the dollar
2013-04-04|global|The Bank of Japan launches massive quantitative and qualitative easing
1933-04-05|then|Executive Order 6102 requires Americans to turn in gold
2023-04-12|chain|Ethereum’s Shapella upgrade enables staking withdrawals
2000-04-14|then|The Nasdaq falls 9.7% in a single session
2021-04-14|btc|Coinbase lists on Nasdaq
1906-04-18|then|The San Francisco earthquake strains insurers and credit ahead of 1907
2020-04-20|global|WTI crude futures settle below zero, at −$37.63
2024-04-20|btc|Bitcoin’s fourth halving cuts the block reward to 3.125 BTC (UTC)
2015-04-23|then|The Nasdaq closes above its 2000 peak for the first time
1975-05-01|then|May Day: fixed brokerage commissions end on Wall Street
2023-05-01|then|First Republic Bank is seized and sold to JPMorgan
2010-05-02|global|Greece agrees its first bailout with the EU and IMF
1997-05-06|global|The Bank of England is granted operational independence
2010-05-06|then|The Flash Crash: the Dow drops nearly 1,000 points in minutes
1873-05-09|global|The Vienna stock exchange crashes, opening the Panic of 1873 in Europe
1901-05-09|then|Panic of 1901: a fight to corner Northern Pacific shares crashes the market
2022-05-09|chain|TerraUSD loses its dollar peg
1837-05-10|then|New York banks suspend specie payments in the Panic of 1837
1866-05-10|global|Overend, Gurney & Co. suspends payment, setting off a London panic
1869-05-10|then|The transcontinental railroad is completed at Promontory Summit
2010-05-10|global|Europe announces a €750 billion stabilization package
1931-05-11|global|Austria’s Creditanstalt reveals huge losses, spreading the Depression’s banking crisis
2020-05-11|btc|Bitcoin’s third halving cuts the block reward to 6.25 BTC
1984-05-17|then|Regulators announce a rescue of Continental Illinois
2012-05-18|then|Facebook goes public
2013-05-22|then|Bernanke’s taper remarks set off the “taper tantrum”
1896-05-26|then|The Dow Jones Industrial Average is first published
1962-05-28|then|The “Kennedy Slide”: the Dow falls 5.7%
1998-06-01|global|The European Central Bank is established
2009-06-01|then|General Motors files for bankruptcy
2014-06-05|global|The ECB introduces a negative deposit rate
1934-06-06|then|The Securities Exchange Act creates the SEC
2020-06-15|chain|Compound begins distributing COMP, kicking off “DeFi summer”
2022-06-15|then|The Fed raises rates by 0.75 point, its largest hike since 1994
1933-06-16|then|The Banking Act of 1933 (Glass-Steagall) creates the FDIC
1970-06-21|then|Penn Central files for bankruptcy
2016-06-24|global|The pound plunges after Britain votes to leave the EU
1944-07-01|global|The Bretton Woods conference opens
1997-07-02|global|Thailand floats the baht, triggering the Asian financial crisis
1884-07-03|then|Charles Dow publishes his first stock average
2015-07-05|global|Greek voters reject bailout terms in a referendum
1889-07-08|then|The Wall Street Journal publishes its first issue
2016-07-09|btc|Bitcoin’s second halving cuts the block reward to 12.5 BTC
1832-07-10|then|Jackson vetoes the recharter of the Second Bank of the United States
1931-07-13|global|Germany’s Danatbank collapses
2002-07-21|then|WorldCom files for bankruptcy
2010-07-21|then|The Dodd-Frank Act is signed
2022-07-21|global|The ECB raises rates for the first time in 11 years
1944-07-22|global|The Bretton Woods agreements are concluded
2014-07-22|chain|The Ether presale opens
1694-07-27|global|The Bank of England is chartered
2002-07-30|then|The Sarbanes-Oxley Act is signed
1914-07-31|then|The NYSE closes as World War I begins
2012-08-01|then|Knight Capital loses about $440 million in a trading glitch
2017-08-01|btc|Bitcoin Cash splits from Bitcoin
1990-08-02|global|Iraq invades Kuwait; oil prices spike
2011-08-05|then|S&P strips the United States of its AAA credit rating
2024-08-05|global|Japan’s Nikkei falls 12.4% as the yen carry trade unwinds
2011-08-08|then|The Dow falls 634.76 points after the U.S. downgrade
2007-08-09|global|BNP Paribas freezes three funds; the ECB injects emergency liquidity
2015-08-11|global|China devalues the yuan
1982-08-12|global|Mexico says it cannot service its debt, opening the Latin American debt crisis
2010-08-15|btc|A bug creates 184 billion bitcoin; developers fix it with a fork
1998-08-17|global|Russia devalues the ruble and defaults on domestic debt
2004-08-19|then|Google goes public
1857-08-24|then|Ohio Life Insurance and Trust fails, setting off the Panic of 1857
2015-08-24|global|A China-led sell-off sends the Dow down about 1,000 points at the open
2017-08-24|btc|Segregated Witness (SegWit) activates on Bitcoin
1929-09-03|then|The Dow peaks at 381.17 before the Great Crash
2008-09-07|then|Fannie Mae and Freddie Mac are placed into conservatorship
2021-09-07|btc|Bitcoin becomes legal tender in El Salvador
2001-09-11|then|Terrorist attacks close U.S. stock markets for four trading days
2007-09-14|global|Depositors line up outside Northern Rock
2008-09-14|then|Bank of America agrees to buy Merrill Lynch
2001-09-17|then|The NYSE reopens after 9/11; the Dow falls 684.81 points
2019-09-17|then|Repo rates spike and the New York Fed injects cash
1931-09-21|global|Britain leaves the gold standard
2008-09-21|then|Goldman Sachs and Morgan Stanley become bank holding companies
1998-09-23|then|The New York Fed organizes a rescue of Long-Term Capital Management
2022-09-23|global|The UK “mini-budget” sets off a gilt-market crisis
1869-09-24|then|Black Friday: Gould and Fisk’s attempt to corner gold collapses
2008-09-25|then|Washington Mutual is seized in the largest U.S. bank failure
2022-09-28|global|The Bank of England intervenes to stabilize the gilt market
2008-10-03|then|The Emergency Economic Stabilization Act (TARP) is signed
1979-10-06|then|Volcker’s “Saturday Night Special” shifts Fed policy to fight inflation
2008-10-08|global|Six central banks cut rates in a coordinated move
2002-10-09|then|The Nasdaq bottoms at 1,114.11 after the dot-com crash
2007-10-09|then|The Dow closes at a record 14,164.53 before the financial crisis
1989-10-13|then|Friday the 13th mini-crash as a UAL buyout collapses
2008-10-13|then|The Dow gains 936 points, then its largest one-day point gain
1973-10-17|global|Arab oil producers announce an oil embargo
1987-10-20|then|The Fed pledges liquidity the morning after Black Monday
1986-10-27|global|“Big Bang” deregulates the London Stock Exchange
1997-10-27|then|The Dow falls 554 points and market-wide circuit breakers halt trading for the first time
1993-11-01|global|The Maastricht Treaty takes effect, creating the European Union
2018-11-02|chain|Uniswap launches on Ethereum
2022-11-08|chain|FTX halts withdrawals as a liquidity crisis hits
1989-11-09|global|The Berlin Wall falls
2020-11-09|then|Vaccine news sparks a sharp rotation rally
2021-11-10|btc|Bitcoin peaks near $69,000
2022-11-11|chain|FTX files for bankruptcy
1999-11-12|then|The Gramm-Leach-Bliley Act removes Glass-Steagall’s separation of banking and securities
1929-11-13|then|The Dow hits its 1929 low of 198.69
2021-11-14|btc|The Taproot upgrade activates on Bitcoin
1972-11-14|then|The Dow closes above 1,000 for the first time
1923-11-15|global|Germany introduces the Rentenmark to end hyperinflation
1967-11-18|global|Britain devalues the pound by 14.3%
2010-11-21|global|Ireland requests an EU–IMF bailout
1954-11-23|then|The Dow finally closes above its 1929 peak
2008-11-23|then|The U.S. government announces a rescue of Citigroup
1997-11-24|global|Japan’s Yamaichi Securities collapses
2008-11-25|then|The Fed launches mortgage-bond purchases — the start of QE
2009-11-25|global|Dubai World seeks a debt standstill
2012-11-28|btc|Bitcoin’s first halving cuts the block reward to 25 BTC
2017-11-28|chain|CryptoKitties launches and congests Ethereum
2001-12-02|then|Enron files for bankruptcy
1996-12-05|then|Greenspan warns of “irrational exuberance”
2024-12-05|btc|Bitcoin crosses $100,000 for the first time (UTC)
1974-12-06|then|The Dow bottoms at 577.60 at the end of the 1973–74 bear market
2017-12-10|btc|Cboe launches the first bitcoin futures
2008-12-11|then|Bernard Madoff is arrested
1914-12-12|then|The NYSE reopens after its World War I closure
2008-12-16|then|The Fed cuts rates to near zero
2014-12-16|global|Russia’s central bank raises rates to 17% to defend the ruble
2015-12-16|then|The Fed raises rates for the first time since 2006
2017-12-17|btc|CME launches bitcoin futures as bitcoin nears $20,000
1971-12-18|global|The Smithsonian Agreement tries to rebuild fixed exchange rates
2013-12-18|then|The Fed announces it will taper bond purchases
1994-12-20|global|Mexico devalues the peso, sparking the “Tequila crisis”
1913-12-23|then|The Federal Reserve Act is signed
2001-12-23|global|Argentina announces a default on its foreign debt
2018-12-24|then|Stocks suffer their worst Christmas Eve drop; the Dow falls 653 points
2018-12-26|then|The Dow gains 1,086 points, its first 1,000-point day
1989-12-29|global|Japan’s Nikkei 225 peaks at 38,915.87
1600-12-31|global|The English East India Company is chartered
1848-04-03|then|The Chicago Board of Trade is founded
1972-05-16|then|CME opens the International Monetary Market for currency futures
1977-08-22|then|CBOT launches U.S. Treasury bond futures
1982-04-21|then|S&P 500 futures begin trading at CME
1983-03-30|then|NYMEX launches crude oil futures
1992-06-25|then|CME Globex electronic trading goes live
1997-09-09|then|The E-mini S&P 500 launches
2007-07-12|then|CME and CBOT complete their merger`.split('\n').map(l=>{const [date,desk,head]=l.split('|');return{date,desk,head,status:'review'}});
EXTRA.push(...EXTRA2);

const TIMELINE=['voc-charter-1602','south-sea-bubble-1720','buttonwood-agreement-1792','nyse-reopens-1873','knickerbocker-run-1907','black-tuesday-1929','nixon-gold-window-1971','black-monday-1987','nasdaq-peak-2000','lehman-bankruptcy-2008','bitcoin-genesis-block-2009','pandemic-crash-2020','spot-bitcoin-etfs-2024'];
const TL_LABEL={'voc-charter-1602':'Dutch East India Company','south-sea-bubble-1720':'South Sea Bubble','buttonwood-agreement-1792':'Buttonwood Agreement','nyse-reopens-1873':'Panic of 1873','knickerbocker-run-1907':'Panic of 1907','black-tuesday-1929':'Wall Street Crash','nixon-gold-window-1971':'End of gold convertibility','black-monday-1987':'Black Monday','nasdaq-peak-2000':'Dot-com crash','lehman-bankruptcy-2008':'Global Financial Crisis','bitcoin-genesis-block-2009':'Bitcoin launches','pandemic-crash-2020':'Pandemic market crash','spot-bitcoin-etfs-2024':'Spot bitcoin ETFs'};

/* normalize */
const NOW=Date.now();
A.forEach((a,i)=>{
  if(a.type==='live'){a.when=new Date(NOW-a.ago*60000);const d=a.when;a.date=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
  const [y,m,d]=a.date.split('-').map(Number);a.y=y;a.m=m;a.d=d;a.era=eraOf(y);
  a.file=a.type==='hist'?`MF-${y}-${a.prec==='y'?'XXXX':pad(m)+pad(d)}`:`MF-${y}${pad(m)}${pad(d)}-L${pad(i)}`;
  a.alt=a.alt||`Illustrative plate for: ${a.head}`;
  a.img=a.img||{status:a.type==='hist'?'Illustrative placeholder':'Illustrative placeholder',note:PLACEHOLDER};
  a.inst=a.inst||[];a.people=a.people||[];a.assets=a.assets||[];a.countries=a.countries||[];a.sources=a.sources||[];a.keyDates=a.keyDates||[];
  if(a.type==='live'&&!a.body){a.body=[['Sample story','This is placeholder copy demonstrating the live-desk template: timestamp, ticker, desk attribution and updates. Real reporting replaces it through the CMS.'],['What goes here','Live stories carry the same structure as the archive — what happened, why it matters, and the mechanism — so today’s reporting can be filed straight into the archive later.']]}
});
const BY=Object.fromEntries(A.map(a=>[a.slug,a]));
const HIST=A.filter(a=>a.type==='hist'), LIVE=A.filter(a=>a.type==='live').sort((x,y)=>x.ago-y.ago);

/* ---------- dates ---------- */
const fmtD=(a)=>a.prec==='y'?String(a.y):`${MONTHS[a.m-1]} ${a.d}, ${a.y}`;
const fmtISO=iso=>{const p=iso.split('-');if(p.length===1||isNaN(+p[1]))return iso;const [y,m,d]=p.map(Number);return d?`${MONTHS[m-1].slice(0,3)} ${d}, ${y}`:`${MONTHS[m-1].slice(0,3)} ${y}`};
const fmtTime=d=>d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'})+' ET';
const dateline=a=>`${a.loc.toUpperCase()} — ${a.type==='live'?fmtTime(a.when).toUpperCase():fmtD(a).toUpperCase()}`;

/* =========================================================================
   MARKET DATA LAYER — swap SimulatedFeed for a real provider later.
   Interface: feed.start(), feed.subscribe(fn(quote)), feed.quotes
   ========================================================================= */
const INSTR=[
 {id:'SPX',name:'S&P 500',g:'eq',v:6720.15,dp:2,vol:.0006,tk:1},{id:'COMP',name:'Nasdaq',g:'eq',v:22410.6,dp:2,vol:.0008,tk:1},
 {id:'INDU',name:'Dow Jones',g:'eq',v:46380.2,dp:2,vol:.0005,tk:1},{id:'RUT',name:'Russell 2000',g:'eq',v:2410.35,dp:2,vol:.0009,tk:1},
 {id:'VIX',name:'VIX',g:'eq',v:16.42,dp:2,vol:.006,tk:1},
 {id:'US2Y',name:'2Y Treasury',g:'rt',v:3.612,dp:3,vol:.0012,u:'%',bp:1},{id:'US10Y',name:'10Y Treasury',g:'rt',v:4.184,dp:3,vol:.001,u:'%',bp:1,tk:1},
 {id:'US30Y',name:'30Y Treasury',g:'rt',v:4.762,dp:3,vol:.0009,u:'%',bp:1},
 {id:'XAU',name:'Gold',g:'cm',v:3720.5,dp:2,vol:.0007,tk:1},{id:'XAG',name:'Silver',g:'cm',v:44.1,dp:2,vol:.0012,tk:1},
 {id:'CL',name:'WTI Crude',g:'cm',v:63.4,dp:2,vol:.0012,tk:1},{id:'HG',name:'Copper',g:'cm',v:4.72,dp:3,vol:.001},
 {id:'EURUSD',name:'EUR/USD',g:'fx',v:1.1718,dp:4,vol:.0003,tk:1},{id:'USDJPY',name:'USD/JPY',g:'fx',v:148.35,dp:2,vol:.0004,tk:1},
 {id:'GBPUSD',name:'GBP/USD',g:'fx',v:1.3442,dp:4,vol:.0003},{id:'DXY',name:'Dollar Index',g:'fx',v:97.8,dp:2,vol:.0003},
 {id:'BTC',name:'Bitcoin',g:'cr',v:112400,dp:0,vol:.0015,tk:1},{id:'ETH',name:'Ethereum',g:'cr',v:4150.2,dp:2,vol:.002,tk:1},
 {id:'SOL',name:'Solana',g:'cr',v:212.4,dp:2,vol:.0025},
 {id:'US5Y',name:'5Y Treasury',g:'rt',v:3.705,dp:3,vol:.0011,u:'%',bp:1},
 {id:'DE10Y',name:'Germany 10Y',g:'gy',v:2.705,dp:3,vol:.001,u:'%',bp:1,ex:'XETRA'},{id:'GB10Y',name:'U.K. 10Y',g:'gy',v:4.705,dp:3,vol:.001,u:'%',bp:1,ex:'LSE'},
 {id:'JP10Y',name:'Japan 10Y',g:'gy',v:1.652,dp:3,vol:.0008,u:'%',bp:1,ex:'TSE'},{id:'FR10Y',name:'France 10Y',g:'gy',v:3.512,dp:3,vol:.001,u:'%',bp:1,ex:'PAR'},{id:'IT10Y',name:'Italy 10Y',g:'gy',v:3.548,dp:3,vol:.001,u:'%',bp:1},
 {id:'USDCNY',name:'USD/CNY',g:'fx',v:7.1205,dp:4,vol:.0001},{id:'USDCHF',name:'USD/CHF',g:'fx',v:.7952,dp:4,vol:.0003},{id:'AUDUSD',name:'AUD/USD',g:'fx',v:.6604,dp:4,vol:.0003},
 {id:'TSX',name:'S&P/TSX',g:'wi',ex:'TSX',v:30120.4,dp:2,vol:.0005},{id:'IBOV',name:'Bovespa',g:'wi',ex:'B3',v:146210,dp:0,vol:.0007},
 {id:'UKX',name:'FTSE 100',g:'wi',ex:'LSE',v:9352.2,dp:2,vol:.0005},{id:'DAX',name:'DAX',g:'wi',ex:'XETRA',v:23740.5,dp:2,vol:.0006},{id:'CAC',name:'CAC 40',g:'wi',ex:'PAR',v:7880.3,dp:2,vol:.0006},{id:'SX5E',name:'Euro Stoxx 50',g:'wi',ex:'XETRA',v:5480.6,dp:2,vol:.0006},
 {id:'NKY',name:'Nikkei 225',g:'wi',ex:'TSE',v:44920,dp:2,vol:.0008},{id:'HSI',name:'Hang Seng',g:'wi',ex:'HKEX',v:26510,dp:2,vol:.0009},{id:'SHCOMP',name:'Shanghai Comp.',g:'wi',ex:'SSE',v:3862.5,dp:2,vol:.0007},{id:'SENSEX',name:'Sensex',g:'wi',ex:'BSE',v:81240,dp:2,vol:.0006},{id:'AS51',name:'S&P/ASX 200',g:'wi',ex:'ASX',v:8852.4,dp:2,vol:.0005},
 ...[['XLK','Technology'],['XLF','Financials'],['XLV','Health Care'],['XLY','Cons. Discretionary'],['XLC','Communication'],['XLI','Industrials'],['XLP','Cons. Staples'],['XLE','Energy'],['XLU','Utilities'],['XLRE','Real Estate'],['XLB','Materials']].map(([id,name],i)=>({id,name,g:'sec',v:[268,52,138,232,108,151,79,88,85,42,90][i],dp:2,vol:.0009}))];
INSTR.push({id:'XRP',name:'XRP',g:'cr',v:2.853,dp:4,vol:.003,sup:59.9e9},{id:'BNB',name:'BNB',g:'cr',v:981.2,dp:2,vol:.002,sup:139.2e6},{id:'DOGE',name:'Dogecoin',g:'cr',v:.2351,dp:4,vol:.0035,sup:150.9e9},{id:'ADA',name:'Cardano',g:'cr',v:.8124,dp:4,vol:.003,sup:36.5e9},{id:'LINK',name:'Chainlink',g:'cr',v:21.42,dp:2,vol:.003,sup:678e6});
Object.assign(INSTR.find(q=>q.id==='BTC'),{sup:19.93e6});Object.assign(INSTR.find(q=>q.id==='ETH'),{sup:120.7e6});Object.assign(INSTR.find(q=>q.id==='SOL'),{sup:541e6});
INSTR.filter(q=>['SPX','COMP','INDU','RUT'].includes(q.id)).forEach(q=>q.ex='NYSE');
/* ---------- futures ---------- */
const FUGROUPS=[{id:'eq',name:'Equity index'},{id:'rt',name:'Interest rates'},{id:'en',name:'Energy'},{id:'mt',name:'Metals'},{id:'ag',name:'Agriculture & livestock'},{id:'fx',name:'Currencies'},{id:'cr',name:'Crypto'},{id:'vol',name:'Volatility'}];
const FUT=[['ES1','E-mini S&P 500','eq','CME','$50 × index',6752.25,2,.0006],['NQ1','E-mini Nasdaq-100','eq','CME','$20 × index',24650.5,2,.0008],['YM1','E-mini Dow','eq','CBOT','$5 × index',46520,0,.0005],['RTY1','E-mini Russell 2000','eq','CME','$50 × index',2418.4,1,.0009],
 ['ZT1','2-Year T-Note','rt','CBOT','$200,000 face',104.12,3,.0002],['ZN1','10-Year T-Note','rt','CBOT','$100,000 face',112.53,3,.0003],['ZB1','30-Year T-Bond','rt','CBOT','$100,000 face',116.19,3,.0005],
 ['CL1','WTI Crude Oil','en','NYMEX','1,000 barrels',63.52,2,.0012],['BZ1','Brent Crude Oil','en','NYMEX','1,000 barrels',67.3,2,.0011],['NG1','Henry Hub Natural Gas','en','NYMEX','10,000 MMBtu',3.051,3,.002],['RB1','RBOB Gasoline','en','NYMEX','42,000 gallons',2.021,4,.0012],
 ['GC1','Gold','mt','COMEX','100 troy oz',3745.6,1,.0007],['SI1','Silver','mt','COMEX','5,000 troy oz',44.4,3,.0012],['HG1','Copper','mt','COMEX','25,000 lbs',4.735,4,.001],['PL1','Platinum','mt','NYMEX','50 troy oz',1560,1,.0012],
 ['ZC1','Corn','ag','CBOT','5,000 bushels',425.25,2,.0009],['ZS1','Soybeans','ag','CBOT','5,000 bushels',1025.5,2,.0008],['ZW1','Wheat','ag','CBOT','5,000 bushels',530.75,2,.001],['LE1','Live Cattle','ag','CME','40,000 lbs',235.1,2,.0006],['KC1','Coffee','ag','ICE','37,500 lbs',380.5,2,.0014],['SB1','Sugar No. 11','ag','ICE','112,000 lbs',16.2,2,.0012],
 ['6E1','Euro FX','fx','CME','€125,000',1.1745,4,.0003],['6J1','Japanese Yen','fx','CME','¥12,500,000',.006745,6,.0004],['6B1','British Pound','fx','CME','£62,500',1.345,4,.0003],
 ['BTC1','CME Bitcoin','cr','CME','5 bitcoin',112600,0,.0015],['ETH1','CME Ether','cr','CME','50 ether',4160,1,.002],['VX1','VIX futures','vol','Cboe','$1,000 × index',18.25,2,.005]];
FUT.forEach(([id,name,fg,ex,size,v,dp,vol])=>INSTR.push({id,name,g:'fu',fg,fx:ex,size,v,dp,vol,fut:true}));
const GROUPS=[{id:'eq',name:'U.S. Equities',sess:'eq'},{id:'rt',name:'Rates',sess:'rt'},{id:'cm',name:'Commodities',sess:'cm'},{id:'fx',name:'FX',sess:'fx'},{id:'cr',name:'Crypto',sess:'cr'},{id:'wi',name:'World indices',sess:'fx'},{id:'gy',name:'Global yields',sess:'rt'},{id:'sec',name:'S&P sectors',sess:'eq'},{id:'fu',name:'Futures',sess:'fu'}];
const SimulatedFeed=(()=>{
  const subs=new Set();const r=rng(20260930);
  const gauss=()=>{let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)};
  INSTR.forEach(q=>{const drift=(r()-.47)*q.vol*28;q.prev=q.v/(1+drift);const s=[];let x=q.prev;for(let i=0;i<48;i++){x*=1+gauss()*q.vol*2.2+(q.v-x)/q.v*.08;s.push(x)}s.push(q.v);q.series=s;
    if(q.g==='eq'&&q.id!=='VIX'){const w=[0];for(let i=1;i<=78;i++)w.push(w[i-1]+gauss());q.intra=w.map((x,i)=>q.prev+(q.v-q.prev)*i/78+(x-i/78*w[78])*q.prev*q.vol*1.1)}});
  return{name:'SIMULATED',quotes:INSTR,subscribe(f){subs.add(f)},
    start(){setInterval(()=>{for(let k=0;k<4;k++){const q=INSTR[Math.floor(r()*INSTR.length)];const old=q.v;q.v=q.v*(1+gauss()*q.vol);q.dir=q.v>=old?1:-1;q.series.push(q.v);if(q.series.length>60)q.series.shift();subs.forEach(f=>f(q))}},2200)}};
})();
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

const fmtV=q=>q.na?'—':q.v.toLocaleString('en-US',{minimumFractionDigits:q.dp,maximumFractionDigits:q.dp})+(q.u||'');
function chg(q){if(q.na)return{cls:'flat',txt:'—',arrow:''};const d=q.v-q.prev;if(q.bp){const b=d*100;return{cls:b>0.05?'up':b<-0.05?'dn':'flat',txt:`${b>=0?'+':''}${b.toFixed(1)}bp`,arrow:b>=0?'▲':'▼'}}
  const p=d/q.prev*100;return{cls:p>0.005?'up':p<-0.005?'dn':'flat',txt:`${p>=0?'+':''}${p.toFixed(2)}%`,arrow:p>=0?'▲':'▼'}}
function sparkPath(s){const mn=Math.min(...s),mx=Math.max(...s),rg=mx-mn||1;return s.map((v,i)=>`${i?'L':'M'}${(i/(s.length-1)*100).toFixed(1)},${(26-(v-mn)/rg*24).toFixed(1)}`).join('')}
function spark(q){const c=chg(q);const col=c.cls==='up'?'#2FBF77':c.cls==='dn'?'#E5534B':'#7A869A';return `<svg class="sp" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><path data-spark="${q.id}" d="${sparkPath(q.series)}" fill="none" stroke="${col}" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>`}

/* sessions (America/New_York; exchange holidays not modeled) */
function ny(){const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',weekday:'short',hour:'numeric',minute:'numeric',hour12:false}).formatToParts(new Date());const o={};p.forEach(x=>o[x.type]=x.value);return{wd:o.weekday,m:(+o.hour%24)*60+ +o.minute}}
function session(kind){const {wd,m}=ny();const we=wd==='Sat'||wd==='Sun';
  if(kind==='cr')return{c:'open',t:'24/7'};
  if(kind==='eq'){if(we)return{c:'',t:'Closed'};if(m>=570&&m<960)return{c:'open',t:'Open'};if(m>=240&&m<570)return{c:'pre',t:'Pre-market'};if(m>=960&&m<1200)return{c:'pre',t:'After hours'};return{c:'',t:'Closed'}}
  if(kind==='fx'){if(wd==='Sat'||(wd==='Sun'&&m<1020)||(wd==='Fri'&&m>=1020))return{c:'',t:'Closed'};return{c:'open',t:'Open'}}
  if(kind==='cm'){if(wd==='Sat'||(wd==='Sun'&&m<1080)||(wd==='Fri'&&m>=1020))return{c:'',t:'Closed'};if(m>=1020&&m<1080)return{c:'',t:'Break'};return{c:'open',t:'Open'}}
  if(kind==='fu'){if(wd==='Sat'||(wd==='Sun'&&m<1080)||(wd==='Fri'&&m>=1020))return{c:'',t:'Globex closed'};if(m>=1020&&m<1080)return{c:'pre',t:'Daily break'};return{c:'open',t:'Globex open'}}
  if(kind==='rt'){if(we)return{c:'',t:'Closed'};if(m>=480&&m<1020)return{c:'open',t:'Open'};return{c:'',t:'Closed'}}}
const sessHTML=k=>{const s=session(k);return `<span class="sess ${s.c}" data-sess="${k}"><i></i>${s.t}</span>`};

/* =========================================================================
   PLATES — procedural illustrative imagery. Each plate is labeled
   "Illustrative placeholder" until an event-specific archival image clears
   provenance and rights review (see Image Status on every file).
   ========================================================================= */
let PID=0;
function plate(kind,o={}){
  const id='p'+(PID++),r=rng(o.seed||7),ac=o.accent||'#C9A55C';let g='';
  const R=(a,b)=>a+r()*(b-a);
  switch(kind){
  case 'exchange':{const cx=800;g+=`<polygon points="${cx-60},-40 ${cx+60},-40 ${cx+520},900 ${cx-520},900" fill="${ac}" fill-opacity=".045" stroke="none"/>`;
    for(let i=0;i<4;i++)g+=`<rect x="${cx-440-i*34}" y="${760+i*24}" width="${880+i*68}" height="24" stroke-opacity=".32" fill="${ac}" fill-opacity=".04"/>`;
    for(let i=0;i<6;i++){const x=cx-370+i*134;g+=`<rect x="${x}" y="382" width="62" height="378" stroke-opacity=".6" fill="${ac}" fill-opacity=".05"/><rect x="${x-9}" y="366" width="80" height="16" stroke-opacity=".55"/>`;for(let f=1;f<4;f++)g+=`<line x1="${x+f*15.5}" y1="392" x2="${x+f*15.5}" y2="750" stroke-opacity=".2"/>`}
    g+=`<rect x="${cx-420}" y="316" width="840" height="50" stroke-opacity=".6"/><line x1="${cx-420}" y1="340" x2="${cx+420}" y2="340" stroke-opacity=".25"/><polygon points="${cx-440},316 ${cx},180 ${cx+440},316" stroke-opacity=".6" fill="${ac}" fill-opacity=".04"/><polygon points="${cx-340},300 ${cx},196 ${cx+340},300" stroke-opacity=".2"/>`;
    for(let i=0;i<40;i++)g+=`<circle cx="${R(300,1300)}" cy="${R(810,880)}" r="${R(3,6)}" fill="${ac}" fill-opacity="${R(.15,.4).toFixed(2)}" stroke="none"/>`;break}
  case 'crash':{for(let i=0;i<=16;i++)g+=`<line x1="${i*100}" y1="0" x2="${i*100}" y2="900" stroke-opacity=".07"/>`;for(let i=0;i<=9;i++)g+=`<line x1="0" y1="${i*100}" x2="1600" y2="${i*100}" stroke-opacity=".07"/>`;
    const n=64,pts=[];let y=620;for(let i=0;i<n;i++){const t=i/n;if(t<.68)y+=R(-16,9);else y+=R(-6,38);y=Math.max(120,Math.min(840,y));pts.push([60+i*23.5,y])}
    pts.forEach(([x,y],i)=>{if(i%2)return;const h=R(10,46);g+=`<line x1="${x}" y1="${y-h}" x2="${x}" y2="${y+h}" stroke-opacity=".28"/><rect x="${x-5}" y="${y-h/3}" width="10" height="${h/1.5}" fill="${ac}" fill-opacity=".14" stroke-opacity=".3"/>`});
    const d=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(0)},${p[1].toFixed(0)}`).join('');g+=`<path d="${d}L${pts[n-1][0]},900L60,900Z" fill="${ac}" fill-opacity=".07" stroke="none"/><path d="${d}" stroke-width="3.2" stroke-opacity=".95"/>`;break}
  case 'vault':{const cx=800,cy=450;[360,318,250,140,70].forEach((rr,i)=>g+=`<circle cx="${cx}" cy="${cy}" r="${rr}" stroke-opacity="${[.55,.3,.45,.5,.35][i]}" ${i===2?'stroke-dasharray="4 10"':''} ${i===0?`fill="${ac}" fill-opacity=".035"`:''}/>`);
    for(let i=0;i<24;i++){const a=i/24*Math.PI*2;g+=`<circle cx="${(cx+Math.cos(a)*339).toFixed(1)}" cy="${(cy+Math.sin(a)*339).toFixed(1)}" r="7" fill="${ac}" fill-opacity=".35" stroke-opacity=".6"/>`}
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2;g+=`<line x1="${(cx+Math.cos(a)*140).toFixed(1)}" y1="${(cy+Math.sin(a)*140).toFixed(1)}" x2="${(cx+Math.cos(a)*250).toFixed(1)}" y2="${(cy+Math.sin(a)*250).toFixed(1)}" stroke-opacity=".3"/>`}
    g+=`<line x1="${cx-110}" y1="${cy}" x2="${cx+110}" y2="${cy}" stroke-width="6" stroke-opacity=".5"/><line x1="${cx}" y1="${cy-110}" x2="${cx}" y2="${cy+110}" stroke-width="6" stroke-opacity=".5"/><rect x="${cx+380}" y="${cy-120}" width="40" height="240" stroke-opacity=".3"/>`;break}
  case 'globe':{const cx=800,cy=470,rr=330;g+=`<circle cx="${cx}" cy="${cy}" r="${rr}" stroke-opacity=".55" fill="${ac}" fill-opacity=".03"/>`;
    [.15,.4,.62,.82,.95].forEach(k=>g+=`<ellipse cx="${cx}" cy="${cy}" rx="${rr*k}" ry="${rr}" stroke-opacity=".2"/>`);
    for(let i=-3;i<=3;i++){const t=i/4,yy=cy+rr*t,w=rr*Math.sqrt(1-t*t);g+=`<ellipse cx="${cx}" cy="${yy}" rx="${w}" ry="${w*.12}" stroke-opacity=".16"/>`}
    for(let i=0;i<6;i++){const a1=R(0,6.28),a2=R(0,6.28),r1=R(.2,.9)*rr,r2=R(.2,.9)*rr,x1=cx+Math.cos(a1)*r1,y1=cy+Math.sin(a1)*r1*.8,x2=cx+Math.cos(a2)*r2,y2=cy+Math.sin(a2)*r2*.8;
      g+=`<path d="M${x1.toFixed(0)},${y1.toFixed(0)} Q${((x1+x2)/2).toFixed(0)},${(Math.min(y1,y2)-R(120,260)).toFixed(0)} ${x2.toFixed(0)},${y2.toFixed(0)}" stroke-width="2" stroke-opacity=".8"/><circle cx="${x1.toFixed(0)}" cy="${y1.toFixed(0)}" r="5" fill="${ac}"/><circle cx="${x2.toFixed(0)}" cy="${y2.toFixed(0)}" r="5" fill="${ac}"/>`}break}
  case 'chain':{const hx='0123456789abcdef';for(let row=0;row<14;row++){let s='';for(let k=0;k<64;k++)s+=hx[Math.floor(r()*16)];g+=`<text x="40" y="${60+row*62}" font-family="IBM Plex Mono,monospace" font-size="17" fill="${ac}" fill-opacity=".07" stroke="none">${s}</text>`}
    for(let i=0;i<5;i++){const x=150+i*280,y=360+(i%2?30:-10);g+=`<polygon points="${x},${y} ${x+36},${y-36} ${x+236},${y-36} ${x+200},${y}" fill="${ac}" fill-opacity=".08" stroke-opacity=".45"/><polygon points="${x+200},${y} ${x+236},${y-36} ${x+236},${y+124} ${x+200},${y+160}" fill="${ac}" fill-opacity=".04" stroke-opacity=".35"/><rect x="${x}" y="${y}" width="200" height="160" fill="#0A0E14" fill-opacity=".6" stroke-opacity=".7"/>`;
      for(let l=0;l<4;l++)g+=`<line x1="${x+18}" y1="${y+32+l*30}" x2="${x+R(90,182)}" y2="${y+32+l*30}" stroke-opacity=".4" stroke-width="3"/>`;
      if(i<4)g+=`<line x1="${x+200}" y1="${y+80}" x2="${x+280}" y2="${y+80+(i%2?-40:40)}" stroke-width="2" stroke-opacity=".7" stroke-dasharray="6 6"/>`}break}
  case 'ledger':{g+=`<rect x="330" y="80" width="940" height="820" fill="${ac}" fill-opacity=".045" stroke-opacity=".4"/><rect x="380" y="130" width="840" height="64" fill="${ac}" fill-opacity=".14" stroke="none"/><line x1="380" y1="222" x2="1220" y2="222" stroke-opacity=".5"/><line x1="380" y1="230" x2="1220" y2="230" stroke-opacity=".3"/>`;
    for(let c=0;c<4;c++){const x=380+c*215;g+=`<rect x="${x}" y="260" width="195" height="${R(20,34)}" fill="${ac}" fill-opacity=".12" stroke="none"/>`;for(let l=0;l<22;l++)g+=`<line x1="${x}" y1="${320+l*26}" x2="${x+R(120,195)}" y2="${320+l*26}" stroke-opacity=".22" stroke-width="5"/>`}break}
  case 'gold':{const rows=[5,4,3,2];rows.forEach((n,ri)=>{const y=720-ri*112,w=190,sx=800-(n*w)/2;for(let i=0;i<n;i++){const x=sx+i*w;g+=`<polygon points="${x+14},${y} ${x+w-14},${y} ${x+w-2},${y+100} ${x+2},${y+100}" fill="${ac}" fill-opacity="${R(.12,.24).toFixed(2)}" stroke-opacity=".7"/><line x1="${x+30}" y1="${y+22}" x2="${x+w-30}" y2="${y+22}" stroke-opacity=".35"/>`}});g+=`<line x1="200" y1="822" x2="1400" y2="822" stroke-opacity=".4"/>`;break}
  case 'servers':{for(let i=0;i<7;i++){const x=150+i*190,h=R(560,680),y=860-h;g+=`<rect x="${x}" y="${y}" width="150" height="${h}" fill="#0A0E14" stroke-opacity=".5"/>`;for(let s=0;s<Math.floor(h/34)-1;s++){const yy=y+20+s*34;g+=`<rect x="${x+12}" y="${yy}" width="126" height="24" stroke-opacity=".2"/>`;for(let d=0;d<4;d++)if(r()>.35)g+=`<circle cx="${x+24+d*12}" cy="${yy+12}" r="3" fill="${ac}" fill-opacity="${R(.3,1).toFixed(2)}" stroke="none"/>`}}g+=`<line x1="0" y1="862" x2="1600" y2="862" stroke-opacity=".4"/>`;break}
  case 'crowd':{const cx=800;g+=`<rect x="${cx-320}" y="160" width="640" height="420" fill="${ac}" fill-opacity=".04" stroke-opacity=".5"/><polygon points="${cx-340},160 ${cx},80 ${cx+340},160" stroke-opacity=".5"/>`;for(let i=0;i<5;i++)g+=`<rect x="${cx-260+i*118}" y="200" width="54" height="380" stroke-opacity=".35"/>`;g+=`<rect x="${cx-60}" y="430" width="120" height="150" fill="${ac}" fill-opacity=".15" stroke-opacity=".7"/>`;
    for(let i=0;i<260;i++){const x=R(80,1520),y=R(600,890),s=(y-560)/300;g+=`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(6+s*9).toFixed(1)}" fill="${ac}" fill-opacity="${(.12+s*.25).toFixed(2)}" stroke="none"/>`}break}
  default:{for(let i=0;i<9;i++){let d=`M-20,${R(100,800).toFixed(0)}`;for(let x=0;x<=1700;x+=170)d+=` Q${x+85},${R(80,820).toFixed(0)} ${x+170},${R(100,800).toFixed(0)}`;g+=`<path d="${d}" stroke-width="${R(1,3).toFixed(1)}" stroke-opacity="${R(.15,.6).toFixed(2)}" ${i%3?'stroke-dasharray="2 9"':''}/>`}
    for(let row=0;row<4;row++){let s='';for(let k=0;k<22;k++)s+=` ${['+','−'][Math.floor(r()*2)]}${(R(0,3)).toFixed(2)}`;g+=`<text x="40" y="${200+row*170}" font-family="IBM Plex Mono,monospace" font-size="22" fill="${ac}" fill-opacity=".14" stroke="none">${s}</text>`}}
  }
  const yr=o.year?`<text x="1570" y="${o.big?860:880}" text-anchor="end" font-family="Newsreader,Georgia,serif" font-size="${o.big?440:400}" font-weight="600" fill="#fff" fill-opacity=".05">${o.year}</text>`:'';
  return `<svg class="plate" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(o.label||'Illustrative plate')}"><defs><linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0F1622"/><stop offset="1" stop-color="#06080C"/></linearGradient><radialGradient id="${id}l" cx="${o.lx??.55}" cy="0" r=".9"><stop offset="0" stop-color="${ac}" stop-opacity=".22"/><stop offset="1" stop-color="${ac}" stop-opacity="0"/></radialGradient><radialGradient id="${id}v" cx=".5" cy=".45" r=".78"><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".8"/></radialGradient></defs><rect width="1600" height="900" fill="url(#${id}b)"/><rect width="1600" height="900" fill="url(#${id}l)"/>${yr}<g stroke="${ac}" fill="none" stroke-width="1.5" transform="translate(${o.dx||0},0)">${g}</g><rect width="1600" height="900" fill="url(#${id}v)"/>${o.big?'<rect width="1600" height="900" filter="url(#grain)" opacity=".3"/>':''}</svg>`;
}
const P=(a,extra={})=>plate(a.plate,{seed:hash(a.slug),accent:DESKS[a.desk].hex,year:a.type==='hist'?a.y:null,label:a.alt,...extra});

/* =========================================================================
   COMPONENTS
   ========================================================================= */
const deskOf=a=>DESKS[a.desk];
function stamp(s){return `<span class="stamp ${s}">${{review:'In review',verified:'Verified',pending:'Pending',sample:'Sample'}[s]}</span>`}
function card(a,size='m'){const d=deskOf(a);return `<article class="card card-${size} t-${a.type}" style="--dc:${d.hex}"><a href="#/file/${a.slug}"><div class="fig">${P(a)}</div><div class="meta"><span class="dk">${d.name}</span>${a.type==='live'?`<time datetime="${a.when.toISOString()}">${fmtTime(a.when)}</time><span class="flag sample">SAMPLE</span>`:`<span>${a.prec==='y'?'':fmtISO(a.date)}</span><span class="yr">${a.y}</span>`}</div><h3>${esc(a.head)}</h3>${size!=='s'?`<p>${esc(a.deck)}</p>`:''}</a></article>`}
function rowCard(a){const d=deskOf(a);return `<article class="card row t-${a.type}" style="--dc:${d.hex}"><a href="#/file/${a.slug}" style="display:contents"><div class="fig">${P(a)}</div><div class="stack" style="gap:8px"><div class="meta"><span class="dk">${esc(a.cat)}</span>${a.type==='live'?`<time>${fmtTime(a.when)}</time>`:`<span class="yr" style="font-size:17px">${a.y}</span>`}</div><h3>${esc(a.head)}</h3></div></a></article>`}
function fileCard(a){const d=deskOf(a);return `<article class="file" data-holo="tilt" style="--dc:${d.hex}"><a href="#/file/${a.slug}" style="display:contents"><span class="file-tab">FILE ${a.file}</span><div class="file-b"><div class="fig">${P(a)}</div><dl class="file-m"><dt>Location</dt><dd>${esc(a.loc)}</dd><dt>Date</dt><dd>${fmtD(a)}</dd><dt>Category</dt><dd>${esc(a.cat)}</dd></dl><h3>${esc(a.head)}</h3><div class="file-f"><span class="handle" style="--dc:${d.hex}">@${d.handle}</span>${stamp(a.status)}</div></div></a></article>`}
function secHead(title,desc,right='',dc){return `<div class="sec-h" ${dc?`style="--dc:${dc}"`:''}><div><h2>${title}</h2>${desc?`<p>${desc}</p>`:''}</div><div class="sec-a">${right}</div></div>`}
function quoteRow(q){const c=chg(q);return `<div class="q" data-id="${q.id}" ${rowAttr(q)}><span class="n">${esc(q.name)}<small>${q.id}</small></span>${spark(q)}<span class="v" data-f="v">${fmtV(q)}</span><span class="c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</span></div>`}
function board(full){return `<div class="board">${GROUPS.map(g=>`<section class="pnl" data-holo aria-label="${g.name}"><div class="pnl-h"><h3>${g.name}</h3>${sessHTML(g.sess)}</div>${INSTR.filter(q=>q.g===g.id).slice(0,full?9:4).map(quoteRow).join('')}</section>`).join('')}</div><div class="board-foot"><span>Data source: ${Feed.name} — placeholder values for layout. Live provider connects through the market-data layer.</span><span>Sessions in New York time · holidays not modeled</span></div>`}

function tickerHTML(){const items=INSTR.filter(q=>q.tk).map(q=>{const c=chg(q);return `<span class="tk" data-id="${q.id}"><span class="s">${esc(q.name)}</span><span class="v" data-f="v">${fmtV(q)}</span><span class="c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</span></span>`}).join('');return `<div class="tk-set">${items}</div><div class="tk-set" aria-hidden="true">${items}</div>`}
function updateQuote(q){const c=chg(q);$$(`[data-id="${q.id}"]`).forEach(el=>{const v=$('[data-f="v"]',el),cc=$('[data-f="c"]',el);if(v)v.textContent=fmtV(q);if(cc){cc.textContent=`${c.arrow} ${c.txt}`;cc.className=`c ${c.cls}`}
  if(!RM){el.classList.remove('flash-up','flash-dn');void el.offsetWidth;el.classList.add(q.dir>0?'flash-up':'flash-dn')}});
  $$(`[data-spark="${q.id}"]`).forEach(p=>{p.setAttribute('d',sparkPath(q.series));p.setAttribute('stroke',c.cls==='up'?'#2FBF77':c.cls==='dn'?'#E5534B':'#7A869A')})}

/* events for date explorer */
/* ---------- event index: article events + Market Time Machine inventory (database when available, built-in copy otherwise) ---------- */
const evId=e=>`e${e.date.replace(/-/g,'')}-${hash(e.head).toString(36).slice(0,6)}`;
EXTRA.forEach(e=>{e.id=e.id||evId(e)});
let EVENTS=[],YEV=[],MDCOUNT={},COVERED=0,TM_SOURCE='built-in',TM_LIST=EXTRA.slice();
function rebuildEvents(extra){TM_LIST=extra;
  const exp=[...HIST.filter(a=>a.prec!=='y').map(a=>({id:'a-'+a.slug,date:a.date,desk:a.desk,head:a.head,status:a.status,link:a.slug,own:true})),...extra];const expd=new Set(exp.map(e=>e.date));
  const kd=HIST.flatMap(a=>a.keyDates.filter(([d])=>/^\d{4}-\d\d-\d\d$/.test(d)&&!expd.has(d)).map(([d,t])=>({id:'k-'+a.slug+d,date:d,desk:a.desk,head:t,status:a.status,link:a.slug})));
  EVENTS=[...exp,...kd].filter(e=>/^\d{4}-\d\d-\d\d$/.test(e.date)).map(e=>{const [y,m,d]=e.date.split('-').map(Number);return{...e,y,m,d}});
  YEV=[...EVENTS,...HIST.filter(a=>a.prec==='y').map(a=>({date:a.date,desk:a.desk,head:a.head,status:a.status,link:a.slug,own:true,y:a.y,m:0,d:0}))];
  MDCOUNT={};EVENTS.forEach(e=>{const k=e.m+'-'+e.d;MDCOUNT[k]=(MDCOUNT[k]||0)+1});COVERED=Object.keys(MDCOUNT).length}
rebuildEvents(EXTRA);
const DIM=[31,29,31,30,31,30,31,31,30,31,30,31];
const isoOf=(y,m,d)=>`${String(y).padStart(4,'0')}-${pad(m)}-${pad(d)}`;
function utc(y,m,d){const t=new Date(Date.UTC(2000,m-1,d));t.setUTCFullYear(y);return t}
const validDay=(y,m,d)=>{if(!y||!m||!d)return false;const t=utc(y,m,d);return t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d};
function shiftDay(y,m,d,k){const t=utc(y,m,d);t.setUTCDate(t.getUTCDate()+k);return[t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate()]}
const WD=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function evRow(e,byYear){const dk=DESKS[e.desk];const lab=byYear?`<span class="ev-y ev-md">${e.m?MONTHS[e.m-1].slice(0,3)+' '+e.d:e.y}</span>`:`<span class="ev-y">${e.y}</span>`;
  const href=e.link&&(e.own||!e.m)?`#/file/${e.link}`:e.m?`#/day/${isoOf(e.y,e.m,e.d)}`:`#/file/${e.link}`;
  return `<a class="ev" href="${href}">${lab}<div><h3>${esc(e.head)}</h3><div class="meta"><span class="dk" style="--dc:${dk.hex}">${dk.name}</span><span>${e.link&&e.own?'Full file':e.link?'Part of a related file':'Day file'}</span></div></div>${stamp(e.status)}</a>`}
function researchLinks(m,d,y){const md=`${MONTHS[m-1]} ${d}`,full=y?`${md}, ${y}`:md;
  const L=[['Market Files AI',`Ask what happened in markets on ${full}`,aiHref(`What happened in financial markets and the economy on ${full}? List what you are confident about.`),1],['Wikipedia',`${md}: events by year`,`https://en.wikipedia.org/wiki/${MONTHS[m-1]}_${d}`]];
  if(y)L.push(['Wikipedia',`The year ${y}`,`https://en.wikipedia.org/wiki/${y}`]);
  L.push(['FRASER · St. Louis Fed','Primary economic documents','https://fraser.stlouisfed.org/']);
  if(!y||y<1964)L.push(['Library of Congress','Chronicling America newspaper archive','https://chroniclingamerica.loc.gov/']);
  return `<div class="rl"><h4 class="mono">RESEARCH THIS ${y?'DAY':'DATE'}</h4><div class="rl-g">${L.map(([s,t,u,int])=>`<a href="${u}" ${int?'':'target="_blank" rel="noopener"'} data-holo><span class="mono">${s}</span><b>${esc(t)}</b><i aria-hidden="true">${int?'✦':'↗'}</i></a>`).join('')}</div></div>`}
const aiBlock=(m,d,y)=>`<div class="ai" data-m="${m}" data-d="${d}" data-y="${y||''}"><button class="btn ai-btn" ${SAMPLE?'':'hidden'}><span class="holo">✦</span> Find more with AI research</button><div class="ai-out" aria-live="polite"></div></div>`;
function otdResults(m,d,full=true){const ev=EVENTS.filter(e=>e.m===m&&e.d===d).sort((a,b)=>a.y-b.y);
  const head=`<div class="ev-yh mono"><span>${ev.length?`${ev.length} event${ev.length>1?'s':''} on file for ${MONTHS[m-1]} ${d}`:`No files for ${MONTHS[m-1]} ${d} yet`}</span><span>Click any event to open its day file</span></div>`;
  return head+(ev.length?ev.map(e=>evRow(e,false)).join(''):`<div class="empty" style="border:0;text-align:left"><b>The Market Time Machine hasn’t filed ${MONTHS[m-1]} ${d} yet.</b>Use the research links and AI leads below to find what happened.</div>`)+aiBlock(m,d)+(full?researchLinks(m,d):`<div class="ev-yh mono"><a class="lnk" href="#/on-this-date/${m}-${d}">Research tools and the full calendar →</a></div>`)}
function yearResults(y){const ev=YEV.filter(e=>e.y===y).sort((a,b)=>(a.m*40+a.d)-(b.m*40+b.d));const g=`<a class="lnk" href="${aiHref(`Give a financial and economic history of the year ${y}: markets, money, crises and major events.`)}">✦ Research about ${y}</a>`;
  if(!ev.length){const yrs=[...new Set(YEV.map(e=>e.y))].sort((a,b)=>Math.abs(a-y)-Math.abs(b-y)).slice(0,4).sort((a,b)=>a-b);
    return `<div class="empty" style="border:0"><b>No files for ${y} yet.</b>Nearest years on file: ${yrs.map(v=>`<button class="lnk" data-year="${v}">${v}</button>`).join(', ')}.<br><br>${g}</div>`}
  return `<div class="ev-yh mono"><span>${ev.length} event${ev.length>1?'s':''} filed in ${y}</span>${g}</div>`+ev.map(e=>evRow(e,true)).join('')}
function dayMatches(y,m,d){return YEV.filter(e=>e.y===y&&e.m===m&&e.d===d)}
function dayPreview(y,m,d){if(!validDay(y,m,d))return `<div class="empty" style="border:0"><b>That date doesn’t exist.</b>Pick a real calendar day.</div>`;
  const ev=dayMatches(y,m,d),wd=WD[utc(y,m,d).getUTCDay()];
  return `<div class="ev-yh mono"><span>${wd}, ${MONTHS[m-1]} ${d}, ${y} · ${ev.length} event${ev.length===1?'':'s'} on this exact day</span><a class="lnk" href="#/day/${isoOf(y,m,d)}">Open the full day file →</a></div>${ev.map(e=>evRow(e,false)).join('')||`<div class="empty" style="border:0;text-align:left"><b>Nothing filed for this exact day yet.</b>The day file shows the surrounding week, the same date in other years, and research tools.</div>`}`}
function calendar(sel){return `<div class="cal" role="grid" aria-label="Coverage calendar">${MONTHS.map((mn,mi)=>`<div class="cal-r" role="row"><span class="cal-m mono">${mn.slice(0,3)}</span>${Array.from({length:31},(_,di)=>{const m=mi+1,d=di+1;if(d>DIM[mi])return `<i class="cal-x"></i>`;const n=MDCOUNT[m+'-'+d]||0;return `<button role="gridcell" class="cal-c l${Math.min(n,4)}${sel&&sel.m===m&&sel.d===d?' on':''}" data-cal="${m}-${d}" aria-label="${mn} ${d}: ${n} event${n===1?'':'s'}" title="${mn} ${d} · ${n} on file"></button>`}).join('')}</div>`).join('')}
  <div class="cal-k mono"><span>${COVERED} of 366 dates on file · ${EVENTS.length} dated events</span><span class="cal-lg">Fewer <i class="cal-c l0"></i><i class="cal-c l1"></i><i class="cal-c l2"></i><i class="cal-c l3"></i><i class="cal-c l4"></i> More</span></div></div>`}
const FAMOUS=[['1873-09-30','NYSE reopens'],['1929-10-29','Black Tuesday'],['1971-08-15','Gold window'],['1987-10-19','Black Monday'],['2008-09-15','Lehman'],['2009-01-03','Genesis block'],['2020-03-16','Pandemic crash']];
function otdWidget(st,full){return `<div class="otd" id="otd"><div class="otd-ctl">
  <div class="otd-mode" role="tablist" aria-label="Explore by"><button role="tab" data-om="date" aria-selected="${st.mode==='date'}">Date</button><button role="tab" data-om="day" aria-selected="${st.mode==='day'}">Exact day</button><button role="tab" data-om="year" aria-selected="${st.mode==='year'}">Year</button></div>
  <div class="otd-big"><small id="otd-s"></small><span id="otd-l" class="holo"></span></div>
  <div id="otd-dc"><div class="otd-sel"><label class="sr" for="otd-m">Month</label><select class="sel" id="otd-m">${MONTHS.map((n,i)=>`<option value="${i+1}">${n}</option>`).join('')}</select><label class="sr" for="otd-d">Day</label><select class="sel" id="otd-d"></select></div>
    <div class="otd-nav" style="margin-top:8px"><button class="btn" data-otd="-1" aria-label="Previous day">← Prev</button><button class="btn" data-otd="0">Today</button><button class="btn" data-otd="1" aria-label="Next day">Next →</button></div></div>
  <div id="otd-xc"><label class="sr" for="otd-x">Exact day</label><input class="inp mono otd-x" id="otd-x" type="date" min="0001-01-01" max="2100-12-31"><button class="btn btn-p" id="otd-go" style="justify-content:center;height:44px">Open day file →</button>
    <div class="otd-eras">${FAMOUS.map(([dt,l])=>`<button class="tag" data-day="${dt}">${l}</button>`).join('')}</div><small class="otd-h">Any day from year 1 to today. Earlier dates have fewer records.</small></div>
  <div id="otd-yc"><div class="otd-yr"><button class="btn" data-oy="-1" aria-label="Previous year">←</button><label class="sr" for="otd-y">Year</label><input class="inp mono" id="otd-y" type="number" min="1" max="2100" inputmode="numeric"><button class="btn" data-oy="1" aria-label="Next year">→</button></div>
    <div class="otd-eras">${[1602,1720,1792,1873,1907,1929,1971,1987,2000,2008,2020,2024].map(y=>`<button class="tag" data-year="${y}">${y}</button>`).join('')}</div><small class="otd-h">Type any year and press Enter.</small></div>
  ${full?'':'<a class="sec-a" href="#/on-this-date" style="margin-top:auto;color:var(--tx2)">Open the full explorer and calendar →</a>'}</div><div class="otd-res" id="otd-res" aria-live="polite"></div></div>`}
function wireOTD(st,full){const S={...st};const ms=$('#otd-m'),ds=$('#otd-d'),yi=$('#otd-y'),xi=$('#otd-x');
  const fillDays=()=>{const n=DIM[S.m-1];if(S.d>n)S.d=n;ds.innerHTML=Array.from({length:n},(_,i)=>`<option ${i+1===S.d?'selected':''}>${i+1}</option>`).join('')};
  const upd=()=>{const md=S.mode;$('#otd-dc').hidden=md!=='date';$('#otd-yc').hidden=md!=='year';$('#otd-xc').hidden=md!=='day';$$('[data-om]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.om===md)));
    $('#otd-s').textContent=md==='date'?'ON THIS DATE IN MARKETS':md==='year'?'THIS YEAR IN MARKETS':'ONE DAY IN MARKETS';
    $('#otd-l').textContent=md==='date'?`${MONTHS[S.m-1]} ${S.d}`:md==='year'?String(S.y):`${MONTHS[S.m-1].slice(0,3)} ${S.d}, ${S.xy}`;
    ms.value=S.m;fillDays();yi.value=S.y;xi.value=isoOf(S.xy,S.m,S.d);
    $('#otd-res').innerHTML=md==='date'?otdResults(S.m,S.d,full):md==='year'?yearResults(S.y):dayPreview(S.xy,S.m,S.d);wireAI($('#otd-res'));attachHolo();
    $$('.cal-c.on').forEach(c=>c.classList.remove('on'));if(md!=='year')$(`[data-cal="${S.m}-${S.d}"]`)?.classList.add('on');
    if(full)history.replaceState(null,'',md==='date'?`#/on-this-date/${S.m}-${S.d}`:md==='year'?`#/on-this-date/year/${S.y}`:`#/on-this-date/day/${isoOf(S.xy,S.m,S.d)}`)};
  $$('[data-om]').forEach(b=>b.onclick=()=>{S.mode=b.dataset.om;upd()});
  ms.onchange=()=>{S.m=+ms.value;upd()};ds.onchange=()=>{S.d=+ds.value;upd()};
  $$('[data-otd]').forEach(b=>b.onclick=()=>{const k=+b.dataset.otd;if(!k){const t=new Date();S.m=t.getMonth()+1;S.d=t.getDate()}else{const t=new Date(2024,S.m-1,S.d+k);S.m=t.getMonth()+1;S.d=t.getDate()}upd()});
  const setY=v=>{v=Math.round(+v);if(!v||v<1||v>2100){yi.setCustomValidity('Enter a year between 1 and 2100');yi.reportValidity();return}yi.setCustomValidity('');S.y=v;upd()};
  yi.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();setY(yi.value)}};yi.onchange=()=>setY(yi.value);$$('[data-oy]').forEach(b=>b.onclick=()=>setY(S.y+ +b.dataset.oy));
  const setX=()=>{const [y,m,d]=(xi.value||'').split('-').map(Number);if(validDay(y,m,d)){S.xy=y;S.m=m;S.d=d;upd()}};xi.onchange=setX;
  $('#otd-go').onclick=()=>{setX();location.hash=`#/day/${isoOf(S.xy,S.m,S.d)}`};
  const root=$('#otd').parentElement;root.addEventListener('click',e=>{const y=e.target.closest('[data-year]'),c=e.target.closest('[data-cal]'),dy=e.target.closest('[data-day]');
    if(y){S.mode='year';setY(y.dataset.year)}
    if(c){const [m,d]=c.dataset.cal.split('-').map(Number);S.m=m;S.d=d;if(S.mode==='year')S.mode='date';upd();$('#otd').scrollIntoView({behavior:RM?'auto':'smooth',block:'nearest'})}
    if(dy){location.hash=`#/day/${dy.dataset.day}`}});
  upd()}
let OTDST=null;

/* ---------- day file ---------- */
function pageDay(iso){const [y,m,d]=(iso||'').split('-').map(Number);if(!validDay(y,m,d))return notFound();
  const t=utc(y,m,d),wd=WD[t.getUTCDay()],now=new Date();const ago=Math.round((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-t.getTime())/864e5);
  const agoTxt=ago>730?`${Math.floor(ago/365.2425)} years ago`:ago>60?`${Math.round(ago/30.44)} months ago`:ago>=0?`${ago} days ago`:'In the future';
  const exact=dayMatches(y,m,d);const wk=YEV.filter(e=>e.m&&!(e.y===y&&e.m===m&&e.d===d)&&Math.abs((utc(e.y,e.m,e.d)-t)/864e5)<=7).sort((a,b)=>utc(a.y,a.m,a.d)-utc(b.y,b.m,b.d));
  const same=EVENTS.filter(e=>e.m===m&&e.d===d&&e.y!==y).sort((a,b)=>a.y-b.y);const yr=YEV.filter(e=>e.y===y).length;
  const [py,pm,pd]=shiftDay(y,m,d,-1),[ny2,nm,nd]=shiftDay(y,m,d,1);const full=`${MONTHS[m-1]} ${d}, ${y}`;
  setMeta(`${full} in market history — Market Files`,`What happened in markets on ${wd}, ${full}.`);
  const wkRow=e=>{const dd=Math.round((utc(e.y,e.m,e.d)-t)/864e5);return evRow(e,true).replace('</h3>',`</h3><span class="rel mono">${dd>0?'+':''}${dd} day${Math.abs(dd)===1?'':'s'}</span>`)};
  return `<div class="wrap page-in" style="--dc:var(--gold)">
  <header class="ph serif day-h"><p class="mono dim">DAY FILE · ${isoOf(y,m,d)} · ${agoTxt.toUpperCase()}</p><h1 class="holo">${wd}, ${full}</h1>
    <div class="day-nav"><a class="btn" href="#/day/${isoOf(py,pm,pd)}">← ${MONTHS[pm-1].slice(0,3)} ${pd}</a><label class="sr" for="day-x">Go to date</label><input class="inp mono" type="date" id="day-x" value="${isoOf(y,m,d)}" min="0001-01-01" max="2100-12-31"><a class="btn" href="#/day/${isoOf(ny2,nm,nd)}">${MONTHS[nm-1].slice(0,3)} ${nd} →</a><a class="btn" href="#/on-this-date/${m}-${d}">All ${MONTHS[m-1]} ${d}s</a><a class="btn" href="#/on-this-date/year/${y}">All of ${y} (${yr})</a></div></header>
  <div class="day-g">
    <div>
      <section class="dsec"><h2>On this exact day ${CAN_EDIT&&DB?`<button class="btn ed-add" data-addday="${isoOf(y,m,d)}">＋ Add event</button>`:''}</h2>${exact.filter(e=>e.summary||e.source).map(e=>`<div class="evd" data-holo><p class="mono dim">${DESKS[e.desk].name.toUpperCase()} · ${stamp(e.status)}</p><h3>${esc(e.head)}</h3>${e.summary?`<p>${esc(e.summary)}</p>`:''}${e.source?`<p class="mono evd-s">SOURCE · ${esc(e.source)}${e.doc?' — '+esc(e.doc):''} ${e.url?`<a class="lnk" href="${esc(e.url)}" target="_blank" rel="noopener">Open ↗</a>`:''}</p>`:''}</div>`).join('')}${exact.length?`<div class="otd-res">${exact.map(e=>evRow(e,false)).join('')}</div>`:`<div class="empty" style="text-align:left"><b>Nothing filed for ${full} yet.</b>Check the week around it, ask for AI leads, or use the research tools to find the record.</div>`}</section>
      <section class="dsec"><h2>The week around it</h2>${wk.length?`<div class="otd-res">${wk.map(wkRow).join('')}</div>`:'<p class="dim">No other files within seven days of this date.</p>'}</section>
      <section class="dsec"><h2>AI research leads</h2><p class="dim" style="margin-bottom:12px">Leads are drafted by AI from memory and are unverified. Check every one against a primary source before it becomes a file.</p>${aiBlock(m,d,y)}</section>
      <section class="dsec"><h2>${MONTHS[m-1]} ${d} in other years</h2>${same.length?`<div class="otd-res">${same.map(e=>evRow(e,false)).join('')}</div>`:'<p class="dim">No other years filed for this date yet.</p>'}</section>
    </div>
    <aside class="rail">${researchLinks(m,d,y)}<div class="rbox"><h3>This day</h3><ul><li><span class="d">Weekday</span><span>${wd}</span></li><li><span class="d">Age</span><span>${agoTxt}</span></li><li><span class="d">Era</span><span>${(ERAS.find(e=>y>=e.from&&y<=e.to)||{label:'Before 1600'}).label}</span></li><li><span class="d">Year files</span><span>${yr} in ${y}</span></li></ul></div></aside>
  </div></div>`}
function afterDay(){const x=$('#day-x');if(x)x.onchange=()=>{const [y,m,d]=x.value.split('-').map(Number);if(validDay(y,m,d))location.hash=`#/day/${isoOf(y,m,d)}`};wireAI($('#main'))}

/* ---------- AI research leads (optional; uses the viewer's Claude via the sample capability) ---------- */
let SAMPLE=null;
(async()=>{try{if(window.claude&&window.claude.use){SAMPLE=await window.claude.use('sample');if(SAMPLE)$$('.ai-btn').forEach(b=>b.hidden=false)}}catch(e){SAMPLE=null}})();
const AIERR={not_granted:'AI research was declined for this view.',rate_limited:'Too many requests right now — try again in a minute.',cancelled:'Stopped.'};
function wireAI(root){if(!root)return;$$('.ai',root).forEach(box=>{const b=$('.ai-btn',box);if(!b||b._w)return;b._w=1;b.onclick=async()=>{if(!SAMPLE)return;
  const m=+box.dataset.m,d=+box.dataset.d,y=+box.dataset.y||0,out=$('.ai-out',box);const when=y?`${MONTHS[m-1]} ${d}, ${y} (exactly that day)`:`${MONTHS[m-1]} ${d}, in any year`;
  b.disabled=true;out.innerHTML='<p class="ai-wait mono">Researching…</p>';
  const prompt=`You are a research assistant for Market Files, a financial-history newsroom that never publishes unverified facts.
List up to 6 notable events in financial and market history — stock markets, banking, central banks, currencies, commodities, sovereign debt, financial crises, major deals, regulation, Bitcoin and blockchain — that happened on ${when}.
Rules: include an event ONLY if you are confident it happened on exactly that calendar date. If unsure of the exact day, leave it out. Do not invent events. It is fine to return fewer or none.
Reply with only a JSON array, no prose. Each item: {"date":"YYYY-MM-DD","headline":"short plain headline","region":"country or market","confidence":"high" or "medium","verify":"best primary source to check"}.
Example: [{"date":"1929-10-29","headline":"Black Tuesday: heavy selling deepens the Great Crash","region":"United States","confidence":"high","verify":"NYSE records; contemporaneous newspapers"}]`;
  try{let arr=await SAMPLE.json(prompt,{modelTier:'default'});if(!Array.isArray(arr))arr=[];
    out.innerHTML=arr.length?`<ul class="ai-l">${arr.slice(0,6).map(r=>{const [ry,rm,rd]=String(r.date||'').split('-').map(Number);const ok=validDay(ry,rm,rd);const onfile=ok&&YEV.some(e=>e.y===ry&&e.m===rm&&e.d===rd);
      return `<li><span class="ev-y ev-md">${ok?ry:'—'}</span><div><b>${esc(r.headline||'')}</b><span class="meta"><span>${esc(r.region||'')}</span><span>Check: ${esc(r.verify||'primary sources')}</span></span></div><div class="ai-a"><span class="stamp ${r.confidence==='high'?'review':'pending'}">Unverified lead</span>${onfile?'<span class="stamp verified">On file</span>':''}${ok?`<a class="lnk" href="#/day/${isoOf(ry,rm,rd)}">Day file</a>`:''}</div></li>`}).join('')}</ul>`:'<p class="dim">No confident leads for this date. Try the research links.</p>'}
  catch(e){out.innerHTML=`<p class="dim">${AIERR[e&&e.code]||'Couldn’t get leads right now. Use the research links instead.'}</p>`;if(e&&e.code==='not_granted')b.hidden=true}
  finally{b.disabled=false}}})}


/* =========================================================================
   PAGES
   ========================================================================= */
/* ---------- search the market files (site + Google) ---------- */
const PRESS_SITES=['wsj.com','ft.com','bloomberg.com','nytimes.com','economist.com','reuters.com','cnbc.com','marketwatch.com','finance.yahoo.com'];
const WEB={google:{l:'Google',u:q=>`https://www.google.com/search?q=${encodeURIComponent(q)}`},news:{l:'Google News',u:q=>`https://news.google.com/search?q=${encodeURIComponent(q)}`},press:{l:'the Newsstand',u:q=>`https://www.google.com/search?q=${encodeURIComponent(q+' ('+PRESS_SITES.map(x=>'site:'+x).join(' OR ')+')')}`}};
function siteMatches(q,n=5){const t=q.toLowerCase().split(/\s+/).filter(Boolean);if(!t.length)return[];const hay=a=>[a.head,a.deck,a.loc,a.cat,a.y,fmtD(a),a.crisis,...a.inst,...a.people,...a.assets,...a.countries,deskOf(a).name].join(' ').toLowerCase();return A.filter(a=>t.every(w=>hay(a).includes(w))).slice(0,n)}
const aiHref=q=>`#/search?q=${encodeURIComponent(q)}&ai=1`;
function searchBar(id){return `<div class="msearch" id="${id}" role="search">
  <div class="ms-box"><img src="${LOGO72}" alt="" width="26" height="26" class="ms-logo"><label class="sr" for="${id}-i">Search the Market Files here</label><input id="${id}-i" placeholder="Search the Market Files here — or ask Market Files AI anything financial" autocomplete="off" aria-controls="${id}-d" aria-expanded="false">
  <a class="ms-go" id="${id}-go" href="#/search">Search</a></div>
  <div class="ms-drop" id="${id}-d" hidden></div>
  <p class="ms-hint">Try <button type="button" data-try="Panic of 1907">Panic of 1907</button> <button type="button" data-try="Why did the yen carry trade unwind?">Why did the yen carry trade unwind?</button> <button type="button" data-try="Oct 19 1987">Oct 19 1987</button> <button type="button" data-try="How do central banks fight inflation?">How do central banks fight inflation?</button></p></div>`}
function wireSearchBar(id){const root=$('#'+id);if(!root)return;const inp=$(`#${id}-i`),go=$(`#${id}-go`),drop=$(`#${id}-d`);
  const sync=()=>{const q=inp.value.trim();go.href=q?aiHref(q):'#/search';if(!q){drop.hidden=true;inp.setAttribute('aria-expanded','false');return}
    const sg=suggest(q);drop.innerHTML=`<a href="${aiHref(q)}" class="ms-ai"><span class="holo">✦</span><span>Research “${esc(q)}”</span><span class="mono">AI</span></a>${sg.length?`<div class="ms-sec">In the Market Files</div>${sg.map(x=>x.inst?`<button type="button" class="ms-sg" data-inst="${x.inst}"><span class="mono">LIVE</span><span>${esc(x.t)}</span><span class="dk">${esc(x.k)}</span></button>`:`<a href="${x.href}"><span class="mono">${esc(x.k.split(' ')[0].toUpperCase())}</span><span>${esc(x.t)}</span><span class="dk">${esc(x.k)}</span></a>`).join('')}`:''}<a href="#/search?q=${encodeURIComponent(q)}" class="ms-all">See all Market Files results for “${esc(q)}”</a>`;
    drop.hidden=false;inp.setAttribute('aria-expanded','true')};
  $$('[data-try]',root).forEach(b=>b.onclick=()=>{inp.value=b.dataset.try;sync();inp.focus()});
  drop.onclick=e=>{const b=e.target.closest('[data-inst]');if(b){drop.hidden=true;openInst(b.dataset.inst)}};
  inp.oninput=sync;inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();const q=inp.value.trim();if(q)location.hash=aiHref(q)}if(e.key==='Escape')drop.hidden=true};
  const off=e=>{if(!root.contains(e.target))drop.hidden=true};document.addEventListener('click',off);cleanup.push(()=>document.removeEventListener('click',off));sync()}

/* ---------- world exchanges (local clocks and status are real; holidays not modeled) ---------- */
const EXCH={CME:{city:'Chicago',tz:'America/Chicago',globex:true},ASX:{city:'Sydney',tz:'Australia/Sydney',o:600,c:960},TSE:{city:'Tokyo',tz:'Asia/Tokyo',o:540,c:930,l:[690,750]},SSE:{city:'Shanghai',tz:'Asia/Shanghai',o:570,c:900,l:[690,780]},HKEX:{city:'Hong Kong',tz:'Asia/Hong_Kong',o:570,c:960,l:[720,780]},BSE:{city:'Mumbai',tz:'Asia/Kolkata',o:555,c:930},XETRA:{city:'Frankfurt',tz:'Europe/Berlin',o:540,c:1050},PAR:{city:'Paris',tz:'Europe/Paris',o:540,c:1050},LSE:{city:'London',tz:'Europe/London',o:480,c:990},NYSE:{city:'New York',tz:'America/New_York',o:570,c:960},TSX:{city:'Toronto',tz:'America/Toronto',o:570,c:960},B3:{city:'São Paulo',tz:'America/Sao_Paulo',o:600,c:1020}};
function exState(k){const e=EXCH[k];const o={};new Intl.DateTimeFormat('en-GB',{timeZone:e.tz,weekday:'short',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date()).forEach(p=>o[p.type]=p.value);
  const h=(+o.hour)%24,m=h*60+ +o.minute,time=`${pad(h)}:${o.minute}`;const dur=x=>x>=60?`${Math.floor(x/60)}h ${x%60}m`:`${x}m`;
  if(e.globex){const wd=o.weekday;if(wd==='Sat'||(wd==='Sun'&&m<1020))return{c:'',t:wd==='Sun'?`Opens in ${dur(1020-m)}`:'Closed',time};if(wd==='Fri'&&m>=960)return{c:'',t:'Closed',time};if(m>=960&&m<1020)return{c:'pre',t:`Daily break · ${dur(1020-m)}`,time};return{c:'open',t:'Globex open',time}}
  if(o.weekday==='Sat'||o.weekday==='Sun')return{c:'',t:'Closed',time};
  if(e.l&&m>=e.l[0]&&m<e.l[1])return{c:'pre',t:'Lunch break',time};
  if(m>=e.o&&m<e.c)return{c:'open',t:`Open · ${dur(e.c-m)} left`,time};
  if(m<e.o)return{c:'',t:`Opens in ${dur(e.o-m)}`,time};return{c:'',t:'Closed',time}}
const clockHTML=()=>Object.entries(EXCH).map(([k,e])=>{const s=exState(k);return `<div class="clk ${s.c}" data-ex="${k}"><span class="clk-c">${e.city} <small class="mono">${k}</small></span><span class="clk-t mono">${s.time}</span><span class="sess ${s.c}"><i></i>${s.t}</span></div>`}).join('');
function refreshClocks(){const oc=$('#opencount');if(oc)oc.textContent=Object.keys(EXCH).filter(k=>exState(k).c==='open').length;$$('[data-ex]').forEach(el=>{const k=el.dataset.ex,s=exState(k);el.className=`clk ${s.c}`;$('.clk-t',el).textContent=s.time;$('.sess',el).className=`sess ${s.c}`;$('.sess',el).innerHTML=`<i></i>${s.t}`});
  $$('[data-exdot]').forEach(el=>{const s=exState(el.dataset.exdot);el.className=`exdot ${s.c}`;el.title=`${el.dataset.exdot}: ${s.t}`})}

/* ---------- terminal widgets ---------- */
let CHART='SPX';
function bigChart(q){const s=q.intra,all=[...s,q.prev],mn=Math.min(...all),mx=Math.max(...all),rg=(mx-mn)||1,Y=v=>(6+(1-(v-mn)/rg)*268).toFixed(1),X=i=>(i/78*1000).toFixed(1);
  const n=Math.min(s.length,79);const d=s.slice(0,n).map((v,i)=>`${i?'L':'M'}${X(i)},${Y(v)}`).join('');const up=q.v>=q.prev,col=up?'#2FBF77':'#E5534B';
  let grid='';for(let i=0;i<=4;i++)grid+=`<line x1="0" x2="1000" y1="${6+i*67}" y2="${6+i*67}" style="stroke:var(--line)"/>`;
  return `<svg viewBox="0 0 1000 280" preserveAspectRatio="none" class="bigsvg" aria-label="${esc(q.name)} intraday chart, simulated"><defs><linearGradient id="bcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".22"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>${grid}<line x1="0" x2="1000" y1="${Y(q.prev)}" y2="${Y(q.prev)}" stroke="#7A869A" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/><path d="${d}L${X(n-1)},280L0,280Z" fill="url(#bcg)"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/><circle cx="${X(n-1)}" cy="${Y(s[n-1])}" r="4" fill="${col}"/></svg>
  <div class="ch-ax mono">${Feed.live?'<span>Earlier</span><span>Now</span>':'<span>9:30</span><span>11:00</span><span>12:30</span><span>14:00</span><span>16:00 ET</span>'}</div><div class="ch-lg mono"><span>High ${Math.max(...s).toLocaleString('en-US',{maximumFractionDigits:2})}</span><span>Low ${Math.min(...s).toLocaleString('en-US',{maximumFractionDigits:2})}</span><span>Prev close ${q.prev.toLocaleString('en-US',{maximumFractionDigits:2})} <i class="dash"></i></span></div>`}
function yieldCurve(){const T=[['US2Y','2Y'],['US5Y','5Y'],['US10Y','10Y'],['US30Y','30Y']].map(([id,l])=>({q:INSTR.find(x=>x.id===id),l}));const vals=T.flatMap(t=>[t.q.v,t.q.prev]),mn=Math.min(...vals)-.08,mx=Math.max(...vals)+.08,Y=v=>(20+(1-(v-mn)/(mx-mn))*150).toFixed(1),X=i=>60+i*160;
  const line=k=>T.map((t,i)=>`${i?'L':'M'}${X(i)},${Y(t.q[k])}`).join('');
  return `<svg viewBox="0 0 600 210" class="ycsvg" aria-label="U.S. Treasury yield curve, simulated"><path d="${line('prev')}" fill="none" stroke="#7A869A" stroke-dasharray="4 5"/><path d="${line('v')}" fill="none" stroke="#4C8DFF" stroke-width="2.5"/>${T.map((t,i)=>`<circle cx="${X(i)}" cy="${Y(t.q.v)}" r="5" fill="#4C8DFF"/><text x="${X(i)}" y="${+Y(t.q.v)-12}" text-anchor="middle" style="fill:var(--tx)" font-family="IBM Plex Mono,monospace" font-size="15">${t.q.v.toFixed(2)}%</text><text x="${X(i)}" y="202" text-anchor="middle" fill="#7A869A" font-family="IBM Plex Mono,monospace" font-size="14">${t.l}</text>`).join('')}</svg><div class="ch-lg mono"><span><i class="lg-solid"></i> Now</span><span><i class="dash"></i> Prior close</span><span>2s10s ${((INSTR.find(x=>x.id==='US10Y').v-INSTR.find(x=>x.id==='US2Y').v)*100).toFixed(0)}bp</span></div>`}
const qs=ids=>ids.map(id=>INSTR.find(x=>x.id===id)).filter(Boolean);
const TV={ES1:'CME_MINI:ES1!',NQ1:'CME_MINI:NQ1!',YM1:'CBOT_MINI:YM1!',RTY1:'CME_MINI:RTY1!',ZT1:'CBOT:ZT1!',ZN1:'CBOT:ZN1!',ZB1:'CBOT:ZB1!',CL1:'NYMEX:CL1!',BZ1:'NYMEX:BZ1!',NG1:'NYMEX:NG1!',RB1:'NYMEX:RB1!',GC1:'COMEX:GC1!',SI1:'COMEX:SI1!',HG1:'COMEX:HG1!',PL1:'NYMEX:PL1!',ZC1:'CBOT:ZC1!',ZS1:'CBOT:ZS1!',ZW1:'CBOT:ZW1!',LE1:'CME:LE1!',KC1:'ICEUS:KC1!',SB1:'ICEUS:SB1!','6E1':'CME:6E1!','6J1':'CME:6J1!','6B1':'CME:6B1!',BTC1:'CME:BTC1!',ETH1:'CME:ETH1!',VX1:'CBOE:VX1!',SPX:'SP:SPX',COMP:'NASDAQ:IXIC',INDU:'DJ:DJI',RUT:'TVC:RUT',VIX:'CBOE:VIX',US2Y:'TVC:US02Y',US5Y:'TVC:US05Y',US10Y:'TVC:US10Y',US30Y:'TVC:US30Y',XAU:'TVC:GOLD',XAG:'TVC:SILVER',CL:'TVC:USOIL',HG:'COMEX:HG1!',EURUSD:'FX:EURUSD',USDJPY:'FX:USDJPY',GBPUSD:'FX:GBPUSD',DXY:'TVC:DXY',USDCNY:'FX_IDC:USDCNY',USDCHF:'FX:USDCHF',AUDUSD:'FX:AUDUSD',BTC:'BITSTAMP:BTCUSD',ETH:'BITSTAMP:ETHUSD',SOL:'COINBASE:SOLUSD',XRP:'BITSTAMP:XRPUSD',BNB:'BINANCE:BNBUSDT',DOGE:'BINANCE:DOGEUSDT',ADA:'COINBASE:ADAUSD',LINK:'COINBASE:LINKUSD',UKX:'TVC:UKX',DAX:'XETR:DAX',CAC:'EURONEXT:PX1',SX5E:'TVC:SX5E',NKY:'TVC:NI225',HSI:'TVC:HSI',SHCOMP:'SSE:000001',SENSEX:'BSE:SENSEX',AS51:'ASX:XJO',TSX:'TSX:TSX',IBOV:'BMFBOVESPA:IBOV',DE10Y:'TVC:DE10Y',GB10Y:'TVC:GB10Y',JP10Y:'TVC:JP10Y',FR10Y:'TVC:FR10Y',IT10Y:'TVC:IT10Y'};
const tvUrl=id=>`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(TV[id]||'AMEX:'+id)}`;
const CMC={BTC:'bitcoin',ETH:'ethereum',XRP:'xrp',BNB:'bnb',SOL:'solana',DOGE:'dogecoin',ADA:'cardano',LINK:'chainlink'};
const cmcUrl=id=>`https://coinmarketcap.com/currencies/${CMC[id]}/`;
const CRC={BTC:'#F2A03D',ETH:'#8E7CF7',XRP:'#4C8DFF',BNB:'#C9A55C',SOL:'#2FBF77',DOGE:'#B8A26A',ADA:'#3E6BD8',LINK:'#6F8BFF'};
const mcap=q=>q.mc??q.v*q.sup;
const fmtCap=v=>v>=1e12?`$${(v/1e12).toFixed(2)}T`:v>=1e9?`$${(v/1e9).toFixed(1)}B`:`$${(v/1e6).toFixed(0)}M`;
const rowAttr=q=>`tabindex="0" role="button" aria-label="${esc(q.name)} — open details"`;
function chartPanel(){const q=INSTR.find(x=>x.id===CHART),c=chg(q);return `<div class="ch-tabs" role="tablist">${['SPX','COMP','INDU','RUT'].map(id=>{const x=INSTR.find(i=>i.id===id);return `<button role="tab" data-chart="${id}" aria-selected="${id===CHART}">${x.name}</button>`}).join('')}<a class="tvb" href="${tvUrl(CHART)}" target="_blank" rel="noopener">Open in TradingView ↗</a></div>
  <div class="ch-head" data-id="${q.id}"><div><span class="ch-n">${esc(q.name)} · intraday</span><span class="ch-v mono" data-f="v">${fmtV(q)}</span></div><span class="ch-c mono c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</span></div>
  <div class="chwrap" id="chwrap"><div id="bigchart">${bigChart(q)}</div><div class="xh" id="xh" hidden><i></i><span class="mono"></span></div></div>`}
function heatTile(q){const p=(q.v-q.prev)/q.prev*100,a=Math.min(.85,.14+Math.abs(p)/2.2),bg=p>=0?`rgba(47,191,119,${a.toFixed(2)})`:`rgba(229,83,75,${a.toFixed(2)})`;return `<div class="ht" data-heat="${q.id}" ${rowAttr(q)} style="background:${bg}"><b>${esc(q.name)}</b><span class="mono">${q.id}</span><span class="mono ht-p">${p>=0?'+':''}${p.toFixed(2)}%</span></div>`}
const breadth=()=>{const s=INSTR.filter(q=>q.g==='sec');return `${s.filter(q=>q.v>=q.prev).length}/${s.length} up`};
function idxRow(q){const c=chg(q);return `<div class="q" data-id="${q.id}" ${rowAttr(q)}><span class="n">${q.ex?`<i class="exdot" data-exdot="${q.ex}"></i>`:''}${esc(q.name)}</span>${spark(q)}<span class="v" data-f="v">${fmtV(q)}</span><span class="c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</span></div>`}
const pnl=(title,rows,right='')=>`<section class="pnl" data-holo><div class="pnl-h"><h3>${title}</h3>${right}</div>${rows}</section>`;
const coins=()=>INSTR.filter(q=>q.g==='cr'&&q.sup).sort((a,b)=>mcap(b)-mcap(a));
function cryptoTable(){return `<table class="crt"><thead><tr><th>#</th><th>Coin</th><th>Price</th><th>24h</th><th>7d</th><th>Market cap</th><th><span class="sr">Links</span></th></tr></thead><tbody>${coins().map((q,i)=>{const c=chg(q);return `<tr class="cr-row" data-id="${q.id}" ${rowAttr(q)}><td class="mono dim">${i+1}</td><td><i class="cdot" style="background:${CRC[q.id]}"></i><b>${esc(q.name)}</b> <span class="mono dim">${q.id}</span></td><td class="mono" data-f="v">$${fmtV(q)}</td><td class="mono c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</td><td>${spark(q)}</td><td class="mono" data-mc="${q.id}">${fmtCap(mcap(q))}</td><td class="lks"><a href="${cmcUrl(q.id)}" target="_blank" rel="noopener">CMC ↗</a><a href="${tvUrl(q.id)}" target="_blank" rel="noopener">TV ↗</a></td></tr>`}).join('')}</tbody></table>`}
function crShare(){const cs=coins(),tot=cs.reduce((s,q)=>s+mcap(q),0);return `<div class="crs-t"><span class="dim">Top ${cs.length} combined</span><b class="mono">${fmtCap(tot)}</b></div><div class="crs-bar">${cs.map(q=>`<i style="width:${(mcap(q)/tot*100).toFixed(2)}%;background:${CRC[q.id]}" title="${q.name}"></i>`).join('')}</div><ul class="crs-l">${cs.map(q=>`<li><i class="cdot" style="background:${CRC[q.id]}"></i>${q.id}<span class="mono">${(mcap(q)/tot*100).toFixed(1)}%</span></li>`).join('')}</ul><a class="btn" href="https://coinmarketcap.com/" target="_blank" rel="noopener" style="margin:14px">Full crypto market on CoinMarketCap ↗</a>`}
function terminal(){return `
  <div class="tsec-h" id="m-ws" style="--dc:#2FBF77"><h2>Wall Street</h2><div class="sec-a">${sessHTML('eq')}${handleLink(DESKS.wallst)}<a href="#/wall-street">Wall Street desk</a></div></div>
  <div class="ws-grid"><section class="pnl chartp" data-holo>${chartPanel()}</section>
    <div class="ws-side">${pnl('U.S. indices',qs(['SPX','COMP','INDU','RUT','VIX']).map(idxRow).join(''))}${pnl('Treasuries',qs(['US2Y','US5Y','US10Y','US30Y']).map(idxRow).join(''),sessHTML('rt'))}</div></div>
  <div class="ws-grid2">${pnl('S&amp;P 500 sectors',`<div class="heat">${INSTR.filter(q=>q.g==='sec').map(heatTile).join('')}<div class="ht ht-sum"><b>Breadth</b><span class="mono">11 SECTORS</span><span class="mono ht-p" id="breadth2">${breadth()}</span></div></div>`,`<span class="sess mono" id="breadth">${breadth()}</span>`)}${pnl('Yield curve',`<div id="yc">${yieldCurve()}</div>`)}${pnl('Commodities',qs(['XAU','XAG','CL','HG']).map(idxRow).join(''),sessHTML('cm'))}</div>
  <div class="tsec-h" id="m-gf" style="--dc:#4C8DFF"><h2>Global Finance</h2><div class="sec-a">${handleLink(DESKS.global)}<a href="#/global-finance">Global Finance desk</a></div></div>
  <div class="gf-top">
    <div class="clock" aria-label="World exchange clocks">${clockHTML()}<div class="clk clk-sum"><span class="clk-c">Open now</span><span class="clk-t mono" id="opencount">—</span><span class="sess">of ${Object.keys(EXCH).length} exchanges</span></div></div></div>
  <div class="gf-grid">${pnl('Americas',qs(['SPX','TSX','IBOV']).map(idxRow).join(''))}${pnl('Europe',qs(['UKX','DAX','CAC','SX5E']).map(idxRow).join(''))}${pnl('Asia-Pacific',qs(['NKY','HSI','SHCOMP','SENSEX','AS51']).map(idxRow).join(''))}${pnl('Currencies',qs(['DXY','EURUSD','USDJPY','GBPUSD','USDCNY','USDCHF','AUDUSD']).map(idxRow).join(''),sessHTML('fx'))}${pnl('10-year yields',qs(['US10Y','DE10Y','GB10Y','JP10Y','FR10Y','IT10Y']).map(idxRow).join(''))}</div>
  <div class="tsec-h" id="m-fu" style="--dc:#C9A55C"><h2>Futures</h2><div class="sec-a">${sessHTML('fu')}<a href="#/futures">All futures &amp; contract specs</a></div></div>
  ${window.MF_TV?tvFuturesBlock(false):''}<div class="fu-grid" ${window.MF_TV?'hidden':''}>${FUGROUPS.filter(g=>g.id!=='vol').map(g=>pnl(g.id==='cr'?'Crypto &amp; volatility':g.name,INSTR.filter(q=>q.fut&&(q.fg===g.id||(g.id==='cr'&&q.fg==='vol'))).map(idxRow).join(''),`<span class="sess mono">${[...new Set(INSTR.filter(q=>q.fut&&q.fg===g.id).map(q=>q.fx))].join(' · ')}</span>`)).join('')}${pnl('Futures signal',`<div id="fu-sig">${fuSig()}</div>`)}</div>
  <div class="tsec-h" id="m-cr" style="--dc:#F2A03D"><h2>Crypto</h2><div class="sec-a">${sessHTML('cr')}${handleLink(DESKS.btc)}${handleLink(DESKS.chain)}</div></div>
  <div class="cr-grid"><section class="pnl" data-holo><div class="pnl-h"><h3>Top coins by market cap</h3><span class="sess">Links open CoinMarketCap and TradingView</span></div><div class="tscroll">${cryptoTable()}</div></section><section class="pnl" data-holo><div class="pnl-h"><h3>Market-cap share</h3></div><div id="crshare">${crShare()}</div></section></div>
  <div class="board-foot"><span>Prices: ${Feed.name} placeholder values — the live provider plugs into the market-data layer. Exchange clocks and open/closed status are real (holidays not modeled). Click any instrument for details.</span><span><a href="#/markets" style="color:var(--tx2)">Full market board →</a></span></div>`}
function wireChart(){const w=$('#chwrap');if(!w)return;const xh=$('#xh');
  w.onpointermove=e=>{const svg=$('.bigsvg',w);const r=svg.getBoundingClientRect();const f=(e.clientX-r.left)/r.width;if(f<0||f>1){xh.hidden=true;return}const q=INSTR.find(x=>x.id===CHART);const i=Math.round(f*78);if(i>=q.intra.length){xh.hidden=true;return}
    const mins=570+i*5;xh.hidden=false;xh.style.left=(r.left-w.getBoundingClientRect().left+i/78*r.width)+'px';$('span',xh).textContent=`${Math.floor(mins/60)}:${pad(mins%60)} ET · ${q.intra[i].toLocaleString('en-US',{maximumFractionDigits:2})}`};
  w.onpointerleave=()=>xh.hidden=true}
function wireTerminal(){if(window.MF_TV)mountTVFutures();$$('[data-chart]').forEach(b=>b.onclick=()=>{CHART=b.dataset.chart;b.closest('.chartp').innerHTML=chartPanel();wireTerminal();refreshClocks()});wireChart();attachHolo()}
function terminalTick(q){if(q.fut&&$('#fu-sig'))$('#fu-sig').innerHTML=fuSig();if(q.intra){q.intra[q.intra.length-1]=q.v;if(q.id===CHART&&$('#bigchart'))$('#bigchart').innerHTML=bigChart(q)}
  const h=$(`[data-heat="${q.id}"]`);if(h){h.outerHTML=heatTile(q);const b=$('#breadth');if(b)b.textContent=breadth();const b2=$('#breadth2');if(b2)b2.textContent=breadth()}
  if(q.g==='rt'&&$('#yc'))$('#yc').innerHTML=yieldCurve();
  if(q.sup){$$(`[data-mc="${q.id}"]`).forEach(el=>el.textContent=fmtCap(mcap(q)));if($('#crshare'))$('#crshare').innerHTML=crShare()}}

/* ---------- holographic globe ---------- */
const GEO={CME:[41.88,-87.63],ASX:[-33.87,151.21],TSE:[35.68,139.69],SSE:[31.23,121.47],HKEX:[22.32,114.17],BSE:[19.08,72.88],XETRA:[50.11,8.68],PAR:[48.86,2.35],LSE:[51.51,-0.13],NYSE:[40.71,-74.01],TSX:[43.65,-79.38],B3:[-23.55,-46.63]};
const ARCS=[['CME','LSE'],['NYSE','LSE'],['LSE','XETRA'],['LSE','HKEX'],['NYSE','TSE'],['HKEX','SSE'],['TSE','ASX'],['NYSE','B3'],['XETRA','BSE'],['NYSE','TSX'],['BSE','HKEX'],['PAR','NYSE']];
const EXIDX={CME:'ES1',NYSE:'SPX',TSX:'TSX',B3:'IBOV',LSE:'UKX',XETRA:'DAX',PAR:'CAC',BSE:'SENSEX',SSE:'SHCOMP',HKEX:'HSI',TSE:'NKY',ASX:'AS51'};
/* =========================================================================
   HOLOGRAPHIC WORLD GLOBE — landing hero. Click any continent, country,
   U.S. state or financial center to explore its economic & financial history.
   Borders: amCharts 5 geodata (loaded from jsDelivr); falls back to cities + continents.
   ========================================================================= */
const CONTINENTS=[['North America',48,-100],['South America',-16,-60],['Europe',53,18],['Africa',6,20],['Asia',42,95],['Oceania',-24,134],['Antarctica',-78,20]];
/* ---------- capitals: every country and U.S. state ---------- */
const CAP_RAW=`US|United States|Washington, D.C.|38.90|-77.04
CA|Canada|Ottawa|45.42|-75.70
MX|Mexico|Mexico City|19.43|-99.13
GT|Guatemala|Guatemala City|14.63|-90.51
BZ|Belize|Belmopan|17.25|-88.77
SV|El Salvador|San Salvador|13.69|-89.19
HN|Honduras|Tegucigalpa|14.07|-87.19
NI|Nicaragua|Managua|12.11|-86.24
CR|Costa Rica|San José|9.93|-84.09
PA|Panama|Panama City|8.98|-79.52
CU|Cuba|Havana|23.11|-82.37
JM|Jamaica|Kingston|18.00|-76.79
HT|Haiti|Port-au-Prince|18.54|-72.34
DO|Dominican Republic|Santo Domingo|18.49|-69.93
BS|Bahamas|Nassau|25.05|-77.35
TT|Trinidad and Tobago|Port of Spain|10.66|-61.51
BB|Barbados|Bridgetown|13.10|-59.62
PR|Puerto Rico|San Juan|18.47|-66.11|U.S. territory
CO|Colombia|Bogotá|4.71|-74.07
VE|Venezuela|Caracas|10.49|-66.88
GY|Guyana|Georgetown|6.80|-58.16
SR|Suriname|Paramaribo|5.85|-55.20
EC|Ecuador|Quito|-0.18|-78.47
PE|Peru|Lima|-12.05|-77.04
BR|Brazil|Brasília|-15.79|-47.88
BO|Bolivia|Sucre|-19.03|-65.26|La Paz is the seat of government
PY|Paraguay|Asunción|-25.26|-57.58
CL|Chile|Santiago|-33.45|-70.67
AR|Argentina|Buenos Aires|-34.60|-58.38
UY|Uruguay|Montevideo|-34.90|-56.16
GL|Greenland|Nuuk|64.18|-51.72|Autonomous territory of Denmark
FK|Falkland Islands|Stanley|-51.70|-57.85|British overseas territory
GB|United Kingdom|London|51.51|-0.13
IE|Ireland|Dublin|53.35|-6.26
IS|Iceland|Reykjavík|64.15|-21.94
NO|Norway|Oslo|59.91|10.75
SE|Sweden|Stockholm|59.33|18.07
FI|Finland|Helsinki|60.17|24.94
DK|Denmark|Copenhagen|55.68|12.57
EE|Estonia|Tallinn|59.44|24.75
LV|Latvia|Riga|56.95|24.11
LT|Lithuania|Vilnius|54.69|25.28
PL|Poland|Warsaw|52.23|21.01
DE|Germany|Berlin|52.52|13.40
NL|Netherlands|Amsterdam|52.37|4.90|The Hague is the seat of government
BE|Belgium|Brussels|50.85|4.35
LU|Luxembourg|Luxembourg|49.61|6.13
FR|France|Paris|48.86|2.35
CH|Switzerland|Bern|46.95|7.45|Federal city
AT|Austria|Vienna|48.21|16.37
LI|Liechtenstein|Vaduz|47.14|9.52
IT|Italy|Rome|41.90|12.50
ES|Spain|Madrid|40.42|-3.70
PT|Portugal|Lisbon|38.72|-9.14
AD|Andorra|Andorra la Vella|42.51|1.52
MC|Monaco|Monaco|43.73|7.42
SM|San Marino|San Marino|43.94|12.45
VA|Vatican City|Vatican City|41.90|12.45
MT|Malta|Valletta|35.90|14.51
CZ|Czechia|Prague|50.08|14.44
SK|Slovakia|Bratislava|48.15|17.11
HU|Hungary|Budapest|47.50|19.04
SI|Slovenia|Ljubljana|46.06|14.51
HR|Croatia|Zagreb|45.81|15.98
BA|Bosnia and Herzegovina|Sarajevo|43.86|18.41
RS|Serbia|Belgrade|44.79|20.45
ME|Montenegro|Podgorica|42.44|19.26
XK|Kosovo|Pristina|42.66|21.17
MK|North Macedonia|Skopje|42.00|21.43
AL|Albania|Tirana|41.33|19.82
GR|Greece|Athens|37.98|23.73
BG|Bulgaria|Sofia|42.70|23.32
RO|Romania|Bucharest|44.43|26.10
MD|Moldova|Chișinău|47.01|28.86
UA|Ukraine|Kyiv|50.45|30.52
BY|Belarus|Minsk|53.90|27.57
RU|Russia|Moscow|55.76|37.62
CY|Cyprus|Nicosia|35.17|33.36
TR|Türkiye|Ankara|39.93|32.86
GE|Georgia|Tbilisi|41.72|44.79
AM|Armenia|Yerevan|40.18|44.51
AZ|Azerbaijan|Baku|40.41|49.87
IL|Israel|Jerusalem|31.77|35.21|Status disputed; many embassies are in Tel Aviv
PS|Palestine|Ramallah|31.90|35.20|Administrative center; East Jerusalem is the proclaimed capital
LB|Lebanon|Beirut|33.89|35.50
SY|Syria|Damascus|33.51|36.29
JO|Jordan|Amman|31.95|35.93
IQ|Iraq|Baghdad|33.31|44.36
IR|Iran|Tehran|35.69|51.39
SA|Saudi Arabia|Riyadh|24.71|46.68
KW|Kuwait|Kuwait City|29.38|47.99
BH|Bahrain|Manama|26.23|50.59
QA|Qatar|Doha|25.29|51.53
AE|United Arab Emirates|Abu Dhabi|24.45|54.38
OM|Oman|Muscat|23.59|58.41
YE|Yemen|Sanaa|15.37|44.19
AF|Afghanistan|Kabul|34.56|69.21
PK|Pakistan|Islamabad|33.68|73.05
IN|India|New Delhi|28.61|77.21
NP|Nepal|Kathmandu|27.72|85.32
BT|Bhutan|Thimphu|27.47|89.64
BD|Bangladesh|Dhaka|23.81|90.41
LK|Sri Lanka|Sri Jayawardenepura Kotte|6.89|79.90|Colombo is the commercial capital
MV|Maldives|Malé|4.18|73.51
KZ|Kazakhstan|Astana|51.17|71.45
UZ|Uzbekistan|Tashkent|41.30|69.24
TM|Turkmenistan|Ashgabat|37.96|58.33
KG|Kyrgyzstan|Bishkek|42.87|74.59
TJ|Tajikistan|Dushanbe|38.56|68.79
MN|Mongolia|Ulaanbaatar|47.89|106.91
CN|China|Beijing|39.90|116.41
KP|North Korea|Pyongyang|39.04|125.76
KR|South Korea|Seoul|37.57|126.98
JP|Japan|Tokyo|35.68|139.69
TW|Taiwan|Taipei|25.03|121.57
MM|Myanmar|Naypyidaw|19.76|96.08
TH|Thailand|Bangkok|13.76|100.50
LA|Laos|Vientiane|17.97|102.63
KH|Cambodia|Phnom Penh|11.56|104.93
VN|Vietnam|Hanoi|21.03|105.85
MY|Malaysia|Kuala Lumpur|3.14|101.69|Putrajaya is the administrative center
SG|Singapore|Singapore|1.29|103.85
BN|Brunei|Bandar Seri Begawan|4.90|114.94
ID|Indonesia|Jakarta|-6.21|106.85|Government is moving to Nusantara
PH|Philippines|Manila|14.60|120.98
TL|Timor-Leste|Dili|-8.56|125.56
AU|Australia|Canberra|-35.28|149.13
NZ|New Zealand|Wellington|-41.29|174.78
PG|Papua New Guinea|Port Moresby|-9.44|147.18
FJ|Fiji|Suva|-18.14|178.44
SB|Solomon Islands|Honiara|-9.43|159.95
VU|Vanuatu|Port Vila|-17.73|168.32
NC|New Caledonia|Nouméa|-22.28|166.46|French territory
WS|Samoa|Apia|-13.83|-171.76
TO|Tonga|Nukuʻalofa|-21.14|-175.20
EG|Egypt|Cairo|30.04|31.24
LY|Libya|Tripoli|32.89|13.19
TN|Tunisia|Tunis|36.81|10.18
DZ|Algeria|Algiers|36.75|3.06
MA|Morocco|Rabat|34.02|-6.83
EH|Western Sahara|Laayoune|27.15|-13.20|Disputed territory
MR|Mauritania|Nouakchott|18.08|-15.98
ML|Mali|Bamako|12.64|-8.00
NE|Niger|Niamey|13.51|2.11
TD|Chad|N'Djamena|12.13|15.06
SD|Sudan|Khartoum|15.50|32.56
SS|South Sudan|Juba|4.86|31.57
ER|Eritrea|Asmara|15.32|38.93
DJ|Djibouti|Djibouti|11.59|43.15
ET|Ethiopia|Addis Ababa|9.03|38.74
SO|Somalia|Mogadishu|2.05|45.32
KE|Kenya|Nairobi|-1.29|36.82
UG|Uganda|Kampala|0.35|32.58
RW|Rwanda|Kigali|-1.95|30.06
BI|Burundi|Gitega|-3.43|29.93|Bujumbura is the economic capital
TZ|Tanzania|Dodoma|-6.16|35.75|Dar es Salaam is the commercial center
SN|Senegal|Dakar|14.72|-17.47
GM|Gambia|Banjul|13.45|-16.58
GW|Guinea-Bissau|Bissau|11.86|-15.60
GN|Guinea|Conakry|9.64|-13.58
SL|Sierra Leone|Freetown|8.48|-13.23
LR|Liberia|Monrovia|6.30|-10.80
CI|Côte d'Ivoire|Yamoussoukro|6.83|-5.29|Abidjan is the economic capital
BF|Burkina Faso|Ouagadougou|12.37|-1.52
GH|Ghana|Accra|5.60|-0.19
TG|Togo|Lomé|6.13|1.22
BJ|Benin|Porto-Novo|6.50|2.63|Cotonou is the seat of government
NG|Nigeria|Abuja|9.08|7.40|Lagos is the commercial center
CM|Cameroon|Yaoundé|3.85|11.50
CF|Central African Republic|Bangui|4.39|18.56
GQ|Equatorial Guinea|Malabo|3.75|8.78
GA|Gabon|Libreville|0.42|9.47
CG|Republic of the Congo|Brazzaville|-4.27|15.28
CD|DR Congo|Kinshasa|-4.44|15.27
AO|Angola|Luanda|-8.84|13.23
ZM|Zambia|Lusaka|-15.39|28.32
MW|Malawi|Lilongwe|-13.96|33.79
MZ|Mozambique|Maputo|-25.97|32.57
ZW|Zimbabwe|Harare|-17.83|31.05
BW|Botswana|Gaborone|-24.65|25.91
NA|Namibia|Windhoek|-22.56|17.08
ZA|South Africa|Pretoria|-25.75|28.19|Executive capital; Cape Town is legislative, Bloemfontein judicial
LS|Lesotho|Maseru|-29.31|27.48
SZ|Eswatini|Mbabane|-26.31|31.14|Lobamba is the legislative capital
MG|Madagascar|Antananarivo|-18.88|47.51
MU|Mauritius|Port Louis|-20.16|57.50
SC|Seychelles|Victoria|-4.62|55.45
KM|Comoros|Moroni|-11.70|43.26
CV|Cabo Verde|Praia|14.93|-23.51
ST|São Tomé and Príncipe|São Tomé|0.34|6.73`.split('\n').map(l=>{const [iso,country,name,la,lo,note]=l.split('|');return{iso,country,name,lat:+la,lon:+lo,note:note||''}});
const STATE_CAP_RAW='AL|Alabama|Montgomery|32.38|-86.30;AK|Alaska|Juneau|58.30|-134.42;AZ|Arizona|Phoenix|33.45|-112.07;AR|Arkansas|Little Rock|34.75|-92.29;CA|California|Sacramento|38.58|-121.49;CO|Colorado|Denver|39.74|-104.99;CT|Connecticut|Hartford|41.76|-72.68;DE|Delaware|Dover|39.16|-75.52;FL|Florida|Tallahassee|30.44|-84.28;GA|Georgia|Atlanta|33.75|-84.39;HI|Hawaii|Honolulu|21.31|-157.86;ID|Idaho|Boise|43.62|-116.20;IL|Illinois|Springfield|39.80|-89.64;IN|Indiana|Indianapolis|39.77|-86.16;IA|Iowa|Des Moines|41.59|-93.62;KS|Kansas|Topeka|39.05|-95.68;KY|Kentucky|Frankfort|38.20|-84.87;LA|Louisiana|Baton Rouge|30.45|-91.19;ME|Maine|Augusta|44.31|-69.78;MD|Maryland|Annapolis|38.98|-76.49;MA|Massachusetts|Boston|42.36|-71.06;MI|Michigan|Lansing|42.73|-84.56;MN|Minnesota|Saint Paul|44.95|-93.09;MS|Mississippi|Jackson|32.30|-90.18;MO|Missouri|Jefferson City|38.58|-92.17;MT|Montana|Helena|46.59|-112.04;NE|Nebraska|Lincoln|40.81|-96.68;NV|Nevada|Carson City|39.16|-119.77;NH|New Hampshire|Concord|43.21|-71.54;NJ|New Jersey|Trenton|40.22|-74.76;NM|New Mexico|Santa Fe|35.69|-105.94;NY|New York|Albany|42.65|-73.76;NC|North Carolina|Raleigh|35.78|-78.64;ND|North Dakota|Bismarck|46.81|-100.78;OH|Ohio|Columbus|39.96|-83.00;OK|Oklahoma|Oklahoma City|35.47|-97.52;OR|Oregon|Salem|44.94|-123.04;PA|Pennsylvania|Harrisburg|40.27|-76.88;RI|Rhode Island|Providence|41.82|-71.41;SC|South Carolina|Columbia|34.00|-81.03;SD|South Dakota|Pierre|44.37|-100.35;TN|Tennessee|Nashville|36.16|-86.78;TX|Texas|Austin|30.27|-97.74;UT|Utah|Salt Lake City|40.76|-111.89;VT|Vermont|Montpelier|44.26|-72.58;VA|Virginia|Richmond|37.54|-77.44;WA|Washington|Olympia|47.04|-122.90;WV|West Virginia|Charleston|38.35|-81.63;WI|Wisconsin|Madison|43.07|-89.40;WY|Wyoming|Cheyenne|41.14|-104.82'.split(';').map(l=>{const [pc,state,name,la,lo]=l.split('|');return{iso:'US-'+pc,pc,country:state,name,lat:+la,lon:+lo,state:true,note:''}});
const CAP_BY_ISO=Object.fromEntries(CAP_RAW.map(c=>[c.iso,c]));
const CAP_BY_NAME=Object.fromEntries([...CAP_RAW,...STATE_CAP_RAW].map(c=>[c.country.toLowerCase(),c]));
const STATE_BY_KEY=Object.fromEntries(STATE_CAP_RAW.flatMap(c=>[[c.iso,c],['US-'+c.country,c]]));
/** Capital for a clicked feature: countries by ISO code (or name), states by postal code or name. */
function capitalOf(p){if(!p)return null;if(p.type==='U.S. state')return STATE_BY_KEY[p.id]||CAP_BY_NAME[(p.name||'').toLowerCase()]||null;
  if(p.type==='Country')return CAP_BY_ISO[p.id]||CAP_BY_NAME[(p.name||'').toLowerCase()]||CAP_BY_NAME[({'united states of america':'united states','dem. rep. congo':'dr congo','central african rep.':'central african republic','s. sudan':'south sudan','bosnia and herz.':'bosnia and herzegovina','dominican rep.':'dominican republic','eq. guinea':'equatorial guinea','solomon is.':'solomon islands','eswatini':'eswatini','macedonia':'north macedonia','turkey':'türkiye','czech rep.':'czechia','congo':'republic of the congo','w. sahara':'western sahara','falkland is.':'falkland islands','timor-leste':'timor-leste'})[(p.name||'').toLowerCase()]||'']||null;
  if(p.type==='Capital')return p.cap;return null}
let SHOW_CAPS=true;
const CITIES=[...Object.entries(GEO).map(([k,[la,lo]])=>({name:EXCH[k].city,lat:la,lon:lo,ex:k})),
 ...[['Washington',38.91,-77.04,'United States'],['San Francisco',37.77,-122.42,'United States'],['Zurich',47.37,8.54,'Switzerland'],['Amsterdam',52.37,4.9,'Netherlands'],['Singapore',1.35,103.82,'Singapore'],['Dubai',25.2,55.27,'United Arab Emirates'],['Seoul',37.57,126.98,'South Korea'],['Johannesburg',-26.2,28.05,'South Africa'],['Mexico City',19.43,-99.13,'Mexico'],['Buenos Aires',-34.6,-58.38,'Argentina'],['Riyadh',24.71,46.68,'Saudi Arabia'],['Lagos',6.52,3.38,'Nigeria'],['Istanbul',41.01,28.98,'Turkey'],['Moscow',55.76,37.62,'Russia'],['Madrid',40.42,-3.7,'Spain'],['Milan',45.46,9.19,'Italy'],['Stockholm',59.33,18.07,'Sweden'],['Taipei',25.03,121.57,'Taiwan'],['Jakarta',-6.21,106.85,'Indonesia'],['Shenzhen',22.54,114.06,'China'],['Vienna',48.21,16.37,'Austria'],['Dublin',53.35,-6.26,'Ireland'],['Athens',37.98,23.73,'Greece'],['Bangkok',13.76,100.5,'Thailand']].map(([name,lat,lon,country])=>({name,lat,lon,country}))];
const EXCOUNTRY={CME:'United States',NYSE:'United States',TSX:'Canada',B3:'Brazil',LSE:'United Kingdom',XETRA:'Germany',PAR:'France',BSE:'India',SSE:'China',HKEX:'Hong Kong',TSE:'Japan',ASX:'Australia'};
CITIES.forEach(c=>{if(c.ex)c.country=EXCOUNTRY[c.ex]});
const EURO=['Germany','France','Italy','Spain','Netherlands','Ireland','Greece','Austria','Belgium','Portugal','Finland','Cyprus'];
const COUNTRY_MKT={'United States':['SPX','ES1','US10Y','CL1'],'United Kingdom':['UKX','GB10Y','GBPUSD'],Germany:['DAX','DE10Y','EURUSD'],France:['CAC','FR10Y','EURUSD'],Italy:['IT10Y','EURUSD'],Japan:['NKY','JP10Y','USDJPY'],China:['SHCOMP','USDCNY'],'Hong Kong':['HSI'],India:['SENSEX'],Australia:['AS51','AUDUSD'],Canada:['TSX'],Brazil:['IBOV'],Switzerland:['USDCHF']};
const mktFor=n=>COUNTRY_MKT[n]||(EURO.includes(n)?['SX5E','EURUSD']:[]);
const flag=id=>/^[A-Z]{2}$/.test(id||'')?String.fromCodePoint(...[...id].map(c=>127397+c.charCodeAt(0))):'';
let GEOW=null,GEOUS=null,GEO_STATE='loading',GSEL=null;
function prepGeo(fc,type){const rad=Math.PI/180;return (fc.features||[]).map(f=>{const g=f.geometry;if(!g)return null;const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  const rings=[];let bb=[180,90,-180,-90];polys.forEach(p=>p.forEach((r,ri)=>{const v=new Float32Array(r.length*3);r.forEach(([lo,la],i)=>{v[i*3]=Math.cos(la*rad)*Math.cos(lo*rad);v[i*3+1]=Math.cos(la*rad)*Math.sin(lo*rad);v[i*3+2]=Math.sin(la*rad);bb=[Math.min(bb[0],lo),Math.min(bb[1],la),Math.max(bb[2],lo),Math.max(bb[3],la)]});rings.push({ll:r,v,hole:ri>0})}));
  return {name:f.properties&&f.properties.name||'',id:f.properties&&f.properties.id||f.id||'',type,rings,bb}}).filter(x=>x&&x.name&&x.id!=='AQ')}
let GEO_P=null;
/* Built-in simplified landmasses (always available; country borders load on top when the network allows) */
const LAND_RAW={
'North America':[[[-168,66],[-162,70],[-156,71.3],[-141,69.6],[-128,70],[-115,68.5],[-100,68],[-94,71.5],[-85,69.5],[-81,64],[-94,59],[-92,57],[-82,55],[-79,51.5],[-77,58],[-73,62],[-65,60],[-61,56],[-56,52],[-60,47],[-64,45],[-70,43],[-70,41.5],[-74,40.5],[-76,38],[-76,35],[-81,31.5],[-80.5,27],[-80,25.2],[-82,26.5],[-83,29.5],[-89,30],[-94,29.5],[-97.5,26],[-97.5,22],[-96,19],[-94,18.5],[-91,19],[-90.5,21],[-87,21.5],[-88,16],[-83.5,15],[-83.5,11],[-81.5,9],[-79.5,9.3],[-77.3,8.5],[-79,7.5],[-80.5,7.3],[-83,8.3],[-85.7,10],[-87,13],[-91,14],[-94,16],[-97,16],[-101,17.5],[-105.5,20],[-110,23],[-114.5,29],[-117,32.5],[-120.5,34.5],[-122.5,37.5],[-124,40.5],[-124.5,43],[-124,46.2],[-124.7,48.4],[-123,49],[-127,51],[-130,54.5],[-133,57],[-137,58.5],[-141,60],[-146,61],[-150,59.5],[-152,58],[-156,57],[-160,55.5],[-164,55],[-158,57.5],[-157.5,59],[-162,60],[-165,62.5],[-164.5,64.5],[-168,65.6]],
 [[-73,78.5],[-66,80.5],[-52,82.2],[-32,83.6],[-20,82],[-18,79],[-19.5,76],[-18.5,73],[-22,70.5],[-26,68.5],[-35,66],[-40,65],[-43,60],[-48,61.5],[-51,64.5],[-53.5,67],[-54,70.5],[-57,74.5],[-65,76]],
 [[-80,63.5],[-73,62.3],[-65,62.5],[-61.5,66.5],[-67,69.5],[-75,72.5],[-85,73.5],[-90,71.5],[-86,69.5],[-81,69.8],[-78,67]],
 [[-90,76.5],[-75,78.5],[-62,82],[-80,83],[-95,81]],[[-118,70],[-105,68.5],[-101,70],[-105,73],[-116,73]],
 [[-59.3,47.6],[-55.5,51.6],[-52.7,47.5],[-56,46.9]],[[-85,21.9],[-82,23.1],[-77,21.8],[-74.2,20.2],[-77.5,19.9],[-80,21.8]],[[-74.4,18.4],[-72.8,19.9],[-69.5,19.4],[-68.4,18.5],[-71.2,17.7]]],
'South America':[[[-77.3,8.5],[-75,11],[-71.5,12.3],[-68,10.6],[-64,10.6],[-61.5,10.5],[-60,8.5],[-57,6],[-53,5.5],[-51,4],[-50,1.5],[-48,-1],[-44,-2.5],[-40,-3],[-37,-5],[-35,-7.5],[-35.5,-10],[-38.5,-13],[-39,-17.5],[-40.5,-21],[-43,-23],[-46.5,-24],[-48.5,-27],[-49,-29.5],[-52,-32.5],[-54,-34.5],[-57.5,-34.5],[-57,-37],[-62,-39],[-62.5,-41],[-65,-42.5],[-65.5,-45],[-67.5,-46.5],[-66,-48],[-69,-51],[-68.5,-52.5],[-70,-53.5],[-72,-54],[-74,-52.5],[-75.5,-48],[-74,-44],[-73.5,-40],[-73.5,-37],[-72,-33],[-71.5,-28],[-70.5,-23],[-70.2,-18.5],[-72,-17],[-76,-14],[-77.5,-11],[-79.5,-7],[-81.2,-5.5],[-80.5,-3],[-80,-1],[-80.3,1],[-79,1.5],[-77.8,4],[-77.4,7.3]]],
'Africa':[[[-17.3,14.7],[-16.5,19.5],[-16.5,22],[-14.5,26.5],[-11.5,28.3],[-9.8,30],[-9.5,32.5],[-6.5,34.5],[-5.5,35.9],[-2,35.1],[2,36.6],[8,37],[10.2,37.3],[11,35.5],[10,34],[11,33.2],[15.5,32.3],[19.5,30.5],[20,32],[23,32.8],[25,31.8],[29,31],[32.3,31.3],[34.3,31.2],[34.5,28],[32.5,29.9],[35,24],[37,21],[38.5,18],[39.5,15.5],[42.5,12.5],[43.3,11.5],[46,11],[51.2,11.8],[51,10],[49,6],[47.5,4],[44,1],[41,-1.5],[40,-3.5],[39.3,-6],[39.5,-10],[40.5,-11],[40.7,-15],[37,-17.5],[35,-20],[35.5,-24],[32.8,-26],[32.5,-28.7],[30.5,-31],[27.5,-33.7],[25,-34],[20,-34.8],[18.5,-34.2],[18,-32],[16.5,-28.6],[15,-26.5],[14.5,-22.5],[11.8,-17.2],[12,-13.5],[13.5,-11],[12.3,-6.1],[11.8,-4.2],[9.5,-1],[9.5,1],[9.8,3],[8.5,4.5],[6,4.3],[4.5,6.3],[1.5,6.2],[-2,4.8],[-4.5,5.2],[-7.5,4.4],[-10.5,6.5],[-13,8.2],[-15,10.9],[-16.7,12.4]],
 [[49.3,-12],[50.5,-15.5],[49.5,-17.5],[48.7,-20.5],[47.2,-25],[45.2,-25.5],[43.7,-23.5],[43.2,-21.5],[44.4,-19],[44,-16.2],[47,-15.2],[48.5,-13.5]]],
'Eurasia':[[[-9,37],[-9.5,39],[-8.8,42],[-9.3,43],[-1.5,43.4],[-1.2,46],[-4.5,48],[-1.5,48.7],[1.5,50.2],[3.5,51.4],[4.8,53],[8,53.6],[8.6,55.5],[8.1,57],[10.5,57.7],[10.8,56],[12.5,54.4],[14.5,54],[18.5,54.8],[21,55.9],[21,57],[23.5,57.2],[24,59.3],[28,59.6],[22.5,60.3],[21.3,63.2],[25.5,65],[22,65.8],[17.5,62.5],[17.8,59.5],[16.5,56.2],[14,55.4],[12.8,56.2],[11.5,58.8],[10.5,59.2],[8.5,58.2],[5.5,58.8],[5,62],[8,63.5],[12,66],[15,68.5],[19,70],[25,71],[28.5,71],[33,69.4],[36,69.1],[41,67.5],[39.5,66.1],[34.8,66],[37,64.5],[41,64.8],[44,66.5],[43.5,68.5],[46,68.3],[53,68.8],[59,68.7],[60.5,69.8],[66,69.3],[68.5,72.5],[72.5,72.7],[80,73.5],[87,74.5],[98,76],[104,77.7],[112,76.5],[113,73.5],[120,73],[129,72.3],[130,71],[140,72.5],[149,72],[152,70.8],[160,69.6],[167,69.8],[170,70.1],[176,69.8],[179.9,69],[179.9,65],[176,65],[178.5,64.5],[177,62.5],[170,60],[163,59.5],[162,57.5],[163,56],[160,53],[156.5,51],[156,57],[155,59.5],[151,59],[145,59.3],[141,58.5],[135,54.7],[138,54],[141,52.5],[140.5,48.5],[135,43.5],[131,42.5],[129.5,40.8],[128,39],[129.4,37],[129.2,35.2],[126.5,34.4],[126.3,37.5],[124.8,39.6],[121.5,39],[122,40.6],[121,40.9],[118,39.2],[118.5,38.2],[120.8,36.6],[119.5,35],[121,32.5],[121.9,31],[122,29.9],[120.8,27.5],[119.5,25.5],[117,23.5],[114,22.3],[110.5,21.2],[108,21.6],[106.5,20.2],[106,18.8],[108.5,15.5],[109.3,12],[107.5,10.5],[104.8,8.6],[103,10.5],[102.2,12.2],[100.9,13.4],[100,13],[99.3,10.5],[100.3,8],[102,6.2],[103.4,4.5],[103.5,1.4],[101.3,2.8],[98.5,7.9],[98.3,11.7],[97.6,16.5],[94.5,16],[94.2,19],[92.4,20.7],[92,22.5],[90.5,22],[88.5,21.6],[87,21.2],[86.5,20],[84.8,19],[82.3,17],[80.3,15.6],[80.2,13],[79.8,10.3],[77.5,8.1],[76.5,9],[74.8,12.8],[73.5,16],[72.8,19],[72.6,21.3],[70.2,20.9],[68.9,22.4],[67.5,23.8],[66.6,25.4],[61.6,25.2],[57.3,25.8],[56.4,27.2],[54,26.7],[51.5,27.9],[50.1,30.1],[48,29.9],[48.8,27.6],[50.8,24.8],[51.6,24.3],[54,24.1],[56,26],[56.4,24.9],[58.7,23.6],[59.8,22.3],[57.8,19],[55.3,17.2],[52,15.8],[45,12.8],[43.3,12.8],[42.6,16],[40,20],[38.5,23.5],[35,28],[34.3,31.2],[34.9,32.8],[35.9,35.5],[36,36.8],[32.5,36.1],[30,36.2],[27.3,37],[26.3,38.5],[26.5,40.2],[29,41.1],[31.2,41.1],[35.5,42],[38,41],[41.5,41.5],[41.8,42.5],[38,44.5],[37.6,47],[35,45.6],[33.5,44.5],[32.5,45.4],[31,46.5],[30.2,45.2],[28.8,44],[28,43],[28,41.5],[26,40.8],[24,40.8],[23,40.2],[24,38],[22.3,36.5],[21,38],[19.5,40.5],[19.4,41.9],[16,43.5],[13.7,45.1],[12.4,45.4],[12.6,44],[14,42.4],[16.2,41.7],[18.5,40.2],[16.5,38.5],[15.7,38],[16,39.7],[15.3,40.2],[12.5,41.8],[10.5,42.9],[8.8,44.4],[6.5,43.2],[3.2,43.2],[3.3,42],[0.9,41],[0,39.5],[-0.3,37.6],[-2.1,36.7],[-5.2,36.2],[-6.4,36.8]],
 [[-5.7,50],[1.4,51.2],[1.7,52.7],[0,53.5],[-1.6,55.6],[-2,57.6],[-4,58.6],[-5,58.5],[-6.2,56.8],[-5,55],[-3,54.8],[-3.2,53.4],[-4.7,52.8],[-5.3,51.8],[-3.2,51.4]],[[-6,52.2],[-6,53.9],[-7.3,55.3],[-8.5,55],[-10.2,53.5],[-9.8,51.7],[-8.5,51.6]],
 [[-22,64],[-24,65.5],[-22,66.4],[-16,66.5],[-13.6,65.2],[-15,64.3],[-18,63.4]],[[52,71.5],[57,70.6],[61,74],[69,76.7],[65,77],[55,75]],
 [[130,31.3],[131.5,33],[132.5,35.4],[135.5,35.7],[138.5,37.5],[140,40],[140,41.5],[140.5,43.5],[141.5,45.4],[145.5,43.3],[143.2,42],[141.3,41.4],[141.9,39.5],[141,37.5],[140.8,35.7],[139.8,35],[138.8,34.6],[137,34.6],[135.2,33.8],[133,33.9],[132,33],[131.3,31.4]],
 [[79.8,6],[81.8,7.5],[80.2,9.8]],[[120.1,23],[121.9,25.1],[121,22]],[[142,46],[143.5,49],[142.7,54.3],[142,51]],
 [[95.3,5.5],[98.2,4],[104,-1],[106,-3],[105.8,-5.8],[104.5,-5.8],[101.5,-3],[99,0],[97.5,2.5]],[[109,2],[111,1.5],[113,3.2],[115.5,5.3],[117.5,7],[119,5.2],[117.5,4.3],[118.2,1.5],[117.2,-0.5],[116.5,-2.5],[116,-4],[114.5,-3.5],[111,-3],[110,-1.2],[109,0.5]],
 [[105.2,-6.8],[108,-6.3],[111,-6.4],[114.5,-7.7],[114.4,-8.7],[110,-8.1],[106.5,-7.4]],[[120.5,18.5],[122.3,18.4],[124,14],[121.5,13.8],[120.5,15.5]]],
'Oceania':[[[113.4,-22],[114,-26.5],[115,-30],[115.6,-33.5],[117.9,-35.1],[122,-34],[126,-32.3],[131,-31.5],[134,-32.5],[137.7,-35.5],[139.7,-37.2],[141,-38.3],[144,-38.4],[146.3,-39],[150,-37.5],[151.2,-33.9],[153.1,-30.5],[153.2,-26],[151,-23],[149,-20.5],[146,-18],[145.3,-15],[143.5,-12.5],[142.5,-10.8],[141.5,-12.8],[141.6,-15],[140.8,-17.4],[139.2,-17.2],[136.5,-15.2],[136,-12],[132.5,-11.5],[130.2,-12.8],[129,-14.8],[126.5,-14],[124,-16.3],[122.2,-17.8],[121,-19.5],[117,-20.7]],
 [[172.7,-34.5],[174.8,-36.8],[178.5,-37.7],[177.9,-39.2],[176.8,-40],[174.8,-41.3],[173.8,-39.2],[174.6,-37]],[[172.7,-40.5],[174.2,-41.7],[173,-43.6],[171,-44.5],[169,-46.6],[166.5,-46.2],[168,-44.2],[170.5,-43]],
 [[131,-1],[134.5,-0.8],[137.5,-1.5],[141,-2.6],[145,-4.3],[147.5,-6.2],[150.5,-10.5],[147,-10.1],[144,-7.6],[141.5,-9.2],[139.5,-8.2],[138,-8.4],[137.5,-5],[135,-4.4],[132.5,-3.8],[132,-2.3]],[[145.9,-40.7],[148.3,-40.9],[148,-43.2],[146,-43.6],[144.7,-41]]],
'Antarctica':[[[-180,-90],[-180,-78],...Array.from({length:25},(_,i)=>{const lo=-180+i*15;const la=lo>=-75&&lo<=-55?-65:lo>=-60&&lo<=-20?-76:lo<=-150?-77.5:lo>=165?-72:-69;return[lo,la]}),[180,-72],[180,-90]]]
};
const EUROPE_TEST=(lo,la)=>(lo<26&&la>=35)||(lo<60&&la>=45)&&!(lo>=26&&la<45);
function prepLand(){const out=[];Object.entries(LAND_RAW).forEach(([cont,polys])=>polys.forEach(r=>{const ring=[...r,r[0]];out.push({cont,...prepGeo({features:[{properties:{name:cont,id:''},geometry:{type:'Polygon',coordinates:[ring]}}]},'Land')[0]})}));return out.filter(x=>x&&x.rings)}
let LANDP=null;const land=()=>LANDP||(LANDP=prepLand());
const ISO3=Object.fromEntries('ABW:AW,AFG:AF,AGO:AO,AIA:AI,ALA:AX,ALB:AL,AND:AD,ARE:AE,ARG:AR,ARM:AM,ASM:AS,ATA:AQ,ATF:TF,ATG:AG,AUS:AU,AUT:AT,AZE:AZ,BDI:BI,BEL:BE,BEN:BJ,BES:BQ,BFA:BF,BGD:BD,BGR:BG,BHR:BH,BHS:BS,BIH:BA,BLM:BL,BLR:BY,BLZ:BZ,BMU:BM,BOL:BO,BRA:BR,BRB:BB,BRN:BN,BTN:BT,BVT:BV,BWA:BW,CAF:CF,CAN:CA,CCK:CC,CHE:CH,CHL:CL,CHN:CN,CIV:CI,CMR:CM,COD:CD,COG:CG,COK:CK,COL:CO,COM:KM,CPV:CV,CRI:CR,CUB:CU,CUW:CW,CXR:CX,CYM:KY,CYP:CY,CZE:CZ,DEU:DE,DJI:DJ,DMA:DM,DNK:DK,DOM:DO,DZA:DZ,ECU:EC,EGY:EG,ERI:ER,ESH:EH,ESP:ES,EST:EE,ETH:ET,FIN:FI,FJI:FJ,FLK:FK,FRA:FR,FRO:FO,FSM:FM,GAB:GA,GBR:GB,GEO:GE,GGY:GG,GHA:GH,GIB:GI,GIN:GN,GLP:GP,GMB:GM,GNB:GW,GNQ:GQ,GRC:GR,GRD:GD,GRL:GL,GTM:GT,GUF:GF,GUM:GU,GUY:GY,HKG:HK,HMD:HM,HND:HN,HRV:HR,HTI:HT,HUN:HU,IDN:ID,IMN:IM,IND:IN,IOT:IO,IRL:IE,IRN:IR,IRQ:IQ,ISL:IS,ISR:IL,ITA:IT,JAM:JM,JEY:JE,JOR:JO,JPN:JP,KAZ:KZ,KEN:KE,KGZ:KG,KHM:KH,KIR:KI,KNA:KN,KOR:KR,KWT:KW,LAO:LA,LBN:LB,LBR:LR,LBY:LY,LCA:LC,LIE:LI,LKA:LK,LSO:LS,LTU:LT,LUX:LU,LVA:LV,MAC:MO,MAF:MF,MAR:MA,MCO:MC,MDA:MD,MDG:MG,MDV:MV,MEX:MX,MHL:MH,MKD:MK,MLI:ML,MLT:MT,MMR:MM,MNE:ME,MNG:MN,MNP:MP,MOZ:MZ,MRT:MR,MSR:MS,MTQ:MQ,MUS:MU,MWI:MW,MYS:MY,MYT:YT,NAM:NA,NCL:NC,NER:NE,NFK:NF,NGA:NG,NIC:NI,NIU:NU,NLD:NL,NOR:NO,NPL:NP,NRU:NR,NZL:NZ,OMN:OM,PAK:PK,PAN:PA,PCN:PN,PER:PE,PHL:PH,PLW:PW,PNG:PG,POL:PL,PRI:PR,PRK:KP,PRT:PT,PRY:PY,PSE:PS,PYF:PF,QAT:QA,REU:RE,ROU:RO,RUS:RU,RWA:RW,SAU:SA,SDN:SD,SEN:SN,SGP:SG,SGS:GS,SHN:SH,SJM:SJ,SLB:SB,SLE:SL,SLV:SV,SMR:SM,SOM:SO,SPM:PM,SRB:RS,SSD:SS,STP:ST,SUR:SR,SVK:SK,SVN:SI,SWE:SE,SWZ:SZ,SXM:SX,SYC:SC,SYR:SY,TCA:TC,TCD:TD,TGO:TG,THA:TH,TJK:TJ,TKL:TK,TKM:TM,TLS:TL,TON:TO,TTO:TT,TUN:TN,TUR:TR,TUV:TV,TWN:TW,TZA:TZ,UGA:UG,UKR:UA,UMI:UM,URY:UY,USA:US,UZB:UZ,VAT:VA,VCT:VC,VEN:VE,VGB:VG,VIR:VI,VNM:VN,VUT:VU,WLF:WF,WSM:WS,YEM:YE,ZAF:ZA,ZMB:ZM,ZWE:ZW'.split(',').map(x=>x.split(':')));
function loadScript(src){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=res;s.onerror=()=>rej(new Error('load '+src));document.head.appendChild(s)})}
const TOPO_SRC=[{t:'https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js',w:'https://cdnjs.cloudflare.com/ajax/libs/datamaps/0.5.9/datamaps.world.min.js',u:'https://cdnjs.cloudflare.com/ajax/libs/datamaps/0.5.9/datamaps.usa.min.js'},
 {t:'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/dist/topojson-client.min.js',w:'https://cdn.jsdelivr.net/npm/datamaps@0.5.9/dist/datamaps.world.min.js',u:'https://cdn.jsdelivr.net/npm/datamaps@0.5.9/dist/datamaps.usa.min.js'}];
async function viaDatamaps(src){await loadScript(src.t);await loadScript(src.w);const wt=window.Datamap&&window.Datamap.prototype.worldTopo;if(!wt||!window.topojson)throw new Error('no topo');
  const wf=window.topojson.feature(wt,wt.objects.world||Object.values(wt.objects)[0]).features.map(f=>({geometry:f.geometry,properties:{name:f.properties&&f.properties.name||'',id:ISO3[f.id]||''}}));
  let uf=[];try{await loadScript(src.u);const ut=window.Datamap.prototype.usaTopo;uf=window.topojson.feature(ut,ut.objects.usa||Object.values(ut.objects)[0]).features.map(f=>({geometry:f.geometry,properties:{name:f.properties&&f.properties.name||'',id:'US-'+f.id}}))}catch(e){}
  return [{features:wf},{features:uf}]}
async function viaAmcharts(){const [w,u]=await Promise.all([import('https://cdn.jsdelivr.net/npm/@amcharts/amcharts5-geodata@5/worldLow.js'),import('https://cdn.jsdelivr.net/npm/@amcharts/amcharts5-geodata@5/usaLow.js')]);return [w.default,u.default]}
function loadGeo(){if(GEO_P)return GEO_P;GEO_P=(async()=>{const tries=[async()=>{const [w,u]=await Promise.all([fetch('/geo/world.json').then(r=>{if(!r.ok)throw 0;return r.json()}),fetch('/geo/us.json').then(r=>r.ok?r.json():{features:[]})]);return[w,u]},()=>viaDatamaps(TOPO_SRC[0]),()=>viaDatamaps(TOPO_SRC[1]),viaAmcharts];
  for(const t of tries){try{const [w,u]=await t();const W=prepGeo(w,'Country');if(W.length>100){GEOW=W;GEOUS=prepGeo(u,'U.S. state');GEO_STATE='ready';return}}catch(e){}}GEO_STATE='failed'})();return GEO_P}

function inRing(lo,la,ll){let c=false;for(let i=0,j=ll.length-1;i<ll.length;j=i++){const [xi,yi]=ll[i],[xj,yj]=ll[j];if(((yi>la)!==(yj>la))&&(lo<(xj-xi)*(la-yi)/(yj-yi)+xi))c=!c}return c}
function hitFeat(list,lo,la){if(!list)return null;for(const f of list){const b=f.bb;if(lo<b[0]||lo>b[2]||la<b[1]||la>b[3])continue;let inside=false;f.rings.forEach(r=>{if(inRing(lo,la,r.ll))inside=!inside});if(inside)return f}return null}

function mountGlobe(){const cv=$('#globe');if(!cv)return;const ctx=cv.getContext('2d'),tip=$('#gtip');let W,H,R0,cx,cy;
  const size=()=>{const dpr=Math.min(devicePixelRatio||1,2),r=cv.getBoundingClientRect();W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);R0=Math.min(W,H)*.44;cx=W/2;cy=H/2};size();
  const ro=new ResizeObserver(size);ro.observe(cv);loadGeo().then(()=>{const s=$('#geo-stat');if(s)s.textContent=GEO_STATE==='ready'?`${GEOW.length} countries · ${GEOUS.length} U.S. states · ${CITIES.length} financial centers`:`${CITIES.length} financial centers · continents shown (country borders couldn’t load)`});
  const rad=Math.PI/180;let lon0=-30,tilt=22*rad,zoom=1,tz=1,drag=null,hover=null,last=performance.now(),raf,states={},stT=0,target=null;const R=()=>R0*zoom;
  const vec=(la,lo)=>[Math.cos(la*rad)*Math.cos(lo*rad),Math.cos(la*rad)*Math.sin(lo*rad),Math.sin(la*rad)];
  const rot=(x0,y0,z0,h=0)=>{const L=-lon0*rad,x=x0*Math.cos(L)-y0*Math.sin(L),y=x0*Math.sin(L)+y0*Math.cos(L);const dz=x*Math.cos(tilt)+z0*Math.sin(tilt),vz=-x*Math.sin(tilt)+z0*Math.cos(tilt),k=R()*(1+h);return{X:cx+y*k,Y:cy-vz*k,vis:dz>0,dz}};
  const proj=(v,h=0)=>rot(v[0],v[1],v[2],h);
  const unproj=(X,Y)=>{const y=(X-cx)/R(),vz=-(Y-cy)/R(),s=y*y+vz*vz;if(s>1)return null;const dz=Math.sqrt(1-s),x=dz*Math.cos(tilt)-vz*Math.sin(tilt),z=dz*Math.sin(tilt)+vz*Math.cos(tilt),L=-lon0*rad,x0=x*Math.cos(L)+y*Math.sin(L),y0=-x*Math.sin(L)+y*Math.cos(L);return{la:Math.asin(Math.max(-1,Math.min(1,z)))/rad,lo:Math.atan2(y0,x0)/rad}};
  const slerp=(a,b,t)=>{const d=Math.acos(Math.min(1,a[0]*b[0]+a[1]*b[1]+a[2]*b[2])),s=Math.sin(d)||1,k1=Math.sin((1-t)*d)/s,k2=Math.sin(t*d)/s;return[a[0]*k1+b[0]*k2,a[1]*k1+b[1]*k2,a[2]*k1+b[2]*k2]};
  const light=()=>document.documentElement.dataset.theme==='light';
  const ringPath=(r)=>{const v=r.v,n=v.length/3;let on=false,any=false;for(let i=0;i<n;i++){const p=rot(v[i*3],v[i*3+1],v[i*3+2]);if(p.vis){on?ctx.lineTo(p.X,p.Y):ctx.moveTo(p.X,p.Y);on=true;any=true}else on=false}return any};
  const ringFull=r=>{const v=r.v,n=v.length/3,rr=R();let vis=0;for(let i=0;i<n;i++){const p=rot(v[i*3],v[i*3+1],v[i*3+2]);let X=p.X,Y=p.Y;if(p.vis)vis++;else{const dx=X-cx,dy=Y-cy,d=Math.hypot(dx,dy)||1;X=cx+dx/d*rr;Y=cy+dy/d*rr}i?ctx.lineTo(X,Y):ctx.moveTo(X,Y)}ctx.closePath();return vis>0};
  function feat(f,stroke,w,fill,glow){if(fill){ctx.beginPath();let any=false;f.rings.forEach(r=>{if(ringFull(r))any=true});if(any){ctx.fillStyle=fill;ctx.fill('evenodd')}}ctx.beginPath();f.rings.forEach(r=>ringPath(r));ctx.strokeStyle=stroke;ctx.lineWidth=w;if(glow){ctx.shadowColor=glow;ctx.shadowBlur=8}ctx.stroke();ctx.shadowBlur=0}
  function draw(now){const dt=Math.min(64,now-last);last=now;zoom+=(tz-zoom)*.15;
    if(target){lon0+=((((target.lo-lon0)%360)+540)%360-180)*.08;tilt+=(target.la*rad*.8-tilt)*.08;if(Math.abs((((target.lo-lon0)%360)+540)%360-180)<.2)target=null}
    else if(!drag&&!hover&&!RM&&!GSEL)lon0+=dt*.005;
    if(now-stT>1000){stT=now;Object.keys(EXCH).forEach(k=>states[k]=exState(k))}
    const L=light(),tx=L?'#0B1220':'#E9EDF2',r=R();ctx.clearRect(0,0,W,H);
    let g=ctx.createRadialGradient(cx,cy,r*.75,cx,cy,r*1.4);g.addColorStop(0,'rgba(76,141,255,0)');g.addColorStop(.4,`rgba(76,141,255,${L?.14:.22})`);g.addColorStop(1,'rgba(142,124,247,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r*1.4,0,7);ctx.fill();
    g=ctx.createRadialGradient(cx-r*.35,cy-r*.4,r*.1,cx,cy,r);g.addColorStop(0,`rgba(76,141,255,${L?.18:.16})`);g.addColorStop(.7,'rgba(142,124,247,.06)');g.addColorStop(1,'rgba(47,191,119,.10)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.fill();ctx.strokeStyle=`rgba(76,141,255,${L?.65:.6})`;ctx.lineWidth=1.3;ctx.stroke();
    const gc=L?'rgba(36,89,216,.14)':'rgba(140,175,255,.10)';ctx.lineWidth=1;
    for(let la=-60;la<=60;la+=30){ctx.beginPath();let on=false;for(let lo=-180;lo<=180;lo+=4){const p=proj(vec(la,lo));if(p.vis){on?ctx.lineTo(p.X,p.Y):ctx.moveTo(p.X,p.Y);on=true}else on=false}ctx.strokeStyle=gc;ctx.stroke()}
    for(let lo=-180;lo<180;lo+=30){ctx.beginPath();let on=false;for(let la=-90;la<=90;la+=4){const p=proj(vec(la,lo));if(p.vis){on?ctx.lineTo(p.X,p.Y):ctx.moveTo(p.X,p.Y);on=true}else on=false}ctx.strokeStyle=gc;ctx.stroke()}
    const landFill=L?'rgba(36,89,216,.2)':'rgba(70,140,255,.3)';
    if(!GEOW){land().forEach(f=>feat(f,L?'rgba(36,89,216,.75)':'rgba(140,205,255,.85)',1.2,landFill,L?null:'rgba(76,141,255,.9)'));if(hover&&hover.lf)hover.lf.forEach(f=>feat(f,'rgba(142,124,247,.95)',1.8,'rgba(142,124,247,.18)'));if(GSEL&&GSEL.lf)GSEL.lf.forEach(f=>feat(f,'rgba(47,191,119,.95)',1.8,'rgba(47,191,119,.16)'))}
    if(GEOW){const cs=L?'rgba(36,89,216,.6)':'rgba(140,205,255,.62)';GEOW.forEach(f=>feat(f,cs,.8,landFill));
      if(GEOUS&&zoom>1.25)GEOUS.forEach(f=>feat(f,L?'rgba(106,85,224,.35)':'rgba(170,150,255,.28)',.6));
      const hl=(f,c)=>{if(f&&f.rings)feat(f,c,2,c.replace(/[\d.]+\)$/,'.22)'))};
      if(hover&&hover.f)hl(hover.f,'rgba(142,124,247,.95)');if(GSEL&&GSEL.f)hl(GSEL.f,'rgba(47,191,119,.95)')}
    {const selCap=capitalOf(GSEL),hovCap=capitalOf(hover);const capPlaced=[];ctx.font='600 10.5px Archivo, system-ui, sans-serif';
      const drawCap=(c,isState)=>{const p=proj(vec(c.lat,c.lon));c._p=p;if(!p.vis)return;const hi=c===selCap||c===hovCap;if(!SHOW_CAPS&&!hi)return;if(isState&&zoom<1.9&&!hi)return;
        const s=hi?5.5:isState?2.4:3.2;ctx.save();ctx.translate(p.X,p.Y);ctx.rotate(Math.PI/4);ctx.fillStyle=hi?'#FFE08A':(L?'#9A7426':'#F5C96B');ctx.shadowColor='#F5C96B';ctx.shadowBlur=hi?16:6;ctx.fillRect(-s/2,-s/2,s,s);ctx.restore();ctx.shadowBlur=0;
        if(hi&&!RM){const ph=((now/1600)%1);ctx.strokeStyle=`rgba(255,215,120,${(1-ph)*.8})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(p.X,p.Y,6+ph*14,0,7);ctx.stroke()}
        const showLabel=hi||(zoom>=1.35&&!isState&&!CITIES.some(x=>x.name===c.name)&&!capPlaced.some(q=>Math.abs(q[0]-p.X)<64&&Math.abs(q[1]-p.Y)<12))||(isState&&zoom>=2.6&&!capPlaced.some(q=>Math.abs(q[0]-p.X)<56&&Math.abs(q[1]-p.Y)<11));
        if(showLabel){capPlaced.push([p.X,p.Y]);ctx.font=hi?'700 12.5px Archivo, system-ui, sans-serif':'600 10.5px Archivo, system-ui, sans-serif';const t=(hi?'★ ':'')+c.name;const w=ctx.measureText(t).width;
          if(hi){ctx.fillStyle=L?'rgba(255,255,255,.85)':'rgba(8,11,16,.78)';ctx.fillRect(p.X-w/2-6,p.Y+8,w+12,18)}ctx.fillStyle=hi?(L?'#7A5A12':'#FFE08A'):(L?'rgba(122,90,18,.9)':'rgba(245,215,150,.85)');ctx.textAlign='center';ctx.fillText(t,p.X,p.Y+(hi?21:15));ctx.textAlign='start'}};
      CAP_RAW.forEach(c=>drawCap(c,false));STATE_CAP_RAW.forEach(c=>drawCap(c,true))}
    ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.clip();const sy=cy-r+((now/30)%(2*r));const sg=ctx.createLinearGradient(0,sy-30,0,sy+2);sg.addColorStop(0,'rgba(76,141,255,0)');sg.addColorStop(1,`rgba(120,200,255,${L?.22:.28})`);ctx.fillStyle=sg;ctx.fillRect(cx-r,sy-30,2*r,32);ctx.restore();
    ARCS.forEach(([a,b],i)=>{const A1=vec(...GEO[a]),B1=vec(...GEO[b]),pts=[];for(let t=0;t<=1.001;t+=.04)pts.push(proj(slerp(A1,B1,t),.18*Math.sin(Math.PI*t)));ctx.beginPath();let on=false;pts.forEach(p=>{if(p.vis){on?ctx.lineTo(p.X,p.Y):ctx.moveTo(p.X,p.Y);on=true}else on=false});ctx.strokeStyle=`rgba(142,124,247,${L?.4:.45})`;ctx.lineWidth=1.1;ctx.stroke();
      const t=((now/2800)+i*.17)%1,p=proj(slerp(A1,B1,t),.18*Math.sin(Math.PI*t));if(p.vis){ctx.fillStyle='#9FD4FF';ctx.shadowColor='#4C8DFF';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(p.X,p.Y,2.2,0,7);ctx.fill();ctx.shadowBlur=0}});
    ctx.font='600 11px Archivo, system-ui, sans-serif';const placed=[];
    CITIES.forEach(c=>{const p=proj(vec(c.lat,c.lon));c._p=p;if(!p.vis)return;const s=c.ex?states[c.ex]||{c:''}:{c:'x'};const col=c.ex?(s.c==='open'?'#2FBF77':s.c==='pre'?'#C9A55C':'#7A869A'):'#9FC3FF';const hv=hover&&hover.c===c,sel=GSEL&&GSEL.c===c;
      if(c.ex&&s.c==='open'&&!RM){const ph=((now/1400+c.lon)%1+1)%1;ctx.strokeStyle=`rgba(47,191,119,${(1-ph)*.7})`;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(p.X,p.Y,4+ph*14,0,7);ctx.stroke()}
      ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=c.ex?10:6;ctx.beginPath();ctx.arc(p.X,p.Y,hv||sel?6:c.ex?4:2.6,0,7);ctx.fill();ctx.shadowBlur=0;
      if((c.ex&&r>150&&!placed.some(q=>Math.abs(q[0]-p.X)<70&&Math.abs(q[1]-p.Y)<14))||hv||sel||(zoom>1.6&&!placed.some(q=>Math.abs(q[0]-p.X)<60&&Math.abs(q[1]-p.Y)<13))){placed.push([p.X,p.Y]);ctx.fillStyle=hv||sel?tx:(L?'rgba(11,18,32,.75)':'rgba(233,237,242,.78)');ctx.fillText(c.name,p.X+8,p.Y+4)}});
    ctx.font='700 12px Archivo, system-ui, sans-serif';ctx.textAlign='center';
    CONTINENTS.forEach(k=>{const p=proj(vec(k[1],k[2]),.02);k._p=p;if(!p.vis||p.dz<.35)return;const hv=hover&&hover.k===k,sel=GSEL&&GSEL.k===k;ctx.fillStyle=hv||sel?'#B9A8FF':(L?'rgba(36,89,216,.7)':'rgba(170,200,255,.6)');ctx.fillText(k[0].toUpperCase(),p.X,p.Y)});ctx.textAlign='start';
    raf=requestAnimationFrame(draw)}
  raf=requestAnimationFrame(draw);
  const hit=(x,y)=>{let best=null,bd=12;CITIES.forEach(c=>{const p=c._p;if(!p||!p.vis)return;const d=Math.hypot(p.X-x,p.Y-y);if(d<bd){bd=d;best={c,name:c.name,type:'Financial center'}}});if(best)return best;
    {let bc=null,bd2=9;const test=(c,st)=>{const p=c._p;if(!p||!p.vis)return;if(st&&zoom<1.9)return;if(!SHOW_CAPS&&c!==capitalOf(GSEL))return;const d=Math.hypot(p.X-x,p.Y-y);if(d<bd2){bd2=d;bc=c}};CAP_RAW.forEach(c=>test(c,false));STATE_CAP_RAW.forEach(c=>test(c,true));if(bc)return{cap:bc,name:bc.name,type:'Capital',id:bc.iso}}
    for(const k of CONTINENTS){const p=k._p;if(p&&p.vis&&p.dz>=.35&&Math.abs(p.X-x)<k[0].length*4.4&&Math.abs(p.Y-4-y)<9)return{k,name:k[0],type:'Continent'}}
    const ll=unproj(x,y);if(!ll)return null;const st=hitFeat(GEOUS,ll.lo,ll.la);if(st)return{f:st,name:st.name,type:'U.S. state',id:st.id};const co=hitFeat(GEOW,ll.lo,ll.la);if(co)return{f:co,name:co.name,type:'Country',id:co.id};
    if(!GEOW){const lf=hitFeat(land(),ll.lo,ll.la);if(lf){let name=lf.cont;if(name==='Eurasia')name=EUROPE_TEST(ll.lo,ll.la)?'Europe':'Asia';const k=CONTINENTS.find(c=>c[0]===name);return{k,name,type:'Continent',lf:land().filter(x=>x.cont===lf.cont)}}}return null};
  const pos=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top]};
  cv.onpointerdown=e=>{const [x,y]=pos(e);drag={x,y,lon:lon0,tilt,moved:false};target=null;cv.setPointerCapture(e.pointerId)};
  cv.onpointermove=e=>{const [x,y]=pos(e);if(drag){const dx=x-drag.x,dy=y-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;lon0=drag.lon-dx/R()*57;tilt=Math.max(-70*rad,Math.min(70*rad,drag.tilt+dy/R()));tip.hidden=true;return}
    hover=hit(x,y);cv.style.cursor=hover?'pointer':'grab';
    if(hover){let extra='';if(hover.c&&hover.c.ex){const s=exState(hover.c.ex);extra=`<span class="sess ${s.c}"><i></i>${hover.c.ex} · ${s.time} local · ${s.t}</span>`}tip.hidden=false;tip.style.left=Math.min(x+14,W-210)+'px';tip.style.top=(y+14)+'px';const hc=hover.type==='Capital'?null:capitalOf(hover);tip.innerHTML=`<b>${hover.id&&hover.type==='Country'?flag(hover.id)+' ':''}${esc(hover.name)}</b><span class="mono">${hover.type==='Capital'?`★ Capital of ${esc(hover.cap.state?hover.cap.country+', U.S.':hover.cap.country)}`:hover.type+' · click to explore'}</span>${hc?`<span class="gtip-cap">★ Capital: ${esc(hc.name)}</span>`:''}${extra}`}else tip.hidden=true};
  cv.onpointerup=e=>{const d=drag;drag=null;if(d&&!d.moved){const [x,y]=pos(e);const h=hit(x,y);if(h){GSEL=h;const ll=h.c?{la:h.c.lat,lo:h.c.lon}:h.cap?{la:h.cap.lat,lo:h.cap.lon}:h.k?{la:h.k[1],lo:h.k[2]}:unproj(x,y);if(ll)target={la:Math.max(-60,Math.min(60,ll.la)),lo:ll.lo};if(h.type!=='Continent'&&tz<1.5)tz=1.6;selectPlace(h)}}};
  cv.onpointerleave=()=>{hover=null;tip.hidden=true};
  cv.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey&&Math.abs(e.deltaY)<40&&!GSEL)return;e.preventDefault();tz=Math.max(.8,Math.min(4,tz*(e.deltaY<0?1.12:.89)))},{passive:false});
  $$('[data-caps]').forEach(b=>b.onclick=()=>{SHOW_CAPS=!SHOW_CAPS;b.classList.toggle('on',SHOW_CAPS);b.setAttribute('aria-pressed',String(SHOW_CAPS))});
  $$('[data-gz]').forEach(b=>b.onclick=()=>{const k=+b.dataset.gz;if(!k){tz=1;GSEL=null;target=null;tilt=22*rad;renderGP()}else tz=Math.max(.8,Math.min(4,tz*(k>0?1.35:.74)))});
  window.__globeFocus=(la,lo,z)=>{target={la,lo};tz=z||1.6};
  cleanup.push(()=>{cancelAnimationFrame(raf);ro.disconnect();window.__globeFocus=null})}

/* ---------- place panel ---------- */
const GP_PICKS=[['United States','Country','US'],['United Kingdom','Country','GB'],['China','Country','CN'],['Japan','Country','JP'],['Germany','Country','DE'],['Argentina','Country','AR'],['California','U.S. state','US-CA'],['New York','Financial center'],['London','Financial center'],['Hong Kong','Financial center'],['Africa','Continent'],['Europe','Continent']];
function placeRecords(p){const n=p.name.toLowerCase(),country=(p.c&&p.c.country||'').toLowerCase();const alias={'united states':['united states','u.s.','america'],'united kingdom':['united kingdom','britain','british','london','sterling'],germany:['germany','german','west germany'],china:['china','chinese','shanghai','yuan'],japan:['japan','japanese','nikkei','yen'],russia:['russia','ruble']}[n]||[n];
  const files=HIST.filter(a=>a.countries.some(c=>c.toLowerCase()===n||(country&&c.toLowerCase()===country))||a.loc.toLowerCase().startsWith(n)||alias.some(w=>(a.head+' '+a.deck).toLowerCase().includes(w)));
  const evs=EVENTS.filter(e=>!e.own&&alias.some(w=>e.head.toLowerCase().includes(w))).sort((a,b)=>a.date.localeCompare(b.date));
  return {files,evs}}
function renderGP(){const gp=$('#gp');if(!gp)return;const p=GSEL;
  if(!p){gp.innerHTML=`<p class="mono dim gp-k">PICK A PLACE</p><h2 class="gp-h">Explore the world’s financial history</h2><p class="gp-p">Click the globe — a continent, a country, a U.S. state or a financial center. Or start here:</p><div class="gp-find"><label class="sr" for="gp-find">Find a country, state or capital</label><input class="inp" id="gp-find" placeholder="Find a country, state or capital…" autocomplete="off"><div class="gp-fr" id="gp-fr"></div></div><div class="gp-picks">${GP_PICKS.map(([n,t,id])=>`<button class="tag" data-pick="${esc(n)}|${t}|${id||''}">${id&&t==='Country'?flag(id)+' ':''}${esc(n)}</button>`).join('')}</div><p class="mono dim gp-geo" id="geo-stat">${GEO_STATE==='ready'?`${GEOW.length} countries · ${GEOUS.length} U.S. states · ${CITIES.length} financial centers`:'Loading borders…'}</p>`;return}
  const cap=capitalOf(p);const country=p.type==='Country'?p.name:p.c?p.c.country:p.type==='Capital'?(p.cap.state?'United States':p.cap.country):p.type==='U.S. state'?'United States':'';const mk=mktFor(country);const {files,evs}=placeRecords(p);
  const ex=p.c&&p.c.ex?exState(p.c.ex):null;const label=p.type==='Capital'?`${p.name}, ${p.cap.state?p.cap.country+', United States':p.cap.country} (capital)`:p.type==='Financial center'?`${p.name}${p.c.country?', '+p.c.country:''}`:p.type==='U.S. state'?`${p.name}, United States`:p.name;
  gp.innerHTML=`<div class="gp-top"><p class="mono dim gp-k">${p.type.toUpperCase()}</p><button class="ib" data-gpx aria-label="Clear selection">×</button></div><h2 class="gp-h">${p.type==='Country'&&p.id?`<span class="gp-flag">${flag(p.id)}</span>`:''}${esc(p.name)}</h2>
  ${p.type==='Capital'?`<p class="gp-cap"><span class="gp-star">★</span> Capital of <button class="lnk" data-capof="${esc(p.cap.iso)}">${esc(p.cap.state?p.cap.country+', U.S.':p.cap.country)}</button>${p.cap.note?`<span class="gp-capn">${esc(p.cap.note)}</span>`:''}</p>`:cap?`<p class="gp-cap"><span class="gp-star">★</span> ${cap.state?'State capital':'Capital'}: <button class="lnk" data-capfly="${esc(cap.iso)}">${esc(cap.name)}</button>${cap.note?`<span class="gp-capn">${esc(cap.note)}</span>`:''}</p>`:''}
  ${ex?`<p class="sess ${ex.c} gp-ex"><i></i>${p.c.ex} · ${ex.time} local · ${ex.t}</p>`:''}
  ${mk.length?`<div class="gp-m">${qs(mk).map(q=>{const c=chg(q);return `<div class="gp-q" data-id="${q.id}" ${rowAttr(q)}><span>${esc(q.name)}</span><b class="mono" data-f="v">${fmtV(q)}</b><span class="mono c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</span></div>`}).join('')}</div>`:''}
  <div class="gp-ai"><p class="mono dim gp-k">✦ RESEARCH · ECONOMIC & FINANCIAL HISTORY</p><div class="gp-chips">${['Economic history','Financial crises','Money & currency','Markets & exchanges','Banks & central bank','Today’s economy'].map(f=>`<button class="tag" data-gpai="${f}">${f}</button>`).join('')}</div>
  <form class="gp-f" id="gp-f"><input class="inp" id="gp-i" placeholder="Ask anything about ${esc(p.name)}’s economy…" autocomplete="off"><button class="btn btn-p">Ask</button></form><div class="gp-out" id="gp-out" aria-live="polite">${SAMPLE?'':''}</div></div>
  <div class="gp-rec"><p class="mono dim gp-k">IN THE MARKET FILES · ${files.length+evs.length}</p>${files.map(a=>`<a href="#/file/${a.slug}"><span class="mono">${a.y}</span>${esc(a.head)}</a>`).join('')}${evs.slice(0,12).map(e=>`<a href="#/day/${e.date}"><span class="mono">${e.y}</span>${esc(e.head)}</a>`).join('')}${files.length+evs.length?'':'<p class="dim">No files yet — ask Market Files AI above.</p>'}</div>`;
  gp.dataset.label=label;gp.scrollTop=0;attachHolo()}
let GP_CTL=null;
async function gpAskClaude(focus,free){const out=$('#gp-out'),gp=$('#gp');if(!out||!SAMPLE)return;const label=gp.dataset.label;if(GP_CTL)GP_CTL.abort();GP_CTL=new AbortController();
  out.innerHTML='<div class="aio-sk"><i></i><i></i><i></i></div><p class="mono dim air-think">Researching '+esc(label)+'…</p>';
  const q=free?`About ${label}: ${free}`:`Give an economic and financial history of ${label}, focused on: ${focus}. Include a short "Key dates" list of 4–8 dated milestones (month, day and year when you are sure; otherwise year only).`;
  try{const r=await SAMPLE([{role:'user',content:`${AI_SYS}\n\nReader's question: ${q}`}],{modelTier:'default',signal:GP_CTL.signal,tools:aiTools(),onText:({text})=>{out.innerHTML=md(text)}});out.innerHTML=md(r.text)+'<p class="mono dim air-n">AI research from Claude and the Market Files archive. Can be wrong or out of date — verify key facts.</p>'}
  catch(e){out.innerHTML=(e&&e.text?md(e.text):'')+`<p class="dim">${AIERR[e&&e.code]||'Market Files AI couldn’t answer right now.'}</p>`}finally{GP_CTL=null}}
function selectPlace(h){GSEL=h;renderGP();const gp=$('#gp');if(gp&&innerWidth<900)gp.scrollIntoView({behavior:RM?'auto':'smooth',block:'start'})}
function selectCountryOrState(c){const st=!!c.state;const list=st?GEOUS:GEOW;const f=list&&list.find(x=>x.id===c.iso||x.id==='US-'+c.country||x.name.toLowerCase()===c.country.toLowerCase());
  const h={name:f?f.name:c.country,type:st?'U.S. state':'Country',id:st?(f?f.id:c.iso):c.iso,f};if(f){const b=f.bb;window.__globeFocus&&window.__globeFocus((b[1]+b[3])/2,(b[0]+b[2])/2,st?2.4:(b[2]-b[0]>60?1.1:1.6))}else window.__globeFocus&&window.__globeFocus(c.lat,c.lon,st?2.4:1.6);selectPlace(h)}
function wireGP(){const gp=$('#gp');if(!gp)return;renderGP();
  gp.addEventListener('click',e=>{const pk=e.target.closest('[data-pick]');if(pk){const [n,t,id]=pk.dataset.pick.split('|');let h={name:n,type:t,id};
      if(t==='Financial center'){const c=CITIES.find(x=>x.name===n);h.c=c;window.__globeFocus&&window.__globeFocus(c.lat,c.lon,1.8)}
      else if(t==='Continent'){const k=CONTINENTS.find(x=>x[0]===n);h.k=k;window.__globeFocus&&window.__globeFocus(k[1],k[2],1)}
      else{const list=t==='U.S. state'?GEOUS:GEOW;const f=list&&list.find(x=>x.id===id);if(f){h.f=f;const b=f.bb;window.__globeFocus&&window.__globeFocus((b[1]+b[3])/2,(b[0]+b[2])/2,t==='U.S. state'?2.4:1.5)}}
      selectPlace(h)}
    if(e.target.closest('[data-gpx]')){GSEL=null;renderGP()}
    const cf=e.target.closest('[data-capfly]');if(cf){const c=[...CAP_RAW,...STATE_CAP_RAW].find(x=>x.iso===cf.dataset.capfly);if(c){window.__globeFocus&&window.__globeFocus(c.lat,c.lon,c.state?2.8:2);selectPlace({cap:c,name:c.name,type:'Capital',id:c.iso})}}
    const co=e.target.closest('[data-capof]');if(co){const c=[...CAP_RAW,...STATE_CAP_RAW].find(x=>x.iso===co.dataset.capof);if(c)selectCountryOrState(c)}
    const fr=e.target.closest('[data-find]');if(fr){const [kind,iso]=fr.dataset.find.split('|');const c=[...CAP_RAW,...STATE_CAP_RAW].find(x=>x.iso===iso);if(!c)return;if(kind==='cap'){window.__globeFocus&&window.__globeFocus(c.lat,c.lon,c.state?2.8:2);selectPlace({cap:c,name:c.name,type:'Capital',id:c.iso})}else selectCountryOrState(c)}
    const ai=e.target.closest('[data-gpai]');if(ai){$$('[data-gpai]',gp).forEach(b=>b.classList.toggle('on',b===ai));gpAsk(ai.dataset.gpai)}});
  gp.addEventListener('input',e=>{if(e.target.id!=='gp-find')return;const q=e.target.value.trim().toLowerCase();const out=$('#gp-fr');if(!q){out.innerHTML='';return}
    const all=[...CAP_RAW,...STATE_CAP_RAW];const res=[];all.forEach(c=>{if(c.country.toLowerCase().includes(q))res.push(['place',c]);if(c.name.toLowerCase().includes(q))res.push(['cap',c])});
    out.innerHTML=res.slice(0,8).map(([k,c])=>`<button data-find="${k}|${esc(c.iso)}"><span>${k==='cap'?'★ '+esc(c.name):(c.state?'':flag(c.iso)+' ')+esc(c.country)}</span><span class="mono">${k==='cap'?`Capital of ${esc(c.state?c.country+', U.S.':c.country)}`:(c.state?'U.S. state':'Country')+' · ★ '+esc(c.name)}</span></button>`).join('')||'<p class="dim">No match.</p>'});
  gp.addEventListener('submit',e=>{if(e.target.id==='gp-f'){e.preventDefault();const v=$('#gp-i').value.trim();if(v)gpAsk(null,v)}})}
function globeHero(){return `<section class="gh" id="j-globe"><div class="wrap gh-in">
  <div class="gh-side"><div class="gh-copy"><div class="gh-brand"><img src="${LOGO240}" alt="Market Files logo" width="64" height="64"><span class="mono">MARKET FILES · MARKETS • MONEY • HISTORY</span></div>
    <h1 class="holo">Every market on Earth — and the history behind it.</h1><p>Market Files is a financial library and newsroom: live markets and futures, centuries of market history, and AI research on anything financial. Spin the globe and click any continent, country, state, capital or financial center.</p><div class="gh-cta"><a class="btn btn-p" href="https://x.com/TheMarketFiles" target="_blank" rel="noopener"><svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.4L6.3 22H3.2l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z"/></svg> Follow @TheMarketFiles</a><a class="btn" href="#/newsletter">Get The Daily File</a><a class="btn" href="#/library">Open the Library</a></div></div>
    <aside class="gp" id="gp" data-holo aria-live="polite"></aside></div>
  <div class="gh-stage"><canvas id="globe" role="img" aria-label="Interactive globe of world markets. Use the place list to explore by keyboard."></canvas><div class="gtip" id="gtip" hidden></div>
    <div class="gh-ctl"><button class="ib" data-gz="1" aria-label="Zoom in">+</button><button class="ib" data-gz="-1" aria-label="Zoom out">−</button><button class="ib" data-gz="0" aria-label="Reset globe">⟲</button><button class="ib gz-cap on" data-caps aria-pressed="true" aria-label="Show capitals" title="Capitals">★</button></div>
    <div class="gh-lg mono"><span><i style="background:#2FBF77"></i>Exchange open</span><span><i style="background:#C9A55C"></i>Lunch / pre-market</span><span><i style="background:#7A869A"></i>Closed</span><span><i style="background:#9FC3FF"></i>Financial center</span><span><i style="background:#F5C96B;border-radius:1px;transform:rotate(45deg)"></i>Capital</span></div></div>
  </div><a class="gh-down mono" href="#j-mk" data-jumpto="j-mk">MARKETS NOW ↓</a></section>`}

/* ---------- instrument drawer ---------- */
const KW={BTC:['bitcoin'],ETH:['ether'],XAU:['gold'],EURUSD:['euro'],SX5E:['euro'],USDJPY:['yen','japan'],NKY:['japan'],GBPUSD:['sterling'],UKX:['sterling','london'],USDCHF:['franc'],DXY:['dollar'],SPX:['equities'],INDU:['dow'],COMP:['nasdaq'],VIX:['crash'],US10Y:['treasury','repo'],US2Y:['treasury'],US5Y:['treasury'],US30Y:['treasury'],DAX:['germany'],IT10Y:['euro'],DE10Y:['euro'],SOL:['bitcoin'],XLF:['bank'],XLK:['nasdaq']};
function lineChart(s,prev){const h=170,all=[...s,prev],mn=Math.min(...all),mx=Math.max(...all),rg=mx-mn||1,n=s.length,X=i=>(i/(n-1)*1000).toFixed(1),Y=v=>(8+(1-(v-mn)/rg)*(h-16)).toFixed(1),col=s[n-1]>=prev?'#2FBF77':'#E5534B',d=s.map((v,i)=>`${i?'L':'M'}${X(i)},${Y(v)}`).join('');
  return `<svg viewBox="0 0 1000 ${h}" preserveAspectRatio="none" class="dsvg" aria-hidden="true"><line x1="0" x2="1000" y1="${Y(prev)}" y2="${Y(prev)}" style="stroke:var(--tx3)" stroke-dasharray="4 5" vector-effect="non-scaling-stroke"/><path d="${d}L1000,${h}L0,${h}Z" fill="${col}" fill-opacity=".13"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`}
function openInst(id){const q=INSTR.find(x=>x.id===id);if(!q)return;const c=chg(q);const grp={eq:'eq',sec:'eq',rt:'rt',gy:'rt',cm:'cm',fx:'fx',cr:'cr',wi:'fx',fu:'fu'}[q.g]||'cm';const s=q.ex?exState(q.ex):session(grp);
  const kws=KW[id]||[];const rel=kws.length?A.filter(a=>{const h=[a.head,a.deck,...a.assets,...a.countries].join(' ').toLowerCase();return kws.some(k=>h.includes(k))}).slice(0,4):[];
  const ser=q.intra||q.series;
  $('#inst-b').innerHTML=`<div class="holo-bar"></div><div class="side-h"><div><span class="mono dim">${q.id}${q.ex?` · ${q.ex}`:''}</span><h2>${esc(q.name)}</h2></div><button class="ib" data-x aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M5 5l14 14M19 5 5 19"/></svg></button></div>
  <div class="side-v" data-id="${q.id}"><span class="mono" data-f="v">${q.g==='cr'?'$':''}${fmtV(q)}</span><span class="mono c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</span></div>
  <div class="side-c">${window.MF_TV&&(q.na||q.fut)?'<div class="tvw tvw-sm" id="tv-sym"></div>':lineChart(ser,q.prev)}<div class="ch-ax mono"><span>${q.intra?'9:30':'Earlier'}</span><span>${q.intra?'16:00 ET':'Now'}</span></div></div>
  <dl class="side-s"><dt>Prior close</dt><dd class="mono">${q.prev.toLocaleString('en-US',{maximumFractionDigits:q.dp})}</dd><dt>Range</dt><dd class="mono">${Math.min(...ser).toLocaleString('en-US',{maximumFractionDigits:q.dp})} – ${Math.max(...ser).toLocaleString('en-US',{maximumFractionDigits:q.dp})}</dd><dt>Session</dt><dd><span class="sess ${s.c}"><i></i>${s.t}</span></dd>${q.sup?`<dt>Market cap</dt><dd class="mono" data-mc="${q.id}">${fmtCap(mcap(q))}</dd>`:''}<dt>Data</dt><dd class="mono">${Feed.name}</dd></dl>
  <div class="side-a"><a class="btn btn-p" href="${tvUrl(q.id)}" target="_blank" rel="noopener">Open in TradingView ↗</a>${CMC[q.id]?`<a class="btn" href="${cmcUrl(q.id)}" target="_blank" rel="noopener">CoinMarketCap ↗</a>`:''}<a class="btn" href="${aiHref(`What drives ${q.name} and what is its history?`)}" data-x>✦ Research</a></div>
  <div class="side-r"><h3 class="mono">FROM THE MARKET FILES</h3>${rel.length?rel.map(a=>`<a href="#/file/${a.slug}" data-x><span class="mono">${a.type==='hist'?a.y:'NOW'}</span>${esc(a.head)}</a>`).join(''):`<p class="dim">No files tagged to ${esc(q.name)} yet. <a href="#/search?q=${encodeURIComponent(q.name)}" data-x>Search the archive</a>.</p>`}</div>`;
  const d=$('#inst');if(!d.open)d.showModal();if(window.MF_TV&&(q.na||q.fut))mountTVSymbol($('#tv-sym'),q)}

/* ---------- command palette ---------- */
let CK=[],CKI=0;
function ckItems(q){q=q.trim().toLowerCase();const m=t=>!q||t.toLowerCase().includes(q);const go=h=>()=>location.hash=h;
  const pages=[...NAV.map(([r,l])=>({t:l,k:'Page',go:go('#/'+r)})),{t:'Time Machine calendar',k:'Page',go:go('#/on-this-date')},{t:'Futures',k:'Page',go:go('#/futures')},{t:'Timeline',k:'Page',go:go('#/timeline')},{t:'On This Date',k:'Page',go:go('#/on-this-date')},{t:'Search',k:'Page',go:go('#/search')},{t:'Newsletter',k:'Page',go:go('#/newsletter')}].filter(x=>m(x.t));
  const acts=[{t:`Switch to ${document.documentElement.dataset.theme==='dark'?'light':'dark'} theme`,k:'Action',go:toggleTheme}].filter(x=>m(x.t+' theme mode'));
  const ins=INSTR.filter(i=>m(i.name+' '+i.id)).map(i=>({t:i.name,k:i.id,go:()=>openInst(i.id)}));
  const fl=q?A.filter(a=>m(a.head+' '+a.y+' '+a.cat)).map(a=>({t:a.head,k:a.type==='hist'?String(a.y):'Now',go:go('#/file/'+a.slug)})):[];
  const dm=q.match(/^(\d{4})-(\d\d)-(\d\d)$/);const dayI=dm&&validDay(+dm[1],+dm[2],+dm[3])?[{t:`Day file: ${MONTHS[+dm[2]-1]} ${+dm[3]}, ${dm[1]}`,k:'Day',go:go('#/day/'+q)}]:[];const yr=/^\d{3,4}$/.test(q)?[{t:`Everything filed in ${q}`,k:'Year',go:go('#/on-this-date/year/'+q)}]:[];
  const web=q?[{t:`Ask Market Files AI: “${q}”`,k:'✦ AI',go:go(aiHref(q))}]:[];
  return [...dayI,...yr,...pages.slice(0,q?4:9),...acts,...ins.slice(0,q?6:4),...fl.slice(0,6),...web]}
function renderCk(){const l=$('#ck-l');CK=ckItems($('#ck-i').value);CKI=Math.min(CKI,Math.max(0,CK.length-1));
  l.innerHTML=CK.length?CK.map((x,i)=>x.href?`<a class="ck-i" role="option" aria-selected="${i===CKI}" href="${x.href}" target="_blank" rel="noopener" data-i="${i}"><span>${esc(x.t)}</span><span class="mono">${x.k}</span></a>`:`<button class="ck-i" role="option" aria-selected="${i===CKI}" data-i="${i}"><span>${esc(x.t)}</span><span class="mono">${esc(x.k)}</span></button>`).join(''):'<p class="dim" style="padding:16px">No matches. Try an index, a year or a crisis.</p>';
  $('[aria-selected="true"]',l)?.scrollIntoView({block:'nearest'})}
function runCk(i){const x=CK[i];if(!x)return;if(x.href){$(`.ck-i[data-i="${i}"]`).click();return}$('#cmdk').close();x.go()}
function openCmdk(){const d=$('#cmdk');$('#ck-i').value='';CKI=0;renderCk();if(!d.open)d.showModal();$('#ck-i').focus()}

/* ---------- theme + holographic hover ---------- */
const SUN='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';
function setTheme(t){document.documentElement.dataset.theme=t;try{localStorage.setItem('mf-theme',t)}catch(e){}const b=$('#theme-b');b.innerHTML=t==='dark'?SUN:MOON;b.setAttribute('aria-label',t==='dark'?'Switch to light theme':'Switch to dark theme');($('meta[name="theme-color"]')||{}).content=t==='dark'?'#080B10':'#F3F5F8';
  $$('.bigsvg').length&&$('#bigchart')&&($('#bigchart').innerHTML=bigChart(INSTR.find(x=>x.id===CHART)));$('#yc')&&($('#yc').innerHTML=yieldCurve())}
function toggleTheme(){setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')}
function attachHolo(){$$('[data-holo]').forEach(el=>{if(el._h)return;el._h=1;el.addEventListener('pointermove',e=>{const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;el.style.setProperty('--mx',x*100+'%');el.style.setProperty('--my',y*100+'%');
  if(el.dataset.holo==='tilt'&&!RM)el.style.transform=`perspective(900px) rotateX(${((.5-y)*6).toFixed(2)}deg) rotateY(${((x-.5)*6).toFixed(2)}deg) translateZ(0)`});el.addEventListener('pointerleave',()=>{el.style.transform=''})})}
function bootLine(){const el=$('#sys');if(!el)return;const open=Object.keys(EXCH).filter(k=>exState(k).c==='open').length;const txt=`MF//TERMINAL ONLINE · FEED ${Feed.name} · ${INSTR.length} INSTRUMENTS · ${Object.keys(EXCH).length} EXCHANGES · ${open} OPEN NOW · PRESS ⌘K / CTRL+K FOR COMMANDS`;
  if(RM){el.textContent=txt;return}let i=0;const t=setInterval(()=>{i+=2;el.textContent=txt.slice(0,i);if(i>=txt.length)clearInterval(t)},14);cleanup.push(()=>clearInterval(t))}

/* ---------- newsstand + social pulse ---------- */
const PRESS=[['Real-time market pulse',[['Bloomberg','Markets, data and breaking business news','https://www.bloomberg.com/markets'],['Reuters','Global wire coverage of markets','https://www.reuters.com/markets/'],['CNBC','Live market TV and headlines','https://www.cnbc.com/markets/'],['MarketWatch','Market briefs and personal finance','https://www.marketwatch.com/'],['Yahoo Finance','Free quotes, charts and portfolios','https://finance.yahoo.com/']]],
 ['Deep analysis',[['The Wall Street Journal','Business and markets reporting','https://www.wsj.com/'],['Financial Times','Global finance and economics','https://www.ft.com/markets'],['The Economist','Finance and economics analysis','https://www.economist.com/finance-and-economics'],['The New York Times','Business and economy coverage','https://www.nytimes.com/section/business']]],
 ['Learning & research',[['Investopedia','Definitions, tutorials and explainers','https://www.investopedia.com/'],['Morningstar','Independent fund and stock research','https://www.morningstar.com/'],['Koyfin','Institutional-style charts and data','https://www.koyfin.com/'],['FRED · St. Louis Fed','Free economic data series','https://fred.stlouisfed.org/']]],
 ['Community',[['Seeking Alpha','Investor analysis and commentary','https://seekingalpha.com/'],['EconomyWatch','Economics and trading education','https://www.economywatch.com/']]]];
const PULSE=[['S&P 500','$SPX OR $SPY','SPY'],['Nasdaq','$QQQ OR Nasdaq','QQQ'],['The Fed','FOMC OR "Federal Reserve"',''],['Treasury yields','"Treasury yields" OR $TNX',''],['Oil','"oil prices" OR $CL_F','USO'],['Gold','$GLD OR "gold price"','GLD'],['Bitcoin','$BTC OR bitcoin','BTC.X'],['Ethereum','$ETH OR ethereum','ETH.X'],['Earnings','earnings beat OR miss',''],['Global markets','Nikkei OR DAX OR FTSE','']];
function newsstand(){return `<section class="sec wrap" id="newsstand">${secHead('The Newsstand','The rest of the financial press, one click away.','')}
  
  <div class="press">${PRESS.map(([g,list])=>`<div class="press-g"><h3 class="mono">${g.toUpperCase()}</h3>${list.map(([n,t,u])=>`<a href="${u}" target="_blank" rel="noopener" data-holo><b>${n}</b><span>${t}</span><i aria-hidden="true">↗</i></a>`).join('')}</div>`).join('')}</div></section>
  <section class="sec wrap" id="pulse">${secHead('Social Pulse','What traders are saying right now. Each topic opens a live search.','')}
  <div class="pulse">${PULSE.map(([l,q,st])=>`<div class="pl" data-holo><b>${l}</b><div class="pl-a"><a href="https://x.com/search?q=${encodeURIComponent(q)}&f=live" target="_blank" rel="noopener">X ↗</a><a href="https://www.reddit.com/search/?q=${encodeURIComponent(l)}&sort=new" target="_blank" rel="noopener">Reddit ↗</a><a href="https://www.youtube.com/results?search_query=${encodeURIComponent(l+' market today')}" target="_blank" rel="noopener">YouTube ↗</a>${st?`<a href="https://stocktwits.com/symbol/${st}" target="_blank" rel="noopener">StockTwits ↗</a>`:''}</div></div>`).join('')}</div>
  <p class="pv">Live headline and trend feeds from these outlets and X connect in the production build. Links open the sources directly.</p></section>`}
function wireNewsstand(){const i=$('#ps-i'),g=$('#ps-go');if(!i)return;const s=()=>{g.href=WEB.press.u(i.value.trim()||'markets today')};i.oninput=s;$('#ps-f').onsubmit=e=>{e.preventDefault();s();g.click()}}

/* ---------- Crash Lab: peak-to-trough drawdowns (index closing levels; in review) ---------- */
const CRASHES=[
 {id:'1929',name:'Great Crash',idx:'Dow',peak:['1929-09-03',381.17],low:['1932-07-08',41.22],rec:'1954-11-23',slug:'black-tuesday-1929',col:'#C9A55C'},
 {id:'1987',name:'Black Monday',idx:'Dow',peak:['1987-08-25',2722.42],low:['1987-10-19',1738.74],rec:'1989-08-24',slug:'black-monday-1987',col:'#E5534B'},
 {id:'2000',name:'Dot-com bust',idx:'Nasdaq',peak:['2000-03-10',5048.62],low:['2002-10-09',1114.11],rec:'2015-04-23',slug:'nasdaq-peak-2000',col:'#8E7CF7'},
 {id:'2008',name:'Financial crisis',idx:'S&P 500',peak:['2007-10-09',1565.15],low:['2009-03-09',676.53],rec:'2013-03-28',slug:'lehman-bankruptcy-2008',col:'#4C8DFF'},
 {id:'2020',name:'Pandemic crash',idx:'S&P 500',peak:['2020-02-19',3386.15],low:['2020-03-23',2237.40],rec:'2020-08-18',slug:'pandemic-crash-2020',col:'#2FBF77'},
 {id:'2022',name:'Inflation bear',idx:'S&P 500',peak:['2022-01-03',4796.56],low:['2022-10-12',3577.03],rec:'2024-01-19',slug:'',col:'#F2A03D'}];
const dDays=(a,b)=>Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/864e5);
CRASHES.forEach(c=>{c.depth=(c.low[1]/c.peak[1]-1)*100;c.fall=dDays(c.peak[0],c.low[0]);c.back=dDays(c.low[0],c.rec);c.total=dDays(c.peak[0],c.rec)});
const durTxt=d=>d>=730?`${(d/365.25).toFixed(1)} years`:d>=60?`${Math.round(d/30.44)} months`:`${d} days`;
let LABSEL='2008';
function labSVG(){const W=760,H=360,L=64,Rt=24,T=24,B=48,lx=v=>L+(Math.log10(v)-1.3)/(3.1-1.3)*(W-L-Rt),ly=v=>T+(-v)/95*(H-T-B);
  let g='';[0,-25,-50,-75].forEach(v=>{g+=`<line x1="${L}" x2="${W-Rt}" y1="${ly(v)}" y2="${ly(v)}" style="stroke:var(--line)"/><text x="${L-10}" y="${ly(v)+4}" text-anchor="end" class="lab-ax">${v}%</text>`});
  [30,60,120,250,500,1000].forEach(v=>{g+=`<line x1="${lx(v)}" x2="${lx(v)}" y1="${T}" y2="${H-B}" style="stroke:var(--line)" stroke-dasharray="2 6"/><text x="${lx(v)}" y="${H-B+20}" text-anchor="middle" class="lab-ax">${v}d</text>`});
  g+=`<text x="${(L+W-Rt)/2}" y="${H-8}" text-anchor="middle" class="lab-ax">Days from peak to bottom (log scale)</text><text x="16" y="${(T+H-B)/2}" transform="rotate(-90 16 ${(T+H-B)/2})" text-anchor="middle" class="lab-ax">Peak-to-trough fall</text>`;
  const pts=CRASHES.map(c=>{const x=lx(c.fall),y=ly(c.depth),r=8+Math.sqrt(c.back/30)*1.6,on=c.id===LABSEL;
    return `<g class="lab-pt${on?' on':''}" data-lab="${c.id}" tabindex="0" role="button" aria-label="${c.name}: ${c.depth.toFixed(1)}% over ${durTxt(c.fall)}"><circle cx="${x}" cy="${y}" r="${r+10}" fill="${c.col}" opacity="${on?.18:.07}" class="lab-halo"/><circle cx="${x}" cy="${y}" r="${r}" fill="${c.col}" fill-opacity=".28" stroke="${c.col}" stroke-width="${on?2.5:1.5}"/><text x="${c.id==='1929'?x+r+8:x}" y="${c.id==='1929'?y+4:y-r-8}" text-anchor="${c.id==='1929'?'start':'middle'}" class="lab-lb">${c.id}</text></g>`}).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="lab-svg" role="group" aria-label="Crash comparison chart">${g}${pts}</svg>`}
function labDetail(){const c=CRASHES.find(x=>x.id===LABSEL);const mx=Math.max(...CRASHES.map(x=>x.total));
  return `<div class="lab-d" style="--lc:${c.col}"><p class="mono dim">${c.idx.toUpperCase()} · ${fmtISO(c.peak[0]).toUpperCase()} → ${fmtISO(c.low[0]).toUpperCase()}</p><h3>${c.name}</h3>
  <div class="lab-big"><span class="mono">${c.depth.toFixed(1)}%</span><small>peak to trough</small></div>
  <dl><dt>Peak</dt><dd class="mono">${c.peak[1].toLocaleString('en-US')} · ${fmtISO(c.peak[0])}</dd><dt>Bottom</dt><dd class="mono">${c.low[1].toLocaleString('en-US')} · ${fmtISO(c.low[0])}</dd><dt>Time to bottom</dt><dd class="mono">${durTxt(c.fall)}</dd><dt>Back to the old high</dt><dd class="mono">${fmtISO(c.rec)} · ${durTxt(c.back)} later</dd></dl>
  <div class="lab-bar" aria-hidden="true"><i style="width:${c.fall/mx*100}%;background:var(--dn)"></i><i style="width:${c.back/mx*100}%;background:var(--up)"></i></div><p class="mono dim lab-bl"><span>■ falling</span><span style="color:var(--up)">■ recovering</span></p>
  ${c.slug?`<a class="readfile" href="#/file/${c.slug}">Read the file →</a>`:`<a class="readfile" href="#/day/${c.low[0]}">Open the bottom’s day file →</a>`}</div>`}
function crashLab(){return `<section class="sec wrap" id="crash">${secHead('Crash Lab','Six great drawdowns on one chart: how far each fell, how fast, and how long the climb back took. Bubble size = time to recover.','<a href="#/timeline">Timeline</a>')}
  <div class="lab" data-holo><div class="lab-c">${labSVG()}<div class="lab-chips">${CRASHES.map(c=>`<button class="lab-chip" data-lab="${c.id}" aria-pressed="${c.id===LABSEL}" style="--lc:${c.col}">${c.id} · ${c.name}</button>`).join('')}</div></div><div id="lab-d">${labDetail()}</div></div>
  <p class="pv">Closing levels of the index named for each episode. Figures are in review until checked against the index providers’ historical data.</p></section>`}
function wireLab(){const root=$('#crash');if(!root)return;const sel=id=>{LABSEL=id;$('.lab-c svg',root).outerHTML=labSVG();$('#lab-d').innerHTML=labDetail();$$('.lab-chip',root).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lab===id)))};
  root.addEventListener('click',e=>{const t=e.target.closest('[data-lab]');if(t)sel(t.dataset.lab)});
  root.addEventListener('keydown',e=>{const t=e.target.closest('.lab-pt');if(t&&(e.key==='Enter'||e.key===' ')){e.preventDefault();sel(t.dataset.lab)}});
  root.addEventListener('pointerover',e=>{const t=e.target.closest('.lab-pt');if(t&&t.dataset.lab!==LABSEL&&matchMedia('(hover:hover)').matches)sel(t.dataset.lab)})}

/* ---------- desk market strips ---------- */
const DESK_INST={futures:['ES1','NQ1','ZN1','CL1','GC1','BTC1'],latest:['SPX','COMP','US10Y','XAU','EURUSD','BTC'],'wall-street':['SPX','COMP','INDU','RUT','VIX','US10Y'],'global-finance':['UKX','DAX','NKY','HSI','EURUSD','USDJPY'],bitcoin:['BTC','ETH','SOL','XAU'],blockchain:['ETH','SOL','LINK','ADA'],markets:[]};
function stripTiles(ids){return ids.length?`<div class="kts kts-${Math.min(ids.length,6)}">${qs(ids).map(q=>{const c=chg(q);return `<div class="kt" data-id="${q.id}" ${rowAttr(q)} data-holo><span class="kt-n">${esc(q.name)}${q.fut?' · futures':''}</span><span class="kt-v mono" data-f="v">${fmtV(q)}</span><span class="kt-c mono c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</span>${spark(q)}</div>`}).join('')}</div>`:''}

/* ---------- article extras ---------- */
function shareRow(a){const url=`${SITE_URL}/files/${a.slug}`,d=deskOf(a);const txt=`${a.head} — via @${d.handle}`;
  return `<div class="share"><a class="btn" href="https://x.com/intent/post?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Share on X ↗</a><a class="btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}" target="_blank" rel="noopener">LinkedIn ↗</a><button class="btn" data-copy="${url}">Copy link</button></div>`}
function wireArticle(){const bar=$('#rprog');if(bar){const f=()=>{const h=document.documentElement,max=h.scrollHeight-h.clientHeight;bar.style.transform=`scaleX(${max>0?Math.min(1,scrollY/max):0})`};addEventListener('scroll',f,{passive:true});cleanup.push(()=>removeEventListener('scroll',f));f()}
  $$('[data-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent='Link copied'}catch(e){b.textContent=b.dataset.copy}setTimeout(()=>b.textContent='Copy link',2500)})}

/* =========================================================================
   MARKET FILES LIBRARY — topic pages: live data, long-run milestones, archive, AI research
   ========================================================================= */
// Milestone levels are benchmark readings on the date shown ("≈" = approximate). All in review.
const LIB={
 gold:{title:'Gold',kind:'Precious metal',unit:'$ per troy ounce',live:['XAU','GC1'],log:true,since:1792,aka:['gold price','xau','bullion'],
  intro:'From the U.S. Mint’s first gold dollar valuation to a free-floating global market, gold has been money, reserve asset and crisis hedge.',
  pts:[['1792-04-02',19.39,'Coinage Act defines the dollar in gold and silver','≈'],['1834-06-28',20.67,'Coinage Act of 1834 revalues gold to $20.67'],['1900-03-14',20.67,'Gold Standard Act makes gold the sole standard'],['1933-04-05',20.67,'Executive Order 6102 orders gold turned in'],['1934-01-31',35,'Gold reset to $35 an ounce'],['1968-03-17',35,'Two-tier market: official price stays $35'],['1971-08-15',35,'Gold window closed; official convertibility ends'],['1980-01-21',850,'London fix peaks at $850'],['1999-07-20',252.8,'Two-decade low','≈'],['2011-09-05',1895,'Post-crisis record','≈'],['2020-08-06',2067,'Pandemic-era record','≈']]},
 dow:{title:'Dow Jones Industrial Average',kind:'U.S. stock index',unit:'index points',live:['INDU','YM1'],log:true,since:1896,aka:['dow','djia','dow jones'],
  intro:'Published since 1896, the Dow is the longest-running continuous record of American stock prices.',
  pts:[['1896-05-26',40.94,'First published'],['1929-09-03',381.17,'Peak before the Great Crash'],['1932-07-08',41.22,'Great Depression bottom'],['1954-11-23',382.74,'Finally regains its 1929 high'],['1972-11-14',1003.16,'First close above 1,000'],['1987-10-19',1738.74,'Black Monday close'],['1999-03-29',10006.78,'First close above 10,000'],['2007-10-09',14164.53,'Pre-crisis record'],['2009-03-09',6547.05,'Financial-crisis low'],['2020-03-23',18591.93,'Pandemic low'],['2024-05-17',40003.59,'First close above 40,000']]},
 bitcoin:{title:'Bitcoin',kind:'Digital asset',unit:'$ per bitcoin',live:['BTC','BTC1'],log:true,since:2009,aka:['btc','bitcoin price'],
  intro:'From a mailing-list white paper in 2008 to a regulated ETF asset, bitcoin’s price history is the fastest monetization of a new asset on record.',
  pts:[['2010-05-22',0.004,'Pizza purchase implies a fraction of a cent','≈'],['2011-02-09',1,'Parity with the U.S. dollar'],['2017-12-17',19700,'2017 peak near $20,000','≈'],['2018-12-15',3200,'Bear-market low','≈'],['2021-11-10',69000,'2021 peak near $69,000','≈'],['2022-11-21',15500,'Post-FTX low','≈'],['2024-12-05',100000,'First trade above $100,000 (UTC)']]},
 oil:{title:'Crude Oil (WTI)',kind:'Energy commodity',unit:'$ per barrel',live:['CL1','CL'],log:false,since:1983,aka:['oil','crude','wti','crude oil'],
  intro:'West Texas Intermediate futures have traded on NYMEX since 1983 and anchor global energy pricing alongside Brent.',
  pts:[['2008-07-03',145.29,'Record settlement'],['2020-04-20',-37.63,'May contract settles below zero'],['2022-03-08',123.7,'Price spike after Russia’s invasion of Ukraine','≈']]},
 treasuries:{title:'U.S. 10-Year Treasury Yield',kind:'Interest rate',unit:'% yield',live:['US10Y','ZN1'],log:false,since:1962,fred:'DGS10',aka:['10 year','treasury','yields','10-year','bond yields'],
  intro:'The benchmark for mortgages, corporate borrowing and equity valuations worldwide.',
  pts:[['1981-09-30',15.8,'Record high near 15.8%','≈'],['2012-07-25',1.43,'Post-crisis low','≈'],['2020-08-04',0.52,'Record low close','≈'],['2023-10-19',5.0,'Touches 5% for the first time since 2007','≈']]},
 fedfunds:{title:'Federal Funds Rate',kind:'Policy rate',unit:'%',live:[],log:false,since:1954,fred:'FEDFUNDS',aka:['fed funds','interest rates','fed rate','federal reserve rate'],
  intro:'The overnight rate the Federal Reserve targets to steer the U.S. economy.',
  pts:[['1981-01-15',19.1,'Volcker-era peak (monthly average)','≈'],['2008-12-16',0.125,'Cut to 0–0.25%'],['2015-12-16',0.375,'First hike since 2006'],['2020-03-15',0.125,'Cut back to near zero'],['2022-03-16',0.375,'Inflation-fighting hikes begin'],['2023-07-26',5.375,'Target reaches 5.25–5.50%']]},
 inflation:{title:'U.S. Inflation (CPI)',kind:'Economic indicator',unit:'% year over year',live:[],log:false,since:1947,fred:'CPIAUCSL',fredUnits:'pc1',aka:['cpi','inflation rate','consumer prices'],
  intro:'The Consumer Price Index measures what households pay; its annual change is the headline inflation rate.',
  pts:[['1980-03-15',14.8,'Great Inflation peak'],['2009-07-15',-2.1,'Deflation during the financial crisis','≈'],['2022-06-15',9.1,'Highest in four decades']]},
};
const LIB_MORE=['Silver','Copper','Natural gas','S&P 500','Nasdaq','Ethereum','U.S. dollar','Euro','Japanese yen','Chinese yuan','Stablecoins','Housing prices','Unemployment','GDP','The gold standard','Central banking','Derivatives','Sovereign debt','Hedge funds','Private equity'];
const libKey=q=>{q=q.trim().toLowerCase();return Object.keys(LIB).find(k=>k===q||LIB[k].title.toLowerCase()===q||LIB[k].aka.includes(q))||null};
const libSlug=t=>encodeURIComponent(t.toLowerCase());
function libChart(t,series,now){const pts=t.pts.map(([d,v,l,a])=>({x:+d.slice(0,4)+(+d.slice(5,7)-1)/12,v,l,d,a}));const all=[...pts.map(p=>p.v),...(series||[]).map(p=>p.v),...(now?[now.v]:[])];
  const x0=Math.min(t.since,...pts.map(p=>p.x),...(series||[]).map(p=>p.x)),x1=new Date().getFullYear()+1;
  const pos=all.filter(v=>v>0);const lg=t.log&&pos.length===all.length;const f=v=>lg?Math.log10(v):v;
  const lo=Math.min(...all.map(f)),hi=Math.max(...all.map(f)),pad=(hi-lo)*.08||1;const W=1000,H=320,L=56,B=28;
  const X=x=>L+(x-x0)/(x1-x0)*(W-L-12),Y=v=>12+(1-(f(v)-(lo-pad))/((hi+pad)-(lo-pad)))*(H-12-B);
  let g='';const ticks=lg?(()=>{const t=[];for(let e=Math.floor(lo);e<=Math.ceil(hi);e++)t.push(10**e);return t})():Array.from({length:5},(_,i)=>lo-pad+(i/4)*((hi+pad)-(lo-pad))).map(v=>+v.toFixed(2));
  ticks.forEach(v=>{const yy=Y(v);if(yy<8||yy>H-B)return;g+=`<line x1="${L}" x2="${W-12}" y1="${yy}" y2="${yy}" style="stroke:var(--line)"/><text x="${L-8}" y="${yy+4}" text-anchor="end" class="lab-ax">${v>=1000?(v/1000).toLocaleString('en-US')+'k':v}</text>`});
  const span=x1-x0,step=span>150?50:span>60?20:span>25?5:2;for(let yr=Math.ceil(x0/step)*step;yr<=x1;yr+=step)g+=`<text x="${X(yr)}" y="${H-8}" text-anchor="middle" class="lab-ax">${yr}</text>`;
  const line=series&&series.length>1?`<path d="${series.map((p,i)=>`${i?'L':'M'}${X(p.x).toFixed(1)},${Y(p.v).toFixed(1)}`).join('')}" fill="none" stroke="#4C8DFF" stroke-width="2"/>`:'';
  const dots=pts.map((p,i)=>`<g class="lib-pt" tabindex="0"><title>${p.d}: ${p.a||''}${p.v.toLocaleString('en-US')} — ${p.l}</title><circle cx="${X(p.x)}" cy="${Y(p.v)}" r="5.5" fill="#F5C96B" stroke="#FFE7AA" stroke-width="1.2" style="filter:drop-shadow(0 0 6px rgba(245,201,107,.7))"/></g>`).join('');
  const conn=`<path d="${pts.map((p,i)=>`${i?'L':'M'}${X(p.x).toFixed(1)},${Y(p.v).toFixed(1)}`).join('')}" fill="none" stroke="#F5C96B" stroke-opacity=".35" stroke-dasharray="3 5"/>`;
  const nowDot=now?`<g class="lib-pt" tabindex="0"><title>Latest on the board: ${fmtV(now.q)} (${Feed.name})</title><line x1="${X(pts[pts.length-1].x)}" y1="${Y(pts[pts.length-1].v)}" x2="${X(now.x)}" y2="${Y(now.v)}" stroke="#4CE0FF" stroke-opacity=".5" stroke-dasharray="3 5"/><circle cx="${X(now.x)}" cy="${Y(now.v)}" r="7" fill="none" stroke="#4CE0FF" stroke-width="2" style="filter:drop-shadow(0 0 8px rgba(76,224,255,.8))"/><text x="${X(now.x)-10}" y="${Y(now.v)-12}" text-anchor="end" class="lab-lb" style="fill:#4CE0FF">Now</text></g>`:'';
  return `<svg viewBox="0 0 ${W} ${H}" class="lib-svg" role="img" aria-label="${esc(t.title)} milestones since ${x0|0}">${g}${line}${conn}${dots}${nowDot}</svg><div class="ch-lg mono"><span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#F5C96B;margin-right:6px"></i>Benchmark milestones${lg?' · log scale':''}</span>${series?'<span><i class="lg-solid"></i> FRED data (annual)</span>':''}</div>`}
const libNow=t=>{const q=qs(t.live).find(x=>!x.na&&x.v>0||(!t.log&&!x.na));if(!q)return null;const d=new Date();return{x:d.getFullYear()+d.getMonth()/12,v:q.v,q}};
function pageLibraryIndex(){setMeta('The Market Files Library','Long-run histories of markets, assets and economic indicators.');
  return `<div class="wrap page-in" style="--dc:#F5C96B"><header class="ph serif"><p class="mono dim">MARKET FILES LIBRARY</p><h1 class="holo">The financial library</h1><p>Long-run histories of every major market — live data, benchmark levels going back centuries, every Market Files record, and Market Files AI research on any topic.</p></header>
  <div class="sbox se-box" style="max-width:760px;margin-bottom:28px"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--tx3)"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><label class="sr" for="lib-q">Open any topic</label><input id="lib-q" placeholder="Open any topic — gold, sovereign debt, the yen, options pricing…" autocomplete="off"></div>
  <div class="lib-g">${Object.entries(LIB).map(([k,t])=>`<a class="lib-c" href="#/library/${k}" data-holo><span class="mono dim">${t.kind.toUpperCase()} · SINCE ${t.since}</span><h3>${esc(t.title)}</h3><p>${esc(t.intro)}</p><span class="mono lib-n">${t.pts.length} milestones${t.fred?' · FRED data':''} →</span></a>`).join('')}</div>
  ${secHead('More topics','Every topic gets a library page with live data where available, the archive and Market Files AI research.','')}
  <div class="gp-picks">${LIB_MORE.map(t=>`<a class="tag" href="#/library/${libSlug(t)}">${esc(t)}</a>`).join('')}</div></div>`}
function pageLibrary(slug){const raw=decodeURIComponent(slug||'');const key=LIB[raw]?raw:libKey(raw);const t=key?LIB[key]:null;const title=t?t.title:raw.replace(/\b\w/g,c=>c.toUpperCase());
  setMeta(`${title} — Market Files Library`,t?t.intro:`The history of ${title} in markets and finance.`);
  const liveQ=t?qs(t.live):qs([findInst(raw)?.id].filter(Boolean));searchState.q=t?t.title.split(' (')[0]:raw;const hits=searchHits().slice(0,8);
  const prompts=t?[`The complete price history of ${t.title} as far back as records go`,`What drove the biggest moves in ${t.title}?`,`How is ${t.title} measured and traded today?`,`${t.title} during financial crises`]:[`The complete history of ${title} in financial markets`,`Explain ${title} from beginner to professional level`,`Key data, dates and turning points for ${title}`,`${title} today: what matters and why`];
  return `<div class="wrap page-in" style="--dc:#F5C96B"><header class="ph serif"><p class="mono dim"><a href="#/library">MARKET FILES LIBRARY</a> · ${t?esc(t.kind.toUpperCase()):'TOPIC'}</p><h1 class="holo">${esc(title)}</h1><p>${t?esc(t.intro):`Everything Market Files has on ${esc(title)}, plus Market Files AI research at any depth.`}</p></header>
  ${liveQ.length?stripTiles(liveQ.map(q=>q.id)):''}
  ${t?`<section class="pnl lib-ch" data-holo style="margin-top:24px"><div class="pnl-h"><h3>${esc(t.title)} since ${t.since}</h3><span class="sess mono">${esc(t.unit)}</span></div><div id="lib-chart">${libChart(t,null,libNow(t))}</div></section>
  <div class="split" style="margin-top:32px"><section>${secHead('Milestones','Benchmark levels on the dates they happened. ≈ marks approximate readings; all in review.','')}<div class="otd-res" style="border:1px solid var(--line)">${[...t.pts].reverse().map(([d,v,l,a])=>`<a class="ev" href="#/day/${d}"><span class="ev-y">${d.slice(0,4)}</span><div><h3>${esc(l)}</h3><div class="meta"><span class="mono">${a||''}${v.toLocaleString('en-US')} ${esc(t.unit.replace('$ per ','/ '))}</span><span>${fmtISO(d)}</span></div></div><span class="stamp review">In review</span></a>`).join('')}</div></section>`:'<div class="split" style="margin-top:32px">'}
  <section>${secHead('Research further','Any question, any depth.','')}<div class="deep" style="grid-template-columns:1fr">${prompts.map(q=>`<a href="${aiHref(q)}&depth=deep" data-holo><span class="n">✦ DEEP RESEARCH</span><h3>${esc(q)}</h3></a>`).join('')}</div></section></div>
  <section class="sec" style="padding-top:36px">${secHead('In the Market Files',hits.length?`${hits.length} records`:'No records yet','')}${hits.length?`<div class="otd-res" style="border:1px solid var(--line)">${hits.map(h=>h.kind==='file'?`<a class="ev" href="#/file/${h.a.slug}"><span class="ev-y">${h.a.y}</span><div><h3>${esc(h.a.head)}</h3><div class="meta"><span class="dk" style="--dc:${deskOf(h.a).hex}">${deskOf(h.a).name}</span></div></div>${stamp(h.a.status)}</a>`:`<a class="ev" href="#/day/${h.e.date}"><span class="ev-y">${h.e.y}</span><div><h3>${esc(h.e.head)}</h3><div class="meta"><span class="dk" style="--dc:${DESKS[h.e.desk].hex}">${DESKS[h.e.desk].name}</span></div></div>${stamp(h.e.status)}</a>`).join('')}</div>`:''}</section></div>`}
function afterLibrary(slug){const raw=decodeURIComponent(slug||'');const key=LIB[raw]?raw:libKey(raw);const t=key&&LIB[key];
  if(t&&t.fred&&window.MF_CONFIG&&MF_CONFIG.market==='live'){fetch(`/api/series?id=${t.fred}${t.fredUnits?'&units='+t.fredUnits:''}`).then(r=>r.ok?r.json():null).then(j=>{if(!j||!j.points||!$('#lib-chart'))return;$('#lib-chart').innerHTML=libChart(t,j.points.map(p=>({x:+p.d.slice(0,4)+.5,v:p.v})),libNow(t))}).catch(()=>{})}}
function wireLibIndex(){const i=$('#lib-q');if(!i)return;i.onkeydown=e=>{if(e.key==='Enter'&&i.value.trim()){const k=libKey(i.value);location.hash='#/library/'+(k||libSlug(i.value.trim()))}}}

/* =========================================================================
   BLOG — The Market Files Blog
   ========================================================================= */
let BLOG_DESK='';
function pageBlog(){setMeta('The Market Files Blog','Stories, explainers and history from every Market Files desk.');
  const posts=[...LIVE,...[...HIST].sort((a,b)=>(b.research-a.research)||b.date.localeCompare(a.date))];
  const list=posts.filter(a=>!BLOG_DESK||a.desk===BLOG_DESK);const lead=list[0];
  return `<div class="wrap page-in"><header class="ph serif"><p class="mono dim">THE MARKET FILES BLOG</p><h1 class="holo">From the desks</h1><p>Live market stories, explainers and financial history from every Market Files desk — the same reporting that runs across our six X accounts.</p></header>
  <div class="blog-f" role="tablist"><button class="tag${!BLOG_DESK?' on':''}" data-bdesk="">All desks</button>${Object.entries(DESKS).filter(([k])=>k!=='hub').map(([k,d])=>`<button class="tag${BLOG_DESK===k?' on':''}" data-bdesk="${k}" style="--dc:${d.hex}">${d.name}</button>`).join('')}</div>
  ${lead?`<div class="grid-top" style="margin-top:22px">${card(lead,'l')}${list.slice(1,5).map(a=>card(a,'s')).join('')}</div>`:'<div class="empty"><b>No posts yet for this desk.</b></div>'}
  ${list.length>5?`<div class="sec" style="padding-top:40px">${secHead('More posts','','')}<div class="g4">${list.slice(5).map(a=>card(a,'s')).join('')}</div></div>`:''}</div>`}
function wireBlog(){$$('[data-bdesk]').forEach(b=>b.onclick=()=>{BLOG_DESK=b.dataset.bdesk;$('#main').innerHTML=pageBlog();wireBlog();attachHolo()})}

/* =========================================================================
   X MENU — every Market Files account
   ========================================================================= */
const XLOGO='<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.4L6.3 22H3.2l7.3-8.3L1 2h6.3l4.4 5.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z"/></svg>';
function avatar(d,size=40){return `<span class="xav" style="--dc:${d.hex};width:${size}px;height:${size}px">${d.pfp?`<img src="${d.pfp}" alt="">`:`<img src="${LOGO72}" alt="">`}</span>`}
function xMenuHTML(){return `<div class="xm-h"><span class="mono dim">MARKET FILES ON X</span></div>${Object.entries(DESKS).map(([k,d])=>`<a class="xm-i" href="${xUrl(d.handle)}" target="_blank" rel="noopener" role="menuitem" style="--dc:${d.hex}">${avatar(d)}<span class="xm-t"><b>${k==='hub'?'Market Files':esc(d.name)}</b><span class="mono">@${d.handle}</span><small>${esc(d.blurb||'The main account — every desk in one feed.')}</small></span><span class="xm-f">Follow</span></a>`).join('')}`}
function wireXMenu(){const b=$('#x-b'),m=$('#x-m');if(!b||!m)return;m.innerHTML=xMenuHTML();
  const close=()=>{m.hidden=true;b.setAttribute('aria-expanded','false')};
  b.onclick=e=>{e.stopPropagation();const open=m.hidden;m.hidden=!open;b.setAttribute('aria-expanded',String(open));if(open)$('a',m).focus()};
  document.addEventListener('click',e=>{if(!m.hidden&&!m.contains(e.target))close()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!m.hidden){close();b.focus()}})}

/* ---------- home ---------- */
const PLATFORMS=[['Instagram','Photo files from the archive'],['YouTube','Documentary video files'],['TikTok','Short market-history reconstructions'],['LinkedIn','Company news and research']];
function wrapLine(){const g=id=>INSTR.find(q=>q.id===id),p=q=>(q.v-q.prev)/q.prev*100;
  const eq=['SPX','COMP','INDU'].map(id=>p(g(id)));const up=eq.filter(x=>x>0).length;
  let st=up===3?'Stocks are higher':up===0?'Stocks are lower':'Stocks are mixed';
  const es=g('ES1');if(es&&!es.na&&session('eq').c!=='open'){const e=p(es);st=`S&P 500 futures are ${Math.abs(e)<.05?'flat':`${e>0?'up':'down'} ${Math.abs(e).toFixed(2)}%`}, pointing to a ${Math.abs(e)<.05?'flat':e>0?'higher':'lower'} open`}
  const y=(g('US10Y').v-g('US10Y').prev)*100,dx=p(g('DXY')),oil=p(g('CL')),au=p(g('XAU')),bt=p(g('BTC'));
  const mv=(x,u,d)=>Math.abs(x)<.05?'flat':(x>0?u:d);
  return `${st}. The 10-year yield is ${Math.abs(y)<.5?'little changed':`${y>0?'up':'down'} ${Math.abs(y).toFixed(1)}bp`}, the dollar is ${mv(dx,'firmer','softer')}, oil is ${mv(oil,'up','down')} ${Math.abs(oil).toFixed(1)}%, gold is ${mv(au,'up','down')} ${Math.abs(au).toFixed(1)}% and bitcoin is ${mv(bt,'up','down')} ${Math.abs(bt).toFixed(1)}%.`}
const KT=['SPX','COMP','INDU','US10Y','XAU','CL','EURUSD','BTC'];
function keyTiles(){return `<div class="kts">${qs(KT).map(q=>{const c=chg(q);return `<div class="kt" data-id="${q.id}" ${rowAttr(q)} data-holo><span class="kt-n">${esc(q.name)}</span><span class="kt-v mono" data-f="v">${fmtV(q)}</span><span class="kt-c mono c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</span>${spark(q)}</div>`}).join('')}</div>`}
const JUMP=[['j-globe','Globe'],['j-mk','Markets'],['m-ws','Wall Street'],['m-gf','Global'],['m-fu','Futures'],['m-cr','Crypto'],['j-news','The Files'],['j-arch','Archive'],['crash','Crash Lab'],['j-lib','Library'],['j-otd','Time Machine'],['newsstand','Newsstand'],['pulse','Social']];
function pageHome(){
  const t=new Date(),tm=t.getMonth()+1,td=t.getDate();const nowNY=t.toLocaleString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const todays=HIST.filter(a=>a.m===tm&&a.d===td&&a.prec!=='y');const feat=todays[0]||BY['nyse-reopens-1873'];const fd=deskOf(feat);
  const top=['black-monday-1987','ireland-bank-guarantee-2008','spot-bitcoin-etfs-2024','whatever-it-takes-2012','the-merge-2022'].map(s=>BY[s]);
  const then=['buttonwood-agreement-1792','knickerbocker-run-1907','black-tuesday-1929','nasdaq-peak-2000','lehman-bankruptcy-2008','pandemic-crash-2020'].map(s=>BY[s]);
  const deep=['knickerbocker-run-1907','black-tuesday-1929','nixon-gold-window-1971','lehman-bankruptcy-2008'].map(s=>BY[s]);
  const NICHE={hub:['Every desk in one feed','Lead stories and the day’s file'],wallst:['U.S. equities, rates and earnings','The day’s Wall Street news'],then:['Crashes, panics and bank runs','Wall Street’s founding events'],global:['Central banks and currencies','Sovereign debt and global crises'],btc:['Bitcoin markets and ETFs','Bitcoin’s history, block by block'],chain:['Protocols and infrastructure','DeFi, security and upgrades']};
  return `
  <nav class="jump" id="jump" aria-label="On this page"><div class="wrap">${JUMP.map(([id,l])=>`<a href="#${id}" data-j="${id}">${l}</a>`).join('')}<i class="jump-ind" id="jump-ind"></i></div></nav>
  ${globeHero()}
  <section class="term-top" id="j-mk"><div class="wrap">
    <div class="cmd"><div><p class="cmd-d mono">${nowNY.toUpperCase()}</p><h1 class="cmd-h holo">Markets now</h1></div>${searchBar('hs')}</div>
    <div class="wrapbox" data-holo><span class="mono wb-l">MARKET WRAP</span><p id="wrapline">${wrapLine()}</p><span class="mono wb-r">Auto-generated from the board · ${Feed.live?'delayed market data':'simulated data'}</span></div>
    ${keyTiles()}
    <div class="sysl"><span class="mono" id="sys" aria-live="off"></span><span class="lt mono">LAST TICK <b id="lt">—</b></span></div>
    ${terminal()}
  </div></section>

  <div class="mf-div" id="j-news"><div class="wrap"><p class="mono">SCROLL FOR THE FILES</p><h2 class="holo">The Market Files</h2><p class="mf-sub">Reporting on today’s markets and the history behind them — six desks, one newsroom.</p></div></div>

  <section class="sec wrap" style="padding-top:36px">
    ${secHead('The Tape','The latest from every desk, newest first.','<a href="#/latest">All latest</a>')}
    <div class="tape">${LIVE.slice(0,6).map(a=>{const d=deskOf(a);const q=INSTR.find(x=>x.id===a.sym);const c=q?chg(q):null;return `<a class="tape-i" data-holo href="#/file/${a.slug}" style="--dc:${d.hex}"><div class="tape-t"><time datetime="${a.when.toISOString()}">${fmtTime(a.when)}</time><span class="flag ${a.flag==='LIVE'?'live':''}">${a.flag}</span></div><div class="meta"><span class="dk">${d.name}</span><span>${esc(a.cat)}</span></div><h3>${esc(a.head)}</h3><div class="tape-b">${q?`<span data-id="${q.id}">${q.id} <span data-f="c" class="c ${c.cls}">${c.arrow} ${c.txt}</span></span>`:'<span></span>'}<span class="flag sample">SAMPLE</span></div></a>`}).join('')}</div>
  </section>

  <section class="sec wrap">${secHead('Top stories','','<a href="#/latest">More stories</a>')}<div class="grid-top">${card(top[0],'l')}${top.slice(1).map(a=>card(a,'s')).join('')}</div></section>

  <section class="sec wrap" style="--dc:${fd.hex}">
    ${secHead(todays.length?'Today in the archive':'From the archive',`${MONTHS[feat.m-1]} ${feat.d} in market history.`,`<a href="#/on-this-date">Every event on this date</a>`,fd.hex)}
    <a class="feat" data-holo href="#/file/${feat.slug}"><div class="fig">${P(feat,{big:true})}</div><div class="feat-t"><div class="hero-k"><span class="chip solid">${esc(feat.cat)}</span><span class="chip">FILE ${feat.file}</span></div><p class="dateline">${dateline(feat)}</p><h3>${esc(feat.head)}</h3><p>${esc(feat.deck)}</p><span class="readfile" style="align-self:flex-start">Read file <span aria-hidden="true">→</span></span></div></a>
  </section>

  <section class="sec wrap">
    ${secHead('Our desks','Six desks, one newsroom. Read a desk here or follow it on X.','')}
    <div class="dgrid">${Object.entries(DESKS).map(([k,d])=>`<article class="dcard" data-holo="tilt" style="--dc:${d.hex}"><div class="dcard-t"><h3>${k==='hub'?'Market Files':d.name}</h3>${handleLink(d)}</div><p>${esc(d.blurb||'The main account: lead stories from every desk and the day’s file.')}</p><ul>${NICHE[k].map(n=>`<li>${n}</li>`).join('')}</ul><div class="dcard-a"><a class="btn" href="#/${k==='hub'?'latest':d.route}">Read the desk</a><a class="btn" href="${xUrl(d.handle)}" target="_blank" rel="noopener">Follow on X ↗</a></div></article>`).join('')}</div>
  </section>

  <section class="then" style="--dc:${DESKS.then.hex}"><div class="wrap sec" style="padding-top:44px">
    ${secHead('Then on Wall Street','Wall Street and American financial history, told as it happened.',`${handleLink(DESKS.then)}<a href="#/history">All history</a>`,DESKS.then.hex)}
    <div class="then-list">${then.map(a=>`<article class="then-i" data-holo><a href="#/file/${a.slug}"><div class="fig">${P(a)}</div><div class="then-t"><span class="then-d">${fmtD(a).toUpperCase()}</span><span class="then-y">${a.y}</span><h3>${esc(a.head)}</h3><p>${esc(a.deck)}</p></div></a></article>`).join('')}</div>
  </div></section>

  <section class="sec wrap" id="j-arch" style="--dc:var(--gold)">
    ${secHead('The Archive','Every event filed by date, era, institution and market — with its sources on record.','<a href="#/timeline">Timeline</a><a href="#/archive">Open the archive</a>','#C9A55C')}
    ${eraRail(null,true)}
    <div class="files">${['voc-charter-1602','nixon-gold-window-1971','bitcoin-genesis-block-2009','the-dao-exploit-2016'].map(s=>fileCard(BY[s])).join('')}</div>
  </section>

  ${crashLab()}
  <section class="sec wrap" id="j-lib">${secHead('The Market Files Library','Long-run histories of every major market — search any topic and go as deep as you want.','<a href="#/library">Open the Library</a>','#F5C96B')}<div class="lib-g">${Object.entries(LIB).slice(0,4).map(([k,t])=>`<a class="lib-c" href="#/library/${k}" data-holo><span class="mono dim">${t.kind.toUpperCase()} · SINCE ${t.since}</span><h3>${esc(t.title)}</h3><p>${esc(t.intro)}</p><span class="mono lib-n">Open →</span></a>`).join('')}</div></section>

  <section class="sec wrap" id="j-otd">${secHead('The Market Time Machine',`Any date, any day, any year. ${COVERED} of 366 dates on file so far.`,'<a href="#/on-this-date">Open the calendar</a>')}${otdWidget({mode:'date',m:tm,d:td,y:1929,xy:t.getFullYear()},false)}</section>

  <section class="sec wrap">${secHead('Research','Long-form files on the mechanisms behind the biggest events.','<a href="#/research">All research</a>')}
    <div class="deep">${deep.map(a=>`<a href="#/file/${a.slug}" data-holo style="--dc:${deskOf(a).hex}"><span class="n">${a.file} · ${a.y}</span><h3>${esc(a.head)}</h3><p>${esc(a.deck)}</p><span class="meta"><span class="dk">${deskOf(a).name}</span></span></a>`).join('')}</div></section>

  ${newsstand()}
  <section class="sec wrap" id="follow">${secHead('Follow Market Files','Every desk posts on X. More platforms are on the way.','')}
    <div class="soc"><div class="soc-x"><h3>X</h3><div class="soc-list">${Object.values(DESKS).map(d=>`<a href="${xUrl(d.handle)}" target="_blank" rel="noopener" style="--dc:${d.hex}"><b>@${d.handle}</b><span>${k2name(d)}</span><span aria-hidden="true">↗</span></a>`).join('')}</div></div>
    <div class="soc-o">${PLATFORMS.map(([n,t])=>`<div class="soc-p"><h3>${n}</h3><p>${t}</p><span class="stamp sample">Link to be added</span></div>`).join('')}</div></div></section>
  ${newsletter()}`;
}
function wireJump(){const bar=$('#jump');if(!bar)return;const links=$$('[data-j]',bar),ind=$('#jump-ind');
  const setA=id=>{links.forEach(a=>{const on=a.dataset.j===id;a.classList.toggle('on',on);if(on){ind.style.transform=`translateX(${a.offsetLeft}px)`;ind.style.width=a.offsetWidth+'px';if(bar.scrollWidth>bar.clientWidth)a.scrollIntoView({block:'nearest',inline:'center'})}})};
  const secs=JUMP.map(([id])=>document.getElementById(id)).filter(Boolean);let cur='';
  const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting&&e.target.id!==cur){cur=e.target.id;setA(cur)}})},{rootMargin:'-140px 0px -65% 0px'});
  secs.forEach(s=>io.observe(s));cleanup.push(()=>io.disconnect());setA('j-globe');
  links.forEach(a=>a.onclick=e=>{e.preventDefault();const el=document.getElementById(a.dataset.j);if(el){el.scrollIntoView({behavior:RM?'auto':'smooth',block:'start'})}})}
let WRAPT=0;function wrapTick(){const w=$('#wrapline');if(!w)return;const n=Date.now();if(n-WRAPT<6000)return;WRAPT=n;w.textContent=wrapLine()}

const k2name=d=>d.handle==='TheMarketFiles'?'Main account':d.name;
function afterHome(){const t=new Date();wireSearchBar('hs');wireTerminal();refreshClocks();wireGP();mountGlobe();$$('[data-jumpto]').forEach(a=>a.onclick=e=>{e.preventDefault();document.getElementById(a.dataset.jumpto).scrollIntoView({behavior:RM?'auto':'smooth'})});bootLine();wireOTD({mode:'date',m:t.getMonth()+1,d:t.getDate(),y:1929,xy:t.getFullYear()},false);wireEras(true);wireNL();wireNewsstand();wireLab();wireJump();$$('.term-top .pnl,.term-top .kt').forEach((el,i)=>el.style.setProperty('--i',Math.min(i,24)));
  const tt=$('.term-top');if(tt)tt.onpointermove=e=>{const r=tt.getBoundingClientRect();tt.style.setProperty('--sx',e.clientX-r.left+'px');tt.style.setProperty('--sy',e.clientY-r.top+'px')}}

function newsletter(){return `<section class="nl" id="newsletter" aria-labelledby="nl-h"><div class="wrap nl-in"><div><h2 id="nl-h">The Daily File</h2><p>The most important stories in markets, money and financial history — delivered directly to your inbox.</p></div><div><form id="nl-f" novalidate><label class="sr" for="nl-e">Email address</label><input id="nl-e" type="email" placeholder="Email address" autocomplete="email" required><button>SUBSCRIBE</button></form><p class="msg" id="nl-m" role="status"></p></div></div></section>`}
function wireNL(){const f=$('#nl-f');if(!f)return;f.onsubmit=e=>{e.preventDefault();const v=$('#nl-e').value.trim();const m=$('#nl-m');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)){m.textContent='Enter a valid email address, like name@firm.com.';m.style.color='var(--dn)';return}
  m.style.color='var(--tx3)';m.textContent='Subscribing…';fetch('/api/newsletter',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:v})}).then(async r=>{const j=await r.json().catch(()=>({}));if(r.ok){m.style.color='var(--up)';m.textContent=j.message||'You’re subscribed. Check your inbox to confirm.';f.reset()}else{m.style.color='var(--dn)';m.textContent=j.error||'Couldn’t subscribe right now. Please try again.'}}).catch(()=>{m.style.color='var(--dn)';m.textContent='Couldn’t subscribe right now. Please try again.'})}}

function eraRail(active,home){const counts=Object.fromEntries(ERAS.map(e=>[e.id,HIST.filter(a=>a.era===e.id).length]));const mx=Math.max(...Object.values(counts),1);
  return `<div class="eras" role="group" aria-label="Browse by era">${ERAS.map(e=>`<button class="era" data-era="${e.id}" aria-pressed="${active===e.id}"><b>${e.label}</b><span>${counts[e.id]} file${counts[e.id]===1?'':'s'}</span><span class="bar"><i style="width:${counts[e.id]/mx*100}%"></i></span></button>`).join('')}</div>`}
function wireEras(home){$$('.era').forEach(b=>b.onclick=()=>{if(home){location.hash=`#/archive?era=${b.dataset.era}`;return}archiveState.era=archiveState.era===b.dataset.era?'':b.dataset.era;renderArchiveResults()})}

/* archive */
const archiveState={era:'',desk:'',asset:'',country:'',inst:'',crisis:'',person:'',q:'',sort:'old'};
const uniq=f=>[...new Set(HIST.flatMap(f))].filter(Boolean).sort();
function selectF(id,label,opts,val){return `<label class="sr" for="${id}">${label}</label><select class="sel" id="${id}"><option value="">${label}: all</option>${opts.map(o=>`<option value="${esc(o[0]??o)}" ${String(o[0]??o)===val?'selected':''}>${esc(o[1]??o)}</option>`).join('')}</select>`}
function pageArchive(params){Object.assign(archiveState,{era:params.get('era')||'',desk:'',asset:'',country:'',inst:'',crisis:'',person:'',q:''});
  return `<div class="wrap"><header class="ph" style="--dc:var(--gold)"><h1>The Archive</h1><p>Every Market Files event, filed like a record: file number, date, location, category and status. Browse by era, or narrow by desk, asset, country, institution, crisis and person.</p><a class="pv" href="#/timeline">Prefer a visual route? Open the timeline →</a></header>
  ${eraRail(archiveState.era)}
  <div class="filters"><label class="sr" for="af-q">Search the archive</label><input class="inp" id="af-q" placeholder="Filter by keyword or year" style="width:220px">
  ${selectF('af-desk','Desk',Object.entries(DESKS).filter(([k])=>k!=='hub'&&k!=='wallst').map(([k,d])=>[k,d.name]),'')}
  ${selectF('af-asset','Asset',uniq(a=>a.assets),'')}${selectF('af-country','Country',uniq(a=>a.countries),'')}${selectF('af-inst','Institution',uniq(a=>a.inst),'')}${selectF('af-crisis','Crisis',uniq(a=>[a.crisis]),'')}${selectF('af-person','Person',uniq(a=>a.people),'')}
  ${selectF('af-sort','Sort',[['old','Oldest first'],['new','Newest first']],'old')}
  <span class="count" id="af-count"></span></div>
  <div id="af-res"></div></div>`}
function renderArchiveResults(){const s=archiveState;const q=s.q.toLowerCase();
  let r=HIST.filter(a=>(!s.era||a.era===s.era)&&(!s.desk||a.desk===s.desk)&&(!s.asset||a.assets.includes(s.asset))&&(!s.country||a.countries.includes(s.country))&&(!s.inst||a.inst.includes(s.inst))&&(!s.crisis||a.crisis===s.crisis)&&(!s.person||a.people.includes(s.person))&&(!q||(a.head+a.deck+a.y+a.loc+a.cat).toLowerCase().includes(q)));
  r.sort((a,b)=>s.sort==='new'?b.date.localeCompare(a.date):a.date.localeCompare(b.date));
  $$('.era').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.era===s.era)));
  $('#af-count').textContent=`${r.length} of ${HIST.length} files`;
  $('#af-res').innerHTML=r.length?`<div class="files">${r.map(fileCard).join('')}</div>`:`<div class="empty"><b>No files match these filters.</b>Clear a filter or pick another era to widen the search.</div>`}
function afterArchive(){['desk','asset','country','inst','crisis','person','sort'].forEach(k=>$('#af-'+k).onchange=e=>{archiveState[k]=e.target.value;renderArchiveResults()});$('#af-q').oninput=e=>{archiveState.q=e.target.value;renderArchiveResults()};wireEras(false);renderArchiveResults()}

/* article */
function pageFile(slug){const a=BY[slug];if(!a)return notFound();const d=deskOf(a);
  const rel=A.filter(x=>x!==a&&x.type==='hist'&&(x.desk===a.desk||x.crisis&&x.crisis===a.crisis||x.inst.some(i=>a.inst.includes(i)))).slice(0,3);
  const q=a.sym&&INSTR.find(x=>x.id===a.sym);
  setMeta(`${a.head} — Market Files`,a.deck,{"@context":"https://schema.org","@type":a.type==='live'?'NewsArticle':'Article',"headline":a.head,"description":a.deck,"datePublished":(a.when||new Date(NOW)).toISOString(),"dateModified":(a.when||new Date(NOW)).toISOString(),"author":{"@type":"Organization","name":"Market Files"},"publisher":{"@id":`${SITE_URL}/#org`},"mainEntityOfPage":`${SITE_URL}/files/${a.slug}`,...(a.type==='hist'?{"about":{"@type":"Event","name":a.head,"startDate":a.prec==='y'?String(a.y):a.date,"location":{"@type":"Place","name":a.loc}}}:{}),"articleSection":d.name});
  return `<div class="rprog" id="rprog" aria-hidden="true"></div><article class="wrap page-in" style="--dc:${d.hex}">
  <header class="art-h t-${a.type}">
    <div class="hero-k"><a class="chip solid" href="#/${d.route}">${esc(a.cat)}</a><span class="chip">FILE ${a.file}</span>${stamp(a.status)}${a.type==='live'?`<span class="flag ${a.flag==='LIVE'?'live':''}">${a.flag}</span>`:''}</div>
    <p class="dateline">${dateline(a)}</p>
    <h1>${esc(a.head)}</h1><p class="deck">${esc(a.deck)}</p>
    <div class="byline"><span>By <b>Market Files</b></span><span>Desk <a class="handle" href="${xUrl(d.handle)}" target="_blank" rel="noopener">@${d.handle}</a></span><span>Published <b>${a.when?fmtTime(a.when):'Sep 30, 2026'}</b></span><span>Updated <b>${a.when?fmtTime(a.when):'Sep 30, 2026'}</b></span>${q?`<span data-id="${q.id}">${q.id} <b data-f="v">${fmtV(q)}</b> <span data-f="c" class="c ${chg(q).cls}">${chg(q).arrow} ${chg(q).txt}</span></span>`:''}</div>
  ${shareRow(a)}</header>
  <figure class="art-fig"><div class="box">${P(a,{big:true})}</div><figcaption><span>${esc(a.alt)}</span><span class="mono">IMAGE STATUS · ${esc(a.img.status).toUpperCase()}</span></figcaption></figure>
  <div class="art-grid">
    <div>
      <div class="body">${a.body.map(([h,p])=>`<h2>${esc(h)}</h2><p>${esc(p)}</p>`).join('')}</div>
      ${a.type==='hist'?`<section class="srcfile"><div class="body"><h2>Source File</h2></div><ol>${a.sources.map(s=>`<li><b>${esc(s.source)}</b> — ${esc(s.doc)}${s.date&&s.date!=='—'?`, ${esc(s.date)}`:''}</li>`).join('')}</ol></section>`:''}
      ${a.sources.length?`<section class="srec" aria-labelledby="sr-h"><div class="srec-h"><h2 id="sr-h">SOURCE RECORD</h2><span>${a.sources.length} claim${a.sources.length>1?'s':''} · file ${stamp(a.status)}</span></div><div class="tscroll"><table><thead><tr><th>Claim</th><th>Source</th><th>Publication / document</th><th>Date</th><th>Evidence</th><th>Confidence</th><th>Asset rights</th></tr></thead><tbody>${a.sources.map(s=>`<tr><td>${esc(s.claim)}</td><td data-l="Source">${esc(s.source)}</td><td data-l="Document">${esc(s.doc)}</td><td data-l="Date" class="mono">${esc(s.date)}</td><td data-l="Evidence">${esc(s.evidence)}</td><td data-l="Confidence"><span class="conf ${esc(s.conf)}">${esc(s.conf)}</span></td><td data-l="Rights">${esc(s.rights)}</td></tr>`).join('')}</tbody></table></div></section>`:''}
      <p class="pv">Editorial note: facts marked In review are drafted and must be confirmed against the listed sources before publication.</p>
    </div>
    <aside class="rail" aria-label="File details">
      ${a.keyDates.length?`<div class="rbox"><h3>Key dates</h3><ul>${a.keyDates.map(([dt,t])=>`<li><span class="d">${fmtISO(dt)}</span><span>${esc(t)}</span></li>`).join('')}</ul></div>`:''}
      ${[['Institutions',a.inst,'inst'],['People',a.people,'person'],['Markets',a.assets,'asset']].filter(x=>x[1].length).map(([t,l,k])=>`<div class="rbox"><h3>${t}</h3><div class="tags">${l.map(v=>`<a class="tag" href="#/search?${k}=${encodeURIComponent(v)}">${esc(v)}</a>`).join('')}</div></div>`).join('')}
      <div class="rbox"><h3>Image status</h3><div class="imgstat"><b>${esc(a.img.status)}</b>${esc(a.img.note)}</div></div>
      ${rel.length?`<div class="rbox"><h3>Related files</h3><ul>${rel.map(r=>`<li><span class="d">${r.y}</span><a href="#/file/${r.slug}">${esc(r.head)}</a></li>`).join('')}</ul></div>`:''}
      <div class="rbox"><h3>Filed by</h3><div class="imgstat">${d.name} desk · ${handleLink(d)}</div></div>
    </aside>
  </div></article>`}

/* section pages */
const SECTIONS={
 latest:{title:'Latest',desc:'Everything filed across the Market Files desks.',filter:()=>[...LIVE,...[...HIST].sort((a,b)=>b.date.localeCompare(a.date))]},
 'wall-street':{title:'Wall Street',desk:'wallst',filter:()=>[...LIVE.filter(a=>a.desk==='wallst'),...HIST.filter(a=>a.desk==='then').sort((a,b)=>b.date.localeCompare(a.date))]},
 'global-finance':{title:'Global Finance',desk:'global',filter:()=>A.filter(a=>a.desk==='global').sort((a,b)=>(b.type==='live')-(a.type==='live')||b.date.localeCompare(a.date))},
 history:{title:'History',desk:'then',serif:true,desc:'Financial history from every desk, from the Dutch East India Company to spot bitcoin ETFs.',filter:()=>[...HIST].sort((a,b)=>b.date.localeCompare(a.date))},
 bitcoin:{title:'Bitcoin',desk:'btc',filter:()=>A.filter(a=>a.desk==='btc').sort((a,b)=>(b.type==='live')-(a.type==='live')||b.date.localeCompare(a.date))},
 blockchain:{title:'Blockchain',desk:'chain',filter:()=>A.filter(a=>a.desk==='chain').sort((a,b)=>(b.type==='live')-(a.type==='live')||b.date.localeCompare(a.date))},
 research:{title:'Research',serif:true,desc:'Deep reads on the mechanisms behind the events that changed markets.',filter:()=>HIST.filter(a=>a.research)}
};
function pageSection(key){const s=SECTIONS[key];const d=s.desk?DESKS[s.desk]:null;const list=s.filter();const dc=d?d.hex:'#E9EDF2';
  setMeta(`${s.title} — Market Files`,s.desc||d?.blurb||'');
  const extra=key==='wall-street'?`<p class="pv" style="margin-top:14px">History from this beat is filed by ${handleLink(DESKS.then)}.</p>`:'';
  return `<div class="wrap page-in" style="--dc:${dc}"><header class="ph ${s.serif?'serif':''}"><h1>${s.title}</h1><p>${esc(s.desc||d.blurb)}</p>${d?`<div class="sec-a">${handleLink(d)}</div>`:''}${extra}</header>
  ${stripTiles(DESK_INST[key]||[])}<div style="height:28px"></div>${list.length?`<div class="grid-top">${list.slice(0,5).map((a,i)=>card(a,i?'s':'l')).join('')}</div>${list.length>5?`<div class="sec" style="padding-top:40px">${secHead('More','','')}<div class="g4">${list.slice(5).map(a=>card(a,'s')).join('')}</div></div>`:''}`:'<div class="empty"><b>Nothing filed here yet.</b>Check the archive for related files.</div>'}</div>`}
function pageMarkets(){setMeta('Markets — Market Files','Market board: equities, rates, commodities, FX and crypto.');return `<div class="wrap page-in" style="--dc:var(--up)"><header class="ph"><h1>Markets</h1><p>Wall Street and global markets in one view: indices, sectors, Treasuries, world exchanges, currencies and yields.</p></header>${terminal()}<div class="sec">${secHead('Full board','','')}${board(true)}</div><div class="sec">${secHead('Market reporting','','<a href="#/latest">All latest</a>')}<div class="g3">${LIVE.slice(0,6).map(a=>card(a,'s')).join('')}</div></div></div>`}

function fuSig(){const g=id=>INSTR.find(q=>q.id===id);const p=q=>q.na?null:(q.v-q.prev)/q.prev*100;const es=g('ES1'),v=p(es);const s=session('fu');
  const row=id=>{const q=g(id),x=p(q);return `<div class="fs-r"><span>${esc(q.name.replace('E-mini ',''))}</span><b class="mono ${x==null?'flat':x>=0?'up':'dn'}">${x==null?'—':(x>=0?'+':'')+x.toFixed(2)+'%'}</b></div>`};
  return `<div class="fs"><p class="mono dim">S&amp;P 500 FUTURES VS. PRIOR SETTLE</p><p class="fs-big mono ${v==null?'flat':v>=0?'up':'dn'}">${v==null?'—':(v>=0?'+':'')+v.toFixed(2)+'%'}</p><p class="fs-t">${v==null?'Waiting for futures data.':`Futures point to a ${Math.abs(v)<.05?'flat':v>0?'higher':'lower'} open for U.S. stocks.`}</p>${['NQ1','YM1','RTY1','ZN1'].map(row).join('')}<p class="mono dim fs-s">${s.t}</p></div>`}
/* futures page */
const FUT_HISTORY=[['1848-04-03','The Chicago Board of Trade is founded'],['1972-05-16','CME opens the International Monetary Market for currency futures'],['1977-08-22','CBOT launches U.S. Treasury bond futures'],['1982-04-21','S&P 500 futures begin trading at CME'],['1983-03-30','NYMEX launches crude oil futures'],['1992-06-25','CME Globex electronic trading goes live'],['1997-09-09','The E-mini S&P 500 launches'],['2007-07-12','CME and CBOT complete their merger'],['2017-12-17','CME launches bitcoin futures']];
function pageFutures(){setMeta('Futures — Market Files','Equity index, rates, energy, metals, agriculture, currency, crypto and volatility futures with contract specs.');
  const t=`<table class="crt fut-t${window.MF_TV?' tv':''}"><thead><tr><th>Contract</th><th>Exchange</th><th>Contract size</th><th>Last</th><th>Change</th><th>Trend</th><th><span class="sr">Links</span></th></tr></thead><tbody>${FUGROUPS.map(g=>{const rows=INSTR.filter(q=>q.fut&&q.fg===g.id);return `<tr class="fut-g"><td colspan="7">${g.name}</td></tr>`+rows.map(q=>{const c=chg(q);return `<tr class="cr-row" data-id="${q.id}" ${rowAttr(q)}><td><b>${esc(q.name)}</b> <span class="mono dim">${q.id.replace(/1$/,'')}</span></td><td class="mono">${q.fx}</td><td class="mono dim">${q.size}</td><td class="mono" data-f="v">${fmtV(q)}</td><td class="mono c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</td><td>${spark(q)}</td><td class="lks"><a href="${tvUrl(q.id)}" target="_blank" rel="noopener">TV ↗</a></td></tr>`}).join('')}).join('')}</tbody></table>`;
  return `<div class="wrap page-in" style="--dc:#C9A55C"><header class="ph"><h1>Futures</h1><p>Front-month futures across equity indexes, Treasuries, energy, metals, agriculture, currencies, crypto and volatility — the market that trades nearly around the clock.</p><div class="sec-a">${sessHTML('fu')}<span class="mono dim">CME Globex: Sunday–Friday, 6:00 p.m.–5:00 p.m. ET with a daily one-hour break</span></div></header>
  ${window.MF_TV?tvFuturesBlock(true):stripTiles(DESK_INST.futures)}<div style="height:28px"></div>
  <section class="pnl" data-holo><div class="pnl-h"><h3>All contracts · front month</h3><span class="sess">Data: ${Feed.name}</span></div><div class="tscroll">${t}</div></section>
  <p class="pv">Contract sizes are standard exchange specifications; confirm details on the exchange’s contract page before trading. Market Files is educational only.</p>
  <div class="split" style="margin-top:40px"><section>${secHead('Futures in history','Dates that built the modern futures market.','')}<div class="otd-res" style="border:1px solid var(--line)">${FUT_HISTORY.map(([d,h])=>`<a class="ev" href="#/day/${d}"><span class="ev-y">${d.slice(0,4)}</span><div><h3>${esc(h)}</h3><div class="meta"><span>${fmtISO(d)}</span></div></div><span class="stamp review">In review</span></a>`).join('')}</div></section>
  <section>${secHead('Ask Market Files AI','How futures work, explained.','')}<div class="deep" style="grid-template-columns:1fr">${['How do futures contracts work?','What are contango and backwardation?','Why do S&P 500 futures trade overnight?','How did the 1982 launch of S&P 500 futures change markets?'].map(q=>`<a href="${aiHref(q)}" data-holo><span class="n">✦ MARKET FILES AI</span><h3>${esc(q)}</h3></a>`).join('')}</div></section></div></div>`}

/* timeline */
function pageTimeline(sel){const items=TIMELINE.map(s=>BY[s]);const cur=items.find(a=>a.slug===sel)||items[3];
  setMeta('Timeline of financial history — Market Files','Four centuries of market history, from 1602 to today.');
  return `<div class="wrap page-in" style="--dc:var(--gold)"><header class="ph serif"><h1>Four centuries of markets</h1><p>Step through the events that shaped modern finance. Each point opens its full file.</p></header>
  <div class="tl"><div class="tl-bands">${ERAS.map(e=>`<span>${e.label}</span>`).join('')}</div><div class="tl-track" id="tl-track"><div class="tl-rail" role="tablist" aria-label="Events">${items.map(a=>`<button class="tl-n" role="tab" data-s="${a.slug}" aria-selected="${a===cur}"><span class="y">${a.y}</span><span class="dot"></span><span class="l">${TL_LABEL[a.slug]}</span></button>`).join('')}</div></div>
  <div class="tl-ctl"><button class="btn" data-tl="-1">← Earlier</button><span id="tl-pos"></span><button class="btn" data-tl="1">Later →</button></div></div>
  <div class="tl-d" id="tl-d"></div></div>${crashLab()}`}
function afterTimeline(sel){const items=TIMELINE.map(s=>BY[s]);let i=Math.max(0,items.findIndex(a=>a.slug===sel));if(i<0||!sel)i=3;
  const show=(k,focus)=>{i=Math.max(0,Math.min(items.length-1,k));const a=items[i];$$('.tl-n').forEach((b,j)=>{b.setAttribute('aria-selected',String(j===i));b.tabIndex=j===i?0:-1});
    const n=$$('.tl-n')[i];const tr=$('#tl-track');tr.scrollLeft=n.offsetLeft-tr.clientWidth/2+75;if(focus)n.focus();
    $('#tl-pos').textContent=`${i+1} / ${items.length}`;const d=deskOf(a);
    $('#tl-d').innerHTML=`<div class="fig">${P(a)}</div><div class="t" style="--dc:${d.hex}"><p class="dateline">${dateline(a)}</p><h2>${esc(a.head)}</h2><p>${esc(a.deck)}</p><div class="meta"><span class="dk">${d.name}</span><span>FILE ${a.file}</span></div><a class="readfile" href="#/file/${a.slug}" style="align-self:flex-start;margin-top:8px">Read file <span aria-hidden="true">→</span></a></div>`;
    history.replaceState(null,'',`#/timeline/${a.slug}`)};
  $$('.tl-n').forEach((b,j)=>{b.onclick=()=>show(j);b.onkeydown=e=>{if(e.key==='ArrowRight'){e.preventDefault();show(i+1,true)}if(e.key==='ArrowLeft'){e.preventDefault();show(i-1,true)}}});
  $$('[data-tl]').forEach(b=>b.onclick=()=>show(i+ +b.dataset.tl));show(i)}

/* on this date */
function pageOTD(seg){const t=new Date();let st={mode:'date',m:t.getMonth()+1,d:t.getDate(),y:1929,xy:t.getFullYear()};
  if(seg[1]==='year'){st.mode='year';st.y=+seg[2]||1929}else if(seg[1]==='day'){const [y,m,d]=(seg[2]||'').split('-').map(Number);if(validDay(y,m,d)){st={...st,mode:'day',xy:y,m,d}}}else if(seg[1]){const [m,d]=seg[1].split('-').map(Number);if(m&&d){st.m=m;st.d=d}}OTDST=st;
  setMeta('On this date in markets — Market Files','Explore any date, any day and any year in market history.');
  return `<div class="wrap page-in" style="--dc:var(--gold)"><header class="ph serif"><h1 class="holo">The Market Time Machine</h1><p>Pick a date on the calendar, dive into one exact day, or search any year. Every day gets a day file — what we’ve filed, the week around it, the same date in other years, AI research leads and direct links to primary sources.</p></header>
  <p class="dbstat mono" data-dbstat></p><section class="calw" data-holo>${calendar(st)}</section>${otdWidget(st,true)}<p class="pv">${EVENTS.length} dated events across ${COVERED} of 366 calendar dates in this preview, all marked in review until checked against primary sources. The Market Time Machine research cycles fill the rest.</p></div>`}

/* search */
/* =========================================================================
   MARKET FILES DATABASE — Market Time Machine inventory
   Store: collection "tm", one document per month ("m01".."m12"), body {events:[Event]}.
   Event {id,date,desk,head,status,summary?,source?,doc?,url?,link?,updatedAt}
   ========================================================================= */
let DB=null,USER=null,CAN_EDIT=false,EDITOR=false,TM_DOCS={};
const mKey=m=>'m'+pad(m);
function setDbStatus(){const t=TM_SOURCE==='database'?`Database connected · ${TM_LIST.length} inventory events`:TM_SOURCE==='empty'?'Database connected · empty (showing built-in copy)':'Built-in copy · database offline';
  $$('[data-dbstat]').forEach(el=>{el.textContent=t;el.className=`dbstat mono ${TM_SOURCE==='database'?'ok':''}`})}
function rerenderIfData(){const k=(location.hash.slice(1).split('?')[0].split('/').filter(Boolean)[0])||'';if(['on-this-date','day'].includes(k)){routeKeep=true;const y=scrollY;route();scrollTo(0,y)}else if(!k&&$('#otd-res')){const b=$('[data-om][aria-selected="true"]');if(b)b.click()}}
(async()=>{try{
  if(!window.claude||!window.claude.use)return;
  [DB,USER]=await Promise.all([window.claude.use('db'),window.claude.use('user')]);
  if(USER){try{CAN_EDIT=!!(USER.isOwner()||USER.canEdit())}catch(e){CAN_EDIT=false}}
  $('#editor-b').hidden=!CAN_EDIT||!DB;
  if(!DB){setDbStatus();return}
  DB.collection('tm').onSnapshot(snap=>{TM_DOCS={};snap.docs.forEach(d=>{TM_DOCS[d.id]=d.data()});
    const list=Object.values(TM_DOCS).flatMap(d=>Array.isArray(d&&d.events)?d.events:[]).filter(e=>e&&typeof e.date==='string'&&typeof e.head==='string'&&DESKS[e.desk]).map(e=>({id:String(e.id),date:e.date,desk:e.desk,head:String(e.head).slice(0,240),status:['verified','review','pending'].includes(e.status)?e.status:'review',summary:e.summary?String(e.summary).slice(0,2000):'',source:e.source?String(e.source):'',doc:e.doc?String(e.doc):'',url:/^https?:\/\//.test(e.url||'')?e.url:'',link:BY[e.link]?e.link:'',updatedAt:e.updatedAt||''}));
    if(snap.empty){TM_SOURCE='empty';rebuildEvents(EXTRA)}else{TM_SOURCE='database';rebuildEvents(list)}
    setDbStatus();if(!snap.metadata.fromCache)rerenderIfData();if($('#ed').open)renderEdList()},
   e=>{TM_SOURCE='built-in';setDbStatus()});
}catch(e){}})();

/* ---------- editor (owner and editors only) ---------- */
function edForm(ev){const e=ev||{id:'',date:new Date().toISOString().slice(0,10),desk:'then',head:'',status:'review',summary:'',source:'',doc:'',url:'',link:''};
  return `<form id="ed-f" class="ed-f" data-id="${esc(e.id)}" data-orig="${esc(e.date||'')}">
  <div class="ed-2"><label>Date<input class="inp mono" name="date" type="date" required value="${esc(e.date)}" min="0001-01-01" max="2100-12-31"></label>
  <label>Desk<select class="sel" name="desk">${Object.entries(DESKS).filter(([k])=>k!=='hub').map(([k,d])=>`<option value="${k}" ${k===e.desk?'selected':''}>${d.name} · @${d.handle}</option>`).join('')}</select></label></div>
  <label>Headline<input class="inp" name="head" required maxlength="240" value="${esc(e.head)}" placeholder="What happened, in one plain sentence"></label>
  <label>Summary<textarea class="inp" name="summary" rows="3" maxlength="2000" placeholder="What happened, why it mattered, the mechanism">${esc(e.summary||'')}</textarea></label>
  <div class="ed-2"><label>Source<input class="inp" name="source" value="${esc(e.source||'')}" placeholder="e.g. Federal Reserve History"></label><label>Document<input class="inp" name="doc" value="${esc(e.doc||'')}" placeholder="Title, date, page"></label></div>
  <div class="ed-2"><label>Source link<input class="inp" name="url" type="url" value="${esc(e.url||'')}" placeholder="https://"></label><label>Linked file<select class="sel" name="link"><option value="">None</option>${HIST.map(a=>`<option value="${a.slug}" ${a.slug===e.link?'selected':''}>${a.y} · ${esc(a.head.slice(0,50))}</option>`).join('')}</select></label></div>
  <fieldset class="ed-st"><legend>Status</legend>${[['review','In review'],['verified','Verified'],['pending','Pending']].map(([v,l])=>`<label><input type="radio" name="status" value="${v}" ${v===e.status?'checked':''}> ${l}</label>`).join('')}</fieldset>
  <p class="ed-msg mono" id="ed-msg" role="status"></p>
  <div class="ed-a"><button class="btn btn-p" type="submit">Save to database</button><button class="btn" type="button" data-edback>Back to list</button>${e.id?'<button class="btn ed-del" type="button" data-eddel>Delete</button>':''}</div></form>`}
let ED_Q='';
function renderEdList(){const b=$('#ed-b');if(!b||$('#ed-f'))return;const q=ED_Q.toLowerCase();
  const list=TM_LIST.filter(e=>!q||(e.date+' '+e.head+' '+DESKS[e.desk].name).toLowerCase().includes(q)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,200);
  b.innerHTML=`<div class="ed-top"><input class="inp" id="ed-q" placeholder="Filter by date, headline or desk" value="${esc(ED_Q)}"><button class="btn btn-p" data-ednew>＋ New event</button></div>
  <p class="mono dim ed-count"><span data-dbstat></span> · showing ${list.length}</p>
  <div class="ed-l">${list.map(e=>`<button class="ed-i" data-edit="${esc(e.id)}"><span class="mono">${e.date}</span><span>${esc(e.head)}</span>${stamp(e.status)}</button>`).join('')||'<p class="dim" style="padding:16px">No events match.</p>'}</div>`;
  setDbStatus();const qi=$('#ed-q');qi.oninput=()=>{ED_Q=qi.value;const pos=qi.selectionStart;renderEdList();const n=$('#ed-q');n.focus();n.setSelectionRange(pos,pos)}}
function openEditor(ev,prefillDate){const d=$('#ed');if(!d.open)d.showModal();if(ev||prefillDate){$('#ed-b').innerHTML=edForm(ev||{id:'',date:prefillDate,desk:'then',head:'',status:'review'});wireEdForm()}else{$('#ed-b').innerHTML='';renderEdList()}}
async function writeMonth(m,mutate){const ref=DB.collection('tm').doc(mKey(m));const snap=await ref.get();const cur=snap.exists&&Array.isArray(snap.data().events)?snap.data().events.map(x=>({...x})):[];const next=mutate(cur);await ref.set({month:m,events:next,updatedAt:new Date().toISOString()})}
function wireEdForm(){const f=$('#ed-f'),msg=$('#ed-msg');
  $('[data-edback]',f).onclick=()=>{$('#ed-b').innerHTML='';renderEdList()};
  const del=$('[data-eddel]',f);if(del)del.onclick=async()=>{if(!confirm('Delete this event from the database?'))return;const id=f.dataset.id,om=+f.dataset.orig.split('-')[1];msg.textContent='Deleting…';
    try{await writeMonth(om,list=>list.filter(x=>x.id!==id));$('#ed-b').innerHTML='';renderEdList()}catch(e){msg.textContent='Couldn’t delete: '+(e.message||e.code)}};
  f.onsubmit=async e=>{e.preventDefault();const fd=Object.fromEntries(new FormData(f));const [y,m,d]=String(fd.date).split('-').map(Number);
    if(!validDay(y,m,d)){msg.textContent='Enter a real date.';return}if(!String(fd.head).trim()){msg.textContent='Add a headline.';return}
    const id=f.dataset.id||`e${String(fd.date).replace(/-/g,'')}-${Date.now().toString(36)}`;
    const ev={id,date:isoOf(y,m,d),desk:fd.desk,head:String(fd.head).trim(),status:fd.status||'review',summary:String(fd.summary||'').trim(),source:String(fd.source||'').trim(),doc:String(fd.doc||'').trim(),url:String(fd.url||'').trim(),link:fd.link||'',updatedAt:new Date().toISOString()};
    const om=f.dataset.orig?+f.dataset.orig.split('-')[1]:0;msg.textContent='Saving…';
    try{if(TM_SOURCE!=='database'&&!Object.keys(TM_DOCS).length){msg.textContent='The database is empty. Ask Claude to load the inventory first, then add events.';return}
      if(om&&om!==m)await writeMonth(om,list=>list.filter(x=>x.id!==id));
      await writeMonth(m,list=>{const i=list.findIndex(x=>x.id===id);if(i>=0)list[i]=ev;else list.push(ev);return list.sort((a,b)=>a.date.localeCompare(b.date))});
      msg.textContent='Saved. Live for every signed-in reader.';f.dataset.id=id;f.dataset.orig=ev.date}
    catch(e){msg.textContent=e&&e.code==='invalid_argument'?'Your account can’t write to this database.':'Couldn’t save: '+(e.message||e.code)}}}
document.addEventListener('click',e=>{const t=e.target;
  if(t.closest('[data-ednew]')){$('#ed-b').innerHTML=edForm(null);wireEdForm()}
  const ed=t.closest('[data-edit]');if(ed){const ev=TM_LIST.find(x=>x.id===ed.dataset.edit);if(ev){$('#ed-b').innerHTML=edForm(ev);wireEdForm()}}
  const add=t.closest('[data-addday]');if(add){e.preventDefault();openEditor(null,add.dataset.addday)}});

/* =========================================================================
   MARKET FILES AI — research anything in financial markets with Claude
   (preview: runs on the reader's Claude account; production: server-side API)
   ========================================================================= */
const FILEMAP=Object.fromEntries(A.map(a=>[a.file,a]));
function md(t){const lines=esc(t).split('\n');let html='',inList=false;
  const inline=s=>s.replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\[(MF-[0-9X-]+(?:L\d+)?)\]/g,(m,id)=>{const a=FILEMAP[id];return a?`<a class="aio-c" href="#/file/${a.slug}" title="${esc(a.head)}">${id}</a>`:`<span class="aio-c">${id}</span>`}).replace(/\[day:(\d{4}-\d\d-\d\d)\]/g,(m,d)=>`<a class="aio-c" href="#/day/${d}">${d}</a>`);
  lines.forEach(l=>{const b=l.match(/^\s*[-•*]\s+(.*)/);if(b){if(!inList){html+='<ul>';inList=true}html+=`<li>${inline(b[1])}</li>`;return}if(inList){html+='</ul>';inList=false}
    const h=l.match(/^#{1,4}\s+(.*)/);if(h){html+=`<h4>${inline(h[1])}</h4>`;return}if(l.trim())html+=`<p>${inline(l)}</p>`});if(inList)html+='</ul>';return html}
const AI_SYS=`You are Market Files AI, the research desk of Market Files (Markets • Money • History) — a financial library and media company covering Wall Street, global finance, futures, financial history, Bitcoin and blockchain.
You research and answer ANY question about finance and economics at ANY level — from a beginner's first question to professional and academic depth: markets and asset classes, price histories as far back as records go, companies and industries, economies and economic history of any country, state or city, central banks and monetary systems, fiscal policy and sovereign debt, derivatives and futures, quantitative methods, valuation, risk, accounting, regulation, market microstructure, crises, and crypto and blockchain.
How to work:
- Use search_archive whenever Market Files may have a record, and events_on_date for date questions. Cite Market Files records inline exactly as given, like [MF-1929-1029] or [day:2008-09-15].
- Use get_quote only for the current board; in this preview it is SIMULATED data, so say so if you use it.
- Give real numbers, dates and named sources where you know them; show formulas or worked examples when they help. Separate established facts from estimates and say when something is uncertain. Never invent sources, quotes or data.
- Your knowledge has a cutoff and you cannot see today's news or live prices; say so for anything time-sensitive.
- Educational only: no personalized buy/sell recommendations.
- If a question has no financial or economic angle, say in one sentence that Market Files AI covers finance, markets and economic history.
Format: open with a direct 1–3 sentence answer, then structured sections ("### " headings, "- " bullets, **bold**) as the question requires. Match length to the question.`;
function aiTools(){return [
 {name:'search_archive',description:'Search the Market Files archive of files and dated Market Time Machine events. Returns up to 8 records with id, title, date, desk, status and summary.',inputSchema:{type:'object',properties:{query:{type:'string',description:'keywords, e.g. "Panic of 1907" or "Federal Reserve"'}},required:['query']},
  execute:({query})=>{searchState.q=String(query||'');const hs=searchHits().slice(0,8);return hs.map(h=>h.kind==='file'?{id:h.a.file,title:h.a.head,date:h.a.date,desk:deskOf(h.a).name,status:h.a.status,summary:[h.a.deck,...(h.a.body||[]).map(b=>b[1])].join(' ').slice(0,700)}:{id:`day:${h.e.date}`,title:h.e.head,date:h.e.date,desk:DESKS[h.e.desk].name,status:h.e.status,summary:(h.e.summary||'').slice(0,500)})}},
 {name:'events_on_date',description:'List Market Files events on a calendar date (any year) or an exact day. Returns id, date, title, status.',inputSchema:{type:'object',properties:{month:{type:'integer'},day:{type:'integer'},year:{type:'integer',description:'optional; omit for every year'}},required:['month','day']},
  execute:({month,day,year})=>{const m=+month,d=+day,y=+year||0;return EVENTS.filter(e=>e.m===m&&e.d===d&&(!y||e.y===y)).map(e=>({id:e.own?FILEMAP_BY_SLUG(e.link):`day:${e.date}`,date:e.date,title:e.head,status:e.status}))}},
 {name:'get_quote',description:'Current value from the Market Files board for a symbol or name (e.g. SPX, S&P 500, BTC, US10Y, EURUSD). Preview data is SIMULATED.',inputSchema:{type:'object',properties:{symbol:{type:'string'}},required:['symbol']},
  execute:({symbol})=>{const q=findInst(String(symbol||''))||INSTR.find(x=>x.id===String(symbol).toUpperCase());if(!q)throw new Error('Unknown symbol');const c=chg(q);return{symbol:q.id,name:q.name,value:fmtV(q),change:c.txt,data:'SIMULATED preview data, not real prices'}}}]}
const FILEMAP_BY_SLUG=s=>(BY[s]||{}).file||s;
let AI_TURNS=[],AI_CTL=null,AI_DEPTH='quick';
const DEPTH_NOTE={quick:'Mode: quick answer — be concise, under 300 words.',deep:'Mode: deep research — be comprehensive and structured (context, history with dates and levels, mechanisms, data, current state, key sources to consult), up to about 900 words.'};
function aiPanelClaude(){return `<section class="air" id="air" data-holo>
  <div class="air-h"><img src="${LOGO72}" alt="" width="28" height="28"><div><b>Market Files AI</b><span class="mono dim">Financial research at any depth · powered by Claude</span></div><div class="air-dp" role="radiogroup" aria-label="Research depth"><button role="radio" data-depth="quick" aria-checked="${AI_DEPTH==='quick'}">Quick</button><button role="radio" data-depth="deep" aria-checked="${AI_DEPTH==='deep'}">Deep research</button></div><button class="btn" id="air-stop" hidden>Stop</button></div>
  <div class="air-thread" id="air-thread"></div>
  <form class="air-f" id="air-f" hidden><label class="sr" for="air-i">Ask a follow-up</label><input class="inp" id="air-i" placeholder="Ask a follow-up…" autocomplete="off"><button class="btn btn-p">Ask</button></form>
  <div class="air-off" id="air-off" hidden><p>Market Files AI is temporarily unavailable. Please try again shortly.</p></div>
  <p class="mono dim air-n">AI answers draw on Claude’s knowledge and the Market Files archive. They can be wrong or out of date, and they are not financial advice. Check cited files.</p></section>`}
async function askAIClaude(q){const th=$('#air-thread');if(!th)return;if(!SAMPLE){$('#air-off').hidden=false;return}
  if(AI_CTL)AI_CTL.abort();AI_CTL=new AbortController();const saveQ=searchState.q;
  th.insertAdjacentHTML('beforeend',`<div class="air-q"><span class="mono dim">YOU</span><p>${esc(q)}</p></div><div class="air-a"><span class="mono holo">MARKET FILES AI</span><div class="air-body"><div class="aio-sk"><i></i><i></i><i></i></div><p class="mono dim air-think">Researching…</p></div></div>`);
  const body=$$('.air-body',th).pop();$('#air-stop').hidden=false;$('#air-f').hidden=true;
  AI_TURNS.push({role:'user',content:AI_TURNS.length?`${DEPTH_NOTE[AI_DEPTH]}\n\n${q}`:`${AI_SYS}\n\n${DEPTH_NOTE[AI_DEPTH]}\n\nReader's question: ${q}`});
  try{const r=await SAMPLE(AI_TURNS,{modelTier:AI_DEPTH==='deep'?'complex':'default',cache:false,signal:AI_CTL.signal,tools:aiTools(),onText:({text})=>{body.innerHTML=md(text)}});
    body.innerHTML=md(r.text)+(r.truncated?'<p class="dim">Answer cut short — ask a narrower follow-up.</p>':'');AI_TURNS.push({role:'assistant',content:r.text})}
  catch(e){if(e&&e.text)body.innerHTML=md(e.text);body.insertAdjacentHTML('beforeend',`<p class="dim">${AIERR[e&&e.code]||'Market Files AI couldn’t answer right now. Try again in a moment.'}</p>`);AI_TURNS.pop();if(e&&e.code==='not_granted'){$('#air-off').hidden=false}}
  finally{AI_CTL=null;searchState.q=saveQ;$('#air-stop').hidden=true;$('#air-f').hidden=false;attachHolo()}}
function wireAIPanelClaude(q,auto){AI_TURNS=[];$$('[data-depth]').forEach(b=>b.onclick=()=>{AI_DEPTH=b.dataset.depth;$$('[data-depth]').forEach(x=>x.setAttribute('aria-checked',String(x===b)))});const f=$('#air-f');if(!f)return;$('#air-stop').onclick=()=>AI_CTL&&AI_CTL.abort();
  f.onsubmit=e=>{e.preventDefault();const v=$('#air-i').value.trim();if(!v)return;$('#air-i').value='';askAI(v)};
  if(!q){$('#air').hidden=true;return}
  if(auto)askAI(q);else{$('#air-thread').innerHTML=`<button class="btn btn-p air-go" id="air-go">✦ Research “${esc(q)}”</button>`;$('#air-go').onclick=()=>{$('#air-thread').innerHTML='';askAI(q)}}}

/* =========================================================================
   SEARCH ENGINE — autocomplete, entities, did-you-mean, knowledge panel, AI Overview
   ========================================================================= */
function lev(a,b){if(Math.abs(a.length-b.length)>2)return 9;const d=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let p=d[0];d[0]=i;for(let j=1;j<=b.length;j++){const t=d[j];d[j]=Math.min(d[j]+1,d[j-1]+1,p+(a[i-1]===b[j-1]?0:1));p=t}}return d[b.length]}
function entities(){const m=new Map();const add=(name,type,slug)=>{if(!name)return;const k=name.toLowerCase();if(!m.has(k))m.set(k,{name,type,files:new Set()});m.get(k).files.add(slug)};
  HIST.forEach(a=>{a.inst.forEach(x=>add(x,'Institution',a.slug));a.people.forEach(x=>add(x,'Person',a.slug));a.assets.forEach(x=>add(x,'Market',a.slug));a.countries.forEach(x=>add(x,'Country',a.slug));add(a.crisis,'Crisis',a.slug)});return m}
let ENT=null;const ent=()=>ENT||(ENT=entities());
function vocab(){const v=new Set();[...A.map(a=>a.head+' '+a.deck),...EVENTS.map(e=>e.head),...[...ent().values()].map(e=>e.name),...INSTR.map(q=>q.name)].join(' ').toLowerCase().replace(/[^a-z0-9& ]/g,' ').split(/\s+/).forEach(w=>{if(w.length>=4)v.add(w)});return v}
function parseDateQ(q){q=q.trim().toLowerCase().replace(/,/g,'');let m=q.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})$/);if(m)return{y:+m[1],m:+m[2],d:+m[3]};
  m=q.match(/^(\d{1,2})\/(\d{1,2})\/(\d{3,4})$/);if(m)return{y:+m[3],m:+m[1],d:+m[2]};
  m=q.match(/^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{1,4}))?$/);if(m){const mi=MONTHS.findIndex(x=>x.toLowerCase().startsWith(m[1].slice(0,3)));if(mi>=0&&+m[2]>=1&&+m[2]<=DIM[mi])return{y:m[3]?+m[3]:0,m:mi+1,d:+m[2]}}return null}
function findInst(q){const s=q.trim().toLowerCase();if(s.length<2)return null;return INSTR.find(x=>x.id.toLowerCase()===s||x.name.toLowerCase()===s)||(s.length>=3?INSTR.find(x=>x.name.toLowerCase().startsWith(s)):null)}
function suggest(q){q=q.trim();if(!q)return[];const s=q.toLowerCase(),out=[];const dq=parseDateQ(q);
  const lk=libKey(q)||Object.keys(LIB).find(k=>LIB[k].title.toLowerCase().startsWith(s)||LIB[k].aka.some(a=>a.startsWith(s)));if(lk)out.push({t:`${LIB[lk].title} — full history since ${LIB[lk].since}`,k:'Library',href:`#/library/${lk}`});
  if(dq){if(dq.y&&validDay(dq.y,dq.m,dq.d))out.push({t:`${WD[utc(dq.y,dq.m,dq.d).getUTCDay()]}, ${MONTHS[dq.m-1]} ${dq.d}, ${dq.y}`,k:'Day file',href:`#/day/${isoOf(dq.y,dq.m,dq.d)}`});else if(!dq.y)out.push({t:`${MONTHS[dq.m-1]} ${dq.d} in every year`,k:'Time Machine',href:`#/on-this-date/${dq.m}-${dq.d}`})}
  if(/^\d{3,4}$/.test(s))out.push({t:`Everything filed in ${s}`,k:'Year',href:`#/on-this-date/year/${s}`});
  INSTR.filter(x=>x.name.toLowerCase().includes(s)||x.id.toLowerCase().startsWith(s)).slice(0,3).forEach(x=>out.push({t:x.name,k:`Live · ${x.id}`,inst:x.id}));
  [...ent().values()].filter(e=>e.name.toLowerCase().includes(s)).slice(0,3).forEach(e=>out.push({t:e.name,k:e.type,href:`#/search?q=${encodeURIComponent(e.name)}`}));
  A.filter(a=>a.head.toLowerCase().includes(s)).slice(0,3).forEach(a=>out.push({t:a.head,k:a.type==='hist'?`File · ${a.y}`:'Story',href:`#/file/${a.slug}`}));
  EVENTS.filter(e=>!e.own&&e.head.toLowerCase().includes(s)).slice(0,2).forEach(e=>out.push({t:e.head,k:`Event · ${e.y}`,href:`#/day/${e.date}`}));
  if(s.length>=3&&!lk)out.push({t:`Library: everything on “${q}”`,k:'Library',href:`#/library/${libSlug(q)}`});
  return out.slice(0,9)}
function sugHTML(list,sel){return list.map((x,i)=>x.inst?`<button class="sg${i===sel?' on':''}" data-sgi="${i}" role="option"><span>${esc(x.t)}</span><span class="mono">${esc(x.k)}</span></button>`:`<a class="sg${i===sel?' on':''}" data-sgi="${i}" role="option" href="${x.href}"><span>${esc(x.t)}</span><span class="mono">${esc(x.k)}</span></a>`).join('')}

const searchState={q:'',era:'',desk:'',country:'',asset:'',inst:'',person:''};
let SEARCH_AI=false;
function pageSearch(params){Object.keys(searchState).forEach(k=>searchState[k]=params.get(k)||'');SEARCH_AI=params.get('ai')==='1';if(params.get('depth')==='deep')AI_DEPTH='deep';
  setMeta(searchState.q?`${searchState.q} — Market Files search`:'Search — Market Files','Search markets, companies, crises, dates, people and institutions.');
  const f=(k,l,o)=>selectF('sf-'+k,l,o,searchState[k]);
  return `<div class="wrap page-in se">
  <div class="se-top"><div class="se-brand"><img src="${LOGO240}" alt="" width="76" height="76"><h1 class="se-logo holo">Market Files <span>AI Search</span></h1></div>
    <div class="se-box-w"><div class="sbox se-box"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color:var(--tx3)"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg><label class="sr" for="sf-q">Search the Market Files</label><input id="sf-q" value="${esc(searchState.q)}" placeholder="Search the Market Files here — or ask Market Files AI anything financial" autocomplete="off" role="combobox" aria-controls="sf-sug" aria-expanded="false"><kbd>/</kbd></div><div class="se-sug" id="sf-sug" role="listbox" hidden></div></div></div>
  <div class="filters se-f">${f('era','Era',ERAS.map(e=>[e.id,e.label]))}${f('desk','Desk',Object.entries(DESKS).filter(([k])=>k!=='hub').map(([k,d])=>[k,d.name]))}${f('country','Geography',uniq(a=>a.countries))}${f('asset','Asset',uniq(a=>a.assets))}${f('inst','Institution',uniq(a=>a.inst))}${f('person','Person',uniq(a=>a.people))}</div>
  <p class="se-stats mono" id="sf-stats"></p>
  <div class="se-g"><div><div id="sf-dym"></div>${aiPanel()}<div id="sf-res"></div></div><aside id="sf-kp"></aside></div></div>`}
function searchHits(){const s=searchState,terms=s.q.toLowerCase().split(/\s+/).filter(Boolean);const facet=s.country||s.asset||s.inst||s.person;
  const hayA=a=>[a.head,a.deck,a.loc,a.cat,a.y,fmtD(a),a.crisis,...a.inst,...a.people,...a.assets,...a.countries,deskOf(a).name,a.file,...(a.body||[]).map(b=>b[1])].join(' ').toLowerCase();
  const arts=A.filter(a=>(!s.era||a.era===s.era)&&(!s.desk||a.desk===s.desk)&&(!s.country||a.countries.includes(s.country))&&(!s.asset||a.assets.includes(s.asset))&&(!s.inst||a.inst.includes(s.inst))&&(!s.person||a.people.includes(s.person))&&terms.every(t=>hayA(a).includes(t)))
    .map(a=>({kind:'file',a,score:terms.reduce((n,t)=>n+(a.head.toLowerCase().includes(t)?3:1),0)+2}));
  const evs=facet||!terms.length?[]:EVENTS.filter(e=>!e.own&&(!s.era||eraOf(e.y)===s.era)&&(!s.desk||e.desk===s.desk)&&terms.every(t=>(e.head+' '+(e.summary||'')+' '+e.date+' '+e.y+' '+MONTHS[e.m-1]+' '+DESKS[e.desk].name).toLowerCase().includes(t)))
    .map(e=>({kind:'event',e,score:terms.reduce((n,t)=>n+(e.head.toLowerCase().includes(t)?3:1),0)}));
  return [...arts,...evs].sort((x,y)=>y.score-x.score||((y.a||y.e).date).localeCompare((x.a||x.e).date))}
function knowledgePanel(q){q=q.trim();if(!q)return '';const dq=parseDateQ(q);
  const lk=libKey(q);if(lk){const t=LIB[lk],lq=qs(t.live)[0],c=lq?chg(lq):null,first=t.pts[0],last=t.pts[t.pts.length-1];return `<div class="kp" data-holo><p class="mono dim">MARKET FILES LIBRARY · ${t.kind.toUpperCase()}</p><h2>${esc(t.title)}</h2>${lq?`<div data-id="${lq.id}" class="kp-q"><span class="mono" data-f="v">${fmtV(lq)}</span><span class="mono c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</span></div>`:''}<p class="kp-sub">${esc(t.intro)}</p><h3 class="mono">SINCE ${t.since}</h3><a class="kp-l" href="#/day/${first[0]}"><span class="mono">${first[0].slice(0,4)}</span> ${first[3]||''}${first[1].toLocaleString('en-US')} · ${esc(first[2])}</a><a class="kp-l" href="#/day/${last[0]}"><span class="mono">${last[0].slice(0,4)}</span> ${last[3]||''}${last[1].toLocaleString('en-US')} · ${esc(last[2])}</a><a class="btn btn-p" href="#/library/${lk}">Open the full history →</a></div>`}
  if(dq&&dq.y&&validDay(dq.y,dq.m,dq.d)){const ev=dayMatches(dq.y,dq.m,dq.d);return `<div class="kp" data-holo><p class="mono dim">DAY FILE</p><h2>${MONTHS[dq.m-1]} ${dq.d}, ${dq.y}</h2><p class="kp-sub">${WD[utc(dq.y,dq.m,dq.d).getUTCDay()]} · ${ev.length} event${ev.length===1?'':'s'} on this exact day</p>${ev.slice(0,4).map(e=>`<a class="kp-l" href="#/day/${e.date}">${esc(e.head)}</a>`).join('')}<a class="btn btn-p" href="#/day/${isoOf(dq.y,dq.m,dq.d)}">Open day file →</a></div>`}
  if(/^\d{3,4}$/.test(q)){const y=+q,ev=YEV.filter(e=>e.y===y);return `<div class="kp" data-holo><p class="mono dim">YEAR</p><h2 class="kp-yr">${y}</h2><p class="kp-sub">${ev.length} event${ev.length===1?'':'s'} filed · ${(ERAS.find(e=>y>=e.from&&y<=e.to)||{label:'Before 1600'}).label}</p>${ev.slice(0,5).map(e=>`<a class="kp-l" href="${e.m?'#/day/'+e.date:'#/file/'+e.link}">${e.m?`<span class="mono">${MONTHS[e.m-1].slice(0,3)} ${e.d}</span> `:''}${esc(e.head)}</a>`).join('')}<a class="btn btn-p" href="#/on-this-date/year/${y}">All of ${y} →</a></div>`}
  const qi=findInst(q);if(qi){const c=chg(qi);return `<div class="kp" data-holo><p class="mono dim">LIVE MARKET · ${qi.id}</p><h2>${esc(qi.name)}</h2><div data-id="${qi.id}" class="kp-q"><span class="mono" data-f="v">${fmtV(qi)}</span><span class="mono c ${c.cls}" data-f="c">${c.arrow} ${c.txt}</span></div>${spark(qi)}<p class="kp-sub">Data: ${Feed.name}</p><div class="kp-a"><button class="btn btn-p" data-openinst="${qi.id}">Details</button><a class="btn" href="${tvUrl(qi.id)}" target="_blank" rel="noopener">TradingView ↗</a>${CMC[qi.id]?`<a class="btn" href="${cmcUrl(qi.id)}" target="_blank" rel="noopener">CoinMarketCap ↗</a>`:''}</div></div>`}
  const e=ent().get(q.toLowerCase())||[...ent().values()].find(x=>x.name.toLowerCase().startsWith(q.toLowerCase())&&q.length>=4);
  if(e){const files=[...e.files].map(s=>BY[s]).filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));const kd=files.flatMap(a=>a.keyDates.map(k=>[k[0],k[1],a.slug])).sort((a,b)=>a[0].localeCompare(b[0])).slice(0,5);
    return `<div class="kp" data-holo><p class="mono dim">${e.type.toUpperCase()}</p><h2>${esc(e.name)}</h2><p class="kp-sub">${files.length} Market Files record${files.length===1?'':'s'} · ${files[0].y}–${files[files.length-1].y}</p><h3 class="mono">KEY DATES</h3>${kd.map(k=>`<a class="kp-l" href="${/^\d{4}-\d\d-\d\d$/.test(k[0])?'#/day/'+k[0]:'#/file/'+k[2]}"><span class="mono">${fmtISO(k[0])}</span> ${esc(k[1])}</a>`).join('')}<h3 class="mono">FILES</h3>${files.slice(0,4).map(a=>`<a class="kp-l" href="#/file/${a.slug}"><span class="mono">${a.y}</span> ${esc(a.head)}</a>`).join('')}<a class="btn" href="${aiHref(`Give a financial history of ${e.name}.`)}">✦ Research</a></div>`}
  return ''}
function didYouMean(q){const V=vocab();let changed=false;const out=q.toLowerCase().split(/\s+/).map(w=>{if(w.length<4||V.has(w))return w;let best=w,bd=w.length>=8?3:2;V.forEach(v=>{const d=lev(w,v);if(d<bd){bd=d;best=v}});if(best!==w)changed=true;return best}).join(' ');return changed?out:''}
function renderSearch(){const t0=performance.now(),s=searchState,terms=s.q.toLowerCase().split(/\s+/).filter(Boolean);const hits=searchHits();const ms=performance.now()-t0;
  const hl=t=>{let h=esc(t);terms.forEach(w=>{const re=new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`,'gi');h=h.replace(re,'<mark>$1</mark>')});return h};
  const snip=txt=>{const l=txt.toLowerCase();let i=terms.map(t=>l.indexOf(t)).filter(x=>x>=0).sort((a,b)=>a-b)[0]??0;const st=Math.max(0,i-60);return (st?'…':'')+txt.slice(st,st+220)+(txt.length>st+220?'…':'')};
  $('#sf-stats').textContent=s.q||hits.length?`About ${hits.length} result${hits.length===1?'':'s'} (${(ms/1000).toFixed(3)} seconds)`:'';
  const dym=hits.length?'':didYouMean(s.q);$('#sf-dym').innerHTML=dym?`<p class="se-dym">Did you mean: <a href="#/search?q=${encodeURIComponent(dym)}"><b><i>${esc(dym)}</i></b></a></p>`:'';
  $('#sf-res').innerHTML=hits.length?hits.slice(0,60).map(h=>{if(h.kind==='file'){const a=h.a,d=deskOf(a),body=[a.deck,...(a.body||[]).map(b=>b[1])].join(' ');
      return `<div class="gr"><div class="gr-u mono"><span class="gr-fav" style="--dc:${d.hex}"></span>Market Files › ${d.name} › ${a.file}</div><a class="gr-t" href="#/file/${a.slug}">${hl(a.head)}</a><p class="gr-s"><span class="mono">${a.type==='live'?fmtTime(a.when):fmtD(a)} — </span>${hl(snip(body))}</p></div>`}
    const e=h.e,d=DESKS[e.desk];return `<div class="gr"><div class="gr-u mono"><span class="gr-fav" style="--dc:${d.hex}"></span>Market Files › Time Machine › ${e.date}</div><a class="gr-t" href="#/day/${e.date}">${hl(e.head)}</a><p class="gr-s"><span class="mono">${MONTHS[e.m-1]} ${e.d}, ${e.y} — </span>${e.summary?hl(snip(e.summary)):`${d.name} · ${stamp(e.status)}`}</p></div>`}).join('')
    :s.q?`<div class="empty" style="text-align:left"><b>No Market Files match “${esc(s.q)}”.</b>Try a year (1929), a date (Oct 29 1929), an institution (Federal Reserve) or ask Market Files AI above.</div>`:`<div class="se-hint"><p class="mono dim">TRY</p>${['Federal Reserve','Oct 19 1987','Panic of 1907','1929','Bitcoin','Lehman Brothers','euro'].map(x=>`<a class="tag" href="#/search?q=${encodeURIComponent(x)}">${x}</a>`).join('')}</div>`;
  $('#sf-kp').innerHTML=knowledgePanel(s.q);
  attachHolo();const qs2=new URLSearchParams(Object.entries(s).filter(([,v])=>v)).toString();history.replaceState(null,'',`#/search${qs2?'?'+qs2:''}`)}
let AIO_CTL=null;
async function aiOverview(q,hits){const o=$('#aio-o'),go=$('#aio-go');if(!SAMPLE||!o)return;
  if(AIO_CTL){AIO_CTL.abort();return}AIO_CTL=new AbortController();go.textContent='Stop';o.innerHTML='<div class="aio-sk"><i></i><i></i><i></i></div>';
  const src=hits.map((h,i)=>h.kind==='file'?`[${i+1}] ${h.a.head} (${fmtD(h.a)}; file ${h.a.file}; status ${h.a.status}) — ${h.a.deck} ${(h.a.body||[]).map(b=>b[0]+': '+b[1]).join(' ')}`:`[${i+1}] ${h.e.head} (${h.e.date}; Time Machine event; status ${h.e.status}) ${h.e.summary||''}`).join('\n\n');
  const prompt=`You write the "AI Overview" at the top of Market Files search results. Answer the reader's query using ONLY the numbered records below. Cite records inline like [1] or [2][3]. If the records don't answer it, say so plainly. Keep it under 110 words, plain prose, no headings, no lists. Records marked "review" are not yet verified — don't overstate them.

Query: ${q}

Records:
${src}`;
  const render=t=>{o.innerHTML=`<p class="aio-t">${esc(t).replace(/\[(\d+)\]/g,(m,n)=>{const h=hits[+n-1];return h?`<a class="aio-c" href="${h.kind==='file'?'#/file/'+h.a.slug:'#/day/'+h.e.date}" title="${esc(h.kind==='file'?h.a.head:h.e.head)}">${n}</a>`:m})}</p>`};
  try{const r=await SAMPLE(prompt,{modelTier:'quick',signal:AIO_CTL.signal,onText:({text})=>render(text)});render(r.text);o.insertAdjacentHTML('beforeend','<p class="mono dim aio-n">Generated from Market Files records. AI can make mistakes — follow the numbered sources.</p>')}
  catch(e){if(e&&e.text)render(e.text);o.insertAdjacentHTML('beforeend',`<p class="dim">${AIERR[e&&e.code]||'Couldn’t generate an overview right now.'}</p>`);if(e&&e.code==='not_granted')$('#aio').remove()}
  finally{AIO_CTL=null;const g=$('#aio-go');if(g)g.textContent='Regenerate'}}
function afterSearch(){const i=$('#sf-q'),box=$('#sf-sug');i.focus();i.setSelectionRange(i.value.length,i.value.length);let t,list=[],sel=-1;
  const show=()=>{list=suggest(i.value);sel=-1;if(!list.length||!i.value.trim()){box.hidden=true;i.setAttribute('aria-expanded','false');return}box.innerHTML=sugHTML(list,sel);box.hidden=false;i.setAttribute('aria-expanded','true')};
  const pick=k=>{const x=list[k];if(!x)return;box.hidden=true;if(x.inst)openInst(x.inst);else location.hash=x.href};
  i.oninput=()=>{show();clearTimeout(t);t=setTimeout(()=>{searchState.q=i.value;renderSearch()},140)};
  i.onkeydown=e=>{if(e.key==='ArrowDown'&&!box.hidden){e.preventDefault();sel=Math.min(list.length-1,sel+1);box.innerHTML=sugHTML(list,sel)}else if(e.key==='ArrowUp'&&!box.hidden){e.preventDefault();sel=Math.max(-1,sel-1);box.innerHTML=sugHTML(list,sel)}else if(e.key==='Enter'){if(sel>=0){e.preventDefault();pick(sel)}else{box.hidden=true;searchState.q=i.value;renderSearch();if(i.value.trim()){$('#air').hidden=false;$('#air-thread').innerHTML='';AI_TURNS=[];askAI(i.value.trim())}}}else if(e.key==='Escape')box.hidden=true};
  box.onclick=e=>{const b=e.target.closest('[data-sgi]');if(b&&b.tagName==='BUTTON')pick(+b.dataset.sgi)};
  const off=e=>{if(!e.target.closest('.se-box-w'))box.hidden=true};document.addEventListener('click',off);cleanup.push(()=>document.removeEventListener('click',off));
  $('#sf-kp').addEventListener('click',e=>{const b=e.target.closest('[data-openinst]');if(b)openInst(b.dataset.openinst)});
  ['era','desk','country','asset','inst','person'].forEach(k=>$('#sf-'+k).onchange=e=>{searchState[k]=e.target.value;renderSearch()});renderSearch();wireAIPanel(searchState.q,SEARCH_AI)}

/* info pages */
const INFO={
 about:['About Market Files',`<p>Market Files is a financial library and media company: live markets and futures, a searchable archive of market history, and Market Files AI research on any financial topic. We are also a newsroom that investigates and visually reconstructs the events that changed markets — from Wall Street crashes and banking crises to central-bank decisions, Bitcoin, blockchain and today’s financial markets.</p><p>We present financial history the way we report the news: what happened, why it mattered, and the financial mechanism that actually moved. The same standard applies to live coverage, so every current story can be filed into the archive tomorrow.</p><h2>The desks</h2><ul>${Object.values(DESKS).map(d=>`<li><a href="${xUrl(d.handle)}" target="_blank" rel="noopener">@${d.handle}</a> — ${d.blurb||'The main Market Files account and hub for every desk.'}</li>`).join('')}</ul><p>Each event is covered by one desk only.</p>`],
 standards:['Editorial Standards',`<p>Important claims are verified before publication, preferably against primary or authoritative sources. We check dates, figures, quotations, historical distinctions, image provenance and usage rights.</p><h2>Source Record</h2><p>Files carry a Source Record listing each key claim, its source, the document, date, the type of evidence, our confidence and the rights status of any asset used.</p><h2>Image Status</h2><p>Every image is labeled. <strong>Archival photograph</strong>: a period image of the event itself, with provenance recorded. <strong>Illustrative historical reconstruction</strong>: an original visual built from the record, labeled as such. <strong>Illustrative placeholder</strong>: a stand-in used only until an event-specific image clears review. Images must correspond to the exact event described and are never reused across stories.</p><h2>Statuses</h2><p><strong>Verified</strong> — all key claims confirmed. <strong>In review</strong> — drafted, sources listed, confirmation under way. <strong>Pending</strong> — a claim or date is unresolved and the file is not published.</p>`],
 corrections:['Corrections',`<p>When we get something wrong, we correct it on the file, note what changed and when, and update the Source Record. Send corrections with the file number (for example MF-1873-0930) and your source.</p><p>No corrections have been logged in this preview.</p>`],
 contact:['Contact',`<p>Editorial and corrections: include the file number in your message.</p><p>On X: <a href="${xUrl('TheMarketFiles')}" target="_blank" rel="noopener">@TheMarketFiles</a>.</p><p>A contact form connects here once the email service is configured.</p>`],
 privacy:['Privacy',`<p>This preview collects no personal data. The newsletter and sign-in forms are not connected to any service. The production privacy policy will be published before launch.</p>`],
 terms:['Terms',`<p>Content is for educational purposes only. Nothing published by Market Files constitutes financial advice. Market data in this preview is simulated. Full terms will be published before launch.</p>`],
 newsletter:['The Daily File','']
};
function pageInfo(k){const p=INFO[k];if(!p)return notFound();setMeta(`${p[0]} — Market Files`,'');if(k==='newsletter')return `<div class="page-in">${newsletter()}<div class="wrap prose" style="padding-top:40px"><p>One email each weekday: the markets that moved, the story behind them, and one file from the archive on that date.</p></div></div>`;
  return `<div class="wrap page-in"><header class="ph serif"><h1>${p[0]}</h1></header><div class="prose">${p[1]}</div></div>`}
function notFound(){setMeta('Not found — Market Files','');return `<div class="wrap page-in"><header class="ph"><h1>File not found</h1><p>This address doesn’t match a Market Files page. Search the archive or return to the front page.</p></header><a class="btn" href="#/search">Search files</a> <a class="btn" href="#/">Front page</a></div>`}

/* =========================================================================
   ROUTER / META
   ========================================================================= */
function setMeta(title,desc,ld){document.title=title;($('meta[name="description"]')||{}).content=desc||'Markets • Money • History';
  ['og:title','twitter:title'].forEach(k=>{const m=$(`meta[property="${k}"],meta[name="${k}"]`);if(m)m.content=title});
  ['og:description','twitter:description'].forEach(k=>{const m=$(`meta[property="${k}"],meta[name="${k}"]`);if(m&&desc)m.content=desc});
  ($('#ld-page')||{}).textContent=ld?JSON.stringify(ld):''}
const NAV=[['blog','Blog','#8E7CF7'],['markets','Markets','#2FBF77'],['futures','Futures','#C9A55C'],['wall-street','Wall Street','#2FBF77'],['global-finance','Global Finance','#4C8DFF'],['history','History','#C9A55C'],['bitcoin','Bitcoin','#F2A03D'],['blockchain','Blockchain','#8E7CF7'],['library','Library','#F5C96B'],['archive','Archive','#C9A55C']];
$('#nav-links').innerHTML=NAV.map(([r,l,c])=>`<li><a href="#/${r}" data-r="${r}" style="--dc:${c||'#E9EDF2'}">${l}</a></li>`).join('');
$('#drawer-in').innerHTML=NAV.map(([r,l])=>`<a href="#/${r}">${l}<span aria-hidden="true">→</span></a>`).join('')+`<a href="#/timeline">Timeline<span>→</span></a><a href="#/on-this-date">On This Date<span>→</span></a><a href="#/newsletter">Newsletter<span>→</span></a>`;
$('#f-desks').innerHTML=Object.values(DESKS).map(d=>`<a href="${xUrl(d.handle)}" target="_blank" rel="noopener" style="--dc:${d.hex}"><b>@${d.handle}</b><span>${d.blurb||'Main account — every desk in one feed.'}</span></a>`).join('');
$('#yr').textContent=new Date().getFullYear();
$('#tk-track').innerHTML=tickerHTML();$('#tk-src').textContent=Feed.name;

let cleanup=[];
function route(){cleanup.forEach(f=>f());cleanup=[];
  const raw=location.hash.slice(1)||'/';const [path,qs]=raw.split('?');const params=new URLSearchParams(qs||'');const seg=path.split('/').filter(Boolean);const k=seg[0]||'';
  let html,after;
  if(!k){setMeta('Market Files — Markets • Money • History','Real-time market intelligence and the history behind it.');html=pageHome();after=afterHome}
  else if(k==='file'){html=pageFile(seg[1]);after=wireArticle}
  else if(k==='archive'){setMeta('The Archive — Market Files','Browse financial history by era, institution, market, crisis and person.');html=pageArchive(params);after=afterArchive}
  else if(k==='timeline'){html=pageTimeline(seg[1]);after=()=>{afterTimeline(seg[1]);wireLab()}}
  else if(k==='on-this-date'){html=pageOTD(seg);after=()=>{wireOTD(OTDST,true);setDbStatus()}}
  else if(k==='day'){html=pageDay(seg[1]);after=afterDay}
  else if(k==='search'){html=pageSearch(params);after=afterSearch}
  else if(k==='blog'){html=pageBlog();after=wireBlog}
  else if(k==='library'&&seg[1]){html=pageLibrary(seg[1]);after=()=>afterLibrary(seg[1])}
  else if(k==='library'){html=pageLibraryIndex();after=wireLibIndex}
  else if(k==='futures'){html=pageFutures();after=()=>{wireTerminal()}}
  else if(k==='markets'){html=pageMarkets();after=()=>{wireTerminal();refreshClocks();mountGlobe()}}
  else if(SECTIONS[k]){html=pageSection(k)}
  else if(k==='newsletter'){html=pageInfo('newsletter');after=wireNL}
  else if(k==='page'){html=pageInfo(seg[1])}
  else html=notFound();
  const main=$('#main');main.innerHTML=html;after&&after();attachHolo();
  const active=k==='file'?(BY[seg[1]]?DESKS[BY[seg[1]].desk].route:''):k==='timeline'||k==='on-this-date'||k==='day'?'archive':k;
  $$('#nav-links a').forEach(a=>{if(a.dataset.r===active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
  $('#drawer').classList.remove('open');{const xm=$('#x-m');if(xm&&!xm.hidden){xm.hidden=true;$('#x-b').setAttribute('aria-expanded','false')}}$$('#tabbar [data-t]').forEach(a=>a.classList.toggle('on',a.dataset.t===(k==='day'?'on-this-date':k)));$('#menu-b').setAttribute('aria-expanded','false');
  if(!routeKeep){window.scrollTo(0,0);main.focus({preventScroll:true})}routeKeep=false}
let routeKeep=false;
addEventListener('hashchange',route);

/* global UI */
$('#tab-menu').onclick=()=>{scrollTo({top:0,behavior:RM?'auto':'smooth'});$('#menu-b').click()};
$('#menu-b').onclick=()=>{const o=$('#drawer').classList.toggle('open');$('#menu-b').setAttribute('aria-expanded',String(o))};
const dlg=$('#dlg');$('#signin-b').onclick=()=>dlg.showModal();$$('[data-close]').forEach(b=>b.onclick=()=>dlg.close());
$('#dlg-f').onsubmit=e=>{e.preventDefault();const s=$('#dlg-f small');s.textContent='Preview only: the sign-in link would be sent here once authentication is connected.';s.style.color='var(--gold)'};
addEventListener('keydown',e=>{if(e.key==='/'&&!/input|select|textarea/i.test(document.activeElement.tagName)){e.preventDefault();if(!location.hash.startsWith('#/search'))location.hash='#/search';else $('#sf-q')?.focus()}});
function tickLive(){const s=session('eq');const el=$('#live');el.classList.toggle('on',s.c==='open');$('span',el).textContent=s.c==='open'?'LIVE · NYSE OPEN':s.t==='Pre-market'?'PRE-MARKET':s.t==='After hours'?'AFTER HOURS':'MARKETS CLOSED';
  $$('[data-sess]').forEach(x=>{const k=x.dataset.sess,t=session(k);x.className=`sess ${t.c}`;x.innerHTML=`<i></i>${t.t}`})}
tickLive();setInterval(()=>{tickLive();refreshClocks()},20000);
Feed.subscribe(updateQuote);Feed.subscribe(terminalTick);Feed.subscribe(wrapTick);Feed.subscribe(()=>{const lt=$('#lt');if(lt)lt.textContent=new Date().toLocaleTimeString('en-GB')});
setTheme(document.documentElement.dataset.theme||'dark');wireXMenu();$('#editor-b').onclick=()=>openEditor();$('[data-edclose]').onclick=()=>$('#ed').close();$('#theme-b').onclick=toggleTheme;$('#cmdk-b').onclick=openCmdk;
const SEL='.q[data-id],.tk[data-id],.cr-row[data-id],.ht[data-heat],.kt[data-id]';
document.addEventListener('click',e=>{const el=e.target.closest(SEL);if(el&&!e.target.closest('a'))openInst(el.dataset.id||el.dataset.heat)});
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#cmdk').open?$('#cmdk').close():openCmdk();return}
  if(e.key==='Enter'&&document.activeElement.matches&&document.activeElement.matches(SEL)){e.preventDefault();const el=document.activeElement;openInst(el.dataset.id||el.dataset.heat)}});
$('#inst').addEventListener('click',e=>{if(e.target.id==='inst'||e.target.closest('[data-x]'))$('#inst').close()});
$('#ck-i').oninput=()=>{CKI=0;renderCk()};
$('#ck-i').onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();CKI=Math.min(CK.length-1,CKI+1);renderCk()}else if(e.key==='ArrowUp'){e.preventDefault();CKI=Math.max(0,CKI-1);renderCk()}else if(e.key==='Enter'){e.preventDefault();runCk(CKI)}};
$('#ck-l').onclick=e=>{const b=e.target.closest('.ck-i');if(!b)return;if(b.tagName==='A'){$('#cmdk').close();return}runCk(+b.dataset.i)};
$('#cmdk').addEventListener('click',e=>{if(e.target.id==='cmdk')$('#cmdk').close()});Feed.start();
route();

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
