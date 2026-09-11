(function(){
'use strict';

function render({state,esc}){
  const projects=Array.isArray(state.projects)?state.projects:[];
  return `<main class="wrap"><section class="hero"><div class="hero-copy"><div class="kicker">Floral Design / Build Study</div><h1>从一个想法，<br>到真正做出来。</h1><p>把花材、预算和结构落实到每一枝，再按步骤完成现实作品。</p><div class="hero-actions"><button class="primary" id="newDesign">开始一个作品</button><label class="text-action file-input">导入设计文件 →<input id="importFile" type="file" accept=".floralab,.json,.floralab.json,application/json"></label></div></div><figure class="hero-figure"><img class="hero-cover" src="assets/hero-render-study.webp" alt="FloraLab 紫白花艺构图封面"><figcaption class="figure-note"><span>Study No. 01</span><span>Form · Tone · Structure</span></figcaption></figure></section><section class="process"><article><div class="no">01</div><h2>设计</h2><p>先确定形式、颜色、预算和已有材料。</p></article><article><div class="no">02</div><h2>调整</h2><p>材料数量、采购价格与每一枝的位置都可以继续修改。</p></article><article><div class="no">03</div><h2>制作</h2><p>五个施工视图共享同一份结构稿，并记录材料消耗与损耗。</p></article></section><section class="local-projects" id="localProjects">${projects.length?`<div class="section-head"><div><div class="kicker">On this device</div><h2 class="section-title">本机作品</h2></div></div><div class="local-project-grid">${projects.slice(0,6).map(x=>`<button class="local-project" data-open-project="${esc(x.id)}"><span>${esc(x.title||'未命名作品')}</span><small>${new Date(x.updatedAt).toLocaleDateString()}</small></button>`).join('')}</div>`:''}</section></main>`;
}

globalThis.FloraLabHomeView={render};
})();
