"""Real-browser regressions for stale-tab writes and the finished-work form."""
import atexit
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.getenv('FLORALAB_BASE_URL', 'http://127.0.0.1:4173/floralab/')
OUT = Path(os.getenv('FLORALAB_RELIABILITY_QA_DIR', str(ROOT / 'qa/reliability-acceptance')))
OUT.mkdir(parents=True, exist_ok=True)
checks = []
errors = []


def check(value, label):
    assert value, label
    checks.append(label)


def current(page):
    return page.evaluate("JSON.parse(localStorage.getItem('floralab-studio-state')).plan")


def saved(page, project_id):
    return page.evaluate("async id => (await Storage.idbGet('projects',id)).state.plan", project_id)


def start(page):
    page.goto(URL, wait_until='networkidle')
    page.locator('#newDesign').wait_for()


def confirm(page):
    page.locator('#dialogConfirm').click()
    page.locator('dialog').wait_for(state='detached')


if not os.getenv('FLORALAB_BASE_URL'):
    try:
        with socket.create_connection(('127.0.0.1', 4173), timeout=1):
            pass
    except OSError:
        server = subprocess.Popen([shutil.which('node'), 'scripts/static-server.js'], cwd=ROOT, stdout=subprocess.DEVNULL)
        atexit.register(server.terminate)
        time.sleep(1)

