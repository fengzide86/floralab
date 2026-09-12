'use strict';
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const root=path.resolve(__dirname,'..');
function collect(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(dir,entry.name);
  return entry.isDirectory()?collect(file):file.endsWith('.js')?[file]:[];
});}
const files=['browser','lib','public','scripts','tests'].flatMap(dir=>collect(path.join(root,dir))).sort();
for(const file of files){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0){process.stderr.write(result.stderr||String(result.error));process.exit(result.status||1);}
}
console.log(`syntax: ${files.length} JavaScript files checked`);
