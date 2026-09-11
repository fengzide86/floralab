const crypto = require('crypto');
const { localPlan, validatePlan: legacyValidatePlan } = require('./engine');

function clone(v){ return JSON.parse(JSON.stringify(v)); }
function sum(a,fn){ return (a||[]).reduce((s,x)=>s+fn(x),0); }
function now(){ return new Date().toISOString(); }
function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }
function finite(n){ return Number.isFinite(Number(n)); }
function round1(n){ return Number(Number(n||0).toFixed(1)); }
function isBouquet(plan){ return /花束|创意|礼盒|束扎/.test(`${plan.type||''} ${plan.mechanics?.type||''}`) || plan.mode==='creative'; }
function titleOf(plan){ return String(plan.title||'未命名作品').replace(/\s*·\s*Reality Ready.*$/,'').trim(); }

function appendHistory(plan,type,summary){
  plan.history = Array.isArray(plan.history) ? plan.history : [];
  plan.history.push({version:Number(plan.handoff?.version||1),type,summary,at:now()});
  if(plan.history.length>80) plan.history=plan.history.slice(-80);
}

function deriveAssessment(plan){
  const blocks=(plan.checks||[]).filter(x=>x.status==='block');
  const warns=(plan.checks||[]).filter(x=>x.status==='warn');
  let buildability='可以制作',tone='pass';
  if(blocks.length){buildability='需要调整';tone='block';}
  else if(warns.length){buildability='可以制作';tone='warn';}
  const heavy=(plan.flowers||[]).some(f=>Number(f.quantity||0)>0 && f.catalog?.weight==='heavy') || (plan.creative||[]).some(c=>Number(c.quantity||0)>0 && (c.catalog?.weight_g?.[1]||0)>300);
  const stability=blocks.some(x=>/重心|稳定|承重/.test(`${x.label}${x.detail}`))?'需要调整':heavy?'良好，建议加固':'良好';
  return {buildability,tone,difficulty:plan.metrics?.difficulty||'中等',stability,riskCount:blocks.length+warns.length,blockCount:blocks.length,warnCount:warns.length};
}

function enrichChecks(plan,catalog){
  const checks=(plan.checks||[]).filter(x=>!['pet-lily','foam-compat','vessel-stability','empty-design','high-water','reference-material','blueprint-balance'].includes(x.id));
  const add=(id,label,status,detail,source)=>checks.push({id,label,status,detail,source});
  const pet=String(plan.request?.petContext||'');
  const cat=/猫|cat/i.test(pet);
  const lily=(plan.flowers||[]).find(f=>Number(f.quantity||0)>0 && (f.name==='百合' || f.catalog?.pet_risk==='block_cat'));
  if(cat && lily) add('pet-lily','宠物环境','block','猫环境中不使用真百合类花材。先替换百合，再进入制作。','aspca-lily-cats');
  const foam=/花泥/.test(plan.mechanics?.type||'');
  const poorFoam=(plan.flowers||[]).filter(f=>Number(f.quantity||0)>0 && f.catalog?.foam_fit==='poor');
  if(foam && poorFoam.length) add('foam-compat','供水方式','warn',`${poorFoam.map(f=>f.name).join('、')}不建议优先依赖花泥供水，可改清水瓶插、水管或重新选结构。`,'teamflower-mechanics');
  const highWater=(plan.flowers||[]).filter(f=>Number(f.quantity||0)>0 && ['high','very_high'].includes(f.catalog?.water_need));
  if(highWater.length && !/清水|保水|水管/.test(`${plan.mechanics?.type||''} ${(plan.mechanics?.items||[]).join(' ')}`)) add('high-water','供水方式','warn',`${highWater.map(f=>f.name).join('、')}需持续可靠供水，当前结构需要补充清水或保水方案。`);
  const refs=(plan.flowers||[]).filter(f=>Number(f.quantity||0)>0 && catalog.flowers.find(x=>x.id===f.id)?.reference_only);
  if(refs.length) add('reference-material','资料完整度','warn',`${refs.map(x=>x.name).join('、')}属于参考条目；采购前核实具体品种、季节、价格、宠物风险与固定方式。`);
  const stems=sum(plan.flowers||[],x=>Number(x.quantity||0));
  const size=plan.request?.size||'medium';
  if(size==='large' && stems>0 && stems<24 && !checks.some(x=>x.id==='size-density')) add('size-density','体量与密度','warn',`大尺寸目标目前约 ${stems} 枝鲜花。若不是高留白线条造型，成品会偏疏。`);
  if(size==='small' && stems>42) add('size-density-small','体量与密度','warn',`小尺寸目标包含约 ${stems} 枝鲜花，花口或束扎点可能过密。`);
  const dims=plan.dimensions||{};
  const heavy=(plan.flowers||[]).some(f=>f.catalog?.weight==='heavy') || (plan.creative||[]).some(c=>(c.catalog?.weight_g?.[1]||0)>300);
  if(!isBouquet(plan) && heavy && Number(dims.width||0)>=70 && !/低重心|宽底|剑山|鸡笼网|花泥/.test(`${plan.vessel?.base||''} ${plan.mechanics?.type||''}`)) add('vessel-stability','结构稳定','block','作品跨度较大且含重花头/重物，当前花器或固定结构不足以证明稳定。');
  else if(!isBouquet(plan) && heavy) add('vessel-stability','结构稳定','pass','重花头/重物已安排在低位或靠近中心，搬运前仍需做倾覆检查。');
  if((plan.flowers||[]).every(f=>Number(f.quantity||0)<=0) && (plan.creative||[]).every(c=>Number(c.quantity||0)<=0)) add('empty-design','主体材料','block','当前配方没有主体材料，无法形成作品。');
  plan.checks=checks;
  plan.warnings=checks.filter(x=>x.status!=='pass').map(x=>x.detail);
  plan.assessment=deriveAssessment(plan);
  return plan;
}

