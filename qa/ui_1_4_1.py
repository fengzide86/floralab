import json, mimetypes, shutil, os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
QA=ROOT/'qa'
QA.mkdir(exist_ok=True)
LIVE_URL=os.getenv('FLORALAB_BASE_URL','').strip()
checks=[]

def ck(cond,name):
    if not cond:
        raise AssertionError(name)
    checks.append(name)

def shot(page,name):
    if page.locator('.material-visual[data-visual-query]').count():
        try:
            page.wait_for_function("""()=>[...document.querySelectorAll('.material-visual[data-visual-query]')].filter(el=>{const r=el.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight;}).every(el=>['loaded','missing'].includes(el.dataset.visualState))""",timeout=15000)
        except Exception:
            pass
    page.screenshot(path=str(QA/name),full_page=False)

def overflow_ok(page):
    return page.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2')

def px(page,selector,prop='fontSize'):
    return float(page.evaluate("""([sel,prop])=>parseFloat(getComputedStyle(document.querySelector(sel))[prop])""",[selector,prop]))

def install_storage_mocks(page):
    page.evaluate("""()=>{
      const ls={_d:{},getItem(k){return Object.prototype.hasOwnProperty.call(this._d,k)?this._d[k]:null;},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];},clear(){this._d={};}};
      Object.defineProperty(window,'localStorage',{configurable:true,value:ls});
      const stores={};let opened=false;
      const db={objectStoreNames:{contains(n){return Object.prototype.hasOwnProperty.call(stores,n);}},createObjectStore(n,o={}){stores[n]={keyPath:o.keyPath||null,items:new Map()};return{};},close(){},transaction(name){const tx={oncomplete:null,onerror:null,error:null};tx.objectStore=function(n){const st=stores[n];return{put(v){const key=st.keyPath?v[st.keyPath]:v.key;st.items.set(key,structuredClone(v));setTimeout(()=>tx.oncomplete&&tx.oncomplete(),0);},get(key){const r={};setTimeout(()=>{r.result=st.items.has(key)?structuredClone(st.items.get(key)):undefined;r.onsuccess&&r.onsuccess();},0);return r;},getAll(){const r={};setTimeout(()=>{r.result=[...st.items.values()].map(v=>structuredClone(v));r.onsuccess&&r.onsuccess();},0);return r;},count(){const r={};setTimeout(()=>{r.result=st.items.size;r.onsuccess&&r.onsuccess();},0);return r;}}};return tx;}};
      Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){const r={result:db,error:null};setTimeout(()=>{if(!opened){opened=true;r.onupgradeneeded&&r.onupgradeneeded();}setTimeout(()=>r.onsuccess&&r.onsuccess(),0);},0);return r;}}});
      window.__qaStores=stores;
    }""")

def set_app(page,network,errors):
    page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
    if LIVE_URL:
        page.on('request',lambda r: network.append(r.url))
        last=None
        for _ in range(5):
            try:
                page.goto(LIVE_URL,wait_until='networkidle',timeout=25000)
                page.wait_for_selector('#newDesign',timeout=12000)
                return
            except Exception as e:
                last=e
                page.wait_for_timeout(2500)
        raise last
    def route_handler(route):
        u=route.request.url
        network.append(u)
        marker='floralab.test/floralab/'
        rel=u.split(marker,1)[-1].split('?',1)[0] if marker in u else ''
        if not rel:
            rel='index.html'
        f=PUB/rel
        if not f.exists() or not f.is_file():
            f=PUB/'index.html'
        ct=mimetypes.guess_type(str(f))[0] or ('application/manifest+json' if f.suffix=='.webmanifest' else 'application/octet-stream')
        route.fulfill(status=200,body=f.read_bytes(),headers={'Content-Type':ct,'Cache-Control':'no-store'})
    page.route('https://floralab.test/floralab/**',route_handler)
    install_storage_mocks(page)
    html=(PUB/'index.html').read_text()
    html=html.replace('<head>','<head><base href="https://floralab.test/floralab/">')
    page.set_content(html,wait_until='load')
    page.wait_for_timeout(700)

def generate_project(page):
    page.click('#newDesign')
    page.wait_for_selector('#generate')
    page.click('#generate')
    page.wait_for_selector('.project-title')
    page.wait_for_timeout(250)

