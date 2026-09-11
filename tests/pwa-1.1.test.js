const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..'),pub=path.join(root,'public');let n=0;const ok=(x,m)=>{assert.ok(x,m);n++};
const swText=fs.readFileSync(path.join(pub,'service-worker.js'),'utf8');
const coreMatch=swText.match(/const CORE=\[(.*?)\];/s);ok(coreMatch,'service worker core list');
const core=[...coreMatch[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);ok(core.length>=10,'enough offline core assets');
for(const rel of core){if(rel==='./')continue; const f=path.join(pub,rel.replace(/^\.\//,''));ok(fs.existsSync(f),`offline asset exists ${rel}`);}
let installed=null,activated=null,fetchHandler=null,added=[];const cacheStore=new Map();
const cache={addAll:async xs=>{added=[...xs];},match:async req=>cacheStore.get(typeof req==='string'?req:req.url),put:async(req,res)=>cacheStore.set(typeof req==='string'?req:req.url,res)};
const ctx={
 self:{addEventListener(type,fn){if(type==='install')installed=fn;if(type==='activate')activated=fn;if(type==='fetch')fetchHandler=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},
 caches:{open:async()=>cache,keys:async()=>['old-cache','floralab-1.1.0'],delete:async()=>true,match:async req=>cache.match(req)},
 fetch:async()=>({status:200,type:'basic',clone(){return this;}}),Promise,console,setTimeout,clearTimeout
};
vm.runInNewContext(swText,ctx,{filename:'service-worker.js'});ok(installed&&activated&&fetchHandler,'SW handlers registered');
let installPromise;installed({waitUntil(p){installPromise=p;}});Promise.resolve(installPromise).then(async()=>{
 ok(added.includes('./runtime.js'),'runtime precached');ok(added.includes('./data/catalog.json'),'catalog precached');ok(added.includes('./manifest.webmanifest'),'manifest precached');
 const mf=JSON.parse(fs.readFileSync(path.join(pub,'manifest.webmanifest'),'utf8'));ok(mf.display==='standalone','standalone');ok(mf.start_url==='./','relative start url');ok(mf.scope==='./','relative scope');ok(mf.icons.some(i=>i.purpose==='maskable'),'maskable icon');
 const desktop=path.join(root,'desktop');for(const f of ['FloraLab.ico','安装 FloraLab.cmd','打开 FloraLab.cmd','卸载 FloraLab 快捷方式.cmd'])ok(fs.existsSync(path.join(desktop,f)),`desktop pack ${f}`);
 const install=fs.readFileSync(path.join(desktop,'安装 FloraLab.cmd'),'utf8');ok(install.includes('https://fengzide86.github.io/floralab/'),'shortcut target');
 console.log(`pwa-1.1: ${n} checks passed`);
}).catch(e=>{console.error(e);process.exit(1)});