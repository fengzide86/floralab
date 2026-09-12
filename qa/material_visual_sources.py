import hashlib, html, io, json, re, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
PUB=ROOT/'public'
OUT=ROOT/'qa'/'material-visual-sources.json'
PUB_OUT=PUB/'data'/'material-visual-sources.json'
ASSET_DIR=PUB/'assets'/'materials'
QUERY_FILE=ROOT/'data'/'material-visual-queries.json'
queries=json.loads(QUERY_FILE.read_text(encoding='utf-8'))['items']
illustrations={k:v for k,v in json.loads((ROOT/'data'/'material-visuals.json').read_text(encoding='utf-8'))['items'].items() if v.get('image_type')=='ai_illustration'}
pinned_file=ROOT/'data'/'material-photo-sources.json'
pinned=json.loads(pinned_file.read_text(encoding='utf-8'))['items'] if pinned_file.exists() else {}
catalog=json.loads((ROOT/'data'/'catalog.json').read_text(encoding='utf-8'))
COMMONS='https://commons.wikimedia.org/w/api.php'
OPENVERSE='https://api.openverse.org/v1/images/'
BAD=('logo','icon','diagram','map','flag','stamp','drawing','illustration','painting','poster','herbarium','specimen','catalogue','price list','book page','botanical plate','engraving','plans','glider','aircraft','fossil','rock','geology','spider','argiope','oak trunk','tree trunk')
GENERIC={'flower','flowers','branch','leaves','leaf','foliage','close','up','cut','woody','dyed','form','photograph','photo','plant','plants'}
ALLOWED_OPENVERSE={'cc0','pdm','by','by-sa'}
CREATIVE_MUST={
 'creative:plush':('plush','teddy','bear'),
 'creative:strawberry':('strawberry',),
 'creative:chocolate':('chocolate',),
 'creative:snack':('snack',),
 'creative:can':('soda','can','beverage'),
 'creative:photo':('photo','polaroid'),
 'creative:acrylic':('acrylic','sign'),
 'creative:light':('fairy','light','lights'),
 'creative:building':('block','blocks','building'),
 'creative:giftbox':('gift','box'),
 'creative:keychain':('keychain','charm'),
 'creative:card':('card','greeting'),
 'creative:coffee':('coffee','drip')
}

MANUAL_OPEN={
 'creative:acrylic':{
   'ok':True,'provider':'Wikimedia Commons','query':'clear acrylic sign display stand','search_query':'curated','confidence':100,
   'title':'Restroom Acrylic Sign with Mounting Hardware.jpg',
   'asset':'https://upload.wikimedia.org/wikipedia/commons/e/eb/Restroom_Acrylic_Sign_with_Mounting_Hardware.jpg',
   'preview':'','source':'https://commons.wikimedia.org/wiki/File:Restroom_Acrylic_Sign_with_Mounting_Hardware.jpg',
   'mime':'image/jpeg','license':'CC BY-SA 4.0','license_url':'https://creativecommons.org/licenses/by-sa/4.0/','creator':'Helene.3160'
 },
 'creative:snack':{
   'ok':True,'provider':'Wikimedia Commons','query':'potato chips snack bag package','search_query':'curated','confidence':100,
   'title':'Chips - Best before seal; forever.jpg',
   'asset':'https://upload.wikimedia.org/wikipedia/commons/3/37/Chips_-_Best_before_seal%3B_forever.jpg',
   'preview':'','source':'https://commons.wikimedia.org/wiki/File:Chips_-_Best_before_seal%3B_forever.jpg',
   'mime':'image/jpeg','license':'CC BY-SA 4.0','license_url':'https://creativecommons.org/licenses/by-sa/4.0/','creator':'Silverije'
 },
 'creative:chocolate':{
   'ok':True,'provider':'Wikimedia Commons','query':'wrapped chocolate candy close up','search_query':'curated','confidence':100,
   'title':'Chocolate balls close up.jpg',
   'asset':'https://upload.wikimedia.org/wikipedia/commons/d/d0/Chocolate_balls_close_up.jpg',
   'preview':'','source':'https://commons.wikimedia.org/wiki/File:Chocolate_balls_close_up.jpg',
   'mime':'image/jpeg','license':'CC BY 4.0','license_url':'https://creativecommons.org/licenses/by/4.0/','creator':'Gnu-Bricoleur'
 },
 'creative:photo':{
   'ok':True,'provider':'Wikimedia Commons','query':'instant photo card polaroid','search_query':'curated','confidence':100,
   'title':'Polaroid Time Zero SX-70 AutoFocus Special Edition With Photos.jpg',
   'asset':'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ea/Polaroid_Time_Zero_SX-70_AutoFocus_Special_Edition_With_Photos.jpg/960px-Polaroid_Time_Zero_SX-70_AutoFocus_Special_Edition_With_Photos.jpg',
   'preview':'','source':'https://commons.wikimedia.org/wiki/File:Polaroid_Time_Zero_SX-70_AutoFocus_Special_Edition_With_Photos.jpg',
   'mime':'image/jpeg','license':'CC BY 4.0','license_url':'https://creativecommons.org/licenses/by/4.0/','creator':'Moki8'
 },
 'creative:light':{
   'ok':True,'provider':'Wikimedia Commons','query':'warm fairy light string LEDs close up','search_query':'curated','confidence':100,
   'title':'LED string lights.jpg',
   'asset':'https://upload.wikimedia.org/wikipedia/commons/d/db/LED_string_lights.jpg',
   'preview':'','source':'https://commons.wikimedia.org/wiki/File:LED_string_lights.jpg',
   'mime':'image/jpeg','license':'CC BY-SA 4.0','license_url':'https://creativecommons.org/licenses/by-sa/4.0/','creator':'Battuaruna'
 }
}

