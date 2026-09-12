(function () {
  'use strict';
  const LABELS = {
    reference: '灵感参考',
    render: '生成效果图',
    finished: '真实成品'
  };
  function create({ esc, media }) {
    function image(item, extra = '') {
      return `<img class="asset-pending ${extra}" data-asset="${esc(item.id)}" alt="${esc(item.title || LABELS[item.kind] || '作品图片')}">`;
    }
    function gallery(plan, kind) {
      const items = (plan.media || []).filter((m) => m.kind === kind);
      return `<section class="media-section"><div class="panel-head"><div><h3>${LABELS[kind]}</h3><p>${kind === 'render' ? '把创作空间生成的图片放回这件作品；材料或摆放变化后，会提示旧图。' : kind === 'finished' ? '留下正面、侧面或细节照片，也可以补充一句制作体会。' : '收集喜欢的颜色、形态和材料。参考图不代表当前作品已经采用这些材料。'}</p></div><button class="secondary" data-add-media="${kind}">添加${kind === 'render' ? '效果图' : '照片'}</button></div>${items.length ? `<div class="media-grid">${items.map((item) => `<article class="media-card"><button class="media-open" data-open-media="${esc(item.id)}">${image(item)}</button><div class="media-caption"><span class="media-kind ${media.isStale(plan, item) ? 'stale' : ''}">${item.missing ? '附件缺失' : media.isStale(plan, item) ? '基于较早版本' : LABELS[kind]}</span><b>${esc(item.title || LABELS[kind])}</b><p>${esc(item.note || '')}</p><div class="media-actions"><button data-cover-media="${esc(item.id)}">${plan.coverId === item.id ? '当前封面' : '设为封面'}</button><button data-remove-media="${esc(item.id)}">移出本版</button></div></div></article>`).join('')}</div>` : `<div class="media-empty"><b>${kind === 'render' ? '还没有这版作品的效果图' : '还没有照片'}</b><span>${kind === 'render' ? '先复制下面的交接内容生成图片，再点击“添加效果图”。' : '支持 JPG、PNG、WebP；仅保存在本机，可随设计文件导出。'}</span></div>`}</section>`;
    }
    function cover(plan) {
      const item = media.cover(plan);
      return item
        ? `<figure class="work-photo">${image(item)}<figcaption>${media.isStale(plan, item) ? '基于较早版本 · ' : ''}${LABELS[item.kind] || '作品图片'} · ${esc(item.title || '')}</figcaption></figure>`
        : '';
    }
    function comparison(plan) {
      const render = (plan.media || [])
          .filter((m) => m.kind === 'render')
          .at(-1),
        finished = (plan.media || [])
          .filter((m) => m.kind === 'finished')
          .at(-1);
      if (!render || !finished) return '';
      return `<section class="photo-comparison"><h3>最近效果图与成品</h3><p>比较轮廓、颜色、层次与材料；两张图保持完整比例。${media.isStale(plan, render) ? '这张效果图来自较早的材料或结构版本。' : ''}</p><div class="photo-pair">${[
        [render, '效果图'],
        [finished, '真实成品']
      ]
        .map(
          ([item, label]) =>
            `<figure><button class="media-open" data-open-media="${esc(item.id)}">${image(item)}</button><figcaption>${label} · ${esc(item.title || '')}<small>${esc(item.note || '')}</small></figcaption></figure>`
        )
        .join('')}</div></section>`;
    }
    return { image, gallery, cover, comparison, LABELS };
  }
  globalThis.FloraLabMediaViews = { create };
})();