function buildRecipe(plan){
  const rows=[];
  for(const f of plan.flowers||[]) rows.push({key:`flower:${f.id}`,kind:'flower',id:f.id,name:f.name,variant:f.color||'',role:f.role||'',quantity:Number(f.quantity||0),unit:f.unit||'枝',owned:Number(f.existing_quantity||0),unit_price:Number(f.unit_price||0),source:'catalog'});
  for(const c of plan.creative||[]) rows.push({key:`creative:${c.id}`,kind:'creative',id:c.id,name:c.name,variant:c.category||'',role:'创意物件',quantity:Number(c.quantity||0),unit:c.unit||'个',owned:Number(c.existing_quantity||0),unit_price:Number(c.unit_price||0),source:'catalog'});
  for(const s of plan.supplies||[]) rows.push({key:`supply:${s.name}`,kind:'supply',id:s.name,name:s.name,variant:s.color||'',role:s.purpose||'辅材',quantity:Number(s.quantity||0),unit:s.unit||'份',owned:Number(s.existing_quantity||0),unit_price:Number(s.unit_price||0),source:'catalog'});
  if(Number(plan.cost?.vessel||0)>0) rows.push({key:'vessel:main',kind:'vessel',id:'main',name:plan.vessel?.name||'花器',variant:plan.vessel?.color||'',role:'花器',quantity:1,unit:'个',owned:0,unit_price:Number(plan.cost.vessel||0),source:'catalog'});
  for(const r of rows){
    r.quantity=Math.max(0,Number(r.quantity||0));r.owned=Math.min(r.quantity,Math.max(0,Number(r.owned||0)));r.unit_price=Math.max(0,Number(r.unit_price||0));
    r.to_buy=Math.max(0,r.quantity-r.owned);r.subtotal=Number((r.to_buy*r.unit_price).toFixed(2));
  }
  return rows;
}
function totalsFromRecipe(recipe){
  const groups={flower:0,creative:0,supply:0,vessel:0};
  for(const r of recipe||[]) groups[r.kind]=(groups[r.kind]||0)+Number(r.subtotal||0);
  return {flowers:groups.flower||0,creative:groups.creative||0,supplies:groups.supply||0,vessel:groups.vessel||0,total:Object.values(groups).reduce((a,b)=>a+b,0)};
}
function budgetCheck(plan){
  const checks=(plan.checks||[]).filter(x=>x.id!=='budget');
  const budget=Number(plan.request?.budget||plan.cost?.budget||0), total=Number(plan.cost?.total||0), priority=plan.request?.budgetPriority||'balance';
  if(budget>0 && total>budget && priority!=='effect') checks.push({id:'budget',label:'预算',status:'block',detail:`当前需购约 ¥${Math.round(total)}，高于预算 ¥${Math.round(budget)}。减少数量、补充已有材料、调整单价或提高预算。`});
  else if(budget>0 && total>budget) checks.push({id:'budget',label:'预算',status:'warn',detail:`当前选择效果优先，需购约 ¥${Math.round(total)}，高于参考预算 ¥${Math.round(budget)}。`});
  else if(budget>0) checks.push({id:'budget',label:'预算',status:'pass',detail:`当前需购约 ¥${Math.round(total)}，未超过预算 ¥${Math.round(budget)}。`});
  plan.checks=checks;
}
function syncPlanFromRecipe(plan){
  const map=new Map((plan.recipe||[]).map(r=>[r.key,r]));
  for(const f of plan.flowers||[]){const r=map.get(`flower:${f.id}`);if(r){f.quantity=r.quantity;f.existing_quantity=r.owned;f.unit_price=r.unit_price;f.subtotal=r.subtotal;}}
  for(const c of plan.creative||[]){const r=map.get(`creative:${c.id}`);if(r){c.quantity=r.quantity;c.existing_quantity=r.owned;c.unit_price=r.unit_price;c.price=r.subtotal;}}
  for(const s of plan.supplies||[]){const r=map.get(`supply:${s.name}`);if(r){s.quantity=r.quantity;s.existing_quantity=r.owned;s.unit_price=r.unit_price;s.subtotal=r.subtotal;}}
  const t=totalsFromRecipe(plan.recipe||[]);plan.cost={...(plan.cost||{}),...t,range:[Math.round(t.total*.9),Math.round(t.total*1.15)]};budgetCheck(plan);return plan;
}

