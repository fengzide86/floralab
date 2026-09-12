const fs=require('fs'),path=require('path'),assert=require('assert');
const Studio=require('../lib/studio');
const Exploration=require('../lib/exploration');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','catalog.json'),'utf8'));
let n=0;const ok=(x,m)=>{assert.ok(x,m);n++};

const input={mode:'floral',type:'花束',colors:['紫色','白色'],budget:360,budgetPriority:'balance',style:'自然、温柔',existing:'',size:'medium',designMonth:9,region:'',preferred:'玫瑰、绣球',avoid:'',petContext:'',mechanicPreference:''};
const plan=Studio.createStudioPlan(catalog,input);
ok(plan.exploration?.version===Exploration.VERSION,'new plan has exploration state');
ok(Boolean(plan.exploration?.branch?.id),'root branch has id');
ok(plan.exploration.branch.parent_id===null,'root branch has no parent');
ok(Exploration.LOCK_KEYS.every(key=>plan.exploration.locks[key]===false),'all creative locks default off');

const recipeBefore=JSON.stringify(plan.recipe),blueprintBefore=JSON.stringify(plan.blueprint),handoffVersion=plan.handoff.version;
const locked=Studio.updateExploration(plan,{locks:{materials:true,colors:true,structure:true}});
ok(locked.exploration.locks.materials===true,'materials lock enabled');
ok(locked.exploration.locks.colors===true,'colors lock enabled');
ok(locked.exploration.locks.structure===true,'structure lock enabled');
ok(locked.exploration.locks.quantities===false,'unmentioned lock remains off');
ok(JSON.stringify(locked.recipe)===recipeBefore,'locking does not change Recipe');
ok(JSON.stringify(locked.blueprint)===blueprintBefore,'locking does not change Blueprint');
ok(locked.handoff.version===handoffVersion+1,'locking increments handoff version');
ok(locked.history.at(-1)?.type==='exploration-locks','locking is recorded in history');

const constraints=Studio.variationConstraints(locked);
ok(constraints.branch_id===locked.exploration.branch.id,'constraints belong to current branch');
ok(Array.isArray(constraints.locked.materials)&&constraints.locked.materials.length>0,'materials snapshot emitted when locked');
ok(constraints.locked.colors?.palette?.length>0,'palette snapshot emitted when colors locked');
ok(constraints.locked.structure?.nodes?.length===locked.blueprint.nodes.length,'Blueprint snapshot emitted when structure locked');
ok(constraints.locked.quantities===null,'unlocked quantities are not frozen');

const qtyLocked=Studio.updateExploration(locked,{quantities:true});
const qtyConstraints=Studio.variationConstraints(qtyLocked);
ok(Array.isArray(qtyConstraints.locked.quantities)&&qtyConstraints.locked.quantities.length>0,'quantity snapshot emitted when locked');

const forked=Studio.forkCreativePlan(qtyLocked,{label:'方向 B'});
ok(forked.id!==qtyLocked.id,'fork creates a new project id');
ok(forked.exploration.branch.id!==qtyLocked.exploration.branch.id,'fork creates a new branch id');
ok(forked.exploration.branch.parent_id===qtyLocked.exploration.branch.id,'fork points to parent branch');
ok(forked.exploration.branch.source_project_id===qtyLocked.id,'fork remembers source project');
ok(forked.exploration.branch.label==='方向 B','fork label retained');
ok(JSON.stringify(forked.recipe)===JSON.stringify(qtyLocked.recipe),'fork preserves Recipe facts');
ok(JSON.stringify(forked.blueprint)===JSON.stringify(qtyLocked.blueprint),'fork preserves Blueprint facts');
ok(forked.exploration.locks.materials===true&&forked.exploration.locks.quantities===true,'fork inherits locks');
ok(forked.history.at(-1)?.type==='exploration-fork','fork is recorded in history');

const exported=Studio.handoffObject(forked);
ok(exported.plan.exploration?.branch?.id===forked.exploration.branch.id,'handoff canonical plan exports exploration metadata');
ok(JSON.stringify(exported.plan.recipe)===JSON.stringify(forked.recipe),'handoff canonical Recipe remains authoritative');

const old=Studio.handoffObject(plan);delete old.plan.exploration;
const migrated=Studio.migratePlan(catalog,old);
ok(Boolean(migrated.exploration?.branch?.id),'old file gains exploration metadata on migration');
ok(JSON.stringify(migrated.recipe)===recipeBefore,'migration does not alter Recipe while adding exploration');

const creativePlan=Studio.createStudioPlan(catalog,{...input,mode:'creative',type:'创意花束',style:'怪诞、艺术',existing:'1个毛绒娃娃'});
const specialLocked=Studio.updateExploration(creativePlan,{special_objects:true});
const specialConstraints=Studio.variationConstraints(specialLocked);
ok(Array.isArray(specialConstraints.locked.special_objects),'special-object snapshot emitted');
ok(specialConstraints.locked.special_objects.length>0,'special-object lock captures creative items');

console.log(`creative-1.4: ${n} checks passed`);
