import json,os,base64,shutil,subprocess,time,socket,atexit
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('FLORALAB_QA_DIR',str(ROOT/'qa/acceptance-1.6')));OUT.mkdir(parents=True,exist_ok=True)
URL=os.environ.get('FLORALAB_BASE_URL','http://127.0.0.1:4173/floralab/')
checks=[];errors=[];shots=[]
def ck(value,label):
 assert value,label
 checks.append(label)
def shot(page,name):
 page.wait_for_timeout(500)
 page.evaluate("async()=>{const visible=[...document.images].filter(i=>i.src&&i.getBoundingClientRect().top<innerHeight&&i.getBoundingClientRect().bottom>0);await Promise.race([Promise.all(visible.map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,4000))]);}")
 ck(page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),name+' no horizontal overflow')
 page.screenshot(path=str(OUT/(name+'.png')));shots.append(name)
def plan(page):return page.evaluate("JSON.parse(localStorage.getItem('floralab-studio-state')).plan")
def nav(page,group,tab=None):
 page.locator('[data-group="'+group+'"]').click()
 if tab:page.locator('[data-tab="'+tab+'"]').click()
 page.wait_for_timeout(120)
def confirm(page):
 page.locator('#dialogConfirm').click()
 try:page.locator('dialog').wait_for(state='detached')
 except Exception:
  print(page.locator('dialog').inner_text(),flush=True);raise
def upload(page,kind,name):
 page.locator('[data-add-media="'+kind+'"]').click();page.locator('#mediaFile').set_input_files(str(OUT/'qa-image.png'));page.locator('#mediaTitle').fill(name);confirm(page);page.wait_for_function("()=>[...document.querySelectorAll('img[data-asset]')].some(i=>i.complete&&i.naturalWidth>0)")
def start(page):
 page.goto(URL,wait_until='networkidle');page.locator('#newDesign').wait_for()
 ck(page.evaluate("async()=> (await FloraLabRuntime.request('/api/status')).version")=='1.6.0','served 1.6.0')
if not os.environ.get('FLORALAB_BASE_URL'):
 try:
  with socket.create_connection(('127.0.0.1',4173),timeout=1):pass
 except OSError:
  server=subprocess.Popen([shutil.which('node'),'scripts/static-server.js'],cwd=ROOT,stdout=subprocess.DEVNULL);atexit.register(server.terminate);time.sleep(1)
