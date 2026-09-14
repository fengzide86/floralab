const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const app=$('#app');
const MONTH=new Date().getMonth()+1;
const S={page:'home',mode:'floral',plan:null,tab:'work',view:'front',selectedNode:null,buildStep:0,compareBranchId:null,status:null,catalog:null,visualRegistry:{items:{}},visualQueries:{items:{}},visualSources:{items:{}},visualCache:null,visualPromises:{},materialQuery:'',libraryKind:'flower',materialFilters:{role:'',color:'',season:'',making:''},materialId:null,projects:[],installPrompt:null,form:{idea:'',type:'花束',colors:[],budget:0,budgetPriority:'balance',style:'',existing:'',size:'medium',designMonth:MONTH,region:'',preferred:'',avoid:'',petContext:'',mechanicPreference:''}};
const COLORS=[['紫色','#9c87aa'],['白色','#f8f5ee'],['粉色','#ddb0b8'],['红色','#a95b57'],['蓝色','#89a7b8'],['黄色','#dcc36a'],['橙色','#cf8d60'],['绿色','#7d9277'],['奶油色','#e6d7b9'],['黑色','#39373b']];
const TYPES=['花束','瓶插','桌花','花篮','礼盒','创意花束','创意装置'];
const STYLES=['自然','温柔','极简','法式','日式','复古','清冷','热烈'];
const VIEW_NAMES={front:'正面',left:'左侧',back:'背面',right:'右侧',top:'俯视'};
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function money(n){return `¥${Math.round(Number(n||0))}`;}
function toast(msg){document.querySelectorAll('.toast').forEach(n=>n.remove());const n=document.createElement('div');n.className='toast';n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),2600);}
async function api(url,opts={}){if(!window.FloraLabRuntime)throw new Error('Studio runtime 未加载');return window.FloraLabRuntime.request(url,opts);}
function cleanTitle(s=''){return String(s).replace(/\s*·\s*Reality Ready.*$/,'').trim();}
function colorHex(name,i=0){const map=Object.fromEntries(COLORS);return map[name]||['#a68baa','#f2eee5','#8ba487','#c3a87c'][i%4];}
const {projection,projectionConfig,renderBlueprint,nodeInfo,editorControls,structureTab}=window.FloraLabBlueprintViews.create({state:S,esc,colorHex,viewNames:VIEW_NAMES});
const {renderSpecFor,renderRenderView,renderHandoffTab}=window.FloraLabRenderViews.create({esc,colorHex,viewNames:VIEW_NAMES,buildRenderSpec:window.FloraLabRuntime.Studio.buildRenderSpec});
const Records=window.FloraLabRuntime.Records;
const Storage=window.FloraLabStorage.create({state:S,cleanTitle,onStatus:status=>{const e=$('#saveState');if(e){e.textContent=status.label;e.dataset.tone=status.tone;}}});
const {idbPut,idbGet,idbAll,snapshot,save,load}=Storage;
const Drafts=window.FloraLabDrafts.create();
const emptyForm=()=>({idea:'',type:'花束',colors:[],budget:0,budgetPriority:'balance',style:'',existing:'',size:'medium',designMonth:MONTH,region:'',preferred:'',avoid:'',petContext:'',mechanicPreference:''});
let draftMemory=null,draftStatus=null;
function readDraft(){const value=Drafts.read();if(value.ok){draftMemory=value.draft;draftStatus=null;}else draftStatus=value.message;return draftMemory;}
function persistDraft(){
  if(S.page!=='create'||!$('#idea'))return;
  sync();draftMemory={form:{...S.form,colors:[...S.form.colors]},mode:S.mode};
  const saved=Drafts.save(draftMemory);draftStatus=saved.ok?null:saved.message;if(saved.ok)draftMemory=saved.draft;
  const status=$('#draftState');if(status){status.textContent=draftStatus||(draftMemory?'草稿已自动保存在本机':'写下想法后，会自动保存草稿');status.dataset.tone=draftStatus?'error':'saved';}
}
const Navigation=window.FloraLabNavigation.create({window,onError:()=>toast('页面没有打开，请从首页重新进入。'),onNavigate:async(route,{isCurrent})=>{
  persistDraft();
  if(route.page==='home')return home();
  if(route.page==='create')return newDraft();
  if(route.page==='materials')return materials(route.materialId||null);
  const opened=await Storage.openProject(route.projectId,{isCurrent});if(!isCurrent())return;
  if(!opened){Navigation.record({page:'home'},{replace:true});home();toast('这件作品不在当前设备，请先导入 .floralab 文件。');return;}
  S.tab=route.tab;S.buildStep=S.plan.build?.currentStep||0;S.compareBranchId=null;result();
}});
function rememberLocation(){if(S.plan)Storage.setLocation({projectId:S.plan.id,tab:S.tab}).catch(()=>{});}
const Media=window.FloraLabMedia.create({storage:Storage,records:Records});
const MediaViews=window.FloraLabMediaViews.create({esc,media:Media});
const {workTab,recipeTab,printSheet}=window.FloraLabWorkViews.create({state:S,esc,money,cleanTitle,colorHex,renderBlueprint,mediaViews:MediaViews});
const {stepTitle,stepMaterials,buildTab,feedbackTab,historyTab}=window.FloraLabMakingViews.create({state:S,esc,renderBlueprint,mediaViews:MediaViews});
const Workflow=window.FloraLabWorkflow.create({state:S,storage:Storage,records:Records,media:Media,mediaViews:MediaViews,studio:window.FloraLabRuntime.Studio,esc,toast,render:result,home});
const GROUPS=[{key:'ideas',label:'想法与方案',tabs:[['work','总览'],['explore','比较方向'],['render','效果图']]},{key:'prepare',label:'材料与准备',tabs:[['recipe','材料清单']]},{key:'making',label:'动手制作',tabs:[['structure','摆放施工图'],['build','制作步骤']]},{key:'record',label:'成品与记录',tabs:[['feedback','成品照片'],['history','修改与恢复']]}];

