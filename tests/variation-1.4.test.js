const fs=require('fs'),path=require('path'),assert=require('assert');
const Studio=require('../lib/studio');
const Grammar=require('../lib/composition-grammar');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','catalog.json'),'utf8'));
let n=0;const ok=(x,m)=>{assert.ok(x,m);n++};

const input={mode:'floral',type:'花束',colors:['紫色','白色'],budget:500,budgetPriority:'effect',style:'自然、温柔',existing:'',size:'medium',designMonth:9,region:'',preferred:'玫瑰、绣球',avoid:'',petContext:'',mechanicPreference:''};
const root=Studio.createStudioPlan(catalog,input);
const rootRecipe=JSON.stringify(root.recipe);
const rootId=root.id,rootBranch=root.exploration.branch.id,rootFamily=root.exploration.branch.family_id;
const positions=plan=>new Map((plan.blueprint.nodes||[]).map(x=>[x.id,[x.x,x.y,x.z]]));
const distance=(a,b)=>{
  const A=positions(a),B=positions(b);let sum=0,count=0;
  for(const [id,p] of A){const q=B.get(id);if(!q)continue;sum+=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);count++;}
  return count?sum/count:0;
};
const bounds=plan=>{
  const nodes=plan.blueprint.nodes||[],xs=nodes.map(x=>x.x),zs=nodes.map(x=>x.z);
  return {width:Math.max(...xs)-Math.min(...xs),height:Math.max(...zs)-Math.min(...zs),meanX:xs.reduce((a,b)=>a+b,0)/xs.length,meanZ:zs.reduce((a,b)=>a+b,0)/zs.length};
};

const options=Studio.variationOptions(root);
ok(options.length===Object.keys(Grammar.PRESETS).length,'all grammar presets exposed');
ok(options.every(x=>x.enabled),'all presets available with no locks');

const right=Studio.createVariation(catalog,root,'rightRise');
ok(right.id!==rootId,'variation forks project');
ok(right.exploration.branch.parent_id===rootBranch,'variation branch points to root');
ok(right.exploration.branch.family_id===rootFamily,'variation stays in family');
ok(right.compositionIntent.preset==='rightRise','composition intent recorded');
ok(right.exploration.lastVariation.preset==='rightRise','last variation recorded');
ok(JSON.stringify(right.recipe)===rootRecipe,'structure-only variation preserves Recipe');
ok(distance(root,right)>3,'right-rise materially changes Blueprint');
ok(bounds(right).meanX>bounds(root).meanX,'right-rise shifts visual mass right');

const left=Studio.createVariation(catalog,root,'leftSweep');
ok(distance(root,left)>3,'left-sweep materially changes Blueprint');
ok(bounds(left).meanX<bounds(root).meanX,'left-sweep shifts visual mass left');
ok(JSON.stringify(left.blueprint)!==JSON.stringify(right.blueprint),'different presets create different structure');

const low=Studio.createVariation(catalog,root,'lowWide');
ok(bounds(low).height<bounds(root).height*1.02,'low-wide does not increase vertical span');
ok(bounds(low).width>bounds(root).width*.95,'low-wide keeps or expands horizontal span');

const focused=Studio.createVariation(catalog,root,'focused');
ok(bounds(focused).width<bounds(root).width,'focused narrows horizontal span');

const airy=Studio.createVariation(catalog,root,'airy');
ok(airy.compositionIntent.applied.includes('structure'),'airy changes structure');
ok(airy.compositionIntent.applied.includes('quantities'),'airy can change quantities');
const airyFlowerTotal=airy.recipe.filter(x=>x.kind==='flower').reduce((s,x)=>s+x.quantity,0);
const rootFlowerTotal=root.recipe.filter(x=>x.kind==='flower').reduce((s,x)=>s+x.quantity,0);
ok(airyFlowerTotal<=rootFlowerTotal,'airy does not increase flower count');

const qtyLocked=Studio.updateExploration(root,{quantities:true});
const airyLocked=Studio.createVariation(catalog,qtyLocked,'airy');
ok(JSON.stringify(airyLocked.recipe)===JSON.stringify(qtyLocked.recipe),'quantity lock preserves Recipe quantities');
ok(airyLocked.compositionIntent.applied.includes('structure')&&!airyLocked.compositionIntent.applied.includes('quantities'),'airy still changes unlocked structure');

const structureLocked=Studio.updateExploration(root,{structure:true});
const structureOptions=Studio.variationOptions(structureLocked);
ok(structureOptions.find(x=>x.key==='rightRise').enabled===false,'structure-only preset disabled by structure lock');
assert.throws(()=>Studio.createVariation(catalog,structureLocked,'rightRise'),/variation_locked/);n++;
const airyStructureLocked=Studio.createVariation(catalog,structureLocked,'airy');
ok(JSON.stringify(airyStructureLocked.blueprint)===JSON.stringify(structureLocked.blueprint),'structure lock preserves Blueprint');
ok(airyStructureLocked.compositionIntent.applied.includes('quantities'),'airy can still adjust unlocked quantity dimension');

const allLocked=Studio.updateExploration(root,{structure:true,quantities:true});
ok(Studio.variationOptions(allLocked).every(x=>x.enabled===false),'all current presets disabled when structure and quantities locked');

for(const key of Object.keys(Grammar.PRESETS)){
  const v=Studio.createVariation(catalog,root,key);
  ok(v.recipe.every(r=>r.quantity>=0),'variation keeps nonnegative quantities: '+key);
  ok((v.blueprint.nodes||[]).every(node=>Number.isFinite(node.x)&&Number.isFinite(node.y)&&Number.isFinite(node.z)),'variation keeps finite coordinates: '+key);
  ok(Studio.validatePlan(v,catalog,input).ok,'variation stays valid: '+key);
}

const handoff=Studio.handoffObject(right);
ok(handoff.compositionIntent?.preset==='rightRise','handoff exports composition intent');
ok(handoff.exploration.branch.family_id===rootFamily,'handoff exports branch family');

console.log(`variation-1.4: ${n} checks passed`);
