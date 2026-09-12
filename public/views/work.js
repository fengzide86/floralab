(function () {
  'use strict';

  // Rendering only. Dependencies are supplied by the app composition root.
  function create({
    state: S,
    esc,
    money,
    cleanTitle,
    colorHex,
    renderBlueprint,
    mediaViews
  }) {
    function workTab(p) {
      const blocks = (p.checks || []).filter((x) => x.status === 'block'),
        warns = (p.checks || []).filter((x) => x.status === 'warn'),
        study = renderBlueprint(p, 'front', null, false).replace(
          'class="blueprint-svg"',
          'class="blueprint-svg visual-study-svg"'
        );
      const intent=p.request?._intent;
      const preview=globalThis.FloraLabDirectionPreview?.render(p,{view:'front',label:'当前摆放示意',esc})||study;
      return `<section class="panel editorial-grid"><div>${mediaViews?.cover(p)||`<div class="work-composition">${preview}<p>当前摆放示意 · 可以在效果图页添加生成图片</p></div>`}<div class="palette-line">${(p.palette||[]).map((x,i)=>`<i style="--c:${colorHex(x,i)}"></i>`).join('')}</div><button class="secondary" data-tabjump="render">查看或添加效果图</button></div><article class="story"><div class="kicker">This piece</div><h2>${esc(p.exploration?.branch?.label||'当前方案')}</h2>${p.creativeBrief?.idea?`<blockquote class="original-idea">${esc(p.creativeBrief.idea)}</blockquote>`:''}${intent?`<div class="intent-summary"><b>从描述中识别到</b><p>${intent.colors.length?'配色：'+esc(intent.colors.join(' / ')):'颜色：自动建议'}${intent.excludes.length?' · 不使用：'+esc(intent.excludes.join('、')):''}</p>${intent.required.length?`<p>${intent.required.map(r=>esc(r.color+r.name)+(r.quantity!==null?' × '+r.quantity:'')).join(' · ')}</p>`:''}<small>这是规则生成的起点，请核对未识别的气质与构图要求。</small></div>`:''}<div class="stats-line"><div><b>${p.dimensions.height} × ${p.dimensions.width}</b><span>cm · 高 × 宽</span></div><div><b>${p.recipe.filter(r=>r.kind==='flower').reduce((n,r)=>n+r.quantity,0)} 枝</b><span>鲜花总量</span></div></div><div class="work-next"><button class="primary" data-select-making>选为制作方案</button><button class="secondary" data-tabjump="explore">继续比较方向</button></div><details class="reality-details"><summary>${blocks.length?blocks.length+' 项需要调整':warns.length?warns.length+' 项制作前需核对':'查看材料与结构检查'}</summary><div class="checks">${(p.checks||[]).map(c=>`<div class="check-row ${c.status}"><i></i><b>${esc(c.label)}</b><p>${esc(c.detail)}</p></div>`).join('')}</div></details></article></section>`;
    }

    function recipeTab(p) {
      return `<section class="panel"><div class="panel-head"><div><div class="kicker">Material Recipe</div><h2 class="section-title">把每一种材料落实下来。</h2><p>需要 − 已有 = 还需购买。留空价格表示待询价，不会按零元假装算齐。修改数量或替换材料会更新当前设计。</p></div><div class="total-box"><strong>${money(p.cost.total)}</strong><span>${p.cost.unknown_prices?`已知部分 · ${p.cost.unknown_prices} 项待询价`:'预计需购'}</span></div></div><div class="purchase-actions"><button id="copyPurchase" class="secondary">复制采购清单</button><button id="printPurchase" class="secondary">打印采购清单</button></div><div class="recipe"><div class="recipe-head"><span>材料</span><span>需要</span><span>已有</span><span>单价 / 来源</span><span>还需买</span><span>小计</span></div>${p.recipe.map((r) => `<div class="recipe-row" data-key="${esc(r.key)}"><div class="recipe-name">${['flower', 'creative'].includes(r.kind) ? `<button class="recipe-material-link" data-material-detail="${esc(r.kind)}:${esc(r.id)}">${esc(r.name)}</button>` : `<b>${esc(r.name)}</b>`}<span>${esc(r.variant || r.role || '')}</span>${['flower','creative'].includes(r.kind)?`<button class="replace-link" data-replace-material="${esc(r.key)}">替换 / 改颜色</button>`:''}</div><div class="qty-control rcell" data-label="需要"><button data-minus>−</button><input data-qty type="number" min="0" value="${r.quantity}"><button data-plus>＋</button><em>${esc(r.unit)}</em></div><div class="rcell" data-label="已有"><input class="mini" data-owned type="number" min="0" max="${r.quantity}" value="${r.owned}"></div><div class="price-control rcell" data-label="单价 / 来源"><span>¥</span><input class="mini" data-price type="number" min="0" step="0.5" value="${r.unit_price??''}" placeholder="待询价"><small>${r.unit_price===null?'待询价':r.price_source==='actual'?'我的单价':'参考估价'}</small></div><div class="buy rcell" data-label="还需买"><strong>${r.to_buy}${esc(r.unit)}</strong></div><div class="subtotal rcell" data-label="小计"><strong>${r.unit_price===null&&r.to_buy>0?'待询价':money(r.subtotal)}</strong></div></div>`).join('')}</div><div class="recipe-foot"><p>${esc(p.cost.note || '价格为参考估算，可替换为自己的采购单价。')}</p><button class="text-action" data-tabjump="structure">看施工结构 →</button></div></section>`;
    }

    function printSheet(p) {
      return `<header><h1>${esc(cleanTitle(p.title))}</h1><p>${esc(p.type)} · ${esc((p.palette || []).join(' / '))} · ${money(p.cost.total)}</p></header><section><h2>材料</h2>${p.recipe
        .filter((r) => r.quantity > 0)
        .map(
          (r) =>
            `<p>${esc(r.name)} — ${r.quantity}${esc(r.unit)} · 已有 ${r.owned} · 还需购买 ${r.to_buy}${esc(r.unit)}</p>`
        )
        .join(
          ''
        )}</section><section><h2>正面结构</h2>${renderBlueprint(p, 'front', null, false)}</section><section><h2>制作步骤</h2><ol>${(p.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section><footer>${esc(p.mechanics.type)} · FloraLab Studio ${esc(S.status?.version || 'dev')}</footer>`;
    }

    return { workTab, recipeTab, printSheet };
  }
  globalThis.FloraLabWorkViews = { create };
})();
