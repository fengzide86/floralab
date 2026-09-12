(function () {
  'use strict';
  const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  function create({ storage, records }) {
    const urls = new Map();
    async function prepareFile(file, meta) {
      if (!TYPES.includes(file.type))
        throw new Error('请选择 JPG、PNG 或 WebP 图片');
      if (file.size > 20 * 1024 * 1024)
        throw new Error('单张原图不能超过 20MB');
      const image = await createImageBitmap(file);
      try {
        if (image.width * image.height > 40000000)
          throw new Error('图片超过 4000 万像素，请先缩小');
        const ratio = Math.min(1, 1600 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * ratio);
        canvas.height = Math.round(image.height * ratio);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.87)
        );
        if (!blob || blob.size > 3 * 1024 * 1024)
          throw new Error('处理后的图片过大，请换一张尺寸较小的图片');
        return {
          id: crypto.randomUUID(),
          ...meta,
          blob,
          mime: blob.type,
          width: canvas.width,
          height: canvas.height,
          createdAt: new Date().toISOString()
        };
      } finally {
        image.close();
      }
    }
    function metadata(asset) {
      const { blob, ...meta } = asset;
      return meta;
    }
    function cover(plan, kind) {
      const items = (plan.media || []).filter((m) => !kind || m.kind === kind);
      return (
        items.find((m) => m.id === plan.coverId) ||
        items
          .slice()
          .reverse()
          .find((m) => m.kind === 'finished') ||
        items
          .slice()
          .reverse()
          .find((m) => m.kind === 'render') ||
        items[0]
      );
    }
    function isStale(plan, item) {
      return (
        item.kind === 'render' &&
        item.sourceSignature !== records.signature(plan)
      );
    }
    async function hydrate(root = document) {
      const elements = [...root.querySelectorAll('img[data-asset]')],
        wanted = new Set(
          [...document.querySelectorAll('img[data-asset]')].map(
            (e) => e.dataset.asset
          )
        );
      for (const [id, url] of urls)
        if (!wanted.has(id)) {
          URL.revokeObjectURL(url);
          urls.delete(id);
        }
      await Promise.all(
        elements.map(async (img) => {
          const id = img.dataset.asset;
          if (!urls.has(id)) {
            const asset = await storage.idbGet('media', id);
            if (asset?.blob) urls.set(id, URL.createObjectURL(asset.blob));
          }
          if (!img.isConnected) return;
          if (urls.has(id)) {
            img.src = urls.get(id);
            img.classList.remove('asset-pending');
          } else {
            img.alt = '图片附件不在本机，请重新导入含图片的文件';
            img.classList.add('asset-missing');
          }
        })
      );
    }
    async function dataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    }
    async function attachExport(handoff) {
      const assets = [],
        missing = [];
      for (const item of handoff.plan.media || []) {
        const record = await storage.idbGet('media', item.id);
        if (!record?.blob) {
          missing.push(item.title || item.kind);
          continue;
        }
        assets.push({ ...metadata(record), data: await dataUrl(record.blob) });
      }
      if (assets.length) handoff.media = { version: 1, assets };
      if (missing.length)
        throw new Error(
          `缺少 ${missing.length} 张图片附件。请重新添加，或选择仅导出材料与结构。`
        );
      return handoff;
    }
    async function prepareImport(raw, plan) {
      const incoming = raw.media?.assets || [];
      if (!Array.isArray(incoming) || incoming.length > 16)
        throw new Error('图片附件格式不正确，最多支持 16 张');
      const assets = [],
        mapping = new Map();
      let total = 0;
      for (const item of incoming) {
        if (
          !item ||
          typeof item.data !== 'string' ||
          !item.id ||
          mapping.has(item.id)
        )
          throw new Error('图片附件 ID 缺失或重复');
        const match = item.data.match(
          /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/
        );
        if (!match || item.data.length > 4500000)
          throw new Error('图片附件类型或大小不正确');
        const binary = atob(match[2]);
        total += binary.length;
        if (total > 32 * 1024 * 1024) throw new Error('图片附件总量超过 32MB');
        const blob = new Blob(
          [Uint8Array.from(binary, (c) => c.charCodeAt(0))],
          { type: match[1] }
        );
        const decoded = await createImageBitmap(blob);
        try {
          if (decoded.width * decoded.height > 40000000)
            throw new Error('图片附件像素过大');
        } finally {
          decoded.close();
        }
        const id = crypto.randomUUID();
        mapping.set(item.id, id);
        const ref = (plan.media || []).find((m) => m.id === item.id);
        if (!ref) throw new Error('图片附件没有对应的作品记录');
        assets.push({ ...ref, id, projectId: plan.id, blob, mime: match[1] });
      }
      plan.media = (plan.media || []).map((m) => ({
        ...m,
        id: mapping.get(m.id) || crypto.randomUUID(),
        projectId: plan.id,
        missing: !mapping.has(m.id)
      }));
      if (plan.coverId) plan.coverId = mapping.get(plan.coverId) || null;
      return assets;
    }
    return {
      prepareFile,
      metadata,
      cover,
      isStale,
      hydrate,
      attachExport,
      prepareImport
    };
  }
  globalThis.FloraLabMedia = { create };
})();
