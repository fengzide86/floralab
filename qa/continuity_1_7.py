"""Real browser checks for unfinished drafts, reloads and Back/Forward navigation.

Each desktop/mobile context starts empty. It never reads a user's browser profile.
"""
import atexit, json, os, shutil, socket, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = os.getenv('FLORALAB_BASE_URL', 'http://127.0.0.1:4173/floralab/')
OUT = Path(os.getenv('FLORALAB_CONTINUITY_QA_DIR', str(ROOT/'qa/continuity-acceptance')))
OUT.mkdir(parents=True, exist_ok=True)
VERSION = json.loads((ROOT/'package.json').read_text(encoding='utf-8'))['version']
checks, shots, errors = [], [], []

if not os.getenv('FLORALAB_BASE_URL'):
    try:
        with socket.create_connection(('127.0.0.1', 4173), timeout=1): pass
    except OSError:
        server = subprocess.Popen([shutil.which('node'), 'scripts/static-server.js'], cwd=ROOT, stdout=subprocess.DEVNULL)
        atexit.register(server.terminate)
        time.sleep(1)


def ck(value, label):
    assert value, label
    checks.append(label)


def shot(page, label):
    page.wait_for_timeout(200)
    ck(page.evaluate('document.documentElement.scrollWidth<=innerWidth+2'), label+' no overflow')
    page.screenshot(path=str(OUT/(label+'.png')))
    shots.append(label)


def home(page):
    page.locator('[data-go="home"]').click()
    page.locator('#newDesign').wait_for()


def details(page):
    for selector in ['#customize', '.reality-constraints']:
        item = page.locator(selector)
        if item.get_attribute('open') is None: item.locator('summary').click()


def assert_form(page, expected, label):
    for field, value in expected.items():
        ck(page.locator('#'+field).input_value() == value, label+' restores '+field)
    for selector in ['[data-type="桌花"]', '[data-color="白色"]', '[data-color="绿色"]', '[data-style="自然"]']:
        ck('active' in (page.locator(selector).get_attribute('class') or ''), label+' restores choice '+selector)


def active_tab(page, project, tab):
    page.wait_for_function('(tab)=>document.querySelector(`[data-tab="${tab}"]`)?.classList.contains("active")', arg=tab)
    page.wait_for_url('**/#/project/'+project+'/'+tab)


def plan(page):
    return page.evaluate("JSON.parse(localStorage.getItem('floralab-studio-state')).plan")