function hash01(key){const hex=crypto.createHash('sha1').update(String(key)).digest('hex').slice(0,8);return parseInt(hex,16)/0xffffffff;}
function roleProfile(role='',kind='flower'){
  if(kind==='creative') return {radius:.34,z0:.28,z1:.55,stage:5};
  if(/线条/.test(role)) return {radius:.92,z0:.68,z1:.98,stage:3};
  if(/叶材/.test(role)) return {radius:.82,z0:.36,z1:.72,stage:3};
  if(/体块/.test(role)) return {radius:.40,z0:.34,z1:.58,stage:4};
  if(/焦点/.test(role)) return {radius:.32,z0:.46,z1:.68,stage:4};
  if(/主花/.test(role)) return {radius:.48,z0:.42,z1:.70,stage:4};
  if(/过渡/.test(role)) return {radius:.60,z0:.42,z1:.74,stage:5};
  return {radius:.72,z0:.40,z1:.78,stage:5};
}
function groupCode(i){const letters='ABCDEFGHJKLMNPQRSTUVWXYZ';return letters[i%letters.length]||'Z';}
function vesselGeometry(plan){
  const h=Number(plan.vessel?.height_cm||Math.max(12,Math.min(32,Number(plan.dimensions?.height||56)*.34)));
  const opening=Number(plan.vessel?.opening_cm||Math.max(8,Math.min(22,Number(plan.dimensions?.width||60)*.22)));
  const base=Number(plan.vessel?.base_cm||Math.max(opening,opening*1.18));
  return {name:plan.vessel?.name||'花器',base:plan.vessel?.base||'',color:plan.vessel?.color||'',height_cm:round1(h),opening_cm:round1(opening),base_cm:round1(base)};
}
function mechanicAnchors(plan,vessel){
  const type=plan.mechanics?.type||'清水瓶插';
  if(isBouquet(plan)) return [{id:'M01',type:'束扎点',x:0,y:0,z:Math.max(8,Math.round(vessel.height_cm*.75))}];
  if(/剑山/.test(type)) return [{id:'M01',type:'剑山',x:0,y:0,z:Math.max(2,Math.round(vessel.height_cm*.12))}];
  if(/花泥/.test(type)) return [{id:'M01',type:'花泥',x:0,y:0,z:Math.max(4,Math.round(vessel.height_cm*.55))}];
  if(/鸡笼网/.test(type)) return [{id:'M01',type:'鸡笼网',x:0,y:0,z:Math.max(5,Math.round(vessel.height_cm*.68))}];
  return [{id:'M01',type:'花口',x:0,y:0,z:vessel.height_cm}];
}
function computeAngles(n,anchor){
  const dx=n.x-anchor.x,dy=n.y-anchor.y,dz=n.z-anchor.z;
  n.length_cm=Math.max(1,Math.round(Math.sqrt(dx*dx+dy*dy+dz*dz)));
  n.yaw_deg=Math.round(Math.atan2(dy,dx)*180/Math.PI);
  n.pitch_deg=Math.round(Math.atan2(dz,Math.sqrt(dx*dx+dy*dy)||1)*180/Math.PI);
  return n;
}
function preserveMap(previous){return new Map((previous?.nodes||[]).map(n=>[n.id,n]));}
function buildBlueprint(catalog,plan,previous=null){
  const dims=clone(plan.dimensions||{height:56,width:62,depth:42});
  const subjects=[...(plan.flowers||[]).filter(x=>Number(x.quantity||0)>0).map(x=>({kind:'flower',ref:x})),...(plan.creative||[]).filter(x=>Number(x.quantity||0)>0).map(x=>({kind:'creative',ref:x}))];
  const nodes=[],legend=[],old=preserveMap(previous),vessel=vesselGeometry(plan),anchors=mechanicAnchors(plan,vessel),anchor=anchors[0];
  subjects.forEach((subject,gidx)=>{
    const item=subject.ref,qty=Math.max(0,Math.min(80,Math.round(Number(item.quantity||0)))),code=groupCode(gidx),profile=roleProfile(item.role,subject.kind);
    legend.push({code,kind:subject.kind,id:item.id,name:item.name,color:item.color||'',role:item.role||'创意物件',quantity:qty});
    for(let i=0;i<qty;i++){
      const id=`${code}${String(i+1).padStart(2,'0')}`; const prev=old.get(id);
      if(prev && prev.material_id===item.id){nodes.push({...clone(prev),group:code,name:item.name,color:item.color||prev.color||'',role:item.role||prev.role,stage:prev.stage||profile.stage,anchor_id:prev.anchor_id||anchor.id});continue;}
      const key=`${item.id}:${i}`,golden=2.399963229728653,angle=(i*golden+hash01(key+'a')*.8+gidx*.47)%(Math.PI*2),rr=profile.radius*(.50+.50*hash01(key+'r'));
      let x=Math.cos(angle)*(Number(dims.width||60)/2)*rr,y=Math.sin(angle)*(Number(dims.depth||40)/2)*rr;
      if(/焦点/.test(item.role||'')){x*=.55;y*=.55;} if(subject.kind==='creative'){x*=.72;y*=.72;}
      const z=Math.max(anchor.z+4,Number(dims.height||56)*(profile.z0+(profile.z1-profile.z0)*hash01(key+'z')));
      const cat=subject.kind==='flower'?catalog.flowers.find(f=>f.id===item.id):catalog.creative.find(c=>c.id===item.id);
      const head=subject.kind==='flower'?Math.max(3,Math.min(15,((cat?.head_cm?.[0]||5)+(cat?.head_cm?.[1]||9))/2)):10;
      const n={id,group:code,kind:subject.kind,material_id:item.id,name:item.name,color:item.color||'',role:item.role||'创意物件',x:round1(x),y:round1(y),z:round1(z),head_cm:round1(head),stage:profile.stage,anchor_id:anchor.id,locked:false};
      computeAngles(n,anchor);nodes.push(n);
    }
  });
  return {version:'2.0',units:'cm',dimensions:dims,origin:{x:0,y:0,z:0},vessel,mechanics:{type:plan.mechanics?.type||'',anchors},views:['front','left','back','right','top'],nodes,legend,note:'五个施工视图共享同一组三维点位；节点 ID 在所有视图保持不变。'};
}

