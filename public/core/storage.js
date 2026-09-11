(function(){
'use strict';

const DB_NAME='floralab-studio';
const DB_VERSION=1;

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
      const prev=localStorage.getItem('floralab-1.1')||localStorage.getItem('floralab-1.0');
      if(prev)localStorage.setItem('floralab-1.1-backup',prev);
      const raw=JSON.stringify(snapshot());
      localStorage.setItem('floralab-1.1',raw);
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
      const raw=localStorage.getItem('floralab-1.1')||localStorage.getItem('floralab-1.0')||localStorage.getItem('floralab-v5')||localStorage.getItem('floralab-v4');
      let value=JSON.parse(raw||'{}');
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

  return {openDB,idbPut,idbGet,idbAll,snapshot,save,load};
}

globalThis.FloraLabStorage={create};
})();
