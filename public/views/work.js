(function () {
  'use strict';

  // Rendering only. Dependencies are supplied by the app composition root.
  function create({
    state: S,
    esc,
    money,
    cleanTitle,
    colorHex,
    renderBlueprint
  }) {
    function workTab(p) {
      const blocks = (p.checks || []).filter((x) => x.status === 'block'),
        warns = (p.checks || []).filter((x) => x.status === 'warn'),
        study = renderBlueprint(p, 'front', null, false).replace(
          'class="blueprint-svg"',
          'class="blueprint-svg visual-study-svg"'
        );
      return `<section class="panel editorial-grid"><div><div class="visual-slot visual-study">${study}<div class="visual-inner"><small>Composition Study</small><b>${esc(cleanTitle(p.title))}</b><p>来自当前 Blueprint 的构图预览。效果图交接可在 Studio 的「效果图」工作区查看，再带到创作空间生成成品视觉。</p></div></div><div class="palette-line">${(p.palette || []).map((x, i) => `<i style="--c:${colorHex(x, i)}"></i>`).join('')}</div></div><article class="story"><h2>${blocks.length ? '先解决这些问题，再进入制作。' : warns.length ? '可以制作，先留意几个细节。' : '材料与结构已经可以进入制作。'}</h2><p>${esc(p.subtitle || '')}</p><div class="stats-line"><div><b>${p.dimensions.height} × ${p.dimensions.width}</b><span>cm · 高 × 宽</span></div><div><b>${p.metrics?.estimated_weight_kg || '—'} kg</b><span>估算重量</span></div><div><b>${p.recipe.filter((x) => x.kind === 'flower').reduce((n, x) => n + x.quantity, 0)} 枝</b><span>鲜花总量</span></div></div><div class="checks">${(p.checks || []).map((c) => `<div class="check-row ${c.status}"><i></i><b>${esc(c.label)}</b><p>${esc(c.detail)}</p></div>`).join('')}</div>${p.composition?.advice?.length ? `<div class="composition-notes"><div class="kicker">Composition</div>${p.composition.advice.map((a) => `<div class="comp-row"><b>${esc(a.title)}</b><p>${esc(a.detail)}</p></div>`).join('')}</div>` : ''}<button class="next-link" data-tabjump="recipe">确认材料 →</button></article></section>`;
    }

    function recipeTab(p) {
      return `<section class="panel"><div class="panel-head"><div><div class="kicker">Material Recipe</div><h2 class="section-title">把每一种材料落实下来。</h2><p>需要 − 已有 = 还需购买。自己的单价会覆盖参考单价。</p></div><div class="total-box"><strong>${money(p.cost.total)}</strong><span>当前需购</span></div></div><div class="recipe"><div class="recipe-head"><span>材料</span><span>需要</span><span>已有</span><span>我的单价</span><span>还需买</span><span>小计</span></div>${p.recipe.map((r) => `<div class="recipe-row" data-key="${esc(r.key)}"><div class="recipe-name">${['flower', 'creative'].includes(r.kind) ? `<button class="recipe-material-link" data-material-detail="${esc(r.kind)}:${esc(r.id)}">${esc(r.name)}</button>` : `<b>${esc(r.name)}</b>`}<span>${esc(r.variant || r.role || '')}</span></div><div class="qty-control rcell" data-label="需要"><button data-minus>−</button><input data-qty type="number" min="0" value="${r.quantity}"><button data-plus>＋</button><em>${esc(r.unit)}</em></div><div class="rcell" data-label="已有"><input class="mini" data-owned type="number" min="0" max="${r.quantity}" value="${r.owned}"></div><div class="price-control rcell" data-label="我的单价"><span>¥</span><input class="mini" data-price type="number" min="0" step="0.5" value="${r.unit_price}"></div><div class="buy rcell" data-label="还需买"><strong>${r.to_buy}${esc(r.unit)}</strong></div><div class="subtotal rcell" data-label="小计"><strong>${money(r.subtotal)}</strong></div></div>`).join('')}</div><div class="recipe-foot"><p>${esc(p.cost.note || '价格为参考估算，可替换为自己的采购单价。')}</p><button class="text-action" data-tabjump="structure">看施工结构 →</button></div></section>`;
    }

    function printSheet(p) {
      return `<header><h1>${esc(cleanTitle(p.title))}</h1><p>${esc(p.type)} · ${esc((p.palette || []).join(' / '))} · ${money(p.cost.total)}</p></header><section><h2>材料</h2>${p.recipe
        .filter((r) => r.quantity > 0)
        .map(
          (r) =>
            `<p>${esc(r.name)} — ${r.quantity}${esc(r.unit)}${r.owned ? `（已有 ${r.owned}）` : ''}</p>`
        )
        .join(
          ''
        )}</section><section><h2>正面结构</h2>${renderBlueprint(p, 'front', null, false)}</section><section><h2>制作步骤</h2><ol>${(p.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></section><footer>${esc(p.mechanics.type)} · FloraLab Studio ${esc(S.status?.version || 'dev')}</footer>`;
    }

    return { workTab, recipeTab, printSheet };
  }
  globalThis.FloraLabWorkViews = { create };
})();
