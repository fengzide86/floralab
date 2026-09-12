'use strict';
const Records = require('./records');
const Intent = require('./intent');

// In-process API adapter. No network, DOM or persistent state.
function createRuntime({
  Studio,
  Engine,
  Versions,
  getCatalog,
  version,
  baseUrl
}) {
  function search(catalog, q) {
    q = String(q || '')
      .trim()
      .toLowerCase();
    if (!q) return [];
    const out = [];
    for (const f of catalog.flowers || []) {
      const hay = [
        f.name,
        ...(f.aliases || []),
        ...(f.roles || []),
        ...(f.colors || [])
      ]
        .join(' ')
        .toLowerCase();
      if (hay.includes(q))
        out.push({
          kind: 'flower',
          id: f.id,
          name: f.name,
          detail: `${(f.roles || []).join(' / ')} · ${f.season || ''}`,
          price: f.price,
          reference_only: Boolean(f.reference_only)
        });
    }
    for (const c of catalog.creative || []) {
      const hay = [c.name, ...(c.aliases || []), c.category]
        .join(' ')
        .toLowerCase();
      if (hay.includes(q))
        out.push({
          kind: 'creative',
          id: c.id,
          name: c.name,
          detail: c.category,
          price: c.price
        });
    }
    return out.slice(0, 30);
  }
  function parseBody(opts) {
    if (!opts || opts.body == null) return {};
    if (typeof opts.body === 'string') return JSON.parse(opts.body || '{}');
    return opts.body;
  }
  function fail(message, status = 400, data = {}) {
    const e = new Error(message);
    e.status = status;
    e.data = { error: message, ...data };
    throw e;
  }
  async function request(rawUrl, opts = {}) {
    const catalog = await getCatalog();
    const u = new URL(rawUrl, baseUrl);
    const method = String(opts.method || 'GET').toUpperCase();
    if (method === 'GET' && u.pathname.endsWith('/api/status'))
      return {
        version,
        mode: 'zero-api-pwa',
        schema: Versions.HANDOFF_SCHEMA,
        catalog: {
          flowers: catalog.flowers.length,
          creative: catalog.creative.length
        },
        features: [
          'recipe-editor',
          'owned-materials',
          'my-prices',
          'reality-engine-v2',
          'composition-engine',
          'stem-blueprint-2',
          'blueprint-editor',
          'vessel-mechanics',
          'build-tracking',
          'loss-tracking',
          'feedback',
          'import-validation',
          'migration-0.5',
          'print-sheet',
          'offline-pwa',
          'indexeddb',
          'render-handoff-1',
          'render-view',
          'render-self-check',
          'creative-locks-1',
          'creative-branching-1',
          'creative-variation-1'
        ]
      };
    if (method === 'GET' && u.pathname.endsWith('/api/catalog'))
      return Studio.publicCatalog(catalog);
    if (method === 'GET' && u.pathname.endsWith('/api/materials/search'))
      return { items: search(catalog, u.searchParams.get('q')) };
    const x = parseBody(opts);
    if (method === 'POST' && u.pathname.endsWith('/api/design/generate')) {
      const plan = Studio.createStudioPlan(catalog, x);
      const v = Studio.validatePlan(plan, catalog, x);
      if (!v.ok) fail('invalid_plan', 500, { details: v.errors });
      return plan;
    }
    if (
      method === 'POST' &&
      u.pathname.endsWith('/api/design/update-exploration')
    ) {
      if (!x.plan) fail('missing_plan');
      return Studio.updateExploration(x.plan, x.patch || x.locks || {});
    }
    if (method === 'POST' && u.pathname.endsWith('/api/design/fork')) {
      if (!x.plan) fail('missing_plan');
      return Studio.forkCreativePlan(x.plan, x.options || {});
    }
    if (
      method === 'POST' &&
      u.pathname.endsWith('/api/design/variation-constraints')
    ) {
      if (!x.plan) fail('missing_plan');
      return Studio.variationConstraints(x.plan);
    }
    if (
      method === 'POST' &&
      u.pathname.endsWith('/api/design/variation-options')
    ) {
      if (!x.plan) fail('missing_plan');
      return Studio.variationOptions(x.plan);
    }
    if (method === 'POST' && u.pathname.endsWith('/api/design/variation')) {
      if (!x.plan) fail('missing_plan');
      return Studio.createVariation(catalog, x.plan, x.preset, x.options || {});
    }
    if (method === 'POST' && u.pathname.endsWith('/api/design/update-recipe')) {
      if (!x.plan) fail('missing_plan');
      return Studio.updateRecipe(catalog, x.plan, x.patches || []);
    }
    if (
      method === 'POST' &&
      u.pathname.endsWith('/api/design/update-blueprint')
    ) {
      if (!x.plan) fail('missing_plan');
      return Studio.updateBlueprint(catalog, x.plan, x.action || {});
    }
    if (method === 'POST' && u.pathname.endsWith('/api/design/update-build')) {
      if (!x.plan) fail('missing_plan');
      return Studio.updateBuild(catalog, x.plan, x.patch || {});
    }
    if (method === 'POST' && u.pathname.endsWith('/api/design/feedback')) {
      if (!x.plan) fail('missing_plan');
      return Studio.recordFeedback(catalog, x.plan, x.feedback || {});
    }
    if (
      method === 'POST' &&
      u.pathname.endsWith('/api/design/validate-import')
    ) {
      const v = Studio.validateImportObject(x, catalog);
      if (!v.ok) fail('invalid_import', 422, v);
      return { ...v, plan: Studio.migratePlan(catalog, x) };
    }
    fail('not_found', 404);
  }
  return { request, Studio, Engine, Records, Intent, getCatalog };
}
module.exports = { createRuntime };
