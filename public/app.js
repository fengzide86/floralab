const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const app=$('#app');
const MONTH=new Date().getMonth()+1;
const S={page:'home',mode:'floral',plan:null,tab:'work',view:'front',selectedNode:null,buildStep:0,compareBranchId:null,status:null,catalog:null,visualRegistry:{items:{}},visualQueries:{items:{}},visualSources:{items:{}},visualCache:null,visualPromises:{},materialQuery:'',libraryKind:'flower',materialFilters:{role:'',color:'',season:'',making:''},materialId:null,projects:[],installPrompt:null,form:{idea:'',type:'花束',colors:['紫色','白色'],budget:0,budgetPriority:'balance',style:'温柔、自然',existing:'',size:'medium',designMonth:MONTH,region:'',preferred:'',avoid:'',petContext:'',mechanicPreference:''}};
const COLORS=[['紫色','#9c87aa'],['白色','#f8f5ee'],['粉色','#ddb0b8'],['红色','#a95b57'],['蓝色','#89a7b8'],['黄色','#dcc36a'],['橙色','#cf8d60'],['绿色','#7d9277'],['奶油色','#e6d7b9'],['黑色','#39373b']];
const TYPES=['花束','瓶插','桌花','花篮','礼盒','创意花束','创意装置'];
const STYLES=['自然','温柔','极简','法式','日式','复古','清冷','热烈'];
const VIEW_NAMES={front:'正面',left:'左侧',back:'背面',right:'右侧',top:'俯视'};
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function money(n){return `¥${Math.round(Number(n||0))}`;}
function toast(msg){const n=document.createElement('div');n.className='toast';n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),2600);}
async function api(url,opts={}){if(!window.FloraLabRuntime)throw new Error('Studio runtime 未加载');return window.FloraLabRuntime.request(url,opts);}
function cleanTitle(s=''){return String(s).replace(/\s*·\s*Reality Ready.*$/,'').trim();}
function colorHex(name,i=0){const map=Object.fromEntries(COLORS);return map[name]||['#a68baa','#f2eee5','#8ba487','#c3a87c'][i%4];}
const {projection,projectionConfig,renderBlueprint,nodeInfo,editorControls,structureTab}=window.FloraLabBlueprintViews.create({state:S,esc,colorHex,viewNames:VIEW_NAMES});
const {renderSpecFor,renderRenderView,renderHandoffTab}=window.FloraLabRenderViews.create({esc,colorHex,viewNames:VIEW_NAMES,buildRenderSpec:window.FloraLabRuntime.Studio.buildRenderSpec});
const {workTab,recipeTab,printSheet}=window.FloraLabWorkViews.create({state:S,esc,money,cleanTitle,colorHex,renderBlueprint});
const {stepTitle,stepMaterials,buildTab,feedbackTab,historyTab}=window.FloraLabMakingViews.create({state:S,esc,renderBlueprint});

const {idbPut,idbGet,idbAll,snapshot,save,load,restoreBackup:restoreLocalBackup}=window.FloraLabStorage.create({state:S,cleanTitle});

