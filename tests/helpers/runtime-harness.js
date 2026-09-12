'use strict';
const vm=require('vm');
const crypto=require('crypto');
const catalog=require('../../data/catalog.json');

function loadRuntime(source,fetchOverride){
  let counter=0;
  const time='2026-09-12T12:00:00.000Z';
  class FixedDate extends Date {
    constructor(...args){super(...(args.length?args:[time]));}
    static now(){return new Date(time).getTime();}
  }
  const context={URL,console,Date:FixedDate,crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++counter).padStart(12,'0')}`},document:{baseURI:'https://example.com/floralab/'}};
  context.fetch=fetchOverride||(async()=>({ok:true,json:async()=>JSON.parse(JSON.stringify(catalog))}));
  context.window=context;
  vm.runInNewContext(source,context,{filename:'runtime.js'});
  return context.FloraLabRuntime;
}
// The 1.5.2 fixture predates price provenance; product tests verify that new field separately.
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(value,(key,value)=>key==='price_source'?undefined:value)).digest('hex');}
async function transcript(runtime,input){
  const call=(route,body)=>runtime.request('/api/design/'+route,{method:'POST',body:JSON.stringify(body)});
  const records={};
  let plan=await call('generate',input);
  const record=name=>{records[name]=digest(plan);};
  record('generated');
  records.renderSpec=digest(runtime.Studio.buildRenderSpec(plan));
  records.handoff=digest(runtime.Studio.handoffObject(plan));
  const row=plan.recipe[0];
  plan=await call('update-recipe',{plan,patches:[{key:row.key,quantity:row.quantity+1,owned:1,unit_price:9.5}]});
  record('purchase-edit');
  plan=await call('update-exploration',{plan,patch:{quantities:true,colors:true}});
  record('locked');
  plan=await call('variation',{plan,preset:'rightRise'});
  record('variation');
  const node=plan.blueprint.nodes.find(n=>!n.locked);
  if(node){plan=await call('update-blueprint',{plan,action:{type:'move',id:node.id,x:node.x+1,y:node.y,z:node.z}});record('blueprint');}
  plan=await call('update-build',{plan,patch:{currentStep:2}});
  record('build');
  plan=await call('feedback',{plan,feedback:{minutes:35,actual_difficulty:'中等',issues:['运输时右侧下垂'],notes:'下次加固'}});
  record('feedback');
  const imported=await call('validate-import',runtime.Studio.handoffObject(plan));
  records.imported=digest(imported.plan);
  return records;
}
module.exports={loadRuntime,digest,transcript};
