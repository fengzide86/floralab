(function(){
'use strict';
const ROLE_ORDER=['主花','焦点','体块','线条','过渡','填充','叶材','点缀'];
const COLOR_ORDER=['白','紫','粉','红','黄','橙','蓝','绿','香槟','奶油','黑'];
const SEASONS={spring:[3,4,5],summer:[6,7,8],autumn:[9,10,11],winter:[12,1,2]};
const COLOR_HEX={白:'#eee9df',紫:'#9d87ad',粉:'#d9aeb7',红:'#a85d59',黄:'#d4b95e',橙:'#ca865c',蓝:'#88a6b7',绿:'#7e9277',香槟:'#d7c4a8',奶油:'#e8dcc2',黑:'#47434a'};
const WEIGHT_LABEL={light:'轻',medium:'中等',heavy:'偏重'};
const LEVEL_LABEL={low:'低',medium:'中等',high:'高',good:'适合',fair:'一般',poor:'不适合',flexible:'柔韧',woody:'木质',strong:'强',soft:'柔软',very_high:'很高',conditional:'有条件适用',excellent:'非常适合',unknown:'需核实'};

function q(sel,root=document){return root.querySelector(sel);}
function qa(sel,root=document){return [...root.querySelectorAll(sel)];}
function valLabel(v){return LEVEL_LABEL[v]||WEIGHT_LABEL[v]||v||'—';}
function rangeLabel(v,unit){return Array.isArray(v)&&v.length>=2?`${v[0]}–${v[1]} ${unit}`:'—';}
function priceLabel(v){return Array.isArray(v)&&v.length>=2?`¥${v[0]}–${v[1]}`:'—';}
function monthLabel(month){return `${month} 月`;}
function seasonMonths(season){return SEASONS[season]||[];}
function palette(m){const colors=(m.colors||[]).slice(0,5);return colors.length?colors:['绿'];}
function escAttr(s=''){return String(s).replace(/"/g,'&quot;');}

function petRiskInfo(value,referenceOnly=false){
  const v=String(value||'').trim();
  if(!v||v==='unknown')return {tone:'unknown',label:referenceOnly?'宠物信息需核实':'宠物信息未提供',text:'没有可靠信息时，不把“未知”显示成“安全”。'};
  if(v==='block_cat')return {tone:'safety',label:'猫环境高风险',text:'真百合对猫为高危材料；猫环境不使用真百合，并避免花粉、花瓣、叶片和花水接触。'};
  return {tone:'note',label:'宠物信息',text:v};
}
function beginnerLabel(v){
  return v===true?'新手友好':v===false?'需要一定经验':'需核实';
}

const COMMONS_API='https://commons.wikimedia.org/w/api.php';
const OPENVERSE_API='https://api.openverse.org/v1/images/';
const VISUAL_CACHE_KEY='floralab-commons-visual-cache-v2';
function visualKey(kind,m){return `${kind}:${m.id}`;}
function visualEntry(S,kind,m){
  const key=visualKey(kind,m),verified=S.visualRegistry?.items||{},resolved=S.visualSources?.items||{};
  return verified[key]||verified[m.id]||resolved[key]||null;
}
function visualQuery(S,kind,m){
  const item=S.visualQueries?.items?.[visualKey(kind,m)]||null;
  return item?.query||[m.name,...(m.aliases||[])].filter(Boolean).join(' ');
}
function stripHtml(value=''){
  const d=document.createElement('div');d.innerHTML=String(value||'');
  return (d.textContent||'').replace(/\s+/g,' ').trim();
}
function readVisualCache(S){
  if(S.visualCache)return S.visualCache;
  let parsed={};
  try{parsed=JSON.parse(localStorage.getItem(VISUAL_CACHE_KEY)||'{}')||{};}catch{parsed={};}
  const maxAge=1000*60*60*24*45,now=Date.now();
  for(const [k,v] of Object.entries(parsed)){if(!v?.asset||!v.resolved_at||now-v.resolved_at>maxAge)delete parsed[k];}
  S.visualCache=parsed;return parsed;
}
function writeVisualCache(S){
  try{localStorage.setItem(VISUAL_CACHE_KEY,JSON.stringify(S.visualCache||{}));}catch{}
}
function commonsScore(page,query){
  const title=String(page?.title||'').replace(/^File:/i,'').toLowerCase();
  const q=String(query||'').toLowerCase();
  const words=q.split(/[^a-z0-9]+/).filter(x=>x.length>2);
  let score=0;for(const w of words)if(title.includes(w))score+=3;
  const bad=['logo','icon','diagram','map','flag','stamp','drawing','illustration','painting','poster','herbarium','specimen sheet'];
  for(const w of bad)if(title.includes(w))score-=8;
  const mime=page?.imageinfo?.[0]?.mime||'';
  if(/^image\/(jpeg|png|webp)$/i.test(mime))score+=4;else score-=10;
  const md=page?.imageinfo?.[0]?.extmetadata||{};
  const desc=stripHtml(md.ImageDescription?.value||md.ObjectName?.value||'').toLowerCase();
  for(const w of words)if(desc.includes(w))score+=1;
  return score;
}
function pumpVisualFetchQueue(S){
  S.visualFetchQueue=S.visualFetchQueue||[];S.visualFetchActive=S.visualFetchActive||0;
  while(S.visualFetchActive<3&&S.visualFetchQueue.length){
    const job=S.visualFetchQueue.shift();S.visualFetchActive++;
    (async()=>{
      let last;
      for(let attempt=0;attempt<4;attempt++){
        try{
          const res=await fetch(job.url,{mode:'cors',credentials:'omit'});
          if(res.status===429){last=new Error('commons_429');await new Promise(r=>setTimeout(r,900*(attempt+1)));continue;}
          if(!res.ok)throw new Error('commons_'+res.status);
          job.resolve(await res.json());return;
        }catch(err){last=err;if(attempt<3)await new Promise(r=>setTimeout(r,550*(attempt+1)));}
      }
      job.reject(last||new Error('commons_request_failed'));
    })().finally(()=>{S.visualFetchActive--;pumpVisualFetchQueue(S);});
  }
}
function queuedCommonsJson(S,url){
  return new Promise((resolve,reject)=>{S.visualFetchQueue=S.visualFetchQueue||[];S.visualFetchQueue.push({url,resolve,reject});pumpVisualFetchQueue(S);});
}
async function openverseResult(S,query){
  const params=new URLSearchParams({q:query,page_size:'8',mature:'false'});
  const data=await queuedCommonsJson(S,`${OPENVERSE_API}?${params.toString()}`);
  const rows=(data?.results||[]).filter(x=>x?.thumbnail&&x?.foreign_landing_url);
  const bad=['logo','icon','diagram','map','flag','stamp','drawing','illustration','painting','poster'];
  const qwords=String(query||'').toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>2);
  rows.sort((a,b)=>{
    const score=x=>{const t=String(x.title||'').toLowerCase();let n=0;for(const w of qwords)if(t.includes(w))n+=2;for(const w of bad)if(t.includes(w))n-=8;if(String(x.category||'').toLowerCase()==='photograph')n+=3;return n;};
    return score(b)-score(a);
  });
  const x=rows[0];if(!x)return null;
  const license=[String(x.license||'').toUpperCase(),x.license_version].filter(Boolean).join(' ');
  return {asset:x.thumbnail,source:x.foreign_landing_url,license:license||'Open license',credit:String(x.creator||x.source||'Openverse'),provider:'Openverse',query,resolved_at:Date.now()};
}
async function commonsResult(S,query){
  const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'8',prop:'imageinfo',iiprop:'url|extmetadata|mime',iiurlwidth:'1100',format:'json',origin:'*'});
  const data=await queuedCommonsJson(S,`${COMMONS_API}?${params.toString()}`),pages=Object.values(data?.query?.pages||{}).filter(p=>p?.imageinfo?.[0]);
  pages.sort((a,b)=>commonsScore(b,query)-commonsScore(a,query));
  const best=pages.find(p=>commonsScore(p,query)>-3);if(!best)return null;
  const info=best.imageinfo[0],md=info.extmetadata||{};
  const license=stripHtml(md.LicenseShortName?.value||md.UsageTerms?.value||'Wikimedia Commons');
  let artist=stripHtml(md.Artist?.value||md.Credit?.value||'Wikimedia Commons');if(artist.length>80)artist=artist.slice(0,77)+'…';
  return {asset:info.thumburl||info.url,source:info.descriptionurl||`https://commons.wikimedia.org/wiki/${encodeURIComponent(best.title)}`,license,credit:artist,provider:'Wikimedia Commons',query,resolved_at:Date.now()};
}
async function commonsVisual(S,key,query){
  const cache=readVisualCache(S);if(cache[key])return cache[key];
  if(S.visualPromises?.[key])return S.visualPromises[key];
  S.visualPromises=S.visualPromises||{};
  S.visualPromises[key]=(async()=>{
    let out=null;
    try{out=await openverseResult(S,query);}catch{}
    if(!out){try{out=await commonsResult(S,query);}catch{}}
    if(!out)throw new Error('open_image_no_match');
    cache[key]=out;writeVisualCache(S);return out;
  })().finally(()=>{delete S.visualPromises[key];});
  return S.visualPromises[key];
}
function visualCaption(fig,res){
  const cap=fig.querySelector('figcaption');if(!cap)return;
  cap.textContent='';const a=document.createElement('a');a.href=res.source;a.target='_blank';a.rel='noopener noreferrer';a.textContent=`${res.provider||'开放图库'} · ${res.license}`;
  cap.appendChild(a);if(res.credit){const span=document.createElement('span');span.textContent=` · ${res.credit}`;cap.appendChild(span);}
}
function markVisualMissing(fig,label='图片暂未载入'){
  fig.dataset.visualState='missing';fig.classList.remove('resolved');fig.classList.add('placeholder');
  const img=fig.querySelector('img');if(img){img.hidden=true;img.removeAttribute('src');}
  const cap=fig.querySelector('figcaption');if(cap)cap.textContent=label;
}
async function resolveVisualFigure(ctx,fig){
  if(!fig||fig.dataset.visualState==='loading'||fig.dataset.visualState==='loaded')return;
  const {S}=ctx,key=fig.dataset.visualKey,query=fig.dataset.visualQuery;if(!key||!query)return;
  fig.dataset.visualState='loading';
  try{
    const res=await commonsVisual(S,key,query),img=fig.querySelector('img');if(!img)throw new Error('visual_img_missing');
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=res.asset;img.hidden=false;});
    fig.dataset.visualState='loaded';fig.classList.remove('placeholder','loading');fig.classList.add('resolved');visualCaption(fig,res);
  }catch(err){markVisualMissing(fig,'公开图库暂未找到合适图片 · 已保留材料信息');}
}
function hydrateMaterialVisuals(ctx,root=document){
  const figs=qa('.material-visual[data-visual-query]',root).filter(x=>!x.dataset.visualState);
  if(!figs.length)return;
  let observer=ctx.S.visualObserver;
  if(!observer&&'IntersectionObserver'in window){
    observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){observer.unobserve(e.target);resolveVisualFigure(ctx,e.target);}}),{rootMargin:'700px 0px'});
    ctx.S.visualObserver=observer;
  }
  figs.forEach((fig,i)=>{if(i<18||!observer)resolveVisualFigure(ctx,fig);else observer.observe(fig);});
}
function materialVisual(ctx,kind,m,large=false){
  const {S,esc}=ctx,entry=visualEntry(S,kind,m);
  if(entry?.asset||entry?.local_asset){
    const asset=entry.local_asset||entry.asset;
    const illustrated=entry.image_type==='ai_illustration';
    const provider=illustrated?'AI 形态示意':entry.provider||'已核实材料图',license=illustrated?'非实物照片':entry.license||'',creditRaw=String(entry.creator||entry.credit||'').trim(),credit=illustrated||/\bunknown\b/i.test(creditRaw)?'':creditRaw;
    const label=[provider,license].filter(Boolean).join(' · ');
    const source=entry.source?`<a href="${esc(entry.source)}" target="_blank" rel="noopener noreferrer">${esc(label||'材料参考图')}</a>`:esc(label||'材料参考图');
    return `<figure class="material-visual resolved ${large?'large':''}" data-image-type="${illustrated?'ai_illustration':'reference_photo'}"><img src="${esc(asset)}" alt="${esc(m.name)}${illustrated?' AI 形态示意，非实物照片':'真实材料参考图'}" loading="lazy" decoding="async"><figcaption>${source}${credit?`<span> · ${esc(credit)}</span>`:''}</figcaption></figure>`;
  }
  const key=visualKey(kind,m),query=visualQuery(S,kind,m);
  const swatches=kind==='flower'?palette(m).map(c=>`<i style="--material-swatch:${COLOR_HEX[c]||'#b9b0a5'}"></i>`).join(''):'<i style="--material-swatch:#bbaea2"></i><i style="--material-swatch:#817388"></i>';
  return `<figure class="material-visual placeholder loading ${large?'large':''}" data-visual-key="${escAttr(key)}" data-visual-query="${escAttr(query)}" data-visual-state=""><img alt="${esc(m.name)}真实材料参考图" loading="lazy" decoding="async" crossorigin="anonymous" hidden><div class="material-visual-mark">${esc(String(m.name||'?').slice(0,1))}</div><div class="material-visual-swatches">${swatches}</div><figcaption>正在查找可复用真实图片…</figcaption></figure>`;
}
function currentUse(S,kind,id){
  if(!S.plan?.recipe)return null;
  const key=`${kind}:${id}`;
  return S.plan.recipe.find(r=>r.key===key)||null;
}
function flowerByName(S,name){return (S.catalog?.flowers||[]).find(x=>x.name===name||(x.aliases||[]).includes(name));}
function currentSeasonMatch(f,month){
  if((f.peak_months||[]).includes(month))return true;
  if(String(f.season||'').includes('全年'))return true;
  const map={春:[3,4,5],夏:[6,7,8],秋:[9,10,11],冬:[12,1,2]};
  return Object.entries(map).some(([k,months])=>String(f.season||'').includes(k)&&months.includes(month));
}
function seasonMatch(f,filter,month){
  if(!filter)return true;
  if(filter==='current')return currentSeasonMatch(f,month);
  return seasonMonths(filter).some(m=>(f.peak_months||[]).includes(m))||({spring:'春',summer:'夏',autumn:'秋',winter:'冬'}[filter]&&String(f.season||'').includes({spring:'春',summer:'夏',autumn:'秋',winter:'冬'}[filter]));
}
function makingMatch(f,filter){
  if(!filter)return true;
  if(filter==='beginner')return Boolean(f.beginner);
  if(filter==='vase')return f.vase_fit==='good';
  if(filter==='foam')return f.foam_fit==='good';
  if(filter==='water')return f.water_need==='high';
  if(filter==='fragile')return f.fragility==='high';
  if(filter==='pet')return Boolean(f.pet_risk);
  if(filter==='reference')return Boolean(f.reference_only);
  return true;
}
function searchMatch(m,kind,query){
  const q=String(query||'').trim().toLowerCase();
  if(!q)return true;
  const flowerFields=kind==='flower'?[m.name,...(m.aliases||[]),...(m.colors||[]),...(m.roles||[]),m.season,m.availability,m.market_tier,m.water_need,m.fragility,m.vase_fit,m.foam_fit,m.beginner?'新手':'',m.pet_risk,m.notes]:[];
  const creativeFields=kind==='creative'?[m.name,...(m.aliases||[]),m.category,m.food?'食品':'',m.wet_safe?'防水':'',...(m.fix||[]),m.notes]:[];
  return [...flowerFields,...creativeFields].filter(Boolean).join(' ').toLowerCase().includes(q);
}
function filteredItems(ctx){
  const {S,MONTH}=ctx,kind=S.libraryKind||'flower',filters=S.materialFilters||{},query=S.materialQuery||'';
  const items=kind==='creative'?(S.catalog?.creative||[]):(S.catalog?.flowers||[]);
  return items.filter(m=>searchMatch(m,kind,query))
    .filter(m=>kind!=='flower'||(!filters.role||(m.roles||[]).includes(filters.role)))
    .filter(m=>kind!=='flower'||(!filters.color||(m.colors||[]).includes(filters.color)))
    .filter(m=>kind!=='flower'||seasonMatch(m,filters.season,MONTH))
    .filter(m=>kind!=='flower'||makingMatch(m,filters.making));
}
function filterButton(label,group,value,current){return `<button class="library-filter ${current===value?'active':''}" data-filter-group="${group}" data-filter-value="${value}">${label}</button>`;}
function roleOptions(S){
  const set=new Set();(S.catalog?.flowers||[]).forEach(f=>(f.roles||[]).forEach(x=>set.add(x)));
  return ROLE_ORDER.filter(x=>set.has(x));
}
function colorOptions(S){
  const set=new Set();(S.catalog?.flowers||[]).forEach(f=>(f.colors||[]).forEach(x=>set.add(x)));
  return COLOR_ORDER.filter(x=>set.has(x));
}
function activeFilterCount(S){return Object.values(S.materialFilters||{}).filter(Boolean).length;}
function resetFilters(S){S.materialFilters={role:'',color:'',season:'',making:''};}
function materialCard(ctx,kind,m){
  const {S,esc}=ctx,use=currentUse(S,kind,m.id),ref=Boolean(m.reference_only);
  const meta=kind==='flower'?`${(m.roles||[]).slice(0,2).join(' · ')||'花材'} · ${m.season||'季节需核实'}`:`${m.category||'创意物料'} · ${m.food?'食品需隔离':'非食品'}`;
  return `<button class="material-card" data-material-detail="${kind}:${escAttr(m.id)}">
    ${materialVisual(ctx,kind,m,false)}
    <span class="material-card-body"><span class="material-card-topline"><b>${esc(m.name)}</b>${ref?'<em>参考条目</em>':''}</span><span class="material-card-meta">${esc(meta)}</span>${kind==='flower'?`<span class="material-card-colors">${(m.colors||[]).slice(0,5).map(c=>`<i style="--material-swatch:${COLOR_HEX[c]||'#aaa'}" title="${esc(c)}"></i>`).join('')}</span>`:''}${use?`<span class="material-current">当前作品 · ${use.quantity}${esc(use.unit)}</span>`:''}</span>
  </button>`;
}
function discovery(ctx){
  const {S,MONTH,esc}=ctx,flowers=S.catalog?.flowers||[],roles=roleOptions(S).slice(0,7),seasonal=flowers.filter(f=>currentSeasonMatch(f,MONTH)).slice(0,6);
  return `<section class="library-discovery"><div class="library-discovery-head"><div><div class="kicker">Browse</div><h2>从角色和当季材料开始。</h2></div><span>${monthLabel(MONTH)}</span></div><div class="library-role-links">${roles.map(r=>`<button data-quick-filter="role:${escAttr(r)}">${esc(r)}</button>`).join('')}</div>${seasonal.length?`<div class="library-seasonal"><div class="library-subhead"><b>这个月可以先看</b><button data-quick-filter="season:current">查看全部当季 →</button></div><div class="material-grid compact">${seasonal.map(m=>materialCard(ctx,'flower',m)).join('')}</div></div>`:''}</section>`;
}
function libraryPage(ctx){
  ctx.S.materialId=null;ctx.onNavigate?.(null);
  const {S,shell,esc}=ctx,kind=S.libraryKind||'flower',filters=S.materialFilters||{},items=filteredItems(ctx),filterCount=activeFilterCount(S),query=S.materialQuery||'';
  const count=kind==='flower'?(S.catalog?.flowers||[]).length:(S.catalog?.creative||[]).length;
  shell(`<main class="wrap workspace library-workspace"><header class="page-head library-page-head"><div><div class="kicker">Material Library / Botanical Archive</div><h1 class="page-title">材料库</h1><p class="page-sub">找材料、看现实属性、理解替代关系。没有可靠资料的地方会明确显示“需核实”。</p></div></header><section class="library-shell"><div class="library-toolbar"><div class="library-kind" role="tablist" aria-label="材料类型"><button class="${kind==='flower'?'active':''}" data-library-kind="flower">花材 <span>${S.catalog?.flowers?.length||0}</span></button><button class="${kind==='creative'?'active':''}" data-library-kind="creative">创意物料 <span>${S.catalog?.creative?.length||0}</span></button></div><label class="library-searchbox"><span>搜索</span><input id="materialSearch" value="${esc(query)}" placeholder="${kind==='flower'?'花名、别名、颜色、角色，例如：绣球 / 紫 / 线条':'物料、类别或固定方式，例如：玩偶 / 食品 / 托架'}" autocomplete="off"><button type="button" id="clearMaterialSearch" ${query?'':'hidden'}>清除</button></label></div>${kind==='flower'?`<div class="library-filters"><div class="library-filter-line"><b>角色</b><div>${filterButton('全部','role','',filters.role)}${roleOptions(S).map(x=>filterButton(x,'role',x,filters.role)).join('')}</div></div><div class="library-filter-line"><b>颜色</b><div>${filterButton('全部','color','',filters.color)}${colorOptions(S).map(x=>filterButton(x,'color',x,filters.color)).join('')}</div></div><div class="library-filter-line"><b>季节</b><div>${filterButton('全部','season','',filters.season)}${filterButton('当季','season','current',filters.season)}${filterButton('春','season','spring',filters.season)}${filterButton('夏','season','summer',filters.season)}${filterButton('秋','season','autumn',filters.season)}${filterButton('冬','season','winter',filters.season)}</div></div><details class="library-more" ${filters.making?'open':''}><summary>制作与现实${filters.making?' · 已选':''}</summary><div class="library-filter-line"><b>制作</b><div>${filterButton('全部','making','',filters.making)}${filterButton('新手友好','making','beginner',filters.making)}${filterButton('瓶插友好','making','vase',filters.making)}${filterButton('花泥友好','making','foam',filters.making)}${filterButton('高需水','making','water',filters.making)}${filterButton('易损','making','fragile',filters.making)}${filterButton('宠物信息','making','pet',filters.making)}${filterButton('参考条目','making','reference',filters.making)}</div></div></details></div>`:''}<div class="library-results-head"><div><b>${items.length}</b><span> / ${count} 项</span>${query?`<small>搜索“${esc(query)}”</small>`:''}</div>${filterCount||query?'<button id="resetLibrary">清除筛选</button>':''}</div>${!query&&!filterCount&&kind==='flower'?discovery(ctx):''}<div class="material-grid" id="libraryResults">${items.map(m=>materialCard(ctx,kind,m)).join('')||`<div class="library-empty"><div class="material-visual-mark">∅</div><h2>没有找到匹配材料。</h2><p>试试减少筛选条件，或换一个名称、别名、颜色、角色。</p><button id="emptyReset" class="secondary">清除筛选</button></div>`}</div></section></main>`,'materials');
  bindLibrary(ctx);
  hydrateMaterialVisuals(ctx);
}
function bindLibrary(ctx){
  const {S}=ctx,input=q('#materialSearch');
  if(input){input.oninput=()=>{S.materialQuery=input.value.trim();libraryPage(ctx);setTimeout(()=>{const n=q('#materialSearch');if(n){n.focus();try{n.setSelectionRange(n.value.length,n.value.length);}catch{}}},0);};}
  const clear=q('#clearMaterialSearch');if(clear)clear.onclick=()=>{S.materialQuery='';libraryPage(ctx);};
  qa('[data-library-kind]').forEach(b=>b.onclick=()=>{S.libraryKind=b.dataset.libraryKind;S.materialQuery='';resetFilters(S);libraryPage(ctx);});
  qa('[data-filter-group]').forEach(b=>b.onclick=()=>{S.materialFilters={role:'',color:'',season:'',making:'',...(S.materialFilters||{})};S.materialFilters[b.dataset.filterGroup]=b.dataset.filterValue;libraryPage(ctx);});
  qa('[data-material-detail]').forEach(b=>b.onclick=()=>detailPage(ctx,b.dataset.materialDetail));
  qa('[data-quick-filter]').forEach(b=>b.onclick=()=>{const [g,v]=b.dataset.quickFilter.split(':');S.materialFilters={role:'',color:'',season:'',making:'',...(S.materialFilters||{})};S.materialFilters[g]=v;libraryPage(ctx);});
  const reset=()=>{S.materialQuery='';resetFilters(S);libraryPage(ctx);};
  const rr=q('#resetLibrary');if(rr)rr.onclick=reset;const er=q('#emptyReset');if(er)er.onclick=reset;
}
function timeline(months=[]){
  const active=new Set(months||[]);return `<div class="season-timeline">${Array.from({length:12},(_,i)=>i+1).map(m=>`<span class="${active.has(m)?'active':''}"><i></i><b>${String(m).padStart(2,'0')}</b></span>`).join('')}</div>`;
}
function usePanel(ctx,kind,m){
  const {S,esc}=ctx,use=currentUse(S,kind,m.id);if(!use)return '';
  return `<aside class="material-project-use"><div><span>当前作品正在使用</span><b>${use.quantity}${esc(use.unit)} · 已有 ${use.owned}${esc(use.unit)} · 还需 ${use.to_buy}${esc(use.unit)}</b></div><button id="returnRecipe">回到 Recipe →</button></aside>`;
}
function flowerDetail(ctx,m){
  const {S,esc}=ctx,ref=Boolean(m.reference_only),subs=(m.substitutes||[]).map(n=>flowerByName(S,n)).filter(Boolean),months=m.peak_months||[],pet=petRiskInfo(m.pet_risk,ref);
  return `<section class="material-detail-layout"><div>${materialVisual(ctx,'flower',m,true)}</div><article class="material-detail-copy"><div class="material-detail-title"><div><div class="kicker">${ref?'Reference Material':'Core Material'}</div><h1>${esc(m.name)}</h1><p>${esc((m.aliases||[]).join(' / ')||'FloraLab 材料档案')}</p></div><button class="material-back" data-library-back>← 材料库</button></div>${ref?'<div class="material-trust reference"><b>参考条目</b><p>这项材料可用于初步检索，但季节、价格、宠物风险和结构适配中未知的部分必须在采购或制作前核实。</p></div>':''}${usePanel(ctx,'flower',m)}<section class="material-section"><div class="material-section-head"><span>01</span><h2>角色与颜色</h2></div><div class="material-role-row">${(m.roles||[]).map(x=>`<span>${esc(x)}</span>`).join('')||'<span>角色需核实</span>'}</div><div class="material-color-row">${(m.colors||[]).map(c=>`<span><i style="--material-swatch:${COLOR_HEX[c]||'#aaa'}"></i>${esc(c)}</span>`).join('')||'<span>颜色资料不足</span>'}</div></section><section class="material-section"><div class="material-section-head"><span>02</span><h2>形态</h2></div><dl class="material-spec-grid"><div><dt>枝长</dt><dd>${rangeLabel(m.stem_cm,'cm')}</dd></div><div><dt>花头</dt><dd>${rangeLabel(m.head_cm,'cm')}</dd></div><div><dt>重量</dt><dd>${valLabel(m.weight)}</dd></div><div><dt>茎强度</dt><dd>${valLabel(m.stem_strength)}</dd></div><div><dt>脆弱度</dt><dd>${valLabel(m.fragility)}</dd></div><div><dt>市场等级</dt><dd>${esc(m.market_tier||'需核实')}</dd></div></dl></section><section class="material-section"><div class="material-section-head"><span>03</span><h2>制作</h2></div><dl class="material-spec-grid"><div><dt>需水</dt><dd>${valLabel(m.water_need)}</dd></div><div><dt>瓶插</dt><dd>${valLabel(m.vase_fit)}</dd></div><div><dt>花泥</dt><dd>${valLabel(m.foam_fit)}</dd></div><div><dt>新手</dt><dd>${beginnerLabel(m.beginner)}</dd></div></dl>${m.notes?`<p class="material-notes">${esc(m.notes)}</p>`:''}</section><section class="material-section"><div class="material-section-head"><span>04</span><h2>季节</h2></div><div class="material-season-copy"><b>${esc(m.season||'季节需核实')}</b><span>${esc(m.availability||'供应信息需核实')}</span></div>${months.length?timeline(months):'<p class="material-unknown">暂无可靠高峰月份数据。</p>'}</section><section class="material-section"><div class="material-section-head"><span>05</span><h2>现实提醒</h2></div>${`<div class="material-trust ${pet.tone==='note'?'':pet.tone}"><b>${esc(pet.label)}</b><p>${esc(pet.text)}</p></div>`}<div class="material-price-note"><b>静态参考价 ${priceLabel(m.price)}</b><span>真实采购价会随城市、季节、节日和等级变化。</span></div></section><section class="material-section"><div class="material-section-head"><span>06</span><h2>替代材料</h2></div>${subs.length?`<div class="material-substitutes">${subs.map(x=>`<button data-substitute-id="${escAttr(x.id)}"><b>${esc(x.name)}</b><span>${esc((x.roles||[]).slice(0,2).join(' · ')||x.season||'')}</span></button>`).join('')}</div>`:'<p class="material-unknown">当前资料没有可靠替代关系。</p>'}</section></article></section>`;
}
function creativeDetail(ctx,m){
  const {esc}=ctx;
  return `<section class="material-detail-layout creative-detail"><div>${materialVisual(ctx,'creative',m,true)}</div><article class="material-detail-copy"><div class="material-detail-title"><div><div class="kicker">Creative Material</div><h1>${esc(m.name)}</h1><p>${esc(m.category||'创意物料')}</p></div><button class="material-back" data-library-back>← 材料库</button></div>${usePanel(ctx,'creative',m)}<section class="material-section"><div class="material-section-head"><span>01</span><h2>现实属性</h2></div><dl class="material-spec-grid"><div><dt>类别</dt><dd>${esc(m.category||'—')}</dd></div><div><dt>重量</dt><dd>${rangeLabel(m.weight_g,'g')}</dd></div><div><dt>湿区</dt><dd>${m.wet_safe?'可接近湿区，仍需视包装判断':'避免花水 / 湿花泥'}</dd></div><div><dt>食品</dt><dd>${m.food?'是 · 与花水和花泥隔离':'否'}</dd></div></dl></section><section class="material-section"><div class="material-section-head"><span>02</span><h2>固定方式</h2></div><div class="creative-fix-list">${(m.fix||[]).map((x,i)=>`<div><span>${String(i+1).padStart(2,'0')}</span><p>${esc(x)}</p></div>`).join('')||'<p>暂无可靠固定资料。</p>'}</div></section><section class="material-section"><div class="material-section-head"><span>03</span><h2>制作提醒</h2></div>${m.food?'<div class="material-trust safety"><b>食品隔离</b><p>保持原包装或独立食品级包装，避免与花材污水、花泥和处理液直接接触。</p></div>':''}<p class="material-notes">${esc(m.notes||'暂无补充说明。')}</p><div class="material-price-note"><b>静态参考价 ${priceLabel(m.price)}</b><span>只用于方案内相对估算，不代表实时采购价格。</span></div></section></article></section>`;
}
function detailPage(ctx,key){
  const {S,shell}=ctx,[kind,id]=String(key||'').split(':'),list=kind==='creative'?(S.catalog?.creative||[]):(S.catalog?.flowers||[]),m=list.find(x=>x.id===id);
  if(!m){S.materialQuery='';libraryPage(ctx);return;}
  S.libraryKind=kind==='creative'?'creative':'flower';S.materialId=key;ctx.onNavigate?.(key);
  shell(`<main class="wrap workspace material-detail-workspace">${kind==='creative'?creativeDetail(ctx,m):flowerDetail(ctx,m)}</main>`,'materials');
  window.scrollTo({top:0,behavior:'instant'});
  hydrateMaterialVisuals(ctx);
  qa('[data-library-back]').forEach(b=>b.onclick=()=>libraryPage(ctx));
  qa('[data-substitute-id]').forEach(b=>b.onclick=()=>detailPage(ctx,`flower:${b.dataset.substituteId}`));
  const rr=q('#returnRecipe');if(rr)rr.onclick=()=>ctx.openRecipe();
}
function render(ctx,detailKey=null){
  ctx.S.materialFilters={role:'',color:'',season:'',making:'',...(ctx.S.materialFilters||{})};
  if(detailKey)return detailPage(ctx,detailKey);
  return libraryPage(ctx);
}
window.FloraLabLibrary={render,detail:detailPage};
})();
