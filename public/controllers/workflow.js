(function () {
  'use strict';
  function create({
    state: S,
    storage,
    records,
    media,
    mediaViews,
    studio,
    esc,
    toast,
    render,
    home
  }) {
    const clone = (value) => JSON.parse(JSON.stringify(value)),
      dialog = globalThis.FloraLabDialog.open;
    const family = (p) => p.exploration?.branch?.family_id || p.id;
    function selected(p = S.plan) {
      return S.selections?.[family(p)] === p.id;
    }
    function refresh() {
      render();
      media.hydrate();
    }
    function addMedia(kind) {
      if ((S.plan.media || []).length >= 16)
        return toast(
          '一件作品最多保存 16 张照片；可以将部分照片移出当前版本。'
        );
      const id = S.plan.id;
      dialog({
        title:
          kind === 'render'
            ? '添加这版作品的效果图'
            : kind === 'finished'
              ? '留下真实成品'
              : '添加灵感参考',
        body: `<label>选择图片<input id="mediaFile" type="file" accept="image/jpeg,image/png,image/webp"></label><label>名称<input id="mediaTitle" maxlength="80" placeholder="例如：正面 · 自然光"></label><label>备注<textarea id="mediaNote" maxlength="500" placeholder="喜欢哪里，或实际制作有什么变化"></textarea></label><p>单张原图最大 20MB，将缩小到最长边 1600px 保存。仅保存在本机；导出时可包含图片。${kind === 'render' ? '请先核对材料、颜色、物件和轮廓。图片会关联当前事实版本，不自动识别或计数。' : ''}</p>`,
        confirm: '保存图片',
        onConfirm: async (d) => {
          const file = d.querySelector('#mediaFile').files[0];
          if (!file) throw new Error('请先选择图片');
          const original = clone(S.plan);
          if (original.id !== id)
            throw new Error('当前作品已经改变，请重新添加');
          const asset = await media.prepareFile(file, {
            projectId: id,
            kind,
            title:
              d.querySelector('#mediaTitle').value.trim() ||
              mediaViews.LABELS[kind],
            note: d.querySelector('#mediaNote').value.trim(),
            sourceSignature: records.signature(original),
            sourceVersion: original.handoff?.version || 1
          });
          if (S.plan.id !== id) throw new Error('当前作品已经改变，请重新添加');
          const plan = clone(S.plan);
          plan.media = [...(plan.media || []), media.metadata(asset)];
          if (!plan.coverId && kind !== 'reference') plan.coverId = asset.id;
          await storage.commitPlan(plan, {
            assets: [asset],
            reason: '添加图片前'
          });
          refresh();
          toast('图片已保存在本机');
        }
      });
    }
    function openMedia(id) {
      const item = (S.plan.media || []).find((x) => x.id === id);
      if (!item) return;
      const d = dialog({
        title: item.title || '作品图片',
        body: `<figure class="dialog-photo">${mediaViews.image(item)}<figcaption>${esc(item.note || '')}</figcaption></figure>${media.isStale(S.plan, item) ? '<p>这张效果图对应较早的材料或结构，请重新核对。</p>' : ''}`,
        confirm: '关闭',
        onConfirm: async () => {}
      });
      media.hydrate(d);
    }
    function setStage(stage = 'preparing') {
      const p = S.plan;
      dialog({
        title:
          stage === 'exploring'
            ? '继续探索这件作品'
            : stage === 'finished'
              ? '保存这次作品为已完成'
              : '选为制作方案',
        body: `<p><strong>${esc(p.title)}</strong> · ${esc(p.exploration?.branch?.label || '主线')}</p><p>${stage === 'exploring' ? '阶段将改为探索中，已有材料和图片会保留。' : '当前方向将成为这组作品的制作方案。材料、颜色、数量、花器、包装、特殊物件、固定与主结构会锁定；其他方向仍可查看。'}</p><p>${p.recipe
          .filter((r) => r.quantity > 0)
          .map((r) => `${esc(r.name)} ${r.quantity}${esc(r.unit)}`)
          .join(' · ')}</p>`,
        confirm: stage === 'finished' ? '标记完成' : '确认阶段',
        onConfirm: async () => {
          const plan = studio.updateRecord(p, { stage });
          await storage.commitPlan(plan, {
            selection: {
              family: family(p),
              id:
                stage === 'exploring'
                  ? S.selections?.[family(p)] === p.id
                    ? null
                    : S.selections?.[family(p)]
                  : p.id
            },
            reason: '切换制作阶段前'
          });
          if (stage === 'preparing') S.tab = 'recipe';
          if (stage === 'making') S.tab = 'build';
          if (stage === 'finished') S.tab = 'feedback';
          refresh();
          window.scrollTo(0, 0);
        }
      });
    }
    function rename() {
      dialog({
        title: '作品名称',
        body: `<label>给作品起个名字<input id="renameTitle" maxlength="100" value="${esc(S.plan.title)}"></label>`,
        confirm: '保存名称',
        onConfirm: async (d) => {
          await storage.commitPlan(
            studio.updateRecord(S.plan, {
              title: d.querySelector('#renameTitle').value
            })
          );
          refresh();
        }
      });
    }
    async function exportPlan(includeMedia = true) {
      try {
        let handoff = studio.handoffObject(S.plan);
        handoff.plan.workflow = {
          ...handoff.plan.workflow,
          selectedForMaking: selected()
        };
        if (includeMedia) handoff = await media.attachExport(handoff);
        else {
          delete handoff.plan.media;
          delete handoff.plan.coverId;
        }
        const blob = new Blob([JSON.stringify(handoff, null, 2)], {
            type: 'application/json'
          }),
          url = URL.createObjectURL(blob),
          a = document.createElement('a');
        a.href = url;
        a.download =
          (S.plan.title || 'FloraLab').replace(/[\\/:*?"<>|\s]+/g, '-') +
          '.floralab';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast(
          includeMedia ? '已导出设计与可用图片' : '已导出材料与结构，不含图片'
        );
      } catch (error) {
        toast(error.message);
      }
    }
    async function importPlan(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        if (file.size > 50 * 1024 * 1024)
          throw new Error('设计文件超过 50MB，请减少图片后再导入');
        const raw = JSON.parse(await file.text()),
          validation = studio.validateImportObject(raw, S.designCatalog);
        if (!validation.ok) throw new Error(validation.errors.join('；'));
        const plan = studio.migratePlan(S.designCatalog, raw),
          oldId = plan.id;
        plan.id = crypto.randomUUID();
        plan.exploration.branch = {
          ...plan.exploration.branch,
          id: crypto.randomUUID(),
          family_id: plan.id,
          source_project_id: oldId,
          parent_id: null
        };
        plan.handoff = { ...plan.handoff, project_id: plan.id };
        plan.exploration.locks = Object.fromEntries(
          Object.keys(plan.exploration.locks).map((k) => [k, true])
        );
        const assets = await media.prepareImport(raw, plan);
        dialog({
          title: '导入为一件独立作品',
          body: `<p><strong>${esc(plan.title)}</strong></p><p>${esc(plan.type)} · ${plan.recipe.length} 行材料 · ${plan.blueprint.nodes.length} 个点位 · ${assets.length} 张图片</p><p>现有作品会保留。导入后材料、数量与结构默认锁定。</p>${(plan.media || []).some((x) => x.missing) ? '<p class="dialog-error">文件没有包含全部图片附件，缺失图片会显示提示。</p>' : ''}${validation.warnings.map((w) => `<p>${esc(w)}</p>`).join('')}`,
          confirm: '导入作品',
          onConfirm: async () => {
            await storage.commitPlan(plan, {
              assets,
              form: plan.request || S.form,
              mode: plan.mode,
              reason: '导入前',
              ...(plan.workflow?.selectedForMaking
                ? { selection: { family: plan.id, id: plan.id } }
                : {})
            });
            S.tab = 'work';
            S.buildStep = plan.build.currentStep || 0;
            S.compareBranchId = null;
            refresh();
            toast('已导入，原有作品仍保留');
          }
        });
      } catch (error) {
        toast('导入失败：' + error.message);
      } finally {
        event.target.value = '';
      }
    }
    async function restore(entry) {
      const target = entry || (await storage.backupInfo());
      if (!target) return toast('还没有可恢复的快照');
      const plan = target.state.plan;
      dialog({
        title: '确认恢复目标',
        body: `<dl class="restore-summary"><dt>作品</dt><dd>${esc(target.title)}</dd><dt>保存时间</dt><dd>${target.at ? esc(new Date(target.at).toLocaleString()) : '旧备份未记录时间'}</dd><dt>材料</dt><dd>${plan.recipe?.length || 0} 行</dd><dt>图片</dt><dd>${plan.media?.length || 0} 张</dd></dl><p>将打开并恢复上述状态。该作品恢复前的状态会另外保存为快照，可以再次找回。</p>`,
        confirm: '恢复这个快照',
        onConfirm: async () => {
          const valid = studio.validateImportObject(plan, S.designCatalog);
          if (!valid.ok) throw new Error(valid.errors.join('；'));
          const result = await storage.restoreBackup(target);
          S.tab = 'work';
          S.buildStep = S.plan.build?.currentStep || 0;
          refresh();
          toast(result.message);
        }
      });
    }
    async function loadRevisions() {
      const host = document.querySelector('#snapshotList');
      if (!host) return;
      const id = S.plan.id,
        items = await storage.revisions(id);
      if (!host.isConnected || S.plan.id !== id) return;
      host.innerHTML = items.length
        ? items
            .map(
              (x, i) =>
                `<article class="snapshot-row"><div><b>${esc(x.title)}</b><small>${esc(new Date(x.at).toLocaleString())} · ${esc(x.reason)}</small></div><button data-snapshot-index="${i}">查看并恢复</button></article>`
            )
            .join('')
        : '<p>修改后会保留修改前的快照；恢复之前可先查看目标。</p>';
      host
        .querySelectorAll('[data-snapshot-index]')
        .forEach(
          (b) =>
            (b.onclick = () => restore(items[Number(b.dataset.snapshotIndex)]))
        );
    }
    function replaceMaterial(key) {
      const current = S.plan.recipe.find((r) => r.key === key);
      if (!current) return;
      const options = (
        current.kind === 'flower'
          ? S.designCatalog.flowers
          : S.designCatalog.creative
      ).filter(
        (r) =>
          !S.plan.recipe.some(
            (x) => x.kind === current.kind && x.id === r.id && x.key !== key
          )
      );
      const d = dialog({
        title: '替换材料，先核对变化',
        body: `<p>原材料：${esc(current.variant)}${esc(current.name)} × ${current.quantity}${esc(current.unit)}</p><label>新材料<select id="replacement">${options.map((r) => `<option value="${esc(r.id)}" ${r.id === current.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></label><label id="replacementColorLabel">颜色<select id="replacementColor"></select></label><p>数量保持 ${current.quantity}${esc(current.unit)}；已有数量清零待核对，单价改用参考价，点位保留并重新检查供水与结构。原效果图会保留并标记为旧版。</p>`,
        confirm: '应用这次替换',
        onConfirm: async (dialog) => {
          const plan = studio.replaceMaterial(S.designCatalog, S.plan, {
            key,
            id: dialog.querySelector('#replacement').value,
            color: dialog.querySelector('#replacementColor').value
          });
          await storage.commitPlan(plan, { reason: '替换材料前' });
          refresh();
        }
      });
      const select = d.querySelector('#replacement'),
        colors = d.querySelector('#replacementColor');
      const fill = () => {
        const ref = options.find((x) => x.id === select.value);
        colors.innerHTML = (ref?.colors || [ref?.category || ''])
          .map((c) => `<option>${esc(c)}</option>`)
          .join('');
        if (select.value === current.id) colors.value = current.variant;
      };
      select.onchange = fill;
      fill();
    }
    function bind() {
      document
        .querySelectorAll('[data-add-media]')
        .forEach((b) => (b.onclick = () => addMedia(b.dataset.addMedia)));
      document
        .querySelectorAll('[data-open-media]')
        .forEach((b) => (b.onclick = () => openMedia(b.dataset.openMedia)));
      document.querySelectorAll('[data-cover-media]').forEach(
        (b) =>
          (b.onclick = async () => {
            try {
              await storage.commitPlan({
                ...S.plan,
                coverId: b.dataset.coverMedia
              });
              refresh();
            } catch (e) {
              toast(e.message);
            }
          })
      );
      document.querySelectorAll('[data-remove-media]').forEach(
        (b) =>
          (b.onclick = () =>
            dialog({
              title: '从当前版本移出这张照片？',
              body: '<p>历史快照中的照片仍会保留，可以通过快照恢复。</p>',
              confirm: '移出当前版本',
              onConfirm: async () => {
                const id = b.dataset.removeMedia,
                  plan = clone(S.plan);
                plan.media = plan.media.filter((m) => m.id !== id);
                if (plan.coverId === id) plan.coverId = null;
                await storage.commitPlan(plan);
                refresh();
              }
            }))
      );
      document
        .querySelectorAll('[data-select-making]')
        .forEach((b) => (b.onclick = () => setStage('preparing')));
      document
        .querySelectorAll('[data-workflow-stage]')
        .forEach((b) => (b.onclick = () => setStage(b.dataset.workflowStage)));
      document
        .querySelectorAll('[data-replace-material]')
        .forEach(
          (b) => (b.onclick = () => replaceMaterial(b.dataset.replaceMaterial))
        );
      const renameButton = document.querySelector('#renameProject');
      if (renameButton) renameButton.onclick = rename;
      const textExport = document.querySelector('#exportTextOnly');
      if (textExport) textExport.onclick = () => exportPlan(false);
      loadRevisions();
      media.hydrate();
    }
    return {
      bind,
      selected,
      setStage,
      rename,
      addMedia,
      exportPlan,
      importPlan,
      restore,
      replaceMaterial
    };
  }
  globalThis.FloraLabWorkflow = { create };
})();
