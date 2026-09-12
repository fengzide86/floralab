"""Actual mouse/touch gestures, saved geometry and discoverable in-product help."""
import atexit, json, os, shutil, socket, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
URL=os.getenv('FLORALAB_BASE_URL','http://127.0.0.1:4173/floralab/')
OUT=Path(os.getenv('FLORALAB_STRUCTURE_QA_DIR',str(ROOT/'qa/structure-acceptance')))
OUT.mkdir(parents=True,exist_ok=True)
if not os.getenv('FLORALAB_BASE_URL'):
 try:
  with socket.create_connection(('127.0.0.1',4173),timeout=1):pass
 except OSError:
  server=subprocess.Popen([shutil.which('node'),'scripts/static-server.js'],cwd=ROOT,stdout=subprocess.DEVNULL)
  atexit.register(server.terminate);time.sleep(1)
checks=[];shots=[]
def ck(value,label):
 assert value,label
 checks.append(label)
def state(p):return p.evaluate("JSON.parse(localStorage.getItem('floralab-studio-state')).plan")
def node(p):return state(p)['blueprint']['nodes'][0]
def settled(p):p.wait_for_function('!S.mutating')
def shot(p,label):
 ck(p.evaluate('document.documentElement.scrollWidth<=innerWidth+2'),label+' no overflow')
 p.screenshot(path=str(OUT/(label+'.png')));shots.append(label)
def center(p):
 p.locator('.editor-frame svg').scroll_into_view_if_needed()
 q=p.locator('.editor-frame .bp-node.selected circle:not(.bp-hit)').bounding_box()
 return q['x']+q['width']/2,q['y']+q['height']/2