def goto_tab(page,tab):
    page.click(f'[data-tab="{tab}"]')
    page.wait_for_timeout(180)

def wait_detail_visual(page):
    page.wait_for_function("""()=>{const img=document.querySelector('.material-detail-workspace .material-visual img');return !!(img&&img.complete&&img.naturalWidth>0&&img.naturalHeight>0)}""",timeout=5000)

with sync_playwright() as p:
    chrome=shutil.which('google-chrome') or shutil.which('google-chrome-stable') or shutil.which('chromium') or shutil.which('chromium-browser')
    if not chrome:
        raise RuntimeError('System Chrome/Chromium is required for FloraLab visual QA')
    browser=p.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox'])
    network=[];errors=[]
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1,accept_downloads=True)
    page.set_default_timeout(9000)
    set_app(page,network,errors)

    # D01 Home
    ck(page.locator('text=从一个想法').count()>0,'D01 home loaded')
    ck(page.locator('.hero-cover').get_attribute('src').endswith('assets/hero-sprout-identity.webp'),'D01 approved hero cover')
    ck(page.locator('.hero-cover').evaluate("e=>e.complete&&e.naturalWidth>=300&&e.naturalHeight>=380"),'D01 hero cover decodes')
    hero_box=page.locator('.hero-cover').bounding_box()
    ck(bool(hero_box) and 1.47<=hero_box['width']/hero_box['height']<=1.53,'D01 hero cover rendered 3:2')
    ck(page.locator('[data-go="render"]').count()>=1,'D01 Render workspace entry visible')
    page.locator('.nav-links [data-go="render"]').click();page.wait_for_selector('#renderIntroCreate')
    ck(page.locator('text=效果图工作区在作品里面').count()==1,'D01 Render entry explains project requirement')
    page.locator('#closeModal').click()
    ck(overflow_ok(page),'D01 no overflow')
    shot(page,'1.4.1-D01-home.png')

    # D02 New
    page.click('#newDesign');page.wait_for_selector('#generate')
    ck(px(page,'.form-label span')>=14,'D02 supporting text >=14')
    ck(overflow_ok(page),'D02 no overflow')
    shot(page,'1.4.1-D02-new.png')
    page.locator('#generate').scroll_into_view_if_needed();page.wait_for_timeout(100)
    shot(page,'1.4.1-D20-new-bottom.png')

    # D23-D25 Direction workspace (1.4.1)
    page.click('#generate');page.wait_for_timeout(1000)
    if page.locator('.project-title').count()==0:
        print('D23 console errors:',errors)
        print('D23 toasts:',page.locator('.toast').all_text_contents())
        shot(page,'1.4.1-D23-FAILED.png')
        raise AssertionError('D23 generate did not reach Direction workspace')
    page.wait_for_selector('.explore-locks')
    ck(page.locator('[data-tab="explore"].active').count()==1,'D23 new work opens Direction first')
    ck(page.locator('[data-explore-lock]').count()==8,'D23 eight lock controls')
    ck(page.locator('[data-variation]').count()==6,'D23 six controlled variations')
    ck(overflow_ok(page),'D23 Direction no overflow')
    shot(page,'1.4.1-D23-direction.png')
    page.locator('.explore-variations').scroll_into_view_if_needed();page.wait_for_timeout(100)
    ck(page.locator('[data-variation="rightRise"]').is_enabled(),'D24 right-rise variation available')
    shot(page,'1.4.1-D24-variations.png')
    page.click('[data-explore-lock="quantities"]');page.wait_for_timeout(100)
    ck(page.locator('[data-explore-lock="quantities"].active').count()==1,'D25 quantity lock persists')
    initial_branches=page.locator('.branch-card').count()
    page.click('[data-variation="rightRise"]')
    page.wait_for_function("(n)=>document.querySelectorAll('.branch-card').length>n",arg=initial_branches)
    page.wait_for_selector('.toast',state='detached',timeout=5000)
    ck(page.locator('.branch-card').count()>=2,'D25 variation forks instead of overwriting')
    ck(page.locator('.branch-card.active').get_by_text('右上延伸').count()>=1,'D25 branch label visible')
    if page.locator('[data-compare-branch]').count():
        page.locator('[data-compare-branch]').first.click();page.wait_for_selector('.branch-compare')
        ck(page.locator('.compare-grid article').count()==2,'D25 branch compare has two directions')
    page.locator('.branch-family').scroll_into_view_if_needed();page.wait_for_timeout(100)
    ck(overflow_ok(page),'D25 branch compare no overflow')
    shot(page,'1.4.1-D25-branch-compare.png')
    if page.locator('#closeBranchCompare').count():
        page.click('#closeBranchCompare');page.wait_for_timeout(80)

    # D03 Overview
    goto_tab(page,'work');page.wait_for_selector('.project-title')
    ck(px(page,'.project-title')>=40,'D03 overview title scale')
    page.locator('.nav-links [data-go="render"]').click();page.wait_for_selector('.render-layout')
    ck(page.locator('[data-tab="render"].active').count()==1,'D03 top Render entry opens workspace')
    goto_tab(page,'work')
    ck(overflow_ok(page),'D03 no overflow')
    shot(page,'1.4.1-D03-overview.png')
    page.locator('.next-link').scroll_into_view_if_needed();page.wait_for_timeout(100)
    shot(page,'1.4.1-D21-overview-bottom.png')

    # D04 Recipe + material link
    goto_tab(page,'recipe');page.wait_for_selector('.recipe-row')
    ck(page.locator('.recipe-material-link').count()>=1,'D04 Recipe material links')
    ck(px(page,'.recipe-name span')>=14,'D04 Recipe supporting text >=14')
    ck(overflow_ok(page),'D04 no overflow')
    shot(page,'1.4.1-D04-recipe.png')

    # D05 Structure
    goto_tab(page,'structure');page.wait_for_selector('.blueprint-svg')
    ck(page.locator('[data-view]').count()==5,'D05 five views')
    ck(px(page,'.node-info dl')>=14,'D05 inspector readable')
    ck(overflow_ok(page),'D05 no overflow')
    shot(page,'1.4.1-D05-structure.png')

    # D05R Render Handoff
    goto_tab(page,'render');page.wait_for_selector('.render-layout')
    ck(page.locator('.render-view-svg').count()==1,'D05R render view')
    ck(page.locator('[data-render-material]').count()>=1,'D05R locked materials')
    ck(page.locator('text=Recipe 数量锁定').count()>=1,'D05R quantity lock copy')
    ck(overflow_ok(page),'D05R no overflow')
    shot(page,'1.4.1-D05R-render.png')
    page.locator('.render-spec-panel').scroll_into_view_if_needed();page.wait_for_timeout(100)
    shot(page,'1.4.1-D22R-render-spec.png')

    # D06 Build
    goto_tab(page,'build');page.wait_for_selector('.build-step')
    ck(px(page,'.build-step>p')>=18,'D06 build instruction readable')
    ck(overflow_ok(page),'D06 no overflow')
    shot(page,'1.4.1-D06-build.png')

    # D14 Feedback
    goto_tab(page,'feedback');page.wait_for_selector('.feedback-form')
    ck(overflow_ok(page),'D14 feedback no overflow')
    shot(page,'1.4.1-D14-feedback.png')

    # D15 History
    goto_tab(page,'history');page.wait_for_selector('.history-list')
    ck(overflow_ok(page),'D15 history no overflow')
    shot(page,'1.4.1-D15-history.png')

    # D16 Install modal
    page.click('#installApp');page.wait_for_selector('#installModal')
    ck(page.locator('#installModal .modal').count()==1,'D16 install modal visible')
    shot(page,'1.4.1-D16-install.png')
    page.click('#closeInstall');page.wait_for_timeout(80)

    # D17 Creative Space modal
    page.click('#creativeSpace');page.wait_for_selector('#modal')
    ck(page.locator('#modal .modal').count()==1,'D17 creative-space modal visible')
    shot(page,'1.4.1-D17-creative-space.png')
    page.click('#closeModal');page.wait_for_timeout(80)

    # D07 Library home
    page.click('[data-go="materials"]');page.wait_for_selector('.library-shell');page.wait_for_timeout(180)
    ck(page.locator('.material-card').count()>0,'D07 library cards')
    ck(page.locator('#libraryResults').evaluate("e=>getComputedStyle(e).gridTemplateColumns.split(' ').length")>=3,'D07 three-column desktop')
    ck(px(page,'.material-card-meta')>=14,'D07 card metadata readable')
    ck(overflow_ok(page),'D07 no overflow')
    shot(page,'1.4.1-D07-library-home.png')

    # D08 Search
    page.fill('#materialSearch','紫');page.wait_for_timeout(220)
    ck(page.locator('.library-results-head small').count()==1,'D08 search state')
    ck(page.locator('.material-card').count()>0,'D08 search results')
    ck(overflow_ok(page),'D08 no overflow')
    shot(page,'1.4.1-D08-library-search.png')

    # D09 Filtered
    page.click('#resetLibrary');page.wait_for_timeout(120)
    page.click('[data-filter-group="role"][data-filter-value="线条"]');page.wait_for_timeout(150)
    ck(page.locator('[data-filter-group="role"][data-filter-value="线条"].active').count()==1,'D09 active filter')
    ck(page.locator('.material-card').count()>0,'D09 filtered results')
    shot(page,'1.4.1-D09-library-filter.png')

    # D10 Core detail
    page.click('#resetLibrary');page.wait_for_timeout(120)
    page.click('[data-material-detail="flower:hydrangea"]');page.wait_for_selector('.material-detail-layout');wait_detail_visual(page)
    ck(page.locator('.material-spec-grid').count()>=2,'D10 flower specs')
    ck(page.locator('.season-timeline').count()==1,'D10 season timeline')
    ck(page.locator('.material-trust').count()>=1,'D10 reality information block')
    ck(overflow_ok(page),'D10 no overflow')
    shot(page,'1.4.1-D10-core-detail.png')
    page.locator('.material-trust').last.scroll_into_view_if_needed();page.wait_for_timeout(100)
    shot(page,'1.4.1-D18-core-reality.png')

    # D11 Reference detail
    page.click('[data-library-back]');page.wait_for_selector('.library-shell')
    page.click('.library-more summary');page.wait_for_timeout(80)
    page.click('[data-filter-group="making"][data-filter-value="reference"]');page.wait_for_timeout(120)
    page.locator('.material-card').first.click();page.wait_for_selector('.material-detail-layout');wait_detail_visual(page)
    ck(page.locator('.material-trust.reference').count()==1,'D11 reference warning')
    shot(page,'1.4.1-D11-reference-detail.png')

    # D12 Creative detail
    page.click('[data-library-back]');page.wait_for_selector('.library-shell')
    page.click('[data-library-kind="creative"]');page.wait_for_timeout(120)
    page.click('[data-material-detail="creative:plush"]');page.wait_for_selector('.creative-detail');wait_detail_visual(page)
    ck(page.locator('.creative-fix-list').count()==1,'D12 creative fixing guidance')
    ck(overflow_ok(page),'D12 no overflow')
    shot(page,'1.4.1-D12-creative-detail.png')
    page.click('[data-library-back]');page.wait_for_selector('.library-shell')
    page.click('[data-material-detail="creative:chocolate"]');page.wait_for_selector('.creative-detail');wait_detail_visual(page)
    ck(page.locator('.material-trust.safety').count()==1,'D19 creative food warning')
    page.locator('.material-trust.safety').scroll_into_view_if_needed();page.wait_for_timeout(100)
    shot(page,'1.4.1-D19-creative-safety.png')

    # D13 Empty
    page.click('[data-library-back]');page.wait_for_selector('.library-shell')
    page.fill('#materialSearch','no-such-material-zzzz');page.wait_for_timeout(160)
    ck(page.locator('.library-empty').count()==1,'D13 empty state')
    shot(page,'1.4.1-D13-empty.png')

    # Exhaustive material-surface audit: render every material detail and reject internal tokens.
    surface_audit=page.evaluate("""async()=>{
      const catalog=await window.FloraLabRuntime.getCatalog();
      const blocked=['block_cat','very_high','conditional','excellent','unknown','woody','flexible','strong','soft','undefined','null','NaN','[object Object]','true','false'];
      const findings=[];
      let audited=0;
      const scan=(kind,id)=>{
        const key=kind+':'+id;
        const btn=[...document.querySelectorAll('[data-material-detail]')].find(x=>x.dataset.materialDetail===key);
        if(!btn){findings.push(key+':missing-card');return;}
        btn.click();
        audited++;
        const root=document.querySelector('.material-detail-workspace');
        const text=(root?.innerText||'');
        const normalized=' '+text.replace(/\\s+/g,' ')+' ';
        for(const token of blocked){
          if(token==='[object Object]' ? text.includes(token) : normalized.toLowerCase().includes(' '+token.toLowerCase()+' ')) findings.push(key+':'+token);
        }
        if(text.includes('\\\\n'))findings.push(key+':literal-backslash-n');
        const back=document.querySelector('[data-library-back]');
        if(!back){findings.push(key+':missing-back');return;}
        back.click();
      };
      document.querySelector('[data-library-kind="flower"]')?.click();
      for(const m of catalog.flowers||[])scan('flower',m.id);
      document.querySelector('[data-library-kind="creative"]')?.click();
      for(const m of catalog.creative||[])scan('creative',m.id);
      return {audited,findings};
    }""")
    ck(surface_audit['audited']==130,'all 130 material details rendered in surface audit')
    ck(len(surface_audit['findings'])==0,'no internal tokens in rendered material details: '+str(surface_audit['findings'][:20]))

    # Mobile fresh page
    mob=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=1,accept_downloads=True)
    mob.set_default_timeout(9000);mnet=[];merrors=[];set_app(mob,mnet,merrors)

    # M01
    ck(mob.locator('.hero-cover').get_attribute('src').endswith('assets/hero-sprout-identity.webp'),'M01 approved hero cover')
    ck(mob.locator('.hero-cover').evaluate("e=>e.complete&&e.naturalWidth>=300&&e.naturalHeight>=380"),'M01 hero cover decodes')
    hero_box=mob.locator('.hero-cover').bounding_box()
    ck(bool(hero_box) and 1.47<=hero_box['width']/hero_box['height']<=1.53,'M01 hero cover rendered 3:2')
    mob.click('#navMore');mob.wait_for_timeout(80)
    ck(mob.locator('#mobileMenu [data-go="render"]').count()==1,'M01 mobile Render entry visible')
    mob.click('#navMore');mob.wait_for_timeout(80)
    ck(overflow_ok(mob),'M01 no overflow');shot(mob,'1.4.1-M01-home.png')
    # M02
    mob.click('#newDesign');mob.wait_for_selector('#generate')
    ck(px(mob,'.form-label span')>=14,'M02 form support readable');shot(mob,'1.4.1-M02-new.png')
    mob.locator('#generate').scroll_into_view_if_needed();mob.wait_for_timeout(100)
    shot(mob,'1.4.1-M20-new-bottom.png')
    # M25-M27 Direction workspace (1.4.1)
    mob.click('#generate');mob.wait_for_selector('.project-title');mob.wait_for_selector('.explore-locks');mob.wait_for_timeout(200)
    ck(mob.locator('[data-tab="explore"].active').count()==1,'M25 new work opens Direction first')
    ck(mob.locator('[data-explore-lock]').count()==8,'M25 eight lock controls')
    ck(mob.locator('[data-variation]').count()==6,'M25 six controlled variations')
    ck(overflow_ok(mob),'M25 Direction no overflow')
    shot(mob,'1.4.1-M25-direction.png')
    mob.locator('.explore-variations').scroll_into_view_if_needed();mob.wait_for_timeout(100)
    ck(mob.locator('[data-variation="rightRise"]').is_enabled(),'M26 right-rise variation available')
    shot(mob,'1.4.1-M26-variations.png')
    mob.click('[data-explore-lock="quantities"]');mob.wait_for_timeout(100)
    ck(mob.locator('[data-explore-lock="quantities"].active').count()==1,'M27 quantity lock persists')
    initial_branches=mob.locator('.branch-card').count()
    mob.click('[data-variation="rightRise"]')
    mob.wait_for_function("(n)=>document.querySelectorAll('.branch-card').length>n",arg=initial_branches)
    mob.wait_for_selector('.toast',state='detached',timeout=5000)
    ck(mob.locator('.branch-card').count()>=2,'M27 variation forks instead of overwriting')
    if mob.locator('[data-compare-branch]').count():
        mob.locator('[data-compare-branch]').first.click();mob.wait_for_selector('.branch-compare')
        ck(mob.locator('.compare-grid article').count()==2,'M27 branch compare has two directions')
    mob.locator('.branch-family').scroll_into_view_if_needed();mob.wait_for_timeout(100)
    ck(overflow_ok(mob),'M27 branch compare no overflow')
    shot(mob,'1.4.1-M27-branch-compare.png')
    if mob.locator('#closeBranchCompare').count():
        mob.click('#closeBranchCompare');mob.wait_for_timeout(80)

    # M03 Overview
    goto_tab(mob,'work');mob.wait_for_selector('.project-title')
    ck(overflow_ok(mob),'M03 no overflow');shot(mob,'1.4.1-M03-overview.png')
    mob.locator('.next-link').scroll_into_view_if_needed();mob.wait_for_timeout(100)
    shot(mob,'1.4.1-M21-overview-bottom.png')
    # M04
    goto_tab(mob,'recipe');mob.wait_for_selector('.recipe-row')
    ck(mob.locator('.qty-control button').first.bounding_box()['height']>=40,'M04 Recipe target')
    ck(mob.locator('.recipe-material-link').first.bounding_box()['height']>=40,'M04 material link target')
    ck(overflow_ok(mob),'M04 no overflow');shot(mob,'1.4.1-M04-recipe.png')
    # M05
    goto_tab(mob,'structure');mob.wait_for_selector('.blueprint-svg')
    ck(overflow_ok(mob),'M05 no overflow');shot(mob,'1.4.1-M05-structure.png')
    mob.locator('.node-info').scroll_into_view_if_needed();mob.wait_for_timeout(100)
    shot(mob,'1.4.1-M22-structure-inspector.png')
    # M05R Render Handoff
    goto_tab(mob,'render');mob.wait_for_selector('.render-layout')
    ck(mob.locator('.render-view-svg').count()==1,'M05R render view')
    ck(mob.locator('#copyRenderHandoff').bounding_box()['height']>=40,'M05R copy target')
    ck(overflow_ok(mob),'M05R no overflow')
    shot(mob,'1.4.1-M05R-render.png')
    mob.locator('.render-spec-panel').scroll_into_view_if_needed();mob.wait_for_timeout(100)
    shot(mob,'1.4.1-M24-render-spec.png')
    # M06
    goto_tab(mob,'build');mob.wait_for_selector('.build-step')
    ck(mob.locator('.use-row button').first.bounding_box()['height']>=40,'M06 build target')
    shot(mob,'1.4.1-M06-build.png')
    mob.locator('.step-actions').scroll_into_view_if_needed();mob.wait_for_timeout(100)
    shot(mob,'1.4.1-M23-build-actions.png')

    # M15 Feedback
    goto_tab(mob,'feedback');mob.wait_for_selector('.feedback-form')
    ck(overflow_ok(mob),'M15 feedback no overflow')
    shot(mob,'1.4.1-M15-feedback.png')
    mob.locator('#saveFeedback').scroll_into_view_if_needed();mob.wait_for_timeout(100)
    shot(mob,'1.4.1-M19-feedback-bottom.png')

    # M16 History
    goto_tab(mob,'history');mob.wait_for_selector('.history-list')
    ck(overflow_ok(mob),'M16 history no overflow')
    shot(mob,'1.4.1-M16-history.png')

    # M07
    mob.click('#navMore');mob.wait_for_timeout(80)
    ck(mob.locator('#mobileMenu:not([hidden])').count()==1,'M07 menu visible')
    ck(min(mob.locator('#mobileMenu button').nth(i).bounding_box()['height'] for i in range(mob.locator('#mobileMenu button').count()))>=44,'M07 menu targets')
    ck(mob.locator('#mobileMenu [data-go="render"]').count()==1,'M07 Render entry in mobile menu')
    shot(mob,'1.4.1-M07-menu.png')
    mob.click('#mobileMenu [data-go="render"]');mob.wait_for_selector('.render-layout')
    ck(mob.locator('[data-tab="render"].active').count()==1,'M07 mobile Render entry opens workspace')

    # M17 Install modal
    if mob.locator('#mobileMenu[hidden]').count():
        mob.click('#navMore');mob.wait_for_timeout(80)
    mob.click('#installAppMobile');mob.wait_for_selector('#installModal')
    ck(mob.locator('#installModal .modal').count()==1,'M17 install modal visible')
    shot(mob,'1.4.1-M17-install.png')
    mob.click('#closeInstall');mob.wait_for_timeout(80)
    if mob.locator('#mobileMenu:not([hidden])').count():
        mob.click('#navMore');mob.wait_for_timeout(80)

    # M18 Creative Space modal
    mob.click('#creativeSpace');mob.wait_for_selector('#modal')
    ck(mob.locator('#modal .modal').count()==1,'M18 creative-space modal visible')
    shot(mob,'1.4.1-M18-creative-space.png')
    mob.click('#closeModal');mob.wait_for_timeout(80)

    # M08
    mob.click('#navMore');mob.wait_for_timeout(80)
    mob.click('#mobileMenu [data-go="materials"]');mob.wait_for_selector('.library-shell')
    cols=mob.locator('#libraryResults').evaluate("e=>getComputedStyle(e).gridTemplateColumns.split(' ').length")
    ck(cols==1,'M08 one-column mobile library')
    ck(px(mob,'#materialSearch')>=16,'M08 search input >=16')
    ck(overflow_ok(mob),'M08 no overflow');shot(mob,'1.4.1-M08-library-home.png')
    # M09
    mob.fill('#materialSearch','绣球');mob.wait_for_timeout(150)
    ck(mob.locator('[data-material-detail="flower:hydrangea"]').count()==1,'M09 hydrangea search')
    shot(mob,'1.4.1-M09-library-search.png')
    # M10
    mob.click('#resetLibrary');mob.wait_for_timeout(100)
    mob.click('[data-filter-group="color"][data-filter-value="紫"]');mob.wait_for_timeout(120)
    ck(mob.locator('[data-filter-group="color"][data-filter-value="紫"].active').count()==1,'M10 filter active')
    ck(mob.locator('[data-filter-group="color"][data-filter-value="紫"]').bounding_box()['height']>=40,'M10 filter target')
    shot(mob,'1.4.1-M10-filter.png')
    # M11
    mob.click('[data-material-detail="flower:hydrangea"]');mob.wait_for_selector('.material-detail-layout');wait_detail_visual(mob)
    ck(px(mob,'.material-detail-title h1')>=36,'M11 detail title')
    ck(overflow_ok(mob),'M11 no overflow');shot(mob,'1.4.1-M11-core-detail.png')
    # M12 safety
    mob.click('[data-library-back]');mob.wait_for_selector('.library-shell')
    if mob.locator('#resetLibrary').count():
        mob.click('#resetLibrary');mob.wait_for_timeout(80)
    mob.fill('#materialSearch','百合');mob.wait_for_timeout(120)
    mob.click('[data-material-detail="flower:lily"]');mob.wait_for_selector('.material-detail-layout');wait_detail_visual(mob)
    ck(mob.locator('.material-trust.safety').count()==1,'M12 pet safety warning')
    mob.locator('.material-trust.safety').scroll_into_view_if_needed();mob.wait_for_timeout(100)
    shot(mob,'1.4.1-M12-safety-detail.png')
    # M13 creative
    mob.click('[data-library-back]');mob.wait_for_selector('.library-shell')
    mob.click('[data-library-kind="creative"]');mob.wait_for_timeout(100)
    mob.click('[data-material-detail="creative:chocolate"]');mob.wait_for_selector('.creative-detail');wait_detail_visual(mob)
    ck(mob.locator('.material-trust.safety').count()==1,'M13 food separation warning')
    mob.locator('.material-trust.safety').scroll_into_view_if_needed();mob.wait_for_timeout(100)
    shot(mob,'1.4.1-M13-creative-detail.png')
    # M14 empty/long state
    mob.click('[data-library-back]');mob.wait_for_selector('.library-shell')
    mob.fill('#materialSearch','this-will-never-match-material');mob.wait_for_timeout(100)
    ck(mob.locator('.library-empty').count()==1,'M14 empty')
    ck(overflow_ok(mob),'M14 no overflow');shot(mob,'1.4.1-M14-empty.png')

    ck(not any('/api/' in x for x in network+mnet),'no HTTP API requests')
    ck(len(errors)==0,'desktop console errors: '+str(errors))
    ck(len(merrors)==0,'mobile console errors: '+str(merrors))
    browser.close()

report={'version':'1.4.1','mode':'online' if LIVE_URL else 'build','base_url':LIVE_URL or 'in-memory-build','checks':len(checks),'items':checks,'screenshots':54,'desktop':26,'mobile':28,'note':'Screenshots are primary page-by-page visual acceptance inputs. Contact sheet is intentionally not generated by this gate.'}
(QA/'ui-1.4.1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print("ui-1.4.1 (%s): %d checks passed; 54 page screenshots written" % ("online" if LIVE_URL else "build",len(checks)))