def clean(value):
    text=re.sub(r'<[^>]+>',' ',html.unescape(str(value or '')))
    return re.sub(r'\s+',' ',text).strip()

def words(value):
    return [w for w in re.sub(r'[^a-z0-9]+',' ',str(value or '').lower()).split() if len(w)>2]

def profile(key,query):
    if key in CREATIVE_MUST:
        must=CREATIVE_MUST[key]
        qwords=[w for w in words(query) if w not in GENERIC]
        phrase=' '.join(qwords[:3] or must[:2])
        return must,phrase,qwords
    qwords=[w for w in words(query) if w not in GENERIC]
    must=tuple(qwords[:1])
    phrase=' '.join(qwords[:2] or qwords[:1])
    return must,phrase,qwords

def text_matches(text,must):
    t=' '+str(text or '').lower()+' '
    return any(re.search(r'(?<![a-z0-9])'+re.escape(w)+r'(?![a-z0-9])',t) for w in must)

def score_text(title,meta,query,must,photograph=False):
    title=str(title or '').lower();meta=str(meta or '').lower();all_text=title+' '+meta
    if any(b in all_text for b in BAD): return -100
    if not text_matches(all_text,must): return -80
    qwords=[w for w in words(query) if w not in GENERIC]
    n=10
    n+=sum(5 for w in must if text_matches(title,(w,)))
    n+=sum(3 for w in qwords if text_matches(title,(w,)))
    n+=sum(1 for w in qwords if text_matches(meta,(w,)))
    if photograph:n+=4

    flower_intent=any(w in words(query) for w in ('flower','flowers','bloom','blossom'))
    leaf_intent=any(w in words(query) for w in ('leaf','leaves','foliage','frond'))
    if flower_intent:
        if any(w in all_text for w in ('flower','flowers','bloom','blossom','inflorescence')): n+=8
        if any(w in all_text for w in ('seed','seeds','fruit','bark','root','wood','trunk')): n-=18
    if leaf_intent:
        if any(w in all_text for w in ('leaf','leaves','foliage','frond')): n+=8
        if any(w in all_text for w in ('fountain','airport','building','cat ',' dog ')): n-=18
    if 'close up' in query.lower() or 'close-up' in query.lower():
        if any(w in all_text for w in ('close-up','close up','macro')): n+=3
    return n

def fetch_json(url,attempts=3):
    last=None
    for attempt in range(attempts):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'FloraLabStudio/1.2 material visual audit'})
            with urllib.request.urlopen(req,timeout=12) as r:
                return json.load(r)
        except Exception as e:
            last=e
            delay=(3.0 if '429' in str(e) else .7)*(attempt+1)
            time.sleep(delay)
    raise last

def openverse_rows(q):
    params={'q':q,'page_size':'20','mature':'false','category':'photograph'}
    data=fetch_json(OPENVERSE+'?'+urllib.parse.urlencode(params))
    return data.get('results',[]) or []

