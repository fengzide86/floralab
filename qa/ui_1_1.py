import json, mimetypes
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]; PUB=ROOT/'public'; QA=ROOT/'qa'; QA.mkdir(exist_ok=True)
checks=[]
def ck(cond,name):
    if not cond: raise AssertionError(name)
    checks.append(name)
def shot(page,name,full=True): page.screenshot(path=str(QA/name),full_page=full)
def overflow_ok(page): return page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2')

def install_storage_mocks(page):
    page.evaluate("""()=>{
      const ls={
        _d:{},
        getItem(k){return Object.prototype.hasOwnProperty.call(this._d,k)?this._d[k]:null;},
        setItem(k,v){this._d[k]=String(v);},
        removeItem(k){delete this._d[k];},
        clear(){this._d={};}
      };
      Object.defineProperty(window,'localStorage',{configurable:true,value:ls});

      const stores={};
      let opened=false;
      const db={
        objectStoreNames:{contains(name){return Object.prototype.hasOwnProperty.call(stores,name);}},
        createObjectStore(name,opts={}){
          stores[name]={keyPath:opts.keyPath||null,items:new Map()};
          return {};
        },
        close(){},
        transaction(name){
          const tx={oncomplete:null,onerror:null,error:null};
          tx.objectStore=function(n){
            const st=stores[n];
            return {
              put(v){
                const key=st.keyPath?v[st.keyPath]:v.key;
                st.items.set(key,structuredClone(v));
                setTimeout(()=>{if(tx.oncomplete)tx.oncomplete();},0);
              },
              get(key){
                const r={};
                setTimeout(()=>{r.result=st.items.has(key)?structuredClone(st.items.get(key)):undefined;if(r.onsuccess)r.onsuccess();},0);
                return r;
              },
              getAll(){
                const r={};
                setTimeout(()=>{r.result=[...st.items.values()].map(v=>structuredClone(v));if(r.onsuccess)r.onsuccess();},0);
                return r;
              },
              count(){
                const r={};
                setTimeout(()=>{r.result=st.items.size;if(r.onsuccess)r.onsuccess();},0);
                return r;
              }
            };
          };
          return tx;
        }
      };
      const fake={
        open(){
          const r={result:db,error:null};
          setTimeout(()=>{
            if(!opened){opened=true;if(r.onupgradeneeded)r.onupgradeneeded();}
            setTimeout(()=>{if(r.onsuccess)r.onsuccess();},0);
          },0);
          return r;
        }
      };
      Object.defineProperty(window,'indexedDB',{configurable:true,value:fake});
      window.__qaStores=stores;
    }""")

