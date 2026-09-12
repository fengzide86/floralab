const crypto = require('crypto');
const { localPlan, validatePlan: legacyValidatePlan } = require('./engine');
const V = require('./versions');
const Exploration = require('./exploration');
const Grammar = require('./composition-grammar');

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
  return {version:V.BLUEPRINT_VERSION,units:'cm',dimensions:dims,origin:{x:0,y:0,z:0},vessel,mechanics:{type:plan.mechanics?.type||'',anchors},views:['front','left','back','right','top'],nodes,legend,note:'五个施工视图共享同一组三维点位；节点 ID 在所有视图保持不变。'};
}


function renderCountConfidence(row){
  if(row.kind==='creative') return 'high';
  if(row.kind!=='flower') return 'not_applicable';
  if(/洋桔梗|补血草|尤加利|满天星|小菊|喷玫/i.test(row.name||'')) return 'medium';
  if(/填充|叶材|线条|过渡|点缀/.test(row.role||'')) return 'medium';
  return 'high';
}
function renderDirectionLabel(n,dims){
  const w=Number(dims.width||60),h=Number(dims.height||56),x=Number(n.x||0),z=Number(n.z||0);
  if(z>=h*.78&&Math.abs(x)<=w*.16)return '上扬';
  if(x<=-w*.20&&z>=h*.62)return '左上';
  if(x>=w*.20&&z>=h*.62)return '右上';
  if(x<=-w*.24)return '向左展开';
  if(x>=w*.24)return '向右展开';
  return z>=h*.68?'向上':'向外';
}
function buildRenderSpec(plan){
  const recipe=(plan.recipe||[]).filter(r=>Number(r.quantity||0)>0);
  const materials=recipe.filter(r=>['flower','creative'].includes(r.kind)).map(r=>({key:r.key,kind:r.kind,name:r.name,variant:r.variant||'',role:r.role||'',quantity:Number(r.quantity||0),unit:r.unit||'',count_confidence:renderCountConfidence(r)}));
  const packaging=recipe.filter(r=>r.kind==='supply'&&/包装|包材|纸|丝带|缎带|麻绳|tissue|ribbon/i.test(`${r.name} ${r.role||''}`)).map(r=>({key:r.key,name:r.name,variant:r.variant||'',quantity:Number(r.quantity||0),unit:r.unit||''}));
  const vesselRow=recipe.find(r=>r.kind==='vessel');
  const vessel={name:vesselRow?.name||plan.vessel?.name||plan.blueprint?.vessel?.name||'',color:vesselRow?.variant||plan.vessel?.color||plan.blueprint?.vessel?.color||'',quantity:vesselRow?Number(vesselRow.quantity||1):(plan.vessel||plan.blueprint?.vessel?1:0),geometry:plan.blueprint?.vessel||null};
  const nodes=plan.blueprint?.nodes||[],dims=plan.blueprint?.dimensions||plan.dimensions||{width:60,depth:40,height:56};
  const width=Number(dims.width||60),depth=Number(dims.depth||40),height=Number(dims.height||56);
  const weight=n=>Math.max(2,Number(n.head_cm||6))*(/焦点|主花|体块/.test(n.role||'')?1.35:1);
  const tw=nodes.reduce((sum,n)=>sum+weight(n),0)||1;
  const mass={x_cm:round1(nodes.reduce((sum,n)=>sum+Number(n.x||0)*weight(n),0)/tw),y_cm:round1(nodes.reduce((sum,n)=>sum+Number(n.y||0)*weight(n),0)/tw),z_cm:round1(nodes.reduce((sum,n)=>sum+Number(n.z||0)*weight(n),0)/tw)};
  mass.horizontal=Math.abs(mass.x_cm)<=width*.07?'左右均衡':mass.x_cm<0?'视觉重量偏左':'视觉重量偏右';
  mass.depth=Math.abs(mass.y_cm)<=depth*.07?'前后均衡':mass.y_cm<0?'视觉重量偏前':'视觉重量偏后';
  mass.vertical=mass.z_cm>=height*.66?'重心偏高':mass.z_cm<=height*.48?'重心偏低':'重心居中';
  const xs=nodes.map(n=>Number(n.x||0)),zs=nodes.map(n=>Number(n.z||0));
  const minX=xs.length?Math.min(...xs):0,maxX=xs.length?Math.max(...xs):0,minZ=zs.length?Math.min(...zs):0,maxZ=zs.length?Math.max(...zs):0;
  const spanW=Math.max(1,maxX-minX),spanH=Math.max(1,maxZ-minZ),aspect=spanW/spanH;
  let outline=aspect>1.18?'横向展开':aspect<.82?'纵向上扬':'近圆 / 均衡';
  if(Math.abs(mass.x_cm)>width*.10)outline+=(mass.x_cm<0?'，左侧更重':'，右侧更重');
  const focusPool=nodes.filter(n=>/焦点|主花|体块/.test(n.role||''));
  const focus=(focusPool.length?focusPool:nodes.slice().sort((a,b)=>weight(b)-weight(a))).slice(0,8).map(n=>({id:n.id,name:n.name,role:n.role||'',x:round1(n.x),y:round1(n.y),z:round1(n.z)}));
  const layers={high:[],middle:[],low:[]},depthLayers={front:[],middle:[],back:[]};
  for(const n of nodes){
    const z=Number(n.z||0),y=Number(n.y||0);
    (z>=height*.72?layers.high:z<=height*.44?layers.low:layers.middle).push(n.id);
    (y<=-depth*.12?depthLayers.front:y>=depth*.12?depthLayers.back:depthLayers.middle).push(n.id);
  }
  const sectors=[
    {label:'左上',count:nodes.filter(n=>n.x<0&&n.z>=height*.58).length},
    {label:'右上',count:nodes.filter(n=>n.x>=0&&n.z>=height*.58).length},
    {label:'左下',count:nodes.filter(n=>n.x<0&&n.z<height*.58).length},
    {label:'右下',count:nodes.filter(n=>n.x>=0&&n.z<height*.58).length}
  ].sort((a,b)=>a.count-b.count);
  const lineNodes=nodes.filter(n=>/线条|叶材/.test(n.role||'')),outer=(lineNodes.length?lineNodes:nodes).slice().sort((a,b)=>((b.x*b.x)/(width*width)+(b.z*b.z)/(height*height))-((a.x*a.x)/(width*width)+(a.z*a.z)/(height*height))).slice(0,5);
  const directional=[...new Set(outer.map(n=>renderDirectionLabel(n,dims)))].slice(0,4);
  const specialMap=new Map();
  for(const n of nodes.filter(n=>n.kind==='creative')){const k=n.material_id||n.name;if(!specialMap.has(k))specialMap.set(k,{name:n.name,quantity:0,node_ids:[],positions:[]});const x=specialMap.get(k);x.quantity++;x.node_ids.push(n.id);x.positions.push({x:round1(n.x),y:round1(n.y),z:round1(n.z)});}
  return {
    version:V.RENDER_SPEC_VERSION,purpose:'effect-render-handoff',primary_view:'front',
    source_priority:{recipe:'材料种类、颜色与数量的唯一事实源',mechanics:'固定与供水结构的唯一事实源',blueprint:'高低、左右、前后、方向和轮廓的结构事实源',render:'由上述事实即时推导，不反向覆盖源数据'},
    generated_from:{handoff_version:Number(plan.handoff?.version||1),blueprint_version:plan.blueprint?.version||null},
    dimensions:{height,width,depth,unit:'cm'},materials,packaging,vessel,
    mechanics:{type:plan.mechanics?.type||'',items:[...(plan.mechanics?.items||[])],why:plan.mechanics?.why||''},
    special_objects:[...specialMap.values()],
    structure:{
      focus_nodes:focus,
      silhouette:{label:outline,bounds_cm:{left:round1(minX),right:round1(maxX),bottom:round1(minZ),top:round1(maxZ)},span_cm:{width:round1(spanW),height:round1(spanH)}},
      visual_mass:mass,
      left_right:{label:mass.horizontal,left_extent_cm:round1(Math.abs(minX)),right_extent_cm:round1(Math.abs(maxX))},
      height_layers:layers,depth_layers:depthLayers,directional_flow:directional,
      inferred_negative_space:sectors.slice(0,2).map(x=>({zone:x.label,node_count:x.count,note:'按正面 Blueprint 点位密度推导，仅用于保持留白，不是新的设计要求'}))
    },
    hard_constraints:['材料种类','材料颜色','Recipe 数量','花器与包装','已确认特殊物件','Mechanics'],
    structural_constraints:['焦点与主花位置','高低层次','左右展开','前后关系','主要方向','整体尺寸比例与轮廓','特殊物件所在层级'],
    visual_freedom:['花瓣与叶片自然姿态','包装细小褶皱','光线与背景','摄影构图','阴影和材质表现','不改变结构事实的细微空间关系'],
    self_check:['材料种类是否被替换','颜色是否被改变','数量密度是否明显膨胀或缩水','特殊物件是否跑位','高低左右前后是否颠倒','轮廓是否明显改变','花器包装与 Mechanics 是否被擅自更换'],
    note:'Recipe 数量是目标事实；分枝或多头材料在生成图中未必能逐枝精确计数，但不得因此改动数量设定。'
  };
}
function renderHandoffText(plan){
  const r=buildRenderSpec(plan);
  const mat=r.materials.map(m=>`- ${m.name}${m.variant?`（${m.variant}）`:''} × ${m.quantity}${m.unit}${m.count_confidence==='medium'?'〔分枝/多头，画面不一定逐枝可数〕':''}`).join('\n')||'- 无';
  const pack=r.packaging.map(m=>`${m.name}${m.variant?`（${m.variant}）`:''} × ${m.quantity}${m.unit}`).join('、')||'无';
  const special=r.special_objects.map(x=>`${x.name} × ${x.quantity}（点位 ${x.node_ids.join(' / ')}）`).join('；')||'无';
  const focus=r.structure.focus_nodes.map(x=>`${x.id} ${x.name}`).join('、')||'无明确焦点点位';
  const layers=r.structure.height_layers,depth=r.structure.depth_layers;
  return `FloraLab 效果图交接｜${titleOf(plan)}
模式：基于当前已确定版本做视觉效果图，不重新设计。
尺寸：${r.dimensions.height} × ${r.dimensions.width} × ${r.dimensions.depth} cm
主视图：正面

【硬约束｜不得擅自改变】
材料与 Recipe：
${mat}
花器：${r.vessel.name||'无独立花器'}${r.vessel.color?` · ${r.vessel.color}`:''}
包装：${pack}
特殊物件：${special}
Mechanics：${r.mechanics.type||'未记录'}${r.mechanics.items.length?` · ${r.mechanics.items.join('、')}`:''}

【结构约束｜按 Blueprint 尽可能保持】
焦点/主花：${focus}
轮廓：${r.structure.silhouette.label}；左右展开约 ${r.structure.silhouette.span_cm.width} cm，主体高差约 ${r.structure.silhouette.span_cm.height} cm
视觉重量：${r.structure.visual_mass.horizontal}；${r.structure.visual_mass.depth}；${r.structure.visual_mass.vertical}
高层：${layers.high.join('、')||'无'}；中层：${layers.middle.join('、')||'无'}；低层：${layers.low.join('、')||'无'}
前层：${depth.front.join('、')||'无'}；中层：${depth.middle.join('、')||'无'}；后层：${depth.back.join('、')||'无'}
主要方向：${r.structure.directional_flow.join('、')||'按 Blueprint 点位关系保持'}
建议保留的稀疏区：${r.structure.inferred_negative_space.map(x=>x.zone).join('、')||'无明显稀疏区'}

【视觉自由区】
${r.visual_freedom.map(x=>`- ${x}`).join('\n')}

【生成后自检】
${r.self_check.map(x=>`- ${x}`).join('\n')}

说明：${r.note}
如果结果出现换花、换色、特殊物件跑位、主要轮廓颠倒或数量密度明显异常，应优先重做；无法稳定锁定时明确说明是视觉近似。`;
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
  const plan=localPlan(catalog,input);plan.title=titleOf(plan);plan.creativeBrief={idea:String(input.idea||input.prompt||''),created_at:now()};plan.engineVersion=V.ENGINE_VERSION;plan.source='FloraLab Studio deterministic build workspace';plan.recipe=buildRecipe(plan);syncPlanFromRecipe(plan);enrichChecks(plan,catalog);plan.blueprint=buildBlueprint(catalog,plan);compositionCheck(plan);initBuild(plan);plan.resultFeedback=null;plan.history=[];Exploration.ensure(plan);plan.handoff={schema:V.HANDOFF_SCHEMA,project_id:plan.id,version:1,updated_at:now()};plan.provenance={...(plan.provenance||{}),catalog:'内置现实材料库 1.0',mode:'Zero API · deterministic'};appendHistory(plan,'create','创建作品');delete plan.scores;return plan;
}

