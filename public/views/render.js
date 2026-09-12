(function () {
  'use strict';

  // Rendering only. Dependencies are supplied by the app composition root.
  function create({ esc, colorHex, viewNames: VIEW_NAMES, buildRenderSpec }) {
    function renderSpecFor(p) {
      return buildRenderSpec?.(p) || null;
    }

    function renderRenderView(p, spec) {
      const bp = p.blueprint;
      if (!bp || !bp.nodes?.length || !spec)
        return '<div class="empty-state">暂无可视结构</div>';
      const W = 620,
        H = 520,
        pad = 52,
        d = bp.dimensions || p.dimensions || { width: 60, height: 56 },
        sx = (W - pad * 2) / (Number(d.width || 60) || 1),
        sy = (H - pad * 2) / (Number(d.height || 56) || 1),
        scale = Math.min(sx, sy),
        cx = W / 2,
        base = H - pad;
      const b = spec.structure.silhouette.bounds_cm,
        rx = cx + b.left * scale,
        ry = base - b.top * scale,
        rw = Math.max(24, (b.right - b.left) * scale),
        rh = Math.max(24, (b.top - b.bottom) * scale);
      const focus = new Set(spec.structure.focus_nodes.map((x) => x.id));
      const vessel = bp.vessel || {},
        vesselSvg = `<path d="M ${cx - 50} ${base} L ${cx - 38} ${base - Math.min(95, (vessel.height_cm || 20) * scale)} Q ${cx} ${base - Math.min(108, (vessel.height_cm || 20) * scale) - 14} ${cx + 38} ${base - Math.min(95, (vessel.height_cm || 20) * scale)} L ${cx + 50} ${base}" class="render-vessel"/>`;
      const anchor = (bp.mechanics?.anchors || [])[0] || { x: 0, z: 0 },
        ax = cx + Number(anchor.x || 0) * scale,
        ay = base - Number(anchor.z || 0) * scale;
      const nodes = bp.nodes
        .map((n) => {
          const x = cx + Number(n.x || 0) * scale,
            y = base - Number(n.z || 0) * scale,
            f = focus.has(n.id),
            special = n.kind === 'creative',
            r = special ? 8 : f ? 7 : 4.8,
            fill = special
              ? '#efe3d7'
              : colorHex(
                  (n.color || '').includes('色') ? n.color : `${n.color}色`,
                  0
                );
          return `<g class="render-node ${f ? 'focus' : ''} ${special ? 'special' : ''}"><line x1="${ax}" y1="${ay}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>${f ? `<circle class="render-focus-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r + 7}"/>` : ''}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}"/><title>${esc(n.id)} · ${esc(n.name)} · ${esc(n.role || '')}</title></g>`;
        })
        .join('');
      return `<svg class="render-view-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="效果图结构视图"><text x="${pad}" y="32" class="render-view-label">RENDER VIEW · FRONT</text><rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="36" class="render-silhouette"/><line x1="${pad}" y1="${base}" x2="${W - pad}" y2="${base}" class="render-axis"/><line x1="${cx}" y1="${pad}" x2="${cx}" y2="${base}" class="render-axis"/>${vesselSvg}${nodes}<text x="${pad}" y="${H - 16}" class="render-view-note">${esc(spec.structure.silhouette.label)} · ${esc(spec.structure.visual_mass.horizontal)} · ${esc(spec.structure.visual_mass.vertical)}</text></svg>`;
    }

    function renderHandoffTab(p) {
      const r = renderSpecFor(p);
      if (!r)
        return '<section class="panel"><div class="empty-state">效果图交接暂不可用</div></section>';
      const layers = r.structure.height_layers,
        depth = r.structure.depth_layers;
      return `<section class="panel render-layout"><div class="render-main"><div class="render-toolbar"><div><div class="kicker">Render Handoff</div><h2 class="section-title">把当前作品交给效果图，<br>而不是重新设计。</h2><p>Render View 来自当前 Recipe / Mechanics / Blueprint。它表达视觉关系，不冒充 CAD 或生成图。</p></div><div class="render-actions"><button class="primary" id="copyRenderHandoff">复制效果图交接</button><button class="secondary" id="exportRenderPlan">导出 .floralab</button></div></div><div class="render-frame">${renderRenderView(p, r)}<span class="render-caption">正面视觉关系 · 焦点、高低、左右与轮廓来自 Blueprint</span></div><div class="render-key"><span><i class="focus"></i>焦点 / 主花</span><span><i class="special"></i>特殊物件</span><span><i class="outline"></i>主要轮廓</span></div></div><aside class="render-side"><div class="render-rule hard"><b>硬约束</b><p>材料种类、颜色、Recipe 数量、花器/包装、特殊物件、Mechanics 不得为了画面好看被改掉。</p></div><div class="render-rule structure"><b>结构约束</b><p>${esc(r.structure.silhouette.label)}；${esc(r.structure.visual_mass.horizontal)}；${esc(r.structure.visual_mass.depth)}；${esc(r.structure.visual_mass.vertical)}。</p></div><div class="render-mini-grid"><div><small>焦点</small><b>${r.structure.focus_nodes.length}</b><span>个关键点位</span></div><div><small>主体</small><b>${p.blueprint?.nodes?.length || 0}</b><span>个 Blueprint 点位</span></div><div><small>高层</small><b>${layers.high.length}</b><span>个点位</span></div><div><small>特殊物件</small><b>${r.special_objects.length}</b><span>类</span></div></div><div class="render-layer-note"><b>前 / 中 / 后</b><p>${depth.front.length} / ${depth.middle.length} / ${depth.back.length} 个点位。方向：${esc(r.structure.directional_flow.join('、') || '按 Blueprint 保持')}。</p></div></aside></section><section class="panel render-spec-panel"><div class="panel-head"><div><div class="kicker">Locked Facts</div><h2 class="section-title">效果图必须先认清这些事实。</h2></div><span class="render-source">Recipe → Blueprint → Render Spec</span></div><div class="render-materials">${r.materials.map((m) => `<article data-render-material="${esc(m.key)}"><div><b>${esc(m.name)}</b><span>${esc(m.variant || m.role || '')}</span></div><strong>${m.quantity}${esc(m.unit)}</strong><small>${m.count_confidence === 'medium' ? '分枝 / 多头，数量仍锁定' : '数量应尽量清楚可辨'}</small></article>`).join('')}</div>${r.packaging.length ? `<div class="render-inline"><b>包装</b><p>${r.packaging.map((x) => `${esc(x.name)} × ${x.quantity}${esc(x.unit)}`).join('、')}</p></div>` : ''}${r.special_objects.length ? `<div class="render-inline"><b>特殊物件</b><p>${r.special_objects.map((x) => `${esc(x.name)} × ${x.quantity} · ${esc(x.node_ids.join(' / '))}`).join('；')}</p></div>` : ''}<div class="render-freedom"><div><b>视觉自由区</b><p>${r.visual_freedom.map(esc).join(' · ')}</p></div><div><b>生成后自检</b><p>${r.self_check.map(esc).join(' · ')}</p></div></div><p class="render-note">Recipe 数量锁定。分枝或多头材料在图片里未必逐枝可数，但不能因此改变数量设定；明显换花、换色、跑位或密度异常应重做。</p></section>`;
    }

    return { renderSpecFor, renderRenderView, renderHandoffTab };
  }
  globalThis.FloraLabRenderViews = { create };
})();