with sync_playwright() as pw:
    executable = os.getenv('FLORALAB_BROWSER') or shutil.which('google-chrome') or shutil.which('chromium') or r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
    browser = pw.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
    for label, width, height in [('D', 1440, 1000), ('M', 390, 844)]:
        ctx = browser.new_context(viewport={'width': width, 'height': height}, accept_downloads=True)
        a = ctx.new_page()
        a.set_default_timeout(10000)
        a.set_default_navigation_timeout(60000)
        a.on('pageerror', lambda error: errors.append(str(error)))
        start(a)
        a.locator('#newDesign').click()
        a.locator('#idea').fill('白绿桌花，自然有空隙')
        a.locator('#generate').click()
        a.locator('[data-group="prepare"]').click()
        a.locator('.recipe-row').first.wait_for()
        original = current(a)
        project_id = original['id']
        quantity = original['recipe'][0]['quantity']

        b = ctx.new_page()
        b.set_default_timeout(10000)
        b.set_default_navigation_timeout(60000)
        b.on('pageerror', lambda error: errors.append(str(error)))
        start(b)
        b.locator('[data-open-project]').first.click()
        b.locator('[data-group="prepare"]').click()
        b.locator('.recipe-row').first.wait_for()
        a.locator('.recipe-row [data-plus]').first.click()
        a.wait_for_function("q => JSON.parse(localStorage.getItem('floralab-studio-state')).plan.recipe[0].quantity===q", arg=quantity+1)
        b.locator('[data-group="ideas"]').click()
        b.locator('[data-select-making]').wait_for()
        b.wait_for_timeout(100)
        check(saved(b, project_id)['recipe'][0]['quantity'] == quantity+1, label+' stale-tab navigation preserves latest quantity')

        b.locator('#renameProject').click()
        b.locator('#renameTitle').fill('另一页尚未保存的名字')
        b.locator('#dialogConfirm').click()
        b.locator('.dialog-error').filter(has_text='另一个页面更新').wait_for()
        check(saved(b, project_id)['title'] == original['title'], label+' stale-tab rename rejected without overwrite')
        check(current(b)['recipe'][0]['quantity'] == quantity+1, label+' conflict does not corrupt localStorage mirror')
        check(b.locator('#renameTitle').input_value() == '另一页尚未保存的名字', label+' conflict retains form input')
        b.screenshot(path=str(OUT/(label+'01-save-conflict.png')))
        b.locator('dialog .dialog-actions .secondary').click()
        with b.expect_download() as download:
            b.locator('#exportPlan').click()
        exported = OUT/(label+'-unsaved-conflict.floralab')
        download.value.save_as(str(exported))
        check(json.loads(exported.read_text(encoding='utf-8'))['plan']['title'] == '另一页尚未保存的名字', label+' conflict candidate can be exported')
        b.reload(wait_until='networkidle')
        # Navigation restoration may reopen the workspace directly.
        if b.locator('#newDesign').count():
            b.locator('[data-open-project]').first.click()
        b.locator('#renameProject').click()
        b.locator('#renameTitle').fill('重新打开后的作品')
        confirm(b)
        check(saved(b, project_id)['title'] == '重新打开后的作品', label+' explicit reopen reads latest baseline')

        b.locator('[data-group="record"]').click()
        b.locator('#actualDifficulty').select_option('中等')
        b.locator('#actualMinutes').fill('45')
        b.locator('#actualIssues').fill('右侧容易下坠')
        b.locator('#actualNotes').fill('第一次制作，下次把右侧做高一点')
        b.locator('[data-workflow-stage="finished"]').click()
        confirm(b)
        finished = saved(b, project_id)
        check(finished['workflow']['stage'] == 'finished', label+' mark finished saves stage')
        check(finished['resultFeedback']['minutes'] == 45 and finished['resultFeedback']['actual_difficulty'] == '中等', label+' mark finished saves difficulty and minutes')
        check(finished['resultFeedback']['issues'] == ['右侧容易下坠'] and finished['resultFeedback']['notes'] == '第一次制作，下次把右侧做高一点', label+' mark finished saves feedback text')
        check(b.locator('#actualNotes').input_value() == finished['resultFeedback']['notes'], label+' finished form survives rerender')
        b.screenshot(path=str(OUT/(label+'02-finished-feedback.png')))

        # Exercise the persistence boundary directly in the same real IndexedDB.
        extra = b.evaluate("""async () => {
          const checks=[],assert=(ok,label)=>{if(!ok)throw new Error(label);checks.push(label)};
          const state={plan:null,form:{},mode:'floral',tab:'work',projects:[]};
          const store=FloraLabStorage.create({state,cleanTitle:String});await store.load();
          const id=state.plan.id,base=JSON.parse(JSON.stringify(state.plan));
          await Promise.all([store.commitPlan({...base,title:'队列一'}),store.commitPlan({...base,title:'队列二'})]);
          assert((await store.idbGet('projects',id)).state.plan.title==='队列二','same-tab queued commits remain usable');
          const old=(await store.revisions(id)).find(x=>x.state.plan.title==='队列一');
          await store.restoreBackup(old);assert(state.plan.title==='队列一','snapshot restore retains current version baseline');
          const before=JSON.stringify(await store.idbGet('projects',id));
          await store.setLocation({projectId:id,tab:'history'});
          assert(JSON.stringify(await store.idbGet('projects',id))===before,'location update does not rewrite project or timestamp');
          const previous=state.plan;assert(await store.openProject(id,{isCurrent:()=>false})===null&&state.plan===previous,'cancelled navigation does not adopt project');
          await store.openProject(id);assert(state.tab==='history','reopening resumes separate location metadata');
          const independent={...base,id:crypto.randomUUID(),title:'独立导入副本'};
          await store.commitPlan(independent);assert(state.plan.id===independent.id,'new project commit remains usable');
          const legacy={plan:{...base,id:crypto.randomUUID(),title:'旧版仅本机备份'},form:{idea:'白绿桌花'},mode:'floral',updatedAt:new Date(Date.now()+1000).toISOString()};
          localStorage.setItem(store.keys.state,JSON.stringify(legacy));
          const legacyState={plan:null,form:{},projects:[]},legacyStore=FloraLabStorage.create({state:legacyState,cleanTitle:String});await legacyStore.load();
          assert((await legacyStore.openProject(legacy.plan.id)).title===legacy.plan.title,'legacy localStorage-only project can open');
          await legacyStore.commitPlan(legacyState.plan);assert((await legacyStore.idbGet('projects',legacy.plan.id)).state.plan.id===legacy.plan.id,'legacy localStorage-only project can migrate to IndexedDB');
          return checks;
        }""")
        checks.extend(label+' '+entry for entry in extra)
        check(b.evaluate('document.documentElement.scrollWidth<=innerWidth+2'), label+' no horizontal overflow')
        ctx.close()
    browser.close()

check(not errors, 'no unhandled browser errors')
(OUT/'reliability.json').write_text(json.dumps({'url': URL, 'checks': checks, 'errors': errors}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'reliability_checks': len(checks), 'errors': errors, 'output': str(OUT)}, ensure_ascii=False))
