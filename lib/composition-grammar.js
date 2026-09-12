const VERSION='1.0';

const PRESETS={
  airy:{
    key:'airy',label:'轻盈留白',summary:'拉开外围，让焦点更集中，填充与叶材更克制。',
    affects:['structure','quantities'],scaleX:1.12,scaleY:1.08,scaleZ:1.06,biasX:-0.03,biasZ:0.02,flowX:0.05,lineLift:0.08,focusScale:0.86,rotation:0,depthWave:0.05,quantity:{factor:0.82,roles:['填充','叶材','过渡','点缀']}
  },
  rightRise:{
    key:'rightRise',label:'右上延伸',summary:'把主要动势推向右上，保持中心可读但明显不对称。',
    affects:['structure'],scaleX:1.08,scaleY:1.00,scaleZ:1.08,biasX:0.08,biasZ:0.02,flowX:0.24,lineLift:0.10,focusScale:0.94,rotation:-4,depthWave:0.04
  },
  leftSweep:{
    key:'leftSweep',label:'左侧舒展',summary:'把外围线条与视觉重量向左拉开，形成更长的横向呼吸。',
    affects:['structure'],scaleX:1.14,scaleY:1.02,scaleZ:0.98,biasX:-0.08,biasZ:0,flowX:-0.22,lineLift:0.04,focusScale:0.94,rotation:4,depthWave:0.05
  },
  lowWide:{
    key:'lowWide',label:'低位横向',summary:'压低整体重心、放宽左右跨度，更接近桌花式的横向展开。',
    affects:['structure'],scaleX:1.22,scaleY:1.04,scaleZ:0.82,biasX:0,biasZ:-0.03,flowX:0,lineLift:0.01,focusScale:0.92,rotation:0,depthWave:0.03
  },
  sculptural:{
    key:'sculptural',label:'雕塑感',summary:'加强前后错位和不对称，让结构更像一件空间作品。',
    affects:['structure','quantities'],scaleX:1.05,scaleY:1.18,scaleZ:1.10,biasX:0.02,biasZ:0.01,flowX:0.12,lineLift:0.08,focusScale:0.82,rotation:10,depthWave:0.18,quantity:{factor:0.78,roles:['填充','过渡','点缀']}
  },
  focused:{
    key:'focused',label:'收束聚焦',summary:'把主体往中心收，外围更少，焦点更明确。',
    affects:['structure'],scaleX:0.76,scaleY:0.80,scaleZ:0.94,biasX:0,biasZ:0,flowX:0,lineLift:0.02,focusScale:0.72,rotation:0,depthWave:0.02
  }
};

function clone(v){return JSON.parse(JSON.stringify(v));}
function getPreset(key){const p=PRESETS[key];if(!p)throw new Error('variation_preset_not_found');return clone(p);}
function hash01(text=''){
  let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0)/0xffffffff;
}
function isFocus(node){return /焦点|主花|体块/.test(node.role||'');}
function isLine(node){return /线条|叶材/.test(node.role||'');}
function clamp(n,a,b){return Math.max(a,Math.min(b,n));}

function applyToBlueprint(rawBlueprint,presetKey){
  const bp=clone(rawBlueprint);
  const p=getPreset(presetKey);
  const dims=bp.dimensions||{width:60,depth:40,height:56};
  const w=Number(dims.width||60),d=Number(dims.depth||40),h=Number(dims.height||56);
  const anchor=bp.mechanics?.anchors?.[0]||{x:0,y:0,z:0};
  const rad=Number(p.rotation||0)*Math.PI/180;
  for(const n of bp.nodes||[]){
    if(n.locked)continue;
    const focus=isFocus(n),line=isLine(n);
    let dx=Number(n.x||0)-Number(anchor.x||0);
    let dy=Number(n.y||0)-Number(anchor.y||0);
    let dz=Number(n.z||0)-Number(anchor.z||0);
    const localScale=focus?Number(p.focusScale||1):1;
    dx*=Number(p.scaleX||1)*localScale;
    dy*=Number(p.scaleY||1)*(focus?0.92:1);
    dz*=Number(p.scaleZ||1)*(focus?0.96:1);
    const rx=dx*Math.cos(rad)-dy*Math.sin(rad);
    const ry=dx*Math.sin(rad)+dy*Math.cos(rad);
    dx=rx;dy=ry;
    const vertical=Math.max(0,Math.min(1,(Number(n.z||0)-Number(anchor.z||0))/Math.max(1,h-Number(anchor.z||0))));
    dx+=Number(p.biasX||0)*w + Number(p.flowX||0)*w*(vertical-0.25);
    dz+=Number(p.biasZ||0)*h + (line?Number(p.lineLift||0)*h:0);
    const wave=(hash01(String(n.id||n.name))-0.5)*2;
    dy+=wave*Number(p.depthWave||0)*d;
    n.x=Number(clamp(Number(anchor.x||0)+dx,-w/2,w/2).toFixed(1));
    n.y=Number(clamp(Number(anchor.y||0)+dy,-d/2,d/2).toFixed(1));
    n.z=Number(clamp(Number(anchor.z||0)+dz,Math.max(0,Number(anchor.z||0)+2),h*1.08).toFixed(1));
  }
  bp.composition_intent={version:VERSION,preset:p.key,label:p.label,summary:p.summary};
  return bp;
}

function adjustRecipe(rawRecipe,presetKey){
  const rows=clone(rawRecipe||[]);
  const p=getPreset(presetKey);
  if(!p.quantity)return rows;
  const roles=new Set(p.quantity.roles||[]);
  const factor=Number(p.quantity.factor||1);
  for(const row of rows){
    if(row.kind!=='flower'||!roles.has(row.role||''))continue;
    const old=Math.max(0,Number(row.quantity||0));
    if(!old)continue;
    const next=Math.max(1,Math.round(old*factor));
    row.quantity=next;
    row.owned=Math.min(Number(row.owned||0),next);
    row.to_buy=Math.max(0,next-row.owned);
    row.subtotal=Number((row.to_buy*Number(row.unit_price||0)).toFixed(2));
  }
  return rows;
}

function optionsFor(locks={}){
  return Object.values(PRESETS).map(p=>{
    const blocked=(p.affects||[]).filter(key=>Boolean(locks[key]));
    const available=(p.affects||[]).filter(key=>!locks[key]);
    return {key:p.key,label:p.label,summary:p.summary,affects:[...p.affects],blocked,available,enabled:available.length>0};
  });
}

module.exports={VERSION,PRESETS,getPreset,applyToBlueprint,adjustRecipe,optionsFor};
