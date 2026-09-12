const fs=require('fs'),path=require('path'),assert=require('assert');
const Studio=require('../lib/studio');
const V=require('../lib/versions');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','catalog.json'),'utf8'));
let n=0;const ok=(x,m)=>{assert.ok(x,m);n++};
const input={idea:'紫白、轻盈、有留白',mode:'floral',type:'花束',colors:['紫色','白色'],budget:0,style:'自然、清冷',size:'medium',existing:'',designMonth:9};
const plan=Studio.createStudioPlan(catalog,input);
const exported=Studio.handoffObject(plan);

ok(exported.schema==='floralab/2.0','v2 schema exported');
ok(exported.plan&&exported.plan.id===plan.id,'canonical plan exported once');
ok(exported.plan.handoff.schema==='floralab/2.0','nested plan records current schema');
ok(exported.render?.version===V.RENDER_SPEC_VERSION,'derived Render snapshot remains available');
for(const key of ['recipe','blueprint','mechanics','exploration','intent','composition','build']){
  ok(!Object.prototype.hasOwnProperty.call(exported,key),`v2 does not duplicate ${key} at top level`);
}
ok(!Object.prototype.hasOwnProperty.call(exported.plan,'render'),'Render remains outside authoritative plan');
ok(exported.project.branch_id===plan.exploration.branch.id,'project metadata carries branch id');
ok(exported.project.family_id===plan.exploration.branch.family_id,'project metadata carries family id');

const v2Validation=Studio.validateImportObject(exported,catalog);
ok(v2Validation.ok,'v2 validates');
const v2Migrated=Studio.migratePlan(catalog,exported);
ok(JSON.stringify(v2Migrated.recipe)===JSON.stringify(plan.recipe),'v2 roundtrip preserves Recipe');
ok(JSON.stringify(v2Migrated.blueprint)===JSON.stringify(plan.blueprint),'v2 roundtrip preserves Blueprint');
ok(v2Migrated.creativeBrief.idea===plan.creativeBrief.idea,'v2 roundtrip preserves creative brief');
ok(v2Migrated.exploration.branch.id===plan.exploration.branch.id,'v2 roundtrip preserves branch identity');

const previous={
  schema:'floralab/1.0',
  project:{id:plan.id,title:plan.title,version:plan.handoff.version},
  intent:{mode:plan.mode,type:plan.type},
  recipe:plan.recipe,
  blueprint:plan.blueprint,
  render:Studio.buildRenderSpec(plan),
  plan:JSON.parse(JSON.stringify(plan))
};
previous.plan.handoff.schema='floralab/1.0';
const previousValidation=Studio.validateImportObject(previous,catalog);
ok(previousValidation.ok,'1.0 wrapper remains importable');
const previousMigrated=Studio.migratePlan(catalog,previous);
ok(previousMigrated.handoff.schema==='floralab/2.0','1.0 migrates to v2 runtime schema');
ok(JSON.stringify(previousMigrated.recipe)===JSON.stringify(plan.recipe),'1.0 migration keeps Recipe');
ok(JSON.stringify(previousMigrated.blueprint)===JSON.stringify(plan.blueprint),'1.0 migration keeps Blueprint');

const stale=Studio.handoffObject(plan);
stale.render.materials[0].quantity+=2;
const staleValidation=Studio.validateImportObject(stale,catalog);
ok(staleValidation.ok,'stale derived Render does not block v2 import');
ok(staleValidation.warnings.some(x=>x.includes('Render Spec 与 Recipe 数量不一致')),'stale Render is warned against canonical plan');

console.log(`handoff-v2-1.4: ${n} checks passed`);
