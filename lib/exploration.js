const crypto=require('crypto');

const VERSION='1.0';
const LOCK_KEYS=['materials','colors','quantities','vessel','special_objects','packaging','mechanics','structure'];

function clone(value){return JSON.parse(JSON.stringify(value));}
function now(){return new Date().toISOString();}
function uid(){return crypto.randomUUID();}
function normalizeLocks(input={}){
  return Object.fromEntries(LOCK_KEYS.map(key=>[key,Boolean(input[key])]));
}
function ensure(plan){
  const current=plan.exploration&&typeof plan.exploration==='object'?plan.exploration:{};
  const branch=current.branch&&typeof current.branch==='object'?current.branch:{};
  plan.exploration={
    version:VERSION,
    branch:{
      id:String(branch.id||uid()),
      parent_id:branch.parent_id||null,
      source_project_id:branch.source_project_id||null,
      label:String(branch.label||'主线'),
      created_at:branch.created_at||now()
    },
    locks:normalizeLocks(current.locks||{}),
    lastVariation:current.lastVariation||null,
    updated_at:current.updated_at||now()
  };
  return plan;
}
function updateLocks(plan,patch={}){
  ensure(plan);
  for(const key of LOCK_KEYS){
    if(Object.prototype.hasOwnProperty.call(patch,key))plan.exploration.locks[key]=Boolean(patch[key]);
  }
  plan.exploration.updated_at=now();
  return plan;
}
function fork(rawPlan,options={}){
  const plan=clone(rawPlan);
  ensure(plan);
  const parent=clone(plan.exploration.branch);
  const sourceProjectId=plan.id||null;
  plan.id=uid();
  plan.exploration={
    ...plan.exploration,
    branch:{
      id:uid(),
      parent_id:parent.id,
      source_project_id:sourceProjectId,
      label:String(options.label||'新分支'),
      created_at:now()
    },
    lastVariation:null,
    updated_at:now()
  };
  return plan;
}
function lockSnapshot(rawPlan){
  const plan=clone(rawPlan);
  ensure(plan);
  const locks=plan.exploration.locks;
  const recipe=(plan.recipe||[]).filter(row=>Number(row.quantity||0)>0);
  const flowers=recipe.filter(row=>row.kind==='flower');
  const creative=recipe.filter(row=>row.kind==='creative');
  const packaging=recipe.filter(row=>row.kind==='supply'&&/包装|包材|纸|丝带|缎带|麻绳|tissue|ribbon/i.test(`${row.name||''} ${row.role||''}`));
  const vesselRow=recipe.find(row=>row.kind==='vessel')||null;
  return {
    version:VERSION,
    branch_id:plan.exploration.branch.id,
    locks:clone(locks),
    locked:{
      materials:locks.materials?flowers.map(row=>({key:row.key,id:row.id,name:row.name,kind:row.kind})):null,
      colors:locks.colors?{palette:clone(plan.palette||[]),materials:flowers.map(row=>({key:row.key,variant:row.variant||''}))}:null,
      quantities:locks.quantities?recipe.filter(row=>['flower','creative'].includes(row.kind)).map(row=>({key:row.key,quantity:Number(row.quantity||0),unit:row.unit||''})):null,
      vessel:locks.vessel?{plan:clone(plan.vessel||null),recipe:vesselRow?clone(vesselRow):null}:null,
      special_objects:locks.special_objects?creative.map(row=>({key:row.key,id:row.id,name:row.name,variant:row.variant||'',quantity:Number(row.quantity||0),unit:row.unit||''})):null,
      packaging:locks.packaging?packaging.map(clone):null,
      mechanics:locks.mechanics?clone(plan.mechanics||null):null,
      structure:locks.structure?clone(plan.blueprint||null):null
    }
  };
}

module.exports={VERSION,LOCK_KEYS,ensure,updateLocks,fork,lockSnapshot};
