(function(){
'use strict';
const LOCK_LABELS={
  materials:['花材','保持花材种类不变'],
  colors:['颜色','保持当前配色与材料颜色'],
  quantities:['数量','保持 Recipe 数量不变'],
  vessel:['花器','保持花器不变'],
  special_objects:['特殊物件','保持玩偶、亚克力牌等特殊物件'],
  packaging:['包装','保持当前包装材料'],
  mechanics:['Mechanics','保持固定与供水结构'],
  structure:['结构','保持 Blueprint 点位与轮廓']
};
function branchCard(branch,currentId,esc){
  const active=branch.project_id===currentId;
  return `<article class="branch-card ${active?'active':''}"><div class="branch-card-head"><div><small>${active?'CURRENT':'BRANCH'}</small><b>${esc(branch.label)}</b></div><span>${esc(branch.intent||'原始方向')}</span></div><dl><div><dt>轮廓</dt><dd>${esc(branch.silhouette||'—')}</dd></div><div><dt>鲜花</dt><dd>${branch.flowerCount} 枝</dd></div><div><dt>材料</dt><dd>${branch.materialCount} 类</dd></div></dl><div class="branch-actions">${active?'<span>当前方向</span>':`<button data-open-branch="${esc(branch.project_id)}">打开</button><button data-compare-branch="${esc(branch.project_id)}">对比</button>`}</div></article>`;
}
function summaryCard(title,data,esc){
  return `<article><small>${title}</small><b>${esc(data.label)}</b><p>${esc(data.intent||'原始方向')}</p><dl><div><dt>轮廓</dt><dd>${esc(data.silhouette||'—')}</dd></div><div><dt>鲜花</dt><dd>${data.flowerCount} 枝</dd></div><div><dt>视觉重量</dt><dd>${esc(data.mass||'—')}</dd></div></dl></article>`;
}
function render({plan,options,branches,compare,esc}){
  const exp=plan.exploration||{},locks=exp.locks||{};
  const lockMarkup=Object.entries(LOCK_LABELS).map(([key,[label,note]])=>`<button class="explore-lock ${locks[key]?'active':''}" data-explore-lock="${key}" aria-pressed="${locks[key]?'true':'false'}"><span>${locks[key]?'锁定':'可变化'}</span><b>${label}</b><small>${note}</small></button>`).join('');
  const variationMarkup=options.map((option,i)=>`<article class="variation-card ${option.enabled?'':'disabled'}"><div class="variation-no">${String(i+1).padStart(2,'0')}</div><div><b>${esc(option.label)}</b><p>${esc(option.summary)}</p><small>变化：${option.available.map(x=>x==='structure'?'结构':'数量').join(' / ')||'已全部锁定'}${option.blocked.length?` · 锁住：${option.blocked.map(x=>x==='structure'?'结构':'数量').join(' / ')}`:''}</small></div><button data-variation="${option.key}" ${option.enabled?'':'disabled'}>生成分支 →</button></article>`).join('');
  const compareMarkup=compare?`<section class="branch-compare"><div class="panel-head"><div><div class="kicker">Compare</div><h3>两个方向真正改了什么。</h3></div><button class="text-action" id="closeBranchCompare">关闭对比</button></div><div class="compare-grid">${summaryCard('CURRENT',compare.current,esc)}${summaryCard('COMPARE',compare.target,esc)}</div><div class="compare-changes"><b>Recipe / 构图差异</b>${compare.changes.length?compare.changes.map(x=>`<span>${esc(x)}</span>`).join(''):'<span>Recipe 没有变化，主要差异来自 Blueprint / 构图方向。</span>'}</div></section>`:'';
  return `<section class="panel explore-hero"><div><div class="kicker">Creative Direction</div><h2 class="section-title">保留确定的事实，<br>只改变你想继续探索的部分。</h2><p>每次生成都会新建一个分支，不覆盖当前作品。这里不是随机抽方案，而是在明确约束下改变构图方向。</p></div><aside><small>当前分支</small><b>${esc(exp.branch?.label||'主线')}</b><span>${esc(plan.compositionIntent?.label||'原始方向')}</span></aside></section>
  <section class="panel explore-locks"><div class="panel-head"><div><div class="kicker">Locks</div><h2 class="section-title">什么必须保持不变？</h2><p>锁定只约束未来的新方向，不会反过来修改当前 Recipe / Mechanics / Blueprint。</p></div></div><div class="lock-grid">${lockMarkup}</div></section>
  <section class="panel explore-variations"><div class="panel-head"><div><div class="kicker">Variations</div><h2 class="section-title">从同一件作品，走几条不同的路。</h2><p>第一版 Variation 以构图为主；部分方向会在“数量未锁定”时克制调整填充、叶材或过渡数量。</p></div></div><div class="variation-list">${variationMarkup}</div></section>
  <section class="panel branch-family"><div class="panel-head"><div><div class="kicker">Branches</div><h2 class="section-title">同一个想法，不必只有一条版本线。</h2><p>${branches.length} 个方向属于同一个作品家族。可以随时切回原方向，也可以并排比较。</p></div></div><div class="branch-grid">${branches.map(x=>branchCard(x,plan.id,esc)).join('')}</div>${compareMarkup}</section>`;
}
globalThis.FloraLabExploreView={render};
})();