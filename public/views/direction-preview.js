(function(){
'use strict';
const COLORS={紫色:'#9c87aa',白色:'#faf8f2',粉色:'#ddb0b8',红色:'#a95b57',蓝色:'#89a7b8',黄色:'#dcc36a',橙色:'#cf8d60',绿色:'#7d9277',奶油色:'#e6d7b9',黑色:'#39373b'};
const W=420,H=300,PAD=28;
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
function position(node,view){return [finite(node.x),view==='top'?-finite(node.y):finite(node.z)];}
function bounds(plans,view='front'){
  let half=25,up=35,down=4;
  for(const plan of plans.filter(Boolean)){
    const bp=plan.blueprint||{},v=bp.vessel||{};
    half=Math.max(half,finite(v.opening_cm,12)/2,finite(v.base_cm,12)/2);
    if(view!=='top')up=Math.max(up,finite(v.height_cm,0));
    for(const node of [...(bp.nodes||[]),...(bp.mechanics?.anchors||[])]){
      const [x,z]=position(node,view),r=Math.max(1,finite(node.head_cm,4)/2);
      half=Math.max(half,Math.abs(x)+r);up=Math.max(up,z+r);down=Math.max(down,-z+r);
    }
  }
  if(view==='top')up=down=Math.max(up,down);
  const scale=Math.min((W-2*PAD)/(2*half),(H-2*PAD)/(up+down));
  return {scale,base:PAD+up*scale};
}
function render(plan,{view='front',frame,label='构图预览',esc}={}){
  const bp=plan?.blueprint;
  if(!bp?.nodes?.length)return '<div class="direction-empty">暂无可预览的结构</div>';
  const {scale,base}=frame||bounds([plan],view);
  const pt=n=>{const [x,z]=position(n,view);return [W/2+x*scale,base-z*scale];};
  const num=n=>finite(n).toFixed(2),v=bp.vessel||{},opening=finite(v.opening_cm,12)*scale/2,height=finite(v.height_cm,16)*scale,bottom=finite(v.base_cm,10)*scale/2;
  const isBouquet=/花束/.test(plan.type||'');
  const [tieX,tieY]=pt((bp.mechanics?.anchors||[])[0]||{x:0,y:0,z:0});
  const vessel=isBouquet?`<path d="M ${num(tieX-10)} ${num(tieY-2)} h 20 m -20 5 h 20" class="direction-vessel"/>`:view==='top'?`<ellipse cx="210" cy="${num(base)}" rx="${num(opening)}" ry="${num(opening)}" class="direction-vessel"/>`:`<path d="M ${num(210-opening)} ${num(base-height)} L ${num(210-bottom)} ${num(base)} H ${num(210+bottom)} L ${num(210+opening)} ${num(base-height)} Z" class="direction-vessel"/>`;
  const nodes=[...bp.nodes].sort((a,b)=>finite(b.y)-finite(a.y));
  const marks=nodes.map(n=>{
    const [x,y]=pt(n),anchor=(bp.mechanics?.anchors||[]).find(a=>a.id===n.anchor_id)||{x:0,y:0,z:0},[ax,ay]=pt(anchor);
    const color=String(n.color||''),fill=COLORS[color]||COLORS[`${color}色`]||'#ddd8cc',r=Math.max(2,finite(n.head_cm,4)*scale/2),special=n.kind==='creative';
    const head=special?`<rect x="${num(x-r)}" y="${num(y-r)}" width="${num(r*2)}" height="${num(r*2)}" rx="3" fill="${fill}"/>`:`<circle cx="${num(x)}" cy="${num(y)}" r="${num(r)}" fill="${fill}"/>`;
    return `<g class="direction-node" data-preview-node="${esc(n.id)}"><title>${esc(n.name||n.id)} · ${esc(color)}${special?' · 特殊物件':''}</title><line x1="${num(ax)}" y1="${num(ay)}" x2="${num(x)}" y2="${num(y)}"/>${head}</g>`;
  }).join('');
  return `<svg class="direction-preview" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} · ${view==='top'?'俯视':'正面'}构图示意" data-preview-scale="${num(scale)}"><line class="direction-ground" x1="20" y1="${num(base)}" x2="400" y2="${num(base)}"/>${vessel}${marks}</svg>`;
}
globalThis.FloraLabDirectionPreview={bounds,render};
})();
