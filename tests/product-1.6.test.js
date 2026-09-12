'use strict';
const assert = require('assert/strict'),
  S = require('../lib/studio'),
  R = require('../lib/records'),
  I = require('../lib/intent'),
  catalog = require('../data/catalog.json');
let count = 0;
const ok = (x, m) => {
  assert.ok(x, m);
  count++;
};
const make = (idea) => S.createStudioPlan(catalog, { idea, intentVersion: 1 });
let p = make('白绿桌花，不要玫瑰，自然有空隙');
ok(!p.flowers.some((f) => f.name === '玫瑰'), 'negative material omitted');
ok(
  p.flowers.every((f) => ['白', '绿'].includes(f.color)),
  'explicit palette respected'
);
p = make('8枝白玫瑰，3枝白洋桔梗');
ok(
  p.flowers.find((f) => f.name === '玫瑰').quantity === 8,
  'explicit rose quantity'
);
ok(p.flowers.find((f) => f.name === '玫瑰').color === '白', 'explicit color');
ok(
  p.flowers.find((f) => f.name === '洋桔梗').quantity === 3,
  'second material quantity'
);
ok(
  I.inspect(catalog, { idea: '白绿桌花', colors: ['紫色'] }).colors.join(
    '/'
  ) === '白色/绿色',
  'idea overrides default palette'
);
assert.throws(() => make('8枝玫瑰，不要玫瑰'), /同时/);
count++;
p = make('2张照片卡，不要鲜花，不要毛绒娃娃');
ok(
  p.creative.find((c) => c.name === '照片卡').quantity === 2,
  'creative quantity'
);
ok(
  !p.creative.some((c) => c.name === '毛绒娃娃'),
  'negative creative material'
);
p = make('8枝白玫瑰');
const original = JSON.stringify(p),
  key = p.recipe[0].key,
  sig = R.signature(p);
let priced = S.updateRecipe(catalog, p, [{ key, unit_price: null }]);
ok(
  priced.recipe[0].unit_price === null && priced.cost.unknown_prices > 0,
  'unknown price stays unknown'
);
ok(
  S.migratePlan(catalog, S.handoffObject(priced)).recipe[0].unit_price === null,
  'unknown price roundtrip'
);
let actual = S.updateRecipe(catalog, p, [{ key, unit_price: 9.5 }]);
ok(actual.recipe[0].price_source === 'actual', 'actual price provenance');
ok(R.signature(actual) === sig, 'price does not stale image');
let qty = S.updateRecipe(catalog, p, [
  { key, quantity: p.recipe[0].quantity + 1 }
]);
ok(R.signature(qty) !== sig, 'quantity stales image');
let used = S.updateBuild(catalog, p, { key, used: 99, loss: 2 });
ok(
  used.build.usage[key] === 99 && used.build.shortages.length > 0,
  'overuse visible'
);
used = S.migratePlan(catalog, S.handoffObject(used));
ok(used.build.usage[key] === 99, 'overuse survives reload');
let undo = S.updateBuild(catalog, used, { undo: true });
ok(
  undo.build.usage[key] === p.build.usage[key],
  'undo restores previous usage'
);
let prep = S.updateBuild(catalog, p, { prepared: 'water', checked: true });
ok(
  S.migratePlan(catalog, prep).build.preparation.water,
  'preparation survives reload'
);
let locked = S.updateRecord(p, { stage: 'preparing' });
ok(
  Object.values(locked.exploration.locks).every(Boolean),
  'selected making facts locked'
);
ok(JSON.stringify(p) === original, 'domain mutations preserve original');
const old = p.recipe.find((r) => r.kind === 'flower');
const ref = catalog.flowers.find(
  (f) => !p.recipe.some((r) => r.id === f.id) && f.colors.includes('白')
);
const oldNodes = p.blueprint.nodes.filter((n) => n.material_id === old.id);
let replaced = S.replaceMaterial(catalog, p, {
    key: old.key,
    id: ref.id,
    color: '白'
  }),
  row = replaced.recipe.find((r) => r.id === ref.id);
ok(
  row.quantity === old.quantity && row.owned === 0,
  'replacement quantity and owned'
);
ok(row.price_source === 'reference', 'replacement reference price');
ok(
  replaced.blueprint.nodes
    .filter((n) => n.material_id === ref.id)
    .every(
      (n, i) =>
        n.x === oldNodes[i].x && n.y === oldNodes[i].y && n.z === oldNodes[i].z
    ),
  'replacement positions preserved'
);
for (const raw of [
  {},
  [],
  { schema: 'floralab/99', plan: p },
  { ...p, media: {} },
  { ...p, dimensions: { height: NaN, width: 50, depth: 40 } }
])
  ok(!S.validateImportObject(raw, catalog).ok, 'invalid import rejected');
ok(
  S.validateImportObject(S.handoffObject(p), catalog).ok,
  'current roundtrip validated'
);
ok(
  S.validateImportObject({ ...p, media: [] }, catalog).ok,
  'snapshot image metadata is not an attachment envelope'
);
console.log(`product-1.6: ${count} checks passed`);