function compositionCheck(plan){
  const nodes=plan.blueprint?.nodes||[]; const flowerNodes=nodes.filter(n=>n.kind==='flower');
  const roleCount={}; for(const n of flowerNodes) roleCount[n.role]=(roleCount[n.role]||0)+1;
  const advice=[];
  if(!flowerNodes.length) advice.push({level:'info',title:'非植物主体',detail:'当前设计不依赖鲜花构成，重点检查创意物件的固定、重量和包装。'});
  else {
    const focus=(roleCount['主花']||0)+(roleCount['焦点']||0)+(roleCount['体块']||0), line=roleCount['线条']||0, foliage=roleCount['叶材']||0;
    if(focus/flowerNodes.length>.68) advice.push({level:'warn',title:'体块偏重',detail:'圆形或大体块花材占比较高，作品可能显得厚重；可减少体块或增加线条与留白。'});
    if(line===0 && flowerNodes.length>=14) advice.push({level:'note',title:'线条较弱',detail:'当前几乎没有线条花材，若想要更舒展的轮廓，可加入少量线条枝材。'});
    if(foliage===0 && flowerNodes.length>=12) advice.push({level:'note',title:'叶材较少',detail:'当前几乎没有叶材；如果不是刻意裸茎设计，可补少量结构叶材。'});
    const totalW=flowerNodes.reduce((s,n)=>s+(n.head_cm||5),0)||1, balance=flowerNodes.reduce((s,n)=>s+n.x*(n.head_cm||5),0)/totalW;
    if(Math.abs(balance)>Number(plan.dimensions?.width||60)*.10) advice.push({level:'warn',title:'左右视觉重量不均',detail:`结构重心向${balance>0?'右':'左'}偏，可调整主花或体块位置后再检查。`});
  }
  plan.composition={roleCount,advice,updated_at:now()}; return plan;
}

