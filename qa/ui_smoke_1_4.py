import json, mimetypes, shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
OUT=ROOT/'qa'/'targeted'
OUT.mkdir(parents=True,exist_ok=True)
checks=[]

def ck(cond,name):
    if not cond:
        raise AssertionError(name)
    checks.append(name)

def overflow_ok(page):
    return page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2')

def shot(page,name):
    page.screenshot(path=str(OUT/name),full_page=False)

def install_storage_mocks(page):
    page.evaluate("""()=>{
      const ls={_d:{},getItem(k){return Object.prototype.hasOwnProperty.call(this._d,k)?this._d[k]:null;},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];},clear(){this._d={};}};
      Object.defineProperty(window,'localStorage',{configurable:true,value:ls});
      const stores={};let opened=false;
      const db={
        objectStoreNames:{contains(n){return Object.prototype.hasOwnProperty.call(stores,n);}},
        createObjectStore(n,o={}){stores[n]={keyPath:o.keyPath||null,items:new Map()};return{};},
        close(){},
        transaction(name){
          const tx={oncomplete:null,onerror:null,error:null};
          tx.objectStore=function(n){
            const st=stores[n];
            return{
              put(v){const key=st.keyPath?v[st.keyPath]:v.key;st.items.set(key,structuredClone(v));setTimeout(()=>tx.oncomplete&&tx.oncomplete(),0);},
              get(key){const r={};setTimeout(()=>{r.result=st.items.has(key)?structuredClone(st.items.get(key)):undefined;r.onsuccess&&r.onsuccess();},0);return r;},
              getAll(){const r={};setTimeout(()=>{r.result=[...st.items.values()].map(v=>structuredClone(v));r.onsuccess&&r.onsuccess();},0);return r;}
            };
          };
          return tx;
        }
      };
      Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){
        const r={result:db,error:null};
        setTimeout(()=>{if(!opened){opened=true;r.onupgradeneeded&&r.onupgradeneeded();}setTimeout(()=>r.onsuccess&&r.onsuccess(),0);},0);
        return r;
      }}});
    }""")

def mount(page,errors):
    def route_handler(route):
        u=route.request.url
        marker='floralab.test/floralab/'
        rel=u.split(marker,1)[-1].split('?',1)[0] if marker in u else ''
        if not rel:
            rel='index.html'
        f=PUB/rel
        if not f.exists() or not f.is_file():
            f=PUB/'index.html'
        ct=mimetypes.guess_type(str(f))[0] or ('application/manifest+json' if f.suffix=='.webmanifest' else 'application/octet-stream')
        route.fulfill(status=200,body=f.read_bytes(),headers={'Content-Type':ct,'Cache-Control':'no-store'})
    page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
    page.route('https://floralab.test/floralab/**',route_handler)
    install_storage_mocks(page)
    html=(PUB/'index.html').read_text()
    html=html.replace('<head>','<head><base href="https://floralab.test/floralab/">')
    page.set_content(html,wait_until='load')
    page.wait_for_selector('#newDesign')
    page.wait_for_timeout(250)

def generate_project(page):
    page.click('#newDesign')
    page.wait_for_selector('#generate')
    page.click('#generate')
    page.wait_for_selector('.project-title')
    page.wait_for_timeout(150)