with sync_playwright() as pw:
 chrome=os.environ.get('FLORALAB_BROWSER') or shutil.which('google-chrome') or shutil.which('chromium') or r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
 browser=pw.chromium.launch(executable_path=chrome,headless=True,args=['--no-sandbox'])
 for label,width,height in [('D',1440,1000),('M',390,844)]:
  ctx=browser.new_context(viewport={'width':width,'height':height},accept_downloads=True,permissions=['clipboard-read','clipboard-write']);page=ctx.new_page();page.set_default_timeout(10000);page.on('pageerror',lambda e:errors.append(str(e)));start(page);shot(page,label+'01-home')
  data=page.evaluate("()=>{let c=document.createElement('canvas');c.width=600;c.height=800;let x=c.getContext('2d');x.fillStyle='#eff1e8';x.fillRect(0,0,600,800);x.fillStyle='#527247';x.fillRect(160,260,280,300);x.fillStyle='white';x.font='40px sans-serif';x.fillText('QA TEST',205,425);return c.toDataURL('image/png').split(',')[1]}")
  (OUT/'qa-image.png').write_bytes(base64.b64decode(data))
  page.locator('#newDesign').click();page.locator('#idea').fill('白绿桌花，不要玫瑰，自然有空隙');shot(page,label+'02-create');ck(page.locator('#generate').bounding_box()['y']<height,'create action first screen '+label);page.locator('#generate').click();page.locator('[data-select-making]').wait_for();shot(page,label+'03-overview');ck(not any(f['name']=='玫瑰' for f in plan(page)['flowers']),'negative material respected '+label)
  page.locator('#renameProject').click();page.locator('#renameTitle').fill('白绿桌花 · '+label);shot(page,label+'04-rename');confirm(page);ck(plan(page)['title']=='白绿桌花 · '+label,'renamed '+label)
  nav(page,'ideas','explore');shot(page,label+'05-directions');page.locator('.explore-locks summary').click();shot(page,label+'06-locks');page.locator('[data-variation]:not([disabled])').first.click();shot(page,label+'07-variation-preview');original=plan(page)['id'];confirm(page);ck(plan(page)['id']!=original,'new variation preserves original '+label);shot(page,label+'08-compare')
  nav(page,'ideas','render');shot(page,label+'09-render-empty');upload(page,'render','测试效果图');shot(page,label+'10-render-photo');ck(len(plan(page)['media'])==1,'image metadata saved '+label)
  nav(page,'ideas','work');page.locator('[data-select-making]').click();shot(page,label+'11-stage-confirm');confirm(page);ck(plan(page)['workflow']['stage']=='preparing','making direction selected '+label);shot(page,label+'12-recipe')
  first=page.locator('.recipe-row').first;key=first.get_attribute('data-key');qty=plan(page)['recipe'][0]['quantity'];first.locator('[data-price]').fill('');first.locator('[data-price]').press('Tab');page.wait_for_timeout(300);ck(plan(page)['recipe'][0]['unit_price'] is None,'unknown price '+label)
  first=page.locator('.recipe-row').first;first.locator('[data-plus]').click();page.wait_for_timeout(300);ck(plan(page)['recipe'][0]['quantity']==qty+1,'recipe edit '+label)
  page.locator('#copyPurchase').click();copied=page.evaluate('navigator.clipboard.readText()');ck('\n' in copied and '\\n' not in copied,'purchase copy real newlines '+label)
  nav(page,'ideas','render');ck(page.locator('.media-kind.stale').count()==1,'image staleness '+label);shot(page,label+'13-stale-image')
  nav(page,'prepare');page.locator('[data-replace-material]').first.click();opts=page.locator('#replacement option').evaluate_all('(xs)=>xs.map(x=>x.value)');page.locator('#replacement').select_option(next(x for x in opts if x!=page.locator('#replacement').input_value()));shot(page,label+'14-replacement');confirm(page);shot(page,label+'15-replaced-recipe')
  nav(page,'making','structure');shot(page,label+'16-blueprint');page.locator('#nodePicker').select_option(index=1);shot(page,label+'17-node-selected');page.locator('.precise-controls summary').click();shot(page,label+'18-precise-controls')
  nav(page,'making','build');shot(page,label+'19-preparation');page.locator('[data-prepared="tools"]').check();page.wait_for_timeout(300);ck(plan(page)['build']['preparation']['tools'],'preparation persists '+label)
  use=page.locator('[data-used-input]').first;buildkey=page.locator('[data-build-key]').first.get_attribute('data-build-key');use.fill('99');use.press('Tab');page.wait_for_timeout(300);ck(plan(page)['build']['usage'][buildkey]==99,'record overuse '+label);shot(page,label+'20-overuse');page.locator('#undoBuild').click();page.wait_for_timeout(250);ck(plan(page)['build']['usage'][buildkey]==0,'undo overuse '+label);page.locator('[data-step-next]').click();page.wait_for_timeout(250);shot(page,label+'21-making-step')
  nav(page,'record','feedback');upload(page,'finished','测试成品');shot(page,label+'22-photo-comparison');ck(page.locator('.photo-pair img').count()==2,'render finished comparison '+label);page.locator('#actualNotes').fill('颜色与轮廓已核对');page.locator('#saveFeedback').click();page.wait_for_timeout(250);page.locator('[data-workflow-stage="finished"]').click();confirm(page);ck(plan(page)['workflow']['stage']=='finished','finished stage '+label)
  nav(page,'record','history');page.locator('[data-snapshot-index]').first.wait_for();shot(page,label+'23-history');page.locator('[data-snapshot-index]').first.click();shot(page,label+'24-restore-preview');confirm(page);ck(plan(page)['history'][-1]['type']=='restore','restore commits '+label)
  with page.expect_download() as download:page.locator('#exportPlan').click()
  file=OUT/(label+'-roundtrip.floralab');download.value.save_as(str(file));raw=json.loads(file.read_text());ck(len(raw['media']['assets'])==2,'export includes images '+label);before=plan(page)['id']
  page.reload(wait_until='networkidle');page.locator('[data-open-project]').first.click();page.locator('[data-group]').first.wait_for();ck(plan(page)['id']==before,'resume current project '+label)
  # Native navigation on mobile is behind the menu, so use the public home action.
  page.evaluate("document.querySelector('[data-go=home]').click()")
  page.locator('input[type=file]').first.set_input_files(str(file));page.locator('#dialogConfirm').wait_for();shot(page,label+'25-import-preview');confirm(page);ck(plan(page)['id']!=before,'import creates independent copy '+label);ck(len(plan(page)['media'])==2,'import restores media '+label)
  page.evaluate("document.querySelector('[data-go=home]').click()");shot(page,label+'26-projects');ck(page.locator('.project-tile').count()>=3,'all branches retained '+label)
  # Malformed import must leave the selected plan untouched.
  old=plan(page)['id'];page.locator('input[type=file]').first.set_input_files({'name':'bad.floralab','mimeType':'application/json','buffer':b'{}'});page.wait_for_timeout(150);ck(plan(page)['id']==old,'invalid import atomic '+label)
  page.evaluate("document.querySelector('[data-go=materials]').click()");shot(page,label+'27-library')
  for kind,keys in [('creative',['acrylic','photo','card','coffee']),('flower',['ammi','astilbe','monstera','sweetpea','ref_057','ref_078','ref_080','ref_090','ref_111','ref_116'])]:
   page.locator('[data-library-kind="'+kind+'"]').click()
   for key in keys:
    page.locator('[data-material-detail="'+kind+':'+key+'"]').click();page.locator('.material-visual img').wait_for();page.wait_for_function("()=>{const i=document.querySelector('.material-visual img');return i&&i.complete&&i.naturalWidth>0}");shot(page,label+'-material-'+key);page.locator('[data-library-back]').click()
  page.evaluate("document.querySelector('#installApp').click()");shot(page,label+'28-install')
  page.evaluate("document.querySelector('[data-go=creative-space]').click()") if page.locator('[data-go=creative-space]').count() else None
  page.evaluate("document.querySelector('[data-go=home]').click()")
  if label=='D':
   page.evaluate("async()=>{await navigator.serviceWorker.ready}");page.reload(wait_until='networkidle');ctx.set_offline(True);page.reload(wait_until='domcontentloaded');page.locator('#newDesign').wait_for();shot(page,label+'29-offline');page.locator('[data-open-project]').first.click();page.locator('[data-group]').first.wait_for();ck(len(plan(page)['media'])==2,'offline project with media');ctx.set_offline(False)
  ck(not errors,'no runtime errors '+label);ctx.close()
 browser.close()
(OUT/'acceptance.json').write_text(json.dumps({'url':URL,'checks':checks,'screenshots':shots,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(checks),'screenshots':len(shots),'errors':errors,'output':str(OUT)},ensure_ascii=False))
