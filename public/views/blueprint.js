(function () {
  'use strict';

  // Rendering only. Dependencies are supplied by the app composition root.
  function create({ state: S, esc, colorHex, viewNames: VIEW_NAMES }) {
    function projection(node, view) {
      if (view === 'front') return [node.x, node.z];
      if (view === 'back') return [-node.x, node.z];
      if (view === 'left') return [node.y, node.z];
      if (view === 'right') return [-node.y, node.z];
      return [node.x, -node.y];
    }

    function projectionConfig(plan, view) {
      const bp = plan.blueprint,
        W = 620,
        H = 560,
        pad = 54,
        dims = bp.dimensions,
        maxX =
          view === 'left' || view === 'right' ? dims.depth / 2 : dims.width / 2,
        maxY = view === 'top' ? dims.depth / 2 : dims.height,
        sx = (W - pad * 2) / (maxX * 2 || 1),
        sy = (H - pad * 2) / (view === 'top' ? maxY * 2 || 1 : maxY || 1),
        scale = Math.min(sx, sy),
        cx = W / 2,
        baseY = view === 'top' ? H / 2 : H - pad;
      return { W, H, pad, dims, scale, cx, baseY };
    }

    function renderBlueprint(
      plan,
      view = 'front',
      stageLimit = null,
      interactive = true
    ) {
      const bp = plan.blueprint;
      if (!bp || !bp.nodes?.length)
        return '<div class="empty-state">暂无结构数据</div>';
      const { W, H, pad, scale, cx, baseY } = projectionConfig(plan, view),
        nodes = bp.nodes.filter(
          (n) => stageLimit == null || n.stage <= stageLimit
        ),
        origin = view === 'top' ? [cx, H / 2] : [cx, baseY],
        v = bp.vessel || {},
        vessel =
          view === 'top'
            ? `<ellipse cx="${cx}" cy="${H / 2}" rx="${Math.max(34, ((v.opening_cm || 12) * scale) / 2)}" ry="${Math.max(24, (v.opening_cm || 12) * scale * 0.36)}" fill="none" stroke="#a69e94" stroke-width="1"/>`
            : `<path d="M ${cx - 55} ${baseY} L ${cx - 42} ${baseY - Math.min(105, (v.height_cm || 20) * scale)} Q ${cx} ${baseY - Math.min(120, (v.height_cm || 20) * scale) - 16} ${cx + 42} ${baseY - Math.min(105, (v.height_cm || 20) * scale)} L ${cx + 55} ${baseY}" fill="none" stroke="#a69e94" stroke-width="1"/>`,
        anchors = (bp.mechanics?.anchors || [])
          .map((a) => {
            const pseudo = { x: a.x, y: a.y, z: a.z };
            const [aa, bb] = projection(pseudo, view),
              x = cx + aa * scale,
              y = view === 'top' ? H / 2 + bb * scale : baseY - bb * scale;
            return `<circle cx="${x}" cy="${y}" r="4" fill="#416b38" opacity=".45"><title>${esc(a.type || '固定点')}</title></circle>`;
          })
          .join('');
      const lines = nodes
        .map((n) => {
          const [a, b] = projection(n, view),
            x = cx + a * scale,
            y = view === 'top' ? H / 2 + b * scale : baseY - b * scale,
            selected = n.id === S.selectedNode,
            fill = colorHex(
              (n.color || '').includes('色') ? n.color : `${n.color}色`,
              0
            ),
            r = Math.max(4, Math.min(11, n.head_cm * 0.55)),
            anchor = (bp.mechanics?.anchors || []).find(
              (q) => q.id === n.anchor_id
            ) || { x: 0, y: 0, z: 0 },
            ap = projection(anchor, view),
            ax = cx + ap[0] * scale,
            ay = view === 'top' ? H / 2 + ap[1] * scale : baseY - ap[1] * scale;
          return `<g class="bp-node ${selected ? 'selected' : ''} ${n.locked ? 'locked' : ''}" data-node="${n.id}" tabindex="0"><line x1="${ax}" y1="${ay}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${selected ? '#416b38' : '#9b948b'}" stroke-opacity="${n.kind === 'creative' ? 0.5 : 0.58}" stroke-width="${selected ? 1.8 : 0.8}"/><circle class="bp-hit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${interactive ? Math.max(12, r) : r}" fill="transparent"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${n.kind === 'creative' ? '#eee7df' : fill}" fill-opacity="${selected ? 0.96 : 0.76}" stroke="${selected ? '#416b38' : '#6f6861'}" stroke-width="${selected ? 1.6 : 0.65}"/><text class="bp-label" x="${(x + r + 3).toFixed(1)}" y="${(y + 3).toFixed(1)}" font-size="10.5" fill="${selected ? '#416b38' : '#6f6861'}">${n.id}</text></g>`;
        })
        .join('');
      return `<svg class="blueprint-svg" data-blueprint-view="${view}" data-scale="${scale}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${VIEW_NAMES[view]}施工结构图"><line x1="${pad}" y1="${view === 'top' ? H / 2 : baseY}" x2="${W - pad}" y2="${view === 'top' ? H / 2 : baseY}" stroke="#ddd6cd"/><line x1="${cx}" y1="${pad}" x2="${cx}" y2="${H - pad}" stroke="#e6e0d8"/>${vessel}${anchors}${lines}</svg>`;
    }

    function nodeInfo(n) {
      if (!n) return '<span>点击结构图里的点位查看具体位置。</span>';
      return `<span class="node-id">${n.id}</span><b>${esc(n.name)} · ${esc(n.color || n.role)}</b><dl><dt>长度</dt><dd>约 ${n.length_cm} cm</dd><dt>位置</dt><dd>x ${n.x} / y ${n.y} / z ${n.z}</dd><dt>朝向</dt><dd>水平 ${n.yaw_deg}° / 抬升 ${n.pitch_deg}°</dd><dt>层级</dt><dd>${esc(n.role)} · 第 ${n.stage} 阶段</dd></dl>`;
    }

    function editorControls(n) {
      if (!n) return '';
      return `<div class="editor-controls"><div class="editor-grid"><label>x<input data-node-field="x" type="number" step="1" value="${n.x}"></label><label>y<input data-node-field="y" type="number" step="1" value="${n.y}"></label><label>z<input data-node-field="z" type="number" step="1" value="${n.z}"></label><label>长度<input data-node-field="length_cm" type="number" step="1" value="${n.length_cm}"></label><label>水平角<input data-node-field="yaw_deg" type="number" step="1" value="${n.yaw_deg}"></label><label>抬升角<input data-node-field="pitch_deg" type="number" step="1" value="${n.pitch_deg}"></label></div><div class="node-actions"><button data-node-action="lock">${n.locked ? '解锁' : '锁定'}</button><button data-node-action="mirror">镜像</button><button data-node-action="duplicate">复制</button><button data-node-action="delete" class="danger">删除</button></div></div>`;
    }

    function structureTab(p) {
      const nodes = p.blueprint?.nodes || [];
      const sel = nodes.find((x) => x.id === S.selectedNode) || nodes[0];
      return `<section class="panel structure-layout"><div class="structure-main"><div class="view-switch">${Object.entries(
        VIEW_NAMES
      )
        .map(
          ([k, n]) =>
            `<button class="${S.view === k ? 'active' : ''}" data-view="${k}">${n}</button>`
        )
        .join(
          ''
        )}</div><div class="blueprint-frame editor-frame">${renderBlueprint(p, S.view)}<span class="blueprint-caption">拖动枝条，五个视图同步 · ${p.blueprint?.nodes?.length || 0} 个主体点位</span></div></div><aside class="structure-side"><div class="kicker">Construction</div><h3>每个编号在五个视图里保持不变。</h3><div class="node-info" id="nodeInfo">${nodeInfo(sel)}</div>${editorControls(sel)}<div class="mechanics-note"><b>${esc(p.mechanics.type)}</b><p>${esc(p.mechanics.why || '')} ${esc((p.mechanics.items || []).join('、'))}</p><small>锚点：${esc((p.blueprint?.mechanics?.anchors || []).map((x) => x.type).join('、'))}</small></div></aside></section>`;
    }

    return {
      projection,
      projectionConfig,
      renderBlueprint,
      nodeInfo,
      editorControls,
      structureTab
    };
  }
  globalThis.FloraLabBlueprintViews = { create };
})();
