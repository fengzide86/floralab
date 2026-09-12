'use strict';
const assert=require('assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {bundle}=require('../scripts/bundle-commonjs');
const {loadRuntime,transcript}=require('./helpers/runtime-harness');
const {createBrowserRuntime}=require('../browser/runtime-entry');
const catalog=require('../data/catalog.json');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'public/runtime.js'),'utf8');
const fixture=require('./fixtures/runtime-1.5.2.json');
let count=0;
const ok=(value,label)=>{assert.ok(value,label);count++;};
async function main(){
  for(const scenario of fixture.scenarios){
    const actual=await transcript(loadRuntime(source),scenario.input);
    assert.deepEqual(actual,scenario.expected,scenario.name+' must preserve released 1.5.2 behavior');
    count+=Object.keys(actual).length;
  }
  let fetches=0;
  const runtime=createBrowserRuntime({version:'test',baseUrl:'https://example.com/floralab/',fetch:async url=>{
    fetches++;assert.equal(url,'https://example.com/floralab/data/catalog.json?v=test');
    if(fetches===1)return {ok:false};
    return {ok:true,json:async()=>catalog};
  }});
  await assert.rejects(runtime.getCatalog(),/catalog_load_failed/);count++;
  const [a,b]=await Promise.all([runtime.getCatalog(),runtime.getCatalog()]);
  ok(fetches===2&&a===b,'failed catalog loads recover and concurrent callers share a request');
  ok((await runtime.request('/api/status')).version==='test','adapter uses injected release version');
  await assert.rejects(runtime.request('/api/unknown'),e=>e.status===404&&e.data.error==='not_found');count++;
  await assert.rejects(runtime.request('/api/design/variation',{method:'POST',body:'{}'}),e=>e.data.error==='missing_plan');count++;
  await assert.rejects(runtime.request('/api/design/validate-import',{method:'POST',body:'{"recipe":{}}'}),e=>e.status===422);count++;
  const options={root,entry:'browser/runtime-entry.js',externals:{crypto:'browser/crypto-shim.js'}};
  const first=bundle(options),second=bundle(options);
  ok(first.code===second.code,'runtime bundle is deterministic');
  ok(first.modules.includes('lib/recipe.js')&&first.modules.includes('lib/runtime.js'),'recursive dependencies are included');
  assert.throws(()=>bundle({...options,externals:{}}),/Unsupported browser dependency crypto/);count++;
  const index=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const sw=fs.readFileSync(path.join(root,'public/service-worker.js'),'utf8');
  for(const match of index.matchAll(/<script src="\.\/([^\"]+)"/g)){
    ok(sw.includes(`'./${match[1].split('?')[0]}'`),'offline shell includes '+match[1]);
  }
  const browserRuntime=loadRuntime(source);
  const plan=await browserRuntime.request('/api/design/generate',{method:'POST',body:JSON.stringify(fixture.scenarios[0].input)});
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  freeze(plan);
  const state=freeze({selectedNode:plan.blueprint.nodes[0].id,view:'front',buildStep:0,status:{version:'test'}});
  const context={};
  for(const name of ['blueprint','render','work','making'])vm.runInNewContext(fs.readFileSync(path.join(root,'public/views',name+'.js'),'utf8'),context);
  const deps={state,esc:String,money:String,cleanTitle:String,colorHex:()=> '#fff',viewNames:{front:'正面'},buildRenderSpec:browserRuntime.Studio.buildRenderSpec};
  const blueprint=context.FloraLabBlueprintViews.create(deps);
  const render=context.FloraLabRenderViews.create(deps);
  const work=context.FloraLabWorkViews.create({...deps,renderBlueprint:blueprint.renderBlueprint});
  const making=context.FloraLabMakingViews.create({...deps,renderBlueprint:blueprint.renderBlueprint});
  for(const fn of [blueprint.structureTab,render.renderHandoffTab,work.workTab,work.recipeTab,work.printSheet,making.buildTab,making.feedbackTab,making.historyTab]){
    ok(fn(plan).length>30,fn.name+' renders without modifying frozen state or plan');
  }
  console.log(`runtime-architecture: ${count} checks passed`);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
