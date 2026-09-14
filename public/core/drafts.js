(function(){
'use strict';
const KEY='floralab-studio-draft',VERSION=1;
const TEXT_FIELDS={idea:20000,type:100,style:2000,existing:20000,size:100,budgetPriority:100,region:1000,preferred:5000,avoid:5000,petContext:2000,mechanicPreference:100};
const NUMBER_FIELDS=['budget','designMonth'];
const has=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const fail=(code,message)=>({ok:false,code,message});

function sanitize(form){
  if(!object(form))throw new Error('草稿表单格式不正确，尚未保存。');
  const clean={};
  for(const [key,limit] of Object.entries(TEXT_FIELDS)){
    if(!has(form,key))continue;
    if(typeof form[key]!=='string'||form[key].length>limit)throw new Error('草稿字段格式不正确或内容过长，尚未保存。');
    clean[key]=form[key];
  }
  for(const key of NUMBER_FIELDS){
    if(!has(form,key))continue;
    const value=form[key];
    // Keep intermediate form values, including an empty or invalid number, for editing after recovery.
    if(!((typeof value==='number'&&Number.isFinite(value))||(typeof value==='string'&&value.length<=100)))throw new Error('草稿数值格式不正确，尚未保存。');
    clean[key]=value;
  }
  if(has(form,'colors')){
    if(!Array.isArray(form.colors)||form.colors.length>10||form.colors.some(x=>typeof x!=='string'||!x.trim()||x.length>100))throw new Error('草稿颜色格式不正确，尚未保存。');
    clean.colors=[...new Set(form.colors)];
  }
  if(Object.keys(form).length&&!Object.keys(clean).length)throw new Error('没有可保存的创作表单字段。');
  return clean;
}

function isEmpty(form,mode,date){
  if(mode!=='floral')return false;
  const defaults={type:'花束',size:'medium',budgetPriority:'balance',budget:0,designMonth:date.getMonth()+1};
  return Object.entries(form).every(([key,value])=>{
    if(key==='colors')return value.length===0;
    if(typeof value==='string'&&!value.trim())return true;
    if(has(defaults,key))return String(value)===String(defaults[key]);
    return false;
  });
}

function create(options={}){
  const now=options.now||(()=>new Date());
  // Access localStorage inside each operation so browser privacy restrictions produce a usable result.
  const storage=()=>has(options,'storage')?options.storage:globalThis.localStorage;
  function clear(){
    try{storage().removeItem(KEY);return {ok:true,draft:null,cleared:true};}
    catch{return fail('storage','草稿未能清除，请保留当前内容后重试。');}
  }
  function read(){
    let raw;
    try{raw=storage().getItem(KEY);}catch{return fail('storage','无法读取本机草稿，请检查浏览器存储权限。');}
    if(raw===null)return {ok:true,draft:null};
    let value;
    try{value=JSON.parse(raw);}catch{return fail('corrupt','本机草稿无法读取，原有数据已保留。');}
    if(!object(value)||!Number.isInteger(value.version))return fail('corrupt','本机草稿格式不完整，原有数据已保留。');
    if(value.version!==VERSION)return fail('version','此草稿来自其他版本，请更新 FloraLab 后再试。');
    try{
      if(!['floral','creative'].includes(value.mode)||typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt)))throw new Error();
      const form=sanitize(value.form);
      return {ok:true,draft:{version:VERSION,updatedAt:value.updatedAt,mode:value.mode,form}};
    }catch{return fail('corrupt','本机草稿格式不完整，原有数据已保留。');}
  }
  function save(value){
    let draft,date;
    try{
      if(!object(value)||!['floral','creative'].includes(value.mode))throw new Error('草稿模式不正确，尚未保存。');
      const form=sanitize(value.form);
      date=now();
      draft={version:VERSION,updatedAt:date.toISOString(),mode:value.mode,form};
    }catch(error){return fail('invalid',error.message||'草稿格式不正确，尚未保存。');}
    if(isEmpty(draft.form,draft.mode,date))return clear();
    try{storage().setItem(KEY,JSON.stringify(draft));return {ok:true,draft,cleared:false};}
    catch{return fail('storage','草稿尚未保存在本机，请先复制文字，避免刷新后丢失。');}
  }
  return {read,save,clear};
}
globalThis.FloraLabDrafts={create,key:KEY,version:VERSION};
})();