function initBuild(plan){
  const prev=plan.build||{}; const usage={...(prev.usage||{})},losses={...(prev.losses||{})};
  for(const r of plan.recipe||[]){if(['flower','creative'].includes(r.kind)){usage[r.key]=Math.min(Number(usage[r.key]||0),r.quantity);losses[r.key]=Math.min(Number(losses[r.key]||0),r.quantity);}}
  plan.build={currentStep:Number(prev.currentStep||0),completed:Array.isArray(prev.completed)?prev.completed:[],usage,losses,notes:Array.isArray(prev.notes)?prev.notes:[],updated_at:now()};
  computeBuildGaps(plan); return plan;
}
function computeBuildGaps(plan){
  const rows=[];
  for(const r of plan.recipe||[]){if(!['flower','creative'].includes(r.kind))continue;const used=Number(plan.build?.usage?.[r.key]||0),loss=Number(plan.build?.losses?.[r.key]||0),available=r.quantity,remaining=Math.max(0,available-used-loss),shortage=Math.max(0,used+loss-available);rows.push({key:r.key,name:r.name,available,used,loss,remaining,shortage,unit:r.unit});}
  plan.build.materials=rows;plan.build.shortages=rows.filter(x=>x.shortage>0);return plan;
}

function revalidate(plan,catalog){syncPlanFromRecipe(plan);enrichChecks(plan,catalog);compositionCheck(plan);initBuild(plan);plan.assessment=deriveAssessment(plan);return plan;}
function createStudioPlan(catalog,input={}){
  const plan=localPlan(catalog,input);plan.title=titleOf(plan);plan.engineVersion='1.0.0';plan.source='FloraLab Studio deterministic build workspace';plan.recipe=buildRecipe(plan);syncPlanFromRecipe(plan);enrichChecks(plan,catalog);plan.blueprint=buildBlueprint(catalog,plan);compositionCheck(plan);initBuild(plan);plan.resultFeedback=null;plan.history=[];plan.handoff={schema:'floralab/1.0',project_id:plan.id,version:1,updated_at:now()};plan.provenance={...(plan.provenance||{}),catalog:'内置现实材料库 1.0',mode:'Zero API · deterministic'};appendHistory(plan,'create','创建作品');delete plan.scores;return plan;
}

function updateRecipe(catalog,rawPlan,patches=[]){
  const plan=clone(rawPlan),previous=clone(rawPlan.blueprint);const recipe=buildRecipe(plan),byKey=new Map(recipe.map(r=>[r.key,r]));
  for(const p of patches){const r=byKey.get(p.key);if(!r)continue;if(p.quantity!==undefined)r.quantity=Math.max(0,Number(p.quantity)||0);if(p.owned!==undefined)r.owned=Math.max(0,Math.min(r.quantity,Number(p.owned)||0));if(p.unit_price!==undefined)r.unit_price=Math.max(0,Number(p.unit_price)||0);r.to_buy=Math.max(0,r.quantity-r.owned);r.subtotal=Number((r.to_buy*r.unit_price).toFixed(2));}
  plan.recipe=[...byKey.values()];syncPlanFromRecipe(plan);enrichChecks(plan,catalog);plan.blueprint=buildBlueprint(catalog,plan,previous);compositionCheck(plan);initBuild(plan);plan.handoff={...(plan.handoff||{}),schema:'floralab/1.0',version:Number(plan.handoff?.version||1)+1,updated_at:now()};appendHistory(plan,'recipe','调整材料配方');return plan;
}

