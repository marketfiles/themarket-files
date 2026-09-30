"""Converts the approved Market Files preview (single HTML file) into the production
experience bundle: public/experience/market-files.js, app/globals.css, app/experience-shell.ts.
Re-run after changing the preview:  python3 tools/build_experience.py path/to/market-files.html
"""
import re, sys, json, pathlib
src = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'market-files.html').read_text()
root = pathlib.Path(__file__).resolve().parent.parent

css = re.search(r'<style>(.*?)</style>', src, re.S).group(1)
body = src.split('<body>', 1)[1]
shell, rest = body.split('<script>\n/* =====', 1)
js = '/* =====' + rest.rsplit('</script>', 1)[0]

def rep(s, a, b, count=1):
    assert a in s, 'missing: ' + a[:80]
    return s.replace(a, b, count)

# ---------- shell: production copy ----------
shell = rep(shell, 'Market Files · Market data shown is simulated', 'Market Files · Market data may be delayed · Sources in each panel')
shell = rep(shell, "Accounts aren’t connected in this preview. The authentication provider plugs in here.", 'Reader accounts are coming soon. Market Files is free to read.')
shell = re.sub(r'src="data:image/png;base64,[^"]+"', 'src="/logo-72.png"', shell)

# ---------- css ----------
css += '\n/* production */\n#signin-b{display:none}\n'

# ---------- js ----------
js = re.sub(r"const LOGO72='data:image/png;base64,[^']+';", "const LOGO72='/logo-72.png';", js)
js = re.sub(r"const LOGO240='data:image/png;base64,[^']+';", "const LOGO240='/logo-240.png';", js)
js = rep(js, "const SITE_URL='https://www.themarketfiles.com'; // placeholder domain", "const SITE_URL=(window.MF_CONFIG&&MF_CONFIG.siteUrl)||location.origin;")
js = rep(js, "const Feed=SimulatedFeed; // ← replace with a live provider implementing the same interface", open(root/'tools/livefeed.js').read())
js = rep(js, "const fmtV=q=>q.v.toLocaleString(", "const fmtV=q=>q.na?'—':q.v.toLocaleString(")
js = rep(js, "function chg(q){const d=q.v-q.prev;", "function chg(q){if(q.na)return{cls:'flat',txt:'—',arrow:''};const d=q.v-q.prev;")
js = rep(js, "<span>9:30</span><span>11:00</span><span>12:30</span><span>14:00</span><span>16:00 ET</span>", "${Feed.live?'<span>Earlier</span><span>Now</span>':'<span>9:30</span><span>11:00</span><span>12:30</span><span>14:00</span><span>16:00 ET</span>'}")
js = rep(js, "Auto-generated from the board · simulated data", "Auto-generated from the board · ${Feed.live?'delayed market data':'simulated data'}")
js = re.sub(r'(\w)\.v\*\1\.sup', r'mcap(\1)', js)
js = rep(js, "const fmtCap=", "const mcap=q=>q.mc??q.v*q.sup;\nconst fmtCap=")
js = rep(js, "const tries=[()=>viaDatamaps(TOPO_SRC[0])", "const tries=[async()=>{const [w,u]=await Promise.all([fetch('/geo/world.json').then(r=>{if(!r.ok)throw 0;return r.json()}),fetch('/geo/us.json').then(r=>r.ok?r.json():{features:[]})]);return[w,u]},()=>viaDatamaps(TOPO_SRC[0])")
js = rep(js, "'Built-in copy · sign in to Claude for the live database'", "'Built-in copy · database offline'")
js = rep(js, "Market Files AI runs on Claude. Open this page signed in to Claude to use it.", "Market Files AI is temporarily unavailable. Please try again shortly.")
js = rep(js, "<p class=\"dim\">Market Files AI runs on Claude — open this page signed in to Claude to use it.</p>", "")
js = rep(js, "Preview content: facts are drafted for review", "Editorial note: facts marked In review are drafted")
js = rep(js, "m.style.color='var(--up)';m.textContent=`Subscribed ${v}. (Preview: connect a newsletter provider to send the confirmation email.)`;f.reset()}}",
  "m.style.color='var(--tx3)';m.textContent='Subscribing…';fetch('/api/newsletter',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:v})}).then(async r=>{const j=await r.json().catch(()=>({}));if(r.ok){m.style.color='var(--up)';m.textContent=j.message||'You’re subscribed. Check your inbox to confirm.';f.reset()}else{m.style.color='var(--dn)';m.textContent=j.error||'Couldn’t subscribe right now. Please try again.'}}).catch(()=>{m.style.color='var(--dn)';m.textContent='Couldn’t subscribe right now. Please try again.'})}}")

