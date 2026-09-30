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