const Shell=window.FloraLabShell.create({
  state:S,
  onNavigate:p=>{
    if(p==='home')home();
    else if(p==='create')create();
    else if(p==='materials')materials();
    else if(p==='render'){
      if(S.plan){S.tab='render';result();}
      else openRenderWorkspaceIntro();
    }else if(S.plan)result();
    else create();
    window.scrollTo(0,0);
  },
  onCreativeSpace:()=>openCreativeSpace(),
  onInstall:()=>installApp()
});
function shell(body,active=''){Shell.render(body,active);}
function openRenderWorkspaceIntro(){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><section class="modal"><div class="kicker">Render Handoff</div><h2>效果图工作区在作品里面。</h2><p>它会读取当前 Recipe、Mechanics 和 Blueprint，锁定材料、颜色、数量与主要结构。先新建或导入一件作品，之后顶部“效果图”和作品内“效果图”标签都可以直接进入。</p><div class="modal-actions"><button class="secondary" id="closeModal">关闭</button><button class="primary" id="renderIntroCreate">开始一个作品</button></div></section></div>`); $('#closeModal').onclick=()=>$('#modal').remove();$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').remove();};$('#renderIntroCreate').onclick=()=>{$('#modal').remove();create();};}
function openCreativeSpace(){const has=Boolean(S.plan);document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><section class="modal"><div class="kicker">Creative Space</div><h2>${has?'继续这件作品':'从一个想法开始'}</h2><p>${has?'复制当前摘要，带回你的 FloraLab 创作空间继续讨论视觉与灵感。':'创作空间负责灵感、参考图和视觉稿；Studio 负责材料、成本与施工结构。'}</p><div class="modal-actions"><button class="secondary" id="closeModal">关闭</button>${has?'<button class="primary" id="modalCopy">复制作品摘要</button>':''}</div></section></div>`);$('#closeModal').onclick=()=>$('#modal').remove();$('#modal').onclick=e=>{if(e.target.id==='modal')$('#modal').remove();};if(has)$('#modalCopy').onclick=async()=>{await copyBrief();$('#modal').remove();};}
function home(){
  S.page='home';
  shell(window.FloraLabHomeView.render({state:S,esc}));
  $('#newDesign').onclick=create;
  $('#importFile').onchange=importPlan;
  $$('[data-open-project]').forEach(b=>b.onclick=async()=>{
    const row=await idbGet('projects',b.dataset.openProject);
    if(!row?.state)return toast('没有找到这件本机作品');
    S.plan=row.state.plan;
    S.form={...S.form,...(row.state.form||{})};
    S.mode=row.state.mode||'floral';
    save();
    result();
  });
}
function create(){
  S.page='create';
  shell(window.FloraLabCreateView.render({state:S,colors:COLORS,types:TYPES,styles:STYLES,esc}),'create');
  $$('[data-mode]').forEach(b=>b.onclick=()=>{sync();S.mode=b.dataset.mode;if(S.mode==='creative'&&S.form.type==='花束')S.form.type='创意花束';create();});
  $$('[data-type]').forEach(b=>b.onclick=()=>{S.form.type=b.dataset.type;$$('[data-type]').forEach(x=>x.classList.toggle('active',x===b));});
  $$('[data-color]').forEach(b=>b.onclick=()=>{const c=b.dataset.color;S.form.colors=S.form.colors.includes(c)?S.form.colors.filter(x=>x!==c):[...S.form.colors,c].slice(-4);b.classList.toggle('active');});
  $$('[data-style]').forEach(b=>b.onclick=()=>{const x=b.dataset.style;let arr=String($('#style').value||'').split(/[、,，]/).map(s=>s.trim()).filter(Boolean);arr=arr.includes(x)?arr.filter(v=>v!==x):[...arr,x];$('#style').value=arr.join('、');b.classList.toggle('active');});
  $('#generate').onclick=generate;
}
function sync(){for(const id of ['idea','budget','style','existing','size','budgetPriority','designMonth','region','preferred','avoid','petContext','mechanicPreference']){const e=$('#'+id);if(e)S.form[id]=e.value;}S.form.budget=Number(S.form.budget||0);S.form.designMonth=Number(S.form.designMonth||MONTH);}
async function generate(){sync();if(!S.form.colors.length)return toast('至少保留一个颜色');try{const b=$('#generate');b.disabled=true;b.textContent='整理中…';S.plan=await api('/api/design/generate',{method:'POST',body:JSON.stringify({...S.form,mode:S.mode})});S.tab='explore';S.view='front';S.buildStep=0;S.compareBranchId=null;S.selectedNode=S.plan.blueprint?.nodes?.[0]?.id||null;save();result();requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'instant'}));}catch(e){toast(`没有整理成功：${e.message}`);create();}}
function result(){if(!S.plan)return create();S.page='result';const p=S.plan,a=p.assessment,overview=S.tab==='work';shell(`<main class="wrap project ${overview?'project-overview':'project-workspace'}"><header class="project-head ${overview?'project-head-overview':'project-head-compact'}"><div class="project-identity"><div class="kicker">${overview?'Current Composition':'Current Project'}</div><h1 class="project-title">${esc(cleanTitle(p.title))}</h1><p class="project-sub">${esc(p.type)} · ${esc(p.style)} · ${esc((p.palette||[]).join(' / '))}</p></div><div class="project-meta"><div class="project-state"><strong>${money(p.cost.total)}</strong><span class="status-text ${a.tone}">${esc(a.buildability)} · ${esc(a.difficulty)}</span></div><div class="project-actions"><button id="copyBrief">复制摘要</button><button id="exportPlan">导出设计</button><button id="printPlan">打印制作单</button></div></div></header><nav class="tabs" aria-label="作品工作区">${[['work','作品'],['explore','方向'],['recipe','材料'],['structure','结构'],['render','效果图'],['build','制作'],['feedback','成品'],['history','版本']].map(([k,n])=>`<button data-tab="${k}" class="${S.tab===k?'active':''}">${n}</button>`).join('')}</nav><div id="tabBody"></div><section id="printSheet" class="print-sheet">${printSheet(p)}</section></main>`,S.tab==='render'?'render':'work');$$('[data-tab]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tab;result();window.scrollTo({top:0,behavior:'instant'});});renderTab();$('#copyBrief').onclick=copyBrief;$('#exportPlan').onclick=exportPlan;$('#printPlan').onclick=()=>window.print();}
function renderTab(){if(S.tab==='structure'){const nodes=S.plan?.blueprint?.nodes||[];if(!nodes.some(n=>n.id===S.selectedNode))S.selectedNode=nodes[0]?.id||null;}const host=$('#tabBody'),p=S.plan;if(S.tab==='work')host.innerHTML=workTab(p);if(S.tab==='explore')host.innerHTML=exploreTab(p);if(S.tab==='recipe')host.innerHTML=recipeTab(p);if(S.tab==='structure')host.innerHTML=structureTab(p);if(S.tab==='render')host.innerHTML=renderHandoffTab(p);if(S.tab==='build')host.innerHTML=buildTab(p);if(S.tab==='feedback')host.innerHTML=feedbackTab(p);if(S.tab==='history')host.innerHTML=historyTab(p);bindTab();}

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
  return window.FloraLabExploreView.render({plan:p,options,branches,compare,view:S.exploreView||'front',esc});
}


function bindTab(){
  $$('[data-material-detail]').forEach(b=>b.onclick=()=>materials(b.dataset.materialDetail));
  $$('[data-tabjump]').forEach(b=>b.onclick=()=>{S.tab=b.dataset.tabjump;result();});
  if(S.tab==='explore'){
    $$('[data-explore-lock]').forEach(b=>b.onclick=()=>updateExplorationLock(b.dataset.exploreLock,b.getAttribute('aria-pressed')!=='true'));
    $$('[data-variation]').forEach(b=>b.onclick=()=>createVariation(b.dataset.variation));
    $$('[data-open-branch]').forEach(b=>b.onclick=()=>openBranch(b.dataset.openBranch));
    $$('[data-compare-branch]').forEach(b=>b.onclick=()=>{S.compareBranchId=b.dataset.compareBranch;renderTab();$('.branch-compare')?.scrollIntoView({block:'start'});});
    $$('[data-explore-view]').forEach(b=>b.onclick=()=>{S.exploreView=b.dataset.exploreView;renderTab();});
    const close=$('#closeBranchCompare');if(close)close.onclick=()=>{S.compareBranchId=null;renderTab();};
  }
  if(S.tab==='recipe'){$$('.recipe-row').forEach(row=>{const key=row.dataset.key,q=$('[data-qty]',row),o=$('[data-owned]',row),pr=$('[data-price]',row);$('[data-minus]',row).onclick=()=>{q.value=Math.max(0,Number(q.value)-1);patchRow(key,row)};$('[data-plus]',row).onclick=()=>{q.value=Number(q.value)+1;patchRow(key,row)};[q,o,pr].forEach(e=>e.onchange=()=>patchRow(key,row));});}
  if(S.tab==='structure'){bindStructure();}
  if(S.tab==='render'){const c=$('#copyRenderHandoff'),e=$('#exportRenderPlan');if(c)c.onclick=copyRenderHandoff;if(e)e.onclick=exportPlan;}
  if(S.tab==='build'){$$('[data-step]').forEach(b=>b.onclick=()=>{S.buildStep=Number(b.dataset.step);updateBuild({currentStep:S.buildStep},false);});$('#prevStep').onclick=()=>{S.buildStep=Math.max(0,S.buildStep-1);updateBuild({currentStep:S.buildStep},false);};$('#nextStep').onclick=()=>{S.buildStep=Math.min(S.plan.steps.length-1,S.buildStep+1);updateBuild({currentStep:S.buildStep,completeStep:S.buildStep-1},false);};$$('[data-build-key]').forEach(row=>{const key=row.dataset.buildKey;$$('[data-use]',row).forEach(b=>b.onclick=()=>updateBuild({key,useDelta:1}));$$('[data-loss]',row).forEach(b=>b.onclick=()=>updateBuild({key,lossDelta:1}));});}
  if(S.tab==='feedback')$('#saveFeedback').onclick=saveFeedback;
  if(S.tab==='history')$('#restoreBackup').onclick=restoreBackup;
}
function svgWorldPoint(svg,e){const pt=svg.createSVGPoint();pt.x=e.clientX;pt.y=e.clientY;const m=svg.getScreenCTM();return m?pt.matrixTransform(m.inverse()):pt;}
function screenToWorld(plan,view,pt,node){const {scale,cx,baseY}=projectionConfig(plan,view);const a=(pt.x-cx)/scale,b=view==='top'?(pt.y-280)/scale:(baseY-pt.y)/scale;const out={x:node.x,y:node.y,z:node.z};if(view==='front'){out.x=a;out.z=b;}if(view==='back'){out.x=-a;out.z=b;}if(view==='left'){out.y=a;out.z=b;}if(view==='right'){out.y=-a;out.z=b;}if(view==='top'){out.x=a;out.y=-b;}return out;}
function bindStructure(){
  $$('[data-view]').forEach(b=>b.onclick=()=>{S.view=b.dataset.view;renderTab();});
  $$('[data-node]').forEach(g=>{g.onclick=()=>{S.selectedNode=g.dataset.node;renderTab();};g.onpointerdown=e=>{const id=g.dataset.node,node=S.plan.blueprint.nodes.find(n=>n.id===id);if(!node||node.locked)return;S.selectedNode=id;const svg=g.closest('svg');g.setPointerCapture?.(e.pointerId);const move=ev=>{const pt=svgWorldPoint(svg,ev),w=screenToWorld(S.plan,S.view,pt,node);const circle=$('circle:not(.bp-hit)',g);if(circle){const cfg=projectionConfig(S.plan,S.view);const pseudo={...node,...w},pr=projection(pseudo,S.view),x=cfg.cx+pr[0]*cfg.scale,y=S.view==='top'?280+pr[1]*cfg.scale:cfg.baseY-pr[1]*cfg.scale;circle.setAttribute('cx',x);circle.setAttribute('cy',y);}};const up=async ev=>{g.removeEventListener('pointermove',move);g.removeEventListener('pointerup',up);const pt=svgWorldPoint(svg,ev),w=screenToWorld(S.plan,S.view,pt,node);await updateBlueprint({type:'move',id,x:w.x,y:w.y,z:w.z});};g.addEventListener('pointermove',move);g.addEventListener('pointerup',up);};});
  $$('[data-node-field]').forEach(inp=>inp.onchange=async()=>{const n=S.plan.blueprint.nodes.find(x=>x.id===S.selectedNode);if(!n)return;const field=inp.dataset.nodeField;await updateBlueprint({type:'set',id:n.id,[field]:Number(inp.value)});});
  $$('[data-node-action]').forEach(b=>b.onclick=()=>updateBlueprint({type:b.dataset.nodeAction,id:S.selectedNode}));
}

async function updateExplorationLock(key,value){
  try{S.plan=await api('/api/design/update-exploration',{method:'POST',body:JSON.stringify({plan:S.plan,patch:{locks:{[key]:value}}})});save();S.tab='explore';renderTab();}catch(e){toast(`锁定没有更新：${e.message}`);}
}
async function createVariation(preset){
  try{
    S.plan=await api('/api/design/variation',{method:'POST',body:JSON.stringify({plan:S.plan,preset})});
    S.selectedNode=S.plan.blueprint?.nodes?.[0]?.id||null;S.compareBranchId=null;save();S.tab='explore';result();toast(`已创建新方向：${S.plan.exploration?.branch?.label||'新分支'}`);
  }catch(e){toast(e.message==='variation_locked'?'这个方向要改变的部分已经全部锁定。':`没有生成新方向：${e.message}`);}
}
async function openBranch(id){
  try{
    const row=(S.projects||[]).find(x=>x.id===id)||await idbGet('projects',id);
    if(!row?.state?.plan)return toast('没有找到这个方向');
    S.plan=row.state.plan;S.form={...S.form,...(row.state.form||{})};S.mode=row.state.mode||S.mode;S.selectedNode=S.plan.blueprint?.nodes?.[0]?.id||null;S.compareBranchId=null;S.tab='explore';save();result();
  }catch(e){toast(`没有打开这个方向：${e.message}`);}
}
async function patchRow(key,row){const patch={key,quantity:Number($('[data-qty]',row).value),owned:Number($('[data-owned]',row).value),unit_price:Number($('[data-price]',row).value)};try{S.plan=await api('/api/design/update-recipe',{method:'POST',body:JSON.stringify({plan:S.plan,patches:[patch]})});save();S.tab='recipe';result();}catch(e){toast(`没有更新成功：${e.message}`);}}
async function updateBlueprint(action){try{S.plan=await api('/api/design/update-blueprint',{method:'POST',body:JSON.stringify({plan:S.plan,action})});if(!S.plan.blueprint.nodes.some(n=>n.id===S.selectedNode))S.selectedNode=S.plan.blueprint.nodes[0]?.id||null;save();S.tab='structure';result();}catch(e){toast(e.message==='node_locked'?'这枝已经锁定，先解锁再调整。':`结构没有更新：${e.message}`);}}
async function updateBuild(patch,rerender=true){try{S.plan=await api('/api/design/update-build',{method:'POST',body:JSON.stringify({plan:S.plan,patch})});S.buildStep=S.plan.build.currentStep||0;save();if(rerender){S.tab='build';result();}else renderTab();}catch(e){toast(`制作记录没有更新：${e.message}`);}}
async function saveFeedback(){try{const feedback={actual_difficulty:$('#actualDifficulty').value,minutes:Number($('#actualMinutes').value||0),issues:$('#actualIssues').value,notes:$('#actualNotes').value};S.plan=await api('/api/design/feedback',{method:'POST',body:JSON.stringify({plan:S.plan,feedback})});save();result();toast('成品记录已保存');}catch(e){toast(`没有保存：${e.message}`);}}
function handoffObject(){return window.FloraLabRuntime.Studio.handoffObject(S.plan);}
function exportPlan(){const blob=new Blob([JSON.stringify(handoffObject(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${cleanTitle(S.plan.title).replace(/[\\/:*?"<>|·\s]+/g,'-')}.floralab`;a.click();URL.revokeObjectURL(a.href);toast('设计文件已导出');}
function briefText(){const p=S.plan;return `FloraLab 作品：${cleanTitle(p.title)}\n想法：${p.creativeBrief?.idea||'未填写'}\n形式：${p.type}\n配色：${(p.palette||[]).join(' / ')}\n尺寸：${p.dimensions.height}×${p.dimensions.width}×${p.dimensions.depth}cm\n制作状态：${p.assessment.buildability}\n当前需购：${money(p.cost.total)}\n材料：\n${p.recipe.filter(x=>x.quantity>0).map(x=>`- ${x.name}：需要 ${x.quantity}${x.unit}，已有 ${x.owned}${x.unit}，还需 ${x.to_buy}${x.unit}`).join('\n')}\n固定结构：${p.mechanics.type}\n结构稿：${p.blueprint?.nodes?.length||0} 个主体点位。效果图交接会从当前 Recipe / Mechanics / Blueprint 即时生成；若要改材料或结构，先回 Studio 更新作品事实。`;}
async function copyBrief(){try{await navigator.clipboard.writeText(briefText());toast('作品摘要已复制');}catch{const t=document.createElement('textarea');t.value=briefText();document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('作品摘要已复制');}}
async function copyRenderHandoff(){const text=window.FloraLabRuntime.Studio.renderHandoffText(S.plan);try{await navigator.clipboard.writeText(text);toast('效果图交接已复制');}catch{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();toast('效果图交接已复制');}}
async function importPlan(e){const f=e.target.files?.[0];if(!f)return;try{const raw=JSON.parse(await f.text());const v=await api('/api/design/validate-import',{method:'POST',body:JSON.stringify(raw)});S.plan=v.plan;S.selectedNode=S.plan.blueprint?.nodes?.[0]?.id||null;S.tab='work';S.compareBranchId=null;save();result();if(v.warnings?.length)toast(`已导入，另有 ${v.warnings.length} 项兼容提醒`);else toast('设计文件已导入');}catch(err){toast(`导入失败：${err.data?.errors?.join('；')||err.message}`);}}
async function restoreBackup(){const restored=await restoreLocalBackup();toast(restored.message);if(restored.ok)result();}
function materials(detailKey=null){
  S.page='materials';
  if(!window.FloraLabLibrary){toast('材料库模块未加载');return;}
  const ctx={S,shell,esc,money,MONTH,openRecipe:()=>{S.tab='recipe';result();window.scrollTo({top:0,behavior:'instant'});}};
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
  home();
}
init();