function nodeAnchor(plan,node){return plan.blueprint?.mechanics?.anchors?.find(a=>a.id===node.anchor_id)||plan.blueprint?.mechanics?.anchors?.[0]||{x:0,y:0,z:0};}
function clampNode(plan,n){const d=plan.blueprint?.dimensions||plan.dimensions||{width:60,depth:40,height:56};n.x=round1(clamp(Number(n.x||0),-Number(d.width||60)/2,Number(d.width||60)/2));n.y=round1(clamp(Number(n.y||0),-Number(d.depth||40)/2,Number(d.depth||40)/2));n.z=round1(clamp(Number(n.z||0),0,Number(d.height||56)*1.12));computeAngles(n,nodeAnchor(plan,n));return n;}
function nextNodeId(bp,group){let m=0;for(const n of bp.nodes||[]){const x=String(n.id).match(new RegExp(`^${group}(\\d+)$`));if(x)m=Math.max(m,Number(x[1]));}return `${group}${String(m+1).padStart(2,'0')}`;}
function updateBlueprint(catalog,rawPlan,action={}){
  const plan=clone(rawPlan);plan.blueprint=clone(plan.blueprint||buildBlueprint(catalog,plan));const bp=plan.blueprint;const idx=bp.nodes.findIndex(n=>n.id===action.id);let summary='调整结构';
  if(['move','set','lock','mirror','delete','duplicate'].includes(action.type) && idx<0) throw new Error('node_not_found');
  if(action.type==='move'||action.type==='set'){
    const n=bp.nodes[idx];if(n.locked)throw new Error('node_locked');
    for(const k of ['x','y','z']) if(action[k]!==undefined && finite(action[k])) n[k]=Number(action[k]);
    if(action.length_cm!==undefined&&finite(action.length_cm))n.length_cm=Math.max(1,Number(action.length_cm));
    if(action.yaw_deg!==undefined&&finite(action.yaw_deg))n.yaw_deg=Number(action.yaw_deg);
    if(action.pitch_deg!==undefined&&finite(action.pitch_deg))n.pitch_deg=Number(action.pitch_deg);
    if(action.length_cm!==undefined||action.yaw_deg!==undefined||action.pitch_deg!==undefined){const a=nodeAnchor(plan,n),L=Number(n.length_cm||1),yaw=Number(n.yaw_deg||0)*Math.PI/180,pitch=Number(n.pitch_deg||0)*Math.PI/180,h=L*Math.cos(pitch);n.x=a.x+h*Math.cos(yaw);n.y=a.y+h*Math.sin(yaw);n.z=a.z+L*Math.sin(pitch);}
    clampNode(plan,n);summary=`调整 ${n.id} ${n.name} 位置`;
  } else if(action.type==='lock'){bp.nodes[idx].locked=action.value===undefined?!bp.nodes[idx].locked:Boolean(action.value);summary=`${bp.nodes[idx].locked?'锁定':'解锁'} ${bp.nodes[idx].id}`;}
  else if(action.type==='mirror'){const n=bp.nodes[idx];if(n.locked)throw new Error('node_locked');n.x=-Number(n.x||0);computeAngles(n,nodeAnchor(plan,n));summary=`镜像 ${n.id}`;}
  else if(action.type==='duplicate'){
    const src=bp.nodes[idx];const row=plan.recipe.find(r=>`${r.kind}:${r.id}`===`${src.kind}:${src.material_id}`);if(row){row.quantity+=1;row.to_buy=Math.max(0,row.quantity-row.owned);row.subtotal=Number((row.to_buy*row.unit_price).toFixed(2));}
    const n={...clone(src),id:nextNodeId(bp,src.group),x:round1(src.x+Math.max(3,src.head_cm*.5)),locked:false};clampNode(plan,n);bp.nodes.push(n);const l=bp.legend.find(x=>x.code===src.group);if(l)l.quantity+=1;summary=`复制 ${src.id} 为 ${n.id}`;
  } else if(action.type==='delete'){
    const src=bp.nodes[idx];if(src.locked)throw new Error('node_locked');bp.nodes.splice(idx,1);const row=plan.recipe.find(r=>`${r.kind}:${r.id}`===`${src.kind}:${src.material_id}`);if(row){row.quantity=Math.max(0,row.quantity-1);row.owned=Math.min(row.owned,row.quantity);row.to_buy=Math.max(0,row.quantity-row.owned);row.subtotal=Number((row.to_buy*row.unit_price).toFixed(2));}const l=bp.legend.find(x=>x.code===src.group);if(l)l.quantity=Math.max(0,l.quantity-1);summary=`删除 ${src.id}`;
  }
  syncPlanFromRecipe(plan);enrichChecks(plan,catalog);compositionCheck(plan);initBuild(plan);plan.handoff={...(plan.handoff||{}),schema:'floralab/1.0',version:Number(plan.handoff?.version||1)+1,updated_at:now()};appendHistory(plan,'blueprint',summary);return plan;
}

