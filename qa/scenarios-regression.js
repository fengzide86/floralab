const fs=require('fs'),assert=require('assert');const catalog=require('../data/catalog.json');const S=require('../lib/studio');
let checks=0;const results=[];function ok(x,m){assert.ok(x,m);checks++;}
function run(name,input,fn){const p=S.createStudioPlan(catalog,input);fn(p);results.push({name,status:'pass',cost:p.cost.total,buildability:p.assessment.buildability,nodes:p.blueprint.nodes.length,warnings:p.assessment.warnCount,blocks:p.assessment.blockCount});}
const bases=[
 ['紫白教师节',{mode:'floral',type:'桌花',budget:300,colors:['紫色','白色'],style:'自然',size:'medium'}],
 ['粉白生日',{mode:'floral',type:'花束',budget:260,colors:['粉色','白色'],style:'温柔',size:'medium'}],
 ['蓝白毕业',{mode:'floral',type:'花束',budget:220,colors:['蓝色','白色'],style:'清冷',size:'small'}],
 ['日式极简',{mode:'floral',type:'瓶插',budget:280,colors:['白色','绿色'],style:'日式、极简',size:'medium'}],
 ['法式桌花',{mode:'floral',type:'桌花',budget:500,colors:['奶油色','粉色'],style:'法式、自然',size:'large'}],
 ['小熊创意',{mode:'creative',type:'创意花束',budget:300,colors:['粉色','白色'],style:'可爱',existing:'1个小熊'}],
 ['草莓创意',{mode:'creative',type:'创意花束',budget:260,colors:['红色','白色'],style:'甜美',preferred:'草莓'}],
 ['零食创意',{mode:'creative',type:'创意花束',budget:180,colors:['黄色','橙色'],style:'热烈',preferred:'零食'}],
 ['无植物创意',{mode:'creative',type:'创意装置',budget:200,colors:['蓝色','白色'],style:'极简',avoid:'完全不要植物',existing:'1个小熊、3张照片'}],
 ['已有花材',{mode:'floral',type:'花束',budget:200,colors:['白色','紫色'],existing:'8枝白玫瑰、2张包装纸'}]
];
for(const [name,input] of bases)run(name,input,p=>{ok(p.handoff.schema==='floralab/2.0',name+' schema');ok(p.blueprint.views.length===5,name+' views');ok(new Set(p.blueprint.nodes.map(n=>n.id)).size===p.blueprint.nodes.length,name+' ids');ok(p.recipe.every(r=>r.to_buy===Math.max(0,r.quantity-r.owned)),name+' recipe');});
run('猫与百合',{mode:'floral',type:'花束',budget:300,colors:['白色'],preferred:'百合',petContext:'家里有猫'},p=>ok(p.checks.some(c=>c.id==='pet-lily'&&c.status==='block')));
run('大尺寸低预算',{mode:'floral',type:'桌花',budget:60,colors:['紫色','白色'],size:'large'},p=>ok(p.checks.some(c=>c.id==='budget'&&c.status==='block')));
run('效果优先超预算',{mode:'floral',type:'桌花',budget:60,budgetPriority:'effect',colors:['紫色','白色'],size:'large'},p=>ok(p.checks.some(c=>c.id==='budget'&&c.status==='warn')));
run('排除百合',{mode:'floral',type:'花束',budget:300,colors:['白色'],preferred:'百合、玫瑰',avoid:'百合'},p=>ok(!p.flowers.some(f=>f.name==='百合'&&f.quantity>0)));
run('排除红色',{mode:'floral',type:'花束',budget:300,colors:['红色','白色'],avoid:'不要红色'},p=>ok(!p.palette.some(c=>c.includes('红'))));
run('花泥偏好',{mode:'floral',type:'桌花',budget:300,colors:['白色','紫色'],mechanicPreference:'鲜花泥'},p=>ok(/花泥/.test(p.mechanics.type)));
run('剑山偏好',{mode:'floral',type:'瓶插',budget:300,colors:['白色','绿色'],mechanicPreference:'剑山',style:'日式'},p=>ok(/剑山/.test(p.mechanics.type)));
run('鸡笼网偏好',{mode:'floral',type:'桌花',budget:300,colors:['白色','绿色'],mechanicPreference:'鸡笼网'},p=>ok(/鸡笼网/.test(p.mechanics.type)));
// 20 deterministic repeat / edit scenarios
for(let i=0;i<20;i++){
 const input={mode:i%4===0?'creative':'floral',type:i%4===0?'创意花束':i%3===0?'瓶插':'桌花',budget:180+i*12,colors:i%2?['紫色','白色']:['粉色','白色'],style:i%3===0?'极简':'自然',size:['small','medium','large'][i%3]};
 run('参数组合 '+(i+1),input,p=>{ok(p.cost.total>=0);ok(p.blueprint.nodes.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&Number.isFinite(n.z)));ok(p.blueprint.nodes.every(n=>n.anchor_id));});
}
// structural edit workflow
let p=S.createStudioPlan(catalog,{mode:'floral',type:'桌花',budget:350,colors:['紫色','白色'],style:'自然'});const first=p.blueprint.nodes[0];const originalIds=p.blueprint.nodes.map(n=>n.id);p=S.updateBlueprint(catalog,p,{type:'move',id:first.id,x:first.x+5,y:first.y,z:first.z});ok(p.blueprint.nodes.find(n=>n.id===first.id).x!==first.x,'move workflow');p=S.updateBlueprint(catalog,p,{type:'duplicate',id:first.id});ok(p.blueprint.nodes.length===originalIds.length+1,'duplicate workflow');const extra=p.blueprint.nodes.find(n=>!originalIds.includes(n.id));ok(extra,'new id');p=S.updateBlueprint(catalog,p,{type:'delete',id:extra.id});ok(p.blueprint.nodes.length===originalIds.length,'delete workflow');
// recipe price must preserve moved coordinate
const moved=p.blueprint.nodes.find(n=>n.id===first.id),px=moved.x;const rr=p.recipe.find(r=>r.kind==='flower');p=S.updateRecipe(catalog,p,[{key:rr.key,unit_price:rr.unit_price+3}]);ok(p.blueprint.nodes.find(n=>n.id===first.id).x===px,'price preserves structure');
// build and feedback
const r=p.recipe.find(x=>x.kind==='flower');p=S.updateBuild(catalog,p,{key:r.key,used:r.quantity,loss:1});ok(p.build.shortages.length===1,'loss gap');p=S.recordFeedback(catalog,p,{actual_difficulty:'困难',minutes:80,issues:'右侧偏重'});ok(p.resultFeedback.minutes===80,'feedback');ok(p.history.length>=6,'history continuity');
fs.writeFileSync(__dirname+'/scenarios-regression.json',JSON.stringify({checks,results},null,2));console.log(`scenarios-regression: ${checks} checks across ${results.length} scenarios passed`);