function updateExploration(rawPlan,patch={}){
  const plan=clone(rawPlan);Exploration.ensure(plan);Exploration.updateLocks(plan,patch.locks||patch);plan.handoff={...(plan.handoff||{}),schema:V.HANDOFF_SCHEMA,version:Number(plan.handoff?.version||1)+1,updated_at:now()};appendHistory(plan,'exploration-locks','更新创作锁定');return plan;
}
function forkCreativePlan(rawPlan,options={}){
  const plan=Exploration.fork(rawPlan,options);plan.handoff={...(plan.handoff||{}),schema:V.HANDOFF_SCHEMA,version:Number(plan.handoff?.version||1)+1,updated_at:now()};appendHistory(plan,'exploration-fork',`创建分支：${plan.exploration.branch.label}`);return plan;
}
function variationConstraints(plan){return Exploration.lockSnapshot(plan);}
function variationOptions(plan){Exploration.ensure(plan);return Grammar.optionsFor(plan.exploration.locks);}
function previewVariation(catalog,rawPlan,presetKey){
  const original=clone(rawPlan);Exploration.ensure(original);
  const preset=Grammar.getPreset(presetKey);
  const availability=Grammar.optionsFor(original.exploration.locks).find(x=>x.key===presetKey);
  if(!availability?.enabled)throw new Error('variation_locked');
  const plan=original;
  const applied=[];
  if(preset.affects.includes('quantities')&&!plan.exploration.locks.quantities){
    plan.recipe=Grammar.adjustRecipe(plan.recipe,presetKey);
    syncPlanFromRecipe(plan);
    applied.push('quantities');
  }
  if(preset.affects.includes('structure')&&!plan.exploration.locks.structure){
    const base=buildBlueprint(catalog,plan,null);
    plan.blueprint=Grammar.applyToBlueprint(base,presetKey);
    for(const node of plan.blueprint.nodes||[])clampNode(plan,node);
    applied.push('structure');
  }
  plan.compositionIntent={version:Grammar.VERSION,preset:preset.key,label:preset.label,summary:preset.summary,affects:[...preset.affects],applied,created_at:now()};
  revalidate(plan,catalog);
  return plan;
}
function createVariation(catalog,rawPlan,presetKey,options={}){
  const preview=previewVariation(catalog,rawPlan,presetKey);
  const plan=Exploration.fork(preview,{label:options.label||preview.compositionIntent.label});
  const preset=Grammar.getPreset(presetKey),applied=plan.compositionIntent.applied;
  plan.exploration.lastVariation={preset:preset.key,label:preset.label,applied,from_branch:preview.exploration.branch.id,at:now()};
  plan.handoff={...(plan.handoff||{}),schema:V.HANDOFF_SCHEMA,version:Number(plan.handoff?.version||1)+1,updated_at:now()};
  appendHistory(plan,'exploration-variation',`生成方向：${preset.label}`);
  return plan;
}