const Shell=window.FloraLabShell.create({
  state:S,
  onNavigate:p=>{
    if(p==='home')home();
    else if(p==='create')newDraft();
    else if(p==='materials')materials();
    else if(p==='render'){
      if(S.plan){S.tab='render';result();}
      else openRenderWorkspaceIntro();
    }else if(S.plan)result();
    else create();
    window.scrollTo(0,0);
  },
  onCreativeSpace:()=>openCreativeSpace(),
  onInstall:()=>installApp(),
  onHelp:()=>window.FloraLabGuide.open()
});
function shell(body,active=''){Shell.render(body,active);}
function openRenderWorkspaceIntro(){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><section class="modal"><div class="kicker">Render Handoff</div><h2>效果图工作区在作品里面。</h2><p>它会读取当前 Recipe、Mechanics 和 Blueprint，锁定材料、颜色、数量与主要结构。先新建或导入一件作品，之后顶部“效果图”和作品内“效果图”标签都可以直接进入。</p><div class="modal-actions"><button class="secondary" id="closeModal">关闭</button><button class="primary" id="renderIntroCreate">开始一个作品</button></div></section></div>`); $('#closeModal').onclick=()=>$('#modal').remove();$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').remove();};$('#renderIntroCreate').onclick=()=>{$('#modal').remove();create();};}
function openCreativeSpace(){const has=Boolean(S.plan);document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><section class="modal"><div class="kicker">Creative Space</div><h2>${has?'继续这件作品':'从一个想法开始'}</h2><p>${has?'复制当前摘要，带回你的 FloraLab 创作空间继续讨论视觉与灵感。':'创作空间负责灵感、参考图和视觉稿；Studio 负责材料、成本与施工结构。'}</p><div class="modal-actions"><button class="secondary" id="closeModal">关闭</button>${has?'<button class="primary" id="modalCopy">复制作品摘要</button>':''}</div></section></div>`);$('#closeModal').onclick=()=>$('#modal').remove();$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').remove();};if(has)$('#modalCopy').onclick=async()=>{await copyBrief();$('#modal').remove();};}
function home(){
  persistDraft();if(!draftMemory&&!draftStatus)readDraft();
  S.page='home';
  const cover=p=>MediaViews.cover(p)||`<figure class="project-placeholder">${window.FloraLabDirectionPreview.render(p,{view:'front',label:'摆放示意',esc})}<figcaption>摆放示意 · 尚未设置照片</figcaption></figure>`;
  shell(window.FloraLabHomeView.render({state:S,draft:draftMemory,draftError:draftStatus,esc,cover,stageLabel:p=>(Workflow.selected(p)?'制作方案 · ':'')+Records.STAGES[Records.stage(p)]}));
  $('#newDesign').onclick=newDraft;$('#importFile').onchange=importPlan;
  if($('#resumeDraft'))$('#resumeDraft').onclick=newDraft;if($('#freshDraft'))$('#freshDraft').onclick=discardDraft;
  const filter=$('#projectFilter'),query=$('#projectQuery');if(filter)filter.onchange=()=>{S.projectFilter=filter.value;home();};if(query)query.onchange=()=>{S.projectQuery=query.value;home();};
  $$('[data-open-project]').forEach(b=>b.onclick=async()=>{try{
    if(!await Storage.openProject(b.dataset.openProject))return toast('没有找到这件本机作品');
    S.buildStep=S.plan.build?.currentStep||0;S.compareBranchId=null;result();window.scrollTo(0,0);
  }catch(error){toast(error.message);}});Media.hydrate();Navigation.record({page:'home'});
}
function newDraft(){persistDraft();const draft=draftMemory||readDraft();S.form={...emptyForm(),...draft?.form};S.mode=draft?.mode||'floral';create();}
function discardDraft(){window.FloraLabDialog.open({title:'从一个新想法开始？',body:'<p>这会清除尚未生成方案的草稿。已经保存的作品会继续保留。</p>',confirm:'清除草稿，重新开始',onConfirm:()=>{const cleared=Drafts.clear();if(!cleared.ok)throw new Error(cleared.message);draftMemory=null;draftStatus=null;S.page='home';S.form=emptyForm();S.mode='floral';create();}});}
function create(){
  S.page='create';
  shell(window.FloraLabCreateView.render({state:S,colors:COLORS,types:TYPES,styles:STYLES,esc}),'create');
  $$('[data-mode]').forEach(b=>b.onclick=()=>{sync();S.mode=b.dataset.mode;if(S.mode==='creative'&&S.form.type==='花束')S.form.type='创意花束';persistDraft();create();});
  $$('[data-type]').forEach(b=>b.onclick=()=>{S.form.type=b.dataset.type;$$('[data-type]').forEach(x=>x.classList.toggle('active',x===b));});
  $$('[data-color]').forEach(b=>b.onclick=()=>{const c=b.dataset.color;S.form.colors=S.form.colors.includes(c)?S.form.colors.filter(x=>x!==c):[...S.form.colors,c].slice(-4);b.classList.toggle('active');});
  $$('[data-style]').forEach(b=>b.onclick=()=>{const x=b.dataset.style;let arr=String($('#style').value||'').split(/[、,，]/).map(s=>s.trim()).filter(Boolean);arr=arr.includes(x)?arr.filter(v=>v!==x):[...arr,x];$('#style').value=arr.join('、');b.classList.toggle('active');});
  $('#generate').onclick=generate;$('#useExample').onclick=()=>{$('#idea').value='做一件白绿的桌花，不要玫瑰，想要自然、有空隙。';$('#idea').focus();};
  const form=$('.design-form');form.addEventListener('input',persistDraft);form.addEventListener('change',persistDraft);
  form.addEventListener('click',e=>{if(e.target.closest('[data-type],[data-color],[data-style],#useExample'))persistDraft();});
  const status=$('#draftState');status.textContent=draftStatus||(draftMemory?'草稿已恢复，可接着写':'写下想法后，会自动保存草稿');status.dataset.tone=draftStatus?'error':'saved';
  Navigation.record({page:'create'});
}
function sync(){for(const id of ['idea','budget','style','existing','size','budgetPriority','designMonth','region','preferred','avoid','petContext','mechanicPreference']){const e=$('#'+id);if(e)S.form[id]=e.value;}S.form.budget=Number(S.form.budget||0);S.form.designMonth=Number(S.form.designMonth||MONTH);}
async function generate(){
  persistDraft();const error=$('#intentError');error.textContent='';
  if(!S.form.idea.trim()&&!S.form.existing.trim()&&!S.form.preferred.trim()){error.textContent='先写一句想法，或补充已经确定的材料。';$('#idea').focus();return;}
  const b=$('#generate');b.disabled=true;b.textContent='正在整理…';
  try{
    const input={...S.form,mode:S.mode,intentVersion:1};
    const report=window.FloraLabRuntime.Intent.inspect(S.designCatalog,input);if(report.conflicts.length)throw new Error(report.conflicts.join('；'));
    let plan=await api('/api/design/generate',{method:'POST',body:JSON.stringify(input)});
    plan=window.FloraLabRuntime.Studio.updateExploration(plan,{locks:{materials:true,colors:true,quantities:true,vessel:true,special_objects:true,packaging:true,mechanics:true,structure:false}});
    plan.workflow={stage:'exploring'};await Storage.commitPlan(plan);S.page='result';const cleared=Drafts.clear();draftMemory=null;draftStatus=cleared.ok?null:cleared.message;S.tab='work';S.view='front';S.buildStep=0;S.compareBranchId=null;S.selectedNode=plan.blueprint?.nodes?.[0]?.id||null;result();window.scrollTo(0,0);
  }catch(e){error.textContent=e.message;error.scrollIntoView({block:'nearest'});b.disabled=false;b.textContent='整理想法，查看方案 →';}
}
function result(){
  persistDraft();
  if(!S.plan)return create();S.page='result';const p=S.plan,group=GROUPS.find(g=>g.tabs.some(([k])=>k===S.tab))||GROUPS[0],stage=Records.stage(p);
  shell(`<main class="wrap project product-project"><header class="product-head"><div class="project-identity"><span class="stage-badge">${Workflow.selected()?'制作方案 · ':''}${Records.STAGES[stage]}</span><h1 class="project-title">${esc(cleanTitle(p.title))}<button id="renameProject" class="rename-project" aria-label="修改作品名称">改名</button></h1><p class="project-sub">${esc(p.exploration?.branch?.label||'主线')} · ${esc(p.type)} · ${esc((p.palette||[]).join(' / '))}</p><span id="saveState" role="status" data-tone="${S.saveStatus?.tone||'saved'}">${esc(S.saveStatus?.label||'已保存在本机')}</span></div><div class="project-actions"><button id="copyBrief">复制摘要</button><button id="exportPlan">导出设计与图片</button><button id="printPlan">打印制作单</button><details class="more-actions"><summary>更多</summary><button id="exportTextOnly">仅导出材料与结构</button><button data-workflow-stage="exploring">改为探索中</button></details></div></header><nav class="workflow-groups" aria-label="创作阶段">${GROUPS.map(g=>`<button data-group="${g.key}" aria-current="${g===group?'page':'false'}">${g.label}</button>`).join('')}</nav><nav class="tabs workflow-tabs" aria-label="作品工作区">${GROUPS.flatMap(g=>g.tabs.map(([k,n])=>`<button data-tab="${k}" ${g!==group?'hidden':''} class="${S.tab===k?'active':''}">${n}</button>`)).join('')}</nav><div id="tabBody"></div><section id="printSheet" class="print-sheet">${printSheet(p)}</section></main>`,'work');
  $$('[data-group]').forEach(b=>b.onclick=()=>{S.tab=GROUPS.find(g=>g.key===b.dataset.group).tabs[0][0];result();});
  $$('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;result();});
  renderTab();$('#copyBrief').onclick=copyBrief;$('#exportPlan').onclick=exportPlan;$('#printPlan').onclick=()=>window.print();
  Navigation.record({page:'result',projectId:S.plan.id,tab:S.tab});rememberLocation();
}
function renderTab(){
  if(S.tab==='structure'){const nodes=S.plan?.blueprint?.nodes||[];if(!nodes.some(n=>n.id===S.selectedNode))S.selectedNode=nodes[0]?.id||null;}
  const host=$('#tabBody'),p=S.plan;
  if(S.tab==='work')host.innerHTML=workTab(p);
  if(S.tab==='explore')host.innerHTML=exploreTab(p).replace('<details class="panel explore-locks">',MediaViews.gallery(p,'reference')+'<details class="panel explore-locks">');
  if(S.tab==='recipe')host.innerHTML=recipeTab(p)+`<div class="workspace-next"><button class="primary" data-workflow-stage="making">准备好了，开始制作 →</button></div>`;
  if(S.tab==='structure')host.innerHTML=structureTab(p);
  if(S.tab==='render')host.innerHTML=MediaViews.gallery(p,'render')+renderHandoffTab(p);
  if(S.tab==='build')host.innerHTML=buildTab(p);
  if(S.tab==='feedback')host.innerHTML=feedbackTab(p);
  if(S.tab==='history')host.innerHTML=historyTab(p);
  bindTab();Workflow.bind();
}
function variationOptionsFor(p){return window.FloraLabRuntime?.Studio?.variationOptions?.(p)||[];}
function branchSummary(p,updatedAt=''){
  const spec=renderSpecFor(p),flowerCount=(p.recipe||[]).filter(x=>x.kind==='flower').reduce((s,x)=>s+Number(x.quantity||0),0);
  return {project_id:p.id,label:p.exploration?.branch?.label||'主线',intent:p.compositionIntent?.label||p.exploration?.lastVariation?.label||'原始方向',silhouette:spec?.structure?.silhouette?.label||'—',mass:spec?.structure?.visual_mass?.horizontal||'—',flowerCount,materialCount:(p.recipe||[]).filter(x=>['flower','creative'].includes(x.kind)&&Number(x.quantity||0)>0).length,updatedAt};
}
function familyBranches(p){
  const family=p.exploration?.branch?.family_id||p.id,seen=new Set(),rows=[];
  const all=[{id:p.id,updatedAt:new Date().toISOString(),state:{plan:p}},...(S.projects||[])];
  for(const row of all){const q=row.state?.plan;if(!q||seen.has(q.id))continue;const qFamily=q.exploration?.branch?.family_id||q.id;if(qFamily!==family)continue;seen.add(q.id);rows.push(branchSummary(q,row.updatedAt||''));}
  return rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
function branchPlanById(id){if(S.plan?.id===id)return S.plan;return (S.projects||[]).find(x=>x.id===id)?.state?.plan||null;}
function branchDiff(a,b){
  const map=x=>new Map((x.recipe||[]).filter(r=>['flower','creative'].includes(r.kind)).map(r=>[r.key,r]));
  const A=map(a),B=map(b),keys=new Set([...A.keys(),...B.keys()]),changes=[];
  for(const key of keys){const x=A.get(key),y=B.get(key),name=y?.name||x?.name||key;if(!x)changes.push(`${name}：新增 ${y.quantity}${y.unit||''}`);else if(!y)changes.push(`${name}：移除`);else if(Number(x.quantity)!==Number(y.quantity))changes.push(`${name}：${x.quantity} → ${y.quantity}${y.unit||''}`);else if(String(x.variant||'')!==String(y.variant||''))changes.push(`${name}：${x.variant||'—'} → ${y.variant||'—'}`);}
  return changes.slice(0,10);
}
function exploreTab(p){
  const options=variationOptionsFor(p).map(option=>({...option,plan:option.enabled&&S.designCatalog?window.FloraLabRuntime.Studio.previewVariation(S.designCatalog,p,option.key):null})),branches=familyBranches(p).map(branch=>({...branch,plan:branchPlanById(branch.project_id)}));let compare=null;
  if(S.compareBranchId){const target=branchPlanById(S.compareBranchId);if(target&&target.id!==p.id)compare={current:branchSummary(p),target:branchSummary(target),changes:branchDiff(p,target)};}
  if(compare){compare.current.plan=p;compare.target.plan=branchPlanById(S.compareBranchId);}
  return window.FloraLabExploreView.render({plan:p,options,branches,compare,view:S.exploreView||'front',compareSide:S.compareSide||'a',esc});
}


function bindTab(){
  $$('[data-material-detail]').forEach(b=>b.onclick=()=>materials(b.dataset.materialDetail));
  $$('[data-tabjump]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tabjump;result();});
  if(S.tab==='explore'){
    $$('[data-explore-lock]').forEach(b=>b.onclick=()=>updateExplorationLock(b.dataset.exploreLock,b.getAttribute('aria-pressed')!=='true'));
    $$('[data-variation]').forEach(b=>b.onclick=()=>createVariation(b.dataset.variation));
    $$('[data-open-branch]').forEach(b=>b.onclick=()=>openBranch(b.dataset.openBranch));
    $$('[data-compare-branch]').forEach(b=>b.onclick=()=>{S.compareBranchId=b.dataset.compareBranch;renderTab();$('.branch-compare')?.scrollIntoView({block:'start'});});
    $$('[data-compare-side]').forEach(b=>b.onclick=()=>{S.compareSide=b.dataset.compareSide;renderTab();$('.branch-compare')?.scrollIntoView({block:'start'});});
    $$('[data-explore-view]').forEach(b=>b.onclick=()=>{S.exploreView=b.dataset.exploreView;renderTab();});
    const close=$('#closeBranchCompare');if(close)close.onclick=()=>{S.compareBranchId=null;renderTab();};
  }
  if(S.tab==='recipe'){$$('.recipe-row').forEach(row=>{const key=row.dataset.key,q=$('[data-qty]',row),o=$('[data-owned]',row),pr=$('[data-price]',row);$('[data-minus]',row).onclick=()=>{q.value=Math.max(0,Number(q.value)-1);patchRow(key,row)};$('[data-plus]',row).onclick=()=>{q.value=Number(q.value)+1;patchRow(key,row)};[q,o,pr].forEach(e=>e.onchange=()=>patchRow(key,row));});}
  if(S.tab==='recipe'){$('#copyPurchase').onclick=copyPurchase;$('#printPurchase').onclick=()=>window.print();}
  if(S.tab==='structure'){bindStructure();}
  if(S.tab==='render'){const c=$('#copyRenderHandoff'),e=$('#exportRenderPlan');if(c)c.onclick=copyRenderHandoff;if(e)e.onclick=exportPlan;}
  if(S.tab==='build'){
    const next=()=>{if(S.buildStep>=S.plan.steps.length-1){S.tab='feedback';result();window.scrollTo(0,0);return;}updateBuild({currentStep:S.buildStep+1,completeStep:S.buildStep},false);};
    const prev=()=>updateBuild({currentStep:Math.max(0,S.buildStep-1)},false);
    $$('[data-step]').forEach(b=>b.onclick=()=>updateBuild({currentStep:Number(b.dataset.step)},false));$('#prevStep').onclick=prev;$('#nextStep').onclick=next;
    $$('[data-step-next]').forEach(b=>b.onclick=next);$$('[data-step-back]').forEach(b=>b.onclick=prev);
    $$('[data-prepared]').forEach(c=>c.onchange=()=>updateBuild({prepared:c.dataset.prepared,checked:c.checked}));
    $('#undoBuild').onclick=()=>updateBuild({undo:true});
    $$('[data-build-key]').forEach(row=>{const key=row.dataset.buildKey;$$('[data-use]',row).forEach(b=>b.onclick=()=>updateBuild({key,useDelta:Number(b.dataset.use)}));$$('[data-loss]',row).forEach(b=>b.onclick=()=>updateBuild({key,lossDelta:Number(b.dataset.loss)}));$('[data-used-input]',row).onchange=e=>updateBuild({key,used:Number(e.target.value)});$('[data-loss-input]',row).onchange=e=>updateBuild({key,loss:Number(e.target.value)});});
  }
  if(S.tab==='feedback')$('#saveFeedback').onclick=saveFeedback;
  if(S.tab==='history')$('#restoreBackup').onclick=restoreBackup;
}
function svgWorldPoint(svg,e){const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const m=svg.getScreenCTM();return m?pt.matrixTransform(m.inverse()):pt;}
function screenToWorld(plan,view,pt,node){const {scale,cx,baseY}=projectionConfig(plan,view);const a=(pt.x-cx)/scale,b=view==='top'?(pt.y-280)/scale:(baseY-pt.y)/scale;const out={x:node.x,y:node.y,z:node.z};if(view==='front'){out.x=a;out.z=b;}if(view==='back'){out.x=-a;out.z=b;}if(view==='left'){out.y=a;out.z=b;}if(view==='right'){out.y=-a;out.z=b;}if(view==='top'){out.x=a;out.y=-b;}return out;}
function bindStructure(){
  window.FloraLabStructure.bind({root:$('#tabBody'),state:S,
    select:id=>{S.selectedNode=id;renderStructure();},render:renderStructure,update:updateBlueprint,
    worldPoint:svgWorldPoint,toWorld:screenToWorld,config:projectionConfig,project:projection,toast});
  $('#structureHelp').onclick=()=>window.FloraLabGuide.open('structure');
}
function renderStructure(){
  const scroll=window.scrollY,opened=$('.precise-controls')?.open,step=$('#moveStep')?.value;
  renderTab();if($('.precise-controls'))$('.precise-controls').open=Boolean(opened);
  if(step&&$('#moveStep'))$('#moveStep').value=step;
  window.scrollTo(0,scroll);
}

async function updateExplorationLock(key,value){
  try{await Storage.commitPlan(await api('/api/design/update-exploration',{method:'POST',body:JSON.stringify({plan:S.plan,patch:{locks:{[key]:value}}})}));S.tab='explore';renderTab();}catch(e){toast(`锁定没有更新：${e.message}`);}
}
async function createVariation(preset){
  try{const original=S.plan,preview=window.FloraLabRuntime.Studio.previewVariation(S.designCatalog,original,preset),changes=branchDiff(original,preview);
    window.FloraLabDialog.open({title:'先看变化，再保存方案',body:`<p>${esc(preview.compositionIntent.label)}：${esc(preview.compositionIntent.summary)}</p>${window.FloraLabDirectionPreview.render(preview,{view:S.exploreView||'front',label:preview.compositionIntent.label,esc})}<div class="variation-diff">${changes.length?changes.map(x=>`<p>${esc(x)}</p>`).join(''):'<p>材料、颜色和数量保持不变，只调整允许变化的结构。</p>'}</div><p>保存后会多一份备选方案，当前方案仍会保留。</p>`,confirm:'保存为另一个方案',onConfirm:async()=>{
      let plan=await api('/api/design/variation',{method:'POST',body:JSON.stringify({plan:original,preset})});plan.workflow={stage:'exploring'};
      await Storage.commitPlan(plan);S.selectedNode=plan.blueprint?.nodes?.[0]?.id||null;S.compareBranchId=original.id;S.tab='explore';result();requestAnimationFrame(()=>document.querySelector('.branch-compare')?.scrollIntoView({block:'start'}));toast('已保存备选方案，原方案仍保留');
    }});
  }catch(e){toast(e.message==='variation_locked'?'这个方向要改变的部分已锁定，请先明确允许调整的内容。':e.message);}
}
async function openBranch(id){
  try{
    if(!await Storage.openProject(id))return toast('没有找到这个方向');
    S.selectedNode=S.plan.blueprint?.nodes?.[0]?.id||null;S.compareBranchId=null;S.tab='explore';S.buildStep=S.plan.build?.currentStep||0;result();
  }catch(e){toast(`没有打开这个方向：${e.message}`);}
}
async function patchRow(key,row){if(S.mutating)return;S.mutating=true;const patch={key,quantity:Number($('[data-qty]',row).value),owned:Number($('[data-owned]',row).value),unit_price:$('[data-price]',row).value.trim()===''?null:Number($('[data-price]',row).value)};try{const old=S.plan.recipe.find(r=>r.key===key);if(old.unit_price===patch.unit_price)delete patch.unit_price;await Storage.commitPlan(await api('/api/design/update-recipe',{method:'POST',body:JSON.stringify({plan:S.plan,patches:[patch]})}));S.tab='recipe';result();}catch(e){toast(`没有更新成功：${e.message}`);}finally{S.mutating=false;}}
async function updateBlueprint(action){
  if(S.mutating)return;
  if(['duplicate','delete'].includes(action.type)&&!action.confirmed){
    const n=S.plan.blueprint.nodes.find(x=>x.id===action.id);
    if(!n)return;
    window.FloraLabDialog.open({title:action.type==='duplicate'?'复制点位并增加材料？':'删除点位并减少材料？',body:`<p>${esc(n.id+' · '+n.name)}：材料清单数量会${action.type==='duplicate'?'增加':'减少'} 1。其他点位保持不变。</p>`,confirm:action.type==='duplicate'?'确认复制':'确认删除',onConfirm:()=>updateBlueprint({...action,confirmed:true})});return;
  }
  S.mutating=true;
  try{
    const next=await api('/api/design/update-blueprint',{method:'POST',body:JSON.stringify({plan:S.plan,action})});
    await Storage.commitPlan(next);
    if(!S.plan.blueprint.nodes.some(n=>n.id===S.selectedNode))S.selectedNode=S.plan.blueprint.nodes[0]?.id||null;
    S.tab='structure';renderStructure();
    toast(action.type==='lock'?(S.plan.blueprint.nodes.find(n=>n.id===action.id)?.locked?'点位已锁定':'点位已解锁'):'摆放已保存在本机');
  }catch(e){renderStructure();toast(e.message==='node_locked'?'这枝已经锁定，先解锁再调整。':`结构没有更新：${e.message}`);if(action.confirmed)throw e;}
  finally{S.mutating=false;}
}
async function updateBuild(patch,rerender=true){if(S.mutating)return;S.mutating=true;try{await Storage.commitPlan(await api('/api/design/update-build',{method:'POST',body:JSON.stringify({plan:S.plan,patch})}));S.buildStep=S.plan.build.currentStep||0;if(rerender){S.tab='build';result();}else renderTab();}catch(e){toast(`制作记录没有更新：${e.message}`);}finally{S.mutating=false;}}
async function saveFeedback(){try{const feedback={actual_difficulty:$('#actualDifficulty').value,minutes:Number($('#actualMinutes').value||0),issues:$('#actualIssues').value,notes:$('#actualNotes').value};await Storage.commitPlan(await api('/api/design/feedback',{method:'POST',body:JSON.stringify({plan:S.plan,feedback})}));result();toast('成品记录已保存');}catch(e){toast(`没有保存：${e.message}`);}}
function handoffObject(){return window.FloraLabRuntime.Studio.handoffObject(S.plan);}
async function exportPlan(){return Workflow.exportPlan(true);}
function briefText(){const p=S.plan;return `FloraLab 作品：${cleanTitle(p.title)}\n想法：${p.creativeBrief?.idea||'未填写'}\n形式：${p.type}\n配色：${(p.palette||[]).join(' / ')}\n尺寸：${p.dimensions.height}×${p.dimensions.width}×${p.dimensions.depth}cm\n制作状态：${p.assessment.buildability}\n当前需购：${money(p.cost.total)}\n材料：\n${p.recipe.filter(x=>x.quantity>0).map(x=>`- ${x.name}：需要 ${x.quantity}${x.unit}，已有 ${x.owned}${x.unit}，还需 ${x.to_buy}${x.unit}`).join('\n')}\n固定结构：${p.mechanics.type}\n结构稿：${p.blueprint?.nodes?.length||0} 个主体点位。效果图交接会从当前 Recipe / Mechanics / Blueprint 即时生成；若要改材料或结构，先回 Studio 更新作品事实。`;}
async function copyPurchase(){const p=S.plan,text=`${cleanTitle(p.title)} · 采购清单\n`+p.recipe.filter(r=>r.to_buy>0).map(r=>`- ${r.variant||''}${r.name}：还需 ${r.to_buy}${r.unit}（需要 ${r.quantity} / 已有 ${r.owned}）${r.unit_price===null?' · 待询价':` · 单价 ¥${r.unit_price}`}`).join('\n')+`\n已知金额 ¥${p.cost.total}${p.cost.unknown_prices?'；另有 '+p.cost.unknown_prices+' 项待询价':''}\n固定与供水：${p.mechanics.type}`;try{await navigator.clipboard.writeText(text);toast('采购清单已复制');}catch{toast('复制不可用，可以使用“打印采购清单”');}}
async function copyBrief(){try{await navigator.clipboard.writeText(briefText());toast('作品摘要已复制');}catch{const t=document.createElement('textarea');t.value=briefText();document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('作品摘要已复制');}}
async function copyRenderHandoff(){const text=window.FloraLabRuntime.Studio.renderHandoffText(S.plan);try{await navigator.clipboard.writeText(text);toast('效果图交接已复制');}catch{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('效果图交接已复制');}}
async function importPlan(event){return Workflow.importPlan(event);}
async function restoreBackup(){return Workflow.restore();}
function materials(detailKey=null){
  persistDraft();
  S.page='materials';
  if(!window.FloraLabLibrary){toast('材料库模块未加载');return;}
  const ctx={S,shell,esc,money,MONTH,onNavigate:materialId=>Navigation.record({page:'materials',materialId}),openRecipe:()=>{S.tab='recipe';result();window.scrollTo({top:0,behavior:'instant'});}};
  window.FloraLabLibrary.render(ctx,detailKey);
}

function installHelp(){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="installModal"><section class="modal"><div class="kicker">Install FloraLab</div><h2>把 FloraLab 放到桌面。</h2><p>Windows / Android：在 Chrome 或 Edge 菜单里选择“安装应用”。iPhone / iPad：Safari → 分享 →“添加到主屏幕”。安装后仍然使用同一个线上 Studio，作品保存在当前设备。</p><div class="modal-actions"><button class="primary" id="closeInstall">知道了</button></div></section></div>`);$('#closeInstall').onclick=()=>$('#installModal').remove();$('#installModal').onclick=e=>{if(e.target.id==='installModal')$('#installModal').remove();};}
async function installApp(){if(S.installPrompt){S.installPrompt.prompt();try{await S.installPrompt.userChoice;}catch{}S.installPrompt=null;return;}installHelp();}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();S.installPrompt=e;});
window.addEventListener('appinstalled',()=>{S.installPrompt=null;toast('FloraLab 已安装到设备');});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(()=>{}));

async function init(){
  await load();
  try{S.status=await api('/api/status');S.catalog=await api('/api/catalog');S.designCatalog=await window.FloraLabRuntime.getCatalog();}
  catch{S.status={version:'dev',mode:'zero-api-pwa',catalog:{flowers:117,creative:13}};}
  try{
    const [vr,vq]=await Promise.all([
      fetch('./data/material-visuals.json',{cache:'no-store'}),
      fetch('./data/material-visual-queries.json',{cache:'no-store'})
    ]);
    S.visualRegistry=vr.ok?await vr.json():{items:{}};
    S.visualQueries=vq.ok?await vq.json():{items:{}};
  }catch{S.visualRegistry={items:{}};S.visualQueries={items:{}};}
  try{
    const vs=await fetch('./data/material-visual-sources.json',{cache:'no-store'});
    S.visualSources=vs.ok?await vs.json():{items:{}};
  }catch{S.visualSources={items:{}};}
  readDraft();if(!await Navigation.restore())home();
}
window.addEventListener('pagehide',persistDraft);
init();
