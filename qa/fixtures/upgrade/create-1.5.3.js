(function(){
'use strict';

function choiceButtons(items,current,attr,esc){
  return items.map(x=>`<button type="button" class="choice ${current===x?'active':''}" data-${attr}="${esc(x)}">${esc(x)}</button>`).join('');
}

function render({state,colors,types,styles,esc}){
  const f=state.form;
  return `<main class="wrap workspace"><header class="page-head creative-page-head"><div><div class="kicker">New Composition</div><h1 class="page-title">从一个想法开始。</h1><p class="page-sub">不用先把预算、Mechanics 和每一枝都想清楚。先说你想做什么、想往什么感觉走；确定喜欢的方向后，再进入现实制作。</p></div><div class="mode-switch"><button class="${state.mode==='floral'?'active':''}" data-mode="floral">花艺</button><button class="${state.mode==='creative'?'active':''}" data-mode="creative">创意作品</button></div></header><form class="design-form creative-form" onsubmit="return false">
  <section class="form-row creative-idea-row"><div class="form-label"><b>先说一句</b><span>主题、送给谁、某个画面，或者你只知道“我想要很轻、很怪、很紫”都可以。</span></div><div class="form-control"><textarea id="idea" class="idea-input" placeholder="例如：想做一束像紫色雾气一样的生日花，里面有一个小玩偶，但不要太甜。">${esc(f.idea||'')}</textarea><small class="idea-hint">不用写成提示词。Studio 会把这句话留在作品里，后面的方向都从同一个想法分支出去。</small></div></section>
  <section class="form-row"><div class="form-label"><b>感觉</b><span>先定气质，不必一次选得很准。</span></div><div class="form-control"><div class="style-choices">${styles.map(x=>`<button type="button" class="choice ${String(f.style).includes(x)?'active':''}" data-style="${x}">${x}</button>`).join('')}</div><input id="style" value="${esc(f.style)}" placeholder="也可以补充自己的感觉词"></div></section>
  <section class="form-row"><div class="form-label"><b>形式</b><span>大概是什么作品；后面仍然可以调整。</span></div><div class="form-control type-choices">${choiceButtons(types,f.type,'type',esc)}</div></section>
  <section class="form-row"><div class="form-label"><b>颜色线索</b><span>最多四个主色。它是起点，不是要求每个花头都同色。</span></div><div class="form-control palette">${colors.map(([n,c])=>`<button type="button" class="color-choice ${f.colors.includes(n)?'active':''}" data-color="${n}"><i style="background:${c}"></i><span>${n.replace('色','')}</span></button>`).join('')}</div></section>
  <section class="form-row"><div class="form-label"><b>已经确定的东西</b><span>如果某些花材、玩偶、包装已经买了，写清数量；它们会作为现实事实保留下来。</span></div><div class="form-control"><textarea id="existing" placeholder="例如：8枝白玫瑰、1个小熊、2张包装纸">${esc(f.existing)}</textarea></div></section>
  <details class="advanced reality-constraints"><summary><span>现实制作约束</span><small>预算、尺寸、月份、宠物、Mechanics · 可以稍后补</small></summary><div class="advanced-grid"><label><span>预算（可留空 / 0）</span><input id="budget" type="number" min="0" value="${Number(f.budget||0)||''}" placeholder="不先设预算"></label><label><span>尺寸</span><select id="size"><option value="small" ${f.size==='small'?'selected':''}>小 · 约30–40cm</option><option value="medium" ${f.size==='medium'?'selected':''}>中 · 约45–60cm</option><option value="large" ${f.size==='large'?'selected':''}>大 · 约70cm+</option></select></label><label><span>预算策略</span><select id="budgetPriority"><option value="balance" ${f.budgetPriority==='balance'?'selected':''}>填写预算后按硬约束</option><option value="effect" ${f.budgetPriority==='effect'?'selected':''}>填写预算后仍以效果优先</option></select></label><label><span>制作月份</span><input id="designMonth" type="number" min="1" max="12" value="${f.designMonth}"></label><label><span>采购地区</span><input id="region" value="${esc(f.region)}" placeholder="例如：广州"></label><label><span>指定材料</span><input id="preferred" value="${esc(f.preferred)}" placeholder="例如：一定要有玫瑰、绣球"></label><label><span>不使用</span><input id="avoid" value="${esc(f.avoid)}" placeholder="例如：百合、红色"></label><label><span>环境提醒</span><input id="petContext" value="${esc(f.petContext)}" placeholder="例如：家里有猫"></label><label><span>固定结构</span><select id="mechanicPreference"><option value="">自动选择</option>${['鸡笼网','剑山','鲜花泥'].map(x=>`<option ${f.mechanicPreference===x?'selected':''}>${x}</option>`).join('')}</select></label></div></details>
  <div class="form-end creative-form-end"><small>下一步先看构图方向；Recipe / Mechanics / Blueprint 不会消失，只是稍后再进入。</small><button class="primary" id="generate">先看看方向 →</button></div></form></main>`;
}

globalThis.FloraLabCreateView={render};
})();