def resolve_openverse(key,query):
    must,phrase,_=profile(key,query)
    tried=[]
    for q in [f'"{phrase}"',query]:
        if not q or q in tried:continue
        tried.append(q)
        rows=[]
        for x in openverse_rows(q):
            lic=str(x.get('license') or '').lower()
            if lic not in ALLOWED_OPENVERSE or not (x.get('url') or x.get('thumbnail')) or not x.get('foreign_landing_url'):
                continue
            source_name=str(x.get('source') or x.get('provider') or '').lower()
            if key.startswith('flower:') and 'rawpixel' in source_name:
                continue
            tags=' '.join(clean(t.get('name')) for t in (x.get('tags') or []) if isinstance(t,dict))
            meta=' '.join([tags,clean(x.get('creator')),clean(x.get('source')),clean(x.get('category'))])
            sc=score_text(x.get('title',''),meta,query,must,str(x.get('category','')).lower()=='photograph')
            if sc>-50: rows.append((sc,x))
        if not rows:continue
        rows.sort(key=lambda pair:pair[0],reverse=True)
        sc,x=rows[0]
        lic=' '.join(v for v in [str(x.get('license','')).upper(),str(x.get('license_version') or '')] if v)
        return {
          'ok':True,'provider':'Openverse','query':query,'search_query':q,'confidence':sc,'title':x.get('title',''),
          'asset':x.get('thumbnail') or x.get('url'),'preview':x.get('url') or '','source':x.get('foreign_landing_url'),'mime':x.get('filetype',''),
          'license':lic or 'Open license','license_url':x.get('license_url') or '',
          'creator':clean(x.get('creator') or x.get('source') or 'Openverse')
        }
    return None

def commons_pages(q):
    params={
      'action':'query','generator':'search','gsrsearch':q,'gsrnamespace':'6','gsrlimit':'12',
      'prop':'imageinfo','iiprop':'url|extmetadata|mime','iiurlwidth':'1200','format':'json','origin':'*'
    }
    data=fetch_json(COMMONS+'?'+urllib.parse.urlencode(params))
    return [p for p in (data.get('query',{}).get('pages',{}) or {}).values() if p.get('imageinfo')]

def resolve_commons(key,query):
    must,phrase,_=profile(key,query)
    tried=[]
    for q in [f'"{phrase}"',query]:
        if not q or q in tried:continue
        tried.append(q)
        rows=[]
        for page in commons_pages(q):
            info=page['imageinfo'][0];md=info.get('extmetadata') or {}
            mime=info.get('mime','')
            if mime not in ('image/jpeg','image/png','image/webp'):continue
            meta=' '.join([
              clean((md.get('ImageDescription') or {}).get('value','')),
              clean((md.get('ObjectName') or {}).get('value','')),
              clean((md.get('Categories') or {}).get('value','')),
              clean((md.get('Artist') or {}).get('value',''))
            ])
            sc=score_text(page.get('title',''),meta,query,must,True)
            if sc>-50:rows.append((sc,page))
        if not rows:continue
        rows.sort(key=lambda pair:pair[0],reverse=True)
        sc,best=rows[0]
        info=best['imageinfo'][0];md=info.get('extmetadata') or {}
        return {
          'ok':True,'provider':'Wikimedia Commons','query':query,'search_query':q,'confidence':sc,'title':best.get('title',''),
          'asset':info.get('thumburl') or info.get('url'),'preview':info.get('url') or '','source':info.get('descriptionurl',''),'mime':info.get('mime',''),
          'license':clean((md.get('LicenseShortName') or md.get('UsageTerms') or {}).get('value','Wikimedia Commons')),
          'license_url':clean((md.get('LicenseUrl') or {}).get('value','')),
          'creator':clean((md.get('Artist') or md.get('Credit') or {}).get('value','Wikimedia Commons'))[:160]
        }
    return None

def resolve(pair):
    key,item=pair;query=item['query'];last=None
    if key in illustrations:return key,{**illustrations[key],'ok':True,'query':query}
    if key in pinned:return key,dict(pinned[key])
    if key in MANUAL_OPEN:return key,dict(MANUAL_OPEN[key])
    try:
        out=resolve_openverse(key,query)
        if out:return key,out
    except Exception as e:last='openverse: '+str(e)
    time.sleep(.08)
    try:
        out=resolve_commons(key,query)
        if out:return key,out
    except Exception as e:last='commons: '+str(e)
    return key,{'ok':False,'query':query,'reason':last or 'no_confident_open_image'}

