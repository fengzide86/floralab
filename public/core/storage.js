(function(){
'use strict';
const DB_NAME='floralab-studio',DB_VERSION=2;
const STATE_KEY='floralab-studio-state',BACKUP_KEY='floralab-studio-backup';
const LEGACY_STATE_KEYS=['floralab-1.1','floralab-1.0','floralab-v5','floralab-v4'];
const LEGACY_BACKUP_KEYS=['floralab-1.1-backup','floralab-1.0-backup'];
const copy=value=>JSON.parse(JSON.stringify(value));
function create({state,cleanTitle,onStatus=()=>{}}){
  let queue=Promise.resolve();
  // A tab may only replace the version it actually read. Keep this outside the
  // exported plan so legacy files and other devices remain compatible.
  const baselines=new Map((state.projects||[]).map(row=>[row.id,JSON.stringify(row.state?.plan)]));
  function remember(row){if(row?.state?.plan)baselines.set(row.id,JSON.stringify(row.state.plan));}
  function conflict(){const error=new Error('这件作品已在另一个页面更新。当前修改尚未保存，请先导出保留，再刷新并打开最新作品。');error.code='STORAGE_CONFLICT';return error;}
  function status(label,tone='saved'){state.saveStatus={label,tone};onStatus(state.saveStatus);}
  function openDB(){return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{const db=req.result;for(const [name,keyPath] of [['projects','id'],['meta','key'],['media','id'],['revisions','id']])if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath});};
    req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
    req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('请关闭旧版 FloraLab 标签页，再重试保存'));
  });}
  async function read(store,key,all=false){const db=await openDB();try{return await new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store)[all?'getAll':'get'](...(all?[]:[key]));req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}finally{db.close();}}
  async function idbGet(store,key){try{return await read(store,key);}catch{return null;}}
  async function idbAll(store){try{return await read(store,null,true)||[];}catch{return [];}}
  async function idbPut(store,value){const db=await openDB();try{await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||new Error('保存被中断'));});}finally{db.close();}}
  function snapshot(plan=state.plan){return copy({plan,form:state.form,mode:state.mode,lastTab:state.tab||'work',updatedAt:new Date().toISOString()});}
  function updateRows(row){const index=state.projects.findIndex(x=>x.id===row.id);if(index<0)state.projects.push(copy(row));else state.projects[index]=copy(row);state.projects.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  async function persist(value,{assets=[],selection,reason='修改前快照',requireDB=false}={}){
    if(!value.plan?.id)throw new Error('缺少需要保存的作品');
    status('保存中…','pending');
    const row={id:value.plan.id,title:cleanTitle(value.plan.title),updatedAt:value.updatedAt||new Date().toISOString(),state:copy(value)};
    let dbSaved=false,dbError;
    try{
      const db=await openDB();
      try{await new Promise((resolve,reject)=>{
        const tx=db.transaction(['projects','meta','media','revisions'],'readwrite'),projects=tx.objectStore('projects');
        const previous=projects.get(row.id);let transactionError;
        previous.onsuccess=()=>{
          const old=previous.result;
          if(old?.state?.plan&&JSON.stringify(old.state.plan)!==baselines.get(row.id)){
            transactionError=conflict();tx.abort();return;
          }
          if(old?.state?.plan&&JSON.stringify(old.state.plan)!==JSON.stringify(row.state.plan))tx.objectStore('revisions').put({id:crypto.randomUUID(),projectId:old.id,title:old.title,at:old.updatedAt,reason,state:old.state});
          projects.put(row);
        };
        tx.objectStore('meta').put({key:'current',planId:row.id});
        if(selection)tx.objectStore('meta').put({key:'selection:'+selection.family,planId:selection.id});
        for(const asset of assets)tx.objectStore('media').put(asset);
        tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(transactionError||tx.error||new Error('本机存储事务失败'));
      });dbSaved=true;remember(row);}finally{db.close();}
    }catch(error){dbError=error;}
    if(dbError?.code==='STORAGE_CONFLICT'){state.saveConflict={projectId:row.id,...copy(value)};status('其他页面已有更新，本页修改未保存','error');throw dbError;}
    if(!dbSaved&&(requireDB||assets.length)){status('保存失败，请导出备份','error');throw new Error(dbError?.message||'本机存储空间不足');}
    let mirrorSaved=false;
    try{const prev=localStorage.getItem(STATE_KEY)||LEGACY_STATE_KEYS.map(k=>localStorage.getItem(k)).find(Boolean);if(prev)localStorage.setItem(BACKUP_KEY,prev);localStorage.setItem(STATE_KEY,JSON.stringify(value));mirrorSaved=true;}catch{}
    if(!dbSaved&&!mirrorSaved){status('保存失败，请立即导出','error');throw new Error('本机存储不可用或空间不足；当前编辑仍在页面中，请导出备份。');}
    updateRows(row);
    if(state.saveConflict?.projectId===row.id)state.saveConflict=null;
    if(selection){state.selections=state.selections||{};state.selections[selection.family]=selection.id;}
    status(dbSaved?'已保存在本机':'仅保存当前作品，请导出备份',dbSaved?'saved':'warning');
    return row;
  }
  function enqueue(fn){const result=queue.then(fn);queue=result.catch(()=>{});return result;}
  function save(){const value=snapshot();const promise=enqueue(()=>persist(value));promise.catch(()=>{});return promise;}
  function commitPlan(plan,options={}){
    const value=snapshot(plan);if(options.form)value.form=copy(options.form);if(options.mode)value.mode=options.mode;
    return enqueue(async()=>{await persist(value,{...options,requireDB:true});state.plan=copy(value.plan);state.form=copy(value.form);state.mode=value.mode;return state.plan;});
  }
  function setLocation({projectId,tab}){
    if(!projectId)return Promise.resolve();
    return enqueue(async()=>{
      const db=await openDB();
      try{await new Promise((resolve,reject)=>{
        const tx=db.transaction('meta','readwrite'),meta=tx.objectStore('meta');
        meta.put({key:'current',planId:projectId});meta.put({key:'location:'+projectId,tab:tab||'work'});
        tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error||new Error('没有保存阅读位置'));
      });}finally{db.close();}
    });
  }
  async function openProject(id,{isCurrent=()=>true}={}){
    await queue;
    const stored=await read('projects',id),row=stored||state.projects.find(item=>item.id===id),location=await idbGet('meta','location:'+id);
    if(!row?.state?.plan||!isCurrent())return null;
    remember(row);updateRows(row);
    if(state.saveConflict?.projectId===id)state.saveConflict=null;
    state.plan=copy(row.state.plan);state.form={...state.form,...copy(row.state.form||{})};state.mode=row.state.mode||'floral';state.tab=location?.tab||row.state.lastTab||'work';
    status('已从本机接续');return state.plan;
  }
  async function load(){
    state.projects=(await idbAll('projects')).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    baselines.clear();state.projects.forEach(remember);
    state.selections=Object.fromEntries((await idbAll('meta')).filter(x=>x.key.startsWith('selection:')).map(x=>[x.key.slice(10),x.planId]));
    let mirror={};try{mirror=JSON.parse(localStorage.getItem(STATE_KEY)||LEGACY_STATE_KEYS.map(k=>localStorage.getItem(k)).find(Boolean)||'{}');}catch{}
    const current=await idbGet('meta','current'),stored=state.projects.find(x=>x.id===current?.planId)?.state;
    const value=stored&&(!mirror.updatedAt||String(stored.updatedAt)>=String(mirror.updatedAt))?stored:mirror;
    state.plan=value.plan||null;state.form={...state.form,...(value.form||{})};state.mode=value.mode||'floral';state.tab=value.lastTab||'work';
    if(state.plan){const location=await idbGet('meta','location:'+state.plan.id);if(location?.tab)state.tab=location.tab;}
    if(state.plan&&!state.projects.some(x=>x.id===state.plan.id))updateRows({id:state.plan.id,title:cleanTitle(state.plan.title),updatedAt:value.updatedAt||new Date().toISOString(),state:copy(value)});
    status(state.plan?'已从本机接续':'作品将保存在本机');
  }
  async function revisions(projectId=state.plan?.id){return (await idbAll('revisions')).filter(x=>x.projectId===projectId).sort((a,b)=>String(b.at).localeCompare(String(a.at)));}
  async function backupInfo(){
    try{const raw=localStorage.getItem(BACKUP_KEY)||LEGACY_BACKUP_KEYS.map(k=>localStorage.getItem(k)).find(Boolean);if(!raw)return null;const value=JSON.parse(raw);return value.plan?{id:'legacy',title:cleanTitle(value.plan.title),at:value.updatedAt||value.plan.handoff?.updated_at,state:value}:null;}catch{return null;}
  }
  async function restoreBackup(entry){
    const selected=entry||await backupInfo();if(!selected?.state?.plan)return {ok:false,message:'没有可恢复的完整快照'};
    const plan=copy(selected.state.plan);plan.history=plan.history||[];plan.history.push({type:'restore',summary:'恢复快照；恢复前的状态已另外保留',at:new Date().toISOString()});
    await commitPlan(plan,{form:selected.state.form||state.form,mode:selected.state.mode||state.mode,reason:'恢复前快照'});
    return {ok:true,message:'已恢复，恢复前状态仍在快照列表中'};
  }
  return {openDB,idbPut,idbGet,idbAll,snapshot,save,commitPlan,setLocation,openProject,load,revisions,backupInfo,restoreBackup,keys:{state:STATE_KEY,backup:BACKUP_KEY}};
}
globalThis.FloraLabStorage={create};
})();