js = js.replace("$('#ld-page').textContent=", "($('#ld-page')||{}).textContent=")
for name in ('theme-color', 'description'):
    js = js.replace("$('meta[name=\"%s\"]').content=" % name, "($('meta[name=\"%s\"]')||{}).content=" % name)
js = rep(js, "const xUrl=h=>`https://x.com/${h}`;", "const xUrl=h=>`https://x.com/${h}`;\nObject.values(DESKS).forEach(d=>{const f=(window.MF_CONFIG&&MF_CONFIG.pfps||{})[d.handle];if(f)d.pfp=f});")
# ---- $0 launch hooks: Google research + TradingView ----
for fn in ('function aiPanel(){', 'async function askAI(q){', 'function wireAIPanel(q,auto){', 'async function gpAsk(focus,free){'):
    name = fn.split('(')[0].split()[-1]
    js = rep(js, fn, fn.replace(name + '(', name + 'Claude('))
js = rep(js, 'function wireTerminal(){', 'function wireTerminal(){if(window.MF_TV)mountTVFutures();')
js = rep(js, '<div class="fu-grid">', '${window.MF_TV?tvFuturesBlock(false):\'\'}<div class="fu-grid" ${window.MF_TV?\'hidden\':\'\'}>')
js = rep(js, '${stripTiles(DESK_INST.futures)}<div style="height:28px"></div>', '${window.MF_TV?tvFuturesBlock(true):stripTiles(DESK_INST.futures)}<div style="height:28px"></div>')
js = rep(js, '<table class="crt fut-t">', '<table class="crt fut-t${window.MF_TV?\' tv\':\'\'}">')
js = rep(js, '<div class="side-c">${lineChart(ser,q.prev)}', '<div class="side-c">${window.MF_TV&&(q.na||q.fut)?\'<div class="tvw tvw-sm" id="tv-sym"></div>\':lineChart(ser,q.prev)}')
js = rep(js, "const d=$('#inst');if(!d.open)d.showModal()}", "const d=$('#inst');if(!d.open)d.showModal();if(window.MF_TV&&(q.na||q.fut))mountTVSymbol($('#tv-sym'),q)}")
js = js.replace('✦ Ask Market Files AI', '✦ Research').replace('Research “${esc(q)}” with Market Files AI', 'Research “${esc(q)}”').replace('Research with Market Files AI', 'Research further').replace('✦ MARKET FILES AI · ECONOMIC & FINANCIAL HISTORY', '✦ RESEARCH · ECONOMIC & FINANCIAL HISTORY')
js = js + '\n' + open(root/'tools/production.js').read()
css += '\n.tvw{height:520px;padding:0 8px 8px}.tvw-lg{height:680px}.tvw-sm{height:320px;padding:0}.tvw-p{margin-bottom:1px}.fut-t.tv th:nth-child(4),.fut-t.tv th:nth-child(5),.fut-t.tv th:nth-child(6),.fut-t.tv td:nth-child(4),.fut-t.tv td:nth-child(5),.fut-t.tv td:nth-child(6){display:none}.gcse-box{min-height:120px}.gcse-box .gsc-control-cse{background:transparent!important;border:0!important;padding:0!important}\n'
runtime = open(root/'tools/runtime.js').read()
(root/'public/experience/market-files.js').write_text(runtime + '\n' + js)
(root/'app/globals.css').write_text(css)
(root/'app/experience-shell.ts').write_text('// Generated by tools/build_experience.py — do not edit by hand.\nexport const SHELL_HTML = ' + json.dumps(shell) + ';\n')
print('ok', len(js), len(css), len(shell))
