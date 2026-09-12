const assert=require('assert'),fs=require('fs'),vm=require('vm');
const Studio=require('../lib/studio');
const catalog=require('../data/catalog.json');
let count=0;const ok=(x,m)=>{assert.ok(x,m);count++;};
const source=Studio.createStudioPlan(catalog,{type:'花束',colors:['紫色','白色'],style:'自然',size:'medium',budget:0,designMonth:9});
const before=JSON.stringify(source);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context={};vm.createContext(context);
vm.runInContext(fs.readFileSync('public/views/direction-preview.js','utf8'),context);
const Visual=context.FloraLabDirectionPreview;
for(const option of Studio.variationOptions(source)){
  const preview=Studio.previewVariation(catalog,source,option.key),saved=Studio.createVariation(catalog,source,option.key);
  ok(JSON.stringify(source)===before,'preview and fork leave source unchanged: '+option.key);
  ok(preview.id===source.id&&preview.history.length===source.history.length,'preview does not create a project/history entry: '+option.key);
  ok(JSON.stringify(preview.blueprint)===JSON.stringify(saved.blueprint),'preview matches generated branch: '+option.key);
  ok(JSON.stringify(preview.recipe)===JSON.stringify(saved.recipe),'preview uses actual generated Recipe: '+option.key);
  for(const view of ['front','top']){
    const frame=Visual.bounds([source,preview],view);
    const svg=Visual.render(preview,{view,frame,label:option.label,esc:escape});
    ok((svg.match(/data-preview-node=/g)||[]).length===preview.blueprint.nodes.length,'exactly one mark per Blueprint node: '+option.key+' '+view);
    ok(!/NaN|Infinity|undefined/.test(svg),'valid preview coordinates: '+option.key+' '+view);
  }
}
const locked=Studio.updateExploration(source,{quantities:true});
ok(JSON.stringify(Studio.previewVariation(catalog,locked,'airy').recipe)===JSON.stringify(locked.recipe),'quantity lock respected by preview');
assert.throws(()=>Studio.previewVariation(catalog,Studio.updateExploration(source,{structure:true}),'rightRise'),/variation_locked/);count++;
const weird=JSON.parse(before);weird.blueprint.nodes[0].name='<img src=x onerror=alert(1)>';
const svg=Visual.render(weird,{esc:escape});
ok(!svg.includes('<img')&&svg.includes('&lt;img'),'imported material text is escaped');
ok(!svg.includes('tabindex'),'preview cannot edit or focus Blueprint nodes');
vm.runInContext(fs.readFileSync('public/views/explore.js','utf8'),context);
const disabled=Studio.variationOptions(Studio.updateExploration(source,{structure:true,quantities:true}));
ok(context.FloraLabExploreView.render({plan:source,options:disabled,branches:[],compare:null,esc:escape}).includes('已锁定，暂不生成预览'),'locked preview explains its empty state');
console.log(`direction-preview: ${count} checks passed`);