try:
    with sync_playwright() as pw:
        chrome = os.getenv('FLORALAB_BROWSER') or shutil.which('google-chrome') or shutil.which('chromium') or r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
        browser = pw.chromium.launch(executable_path=chrome, headless=True, args=['--no-sandbox'])
        for label, mobile, width, height in [('D', False, 1440, 1000), ('M', True, 390, 844)]:
            context = browser.new_context(viewport={'width':width, 'height':height}, is_mobile=mobile, has_touch=mobile)
            page = context.new_page()
            page.set_default_timeout(10000)
            page.set_default_navigation_timeout(60000)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(URL, wait_until='networkidle')
            page.locator('#newDesign').wait_for()
            ck(page.locator('#resumeDraft').count() == 0, label+' first visit has no phantom draft')
            page.locator('#newDesign').click()
            page.locator('#idea').fill('白绿桌花，不要玫瑰，自然留空。')
            details(page)
            expected = {'idea':'白绿桌花，不要玫瑰，自然留空。', 'existing':'3枝白洋桔梗', 'style':'自然', 'budget':'280', 'region':'广州', 'size':'small', 'designMonth':'9', 'petContext':'家里没有宠物', 'avoid':'玫瑰'}
            for field in ['existing', 'style', 'budget', 'region', 'designMonth', 'petContext', 'avoid']:
                page.locator('#'+field).fill(expected[field])
            page.locator('#size').select_option(expected['size'])
            page.locator('[data-type="桌花"]').click()
            page.locator('[data-color="白色"]').click()
            page.locator('[data-color="绿色"]').click()
            page.locator('#idea').focus()
            page.wait_for_function('()=>/已.*保存/.test(document.querySelector("#draftState")?.textContent||"")')
            ck(page.locator('#draftState').is_visible(), label+' draft save state is visible')
            home(page)
            page.locator('#resumeDraft').wait_for()
            ck(page.evaluate('scrollY') == 0, label+' returning home immediately starts at top')
            shot(page, label+'01-home-resume-draft')
            page.locator('#resumeDraft').click()
            page.locator('#idea').wait_for()
            assert_form(page, expected, label+' resume')
            page.reload(wait_until='networkidle')
            page.locator('#idea').wait_for()
            assert_form(page, expected, label+' refresh')
            shot(page, label+'02-restored-form')
            if mobile: page.locator('#navMore').click()
            page.locator('[data-go="materials"]:visible').click()
            page.locator('[data-material-detail]').first.wait_for()
            page.go_back()
            page.locator('#idea').wait_for()
            assert_form(page, expected, label+' return from material library')
            home(page)
            page.go_back()
            page.locator('#idea').wait_for()
            ck(page.locator('#idea').input_value() == expected['idea'], label+' Back returns to unfinished form')
            page.go_forward()
            page.locator('#resumeDraft').wait_for()
            ck(page.locator('#newDesign').is_visible(), label+' Forward returns home')
            page.locator('#freshDraft').click()
            page.locator('dialog').wait_for()
            ck(page.locator('#dialogConfirm').is_enabled(), label+' starting over asks before clearing draft')
            page.locator('dialog').get_by_role('button', name='取消', exact=True).click()
            page.locator('#resumeDraft').click()
            assert_form(page, expected, label+' cancel reset')

            # A real material conflict exercises the ordinary error path, without replacing app internals.
            page.locator('#idea').fill('8枝白玫瑰，不要玫瑰')
            page.locator('#generate').click()
            page.wait_for_function('()=>Boolean(document.querySelector("#intentError")?.textContent.trim())')
            ck(page.locator('#generate').is_enabled(), label+' failed generation can retry')
            shot(page, label+'03-generation-error-keeps-draft')
            page.reload(wait_until='networkidle')
            page.locator('#idea').wait_for()
            ck(page.locator('#idea').input_value() == '8枝白玫瑰，不要玫瑰', label+' failed generation draft survives refresh')
            page.locator('#idea').fill(expected['idea'])
            page.locator('#generate').click()
            page.locator('[data-select-making]').wait_for()
            project = plan(page)['id']
            active_tab(page, project, 'work')
            page.locator('[data-group="prepare"]').click()
            active_tab(page, project, 'recipe')
            count = page.evaluate('history.length')
            page.locator('[data-plus]').first.click()
            page.wait_for_timeout(300)
            ck(page.evaluate('history.length') == count, label+' same-tab edit does not add a history entry')
            page.locator('[data-group="making"]').click()
            active_tab(page, project, 'structure')
            page.go_back()
            active_tab(page, project, 'recipe')
            ck(plan(page)['id'] == project, label+' Back returns to recipe of same project')
            page.go_back()
            active_tab(page, project, 'work')
            page.go_forward()
            active_tab(page, project, 'recipe')
            ck(page.locator('#copyPurchase').is_visible(), label+' Forward restores recipe')
            detail = page.locator('[data-material-detail]').first
            detail.scroll_into_view_if_needed()
            page.wait_for_timeout(120)
            scroll = page.evaluate('scrollY')
            detail.click()
            page.locator('#returnRecipe').wait_for()
            ck('/#/materials/' in page.url, label+' material detail has restorable route')
            page.go_back()
            active_tab(page, project, 'recipe')
            page.wait_for_timeout(120)
            ck(abs(page.evaluate('scrollY')-scroll) < 3, label+' material Back restores recipe scroll position')
            page.go_forward()
            page.locator('#returnRecipe').wait_for()
            ck(page.locator('.material-detail').count() or page.locator('.material-visual').count(), label+' material Forward restores detail')
            page.locator('#returnRecipe').click()
            active_tab(page, project, 'recipe')
            page.locator('[data-group="making"]').click()
            active_tab(page, project, 'structure')
            page.reload(wait_until='networkidle')
            page.locator('#nodePicker').wait_for()
            active_tab(page, project, 'structure')
            shot(page, label+'04-refresh-structure')
            home(page)
            ck(page.locator('#resumeDraft').count() == 0, label+' successful generation clears unfinished draft')
            ck(page.locator(f'[data-open-project="{project}"]').count() > 0, label+' generated project remains saved')
            page.locator('#newDesign').click()
            ck(page.locator('#idea').input_value() == '', label+' new project does not reuse finished input as a draft')
            page.locator('#idea').fill('待清除的测试草稿')
            home(page)
            page.locator('#freshDraft').click()
            page.locator('#dialogConfirm').click()
            page.locator('dialog').wait_for(state='detached')
            page.locator('#idea').wait_for()
            ck(page.locator('#idea').input_value() == '', label+' confirmed fresh start clears draft')
            home(page)
            ck(page.locator('#resumeDraft').count() == 0, label+' cleared draft no longer appears on home')
            ck(page.locator(f'[data-open-project="{project}"]').count() > 0, label+' clearing draft preserves completed project')
            # Explicit root visits still show the library of local work, even with a last-tab record.
            page.goto(URL, wait_until='networkidle')
            page.locator('#newDesign').wait_for()
            ck(page.locator('[data-group]').count() == 0, label+' hashless visit stays home')

            # Only the draft write fails; this must not affect project storage or overwrite the last good draft.
            page.locator('#newDesign').click()
            page.locator('#idea').fill('已经保存在本机的测试草稿')
            page.wait_for_function('()=>document.querySelector("#draftState")?.dataset.tone==="saved"')
            last_good = page.evaluate("localStorage.getItem('floralab-studio-draft')")
            page.evaluate("""()=>{
                window.__qaDraftStoragePrototype=Object.getPrototypeOf(localStorage);
                window.__qaDraftSetItem=window.__qaDraftStoragePrototype.setItem;
                window.__qaDraftStoragePrototype.setItem=function(key,value){
                    if(key==='floralab-studio-draft')throw new DOMException('QA draft quota failure','QuotaExceededError');
                    return window.__qaDraftSetItem.call(this,key,value);
                };
                localStorage.setItem('qa-independent-write','still works');
            }""")
            try:
                interrupted = '存储暂不可用时继续写下的测试想法'
                page.locator('#idea').fill(interrupted)
                page.wait_for_function('()=>document.querySelector("#draftState")?.dataset.tone==="error"')
                status = page.locator('#draftState').inner_text()
                ck('尚未保存' in status and '已自动保存' not in status, label+' quota error never reports successful draft save')
                ck(page.evaluate("localStorage.getItem('floralab-studio-draft')") == last_good, label+' failed write preserves last saved draft bytes')
                ck(page.evaluate("localStorage.getItem('qa-independent-write')") == 'still works', label+' draft failure leaves other storage keys writable')
                ck(page.locator('#idea').input_value() == interrupted, label+' quota failure keeps current input visible')
                page.locator('#idea').press('Control+A')
                ck(page.locator('#idea').evaluate('(el)=>!el.readOnly&&!el.disabled&&el.selectionStart===0&&el.selectionEnd===el.value.length'), label+' unsaved input stays selectable for copying')
                shot(page, label+'05-draft-storage-failure')
            finally:
                page.evaluate("()=>{window.__qaDraftStoragePrototype.setItem=window.__qaDraftSetItem;delete window.__qaDraftSetItem;delete window.__qaDraftStoragePrototype;localStorage.removeItem('qa-independent-write');}")
            recovered = interrupted+'，现在继续保存'
            page.locator('#idea').fill(recovered)
            page.wait_for_function('()=>document.querySelector("#draftState")?.dataset.tone==="saved"')
            ck('已自动保存' in page.locator('#draftState').inner_text(), label+' draft status recovers after storage becomes writable')
            ck(page.evaluate("JSON.parse(localStorage.getItem('floralab-studio-draft')).form.idea") == recovered, label+' next input saves full recovered draft')

            # Start a fresh document at an unavailable project URL to exercise boot-time route restoration.
            page.goto('about:blank')
            page.goto(URL+'#/project/qa-missing-project/structure', wait_until='networkidle')
            page.locator('#newDesign').wait_for()
            ck(page.url.endswith('#/home'), label+' missing project route falls back to a valid home URL')
            ck('不在当前设备' in page.locator('.toast').inner_text(), label+' missing project explains how to recover')
            ck(page.locator(f'[data-open-project="{project}"]').count() > 0, label+' missing project route retains existing local work')
            shot(page, label+'06-missing-project-home')
            page.locator('#resumeDraft').click()
            page.locator('#idea').wait_for()
            ck(page.locator('#generate').is_enabled() and page.locator('#idea').input_value() == recovered, label+' missing project fallback remains usable with recovered draft')
            ck(not errors, label+' no runtime errors')
            context.close()
        browser.close()
finally:
    (OUT/'continuity.json').write_text(json.dumps({'url':URL, 'version':VERSION, 'checks':checks, 'screenshots':shots, 'errors':errors}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'continuity_checks':len(checks), 'screenshots':len(shots), 'errors':errors, 'output':str(OUT)}, ensure_ascii=False))