function updateRecipe(catalog,rawPlan,patches=[]){
  const plan=clone(rawPlan),previous=clone(rawPlan.blueprint);const recipe=buildRecipe(plan),byKey=new Map(recipe.map(r=>[r.key,r]));
  for(const p of patches){const r=byKey.get(p.key);if(!r)continue;if(p.quantity!==undefined)r.quantity=Math.max(0,Number(p.quantity)||0);if(p.owned!==undefined)r.owned=Math.max(0,Math.min(r.quantity,Number(p.owned)||0));if(p.unit_price!==undefined)r.unit_price=Math.max(0,Number(p.unit_price)||0);r.to_buy=Math.max(0,r.quantity-r.owned);r.subtotal=Number((r.to_buy*r.unit_price).toFixed(2));}
  plan.recipe=[...byKey.values()];syncPlanFromRecipe(plan);enrichChecks(plan,catalog);plan.blueprint=buildBlueprint(catalog,plan,previous);compositionCheck(plan);initBuild(plan);plan.handoff={...(plan.handoff||{}),schema:V.HANDOFF_SCHEMA,version:Number(plan.handoff?.version||1)+1,updated_at:now()};appendHistory(plan,'recipe','调整材料配方');return plan;
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
  syncPlanFromRecipe(plan);enrichChecks(plan,catalog);compositionCheck(plan);initBuild(plan);plan.handoff={...(plan.handoff||{}),schema:V.HANDOFF_SCHEMA,version:Number(plan.handoff?.version||1)+1,updated_at:now()};appendHistory(plan,'blueprint',summary);return plan;
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
  plan.handoff={...(plan.handoff||{}),schema:V.HANDOFF_SCHEMA,version:Number(plan.handoff?.version||1)+1,updated_at:now()};appendHistory(plan,'build','更新制作记录');return plan;
}
function recordFeedback(catalog,rawPlan,feedback={}){
  const plan=clone(rawPlan);plan.resultFeedback={actual_difficulty:String(feedback.actual_difficulty||'未填写'),minutes:Math.max(0,Number(feedback.minutes||0)),issues:Array.isArray(feedback.issues)?feedback.issues.map(String):String(feedback.issues||'').split(/[、,，\n]/).map(x=>x.trim()).filter(Boolean),notes:String(feedback.notes||''),completed_at:feedback.completed_at||now()};plan.handoff={...(plan.handoff||{}),schema:V.HANDOFF_SCHEMA,version:Number(plan.handoff?.version||1)+1,updated_at:now()};appendHistory(plan,'feedback','记录现实成品反馈');return plan;
}

