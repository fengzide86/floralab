(function(){
'use strict';

function render({state,esc}){
  const projects=Array.isArray(state.projects)?state.projects:[];
  const familyMap=new Map();
  for(const row of projects){
    const plan=row.state?.plan,family=plan?.exploration?.branch?.family_id||plan?.id||row.id;
    if(!familyMap.has(family))familyMap.set(family,{...row,branchCount:1});
    else familyMap.get(family).branchCount+=1;
  }
  const families=[...familyMap.values()];
  return `<main class="wrap"><section class="hero"><div class="hero-copy"><div class="kicker">Floral Design / Build Study</div><h1>从一个想法，<br>到真正做出来。</h1><p>先把模糊想法变成几条真正不同的方向，选定喜欢的版本，再把材料与结构落实到现实制作。</p><div class="hero-actions"><button class="primary" id="newDesign">开始一个作品</button><label class="text-action file-input">导入设计文件 →<input id="importFile" type="file" accept=".floralab,.json,.floralab.json,application/json"></label></div></div><figure class="hero-figure"><img class="hero-cover" src="assets/hero-render-study.webp" alt="FloraLab 紫白花艺构图封面"><figcaption class="figure-note"><span>Study No. 01</span><span>Form · Tone · Structure</span></figcaption></figure></section><section class="process"><article><div class="no">01</div><h2>想法</h2><p>先说主题、感觉，或你已经确定的花材与特殊物件。</p></article><article><div class="no">02</div><h2>方向</h2><p>看几条明显不同的构图路，锁住喜欢的部分，再继续变化。</p></article><article><div class="no">03</div><h2>制作</h2><p>确定“我要做它”之后，再进入 Recipe、Mechanics、Blueprint 与制作记录。</p></article></section><section class="local-projects" id="localProjects">${families.length?`<div class="section-head"><div><div class="kicker">On this device</div><h2 class="section-title">本机作品</h2></div></div><div class="local-project-grid">${families.slice(0,6).map(x=>`<button class="local-project" data-open-project="${esc(x.id)}"><span>${esc(x.title||'未命名作品')}</span><small>${new Date(x.updatedAt).toLocaleDateString()}${x.branchCount>1?` · ${x.branchCount} 个方向`:''}</small></button>`).join('')}</div>`:''}</section></main>`;
}

globalThis.FloraLabHomeView={render};
})();