def download_bytes(url,attempts=4):
    last=None
    for attempt in range(attempts):
        try:
            req=urllib.request.Request(url,headers={
              'User-Agent':'Mozilla/5.0 FloraLabStudio/1.2',
              'Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            })
            with urllib.request.urlopen(req,timeout=24) as r:return r.read(12_000_000)
        except Exception as e:
            last=e
            time.sleep((1.0 if '429' not in str(e) else 3.0)*(attempt+1))
    raise last

def safe_name(key):
    return re.sub(r'[^a-zA-Z0-9_-]+','-',key).strip('-')+'.webp'

def wikimedia_thumbnail(url,width=960):
    if not url:return None
    try:
        p=urllib.parse.urlsplit(url)
        path=p.path
        marker='/wikipedia/commons/'
        if p.netloc not in ('upload.wikimedia.org','thumb.wikimedia.org') or marker not in path or '/thumb/' in path:
            return None
        base=path.rsplit('/',1)[-1]
        if not re.search(r'\.(?:jpe?g|png|webp)$',base,re.I):
            return None
        thumb_path=path.replace(marker,'/wikipedia/commons/thumb/',1)+f'/{width}px-{base}'
        return urllib.parse.urlunsplit(('https','thumb.wikimedia.org',thumb_path,'',''))
    except Exception:
        return None

def alternative_resolution(key,current):
    query=queries[key]['query']
    provider=str(current.get('provider') or '')
    resolvers=[resolve_commons,resolve_openverse] if provider=='Openverse' else [resolve_openverse,resolve_commons]
    for fn in resolvers:
        try:
            alt=fn(key,query)
            if alt and alt.get('ok') and alt.get('asset') and alt.get('source')!=current.get('source'):
                return alt
        except Exception:
            pass
        time.sleep(.25)
    return None

def persist_asset(key,res):
    if not res.get('ok'):return key,res
    if res.get('sha256'):
        local=(PUB/res['local_asset'].removeprefix('./')).resolve()
        if not local.is_relative_to(PUB.resolve()) or not local.is_file():
            raise RuntimeError('Missing pinned photograph: '+key)
        if not all(res.get(field) for field in ['source','license','creator']):
            raise RuntimeError('Missing photograph attribution: '+key)
        if hashlib.sha256(local.read_bytes()).hexdigest()!=res['sha256']:
            raise RuntimeError('Pinned photograph changed without review: '+key)
        with Image.open(local) as im:im.verify()
        return key,res
    if res.get('image_type')=='ai_illustration':
        local=(PUB/res['local_asset'].removeprefix('./')).resolve()
        if not local.is_relative_to(PUB.resolve()) or not local.is_file():
            raise RuntimeError('Missing packaged illustration: '+key)
        with Image.open(local) as im:
            im.verify()
        with Image.open(local) as im:
            res={**res,'width':im.width,'height':im.height,'bytes':local.stat().st_size}
        return key,res
    try:
        raw=None;last=None
        candidates=[]
        for original in [res.get('asset'),res.get('preview')]:
            thumb=wikimedia_thumbnail(original)
            if thumb and thumb not in candidates:candidates.append(thumb)
            if original and original not in candidates:candidates.append(original)
        for candidate in candidates:
            try:raw=download_bytes(candidate);break
            except Exception as e:last=e
        if raw is None:raise last or RuntimeError('no_downloadable_asset')
        im=Image.open(io.BytesIO(raw));im=ImageOps.exif_transpose(im).convert('RGB');im.thumbnail((1200,1200),Image.Resampling.LANCZOS)
        ASSET_DIR.mkdir(parents=True,exist_ok=True)
        filename=safe_name(key);out=ASSET_DIR/filename;im.save(out,'WEBP',quality=84,method=5)
        res=dict(res);res['local_asset']='./assets/materials/'+filename;res['width'],res['height']=im.size;res['bytes']=out.stat().st_size
        return key,res
    except Exception as e:
        fallback=dict(res);fallback['mirror_error']='asset_download: '+str(e);return key,fallback

results={}
with ThreadPoolExecutor(max_workers=3) as pool:
    futs=[pool.submit(resolve,pair) for pair in queries.items()]
    for i,fut in enumerate(as_completed(futs),1):
        key,res=fut.result();results[key]=res
        if i%10==0 or i==len(queries):print(f"visual-search: {i}/{len(queries)}",flush=True)

persisted={}
with ThreadPoolExecutor(max_workers=5) as pool:
    futs=[pool.submit(persist_asset,k,v) for k,v in results.items()]
    for i,fut in enumerate(as_completed(futs),1):
        key,res=fut.result();persisted[key]=res
        if i%10==0 or i==len(results):print(f"visual-mirror: {i}/{len(results)}",flush=True)

# A resolved remote URL is not enough for the PWA: every factual image must be copied into
# the release artifact. Retry transient failures, then switch provider/source before failing.
repair_keys=sorted(k for k,v in persisted.items() if v.get('ok') and v.get('asset') and not v.get('local_asset'))
if repair_keys:
    print('visual-mirror-repair:',', '.join(repair_keys),flush=True)
for key in repair_keys:
    time.sleep(.4)
    _,retry=persist_asset(key,persisted[key])
    if retry.get('local_asset'):
        persisted[key]=retry
        continue
    alt=alternative_resolution(key,persisted[key])
    if alt:
        _,retry_alt=persist_asset(key,alt)
        if retry_alt.get('local_asset'):
            retry_alt['mirror_recovered_from']=persisted[key].get('provider','')
            persisted[key]=retry_alt

missing=sorted(k for k,v in persisted.items() if not v.get('ok') or not v.get('asset'))
low_conf=sorted(k for k,v in persisted.items() if v.get('ok') and v.get('image_type')!='ai_illustration' and float(v.get('confidence',0))<10)
remote_fallback=sorted(k for k,v in persisted.items() if v.get('ok') and v.get('asset') and not v.get('local_asset'))
report={
  'version':'1.2.1','total':len(queries),'resolved':len(queries)-len(missing),'missing':missing,'low_confidence':low_conf,
  'mirrored':sum(1 for v in persisted.values() if v.get('local_asset')),
  'remote_fallback':len(remote_fallback),
  'illustrations':sum(1 for v in persisted.values() if v.get('image_type')=='ai_illustration'),
  'policy':'Reference photographs retain source, creator and license. Packaged AI shape illustrations are explicitly marked ai_illustration and must never be labelled identification photographs.',
  'items':dict(sorted(persisted.items()))
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
PUB_OUT.parent.mkdir(parents=True,exist_ok=True);PUB_OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')

# Material-image audit sheets are supplemental QA, not a substitute for page-by-page UI review.
names={**{'flower:'+x['id']:x['name'] for x in catalog['flowers']},**{'creative:'+x['id']:x['name'] for x in catalog['creative']}}
font_paths=['/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf']
font=ImageFont.load_default()
for fp in font_paths:
    if Path(fp).exists():
        try:font=ImageFont.truetype(fp,18);break
        except Exception:pass
keys=sorted(persisted)
for sheet_i in range(0,len(keys),26):
    subset=keys[sheet_i:sheet_i+26];canvas=Image.new('RGB',(1300,((len(subset)+4)//5)*230),(246,243,238));draw=ImageDraw.Draw(canvas)
    for idx,key in enumerate(subset):
        col=idx%5;row=idx//5;x=col*260;y=row*230
        res=persisted[key];im=None
        path=PUB/res['local_asset'].removeprefix('./') if res.get('local_asset') else ASSET_DIR/safe_name(key)
        if path.exists():
            try:im=Image.open(path).convert('RGB')
            except Exception:im=None
        if im is None and res.get('asset'):
            try:im=Image.open(io.BytesIO(download_bytes(res['asset']))).convert('RGB')
            except Exception:im=None
        if im:
            im=ImageOps.fit(im,(240,165),method=Image.Resampling.LANCZOS);canvas.paste(im,(x+10,y+8))
        else:
            draw.rectangle((x+10,y+8,x+250,y+173),outline=(170,160,150),width=2);draw.text((x+28,y+72),'NO IMAGE',fill=(100,90,85),font=font)
        label=(names.get(key,key)+'  '+key)[:34];draw.text((x+10,y+181),label,fill=(55,48,44),font=font)
        meta=(res.get('provider','')+' · '+str(res.get('confidence','')))[:32];draw.text((x+10,y+204),meta,fill=(110,100,94),font=font)
    canvas.save(ROOT/'qa'/f'material-visual-sheet-{sheet_i//26+1:02d}.jpg',quality=88)

print(f"material-visual-sources: {report['resolved']} / {report['total']} resolved; {report['mirrored']} mirrored; {report['remote_fallback']} remote fallbacks")
print(f"material-visual-low-confidence: {len(low_conf)}")
print(f"material-visual-bytes: {sum(v.get('bytes',0) for v in persisted.values())}")
if missing or low_conf or remote_fallback:
    if missing:print('missing:',', '.join(missing))
    if low_conf:print('low-confidence:',', '.join(low_conf))
    if remote_fallback:print('remote-fallback:',', '.join(remote_fallback))
    raise SystemExit(1)