def set_app(page, network):
    def route_handler(route):
        u=route.request.url; network.append(u)
        marker='floralab.test/floralab/'
        rel=u.split(marker,1)[-1].split('?',1)[0] if marker in u else ''
        if not rel: rel='index.html'
        f=PUB/rel
        if not f.exists() or not f.is_file(): f=PUB/'index.html'
        ct=mimetypes.guess_type(str(f))[0] or ('application/manifest+json' if f.suffix=='.webmanifest' else 'application/octet-stream')
        route.fulfill(status=200,body=f.read_bytes(),headers={'Content-Type':ct,'Cache-Control':'no-store'})
    page.route('https://floralab.test/floralab/**',route_handler)
    install_storage_mocks(page)
    html=(PUB/'index.html').read_text()
    html=html.replace('<head>','<head><base href="https://floralab.test/floralab/">')
    page.set_content(html,wait_until='load'); page.wait_for_timeout(700)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True); page.set_default_timeout(7000)
    errors=[]; network=[]
    page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
    set_app(page,network)
    ck('FloraLab' in page.title(),'title'); ck(page.locator('text=从一个想法').count()>0,'home hero'); ck(page.locator('.brand-mark').count()==1,'brand mark'); ck(overflow_ok(page),'home no overflow');
    ck(not any('/api/' in x for x in network),'no network API requests'); shot(page,'1.1-01-home-desktop.png')
    page.click('#newDesign'); ck(page.locator('text=新作品').count()>0,'create open'); shot(page,'1.1-02-create-desktop.png')
    page.click('#generate'); page.wait_for_selector('.project-title'); ck(page.locator('.tabs button').count()==6,'six project tabs'); ck(page.locator('.status-text').count()==1,'status visible'); ck(page.evaluate("localStorage.getItem('floralab-1.1')!==null"),'local save'); ck(overflow_ok(page),'work no overflow'); shot(page,'1.1-03-result-desktop.png')
    page.wait_for_timeout(500)
    idb_count=page.evaluate("window.__qaStores.projects?.items.size||0"); ck(idb_count>=1,'indexeddb project stored')
    # Recipe edit
    page.click('[data-tab="recipe"]'); page.wait_for_selector('.recipe-row'); first=page.locator('.recipe-row').first; old=float(first.locator('[data-qty]').input_value()); first.locator('[data-plus]').click(); page.wait_for_timeout(300); ck(float(page.locator('.recipe-row').first.locator('[data-qty]').input_value())==old+1,'recipe edit'); shot(page,'1.1-04-recipe-desktop.png')
    # Structure edit
    page.click('[data-tab="structure"]'); page.wait_for_selector('.blueprint-svg'); ck(page.locator('[data-view]').count()==5,'five views'); ck(page.locator('[data-node-field]').count()==6,'node fields'); count=page.locator('.structure-main [data-node]').count(); page.locator('.structure-main [data-node]').first.locator('.bp-hit').click(force=True); page.wait_for_timeout(100); page.click('[data-node-action="duplicate"]'); page.wait_for_timeout(300); ck(page.locator('.structure-main [data-node]').count()==count+1,'duplicate'); page.click('[data-node-action="delete"]'); page.wait_for_timeout(300); ck(page.locator('.structure-main [data-node]').count()==count,'delete'); ck(overflow_ok(page),'structure no overflow'); shot(page,'1.1-05-structure-desktop.png')
    # Build and feedback
    page.click('[data-tab="build"]'); page.wait_for_selector('.use-row'); page.locator('.use-row').first.locator('[data-use]').click(); page.wait_for_timeout(220); page.locator('.use-row').first.locator('[data-loss]').click(); page.wait_for_timeout(220); ck(page.locator('.build-nav button').count()==6,'build steps'); shot(page,'1.1-06-build-desktop.png')
    page.click('[data-tab="feedback"]'); page.fill('#actualMinutes','48'); page.fill('#actualIssues','右侧略重'); page.click('#saveFeedback'); page.wait_for_timeout(350); ck(page.locator('.feedback-summary').count()==1,'feedback saved')
    # Export
    with page.expect_download() as di: page.click('#exportPlan')
    out=QA/'exported-1.1.floralab'; di.value.save_as(out); data=json.loads(out.read_text()); ck(data.get('schema')=='floralab/1.0','export schema compatible'); ck(data.get('blueprint',{}).get('version')=='2.0','export blueprint 2')
    # Confirm storage has project and latest local state
    ck(page.evaluate("JSON.parse(localStorage.getItem('floralab-1.1')).plan.id.length>10"),'local restore payload valid'); ck(page.evaluate("window.__qaStores.projects.items.size>=1"),'project library payload valid')
    # Materials
    page.click('[data-go="materials"]'); page.fill('#materialSearch','绣球'); page.wait_for_timeout(300); ck(page.locator('.material-row',has_text='绣球').count()>=1,'material search'); ck(not any(('失败' in t or '没有' in t or '错误' in t) for t in page.locator('.toast').all_text_contents()),'no material error toast'); page.wait_for_timeout(2800); ck(page.locator('.toast').count()==0,'transient toasts cleared before screenshot'); shot(page,'1.1-07-library-desktop.png')
    page.click('#installApp'); page.wait_for_timeout(100); ck(page.locator('#installModal').count()==1,'install help available'); page.click('#closeInstall')
    # Mobile
    page.click('[data-go="result"]'); page.click('[data-tab="work"]'); page.set_viewport_size({'width':390,'height':844}); page.wait_for_timeout(160); ck(overflow_ok(page),'mobile work no overflow'); shot(page,'1.1-08-result-mobile.png',False)
    page.click('[data-tab="recipe"]'); ck(overflow_ok(page),'mobile recipe no overflow'); shot(page,'1.1-09-recipe-mobile.png',False)
    page.click('[data-tab="structure"]'); ck(overflow_ok(page),'mobile structure no overflow'); labels=page.locator('.structure-main .bp-label'); visible=sum(1 for i in range(labels.count()) if labels.nth(i).is_visible()); ck(visible<=1,'mobile labels decluttered'); shot(page,'1.1-10-structure-mobile.png',False)
    page.click('[data-tab="build"]'); ck(overflow_ok(page),'mobile build no overflow'); shot(page,'1.1-11-build-mobile.png',False)
    page.click('#navMore'); page.wait_for_timeout(80); ck(page.locator('#mobileMenu:not([hidden]) button').count()==3,'mobile menu complete'); ck(page.locator('#navMore').bounding_box()['height']>=40,'mobile menu target'); ck(min(page.locator('#mobileMenu button').nth(i).bounding_box()['height'] for i in range(page.locator('#mobileMenu button').count()))>=44,'mobile menu item targets'); shot(page,'1.1-12-mobile-menu.png',False); page.click('#navMore')
    page.click('[data-tab="recipe"]'); ck(page.locator('.qty-control button').first.bounding_box()['height']>=40,'mobile recipe touch target'); page.click('[data-tab="work"]'); ck(min(page.locator('.tabs button').nth(i).bounding_box()['height'] for i in range(page.locator('.tabs button').count()))>=40,'mobile tab targets')
    ratio=page.evaluate("""()=>{function L(c){const m=c.match(/\d+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4));return .2126*m[0]+.7152*m[1]+.0722*m[2]}const el=document.querySelector('.project-sub'),fg=getComputedStyle(el).color,bg=getComputedStyle(document.body).backgroundColor,a=L(fg),b=L(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}"""); ck(ratio>=4.5,'project sub contrast')
    tab_ratio=page.evaluate("""()=>{function L(c){const m=c.match(/\d+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4));return .2126*m[0]+.7152*m[1]+.0722*m[2]}const el=[...document.querySelectorAll('.tabs button')].find(x=>!x.classList.contains('active'))||document.querySelector('.tabs button'),fg=getComputedStyle(el).color,bg=getComputedStyle(document.body).backgroundColor,a=L(fg),b=L(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}"""); ck(tab_ratio>=4.5,'inactive tab contrast')
    kicker_ratio=page.evaluate("""()=>{function L(c){const m=c.match(/\d+/g).slice(0,3).map(Number).map(x=>x/255).map(x=>x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4));return .2126*m[0]+.7152*m[1]+.0722*m[2]}const el=document.querySelector('.kicker'),fg=getComputedStyle(el).color,bg=getComputedStyle(document.body).backgroundColor,a=L(fg),b=L(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}"""); ck(kicker_ratio>=4.5,'kicker contrast')
    ck(not any('/api/' in x for x in network),'still no network API requests'); ck(len(errors)==0,'no console errors: '+str(errors))
    # Fresh-device import in a second browser page with independent stores
    p2=browser.new_page(viewport={'width':390,'height':844},accept_downloads=True); n2=[]; set_app(p2,n2); p2.set_input_files('#importFile',str(out)); p2.wait_for_selector('.project-title'); ck(p2.locator('.project-title').count()==1,'fresh device import'); ck(overflow_ok(p2),'fresh import mobile no overflow'); p2.close()
    browser.close()

