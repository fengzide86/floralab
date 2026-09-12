(function(){
'use strict';
const LOCK_LABELS={
  materials:['花材','保持花材种类不变'],
  colors:['颜色','保持当前配色与材料颜色'],
  quantities:['数量','保持材料清单数量'],
  vessel:['花器','保持花器不变'],
  special_objects:['特殊物件','保持玩偶、亚克力牌等特殊物件'],
  packaging:['包装','保持当前包装材料'],
  mechanics:['固定与供水','保持固定与供水结构'],
  structure:['结构','保持点位与轮廓']
};
function branchCard(branch,currentId,esc,preview){
  const active=branch.project_id===currentId;
  return `<article class="branch-card ${active?'active':''}"><div class="branch-card-head"><div><small>${active?'当前':'分支'}</small><b>${esc(branch.label)}</b></div><span>${esc(branch.intent||'原始方向')}</span></div>${preview(branch.plan,branch.label)}<dl><div><dt>轮廓</dt><dd>${esc(branch.silhouette||'—')}</dd></div><div><dt>鲜花</dt><dd>${branch.flowerCount} 枝</dd></div><div><dt>材料</dt><dd>${branch.materialCount} 类</dd></div></dl><div class="branch-actions">${active?'<span>当前方向</span>':`<button data-open-branch="${esc(branch.project_id)}">打开</button><button data-compare-branch="${esc(branch.project_id)}">对比</button>`}</div></article>`;
}
function summaryCard(title,data,esc,preview){
  return `<article><small>${title}</small><b>${esc(data.label)}</b><p>${esc(data.intent||'原始方向')}</p>${preview(data.plan,data.label)}<dl><div><dt>轮廓</dt><dd>${esc(data.silhouette||'—')}</dd></div><div><dt>鲜花</dt><dd>${data.flowerCount} 枝</dd></div><div><dt>视觉重量</dt><dd>${esc(data.mass||'—')}</dd></div></dl></article>`;
}
function render({plan,options,branches,compare,view='front',compareSide='a',esc}){
  const exp=plan.exploration||{},locks=exp.locks||{};
  const visual=globalThis.FloraLabDirectionPreview,frame=visual.bounds([plan,...options.map(x=>x.plan),...branches.map(x=>x.plan)],view);
  const preview=(p,label)=>visual.render(p,{view,frame,label,esc});
  const lockMarkup=Object.entries(LOCK_LABELS).map(([key,[label,note]])=>`<button class="explore-lock ${locks[key]?'active':''}" data-explore-lock="${key}" role="switch" aria-checked="${locks[key]?'true':'false'}" aria-pressed="${locks[key]?'true':'false'}"><span>${locks[key]?'已锁定':'允许调整'}</span><b>${label}</b><small>${locks[key]?note:'新方案可调整；当前方案保持原样'}</small></button>`).join('');
  const variationMarkup=options.map((option,i)=>`<article class="variation-card ${option.enabled?'':'disabled'}"><div class="variation-no">${String(i+1).padStart(2,'0')}</div>${option.plan?preview(option.plan,option.label):'<div class="direction-empty">已锁定，暂不生成预览</div>'}<div class="variation-copy"><b>${esc(option.label)}</b><p>${esc(option.summary)}</p><small>变化：${option.available.map(x=>x==='structure'?'结构':'数量').join(' / ')||'已全部锁定'}${option.blocked.length?` · 锁住：${option.blocked.map(x=>x==='structure'?'结构':'数量').join(' / ')}`:''}</small></div><button data-variation="${option.key}" ${option.enabled?'':'disabled'}>查看变化 →</button></article>`).join('');
  const compareMarkup=compare?`<section class="branch-compare"><div class="panel-head"><div><div class="kicker">Compare</div><h3>两个方向真正改了什么。</h3><p>同一视角、同一尺度，对照轮廓与材料变化。</p></div><button class="text-action" id="closeBranchCompare">关闭对比</button></div><div class="compare-toggle"><button data-compare-side="a" aria-pressed="${compareSide==='a'}">A · 当前方向</button><button data-compare-side="b" aria-pressed="${compareSide==='b'}">B · 对比方向</button></div><div class="compare-grid compare-${compareSide}">${summaryCard('当前方向',compare.current,esc,preview)}${summaryCard('对比方向',compare.target,esc,preview)}</div><div class="compare-changes"><b>材料与构图差异</b>${compare.changes.length?compare.changes.map(x=>`<span>${esc(x)}</span>`).join(''):'<span>材料没有变化，主要差异来自摆放与构图方向。</span>'}</div></section>`:'';
  return `<section class="panel explore-hero"><div><div class="kicker">Creative Direction</div><h2 class="section-title">先选一个喜欢的方向。</h2><p>先比较，再保存为另一个方案。选定制作方案前，可以继续探索。</p><div class="view-switch direction-view-switch" aria-label="方向预览视角">${[['front','正面'],['top','俯视']].map(([key,label])=>`<button data-explore-view="${key}" class="${view===key?'active':''}" aria-pressed="${view===key}">${label}</button>`).join('')}</div><p class="direction-note">摆放示意：圆点表示花头，方块表示特殊物件，颜色跟随材料。它表达位置与轮廓；真实花瓣与成品感觉请看效果图。</p></div><figure class="direction-current">${preview(plan,'当前方向')}<figcaption><b>${esc(exp.branch?.label||'主线')}</b><span>${esc(plan.compositionIntent?.label||'原始方向')} · 当前构图</span></figcaption></figure></section>
  <details class="panel explore-locks"><summary>查看与调整锁定 · 材料事实优先</summary><div class="panel-head"><div><div class="kicker">Locks</div><h2 class="section-title">什么必须保持不变？</h2><p>开关显示当前状态。它约束新方案，不修改眼前这份材料清单与摆放。</p></div></div><div class="lock-grid">${lockMarkup}</div></details>
  <section class="panel explore-variations"><div class="panel-head"><div><div class="kicker">Variations</div><h2 class="section-title">换个摆放，看看差别。</h2><p>同一尺度比较。点击“查看变化”后，会先列出差异，再由你决定是否保存。手机可左右滑动卡片。</p></div></div><div class="variation-list">${variationMarkup}</div></section>
  <section class="panel branch-family"><div class="panel-head"><div><div class="kicker">Branches</div><h2 class="section-title">保存过的方案</h2><p>${branches.length} 个方向属于同一个作品家族。可以随时切回原方向，也可以并排比较。</p></div></div><div class="branch-grid">${branches.map(x=>branchCard(x,plan.id,esc,preview)).join('')}</div>${compareMarkup}</section>`;
}
globalThis.FloraLabExploreView={render};
})();