function updateBuild(catalog,rawPlan,patch={}){
  const plan=clone(rawPlan);initBuild(plan);const r=plan.recipe.find(x=>x.key===patch.key);
  if(patch.currentStep!==undefined) plan.build.currentStep=clamp(Number(patch.currentStep)||0,0,Math.max(0,(plan.steps||[]).length-1));
  if(patch.completeStep!==undefined){const s=Number(patch.completeStep);if(!plan.build.completed.includes(s))plan.build.completed.push(s);}
  if(r && ['flower','creative'].includes(r.kind)){
    if(patch.used!==undefined)plan.build.usage[r.key]=Math.max(0,Number(patch.used)||0);
    if(patch.loss!==undefined)plan.build.losses[r.key]=Math.max(0,Number(patch.loss)||0);
    if(patch.useDelta!==undefined)plan.build.usage[r.key]=Math.max(0,Number(plan.build.usage[r.key]||0)+Number(patch.useDelta||0));
    if(patch.lossDelta!==undefined)plan.build.losses[r.key]=Math.max(0,Number(plan.build.losses[r.key]||0)+Number(patch.lossDelta||0));
  }
  if(patch.note)plan.build.notes.push({text:String(patch.note),at:now()});computeBuildGaps(plan);
  const shortages=plan.build.shortages||[];plan.build.substitutionAdvice=shortages.map(s=>{const id=s.key.split(':')[1],f=catalog.flowers.find(x=>x.id===id);return {name:s.name,shortage:s.shortage,substitutes:f?.substitutes||[],detail:f?.substitutes?.length?`可优先考虑 ${f.substitutes.join('、')}。`:'暂无可靠自动替代；优先补买同品种或回到材料页调整配方。'};});
  plan.handoff={...(plan.handoff||{}),schema:'floralab/1.0',version:Number(plan.handoff?.version||1)+1,updated_at:now()};appendHistory(plan,'build','更新制作记录');return plan;
}
function recordFeedback(catalog,rawPlan,feedback={}){
  const plan=clone(rawPlan);plan.resultFeedback={actual_difficulty:String(feedback.actual_difficulty||'未填写'),minutes:Math.max(0,Number(feedback.minutes||0)),issues:Array.isArray(feedback.issues)?feedback.issues.map(String):String(feedback.issues||'').split(/[、,，\n]/).map(x=>x.trim()).filter(Boolean),notes:String(feedback.notes||''),completed_at:feedback.completed_at||now()};plan.handoff={...(plan.handoff||{}),schema:'floralab/1.0',version:Number(plan.handoff?.version||1)+1,updated_at:now()};appendHistory(plan,'feedback','记录现实成品反馈');return plan;
}