def gesture(p,cdp,mobile,dx,dy,cancel=False):
 x,y=center(p)
 if mobile:
  cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  for i in range(1,9):cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*i/8,'y':y+dy*i/8}]})
  cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel' if cancel else 'touchEnd','touchPoints':[]})
 else:
  p.mouse.move(x,y);p.mouse.down();p.mouse.move(x+dx,y+dy,steps=8);p.mouse.up()
 settled(p)

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.getenv('FLORALAB_BROWSER') or shutil.which('google-chrome') or shutil.which('chromium') or r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',headless=True,args=['--no-sandbox'])
 for label,mobile,width,height in [('D',False,1440,1000),('M',True,390,844)]:
  c=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile)
  p=c.new_page();p.set_default_timeout(10000);p.set_default_navigation_timeout(60000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  p.goto(URL,wait_until='networkidle');p.locator('#newDesign').click();p.locator('#idea').fill('白绿桌花，不要玫瑰')
  if mobile:p.locator('#navMore').click()
  p.locator('[data-help]:visible').click();p.locator('.usage-guide').wait_for();shot(p,label+'01-guide')
  for section in p.locator('.usage-guide details').all():
   if section.get_attribute('open') is None:section.locator('summary').click()
   ck(section.locator('p').first.is_visible(),label+' guide section readable')
  p.locator('[data-close-guide]').click();ck(p.locator('#idea').input_value()=='白绿桌花，不要玫瑰',label+' guide preserves unsubmitted form')
  p.locator('#generate').click();p.locator('[data-group="making"]').click();p.locator('#nodePicker').wait_for()
  before=state(p);recipe=before['recipe'];ident=node(p)['id'];cdp=c.new_cdp_session(p)
  # All five projections: horizontal motion affects the expected world axis/sign.
  for view,axis,sign,hidden in [('front','x',1,'y'),('back','x',-1,'y'),('left','y',1,'x'),('right','y',-1,'x'),('top','x',1,'z')]:
   p.locator('[data-view="'+view+'"]').click();p.locator('#nodePicker').select_option(ident)
   old=node(p);gesture(p,cdp,mobile,12,0);new=node(p)
   ck((new[axis]-old[axis])*sign>0,label+' '+view+' drag moves selected node in projected direction')
   ck(new[hidden]==old[hidden],label+' '+view+' drag preserves hidden axis')
  ck(state(p)['recipe']==recipe,label+' dragging preserves materials colors and quantities')
  p.locator('[data-view="top"]').click();old=node(p);gesture(p,cdp,mobile,0,-12);ck(node(p)['y']>old['y'],label+' top upward moves toward front')
  if mobile:
   old=node(p);gesture(p,cdp,mobile,-12,8,True);ck(node(p)==old,'M cancelled touch leaves saved geometry unchanged')
  shot(p,label+'02-dragged')
  p.locator('#nodePicker').select_option(index=1);second=p.locator('#nodePicker').input_value();ck(second!=ident,label+' picker can select crowded points')
  p.locator('#nodePicker').select_option(ident)
  old=node(p);p.locator('[data-nudge="z:1"]').click();settled(p);ck(node(p)['z']==round(old['z']+1,1),label+' raise button moves one cm')
  p.locator('#moveStep').select_option('5');old=node(p);p.locator('[data-nudge="y:-1"]').click();settled(p);ck(node(p)['y']==round(old['y']-5,1),label+' rear button moves five cm')
  ck(p.locator('#moveStep').input_value()=='5',label+' adjustment step retained')
  p.locator('[data-node-action="lock"]').click();settled(p);ck(node(p)['locked'],label+' lock persists')
  ck(not p.locator('[data-nudge="x:1"]').is_enabled(),label+' locked point has disabled spatial controls')
  old=node(p);gesture(p,cdp,mobile,12,0);ck(node(p)==old,label+' locked drag cannot change point')
  p.locator('[data-node-action="lock"]').click();settled(p)
  p.locator('.precise-controls summary').click();p.locator('[data-node-field="x"]').fill('0');p.locator('[data-node-field="x"]').press('Tab');settled(p);ck(node(p)['x']==0,label+' precise field persists')
  ck(p.locator('.precise-controls').get_attribute('open') is not None,label+' precise controls stay open')
  shot(p,label+'03-spatial-controls')
  p.locator('[data-node-action="duplicate"]').click();ck(p.locator('dialog').is_visible(),label+' quantity-changing action explains impact')
  p.locator('dialog').get_by_role('button',name='取消',exact=True).click();ck(state(p)['recipe']==recipe,label+' cancel duplication preserves quantity')
  count=len(state(p)['blueprint']['nodes']);quantity=sum(r['quantity'] for r in state(p)['recipe'])
  p.locator('[data-node-action="duplicate"]').click();p.locator('#dialogConfirm').click();p.locator('dialog').wait_for(state='detached');settled(p)
  ck(len(state(p)['blueprint']['nodes'])==count+1 and sum(r['quantity'] for r in state(p)['recipe'])==quantity+1,label+' confirmed duplication adds exactly one material')
  duplicate=state(p)['blueprint']['nodes'][-1]['id'];p.locator('#nodePicker').select_option(duplicate)
  p.locator('[data-node-action="delete"]').click();p.locator('#dialogConfirm').click();p.locator('dialog').wait_for(state='detached');settled(p)
  ck(len(state(p)['blueprint']['nodes'])==count and sum(r['quantity'] for r in state(p)['recipe'])==quantity,label+' confirmed removal subtracts exactly one material')
  p.locator('#nodePicker').select_option(ident)
  p.locator('#structureHelp').click();ck(p.locator('.usage-guide details[open] summary').inner_text().startswith('4.'),label+' context help opens spatial instructions');shot(p,label+'04-spatial-guide');p.locator('[data-close-guide]').click()
  saved=node(p);p.reload(wait_until='networkidle');p.locator('[data-open-project]').first.click();p.locator('#nodePicker').wait_for();ck(node(p)==saved,label+' geometry survives reload')
  ck(not errors,label+' no runtime errors');c.close()
 browser.close()
(OUT/'structure.json').write_text(json.dumps({'url':URL,'checks':checks,'screenshots':shots},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'structure_checks':len(checks),'screenshots':len(shots),'output':str(OUT)},ensure_ascii=False))
