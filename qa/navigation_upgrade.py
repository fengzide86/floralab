"""Reproduce a returning user's mixed cached form, then test the real upgrade.

Fixtures are verbatim files from main 46013d7. Each browser uses isolated data.
The previous worker deliberately stays active while the new version opens.
"""
import json, os, re, shutil, threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.environ.get('FLORALAB_NAV_QA_DIR', str(ROOT/'qa/navigation-upgrade')))
OUT.mkdir(parents=True, exist_ok=True)
VERSION = json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
mode = {'versioned': False, 'new_worker': False}

class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        url = urlsplit(self.path)
        rel = unquote(url.path).removeprefix('/floralab/').lstrip('/')
        if rel == 'seed.html':
            body = b'<!doctype html><title>Isolated upgrade test</title>'; mime = 'text/html'
        elif rel == 'service-worker.js' and not mode['new_worker']:
            body = (ROOT/'qa/fixtures/upgrade/worker-1.5.3.js').read_bytes(); mime = 'text/javascript'
        elif rel == 'views/create.js' and not url.query and not mode['new_worker']:
            body = (ROOT/'qa/fixtures/upgrade/create-1.5.3.js').read_bytes(); mime = 'text/javascript'
        else:
            path = (ROOT/'public'/(rel or 'index.html')).resolve()
            if not path.is_relative_to((ROOT/'public').resolve()) or not path.is_file():
                self.send_error(404); return
            body = path.read_bytes(); mime = self.guess_type(str(path))
            if path.name == 'index.html' and not mode['versioned']:
                body = re.sub(rb'\?v=[^"\s]+', b'', body)
        self.send_response(200)
        self.send_header('Content-Type', mime+'; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers(); self.wfile.write(body)

server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_port}/floralab/'
checks = []
def ck(value, label):
    assert value, label
    checks.append(label)
def shot(p, name):
    p.screenshot(path=str(OUT/(name+'.png')))
def confirm(p):
    p.locator('#dialogConfirm').click()
    p.locator('dialog').wait_for(state='detached')

try:
    with sync_playwright() as pw:
        executable = os.getenv('FLORALAB_BROWSER') or shutil.which('google-chrome') or shutil.which('chromium') or r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
        browser = pw.chromium.launch(executable_path=executable, headless=True)
        for name, width, height in [('D',1440,1000), ('M',390,844)]:
            mode.update(versioned=False, new_worker=False)
            context = browser.new_context(viewport={'width':width,'height':height})
            p = context.new_page(); p.set_default_timeout(10000); p.set_default_navigation_timeout(60000)
            errors=[]; p.on('pageerror', lambda e: errors.append(str(e)))
            p.goto(URL+'seed.html')
            p.add_script_tag(url=URL+'runtime.js')
            old_id = p.evaluate("""async()=>{
                const plan=await FloraLabRuntime.request('/api/design/generate',{method:'POST',body:JSON.stringify({prompt:'白色桌花'})});
                localStorage.setItem('floralab-studio-state',JSON.stringify({plan,form:plan.request,mode:'floral',lastTab:'work',updatedAt:new Date().toISOString()}));
                await navigator.serviceWorker.register('./service-worker.js');
                await navigator.serviceWorker.ready;
                return plan.id;
            }""")
            p.wait_for_function('navigator.serviceWorker.controller!==null')
            p.goto(URL, wait_until='networkidle'); p.locator('#newDesign').click()
            ck(p.locator('#useExample').count()==0, name+' old cached form actually loaded')
            p.locator('#idea').fill('5555'); p.locator('#generate').click()
            p.wait_for_timeout(150)
            ck(any('null' in e for e in errors), name+' reported first-page failure reproduced')
            ck(p.locator('#generate').is_visible(), name+' broken form never advances')
            shot(p, name+'01-reproduced'); errors.clear()

            mode['versioned']=True
            p.reload(wait_until='networkidle')
            p.locator('[data-go="home"]').click(); p.locator('#newDesign').wait_for()
            ck(p.locator(f'[data-open-project="{old_id}"]').count()>0, name+' previous work retained')
            p.locator('#newDesign').click(); p.locator('#useExample').wait_for()
            ck(p.locator('#intentError').count()==1, name+' current form and controls loaded together')
            ck(p.evaluate("document.querySelector('script[src*=\"views/create.js\"]').src.includes('?v=')"), name+' view has release-specific URL')
            p.locator('#idea').fill('白绿桌花，不要玫瑰')
            shot(p, name+'02-upgraded-create')
            p.locator('#generate').click(); p.locator('[data-select-making]').wait_for()
            shot(p, name+'03-generated')
            ck(not errors, name+' generate under old worker has no errors')
            p.locator('[data-tabjump="explore"]').click(); p.locator('[data-variation]').first.wait_for()
            p.locator('[data-tab="work"]').click(); p.locator('[data-select-making]').click(); confirm(p)
            p.locator('[data-workflow-stage="making"]').click(); confirm(p)
            steps=p.locator('[data-step]').count()
            for step in range(steps-1):
                p.locator('#nextStep').click()
                p.wait_for_function('(i)=>document.querySelector("[data-step].active")?.dataset.step===String(i)', arg=step+1)
            ck(p.locator('#nextStep').is_enabled(), name+' final bottom action enabled')
            shot(p,name+'04-last-step')
            p.locator('#nextStep').click(); p.locator('#saveFeedback').wait_for()
            ck(p.locator('[data-tab="feedback"]').get_attribute('class')=='active', name+' last step reaches finished page')
            p.locator('[data-group="prepare"]').click(); p.locator('[data-material-detail]').first.click()
            p.locator('#returnRecipe').click(); p.locator('#copyPurchase').wait_for()
            ck(p.locator('[data-tab="recipe"]').get_attribute('class')=='active', name+' material detail returns to recipe')
            p.locator('[data-go="home"]').click(); p.locator('#newDesign').wait_for()
            ck(p.locator(f'[data-open-project="{old_id}"]').count()>0, name+' original work still retained after navigation')

            mode['new_worker']=True
            p.evaluate('async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()}')
            p.wait_for_function("async v=>{const keys=await caches.keys();return keys.includes('floralab-'+v+'-shell-refresh')&&!keys.includes('floralab-1.5.3-shell-refresh')}", arg=VERSION)
            context.set_offline(True); p.reload(wait_until='domcontentloaded'); p.locator('#newDesign').wait_for()
            p.locator('#newDesign').click(); p.locator('#useExample').wait_for()
            p.locator('#idea').fill('白绿桌花'); p.locator('#generate').click(); p.locator('[data-select-making]').wait_for()
            ck(not errors, name+' upgraded worker supports offline creation with no errors')
            shot(p,name+'05-offline'); context.close()
        browser.close()
finally:
    server.shutdown()
result={'version':VERSION,'checks':checks,'expectedFailureReproduced':True,'postUpgradeErrors':[]}
(OUT/'navigation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'navigation_upgrade_checks':len(checks),'output':str(OUT)},ensure_ascii=False))
