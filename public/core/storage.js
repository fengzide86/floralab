(function(){
'use strict';

const DB_NAME='floralab-studio';
const DB_VERSION=1;
const STATE_KEY='floralab-studio-state';
const BACKUP_KEY='floralab-studio-backup';
const LEGACY_STATE_KEYS=['floralab-1.1','floralab-1.0','floralab-v5','floralab-v4'];
const LEGACY_BACKUP_KEYS=['floralab-1.1-backup','floralab-1.0-backup'];

function create({state,cleanTitle}){
  if(!state)throw new Error('FloraLabStorage requires state');
  if(typeof cleanTitle!=='function')throw new Error('FloraLabStorage requires cleanTitle');

  function openDB(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'});
        if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }

  async function idbPut(store,value){
    try{
      const db=await openDB();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction(store,'readwrite');
        tx.objectStore(store).put(value);
        tx.oncomplete=resolve;
        tx.onerror=()=>reject(tx.error);
      });
      db.close();
    }catch{}
  }

  async function idbGet(store,key){
    try{
      const db=await openDB();
      const value=await new Promise((resolve,reject)=>{
        const tx=db.transaction(store,'readonly');
        const req=tx.objectStore(store).get(key);
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
      });
      db.close();
      return value;
    }catch{return null;}
  }

  async function idbAll(store){
    try{
      const db=await openDB();
      const value=await new Promise((resolve,reject)=>{
        const tx=db.transaction(store,'readonly');
        const req=tx.objectStore(store).getAll();
        req.onsuccess=()=>resolve(req.result||[]);
        req.onerror=()=>reject(req.error);
      });
      db.close();
      return value;
    }catch{return[];}
  }

  function snapshot(){
    return {plan:state.plan,form:state.form,mode:state.mode};
  }

  function save(){
    try{
      const prev=localStorage.getItem(STATE_KEY)||LEGACY_STATE_KEYS.map(key=>localStorage.getItem(key)).find(Boolean);
      if(prev)localStorage.setItem(BACKUP_KEY,prev);
      const raw=JSON.stringify(snapshot());
      localStorage.setItem(STATE_KEY,raw);
      if(state.plan?.id){
        const row={
          id:state.plan.id,
          title:cleanTitle(state.plan.title),
          updatedAt:new Date().toISOString(),
          state:snapshot()
        };
        idbPut('projects',row);
        idbPut('meta',{key:'current',planId:state.plan.id});
        const i=state.projects.findIndex(x=>x.id===row.id);
        if(i>=0)state.projects[i]=row;
        else state.projects.unshift(row);
      }
    }catch{}
  }

  async function load(){
    try{
      const current=localStorage.getItem(STATE_KEY);
      const raw=current||LEGACY_STATE_KEYS.map(key=>localStorage.getItem(key)).find(Boolean)||'';
      let value=JSON.parse(raw||'{}');
      if(!current&&raw)localStorage.setItem(STATE_KEY,raw);
      if(!value.plan){
        const meta=await idbGet('meta','current');
        const row=meta?.planId?await idbGet('projects',meta.planId):null;
        if(row?.state)value=row.state;
      }
      state.plan=value.plan||null;
      state.form={...state.form,...(value.form||{})};
      state.mode=value.mode||'floral';
      state.projects=(await idbAll('projects')).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    }catch{
      state.projects=[];
    }
  }

  async function restoreBackup(){
    try{
      const raw=localStorage.getItem(BACKUP_KEY)||LEGACY_BACKUP_KEYS.map(key=>localStorage.getItem(key)).find(Boolean);
      if(!raw)return {ok:false,message:'没有找到上一版本地备份'};
      const value=JSON.parse(raw);
      if(!value.plan)return {ok:false,message:'备份内容不完整'};
      state.plan=value.plan;
      state.form={...state.form,...(value.form||{})};
      state.mode=value.mode||state.mode;
      localStorage.setItem(STATE_KEY,raw);
      await idbPut('projects',{
        id:state.plan.id,
        title:cleanTitle(state.plan.title),
        updatedAt:new Date().toISOString(),
        state:snapshot()
      });
      await idbPut('meta',{key:'current',planId:state.plan.id});
      return {ok:true,message:'已恢复浏览器上一版'};
    }catch(error){
      return {ok:false,message:`恢复失败：${error?.message||error}`};
    }
  }

  return {openDB,idbPut,idbGet,idbAll,snapshot,save,load,restoreBackup,keys:{state:STATE_KEY,backup:BACKUP_KEY}};
}

globalThis.FloraLabStorage={create};
})();