with sync_playwright() as p:
    chrome=shutil.which('google-chrome') or shutil.which('google-chrome-stable') or shutil.which('chromium') or shutil.which('chromium-browser')
    if not chrome:
        raise RuntimeError('System Chrome/Chromium is required for FloraLab targeted UI smoke')
    browser=p.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])

    # Desktop: home -> empty Render explanation -> create -> direct Render workspace.
    errors=[]
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.set_default_timeout(7000)
    mount(page,errors)
    ck(page.locator('text=从一个想法').count()>0,'desktop home renders')
    ck(page.locator('.hero-cover').evaluate("e=>e.complete&&e.naturalWidth>=300&&e.naturalHeight>=380"),'desktop hero cover decodes')
    ck(page.locator('.nav-links [data-go="render"]').count()==1,'desktop Render entry exists')
    page.locator('.nav-links [data-go="render"]').click()
    page.wait_for_selector('#renderIntroCreate')
    ck(page.locator('text=效果图工作区在作品里面').count()==1,'desktop empty Render state explains dependency')
    page.click('#closeModal')
    generate_project(page)
    ck(page.locator('.project-title').count()==1,'desktop project generates')
    page.locator('.nav-links [data-go="render"]').click()
    page.wait_for_selector('.render-layout')
    ck(page.locator('[data-tab="render"].active').count()==1,'desktop top Render entry opens workspace')
    page.click('[data-tab="explore"]')
    page.wait_for_selector('.explore-variations')
    ck(page.locator('[data-variation]').count()==6,'desktop six controlled variations visible')
    ck(page.locator('[data-explore-lock="quantities"]').count()==1,'desktop quantity lock visible')
    page.click('[data-explore-lock="quantities"]')
    page.wait_for_timeout(120)
    ck(page.locator('[data-explore-lock="quantities"].active').count()==1,'desktop quantity lock persists')
    initial_branches=page.locator('.branch-card').count()
    page.click('[data-variation="rightRise"]')
    page.wait_for_function("(n)=>document.querySelectorAll('.branch-card').length>n",arg=initial_branches)
    ck(page.locator('.branch-card').count()>=2,'desktop variation creates branch without overwriting root')
    ck(page.locator('.branch-card.active').get_by_text('右上延伸').count()>=1,'desktop new direction is labeled')
    ck(overflow_ok(page),'desktop Direction workspace has no overflow')
    shot(page,'desktop-direction.png')
    page.click('[data-tab="render"]')
    page.wait_for_selector('.render-layout')
    ck(page.locator('text=Locked Facts').count()>=1,'desktop Render facts visible')
    ck(overflow_ok(page),'desktop no horizontal overflow')
    shot(page,'desktop-render.png')
    ck(not errors,'desktop has no console errors')
    page.close()

    # Mobile: menu -> Render entry -> create -> menu -> direct Render workspace.
    errors=[]
    mob=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1)
    mob.set_default_timeout(7000)
    mount(mob,errors)
    ck(mob.locator('.hero-cover').evaluate("e=>e.complete&&e.naturalWidth>=300&&e.naturalHeight>=380"),'mobile hero cover decodes')
    mob.click('#navMore')
    mob.wait_for_timeout(80)
    ck(mob.locator('#mobileMenu [data-go="render"]').count()==1,'mobile Render entry exists')
    mob.locator('#mobileMenu [data-go="render"]').click()
    mob.wait_for_selector('#renderIntroCreate')
    ck(mob.locator('text=效果图工作区在作品里面').count()==1,'mobile empty Render state explains dependency')
    mob.click('#closeModal')
    generate_project(mob)
    mob.click('#navMore')
    mob.wait_for_timeout(80)
    mob.locator('#mobileMenu [data-go="render"]').click()
    mob.wait_for_selector('.render-layout')
    ck(mob.locator('[data-tab="render"].active').count()==1,'mobile Render entry opens workspace')
    mob.click('[data-tab="explore"]')
    mob.wait_for_selector('.explore-variations')
    ck(mob.locator('[data-variation]').count()==6,'mobile controlled variations visible')
    ck(mob.locator('[data-explore-lock]').count()==8,'mobile lock controls visible')
    ck(overflow_ok(mob),'mobile Direction workspace has no overflow')
    shot(mob,'mobile-direction.png')
    mob.click('[data-tab="render"]')
    mob.wait_for_selector('.render-layout')
    ck(overflow_ok(mob),'mobile no horizontal overflow')
    shot(mob,'mobile-render.png')
    ck(not errors,'mobile has no console errors')
    mob.close()
    browser.close()

result={'checks':checks,'count':len(checks)}
(OUT/'ui-smoke-1.4.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(f"ui-smoke-1.4: {len(checks)} checks passed; 4 screenshots written")
