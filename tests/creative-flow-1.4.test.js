const fs=require('fs'),path=require('path'),assert=require('assert');
const Studio=require('../lib/studio');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','catalog.json'),'utf8'));
let n=0;const ok=(x,m)=>{assert.ok(x,m);n++};

const idea='想做一件紫白色、轻一点、有明显留白的生日作品';
const input={idea,mode:'floral',type:'花束',colors:['紫色','白色'],budget:0,budgetPriority:'balance',style:'自然、清冷',existing:'',size:'medium',designMonth:9,region:'',preferred:'',avoid:'',petContext:'',mechanicPreference:''};
const plan=Studio.createStudioPlan(catalog,input);
ok(plan.creativeBrief?.idea===idea,'creative brief keeps the original idea');
ok(plan.request?.idea===idea,'request keeps idea');
ok(plan.request?.prompt===idea,'idea also feeds deterministic prompt context');
ok(plan.cost?.status==='unbounded','missing budget is explicitly unbounded');
ok(Number(plan.cost?.budget||0)===0,'missing budget is not replaced by 300');
ok(!(plan.checks||[]).some(x=>x.id==='budget'),'missing budget does not create a fake budget check');

const handoff=Studio.handoffObject(plan);
ok(handoff.plan.creativeBrief?.idea===idea,'handoff canonical plan exports idea');
ok(!Object.prototype.hasOwnProperty.call(handoff,'creativeBrief'),'v2 avoids duplicate top-level creative brief');

const varied=Studio.createVariation(catalog,plan,'rightRise');
ok(varied.creativeBrief?.idea===idea,'variation preserves creative brief');
ok(varied.exploration.branch.parent_id===plan.exploration.branch.id,'variation still forks from original branch');

const forked=Studio.forkCreativePlan(plan,{label:'手动分支'});
ok(forked.creativeBrief?.idea===idea,'manual branch preserves creative brief');

const legacy=Studio.handoffObject(plan);
delete legacy.plan.creativeBrief;
const migrated=Studio.migratePlan(catalog,legacy);
ok(typeof migrated.creativeBrief?.idea==='string','old file receives creative brief metadata');

const constrained=Studio.createStudioPlan(catalog,{...input,budget:60,size:'large'});
ok((constrained.checks||[]).some(x=>x.id==='budget'),'explicit budget still participates in reality validation');
ok(constrained.cost?.status!=='unbounded','explicit budget is not marked unbounded');

console.log(`creative-flow-1.4: ${n} checks passed`);
