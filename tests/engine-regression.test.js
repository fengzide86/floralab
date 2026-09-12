const assert=require('assert');
const catalog=require('../data/catalog.json');
const S=require('../lib/studio');
let checks=0; const ok=(cond,msg)=>{assert.ok(cond,msg);checks++};
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);checks++};
function plan(extra={}){return S.createStudioPlan(catalog,{mode:'floral',type:'桌花',budget:300,colors:['紫色','白色'],style:'自然',size:'medium',...extra});}

ok(catalog.flowers.length===117,'117 flowers');ok(catalog.creative.length===13,'13 creative');ok(catalog.flowers.some(x=>x.reference_only),'reference entries');
let p=plan(); eq(p.engineVersion,'1.0.0');eq(p.handoff.schema,'floralab/2.0');eq(p.blueprint.version,'2.0');eq(p.blueprint.views,['front','left','back','right','top']);ok(p.blueprint.nodes.length>0);ok(p.blueprint.mechanics.anchors.length>0);ok(p.blueprint.vessel.height_cm>0);ok(new Set(p.blueprint.nodes.map(n=>n.id)).size===p.blueprint.nodes.length);
for(const n of p.blueprint.nodes){ok(Number.isFinite(n.x)&&Number.isFinite(n.y)&&Number.isFinite(n.z));ok(Number.isFinite(n.length_cm));ok(Boolean(n.anchor_id));}
for(const r of p.recipe){eq(r.to_buy,Math.max(0,r.quantity-r.owned));eq(r.subtotal,Number((r.to_buy*r.unit_price).toFixed(2)));}
ok(p.assessment.buildability);ok(Array.isArray(p.composition.advice));ok(Array.isArray(p.history)&&p.history.length===1);ok(p.build&&Array.isArray(p.build.materials));

let catLily=plan({preferred:'百合',petContext:'家里有猫'});ok(catLily.checks.some(x=>x.id==='pet-lily'&&x.status==='block'),'cat lily blocked');
let noPlant=S.createStudioPlan(catalog,{mode:'creative',type:'创意花束',budget:200,colors:['粉色','白色'],avoid:'完全不要植物',existing:'1个小熊'});ok(noPlant.flowers.reduce((s,x)=>s+x.quantity,0)===0,'no plants respected');ok(noPlant.creative.some(x=>x.name==='毛绒娃娃'),'existing plush recognized');
let existing=plan({existing:'8枝白玫瑰、2张包装纸'});let rose=existing.recipe.find(x=>x.name==='玫瑰');ok(rose.owned>=8,'owned rose');let pack=existing.recipe.find(x=>/包装纸/.test(x.name));if(pack)ok(pack.owned>=2,'owned paper');
let budget=plan({budget:60,size:'large'});ok(budget.checks.some(x=>x.id==='budget'&&x.status==='block'),'budget conflict');

const before=JSON.stringify(p.blueprint.nodes.map(n=>[n.id,n.x,n.y,n.z]));const hist0=p.history.length;const rr=p.recipe.find(x=>x.kind==='flower');p=S.updateRecipe(catalog,p,[{key:rr.key,unit_price:rr.unit_price+2}]);eq(JSON.stringify(p.blueprint.nodes.map(n=>[n.id,n.x,n.y,n.z])),before,'price preserves positions');ok(p.history.length===hist0+1,'history preserved');
const id=p.blueprint.nodes[0].id,old=JSON.parse(JSON.stringify(p.blueprint.nodes[0]));p=S.updateBlueprint(catalog,p,{type:'move',id,x:old.x+4,y:old.y,z:old.z});ok(p.blueprint.nodes.find(n=>n.id===id).x!==old.x,'move');
p=S.updateBlueprint(catalog,p,{type:'lock',id,value:true});ok(p.blueprint.nodes.find(n=>n.id===id).locked,'lock');let threw=false;try{S.updateBlueprint(catalog,p,{type:'move',id,x:0,y:0,z:20})}catch(e){threw=e.message==='node_locked'}ok(threw,'locked move rejected');p=S.updateBlueprint(catalog,p,{type:'lock',id,value:false});
const count=p.blueprint.nodes.length;const q0=p.recipe.find(x=>x.kind==='flower').quantity;p=S.updateBlueprint(catalog,p,{type:'duplicate',id});eq(p.blueprint.nodes.length,count+1);ok(p.recipe.find(x=>x.kind==='flower').quantity===q0+1,'duplicate sync recipe');const dup=p.blueprint.nodes.find(n=>!new Set([]).has(n.id)&&n.material_id===p.blueprint.nodes.find(x=>x.id===id).material_id&&n.id!==id);
ok(Boolean(dup),'duplicate exists');
const delId=p.blueprint.nodes[p.blueprint.nodes.length-1].id;const count2=p.blueprint.nodes.length;p=S.updateBlueprint(catalog,p,{type:'delete',id:delId});eq(p.blueprint.nodes.length,count2-1);
const m=p.blueprint.nodes[0];const mx=m.x;p=S.updateBlueprint(catalog,p,{type:'mirror',id:m.id});eq(p.blueprint.nodes.find(n=>n.id===m.id).x,Number((-mx).toFixed(1)));

const br=p.recipe.find(x=>x.kind==='flower');p=S.updateBuild(catalog,p,{key:br.key,used:br.quantity,loss:1});ok(p.build.shortages.some(x=>x.key===br.key),'loss creates shortage');ok(p.build.substitutionAdvice.length>0,'sub advice');
p=S.recordFeedback(catalog,p,{actual_difficulty:'困难',minutes:75,issues:'右侧下坠、绣球补水慢',notes:'下次减轻右侧'});eq(p.resultFeedback.actual_difficulty,'困难');eq(p.resultFeedback.minutes,75);ok(p.resultFeedback.issues.length===2);ok(p.history.some(x=>x.type==='feedback'));

let hand=S.handoffObject(p);let v=S.validateImportObject(hand,catalog);ok(v.ok,'valid handoff');let bad=JSON.parse(JSON.stringify(hand));bad.plan.recipe[0].quantity=-2;v=S.validateImportObject(bad,catalog);ok(!v.ok&&v.errors.some(x=>x.includes('quantity')),'negative rejected');bad=JSON.parse(JSON.stringify(hand));bad.plan.blueprint.nodes[1].id=bad.plan.blueprint.nodes[0].id;v=S.validateImportObject(bad,catalog);ok(!v.ok&&v.errors.some(x=>x.includes('重复')),'duplicate stem rejected');bad=JSON.parse(JSON.stringify(hand));bad.schema='floralab/9.9';v=S.validateImportObject(bad,catalog);ok(!v.ok&&v.errors.length>0,'unknown schema rejected');
const v5={schema:'floralab/0.5',plan:{...plan(),engineVersion:'0.5.0',handoff:{schema:'floralab/0.5',version:3},blueprint:{version:'1.0',nodes:[]}}};const migrated=S.migratePlan(catalog,v5);eq(migrated.handoff.schema,'floralab/2.0');eq(migrated.blueprint.version,'2.0');ok(migrated.history.some(x=>x.type==='migration'));
const pub=S.publicCatalog(catalog);eq(pub.flowers.length,117);ok(pub.flowers.some(x=>x.reference_only));
console.log(`engine-regression: ${checks} checks passed`);