function validateImportObject(raw,catalog){
  const errors=[],warnings=[];if(!raw||typeof raw!=='object')return {ok:false,errors:['文件内容不是对象'],warnings:[]};
  let schema=raw.schema||raw.handoff?.schema||raw.plan?.handoff?.schema||null;let plan=raw.plan||raw;
  if(!plan||typeof plan!=='object')errors.push('缺少作品数据');
  if(schema && !['floralab/1.0','floralab/0.5'].includes(schema))warnings.push(`未知 schema：${schema}，将尝试兼容导入。`);
  if(plan.recipe!==undefined && !Array.isArray(plan.recipe))errors.push('Recipe 必须是数组');
  for(const r of Array.isArray(plan.recipe)?plan.recipe:[]){for(const k of ['quantity','owned','unit_price'])if(r[k]!==undefined&&(!finite(r[k])||Number(r[k])<0))errors.push(`${r.name||r.key||'材料'} 的 ${k} 不是合法非负数值`);}
  const nodes=plan.blueprint?.nodes||[];const ids=new Set();for(const n of nodes){if(!n.id)errors.push('结构节点缺少 ID');else if(ids.has(n.id))errors.push(`重复 Stem ID：${n.id}`);else ids.add(n.id);for(const k of ['x','y','z'])if(!finite(n[k]))errors.push(`${n.id||'节点'} 的 ${k} 坐标非法`);if(n.material_id && !catalog.flowers.some(f=>f.id===n.material_id)&&!catalog.creative.some(c=>c.id===n.material_id))warnings.push(`${n.id} 使用未收录材料 ${n.material_id}`);}
  return {ok:errors.length===0,errors,warnings,schema:schema||'unknown'};
}
function migratePlan(catalog,raw){
  const wrapper=raw?.plan?raw:null;let plan=clone(wrapper?wrapper.plan:raw);const schema=wrapper?.schema||plan?.handoff?.schema||'unknown';
  if(schema==='floralab/0.5'||plan.engineVersion==='0.5.0'){
    plan.engineVersion='1.0.0';plan.recipe=Array.isArray(plan.recipe)?plan.recipe:buildRecipe(plan);syncPlanFromRecipe(plan);enrichChecks(plan,catalog);plan.blueprint=buildBlueprint(catalog,plan,plan.blueprint);compositionCheck(plan);initBuild(plan);plan.resultFeedback=plan.resultFeedback||null;plan.history=Array.isArray(plan.history)?plan.history:[];plan.handoff={...(plan.handoff||{}),schema:'floralab/1.0',version:Number(plan.handoff?.version||1),updated_at:now()};appendHistory(plan,'migration','从 0.5 迁移到 1.0');
  } else {
    plan.engineVersion='1.0.0';plan.handoff={...(plan.handoff||{}),schema:'floralab/1.0',version:Number(plan.handoff?.version||1),updated_at:plan.handoff?.updated_at||now()};if(!plan.blueprint||plan.blueprint.version!=='2.0')plan.blueprint=buildBlueprint(catalog,plan,plan.blueprint);compositionCheck(plan);initBuild(plan);plan.history=Array.isArray(plan.history)?plan.history:[];
  }
  return plan;
}

function handoffObject(plan){return {schema:'floralab/1.0',project:{id:plan.id,title:titleOf(plan),version:plan.handoff?.version||1},intent:{mode:plan.mode,type:plan.type,occasion:plan.occasion,style:plan.style,palette:plan.palette,budget:plan.request?.budget||plan.cost?.budget,avoid:plan.request?.avoid||'',pet_context:plan.request?.petContext||''},assessment:plan.assessment,composition:plan.composition,recipe:plan.recipe,dimensions:plan.dimensions,mechanics:plan.mechanics,blueprint:plan.blueprint,build:plan.build,resultFeedback:plan.resultFeedback,history:plan.history,plan};}
function publicCatalog(catalog){return {meta:catalog.meta,flowers:catalog.flowers.map(f=>({id:f.id,name:f.name,aliases:f.aliases||[],colors:f.colors||[],roles:f.roles||[],price:f.price,season:f.season,availability:f.availability,beginner:f.beginner,substitutes:f.substitutes||[],pet_risk:f.pet_risk||'',water_need:f.water_need,foam_fit:f.foam_fit,vase_fit:f.vase_fit,notes:f.notes,reference_only:Boolean(f.reference_only)})),creative:catalog.creative};}
function validatePlan(plan,catalog,input){const legacy=legacyValidatePlan(plan,catalog,input);const importV=validateImportObject(handoffObject(plan),catalog);return {ok:Boolean(legacy.ok)&&importV.ok,errors:[...(legacy.errors||[]),...importV.errors],warnings:importV.warnings};}

module.exports={createStudioPlan,updateRecipe,updateBlueprint,updateBuild,recordFeedback,validateImportObject,migratePlan,handoffObject,publicCatalog,deriveAssessment,buildRecipe,buildBlueprint,compositionCheck,validatePlan};