function validateImportObject(raw,catalog){
  const errors=[],warnings=[];if(!raw||typeof raw!=='object')return {ok:false,errors:['文件内容不是对象'],warnings:[]};
  let schema=raw.schema||raw.handoff?.schema||raw.plan?.handoff?.schema||null;let plan=raw.plan||raw;
  if(!plan||typeof plan!=='object')errors.push('缺少作品数据');
  if(schema && ![V.HANDOFF_SCHEMA,V.PREVIOUS_HANDOFF_SCHEMA,V.LEGACY_HANDOFF_SCHEMA].includes(schema))warnings.push(`未知 schema：${schema}，将尝试兼容导入。`);
  if(plan.recipe!==undefined && !Array.isArray(plan.recipe))errors.push('Recipe 必须是数组');
  for(const r of Array.isArray(plan.recipe)?plan.recipe:[]){for(const k of ['quantity','owned','unit_price'])if(r[k]!==undefined&&(!finite(r[k])||Number(r[k])<0))errors.push(`${r.name||r.key||'材料'} 的 ${k} 不是合法非负数值`);}
  if(raw.render?.materials&&Array.isArray(plan.recipe)){const byKey=new Map(plan.recipe.map(r=>[r.key,Number(r.quantity||0)]));const stale=raw.render.materials.some(r=>byKey.has(r.key)&&Number(r.quantity||0)!==byKey.get(r.key));if(stale)warnings.push('Render Spec 与 Recipe 数量不一致；导入后将以 Recipe / Blueprint 重新生成效果图交接。');}
  if(raw.render?.version&&raw.render.version!==V.RENDER_SPEC_VERSION)warnings.push(`未知 Render Spec 版本：${raw.render.version}，将以当前 Recipe / Blueprint 重新生成。`);
  const nodes=plan.blueprint?.nodes||[];const ids=new Set();for(const n of nodes){if(!n.id)errors.push('结构节点缺少 ID');else if(ids.has(n.id))errors.push(`重复 Stem ID：${n.id}`);else ids.add(n.id);for(const k of ['x','y','z'])if(!finite(n[k]))errors.push(`${n.id||'节点'} 的 ${k} 坐标非法`);if(n.material_id && !catalog.flowers.some(f=>f.id===n.material_id)&&!catalog.creative.some(c=>c.id===n.material_id))warnings.push(`${n.id} 使用未收录材料 ${n.material_id}`);}
  return {ok:errors.length===0,errors,warnings,schema:schema||'unknown'};
}
function migratePlan(catalog,raw){
  const wrapper=raw?.plan?raw:null;let plan=clone(wrapper?wrapper.plan:raw);if(wrapper?.exploration&&!plan.exploration)plan.exploration=clone(wrapper.exploration);const schema=wrapper?.schema||plan?.handoff?.schema||'unknown';
  if(schema===V.LEGACY_HANDOFF_SCHEMA||plan.engineVersion===V.LEGACY_ENGINE_VERSION){
    plan.engineVersion=V.ENGINE_VERSION;plan.recipe=Array.isArray(plan.recipe)?plan.recipe:buildRecipe(plan);syncPlanFromRecipe(plan);enrichChecks(plan,catalog);plan.blueprint=buildBlueprint(catalog,plan,plan.blueprint);compositionCheck(plan);initBuild(plan);plan.resultFeedback=plan.resultFeedback||null;plan.creativeBrief=plan.creativeBrief||{idea:String(plan.request?.idea||plan.request?.prompt||''),created_at:null};plan.history=Array.isArray(plan.history)?plan.history:[];Exploration.ensure(plan);plan.handoff={...(plan.handoff||{}),schema:V.HANDOFF_SCHEMA,version:Number(plan.handoff?.version||1),updated_at:now()};appendHistory(plan,'migration','从 0.5 迁移到 1.0');
  } else {
    plan.engineVersion=V.ENGINE_VERSION;plan.handoff={...(plan.handoff||{}),schema:V.HANDOFF_SCHEMA,version:Number(plan.handoff?.version||1),updated_at:plan.handoff?.updated_at||now()};if(!plan.blueprint||plan.blueprint.version!==V.BLUEPRINT_VERSION)plan.blueprint=buildBlueprint(catalog,plan,plan.blueprint);compositionCheck(plan);initBuild(plan);plan.creativeBrief=plan.creativeBrief||{idea:String(plan.request?.idea||plan.request?.prompt||''),created_at:null};plan.history=Array.isArray(plan.history)?plan.history:[];Exploration.ensure(plan);
  }
  return plan;
}

