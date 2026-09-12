(function () {
  'use strict';
  // Pointer lifecycle and editing controls belong here, separate from SVG rendering.
  function bind({ root, state, select, render, update, worldPoint, toWorld, config, project, toast }) {
    const $ = s => root.querySelector(s);
    const all = s => [...root.querySelectorAll(s)];
    $('#nodePicker').onchange = e => select(e.target.value);
    all('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; render(); });
    all('[data-node]').forEach(g => g.onkeydown = e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(g.dataset.node); }
    });
    all('[data-node-field]').forEach(input => input.onchange = () => {
      if (!input.validity.valid || input.value.trim() === '') { render(); return; }
      update({type: 'set', id: state.selectedNode, [input.dataset.nodeField]: Number(input.value)});
    });
    all('[data-node-action]').forEach(b => b.onclick = () => update({type: b.dataset.nodeAction, id: state.selectedNode}));
    all('[data-nudge]').forEach(b => b.onclick = () => {
      const n = state.plan.blueprint.nodes.find(x => x.id === state.selectedNode);
      const [axis, sign] = b.dataset.nudge.split(':');
      update({type: 'move', id: n.id, [axis]: n[axis] + Number(sign) * Number($('#moveStep').value)});
    });
    const svg = $('.editor-frame svg');
    if (!svg) return;
    const nodes = state.plan.blueprint.nodes;
    const cfg = config(state.plan, state.view);
    const point = n => {
      const [a, b] = project(n, state.view);
      return {x: cfg.cx + a * cfg.scale, y: state.view === 'top' ? cfg.H / 2 + b * cfg.scale : cfg.baseY - b * cfg.scale};
    };
    // Nearest visible flower head wins; invisible hit circles must not select a later sibling.
    function nearest(e) {
      const m = svg.getScreenCTM();
      if (!m) return null;
      return nodes.map(n => {
        const p = svg.createSVGPoint(), xy = point(n); p.x = xy.x; p.y = xy.y;
        const screen = p.matrixTransform(m);
        return {n, distance: Math.hypot(screen.x - e.clientX, screen.y - e.clientY)};
      }).sort((a,b) => a.distance-b.distance || Number(b.n.id===state.selectedNode)-Number(a.n.id===state.selectedNode))
        .find(x => x.distance <= 24)?.n;
    }
    let drag = null;
    function paint(n, value) {
      const g = all('.editor-frame [data-node]').find(g => g.dataset.node === n.id), xy = point(value);
      for (const circle of g.querySelectorAll('circle')) { circle.setAttribute('cx', xy.x); circle.setAttribute('cy', xy.y); }
      const line = g.querySelector('line'), label = g.querySelector('text');
      line.setAttribute('x2', xy.x); line.setAttribute('y2', xy.y);
      label.setAttribute('x', xy.x + 12); label.setAttribute('y', xy.y + 3);
    }
    function finish() {
      const old = drag; drag = null; svg.classList.remove('is-dragging');
      if (old && svg.hasPointerCapture(old.pointerId)) svg.releasePointerCapture(old.pointerId);
      return old;
    }
    svg.onpointerdown = e => {
      if (e.isPrimary === false || e.button !== 0 || drag || state.mutating) return;
      const node = nearest(e); if (!node) return;
      e.preventDefault();
      state.selectedNode = node.id;
      if (node.locked) { select(node.id); toast('这个点位已锁定，点“解锁点位”后再移动。'); return; }
      drag = {node, pointerId:e.pointerId, start:worldPoint(svg,e), client:{x:e.clientX,y:e.clientY}, moved:false};
      all('.editor-frame [data-node]').forEach(g => g.classList.toggle('selected', g.dataset.node === node.id));
      svg.setPointerCapture(e.pointerId); svg.classList.add('is-dragging');
    };
    function destination(e, d) {
      const current = worldPoint(svg,e), origin = point(d.node);
      return toWorld(state.plan, state.view, {x:origin.x+current.x-d.start.x,y:origin.y+current.y-d.start.y},d.node);
    }
    svg.onpointermove = e => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      if (Math.hypot(e.clientX-drag.client.x,e.clientY-drag.client.y)>=5) drag.moved=true;
      if (drag.moved) paint(drag.node,{...drag.node,...destination(e,drag)});
    };
    svg.onpointerup = e => {
      if (!drag || e.pointerId !== drag.pointerId) return;
      const d = finish();
      if (d.moved) update({type:'move',id:d.node.id,...destination(e,d)});
      else select(d.node.id);
    };
    // Interrupted gestures never leave a preview that looks saved.
    const cancel = () => { if (drag) { finish(); render(); } };
    svg.onpointercancel = cancel; svg.onlostpointercapture = cancel;
  }
  globalThis.FloraLabStructure = {bind};
})();
