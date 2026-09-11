import html, io, json, re, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
OUT=ROOT/'qa'/'material-visual-sources.json'
PUB_OUT=PUB/'data'/'material-visual-sources.json'
ASSET_DIR=PUB/'assets'/'materials'
queries=json.loads((ROOT/'data'/'material-visual-queries.json').read_text(encoding='utf-8'))['items']
COMMONS='https://commons.wikimedia.org/w/api.php'
OPENVERSE='https://api.openverse.org/v1/images/'
BAD=('logo','icon','diagram','map','flag','stamp','drawing','illustration','painting','poster','herbarium','specimen')
ALLOWED_OPENVERSE={'cc0','pdm','by','by-sa'}

def clean(value):
    text=re.sub(r'<[^>]+>',' ',html.unescape(str(value or '')))
    return re.sub(r'\s+',' ',text).strip()

def words(query):
    return [w for w in re.sub(r'[^a-z0-9]+',' ',query.lower()).split() if len(w)>2]

def title_score(title,query,photograph=False):
    t=str(title or '').lower()
    n=sum(3 for w in words(query) if w in t)
    n-=sum(9 for w in BAD if w in t)
    if photograph: n+=4
    return n

def commons_score(page,query):
    info=(page.get('imageinfo') or [{}])[0]
    n=title_score(page.get('title',''),query)
    mime=info.get('mime','')
    n+=4 if mime in ('image/jpeg','image/png','image/webp') else -12
    md=info.get('extmetadata') or {}
    desc=clean((md.get('ImageDescription') or md.get('ObjectName') or {}).get('value','')).lower()
    n+=sum(1 for w in words(query) if w in desc)
    return n

def fetch_json(url,attempts=2):
    last=None
    for attempt in range(attempts):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'FloraLabStudio/1.2 material visual audit'})
            with urllib.request.urlopen(req,timeout=8) as r:
                return json.load(r)
        except Exception as e:
            last=e
            delay=(4.0 if '429' in str(e) else .8)*(attempt+1)
            time.sleep(delay)
    raise last

def resolve_openverse(query):
    params={'q':query,'page_size':'6','mature':'false'}
    data=fetch_json(OPENVERSE+'?'+urllib.parse.urlencode(params))
    rows=[]
    for x in data.get('results',[]):
        lic=str(x.get('license') or '').lower()
        if (x.get('url') or x.get('thumbnail')) and x.get('foreign_landing_url') and lic in ALLOWED_OPENVERSE:
            rows.append(x)
    if not rows:return None
    rows.sort(key=lambda x:title_score(x.get('title',''),query,str(x.get('category','')).lower()=='photograph'),reverse=True)
    x=rows[0]
    lic=' '.join(v for v in [str(x.get('license','')).upper(),str(x.get('license_version') or '')] if v)
    return {
      'ok':True,'provider':'Openverse','query':query,'title':x.get('title',''),
      'asset':x.get('thumbnail') or x.get('url'),'preview':x.get('url') or '','source':x.get('foreign_landing_url'),'mime':x.get('filetype',''),
      'license':lic or 'Open license','license_url':x.get('license_url') or '',
      'creator':clean(x.get('creator') or x.get('source') or 'Openverse')
    }

def resolve_commons(query):
    params={
      'action':'query','generator':'search','gsrsearch':query,'gsrnamespace':'6','gsrlimit':'6',
      'prop':'imageinfo','iiprop':'url|extmetadata|mime','iiurlwidth':'1200','format':'json','origin':'*'
    }
    data=fetch_json(COMMONS+'?'+urllib.parse.urlencode(params))
    pages=[p for p in (data.get('query',{}).get('pages',{}) or {}).values() if p.get('imageinfo')]
    pages.sort(key=lambda p:commons_score(p,query),reverse=True)
    best=next((p for p in pages if commons_score(p,query)>-4),None)
    if not best:return None
    info=best['imageinfo'][0];md=info.get('extmetadata') or {}
    return {
      'ok':True,'provider':'Wikimedia Commons','query':query,'title':best.get('title',''),
      'asset':info.get('thumburl') or info.get('url'),'preview':info.get('url') or '','source':info.get('descriptionurl',''),'mime':info.get('mime',''),
      'license':clean((md.get('LicenseShortName') or md.get('UsageTerms') or {}).get('value','Wikimedia Commons')),
      'license_url':clean((md.get('LicenseUrl') or {}).get('value','')),
      'creator':clean((md.get('Artist') or md.get('Credit') or {}).get('value','Wikimedia Commons'))[:160]
    }

