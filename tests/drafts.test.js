'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../public/core/drafts.js'),'utf8');
const context={};vm.runInNewContext(source,context);
const Drafts=context.FloraLabDrafts;
const date=new Date('2026-09-14T12:00:00.000Z');
const clone=value=>JSON.parse(JSON.stringify(value));
let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name);}
function memory(entries={}){
  const data=new Map(Object.entries(entries));
  return {data,getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}
function create(storage){return Drafts.create({storage,now:()=>new Date(date)});}
const normal={mode:'floral',form:{idea:'  白绿桌花，不要玫瑰\n保留自然空隙。  ',type:'桌花',colors:['白色','绿色'],budget:150,budgetPriority:'balance',style:'自然',existing:'8枝白洋桔梗',size:'small',designMonth:9,region:'广州',preferred:'尤加利',avoid:'玫瑰',petContext:'家里有猫',mechanicPreference:'鸡笼网'}};

check('an untouched browser has no draft',()=>assert.deepEqual(clone(create(memory()).read()),{ok:true,draft:null}));
check('all form content survives a new store instance and is isolated from callers',()=>{
  const storage=memory(),input=clone(normal),saved=create(storage).save(input);
  assert.equal(saved.ok,true);assert.equal(saved.cleared,false);
  input.form.idea='后来改动';input.form.colors.push('紫色');saved.draft.form.existing='外部修改';
  const restored=create(storage).read();
  assert.deepEqual(clone(restored.draft.form),normal.form);
  assert.equal(restored.draft.updatedAt,date.toISOString());assert.equal(restored.draft.version,1);
});
check('whitelist omits projects, images and arbitrary extra properties',()=>{
  const storage=memory();create(storage).save({...normal,plan:{id:'do-not-save'},form:{...normal.form,photo:'base64-image',plan:{id:'other'}}});
  const saved=JSON.parse(storage.data.get(Drafts.key));
  assert.deepEqual(Object.keys(saved).sort(),['form','mode','updatedAt','version']);
  assert.deepEqual(saved.form,normal.form);
});
check('draft updates and deletion never touch existing work or backup keys',()=>{
  const entries={'floralab-studio-state':'current-project','floralab-studio-backup':'previous-project','floralab-1.1':'legacy-project','media':'existing-image'},storage=memory(entries),drafts=create(storage);
  drafts.save(normal);drafts.save({...normal,form:{idea:'另一句想法'}});drafts.clear();
  assert.deepEqual(Object.fromEntries(storage.data),entries);
});
check('blank default form clears an older draft instead of creating an empty recovery card',()=>{
  const storage=memory(),drafts=create(storage);drafts.save(normal);
  const saved=drafts.save({mode:'floral',form:{idea:' \n ',type:'花束',colors:[],budget:'0',budgetPriority:'balance',style:'',existing:'',size:'medium',designMonth:9,region:'',preferred:'',avoid:'',petContext:'',mechanicPreference:''}});
  assert.equal(saved.ok,true);assert.equal(saved.cleared,true);assert.equal(drafts.read().draft,null);
});
check('choices alone are kept even before writing an idea',()=>{
  for(const value of [{mode:'creative',form:{}},{mode:'floral',form:{colors:['蓝色']}},{mode:'floral',form:{size:'large'}},{mode:'floral',form:{designMonth:12}},{mode:'floral',form:{region:'广州'}},{mode:'floral',form:{budgetPriority:'effect'}}]){
    const storage=memory(),saved=create(storage).save(value);assert.equal(saved.ok,true);assert.equal(saved.cleared,false);assert.deepEqual(clone(create(storage).read().draft.form),value.form);
  }
});
check('intermediate invalid numeric input is recoverable for correction',()=>{
  const storage=memory(),form={idea:'桌花',budget:'-1',designMonth:''};create(storage).save({mode:'floral',form});assert.deepEqual(clone(create(storage).read().draft.form),form);
});
check('invalid inputs report failure and leave the previous valid draft intact',()=>{
  const storage=memory(),drafts=create(storage);drafts.save(normal);const original=storage.data.get(Drafts.key);
  for(const value of [null,{},[],{mode:'other',form:{}},{mode:'floral',form:null},{mode:'floral',form:[]},{mode:'floral',form:{plan:{id:'bad'}}},{mode:'floral',form:{idea:12}},{mode:'floral',form:{idea:'x'.repeat(20001)}},{mode:'floral',form:{budget:Infinity}},{mode:'floral',form:{colors:['white',{}]}}]){
    assert.equal(drafts.save(value).ok,false);assert.equal(storage.data.get(Drafts.key),original);
  }
});
check('malformed stored data is reported and preserved',()=>{
  for(const raw of ['{broken','null','[]','{}',JSON.stringify({version:1,mode:'floral',updatedAt:'invalid date',form:{idea:'test'}}),JSON.stringify({version:1,mode:'creative',updatedAt:date.toISOString(),form:{colors:[true]}})]){
    const storage=memory({[Drafts.key]:raw}),result=create(storage).read();assert.equal(result.ok,false);assert.equal(result.code,'corrupt');assert.equal(storage.data.get(Drafts.key),raw);
  }
});
check('a newer schema version is not mistaken for a current draft or deleted',()=>{
  const raw=JSON.stringify({version:2,mode:'floral',form:{idea:'future draft'}}),storage=memory({[Drafts.key]:raw}),result=create(storage).read();
  assert.equal(result.ok,false);assert.equal(result.code,'version');assert.equal(storage.data.get(Drafts.key),raw);
});
check('quota failure reports unsaved and retains the last saved draft',()=>{
  const storage=memory(),drafts=create(storage);drafts.save(normal);const original=storage.data.get(Drafts.key);
  storage.setItem=()=>{throw new Error('QuotaExceededError');};
  const result=drafts.save({mode:'floral',form:{idea:'This failed'}});assert.equal(result.ok,false);assert.equal(result.code,'storage');assert.equal(storage.data.get(Drafts.key),original);
});
check('failed deletion is not reported as cleared',()=>{
  const storage=memory(),drafts=create(storage);drafts.save(normal);storage.removeItem=()=>{throw new Error('SecurityError');};
  assert.equal(drafts.clear().ok,false);assert.equal(drafts.save({mode:'floral',form:{}}).ok,false);assert.equal(drafts.read().draft.form.idea,normal.form.idea);
});
check('blocked storage access is returned as an error for every operation',()=>{
  const restricted={};Object.defineProperty(restricted,'localStorage',{get(){throw new Error('SecurityError');}});vm.runInNewContext(source,restricted);
  const drafts=restricted.FloraLabDrafts.create();
  assert.equal(drafts.read().code,'storage');assert.equal(drafts.save(normal).code,'storage');assert.equal(drafts.clear().code,'storage');
});
check('serialized prototype keys cannot leak into the restored form',()=>{
  const storage=memory(),value=JSON.parse('{"mode":"floral","form":{"idea":"桌花","__proto__":{"polluted":true},"constructor":"bad"}}');
  create(storage).save(value);assert.deepEqual(clone(create(storage).read().draft.form),{idea:'桌花'});assert.equal({}.polluted,undefined);
});
console.log(`Draft persistence: ${count} checks passed.`);
