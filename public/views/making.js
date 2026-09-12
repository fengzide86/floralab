(function () {
  'use strict';

  // Rendering only. Dependencies are supplied by the app composition root.
  function create({ state: S, esc, renderBlueprint, mediaViews }) {
    function stepTitle(i) {
      return (
        [
          '准备花材',
          '建立基础结构',
          '确定轮廓',
          '安排主花',
          '补足层次',
          '检查与收尾'
        ][i] || `制作步骤 ${i + 1}`
      );
    }

    function stepMaterials(p, i) {
      if (i === 0)
        return p.flowers
          .slice(0, 6)
          .map((x) => `${x.name} × ${x.quantity}${x.unit}`);
      if (i === 1) return p.mechanics.items.slice(0, 5);
      if (i === 2)
        return p.flowers
          .filter((x) => ['线条', '叶材'].includes(x.role))
          .slice(0, 5)
          .map((x) => `${x.name} × ${x.quantity}${x.unit}`);
      if (i === 3)
        return p.flowers
          .filter((x) => ['主花', '焦点', '体块'].includes(x.role))
          .slice(0, 6)
          .map((x) => `${x.name} × ${x.quantity}${x.unit}`);
      if (i === 4)
        return [
          ...p.creative.map((x) => `${x.name} × ${x.quantity}${x.unit}`),
          ...p.flowers
            .filter((x) => ['过渡', '填充', '点缀'].includes(x.role))
            .map((x) => `${x.name} × ${x.quantity}${x.unit}`)
        ].slice(0, 7);
      return ['花艺剪', '清水', '从五个方向复查结构'];
    }

    function buildTab(p) {
      const i = Math.min(S.buildStep, (p.steps || []).length - 1),
        stage = Math.min(5, Math.max(2, i + 2)),
        materials = p.build?.materials || [];
      return `<section class="panel build-layout"><aside class="build-nav"><div class="build-count">${String(i + 1).padStart(2, '0')} / ${String(p.steps.length).padStart(2, '0')}</div><div class="build-progress"><i style="width:${((i + 1) / p.steps.length) * 100}%"></i></div>${p.steps.map((_, n) => `<button data-step="${n}" class="${n === i ? 'active' : ''}">${String(n + 1).padStart(2, '0')} · ${stepTitle(n)}</button>`).join('')}</aside><article class="build-step"><div class="step-no">${String(i + 1).padStart(2, '0')}</div><h2>${stepTitle(i)}</h2><div class="step-top-actions"><button class="secondary" data-step-back ${i===0?'disabled':''}>上一步</button><button class="primary" data-step-next>${i===p.steps.length-1?'完成检查，记录成品':'完成本步 →'}</button></div><p>${esc(p.steps[i])}</p><div class="build-preview">${i === 0 ? `<div class="prep-visual prep-checklist"><b>动手前，先确认三件事</b>${[['tools','花器和工具已清洁'],['materials','已核对本次材料与数量'],['water','已按花材需要准备供水，食品与湿区分开']].map(([key,label])=>`<label><input type="checkbox" data-prepared="${key}" ${p.build?.preparation?.[key]?'checked':''}>${label}</label>`).join('')}</div>` : renderBlueprint(p, 'front', stage, false)}</div><div class="needed"><b>本步需要</b><div>${stepMaterials(
        p,
        i
      )
        .map((x) => `<span>${esc(x)}</span>`)
        .join(
          ''
        )}</div></div><div class="inventory-mini"><div class="panel-head"><h3>实际用料</h3><button id="undoBuild" class="secondary" ${p.build?.undo?'':'disabled'}>撤销上次用料记录</button></div>${materials
        .slice(0)
        .map(
          (x) =>
            `<div class="use-row" data-build-key="${esc(x.key)}"><div><b>${esc(x.name)}</b><small>剩余 ${x.remaining}${esc(x.unit)}${x.loss ? ` · 损耗 ${x.loss}` : ''}</small></div><div class="usage-controls"><label>已用<input data-used-input type="number" min="0" value="${x.used}" aria-label="${esc(x.name)}已用数量"></label><button data-use="-1" aria-label="减少${esc(x.name)}用量">−</button><button data-use="1" aria-label="增加${esc(x.name)}用量">＋</button><label>损耗<input data-loss-input type="number" min="0" value="${x.loss}" aria-label="${esc(x.name)}损耗数量"></label><button data-loss="-1" aria-label="减少${esc(x.name)}损耗">−</button><button data-loss="1" aria-label="增加${esc(x.name)}损耗">＋</button></div></div>`
        )
        .join(
          ''
        )}${(p.build?.shortages || []).length ? `<div class="shortage-box"><b>出现缺口</b>${(p.build.substitutionAdvice || []).map((x) => `<p>${esc(x.name)} 缺 ${x.shortage}：${esc(x.detail)}</p>`).join('')}</div>` : ''}</div><div class="step-actions"><button class="secondary" id="prevStep" ${i === 0 ? 'disabled' : ''}>← 上一步</button><button class="primary" id="nextStep">${i === p.steps.length - 1 ? '完成检查，记录成品' : '下一步 →'}</button></div></article></section>`;
    }

    function feedbackTab(p) {
      const f = p.resultFeedback || {};
      return `${mediaViews?.comparison(p)||''}${mediaViews?.gallery(p,'finished')||''}<section class="panel feedback-layout"><div><div class="kicker">Finished Work</div><h2 class="section-title">留下这次作品。</h2><p>先添加照片，难度、耗时和体会都可以稍后补。对照效果图时，关注轮廓、颜色、层次和材料的真实变化。</p></div><form id="feedbackForm" class="feedback-form" onsubmit="return false"><label><span>实际难度</span><select id="actualDifficulty">${['未填写', '简单', '中等', '困难'].map((x) => `<option ${f.actual_difficulty === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label><label><span>制作耗时（分钟）</span><input id="actualMinutes" type="number" min="0" value="${f.minutes || ''}"></label><label class="wide"><span>实际遇到的问题</span><textarea id="actualIssues" placeholder="例如：右侧容易下坠、绣球补水慢">${esc((f.issues || []).join('、'))}</textarea></label><label class="wide"><span>备注</span><textarea id="actualNotes" placeholder="哪些地方好做，哪些地方下次要改">${esc(f.notes || '')}</textarea></label><div class="feedback-actions"><button class="primary" id="saveFeedback">保存成品记录</button><button class="secondary" type="button" data-workflow-stage="finished">标记作品已完成</button></div></form>${f.completed_at ? `<div class="feedback-summary"><b>已记录</b><p>${esc(f.actual_difficulty)} · ${f.minutes || 0} 分钟</p>${(f.issues || []).map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}</section>`;
    }

    function historyTab(p) {
      return `<section class="panel history-panel"><div class="panel-head"><div><div class="kicker">Versions</div><h2 class="section-title">修改记录与恢复快照</h2></div><button class="secondary" id="restoreBackup">查看上一份备份</button></div><section class="snapshots"><h3>可恢复的快照</h3><div id="snapshotList"><p>正在读取本机快照…</p></div></section><details class="history-details"><summary>查看修改记录</summary><div class="history-list">${
        (p.history || [])
          .slice()
          .reverse()
          .map(
            (h, i) =>
              `<article><span>${String((p.history || []).length - i).padStart(2, '0')}</span><div><b>${esc(h.summary || h.type)}</b><small>${new Date(h.at).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</small></div></article>`
          )
          .join('') || '<p>暂无版本记录。</p>'
      }</div></details></section>`;
    }

    return { stepTitle, stepMaterials, buildTab, feedbackTab, historyTab };
  }
  globalThis.FloraLabMakingViews = { create };
})();