def resolve(pair):
    key,item=pair;query=item['query'];last=None
    try:
        out=resolve_openverse(query)
        if out:return key,out
    except Exception as e:
        last='openverse: '+str(e)
    time.sleep(.18)
    try:
        out=resolve_commons(query)
        if out:return key,out
    except Exception as e:
        last='commons: '+str(e)
    return key,{'ok':False,'query':query,'reason':last or 'no_suitable_open_image'}

def download_bytes(url):
    last=None
    for attempt in range(2):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 FloraLabStudio/1.2'})
            with urllib.request.urlopen(req,timeout=15) as r:
                return r.read(12_000_000)
        except Exception as e:
            last=e;time.sleep(.8*(attempt+1))
    raise last

def safe_name(key):
    return re.sub(r'[^a-zA-Z0-9_-]+','-',key).strip('-')+'.webp'

def persist_asset(key,res):
    if not res.get('ok'):return key,res
    try:
        raw=None;last=None
        for candidate in [res.get('asset'),res.get('preview')]:
            if not candidate: continue
            try:
                raw=download_bytes(candidate);break
            except Exception as e:
                last=e
        if raw is None: raise last or RuntimeError('no_downloadable_asset')
        im=Image.open(io.BytesIO(raw))
        im=ImageOps.exif_transpose(im).convert('RGB')
        im.thumbnail((1200,1200),Image.Resampling.LANCZOS)
        ASSET_DIR.mkdir(parents=True,exist_ok=True)
        filename=safe_name(key)
        out=ASSET_DIR/filename
        im.save(out,'WEBP',quality=84,method=5)
        res=dict(res)
        res['local_asset']='./assets/materials/'+filename
        res['width'],res['height']=im.size
        res['bytes']=out.stat().st_size
        return key,res
    except Exception as e:
        # If an Openverse thumbnail cannot be mirrored, try a Commons result once.
        if res.get('provider')=='Openverse':
            try:
                alt=resolve_commons(res.get('query',''))
                if alt:
                    raw=download_bytes(alt['asset'])
                    im=Image.open(io.BytesIO(raw))
                    im=ImageOps.exif_transpose(im).convert('RGB')
                    im.thumbnail((1200,1200),Image.Resampling.LANCZOS)
                    ASSET_DIR.mkdir(parents=True,exist_ok=True)
                    filename=safe_name(key)
                    out=ASSET_DIR/filename
                    im.save(out,'WEBP',quality=84,method=5)
                    alt['local_asset']='./assets/materials/'+filename
                    alt['width'],alt['height']=im.size
                    alt['bytes']=out.stat().st_size
                    return key,alt
            except Exception:
                pass
        fallback=dict(res)
        fallback['mirror_error']='asset_download: '+str(e)
        return key,fallback

results={}
# Resolve a few items at a time; provider retry/backoff handles 429s without turning 130 lookups into a serial crawl.
with ThreadPoolExecutor(max_workers=4) as pool:
    futs=[pool.submit(resolve,pair) for pair in queries.items()]
    done=0
    for fut in as_completed(futs):
        key,res=fut.result();results[key]=res;done+=1
        if done%10==0 or done==len(queries):
            print(f"visual-search: {done}/{len(queries)}",flush=True)

# Image downloads are separate and lightly parallel because they hit the selected media hosts, not search APIs.
persisted={}
with ThreadPoolExecutor(max_workers=6) as pool:
    futs=[pool.submit(persist_asset,k,v) for k,v in results.items()]
    done=0
    for fut in as_completed(futs):
        key,res=fut.result();persisted[key]=res;done+=1
        if done%10==0 or done==len(results):
            print(f"visual-mirror: {done}/{len(results)}",flush=True)

missing=sorted(k for k,v in persisted.items() if not v.get('ok') or not v.get('asset'))
report={
  'version':'1.2.1','total':len(queries),'resolved':len(queries)-len(missing),'missing':missing,
  'mirrored':sum(1 for v in persisted.values() if v.get('local_asset')),
  'remote_fallback':sum(1 for v in persisted.values() if v.get('ok') and v.get('asset') and not v.get('local_asset')),
  'policy':'Open reusable photograph first. Images are mirrored when providers allow it; rate-limited items retain their licensed remote asset URL with source, creator and license attribution.',
  'items':dict(sorted(persisted.items()))
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
PUB_OUT.parent.mkdir(parents=True,exist_ok=True)
PUB_OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(f"material-visual-sources: {report['resolved']} / {report['total']} resolved; {report['mirrored']} mirrored; {report['remote_fallback']} remote fallbacks")
print(f"material-visual-bytes: {sum(v.get('bytes',0) for v in persisted.values())}")
if missing:
    print('missing:', ', '.join(missing))
    raise SystemExit(1)
