import json, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
queries=json.loads((ROOT/'data'/'material-visual-queries.json').read_text(encoding='utf-8'))['items']
COMMONS='https://commons.wikimedia.org/w/api.php'
OPENVERSE='https://api.openverse.org/v1/images/'
BAD=('logo','icon','diagram','map','flag','stamp','drawing','illustration','painting','poster','herbarium')

def score(page,query):
    title=str(page.get('title','')).lower()
    words=[w for w in ''.join(ch if ch.isalnum() else ' ' for ch in query.lower()).split() if len(w)>2]
    n=sum(3 for w in words if w in title)
    n-=sum(8 for w in BAD if w in title)
    info=(page.get('imageinfo') or [{}])[0]
    mime=info.get('mime','')
    n+=4 if mime in ('image/jpeg','image/png','image/webp') else -10
    return n

def fetch_json(url):
    req=urllib.request.Request(url,headers={'User-Agent':'FloraLabStudio/1.2 material visual audit'})
    with urllib.request.urlopen(req,timeout=20) as r:
        return json.load(r)

def resolve_openverse(query):
    params={'q':query,'page_size':'8','mature':'false'}
    url=OPENVERSE+'?'+urllib.parse.urlencode(params)
    data=fetch_json(url)
    rows=[x for x in data.get('results',[]) if x.get('thumbnail') and x.get('foreign_landing_url')]
    if not rows:
        return None
    bad=('logo','icon','diagram','map','flag','stamp','drawing','illustration','painting','poster')
    words=[w for w in ''.join(ch if ch.isalnum() else ' ' for ch in query.lower()).split() if len(w)>2]
    def row_score(x):
        title=str(x.get('title','')).lower()
        n=sum(2 for w in words if w in title)-sum(8 for w in bad if w in title)
        if str(x.get('category','')).lower()=='photograph': n+=3
        return n
    rows.sort(key=row_score,reverse=True)
    x=rows[0]
    lic=' '.join(str(v) for v in (str(x.get('license','')).upper(),x.get('license_version')) if v and str(v)!='None').strip()
    return {'ok':True,'provider':'Openverse','query':query,'title':x.get('title',''),'asset':x.get('thumbnail'),'source':x.get('foreign_landing_url'),'mime':x.get('filetype',''),'license':lic or 'Open license','creator':x.get('creator') or x.get('source') or 'Openverse'}

def resolve_commons(query):
    params={
      'action':'query','generator':'search','gsrsearch':query,'gsrnamespace':'6','gsrlimit':'4',
      'prop':'imageinfo','iiprop':'url|extmetadata|mime','iiurlwidth':'1100','format':'json','origin':'*'
    }
    data=fetch_json(COMMONS+'?'+urllib.parse.urlencode(params))
    pages=[p for p in (data.get('query',{}).get('pages',{}) or {}).values() if p.get('imageinfo')]
    pages.sort(key=lambda p:score(p,query),reverse=True)
    best=next((p for p in pages if score(p,query)>-3),None)
    if not best:
        return None
    info=best['imageinfo'][0]
    md=info.get('extmetadata') or {}
    return {'ok':True,'provider':'Wikimedia Commons','query':query,'title':best.get('title',''),'asset':info.get('thumburl') or info.get('url'),'source':info.get('descriptionurl',''),'mime':info.get('mime',''),'license':(md.get('LicenseShortName') or md.get('UsageTerms') or {}).get('value','Wikimedia Commons')}

def resolve(pair):
    key,item=pair
    query=item['query']
    last=None
    for attempt in range(3):
        try:
            out=resolve_openverse(query)
            if out:
                time.sleep(.22)
                return key,out
        except Exception as e:
            last='openverse: '+str(e)
            if '429' in last: time.sleep(2.0*(attempt+1))
        try:
            out=resolve_commons(query)
            if out:
                time.sleep(.35)
                return key,out
        except Exception as e:
            last='commons: '+str(e)
            if '429' in last: time.sleep(3.0*(attempt+1))
            else: time.sleep(.5*(attempt+1))
    return key,{'ok':False,'query':query,'reason':last or 'no_suitable_open_image'}

results={}
with ThreadPoolExecutor(max_workers=1) as pool:
    futs=[pool.submit(resolve,pair) for pair in queries.items()]
    for fut in as_completed(futs):
        key,res=fut.result();results[key]=res

missing=sorted(k for k,v in results.items() if not v.get('ok'))
report={'total':len(queries),'resolved':len(queries)-len(missing),'missing':missing,'items':dict(sorted(results.items()))}
(ROOT/'qa'/'material-visual-sources.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(f"material-visual-sources: {report['resolved']} / {report['total']} resolved")
if missing:
    print('missing:', ', '.join(missing))
    raise SystemExit(1)