function handoffObject(plan){
  const canonical=clone(plan);
  canonical.handoff={...(canonical.handoff||{}),schema:V.HANDOFF_SCHEMA};
  return {
    schema:V.HANDOFF_SCHEMA,
    project:{
      id:canonical.id,
      title:titleOf(canonical),
      version:canonical.handoff?.version||1,
      branch_id:canonical.exploration?.branch?.id||null,
      family_id:canonical.exploration?.branch?.family_id||canonical.id||null
    },
    render:buildRenderSpec(canonical),
    plan:canonical
  };
}
function publicCatalog(catalog){return {meta:catalog.meta,flowers:catalog.flowers.map(f=>({id:f.id,name:f.name,aliases:f.aliases||[],colors:f.colors||[],roles:f.roles||[],price:f.price,season:f.season,availability:f.availability,stem_cm:f.stem_cm||null,head_cm:f.head_cm||null,weight:f.weight||'',stem_strength:f.stem_strength||'',water_need:f.water_need||'',fragility:f.fragility||'',beginner:f.beginner===true?true:(f.beginner===false?false:null),foam_fit:f.foam_fit||'',vase_fit:f.vase_fit||'',peak_months:f.peak_months||[],market_tier:f.market_tier||'',substitutes:f.substitutes||[],pet_risk:f.pet_risk||'',notes:f.notes||'',reference_only:Boolean(f.reference_only)})),creative:(catalog.creative||[]).map(c=>({id:c.id,name:c.name,aliases:c.aliases||[],category:c.category||'',price:c.price||null,weight_g:c.weight_g||null,fix:c.fix||[],wet_safe:Boolean(c.wet_safe),food:Boolean(c.food),notes:c.notes||''}))};}
function validatePlan(plan,catalog,input){const legacy=legacyValidatePlan(plan,catalog,input);const importV=validateImportObject(handoffObject(plan),catalog);return {ok:Boolean(legacy.ok)&&importV.ok,errors:[...(legacy.errors||[]),...importV.errors],warnings:importV.warnings};}

module.exports={createStudioPlan,updateExploration,forkCreativePlan,variationConstraints,variationOptions,previewVariation,createVariation,updateRecipe,updateBlueprint,updateBuild,recordFeedback,validateImportObject,migratePlan,handoffObject,buildRenderSpec,renderHandoffText,publicCatalog,deriveAssessment,buildRecipe,buildBlueprint,compositionCheck,validatePlan};