names=['1.1-01-home-desktop.png','1.1-02-create-desktop.png','1.1-03-result-desktop.png','1.1-04-recipe-desktop.png','1.1-05-structure-desktop.png','1.1-06-build-desktop.png','1.1-07-library-desktop.png','1.1-08-result-mobile.png','1.1-09-recipe-mobile.png','1.1-10-structure-mobile.png','1.1-11-build-mobile.png','1.1-12-mobile-menu.png']
thumbs=[]
for n in names:
    im=Image.open(QA/n).convert('RGB'); im.thumbnail((430,600)); c=Image.new('RGB',(450,640),'white'); c.paste(im,((450-im.width)//2,20)); ImageDraw.Draw(c).text((12,612),n,fill='black'); thumbs.append(c)
cols=4; rows=(len(thumbs)+cols-1)//cols; sheet=Image.new('RGB',(450*cols,640*rows),(238,236,231))
for i,im in enumerate(thumbs): sheet.paste(im,((i%cols)*450,(i//cols)*640))
sheet.save(QA/'1.1-acceptance-contact-sheet.jpg',quality=90)
(QA/'ui-1.1.json').write_text(json.dumps({'checks':len(checks),'items':checks,'consoleErrors':errors},ensure_ascii=False,indent=2))
print(f'ui-1.1: {len(checks)} checks passed')