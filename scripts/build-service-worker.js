const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(ROOT,'package.json'),'utf8'));
const version=String(pkg.version||'dev');
// A cached previous worker may still control the first visit after deployment.
// Version every executable/style URL so it cannot combine old views with a new app.
const indexPath=path.join(ROOT,'public','index.html');
const index=fs.readFileSync(indexPath,'utf8').replace(/((?:src|href)="\.\/[^"?]+\.(?:js|css))(?:\?v=[^"\s]*)?"/g,`$1?v=${version}"`);
fs.writeFileSync(indexPath,index);
const source=fs.readFileSync(path.join(ROOT,'public','service-worker.template.js'),'utf8');
if(!source.includes('__FLORALAB_VERSION__'))throw new Error('service-worker version token missing');
const output=source.replaceAll('__FLORALAB_VERSION__',version);
fs.writeFileSync(path.join(ROOT,'public','service-worker.js'),output);
console.log(`service worker built for ${version}`);
