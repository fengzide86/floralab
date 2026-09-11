const fs=require('fs'),path=require('path'),assert=require('assert');
const Studio=require('../lib/studio');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','catalog.json'),'utf8'));
let n=0;const ok=(x,m)=>{assert.ok(x,m);n++};
const input={mode:'floral',type:'花束',colors:['紫色','白色'],budget:360,budgetPriority:'balance',style:'自然、温柔',existing:'',size:'medium',designMonth:9,region:'',preferred:'玫瑰、绣球',avoid:'',petContext:'',mechanicPreference:''};
const plan=Studio.createStudioPlan(catalog,input);
const spec=Studio.buildRenderSpec(plan);
ok(spec.version==='1.0','Render Spec version');
ok(spec.purpose==='effect-render-handoff','Render purpose');
ok(!Object.prototype.hasOwnProperty.call(plan,'render'),'Render is not duplicated into editable plan state');
ok(spec.materials.length>0,'Render materials exist');
for(const m of spec.materials){const r=plan.recipe.find(x=>x.key===m.key);ok(r&&Number(r.quantity)===Number(m.quantity),`Recipe quantity is authoritative for ${m.key}`);}
ok(spec.hard_constraints.includes('Recipe 数量'),'Recipe quantity locked');
ok(spec.structure&&spec.structure.silhouette&&spec.structure.height_layers&&spec.structure.depth_layers,'structure summary exists');
ok(Array.isArray(spec.self_check)&&spec.self_check.length>=6,'self check exists');
ok(!JSON.stringify(spec).includes('还原率'),'no fake fidelity percentage');
const handoff=Studio.handoffObject(plan);
ok(handoff.render&&handoff.render.version==='1.0','handoff exports Render Spec');
ok(handoff.recipe===plan.recipe,'handoff keeps original Recipe');
ok(!Object.prototype.hasOwnProperty.call(handoff.plan,'render'),'nested plan remains source-only');
const row=plan.recipe.find(x=>['flower','creative'].includes(x.kind)&&x.quantity>0);
const changed=Studio.updateRecipe(catalog,plan,[{key:row.key,quantity:row.quantity+1,owned:row.owned,unit_price:row.unit_price}]);
const changedSpec=Studio.buildRenderSpec(changed),changedMat=changedSpec.materials.find(x=>x.key===row.key);
ok(changedMat.quantity===row.quantity+1,'Render quantity follows Recipe edits');
const node=changed.blueprint.nodes[0],before=Studio.buildRenderSpec(changed).structure.visual_mass.x_cm;
const moved=Studio.updateBlueprint(catalog,changed,{type:'set',id:node.id,x:Number(node.x||0)+4});
const after=Studio.buildRenderSpec(moved).structure.visual_mass.x_cm;
ok(before!==after,'Render structure follows Blueprint edits');
const text=Studio.renderHandoffText(changed);
ok(text.includes('【硬约束｜不得擅自改变】'),'handoff text has hard constraints');
ok(text.includes(row.name),'handoff text names material');
ok(text.includes(`× ${row.quantity+1}${row.unit}`),'handoff text carries exact Recipe count');
ok(text.includes('生成后自检'),'handoff text has self check');
const stale=Studio.handoffObject(plan);stale.render.materials[0].quantity+=3;
const validation=Studio.validateImportObject(stale,catalog);
ok(validation.ok,'stale Render does not block source-compatible import');
ok(validation.warnings.some(x=>x.includes('Render Spec 与 Recipe 数量不一致')),'stale Render mismatch is warned');
const old=Studio.handoffObject(plan);delete old.render;
const oldV=Studio.validateImportObject(old,catalog),migrated=Studio.migratePlan(catalog,old),regen=Studio.handoffObject(migrated);
ok(oldV.ok,'old 1.0 file without Render remains valid');
ok(regen.render&&regen.render.materials.length>0,'old file regenerates Render on export');

// Regression fixture from the real failures that motivated 1.3: white flowers must not
// silently recolor, eucalyptus stays at 4, and a confirmed acrylic sign keeps its anchor.
const violet={
  title:'Violet Playground · 紫雾奇想',handoff:{version:7},dimensions:{height:56,width:62,depth:42},
  recipe:[
    {key:'flower:rose:white',kind:'flower',name:'玫瑰',variant:'白',role:'主花',quantity:8,unit:'枝'},
    {key:'flower:lisianthus:white',kind:'flower',name:'洋桔梗',variant:'白',role:'过渡',quantity:5,unit:'枝'},
    {key:'flower:hydrangea:white',kind:'flower',name:'绣球',variant:'白',role:'体块',quantity:1,unit:'枝'},
    {key:'flower:eucalyptus:green',kind:'flower',name:'尤加利',variant:'绿',role:'叶材',quantity:4,unit:'枝'},
    {key:'flower:statice:purple',kind:'flower',name:'补血草',variant:'紫',role:'填充',quantity:5,unit:'枝'},
    {key:'creative:acrylic',kind:'creative',name:'亚克力牌',variant:'透明紫',role:'特殊物件',quantity:1,unit:'个'}
  ],
  mechanics:{type:'bundle tie + independent armature',items:['束扎','独立骨架'],why:'保持特殊物件上部位置'},
  blueprint:{version:'2.0',dimensions:{height:56,width:62,depth:42},nodes:[
    {id:'R01',material_id:'rose',kind:'flower',name:'玫瑰',color:'白',role:'主花',x:-7,y:-2,z:34,head_cm:7},
    {id:'H01',material_id:'hydrangea',kind:'flower',name:'绣球',color:'白',role:'体块',x:5,y:1,z:31,head_cm:15},
    {id:'E01',material_id:'eucalyptus',kind:'flower',name:'尤加利',color:'绿',role:'叶材',x:-24,y:4,z:38,head_cm:4},
    {id:'A01',material_id:'acrylic',kind:'creative',name:'亚克力牌',color:'透明紫',role:'特殊物件',x:7,y:6,z:50,head_cm:8}
  ],vessel:null,mechanics:{anchors:[{x:0,y:0,z:0}]}}
};
const violetSpec=Studio.buildRenderSpec(violet);
const q=name=>violetSpec.materials.find(x=>x.name===name);
ok(q('玫瑰').variant==='白'&&q('玫瑰').quantity===8,'white roses stay white x8');
ok(q('绣球').variant==='白'&&q('绣球').quantity===1,'white hydrangea stays white x1');
ok(q('尤加利').quantity===4,'eucalyptus remains x4');
ok(q('补血草').quantity===5,'statice remains x5');
ok(violetSpec.special_objects.length===1&&violetSpec.special_objects[0].name==='亚克力牌','acrylic sign is retained');
ok(violetSpec.special_objects[0].positions[0].z===50,'acrylic sign upper anchor is retained');
ok(violetSpec.mechanics.type==='bundle tie + independent armature','confirmed Mechanics retained');
const violetText=Studio.renderHandoffText(violet);
ok(violetText.includes('玫瑰（白） × 8枝')&&violetText.includes('尤加利（绿） × 4枝'),'handoff text locks real regression quantities/colors');
ok(violetText.includes('亚克力牌 × 1')&&violetText.includes('A01'),'handoff text carries special-object anchor');

console.log(`render-1.3: ${n} checks passed`);
